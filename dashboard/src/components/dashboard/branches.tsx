"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  MultiLineChart,
  RankBarChart,
  Sparkline,
  type SimpleDatum,
} from "@/components/charts/chart-kit";
import { Section } from "./section";
import { m, man, md, n, pct, wonSigned } from "@/lib/format";
import type { CenterData } from "@/lib/types";

const LINE_COLORS = ["var(--series-1)", "var(--series-2)", "var(--series-3)"];

export function Branches({ data }: { data: CenterData }) {
  const branches = data.branches;
  const top = branches.slice(0, 12);

  const bars: SimpleDatum[] = top.map((b) => ({
    x: shorten(b.branch),
    y: man(b.cred),
    title: b.branch,
    highlight: b.rank === 1,
    extra: [
      { label: "전일 증분", value: `${wonSigned(b.dCred)}원` },
      { label: "가동/재적", value: `${b.activePeople} / ${b.headcount}명` },
      { label: "가동률", value: pct(b.activeRate) },
    ],
  }));

  // 상위 3개 지사만 추이선으로 (4개 이상은 색 구분이 무너진다)
  const lineSeries = branches.slice(0, 3).map((b, i) => ({
    key: `b${i}`,
    label: shorten(b.branch),
    color: LINE_COLORS[i],
  }));
  const lineData = data.dates.map((d, di) => {
    const row: Record<string, string | number | null> = { x: md(d) };
    branches.slice(0, 3).forEach((b, i) => {
      row[`b${i}`] = man(b.series[di]?.cred ?? 0);
    });
    return row;
  });

  const totalCred = branches.reduce((a, b) => a + b.cred, 0) || 1;
  const top3Share =
    (branches.slice(0, 3).reduce((a, b) => a + b.cred, 0) / totalCred) * 100;
  const wtBranches = branches.filter((b) =>
    b.worldTour?.some((t) => t.people > 0 || t.reached),
  );

  return (
    <Section
      id="branch"
      title="지사별 분석"
      desc={`${branches.length}개 지사 · 재적 ${n(data.headcount)}명. 실적 순.`}
      action={
        <Badge variant="outline">상위 3개 지사 비중 {pct(top3Share)}</Badge>
      }
    >
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>지사 랭킹 (만원)</CardTitle>
            <CardDescription>상위 {top.length}개 지사</CardDescription>
          </CardHeader>
          <CardContent>
            <RankBarChart data={bars} unit="만원" labelWidth={150} />
            <Legend
              items={[
                { label: "지사 실적", color: "var(--series-1)" },
                { label: "1위", color: "var(--series-2)" },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>상위 3개 지사 누적 추이 (만원)</CardTitle>
            <CardDescription>
              같은 축·같은 단위. 기울기가 곧 그 지사의 일간 속도다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MultiLineChart data={lineData} series={lineSeries} unit="만원" />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-3">
        <CardHeader>
          <CardTitle>지사 상세</CardTitle>
          <CardDescription>
            실적·전일·인당은 만원. 가동률 = 당월 실적 발생 인원 ÷ 재적
            설계사수. 인당 = 실적 ÷ 재적.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 pl-5">#</TableHead>
                <TableHead>지사</TableHead>
                <TableHead className="hidden md:table-cell">담당</TableHead>
                <TableHead className="text-right">실적</TableHead>
                <TableHead className="text-right">전일</TableHead>
                <TableHead className="text-right">가동/재적</TableHead>
                <TableHead className="text-right">가동률</TableHead>
                <TableHead className="hidden text-right lg:table-cell">
                  인당
                </TableHead>
                <TableHead className="hidden pr-5 text-right sm:table-cell">
                  추이
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {branches.map((b) => (
                <TableRow key={String(b.key)}>
                  <TableCell className="tnum pl-5 text-muted-foreground">
                    {b.rank}
                  </TableCell>
                  <TableCell className="max-w-[220px]">
                    <div className="truncate font-medium">{b.branch}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {b.agency}
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {b.manager ?? "—"}
                  </TableCell>
                  <TableCell className="tnum text-right font-medium">
                    {m(b.cred)}
                  </TableCell>
                  <TableCell
                    className={`tnum text-right ${
                      b.dCred > 0
                        ? "text-[var(--status-good)]"
                        : "text-muted-foreground"
                    }`}
                  >
                    {b.dCred ? m(b.dCred) : "—"}
                  </TableCell>
                  <TableCell className="tnum text-right text-muted-foreground">
                    {b.activePeople} / {b.headcount}
                  </TableCell>
                  <TableCell className="tnum text-right">
                    {pct(b.activeRate)}
                  </TableCell>
                  <TableCell className="tnum hidden text-right lg:table-cell">
                    {m(b.perHead)}
                  </TableCell>
                  <TableCell className="hidden pr-5 text-right sm:table-cell">
                    <div className="flex justify-end">
                      <Sparkline values={b.series.map((s) => s.cred)} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-3">
        <CardHeader>
          <CardTitle>담당 매니저별 현황</CardTitle>
          <CardDescription>
            지점 직원이 맡은 지사를 묶어 본 관리 단위. 실적·전일은 만원.
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
                  <TableCell className="pl-5 font-medium">
                    {mg.manager}
                  </TableCell>
                  <TableCell className="tnum text-right text-muted-foreground">
                    {mg.branches}
                  </TableCell>
                  <TableCell className="tnum text-right font-medium">
                    {m(mg.cred)}
                  </TableCell>
                  <TableCell
                    className={`tnum text-right ${
                      mg.dCred > 0
                        ? "text-[var(--status-good)]"
                        : "text-muted-foreground"
                    }`}
                  >
                    {mg.dCred ? m(mg.dCred) : "—"}
                  </TableCell>
                  <TableCell className="tnum text-right text-muted-foreground">
                    {mg.active} / {mg.roster}
                  </TableCell>
                  <TableCell className="tnum pr-5 text-right">
                    {pct(mg.activeRate)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="px-5 pt-2 text-xs text-muted-foreground">
            여기서의 가동률 분모는 &lsquo;실적 행이 존재하는 설계사&rsquo;라 지사
            테이블(재적 기준)보다 높게 나온다.
          </p>
        </CardContent>
      </Card>

      {wtBranches.length > 0 && (
        <Card className="mt-3">
          <CardHeader>
            <CardTitle>지사 월드투어 진척</CardTitle>
            <CardDescription>
              등급별 달성 설계사수 (원본 &lsquo;지사&rsquo; 시트 기준).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {wtBranches.map((b) => (
              <div
                key={String(b.key)}
                className="rounded-lg border px-3 py-2 text-xs"
              >
                <div className="mb-1 max-w-[240px] truncate font-medium">
                  {b.branch}
                </div>
                <div className="flex flex-wrap gap-1">
                  {b.worldTour.map((t) => (
                    <Badge
                      key={t.key}
                      variant={t.people > 0 ? "secondary" : "muted"}
                    >
                      {t.label} {t.people}명
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </Section>
  );
}

/** 법인 접두사를 걷어내고 축 라벨 길이에 맞춰 자른다. */
function shorten(s: string, len = 13) {
  const cleaned = s
    .replace(/주식회사|（주）|㈜|\(주\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > len ? `${cleaned.slice(0, len)}…` : cleaned;
}
