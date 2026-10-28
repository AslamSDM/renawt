import * as React from "react";
import { Grid, Section, Stack } from "@/components/layout";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";

/** Loading shells shaped like the real pages (DESIGN.md §8). */
export function HeaderSkeleton({ actions = true }: { actions?: boolean }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <Stack gap={2}>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-5 w-80 max-w-full" />
      </Stack>
      {actions && <Skeleton className="h-10 w-32" />}
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <Grid cols="stats">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-[2px] border border-rule bg-paper p-5">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </Grid>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-[2px] border border-rule bg-paper">
      <div className="h-10 border-b border-rule" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex h-12 items-center gap-4 border-b border-rule px-4 last:border-0">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="ml-auto h-4 w-12" />
        </div>
      ))}
    </div>
  );
}

export function TilesSkeleton({ count = 5 }: { count?: number }) {
  return (
    <Grid cols="tiles">
      {Array.from({ length: count }, (_, i) => (
        <Stack key={i} gap={3}>
          <Skeleton className="aspect-[9/16] w-full" />
          <Skeleton className="h-4 w-3/4" />
        </Stack>
      ))}
    </Grid>
  );
}

export function CardsSkeleton({ count = 3, cols = 3 as const }: { count?: number; cols?: 2 | 3 | 4 }) {
  return (
    <Grid cols={cols}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-4 rounded-[2px] border border-rule bg-paper p-5">
          <Skeleton className="h-5 w-2/3" />
          <SkeletonText lines={3} />
        </div>
      ))}
    </Grid>
  );
}

export function PageSkeleton({ stats, table, tiles, cards }: { stats?: boolean; table?: boolean; tiles?: boolean; cards?: boolean }) {
  return (
    <>
      <HeaderSkeleton />
      {stats && <StatsSkeleton />}
      {cards && (
        <Section>
          <CardsSkeleton />
        </Section>
      )}
      {tiles && (
        <Section>
          <TilesSkeleton />
        </Section>
      )}
      {table && (
        <Section>
          <TableSkeleton />
        </Section>
      )}
    </>
  );
}
