"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, TriangleAlert } from "lucide-react";
import {
  CartesianGrid, Cell, ReferenceArea, ReferenceLine, ResponsiveContainer,
  Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from "recharts";

import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Legend, RankBarChart, type SimpleDatum } from "@/components/charts/chart-kit";
import { LEVEL_COLOR, LEVEL_LABEL, diagnose, unitPace, type Level } from "@/lib/analytics";
import { m, pct, won } from "@/lib/format";
import type { Compare, Unit } from "@/lib/types";

export type Diagnosed = Unit & {
  level: Level;
  flags: string[];
  gapPp: number | null;
};

export function diagnoseAll(children: Unit[], asOf: string): Diagnosed[] {
  return children.map((u) => {
    const gapPp = u.target ? unitPace(u, asOf).gapPp : null;
    const d = diagnose(u, gapPp);
    return { ...u, gapPp, level: d.level, flags: d.flags };
  });
}

const ORDER: Record<Level, number> = { alert: 0, watch: 1, ok: 2 };

/**
 * 궤도 이탈 진단.
 *
 * 세 가지를 겹쳐 본다.
 *   ① 동료 대비 편차(z)  — 중앙값에서 몇 σ 떨어졌나
 *   ② 모멘텀            — 최근 속도가 붙는지 빠지는지
 *   ③ 목표 페이스        — 목표가 있는 조직만
 *
 * 평균·표준편차 대신 중앙값·MAD 를 쓴다. 조직 수가 적어 이상치 한둘이
 * 평균을 끌고 가면 "이상치가 스스로를 정상으로" 만들기 때문이다.
 */
