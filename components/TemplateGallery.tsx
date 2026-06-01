"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { TemplateCard } from "@/lib/templates";

function ratio(w: number, h: number): string {
  if (!w || !h) return "1 / 1";
  return `${w} / ${h}`;
}

function durationLabel(ms: number): string {
  const s = ms / 1000;
  return s >= 1 ? `${s.toFixed(s % 1 === 0 ? 0 : 1)}s` : `${ms}ms`;
}

/** Palette preview: animated diagonal bands built from the template's colors.
 *  Stands in for a real render until video previews exist. */
function PaletteSwatch({ palette }: { palette: string[] }) {
  const colors = palette.length ? palette : ["#1a1a1f", "#2a2a32", "#3a3a44"];
  const stops = colors
    .map((c, i) => {
      const from = (i / colors.length) * 100;
      const to = ((i + 1) / colors.length) * 100;
      return `${c} ${from}%, ${c} ${to}%`;
    })
    .join(", ");
  return (
    <div
      className="h-full w-full"
      style={{
        background: `linear-gradient(115deg, ${stops})`,
      }}
    />
  );
}

interface Props {
  cards: TemplateCard[];
  sections: { id: string; label: string; count: number }[];
}

export function TemplateGallery({ cards, sections }: Props) {
  const [active, setActive] = useState<string>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cards.filter((c) => {
      const sectionOk = active === "all" || c.section === active;
      const queryOk =
        !q ||
        c.title.toLowerCase().includes(q) ||
        c.sectionLabel.toLowerCase().includes(q);
      return sectionOk && queryOk;
    });
  }, [cards, active, query]);

  return (
    <div>
      {/* Controls */}
      <div className="mb-10 flex flex-col gap-6">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search templates…"
          className="w-full max-w-md border border-rule bg-transparent px-4 py-3 text-base text-ink outline-none placeholder:text-muted focus:border-ink"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActive("all")}
            className={`mono-tick rounded-sm border px-3 py-1.5 transition-colors ${
              active === "all"
                ? "border-ink bg-ink text-ink-inverse"
                : "border-rule text-muted hover:text-ink"
            }`}
          >
            ALL {cards.length}
          </button>
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActive(s.id)}
              className={`mono-tick rounded-sm border px-3 py-1.5 transition-colors ${
                active === s.id
                  ? "border-ink bg-ink text-ink-inverse"
                  : "border-rule text-muted hover:text-ink"
              }`}
            >
              {s.label.toUpperCase()} {s.count}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <p className="text-muted">No templates match that search.</p>
      ) : (
        <div className="grid grid-cols-2 gap-px border border-rule bg-rule sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((c) => (
            <div key={c.id} className="group bg-surface p-4">
              <div
                className="mb-3 w-full overflow-hidden rounded-sm border border-rule"
                style={{ aspectRatio: ratio(c.width, c.height) }}
              >
                {c.previewUrl ? (
                  <video
                    src={c.previewUrl}
                    muted
                    loop
                    autoPlay
                    playsInline
                    preload="metadata"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <PaletteSwatch palette={c.palette} />
                )}
              </div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-ink">{c.title}</p>
                  <p className="mono-tick mt-0.5 text-muted">
                    {c.width}×{c.height} · {durationLabel(c.durationMs)}
                  </p>
                </div>
              </div>
              <Link
                href={`/projects?template=${c.id}`}
                className="mono-tick mt-3 inline-block text-muted opacity-0 transition-opacity hover:text-ink group-hover:opacity-100"
              >
                USE TEMPLATE →
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
