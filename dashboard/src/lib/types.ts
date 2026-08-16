/**
 * etl/build.py 가 만들어내는 JSON 의 타입 정의.
 *
 * 실적(cred) 단위는 **천원**. 화면에 찍을 땐 반드시 format.ts 의 man/m/won 을 거친다.
 * convP(환산P)는 현업에서 쓰지 않는 지표라 검증 목적으로만 남아 있고 화면에 띄우지 않는다.
 */

export type Point = { date: string; cred: number; convP?: number };

export type DailyRow = {
  date: string;
  convP: number;
  /** 월 누적 실적 (천원) */
  cred: number;
  dConvP: number | null;
  /** 직전 스냅샷 대비 실적 증분 = 그 구간의 매출 (천원) */
  dCred: number | null;
  /** 직전 스냅샷과의 일수 (파일이 빠진 날이 있으면 2 이상) */
  spanDays: number | null;
  dConvPPerDay: number | null;
  /** 해당 시점에 실적 행이 존재한 설계사 수 */
  roster: number;
  /** 당월 실적 > 0 인 설계사 수 */
  active: number;
  activeConv: number;
  newActive: number | null;
};

export type WeekRow = {
  week: number;
  label: string;
  /** 천원 */
  cred: number;
  people: number;
};

export type WorldTourTier = {
  key: string;
  label: string;
  people: number;
  reached: boolean;
};

export type BranchRow = {
  key: string | number;
  branch: string;
  agency: string;
  manager: string | null;
  headcount: number;
  worldTour: WorldTourTier[];
  cred: number;
  dCred: number;
  activePeople: number;
  roster: number;
  activeRate: number | null;
  /** 재적 1인당 실적 (천원) */
  perHead: number | null;
  rank: number;
  series: Point[];
};

export type AwardItem = { label: string; money: number };

export type PersonRow = {
  code: number | null;
  name: string;
  branch: string;
  agency: string;
  manager: string | null;
  cred: number;
  weeks: number[];
  dCred: number;
  /** 이 설계사가 받는 시상금 합 (천원) */
  awardMoney: number;
  /** 항목별 내역 */
  awardItems: AwardItem[];
  prestigeGrade: number;
  rank: number;
  series: Point[];
};

export type AwardNear = {
  name: string;
  branch: string;
  manager: string | null;
  perf: number;
  gap: number;
};

export type AwardRow = {
  key: string;
  label: string;
  eligible: number;
  achieved: number;
  rate: number;
  threshold: number | null;
  near: AwardNear[];
};

export type ManagerRow = {
  manager: string;
  cred: number;
  dCred: number;
  roster: number;
  active: number;
  branches: number;
  activeRate: number;
};

export type FocusInfo = {
  center: string;
  dept: string;
  hq: string;
  centerHead: string;
};

export type CenterData = {
  focus: FocusInfo;
  asOf: string;
  /** 이 지점의 당월 목표 (천원). targets.json 에 없으면 null */
  target: number | null;
  dates: string[];
  daily: DailyRow[];
  weeks: WeekRow[];
  branches: BranchRow[];
  people: PersonRow[];
  awards: AwardRow[];
  managers: ManagerRow[];
  headcount: number;
};

export type BenchmarkCenter = {
  center: string;
  dept: string | null;
  cred: number;
  dCred: number;
  roster: number;
  active: number;
  headcount: number;
  activeRate: number | null;
  /** 당월 목표 (천원) */
  target: number | null;
  /** 실적 ÷ 목표 */
  achievedPct: number | null;
  /** 달성률 순위 — 목표가 지점마다 달라 이쪽이 진짜 성적표다 */
  achievedRank: number | null;
  isFocus: boolean;
  /** 절대 실적 순위 */
  rank: number;
  series: Point[];
};

export type BenchmarkData = {
  asOf: string;
  dates: string[];
  centers: BenchmarkCenter[];
  depts: {
    dept: string;
    cred: number;
    dCred: number;
    roster: number;
    active: number;
  }[];
};

export type Meta = {
  generatedAt: string;
  asOf: string;
  month: string;
  focus: FocusInfo;
  snapshots: { date: string; source: string; rows: number }[];
  warnings: string[];
  metrics: Record<string, { label: string; unit?: string; desc: string }>;
};
