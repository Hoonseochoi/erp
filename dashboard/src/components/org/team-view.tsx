"use client";

import { AlertTriangle, Database } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { OrgNav } from "./org-nav";
import { OrgHeader } from "./org-header";
import { Trend } from "./trend";
import { Deviation, diagnoseAll } from "./deviation";
import { ChildrenPanel } from "./children-table";
import { AgencyPanel } from "./agency-table";
import { TabsShell } from "./tabs-shell";
import { freshness } from "@/lib/analytics";
import { n } from "@/lib/format";
import type { IndexData, TeamData } from "@/lib/types";

export function TeamView({ data, index }: { data: TeamData; index: IndexData }) {
  const units = diagnoseAll(data.children, data.asOf);
  const fresh = freshness(data.asOf);
  const centers = data.children.reduce((a, b) => a + (b.centers ?? 0), 0);

  return (
    <div className="container mx-auto max-w-6xl px-4 pb-20">
      <OrgNav index={index} asOf={data.asOf} crumbs={[{ name: data.name, href: "/" }]} />

      <div className="pt-7">
        <OrgHeader data={data}
          subtitle={`영업단 ${data.children.length}개 · 센터 ${centers}개 · 대리점 ${n(data.agencyCount)}개`} />

        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="muted" className="gap-1">
            <Database className="h-3 w-3" />
            {data.dates[0]} ~ {data.asOf} · 스냅샷 {data.dates.length}개
          </Badge>
          {data.partialTargets.have < data.partialTargets.total && (
            <Badge variant="muted" className="gap-1">
              목표 등록 {data.partialTargets.have}/{data.partialTargets.total} 영업단
            </Badge>
          )}
          {fresh.stale && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />최신 파일이 {fresh.days}일 전
            </Badge>
          )}
          {index.warnings.length > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />원본 레이아웃 경고 {index.warnings.length}건
            </Badge>
          )}
        </div>

        <TabsShell panes={[
          { id: "trend", label: "추이", node: <Trend data={data} /> },
          {
            id: "diag", label: "궤도 진단",
            node: <Deviation units={units} compare={data.compare}
              label="영업단" asOf={data.asOf} />,
          },
          {
            id: "dept", label: "영업단",
            node: <ChildrenPanel units={units} compare={data.compare}
              label="영업단" dates={data.dates} />,
          },
          {
            id: "agency", label: "운영 대리점",
            node: <AgencyPanel rows={data.agencies} total={data.agencyCount}
              conc={data.agencyConcentration} scope="팀 전체" />,
          },
        ]} />

        <footer className="mt-14 border-t pt-6 text-xs text-muted-foreground">
          <p>생성 {index.generatedAt} · 원본 {index.snapshots.at(-1)?.source}</p>
          <p className="mt-1">
            실적 = 원본 &lsquo;인실적&rsquo;(월 누적, 천원) → 화면은 만원 환산.
            일간 실적은 스냅샷 차분으로 복원한 값이다.
          </p>
        </footer>
      </div>
    </div>
  );
}
