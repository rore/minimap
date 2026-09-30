import { AsyncLocalStorage } from "node:async_hooks";

const currentGuard = new AsyncLocalStorage();

export function withSourceWriteGuard(guard, work) {
  return currentGuard.run(guard, work);
}

export async function assertSourceWriteGuard() {
  await currentGuard.getStore()?.();
}
