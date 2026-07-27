import { ReactWidget } from '@jupyterlab/apputils';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { Contents } from '@jupyterlab/services';
import React, {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import { ApiError, GeoCopilotApi } from './api';
import { RendermimeMarkdown } from './markdown';
import {
  AgentEvent,
  AgentSettings,
  AgentStatus,
  Conversation,
  ConversationMessage,
  NotebookContext
} from './types';

const EVENT_LIMIT = 500;
const ACTIVITY_LIMIT = 80;
const ACTIVITY_OUTPUT_LIMIT = 6000;
const CURSOR_KEY = '@opengeolab/geocopilot:event-cursor';

function uuid(): string {
  return globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

function cellId(cell: NotebookPanel['content']['activeCell']): string {
  if (!cell) {
    return '';
  }
  const shared = cell.model.sharedModel as unknown as {
    getId?: () => string;
  };
  return shared.getId?.() ?? cell.model.id;
}

async function notebookContext(
  tracker: INotebookTracker
): Promise<NotebookContext> {
  const panel = tracker.currentWidget;
  const activeCell = panel?.content.activeCell;
  if (!panel || !activeCell) {
    return {};
  }
  const source = activeCell.model.sharedModel.getSource();
  const editor = activeCell.editor;
  const selection = editor?.getSelection();
  let selectedText = '';
  if (editor && selection) {
    const start = editor.getOffsetAt(selection.start);
    const end = editor.getOffsetAt(selection.end);
    selectedText = source.slice(Math.min(start, end), Math.max(start, end));
  }
  const selectedCellIds = panel.content.widgets
    .filter(cell => panel.content.isSelectedOrActive(cell))
    .map(cell => cellId(cell))
    .filter(Boolean);
  return {
    activeNotebookPath: panel.context.path,
    activeCellId: cellId(activeCell),
    selectedCellIds,
    selectedText,
    activeCellSourceHash: await sha256(source),
    kernelSessionId: panel.sessionContext.session?.id ?? ''
  };
}

function eventItem(event: AgentEvent): Record<string, unknown> {
  const item = event.payload.item;
  return item && typeof item === 'object'
    ? (item as Record<string, unknown>)
    : {};
}

function eventLabel(event: AgentEvent): string {
  if (event.type === 'item/commandExecution/outputDelta') {
    return 'Command output';
  }
  if (event.type === 'item/fileChange/outputDelta') {
    return 'File change';
  }
  if (event.type === 'item/mcpToolCall/progress') {
    return 'Notebook tool progress';
  }
  const item = eventItem(event);
  const type = String(item.type ?? '');
  if (type === 'commandExecution') {
    return event.type === 'item/completed'
      ? 'Workspace command completed'
      : 'Working in the workspace';
  }
  if (type === 'fileChange') {
    return event.type === 'item/completed' ? 'Files updated' : 'Updating files';
  }
  if (type === 'mcpToolCall') {
    return event.type === 'item/completed'
      ? 'Notebook action completed'
      : 'Working with the notebook';
  }
  if (type === 'webSearch') {
    return event.type === 'item/completed'
      ? 'Web search completed'
      : 'Searching the web';
  }
  if (event.type === 'turn/interrupted') {
    return 'Work stopped';
  }
  if (event.type === 'error') {
    return 'Agent error';
  }
  return event.type.replaceAll('/', ' · ');
}

function eventDetail(event: AgentEvent): string {
  const delta = event.payload.delta;
  if (typeof delta === 'string') {
    return delta.slice(-1600);
  }
  const message = event.payload.message;
  if (typeof message === 'string') {
    return message;
  }
  const item = eventItem(event);
  const command = item.command;
  if (typeof command === 'string') {
    return command;
  }
  const changes = item.changes;
  if (Array.isArray(changes)) {
    const paths = changes
      .map(change => {
        if (!change || typeof change !== 'object') {
          return '';
        }
        const value = change as Record<string, unknown>;
        return String(value.path ?? value.file ?? '');
      })
      .filter(Boolean)
      .slice(0, 5);
    return paths.length
      ? paths.join('\n')
      : `${changes.length} file change${changes.length === 1 ? '' : 's'}`;
  }
  const error = event.payload.error;
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object') {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === 'string') {
      return message;
    }
  }
  return '';
}

