/**
 * 숫자/날짜 표기 규칙.
 *
 * 실적(cred)의 원본 단위는 **천원**이다. 화면에는 전부 **만원**으로 환산해 쓴다.
 *   원본 8,309  →  830.9만원
 * 그래서 raw 값을 그대로 찍는 함수는 두지 않는다. 항상 man() 을 거친다.
 */

export const nf0 = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });
export const nf1 = new Intl.NumberFormat("ko-KR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** 천원 → 만원 (숫자). 차트에 넣는 값은 전부 이걸 통과시킨다. */
export function man(thousandWon: number | null | undefined) {
  return (thousandWon ?? 0) / 10;
}

/** 천원 → "830.9" (만원 단위 숫자 문자열, 단위 문자 없음). 표 셀용. */
export function m(thousandWon: number | null | undefined) {
  if (thousandWon === null || thousandWon === undefined) return "—";
  const v = thousandWon / 10;
  if (Math.abs(v) >= 1000) return nf0.format(v);
  return nf1.format(v);
}

/** 천원 → "830.9만" / "1.2억". 단위까지 붙인 표기. KPI·툴팁용. */
export function won(thousandWon: number | null | undefined) {
  if (thousandWon === null || thousandWon === undefined) return "—";
  const v = thousandWon / 10;
  if (Math.abs(v) >= 10000) return `${nf1.format(v / 10000)}억`;
  if (Math.abs(v) >= 1000) return `${nf0.format(v)}만`;
  return `${nf1.format(v)}만`;
}

/** 증감은 부호를 붙인다 (만원). */
export function wonSigned(thousandWon: number | null | undefined) {
  if (thousandWon === null || thousandWon === undefined) return "—";
  const v = thousandWon / 10;
  if (Math.abs(v) < 0.05) return "0";
  const body = Math.abs(v) >= 1000 ? nf0.format(Math.abs(v)) : nf1.format(Math.abs(v));
  return `${v > 0 ? "+" : "-"}${body}만`;
}

/** 인원수 등 순수 카운트. */
export function n(v: number | null | undefined) {
  if (v === null || v === undefined) return "—";
  return nf0.format(v);
}

export function pct(v: number | null | undefined, digits = 1) {
  if (v === null || v === undefined) return "—";
  return `${v.toFixed(digits)}%`;
}

const WD = ["일", "월", "화", "수", "목", "금", "토"];

export function md(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function mdw(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getMonth() + 1}/${d.getDate()}(${WD[d.getDay()]})`;
}

export function isWeekend(iso: string) {
  const g = new Date(`${iso}T00:00:00`).getDay();
  return g === 0 || g === 6;
}

/** 그 달의 마지막 날짜(일). */
export function daysInMonth(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export function dayOfMonth(iso: string) {
  return Number(iso.slice(8, 10));
}
