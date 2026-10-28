# remawt v2 — Design Contract

Every page in `apps/web` follows this file. If you need something this file does not cover, add it here (token in `app/globals.css`, preset in a layout primitive) instead of writing a one-off value in a page.

**World:** editorial dark. Near-black surfaces, off-white ink, one blue accent, hairline rules, 2px corners, Inter for UI, JetBrains Mono for data and measurements, EB Garamond italic for one emphasis per heading. The landing page and the app use the same tokens and primitives.

**Modes:** marketing pages persuade (bigger type, generous rhythm, one authored motion moment). App pages operate (dense, scannable, consistent; brand lives in details).

---

## 1. Color tokens

Defined in `apps/web/app/globals.css` `:root`, exposed to Tailwind via `@theme inline`. Use the Tailwind names. Never write hex in a component (exception: rendering a user's own kit palette).

| Token | Tailwind | Value | Use |
|---|---|---|---|
| surface | `bg-surface` | #07070a | page background |
| paper | `bg-paper` | #0c0c0e | cards, sidebar, popovers, inputs |
| paper-2 | `bg-paper-2` | #14141a | hover rows, wash sections, wells |
| paper-3 | `bg-paper-3` | #1c1c22 | active nav item, selected wells, skeleton highlight |
| ink | `text-ink` | #f5f5f7 | primary text |
| ink-inverse | `text-ink-inverse` | #07070a | text on accent / ink fills |
| muted | `text-muted` | ink @ 62% | secondary text (~8:1) |
| subtle | `text-subtle` | ink @ 46% | placeholders, tertiary, icon default (~4.9:1) |
| rule | `border-rule` / `bg-rule` | ink @ 10% | default hairline |
| rule-strong | `border-rule-strong` | ink @ 22% | inputs, popovers, emphasized dividers |
| accent | `bg-accent` `text-accent` | #3b82f6 | primary action, active state, focus ring |
| accent-hover | `bg-accent-hover` | #5b97f8 | primary hover |
| accent-soft | `bg-accent-soft` | accent @ 14% | selected background |
| accent-line | `border-accent-line` | accent @ 42% | selected border |
| success / -soft | `text-success` `bg-success-soft` | #3ccf8e | ready, posted, positive delta |
| warning / -soft | `text-warning` `bg-warning-soft` | #f2b544 | rendering, quota ≥80%, risk flags |
| danger / -soft | `text-danger` `bg-danger-soft` | #f2555a | failed, destructive, errors, negative delta |

Rules:
- One accent per view region. Do not color headings with accent except a single word in marketing display type.
- Status color always comes with a word (Badge text, label). Color alone never carries meaning.
- Selection, caret, scrollbars and focus ring are already themed globally. Do not override.

## 2. Type scale

Use the `type-*` utilities (defined with `@utility` in globals.css). Do not combine them with `text-[size]`, `leading-*` or `tracking-*`.

| Utility | Size / line-height | Tracking | Weight | Use |
|---|---|---|---|---|
| `type-display-xl` | clamp(40px, 7vw, 88px) / 0.98 | -0.035em | 500 | landing hero, final CTA |
| `type-display` | clamp(32px, 4.6vw, 60px) / 1.04 | -0.03em | 500 | marketing section titles, big prices |
| `type-title` | 28 / 34 | -0.02em | 500 | app page title (PageHeader only) |
| `type-heading` | 18 / 24 | -0.01em | 500 | app Section title, dialog title, FAQ question |
| `type-subheading` | 15 / 20 | -0.005em | 500 | card title, empty-state title |
| `type-body-lg` | 17 / 28 | -0.005em | 400 | marketing lead paragraphs |
| `type-body` | 14 / 22 | 0 | 400 | app default text, inputs, table cells |
| `type-small` | 13 / 20 | 0 | 400 | descriptions, nav items, labels |
| `type-caption` | 12 / 16 | 0 | 400 | hints, errors, meta |
| `type-stat` | 28 / 32 | -0.02em | 500, tabular | StatTile values, big numbers |
| `.mono-label` | 11 / 16 mono caps | 0.14em | 400 | small ink caps label (log step, value tag) |
| `.mono-tick` | 10 / 14 mono caps | 0.18em | 400 | table heads, StatTile label, measurements |
| `.font-serif-italic` | inherits size | -0.01em | 400 | one emphasized phrase in a display/hero heading |

Rules:
- Mono is for data, measurements, timestamps, table heads and stat labels. Not decoration.
- No eyebrow/kicker labels above headings. The heading carries itself.
- Body text measure: `max-w-[64ch]` in app, `max-w-[52ch]`–`[54ch]` for marketing leads.
- All numbers that change or align (counts, money, durations, views) use `tabular-nums`. `type-stat`, `TableCell numeric`, `KeyValueList numeric`, `Input` already do.

## 3. Spacing scale (4px base)

Primitives take step names. Raw Tailwind equivalents are listed so you can read code.

| Step | px | Tailwind | Typical use |
|---|---|---|---|
| space-1 | 4 | `1` | icon ↔ tight text |
| space-2 | 8 | `2` | button groups, badge rows, inline default |
| space-3 | 12 | `3` | toolbar gap, nav icon ↔ label |
| space-4 | 16 | `4` | Stack default, Grid default, card part gap, Section body |
| space-5 | 20 | `5` | card padding (dense) |
| space-6 | 24 | `6` | card padding (comfortable), dialog padding, PageHeader inner |
| space-7 | 32 | `8` | app page section rhythm |
| space-8 | 40 | `10` | app content top padding on lg |
| space-9 | 48 | `12` | marketing header → body (mobile) |
| space-10 | 64 | `16` | marketing header → body (md+), nav offset |
| space-11 | 80 | `20` | marketing section padding (mobile) |
| space-12 | 128 | `32` | marketing section padding (md+) |

`<Stack gap={7}>` = 32px. `<Inline gap={2}>` = 8px. The map lives in `components/layout/spacing.ts`.

### The only allowed paddings and gaps

| Context | Value | Where it is applied |
|---|---|---|
| Page gutters | `px-4 sm:px-6 lg:px-8` | `Container`, AppShell content, topbar, Navbar |
| Marketing container | `max-w-[1400px]` | `Container width="marketing"` (default) |
| App container | `max-w-[1200px]` | AppShell content column |
| Prose container | `max-w-[720px]` | `Container width="prose"` (legal pages, long text) |
| Marketing section rhythm | `py-20 md:py-32` + `border-t border-rule` | `MarketingSection` |
| Marketing header → body | `mt-12 md:mt-16` | `MarketingSection` |
| App page content | `py-8 lg:py-10`, children `gap-8` | AppShell |
| App section body | `gap-4` | `Section` |
| Card padding | `p-5` (dense, default) or `p-6` (`padding="md"`) | `Card` |
| Card internal gap | `gap-4` | `Card` |
| Dialog padding / gap | `p-6`, `gap-6` | `DialogContent` |
| Sheet header/body/footer | `p-5` | `SheetHeader/Body/Footer` |
| Form fields stack | `gap-4` between fields, `gap-1.5` label↔control↔hint | `FormField`, wrap fields in `<Stack gap={4}>` |
| Toolbar | `gap-3`, groups `gap-2`, `min-h-10` | `Toolbar` |
| Empty state | `py-16` page / `py-10` compact, `px-6` | `EmptyState` |

Pages must not write `p-*`, `px-*`, `py-*`, `m*-*` or `gap-*` by hand. Compose `Container`, `MarketingSection`, `PageHeader`, `Section`, `Stack`, `Inline`, `Grid`, `Card`, `Toolbar`. Exception: content-specific internals of a bespoke visual (a phone mock, a chart), which still use scale values only.

## 4. Fixed dimensions

| Thing | Size |
|---|---|
| Marketing navbar | 64px (`h-16`), fixed, blur on scroll, hairline bottom |
| App sidebar | 240px (`--sidebar-w`), fixed at lg+, Sheet drawer below lg |
| App topbar | 56px (`h-14`), sticky, glass blur, hairline bottom |
| Sidebar header row | 56px, aligned with the topbar rule |
| Nav item | `h-9` (36px), icon 16px, gap 12px |
| Button | sm `h-8` / md `h-10` (default) / lg `h-12` |
| IconButton | sm 32 / md 40 / lg 48 square |
| Input, Select trigger | `h-10` (md, default), `h-8` (sm, toolbars only) |
| Textarea | min `h-20`, `py-2.5 px-3` |
| Checkbox / Radio | 16px; Switch 36×20 |
| Badge | `h-5` (20px) mono caps |
| Table head | `h-10`; rows `h-12` default, `h-10` with `<Table dense>` |
| Dropdown / Select item | `h-8` |
| Avatar | xs 20 / sm 24 / md 32 / lg 40 |
| Icons | 14px in sm controls, 16px default, 20px in empty states / lg icon buttons. lucide-react, `strokeWidth` default (1.75 in nav, 1.6 in empty states). |
| Radius | 2px everywhere (`rounded-[2px]`). Full round only for avatars, dots, switches, progress. |
| Dialog widths | sm 400 / md 520 / lg 720 |
| Sheet widths | right 420, left (nav) 280/240, bottom 85dvh |
| Detail aside | 320px (`<Grid cols="aside">`) |

## 5. Alignment rules

- Left-align everything in the app: labels, headings, table text. Center only empty states and the final marketing CTA.
- Numbers right-align in tables (`numeric` prop) and use tabular numerals.
- Labels sit above controls (`FormField`). In settings pages use `layout="horizontal"` (label column 200px on md+), and use it for every field on that page.
- Header rows (`Section`, `PageHeader`) bottom-align title block and actions (`items-end`), so buttons sit on the title baseline region.
- Toolbars line up with h-10 inputs and md buttons. Do not mix sizes inside one toolbar except sm IconButtons.
- Grid columns come from `Grid` presets only: `1 | 2 | 3 | 4 | 6 | stats | tiles | aside`. Need another? Add a preset.
- Every 9:16 thumbnail uses `aspect-[9/16]`, radius 12px only for phone frames (`.phone-frame`).

## 6. Components

All exported from `@/components/ui` (primitives) and `@/components/layout` (structure).

### Primitives (`components/ui`)
| Component | Props (beyond native) |
|---|---|
| `Button` | `variant: primary \| secondary \| outline \| ghost \| destructive \| link` (default primary), `size: sm \| md \| lg`, `block`, `loading`, `asChild` |
| `IconButton` | `size: sm \| md \| lg`, `variant` (default ghost), `aria-label` required |
| `Card` | `tone: default \| wash \| outline \| accent`, `padding: none \| sm \| md`, `interactive`; parts `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardContent`, `CardFooter` |
| `Badge` | `variant: neutral \| outline \| accent \| success \| warning \| danger \| solid`, `dot` |
| `Input` | `size: sm \| md`, `leading`, `trailing` |
| `Textarea` | native |
| `Select` | `Select`, `SelectTrigger (size)`, `SelectValue`, `SelectContent`, `SelectItem`, `SelectGroup`, `SelectLabel`, `SelectSeparator` |
| `Switch`, `Checkbox` | radix props |
| `RadioGroup`, `RadioGroupItem`, `RadioCard` | `RadioCard` = selectable tile (format, skin, plan pickers) |
| `Slider` | radix props (persona tone sliders, voice speed) |
| `Tabs`, `TabsList (variant: underline \| segmented)`, `TabsTrigger`, `TabsContent` | underline for page tabs, segmented for in-card toggles |
| `Dialog` + `DialogContent (size: sm\|md\|lg, hideClose)`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose`, `DialogTrigger` | confirm, short forms |
| `Sheet` + `SheetContent (side: right\|left\|bottom)`, `SheetHeader`, `SheetBody`, `SheetFooter`, `SheetTitle`, `SheetDescription` | detail drawers, editors |
| `DropdownMenu` + `Content`, `Item (destructive)`, `CheckboxItem`, `RadioGroup`, `RadioItem`, `Label`, `Separator`, `Shortcut`, `Sub*` | row actions, account menu |
| `Tooltip` | `content`, `side`, `align`; primitives `TooltipRoot/Trigger/Content`. Provider is in both shells. |
| `Progress` | `value` (null = indeterminate), `max`, `tone`, `size: xs \| sm` |
| `Skeleton`, `SkeletonText` | `lines` |
| `Separator` | `orientation`, `strong` |
| `Spinner` | `size: xs \| sm \| md \| lg`, `label` |
| `Avatar` | `src`, `name`, `size`, `shape: round \| square` (square = channel) |
| `Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableRow`, `TableHead (numeric)`, `TableCell (numeric)`, `TableCaption` | `Table dense` |
| `Kbd` | native |
| `Toaster`, `toast` | sonner, mounted in root layout. Use `toast.success("Video scheduled")`, `toast.error("…")`. |
| `Label` | radix label |
| `FormField` | `label`, `hint`, `error`, `required`, `aside`, `layout: vertical \| horizontal`; wires id / aria-describedby / aria-invalid onto its single child |

### Layout (`components/layout`)
| Component | Props |
|---|---|
| `PageShell` | marketing frame (Navbar + main + Footer). `bare`, `offsetNav` |
| `Container` | `width: marketing \| app \| prose \| full`, `flush`, `as` |
| `MarketingSection` | `title`, `lead`, `action`, `tone: default \| wash`, `rule`, `width`, `id`, `bodyClassName` |
| `AppShell` | wraps `(app)` routes. `topbarStart`, `topbarEnd` |
| `AppShellData` | client bridge: `channels`, `activeChannelId`, `plan`, `usage`. Render it from any server layout/page to feed the shell. |
| `useAppStore`, `useActiveChannel` | zustand store (channels, activeChannelId (persisted), plan, usage, ready, hydrate) |
| `APP_NAV`, `APP_ROUTES` | route config (`/app`, `/app/radar`, `/app/ideas`, `/app/videos`, `/app/schedule`, `/app/analytics`, `/app/series`, `/app/settings`, new video `/app/videos/new`, new channel `/onboarding`, billing `/app/settings/billing`) |
| `PageHeader` | `title`, `description`, `actions`, `back {href,label}`, `meta`, `tabs` |
| `Section` | `title`, `description`, `action`, children |
| `Stack` | `gap` (step), `align`, `justify`, `as` |
| `Inline` | `gap` (step), `align`, `justify`, `wrap`, `as` |
| `Grid` | `cols: 1 \| 2 \| 3 \| 4 \| 6 \| stats \| tiles \| aside`, `gap` (step) |
| `Toolbar`, `ToolbarGroup` | filter/action row |
| `EmptyState`, `ErrorState`, `LoadingState` | `icon`, `title`, `description`, `action`, `size: default \| compact` |
| `StatTile` | `label`, `value`, `delta`, `deltaLabel`, `higherIsBetter`, `hint`, `loading` |
| `KeyValueList` | `items [{label, value, numeric}]`, `layout: inline \| stacked` |

### App page template
```tsx
// app/(app)/app/videos/page.tsx
<>
  <PageHeader title="Videos" description="…" actions={<Button><Plus/> New video</Button>} />
  <Grid cols="stats">{/* StatTile × 4 */}</Grid>
  <Section title="Recent" action={<Button size="sm" variant="ghost">View all</Button>}>
    <Toolbar>…</Toolbar>
    <Table>…</Table>
  </Section>
</>
```
AppShell already provides the container, gutters, top padding and the `gap-8` between these siblings. Do not wrap pages in another container or add margins.

## 7. States

| State | Style |
|---|---|
| Hover (controls) | background step up one surface (`paper` → `paper-2`) or border to `rule-strong`; text `muted` → `ink` |
| Focus | global 2px accent outline, 2px offset. Inputs: accent border + 3px `accent-soft` ring. Never remove focus styles. |
| Active / selected | `bg-paper-3` + `text-ink` (nav), `accent-soft` bg + `accent-line` border (cards, radio cards, table rows `data-state=selected`) |
| Pressed | buttons nudge 1px down (`active:translate-y-px`) |
| Disabled | `opacity-45`, `pointer-events-none`/`cursor-not-allowed`. Explain why in a tooltip or hint when not obvious. |
| Invalid | `aria-invalid` → danger border; message under the field in `type-caption text-danger` via `FormField error` |
| Loading (button) | `loading` prop: spinner + `aria-busy`, keeps label |

## 8. Empty, loading, error

- **Loading:** Skeletons shaped like the real content (same heights: rows 48, stat value 32, card bodies). Use `LoadingState` only when the shape is unknown. Never a full-page spinner after first paint.
- **Empty:** `EmptyState` with an icon, a title that says what will appear here, one sentence on how it fills, and the single action that fills it ("Open Radar", "Connect TikTok"). Inside cards/tables use `size="compact"`.
- **Error:** `ErrorState` names the problem and the recovery ("Couldn’t load ideas. Try again." + Retry button). Field errors go on the field. Transient action errors use `toast.error`. Never show raw error strings or stack traces.
- **Progress of a run:** `Progress` bar + mono-tick step label; video pipeline steps render as a vertical list like the landing render log (step, detail, elapsed time, `rec-dot` on the live step).

## 9. Motion

| Token | Value | Use |
|---|---|---|
| `--dur-fast` | 120ms | checkbox, hover colors on rows |
| `--dur-base` | 200ms | buttons, inputs, tabs, popovers |
| `--dur-slow` | 320ms | sheets, navbar background, underline |
| `ease-out-expo` | cubic-bezier(0.16,1,0.3,1) | default for everything entering |
| `ease-in-out-quart` | cubic-bezier(0.65,0,0.35,1) | looping/scrubbing only |

Rules:
- Animate transform, opacity, clip-path, filter, colors. Never width/height/margin (Progress width is the one exception).
- Popovers/dialogs: fade + 0.98 zoom (tw-animate-css `animate-in`). Sheets slide from their edge.
- No scroll-triggered entrance on every section. Marketing has one authored moment (hero typewriter + phone scene); the format mocks loop because they depict video.
- `prefers-reduced-motion` is respected globally; `.scene` mocks drop to their finished frame. New animated mocks must look complete with animations off.

## 10. Marketing specifics

- Sections: `MarketingSection` gives the editorial split header (title 7 cols / lead 5 cols on lg) and hairline top rule. Alternate `tone="wash"` (paper background) at most every other section.
- Prefer ruled columns (`border-l border-rule` dividers inside a `border-y` band) over grids of identical cards.
- Buttons: hero/final CTA `size="lg"`; inline section actions `md`.
- Phone mocks: `PhoneFrame` / `FormatScene` / `HeroScene` in `app/_landing/scenes.tsx`, sized with container query units (`cqw`).
- Copy: concise, specific, no hype words ("revolutionary", "unleash", "supercharge"). Illustrative numbers are labeled "Example data".
