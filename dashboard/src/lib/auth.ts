import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * 한 사람만 쓰는 대시보드용 최소 인증.
 *
 * 설계 원칙
 *  - 비밀번호는 **코드에 절대 두지 않는다.** `.env.local` 의 APP_PASSWORD 만 읽는다
 *    (저장소는 public 이라 커밋되면 그대로 노출된다).
 *  - 쿠키에는 비밀번호도, "로그인됨" 같은 위조 가능한 평문도 넣지 않는다.
 *    만료시각에 HMAC 서명을 붙여 서버만 검증할 수 있게 한다.
 *  - 비교는 전부 timing-safe.
 */

export const SESSION_COOKIE = "erp_session";
const MAX_AGE_SEC = 60 * 60 * 12; // 12시간

/**
 * 서명 키.
 *
 * AUTH_SECRET 이 있으면 그걸 쓰고, 없으면 비밀번호에서 결정적으로 유도한다.
 * proxy 와 서버 액션이 서로 다른 번들에서 도니까 프로세스마다 랜덤으로 만들면
 * 토큰 검증이 깨진다 — 반드시 결정적이어야 한다.
 */
function signingKey(): string {
  const explicit = process.env.AUTH_SECRET;
  if (explicit && explicit.length >= 16) return explicit;

  const pw = process.env.APP_PASSWORD;
  if (!pw) {
    throw new Error(
      "APP_PASSWORD 가 설정되지 않았습니다. dashboard/.env.local 을 확인하세요.",
    );
  }
  return createHash("sha256").update(`erp-dashboard|${pw}`).digest("hex");
}

function sign(payload: string): string {
  return createHmac("sha256", signingKey()).update(payload).digest("hex");
}

/** 길이가 달라도 예외 없이 false 를 돌려주는 상수시간 비교. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) {
    // 길이만으로 정보가 새지 않도록 더미 비교를 한 번 돌린다.
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

export function checkPassword(input: string): boolean {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return false;
  return safeEqual(input, expected);
}

/** `만료시각.서명` 형태의 세션 토큰. */
export function issueToken(now = Date.now()): string {
  const exp = Math.floor(now / 1000) + MAX_AGE_SEC;
  return `${exp}.${sign(String(exp))}`;
}

export function verifyToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot < 1) return false;

  const exp = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  if (!/^\d+$/.test(exp)) return false;
  if (Number(exp) * 1000 < Date.now()) return false;

  try {
    return safeEqual(mac, sign(exp));
  } catch {
    return false;
  }
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE_SEC,
  // HTTPS 로 서비스할 땐 SECURE_COOKIE=1 을 켠다.
  // 로컬 http 접속에서 켜면 쿠키가 아예 저장되지 않으므로 기본값은 off.
  secure: process.env.SECURE_COOKIE === "1",
};

/* ------------------------------------------------------------------ */
/* 시도 횟수 제한                                                       */
/* ------------------------------------------------------------------ */
/**
 * 4자리 숫자는 경우의 수가 1만개뿐이라 그냥 두면 몇 분이면 뚫린다.
 * 프로세스 메모리에만 두는 단순한 제한 — 서버를 재시작하면 초기화된다.
 */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const attempts = new Map<string, { count: number; first: number }>();

export type RateResult = { allowed: boolean; retryAfterSec: number; left: number };

export function checkRate(key: string): RateResult {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || now - rec.first > WINDOW_MS) {
    return { allowed: true, retryAfterSec: 0, left: MAX_ATTEMPTS };
  }
  if (rec.count >= MAX_ATTEMPTS) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil((rec.first + WINDOW_MS - now) / 1000),
      left: 0,
    };
  }
  return { allowed: true, retryAfterSec: 0, left: MAX_ATTEMPTS - rec.count };
}

export function recordFailure(key: string) {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || now - rec.first > WINDOW_MS) {
    attempts.set(key, { count: 1, first: now });
  } else {
    rec.count += 1;
  }
}

export function clearFailures(key: string) {
  attempts.delete(key);
}
