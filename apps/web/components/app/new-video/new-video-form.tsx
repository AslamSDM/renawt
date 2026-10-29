"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AudioLines, CircleCheck, FileVideo, Lightbulb, Mic, PenLine, RotateCcw, TriangleAlert, Upload, X } from "lucide-react";
import type { PlanId } from "@remawt/shared";
import { Grid, Inline, Section, Stack } from "@/components/layout";
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  FormField,
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Slider,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  toast,
} from "@/components/ui";
import { startVideo } from "@/lib/actions/video";
import { FormatBadge } from "../badges";
import { FormatPicker } from "../format-picker";
import { Dropzone } from "./dropzone";
import { useUpload, type UploadState } from "./use-upload";
import { Waveform } from "./waveform";

type Kind = "prompt" | "video" | "audio";
type Quality = "draft" | "standard" | "premium";
type Aspect = "9:16" | "16:9" | "1:1" | "4:5";
type Density = "light" | "medium" | "heavy";

const QUALITY_LABEL: Record<Quality, { label: string; hint: string; plan: string }> = {
  draft: { label: "Draft", hint: "Fast preview render", plan: "Free" },
  standard: { label: "Standard", hint: "Full 1080×1920 render", plan: "Starter" },
  premium: { label: "Premium", hint: "Extra critic pass on script and motion", plan: "Pro" },
};

export interface NewVideoFormProps {
  channelId: string;
  plan: { id: PlanId; name: string; maxDurationSec: number; quality: Quality };
  videosRemaining: number;
  defaultDuration: number;
  idea: { id: string; title: string; hook: string; format: string; angle: string | null } | null;
  initialTab: Kind;
}

function guessAspect(w: number, h: number): Aspect {
  const r = w / h;
  const options: [Aspect, number][] = [
    ["9:16", 9 / 16],
    ["4:5", 4 / 5],
    ["1:1", 1],
    ["16:9", 16 / 9],
  ];
  return options.reduce((best, o) => (Math.abs(o[1] - r) < Math.abs(best[1] - r) ? o : best))[0];
}

