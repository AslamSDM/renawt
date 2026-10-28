import { HeaderSkeleton } from "@/components/app/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton actions={false} />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-[480px] w-full" />
    </>
  );
}
