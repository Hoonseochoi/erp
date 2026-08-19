import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold tracking-tight">조직을 찾을 수 없습니다</h1>
      <p className="text-sm text-muted-foreground">
        주소가 바뀌었거나, 아직 데이터가 생성되지 않은 조직입니다.
      </p>
      <Button asChild><Link href="/">팀 전체로 돌아가기</Link></Button>
    </main>
  );
}
