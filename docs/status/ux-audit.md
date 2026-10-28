# UX audit and polish pass (apps/web)

Date: 2026-10-28. Branch: `pivot/faceless`. Scope: all of `apps/web`. The v1 editorial dark theme is unchanged. This pass made the existing system consistent and fixed flow gaps.

## Method
- Dev server with `DEV_BYPASS_AUTH=1 DEV_BYPASS_PLAN=CREATOR`, then again with `DEV_BYPASS_EMPTY=1`. Session cookie minted with `next-auth/jwt` `encode`.
- A Puppeteer script screenshots every route at 1440×900 and 375×812, including tab states, the publish drawer with TikTok selected, the series dialog, onboarding steps 1–7, empty states and not-found. For each shot it records horizontal scroll, the number of h1 elements and console errors.
- Before shots: `/private/tmp/claude-501/-Users-aslam-tempy-remawt/67efe01d-a7e2-4a9b-9785-0ad60e586125/scratchpad/qa/before/`
- After shots: `/private/tmp/claude-501/-Users-aslam-tempy-remawt/67efe01d-a7e2-4a9b-9785-0ad60e586125/scratchpad/qa/after/`. `report-full.json` and `report-empty.json` hold the per-shot metrics.
- Script: `/private/tmp/claude-501/-Users-aslam-tempy-remawt/67efe01d-a7e2-4a9b-9785-0ad60e586125/scratchpad/shot.mjs`
- Final run: no horizontal scroll at either width, exactly one h1 on every page, and no console errors. One hydration warning showed up once on `/app/schedule` during a cold compile and did not come back on a re-run.

## Checks applied to every page
- Spacing comes from the DESIGN.md scale only.
- Left edges line up, and numbers use tabular figures.
- One h1 per page, and PageHeader and type-* utilities are used consistently.
- Control heights match across pages.
- Accent is used only for primary actions and active states.
- Every interactive element has focus-visible, hover and disabled states.
- Touch targets are at least 40px on mobile, with no horizontal scroll.
- Skeletons are sized like the content they replace.
- Copy: sentence case, one verb set throughout, and empty states each offer one clear action.
- Every action shows a toast on success and on failure, the reason for a disabled control is visible, and Esc closes dialogs and sheets.
- Motion uses the DESIGN.md tokens.
- Responsive layout: drawer navigation on mobile, full-screen dialogs.

## Pages × issues × fixed

