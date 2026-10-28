import { Skeleton } from "@/components/ui/skeleton";
import { Grid, Stack } from "@/components/layout";

export default function Loading() {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-12">
      <Stack gap={2} className="hidden lg:flex">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </Stack>
      <Stack gap={7}>
        <Stack gap={2}>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-5 w-96 max-w-full" />
        </Stack>
        <Skeleton className="h-10 w-full" />
        <Grid cols={3} gap={2}>
          {Array.from({ length: 9 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </Grid>
      </Stack>
    </div>
  );
}
