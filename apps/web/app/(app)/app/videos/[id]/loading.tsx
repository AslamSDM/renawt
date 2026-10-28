import { Grid, Stack } from "@/components/layout";
import { HeaderSkeleton, TableSkeleton } from "@/components/app/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <Grid cols="aside" gap={8}>
        <Stack gap={6} className="lg:order-2">
          <Skeleton className="aspect-[9/16] w-full max-w-[320px]" />
          <Skeleton className="h-40 w-full" />
        </Stack>
        <Stack gap={6} className="lg:order-1">
          <Skeleton className="h-10 w-full" />
          <TableSkeleton rows={6} />
        </Stack>
      </Grid>
    </>
  );
}
