import { HeaderSkeleton, TableSkeleton } from "@/components/app/skeletons";
import { Section } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <Section>
        <Skeleton className="h-10 w-96 max-w-full" />
        <TableSkeleton rows={8} />
      </Section>
    </>
  );
}