export function Deviation({
  units, compare, label,
}: {
  units: Diagnosed[];
  compare: Compare;
  label: string;
  /** 진단은 diagnoseAll 에서 이미 끝났다. 시그니처 통일을 위해 남겨 둔 값 */
  asOf?: string;
}) {
  const band = compare.band;
  const flagged = [...units].filter((u) => u.level !== "ok")
    .sort((a, b) => ORDER[a.level] - ORDER[b.level] || (a.z ?? 0) - (b.z ?? 0));

  const zBars: SimpleDatum[] = [...units]
    .sort((a, b) => (b.z ?? 0) - (a.z ?? 0))
    .map((u) => ({
      x: u.name, y: u.z ?? 0, title: u.name,
      highlight: u.level !== "ok",
      extra: [
        { label: compare.label, value: compare.field === "achievedPct"
            ? pct(u.achievedPct) : `${m((u.perCapita ?? 0) * 10)}만원/명` },
        { label: "실적", value: `${won(u.cred)}원` },
        { label: "모멘텀", value: u.momentum ? `${u.momentum.toFixed(2)}배` : "—" },
      ],
    }));

  const scatter = units.map((u) => ({
    x: u.z ?? 0,
    y: u.momentum ?? 1,
    name: u.name,
    level: u.level,
    cred: u.cred,
    href: u.href,
  }));

  const counts = {
    alert: units.filter((u) => u.level === "alert").length,
    watch: units.filter((u) => u.level === "watch").length,
    ok: units.filter((u) => u.level === "ok").length,
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <Count icon={<AlertTriangle className="h-3.5 w-3.5" />} level="alert"
          n={counts.alert} total={units.length} />
        <Count icon={<TriangleAlert className="h-3.5 w-3.5" />} level="watch"
          n={counts.watch} total={units.length} />
        <Count icon={<CheckCircle2 className="h-3.5 w-3.5" />} level="ok"
          n={counts.ok} total={units.length} />
      </div>

      {flagged.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>지금 살펴야 할 {label}</CardTitle>
            <CardDescription>
              이탈 → 주의 순. 근거를 배지로 붙였다. 클릭하면 해당 조직으로 이동한다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {flagged.map((u) => (
              <Row key={u.key} u={u} compare={compare} />
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>동료 대비 편차 ({compare.label})</CardTitle>
            <CardDescription>
              0 = 중앙값. 단위는 σ(MAD 기준). <b>−2 아래면 확실한 이탈</b>이다.
              {band?.median !== undefined && (
                <> 중앙값 {compare.field === "achievedPct"
                  ? pct(band.median) : `${m(band.median * 10)}만원/명`}</>)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RankBarChart data={zBars} unit="σ" labelWidth={132} />
            <Legend items={[
              { label: "정상 범위", color: "var(--series-1)" },
              { label: "주의·이탈", color: "var(--series-2)" },
            ]} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>편차 × 속도</CardTitle>
            <CardDescription>
              가로 = 동료 대비 위치, 세로 = 최근 속도(1.0이 유지).
              <b> 왼쪽 아래</b>가 가장 위험하다 — 낮은데 더 느려지는 중.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <QuadrantChart data={scatter} />
            <Legend items={[
              { label: LEVEL_LABEL.ok, color: LEVEL_COLOR.ok },
              { label: LEVEL_LABEL.watch, color: LEVEL_COLOR.watch },
              { label: LEVEL_LABEL.alert, color: LEVEL_COLOR.alert },
            ]} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Count({ icon, level, n, total }: {
  icon: React.ReactNode; level: Level; n: number; total: number;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5 text-xs" style={{ color: LEVEL_COLOR[level] }}>
        {icon}<span className="font-medium">{LEVEL_LABEL[level]}</span>
      </div>
      <div className="tnum mt-1 text-xl font-semibold">
        {n}<span className="text-sm font-normal text-muted-foreground"> / {total}</span>
      </div>
    </Card>
  );
}

function Row({ u, compare }: { u: Diagnosed; compare: Compare }) {
  const body = (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 transition-colors hover:bg-muted/50">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: LEVEL_COLOR[u.level] }} />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{u.name}</span>
      <span className="tnum shrink-0 text-xs text-muted-foreground">
        {compare.field === "achievedPct" ? pct(u.achievedPct) : `${m((u.perCapita ?? 0) * 10)}만/명`}
        {" · "}{won(u.cred)}원
      </span>
      <div className="flex w-full flex-wrap gap-1 sm:w-auto">
        {u.flags.map((f) => (
          <Badge key={f} variant="muted" className="text-[10px]">{f}</Badge>
        ))}
      </div>
    </div>
  );
  return u.href ? <Link href={u.href} className="block">{body}</Link> : body;
}

/** 4사분면 산점도. 축 하나에 한 의미만 담아서 이중축 문제를 피한다. */
function QuadrantChart({ data }: {
  data: { x: number; y: number; name: string; level: Level; cred: number; href?: string }[];
}) {
  const xs = data.map((d) => d.x);
  const ys = data.map((d) => d.y);
  const xr = Math.max(2.5, ...xs.map(Math.abs)) * 1.15;
  const yLo = Math.min(0.6, ...ys) * 0.9;
  const yHi = Math.max(1.4, ...ys) * 1.1;

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 14, bottom: 4, left: -22 }}>
          {/* 위험 구역(왼쪽 아래)을 옅게 깔아 시선을 유도 */}
          <ReferenceArea x1={-xr} x2={-1.5} y1={yLo} y2={0.9}
            fill="var(--status-critical)" fillOpacity={0.06} />
          <CartesianGrid stroke="var(--viz-grid)" strokeDasharray="3 3" />
          <XAxis type="number" dataKey="x" domain={[-xr, xr]}
            stroke="var(--viz-axis)" fontSize={11} tickLine={false} axisLine={false}
            tickFormatter={(v) => `${v > 0 ? "+" : ""}${Number(v).toFixed(1)}σ`} />
          <YAxis type="number" dataKey="y" domain={[yLo, yHi]} width={52}
            stroke="var(--viz-axis)" fontSize={11} tickLine={false} axisLine={false}
            tickFormatter={(v) => `${Number(v).toFixed(1)}x`} />
          <ZAxis range={[70, 70]} />
          <ReferenceLine x={0} stroke="var(--viz-axis)" strokeDasharray="4 4" />
          <ReferenceLine y={1} stroke="var(--viz-axis)" strokeDasharray="4 4" />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as (typeof data)[number];
              return (
                <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg">
                  <div className="mb-1 font-medium">{d.name}</div>
                  <div className="space-y-0.5 text-muted-foreground">
                    <div>편차 <span className="tnum text-foreground">
                      {d.x > 0 ? "+" : ""}{d.x.toFixed(2)}σ</span></div>
                    <div>속도 <span className="tnum text-foreground">{d.y.toFixed(2)}배</span></div>
                    <div>실적 <span className="tnum text-foreground">{won(d.cred)}원</span></div>
                    <div style={{ color: LEVEL_COLOR[d.level] }}>{LEVEL_LABEL[d.level]}</div>
                  </div>
                </div>
              );
            }} />
          <Scatter data={data}>
            {data.map((d, i) => (
              <Cell key={i} fill={LEVEL_COLOR[d.level]}
                stroke="var(--card)" strokeWidth={2} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
