"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { motion } from "motion/react";

import { Card } from "@/components/ui/card";
import { Sparkline } from "@/components/charts/chart-kit";
import { cn } from "@/lib/utils";

export function StatTile({
  label,
  value,
  unit,
  sub,
  delta,
  deltaLabel,
  spark,
  sparkColor,
  index = 0,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: React.ReactNode;
  /** 부호가 의미를 갖는 증감값. undefined 면 표시하지 않는다. */
  delta?: number | null;
  deltaLabel?: string;
  spark?: number[];
  sparkColor?: string;
  index?: number;
}) {
  const dir = delta === null || delta === undefined ? null : Math.sign(delta);
  const Icon = dir === 1 ? ArrowUpRight : dir === -1 ? ArrowDownRight : Minus;

  return (
    <motion.div
      initial={{ y: 12 }}
      animate={{ y: 0 }}
      transition={{ delay: 0.04 * index, duration: 0.35 }}
    >
      <Card className="h-full p-4">
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs text-muted-foreground">{label}</span>
          {spark && spark.length > 1 && (
            <Sparkline values={spark} color={sparkColor} />
          )}
        </div>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="tnum text-2xl font-semibold tracking-tight">
            {value}
          </span>
          {unit && (
            <span className="text-xs text-muted-foreground">{unit}</span>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {dir !== null && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-medium",
                dir > 0 && "text-[var(--status-good)]",
                dir < 0 && "text-[var(--status-critical)]",
                dir === 0 && "text-muted-foreground",
              )}
            >
              <Icon className="h-3 w-3" />
              {deltaLabel}
            </span>
          )}
          {sub && <span className="text-muted-foreground">{sub}</span>}
        </div>
      </Card>
    </motion.div>
  );
}
