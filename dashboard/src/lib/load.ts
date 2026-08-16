import { readFile } from "node:fs/promises";
import path from "node:path";

import type { BenchmarkData, CenterData, Meta } from "./types";

// public/ 밖에 둔다 — HTTP 로 직접 접근되면 로그인 게이트가 무의미해진다.
const DATA_DIR = path.join(process.cwd(), "data");

async function json<T>(name: string): Promise<T> {
  const raw = await readFile(path.join(DATA_DIR, name), "utf-8");
  return JSON.parse(raw) as T;
}

export async function loadAll() {
  const [meta, center, benchmark] = await Promise.all([
    json<Meta>("meta.json"),
    json<CenterData>("center.json"),
    json<BenchmarkData>("benchmark.json"),
  ]);
  return { meta, center, benchmark };
}
