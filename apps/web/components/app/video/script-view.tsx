import * as React from "react";
import type { Script } from "@remawt/shared";
import { Section, Stack } from "@/components/layout";
import { Card } from "@/components/ui/card";

/** Read-only script: hook, beat lines with on-screen text and target seconds, sources. */
export function ScriptView({ script }: { script: Script }) {
  return (
    <Stack gap={4}>
      <Card>
        <p className="mono-tick">Hook</p>
        <p className="type-heading text-ink">{script.hook}</p>
      </Card>
      <ol className="flex flex-col overflow-hidden rounded-[2px] border border-rule bg-paper">
        {script.lines.map((l, i) => (
          <li key={i} className="grid grid-cols-[72px_minmax(0,1fr)_40px] items-baseline gap-3 border-b border-rule px-4 py-3 last:border-0">
            <span className="mono-tick truncate">{l.beatId}</span>
            <span className="flex flex-col gap-1">
              <span className="type-body text-ink">{l.text}</span>
              {l.onScreen && <span className="type-caption text-muted">On screen: {l.onScreen}</span>}
            </span>
            <span className="mono-tick text-right tabular-nums">{Math.round(l.targetSec)}s</span>
          </li>
        ))}
      </ol>
      {script.sources.length > 0 && (
        <Section title="Sources">
          <ul className="flex flex-col gap-1">
            {script.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noreferrer noopener" className="type-small text-muted underline decoration-rule-strong underline-offset-4 hover:text-ink">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </Stack>
  );
}
