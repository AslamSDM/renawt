"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { IdentityKitSchema, getNiche, type IdentityKit } from "@remawt/shared";
import { cn } from "@/lib/utils";
import { Grid, Inline, KeyValueList, Section, Stack } from "@/components/layout";
import { Badge, Button, Card, FormField, Input, Progress, Textarea, toast } from "@/components/ui";
import { createChannel } from "@/lib/actions/channel";
import { kitPreviews } from "@/lib/actions/kit";
import { NichePicker } from "../kit/niche-picker";
import { SkinPicker } from "../kit/skin-picker";
import { VoicePicker } from "../kit/voice-picker";
import { PersonaEditor } from "../kit/persona-editor";
import { MascotEditor } from "../kit/mascot-editor";
import { nicheCopy, type VoiceOption } from "../kit/defaults";
import { SkinPreview } from "../skin-preview";
import { STEPS, useOnboarding } from "./store";

const COPY: Record<(typeof STEPS)[number]["id"], { title: string; description: string }> = {
  niche: { title: "Pick a niche", description: "The radar watches this niche for breakout videos and turns them into ideas for you." },
  audience: { title: "Who is it for, and what do they get?", description: "Every script is written to this audience and keeps this promise." },
  skin: { title: "Choose the look", description: "Palette, type, motion and captions applied to every video. Tweak the accent and fonts to make it yours." },
  voice: { title: "Choose the narrator", description: "Play a few samples. You can change the voice later without redoing the kit." },
  persona: { title: "Set the persona", description: "How the narrator talks. These settings steer the scriptwriter on every video." },
  mascot: { title: "Add a mascot", description: "Optional. Skip it if your channel is about the ideas, not a character." },
  review: { title: "Review your kit", description: "Name the channel and create it. Everything here can be edited later in channel settings." },
};

/** Steps that already have a good default; the user can jump straight to review. */
const OPTIONAL_STEPS = new Set<string>(["skin", "voice", "persona", "mascot"]);

function slugHandle(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "").slice(0, 30);
}

