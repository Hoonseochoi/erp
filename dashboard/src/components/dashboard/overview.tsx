"use client";

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
  ColumnChart,
  CumulativeChart,
  Legend,
  type SimpleDatum,
  type TrendDatum,
} from "@/components/charts/chart-kit";
import { Section } from "./section";
import { StatTile } from "./stat-tile";
import { latestDelta, pace } from "@/lib/analytics";
import {
  isWeekend,
  m,
  man,
  md,
  mdw,
  n,
  pct,
  won,
  wonSigned,
} from "@/lib/format";
import type { CenterData } from "@/lib/types";

export function Overview({ data }: { data: CenterData }) {
  const last = data.daily.at(-1)!;
  const { last: lastDelta, prev: prevDelta, avgPerDay } = latestDelta(data.daily);
  const proj = pace(data.asOf, last.cred, data.target);

  /* --- 일간(구간) 실적 막대 : 만원 -------------------------------------- */
  const dailyBars: SimpleDatum[] = data.daily
    .filter((d) => d.dCred !== null)
    .map((d) => ({
      x: md(d.date),
      y: man(d.dCred),
      title: mdw(d.date),
      highlight: d.date === data.asOf,
      extra: [
        {
          label: d.spanDays && d.spanDays > 1 ? `구간 ${d.spanDays}일` : "구간",
          value:
            d.spanDays && d.spanDays > 1
              ? `일평균 ${won(d.dCred! / d.spanDays)}원`
              : "1일",
        },
        { label: "신규 가동", value: `${d.newActive ?? 0}명` },
        { label: "누적", value: `${won(d.cred)}원` },
      ],
    }));

  /* --- 누적 + 월말 예상 ------------------------------------------------ */
  const cumulative: TrendDatum[] = data.daily.map((d) => ({
    x: md(d.date),
    actual: man(d.cred),
    projected: null,
    title: mdw(d.date),
    extra: [{ label: "가동", value: `${d.active}명` }],
  }));
  cumulative.push({
    x: "월말",
    actual: null,
    projected: man(proj.projected),
    title: "월말 예상",
    extra: [
      { label: "영업일 진척", value: `${proj.elapsedBiz}/${proj.totalBiz}일` },
      { label: "영업일 평균", value: `${won(proj.perDay)}원` },
    ],
  });
  // 점선이 실적 마지막 점에서 이어지도록 연결
  const lastIdx = cumulative.length - 2;
  cumulative[lastIdx].projected = cumulative[lastIdx].actual;

  /* --- 주차별 실적 ----------------------------------------------------- */
  const runningWeek = Math.max(
    ...data.weeks.filter((w) => w.cred > 0).map((w) => w.week),
    0,
  );
  const weekBars: SimpleDatum[] = data.weeks.map((w) => ({
    x: w.label,
    y: man(w.cred),
    title: `${w.label} 실적`,
    highlight: w.week === runningWeek,
    extra: [{ label: "실적 발생", value: `${w.people}명` }],
  }));

  /* --- 신규 가동 인원 -------------------------------------------------- */
  const activeBars: SimpleDatum[] = data.daily
    .filter((d) => d.newActive !== null)
    .map((d) => ({
      x: md(d.date),
      y: d.newActive!,
      title: mdw(d.date),
      highlight: d.date === data.asOf,
      extra: [
        { label: "누적 가동", value: `${d.active}명` },
        { label: "가동률", value: pct((d.active / data.headcount) * 100) },
      ],
    }));

  const activeRate = (last.active / data.headcount) * 100;
  const awardWinners = data.people.filter((p) => p.awardMoney > 0).length;

  return (
    <Section
      id="overview"
      title="개요"
      desc={`${data.focus.center} · ${data.focus.dept} · 지점장 ${data.focus.centerHead}`}
      action={
        <div className="flex flex-wrap gap-1.5">
          {data.target && (
            <Badge variant="outline">목표 {won(data.target)}원</Badge>
          )}
          <Badge variant="outline">재적 {n(data.headcount)}명</Badge>
          <Badge variant="outline">
            영업일 {proj.elapsedBiz}/{proj.totalBiz}
          </Badge>
        </div>
      }
    >
      {/* KPI ------------------------------------------------------------ */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile
          index={0}
          label="목표 달성률"
          value={proj.achievedPct === null ? "—" : proj.achievedPct.toFixed(1)}
          unit="%"
          delta={proj.gapPp}
          deltaLabel={
            proj.gapPp === null
              ? ""
              : `영업일 진척 대비 ${proj.gapPp >= 0 ? "+" : ""}${proj.gapPp.toFixed(1)}%p`
          }
          sub={data.target ? `목표 ${won(data.target)}원` : "목표 미등록"}
        />
        <StatTile
          index={1}
          label="당월 누적 실적"
          value={m(last.cred)}
          unit="만원"
          delta={lastDelta?.dCred ?? null}
          deltaLabel={`${wonSigned(lastDelta?.dCred)} (${md(data.asOf)})`}
          spark={data.daily.map((d) => d.cred)}
        />
        <StatTile
          index={2}
          label="월말 예상"
          value={m(proj.projected)}
          unit="만원"
          sub={
            proj.projectedPct !== null
              ? `목표의 ${proj.projectedPct.toFixed(0)}%`
              : `영업일 평균 ${won(proj.perDay)}원`
          }
        />
        <StatTile
          index={3}
          label="가동 인원"
          value={n(last.active)}
          unit={`명 / ${n(data.headcount)}명`}
          delta={lastDelta?.newActive ?? null}
          deltaLabel={`신규 ${lastDelta?.newActive ?? 0}명`}
          sub={`가동률 ${pct(activeRate)}`}
          spark={data.daily.map((d) => d.active)}
          sparkColor="var(--series-2)"
        />
        <StatTile
          index={4}
          label="시상 받는 설계사"
          value={n(awardWinners)}
          unit={`명 / ${n(data.people.length)}명`}
          sub="금액은 설계사 탭에서"
        />
      </div>

      {/* 페이스 --------------------------------------------------------- */}
      {data.target && (
        <Card className="mt-3">
          <CardContent className="p-5">
            <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
              <div className="space-y-3">
                <PaceBar
                  label="목표 달성"
                  valueLabel={`${won(last.cred)} / ${won(data.target)}원`}
                  pctLabel={pct(proj.achievedPct)}
                  value={Math.min(100, proj.achievedPct ?? 0)}
                  color={
                    (proj.gapPp ?? 0) >= 0
                      ? "var(--status-good)"
                      : "var(--status-warning)"
                  }
                />
                <PaceBar
                  label="영업일 진척"
                  valueLabel={`${proj.elapsedBiz} / ${proj.totalBiz}일`}
                  pctLabel={pct(proj.progressPct)}
                  value={proj.progressPct}
                  color="var(--viz-axis)"
                />
                <p className="text-xs text-muted-foreground">
                  두 막대를 겹쳐 읽는다. 위가 아래보다 길면 계획보다 앞선
                  것이다. 현재{" "}
                  <span
                    className="tnum font-medium"
                    style={{
                      color:
                        (proj.gapPp ?? 0) >= 0
                          ? "var(--status-good)"
                          : "var(--status-warning)",
                    }}
                  >
                    {(proj.gapPp ?? 0) >= 0 ? "+" : ""}
                    {(proj.gapPp ?? 0).toFixed(1)}%p
                  </span>
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
                <MiniFact
                  label="남은 목표"
                  value={`${won(proj.remaining)}원`}
                />
                <MiniFact
                  label="필요 일평균"
                  value={`${won(proj.needPerDay)}원`}
                  sub={`남은 영업일 ${proj.totalBiz - proj.elapsedBiz}일 · 현재 ${won(avgPerDay)}원`}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 차트 ----------------------------------------------------------- */}
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>일간 실적 (만원)</CardTitle>
            <CardDescription>
              스냅샷 간 누적 차이. 파일이 없는 날은 구간으로 합산되며 툴팁에
              일평균을 함께 보여준다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ColumnChart
              data={dailyBars}
              unit="만원"
              avg={man(avgPerDay)}
              avgLabel="구간 평균"
            />
            <Legend
              items={[
                { label: "일간 실적", color: "var(--series-1)" },
                { label: `최신 (${md(data.asOf)})`, color: "var(--series-2)" },
              ]}
            />
            {prevDelta && lastDelta && (
              <p className="mt-2 text-xs text-muted-foreground">
                전일 대비{" "}
                <span className="tnum font-medium text-foreground">
                  {wonSigned(lastDelta.dCred! - prevDelta.dCred!)}원
                </span>{" "}
                ({md(prevDelta.date)} {won(prevDelta.dCred)}원 →{" "}
                {md(lastDelta.date)} {won(lastDelta.dCred)}원)
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>누적 추이 · 월말 예상 (만원)</CardTitle>
            <CardDescription>
              영업일(월~금) 기준 run-rate 로 월말을 환산한 값. 주말을 실적일로
              세지 않는다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CumulativeChart
              data={cumulative}
              unit="만원"
              showProjection
              goal={data.target ? man(data.target) : undefined}
              goalLabel="목표"
            />
            <Legend
              items={[
                { label: "누적 실적", color: "var(--series-1)" },
                { label: "월말 예상", color: "var(--series-2)" },
              ]}
            />
            {data.target && proj.projectedPct !== null && (
              <p className="mt-2 text-xs text-muted-foreground">
                이 속도면 월말{" "}
                <span className="tnum font-medium text-foreground">
                  {won(proj.projected)}원
                </span>{" "}
                = 목표의{" "}
                <span
                  className="tnum font-medium"
                  style={{
                    color:
                      proj.projectedPct >= 100
                        ? "var(--status-good)"
                        : "var(--status-warning)",
                  }}
                >
                  {proj.projectedPct.toFixed(0)}%
                </span>
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>주차별 실적 (만원)</CardTitle>
            <CardDescription>
              원본 파일이 주차 컬럼을 직접 제공한다. 주차 시상의 마감 기준이기도
              하다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ColumnChart data={weekBars} unit="만원" height={200} />
            <Legend
              items={[
                { label: "마감된 주차", color: "var(--series-1)" },
                { label: "진행 중", color: "var(--series-2)" },
              ]}
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {data.weeks.map((w) => (
                <Badge key={w.week} variant={w.cred > 0 ? "secondary" : "muted"}>
                  {w.label} {won(w.cred)}원 · {w.people}명
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>신규 가동 인원</CardTitle>
            <CardDescription>
              그날 처음으로 당월 실적이 잡힌 설계사 수. 가동 촉진 활동의 직접
              지표다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ColumnChart
              data={activeBars}
              unit="명"
              height={200}
              color="var(--series-3)"
            />
            <Legend
              items={[
                { label: "신규 가동", color: "var(--series-3)" },
                { label: `최신 (${md(data.asOf)})`, color: "var(--series-2)" },
              ]}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              누적 가동{" "}
              <span className="tnum font-medium text-foreground">
                {last.active}명
              </span>{" "}
              / 재적 {n(data.headcount)}명 · 가동률{" "}
              <span className="tnum font-medium text-foreground">
                {pct(activeRate)}
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 스냅샷 로그 ---------------------------------------------------- */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {data.daily.map((d) => (
          <Badge
            key={d.date}
            variant={d.date === data.asOf ? "default" : "muted"}
            className={isWeekend(d.date) ? "opacity-60" : undefined}
          >
            {mdw(d.date)} · {won(d.cred)}원
          </Badge>
        ))}
      </div>
    </Section>
  );
}

/** 달성률과 영업일 진척률을 같은 폭의 막대로 겹쳐 읽게 한다. */
function PaceBar({
  label,
  valueLabel,
  pctLabel,
  value,
  color,
}: {
  label: string;
  valueLabel: string;
  pctLabel: string;
  value: number;
  color: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium">{label}</span>
        <span className="tnum text-muted-foreground">
          {valueLabel} · <span className="text-foreground">{pctLabel}</span>
        </span>
      </div>
      <Progress value={value} indicatorColor={color} className="h-2.5" />
    </div>
  );
}

function MiniFact({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="tnum mt-0.5 text-lg font-semibold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
