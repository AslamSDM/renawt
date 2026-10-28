"use client";

import * as React from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { Button, Tooltip, toast } from "@/components/ui";
import { refreshRadar } from "@/lib/actions/radar";
import { generateIdeas } from "@/lib/actions/ideas";

export function RefreshRadarButton({ channelId, nextAllowedAt }: { channelId: string; nextAllowedAt: string | null }) {
  const [until, setUntil] = React.useState<number>(nextAllowedAt ? new Date(nextAllowedAt).getTime() : 0);
  const [now, setNow] = React.useState(() => Date.now());
  const [pending, start] = React.useTransition();

  React.useEffect(() => {
    if (until <= now) return;
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, [until, now]);

  const cooling = until > now;
  const mins = Math.max(1, Math.ceil((until - now) / 60_000));
  const button = (
    <Button
      variant="outline"
      loading={pending}
      disabled={cooling}
      onClick={() =>
        start(async () => {
          const res = await refreshRadar(channelId);
          if (!res.ok) return void toast.error(res.error);
          setUntil(new Date(res.data.nextAllowedAt).getTime());
          setNow(Date.now());
          toast.success("Radar refresh queued. New trend cards land in a few minutes.");
        })
      }
    >
      <RefreshCw /> {cooling ? `Refresh in ${mins}m` : "Refresh"}
    </Button>
  );
  return cooling ? <Tooltip content="The radar re-scans at most every 15 minutes.">{<span tabIndex={0}>{button}</span>}</Tooltip> : button;
}

export function GenerateIdeasButton({
  channelId,
  weekKey,
  size = "md",
  variant = "primary",
  label = "Generate ideas",
}: {
  channelId: string;
  weekKey?: string;
  size?: "sm" | "md";
  variant?: "primary" | "outline" | "ghost";
  label?: string;
}) {
  const [pending, start] = React.useTransition();
  return (
    <Button
      size={size}
      variant={variant}
      loading={pending}
      onClick={() =>
        start(async () => {
          const res = await generateIdeas(channelId, weekKey);
          if (!res.ok) return void toast.error(res.error);
          toast.success(res.data.count ? `${res.data.count} new ideas are in your queue.` : "Idea generation started. Check Ideas in a minute.");
        })
      }
    >
      <Sparkles /> {label}
    </Button>
  );
}
