import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Stack } from "@/components/layout/stack";
import { IdeaCard, type IdeaCardData } from "./idea-card";

/** Four-column idea board. Scrolls sideways on small screens instead of squashing cards. */
export function IdeaBoard({ columns, cards }: { columns: readonly { status: string; title: string; empty: string }[]; cards: IdeaCardData[] }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="grid min-w-[960px] grid-cols-4 gap-4 lg:min-w-0">
        {columns.map((col) => {
          const items = cards.filter((c) => c.status === col.status);
          return (
            <section key={col.status} aria-label={col.title} className="flex min-w-0 flex-col gap-4">
              <div className="flex h-8 items-center justify-between gap-2 border-b border-rule">
                <h2 className="type-small font-medium text-ink">{col.title}</h2>
                <Badge variant="neutral" className="tabular-nums">
                  {items.length}
                </Badge>
              </div>
              {items.length === 0 ? (
                <p className="type-small rounded-[2px] border border-dashed border-rule-strong px-4 py-6 text-center text-muted">{col.empty}</p>
              ) : (
                <Stack gap={3}>
                  {items.map((idea) => (
                    <IdeaCard key={idea.id} idea={idea} />
                  ))}
                </Stack>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
