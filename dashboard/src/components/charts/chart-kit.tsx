"use client";

/**
 * recharts 위에 얇게 얹은 차트 키트.
 *
 * 규칙(전부 의도적임)
 *  - y축은 하나만 쓴다. 성격이 다른 두 지표는 차트를 나눈다.
 *  - 격자/축은 뒤로 물리고(muted), 마크는 얇게.
 *  - 막대 끝은 4px 라운드, 인접 막대 사이에 2px 배경색 간격.
 *  - 시리즈가 2개 이상이면 범례를 항상 띄운다(색만으로 구분하지 않기).
 *  - 색은 검증된 팔레트 토큰(--series-N)만 사용한다.
 */

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "@/lib/utils";

const AXIS = {
  stroke: "var(--viz-axis)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

const GRID = {
  stroke: "var(--viz-grid)",
  strokeDasharray: "3 3",
  vertical: false,
} as const;

type TipRow = { label: string; value: string; color?: string };

function TipBox({
  title,
  rows,
}: {
  title: string;
  rows: TipRow[];
}) {
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-medium text-popover-foreground">{title}</div>
      <div className="space-y-0.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-2">
            {r.color && (
              <span
                className="h-2 w-2 shrink-0 rounded-[2px]"
                style={{ background: r.color }}
              />
            )}
            <span className="text-muted-foreground">{r.label}</span>
            <span className="tnum ml-auto font-medium text-popover-foreground">
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export type SimpleDatum = {
  /** x축 라벨 */
  x: string;
  /** 값 */
  y: number;
  /** 툴팁 제목(없으면 x) */
  title?: string;
  /** 추가 툴팁 행 */
  extra?: TipRow[];
  /** 이 항목만 강조할 때 */
  highlight?: boolean;
};

export function ChartFrame({
  height = 220,
  children,
  className,
}: {
  height?: number;
  children: React.ReactElement;
  className?: string;
}) {
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 세로 막대 — 일간/주간 증분처럼 "크기"를 읽는 데이터                  */
/* ------------------------------------------------------------------ */
export function ColumnChart({
  data,
  unit = "P",
  height = 220,
  color = "var(--series-1)",
  highlightColor = "var(--series-2)",
  avg,
  avgLabel = "평균",
}: {
  data: SimpleDatum[];
  unit?: string;
  height?: number;
  color?: string;
  highlightColor?: string;
  avg?: number;
  avgLabel?: string;
}) {
  return (
    <ChartFrame height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid {...GRID} />
        <XAxis dataKey="x" {...AXIS} />
        <YAxis {...AXIS} width={54} tickFormatter={(v) => nfShort(v)} />
        <Tooltip
          cursor={{ fill: "var(--viz-grid)", opacity: 0.5 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as SimpleDatum;
            return (
              <TipBox
                title={d.title ?? d.x}
                rows={[
                  {
                    label: "실적",
                    value: `${nfFull(d.y)}${unit}`,
                    color: d.highlight ? highlightColor : color,
                  },
                  ...(d.extra ?? []),
                ]}
              />
            );
          }}
        />
        {avg !== undefined && (
          <ReferenceLine
            y={avg}
            stroke="var(--viz-axis)"
            strokeDasharray="4 4"
            label={{
              value: `${avgLabel} ${nfShort(avg)}`,
              position: "insideTopLeft",
              fill: "var(--viz-axis)",
              fontSize: 10,
            }}
          />
        )}
        <Bar dataKey="y" radius={[4, 4, 0, 0]} maxBarSize={44}>
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={d.highlight ? highlightColor : color}
              stroke="var(--card)"
              strokeWidth={2}
            />
          ))}
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}

/* ------------------------------------------------------------------ */
/* 가로 막대 — 랭킹                                                    */
/* ------------------------------------------------------------------ */
export function RankBarChart({
  data,
  unit = "P",
  height,
  color = "var(--series-1)",
  highlightColor = "var(--series-2)",
  labelWidth = 150,
}: {
  data: SimpleDatum[];
  unit?: string;
  height?: number;
  color?: string;
  highlightColor?: string;
  labelWidth?: number;
}) {
  const h = height ?? Math.max(140, data.length * 30 + 24);
  return (
    <ChartFrame height={h}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 44, bottom: 4, left: 4 }}
      >
        <CartesianGrid {...GRID} vertical horizontal={false} />
        <XAxis type="number" {...AXIS} tickFormatter={(v) => nfShort(v)} />
        <YAxis
          type="category"
          dataKey="x"
          {...AXIS}
          width={labelWidth}
          interval={0}
          /* 기본 tick 은 폭이 좁으면 두 줄로 접혀 막대와 어긋난다. 한 줄 고정. */
          tick={(props) => {
            const { x, y, payload } = props as {
              x: number;
              y: number;
              payload: { value: string };
            };
            return (
              <text
                x={x}
                y={y}
                dy={4}
                textAnchor="end"
                fill="var(--viz-axis)"
                fontSize={11}
              >
                {payload.value}
              </text>
            );
          }}
        />
        <Tooltip
          cursor={{ fill: "var(--viz-grid)", opacity: 0.5 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as SimpleDatum;
            return (
              <TipBox
                title={d.title ?? d.x}
                rows={[
                  {
                    label: "실적",
                    value: `${nfFull(d.y)}${unit}`,
                    color: d.highlight ? highlightColor : color,
                  },
                  ...(d.extra ?? []),
                ]}
              />
            );
          }}
        />
        <Bar dataKey="y" radius={[0, 4, 4, 0]} maxBarSize={18}>
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={d.highlight ? highlightColor : color}
              stroke="var(--card)"
              strokeWidth={2}
            />
          ))}
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}

