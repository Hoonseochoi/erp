"use client";

import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { OrgNav } from "./org-nav";
import { OrgHeader } from "./org-header";
import { Trend } from "./trend";
import { Deviation, diagnoseAll } from "./deviation";
import { WeekPacePanel } from "./week-pace";
import { ChildrenPanel } from "./children-table";
import { AgencyPanel } from "./agency-table";
import { TabsShell } from "./tabs-shell";
import { m, n, pct } from "@/lib/format";
import type { DeptData, IndexData } from "@/lib/types";

export function DeptView({ data, index }: { data: DeptData; index: IndexData }) {
  const units = diagnoseAll(data.children, data.asOf);

  return (
    <div className="container mx-auto max-w-6xl px-4 pb-20">
      <OrgNav index={index} asOf={data.asOf} crumbs={[
        { name: data.parent.name, href: data.parent.href },
        { name: data.name, href: `/dept/${data.key}` },
      ]} />

      <div className="pt-7">
        <OrgHeader data={data} ranks={data.ranks}
          subtitle={`${data.parent.name}${data.head ? ` · 단장 ${data.head}` : ""} · 센터 ${data.children.length}개 · 지사 ${n(data.branchCount)}개`} />

        <TabsShell panes={[
          { id: "trend", label: "추이", node: <Trend data={data} /> },
          {
            id: "diag", label: "궤도 진단",
            node: (
              <div className="space-y-8">
                <WeekPacePanel weeks={data.weeks} pace={data.weekPace} />
                <Deviation units={units} compare={data.compare}
                  label="센터" asOf={data.asOf} />
              </div>
            ),
          },
          {
            id: "center", label: "센터",
            node: <ChildrenPanel units={units} compare={data.compare}
              label="센터" dates={data.dates} />,
          },
          {
            id: "agency", label: "운영 대리점",
            node: <AgencyPanel rows={data.agencies} total={data.agencyCount}
              conc={data.agencyConcentration} scope={data.name} />,
          },
          { id: "branch", label: "탑 지사", node: <TopBranches data={data} /> },
        ]} />
      </div>
    </div>
  );
}

function TopBranches({ data }: { data: DeptData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>탑 지사 {data.branches.length} / {n(data.branchCount)}개</CardTitle>
        <CardDescription>
          {data.name} 안의 모든 지사를 실적 순으로. 지사는 센터 아래 단위라 어느 센터
          소속인지 함께 표시한다. 금액 단위 만원.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 pb-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-9 pl-5">#</TableHead>
              <TableHead>지사</TableHead>
              <TableHead className="hidden md:table-cell">센터</TableHead>
              <TableHead className="text-right">실적</TableHead>
              <TableHead className="text-right">전일</TableHead>
              <TableHead className="hidden text-right sm:table-cell">가동/재적</TableHead>
              <TableHead className="pr-5 text-right">가동률</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.branches.map((b, i) => (
              <TableRow key={b.key}>
                <TableCell className="tnum pl-5 text-muted-foreground">{i + 1}</TableCell>
                <TableCell className="max-w-[230px]">
                  <div className="truncate font-medium">{b.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{b.agency}</div>
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">{b.center}</TableCell>
                <TableCell className="tnum text-right font-medium">{m(b.cred)}</TableCell>
                <TableCell className={`tnum text-right ${
                  b.dCred > 0 ? "text-[var(--status-good)]" : "text-muted-foreground"}`}>
                  {b.dCred ? m(b.dCred) : "—"}
                </TableCell>
                <TableCell className="tnum hidden text-right text-muted-foreground sm:table-cell">
                  {b.active} / {n(b.headcount)}
                </TableCell>
                <TableCell className="tnum pr-5 text-right">{pct(b.activeRate)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
