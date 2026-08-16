import { daysInMonth, dayOfMonth } from "./format";
import type { CenterData, DailyRow, PersonRow } from "./types";

/**
 * 모든 계산의 기준은 실적(cred, 단위 천원) 하나다.
 * 환산P 는 쓰지 않는다.
 */

/** 월 마지막 날짜(ISO). */
export function monthEnd(iso: string) {
  return `${iso.slice(0, 7)}-${String(daysInMonth(iso)).padStart(2, "0")}`;
}

/** 영업일(월~금) 개수. 시작일·종료일 모두 포함. */
export function countBusinessDays(fromIso: string, toIso: string) {
  const cur = new Date(`${fromIso}T00:00:00`);
  const end = new Date(`${toIso}T00:00:00`);
  let n = 0;
  while (cur <= end) {
    const g = cur.getDay();
    if (g !== 0 && g !== 6) n += 1;
    cur.setDate(cur.getDate() + 1);
  }
  return n;
}

/**
 * 월말 예상 실적.
 *
 * 단순 (누적 ÷ 경과일수 × 월일수) 는 주말을 실적일로 세기 때문에 왜곡이 크다.
 * 보험 영업은 평일에 몰리므로 영업일 기준 run-rate 로 환산한다.
 * (공휴일은 아직 반영하지 않는다.)
 */
export function projectMonthEnd(asOf: string, cumulative: number) {
  const month = asOf.slice(0, 7);
  const first = `${month}-01`;
  const last = monthEnd(asOf);
  const elapsed = countBusinessDays(first, asOf);
  const total = countBusinessDays(first, last);
  const perDay = elapsed > 0 ? cumulative / elapsed : 0;
  return {
    elapsedBiz: elapsed,
    totalBiz: total,
    perDay,
    projected: perDay * total,
    progressPct: total > 0 ? (elapsed / total) * 100 : 0,
    dayPct: (dayOfMonth(asOf) / daysInMonth(asOf)) * 100,
  };
}

/**
 * 목표 대비 페이스.
 *
 * 달성률만 보면 월초엔 무조건 낮게 나와 판단이 안 된다.
 * **영업일 진척률과 나란히 놓아야** "빠른가 늦은가"가 나온다.
 *   달성률 55.4% vs 영업일 진척 47.6%  →  +7.8%p 앞섬
 */
export function pace(
  asOf: string,
  cumulative: number,
  target: number | null | undefined,
) {
  const proj = projectMonthEnd(asOf, cumulative);
  if (!target) {
    return { ...proj, target: null, achievedPct: null, gapPp: null, remaining: null, needPerDay: null, projectedPct: null };
  }
  const achievedPct = (cumulative / target) * 100;
  const remaining = Math.max(0, target - cumulative);
  const leftBiz = Math.max(0, proj.totalBiz - proj.elapsedBiz);
  return {
    ...proj,
    target,
    achievedPct,
    /** 달성률 − 영업일 진척률. +면 계획보다 앞선 것 */
    gapPp: achievedPct - proj.progressPct,
    remaining,
    /** 남은 영업일 동안 하루에 얼마씩 해야 목표를 채우는가 */
    needPerDay: leftBiz > 0 ? remaining / leftBiz : 0,
    /** 이 속도면 월말에 목표의 몇 % */
    projectedPct: (proj.projected / target) * 100,
  };
}

/** 마지막 구간의 실적 증분 + 그 앞 구간. */
export function latestDelta(daily: DailyRow[]) {
  const withDelta = daily.filter((d) => d.dCred !== null);
  const last = withDelta.at(-1) ?? null;
  const prev = withDelta.at(-2) ?? null;
  const perDay = withDelta
    .filter((d) => d.spanDays)
    .map((d) => d.dCred! / d.spanDays!);
  const avgPerDay = perDay.length
    ? perDay.reduce((a, b) => a + b, 0) / perDay.length
    : 0;
  return { last, prev, avgPerDay };
}

/** 상위 n명이 전체 실적의 몇 %를 만드는지 (파레토). */
export function paretoShare(people: PersonRow[], topN: number) {
  const total = people.reduce((a, b) => a + b.cred, 0);
  if (!total) return 0;
  const top = people.slice(0, topN).reduce((a, b) => a + b.cred, 0);
  return (top / total) * 100;
}

/** 누적 기여도 곡선 (파레토용). 실적이 있는 사람만 센다. */
export function paretoCurve(people: PersonRow[]) {
  const active = people.filter((p) => p.cred > 0);
  const total = active.reduce((a, b) => a + b.cred, 0) || 1;
  let acc = 0;
  return active.map((p, i) => {
    acc += p.cred;
    return {
      x: String(i + 1),
      y: (acc / total) * 100,
      title: `상위 ${i + 1}명`,
      acc,
    };
  });
}

/** 직전 스냅샷 대비 실적이 오른 설계사 = 오늘 움직인 사람. */
export function movers(people: PersonRow[], limit = 10) {
  return people
    .filter((p) => p.dCred > 0)
    .sort((a, b) => b.dCred - a.dCred)
    .slice(0, limit);
}

/** 당월 실적이 아직 없는 설계사 = 가동 촉진 대상. */
export function dormant(people: PersonRow[]) {
  return people.filter((p) => p.cred <= 0);
}

/** 시상금을 실제로 받는 설계사 목록 (많이 받는 순). */
export function awardEarners(people: PersonRow[]) {
  return people
    .filter((p) => p.awardMoney > 0)
    .sort((a, b) => b.awardMoney - a.awardMoney);
}

/** 데이터 신선도 점검 — 스냅샷이 며칠 밀렸는지. */
export function freshness(data: CenterData, today = new Date()) {
  const asOf = new Date(`${data.asOf}T00:00:00`);
  const diff = Math.round(
    (today.getTime() - asOf.getTime()) / (1000 * 60 * 60 * 24),
  );
  return { days: diff, stale: diff > 2 };
}
