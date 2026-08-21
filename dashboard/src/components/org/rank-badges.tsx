"use client";

import { Badge } from "@/components/ui/badge";
import { HelpTip } from "./help-tip";
import { m, pct } from "@/lib/format";
import type { Ranks } from "@/lib/types";

const FIELDS = [
  { key: "achievedPct", label: "달성률", fmt: (v: number) => pct(v) },
  { key: "cred", label: "실적", fmt: (v: number) => `${m(v)}만` },
  { key: "perCapita", label: "인당", fmt: (v: number) => `${m(v * 10)}만` },
  { key: "activeRate", label: "가동률", fmt: (v: number) => pct(v) },
] as const;

/** 형제 조직 사이에서의 순위. 상위 1/3이면 강조한다. */
export function RankBadges({ ranks }: { ranks: Ranks }) {
  const shown = FIELDS.map((f) => ({ ...f, r: ranks[f.key] })).filter((x) => x.r);
  if (shown.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        {ranks.scope}
        <HelpTip title="순위 읽는 법" width="w-72">
          <p>
            같은 층의 조직들 사이에서 이 조직이 몇 등인지다. 기준은 {ranks.scope}.
          </p>
          <p>
            <b>실적 순위와 달성률 순위는 다르게 나온다.</b> 목표와 재적이 조직마다
            달라서, 실적이 낮아도 달성률은 높을 수 있다. 평가에 쓸 잣대는 달성률 쪽이다.
          </p>
          <p>같은 값이면 공동 순위로 처리한다.</p>
        </HelpTip>
      </span>
      {shown.map((x) => {
        const top = x.r!.rank <= Math.max(1, Math.ceil(x.r!.of / 3));
        return (
          <Badge key={x.key} variant={top ? "secondary" : "muted"} className="tnum gap-1">
            <span className="font-normal opacity-70">{x.label}</span>
            {x.r!.rank}/{x.r!.of}위
          </Badge>
        );
      })}
    </div>
  );
}
