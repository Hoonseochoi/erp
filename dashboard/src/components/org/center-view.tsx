"use client";

import * as React from "react";
import { Flame, Gift, Search, Target } from "lucide-react";

import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CumulativeChart, Sparkline } from "@/components/charts/chart-kit";
import { OrgNav } from "./org-nav";
import { OrgHeader } from "./org-header";
import { Trend } from "./trend";
import { Deviation, diagnoseAll } from "./deviation";
import { WeekPacePanel } from "./week-pace";
import { ChildrenPanel } from "./children-table";
import { TabsShell } from "./tabs-shell";
import { awardEarners, movers, paretoCurve, paretoShare } from "@/lib/analytics";
import { m, md, n, pct, won } from "@/lib/format";
import type { CenterData, IndexData, PersonRow } from "@/lib/types";

export function CenterView({ data, index }: { data: CenterData; index: IndexData }) {
  const units = diagnoseAll(data.children, data.asOf);
  const activeCount = data.people.filter((p) => p.cred > 0).length;

  return (
    <div className="container mx-auto max-w-6xl px-4 pb-20">
      <OrgNav index={index} asOf={data.asOf} crumbs={[
        { name: data.grandparent.name, href: data.grandparent.href },
        { name: data.parent.name, href: data.parent.href },
        { name: data.name, href: `/center/${data.key}` },
      ]} />

      <div className="pt-7">
        <OrgHeader data={data}
          subtitle={`${data.parent.name} · 센터장 ${data.head} · 지사 ${data.children.length}개 · 실적 설계사 ${data.people.length}명`} />

        <TabsShell panes={[
          { id: "trend", label: "추이", node: <Trend data={data} /> },
          {
            id: "diag", label: "궤도 진단",
            node: (
              <div className="space-y-8">
                <WeekPacePanel weeks={data.weeks} pace={data.weekPace} />
                <Deviation units={units} compare={data.compare}
                  label="지사" asOf={data.asOf} />
              </div>
            ),
          },
          {
            id: "branch", label: "지사",
            node: <ChildrenPanel units={units} compare={data.compare}
              label="지사" dates={data.dates} showLinks={false} />,
          },
          { id: "people", label: "설계사", node: <People data={data} activeCount={activeCount} /> },
          { id: "award", label: "시상", node: <Awards data={data} /> },
          { id: "mgr", label: "담당 매니저", node: <Managers data={data} /> },
        ]} />
      </div>
    </div>
  );
}

type SortKey = "cred" | "dCred" | "awardMoney";

