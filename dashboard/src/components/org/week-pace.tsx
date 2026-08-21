"use client";

import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ColumnChart, Legend, type SimpleDatum } from "@/components/charts/chart-kit";
import { HelpTip } from "./help-tip";
import { man, md, pct, won } from "@/lib/format";
import type { WeekPace, WeekRow } from "@/lib/types";

/**
 * 주차별 실적과 진행 중인 주차의 기대값 비교.
 *
 * 주차마다 영업일 수가 다르다(8월은 5일·6일·4일). 총액을 그대로 비교하면
 * 짧은 주차가 무조건 나빠 보이므로 영업일당 실적으로 환산해서 본다.
 */
export function WeekPacePanel({ weeks, pace }: { weeks: WeekRow[]; pace: WeekPace }) {
  const live = weeks.filter((w) => w.state !== "none" && w.state !== "upcoming");
  if (live.length === 0) return null;

  const cur = pace?.current ?? null;
  const ratio = cur?.paceRatio ?? null;
  const tone = ratio === null ? "var(--viz-axis)"
    : ratio >= 1 ? "var(--status-good)"
      : ratio >= 0.85 ? "var(--status-warning)" : "var(--status-critical)";

  const bars: SimpleDatum[] = live.map((w) => ({
    x: w.label,
    y: man(w.cred),
    title: `${w.label} (${w.from ? md(w.from) : "?"}~${w.to ? md(w.to) : "?"})`,
    highlight: w.state === "running",
    extra: [
      { label: "영업일", value: `${w.bizDays ?? "?"} / ${w.totalBizDays ?? "?"}일` },
      {
        label: "영업일당",
        value: w.bizDays ? `${won(w.cred / w.bizDays)}원` : "—",
      },
      { label: "실적 발생", value: `${w.people}명` },
    ],
  }));

  const perDayBars: SimpleDatum[] = live
    .filter((w) => w.bizDays)
    .map((w) => ({
      x: w.label,
      y: man(w.cred / w.bizDays!),
      title: `${w.label} 영업일당`,
      highlight: w.state === "running",
      extra: [{ label: "총액", value: `${won(w.cred)}원` }],
    }));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <h3 className="text-sm font-semibold">주차별 페이스</h3>
        <HelpTip title="주차별 페이스, 어떻게 읽나" width="w-80 sm:w-96">
          <WeekGuide />
        </HelpTip>
      </div>

      {cur && (
        <Card>
          <CardContent className="grid gap-5 p-5 lg:grid-cols-[1.6fr_1fr]">
            <div className="space-y-3">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-sm font-semibold">{cur.week}주차 진행 중</span>
                <span className="text-xs text-muted-foreground">
                  영업일 {cur.bizDays} / {cur.totalBizDays ?? "?"}일
                </span>
                {ratio !== null && (
                  <Badge variant="muted" className="ml-auto" style={{ color: tone }}>
                    기대 대비 {ratio.toFixed(2)}배
                  </Badge>
                )}
              </div>

              <Row label="지금까지 실적" right={`${won(cur.cred)}원`}
                value={cur.expectedNow ? Math.min(140, (cur.cred / cur.expectedNow) * 100) : 0}
                color={tone} />
              <Row label="지금 시점 기대값" right={`${won(cur.expectedNow)}원`}
                value={100} color="var(--viz-axis)" />

              <p className="text-xs text-muted-foreground">
                기대값은 <b>완료된 주차의 영업일당 평균</b>({won(pace!.baselinePerDay)}원)에
                이번 주차 경과 영업일 {cur.bizDays}일을 곱한 값이다.
                {ratio !== null && ratio < 1 && (
                  <> 지금은 기대보다 <b style={{ color: tone }}>{won(cur.expectedNow - cur.cred)}원</b> 부족하다.</>
                )}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
              <Fact label="이번 주차 마감 기대"
                value={cur.expectedFull ? `${won(cur.expectedFull)}원` : "—"}
                sub="기준선 × 총 영업일" />
              <Fact label="이 속도면"
                value={cur.projected ? `${won(cur.projected)}원` : "—"}
                sub={cur.expectedFull && cur.projected
                  ? `기대의 ${pct((cur.projected / cur.expectedFull) * 100, 0)}`
                  : undefined} />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>주차별 실적 (만원)</CardTitle>
          </CardHeader>
          <CardContent>
            <ColumnChart data={bars} unit="만원" height={210} />
            <Legend items={[
              { label: "마감된 주차", color: "var(--series-1)" },
              { label: "진행 중", color: "var(--series-2)" },
            ]} />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {live.map((w) => (
                <Badge key={w.week} variant={w.state === "running" ? "secondary" : "muted"}>
                  {w.label} {w.from ? md(w.from) : ""}~{w.to ? md(w.to) : ""} · {won(w.cred)}원
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              영업일당 실적 (만원)
              <HelpTip title="왜 영업일당으로 보나" width="w-72">
                <p>
                  8월은 1주차 5영업일, 2주차 6영업일, 3주차 4영업일로 길이가 다르다.
                  총액을 그대로 비교하면 <b>짧은 주차가 무조건 나빠 보인다.</b>
                </p>
                <p>
                  영업일당으로 나누면 길이 차이가 사라져서 <b>진짜 속도</b>가 드러난다.
                  진행 중인 주차도 같은 잣대로 바로 비교할 수 있다.
                </p>
              </HelpTip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ColumnChart data={perDayBars} unit="만원" height={210}
              avg={pace ? man(pace.baselinePerDay) : undefined} avgLabel="기준선" />
            <Legend items={[
              { label: "마감된 주차", color: "var(--series-1)" },
              { label: "진행 중", color: "var(--series-2)" },
            ]} />
            {pace && (
              <p className="mt-2 text-xs text-muted-foreground">
                기준선 <b>{won(pace.baselinePerDay)}원</b>/영업일 (완료 주차 평균) ·
                직전 주차 {won(pace.prevPerDay)}원
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, right, value, color }: {
  label: string; right: string; value: number; color: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium">{label}</span>
        <span className="tnum text-muted-foreground">{right}</span>
      </div>
      <Progress value={Math.min(100, value)} indicatorColor={color} className="h-2.5" />
    </div>
  );
}

function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="tnum mt-0.5 text-base font-semibold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function WeekGuide() {
  return (
    <>
      <p>
        이번 달 실적이 <b>주차별로 어떻게 흘러왔고, 지금 주차가 그 흐름 대비
        어디쯤인지</b>를 본다.
      </p>
      <div>
        <p><b>주차 구간은 원본이 정한다</b></p>
        <p>
          8월은 1주차 8/1~9, 2주차 8/10~17, 3주차 8/18~23이다. 7일씩 균등하지
          않아서 계산으로 맞히지 않고 원본 시상 헤더에 적힌 구간을 그대로 읽는다.
        </p>
      </div>
      <div>
        <p><b>비교는 영업일당으로</b></p>
        <p>
          주차마다 영업일이 5일·6일·4일로 달라서 총액 비교는 왜곡된다.
          영업일당 실적으로 환산해야 속도가 제대로 보인다.
        </p>
      </div>
      <div>
        <p><b>기대값 계산</b></p>
        <p>
          기준선 = 완료된 주차들의 영업일당 실적 평균.<br />
          지금 시점 기대값 = 기준선 × 이번 주차 경과 영업일.<br />
          <b>기대 대비 배수</b>가 1보다 작으면 앞선 주차들보다 느리다는 뜻이다.
        </p>
      </div>
      <div>
        <p><b>스냅샷은 전일 마감 기준</b></p>
        <p>
          오늘 받은 파일에는 어제까지의 실적이 담긴다. 그래서 경과 영업일도
          하루 전까지만 센다.
        </p>
      </div>
    </>
  );
}
