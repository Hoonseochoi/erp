"use client";

import * as React from "react";
import { Target } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Section } from "./section";
import { m, pct } from "@/lib/format";
import type { AwardRow, CenterData } from "@/lib/types";

/**
 * 시상 화면은 "돈이 얼마 나가나"가 아니라 "누가 시상을 받고, 누가 아깝게 못 받나"를 본다.
 * 시상금 금액은 설계사 개인의 것이라 설계사 탭에서만 다룬다.
 */
export function Awards({ data }: { data: CenterData }) {
  const live = data.awards.filter((a) => a.eligible > 0);
  // 아직 시작도 안 한 항목(3주차 이후)은 진척바에서 빼고 아래 표에만 남긴다.
  const running = live.filter((a) => a.achieved > 0 || a.near.length > 0);
  const [pick, setPick] = React.useState<string>(
    running.find((a) => a.near.length > 0)?.key ?? running[0]?.key ?? "",
  );
  const picked = running.find((a) => a.key === pick);

  const nearTotal = live.reduce((a, b) => a + b.near.length, 0);
  const winners = data.people.filter((p) => p.awardMoney > 0).length;

  return (
    <Section
      id="award"
      title="시상 진척"
      desc="지급 기준선은 전 본부 데이터에서 '시상금이 찍힌 최소 실적'으로 역산한 값이다. 실적 단위는 만원."
      action={
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline">시상 확정 {winners}명</Badge>
          <Badge variant="outline">문턱 근접 {nearTotal}건</Badge>
        </div>
      }
    >
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>항목별 달성 현황</CardTitle>
            <CardDescription>
              항목을 누르면 옆 근접자 목록이 바뀐다. 달성 인원 ÷ 운영 대상 인원.
              아직 시작 안 한 항목은 아래 전체 표에만 있다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {running.map((a) => (
              <button
                key={a.key}
                onClick={() => setPick(a.key)}
                className={`w-full rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/60 ${
                  pick === a.key ? "bg-muted" : ""
                }`}
              >
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-medium">{a.label}</span>
                  <span className="tnum shrink-0 text-muted-foreground">
                    달성 {a.achieved}명 · 근접 {a.near.length}명
                  </span>
                </div>
                <Progress
                  value={Math.min(100, a.rate)}
                  indicatorColor={
                    a.rate >= 10
                      ? "var(--status-good)"
                      : a.rate >= 5
                        ? "var(--series-1)"
                        : "var(--status-warning)"
                  }
                />
              </button>
            ))}
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
                ? `기준선 ${m(picked.threshold)}만원. 기준선의 50% 이상을 채웠지만 아직 못 넘은 인원 — 한 건이면 넘어간다.`
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
                      <TableCell className="hidden max-w-[180px] sm:table-cell">
                        <span className="block truncate text-muted-foreground">
                          {x.branch}
                        </span>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {x.manager ?? "—"}
                      </TableCell>
                      <TableCell className="tnum text-right">
                        {m(x.perf)}
                      </TableCell>
                      <TableCell className="tnum pr-5 text-right font-medium text-[var(--status-serious)]">
                        -{m(x.gap)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="px-5 py-6 text-sm text-muted-foreground">
                근접자가 없습니다. 왼쪽에서 다른 항목을 선택해 보세요.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <AwardTable rows={live} />
    </Section>
  );
}

function AwardTable({ rows }: { rows: AwardRow[] }) {
  return (
    <Card className="mt-3">
      <CardHeader>
        <CardTitle>시상 항목 전체</CardTitle>
        <CardDescription>
          기준선·실적 단위는 만원. 색 없이도 같은 내용을 읽을 수 있게 둔 표다.
        </CardDescription>
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
            {rows.map((a) => (
              <TableRow key={a.key}>
                <TableCell className="pl-5 font-medium">{a.label}</TableCell>
                <TableCell className="tnum text-right text-muted-foreground">
                  {a.eligible}
                </TableCell>
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
  );
}
