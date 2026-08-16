"use client";

import * as React from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Legend,
  RankBarChart,
  Sparkline,
  type SimpleDatum,
} from "@/components/charts/chart-kit";
import { Section } from "./section";
import { m, man, n, pct, won } from "@/lib/format";
import type { BenchmarkData, BenchmarkCenter, CenterData } from "@/lib/types";

type Scope = "dept" | "hq";
type SortBy = "achieved" | "cred";

export function Benchmark({
  data,
  center,
}: {
  data: BenchmarkData;
  center: CenterData;
}) {
  const [scope, setScope] = React.useState<Scope>("dept");
  // 목표가 지점마다 크게 달라서 절대 실적으로 줄 세우면 의미가 없다.
  // 기본 정렬은 달성률.
  const [sortBy, setSortBy] = React.useState<SortBy>("achieved");
  const focusDept = center.focus.dept;

  const rows = React.useMemo(() => {
    const base =
      scope === "dept"
        ? data.centers.filter((c) => c.dept === focusDept)
        : data.centers;
    return [...base].sort((a, b) =>
      sortBy === "achieved"
        ? (b.achievedPct ?? -1) - (a.achievedPct ?? -1)
        : b.cred - a.cred,
    );
  }, [data.centers, scope, focusDept, sortBy]);

  const focusRow = rows.find((c) => c.isFocus);
  const focusIdx = rows.findIndex((c) => c.isFocus);

  const visible = scope === "dept" ? rows : rows.slice(0, 15);

  /* 달성률 막대 — 이게 실제 성적표다. */
  const achieveBars: SimpleDatum[] = visible
    .filter((c) => c.achievedPct !== null)
    .map((c) => ({
      x: c.center,
      y: c.achievedPct!,
      title: c.center,
      highlight: c.isFocus,
      extra: [
        { label: "실적", value: `${won(c.cred)}원` },
        { label: "목표", value: `${won(c.target)}원` },
        { label: "가동/재적", value: `${c.active} / ${n(c.headcount)}명` },
      ],
    }));

  const bars: SimpleDatum[] = visible.map((c) => ({
    x: c.center,
    y: man(c.cred),
    title: c.center,
    highlight: c.isFocus,
    extra: [
      { label: "목표", value: c.target ? `${won(c.target)}원` : "—" },
      { label: "달성률", value: pct(c.achievedPct) },
      { label: "전일 증분", value: `${won(c.dCred)}원` },
    ],
  }));

  const median = rows.length
    ? [...rows].sort((a, b) => a.cred - b.cred)[Math.floor(rows.length / 2)].cred
    : 0;
  const achieved = rows
    .map((c) => c.achievedPct)
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);
  const achieveMedian = achieved.length
    ? achieved[Math.floor(achieved.length / 2)]
    : null;

  /* 가동 1인당 실적 — 규모가 아니라 "한 명이 얼마나 크게 파는가".
     인원수가 비슷한데 총액이 다르면 원인은 대부분 여기에 있다. */
  const perActive = (c: BenchmarkCenter) => (c.active ? c.cred / c.active : 0);
  const productivity: SimpleDatum[] = [...rows]
    .sort((a, b) => perActive(b) - perActive(a))
    .slice(0, scope === "dept" ? rows.length : 15)
    .map((c) => ({
      x: c.center,
      y: man(perActive(c)),
      title: c.center,
      highlight: c.isFocus,
      extra: [
        { label: "실적", value: `${won(c.cred)}원` },
        { label: "가동 인원", value: `${c.active}명` },
      ],
    }));
  const prodMedian = rows.length
    ? [...rows].map(perActive).sort((a, b) => a - b)[Math.floor(rows.length / 2)]
    : 0;
  const focusProd = focusRow ? perActive(focusRow) : 0;

  return (
    <Section
      id="benchmark"
      title="조직 비교"
      desc="지점마다 목표가 크게 다르다. 절대 실적으로 줄 세우면 목표가 큰 지점이 무조건 위로 가므로, 기본 정렬은 달성률이다."
      action={
        <div className="flex flex-wrap gap-1">
          <Button
            size="sm"
            variant={scope === "dept" ? "secondary" : "ghost"}
            className="h-8"
            onClick={() => setScope("dept")}
          >
            {focusDept}
          </Button>
          <Button
            size="sm"
            variant={scope === "hq" ? "secondary" : "ghost"}
            className="h-8"
            onClick={() => setScope("hq")}
          >
            {center.focus.hq} 전체
          </Button>
          <span className="mx-1 w-px bg-border" />
          <Button
            size="sm"
            variant={sortBy === "achieved" ? "secondary" : "ghost"}
            className="h-8"
            onClick={() => setSortBy("achieved")}
          >
            달성률순
          </Button>
          <Button
            size="sm"
            variant={sortBy === "cred" ? "secondary" : "ghost"}
            className="h-8"
            onClick={() => setSortBy("cred")}
          >
            실적순
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat
          label="달성률 순위"
          value={
            focusRow?.achievedPct !== null && focusIdx >= 0 && sortBy === "achieved"
              ? `${focusIdx + 1}위`
              : achievedRankOf(rows, focusRow)
          }
          sub={`${rows.length}개 지점 중`}
        />
        <MiniStat
          label="우리 달성률"
          value={pct(focusRow?.achievedPct)}
          sub={`중앙값 ${pct(achieveMedian)}`}
        />
        <MiniStat
          label="실적 / 목표"
          value={`${m(focusRow?.cred ?? 0)}만`}
          sub={`목표 ${won(focusRow?.target)}원`}
        />
        <MiniStat
          label="가동 1인당 실적"
          value={`${m(focusProd)}만`}
          sub={`중앙값 ${won(prodMedian)}원`}
        />
      </div>

      {achieveBars.length > 0 && (
        <Card className="mt-3">
          <CardHeader>
            <CardTitle>
              목표 달성률 (%) {scope === "hq" && "· 상위 15개"}
            </CardTitle>
            <CardDescription>
              목표가 지점마다 달라 실적 총액은 비교가 안 된다. 같은 잣대는 이것
              하나다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RankBarChart data={achieveBars} unit="%" labelWidth={124} />
            <Legend
              items={[
                { label: "타 지점", color: "var(--series-1)" },
                { label: center.focus.center, color: "var(--series-2)" },
              ]}
            />
          </CardContent>
        </Card>
      )}

      <Card className="mt-3">
        <CardHeader>
          <CardTitle>
            지점별 실적 (만원) {scope === "hq" && "· 상위 15개"}
          </CardTitle>
          <CardDescription>
            참고용 절대 규모. 목표 크기가 그대로 반영되므로 이걸로 잘잘못을
            가리면 안 된다. (중앙값 {won(median)}원)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RankBarChart data={bars} unit="만원" labelWidth={124} />
          <Legend
            items={[
              { label: "타 지점", color: "var(--series-1)" },
              { label: center.focus.center, color: "var(--series-2)" },
            ]}
          />
        </CardContent>
      </Card>

      <Card className="mt-3">
        <CardHeader>
          <CardTitle>
            가동 1인당 실적 (만원) {scope === "hq" && "· 상위 15개"}
          </CardTitle>
          <CardDescription>
            총액이 아니라 &ldquo;가동한 한 사람이 얼마나 크게 파는가&rdquo;. 인원은
            비슷한데 총액이 벌어지면 원인은 대개 여기다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RankBarChart data={productivity} unit="만원" labelWidth={124} />
          <Legend
            items={[
              { label: "타 지점", color: "var(--series-1)" },
              { label: center.focus.center, color: "var(--series-2)" },
            ]}
          />
        </CardContent>
      </Card>

      <Card className="mt-3">
        <CardHeader>
          <CardTitle>지점 상세</CardTitle>
          <CardDescription>
            실적·목표·전일·1인당은 만원. 재적은 &lsquo;지사&rsquo; 시트의 지사별
            설계사수 합계. 목표는 <code>etl/targets.json</code> 에서 읽는다.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 pl-5">#</TableHead>
                <TableHead>지점</TableHead>
                <TableHead className="hidden md:table-cell">부서</TableHead>
                <TableHead className="text-right">달성률</TableHead>
                <TableHead className="text-right">실적</TableHead>
                <TableHead className="text-right">목표</TableHead>
                <TableHead className="text-right">전일</TableHead>
                <TableHead className="hidden text-right sm:table-cell">
                  가동/재적
                </TableHead>
                <TableHead className="text-right">가동률</TableHead>
                <TableHead className="text-right">1인당</TableHead>
                <TableHead className="hidden pr-5 text-right sm:table-cell">
                  추이
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c, i) => (
                <TableRow
                  key={c.center}
                  className={c.isFocus ? "bg-muted/60" : undefined}
                >
                  <TableCell className="tnum pl-5 text-muted-foreground">
                    {i + 1}
                  </TableCell>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-1.5">
                      {c.center}
                      {c.isFocus && (
                        <Badge className="h-4 px-1.5 text-[10px]">우리</Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {c.dept}
                  </TableCell>
                  <TableCell className="tnum text-right font-semibold">
                    {pct(c.achievedPct)}
                  </TableCell>
                  <TableCell className="tnum text-right">{m(c.cred)}</TableCell>
                  <TableCell className="tnum text-right text-muted-foreground">
                    {c.target ? m(c.target) : "—"}
                  </TableCell>
                  <TableCell
                    className={`tnum text-right ${
                      c.dCred > 0
                        ? "text-[var(--status-good)]"
                        : "text-muted-foreground"
                    }`}
                  >
                    {c.dCred ? m(c.dCred) : "—"}
                  </TableCell>
                  <TableCell className="tnum hidden text-right text-muted-foreground sm:table-cell">
                    {c.active} / {n(c.headcount)}
                  </TableCell>
                  <TableCell className="tnum text-right">
                    {pct(c.activeRate)}
                  </TableCell>
                  <TableCell className="tnum text-right">
                    {m(perActive(c))}
                  </TableCell>
                  <TableCell className="hidden pr-5 text-right sm:table-cell">
                    <div className="flex justify-end">
                      <Sparkline
                        values={c.series.map((s) => s.cred)}
                        color={c.isFocus ? "var(--series-2)" : "var(--series-1)"}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Section>
  );
}

/** 정렬이 '실적순' 이어도 달성률 순위는 그대로 보여준다. */
function achievedRankOf(
  rows: BenchmarkCenter[],
  focus: BenchmarkCenter | undefined,
) {
  if (!focus || focus.achievedPct === null) return "—";
  const ordered = rows
    .filter((c) => c.achievedPct !== null)
    .sort((a, b) => b.achievedPct! - a.achievedPct!);
  const i = ordered.findIndex((c) => c.center === focus.center);
  return i >= 0 ? `${i + 1}위` : "—";
}

function MiniStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="tnum mt-1 text-xl font-semibold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}
