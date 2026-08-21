"use client";

import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ColumnChart, CumulativeChart, Legend,
  type SimpleDatum, type TrendDatum,
} from "@/components/charts/chart-kit";
import { latestDelta, pace } from "@/lib/analytics";
import { isWeekend, m, man, md, mdw, pct, won, wonSigned } from "@/lib/format";
import { HelpTip } from "./help-tip";
import type { OrgBase } from "@/lib/types";

/** 일간 실적 · 누적/예상 — 층에 상관없이 동일. */
export function Trend({ data }: { data: OrgBase }) {
  const { last: dl, prev, avgPerDay } = latestDelta(data.daily);
  const p = pace(data.asOf, data.daily.at(-1)!.cred, data.target);

  const bars: SimpleDatum[] = data.daily
    .filter((d) => d.dCred !== null)
    .map((d) => ({
      x: md(d.date), y: man(d.dCred), title: mdw(d.date),
      highlight: d.date === data.asOf,
      extra: [
        {
          label: d.spanDays && d.spanDays > 1 ? `구간 ${d.spanDays}일` : "구간",
          value: d.spanDays && d.spanDays > 1
            ? `일평균 ${won(d.dCred! / d.spanDays)}원` : "1일",
        },
        { label: "신규 가동", value: `${d.newActive ?? 0}명` },
        { label: "누적", value: `${won(d.cred)}원` },
      ],
    }));

  const cum: TrendDatum[] = data.daily.map((d) => ({
    x: md(d.date), actual: man(d.cred), projected: null, title: mdw(d.date),
    extra: [{ label: "가동", value: `${d.active}명` }],
  }));
  cum.push({
    x: "월말", actual: null, projected: man(p.projected), title: "월말 예상",
    extra: [
      { label: "영업일", value: `${p.elapsedBiz}/${p.totalBiz}일` },
      { label: "영업일 평균", value: `${won(p.perDay)}원` },
    ],
  });
  cum[cum.length - 2].projected = cum[cum.length - 2].actual;

  const newActive: SimpleDatum[] = data.daily
    .filter((d) => d.newActive !== null)
    .map((d) => ({
      x: md(d.date), y: d.newActive!, title: mdw(d.date),
      highlight: d.date === data.asOf,
      extra: [
        { label: "누적 가동", value: `${d.active}명` },
        ...(data.headcount
          ? [{ label: "가동률", value: pct((d.active / data.headcount) * 100) }]
          : []),
      ],
    }));

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>일간 실적 (만원)</CardTitle>
          <CardDescription className="flex items-center gap-1.5">
            스냅샷 차분
            <HelpTip title="일간 실적은 어떻게 나오나" width="w-72">
              <p>
                원본 파일에는 <b>월 누적</b>만 있고 &ldquo;오늘 얼마&rdquo;는 없다.
                어제 파일과 빼서 복원한 값이다.
              </p>
              <p>
                파일이 없는 날(주말·휴일)은 그 구간이 <b>한 막대에 합쳐진다.</b>
                막대에 마우스를 올리면 며칠치인지와 일평균이 나온다.
              </p>
            </HelpTip>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ColumnChart data={bars} unit="만원" avg={man(avgPerDay)} avgLabel="구간 평균" />
          <Legend items={[
            { label: "일간 실적", color: "var(--series-1)" },
            { label: `최신 (${md(data.asOf)})`, color: "var(--series-2)" },
          ]} />
          {prev && dl && (
            <p className="mt-2 text-xs text-muted-foreground">
              전일 대비{" "}
              <span className="tnum font-medium text-foreground">
                {wonSigned(dl.dCred! - prev.dCred!)}원
              </span>{" "}
              ({md(prev.date)} {won(prev.dCred)}원 → {md(dl.date)} {won(dl.dCred)}원)
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>누적 추이 · 월말 예상 (만원)</CardTitle>
          <CardDescription className="flex items-center gap-1.5">
            영업일 기준 환산
            <HelpTip title="월말 예상 계산법" width="w-72">
              <p>
                <b>누적 ÷ 경과 영업일 × 총 영업일</b>.
                주말을 실적일로 세면 과소평가되므로 월~금만 센다.
              </p>
              <p>공휴일은 아직 빼지 않는다.</p>
            </HelpTip>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CumulativeChart data={cum} unit="만원" showProjection
            goal={data.target ? man(data.target) : undefined} goalLabel="목표" />
          <Legend items={[
            { label: "누적 실적", color: "var(--series-1)" },
            { label: "월말 예상", color: "var(--series-2)" },
          ]} />
          {p.projectedPct !== null && (
            <p className="mt-2 text-xs text-muted-foreground">
              이 속도면 월말{" "}
              <span className="tnum font-medium text-foreground">{won(p.projected)}원</span>
              {" "}= 목표의{" "}
              <span className="tnum font-medium" style={{
                color: p.projectedPct >= 100 ? "var(--status-good)" : "var(--status-warning)",
              }}>{p.projectedPct.toFixed(0)}%</span>
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>신규 가동 인원</CardTitle>
          <CardDescription>그날 처음 당월 실적이 잡힌 설계사 수</CardDescription>
        </CardHeader>
        <CardContent>
          <ColumnChart data={newActive} unit="명" height={200} color="var(--series-3)" />
          <Legend items={[
            { label: "신규 가동", color: "var(--series-3)" },
            { label: `최신 (${md(data.asOf)})`, color: "var(--series-2)" },
          ]} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>스냅샷 로그</CardTitle>
          <CardDescription>확보된 파일 날짜와 그날의 누적값.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-1.5">
          {data.daily.map((d) => (
            <Badge key={d.date} variant={d.date === data.asOf ? "default" : "muted"}
              className={isWeekend(d.date) ? "opacity-60" : undefined}>
              {mdw(d.date)} · {won(d.cred)}원
            </Badge>
          ))}
          <p className="mt-2 w-full text-xs text-muted-foreground">
            빠진 날짜가 있으면 그 구간이 한 막대로 합쳐진다. 누적 {m(data.daily.at(-1)!.cred)}만원.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
