import { daysInMonth, dayOfMonth } from "./format";
import type { DailyRow, PersonRow, Unit } from "./types";

/** 모든 계산의 기준은 실적(cred, 천원) 하나다. */

export function monthEnd(iso: string) {
  return `${iso.slice(0, 7)}-${String(daysInMonth(iso)).padStart(2, "0")}`;
}

/** 영업일(월~금) 개수. 시작일·종료일 포함. */
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
 * 목표 대비 페이스.
 *
 * 달성률만 보면 월초엔 무조건 낮아 판단이 안 된다.
 * **영업일 진척률과 나란히 놓아야** 빠른지 늦은지가 나온다.
 */
export function pace(asOf: string, cumulative: number, target: number | null | undefined) {
  const month = asOf.slice(0, 7);
  const first = `${month}-01`;
  const elapsed = countBusinessDays(first, asOf);
  const total = countBusinessDays(first, monthEnd(asOf));
  const perDay = elapsed > 0 ? cumulative / elapsed : 0;
  const projected = perDay * total;
  const progressPct = total > 0 ? (elapsed / total) * 100 : 0;

  if (!target) {
    return {
      elapsedBiz: elapsed, totalBiz: total, perDay, projected, progressPct,
      dayPct: (dayOfMonth(asOf) / daysInMonth(asOf)) * 100,
      target: null, achievedPct: null, gapPp: null,
      remaining: null, needPerDay: null, projectedPct: null,
    };
  }
  const achievedPct = (cumulative / target) * 100;
  const remaining = Math.max(0, target - cumulative);
  const leftBiz = Math.max(0, total - elapsed);
  return {
    elapsedBiz: elapsed, totalBiz: total, perDay, projected, progressPct,
    dayPct: (dayOfMonth(asOf) / daysInMonth(asOf)) * 100,
    target,
    achievedPct,
    /** 달성률 − 영업일 진척률. +면 계획보다 앞선 것 */
    gapPp: achievedPct - progressPct,
    remaining,
    /** 남은 영업일 동안 하루에 얼마씩 해야 목표를 채우는가 */
    needPerDay: leftBiz > 0 ? remaining / leftBiz : 0,
    projectedPct: (projected / target) * 100,
  };
}

export function latestDelta(daily: DailyRow[]) {
  const w = daily.filter((d) => d.dCred !== null);
  const perDay = w.filter((d) => d.spanDays).map((d) => d.dCred! / d.spanDays!);
  return {
    last: w.at(-1) ?? null,
    prev: w.at(-2) ?? null,
    avgPerDay: perDay.length ? perDay.reduce((a, b) => a + b, 0) / perDay.length : 0,
  };
}

/**
 * 궤도 이탈 판정.
 *
 * 목표가 있으면 페이스 갭이 1순위 근거다(가장 직접적).
 * 없으면 동료 대비 편차(z)로 대체하고, 모멘텀을 함께 본다.
 */
export type Level = "ok" | "watch" | "alert";
export function diagnose(u: Unit, gapPp: number | null): { level: Level; flags: string[] } {
  const flags: string[] = [];
  let level: Level = "ok";
  const worse = (l: Level) => {
    const order = { ok: 0, watch: 1, alert: 2 } as const;
    if (order[l] > order[level]) level = l;
  };

  if (gapPp !== null) {
    if (gapPp <= -15) { worse("alert"); flags.push(`목표 페이스 ${gapPp.toFixed(1)}%p`); }
    else if (gapPp <= -7) { worse("watch"); flags.push(`목표 페이스 ${gapPp.toFixed(1)}%p`); }
    else if (gapPp >= 7) flags.push(`목표 페이스 +${gapPp.toFixed(1)}%p`);
  }
  if (u.z !== null) {
    if (u.z <= -2) { worse("alert"); flags.push(`동료 대비 ${u.z.toFixed(1)}σ`); }
    else if (u.z <= -1.5) { worse("watch"); flags.push(`동료 대비 ${u.z.toFixed(1)}σ`); }
    else if (u.z >= 2) flags.push(`동료 대비 +${u.z.toFixed(1)}σ`);
  }
  if (u.momentum !== null) {
    if (u.momentum < 0.7) { worse("alert"); flags.push(`속도 ${u.momentum.toFixed(2)}배`); }
    else if (u.momentum < 0.9) { worse("watch"); flags.push(`속도 ${u.momentum.toFixed(2)}배`); }
    else if (u.momentum >= 1.2) flags.push(`속도 ${u.momentum.toFixed(2)}배`);
  }
  return { level, flags };
}

export const LEVEL_COLOR: Record<Level, string> = {
  ok: "var(--status-good)",
  watch: "var(--status-warning)",
  alert: "var(--status-critical)",
};
export const LEVEL_LABEL: Record<Level, string> = {
  ok: "정상", watch: "주의", alert: "이탈",
};

/** 자식 조직별 페이스 갭 (목표 있는 곳만). */
export function unitPace(u: Unit, asOf: string) {
  return pace(asOf, u.cred, u.target);
}

export function paretoShare(people: PersonRow[], topN: number) {
  const total = people.reduce((a, b) => a + b.cred, 0);
  if (!total) return 0;
  return (people.slice(0, topN).reduce((a, b) => a + b.cred, 0) / total) * 100;
}

export function paretoCurve(people: PersonRow[]) {
  const active = people.filter((p) => p.cred > 0);
  const total = active.reduce((a, b) => a + b.cred, 0) || 1;
  let acc = 0;
  return active.map((p, i) => {
    acc += p.cred;
    return { x: String(i + 1), y: (acc / total) * 100, title: `상위 ${i + 1}명`, acc };
  });
}

export function movers(people: PersonRow[], limit = 10) {
  return people.filter((p) => p.dCred > 0).sort((a, b) => b.dCred - a.dCred).slice(0, limit);
}

export function awardEarners(people: PersonRow[]) {
  return people.filter((p) => p.awardMoney > 0).sort((a, b) => b.awardMoney - a.awardMoney);
}

export function freshness(asOf: string, today = new Date()) {
  const d = new Date(`${asOf}T00:00:00`);
  const days = Math.round((today.getTime() - d.getTime()) / 86400000);
  return { days, stale: days > 3 };
}
