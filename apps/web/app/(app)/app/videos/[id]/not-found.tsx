import Link from "next/link";
import { Clapperboard } from "lucide-react";
import { EmptyState } from "@/components/layout";
import { Button } from "@/components/ui";

export default function NotFound() {
  return (
    <EmptyState
      icon={Clapperboard}
      title="Video not found"
      description="It may have been deleted, or it belongs to another account."
      action={
        <Button asChild variant="outline">
          <Link href="/app/videos">All videos</Link>
        </Button>
      }
    />
  );
}
