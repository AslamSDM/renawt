import Link from "next/link";
import { Lock } from "lucide-react";
import { EmptyState } from "@/components/layout";
import { Button } from "@/components/ui";
import { OnboardingWizard } from "@/components/app/onboarding/wizard";
import { FALLBACK_VOICES, type VoiceOption } from "@/components/app/kit/defaults";
import { engine } from "@/lib/engine";
import { loadEntitlements } from "@/lib/queries/billing";
import { getViewer } from "@/lib/queries/viewer";

export default async function OnboardingPage() {
  const viewer = await getViewer("/onboarding");
  const [ent, voicesRes] = await Promise.all([loadEntitlements(viewer), engine.voices(viewer.userId)]);

  if (ent.channelsUsed >= ent.channelsAllowed) {
    return (
      <EmptyState
        icon={Lock}
        title={`Your ${ent.plan.name} plan includes ${ent.channelsAllowed} channel${ent.channelsAllowed === 1 ? "" : "s"}`}
        description="Upgrade to run another channel with its own niche, look and voice. Your existing channel stays as it is."
        action={
          <>
            <Button asChild>
              <Link href="/app/settings/billing">Compare plans</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/app">Back to app</Link>
            </Button>
          </>
        }
      />
    );
  }

  const live = voicesRes.ok && Array.isArray(voicesRes.data) && voicesRes.data.length > 0;
  const voices: VoiceOption[] = live
    ? voicesRes.data.map((v) => ({ voiceId: v.voiceId, name: v.name, provider: v.provider, previewUrl: v.previewUrl, tags: v.tags }))
    : FALLBACK_VOICES;

  return <OnboardingWizard voices={voices} voicesLive={live} />;
}
