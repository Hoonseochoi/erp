"use client";

import { motion } from "motion/react";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Sparkline } from "@/components/charts/chart-kit";
import { latestDelta, pace } from "@/lib/analytics";
import { m, md, mdw, n, pct, won, wonSigned } from "@/lib/format";
import type { OrgBase } from "@/lib/types";
import { cn } from "@/lib/utils";
import { HelpTip } from "./help-tip";
import { MetricDetail, type MetricKey } from "./metric-detail";
import { TierCards } from "./tier-cards";

/** 층에 상관없이 같은 KPI 묶음. 목표가 없으면 달성률 자리를 인당생산성이 대신한다. */
export function OrgHeader({ data, subtitle }: { data: OrgBase; subtitle?: string }) {
  const last = data.daily.at(-1)!;
  const { last: dl, avgPerDay } = latestDelta(data.daily);
  const p = pace(data.asOf, last.cred, data.target);
  const activeRate = data.headcount ? (last.active / data.headcount) * 100 : null;
  const perCapita = data.headcount ? last.cred / data.headcount : null;
  const [metric, setMetric] = React.useState<MetricKey | null>(null);
  const hasChildren = data.children.length > 0;

  return (
    <motion.div initial={{ y: 10 }} animate={{ y: 0 }} transition={{ duration: 0.3 }}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tighter sm:text-3xl">{data.name}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {data.target ? (
            <Badge variant="outline">목표 {won(data.target)}원</Badge>
          ) : (
            <Badge variant="muted">목표 미등록</Badge>
          )}
          <Badge variant="outline">재적 {n(data.headcount)}명</Badge>
          <Badge variant="outline">영업일 {p.elapsedBiz}/{p.totalBiz}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile label="당월 누적 실적" value={m(last.cred)} unit="만원"
          delta={dl?.dCred ?? null}
          deltaLabel={`${wonSigned(dl?.dCred)} (${md(data.asOf)})`}
          spark={data.daily.map((d) => d.cred)}
          onClick={hasChildren ? () => setMetric("cred") : undefined} />

        {p.achievedPct !== null ? (
          <Tile label="목표 달성률" value={p.achievedPct.toFixed(1)} unit="%"
            delta={p.gapPp}
            deltaLabel={`영업일 진척 대비 ${p.gapPp! >= 0 ? "+" : ""}${p.gapPp!.toFixed(1)}%p`}
            sub={`남은 ${won(p.remaining)}원`}
            onClick={hasChildren ? () => setMetric("compare") : undefined} />
        ) : (
          <Tile label="인당 생산성" value={perCapita ? m(perCapita * 10) : "—"} unit="만원/명"
            sub="재적 1인당"
            onClick={hasChildren ? () => setMetric("compare") : undefined} />
        )}

        <Tile label="월말 예상" value={m(p.projected)} unit="만원"
          sub={p.projectedPct !== null
            ? `목표의 ${p.projectedPct.toFixed(0)}%`
            : `영업일 평균 ${won(p.perDay)}원`}
          onClick={hasChildren ? () => setMetric("projected") : undefined} />

        <Tile label={`${md(data.asOf)} 실적`} value={m(dl?.dCred ?? 0)} unit="만원"
          sub={`구간 평균 ${won(avgPerDay)}원`}
          spark={data.daily.filter((d) => d.dCred !== null).map((d) => d.dCred!)}
          sparkColor="var(--series-3)"
          onClick={hasChildren ? () => setMetric("today") : undefined} />

        <Tile label="가동 인원" value={n(last.active)} unit={`명 / ${n(data.headcount)}명`}
          delta={dl?.newActive ?? null} deltaLabel={`신규 ${dl?.newActive ?? 0}명`}
          sub={activeRate !== null ? `가동률 ${pct(activeRate)}` : undefined}
          spark={data.daily.map((d) => d.active)} sparkColor="var(--series-2)"
          onClick={hasChildren ? () => setMetric("active") : undefined} />
      </div>

      <TierCards data={data} />

      {hasChildren && (
        <MetricDetail metric={metric} open={metric !== null}
          onOpenChange={(v) => !v && setMetric(null)} data={data} />
      )}

      {data.target && (
        <Card className="mt-3">
          <CardContent className="grid gap-5 p-5 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-3">
              <Bar label="목표 달성"
                right={`${won(last.cred)} / ${won(data.target)}원 · ${pct(p.achievedPct)}`}
                value={Math.min(100, p.achievedPct!)}
                color={p.gapPp! >= 0 ? "var(--status-good)" : "var(--status-warning)"} />
              <Bar label="영업일 진척"
                right={`${p.elapsedBiz} / ${p.totalBiz}일 · ${pct(p.progressPct)}`}
                value={p.progressPct} color="var(--viz-axis)" />
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                계획 대비{" "}
                <span className="tnum font-medium" style={{
                  color: p.gapPp! >= 0 ? "var(--status-good)" : "var(--status-warning)",
                }}>
                  {p.gapPp! >= 0 ? "+" : ""}{p.gapPp!.toFixed(1)}%p
                </span>
                <HelpTip title="목표 페이스" width="w-72">
                  <p>
                    막대 두 개를 겹쳐 읽는다. <b>위(달성률)가 아래(영업일 진척)보다
                    길면 계획보다 앞선 것</b>이다.
                  </p>
                  <p>
                    달성률만 보면 월초엔 무조건 낮게 나와서 판단이 안 된다.
                    시간이 얼마나 지났는지와 나란히 놔야 의미가 생긴다.
                  </p>
                  <p>
                    <b>필요 일평균</b>은 남은 목표를 남은 영업일로 나눈 값이다.
                    지금 일평균보다 크면 속도를 올려야 한다는 뜻.
                  </p>
                </HelpTip>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
              <Fact label="남은 목표" value={`${won(p.remaining)}원`} />
              <Fact label="필요 일평균" value={`${won(p.needPerDay)}원`}
                sub={`남은 ${p.totalBiz - p.elapsedBiz}일 · 현재 ${won(avgPerDay)}원`} />
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}

function Tile({
  label, value, unit, sub, delta, deltaLabel, spark, sparkColor, onClick,
}: {
  label: string; value: string; unit?: string; sub?: React.ReactNode;
  delta?: number | null; deltaLabel?: string; spark?: number[]; sparkColor?: string;
  /** 있으면 카드 전체가 눌러진다 — 자식 조직 기준 상세를 연다 */
  onClick?: () => void;
}) {
  const dir = delta === null || delta === undefined ? null : Math.sign(delta);
  return (
    <Card
      className={cn(
        "h-full p-4",
        onClick && "cursor-pointer transition-colors hover:border-foreground/30 hover:bg-muted/40",
      )}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); }
      } : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        {spark && spark.length > 1 && <Sparkline values={spark} color={sparkColor} />}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="tnum text-2xl font-semibold tracking-tight">{value}</span>
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {dir !== null && (
          <span className={cn("font-medium",
            dir > 0 && "text-[var(--status-good)]",
            dir < 0 && "text-[var(--status-critical)]",
            dir === 0 && "text-muted-foreground")}>
            {deltaLabel}
          </span>
        )}
        {sub && <span className="text-muted-foreground">{sub}</span>}
      </div>
    </Card>
  );
}

function Bar({ label, right, value, color }: {
  label: string; right: string; value: number; color: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium">{label}</span>
        <span className="tnum text-muted-foreground">{right}</span>
      </div>
      <Progress value={value} indicatorColor={color} className="h-2.5" />
    </div>
  );
}

function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="tnum mt-0.5 text-lg font-semibold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export { mdw };
