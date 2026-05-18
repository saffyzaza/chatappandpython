import type { ChatSessionMessage, ChatSessionState, ChatMessageRole, AgentStep } from "./chatTypes";

const CHAT_SESSION_PREFIX = "chat-session:";
export const CHAT_SESSION_UPDATED_EVENT = "chat-session-updated";
const chatSessionSnapshotCache = new Map<string, { rawValue: string | null; snapshot: ChatSessionState }>();

function getStorageKey(sessionId: string) {
  return `${CHAT_SESSION_PREFIX}${sessionId}`;
}

function formatTimestamp(date = new Date()) {
  return new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getDefaultChatSessionState(sessionId: string): ChatSessionState {
  return {
    sessionId,
    status: "idle",
    messages: [],
  };
}

export function createEmptyChatSessionState(sessionId: string) {
  return getDefaultChatSessionState(sessionId);
}

function normalizeChatSessionState(
  sessionId: string,
  parsed: ChatSessionState | ChatSessionMessage[] | null,
): ChatSessionState {
  if (!parsed) {
    return getDefaultChatSessionState(sessionId);
  }

  if (Array.isArray(parsed)) {
    return {
      ...getDefaultChatSessionState(sessionId),
      messages: parsed,
    };
  }

  return {
    ...getDefaultChatSessionState(sessionId),
    ...parsed,
    sessionId,
  };
}

export function createChatSessionMessage(
  role: ChatMessageRole,
  text: string,
  agentSteps?: AgentStep[],
): ChatSessionMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    text,
    timestamp: formatTimestamp(),
    ...(agentSteps && agentSteps.length > 0 ? { agentSteps } : {}),
  };
}

export function generateChatSessionId() {
  return Math.random().toString(36).slice(2, 14);
}

export function getChatSessionState(sessionId: string) {
  if (typeof window === "undefined") {
    return getDefaultChatSessionState(sessionId);
  }

  const rawValue = window.sessionStorage.getItem(getStorageKey(sessionId));
  const cachedEntry = chatSessionSnapshotCache.get(sessionId);

  if (cachedEntry && cachedEntry.rawValue === rawValue) {
    return cachedEntry.snapshot;
  }

  if (!rawValue) {
    const snapshot = getDefaultChatSessionState(sessionId);
    chatSessionSnapshotCache.set(sessionId, { rawValue: null, snapshot });
    return snapshot;
  }

  try {
    const parsed = JSON.parse(rawValue) as ChatSessionState | ChatSessionMessage[];
    const snapshot = normalizeChatSessionState(sessionId, parsed);
    chatSessionSnapshotCache.set(sessionId, { rawValue, snapshot });
    return snapshot;
  } catch {
    const snapshot = getDefaultChatSessionState(sessionId);
    chatSessionSnapshotCache.set(sessionId, { rawValue: null, snapshot });
    return snapshot;
  }
}

export function getChatSessionMessages(sessionId: string) {
  return getChatSessionState(sessionId).messages;
}

export function saveChatSessionState(sessionId: string, state: ChatSessionState) {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedState = normalizeChatSessionState(sessionId, state);
  const rawValue = JSON.stringify(normalizedState);

  chatSessionSnapshotCache.set(sessionId, { rawValue, snapshot: normalizedState });
  window.sessionStorage.setItem(getStorageKey(sessionId), rawValue);
  window.dispatchEvent(
    new CustomEvent(CHAT_SESSION_UPDATED_EVENT, {
      detail: { sessionId },
    }),
  );
}

export function subscribeToChatSession(sessionId: string | null, onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleSessionUpdated = (event: Event) => {
    const detail = (event as CustomEvent<{ sessionId?: string }>).detail;

    if (!sessionId || !detail?.sessionId || detail.sessionId === sessionId) {
      onStoreChange();
    }
  };

  window.addEventListener(CHAT_SESSION_UPDATED_EVENT, handleSessionUpdated);
  window.addEventListener("storage", onStoreChange);

  return () => {
    window.removeEventListener(CHAT_SESSION_UPDATED_EVENT, handleSessionUpdated);
    window.removeEventListener("storage", onStoreChange);
  };
}

export function updateChatSessionState(
  sessionId: string,
  updater: (current: ChatSessionState) => ChatSessionState,
) {
  const nextState = updater(getChatSessionState(sessionId));
  saveChatSessionState(sessionId, nextState);
  return getChatSessionState(sessionId);
}

export function appendChatSessionMessages(
  sessionId: string,
  entries: Array<{ role: ChatSessionMessage["role"]; text: string; agentSteps?: AgentStep[] }>,
) {
  return updateChatSessionState(sessionId, (current) => ({
    ...current,
    messages: [
      ...current.messages,
      ...entries.map((entry) => createChatSessionMessage(entry.role, entry.text, entry.agentSteps)),
    ],
  })).messages;
}