"use client";

import * as React from "react";
import { AlertTriangle, Database } from "lucide-react";
import { motion } from "motion/react";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SiteNav } from "@/components/site-nav";
import { Awards } from "./awards";
import { Benchmark } from "./benchmark";
import { Branches } from "./branches";
import { Overview } from "./overview";
import { People } from "./people";
import { freshness } from "@/lib/analytics";
import { mdw } from "@/lib/format";
import type { BenchmarkData, CenterData, Meta } from "@/lib/types";

export function Dashboard({
  meta,
  center,
  benchmark,
}: {
  meta: Meta;
  center: CenterData;
  benchmark: BenchmarkData;
}) {
  const jump = React.useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const fresh = freshness(center);

  return (
    <div className="container mx-auto max-w-6xl px-4 pb-20">
      <SiteNav focus={center.focus} asOf={center.asOf} onJump={jump} />

      <motion.div
        className="py-8 md:py-10"
        initial={{ y: 16 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <p className="text-sm text-muted-foreground">
          {center.focus.hq} · {center.focus.dept}
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
          {center.focus.center} 매출 대시보드
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
          매일 들어오는 <span className="font-medium text-foreground">누적</span>{" "}
          실적 파일을 쌓아 두고, 스냅샷 간 차분으로{" "}
          <span className="font-medium text-foreground">일간 매출</span>을 복원한
          결과입니다. 기준일 {mdw(center.asOf)} · 스냅샷 {meta.snapshots.length}개.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge variant="muted" className="gap-1">
            <Database className="h-3 w-3" />
            {meta.snapshots[0]?.date} ~ {center.asOf}
          </Badge>
          {fresh.stale && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              최신 파일이 {fresh.days}일 전입니다
            </Badge>
          )}
          {meta.warnings.length > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              원본 레이아웃 경고 {meta.warnings.length}건
            </Badge>
          )}
        </div>
      </motion.div>

      <div className="space-y-12">
        <Overview data={center} />
        <Separator />
        <Branches data={center} />
        <Separator />
        <People data={center} />
        <Separator />
        <Awards data={center} />
        <Separator />
        <Benchmark data={benchmark} center={center} />
      </div>

      <footer className="mt-16 border-t pt-6 text-xs text-muted-foreground">
        <p>
          생성 {meta.generatedAt} · 원본{" "}
          {meta.snapshots.map((s) => s.source).slice(-1)[0]}
        </p>
        <p className="mt-1">
          실적 = 원본 &lsquo;인실적&rsquo;(월 누적). 원본 단위는 천원이고 화면에는
          모두 만원으로 환산해 표시한다. 시상금도 같은 단위이며, 개인이 받는 돈이라
          조직 단위로 합산하지 않는다.
        </p>
        {meta.warnings.length > 0 && (
          <ul className="mt-2 list-inside list-disc text-[var(--status-warning)]">
            {meta.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
      </footer>
    </div>
  );
}
