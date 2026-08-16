"use client";

import * as React from "react";
import { Flame, Gift, Search, UserPlus } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CumulativeChart, Sparkline } from "@/components/charts/chart-kit";
import { Section } from "./section";
import {
  awardEarners,
  movers,
  paretoCurve,
  paretoShare,
} from "@/lib/analytics";
import { m, md, n, pct, won } from "@/lib/format";
import type { CenterData, PersonRow } from "@/lib/types";

type SortKey = "cred" | "dCred" | "awardMoney";

export function People({ data }: { data: CenterData }) {
  const [q, setQ] = React.useState("");
  const [sort, setSort] = React.useState<SortKey>("cred");
  const [limit, setLimit] = React.useState(25);
  const [onlyMoved, setOnlyMoved] = React.useState(false);

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    let rows = data.people;
    if (needle) {
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(needle) ||
          r.branch.toLowerCase().includes(needle) ||
          r.agency.toLowerCase().includes(needle) ||
          (r.manager ?? "").toLowerCase().includes(needle),
      );
    }
    if (onlyMoved) rows = rows.filter((r) => r.dCred > 0);
    return [...rows].sort((a, b) => b[sort] - a[sort]);
  }, [data.people, q, sort, onlyMoved]);

  const top = movers(data.people, 8);
  const earners = awardEarners(data.people);
  const pareto = paretoCurve(data.people);
  const activeCount = data.people.filter((r) => r.cred > 0).length;
  const share20 = paretoShare(data.people, Math.ceil(activeCount * 0.2));

  const paretoTrend = pareto
    .filter((_, i) => i % Math.max(1, Math.floor(pareto.length / 40)) === 0)
    .map((d) => ({
      x: d.x,
      actual: d.y,
      title: d.title,
      extra: [{ label: "누적 실적", value: `${won(d.acc)}원` }],
    }));

  return (
    <Section
      id="people"
      title="설계사 분석"
      desc={`실적 행이 존재하는 ${data.people.length}명 · 당월 가동 ${activeCount}명 · 금액 단위 만원`}
      action={
        <Badge variant="outline">가동자 상위 20% 가 전체의 {pct(share20)}</Badge>
      }
    >
      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5 text-[var(--series-2)]" />
              오늘 움직인 설계사
            </CardTitle>
            <CardDescription>
              {md(data.asOf)} 기준 직전 스냅샷 대비 실적 증가분 상위
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {top.length === 0 && (
              <p className="text-xs text-muted-foreground">
                직전 대비 증분이 없습니다.
              </p>
            )}
            {top.map((r) => (
              <div key={`${r.code}-${r.name}`} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{r.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {r.branch}
                  </div>
                </div>
                <span className="tnum shrink-0 text-sm font-medium text-[var(--status-good)]">
                  +{m(r.dCred)}만
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>기여도 집중도 (파레토)</CardTitle>
            <CardDescription>
              x축 = 실적 상위 n번째 가동자, y축 = 그때까지의 누적 기여 비율(%).
              곡선이 왼쪽에서 급히 솟을수록 소수 의존도가 높다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CumulativeChart data={paretoTrend} unit="%" height={220} />
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
              {[5, 10, 20].map((k) => (
                <div key={k} className="rounded-lg border px-3 py-2">
                  <div className="text-muted-foreground">상위 {k}명</div>
                  <div className="tnum text-base font-semibold">
                    {pct(paretoShare(data.people, k))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 설계사별 시상금 -------------------------------------------------- */}
      <Card className="mt-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <Gift className="h-3.5 w-3.5 text-[var(--series-2)]" />
            설계사별 시상금
          </CardTitle>
          <CardDescription>
            시상금은 설계사 개인이 받는 돈이라 조직 단위로 합산하지 않는다.
            현재 {earners.length}명이 수령 대상.
          </CardDescription>
          <p className="text-xs text-muted-foreground">
            ※ 시상금이 당월 실적보다 커 보이는 건 월드투어처럼 2~3달에 걸친
            시상이 섞여 있어서다.
          </p>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          {earners.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 pl-5">#</TableHead>
                  <TableHead>설계사</TableHead>
                  <TableHead className="hidden md:table-cell">지사</TableHead>
                  <TableHead className="text-right">실적(만원)</TableHead>
                  <TableHead className="pr-5 text-right">시상금(만원)</TableHead>
                  <TableHead className="hidden pr-5 lg:table-cell">
                    내역
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {earners.slice(0, 20).map((r, i) => (
                  <TableRow key={`${r.code}-${r.name}`}>
                    <TableCell className="tnum pl-5 text-muted-foreground">
                      {i + 1}
                    </TableCell>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="hidden max-w-[200px] md:table-cell">
                      <span className="block truncate text-muted-foreground">
                        {r.branch}
                      </span>
                    </TableCell>
                    <TableCell className="tnum text-right">{m(r.cred)}</TableCell>
                    <TableCell className="tnum pr-5 text-right font-medium text-[var(--status-good)]">
                      {m(r.awardMoney)}만
                    </TableCell>
                    <TableCell className="hidden max-w-[320px] pr-5 lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {r.awardItems.slice(0, 4).map((a) => (
                          <Badge key={a.label} variant="muted">
                            {a.label} {m(a.money)}만
                          </Badge>
                        ))}
                        {r.awardItems.length > 4 && (
                          <Badge variant="muted">
                            +{r.awardItems.length - 4}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="px-5 py-6 text-sm text-muted-foreground">
              아직 시상 확정자가 없습니다.
            </p>
          )}
        </CardContent>
      </Card>

      {/* 전체 목록 -------------------------------------------------------- */}
      <Card className="mt-3">
        <CardHeader className="gap-3">
          <div>
            <CardTitle>설계사 목록</CardTitle>
            <CardDescription>
              이름 · 지사 · 담당 매니저로 검색됩니다. 금액 단위 만원.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="설계사 / 지사 / 담당 검색"
                className="pl-8"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ["cred", "실적"],
                  ["dCred", "전일 증분"],
                  ["awardMoney", "시상금"],
                ] as [SortKey, string][]
              ).map(([k, label]) => (
                <Button
                  key={k}
                  size="sm"
                  variant={sort === k ? "secondary" : "ghost"}
                  className="h-8"
                  onClick={() => setSort(k)}
                >
                  {label}
                </Button>
              ))}
              <Button
                size="sm"
                variant={onlyMoved ? "secondary" : "ghost"}
                className="h-8"
                onClick={() => setOnlyMoved((v) => !v)}
              >
                <UserPlus className="mr-1 h-3.5 w-3.5" />
                오늘 실적만
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 pl-5">#</TableHead>
                <TableHead>설계사</TableHead>
                <TableHead className="hidden md:table-cell">지사</TableHead>
                <TableHead className="hidden lg:table-cell">담당</TableHead>
                <TableHead className="text-right">실적</TableHead>
                <TableHead className="text-right">전일</TableHead>
                <TableHead className="text-right">시상금</TableHead>
                <TableHead className="hidden text-right sm:table-cell">
                  주차
                </TableHead>
                <TableHead className="hidden pr-5 text-right sm:table-cell">
                  추이
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, limit).map((r, i) => (
                <PersonRowView key={`${r.code}-${r.name}-${i}`} r={r} idx={i} />
              ))}
            </TableBody>
          </Table>
          {filtered.length > limit && (
            <div className="px-5 pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLimit((v) => v + 50)}
              >
                {n(filtered.length - limit)}명 더 보기
              </Button>
            </div>
          )}
          {filtered.length === 0 && (
            <p className="px-5 py-6 text-sm text-muted-foreground">
              조건에 맞는 설계사가 없습니다.
            </p>
          )}
        </CardContent>
      </Card>
    </Section>
  );
}

function PersonRowView({ r, idx }: { r: PersonRow; idx: number }) {
  return (
    <TableRow>
      <TableCell className="tnum pl-5 text-muted-foreground">{idx + 1}</TableCell>
      <TableCell>
        <div className="font-medium">{r.name}</div>
        <div className="text-xs text-muted-foreground md:hidden">{r.branch}</div>
      </TableCell>
      <TableCell className="hidden max-w-[200px] md:table-cell">
        <div className="truncate text-muted-foreground">{r.branch}</div>
      </TableCell>
      <TableCell className="hidden text-muted-foreground lg:table-cell">
        {r.manager ?? "—"}
      </TableCell>
      <TableCell className="tnum text-right font-medium">{m(r.cred)}</TableCell>
      <TableCell
        className={`tnum text-right ${
          r.dCred > 0 ? "text-[var(--status-good)]" : "text-muted-foreground"
        }`}
      >
        {r.dCred ? m(r.dCred) : "—"}
      </TableCell>
      <TableCell
        className={`tnum text-right ${
          r.awardMoney > 0 ? "" : "text-muted-foreground"
        }`}
      >
        {r.awardMoney ? m(r.awardMoney) : "—"}
      </TableCell>
      <TableCell className="hidden text-right sm:table-cell">
        <div className="flex justify-end gap-0.5">
          {r.weeks.map((w, i) => (
            <span
              key={i}
              title={`${i + 1}주차 ${m(w)}만원`}
              className="h-4 w-1.5 rounded-[2px]"
              style={{
                background: w > 0 ? "var(--series-1)" : "var(--viz-grid)",
              }}
            />
          ))}
        </div>
      </TableCell>
      <TableCell className="hidden pr-5 text-right sm:table-cell">
        <div className="flex justify-end">
          <Sparkline values={r.series.map((s) => s.cred)} />
        </div>
      </TableCell>
    </TableRow>
  );
}
