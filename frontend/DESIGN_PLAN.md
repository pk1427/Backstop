# Backstop Frontend — Design Plan
*Phase 11: Production-grade visual design pass*

---

## 1. Color Palette

Base: cool institutional neutrals + one precise accent. No warm cream, no terracotta, no neon green, no generic crypto purple/blue gradients.

| Name | Hex | Role |
|------|-----|------|
| `ink` | `#0b0d12` | Primary background (dark mode) — near-black with cool blue undertone |
| `surface` | `#13161d` | Card/elevated surface — subtly lighter than ink |
| `surface-raised` | `#1a1e27` | Hover/active surfaces, modals |
| `border` | `#252a37` | Default border — visible but not harsh |
| `text-primary` | `#e6e8f0` | Body text, labels — high contrast against ink |
| `text-secondary` | `#8b919f` | Supporting text, timestamps, metadata |
| `accent` | `#14b8a6` | Primary action, active states, links — teal-500 equivalent |
| `accent-muted` | `#0f766e` | Hover state for accent, subtle indicators |
| `success` | `#10b981` | Passed checks, successful transactions |
| `warning` | `#f59e0b` | Pending states, DEMO DATA badges |
| `danger` | `#ef4444` | Failed checks, blocked transactions, errors |

Light mode overrides:
- Background: `#f8f9fb` (cool off-white)
- Surface: `#ffffff`
- Border: `#e2e5ec`
- Text-primary: `#0f1117`
- Text-secondary: `#6b7280`

**Avoided:**
- Warm cream + terracotta (feels consumer/craft, not institutional)
- Near-black + neon-acid-green (feels degen/terminal-hacker)
- Generic crypto purple/blue gradients (feels template-generated)

---

## 2. Typography

**Primary:** `IBM Plex Sans` — designed by IBM for professional/financial interfaces. Not overused in crypto. Reads as precise, trustworthy, institutional.

**Data/Numbers:** `IBM Plex Mono` — monospace companion designed for numerical data. tabular-nums everywhere. Financial terminals use monospace for numbers because it prevents layout shifts and aids comparison scanning.

**Scale:**
- `text-xs`: 0.75rem / 12px — metadata, timestamps, helper text
- `text-sm`: 0.875rem / 14px — labels, secondary values
- `text-base`: 1rem / 16px — body text, button labels
- `text-lg`: 1.125rem / 18px — card headings
- `text-xl`: 1.25rem / 20px — page headings
- `text-2xl`: 1.5rem / 24px — primary values (balances, health factor)
- `text-3xl`: 1.875rem / 30px — hero numbers

**Weight discipline:**
- `font-normal` (400): body text, secondary values
- `font-medium` (500): labels, button text, tertiary values
- `font-semibold` (600): card headings, primary values
- `font-bold` (700): page headings, status labels

No ALL-CAPS eyebrows unless absolutely necessary. The current "ACTIVE", "READY TO EXECUTE" status labels are acceptable because they are system state, not section headers — but they should be `text-xs font-semibold tracking-wide`, not larger.

---

## 3. Layout

**Approach:** Single-column dashboard with a persistent header. Maximum content width `max-w-6xl` (slightly wider than current `max-w-5xl` to give numbers room to breathe). Consistent `px-6` horizontal padding. Vertical rhythm: sections separated by `gap-6` (24px), cards have `p-6`.

### Overview (dashboard)

