"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";

import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Legend, MultiLineChart, RankBarChart, Sparkline, type SimpleDatum,
} from "@/components/charts/chart-kit";
import { LEVEL_COLOR } from "@/lib/analytics";
import { HelpTip } from "./help-tip";
import { m, man, md, n, pct } from "@/lib/format";
import type { Compare } from "@/lib/types";
import { ClickableRow } from "./clickable-row";
import type { Diagnosed } from "./deviation";

const LINE = ["var(--series-1)", "var(--series-2)", "var(--series-3)"];
type SortKey = "cred" | "achievedPct" | "perCapita" | "activeRate" | "momentum";

/** 자식 조직(영업단 / 센터 / 지사) 랭킹 + 상세표. 행을 누르면 한 단계 내려간다. */
export function ChildrenPanel({
  units, label, dates, showLinks = true,
}: {
  units: Diagnosed[];
  /** 상위가 어떤 잣대로 비교했는지 — 현재 표에서는 쓰지 않지만 호출부 시그니처를 맞춰 둔다 */
  compare?: Compare;
  label: string;
  dates: string[];
  showLinks?: boolean;
}) {
  const hasTarget = units.some((u) => u.achievedPct !== null);
  const [sort, setSort] = React.useState<SortKey>(hasTarget ? "achievedPct" : "cred");

  const rows = React.useMemo(
    () => [...units].sort((a, b) => (b[sort] ?? -Infinity) - (a[sort] ?? -Infinity)),
    [units, sort],
  );

  const bars: SimpleDatum[] = rows.slice(0, 15).map((u) => ({
    x: u.name, y: sort === "cred" ? man(u.cred) : (u[sort] ?? 0),
    title: u.name, highlight: u.level !== "ok",
    extra: [
      { label: "실적", value: `${m(u.cred)}만원` },
      ...(u.achievedPct !== null ? [{ label: "달성률", value: pct(u.achievedPct) }] : []),
      { label: "가동/재적", value: `${u.active} / ${n(u.headcount)}명` },
    ],
  }));

  const top3 = rows.slice(0, 3);
  const lineData = dates.map((d, i) => {
    const row: Record<string, string | number | null> = { x: md(d) };
    top3.forEach((u, k) => { row[`s${k}`] = man(u.series[i]?.cred ?? 0); });
    return row;
  });

  /** 지금 줄 세운 잣대와 짝이 되는 다른 잣대. 규모와 달성도가 어긋나는 조직을 드러낸다. */
  const alt: { key: SortKey; label: string } | null =
    sort === "cred"
      ? (hasTarget ? { key: "achievedPct", label: "달성률" } : { key: "perCapita", label: "인당" })
      : { key: "cred", label: "실적" };

  const SORTS: [SortKey, string][] = [
    ["cred", "실적"],
    ...(hasTarget ? ([["achievedPct", "달성률"]] as [SortKey, string][]) : []),
    ["perCapita", "인당생산성"],
    ["activeRate", "가동률"],
    ["momentum", "속도"],
  ];

  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader className="gap-2">
            <div>
              <CardTitle>{label} 랭킹</CardTitle>
              <CardDescription className="flex items-center gap-1.5">
                기본 정렬 {hasTarget ? "달성률" : "인당생산성"}
                <HelpTip title="왜 총액순이 기본이 아닌가" width="w-72">
                  <p>
                    조직마다 목표와 재적이 달라서 <b>총액 랭킹은 사실상 규모 순위</b>다.
                    큰 조직이 언제나 위에 온다.
                  </p>
                  <p>
                    {hasTarget
                      ? "목표가 모두 등록돼 있어 달성률로 줄 세운다."
                      : "목표가 없는 조직이 섞여 있어 재적 1인당 실적(인당생산성)으로 대신 줄 세운다."}
                  </p>
                </HelpTip>
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-1">
              {SORTS.map(([k, l]) => (
                <Button key={k} size="sm" className="h-7"
                  variant={sort === k ? "secondary" : "ghost"}
                  onClick={() => setSort(k)}>{l}</Button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <RankBarChart data={bars}
              unit={sort === "cred" ? "만원" : sort === "momentum" ? "배" : sort === "perCapita" ? "천원" : "%"}
              labelWidth={132} />
            <Legend items={[
              { label: "정상", color: "var(--series-1)" },
              { label: "주의·이탈", color: "var(--series-2)" },
            ]} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>상위 3개 누적 추이 (만원)</CardTitle>
            <CardDescription>같은 축·같은 단위. 기울기가 그 조직의 속도다.</CardDescription>
          </CardHeader>
          <CardContent>
            <MultiLineChart data={lineData} unit="만원"
              series={top3.map((u, i) => ({
                key: `s${i}`, label: u.name, color: LINE[i],
              }))} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{label} 상세</CardTitle>
          <CardDescription className="flex items-center gap-1.5">
            금액 만원{showLinks && " · 행을 누르면 해당 조직으로 이동"}
            <HelpTip title="표 읽는 법" width="w-72">
              <p><b>인당</b> = 실적 ÷ 재적. 조직 크기를 보정한 값.</p>
              <p><b>속도</b> = 최근 3일 ÷ 이전 3일. 1보다 작으면 느려지는 중.</p>
              <p>이름 앞 점은 궤도 진단 등급(정상·주의·이탈)이다.</p>
              <p>
                <b>#</b> 는 지금 누른 잣대의 순위, 이름 아래 회색 숫자는
                <b> 짝이 되는 다른 잣대의 순위</b>다. 두 숫자가 크게 벌어지면
                규모와 달성도가 어긋난 조직이다.
              </p>
            </HelpTip>
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-9 pl-5">#</TableHead>
                <TableHead>{label}</TableHead>
                {hasTarget && <TableHead className="text-right">달성률</TableHead>}
                <TableHead className="text-right">실적</TableHead>
                <TableHead className="text-right">전일</TableHead>
                <TableHead className="hidden text-right sm:table-cell">가동/재적</TableHead>
                <TableHead className="text-right">가동률</TableHead>
                <TableHead className="hidden text-right md:table-cell">인당</TableHead>
                <TableHead className="text-right">속도</TableHead>
                <TableHead className="hidden pr-5 text-right lg:table-cell">추이</TableHead>
                {showLinks && <TableHead className="w-8 pr-4" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((u, i) => {
                const cells = (
                  <>
                    <TableCell className="tnum pl-5 text-muted-foreground">
                      {u[`${sort}Rank`] ?? i + 1}
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      <div className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: LEVEL_COLOR[u.level] }} />
                        <span className="truncate font-medium">{u.name}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 pl-3 text-xs text-muted-foreground">
                        {u.agency && <span className="truncate">{u.agency}</span>}
                        {alt && u[`${alt.key}Rank`] && (
                          <span className="tnum shrink-0">
                            {alt.label} {u[`${alt.key}Rank`]}위
                          </span>
                        )}
                      </div>
                    </TableCell>
                    {hasTarget && (
                      <TableCell className="tnum text-right font-semibold">
                        {pct(u.achievedPct)}
                      </TableCell>
                    )}
                    <TableCell className="tnum text-right font-medium">{m(u.cred)}</TableCell>
                    <TableCell className={`tnum text-right ${
                      u.dCred > 0 ? "text-[var(--status-good)]" : "text-muted-foreground"}`}>
                      {u.dCred ? m(u.dCred) : "—"}
                    </TableCell>
                    <TableCell className="tnum hidden text-right text-muted-foreground sm:table-cell">
                      {u.active} / {n(u.headcount)}
                    </TableCell>
                    <TableCell className="tnum text-right">{pct(u.activeRate)}</TableCell>
                    <TableCell className="tnum hidden text-right md:table-cell">
                      {u.perCapita !== null ? m(u.perCapita * 10) : "—"}
                    </TableCell>
                    <TableCell className="tnum text-right" style={{
                      color: u.momentum && u.momentum < 0.9
                        ? "var(--status-warning)" : undefined,
                    }}>
                      {u.momentum ? `${u.momentum.toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell className="hidden pr-5 text-right lg:table-cell">
                      <div className="flex justify-end">
                        <Sparkline values={u.series.map((s) => s.cred)} />
                      </div>
                    </TableCell>
                  </>
                );
                const href = showLinks ? u.href : undefined;
                return (
                  <ClickableRow key={u.key} href={href}>
                    {cells}
                    {showLinks && (
                      <TableCell className="pr-4">
                        {u.href && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </TableCell>
                    )}
                  </ClickableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