function People({ data, activeCount }: { data: CenterData; activeCount: number }) {
  const [q, setQ] = React.useState("");
  const [sort, setSort] = React.useState<SortKey>("cred");
  const [limit, setLimit] = React.useState(25);
  const [onlyMoved, setOnlyMoved] = React.useState(false);

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    let rows = data.people;
    if (needle) {
      rows = rows.filter((r) =>
        r.name.toLowerCase().includes(needle) ||
        r.branch.toLowerCase().includes(needle) ||
        r.agency.toLowerCase().includes(needle) ||
        (r.manager ?? "").toLowerCase().includes(needle));
    }
    if (onlyMoved) rows = rows.filter((r) => r.dCred > 0);
    return [...rows].sort((a, b) => b[sort] - a[sort]);
  }, [data.people, q, sort, onlyMoved]);

  const top = movers(data.people, 8);
  const earners = awardEarners(data.people);
  const pareto = paretoCurve(data.people);
  const trend = pareto
    .filter((_, i) => i % Math.max(1, Math.floor(pareto.length / 40)) === 0)
    .map((d) => ({
      x: d.x, actual: d.y, title: d.title,
      extra: [{ label: "누적 실적", value: `${won(d.acc)}원` }],
    }));

  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5 text-[var(--series-2)]" />오늘 움직인 설계사
            </CardTitle>
            <CardDescription>{md(data.asOf)} 직전 스냅샷 대비 증가분 상위</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {top.length === 0 && <p className="text-xs text-muted-foreground">증분이 없습니다.</p>}
            {top.map((r) => (
              <div key={`${r.code}-${r.name}`} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{r.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{r.branch}</div>
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
              x = 실적 상위 n번째 가동자, y = 누적 기여 비율. 왼쪽에서 급히 솟을수록 소수 의존.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CumulativeChart data={trend} unit="%" height={220} />
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <Gift className="h-3.5 w-3.5 text-[var(--series-2)]" />설계사별 시상금
          </CardTitle>
          <CardDescription>
            시상금은 개인이 받는 돈이라 조직 단위로 합산하지 않는다. 현재 {earners.length}명 수령 대상.
            당월 실적보다 커 보이는 건 월드투어처럼 2~3달에 걸친 시상이 섞여서다.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          {earners.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-9 pl-5">#</TableHead>
                  <TableHead>설계사</TableHead>
                  <TableHead className="hidden md:table-cell">지사</TableHead>
                  <TableHead className="text-right">실적(만원)</TableHead>
                  <TableHead className="pr-5 text-right">시상금(만원)</TableHead>
                  <TableHead className="hidden pr-5 lg:table-cell">내역</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {earners.slice(0, 20).map((r, i) => (
                  <TableRow key={`${r.code}-${r.name}`}>
                    <TableCell className="tnum pl-5 text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="hidden max-w-[190px] md:table-cell">
                      <span className="block truncate text-muted-foreground">{r.branch}</span>
                    </TableCell>
                    <TableCell className="tnum text-right">{m(r.cred)}</TableCell>
                    <TableCell className="tnum pr-5 text-right font-medium text-[var(--status-good)]">
                      {m(r.awardMoney)}
                    </TableCell>
                    <TableCell className="hidden max-w-[300px] pr-5 lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {r.awardItems.slice(0, 3).map((a) => (
                          <Badge key={a.label} variant="muted">{a.label} {m(a.money)}만</Badge>
                        ))}
                        {r.awardItems.length > 3 && (
                          <Badge variant="muted">+{r.awardItems.length - 3}</Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="px-5 py-6 text-sm text-muted-foreground">아직 시상 확정자가 없습니다.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3">
          <div>
            <CardTitle>설계사 목록</CardTitle>
            <CardDescription>
              실적 행이 있는 {data.people.length}명 · 당월 가동 {activeCount}명 · 금액 만원
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="설계사 / 지사 / 담당 검색" className="pl-8" />
            </div>
            <div className="flex flex-wrap gap-1">
              {([["cred", "실적"], ["dCred", "전일 증분"], ["awardMoney", "시상금"]] as [SortKey, string][])
                .map(([k, l]) => (
                  <Button key={k} size="sm" className="h-8"
                    variant={sort === k ? "secondary" : "ghost"}
                    onClick={() => setSort(k)}>{l}</Button>
                ))}
              <Button size="sm" className="h-8"
                variant={onlyMoved ? "secondary" : "ghost"}
                onClick={() => setOnlyMoved((v) => !v)}>오늘 실적만</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-9 pl-5">#</TableHead>
                <TableHead>설계사</TableHead>
                <TableHead className="hidden md:table-cell">지사</TableHead>
                <TableHead className="hidden lg:table-cell">담당</TableHead>
                <TableHead className="text-right">실적</TableHead>
                <TableHead className="text-right">전일</TableHead>
                <TableHead className="text-right">시상금</TableHead>
                <TableHead className="hidden text-right sm:table-cell">주차</TableHead>
                <TableHead className="hidden pr-5 text-right sm:table-cell">추이</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, limit).map((r, i) => <Row key={`${r.code}-${i}`} r={r} idx={i} />)}
            </TableBody>
          </Table>
          {filtered.length > limit && (
            <div className="px-5 pt-3">
              <Button variant="outline" size="sm" onClick={() => setLimit((v) => v + 50)}>
                {n(filtered.length - limit)}명 더 보기
              </Button>
            </div>
          )}
          {filtered.length === 0 && (
            <p className="px-5 py-6 text-sm text-muted-foreground">조건에 맞는 설계사가 없습니다.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ r, idx }: { r: PersonRow; idx: number }) {
  return (
    <TableRow>
      <TableCell className="tnum pl-5 text-muted-foreground">{idx + 1}</TableCell>
      <TableCell>
        <div className="font-medium">{r.name}</div>
        <div className="text-xs text-muted-foreground md:hidden">{r.branch}</div>
      </TableCell>
      <TableCell className="hidden max-w-[190px] md:table-cell">
        <div className="truncate text-muted-foreground">{r.branch}</div>
      </TableCell>
      <TableCell className="hidden text-muted-foreground lg:table-cell">{r.manager ?? "—"}</TableCell>
      <TableCell className="tnum text-right font-medium">{m(r.cred)}</TableCell>
      <TableCell className={`tnum text-right ${
        r.dCred > 0 ? "text-[var(--status-good)]" : "text-muted-foreground"}`}>
        {r.dCred ? m(r.dCred) : "—"}
      </TableCell>
      <TableCell className={`tnum text-right ${r.awardMoney > 0 ? "" : "text-muted-foreground"}`}>
        {r.awardMoney ? m(r.awardMoney) : "—"}
      </TableCell>
      <TableCell className="hidden text-right sm:table-cell">
        <div className="flex justify-end gap-0.5">
          {r.weeks.map((w, i) => (
            <span key={i} title={`${i + 1}주차 ${m(w)}만원`} className="h-4 w-1.5 rounded-[2px]"
              style={{ background: w > 0 ? "var(--series-1)" : "var(--viz-grid)" }} />
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

function Awards({ data }: { data: CenterData }) {
  const live = data.awards.filter((a) => a.eligible > 0);
  const running = live.filter((a) => a.achieved > 0 || a.near.length > 0);
  const [pick, setPick] = React.useState(running[0]?.key ?? "");
  const picked = running.find((a) => a.key === pick);
  const winners = data.people.filter((p) => p.awardMoney > 0).length;
  const nearTotal = live.reduce((a, b) => a + b.near.length, 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline">시상 확정 {winners}명</Badge>
        <Badge variant="outline">문턱 근접 {nearTotal}건</Badge>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>항목별 달성 현황</CardTitle>
            <CardDescription>
              누르면 옆 근접자 목록이 바뀐다. 기준선은 전 팀 데이터에서 &lsquo;시상금이 찍힌
              최소 실적&rsquo;으로 역산한 값이다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {running.map((a) => (
              <button key={a.key} onClick={() => setPick(a.key)}
                className={`w-full rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/60 ${
                  pick === a.key ? "bg-muted" : ""}`}>
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-medium">{a.label}</span>
                  <span className="tnum shrink-0 text-muted-foreground">
                    달성 {a.achieved}명 · 근접 {a.near.length}명
                  </span>
                </div>
                <Progress value={Math.min(100, a.rate)} indicatorColor={
                  a.rate >= 10 ? "var(--status-good)"
                    : a.rate >= 5 ? "var(--series-1)" : "var(--status-warning)"} />
              </button>
            ))}
            {running.length === 0 && (
              <p className="text-sm text-muted-foreground">진행 중인 시상 항목이 없습니다.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5 text-[var(--series-1)]" />
              문턱 근접자 {picked ? `— ${picked.label}` : ""}
            </CardTitle>
            <CardDescription>
              {picked?.threshold
                ? `기준선 ${m(picked.threshold)}만원. 50% 이상 채웠지만 아직 못 넘은 인원 — 한 건이면 넘어간다.`
                : "기준선을 역산할 수 없는 항목입니다."}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            {picked && picked.near.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">설계사</TableHead>
                    <TableHead className="hidden sm:table-cell">지사</TableHead>
                    <TableHead className="hidden md:table-cell">담당</TableHead>
                    <TableHead className="text-right">현재</TableHead>
                    <TableHead className="pr-5 text-right">부족분</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {picked.near.map((x, i) => (
                    <TableRow key={`${x.name}-${i}`}>
                      <TableCell className="pl-5 font-medium">{x.name}</TableCell>
                      <TableCell className="hidden max-w-[170px] sm:table-cell">
                        <span className="block truncate text-muted-foreground">{x.branch}</span>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {x.manager ?? "—"}
                      </TableCell>
                      <TableCell className="tnum text-right">{m(x.perf)}</TableCell>
                      <TableCell className="tnum pr-5 text-right font-medium text-[var(--status-serious)]">
                        -{m(x.gap)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="px-5 py-6 text-sm text-muted-foreground">근접자가 없습니다.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>시상 항목 전체</CardTitle>
          <CardDescription>기준선·실적 단위는 만원. 차트의 표 대체본.</CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">항목</TableHead>
                <TableHead className="text-right">운영 대상</TableHead>
                <TableHead className="text-right">달성</TableHead>
                <TableHead className="text-right">달성률</TableHead>
                <TableHead className="text-right">기준선</TableHead>
                <TableHead className="pr-5 text-right">문턱 근접</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {live.map((a) => (
                <TableRow key={a.key}>
                  <TableCell className="pl-5 font-medium">{a.label}</TableCell>
                  <TableCell className="tnum text-right text-muted-foreground">{a.eligible}</TableCell>
                  <TableCell className="tnum text-right">{a.achieved}</TableCell>
                  <TableCell className="tnum text-right">{pct(a.rate)}</TableCell>
                  <TableCell className="tnum text-right text-muted-foreground">
                    {a.threshold ? m(a.threshold) : "—"}
                  </TableCell>
                  <TableCell className="tnum pr-5 text-right font-medium">
                    {a.near.length || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Managers({ data }: { data: CenterData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>담당 매니저별 현황</CardTitle>
        <CardDescription>
          지점 직원이 맡은 지사를 묶어 본 관리 단위. 금액 만원.
          여기 가동률의 분모는 &lsquo;실적 행이 있는 설계사&rsquo;라 재적 기준보다 높게 나온다.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 pb-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">담당</TableHead>
              <TableHead className="text-right">지사</TableHead>
              <TableHead className="text-right">실적</TableHead>
              <TableHead className="text-right">전일</TableHead>
              <TableHead className="text-right">가동</TableHead>
              <TableHead className="pr-5 text-right">가동률</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.managers.map((mg) => (
              <TableRow key={mg.manager}>
                <TableCell className="pl-5 font-medium">{mg.manager}</TableCell>
                <TableCell className="tnum text-right text-muted-foreground">{mg.branches}</TableCell>
                <TableCell className="tnum text-right font-medium">{m(mg.cred)}</TableCell>
                <TableCell className={`tnum text-right ${
                  mg.dCred > 0 ? "text-[var(--status-good)]" : "text-muted-foreground"}`}>
                  {mg.dCred ? m(mg.dCred) : "—"}
                </TableCell>
                <TableCell className="tnum text-right text-muted-foreground">
                  {mg.active} / {mg.roster}
                </TableCell>
                <TableCell className="tnum pr-5 text-right">{pct(mg.activeRate)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
