import type { ChatMessage, ToolCall, ToolResult, ConnectionStatus, TabInfo } from './types';

// Direction: Panel -> Background
export type PanelMessage =
  | { type: 'SEND_CHAT_MESSAGE'; payload: { content: string; sessionId: string } }
  | { type: 'CANCEL_REQUEST'; payload: { sessionId: string } }
  | { type: 'GET_CONNECTION_STATUS' }
  | { type: 'CONNECT_TO_HOST' }
  | { type: 'DISCONNECT_FROM_HOST' }
  | { type: 'GET_OPEN_TABS' }
  | { type: 'EXECUTE_TOOL'; payload: { toolCall: ToolCall } };

// Direction: Background -> Panel
export type BackgroundMessage =
  | { type: 'CHAT_RESPONSE_CHUNK'; payload: { chunk: string; sessionId: string } }
  | { type: 'CHAT_RESPONSE_COMPLETE'; payload: { message: ChatMessage; sessionId: string } }
  | { type: 'CHAT_RESPONSE_ERROR'; payload: { error: string; sessionId: string } }
  | { type: 'TOOL_CALL_START'; payload: { toolCall: ToolCall; sessionId: string } }
  | { type: 'TOOL_CALL_RESULT'; payload: { toolCallId: string; result: ToolResult; sessionId: string } }
  | { type: 'CONNECTION_STATUS_CHANGED'; payload: { status: ConnectionStatus; error?: string | null } }
  | { type: 'OPEN_TABS'; payload: { tabs: TabInfo[] } };

// Direction: Background -> Content Script
export type ContentScriptMessage =
  | { type: 'GET_PAGE_CONTENT' }
  | { type: 'GET_PAGE_HTML'; payload?: { selector?: string } }
  | { type: 'GET_PAGE_STRUCTURE' }
  | { type: 'QUERY_SELECTOR'; payload: { selector: string } }
  | { type: 'QUERY_SELECTOR_ALL'; payload: { selector: string } }
  | { type: 'GET_PAGE_TABLES' }
  | { type: 'GET_PAGE_LINKS' }
  | { type: 'GET_PAGE_FORMS' }
  | { type: 'CLICK_ELEMENT'; payload: { selector: string } }
  | { type: 'TYPE_TEXT'; payload: { selector: string; text: string } }
  | { type: 'FILL_FORM'; payload: { fields: Record<string, string> } }
  | { type: 'SELECT_OPTION'; payload: { selector: string; value: string } }
  | { type: 'SCROLL_PAGE'; payload: { direction?: 'up' | 'down'; amount?: number; selector?: string } }
  | { type: 'PRESS_KEY'; payload: { key: string } }
  | { type: 'HOVER_ELEMENT'; payload: { selector: string } }
  | { type: 'HIGHLIGHT_ELEMENT'; payload: { selector: string; color?: string } }
  | { type: 'EXECUTE_JAVASCRIPT'; payload: { code: string } }
  | { type: 'WAIT_FOR_ELEMENT'; payload: { selector: string; timeout?: number } }
  | { type: 'HOVER_ELEMENT'; payload: { selector: string } };

// Content Script -> Background response
export interface ContentScriptResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

// Native messaging (Background <-> Host)
export type NativeMessage =
  | { type: 'COPILOT_REQUEST'; payload: { method: string; params: unknown } }
  | { type: 'COPILOT_RESPONSE'; payload: { id: string; result?: unknown; error?: unknown } }
  | { type: 'COPILOT_STREAM'; payload: { id: string; chunk: string } }
  | { type: 'HOST_STATUS'; payload: { connected: boolean; error?: string } };
