import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE, verifyToken } from "@/lib/auth";

/**
 * 로그인 게이트.
 *
 * Next 16 에서 middleware 는 proxy 로 이름이 바뀌었고 Node.js 런타임에서 돈다.
 * 여기서 막지 않으면 서버 컴포넌트가 데이터를 읽어 렌더한 뒤에야 막히므로
 * 요청 단계에서 걸러낸다.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/login") return NextResponse.next();

  if (verifyToken(request.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  // 로그인 후 원래 보려던 곳으로 돌려보낸다. 오픈 리다이렉트를 막으려고
  // 같은 사이트의 경로만 넘긴다.
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // 정적 자산은 통과시키되 나머지는 전부 검사한다.
  // public/ 에 데이터를 두지 않으므로 여기서 새어나갈 파일은 없다.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
