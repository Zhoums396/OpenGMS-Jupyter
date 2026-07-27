import { URLExt } from '@jupyterlab/coreutils';
import { ServerConnection } from '@jupyterlab/services';

import {
  AgentSettings,
  AgentStatus,
  Conversation,
  NotebookContext,
  TurnResult
} from './types';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string
  ) {
    super(message);
  }
}

export class GeoCopilotApi {
  private readonly settings = ServerConnection.makeSettings();

  async status(): Promise<AgentStatus> {
    return this.request<AgentStatus>('status');
  }

  async settingsView(): Promise<AgentSettings> {
    return this.request<AgentSettings>('settings');
  }

  async updateSettings(payload: {
    apiKey?: string;
    baseUrl: string;
    model: string;
    clearApiKey?: boolean;
  }): Promise<AgentSettings> {
    return this.request<AgentSettings>('settings', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  }

  async conversation(): Promise<Conversation> {
    return this.request<Conversation>('conversation');
  }

  async startTurn(
    message: string,
    clientMessageId: string,
    context: NotebookContext
  ): Promise<TurnResult> {
    return this.request<TurnResult>('turn', {
      method: 'POST',
      body: JSON.stringify({ message, clientMessageId, context })
    });
  }

  async cancelTurn(turnId: string): Promise<void> {
    await this.request(`turn/${encodeURIComponent(turnId)}/cancel`, {
      method: 'POST',
      body: '{}'
    });
  }

  async resetConversation(): Promise<void> {
    await this.request('conversation/reset', {
      method: 'POST',
      body: '{}'
    });
  }

  eventsUrl(after: number): string {
    const url = new URL(
      URLExt.join(this.settings.wsUrl, 'geocopilot', 'api', 'events')
    );
    url.searchParams.set('after', String(after));
    if (this.settings.token) {
      url.searchParams.set('token', this.settings.token);
    }
    return url.toString();
  }

  private async request<T = unknown>(
    path: string,
    init: RequestInit = {}
  ): Promise<T> {
    const response = await ServerConnection.makeRequest(
      URLExt.join(this.settings.baseUrl, 'geocopilot', 'api', path),
      {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(init.headers ?? {})
        }
      },
      this.settings
    );
    if (!response.ok) {
      let data: { error?: string; message?: string } = {};
      try {
        data = (await response.json()) as typeof data;
      } catch {
        // Jupyter may return an HTML error page for failures before our handler.
      }
      throw new ApiError(
        data.message || response.statusText || 'GeoCopilot request failed',
        response.status,
        data.error || 'request_failed'
      );
    }
    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  }
}

