"use client";

import * as React from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type Pane = { id: string; label: string; node: React.ReactNode };

/** 층마다 탭 구성이 달라서 배열로 받는다. */
export function TabsShell({ panes, initial }: { panes: Pane[]; initial?: string }) {
  return (
    <Tabs defaultValue={initial ?? panes[0].id} className="mt-6">
      <TabsList className="h-auto flex-wrap justify-start">
        {panes.map((p) => (
          <TabsTrigger key={p.id} value={p.id}>{p.label}</TabsTrigger>
        ))}
      </TabsList>
      {panes.map((p) => (
        <TabsContent key={p.id} value={p.id}>{p.node}</TabsContent>
      ))}
    </Tabs>
  );
}
