import "server-only";
import path from "node:path";
import { connection } from "next/server";
import { JsonFileRepository } from "./json-store";
import type { Repository } from "./types";

const globalForStore = globalThis as unknown as { reachmeStore?: Repository };

/**
 * The one place that decides which store implementation is used.
 * Swap `JsonFileRepository` for a database-backed Repository here.
 */
function createStore(): Repository {
  const file = process.env.REACHME_STORE_FILE ?? path.join(process.cwd(), ".data", "store.json");
  return new JsonFileRepository(file);
}

/**
 * Get the store. Awaits `connection()` so pages that read it are rendered
 * per request instead of being prerendered at build time.
 */
export async function getStore(): Promise<Repository> {
  await connection();
  globalForStore.reachmeStore ??= createStore();
  return globalForStore.reachmeStore;
}

export type { Repository, StoreData } from "./types";
