"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Legend, RankBarChart, type SimpleDatum } from "@/components/charts/chart-kit";
import { ClickableRow } from "./clickable-row";
import { diagnoseAll, type Diagnosed } from "./deviation";
import { unitPace } from "@/lib/analytics";
import { m, man, n, pct, won } from "@/lib/format";
import type { OrgBase } from "@/lib/types";

export type MetricKey = "cred" | "compare" | "projected" | "today" | "active";

/**
 * 헤더 KPI 카드를 눌렀을 때 뜨는 상세 시트.
 *
 * 팀 카드를 누르면 영업단 기준으로, 영업단 카드를 누르면 센터 기준으로 —
 * 항상 data.children(한 단계 아래) 을 그대로 쓴다. 그래서 층을 하나 더
 * 늘려도(예: 센터 → 지사는 이미 그렇다) 이 컴포넌트는 손댈 필요가 없다.
 * 목표가 없는 층에서는 diagnoseAll 이 이미 인당생산성으로 자동 전환해 둔 값을 그대로 쓴다.
 */
export function MetricDetail({
  metric, open, onOpenChange, data,
}: {
  metric: MetricKey | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: OrgBase;
}) {
  const diagnosed = React.useMemo(
    () => diagnoseAll(data.children, data.asOf),
    [data.children, data.asOf],
  );

  const spec = metric ? SPECS[metric](diagnosed, data) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:w-[560px] sm:max-w-[560px]">
        {spec && (
          <>
            <SheetHeader className="mb-1">
              <SheetTitle>{spec.title}</SheetTitle>
              <SheetDescription>{spec.desc}</SheetDescription>
            </SheetHeader>

            {spec.summary && (
              <div className="mb-4 flex flex-wrap gap-1.5">
                {spec.summary.map((b) => (
                  <Badge key={b} variant="outline">{b}</Badge>
                ))}
              </div>
            )}

            <RankBarChart data={spec.bars} unit={spec.unit} labelWidth={126} height={
              Math.max(160, spec.rows.length * 30 + 24)
            } />
            <Legend items={[
              { label: "정상", color: "var(--series-1)" },
              { label: "주의·이탈", color: "var(--series-2)" },
            ]} />

            <div className="mt-4 overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8 pl-4">#</TableHead>
                    <TableHead>{data.childLabel}</TableHead>
                    <TableHead className="text-right">{spec.valueLabel}</TableHead>
                    {spec.extraLabel && (
                      <TableHead className="text-right">{spec.extraLabel}</TableHead>
                    )}
                    <TableHead className="w-7 pr-3" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {spec.rows.map((row, i) => (
                    <ClickableRow key={row.key} href={row.href}
                      onClickCapture={() => row.href && onOpenChange(false)}>
                      <TableCell className="tnum pl-4 text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="max-w-[180px]">
                        <div className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ background: LEVEL_DOT[row.level] }} />
                          <span className="truncate font-medium">{row.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="tnum text-right font-medium">{row.value}</TableCell>
                      {spec.extraLabel && (
                        <TableCell className="tnum text-right text-muted-foreground">
                          {row.extra}
                        </TableCell>
                      )}
                      <TableCell className="pr-3">
                        {row.href && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </TableCell>
                    </ClickableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

const LEVEL_DOT: Record<string, string> = {
  ok: "var(--status-good)",
  watch: "var(--status-warning)",
  alert: "var(--status-critical)",
};

type Row = { key: string; name: string; value: string; extra?: string; href?: string; level: string };
type Spec = {
  title: string; desc: string; unit: string; valueLabel: string; extraLabel?: string;
  summary?: string[]; bars: SimpleDatum[]; rows: Row[];
};

const SPECS: Record<MetricKey, (units: Diagnosed[], data: OrgBase) => Spec> = {
  cred: (units, data) => {
    const total = units.reduce((a, b) => a + b.cred, 0) || 1;
    const sorted = [...units].sort((a, b) => b.cred - a.cred);
    return {
      title: `당월 누적 실적 · ${data.childLabel}별`,
      desc: `${data.childLabel} 단위로 나눈 당월 누적 실적. 금액 단위 만원.`,
      unit: "만원", valueLabel: "실적", extraLabel: "비중",
      bars: sorted.map((u) => ({
        x: u.name, y: man(u.cred), title: u.name, highlight: u.level !== "ok",
        extra: [
          { label: "전일 증분", value: `${won(u.dCred)}원` },
          { label: "비중", value: pct((u.cred / total) * 100) },
        ],
      })),
      rows: sorted.map((u) => ({
        key: u.key, name: u.name, value: `${m(u.cred)}만`,
        extra: pct((u.cred / total) * 100), href: u.href, level: u.level,
      })),
    };
  },

  compare: (units, data) => {
    const field = data.compare.field;
    const label = data.compare.label;
    const sorted = [...units].sort((a, b) => (b[field] ?? -Infinity) - (a[field] ?? -Infinity));
    const fmt = (v: number | null) =>
      v === null ? "—" : field === "achievedPct" ? pct(v) : `${m(v * 10)}만`;
    return {
      title: `${label} · ${data.childLabel}별`,
      desc: field === "achievedPct"
        ? "목표가 다르므로 실적 총액이 아니라 달성률로 나란히 놓는다."
        : "목표가 없는 조직이 있어 재적 1인당 실적(인당생산성)으로 비교한다.",
      unit: field === "achievedPct" ? "%" : "천원", valueLabel: label, extraLabel: "동료 대비",
      summary: data.compare.band ? [
        `동료 중앙값 ${fmt(data.compare.band.median)}`,
      ] : undefined,
      bars: sorted.map((u) => ({
        x: u.name, y: (field === "achievedPct" ? u.achievedPct : u.perCapita) ?? 0,
        title: u.name, highlight: u.level !== "ok",
        extra: [
          { label: "실적", value: `${won(u.cred)}원` },
          { label: "속도", value: u.momentum ? `${u.momentum.toFixed(2)}배` : "—" },
        ],
      })),
      rows: sorted.map((u) => ({
        key: u.key, name: u.name,
        value: fmt(field === "achievedPct" ? u.achievedPct : u.perCapita),
        extra: u.z !== null ? `${u.z >= 0 ? "+" : ""}${u.z.toFixed(1)}σ` : "—",
        href: u.href, level: u.level,
      })),
    };
  },

  projected: (units, data) => {
    const withPace = units.map((u) => ({ u, p: unitPace(u, data.asOf) }));
    const sorted = [...withPace].sort((a, b) => b.p.projected - a.p.projected);
    return {
      title: `월말 예상 · ${data.childLabel}별`,
      desc: "영업일 run-rate 로 각 조직의 월말 예상 실적을 환산. 금액 단위 만원.",
      unit: "만원", valueLabel: "월말 예상", extraLabel: "목표 대비",
      bars: sorted.map(({ u, p }) => ({
        x: u.name, y: man(p.projected), title: u.name, highlight: u.level !== "ok",
        extra: [
          { label: "현재 누적", value: `${won(u.cred)}원` },
          { label: "영업일 평균", value: `${won(p.perDay)}원` },
        ],
      })),
      rows: sorted.map(({ u, p }) => ({
        key: u.key, name: u.name, value: `${m(p.projected)}만`,
        extra: p.projectedPct !== null ? pct(p.projectedPct) : "—",
        href: u.href, level: u.level,
      })),
    };
  },

  today: (units, data) => {
    const total = units.reduce((a, b) => a + b.dCred, 0) || 1;
    const sorted = [...units].sort((a, b) => b.dCred - a.dCred);
    return {
      title: `최신 스냅샷 실적 · ${data.childLabel}별`,
      desc: `직전 스냅샷 대비 증분을 ${data.childLabel} 단위로 나눴다. 오늘 누가 움직였는지.`,
      unit: "만원", valueLabel: "증분", extraLabel: "기여 비중",
      bars: sorted.map((u) => ({
        x: u.name, y: man(u.dCred), title: u.name, highlight: u.dCred > 0,
        extra: [{ label: "누적", value: `${won(u.cred)}원` }],
      })),
      rows: sorted.map((u) => ({
        key: u.key, name: u.name, value: `${u.dCred >= 0 ? "+" : ""}${m(u.dCred)}만`,
        extra: total > 0 ? pct((u.dCred / total) * 100) : "—",
        href: u.href, level: u.level,
      })),
    };
  },

  active: (units, data) => {
    const sorted = [...units].sort((a, b) => (b.activeRate ?? -1) - (a.activeRate ?? -1));
    return {
      title: `가동 인원 · ${data.childLabel}별`,
      desc: "가동 인원과 재적 대비 가동률. 목표가 아니라 사람이 실제로 움직였는지를 본다.",
      unit: "%", valueLabel: "가동률", extraLabel: "가동/재적",
      bars: sorted.map((u) => ({
        x: u.name, y: u.activeRate ?? 0, title: u.name, highlight: u.level !== "ok",
        extra: [{ label: "가동/재적", value: `${n(u.active)} / ${n(u.headcount)}명` }],
      })),
      rows: sorted.map((u) => ({
        key: u.key, name: u.name, value: pct(u.activeRate),
        extra: `${n(u.active)} / ${n(u.headcount)}`, href: u.href, level: u.level,
      })),
    };
  },
};
