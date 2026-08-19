"use client";

import Link from "next/link";
import { Building2, ChevronRight, LogOut, Menu, Search } from "lucide-react";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Sheet, SheetContent, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { logout } from "@/app/login/actions";
import { mdw } from "@/lib/format";
import type { IndexData, Link as OrgLink } from "@/lib/types";

/**
 * 상단 고정 네비.
 *
 * 왼쪽은 현재 위치(팀 › 영업단 › 센터)를 보여주는 빵부스러기,
 * 오른쪽 햄버거는 조직 전체 트리를 열어 어디로든 바로 점프한다.
 * 계층이 3단이라 "뒤로가기"만으로는 이동이 답답해서 트리를 항상 열어둔다.
 */
export function OrgNav({
  index,
  crumbs,
  asOf,
}: {
  index: IndexData;
  crumbs: OrgLink[];
  asOf: string;
}) {
  return (
    <header className="sticky top-0 z-40 pt-3">
      <nav className="flex items-center justify-between gap-3 rounded-xl border bg-background/85 px-4 py-2 shadow-lg backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-1.5 text-sm">
          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          {crumbs.map((c, i) => (
            <React.Fragment key={c.href}>
              {i > 0 && (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
              )}
              {i === crumbs.length - 1 ? (
                <span className="truncate font-semibold">{c.name}</span>
              ) : (
                <Link
                  href={c.href}
                  className="hidden shrink-0 text-muted-foreground/70 transition-colors hover:text-foreground sm:inline"
                >
                  {c.name}
                </Link>
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="muted" className="hidden lg:inline-flex">
            기준 {mdw(asOf)}
          </Badge>
          <Separator orientation="vertical" className="hidden h-6 lg:block" />
          <ThemeToggle />
          <form action={logout}>
            <Button type="submit" variant="ghost" size="icon" className="h-7 w-7"
              aria-label="로그아웃" title="로그아웃">
              <LogOut className="h-[15px] w-[15px]" />
            </Button>
          </form>
          <OrgTree index={index} />
        </div>
      </nav>
    </header>
  );
}

function OrgTree({ index }: { index: IndexData }) {
  const [q, setQ] = React.useState("");
  const needle = q.trim().toLowerCase();
  const tree = React.useMemo(() => {
    if (!needle) return index.tree;
    return index.tree
      .map((d) => ({
        ...d,
        centers: d.centers.filter((c) => c.name.toLowerCase().includes(needle)),
      }))
      .filter((d) => d.name.toLowerCase().includes(needle) || d.centers.length > 0);
  }, [index.tree, needle]);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="조직 이동">
          <Menu className="h-[15px] w-[15px]" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[300px] overflow-y-auto sm:w-[340px]">
        <SheetTitle className="mb-3 text-base">조직 이동</SheetTitle>

        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="영업단 · 센터 검색" className="pl-8" />
        </div>

        <Link href="/" className="mb-2 block rounded-md px-2 py-1.5 text-sm font-semibold hover:bg-muted">
          {index.team} <span className="text-muted-foreground">전체</span>
        </Link>

        <div className="space-y-3">
          {tree.map((d) => (
            <div key={d.key}>
              <Link href={d.href}
                className="block rounded-md px-2 py-1 text-sm font-medium hover:bg-muted">
                {d.name}
              </Link>
              <div className="mt-0.5 space-y-0.5 border-l pl-3">
                {d.centers.map((c) => (
                  <Link key={c.key} href={c.href}
                    className="block rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                    {c.name}
                  </Link>
                ))}
              </div>
            </div>
          ))}
          {tree.length === 0 && (
            <p className="px-2 text-xs text-muted-foreground">검색 결과가 없습니다.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
