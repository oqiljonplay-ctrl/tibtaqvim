// DB-backed userState — in-memory Map o'rniga PostgreSQL
// Barcha handlerda userState.get/set/delete chaqiruvlariga await qo'shildi

import { getState, setState, deleteState, maybeCleanup } from "./state/dbState";

export const userState = {
  get: (chatId: number) => getState(chatId),
  set: (chatId: number, state: any) => setState(chatId, state),
  delete: (chatId: number) => deleteState(chatId),
};

export { maybeCleanup };

// Eski cleanExpiredState — DB expiresAt boshqaradi
export function cleanExpiredState(): void {}
