// Message roles
export type MessageRole = 'user' | 'assistant' | 'system';

// Chat message
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
  /** True while assistant response is still streaming in */
  isStreaming?: boolean;
}

// Tool call and result
export interface ToolCall {
  id: string;
  name: string;
  parameters: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: ToolResult;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// Tool definition (for registry)
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, ToolParameter>;
  requiresConfirmation?: boolean;
}

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
  default?: unknown;
}

// Session
export interface Session {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

// Connection status
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// Model info
export interface ModelInfo {
  id: string;
  name: string;
}

// Tab info
export interface TabInfo {
  id: number;
  title: string;
  url: string;
  active: boolean;
  windowId: number;
  favIconUrl?: string;
}
