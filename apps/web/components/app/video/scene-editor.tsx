"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ChevronDown, RotateCcw, Save } from "lucide-react";
import type { ScenePlan } from "@remawt/shared";
import { cn } from "@/lib/utils";
import { EmptyState, Inline, Stack } from "@/components/layout";
import { Badge, Button, FormField, IconButton, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea, toast } from "@/components/ui";
import { rerenderVideo, saveScenes } from "@/lib/actions/video";
import { formatMs } from "@/lib/queries/format";

type Scene = ScenePlan["scenes"][number];
interface Asset {
  id: string;
  kind: string;
  url: string;
  prompt?: string;
}

interface Draft {
  id: string;
  headline: string;
  body: string;
  dataText: string;
  dataError: string | null;
  assetIds: string[];
}

function toDraft(s: Scene): Draft {
  return { id: s.id, headline: s.headline ?? "", body: s.body ?? "", dataText: s.data ? JSON.stringify(s.data, null, 2) : "", dataError: null, assetIds: s.assetIds };
}

/** Scene-level editor: text, data JSON, asset swap and order. Saves to Video.scenes; Re-render sends them to the engine. */
export function SceneEditor({
  videoId,
  plan,
  assets,
  rerendersLeft,
  rerendersTotal,
  busy,
}: {
  videoId: string;
  plan: ScenePlan | null;
  assets: Asset[];
  rerendersLeft: number;
  rerendersTotal: number;
  busy: boolean;
}) {
  const scenes = plan?.scenes ?? [];
  const [order, setOrder] = React.useState(() => scenes.map((s) => s.id));
  const [drafts, setDrafts] = React.useState(() => Object.fromEntries(scenes.map((s) => [s.id, toDraft(s)])) as Record<string, Draft>);
  const [open, setOpen] = React.useState<string | null>(scenes[0]?.id ?? null);
  const [dirty, setDirty] = React.useState(false);
  const [saving, startSave] = React.useTransition();
  const [rendering, startRender] = React.useTransition();
  const byId = new Map(scenes.map((s) => [s.id, s]));

  if (!plan || scenes.length === 0) {
    return <EmptyState size="compact" title="Scenes appear after planning" description="Once the scene plan step finishes you can edit every headline, number and asset here." />;
  }

  const update = (id: string, patch: Partial<Draft>) => {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
    setDirty(true);
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
    setDirty(true);
  };

  function collect() {
    const edits = [];
    for (const id of order) {
      const d = drafts[id];
      let data: Record<string, unknown> | undefined;
      if (d.dataText.trim()) {
        try {
          const parsed: unknown = JSON.parse(d.dataText);
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Data must be a JSON object.");
          data = parsed as Record<string, unknown>;
        } catch (e) {
          update(id, { dataError: e instanceof Error ? e.message : "Invalid JSON" });
          setOpen(id);
          return null;
        }
      }
      edits.push({ id, headline: d.headline || undefined, body: d.body || undefined, data, assetIds: d.assetIds });
    }
    return edits;
  }

  async function save(): Promise<boolean> {
    const edits = collect();
    if (!edits) {
      toast.error("Fix the scene data JSON first.");
      return false;
    }
    const res = await saveScenes({ videoId, order, edits });
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    setDirty(false);
    return true;
  }

  const starts = order.reduce<number[]>((acc, id, i) => [...acc, i === 0 ? 0 : acc[i - 1] + (byId.get(order[i - 1])?.durationMs ?? 0)], []);
  return (
    <Stack gap={4}>
      <ol className="flex flex-col overflow-hidden rounded-[2px] border border-rule bg-paper">
        {order.map((id, i) => {
          const s = byId.get(id);
          const d = drafts[id];
          if (!s || !d) return null;
          const start = starts[i];
          const expanded = open === id;
          const isFootage = s.block === "video-segment";
          const swapOptions = assets.filter((a) => a.kind !== "user-audio");
          return (
            <li key={id} className="border-b border-rule last:border-0">
              <div className="flex min-h-12 items-center gap-3 px-4">
                <span className="mono-tick w-6 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : id)}
                  aria-expanded={expanded}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span className="type-body min-w-0 flex-1 truncate text-ink">{d.headline || (isFootage ? "Your footage" : s.block)}</span>
                  <Badge variant={isFootage ? "accent" : "neutral"} className="hidden sm:inline-flex">
                    {s.block}
                  </Badge>
                  <span className="mono-tick hidden tabular-nums sm:inline">
                    {formatMs(start)}–{formatMs(start + s.durationMs)}
                  </span>
                  <ChevronDown className={cn("size-4 shrink-0 text-subtle transition-transform duration-200", expanded && "rotate-180")} aria-hidden />
                </button>
                <Inline gap={1} wrap={false}>
                  <IconButton size="sm" aria-label="Move scene up" onClick={() => move(i, -1)} disabled={i === 0}>
                    <ArrowUp />
                  </IconButton>
                  <IconButton size="sm" aria-label="Move scene down" onClick={() => move(i, 1)} disabled={i === order.length - 1}>
                    <ArrowDown />
                  </IconButton>
                </Inline>
              </div>
              {expanded && (
                <div className="border-t border-rule bg-paper-2/40 p-5">
                  <Stack gap={4}>
                    {!isFootage && (
                      <>
                        <FormField label="Headline" aside={<span className="tabular-nums">{d.headline.length}</span>}>
                          <Input value={d.headline} onChange={(e) => update(id, { headline: e.target.value })} maxLength={140} />
                        </FormField>
                        <FormField label="Body" aside="Optional">
                          <Textarea value={d.body} onChange={(e) => update(id, { body: e.target.value })} rows={2} maxLength={400} />
                        </FormField>
                      </>
                    )}
                    <FormField label="Data" aside="JSON" error={d.dataError} hint="Chart series, stats, map points. Numbers here are drawn exactly.">
                      <Textarea
                        value={d.dataText}
                        onChange={(e) => update(id, { dataText: e.target.value, dataError: null })}
                        rows={Math.min(10, Math.max(3, d.dataText.split("\n").length))}
                        spellCheck={false}
                        className="font-mono text-[13px]"
                        placeholder='{"value": 73, "unit": "%"}'
                      />
                    </FormField>
                    {swapOptions.length > 0 && !isFootage && (
                      <FormField label="Asset" hint="Swap the image or clip used in this scene.">
                        <Select value={d.assetIds[0] ?? "none"} onValueChange={(v) => update(id, { assetIds: v === "none" ? [] : [v, ...d.assetIds.slice(1).filter((x) => x !== v)] })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No asset</SelectItem>
                            {swapOptions.map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.kind} · {(a.prompt ?? a.url.split("/").pop() ?? a.id).slice(0, 48)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormField>
                    )}
                  </Stack>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <Inline gap={3} justify="between">
        <span className="type-small text-muted tabular-nums">
          {rerendersLeft > 0 ? `${rerendersLeft} of ${rerendersTotal} free re-renders left` : "No free re-renders left on this video"}
        </span>
        <Inline gap={2}>
          <Button variant="outline" onClick={() => startSave(async () => void ((await save()) && toast.success("Scene edits saved.")))} loading={saving} disabled={!dirty || busy}>
            <Save /> Save edits
          </Button>
          <Button
            onClick={() =>
              startRender(async () => {
                if (dirty && !(await save())) return;
                const res = await rerenderVideo(videoId);
                if (!res.ok) return void toast.error(res.error);
                toast.success("Re-render started. Progress is on the left.");
              })
            }
            loading={rendering}
            disabled={busy || rerendersLeft <= 0}
          >
            <RotateCcw /> Re-render
          </Button>
        </Inline>
      </Inline>
    </Stack>
  );
}