```
┌──────────────────────────────────────────────────────┐
│ HEADER: Logo | Status Badge | Wallet | Network | Logout│
├──────────────────────────────────────────────────────┤
│ NAV: Overview | Strategy | Opportunities | Activity   │
├──────────────────────────────────────────────────────┤
│ ┌─────────────────────┐ ┌─────────────────────────┐ │
│ │ CAPITAL CARD        │ │ STRATEGY CARD           │ │
│ │ $12,450.00 USDC     │ │ USDC → WETH Backstop    │ │
│ │ 4.2810 ETH          │ │ Max Trade: $1,000       │ │
│ │ Wallet: 0x1234...5678│ │ Discount: 1.00% – 5.00%│ │
│ │ [Refresh]           │ │ Expiry: 2027-09-09      │ │
│ └─────────────────────┘ └─────────────────────────┘ │
│ ┌──────────────────────────────────────────────────┐ │
│ │ OPPORTUNITY CARD                                 │ │
│ │ Health Factor: 0.85 LIQUIDATABLE                 │ │
│ │ Liquidation Size: $1,000.00                      │ │
│ │ Collateral: $12,840.00  Debt: $8,200.00         │ │
│ │ ┌──────────────────────────────────────────────┐ │ │
│ │ │ Private Execution Quote              DEMO DATA│ │ │
│ │ │ Price: $3,421.00  Discount: 2.00%  Expires: 5m│ │ │
│ │ └──────────────────────────────────────────────┘ │ │
│ └──────────────────────────────────────────────────┘ │
│ ┌─────────────────────┐ ┌─────────────────────────┐ │
│ │ POLICY CHECKLIST    │ │ EXECUTION               │ │
│ │ ✓ Strategy active   │ │ No execution yet.       │ │
│ │ ✓ Quote valid       │ │ [Execute Backstop] SIM  │ │
│ │ ✓ Quote not expired │ │                        │ │
│ │ ✓ Size within max   │ │                        │ │
│ │ ✓ Price within bounds│ │                       │ │
│ │ ✓ Recipient allowed │ │                        │ │
│ │ READY TO EXECUTE    │ │                        │ │
│ └─────────────────────┘ └─────────────────────────┘ │
│ ┌──────────────────────────────────────────────────┐ │
│ │ SPONSOR FOOTER                                   │ │
│ └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

### Strategy

```
┌──────────────────────────────────────────────────────┐
│ HEADER + NAV                                        │
├──────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────┐ │
│ │ STRATEGY CARD                                    │ │
│ │ USDC → WETH Backstop              ACTIVE          │ │
│ │ Max Trade: $1,000  Discount: 1.00% – 5.00%      │ │
│ │ Expiry: 2027-09-09  Pair: USDC / WETH           │ │
│ └──────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────┐ │
│ │ MAKER ONBOARDING                                 │ │
│ │ [Fund Wallet] [Refresh] [Approve Aqua] [Ship]    │ │
│ └──────────────────────────────────────────────────┘ │
│ FOOTER                                              │
└──────────────────────────────────────────────────────┘
```

### Opportunities

```
┌──────────────────────────────────────────────────────┐
│ HEADER + NAV                                        │
├──────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────┐ │
│ │ OPPORTUNITY CARD (same as overview)              │ │
│ └──────────────────────────────────────────────────┘ │
│ ┌─────────────────────┐ ┌─────────────────────────┐ │
│ │ POLICY CHECKLIST    │ │ EXECUTION               │ │
│ └─────────────────────┘ └─────────────────────────┘ │
│ FOOTER                                              │
└──────────────────────────────────────────────────────┘
```

### Activity

```
┌──────────────────────────────────────────────────────┐
│ HEADER + NAV                                        │
├──────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────┐ │
│ │ ACTIVITY TIMELINE                                │ │
│ │ 14:32:05  STRATEGY FUNDED            Success     │ │
│ │ 14:32:08  SECURITY SETUP            Success     │ │
│ │ 14:35:22  LIQUIDATION EXECUTION      Success     │ │
│ │           (SIMULATED)                            │ │
│ └──────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────┐ │
│ │ ▼ Wallet & Policy                                │ │
│ │   Scoped Signer: Added                           │ │
│ │   [Test Within-Policy Tx] [Test Disallowed Tx]   │ │
│ └──────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────┐ │
│ │ ▼ Advanced: Failure Mode Lab                     │ │
│ │   [Expired] [Size Exceeded] [Price Below Min]    │ │
│ │   [Price Above Max] [Unauthorized Write]          │ │
│ └──────────────────────────────────────────────────┘ │
│ FOOTER                                              │
└──────────────────────────────────────────────────────┘
```

**Alignment:** All cards align to a strict 24px grid. No asymmetric offsets, no "creative" overlapping. Financial information is left-aligned for scannability; status indicators are right-aligned.

---

## 4. Design Principles

1. **Restraint over decoration.** No gradients as pure decoration. No glow effects. No excessive border radius (cards use `rounded-xl` / 12px, not `rounded-2xl` or `rounded-3xl`). Buttons use `rounded-lg` / 8px.

2. **Numbers are the hero.** Balances, health factors, and quote prices get the largest type (`text-2xl` / `text-3xl`), `font-semibold`, and `tabular-nums`. Labels above them are small (`text-xs`), uppercase, tracked, and muted.

3. **Status through position and weight, not badges everywhere.** The system status lives in the header. Execution status lives in the execution card. Opportunity status lives in the opportunity card. Badges are used sparingly: DEMO DATA and SIMULATED only, because they are the two states that need explicit visual annotation.

4. **Cool neutrals, one accent.** The entire UI is built from the neutral palette (`ink`, `surface`, `border`, `text-primary`, `text-secondary`). The accent (`#14b8a6` teal) is used only for primary actions and active states. Success/warning/danger are reserved for actual system states (checks passing/failing, transactions succeeding/blocking).

