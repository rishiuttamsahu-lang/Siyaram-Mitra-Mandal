# UI/UX Improvement

**Scope of this audit:** `AdminPanel.tsx`, `AdminBuildingManager.tsx`, `AdminSeasonManager.tsx` — the mandal's admin dashboard ("God Mode"). This does **not** cover public-facing pages; only the admin surfaces reviewed so far are included.

---

## 1. Overall Website Assessment

The admin dashboard is dense, data-heavy, and clearly built by someone who understands the domain deeply — every feature a mandal admin needs (users, buildings, chanda seasons, media vault, security) is present and functional. The visual language (maroon `#5A0000` + amber accents, rounded-xl cards, black-uppercase micro-labels) is consistent and gives it a premium, serious "admin console" feel appropriate for handling money and member data.

The core problem isn't missing features — it's **information density outpacing layout structure**. Three separate "money" surfaces (Chanda Manual Ledger tab, Season Manager's Schedule/Overrides/Approvals, Building Manager's per-flat chanda) live in different places without a single "financial home," multiple three-level drill-downs happen on one continuously scrolling page instead of using dedicated space, and text sizes routinely drop to 8–9px, which will hurt usability on real phones for members who aren't power users. This is fixable without touching business logic — it's primarily a hierarchy, consolidation, and typography-scale problem.

---

## 2. What Is Already Working Well

- **Consistent modal pattern** — every modal uses the same `fixed inset-0 z-[99999] bg-black/60 backdrop-blur-sm` + rounded-3xl white card treatment. Keep this exactly as-is; it's a strong reusable pattern.
- **Consistent stat-card grid language** — `grid-cols-2 sm:grid-cols-4` colored metric cards appear in Analytics, Buildings, and Seasons. The visual grammar (label top-left, icon top-right, big number) is instantly recognizable once learned.
- **Optimistic UI + toast feedback** — actions like role change, payment logging, member removal all give immediate toast confirmation. Good perceived-performance pattern.
- **Custom confirm modal replacing `window.confirm`** — correct call for PWA/Next.js compatibility, and it's used consistently via `askConfirm()`.
- **Chip-based drill-down navigation** (Building → Wing, Season selector) is a reasonable pattern for hierarchical data and scales well horizontally.
- **Color-coded payment status** (green/amber/red for Paid/Partial/Due) is applied consistently across Building flats and is easy to scan.
- **Sticky top nav** in AdminPanel keeps tab-switching always accessible while scrolling long tab content.
- **Search + filter combos** (Users, Vault, Flats) are present wherever a list could grow large — good future-proofing instinct.

---

## 3. Global UI/UX Improvements

### 🔴 Critical

**3.1 — Financial data is fragmented across three unrelated tabs**
- **Where:** AdminPanel's "Manual Ledger" (`chanda` tab), AdminSeasonManager (nested inside "Chanda & Finance" tab), and AdminBuildingManager's per-flat chanda fields.
- **Why it's a problem:** An admin trying to answer "has this member/flat paid?" must check up to three different UIs that don't reference each other. The Danveers leaderboard, the raw Payments Feed, the Season's monthly schedule, and the Building's per-flat ledger are all independent money records with no visible cross-link.
- **Recommended change:** Don't merge the underlying data models (that's a functional change, out of scope) — but visually unify entry points. Add a single "Finance" hub tab that surfaces Season status, pending approvals count, and a way to jump into Ledger/Buildings finance views, rather than 3 separately-discovered tabs.
- **Desktop behavior:** Collapse "seasons" and "chanda" into one top-level "Finance" tab with internal sub-navigation (reusing the sub-view tab pattern already built in AdminSeasonManager).
- **Mobile behavior:** Same hub, but sub-nav becomes a horizontal scroll strip (already the pattern used for `adminTabs` — reuse it).
- **UX benefit:** One mental model for "where do I check money," fewer taps, less chance of an admin missing a payment recorded in the "wrong" module.

