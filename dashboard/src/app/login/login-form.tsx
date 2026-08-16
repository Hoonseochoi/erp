"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { KeyRound, Loader2, LockKeyhole } from "lucide-react";
import { motion } from "motion/react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, type LoginState } from "./actions";

const INITIAL: LoginState = { error: null };

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState(login, INITIAL);

  return (
    <motion.div
      className="w-full max-w-sm"
      initial={{ y: 12 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl border bg-background shadow-sm">
          <LockKeyhole className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-bold tracking-tighter">매출 대시보드</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          경인.GA7센터 · 열람 권한이 있는 사람만 들어올 수 있습니다.
        </p>
      </div>

      <Card>
        <CardContent className="p-5">
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="next" value={next} />
            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                name="password"
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                autoFocus
                required
                placeholder="••••"
              />
            </div>

            {state.error && (
              <p
                role="alert"
                className="rounded-md border border-[var(--status-critical)]/40 bg-[var(--status-critical)]/10 px-3 py-2 text-xs text-[var(--status-critical)]"
              >
                {state.error}
              </p>
            )}

            <SubmitButton />
          </form>
        </CardContent>
      </Card>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        설계사 개인정보가 포함된 화면입니다. 화면 공유·캡처에 주의하세요.
      </p>
    </motion.div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <KeyRound className="mr-2 h-4 w-4" />
      )}
      들어가기
    </Button>
  );
}
