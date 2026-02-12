import type { Session, ChatMessage } from '../../shared/types';

const SESSIONS_KEY = 'copilot_sessions';
const ACTIVE_SESSION_KEY = 'copilot_active_session';
const MAX_SESSIONS = 50;

export async function getSessions(): Promise<Session[]> {
  const result = await chrome.storage.local.get(SESSIONS_KEY);
  return result[SESSIONS_KEY] || [];
}

export async function getSession(id: string): Promise<Session | null> {
  const sessions = await getSessions();
  return sessions.find((s) => s.id === id) || null;
}

export async function getActiveSessionId(): Promise<string | null> {
  const result = await chrome.storage.local.get(ACTIVE_SESSION_KEY);
  return result[ACTIVE_SESSION_KEY] || null;
}

export async function setActiveSessionId(id: string): Promise<void> {
  await chrome.storage.local.set({ [ACTIVE_SESSION_KEY]: id });
}

export async function createSession(title?: string): Promise<Session> {
  const session: Session = {
    id: crypto.randomUUID(),
    title: title || 'New Chat',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const sessions = await getSessions();
  sessions.unshift(session);

  // Trim old sessions
  if (sessions.length > MAX_SESSIONS) {
    sessions.splice(MAX_SESSIONS);
  }

  await chrome.storage.local.set({ [SESSIONS_KEY]: sessions });
  await setActiveSessionId(session.id);
  return session;
}

export async function updateSession(id: string, updates: Partial<Pick<Session, 'title' | 'messages'>>): Promise<void> {
  const sessions = await getSessions();
  const index = sessions.findIndex((s) => s.id === id);
  if (index === -1) return;

  sessions[index] = {
    ...sessions[index],
    ...updates,
    updatedAt: Date.now(),
  };

  await chrome.storage.local.set({ [SESSIONS_KEY]: sessions });
}

export async function addMessage(sessionId: string, message: ChatMessage): Promise<void> {
  const session = await getSession(sessionId);
  if (!session) return;

  session.messages.push(message);

  // Auto-title from first user message
  if (session.title === 'New Chat' && message.role === 'user') {
    session.title = message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '');
  }

  await updateSession(sessionId, { title: session.title, messages: session.messages });
}

export async function deleteSession(id: string): Promise<void> {
  const sessions = await getSessions();
  const filtered = sessions.filter((s) => s.id !== id);
  await chrome.storage.local.set({ [SESSIONS_KEY]: filtered });
}

export async function clearSessions(): Promise<void> {
  await chrome.storage.local.remove([SESSIONS_KEY, ACTIVE_SESSION_KEY]);
}
