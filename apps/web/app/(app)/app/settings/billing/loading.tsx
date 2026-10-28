import { HeaderSkeleton, StatsSkeleton } from "@/components/app/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <Skeleton className="h-72 w-full" />
      <StatsSkeleton />
    </>
  );
}
