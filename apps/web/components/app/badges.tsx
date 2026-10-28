import * as React from "react";
import { getFormat } from "@remawt/shared";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { platformLabel } from "@/lib/queries/format";

type Variant = NonNullable<BadgeProps["variant"]>;

const VIDEO: Record<string, { label: string; variant: Variant; dot?: boolean }> = {
  DRAFT: { label: "Draft", variant: "neutral" },
  QUEUED: { label: "Queued", variant: "neutral", dot: true },
  TRANSCRIBING: { label: "Transcribing", variant: "warning", dot: true },
  SCRIPTING: { label: "Scripting", variant: "warning", dot: true },
  VOICING: { label: "Voicing", variant: "warning", dot: true },
  PLANNING: { label: "Planning", variant: "warning", dot: true },
  COMPOSING: { label: "Composing", variant: "warning", dot: true },
  RENDERING: { label: "Rendering", variant: "warning", dot: true },
  QC: { label: "Checking", variant: "warning", dot: true },
  READY: { label: "Ready", variant: "success" },
  FAILED: { label: "Failed", variant: "danger" },
  PUBLISHED: { label: "Published", variant: "accent" },
};

export const VIDEO_STATUSES = Object.keys(VIDEO);
export const ACTIVE_VIDEO_STATUSES = ["QUEUED", "TRANSCRIBING", "SCRIPTING", "VOICING", "PLANNING", "COMPOSING", "RENDERING", "QC"] as const;
export function videoStatusLabel(s: string) {
  return VIDEO[s]?.label ?? s;
}

export function VideoStatusBadge({ status, className }: { status: string; className?: string }) {
  const m = VIDEO[status] ?? { label: status, variant: "neutral" as const };
  return (
    <Badge variant={m.variant} dot={m.dot} className={className}>
      {m.label}
    </Badge>
  );
}

const IDEA: Record<string, { label: string; variant: Variant }> = {
  SUGGESTED: { label: "Suggested", variant: "neutral" },
  APPROVED: { label: "Approved", variant: "accent" },
  QUEUED: { label: "Queued", variant: "warning" },
  PRODUCED: { label: "Produced", variant: "success" },
  DISMISSED: { label: "Dismissed", variant: "neutral" },
};
export function IdeaStatusBadge({ status }: { status: string }) {
  const m = IDEA[status] ?? { label: status, variant: "neutral" as const };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

const PUB: Record<string, { label: string; variant: Variant; dot?: boolean }> = {
  SCHEDULED: { label: "Scheduled", variant: "accent" },
  PUBLISHING: { label: "Posting", variant: "warning", dot: true },
  PUBLISHED: { label: "Posted", variant: "success" },
  FAILED: { label: "Failed", variant: "danger" },
  CANCELLED: { label: "Cancelled", variant: "neutral" },
};
export function PublicationStatusBadge({ status }: { status: string }) {
  const m = PUB[status] ?? { label: status, variant: "neutral" as const };
  return (
    <Badge variant={m.variant} dot={m.dot}>
      {m.label}
    </Badge>
  );
}

export function FormatBadge({ format }: { format: string | null | undefined }) {
  if (!format || format === "auto") return <Badge variant="outline">Auto format</Badge>;
  return <Badge variant="outline">{getFormat(format)?.name ?? format.replace(/[-_]/g, " ")}</Badge>;
}

export function RiskBadge({ level }: { level: string | null | undefined }) {
  if (!level) return null;
  const variant: Variant = level === "high" ? "danger" : level === "medium" ? "warning" : "success";
  return <Badge variant={variant}>{level} risk</Badge>;
}

export function PlatformBadge({ platform, variant = "neutral" }: { platform: string; variant?: Variant }) {
  return <Badge variant={variant}>{platformLabel(platform)}</Badge>;
}