export function OnboardingWizard({ voices, voicesLive }: { voices: VoiceOption[]; voicesLive: boolean }) {
  const router = useRouter();
  const s = useOnboarding();
  const hydrated = React.useSyncExternalStore(
    (cb) => useOnboarding.persist.onFinishHydration(cb),
    () => useOnboarding.persist.hasHydrated(),
    () => false,
  );
  const [posters, setPosters] = React.useState<Record<string, string>>({});
  const posterNiche = React.useRef<string | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const headingRef = React.useRef<HTMLHeadingElement>(null);

  const step = STEPS[s.step];
  const copy = nicheCopy(s.niche);
  const niche = s.niche ? getNiche(s.niche) : undefined;
  const handle = `@${s.handle || slugHandle(s.name || niche?.name || "yourchannel")}`;

  // Engine-rendered skin posters, once per niche. CSS mocks are the fallback.
  React.useEffect(() => {
    if (step.id !== "skin" || !s.niche || posterNiche.current === s.niche) return;
    posterNiche.current = s.niche;
    void kitPreviews({ niche: s.niche, headline: copy.headline }).then((res) => {
      if (res.ok) setPosters(Object.fromEntries(res.data.previews.map((p) => [p.skinId, p.posterUrl])));
    });
  }, [step.id, s.niche, copy.headline]);

  const firstStep = React.useRef(true);
  React.useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [s.step]);

  function canContinue(): string | null {
    switch (step.id) {
      case "niche":
        return s.niche ? null : "Pick a niche to continue.";
      case "audience":
        if (s.audience.trim().length < 3) return "Describe the audience in a few words.";
        if (s.promise.trim().length < 3) return "Write the promise in a few words.";
        return null;
      case "mascot":
        return s.mascot.enabled && !s.mascot.description?.trim() ? "Describe the mascot, or turn it off." : null;
      default:
        return null;
    }
  }

  function next() {
    const err = canContinue();
    if (err) {
      toast.error(err);
      return;
    }
    // Sensible defaults so a newcomer can click straight through: the niche's example
    // audience and promise, and a channel name derived from the niche. All editable.
    if (step.id === "niche" && s.niche) {
      const c = nicheCopy(s.niche);
      s.set({ audience: s.audience.trim() || c.audience, promise: s.promise.trim() || c.promise });
    }
    const to = Math.min(s.step + 1, STEPS.length - 1);
    if (STEPS[to].id === "review") prefillName();
    s.go(to);
  }

  function prefillName() {
    if (!s.name.trim() && niche) s.set({ name: `${niche.name.split(/[\s&]+/)[0]} Explained` });
  }

  function skipToReview() {
    prefillName();
    s.go(STEPS.length - 1);
  }

  function buildKit(): IdentityKit | null {
    const r = IdentityKitSchema.safeParse({
      version: 1,
      audience: s.audience.trim(),
      promise: s.promise.trim(),
      skin: s.skin,
      voice: s.voice,
      persona: s.persona,
      mascot: s.mascot,
    });
    if (!r.success) {
      const first = r.error.issues[0];
      const area = String(first?.path[0] ?? "");
      const idx = STEPS.findIndex((x) => x.id === (area === "audience" || area === "promise" ? "audience" : area));
      toast.error(`Check the ${STEPS[idx >= 0 ? idx : 0].label.toLowerCase()} step: ${first?.message ?? "invalid value"}`);
      if (idx >= 0) s.go(idx);
      return null;
    }
    return r.data;
  }

  async function submit() {
    const name = s.name.trim();
    if (name.length < 2) {
      setErrors({ name: "Give the channel a name (2+ characters)." });
      return;
    }
    const kit = buildKit();
    if (!kit || !s.niche) return;
    setSubmitting(true);
    const res = await createChannel({
      name,
      handle: s.handle.trim() || undefined,
      niche: s.niche,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      kit,
    });
    setSubmitting(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      toast.error(res.error);
      return;
    }
    toast.success(`${name} is ready. Fresh ideas land in your radar shortly.`);
    s.reset();
    router.push("/app");
    router.refresh();
  }

  if (!hydrated) return <div className="min-h-[60vh]" aria-busy />;

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-12">
      {/* Progress rail */}
      <nav aria-label="Setup steps" className="lg:sticky lg:top-24 lg:self-start">
        <div className="flex flex-col gap-3 lg:hidden">
          <div className="flex items-baseline justify-between">
            <span className="mono-tick tabular-nums">
              Step {s.step + 1} of {STEPS.length}
            </span>
            <span className="type-small text-ink">{step.label}</span>
          </div>
          <Progress value={s.step + 1} max={STEPS.length} aria-label="Setup progress" />
        </div>
        <ol className="hidden flex-col lg:flex">
          {STEPS.map((x, i) => {
            const done = i < s.step;
            const reachable = i <= s.furthest;
            return (
              <li key={x.id}>
                <button
                  type="button"
                  disabled={!reachable}
                  onClick={() => s.go(i)}
                  aria-current={i === s.step ? "step" : undefined}
                  className={cn(
                    "type-small flex h-9 w-full items-center gap-3 border-l pl-4 text-left transition-colors duration-120",
                    i === s.step ? "border-accent font-medium text-ink" : "border-rule text-muted",
                    reachable && i !== s.step && "hover:border-rule-strong hover:text-ink",
                    !reachable && "cursor-not-allowed opacity-45",
                  )}
                >
                  <span className="mono-tick w-4 tabular-nums">{done ? <Check className="size-3 text-success" aria-label="Done" /> : i + 1}</span>
                  {x.label}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <Stack gap={7} className="min-w-0">
        <header className="flex flex-col gap-2">
          <h1 ref={headingRef} tabIndex={-1} className="type-title text-ink outline-none focus-visible:outline-none!">
            {COPY[step.id].title}
          </h1>
          <p className="type-body max-w-[64ch] text-muted">{COPY[step.id].description}</p>
        </header>

        {step.id === "niche" && <NichePicker value={s.niche} onChange={(niche) => s.set({ niche })} />}

        {step.id === "audience" && (
          <Stack gap={4} className="max-w-[640px]">
            <FormField label="Audience" required hint="Filled in from your niche. Make it more specific if you can.">
              <Input value={s.audience} onChange={(e) => s.set({ audience: e.target.value })} maxLength={160} placeholder={copy.audience} />
            </FormField>
            <FormField label="Promise" required hint="What every video delivers, in one line.">
              <Textarea value={s.promise} onChange={(e) => s.set({ promise: e.target.value })} maxLength={240} rows={3} placeholder={copy.promise} />
            </FormField>
          </Stack>
        )}

        {step.id === "skin" && (
          <SkinPicker value={s.skin} onChange={(skin) => s.set({ skin })} headline={copy.headline} stat={copy.stat} handle={handle} posters={posters} />
        )}

        {step.id === "voice" && (
          <Stack gap={4}>
            {!voicesLive && <p className="type-small text-muted">Showing ElevenLabs stock voices. The full library loads once the engine is connected.</p>}
            <VoicePicker voices={voices} value={s.voice} onChange={(voice) => s.set({ voice })} sampleText={`${copy.headline}. Here’s why.`} />
          </Stack>
        )}

        {step.id === "persona" && <PersonaEditor value={s.persona} onChange={(persona) => s.set({ persona })} />}

        {step.id === "mascot" && <MascotEditor value={s.mascot} onChange={(mascot) => s.set({ mascot })} />}

        {step.id === "review" && (
          <Grid cols="aside" gap={8}>
            <Stack gap={7}>
              <Stack gap={4}>
                <FormField label="Channel name" required error={errors.name}>
                  <Input
                    value={s.name}
                    onChange={(e) => {
                      s.set({ name: e.target.value });
                      setErrors({});
                    }}
                    maxLength={60}
                    placeholder={niche ? `${niche.name.split(" ")[0]} Explained` : "My channel"}
                  />
                </FormField>
                <FormField label="Handle" aside="Optional" hint="Shown on previews. Your real handle comes from the connected account.">
                  <Input value={s.handle} onChange={(e) => s.set({ handle: slugHandle(e.target.value) })} maxLength={30} placeholder={slugHandle(s.name || "yourchannel")} leading={<span className="type-body">@</span>} />
                </FormField>
              </Stack>
              <Section title="Kit">
                <Card>
                  <KeyValueList
                    items={[
                      { label: "Niche", value: niche?.name ?? "–" },
                      { label: "Audience", value: s.audience || "–" },
                      { label: "Promise", value: s.promise || "–" },
                      { label: "Skin", value: `${s.skin.name} · ${s.skin.type.display} · ${s.skin.captionStyle} captions` },
                      { label: "Voice", value: `${s.voice.name} · ${s.voice.speed.toFixed(2)}×` },
                      {
                        label: "Tone",
                        value: `formal ${Math.round(s.persona.tone.formal * 100)} · energy ${Math.round(s.persona.tone.energy * 100)} · humor ${Math.round(s.persona.tone.humor * 100)} · density ${Math.round(s.persona.tone.density * 100)}`,
                      },
                      { label: "Point of view", value: { first: "First person", second: "Second person", third: "Third person" }[s.persona.pov] },
                      { label: "Mascot", value: s.mascot.enabled ? (s.mascot.name ?? s.mascot.description ?? "On") : "None" },
                    ]}
                  />
                </Card>
              </Section>
            </Stack>
            <Stack gap={3}>
              <SkinPreview skin={s.skin} headline={copy.headline} stat={copy.stat} handle={handle} posterUrl={posters[s.skin.id]} className="w-full max-w-[280px]" />
              <Inline gap={2}>
                <Badge variant="outline">{s.skin.name}</Badge>
                <Badge variant="neutral">{s.voice.name}</Badge>
              </Inline>
            </Stack>
          </Grid>
        )}

        {/* Sticky so Continue is always one click away, even on the long niche list. */}
        <footer className="sticky bottom-0 z-10 -mx-4 flex items-center justify-between gap-3 border-t border-rule bg-surface/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
          <Button variant="ghost" onClick={() => s.go(Math.max(0, s.step - 1))} disabled={s.step === 0}>
            <ArrowLeft /> Back
          </Button>
          <Inline gap={2} wrap={false}>
            {OPTIONAL_STEPS.has(step.id) && (
              <Button variant="ghost" onClick={skipToReview}>
                <span className="sm:hidden">Skip</span>
                <span className="hidden sm:inline">Skip, use defaults</span>
              </Button>
            )}
            {step.id === "review" ? (
              <Button onClick={submit} loading={submitting}>
                Create channel <Check />
              </Button>
            ) : (
              <Button onClick={next}>
                Continue <ArrowRight />
              </Button>
            )}
          </Inline>
        </footer>
      </Stack>
    </div>
  );
}