**3.2 — Font sizes below 10px throughout**
- **Where:** Pervasive — `text-[8px]`, `text-[9px]` used for labels, timestamps, badges in AdminPanel (users list, ledger modal), AdminBuildingManager (flat cards, wing labels), AdminSeasonManager (override cards, month cards).
- **Why it's a problem:** WCAG and general mobile usability guidance treats anything under ~11px as a legibility risk, especially for real users (mandal members/admins, not developers) viewing on mid-range Android phones, often in bright daylight at event time. 8px text is very likely unreadable for older admins.
- **Recommended change:** Establish a type scale floor: no interactive or informational text below `text-[10px]` (≈10px), and prefer `text-xs` (12px) as the real minimum for anything the admin must read to make a decision (amounts, names, statuses). Reserve 8-9px only for pure decorative badges like "YOU" tag.
- **Desktop behavior:** Bump body/label sizes one step up across the board; existing `sm:` breakpoints already scale up — audit that mobile-first sizes aren't the ones actually shipping to most users.
- **Mobile behavior:** This is the primary target of the fix — mobile is where 8-9px hurts most.
- **UX benefit:** Fewer misreads of amounts/names, less accidental mis-taps from squinting-and-fat-fingering.

### 🟠 High

**3.3 — No shared/reusable StatCard component**
- **Where:** AdminPanel Analytics tab (lines ~1177–1195), AdminBuildingManager top metrics (lines ~439–471), AdminSeasonManager top metrics (lines ~466–500) — three separate hand-written implementations of the same visual pattern with slightly different icon sizes, padding, and color logic.
- **Why it's a problem:** Any future tweak (e.g., add a trend arrow, change padding) needs to be repeated three times and will likely drift out of sync, as already visible in small inconsistencies (icon size `w-3 h-3` vs `w-3.5 h-3.5`, `p-3` vs `p-2.5`).
- **Recommended change:** Extract a `<StatCard label icon value colorTheme />` component used by all three tabs.
- **Desktop/Mobile behavior:** Identical in both — this is a pure code-structure win, not a visual change (see Section 7 for details).
- **UX benefit:** Visual consistency guaranteed by construction; faster to maintain.

**3.4 — Two separate custom dropdown implementations doing the same job**
- **Where:** `CustomSelect` (light/dark theme) and `SearchableSelect` in AdminPanel, both hand-rolled with their own click-outside listeners and near-identical markup.
- **Why it's a problem:** Two dropdown components means two places to fix accessibility issues (see 10.1), two places for hover/focus style drift, and larger bundle for no real UX difference — `SearchableSelect` is just `CustomSelect` + a search box.
- **Recommended change:** Merge into one `<Select searchable={boolean} theme="light"|"dark" />` component.
- **Desktop/Mobile behavior:** No visible change to end users; consistent keyboard/focus handling becomes trivial to add once unified.
- **UX benefit:** One component to make accessible, theme, and maintain instead of two.

### 🟡 Medium

**3.5 — Tab-in-tab nesting adds a hidden navigation layer**
- **Where:** AdminPanel top tabs → "Seasons" tab → AdminSeasonManager's own `activeSubView` tabs (Schedule/Overrides/Approvals/Members).
- **Why it's a problem:** Users must learn there are two independent tab systems stacked on top of each other, and the sub-tabs aren't visible until the parent tab is opened, so it's not discoverable via URL, breadcrumb, or scanning.
- **Recommended change:** Make the nested tab bar visually distinct from the parent tab bar (different shape — e.g., underline tabs instead of pill tabs — or add a small breadcrumb: "Finance / Overrides") so it reads as "level 2," not a second unrelated nav.
- **Desktop/Mobile behavior:** Same treatment both places; on mobile keep horizontal scroll but with a lighter/underlined style than the parent pills.
- **UX benefit:** Clearer wayfinding, less "where am I" confusion in a data-dense screen.

