export interface AgentSettings {
  hasApiKey: boolean;
  baseUrl: string;
  model: string;
}

export interface TurnState {
  turn_id: string;
  client_message_id: string;
  state: 'starting' | 'running' | 'completed' | 'interrupted' | 'failed';
  started_at: number;
  completed_at?: number | null;
}

export interface ConversationMessage {
  messageId: string;
  turnId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
}

export interface Conversation {
  threadId: string;
  messages: ConversationMessage[];
  activeTurn: TurnState | null;
  activeAssistantText: string;
  recentEvents: AgentEvent[];
  latestSequence: number;
}

export interface AgentStatus {
  configured: boolean;
  appServerReady: boolean;
  appServerRunning: boolean;
  eventReaderHealthy: boolean;
  runtimeState: 'idle' | 'ready' | 'degraded';
  rootDir: string;
  threadId: string;
  activeTurn: TurnState | null;
  latestSequence: number;
}

export interface AgentEvent {
  sequence: number;
  timestamp: number;
  type: string;
  threadId: string;
  turnId: string;
  itemId: string;
  payload: Record<string, unknown>;
}

export interface NotebookContext {
  activeNotebookPath?: string;
  activeCellId?: string;
  selectedCellIds?: string[];
  selectedText?: string;
  activeCellSourceHash?: string;
  kernelSessionId?: string;
}

export interface TurnResult {
  threadId: string;
  turnId: string;
  state: string;
  duplicate: boolean;
}
