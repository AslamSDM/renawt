"use client";

import * as React from "react";
import { RadioGroup as RG } from "radix-ui";
import { Search, Sparkles } from "lucide-react";
import { LAUNCH_NICHES, NICHES, type Niche } from "@remawt/shared";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Stack } from "@/components/layout/stack";
import { Grid } from "@/components/layout/grid";
import { EmptyState } from "@/components/layout/empty-state";

const GROUP_LABEL: Record<string, string> = {
  tech: "Tech",
  finance: "Money",
  business: "Business",
  self: "Self & mind",
  knowledge: "Knowledge",
  health: "Health",
  lifestyle: "Lifestyle",
  entertainment: "Entertainment",
};

function NicheOption({ niche, featured }: { niche: Niche; featured?: boolean }) {
  return (
    <RG.Item
      value={niche.slug}
      className={cn(
        "group flex min-w-0 items-center justify-between gap-3 rounded-[2px] border border-rule bg-paper text-left transition-[border-color,background-color] duration-200 ease-out-expo",
        "hover:border-rule-strong hover:bg-paper-2 data-[state=checked]:border-accent data-[state=checked]:bg-accent-soft",
        featured ? "min-h-16 flex-col items-start justify-center gap-1 px-3 py-3" : "h-10 px-3",
      )}
    >
      <span className="type-small truncate font-medium text-ink">{niche.name}</span>
      {featured ? (
        <span className="type-caption line-clamp-1 text-muted">{niche.keywords.slice(0, 3).join(" · ")}</span>
      ) : (
        niche.riskNotes && <span className="mono-tick shrink-0 text-warning" title={niche.riskNotes}>Care</span>
      )}
    </RG.Item>
  );
}

/** Searchable niche grid. Launch niches are featured on top. */
export function NichePicker({ value, onChange }: { value: string | null; onChange: (slug: string) => void }) {
  const [q, setQ] = React.useState("");
  const query = q.trim().toLowerCase();
  const matches = NICHES.filter(
    (n) => !query || n.name.toLowerCase().includes(query) || n.keywords.some((k) => k.toLowerCase().includes(query)) || n.group.includes(query),
  );
  const featured = LAUNCH_NICHES.flatMap((s) => NICHES.filter((n) => n.slug === s));
  const groups = Object.keys(GROUP_LABEL)
    .map((g) => ({ g, items: matches.filter((n) => n.group === g && (query || !LAUNCH_NICHES.includes(n.slug))) }))
    .filter((x) => x.items.length);
  const selected = NICHES.find((n) => n.slug === value);

  return (
    <Stack gap={6}>
      <Input
        leading={<Search />}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search niches: history, AI, stoicism…"
        aria-label="Search niches"
      />
      <RG.Root value={value ?? ""} onValueChange={onChange} aria-label="Niche" className="flex flex-col gap-6">
        {!query && (
          <Stack gap={3}>
            <p className="mono-tick flex items-center gap-1.5">
              <Sparkles className="size-3 text-accent" aria-hidden /> Strongest at launch
            </p>
            <Grid cols={3} gap={2}>
              {featured.map((n) => (
                <NicheOption key={n.slug} niche={n} featured />
              ))}
            </Grid>
          </Stack>
        )}
        {groups.map(({ g, items }) => (
          <Stack key={g} gap={3}>
            <p className="mono-tick">{GROUP_LABEL[g]}</p>
            <Grid cols={3} gap={2}>
              {items.map((n) => (
                <NicheOption key={n.slug} niche={n} />
              ))}
            </Grid>
          </Stack>
        ))}
      </RG.Root>
      {query && groups.length === 0 && (
        <EmptyState size="compact" icon={Search} title={`No niche matches “${q}”`} description="Try a broader word. You can narrow the angle later with your audience and promise." />
      )}
      {selected?.riskNotes && (
        <p className="type-small text-warning" role="note">
          {selected.name}: {selected.riskNotes}.
        </p>
      )}
    </Stack>
  );
}