**3.6 — Filter bars use `CustomSelect` dark theme inconsistently with rest of light UI**
- **Where:** Vault/media tab filters (`theme="dark"`) sit inside an otherwise all-white/light admin panel.
- **Why it's a problem:** The dark maroon/gold vault filter bar is a deliberate "vault" mood choice (understandable — treasure/gallery framing), but it's the only dark UI in the whole admin surface, which can read as inconsistent rather than intentional at a glance.
- **Recommended change:** Keep the vault's dark theme (it's a nice touch and clearly intentional for "media vault" framing), but note it explicitly in a design-system note so future contributors don't "fix" it into light theme, or don't extend the dark treatment inconsistently elsewhere. No code change needed — documentation-level only.
- **Priority:** Low-effort, so flagged Medium mainly for awareness, not because it needs urgent code change.

### 🟢 Low

**3.7 — Emoji used inside toasts and confirm messages** (e.g., "🗑️", "💰", "🎉", "✅")
- **Where:** Throughout `showToast()` calls and `askConfirm()` messages.
- **Why it's a problem:** Not a real problem — informal tone fits a community mandal tool — but worth flagging that emoji rendering is inconsistent across Android OEM keyboards/fonts and could look broken on some devices.
- **Recommended change:** No change required; optional — verify on 2–3 real budget Android phones that emoji render cleanly.

---

## 4. Page-by-Page Improvements

### AdminPanel.tsx (Main Dashboard Shell)

**🔴 Critical**
- **Users tab role dropdown includes destructive "Ban User" as a normal dropdown option** (line ~1244), mixed in with Viewer/Member/Admin. Banning is a destructive, hard-to-reverse-feeling action sitting one careless tap away in a scrollable dropdown, with no distinct visual weight (no red text, no separator).
  - **Fix:** Visually separate "Ban User" from role options — either a divider + red text inside the dropdown, or move it to a dedicated icon button (like the existing Unban button pattern already used at line 1249) so it's a deliberate action, not a dropdown selection.
  - **Desktop/Mobile:** Same treatment both places since it's the same `CustomSelect`.

**🟠 High**
- **Analytics tab is the least useful "home" tab** — it's just 4 raw counters (Total Users, Total Media, Cloud Used, Banned) with no trends, no time context, no click-through. For an admin opening the panel, this is prime real estate showing static numbers only.
  - **Fix:** Either merge Analytics into a combined "Overview" that also surfaces the top 2-3 most-needed actions (e.g., "3 pending chanda approvals," "2 failed-login users near ban threshold"), or de-prioritize Analytics as a tab and make Users/Finance the default landing tab.
  - **Desktop:** 4-card grid could become a 2-row dashboard: metrics row + "needs attention" row.
  - **Mobile:** Keep it to the single most actionable item at top (e.g., pending approvals badge) before the raw counts.

- **Vault media grid uses `grid-cols-3` on mobile** (line 1561) with `gap-1.5` — thumbnails become quite small and tightly packed on a typical 360-390px phone screen, especially with a delete button and privacy badge overlaid on hover/tap.
  - **Fix:** Consider `grid-cols-2` on the smallest breakpoint, `grid-cols-3` only from `sm:` up, giving each thumbnail more breathing room and a larger tap target for the overlay delete button.
  - **Mobile:** 2 columns. **Desktop:** unchanged (3/4/5 already scales well).

**🟡 Medium**
- **Ledger modal transaction history and adjustment form are stacked vertically in a fixed-height modal** (lines 1685–1786) — on a short phone screen this could push the transaction history very short/scrolly beneath the adjust form.
  - **Fix:** No functional change — just verify `max-h-[90vh]` gives the history list at least a usable minimum height on small viewports (e.g., `min-h-[200px]` on the scrollable history div).
- **"Manual Ledger" (`chanda`) tab and Season Manager's "Approvals" sub-tab both deal with chanda payments but are reached via completely different tabs** — see global issue 3.1. Page-level note: the "Add Entry" form in Manual Ledger and the Danveers board control feel like they belong closer to Season Manager's Approvals view, not as a sibling top-level tab.

**🟢 Low**
- The `Key` icon next to "God Mode" heading is `hidden sm:block` — a small decorative icon disappearing on mobile is fine, no action needed, just noting it's intentional so no one "fixes" it by mistake.

---

### AdminBuildingManager.tsx

