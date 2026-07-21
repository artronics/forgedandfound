import {existsSync, readFileSync, writeFileSync} from "node:fs";
import {join} from "node:path";

// A tiny record of what we created, kept next to the data so seeding is
// idempotent (skip products already made) and `seed delete` can tidy up.
export type SeedLock = {
  shop: string;
  products: Record<string, {id: string; handle: string; title: string}>;
};

export function lockPath(dir: string): string {
  return join(dir, "seed-lock.json");
}

export function readLock(dir: string, shop: string): SeedLock {
  const path = lockPath(dir);
  if (existsSync(path)) {
    return JSON.parse(readFileSync(path, "utf8")) as SeedLock;
  }
  return {shop, products: {}};
}

export function writeLock(dir: string, lock: SeedLock): void {
  writeFileSync(lockPath(dir), JSON.stringify(lock, null, 2) + "\n");
}