function isVisibleEvent(event: AgentEvent): boolean {
  if (event.type === 'error' && event.payload.willRetry === true) {
    return false;
  }
  if (['turn/interrupted', 'error'].includes(event.type)) {
    return true;
  }
  if (
    [
      'item/commandExecution/outputDelta',
      'item/fileChange/outputDelta',
      'item/mcpToolCall/progress'
    ].includes(event.type)
  ) {
    return true;
  }
  if (!['item/started', 'item/completed'].includes(event.type)) {
    return false;
  }
  return ['commandExecution', 'fileChange', 'mcpToolCall', 'webSearch'].includes(
    String(eventItem(event).type ?? '')
  );
}

interface AgentActivity {
  key: string;
  sequence: number;
  timestamp: number;
  turnId: string;
  kind: 'command' | 'file' | 'notebook' | 'web' | 'other';
  label: string;
  detail: string;
  running: boolean;
  error: boolean;
  notebookPath?: string;
  notebookActions?: string[];
  notebookOperationKey?: string;
  actionCount?: number;
}

function itemArguments(item: Record<string, unknown>): Record<string, unknown> {
  const value = item.arguments;
  if (value && typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object'
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

function notebookAction(tool: string): string {
  if (tool.endsWith('.run_cell')) {
    return 'run and inspect cell';
  }
  if (tool.endsWith('.read_output')) {
    return 'inspect output';
  }
  if (tool.endsWith('.read') || tool.endsWith('.read_cell')) {
    return 'read notebook';
  }
  if (tool.endsWith('.create')) {
    return 'create notebook';
  }
  if (
    tool.endsWith('.insert_cell') ||
    tool.endsWith('.update_cell') ||
    tool.endsWith('.delete_cell')
  ) {
    return 'edit notebook';
  }
  if (tool.endsWith('.save')) {
    return 'save notebook';
  }
  return 'notebook action';
}

function notebookOperationKey(
  tool: string,
  argumentsValue: Record<string, unknown>
): string {
  const target =
    argumentsValue.cell_id ??
    argumentsValue.output_index ??
    argumentsValue.path ??
    '';
  return `${tool}:${String(target)}`;
}

function compactNotebookActivities(
  activities: AgentActivity[]
): AgentActivity[] {
  const compacted: AgentActivity[] = [];
  const groups = new Map<string, number>();
  const operationErrors = new Map<string, Map<string, boolean>>();

  for (const activity of activities) {
    if (activity.kind !== 'notebook') {
      compacted.push(activity);
      continue;
    }
    const groupKey = `${activity.turnId}:${activity.notebookPath ?? ''}`;
    const errors =
      operationErrors.get(groupKey) ?? new Map<string, boolean>();
    errors.set(
      activity.notebookOperationKey ?? activity.key,
      activity.error
    );
    operationErrors.set(groupKey, errors);
    const hasUnrecoveredError = Array.from(errors.values()).some(Boolean);
    const existingIndex = groups.get(groupKey);
    if (existingIndex === undefined) {
      const actions = activity.notebookActions ?? [];
      const actionCount = activity.actionCount ?? 1;
      compacted.push({
        ...activity,
        key: `notebook:${groupKey}`,
        label: activity.running
          ? 'Working with the notebook'
          : hasUnrecoveredError
            ? 'Notebook work needs attention'
            : 'Notebook work completed',
        detail: [
          activity.notebookPath ?? '',
          `${actionCount} internal action${actionCount === 1 ? '' : 's'}${
            actions.length ? ` · ${actions.join(' · ')}` : ''
          }`
        ]
          .filter(Boolean)
          .join('\n'),
        notebookActions: actions,
        error: hasUnrecoveredError,
        actionCount
      });
      groups.set(groupKey, compacted.length - 1);
      continue;
    }

    const existing = compacted[existingIndex];
    const actions = Array.from(
      new Set([
        ...(existing.notebookActions ?? []),
        ...(activity.notebookActions ?? [])
      ])
    );
    const actionCount =
      (existing.actionCount ?? 1) + (activity.actionCount ?? 1);
    const running = existing.running || activity.running;
    const error = hasUnrecoveredError;
    compacted[existingIndex] = {
      ...existing,
      sequence: Math.max(existing.sequence, activity.sequence),
      running,
      error,
      label: running
        ? 'Working with the notebook'
        : error
          ? 'Notebook work needs attention'
          : 'Notebook work completed',
      detail: [
        existing.notebookPath ?? '',
        `${actionCount} internal actions${
          actions.length ? ` · ${actions.join(' · ')}` : ''
        }`
      ]
        .filter(Boolean)
        .join('\n'),
      notebookActions: actions,
      actionCount
    };
  }

  return compacted;
}

export function projectActivities(events: AgentEvent[]): AgentActivity[] {
  const records = new Map<
    string,
    {
      event: AgentEvent;
      item: Record<string, unknown>;
      output: string;
    }
  >();
  const order: string[] = [];

  for (const event of events.filter(isVisibleEvent)) {
    const key = event.itemId ? `item:${event.itemId}` : `event:${event.sequence}`;
    let record = records.get(key);
    if (!record) {
      record = { event, item: {}, output: '' };
      records.set(key, record);
      order.push(key);
    }
    const item = eventItem(event);
    if (Object.keys(item).length) {
      record.item = item;
    }
    const delta = event.payload.delta;
    if (typeof delta === 'string') {
      record.output += delta;
      if (record.output.length > ACTIVITY_OUTPUT_LIMIT) {
        record.output =
          '[earlier output omitted]\n' +
          record.output.slice(-ACTIVITY_OUTPUT_LIMIT);
      }
    }
    record.event = event;
  }

  const activities = order.map(key => {
    const record = records.get(key)!;
    const itemType = String(record.item.type ?? '');
    const completed = record.event.type === 'item/completed';
    const tool = String(record.item.tool ?? '');
    const argumentsValue = itemArguments(record.item);
    const notebookPath =
      typeof argumentsValue.path === 'string' ? argumentsValue.path : undefined;
    const isNotebookTool =
      itemType === 'mcpToolCall' && tool.startsWith('notebook.');
    const status = String(record.item.status ?? '').toLowerCase();
    const itemFailed = status.includes('fail') || Boolean(record.item.error);
    let label = eventLabel(record.event);
    let kind: AgentActivity['kind'] = 'other';
    if (itemType === 'commandExecution') {
      kind = 'command';
      label = completed
        ? 'Workspace command completed'
        : 'Working in the workspace';
    } else if (itemType === 'fileChange') {
      kind = 'file';
      label = completed ? 'Files updated' : 'Updating files';
    } else if (itemType === 'mcpToolCall') {
      kind = isNotebookTool ? 'notebook' : 'other';
      label = completed
        ? isNotebookTool
          ? 'Notebook action completed'
          : 'Tool action completed'
        : isNotebookTool
          ? 'Working with the notebook'
          : 'Using a tool';
    } else if (itemType === 'webSearch') {
      kind = 'web';
      label = completed ? 'Web search completed' : 'Searching the web';
    }
    const command =
      typeof record.item.command === 'string' ? record.item.command : '';
    const fallbackDetail = eventDetail(record.event);
    const activityDetail =
      record.output || (fallbackDetail === command ? '' : fallbackDetail);
    const detail = [command, activityDetail]
      .filter(Boolean)
      .join('\n');
    return {
      key,
      sequence: record.event.sequence,
      timestamp: record.event.timestamp,
      turnId: record.event.turnId,
      kind,
      label,
      detail,
      running:
        Boolean(itemType) &&
        !completed &&
        record.event.type !== 'turn/interrupted' &&
        record.event.type !== 'error',
      error: record.event.type === 'error' || itemFailed,
      notebookPath,
      notebookActions: isNotebookTool ? [notebookAction(tool)] : undefined,
      notebookOperationKey: isNotebookTool
        ? notebookOperationKey(tool, argumentsValue)
        : undefined,
      actionCount: isNotebookTool ? 1 : undefined
    };
  });
  return compactNotebookActivities(activities);
}

type TranscriptEntry =
  | {
      kind: 'message';
      key: string;
      timestamp: number;
      order: number;
      message: ConversationMessage;
    }
  | {
      kind: 'activity';
      key: string;
      timestamp: number;
      order: number;
      activity: AgentActivity;
    };

function ActivityRow({ activity }: { activity: AgentActivity }) {
  const className = activity.error
    ? 'gc-event gc-event--error'
    : activity.running
      ? 'gc-event gc-event--running'
      : 'gc-event';
  const showDetail = Boolean(activity.detail) && activity.kind !== 'notebook';

  return (
    <div className={className}>
      <span className="gc-event__rail" />
      {showDetail && !activity.error ? (
        <details className="gc-event__details" open={activity.running || undefined}>
          <summary title="Show technical details">{activity.label}</summary>
          <code>{activity.detail}</code>
        </details>
      ) : (
        <div className="gc-event__plain">
          <strong>{activity.label}</strong>
          {showDetail && <code>{activity.detail}</code>}
        </div>
      )}
    </div>
  );
}

function SettingsSheet({
  settings,
  busy,
  onClose,
  onSave
}: {
  settings: AgentSettings;
  busy: boolean;
  onClose: () => void;
  onSave: (value: {
    apiKey?: string;
    baseUrl: string;
    model: string;
    clearApiKey?: boolean;
  }) => Promise<void>;
}) {
  const [key, setKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [model, setModel] = useState(settings.model);
  const [clearKey, setClearKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave({
        apiKey: key || undefined,
        baseUrl,
        model,
        clearApiKey: clearKey
      });
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="gc-sheetBackdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="gc-sheet"
        onSubmit={submit}
        onMouseDown={event => event.stopPropagation()}
      >
        <div className="gc-sheet__header">
          <h2>Connection settings</h2>
          <button
            className="gc-iconButton"
            type="button"
            aria-label="Close settings"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <label>
          <span>API key</span>
          <input
            type="password"
            autoComplete="off"
            value={key}
            placeholder={settings.hasApiKey ? 'Saved — enter only to replace' : 'sk-…'}
            onChange={event => {
              setKey(event.target.value);
              setClearKey(false);
            }}
          />
        </label>
        {settings.hasApiKey && (
          <label className="gc-check">
            <input
              type="checkbox"
              checked={clearKey}
              onChange={event => {
                setClearKey(event.target.checked);
                if (event.target.checked) {
                  setKey('');
                }
              }}
            />
            <span>Remove saved API key</span>
          </label>
        )}
        <label>
          <span>
            Base URL <small>optional · usually ends in /v1</small>
          </span>
          <input
            value={baseUrl}
            placeholder="https://api.openai.com/v1"
            onChange={event => setBaseUrl(event.target.value)}
          />
        </label>
        <label>
          <span>Model</span>
          <input value={model} onChange={event => setModel(event.target.value)} />
        </label>
        {busy && (
          <p className="gc-notice">Settings can be changed after the active turn finishes.</p>
        )}
        {error && <p className="gc-error">{error}</p>}
        <div className="gc-sheet__actions">
          <button type="button" className="gc-button gc-button--quiet" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="gc-button gc-button--primary"
            disabled={busy || saving || !model.trim()}
          >
            {saving ? 'Saving…' : 'Save & restart agent'}
          </button>
        </div>
      </form>
    </div>
  );
}

function GeoCopilotView({
  tracker,
  rendermime,
  contents
}: {
  tracker: INotebookTracker;
  rendermime: IRenderMimeRegistry;
  contents: Contents.IManager;
}) {
  const api = useMemo(() => new GeoCopilotApi(), []);
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [settings, setSettings] = useState<AgentSettings | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [liveText, setLiveText] = useState('');
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const cursor = useRef(Number(window.localStorage.getItem(CURSOR_KEY) ?? '0') || 0);
  const bottom = useRef<HTMLDivElement>(null);
  const composing = useRef(false);

  const refresh = useCallback(async () => {
    const [nextStatus, nextSettings, nextConversation] = await Promise.all([
      api.status(),
      api.settingsView(),
      api.conversation()
    ]);
    if (nextConversation.latestSequence < cursor.current) {
      cursor.current = 0;
      window.localStorage.setItem(CURSOR_KEY, '0');
    }
    setStatus(nextStatus);
    setSettings(nextSettings);
    setConversation(nextConversation);
    setEvents(nextConversation.recentEvents.filter(isVisibleEvent).slice(-EVENT_LIMIT));
    setLiveText(nextConversation.activeAssistantText || '');
  }, [api]);

  useEffect(() => {
    void refresh().catch(reason => {
      setError(reason instanceof Error ? reason.message : String(reason));
    });
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refresh().catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retry: number | null = null;
    let closed = false;
    let delay = 500;

    const connect = () => {
      if (closed) {
        return;
      }
      socket = new WebSocket(api.eventsUrl(cursor.current));
      socket.onopen = () => {
        delay = 500;
      };
      socket.onmessage = message => {
        const event = JSON.parse(String(message.data)) as AgentEvent;
        if (event.sequence <= cursor.current) {
          return;
        }
        cursor.current = event.sequence;
        window.localStorage.setItem(CURSOR_KEY, String(event.sequence));
        if (event.type === 'item/agentMessage/delta') {
          const delta = event.payload.delta;
          if (typeof delta === 'string') {
            setLiveText(value => value + delta);
          }
        }
        if (isVisibleEvent(event)) {
          setEvents(value => [...value, event].slice(-EVENT_LIMIT));
        }
        if (
          event.type === 'turn/completed' ||
          event.type === 'turn/interrupted' ||
          event.type === 'conversation/reset'
        ) {
          setLiveText('');
          void refresh();
        }
      };
      socket.onerror = () => socket?.close();
      socket.onclose = () => {
        if (!closed) {
          retry = window.setTimeout(connect, delay);
          delay = Math.min(delay * 2, 10_000);
        }
      };
    };
    connect();
    return () => {
      closed = true;
      if (retry !== null) {
        window.clearTimeout(retry);
      }
      socket?.close();
    };
  }, [api, refresh]);

  const activities = useMemo(
    () => projectActivities(events).slice(-ACTIVITY_LIMIT),
    [events]
  );
  const timeline = useMemo<TranscriptEntry[]>(() => {
    const messages: TranscriptEntry[] = (conversation?.messages ?? []).map(
      (message, index) => ({
        kind: 'message',
        key: `message:${message.messageId}`,
        timestamp: message.createdAt,
        order: index,
        message
      })
    );
    const projectedActivities: TranscriptEntry[] = activities.map(activity => ({
      kind: 'activity',
      key: `activity:${activity.key}`,
      timestamp: activity.timestamp,
      order: activity.sequence,
      activity
    }));
    const priority = (entry: TranscriptEntry): number =>
      entry.kind === 'activity'
        ? 1
        : entry.message.role === 'user'
          ? 0
          : 2;
    return [...messages, ...projectedActivities].sort(
      (left, right) =>
        left.timestamp - right.timestamp ||
        priority(left) - priority(right) ||
        left.order - right.order ||
        left.key.localeCompare(right.key)
    );
  }, [activities, conversation?.messages]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [conversation?.messages.length, activities.length, liveText]);

  const activeTurn = status?.activeTurn ?? conversation?.activeTurn;
  const busy = submitting || Boolean(activeTurn);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const message = text.trim();
    if (!message || busy) {
      return;
    }
    setError('');
    setSubmitting(true);
    setText('');
    setLiveText('');
    const optimistic = {
      messageId: `local-${uuid()}`,
      turnId: '',
      role: 'user' as const,
      content: message,
      createdAt: Date.now() / 1000
    };
    setConversation(value =>
      value ? { ...value, messages: [...value.messages, optimistic] } : value
    );
    try {
      const context = await notebookContext(tracker);
      await api.startTurn(message, uuid(), context);
      await refresh();
    } catch (reason) {
      setText(message);
      setError(reason instanceof ApiError ? reason.message : String(reason));
      await refresh().catch(() => undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async () => {
    const turn = activeTurn;
    if (!turn) {
      return;
    }
    setError('');
    try {
      await api.cancelTurn(turn.turn_id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  const reset = async () => {
    if (!window.confirm('Start a new GeoCopilot conversation?')) {
      return;
    }
    setError('');
    try {
      await api.resetConversation();
      setEvents([]);
      setLiveText('');
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  return (
    <div className="gc-root">
      <main className="gc-transcript" aria-live="polite">
        {!timeline.length && !liveText && (
          <section className="gc-empty">
            <h2>How can I help?</h2>
            <p>Work across notebooks, code, data, and the terminal.</p>
          </section>
        )}

        {timeline.map(entry =>
          entry.kind === 'message' ? (
            <article
              key={entry.key}
              className={`gc-message gc-message--${entry.message.role}`}
            >
              <div className="gc-message__content">
                {entry.message.role === 'assistant' ? (
                  <RendermimeMarkdown
                    source={entry.message.content}
                    complete
                    registry={rendermime}
                    contents={contents}
                    workspaceRoot={status?.rootDir ?? ''}
                  />
                ) : (
                  entry.message.content
                )}
              </div>
            </article>
          ) : (
            <ActivityRow key={entry.key} activity={entry.activity} />
          )
        )}

        {liveText && (
          <article className="gc-message gc-message--assistant gc-message--live">
            <div className="gc-message__content">
              <RendermimeMarkdown
                source={liveText}
                complete={false}
                registry={rendermime}
                contents={contents}
                workspaceRoot={status?.rootDir ?? ''}
              />
            </div>
          </article>
        )}
        {busy && !liveText && (
          <div className="gc-thinking">
            <span />
            <span />
            <span />
            <small>Working…</small>
          </div>
        )}
        <div ref={bottom} />
      </main>

      <footer className="gc-composer">
        {error && <p className="gc-error">{error}</p>}
        {!status?.configured && (
          <button className="gc-configure" onClick={() => setShowSettings(true)}>
            Add an API key to start the agent
          </button>
        )}
        <form onSubmit={submit}>
          <textarea
            rows={3}
            value={text}
            disabled={busy || !status?.configured}
            placeholder={
              busy
                ? 'GeoCopilot is working…'
                : 'Ask about this workspace, write code, or work with a notebook…'
            }
            onChange={event => setText(event.target.value)}
            onCompositionStart={() => {
              composing.current = true;
            }}
            onCompositionEnd={() => {
              composing.current = false;
            }}
            onBlur={() => {
              composing.current = false;
            }}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey) {
                const nativeEvent = event.nativeEvent;
                if (
                  composing.current ||
                  nativeEvent.isComposing ||
                  nativeEvent.keyCode === 229
                ) {
                  return;
                }
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <div className="gc-composer__bar">
            <div className="gc-composer__secondary">
              <button
                type="button"
                className="gc-reset"
                disabled={busy}
                onClick={() => void reset()}
              >
                New conversation
              </button>
              <button
                type="button"
                className="gc-settings"
                aria-label="Connection settings"
                onClick={() => setShowSettings(true)}
              >
                Settings
              </button>
            </div>
            {submitting && !activeTurn ? (
              <button
                type="button"
                className="gc-button gc-button--quiet"
                disabled
              >
                Starting…
              </button>
            ) : busy ? (
              <button
                type="button"
                className="gc-button gc-button--cancel"
                onClick={() => void cancel()}
              >
                Stop turn
              </button>
            ) : (
              <button
                type="submit"
                className="gc-send"
                disabled={!text.trim() || !status?.configured}
                aria-label="Send message"
              >
                <span>Send</span>
                <b>↗</b>
              </button>
            )}
          </div>
        </form>
      </footer>

      {showSettings && settings && (
        <SettingsSheet
          settings={settings}
          busy={busy}
          onClose={() => setShowSettings(false)}
          onSave={async value => {
            await api.updateSettings(value);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

export class GeoCopilotPanel extends ReactWidget {
  constructor(
    private readonly tracker: INotebookTracker,
    private readonly rendermime: IRenderMimeRegistry,
    private readonly contents: Contents.IManager
  ) {
    super();
    this.addClass('gc-panelHost');
  }

  protected render(): React.ReactElement {
    return (
      <GeoCopilotView
        tracker={this.tracker}
        rendermime={this.rendermime}
        contents={this.contents}
      />
    );
  }
}
