export const userState: Map<number, any> = new Map();

const STATE_TTL_MS = 30 * 60 * 1000;

export function cleanExpiredState(): void {
  const now = Date.now();
  for (const [chatId, state] of userState.entries()) {
    if (state._createdAt && now - state._createdAt > STATE_TTL_MS) {
      userState.delete(chatId);
    }
  }
}
