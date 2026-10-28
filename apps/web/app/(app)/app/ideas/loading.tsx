import { HeaderSkeleton } from "@/components/app/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { Grid, Stack } from "@/components/layout";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <Grid cols={4}>
        {Array.from({ length: 4 }, (_, i) => (
          <Stack key={i} gap={3}>
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </Stack>
        ))}
      </Grid>
    </>
  );
}
