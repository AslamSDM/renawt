import { Grid, Section } from "@/components/layout";
import { CardsSkeleton, HeaderSkeleton } from "@/components/app/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <Grid cols="aside" gap={8}>
        <Section>
          <CardsSkeleton count={3} cols={2} />
        </Section>
        <Skeleton className="h-64 w-full" />
      </Grid>
    </>
  );
}
