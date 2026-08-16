"use client";

import { motion } from "motion/react";

export function Section({
  id,
  title,
  desc,
  action,
  children,
}: {
  id: string;
  title: string;
  desc?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      id={id}
      className="scroll-mt-24"
      // 투명도는 건드리지 않는다. 탭이 백그라운드면 rAF 가 멈춰
      // opacity 애니메이션이 중간값에서 얼어붙고 본문이 안 보이기 때문.
      initial={{ y: 14 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {desc && (
            <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </motion.section>
  );
}
