"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  SESSION_COOKIE,
  checkPassword,
  checkRate,
  clearFailures,
  cookieOptions,
  issueToken,
  recordFailure,
} from "@/lib/auth";

export type LoginState = { error: string | null };

/** 프록시/터널 뒤에서도 쓸 수 있는 대략적인 클라이언트 식별자. */
async function clientKey() {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim();
}

/** 로그인 후 돌아갈 경로. 외부 URL 로 튕기지 않게 같은 사이트 경로만 허용. */
function safeNext(raw: FormDataEntryValue | null): string {
  const v = typeof raw === "string" ? raw : "";
  if (!v.startsWith("/") || v.startsWith("//")) return "/";
  return v;
}

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const key = await clientKey();

  const rate = checkRate(key);
  if (!rate.allowed) {
    const min = Math.ceil(rate.retryAfterSec / 60);
    return { error: `시도 횟수를 초과했습니다. ${min}분 뒤에 다시 시도하세요.` };
  }

  const password = String(formData.get("password") ?? "");
  if (!password) return { error: "비밀번호를 입력하세요." };

  let ok = false;
  try {
    ok = checkPassword(password);
  } catch (e) {
    return {
      error:
        e instanceof Error ? e.message : "서버 설정이 올바르지 않습니다.",
    };
  }

  if (!ok) {
    recordFailure(key);
    const left = checkRate(key).left;
    return {
      error:
        left > 0
          ? `비밀번호가 맞지 않습니다. (남은 시도 ${left}회)`
          : "시도 횟수를 초과했습니다. 잠시 뒤에 다시 시도하세요.",
    };
  }

  clearFailures(key);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, issueToken(), cookieOptions);
  redirect(safeNext(formData.get("next")));
}

export async function logout() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}
