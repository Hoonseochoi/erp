"use client";

import { HelpCircle } from "lucide-react";

import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * 제목 옆에 붙이는 물음표 아이콘. 누르면 설명이 펼쳐진다.
 * 호버 툴팁 대신 Popover 를 쓴 이유: 내용이 한 줄이 아니라서 마우스를
 * 치우면 사라지는 툴팁으로는 다 못 읽는다. 터치 기기에서도 그대로 동작한다.
 */
export function HelpTip({
  title, children, width = "w-80",
}: {
  title: string;
  children: React.ReactNode;
  width?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${title} 설명 보기`}
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:text-foreground"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className={cn(width, "max-h-[70vh] overflow-y-auto text-sm")} align="start">
        <div className="mb-2 font-semibold">{title}</div>
        <div className="space-y-2.5 text-xs leading-relaxed text-muted-foreground [&_b]:font-medium [&_b]:text-foreground">
          {children}
        </div>
      </PopoverContent>
    </Popover>
  );
}