5. **Dense but breathable.** Financial terminals display a lot of data. We use tight vertical spacing within cards (`space-y-2` or `space-y-3`) but generous spacing between cards (`gap-6`). This keeps related data visually grouped while allowing the eye to move between sections.

6. **What makes this NOT generic SaaS/crypto:**
   - No purple/blue gradient header
   - No "AI-generated" tracked-out ALL-CAPS section eyebrows everywhere (only system-state labels)
   - No middle-dot-joined meta strings like "Self-custodial · Privately-priced · Policy-bounded"
   - No identical-radius cards with the same soft grey shadow — cards have subtle borders, not shadows
   - No monospace labels on everything — only numbers and addresses are monospace; labels are sans-serif
   - No decorative gradient washes — the only color beyond neutrals is the single teal accent

---

## 5. Self-Critique Against Generic-AI-Design Traits

| Trait to avoid | Present in plan? | Action |
|----------------|------------------|--------|
| Tracked-out ALL-CAPS eyebrows everywhere | Partial — status labels like "ACTIVE", "READY TO EXECUTE" are ALL-CAPS | **Keep but limit to system-state labels only.** Section headers ("Protected Capital", "Active Strategy", "Execution Check") use `text-xs font-medium text-zinc-500 uppercase tracking-wide`, not `font-bold` or larger. This is functional, not decorative. |
| Middle-dot-joined meta strings | No | N/A |
| Arrow (`→`) suffixes on buttons/links | No | N/A |
| Identical-radius cards with same soft grey shadow | No — cards use subtle borders (`border border-zinc-200`), not shadows | N/A |
| Monospace labels on everything | No — only numbers/addresses use mono | N/A |
| Gradient washes as pure decoration | No — single flat accent color only | N/A |

**Revision after critique:**
The original draft had `font-bold` on the ALL-CAPS status labels. Revised to `font-semibold` with `tracking-wide` only — this keeps them functional as system-state indicators without shouting. Also removed the `text-lg` size from status labels; they are now `text-xs` to match the rest of the label hierarchy.

---

## 6. Component Inspirations

### shadcn/ui (structural foundation)
- **Button** — `Button` component with `variant="default"` for primary actions, `variant="outline"` for secondary. Our Execute Backstop button becomes the primary action; Approve/Ship become secondary until active.
- **Badge** — `Badge` component with `variant="secondary"` for DEMO DATA and SIMULATED. Already close to what we have; just need to ensure contrast.
- **Card** — `Card` + `CardHeader` + `CardContent` — but we will NOT use the default shadow. Instead, use border-only treatment (`border border-border bg-surface`).
- **Skeleton** — `Skeleton` component for loading states. Already using `animate-pulse` divs; replace with shadcn `Skeleton` for consistency.

### beautifui.dev (data-display patterns)
- **Status indicators** — `BeauStatus` pattern: small colored dot + text, used for the header status badge. Already implemented in `StatusBadge.tsx`.
- **Data rows** — `BeauDataRow` pattern: label above value, used in cards. Already present in `CapitalCard` and `StrategyCard`.
- **Not pulling:** Fancy gradient cards or decorative illustrations. Not appropriate for this brief.

### beui.dev (dashboard/panel layouts)
- **Panel grouping** — `BeuiPanel` pattern: cards with consistent padding, subtle borders, no shadows. Already our approach.
- **Not pulling:** Their signature rounded-3xl cards with heavy shadows. Too consumer-facing.

### rareui.com (distinctive treatment for ONE moment)
- **Orchestrated motion** — `RareUI` has a `Reveal` component that animates content in with a subtle slide + fade. We will use this **only** for the Policy Checklist flipping to all-green when a valid quote arrives. This is the single moment that deserves craft.
- **Not pulling:** Their decorative particle effects or 3D transforms. Inappropriate.