**🔴 Critical**
- **Three-level drill-down (Building → Wing → Flat) happens entirely within page scroll, no dedicated space per level.** Selecting a building reveals wings below it; selecting a wing reveals the flats matrix further below. On mobile, this means an admin managing "Flats" has already scrolled past two chip-selector sections plus a stats grid before reaching the actual flat grid they came for.
  - **Fix:** Once a Wing is selected, consider collapsing the "Select Building" and "Wings" sections into a compact breadcrumb-style summary (e.g., "🏢 Siyaram Heights → A Wing ▾ [change]") that expands back into chips only when tapped, keeping the Flats matrix within the first screen of scroll.
  - **Desktop:** Could remain expanded since horizontal space allows it (or apply the same collapse for consistency).
  - **Mobile:** Collapse-to-breadcrumb behavior matters most here — this directly reduces the "unnecessary scrolling" flagged as a mobile priority.

**🟠 High**
- **Flat grid cards hide edit/delete behind `opacity-0 group-hover:opacity-100`** (line 706) — hover states don't exist on touchscreens, meaning mobile users likely cannot discover or reach the per-flat edit/delete buttons at all without accidentally tapping the card first.
  - **Fix:** On touch devices, either always show a smaller edit/delete affordance (e.g., a 3-dot menu icon, always visible at low opacity ~40%), or make the whole flat card tappable to open the flat modal (which already exists), removing the need for hover-revealed icons.
  - **Desktop:** Keep hover-reveal if desired for a cleaner look.
  - **Mobile:** Must have a non-hover path to edit/delete — this is currently likely broken/undiscoverable on phones.

- **Bulk Flat Generator's number-range inputs have no validation feedback shown inline** (lines 1024–1067) — if an admin enters `end < start` or overlapping ranges, there's no visible warning before they click "Generate Flats."
  - **Fix:** Add a small inline preview line ("Will generate 16 flats: 101–116") so admins can sanity-check before submitting, and disable/warn if end < start.

**🟡 Medium**
- **Migration button ("Migrate") sits as a small secondary action next to "Add Building"** (lines 426-434) with no explanation of what it does beyond a tooltip (`title="Import legacy building_chanda documents"`). This is a meaningfully different, likely rare, admin action (one-time data migration) placed with equal visual weight to routine actions.
  - **Fix:** Move one-time/maintenance actions like Migrate into a small overflow menu (⋯) or a "Settings" sub-area, separate from the primary "Add Building" CTA, so routine vs. rare actions are visually distinguished.
- **Status filter dropdown for flats uses a native `<select>`** (line 630) while the rest of the panel uses the custom `CustomSelect`/`SearchableSelect` components — visually this native select will look different (browser-default arrow, system font rendering) from every other dropdown in the app.
  - **Fix:** Swap to the shared `Select` component recommended in 3.4 for visual consistency.

**🟢 Low**
- Flat card badge text ("₹500 P" for partial payment, line 730) — the "P" suffix is a compact but slightly cryptic abbreviation; a small icon or full "Partial" on hover/long-press tooltip could help newer admins, though current admins are likely already fluent.

---

### AdminSeasonManager.tsx

**🔴 Critical**
- **Four-way sub-tab (Schedule/Overrides/Approvals/Members) is nested two levels deep inside AdminPanel's own tabs, and none of the sub-tabs show unread/pending state except Approvals.** An admin who doesn't know to check "Overrides" might never notice a change was made there, since only Approvals gets a badge count.
  - **Fix:** No functional change to what counts as "pending" — just extend the existing badge pattern (already used for Approvals, line 616-620) to Overrides if overrides can be added by multiple people, or at minimum make sure the badge pattern is applied consistently wherever a count meaningfully signals "needs review."

