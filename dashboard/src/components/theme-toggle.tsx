"use client";

import { useLayoutEffect } from "react";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * 상태를 들고 있지 않는다.
 * 기본 테마는 CSS(prefers-color-scheme)가 정하고, 아이콘 회전도 CSS 의 dark:
 * 변형이 처리하므로 React state 로 중복 관리할 이유가 없다.
 */
export function ThemeToggle() {
  // OS 설정과 다르게 고른 사람만 여기서 복원된다. OS 설정 그대로 쓰는
  // 대다수는 CSS 만으로 이미 맞는 테마라 깜빡임이 없다.
  useLayoutEffect(() => {
    try {
      const saved = localStorage.getItem("theme");
      if (saved === "light" || saved === "dark") {
        document.documentElement.setAttribute("data-theme", saved);
      }
    } catch {}
  }, []);

  function toggle() {
    const root = document.documentElement;
    const explicit = root.getAttribute("data-theme");
    const current =
      explicit ??
      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {}
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7"
      onClick={toggle}
      aria-label="테마 전환"
    >
      <Sun className="h-[15px] w-[15px] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-[15px] w-[15px] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">테마 전환</span>
    </Button>
  );
}