### transitions.dev (state-change transitions)
- **State transitions** — `Transition` component with `enter`, `enterFrom`, `enterTo`, `leave`, `leaveFrom`, `leaveTo`. We will use this for:
  - Quote arriving in `OpportunityCard` (fade in)
  - Execution result appearing (slide up + fade)
  - Policy check items flipping from pending to pass/fail (color transition)
- **Not pulling:** Page-level route transitions. Not needed for this 4-page app.

---

## 7. Component Mapping

| Component | Pattern / Source | Why |
|-----------|------------------|-----|
| **Header** | shadcn `Card` (border-only) + custom status dot | Clean, dense, institutional. Status is part of the header because it's global state, not card content. |
| **Navigation** | shadcn `Tabs` (underline variant) | Standard, functional, low-decoration. Active state is underline + weight, not color explosion. |
| **CapitalCard** | beautifui `DataRow` pattern | Numbers-first. USDC balance is `text-3xl font-semibold tabular-nums`. ETH is smaller below it. Wallet address is mono, truncated. |
| **StrategyCard** | beautifui `DataRow` + shadcn `Badge` (ACTIVE) | Immutable bounds should read as "locked, precise." No gradients, no glow. ACTIVE badge is the only accent on the card. |
| **OpportunityCard** | shadcn `Card` + custom quote block | DEMO DATA badge uses warning palette (amber), not accent. Quote block has subtle inset background (`bg-surface-raised`) to differentiate it from the card background. |
| **PolicyChecklist** | Custom + transitions.dev `Transition` | Each check is a row with icon + label + detail. When all pass, the bottom status bar transitions from red to green. The orchestrated motion moment is here: when the last check flips to passed, the entire checklist gets a subtle teal left-border accent. |
| **ActivityTimeline** | Custom list with timestamp + status color | Left border is colored by status (success=green, error=red, policy=amber, info=border). No icons, no dots — just color. Timestamps are mono, secondary text. |
| **Buttons** | shadcn `Button` (default + outline variants) | Primary action (Execute) uses `variant="default"` with accent background. Secondary actions (Approve, Ship, Fund) use `variant="outline"`. Loading state replaces text with spinner + "...". |
| **Badges (DEMO DATA, SIMULATED)** | shadcn `Badge` (secondary + warning variants) | DEMO DATA: `variant="secondary"` with warning colors. SIMULATED: `variant="secondary"` with warning colors but slightly different shade to distinguish. Both preserve WCAG AA contrast from Phase 10. |

---

## 8. One Orchestrated Motion Moment

**Chosen moment:** Policy Checklist flipping from mixed/failing to all-green when a valid quote arrives and all bounds checks pass.

**Why this moment:**
- It is the cognitive climax of the demo: the system has verified the quote against immutable strategy bounds, and the user can now execute.
- It directly maps to the product thesis: "privately-priced, policy-bounded, programmable."
- It is a state change that happens in the UI, not just a page transition — it has narrative weight.
- The opposite (failure mode) is also demoed, so the contrast between "all-green" and "blocked" is the core story.

**Implementation:**
- Use `transitions.dev` `Transition` component (or Framer Motion `AnimatePresence` if transitions.dev doesn't fit) to animate each check icon from red X to green check with a staggered delay of 50ms per item.
- When the last check flips, the entire checklist card gets a `border-l-4 border-l-accent` left accent border (transitioned over 300ms).
- `prefers-reduced-motion: reduce` → instant state change, no animation.

**Every other interaction:**
- Button hover: `transition-colors duration-150` only
- Tab switch: instant, no animation
- Badge appearance: instant, no animation
- Card hover: none (cards don't hover)

---

## 9. Accessibility Floor

- Preserve WCAG AA contrast fixes from Phase 10 on both badges.
- Preserve all existing `aria-label`s, semantic HTML, keyboard navigation.
- Add `prefers-reduced-motion` media query to disable the orchestrated animation.
- Any new color combinations must be tested for contrast before finalizing.

---

## 10. Implementation Notes

- **Do not change BackstopContext.tsx** — all state, callbacks, and business logic remain byte-for-byte identical.
- **Do not change any contract code** — this is a presentation-layer pass only.
- **Do not add new data flows** — if a design requires data that isn't already in the context, flag it instead of adding it.
- **Reuse existing components** where possible; only create new presentational components.
- **Tailwind-only changes** preferred; avoid adding new dependencies unless the orchestrated motion requires it.
