import { expect, Page, test } from '@playwright/test';

type Turn = {
  turn_id: string;
  client_message_id: string;
  state: 'running' | 'completed' | 'interrupted';
  started_at: number;
  completed_at: number | null;
};

type MockState = {
  configured: boolean;
  hasApiKey: boolean;
  activeTurn: Turn | null;
  messages: Array<{
    messageId: string;
    turnId: string;
    role: 'user' | 'assistant';
    content: string;
    createdAt: number;
  }>;
  recentEvents: Array<Record<string, unknown>>;
  latestSequence: number;
  activeAssistantText?: string;
  submitted?: Record<string, unknown>;
  cancelled?: string;
};

const labUrl =
  process.env.GEOCOPILOT_UI_URL ??
  'http://127.0.0.1:8899/lab?token=geocopilot-ui-test';

function runningTurn(): Turn {
  return {
    turn_id: 'turn-ui-1',
    client_message_id: 'client-ui-1',
    state: 'running',
    started_at: Date.now() / 1000,
    completed_at: null
  };
}

async function mockAgentApi(page: Page, state: MockState): Promise<void> {
  await page.route('**/geocopilot/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = (value: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(value)
      });

    if (path.endsWith('/status')) {
      return json({
        configured: state.configured,
        appServerReady: Boolean(state.activeTurn),
        appServerRunning: Boolean(state.activeTurn),
        eventReaderHealthy: Boolean(state.activeTurn),
        runtimeState: state.activeTurn ? 'ready' : 'idle',
        rootDir: '/workspace',
        threadId: 'thread-ui',
        activeTurn: state.activeTurn,
        latestSequence: state.latestSequence
      });
    }
    if (path.endsWith('/settings')) {
      if (request.method() === 'PUT') {
        const body = request.postDataJSON() as {
          apiKey?: string;
          clearApiKey?: boolean;
        };
        if (body.clearApiKey) {
          state.hasApiKey = false;
          state.configured = false;
        } else if (body.apiKey) {
          state.hasApiKey = true;
          state.configured = true;
        }
      }
      return json({
        hasApiKey: state.hasApiKey,
        baseUrl: '',
        model: 'gpt-5.4'
      });
    }
    if (path.endsWith('/conversation')) {
      return json({
        threadId: 'thread-ui',
        messages: state.messages,
        activeTurn: state.activeTurn,
        activeAssistantText: state.activeAssistantText ?? '',
        recentEvents: state.recentEvents,
        latestSequence: state.latestSequence
      });
    }
    if (path.endsWith('/turn') && request.method() === 'POST') {
      state.submitted = request.postDataJSON() as Record<string, unknown>;
      state.activeTurn = runningTurn();
      state.messages.push({
        messageId: 'server-user-message',
        turnId: state.activeTurn.turn_id,
        role: 'user',
        content: String(state.submitted.message),
        createdAt: Date.now() / 1000
      });
      return json(
        {
          threadId: 'thread-ui',
          turnId: state.activeTurn.turn_id,
          state: 'running',
          duplicate: false
        },
        202
      );
    }
    const cancel = path.match(/\/turn\/([^/]+)\/cancel$/);
    if (cancel && request.method() === 'POST') {
      state.cancelled = decodeURIComponent(cancel[1]);
      return json({ ok: true, turnId: state.cancelled }, 202);
    }
    if (path.endsWith('/conversation/reset')) {
      state.messages = [];
      state.recentEvents = [];
      state.latestSequence += 1;
      return json({ ok: true });
    }
    return json({ error: 'not_found' }, 404);
  });
}

async function openPanel(page: Page): Promise<void> {
  await page.goto(labUrl);
  const news = page.getByRole('button', { name: 'No', exact: true });
  if (await news.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await news.click();
  }
  await expect(page.locator('.gc-root')).toBeVisible();
}

