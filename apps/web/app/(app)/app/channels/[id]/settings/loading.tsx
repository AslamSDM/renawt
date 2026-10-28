import { HeaderSkeleton } from "@/components/app/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { Stack } from "@/components/layout";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <Skeleton className="h-10 w-full" />
      <Stack gap={4}>
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </Stack>
    </>
  );
}