| Page | Issue found | Fixed |
|---|---|---|
| All app pages (Tabs primitive) | The active underline on page tabs was invisible: the scroll container clipped the `-mb-px` border. Affected video detail, new video, schedule and channel settings. | Yes. The rule is now an inset shadow and the underline an `::after`. |
| Billing, pricing, new video (segmented tabs) | The segmented switcher stretched to full width. | Yes. `w-fit self-start`. |
| All app pages (Section primitive) | A section header without an action sat 8px lower than one with an action. Radar "Trend cards" was misaligned with "Format share". | Yes. `min-h-8` now applies only when there is an action. |
| Billing, channel settings (nav) | `/app/settings/billing` highlighted "Channel settings". `/app/channels/[id]/settings` highlighted nothing. | Yes. `NavItem.also` / `exclude`. Billing added to the footer nav. |
| Home | Two identical accent "New video" buttons (topbar and header). With no channel, a dead-end page of zero stats. | Yes. The header duplicate was removed. A user with no channel is redirected to `/onboarding`, so the path is sign-in → `/app` → onboarding. |
| New video | The topbar "New video" showed on the new-video page itself. | Yes. Hidden on `/app/new`. |
| New video | Format cards cut off beat labels ("AXES … BUILD 20S TAKEAWA…"). | Yes. The bar has no labels now; a mono "N beats · 45s" line replaces them; Auto is tagged "Default". |
| New video | No file checks before submit. | Yes. After upload, a checks list shows size against the limit, aspect (9:16 is used as is; other aspects are reframed with a warning) and length against the plan limit (trim warning, too-short warning). |
| New video | No "what happens next". | Yes. Three ruled steps: Script → Render → Review. |
| New video | "Make video" was disabled with no reason, and out-of-quota only showed "Upgrade". | Yes. The footer shows the blocker ("Upload a video to continue", "Waiting for the upload to finish", "The upload failed…", out of videos + "See plans" link). The quota line now reads "Uses 1 video. N left this period on Plan." |
| Video detail | The progress list for a finished run filled the aside. Elapsed times read `1M 00S`. There was no current-activity line and no total time. | Yes. Elapsed times use `m:ss`, with the total time in the header. A live run shows "Step · message", or "Next: …". A finished run collapses to "Show steps". A failed run shows "Stopped at <step>: <message>". |
| Video detail | Failure offered only "Start again" (back to the form). | Yes. A new `RetryVideoButton` re-runs the video with the same inputs, plus "Change inputs". |
| Video detail | Progress sat below the 9:16 preview even while rendering. The preview was very tall on phones (full width 9:16). | Yes. Progress moves above the preview while the video is busy. The preview is capped at 240/280px below lg. |
| Video detail, scenes | No unsaved indicator. The toast said progress was "on the left" (it is on the right). | Yes. "Unsaved changes" warning badge, a `beforeunload` guard, the button reads "Save and re-render" while there are unsaved edits, and the toast states how many free re-renders are left. |
| Publish drawer | The whole sheet scrolled, so the confirm button went off-screen. | Yes, at the primitive level. Sheet header and footer are fixed; only `SheetBody` scrolls. |
| Publish drawer | The schedule defaulted to now + 30 minutes. There was no summary before confirm. The disabled Schedule button gave no reason; validation only came as toasts. | Yes. The default is the next 18:00 slot (`nextSlot` in `lib/queries/tz.ts`, same as the series default). The footer shows a summary ("1 post · TikTok · Oct 28, 6:00 PM London") and the first blocker ("Choose who can view the TikTok post."), or "Ready to go." The button reads "Schedule" / "Schedule N posts". |
| Publish drawer, TikTok block | The consent label split into columns (flex label). Checkboxes were misaligned with two-line labels. | Yes. All TikTok audit items are kept (privacy with no default, toggles, disclosure, consent, AI label, delay notice). |
| Onboarding | The marketing navbar (Product/Formats/Pricing/Open app) distracted from the flow, and its logo was misaligned with the 1200 column. | Yes. `PageShell focused`: no nav links, no Open app, logo aligned to the app column, and a skeleton sized like the avatar. |
| Onboarding | Continue sat ~1600px below on the niche step. Audience and promise were required and blank. There was no way to skip optional steps. The name was blank on review. | Yes. Sticky footer. Audience and promise are prefilled from the niche examples when leaving the niche step. "Skip, use defaults" appears on Look/Voice/Persona/Mascot. The channel name is prefilled ("Personal Explained" style). Progress, Back, sessionStorage persistence and the poster preview were already in place. |
| Series dialog (mobile) | Dialog content clipped. Day pills were 32px tall. | Yes. md/lg dialogs go full screen below sm. Day pills are `h-10` on mobile. |
| All (touch) | sm Buttons, sm IconButtons, checkboxes and switches were under 40px. | Yes. Invisible 40px hit areas on coarse pointers; the visual sizes did not change. |
| Billing | The subscription badge was yellow "active" when no subscription record existed. "Downgrade in the billing portal" overflowed its button. | Yes. Success tone; label is now "Downgrade in portal". |
| Pricing | No h1 (the hero used MarketingSection's h2). | Yes. `titleAs="h1"`. |
| Not-found, route errors | No h1. | Yes. `titleAs="h1"` on whole-page Empty/Error states. |
| Cookie banner (all pages) | Used deleted legacy classes (`btn-ghost`, `btn-accent`): unstyled text buttons and an 1100px banner covering the app. | Yes. Rebuilt with `Button` primitives, compact 720px banner, `useSyncExternalStore` (no hydration flash). |
| Sidebar (no channel) | "PICK A NICHE TO STA…" truncated. | Yes. "About 3 minutes". |
| Lint (whole app) | 6 errors (setState in effect, impure render) in typewriter, cookie banner, app shell, progress timeline and publish drawer; 1 warning in r2.ts. | Yes. ESLint is clean. |

## Remaining known issues
- Legal pages (privacy, terms, refund, cookies, contact) still use the old inline markup inside the new Navbar/Footer. They render fine, but they do not use `Container width="prose"`.
- The logo SVG has internal whitespace, so the sidebar wordmark looks small. A tightly cropped wordmark asset is needed.
- On app pages the cookie banner covers the sidebar usage meter until the user dismisses it.
- The topbar still shows "New" when the user has no channel. It leads to the no-channel empty state, which has the "Create a channel" CTA.
- Radar shows "Refresh" in both the header and the empty state. This is acceptable but redundant.
- Not verified against real services:
  - real uploads (R2), so the file checks were only checked by reading the code;
  - the retry action, because bypass mode is read-only;
  - live progress polling.
- The first click on a tab can show the focus ring in automated Chrome. This is Chrome's heuristic for the first interaction; once there has been a pointer interaction, the ring does not show.

## Verification
- `pnpm --filter @remawt/web typecheck`: pass.
- `pnpm --filter @remawt/web lint`: 0 problems.
- `pnpm --filter @remawt/web build`: pass.
- DESIGN.md: new §7 preamble with the structural rules, and new props for `PageShell focused`, `MarketingSection titleAs` and `EmptyState`/`ErrorState titleAs`.