**🟠 High**
- **12-Month Schedule grid mixes viewing and editing in the same dense card** (lines 671-713) — each month card shows amount, lock toggle, and an "Edit Target" button all within a small `p-2.5` card. On mobile at `grid-cols-2`, this is a lot of interactive surface area packed very close together (lock icon, edit button, and the card itself are all separately tappable within ~140px width).
  - **Fix:** Increase touch-target spacing — either move the lock toggle to only appear via the Edit Target modal (reducing the card to pure display + one clear "Edit" action), or ensure `gap` between lock icon and card edge meets a comfortable ~8px minimum tap padding.
  - **Mobile:** Especially important at `grid-cols-2` — consider `grid-cols-1` on the very smallest screens (under ~360px) if cards feel cramped in testing.

- **Season "Set Live" action sits inline with equal visual weight to "Settings" and "Delete"** (lines 516-539) — activating a season is a significant, mandal-wide action (changes what all members see as the current season) but is styled as just another button in a row.
  - **Fix:** Give "Set Live" more visual prominence (larger, or with a short confirm step via the existing `askConfirm` pattern already used elsewhere in the codebase) so it doesn't get triggered as casually as "Settings."

**🟡 Medium**
- **Member Overrides list has no way to see, at a glance, how many total members have any override applied** vs. browsing the full grid — for a mandal with 50+ members this could require scanning many cards to spot which few have exceptions.
  - **Fix:** Add a small summary line above the override grid: "X of Y members have custom arrangements," reusing data already available (`overrides.length`, `mandalMembers.length`).
- **Create Season modal's "Copy from previous season" toggle and source-season dropdown are nested inside a highlighted amber box** (lines 1006-1032) which is good for drawing attention, but the modal as a whole has no scroll affordance indicator if content exceeds viewport on a small phone — `max-w-md` with several stacked fields could overflow above the fold.
  - **Fix:** Verify (and if needed add) `max-h-[85vh] overflow-y-auto` on the modal's outer content wrapper, consistent with the pattern already used in the Ledger modal (`max-h-[90vh]`).

**🟢 Low**
- Season status badges (active/draft/closed, lines 541-549) use color + text but no icon — fine as-is, but for very quick scanning a small dot/icon (already used elsewhere, e.g., the pulsing dot for active season chips at line 570) could be added here too for visual consistency between the two "active" indicators that currently look different from each other (pulsing dot vs. colored badge for the same concept in two places).

---

## 5. Mobile UX Improvements (Consolidated)

Focus areas across all three files:

- **Raise the font-size floor.** No informational text under 10px (see 3.2). This is the single highest-leverage mobile fix.
- **Replace hover-only interactions with tap-safe patterns.** The flat card edit/delete (AdminBuildingManager) is the clearest offender — hover reveal simply doesn't exist on touch. Audit `group-hover:opacity-100` usage across all three files for the same issue (vault media delete button at line 1587 uses the same hover pattern and should also be checked — currently it's inside a `group-hover` overlay that may not be reachable without a first "reveal" tap).
- **Collapse multi-level drill-downs into breadcrumbs once a selection is made** (Building→Wing, and to a lesser extent Season selector) so the flat/schedule content the admin actually wants is reachable within the first screen, not after scrolling past 2-3 selector rows.
- **Reduce Vault grid density on mobile** from 3 to 2 columns for larger, more comfortably tappable thumbnails.
- **Give destructive/high-stakes actions (Ban User, Set Live, Delete Season) more visual separation** from routine actions so they're not one careless tap away in a dense button row or dropdown.
- **Ensure every modal has a verified safe max-height + internal scroll** on small viewports — most already do (`max-h-[90vh]`), just confirm the Create Season and Bulk Generator modals behave the same on a genuinely small screen (iPhone SE-class, ~667px height).

---

## 6. Responsive Behavior

