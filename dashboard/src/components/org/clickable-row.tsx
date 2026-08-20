"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import { TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * 행 전체가 클릭 대상인 테이블 로우.
 *
 * <Link> 를 <tr> 자식으로 넣으면 브라우저가 유효하지 않은 테이블 구조로 보고
 * 링크를 테이블 밖으로 끌어내 레이아웃이 깨진다. 그래서 라우터 push 로 대신한다.
 * 화살표 아이콘은 장식일 뿐이고, 실제 클릭 영역은 행 전체다.
 */
export function ClickableRow({
  href, className, children, ...props
}: React.ComponentPropsWithoutRef<typeof TableRow> & { href?: string }) {
  const router = useRouter();
  if (!href) return <TableRow className={className} {...props}>{children}</TableRow>;

  return (
    <TableRow
      role="link"
      tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(href);
        }
      }}
      className={cn("cursor-pointer", className)}
      {...props}
    >
      {children}
    </TableRow>
  );
}
