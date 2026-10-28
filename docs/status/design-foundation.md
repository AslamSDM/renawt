# Status: design-foundation

## What exists
- `docs/DESIGN.md`: the design contract. It covers tokens, the type scale (`type-*` utilities), the 4px spacing scale (space-1..12), the only allowed paddings and gaps, fixed dimensions, alignment rules, the component inventory with props, states, empty/loading/error patterns, motion rules and an app page template.
- `apps/web/app/globals.css`: the v1 editorial dark theme is kept. Added tokens for status colors, motion and layout sizes. Added `type-*` utilities, the tw-animate-css import, a reduced-motion policy, themed scrollbars, selection, caret and sonner, and the landing scene keyframes. Removed the legacy pill/glow button classes.
- `apps/web/components/ui/*` (lowercase file names; `Button.tsx` and `Card.tsx` renamed with `git mv`): button + IconButton, card set, badge, input, textarea, select, switch, checkbox, radio-group (+RadioCard), slider, tabs, dialog, sheet, dropdown-menu, tooltip, progress, skeleton, separator, spinner, avatar, table, kbd, toast (Toaster + toast), label, form-field. All are exported from `index.ts`.
- `apps/web/components/layout/*`: Container, PageShell, AppShell (+AppShellData bridge), PageHeader, Section, MarketingSection, Stack, Inline, Grid presets, Toolbar, EmptyState/ErrorState/LoadingState, StatTile, KeyValueList, app-store (zustand; activeChannelId persisted), nav config (APP_NAV/APP_ROUTES under `/app`), spacing map.
- `apps/web/app/(app)/layout.tsx` wraps the app routes in AppShell. It renders with no data: the channel switcher shows "Create a channel" and the usage meter shows the plan quota.
- `apps/web/app/layout.tsx`: new metadata, OG and JSON-LD. Uses the token-styled Toaster.
- `apps/web/components/Navbar.tsx` + `Footer.tsx`: rebuilt. Signed in, the navbar shows "Open app" (→ /app) and the account dropdown.
- `apps/web/app/page.tsx` + `app/_landing/*` (fonts, scenes, typewriter, hero CTA): the new landing page. Sections: hero (typewriter + 9:16 Paper-skin scene + render log), How it works, Formats (6 CSS mocks, one per skin), Identity Kit (6 SKIN_PRESETS), Niche Radar, Monetization-safe, Pricing teaser (PLANS), FAQ, final CTA.
- `apps/web/app/signin/page.tsx`: restyled with the new primitives. The default callback is now `/app`.

## Verified
- `pnpm --filter @remawt/web typecheck` passes (whole project).
- `pnpm --filter @remawt/web build` passes. All 15 routes were generated.
- Playwright screenshots at 1440 and 375 of `/`, `/signin` and a temporary AppShell preview page (now deleted). No horizontal scroll at 375. No console errors.
- The Impeccable detector is clean after one fix (the underline animation now uses transform).

## Open items / notes for other agents
- App URLs are assumed to be `/app/*` (see `components/layout/nav.ts`). The web-app agent should create pages at `app/(app)/app/...` or change the hrefs in `nav.ts`.
- `middleware.ts` matcher still guards `/projects`, `/creative` and `/profile`. db-billing should add `/app/:path*` and `/onboarding/:path*`.
- The web-app agent wires real data with `<AppShellData channels plan usage />` from a server component.
- `/pricing`, `/onboarding` and `/app/*` pages don't exist yet (web-app owns them). Landing and nav links point to them.
- Legal pages (privacy, terms, refund, cookies, contact) still use their old inline markup inside the new Navbar/Footer. design-qa could move them to `PageShell` + `Container width="prose"`.
- The logo SVG has a lot of internal whitespace, so it is rendered taller (h-8 to h-10) to read at the right size. A tightly cropped wordmark asset would be better.
