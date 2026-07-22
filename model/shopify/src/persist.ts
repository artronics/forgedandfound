import {mkdirSync, writeFileSync} from "node:fs";
import {join} from "node:path";

// Snapshots and change logs live outside the repo, one directory per run:
//   <baseDir>/<store-name>/<timestamp>/{before,plan,after}.json + changes.jsonl

export function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export function makeRunDir(baseDir: string, storeName: string, ts: string): string {
  const dir = join(baseDir, storeName, ts);
  mkdirSync(dir, {recursive: true});
  return dir;
}

export function writeJson(dir: string, name: string, data: unknown): void {
  writeFileSync(join(dir, name), JSON.stringify(data, null, 2) + "\n");
}

export function writeJsonl(dir: string, name: string, rows: unknown[]): void {
  const body = rows.map((r) => JSON.stringify(r)).join("\n");
  writeFileSync(join(dir, name), rows.length ? body + "\n" : "");
}