test('GeoCopilot opens by default after JupyterLab restores', async ({
  page
}) => {
  const state: MockState = {
    configured: true,
    hasApiKey: true,
    activeTurn: null,
    messages: [],
    recentEvents: [],
    latestSequence: 0
  };
  await mockAgentApi(page, state);
  await page.goto(labUrl);
  const news = page.getByRole('button', { name: 'No', exact: true });
  if (await news.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await news.click();
  }

  await expect(page.getByRole('tab', { name: 'GeoCopilot' })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  await expect(page.locator('.gc-root')).toBeVisible();
});

test('settings keep the API key write-only', async ({ page }) => {
  const state: MockState = {
    configured: false,
    hasApiKey: false,
    activeTurn: null,
    messages: [],
    recentEvents: [],
    latestSequence: 0
  };
  await mockAgentApi(page, state);
  await openPanel(page);

  await expect(
    page.getByRole('textbox', {
      name: 'Ask about this workspace, write code, or work with a notebook…'
    })
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Add an API key to start the agent' }).click();
  const key = page.getByRole('textbox', { name: 'API key', exact: true });
  await expect(key).toHaveAttribute('type', 'password');
  await key.fill('secret-never-returned');
  await page.getByRole('button', { name: 'Save & restart agent' }).click();

  await page.getByRole('button', { name: 'Connection settings' }).click();
  const savedKey = page.getByRole('textbox', { name: 'API key', exact: true });
  await expect(savedKey).toHaveValue('');
  await expect(savedKey).toHaveAttribute(
    'placeholder',
    'Saved — enter only to replace'
  );
});

test('streaming assistant text uses native Markdown rendering', async ({ page }) => {
  const state: MockState = {
    configured: true,
    hasApiKey: true,
    activeTurn: runningTurn(),
    messages: [],
    activeAssistantText: '**Searching** for `runoff` models…',
    recentEvents: [],
    latestSequence: 0
  };
  await mockAgentApi(page, state);
  await openPanel(page);

  await expect(page.getByText('Searching', { exact: true })).toHaveCSS(
    'font-weight',
    '700'
  );
  await expect(page.getByText('runoff', { exact: true })).toHaveCSS(
    'font-family',
    /Mono|Consolas/
  );
});

test('workspace absolute links open through JupyterLab instead of browser navigation', async ({
  page
}) => {
  const state: MockState = {
    configured: true,
    hasApiKey: true,
    activeTurn: null,
    messages: [
      {
        messageId: 'assistant-workspace-link',
        turnId: 'turn-workspace-link',
        role: 'assistant',
        content:
          '[Open notebook](/workspace/noname.ipynb)\n\n' +
          '[External documentation](https://jupyterlab.readthedocs.io/)',
        createdAt: Date.now() / 1000
      }
    ],
    recentEvents: [],
    latestSequence: 0
  };
  await mockAgentApi(page, state);
  await openPanel(page);

  const workspaceLink = page.getByRole('link', { name: 'Open notebook' });
  await expect(workspaceLink).toHaveAttribute(
    'href',
    /\/files\/noname\.ipynb(?:\?.*)?$/
  );
  const labLocation = page.url();
  await workspaceLink.click();
  await page.waitForTimeout(250);
  expect(page.url()).toBe(labLocation);

  await expect(
    page.getByRole('link', { name: 'External documentation' })
  ).toHaveAttribute('href', 'https://jupyterlab.readthedocs.io/');
});

test('notebook execution and observation are grouped into one activity', async ({
  page
}) => {
  const baseTime = Date.now() / 1000;
  const notebookItem = (
    id: string,
    tool: string,
    sequence: number,
    cellId: string
  ) => ({
    sequence,
    timestamp: baseTime + sequence / 100,
    type: 'item/completed',
    threadId: 'thread-ui',
    turnId: 'turn-notebook-loop',
    itemId: id,
    payload: {
      item: {
        type: 'mcpToolCall',
        id,
        server: 'jupyter-mcp',
        tool,
        status: 'completed',
        arguments: {
          path: 'noname.ipynb',
          cell_id: cellId
        }
      }
    }
  });
  const state: MockState = {
    configured: true,
    hasApiKey: true,
    activeTurn: null,
    messages: [],
    recentEvents: [
      notebookItem('item-update', 'notebook.update_cell', 1, 'plot-cell'),
      notebookItem('item-run', 'notebook.run_cell', 2, 'plot-cell'),
      notebookItem('item-read', 'notebook.read_output', 3, 'plot-cell')
    ],
    latestSequence: 3
  };
  await mockAgentApi(page, state);
  await openPanel(page);

  const activity = page.getByText('Notebook work completed');
  await expect(activity).toHaveCount(1);
  await expect(page.getByText('Notebook action completed')).toHaveCount(0);
  await expect(page.getByText(/3 internal actions/)).toHaveCount(0);
  await expect(page.getByText(/run and inspect cell/)).toHaveCount(0);
  await expect(page.getByText(/inspect output/)).toHaveCount(0);
});

test('a successful notebook retry clears a transient failure', async ({
  page
}) => {
  const baseTime = Date.now() / 1000;
  const notebookItem = (
    id: string,
    sequence: number,
    status: 'completed' | 'failed'
  ) => ({
    sequence,
    timestamp: baseTime + sequence / 100,
    type: 'item/completed',
    threadId: 'thread-ui',
    turnId: 'turn-retry',
    itemId: id,
    payload: {
      item: {
        type: 'mcpToolCall',
        id,
        server: 'jupyter-mcp',
        tool: 'notebook.save',
        status,
        arguments: {
          path: 'noname.ipynb'
        }
      }
    }
  });
  const state: MockState = {
    configured: true,
    hasApiKey: true,
    activeTurn: null,
    messages: [],
    recentEvents: [
      notebookItem('item-save-conflict', 1, 'failed'),
      notebookItem('item-save-retry', 2, 'completed')
    ],
    latestSequence: 2
  };
  await mockAgentApi(page, state);
  await openPanel(page);

  await expect(page.getByText('Notebook work completed')).toHaveCount(1);
  await expect(page.getByText('Notebook work needs attention')).toHaveCount(0);
});

test('IME confirmation Enter does not submit the message', async ({ page }) => {
  const state: MockState = {
    configured: true,
    hasApiKey: true,
    activeTurn: null,
    messages: [],
    recentEvents: [],
    latestSequence: 0
  };
  await mockAgentApi(page, state);
  await openPanel(page);

  const composer = page.getByRole('textbox', {
    name: 'Ask about this workspace, write code, or work with a notebook…'
  });
  await composer.fill('你好');
  await composer.dispatchEvent('compositionstart', { data: '好' });
  await composer.dispatchEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    isComposing: true,
    keyCode: 229
  });

  expect(state.submitted).toBeUndefined();
  await expect(composer).toHaveValue('你好');

  await composer.dispatchEvent('compositionend', { data: '好' });
  await composer.press('Enter');
  expect(state.submitted?.message).toBe('你好');
});

