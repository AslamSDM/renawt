import Link from "next/link";
import { Tv } from "lucide-react";
import { EmptyState } from "@/components/layout";
import { Button } from "@/components/ui";

export default function NotFound() {
  return (
    <EmptyState
      titleAs="h1"
      icon={Tv}
      title="Channel not found"
      description="It may have been deleted, or it belongs to another account."
      action={
        <Button asChild variant="outline">
          <Link href="/app">Back to home</Link>
        </Button>
      }
    />
  );
}