/* ------------------------------------------------------------------ */
/* 누적 추이 — 선/면. 예측 구간은 점선으로 이어 붙인다.                 */
/* ------------------------------------------------------------------ */
export type TrendDatum = {
  x: string;
  actual: number | null;
  projected?: number | null;
  title?: string;
  extra?: TipRow[];
};

export function CumulativeChart({
  data,
  unit = "P",
  height = 240,
  color = "var(--series-1)",
  projectionColor = "var(--series-2)",
  showProjection = false,
  goal,
  goalLabel = "목표",
}: {
  data: TrendDatum[];
  unit?: string;
  height?: number;
  color?: string;
  projectionColor?: string;
  showProjection?: boolean;
  /** 목표선. 값이 있으면 가로 기준선으로 깔린다. */
  goal?: number;
  goalLabel?: string;
}) {
  return (
    <ChartFrame height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <defs>
          <linearGradient id="fillActual" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid {...GRID} />
        <XAxis dataKey="x" {...AXIS} />
        <YAxis {...AXIS} width={54} tickFormatter={(v) => nfShort(v)} />
        <Tooltip
          cursor={{ stroke: "var(--viz-axis)", strokeDasharray: "3 3" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as TrendDatum;
            const rows: TipRow[] = [];
            if (d.actual !== null && d.actual !== undefined)
              rows.push({
                label: "누적",
                value: `${nfFull(d.actual)}${unit}`,
                color,
              });
            if (showProjection && d.projected !== null && d.projected !== undefined)
              rows.push({
                label: "예상",
                value: `${nfFull(d.projected)}${unit}`,
                color: projectionColor,
              });
            return <TipBox title={d.title ?? d.x} rows={[...rows, ...(d.extra ?? [])]} />;
          }}
        />
        {goal !== undefined && (
          <ReferenceLine
            y={goal}
            stroke="var(--viz-axis)"
            strokeDasharray="6 4"
            label={{
              value: `${goalLabel} ${nfShort(goal)}`,
              position: "insideTopLeft",
              fill: "var(--viz-axis)",
              fontSize: 10,
            }}
          />
        )}
        <Area
          type="monotone"
          dataKey="actual"
          stroke={color}
          strokeWidth={2}
          fill="url(#fillActual)"
          dot={{ r: 3, fill: color, stroke: "var(--card)", strokeWidth: 2 }}
          activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2 }}
          connectNulls={false}
        />
        {showProjection && (
          <Area
            type="monotone"
            dataKey="projected"
            stroke={projectionColor}
            strokeWidth={2}
            strokeDasharray="5 4"
            fill="none"
            dot={false}
            connectNulls
          />
        )}
      </AreaChart>
    </ChartFrame>
  );
}

/* ------------------------------------------------------------------ */
/* 다중 선 — 지사/지점 비교 (최대 4개, 범례 필수)                       */
/* ------------------------------------------------------------------ */
export function MultiLineChart({
  data,
  series,
  unit = "P",
  height = 260,
}: {
  data: Record<string, string | number | null>[];
  series: { key: string; label: string; color: string }[];
  unit?: string;
  height?: number;
}) {
  return (
    <div>
      <ChartFrame height={height}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="x" {...AXIS} />
          <YAxis {...AXIS} width={54} tickFormatter={(v) => nfShort(v)} />
          <Tooltip
            cursor={{ stroke: "var(--viz-axis)", strokeDasharray: "3 3" }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <TipBox
                  title={String(label)}
                  rows={series
                    .map((s) => {
                      const hit = payload.find((pp) => pp.dataKey === s.key);
                      return hit
                        ? {
                            label: s.label,
                            value: `${nfFull(Number(hit.value))}${unit}`,
                            color: s.color,
                          }
                        : null;
                    })
                    .filter(Boolean) as TipRow[]}
                />
              );
            }}
          />
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              stroke={s.color}
              strokeWidth={2}
              dot={{ r: 3, fill: s.color, stroke: "var(--card)", strokeWidth: 2 }}
              activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2 }}
            />
          ))}
        </LineChart>
      </ChartFrame>
      <Legend items={series} />
    </div>
  );
}

export function Legend({
  items,
}: {
  items: { label: string; color: string }[];
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((s) => (
        <div key={s.label} className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-[2px]"
            style={{ background: s.color }}
          />
          <span className="text-xs text-muted-foreground">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 스파크라인 — 표 안에 들어가는 초소형 추이                            */
/* ------------------------------------------------------------------ */
export function Sparkline({
  values,
  color = "var(--series-1)",
  width = 72,
  height = 22,
}: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return <span className="text-muted-foreground">—</span>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * (width - 2) + 1;
      const y = height - 2 - ((v - min) / span) * (height - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/** 축 눈금 — 만원 단위 숫자를 그대로 읽히게 둔다. */
function nfShort(v: number) {
  if (Math.abs(v) >= 1000)
    return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(v);
  if (Math.abs(v) >= 10) return v.toFixed(0);
  return v.toFixed(1);
}

function nfFull(v: number) {
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 }).format(v);
}