| Element | Desktop | Tablet | Mobile |
|---|---|---|---|
| Admin top tabs (`adminTabs`) | Full row, no scroll needed at wide widths | Horizontal scroll begins | Horizontal scroll, already implemented — keep |
| Stat card grids | 4 columns | 4 columns (already `sm:grid-cols-4`) | 2 columns — keep, but verify readability at 2-col with 10px+ font floor |
| Building/Wing chips | Horizontal row | Horizontal scroll | Horizontal scroll — consider collapsing to breadcrumb once selected (Section 4) |
| Flats grid | 8 columns (`lg:grid-cols-8`) | 6 columns | 2 columns — fine, but verify touch target size for edit/delete icons per Section 4 |
| Vault media grid | 5 columns | 4 columns | **Recommend changing 3→2 columns** |
| Season month cards | 6 columns | 3-4 columns | 2 columns — verify tap-target spacing per Section 4 |
| Ledger/Create/Bulk modals | Centered, `max-w-md`/`max-w-lg` | Same | Full-width with padding — confirm internal scroll on short viewports |

---

## 7. Component Architecture Recommendations

1. **Extract `<StatCard />`** — used identically (with different colors/icons) in AdminPanel Analytics, AdminBuildingManager metrics, AdminSeasonManager metrics. Props: `label, value, icon, colorTheme ('neutral'|'success'|'warning'|'danger'|'info')`.
2. **Merge `CustomSelect` + `SearchableSelect`** into one `<Select searchable theme />` component (Section 3.4). Also replace the one native `<select>` in AdminBuildingManager's status filter and AdminSeasonManager's override-month `<select>` with this shared component for full visual consistency.
3. **Extract `<ConfirmModal />` usage is already centralized — good.** No change needed, just keep using `askConfirm()` everywhere rather than any local confirm patterns.
4. **Consider a shared `<DrillBreadcrumb />` pattern** for Building→Wing and any future multi-level selectors, so the "collapse once selected" behavior (Section 4) is written once and reused.
5. **Consider a shared `<SectionCard />` wrapper** (`bg-white rounded-xl border border-gray-200 p-3 sm:p-4/5 shadow-sm`) — this exact class combination is repeated verbatim across dozens of top-level sections in all three files. Wrapping it once would make future spacing/radius/shadow changes a one-line edit instead of a find-replace across 3 files.

---

## 8. Navigation & User Flow Improvements

- **"Where do I manage money?" is currently a 3-tab guessing game** (Manual Ledger / Seasons / Buildings). Recommend the Finance-hub consolidation from Section 3.1 as the single highest-impact navigation fix.
- **Nested sub-tabs inside Seasons need a visual "you are here" cue** distinct from the top-level tab bar (Section 3.5) — currently both tab layers use the same pill/maroon-fill style, which flattens the hierarchy visually even though it's two levels deep.
- **Common admin task "ban a problematic user" is buried in a role dropdown** — for a task an admin might need to do quickly during a live event, a more direct path (visible "Ban" icon button next to each user row, matching the existing "Unban" button already present for banned users) would be faster than opening a dropdown and scrolling to the bottom option.

---

## 9. Visual Consistency

- **Icon sizing drifts slightly between the three stat-card implementations** (`w-3 h-3` vs `w-3.5 h-3.5`) — resolved automatically once `<StatCard />` (Section 7) is extracted.
- **Dropdown components (2 custom + 1 native `<select>`)** currently render 3 visually distinct styles for "pick one option" — resolve via Section 3.4/7.2.
- **"Active" status indicators use two different visual languages** — a pulsing dot (season chips, line 570) vs. a colored text badge (season detail header, line 541-549) for the same "this is currently active" meaning. Recommend picking one and applying consistently.
- **Spacing scale is mostly consistent** (`gap-1.5`, `gap-2`, `p-2.5`, `p-3` recur predictably) — no major issue, just keep using the existing scale rather than introducing new arbitrary values as new features are added.

---

## 10. Accessibility & Usability

**10.1 — Custom dropdowns lack keyboard navigation and ARIA roles.** `CustomSelect` and `SearchableSelect` are fully mouse/touch-driven (click-outside-to-close via `mousedown` listener) with no `role="listbox"`/`role="option"`, no arrow-key navigation, and no `aria-expanded` on the trigger. For an admin tool, this is a lower-urgency accessibility gap than a public page, but worth fixing once the components are merged (Section 3.4) since it's a single fix point after consolidation.

