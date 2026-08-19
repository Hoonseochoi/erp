import { readFile } from "node:fs/promises";
import path from "node:path";

import type { CenterData, DeptData, IndexData, TeamData } from "./types";

// public/ 밖에 둔다 — HTTP 로 직접 접근되면 로그인 게이트가 무의미해진다.
const DATA_DIR = path.join(process.cwd(), "data");

async function json<T>(...parts: string[]): Promise<T> {
  const raw = await readFile(path.join(DATA_DIR, ...parts), "utf-8");
  return JSON.parse(raw) as T;
}

export const loadIndex = () => json<IndexData>("index.json");
export const loadTeam = () => json<TeamData>("team.json");
export const loadDept = (code: string) => json<DeptData>("dept", `${code}.json`);
export const loadCenter = (code: string) => json<CenterData>("center", `${code}.json`);
