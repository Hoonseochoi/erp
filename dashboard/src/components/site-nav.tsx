"use client";

import { Building2, CalendarDays, LogOut, Menu } from "lucide-react";

import { logout } from "@/app/login/actions";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { mdw } from "@/lib/format";
import type { FocusInfo } from "@/lib/types";

const SECTIONS = [
  { id: "overview", label: "개요" },
  { id: "branch", label: "지사" },
  { id: "people", label: "설계사" },
  { id: "award", label: "시상" },
  { id: "benchmark", label: "조직비교" },
];

export function SiteNav({
  focus,
  asOf,
  onJump,
}: {
  focus: FocusInfo;
  asOf: string;
  onJump: (id: string) => void;
}) {
  return (
    <header className="sticky top-0 z-40 pt-4">
      <nav className="flex items-center justify-between rounded-xl border bg-background/85 px-4 py-2 shadow-lg backdrop-blur-md">
        <div className="flex min-w-0 items-center space-x-6">
          <button
            onClick={() => onJump("overview")}
            className="flex shrink-0 items-center gap-2 text-base font-semibold"
          >
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">{focus.center}</span>
            <span className="sm:hidden">GA7</span>
          </button>
          <div className="hidden items-center space-x-6 md:flex">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => onJump(s.id)}
                className="text-sm text-muted-foreground/60 transition-colors hover:text-foreground/80"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 items-center space-x-3">
          <Badge variant="muted" className="hidden gap-1 sm:inline-flex">
            <CalendarDays className="h-3 w-3" />
            기준 {mdw(asOf)}
          </Badge>
          <Separator orientation="vertical" className="hidden h-6 sm:block" />
          <ThemeToggle />
          <form action={logout}>
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              className="hidden h-7 w-7 md:inline-flex"
              aria-label="로그아웃"
              title="로그아웃"
            >
              <LogOut className="h-[15px] w-[15px]" />
            </Button>
          </form>
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 md:hidden"
                aria-label="메뉴 열기"
              >
                <Menu className="h-[15px] w-[15px]" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[240px]">
              <SheetTitle className="mb-4 text-base">{focus.center}</SheetTitle>
              <nav className="flex flex-col space-y-4">
                {SECTIONS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => onJump(s.id)}
                    className="text-left text-sm text-muted-foreground/60 transition-colors hover:text-foreground/80"
                  >
                    {s.label}
                  </button>
                ))}
                <Separator />
                <span className="text-xs text-muted-foreground">
                  기준일 {mdw(asOf)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {focus.hq} · {focus.dept}
                </span>
                <form action={logout}>
                  <Button
                    type="submit"
                    variant="ghost"
                    className="h-8 w-full justify-start px-2 text-sm font-normal"
                  >
                    <LogOut className="mr-2 h-3.5 w-3.5" />
                    로그아웃
                  </Button>
                </form>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}