**10.2 — Delete/destructive icon-only buttons rely solely on `title` tooltips** (e.g., Trash2 icons throughout) with no visible text label and no `aria-label`. Tooltips don't appear on touch devices at all, so a screen-reader or keyboard user gets no accessible name for these buttons.
- **Fix:** Add `aria-label="Delete flat"` (etc.) alongside the existing `title` attribute — low effort, meaningfully improves screen-reader support.

**10.3 — Color is sometimes the only signal for status** (e.g., flat payment status badges rely on background color; locked/unlocked month cards rely on border color + icon, which is actually good since it also has the Lock/Unlock icon — but the flat status badges at line 729 have no icon, only color + text abbreviation like "P"). Recommend keeping the existing text abbreviations (already present, which is good) but double-check color contrast ratios for the amber "Partial" badge text-on-background meets at least WCAG AA for the given font size once the 10px floor (3.2) is applied.

---

## 11. Implementation Priority

1. **Critical fixes**
   - Consolidate Finance-related tabs into one discoverable hub (3.1)
   - Raise font-size floor to 10px minimum, 12px preferred for financial data (3.2)
   - Separate "Ban User" from casual role dropdown (Section 4 / AdminPanel)
   - Fix hover-only edit/delete on Flat cards for touch devices (Section 4 / AdminBuildingManager)
   - Collapse Building→Wing drill-down into breadcrumb once selected (Section 4 / AdminBuildingManager)

2. **High-impact UX improvements**
   - Extract `<StatCard />` and merge dropdown components (Section 7)
   - Reduce Vault grid to 2 columns on mobile
   - Add visible tap-target spacing to Season month cards
   - Give "Set Live" (season activation) more visual weight / confirm step
   - Add inline validation preview to Bulk Flat Generator

3. **Medium improvements**
   - Visually distinguish nested sub-tabs from parent tabs (Section 3.5)
   - Move "Migrate" and other rare actions into an overflow/settings area
   - Add member-overrides summary line
   - Verify all modals scroll safely on short viewports
   - Swap native `<select>` elements to the shared Select component

4. **Polish / optional improvements**
   - Unify the two "active" status visual languages (dot vs. badge)
   - Add `aria-label`s to icon-only destructive buttons
   - Add keyboard nav / ARIA roles to the merged Select component
   - Verify emoji rendering across common Android devices

---

## 12. Final Recommended Structure

```text
Admin Dashboard (God Mode)
 ├── Sticky Top Nav
 │    └── Overview | Finance | Users | Buildings | Vault | Security | Website | Profile
 │        (Finance replaces separate "Seasons" + "Manual Ledger" tabs)
 │
 ├── Overview (was "Analytics")
 │    ├── Key Metrics (StatCard grid)
 │    └── Needs Attention (pending approvals, near-ban users, etc.)
 │
 ├── Finance (consolidated hub)
 │    ├── Season Selector (chips) + "Set Live" (prominent, confirm-gated)
 │    ├── Sub-nav: Schedule | Overrides | Approvals | Members | Manual Ledger
 │    │    (underline-style tabs, visually distinct from top nav pills)
 │    └── Danveers Board + Payments Feed (surfaced within relevant sub-tab)
 │
 ├── Buildings
 │    ├── Breadcrumb once selected: "Building Name → Wing Name [change]"
 │    ├── Metrics (StatCard grid)
 │    └── Flats Matrix (grouped by floor, tap-safe edit/delete)
 │
 ├── Vault
 │    ├── Filters (dark theme, kept as intentional)
 │    └── Media Grid (2 cols mobile / 3-5 desktop)
 │
 ├── Users
 │    └── User rows with direct Ban/Unban icon button (not buried in dropdown)
 │
 ├── Security / Website / Profile
 │    (unchanged — already simple, no dropdowns, low complexity)

Mobile
 ├── Compact Sticky Header (tabs horizontal-scroll, unchanged)
 ├── Overview: Needs-Attention row first, metrics below
 ├── Finance: Season chip row → collapsed sub-nav scroll strip
 ├── Buildings: Breadcrumb (collapsed) → Flats grid (2 col, tap-safe)
 └── Vault: 2-column grid
```