test('one submit locks input, exposes cancel, and preserves activity projection', async ({
  page
}) => {
  const baseTime = Date.now() / 1000;
  const state: MockState = {
    configured: true,
    hasApiKey: true,
    activeTurn: null,
    messages: [
      {
        messageId: 'user-previous',
        turnId: 'turn-previous',
        role: 'user',
        content: 'Inspect the existing workspace',
        createdAt: baseTime
      },
      {
        messageId: 'assistant-previous',
        turnId: 'turn-previous',
        role: 'assistant',
        content:
          '## Previous answer\n\n- **Model A** uses `P`\n\n' +
          '| Model | Input |\n| --- | --- |\n| SCS | Rainfall |\n\n' +
          '```python\nprint("hello")\n```',
        createdAt: baseTime + 2
      }
    ],
    recentEvents: [
      {
        sequence: 1,
        timestamp: baseTime + 0.05,
        type: 'turn/accepted',
        threadId: 'thread-ui',
        turnId: 'turn-previous',
        itemId: '',
        payload: {}
      },
      {
        sequence: 2,
        timestamp: baseTime + 0.06,
        type: 'turn/accepted',
        threadId: 'thread-ui',
        turnId: 'turn-previous',
        itemId: '',
        payload: {}
      },
      {
        sequence: 3,
        timestamp: baseTime + 0.1,
        type: 'item/started',
        threadId: 'thread-ui',
        turnId: 'turn-previous',
        itemId: 'item-command',
        payload: {
          item: { type: 'commandExecution', command: 'python analysis.py' }
        }
      },
      {
        sequence: 4,
        timestamp: baseTime + 0.2,
        type: 'item/commandExecution/outputDelta',
        threadId: 'thread-ui',
        turnId: 'turn-previous',
        itemId: 'item-command',
        payload: { delta: 'first line\n' }
      },
      {
        sequence: 5,
        timestamp: baseTime + 0.3,
        type: 'item/commandExecution/outputDelta',
        threadId: 'thread-ui',
        turnId: 'turn-previous',
        itemId: 'item-command',
        payload: { delta: 'second line\n' }
      },
      {
        sequence: 6,
        timestamp: baseTime + 0.4,
        type: 'item/completed',
        threadId: 'thread-ui',
        turnId: 'turn-previous',
        itemId: 'item-command',
        payload: {
          item: { type: 'commandExecution', command: 'python analysis.py' }
        }
      },
      {
        sequence: 7,
        timestamp: baseTime + 0.5,
        type: 'error',
        threadId: 'thread-ui',
        turnId: 'turn-previous',
        itemId: '',
        payload: {
          error: { message: 'Reconnecting... 1/5' },
          willRetry: true
        }
      },
      {
        sequence: 8,
        timestamp: baseTime + 0.6,
        type: 'error',
        threadId: 'thread-ui',
        turnId: 'turn-previous',
        itemId: '',
        payload: {
          error: { message: 'Provider rejected request' },
          willRetry: false
        }
      }
    ],
    latestSequence: 8
  };
  await mockAgentApi(page, state);
  await openPanel(page);

  await expect(page.locator('.gc-header')).toHaveCount(0);
  await expect(page.locator('.gc-brandMark')).toHaveCount(0);
  await expect(page.locator('.gc-connection')).toHaveCount(0);
  await expect(page.locator('.gc-message__meta')).toHaveCount(0);
  await expect(page.locator('.gc-root')).toHaveCSS(
    'background-color',
    'rgb(255, 255, 255)'
  );
  const assistantRule = await page
    .locator('.gc-message--assistant')
    .first()
    .evaluate(element => {
      const style = getComputedStyle(element, '::before');
      return {
        backgroundImage: style.backgroundImage,
        backgroundColor: style.backgroundColor
      };
    });
  expect(assistantRule.backgroundImage).toBe('none');
  expect(assistantRule.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  await expect(
    page.getByRole('button', { name: 'Connection settings' })
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Previous answer', level: 2 })
  ).toBeVisible();
  await expect(page.getByRole('listitem')).toContainText('Model A uses P');
  await expect(page.getByRole('table')).toBeVisible();
  const answerCodeBlock = page.locator('.gc-message--assistant pre');
  await expect(answerCodeBlock).toHaveCount(1);
  const answerCodeLayout = await answerCodeBlock.evaluate(element => {
    const block = element.getBoundingClientRect();
    const answer = element.closest('.gc-message__content')!.getBoundingClientRect();
    return {
      backgroundColor: getComputedStyle(element).backgroundColor,
      width: block.width,
      answerWidth: answer.width
    };
  });
  expect(answerCodeLayout.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  expect(Math.abs(answerCodeLayout.width - answerCodeLayout.answerWidth)).toBeLessThan(1);
  const answerCodeText = page.locator(
    '.gc-message--assistant pre > code'
  );
  await expect(answerCodeText).toHaveCount(1);
  await expect(answerCodeText).toHaveCSS(
    'background-color',
    'rgba(0, 0, 0, 0)'
  );
  await expect(page.getByText('workspace signal', { exact: true })).toHaveCount(0);
  await expect(page.getByText('No notebook focused', { exact: true })).toHaveCount(0);
  await expect(page.getByText('context, not boundary', { exact: true })).toHaveCount(0);
  await expect(page.getByText('turn · accepted')).toHaveCount(0);
  const command = page.getByText('Workspace command completed');
  await expect(command).toHaveCount(1);
  const commandOutput = page.getByText(/first line\s+second line/);
  await expect(commandOutput).toBeHidden();
  await command.click();
  await expect(commandOutput).toBeVisible();
  const shellCodeBlock = page.locator('.gc-event__details code');
  await expect(shellCodeBlock).toHaveCount(1);
  const shellCodeLayout = await shellCodeBlock.evaluate(element => {
    const block = element.getBoundingClientRect();
    const activity = element.parentElement!.getBoundingClientRect();
    return {
      backgroundColor: getComputedStyle(element).backgroundColor,
      width: block.width,
      activityWidth: activity.width
    };
  });
  expect(shellCodeLayout.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  expect(Math.abs(shellCodeLayout.width - shellCodeLayout.activityWidth)).toBeLessThan(1);
  await expect(page.getByText('Agent error')).toHaveCount(1);
  await expect(page.getByText('Provider rejected request')).toBeVisible();
  await expect(page.getByText('Reconnecting... 1/5')).toHaveCount(0);
  const transcript = await page
    .locator('.gc-transcript > .gc-message, .gc-transcript > .gc-event')
    .allTextContents();
  const userIndex = transcript.findIndex(value =>
    value.includes('Inspect the existing workspace')
  );
  const commandIndex = transcript.findIndex(value =>
    value.includes('Workspace command completed')
  );
  const answerIndex = transcript.findIndex(value =>
    value.includes('Previous answer')
  );
  expect(userIndex).toBeGreaterThanOrEqual(0);
  expect(commandIndex).toBeGreaterThan(userIndex);
  expect(answerIndex).toBeGreaterThan(commandIndex);
  const composer = page.getByRole('textbox', {
    name: 'Ask about this workspace, write code, or work with a notebook…'
  });
  await composer.fill('Inspect the workspace');
  await page.getByRole('button', { name: 'Send message' }).click();

  await expect(page.getByRole('button', { name: 'Stop turn' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'GeoCopilot is working…' })).toBeDisabled();
  await expect(page.getByText('Working…')).toBeVisible();
  await expect(page.getByRole('button', { name: 'New conversation' })).toBeDisabled();
  expect(state.submitted?.message).toBe('Inspect the workspace');
  expect(state.submitted?.context).toEqual({});

  await page.getByRole('button', { name: 'Stop turn' }).click();
  expect(state.cancelled).toBe('turn-ui-1');
});