function UploadStatus({ state, onRetry, onClear }: { state: UploadState; onRetry: () => void; onClear: () => void }) {
  const pct = Math.round(state.progress * 100);
  return (
    <Inline gap={3} justify="between" className="w-full">
      <span className="flex min-w-0 flex-col">
        <span className="type-small truncate font-medium text-ink">{state.file?.name}</span>
        <span className={state.status === "error" ? "type-caption text-danger" : "mono-tick tabular-nums"}>
          {state.status === "error"
            ? state.error
            : state.status === "done"
              ? `Uploaded · ${((state.file?.size ?? 0) / 1e6).toFixed(1)} MB`
              : state.status === "signing"
                ? "Preparing upload"
                : `Uploading ${pct}%`}
        </span>
      </span>
      <Inline gap={2} wrap={false}>
        {state.status === "error" && (
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RotateCcw /> Retry
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onClear}>
          <X /> {state.status === "uploading" ? "Cancel" : "Remove"}
        </Button>
      </Inline>
    </Inline>
  );
}

type Check = { label: string; value: string; tone: "ok" | "warn" | "pending" };

/** Size / aspect / duration checks shown as soon as the browser reads the file, before anything is submitted. */
function FileChecks({ checks }: { checks: Check[] }) {
  return (
    <ul className="flex flex-col divide-y divide-rule rounded-[2px] border border-rule" aria-label="File checks">
      {checks.map((c) => (
        <li key={c.label} className="flex min-h-10 items-center gap-3 px-3">
          {c.tone === "ok" ? (
            <CircleCheck className="size-4 shrink-0 text-success" aria-label="Passed" />
          ) : c.tone === "warn" ? (
            <TriangleAlert className="size-4 shrink-0 text-warning" aria-label="Heads up" />
          ) : (
            <span className="grid size-4 shrink-0 place-items-center" aria-label="Checking">
              <span className="size-1.5 rounded-full bg-subtle" />
            </span>
          )}
          <span className="mono-tick w-20 shrink-0">{c.label}</span>
          <span className="type-small min-w-0 flex-1 text-ink">{c.value}</span>
        </li>
      ))}
    </ul>
  );
}

function fmtDuration(ms: number) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const NEXT_STEPS = [
  ["Script", "Researched and written in your channel’s voice, then split into scenes."],
  ["Render", "Voice, visuals and captions in your kit’s look, checked before render."],
  ["Review", "Edit any scene, re-render for free, then publish or schedule."],
] as const;

export function NewVideoForm({ channelId, plan, videosRemaining, defaultDuration, idea, initialTab }: NewVideoFormProps) {
  const router = useRouter();
  const [kind, setKind] = React.useState<Kind>(initialTab);
  const [text, setText] = React.useState("");
  const [format, setFormat] = React.useState<string>(idea?.format ?? "auto");
  const [seconds, setSeconds] = React.useState(Math.min(defaultDuration, plan.maxDurationSec));
  const [quality, setQuality] = React.useState<Quality>(plan.quality === "premium" ? "standard" : plan.quality);
  const [notes, setNotes] = React.useState("");
  const [keepAudio, setKeepAudio] = React.useState(true);
  const [aspect, setAspect] = React.useState<Aspect>("9:16");
  const [density, setDensity] = React.useState<Density>("medium");
  const [media, setMedia] = React.useState<{ durationMs?: number; aspect?: Aspect }>({});
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();

  const videoUp = useUpload(channelId, "video");
  const audioUp = useUpload(channelId, "audio");
  const active = kind === "video" ? videoUp : kind === "audio" ? audioUp : null;

  React.useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function pickFile(f: File, k: "video" | "audio") {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);
    setMedia({});
    void (k === "video" ? videoUp : audioUp).start(f);
  }

  const qualities: Quality[] = ["draft", "standard", "premium"];
  const maxQ = qualities.indexOf(plan.quality);
  const uploadReady = kind === "prompt" || (active?.state.status === "done" && !!active.state.publicUrl);
  const outOfVideos = videosRemaining <= 0;

  function checksFor(k: "video" | "audio"): Check[] {
    const st = (k === "video" ? videoUp : audioUp).state;
    const limit = k === "video" ? 2_000 : 200;
    const mb = (st.file?.size ?? 0) / 1e6;
    const list: Check[] = [{ label: "Size", value: `${mb.toFixed(1)} MB of ${limit.toLocaleString()} MB max`, tone: "ok" }];
    if (k === "video")
      list.push(
        media.aspect
          ? media.aspect === "9:16"
            ? { label: "Aspect", value: "9:16 vertical, used as is", tone: "ok" }
            : { label: "Aspect", value: `${media.aspect}, reframed to 9:16 with a smart crop`, tone: "warn" }
          : { label: "Aspect", value: "Reading the file", tone: "pending" },
      );
    list.push(
      media.durationMs == null
        ? { label: "Length", value: "Reading the file", tone: "pending" }
        : media.durationMs / 1000 > plan.maxDurationSec
          ? { label: "Length", value: `${fmtDuration(media.durationMs)}, trimmed to ${plan.maxDurationSec}s on ${plan.name}`, tone: "warn" }
          : media.durationMs < 10_000
            ? { label: "Length", value: `${fmtDuration(media.durationMs)}, very short; 20s or more works best`, tone: "warn" }
            : { label: "Length", value: `${fmtDuration(media.durationMs)}, within the ${plan.maxDurationSec}s limit`, tone: "ok" },
    );
    return list;
  }

  const blocker = outOfVideos
    ? "You’re out of videos this period."
    : kind !== "prompt" && active?.state.status === "idle"
      ? `Upload a ${kind === "video" ? "video" : "voice recording"} to continue.`
      : kind !== "prompt" && active?.state.status === "error"
        ? "The upload failed. Retry it to continue."
        : !uploadReady
          ? "Waiting for the upload to finish."
          : null;

  function submit() {
    setErrors({});
    if (idea && kind === "prompt" && !text.trim()) {
      // Deep-linked radar idea with no extra prompt: run the idea itself.
    } else if (kind === "prompt" && text.trim().length < 8) {
      setErrors({ text: "Describe the video in a sentence or two." });
      return;
    }
    if (!uploadReady) {
      toast.error("Wait for the upload to finish.");
      return;
    }
    const useIdea = !!idea && kind === "prompt" && !text.trim();
    startTransition(async () => {
      const res = await startVideo({
        channelId,
        kind: useIdea ? "idea" : kind,
        ideaId: idea?.id,
        text: kind === "prompt" ? text.trim() || undefined : notes.trim() || undefined,
        format: format === "auto" ? undefined : format,
        targetSec: kind === "video" && media.durationMs ? Math.min(plan.maxDurationSec, Math.max(20, Math.round(media.durationMs / 1000))) : seconds,
        quality,
        mediaUrl: kind === "prompt" ? undefined : (active?.state.publicUrl ?? undefined),
        mediaDurationMs: media.durationMs,
        mediaAspect: kind === "video" ? aspect : undefined,
        keepOriginalAudio: kind === "video" ? keepAudio : true,
        insertDensity: density,
        notes: notes.trim() || undefined,
      });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      toast.success("Video queued. You can follow every step here.");
      router.push(`/app/videos/${res.data.videoId}`);
    });
  }

  const formatSection = (
    <Section title="Format" description="Each format is a beat structure: hook, body beats, payoff and a loop back to the start.">
      <FormatPicker value={format} onChange={setFormat} seconds={kind === "prompt" ? seconds : undefined} />
    </Section>
  );

  const renderSection = (withDuration: boolean) => (
    <Section title="Render">
      <Grid cols={2} gap={6}>
        {withDuration && (
          <FormField
            label="Length"
            aside={<span className="tabular-nums">{seconds}s</span>}
            hint={plan.maxDurationSec < 90 ? `Up to ${plan.maxDurationSec}s on ${plan.name}. 60–90s cuts need Creator.` : "60s+ cuts qualify for TikTok’s Creator Rewards."}
          >
            <Slider min={30} max={90} step={5} value={[seconds]} onValueChange={([v]) => setSeconds(Math.min(v, plan.maxDurationSec))} aria-label="Length in seconds" />
          </FormField>
        )}
        <FormField label="Quality" hint={QUALITY_LABEL[quality].hint}>
          <Select value={quality} onValueChange={(v) => setQuality(v as Quality)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {qualities.map((q, i) => (
                <SelectItem key={q} value={q} disabled={i > maxQ}>
                  {QUALITY_LABEL[q].label}
                  {i > maxQ ? ` · ${QUALITY_LABEL[q].plan}+` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </Grid>
    </Section>
  );

  return (
    <Stack gap={7}>
      {idea && (
        <Card tone="accent">
          <CardHeader>
            <CardTitle>{idea.hook}</CardTitle>
            <CardDescription>
              From your idea queue: {idea.title}
              {idea.angle ? `. ${idea.angle}` : ""}
            </CardDescription>
          </CardHeader>
          <Inline gap={2} justify="between">
            <Inline gap={2}>
              <Badge variant="accent">
                <Lightbulb /> Radar idea
              </Badge>
              <FormatBadge format={idea.format} />
            </Inline>
            <Button asChild size="sm" variant="ghost">
              <Link href="/app/new">
                <X /> Start from scratch
              </Link>
            </Button>
          </Inline>
        </Card>
      )}

      <Tabs value={kind} onValueChange={(v) => setKind(v as Kind)}>
        <TabsList aria-label="How this video starts">
          <TabsTrigger value="prompt">
            <PenLine /> {idea ? "Idea" : "Describe it"}
          </TabsTrigger>
          <TabsTrigger value="video">
            <FileVideo /> Upload video
          </TabsTrigger>
          <TabsTrigger value="audio">
            <Mic /> Upload voice
          </TabsTrigger>
        </TabsList>

        <TabsContent value="prompt">
          <Stack gap={7}>
            <FormField
              label={idea ? "Extra direction" : "What’s the video about?"}
              required={!idea}
              error={errors.text}
              aside={<span className="tabular-nums">{text.length}/4000</span>}
              hint={idea ? "Optional. Anything to stress, cut or cite." : "A topic, a claim or a question. The scriptwriter researches it and writes the script in your channel’s voice."}
            >
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                maxLength={4000}
                placeholder={idea ? "Lean on the 2008 data point; keep it under 50 seconds." : "Explain why index funds beat most stock pickers over 15 years"}
              />
            </FormField>
            {formatSection}
            {renderSection(true)}
          </Stack>
        </TabsContent>

        <TabsContent value="video">
          <Stack gap={7}>
            <Section title="Your footage" description="A talking head or screen recording, any aspect. We cut silences, add captions and drop motion-graphic cut-ins where they help.">
              {videoUp.state.status === "idle" ? (
                <Dropzone
                  accept={["video/mp4", "video/quicktime", ".mov", ".mp4"]}
                  maxBytes={2_000_000_000}
                  icon={Upload}
                  title="Upload a video"
                  hint="MP4 or MOV, up to 2 GB"
                  onFile={(f) => pickFile(f, "video")}
                  onReject={(r) => toast.error(r)}
                />
              ) : (
                <Grid cols="aside" gap={6}>
                  <Stack gap={4}>
                    <UploadStatus state={videoUp.state} onRetry={() => videoUp.state.file && pickFile(videoUp.state.file, "video")} onClear={videoUp.reset} />
                    <Progress value={videoUp.state.status === "signing" ? null : videoUp.state.progress * 100} tone={videoUp.state.status === "error" ? "danger" : videoUp.state.status === "done" ? "success" : "accent"} size="sm" aria-label="Upload progress" />
                    {videoUp.state.status !== "error" && <FileChecks checks={checksFor("video")} />}
                    <Stack gap={4}>
                      <div className="flex items-start justify-between gap-6">
                        <Stack gap={1}>
                          <span className="type-small font-medium text-ink">Keep my original audio</span>
                          <span className="type-small text-muted">Your voice is the narration. Turn off to re-voice with the channel narrator.</span>
                        </Stack>
                        <Switch checked={keepAudio} onCheckedChange={setKeepAudio} aria-label="Keep original audio" />
                      </div>
                      <Grid cols={2}>
                        <FormField label="Source aspect" hint={media.aspect ? `Detected ${media.aspect}` : "Detected from the file"}>
                          <Select value={aspect} onValueChange={(v) => setAspect(v as Aspect)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="9:16">9:16 vertical</SelectItem>
                              <SelectItem value="4:5">4:5</SelectItem>
                              <SelectItem value="1:1">1:1 square</SelectItem>
                              <SelectItem value="16:9">16:9 landscape (smart crop)</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormField>
                        <FormField label="Cut-ins" hint={{ light: "A few key moments", medium: "Every major point", heavy: "Almost every sentence" }[density]}>
                          <Tabs value={density} onValueChange={(v) => setDensity(v as Density)}>
                            <TabsList variant="segmented" aria-label="Cut-in density" className="self-start">
                              <TabsTrigger value="light">Light</TabsTrigger>
                              <TabsTrigger value="medium">Medium</TabsTrigger>
                              <TabsTrigger value="heavy">Heavy</TabsTrigger>
                            </TabsList>
                          </Tabs>
                        </FormField>
                      </Grid>
                      <FormField label="Notes" aside="Optional" hint="Anything to cut, stress or visualise.">
                        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000} placeholder="Cut the intro before 0:08. Chart the numbers at 0:40." />
                      </FormField>
                    </Stack>
                  </Stack>
                  {previewUrl && (
                    <video
                      src={previewUrl}
                      controls
                      playsInline
                      className="aspect-[9/16] w-full rounded-[2px] border border-rule bg-paper object-contain"
                      onLoadedMetadata={(e) => {
                        const v = e.currentTarget;
                        const a = guessAspect(v.videoWidth || 9, v.videoHeight || 16);
                        setMedia({ durationMs: Math.round(v.duration * 1000), aspect: a });
                        setAspect(a);
                      }}
                    />
                  )}
                </Grid>
              )}
            </Section>
            {renderSection(false)}
          </Stack>
        </TabsContent>

        <TabsContent value="audio">
          <Stack gap={7}>
            <Section title="Your voice recording" description="We transcribe it, write beats over your words and build the visuals. Your recording is the narration; no TTS.">
              {audioUp.state.status === "idle" ? (
                <Dropzone
                  accept={["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/wav", "audio/x-wav", ".mp3", ".m4a", ".wav"]}
                  maxBytes={200_000_000}
                  icon={AudioLines}
                  title="Upload a voice recording"
                  hint="MP3, M4A or WAV, up to 200 MB"
                  onFile={(f) => pickFile(f, "audio")}
                  onReject={(r) => toast.error(r)}
                />
              ) : (
                <Card>
                  <UploadStatus state={audioUp.state} onRetry={() => audioUp.state.file && pickFile(audioUp.state.file, "audio")} onClear={audioUp.reset} />
                  <Waveform seed={audioUp.state.file?.name ?? "voice"} progress={audioUp.state.status === "signing" ? 0 : audioUp.state.progress} />
                  {previewUrl && (
                    <audio
                      src={previewUrl}
                      controls
                      className="w-full"
                      onLoadedMetadata={(e) => setMedia({ durationMs: Math.round(e.currentTarget.duration * 1000) })}
                    />
                  )}
                  {audioUp.state.status !== "error" && <FileChecks checks={checksFor("audio")} />}
                </Card>
              )}
              <FormField label="Notes" aside="Optional" hint="Visual direction: charts, maps, things to show on screen.">
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000} placeholder="Show the inflation chart when I mention 1970s prices." />
              </FormField>
            </Section>
            {formatSection}
            {renderSection(false)}
          </Stack>
        </TabsContent>
      </Tabs>

      <Section title="What happens next">
        <ol className="grid grid-cols-1 border-y border-rule sm:grid-cols-3">
          {NEXT_STEPS.map(([title, body], i) => (
            <li key={title} className="flex flex-col gap-1 border-rule py-4 max-sm:not-first:border-t sm:px-5 sm:first:pl-0 sm:not-first:border-l">
              <span className="mono-tick tabular-nums">
                {String(i + 1).padStart(2, "0")} · {title}
              </span>
              <span className="type-small text-muted">{body}</span>
            </li>
          ))}
        </ol>
      </Section>

      <footer className="flex flex-col gap-3 border-t border-rule pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="type-small text-muted" aria-live="polite">
          {outOfVideos ? (
            <>
              You’re out of videos this period.{" "}
              <Link href="/app/settings/billing" className="text-ink underline decoration-rule-strong underline-offset-4 hover:decoration-ink">
                See plans
              </Link>
            </>
          ) : blocker ? (
            blocker
          ) : (
            <>
              Uses 1 video. <span className="tabular-nums text-ink">{videosRemaining}</span> left this period on {plan.name}.
            </>
          )}
        </p>
        <Button size="lg" onClick={submit} loading={pending} disabled={!!blocker} className="max-sm:w-full">
          Make video
        </Button>
      </footer>
    </Stack>
  );
}
