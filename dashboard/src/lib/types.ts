/**
 * etl/build.py 산출물 타입.
 *
 * 팀 / 영업단 / 센터가 **같은 모양**을 공유한다(OrgPayload).
 * 그래서 화면 컴포넌트를 층마다 다시 만들지 않는다.
 *
 * 금액 단위는 전부 **천원**. 화면에 찍을 땐 format.ts 의 man/m/won 을 거친다.
 */

export type Point = { date: string; cred: number };

export type DailyRow = {
  date: string;
  /** 월 누적 실적 (천원) */
  cred: number;
  /** 직전 스냅샷 대비 증분 = 그 구간의 매출 */
  dCred: number | null;
  /** 직전 스냅샷과의 일수. 2 이상이면 여러 날이 뭉친 값 */
  spanDays: number | null;
  roster: number;
  active: number;
  newActive: number | null;
};

/** 자식 조직 한 줄 (영업단 / 센터 / 지사 공통) */
export type Unit = {
  key: string;
  name: string;
  href?: string;
  cred: number;
  dCred: number;
  roster: number;
  active: number;
  headcount: number;
  target: number | null;
  achievedPct: number | null;
  activeRate: number | null;
  /** 실적 ÷ 재적 — 목표가 없어도 규모 보정 비교가 되는 잣대 */
  perCapita: number | null;
  /** 실적 ÷ 가동인원 */
  perActive: number | null;
  /** 최근 3일 속도 ÷ 이전 3일 속도. 1 미만이면 감속 */
  momentum: number | null;
  /** 동료 집단 안에서의 로버스트 편차 */
  z: number | null;
  series: Point[];
  /** 영업단에만 */
  centers?: number;
  /** 센터에만 */
  head?: string;
  /** 지사에만 */
  agency?: string;
  worldTour?: { key: string; label: string; people: number; reached: boolean }[];
};

export type Band = {
  median: number;
  mad: number | null;
  lo1: number | null;
  hi1: number | null;
  lo2: number | null;
  hi2: number | null;
};

export type Compare = {
  /** 비교에 쓴 필드 이름 */
  field: "achievedPct" | "perCapita";
  label: string;
  band: Band | null;
};

export type AgencyRow = {
  name: string;
  cred: number;
  dCred: number;
  active: number;
  centers: number;
  branches: number;
  share: number;
};

export type Concentration = {
  n: number;
  top1: number;
  top3: number;
  top5: number;
  top20pct: number;
  hhi: number;
} | null;

export type BranchRow = {
  key: string;
  name: string;
  agency: string;
  center: string;
  cred: number;
  dCred: number;
  active: number;
  roster: number;
  headcount: number;
  activeRate: number | null;
};

export type Link = { key?: string; name: string; href: string };

/** 세 층이 공유하는 기본 골격 */
export type OrgBase = {
  level: "team" | "dept" | "center";
  name: string;
  asOf: string;
  dates: string[];
  target: number | null;
  headcount: number;
  daily: DailyRow[];
  children: Unit[];
  childLabel: string;
  compare: Compare;
};

export type TeamData = OrgBase & {
  level: "team";
  agencies: AgencyRow[];
  agencyCount: number;
  agencyConcentration: Concentration;
  partialTargets: { have: number; total: number };
};

export type DeptData = OrgBase & {
  level: "dept";
  key: string;
  parent: Link;
  agencies: AgencyRow[];
  agencyCount: number;
  agencyConcentration: Concentration;
  branches: BranchRow[];
  branchCount: number;
  siblings: Link[];
};

export type WeekRow = { week: number; label: string; cred: number; people: number };
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
  awardMoney: number;
  awardItems: AwardItem[];
  rank: number;
  series: Point[];
};
export type AwardNear = {
  name: string; branch: string; manager: string | null; perf: number; gap: number;
};
export type AwardRow = {
  key: string; label: string; eligible: number; achieved: number;
  rate: number; threshold: number | null; near: AwardNear[];
};
export type ManagerRow = {
  manager: string; cred: number; dCred: number; roster: number;
  active: number; branches: number; activeRate: number;
};

export type CenterData = OrgBase & {
  level: "center";
  key: string;
  head: string;
  parent: Link;
  grandparent: Link;
  weeks: WeekRow[];
  people: PersonRow[];
  awards: AwardRow[];
  managers: ManagerRow[];
  siblings: Link[];
};

export type OrgData = TeamData | DeptData | CenterData;

export type IndexData = {
  generatedAt: string;
  asOf: string;
  month: string;
  team: string;
  snapshots: { date: string; source: string; rows: number }[];
  warnings: string[];
  tree: { key: string; name: string; href: string; centers: Link[] }[];
  focus: string | null;
};
