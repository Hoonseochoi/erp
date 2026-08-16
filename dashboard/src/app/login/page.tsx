import { LoginForm } from "./login-form";

export const metadata = { title: "로그인 · 매출 대시보드" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safe = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <LoginForm next={safe} />
    </main>
  );
}
