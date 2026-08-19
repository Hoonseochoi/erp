"use client";

import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Legend, RankBarChart, type SimpleDatum } from "@/components/charts/chart-kit";
import { m, man, n, pct } from "@/lib/format";
import type { AgencyRow, Concentration } from "@/lib/types";

/**
 * 운영 대리점(GA 법인) 롤업.
 *
 * 조직도(팀-영업단-센터)와 직교하는 축이다. 같은 대리점이 여러 센터에 걸쳐 있어
 * "어느 법인이 우리 실적을 떠받치는가"는 이 표로만 보인다.
 */
export function AgencyPanel({
  rows, total, conc, scope,
}: {
  rows: AgencyRow[];
  total: number;
  conc: Concentration;
  scope: string;
}) {
  const bars: SimpleDatum[] = rows.slice(0, 12).map((a, i) => ({
    x: shorten(a.name), y: man(a.cred), title: a.name, highlight: i === 0,
    extra: [
      { label: "비중", value: pct(a.share) },
      { label: "가동", value: `${n(a.active)}명` },
      { label: "걸친 센터", value: `${a.centers}개` },
    ],
  }));

  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>운영 대리점 랭킹 (만원)</CardTitle>
            <CardDescription>
              {scope} 기준 상위 {bars.length}개 / 전체 {total}개 법인
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RankBarChart data={bars} unit="만원" labelWidth={140} />
            <Legend items={[
              { label: "대리점 실적", color: "var(--series-1)" },
              { label: "1위", color: "var(--series-2)" },
            ]} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>집중도</CardTitle>
            <CardDescription>
              소수 법인에 얼마나 기대고 있나. 상위 편중이 크면 그 법인이 흔들릴 때
              조직 전체가 흔들린다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {conc ? (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat label="1위" v={conc.top1} />
                  <Stat label="상위 3" v={conc.top3} />
                  <Stat label="상위 5" v={conc.top5} />
                  <Stat label="상위 20%" v={conc.top20pct} />
                </div>
                <div className="mt-4 rounded-lg border p-3 text-xs text-muted-foreground">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-medium text-foreground">HHI {n(conc.hhi)}</span>
                    <Badge variant={conc.hhi >= 2500 ? "destructive"
                      : conc.hhi >= 1500 ? "secondary" : "muted"}>
                      {conc.hhi >= 2500 ? "매우 집중" : conc.hhi >= 1500 ? "다소 집중" : "분산"}
                    </Badge>
                  </div>
                  점유율 제곱합. 1,500 미만이면 분산, 2,500 이상이면 특정 법인 의존이 크다는 뜻.
                  실적이 있는 법인 {n(conc.n)}개 기준.
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">집계할 실적이 없습니다.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>대리점 상세</CardTitle>
          <CardDescription>금액 단위 만원. 한 법인이 여러 센터에 걸쳐 있을 수 있다.</CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-9 pl-5">#</TableHead>
                <TableHead>대리점</TableHead>
                <TableHead className="text-right">실적</TableHead>
                <TableHead className="text-right">전일</TableHead>
                <TableHead className="text-right">비중</TableHead>
                <TableHead className="text-right">가동</TableHead>
                <TableHead className="hidden text-right sm:table-cell">지사</TableHead>
                <TableHead className="pr-5 text-right">센터</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((a, i) => (
                <TableRow key={a.name}>
                  <TableCell className="tnum pl-5 text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="max-w-[240px]">
                    <span className="block truncate font-medium">{a.name}</span>
                  </TableCell>
                  <TableCell className="tnum text-right font-medium">{m(a.cred)}</TableCell>
                  <TableCell className={`tnum text-right ${
                    a.dCred > 0 ? "text-[var(--status-good)]" : "text-muted-foreground"}`}>
                    {a.dCred ? m(a.dCred) : "—"}
                  </TableCell>
                  <TableCell className="tnum text-right">{pct(a.share)}</TableCell>
                  <TableCell className="tnum text-right text-muted-foreground">{n(a.active)}</TableCell>
                  <TableCell className="tnum hidden text-right text-muted-foreground sm:table-cell">
                    {a.branches}
                  </TableCell>
                  <TableCell className="tnum pr-5 text-right text-muted-foreground">{a.centers}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, v }: { label: string; v: number }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="tnum mt-0.5 text-base font-semibold">{pct(v)}</div>
    </div>
  );
}

function shorten(s: string, len = 14) {
  const c = s.replace(/주식회사|（주）|㈜|\(주\)/g, " ").replace(/\s+/g, " ").trim();
  return c.length > len ? `${c.slice(0, len)}…` : c;
}
