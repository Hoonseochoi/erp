"use client";

import * as React from "react";
import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { HelpTip } from "./help-tip";
import { m, n, pct, won } from "@/lib/format";
import type { OrgBase, Tier } from "@/lib/types";

/**
 * 목표(20만)나 전월(10만) 대비 색.
 * 전월 대비는 100%만 넘겨도 성장이니 기준을 낮게, 목표 대비는 100%가 기준선이다.
 */
function refTone(t: Tier) {
  const p = t.refPct ?? 0;
  if (t.ref?.kind === "prev") {
    return p >= 100 ? "var(--status-good)" : p >= 90 ? "var(--status-warning)" : "var(--status-critical)";
  }
  return p >= 100 ? "var(--status-good)" : p >= 80 ? "var(--status-warning)" : "var(--status-critical)";
}

/** 10만 가동 / 20만 가동 카드. 누르면 대상자 명단이 열린다. */
export function TierCards({ data }: { data: OrgBase }) {
  const [open, setOpen] = React.useState<Tier | null>(null);
  const tiers = data.tiers ?? [];
  if (tiers.length === 0) return null;

  const active = data.daily.at(-1)?.active ?? 0;

  return (
    <>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {tiers.map((t) => (
          <Card key={t.key} role="button" tabIndex={0}
            onClick={() => setOpen(t)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(t); }
            }}
            className="cursor-pointer p-4 transition-colors hover:border-foreground/30 hover:bg-muted/40">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {t.label}
              {t.key === tiers[0].key && (
                <HelpTip title="10만 · 20만 가동" width="w-72">
                  <p>
                    <b>당월 실적이 그 금액 이상인 설계사 수</b>다.
                    10만 가동은 실적 10만원 이상, 20만 가동은 20만원 이상.
                  </p>
                  <p>
                    단순 가동(실적 1원이라도 있는 사람)과 달리 <b>의미 있는 규모로
                    움직인 인원</b>만 센다. 가동률은 높은데 이 숫자가 낮으면
                    &ldquo;찍기만 하고 크게 못 판다&rdquo;는 신호다.
                  </p>
                  <p>
                    <b>10만은 전월 실적과, 20만은 이번 달 목표와</b> 견준다.
                    원본이 10만은 전월 인원만, 20만은 목표 인원만 주기 때문이다.
                  </p>
                  <p>카드를 누르면 대상자 명단이 열린다.</p>
                </HelpTip>
              )}
            </div>
            <div className="tnum mt-1.5 flex items-baseline gap-1">
              <span className="text-2xl font-semibold tracking-tight">{n(t.count)}</span>
              <span className="text-xs text-muted-foreground">명</span>
            </div>
            {t.ref && t.refPct !== null ? (
              <>
                <div className="mt-1.5 flex items-baseline justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">
                    {t.ref.label} {n(t.ref.value)}명
                  </span>
                  <span className="tnum font-medium" style={{ color: refTone(t) }}>
                    {t.refPct.toFixed(0)}%
                  </span>
                </div>
                <Progress className="mt-1 h-1.5" value={Math.min(100, t.refPct)}
                  indicatorColor={refTone(t)} />
              </>
            ) : (
              <div className="mt-1 text-xs text-muted-foreground">실적 {won(t.cred)}원</div>
            )}
            <div className="mt-1.5 text-xs text-muted-foreground">
              실적 {won(t.cred)}원
              {active > 0 && ` · 가동 중 ${pct((t.count / active) * 100, 0)}`}
            </div>
          </Card>
        ))}
      </div>

      <TierSheet tier={open} onClose={() => setOpen(null)} level={data.level} />
    </>
  );
}

function TierSheet({ tier, onClose, level }: {
  tier: Tier | null; onClose: () => void; level: OrgBase["level"];
}) {
  return (
    <Sheet open={tier !== null} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:w-[620px] sm:max-w-[620px]">
        {/* key 를 주면 다른 구간을 열 때 컴포넌트가 새로 마운트돼 검색어가 초기화된다 */}
        {tier && <TierBody key={tier.key} tier={tier} level={level} />}
      </SheetContent>
    </Sheet>
  );
}

function TierBody({ tier, level }: { tier: Tier; level: OrgBase["level"] }) {
  const [q, setQ] = React.useState("");

  const rows = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return tier.people;
    return tier.people.filter((p) =>
      p.name.toLowerCase().includes(needle) ||
      p.center.toLowerCase().includes(needle) ||
      p.branch.toLowerCase().includes(needle) ||
      (p.manager ?? "").toLowerCase().includes(needle));
  }, [tier, q]);

  return (
    <>
      <SheetHeader className="mb-3">
        <SheetTitle>{tier.label} 대상자</SheetTitle>
        <SheetDescription>
          당월 실적 {m(tier.threshold)}만원 이상 {n(tier.count)}명 ·
          실적 합계 {won(tier.cred)}원
        </SheetDescription>
      </SheetHeader>

      <div className="relative mb-3">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="설계사 · 센터 · 지사 · 담당 검색" className="pl-8" />
      </div>

      {tier.truncated > 0 && (
        <Badge variant="muted" className="mb-2">
          상위 {n(tier.people.length)}명만 표시 · {n(tier.truncated)}명 더 있음
        </Badge>
      )}

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-9 pl-4">#</TableHead>
              <TableHead>설계사</TableHead>
              {level !== "center" && (
                <TableHead className="hidden sm:table-cell">센터</TableHead>
              )}
              <TableHead className="hidden md:table-cell">지사</TableHead>
              <TableHead className="pr-4 text-right">실적</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p, i) => (
              <TableRow key={`${p.name}-${i}`}>
                <TableCell className="tnum pl-4 text-muted-foreground">{i + 1}</TableCell>
                <TableCell className="font-medium">
                  {p.name}
                  {p.manager && (
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                      {p.manager}
                    </span>
                  )}
                </TableCell>
                {level !== "center" && (
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {p.center}
                  </TableCell>
                )}
                <TableCell className="hidden max-w-[180px] md:table-cell">
                  <span className="block truncate text-muted-foreground">{p.branch}</span>
                </TableCell>
                <TableCell className="tnum pr-4 text-right font-medium">
                  {m(p.cred)}만
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {rows.length === 0 && (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            조건에 맞는 설계사가 없습니다.
          </p>
        )}
      </div>
    </>
  );
}
