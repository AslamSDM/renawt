import { notFound } from "next/navigation";
import Link from "next/link";
import { Download, ShieldCheck } from "lucide-react";
import { PIPELINE_STEPS } from "@remawt/shared";
import { EmptyState, Grid, Inline, KeyValueList, PageHeader, Section, Stack } from "@/components/layout";
import { Badge, Button, Card, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui";
import { FormatBadge, PlatformBadge, PublicationStatusBadge } from "@/components/app/badges";
import { ProgressTimeline } from "@/components/app/video/progress-timeline";
import { PublishSheet } from "@/components/app/video/publish-sheet";
import { RetryVideoButton } from "@/components/app/video/retry-button";
import { SceneEditor } from "@/components/app/video/scene-editor";
import { TranscriptPanel } from "@/components/app/video/transcript-panel";
import { ScriptView } from "@/components/app/video/script-view";
import { loadVideoDetail } from "@/lib/queries/video-detail";
import { loadEntitlements } from "@/lib/queries/billing";
import { formatDateTime, formatSeconds, formatUsd, relativeTime } from "@/lib/queries/format";
import { ACTIVE_STATUSES } from "@/lib/queries/home";
import { parseCost, parseCuts, parseKit, parseOriginality, parseProgress, parseQc, parseScenePlan, parseScript, readTranscript, readVideoSource } from "@/lib/queries/shapes";
import { getViewer } from "@/lib/queries/viewer";
import { cn } from "@/lib/utils";

export const metadata = { title: "Video" };

const SOURCE_LABEL = { idea: "Radar idea", prompt: "Prompt", video: "Your footage", audio: "Your voice" } as const;

export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer(`/app/videos/${id}`);
  const video = await loadVideoDetail(viewer, id);
  if (!video) notFound();
  const ent = await loadEntitlements(viewer);

  const events = parseProgress(video.progress);
  const source = readVideoSource(video);
  const script = parseScript(video.script);
  const plan = parseScenePlan(video.scenes);
  const qc = parseQc(video.qc);
  const originality = parseOriginality(video.originality);
  const cost = parseCost(video.cost);
  const cuts = parseCuts(video.cuts);
  const transcript = source && (source.kind === "video" || source.kind === "audio") ? readTranscript(video.transcript) : null;
  const palette = parseKit(video.kitSnapshot ?? video.channel.kit)?.skin.palette;
  const assets = Array.isArray(video.assets)
    ? video.assets.flatMap((a) =>
        a && typeof a === "object" && !Array.isArray(a) && typeof a.id === "string" && typeof a.url === "string"
          ? [{ id: a.id, kind: typeof a.kind === "string" ? a.kind : "image", url: a.url, prompt: typeof a.prompt === "string" ? a.prompt : undefined }]
          : [],
      )
    : [];

  const busy = (ACTIVE_STATUSES as readonly string[]).includes(video.status);
  const ready = video.status === "READY" || video.status === "PUBLISHED";
  const isMedia = source?.kind === "video" || source?.kind === "audio";
  const expected = PIPELINE_STEPS.filter((s) => {
    if (s === "ingest") return source?.kind === "video";
    if (s === "transcribe") return isMedia;
    if (s === "ideate") return source?.kind === "prompt";
    if (s === "voice") return source?.kind !== "audio" && !(source?.kind === "video" && source.keepOriginalAudio);
    return true;
  });
  const rerendersLeft = Math.max(0, ent.plan.rerendersPerVideo - video.rerenders);
  const aiDefault = qc?.labels ? !!(qc.labels.aigc ?? qc.labels.syntheticMedia ?? true) : true;
  const criticNotes = Array.isArray(qc?.criticNotes) ? qc.criticNotes : qc?.criticNotes ? [qc.criticNotes] : [];

  const progressSection = (
    <Section title="Progress">
      <ProgressTimeline videoId={video.id} initialStatus={video.status} initialEvents={events} expectedSteps={[...expected]} />
    </Section>
  );

  return (
    <>
      <PageHeader
        back={{ href: "/app/videos", label: "Videos" }}
        title={video.title}
        meta={
          <>
            <FormatBadge format={video.format} />
            {source && <Badge variant="neutral">{SOURCE_LABEL[source.kind]}</Badge>}
            <span className="mono-tick tabular-nums">
              {formatSeconds(video.targetSec)} · {relativeTime(video.createdAt)}
            </span>
          </>
        }
        actions={
          <>
            {video.masterUrl && (
              <Button asChild variant="outline">
                <a href={video.masterUrl} download>
                  <Download /> Download
                </a>
              </Button>
            )}
            <PublishSheet
              videoId={video.id}
              ready={ready}
              canPublish={ent.canPublish}
              timezone={video.channel.timezone}
              aiLabelDefault={aiDefault}
              accounts={video.channel.socialAccounts.map((a) => ({ id: a.id, platform: a.platform, handle: a.handle, avatarUrl: a.avatarUrl }))}
              defaults={{ title: script?.title ?? video.title, caption: script?.description || script?.hook || "", hashtags: script?.hashtags ?? [] }}
            />
          </>
        }
      />

      {video.status === "FAILED" && (
        <Card tone="outline" className="border-danger/40 bg-danger-soft/40" role="alert">
          <p className="type-subheading text-ink">This video failed</p>
          <p className="type-small text-muted">{video.error ?? "The engine stopped before the render finished."} Your video credit was returned if nothing was rendered.</p>
          <Inline gap={2}>
            <RetryVideoButton channelId={video.channelId} source={source} ideaId={video.idea?.id ?? null} format={video.format} targetSec={video.targetSec} />
            <Button asChild size="sm" variant="outline">
              <Link href={video.idea ? `/app/new?ideaId=${video.idea.id}` : "/app/new"}>Change inputs</Link>
            </Button>
          </Inline>
        </Card>
      )}

      <Grid cols="aside" gap={8}>
        <Stack gap={7} className="min-w-0 lg:order-2">
          {busy && progressSection}
          <Section title="Preview">
            <div
              className="phone-frame w-full max-w-[240px] self-center sm:max-w-[280px] lg:max-w-none lg:self-stretch"
              style={!video.masterUrl && !video.thumbnailUrl && palette ? { background: palette.bg } : undefined}
            >
              {video.masterUrl ? (
                <video src={video.masterUrl} poster={video.thumbnailUrl ?? undefined} controls playsInline className="absolute inset-0 size-full object-cover" />
              ) : video.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={video.thumbnailUrl} alt="" className="absolute inset-0 size-full object-cover" />
              ) : (
                <div className="absolute inset-0 grid place-items-center">
                  <span className="mono-tick" style={{ color: palette?.ink }}>
                    {busy ? "Rendering" : "No render yet"}
                  </span>
                </div>
              )}
            </div>
            {Object.keys(cuts).length > 0 && (
              <Inline gap={2}>
                {Object.entries(cuts).map(([k, c]) => (
                  <Button key={k} asChild size="sm" variant="ghost">
                    <a href={c.url} download>
                      <Download /> {k} cut{c.sec ? ` · ${Math.round(c.sec)}s` : ""}
                    </a>
                  </Button>
                ))}
              </Inline>
            )}
          </Section>
          {!busy && progressSection}
        </Stack>

        <Stack gap={8} className="min-w-0 lg:order-1">
          <Tabs defaultValue={transcript || isMedia ? "transcript" : "scenes"}>
            <TabsList aria-label="Edit video">
              {isMedia && <TabsTrigger value="transcript">Transcript</TabsTrigger>}
              <TabsTrigger value="scenes">Scenes</TabsTrigger>
              <TabsTrigger value="script">Script</TabsTrigger>
              <TabsTrigger value="checks">Checks</TabsTrigger>
            </TabsList>
            {isMedia && (
              <TabsContent value="transcript">
                <TranscriptPanel videoId={video.id} transcript={transcript} />
              </TabsContent>
            )}
            <TabsContent value="scenes">
              <SceneEditor videoId={video.id} plan={plan} assets={assets} rerendersLeft={rerendersLeft} rerendersTotal={ent.plan.rerendersPerVideo} busy={busy} />
            </TabsContent>
            <TabsContent value="script">
              {script ? (
                <ScriptView script={script} />
              ) : (
                <EmptyState size="compact" title="The script appears after the scripting step" description="Hook, beats, on-screen text and sources, all editable through the scenes tab once planned." />
              )}
            </TabsContent>
            <TabsContent value="checks">
              <Grid cols={2}>
                <Card>
                  <p className="mono-tick">Originality</p>
                  {originality ? (
                    <>
                      <p className={cn("type-stat", originality.score >= 0.7 ? "text-success" : originality.score >= 0.5 ? "text-warning" : "text-danger")}>
                        {Math.round(originality.score * 100)}
                      </p>
                      <p className="type-small text-muted">Distance from your last 30 uploads and the trend exemplars. Under 50 is sent back for a new structure.</p>
                      {(originality.flags ?? []).length > 0 && (
                        <Inline gap={2}>
                          {(originality.flags ?? []).map((f) => (
                            <Badge key={f} variant="warning">
                              {f}
                            </Badge>
                          ))}
                        </Inline>
                      )}
                    </>
                  ) : (
                    <p className="type-small text-muted">Scored after render.</p>
                  )}
                </Card>
                <Card>
                  <p className="mono-tick">Quality check</p>
                  {qc ? (
                    <Stack gap={3}>
                      <Inline gap={2}>
                        <Badge variant={qc.lintPassed === false ? "danger" : "success"}>
                          <ShieldCheck /> Lint {qc.lintPassed === false ? "failed" : "passed"}
                        </Badge>
                        <Badge variant={aiDefault ? "accent" : "neutral"}>AI label {aiDefault ? "on" : "off"}</Badge>
                      </Inline>
                      {criticNotes.length > 0 && (
                        <ul className="flex flex-col gap-1">
                          {criticNotes.map((n, i) => (
                            <li key={i} className="type-small text-muted">
                              {n}
                            </li>
                          ))}
                        </ul>
                      )}
                    </Stack>
                  ) : (
                    <p className="type-small text-muted">Runs after render.</p>
                  )}
                </Card>
              </Grid>
            </TabsContent>
          </Tabs>

          <Section title="Posts" description="Where this video is scheduled or live.">
            {video.publications.length === 0 ? (
              <EmptyState size="compact" title="Not posted yet" description={ready ? "Use Publish to post now or schedule it." : "Publish unlocks when the render is ready."} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead numeric>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {video.publications.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Inline gap={2} wrap={false}>
                          <PlatformBadge platform={p.platform} />
                          {p.externalUrl ? (
                            <a href={p.externalUrl} target="_blank" rel="noreferrer noopener" className="hidden truncate underline decoration-rule-strong underline-offset-4 hover:decoration-ink sm:inline">
                              {p.socialAccount.handle ?? "View post"}
                            </a>
                          ) : (
                            <span className="hidden truncate text-muted sm:inline">{p.socialAccount.handle ?? "–"}</span>
                          )}
                        </Inline>
                      </TableCell>
                      <TableCell>
                        <PublicationStatusBadge status={p.status} />
                      </TableCell>
                      <TableCell numeric className="whitespace-nowrap text-muted">
                        {formatDateTime(p.publishedAt ?? p.scheduledAt, video.channel.timezone)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Section>

          {cost && (
            <Section title="Cost">
              <Card>
                <KeyValueList
                  items={[
                    { label: "Language models", value: formatUsd(cost.llmUsd, 3), numeric: true },
                    { label: "Voice", value: formatUsd(cost.ttsUsd, 3), numeric: true },
                    { label: "Images and clips", value: formatUsd(cost.imagesUsd, 3), numeric: true },
                    { label: "Render", value: formatUsd(cost.renderUsd, 3), numeric: true },
                    { label: "Total", value: <span className="font-medium">{formatUsd(cost.totalUsd, 3)}</span>, numeric: true },
                  ]}
                />
              </Card>
            </Section>
          )}
        </Stack>
      </Grid>
    </>
  );
}
