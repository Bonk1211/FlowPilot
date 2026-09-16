# FlowPilot Design System

This document is the single source of truth for FlowPilot's product interface. It covers the hackathon MVP from operator-reported defect through diagnosis, guided inspection, corrective action, and verified recovery.

The system is intentionally compact. Add a separate design document only when a shipped surface cannot be described clearly here.

## 1. Experience direction

### Precision Lab

FlowPilot should feel like a calm industrial investigation workspace: part laboratory instrument, part technical case file. It is evidence-led software that happens to use AI, not an AI chat product wearing an industrial theme.

The interface should help a user answer three questions at a glance:

1. What do we know?
2. What remains uncertain?
3. What should I do next, and why?

### Product-specific visual signature

The primary signature interaction is the **evidence thread**:

`Reported defect -> Evidence -> Ranked cause -> Recommended test -> Result`

Selecting a ranked cause reveals only the evidence relevant to that cause. Solid connectors represent supporting evidence, interrupted connectors represent missing evidence, and a clearly labelled conflicting branch represents conflicting evidence. Do not render every relationship simultaneously.

The epoxy-dot grid may appear as a restrained motif in inspection imagery and measurement views. It must not become repeated decoration across the interface.

### Anti-slop rules

- Do not use chat as the primary interaction model.
- Do not use agent avatars, robot imagery, sparkle icons, or “AI magic” language.
- Do not use purple-blue gradients, neon glow, glassmorphism, or cyberpunk HUD styling.
- Do not arrange every piece of content as a floating rounded card or bento grid.
- Do not create decorative charts, invented metrics, or confidence values without a defined calculation.
- Do not use color, animation, or icons merely to make the screen look busy.
- Do not repeat the dot-grid motif outside contexts where it conveys dispensing or measurement information.
- Do not hide uncertainty. Supporting, conflicting, missing, rejected, provisional, and verified evidence must remain distinguishable.

Use typography, alignment, thin rules, indentation, and whitespace before introducing another container.

## 2. Users and task modes

FlowPilot supports a person performing both process-engineering and maintenance responsibilities. It should not require a role toggle. The interface adapts to the current investigation phase.

| Phase | Interface emphasis | User need |
|---|---|---|
| Report | Clear intake and source labelling | Describe the symptom and attach evidence |
| Diagnose | Evidence-dense investigation workspace | Compare evidence, causes, and uncertainty |
| Inspect | Focused procedure workspace | Safely perform and record the next test |
| Correct | Controlled action recording | Apply only the approved corrective action |
| Verify | Pre/post comparison and resolution gate | Prove recovery before resolving the case |

The hackathon flow assumes one user can perform the entire journey. Preserve handoff metadata such as **Action owner**, **Requested by**, and **Recorded by** so separate roles can be supported later.

## 3. Information architecture

### Persistent application frame

- A dark graphite shell establishes the product boundary.
- The case identifier, defect summary, current phase, and simulation status remain visible.
- The phase rail uses the canonical sequence: **Report, Diagnose, Inspect, Correct, Verify**.
- Navigation contains only implemented MVP destinations. Do not display deferred Knowledge Library or document-ingestion surfaces as if they work.
- **Reset demo** is available but visually separated from normal case actions.

### Investigation workspace

Use three coordinated panes rather than a dashboard of independent widgets:

1. **Evidence ledger:** source, observation, status, provenance, and time.
2. **Ranked causes:** ordered hypotheses and the selected cause's evidence thread.
3. **Next best test:** one recommended action, its rationale, what it separates, and what evidence is still missing.

A chronological investigation timeline spans the workspace without competing with the primary task.

### Guided procedure workspace

Inspection is a deliberate mode change, not a small panel inside diagnosis.

- Give the semantic 3D assembly the largest region.
- Show one current step with instruction, rationale, caution, and progress.
- Keep previous, next, play/pause, and reset-camera controls consistently placed.
- Provide a complete text-step fallback beside or below the 3D viewer.
- Keep **Illustrative model — not OEM-certified guidance** and site-procedure dependencies visible.
- Make **obstruction found** and **no obstruction found** explicit, equally reachable outcomes.

### Verification workspace

- Compare pre-action and post-action measurements against the golden range.
- Pair charts with a readable table and text summary.
- Show the confirmed cause and recorded corrective action.
- Do not allow resolution until verification evidence meets the case-state requirements.

## 4. Token architecture

Implementation uses three layers:

1. **Primitive:** raw values such as graphite, teal, spacing, and type sizes.
2. **Semantic:** purpose such as surface, action, verified, or provisional.
3. **Component:** local aliases such as evidence-row-selected or procedure-action-background.

Components must reference semantic or component tokens. Do not place raw hex values or arbitrary spacing values inside components.

### 4.1 Color

#### Primitive palette

| Token | Value | Purpose |
|---|---:|---|
| `graphite-950` | `#0B1117` | Application shell |
| `graphite-900` | `#13202A` | Elevated dark surface |
| `slate-900` | `#132331` | Primary light-theme text |
| `slate-700` | `#344955` | Secondary text |
| `slate-600` | `#52616B` | Muted text |
| `slate-300` | `#B7C5CC` | Strong divider |
| `slate-200` | `#D4DEE3` | Standard divider |
| `slate-100` | `#E8EEF1` | Muted surface |
| `lab-50` | `#F4F7F8` | Main workspace |
| `white` | `#FFFFFF` | Active document surface |
| `teal-700` | `#006B70` | Primary hover/active |
| `teal-600` | `#007F84` | Primary action and selection |
| `teal-100` | `#D9F0F0` | Selected background |
| `amber-800` | `#8A5600` | Provisional text and icon |
| `amber-100` | `#FFF1CC` | Provisional surface |
| `green-700` | `#157A52` | Verified text and icon |
| `green-100` | `#DDF3E8` | Verified surface |
| `red-700` | `#B33A3A` | Conflict, failure, danger |
| `red-100` | `#FBE3E3` | Conflict surface |

#### Semantic assignments

| Token | Assignment |
|---|---|
| `surface-shell` | `graphite-950` |
| `surface-workspace` | `lab-50` |
| `surface-document` | `white` |
| `surface-muted` | `slate-100` |
| `text-primary` | `slate-900` |
| `text-secondary` | `slate-700` |
| `text-muted` | `slate-600` |
| `border-default` | `slate-200` |
| `border-strong` | `slate-300` |
| `action-primary` | `teal-600` |
| `action-primary-hover` | `teal-700` |
| `state-verified` | `green-700` |
| `state-provisional` | `amber-800` |
| `state-conflicting` | `red-700` |
| `state-missing` | `slate-600` |
| `state-rejected` | `slate-700` with strike or rejection icon |

Color never carries meaning alone. Every state includes a text label and, where space allows, a consistent icon.

### 4.2 Typography

- Interface and prose: **IBM Plex Sans**, with a system sans-serif fallback.
- Measurements, tolerances, evidence IDs, timestamps, and source rows: **IBM Plex Mono**, with a system monospace fallback.
- Use sentence case for headings and actions. Reserve uppercase for compact metadata labels such as `SOURCE` or `NEXT BEST TEST`.
- Use tabular figures for measurements, scores, times, and chart labels.

| Role | Size / line height | Weight |
|---|---|---:|
| Workspace title | `28px / 36px` | 600 |
| Section title | `20px / 28px` | 600 |
| Subsection title | `16px / 24px` | 600 |
| Body | `16px / 24px` | 400 |
| Compact body | `14px / 20px` | 400 |
| Label | `13px / 16px` | 500 |
| Caption / metadata | `12px / 16px` | 400–500 |

Keep long-form content between 60 and 75 characters per line. Do not use text smaller than 12px.

### 4.3 Spacing and density

Use a 4px base scale: `4, 8, 12, 16, 24, 32, 48, 64`.

- Ledger row height: 48–56px.
- Standard control height: 40px.
- Primary procedure/action control: 48px.
- Minimum pointer target: 44px when controls may be used on a touch display.
- Pane padding: 16px at compact widths, 24px at standard desktop widths.
- Major workspace separation: 32px, or a structural divider plus 24px padding.

Density should come from alignment and grouping, not tiny type or reduced hit targets.

### 4.4 Shape, borders, and elevation

- Default control radius: 4px.
- Major panel radius: 6px maximum.
- Status chips may use a full radius only when their compact shape aids scanning.
- Use 1px dividers to structure the primary workspace.
- Use shadows only for content that genuinely overlays another layer: dialogs, popovers, and menus.
- Do not apply shadows to every evidence item or hypothesis.

### 4.5 Motion

| Motion | Duration | Intent |
|---|---:|---|
| Press and hover feedback | 100–150ms | Confirm direct manipulation |
| Expand or collapse | 180–220ms | Preserve local continuity |
| Cause reorder | 280–340ms | Make ranking change understandable |
| Phase transition | 240–320ms | Show movement through the investigation |

Animate transform and opacity rather than layout properties. A ranking must reach its correct state even when animation is interrupted. Respect `prefers-reduced-motion`; never delay access to evidence for animation.

## 5. Core component specifications

### Evidence status marker

Supported states: **Verified, Provisional, Conflicting, Missing, Rejected**.

- Always render the full label in ledger rows.
- Use compact icon-plus-label treatment; avoid large filled badges.
- Status changes append an event to the investigation timeline.
- Editing or rejecting evidence must visibly trigger ranking recalculation.

### Evidence ledger

- Use a table or table-like grid, not a stack of cards.
- Required columns: source/provenance, observation, status, and time.
- Show units beside numeric values.
- Keep missing values visibly missing; never render missing numeric data as zero.
- Selecting a row highlights every currently visible claim that cites it.
- Filters wrap before labels truncate.
- On narrow screens, preserve the observation and status first; move provenance detail into an expandable row.

### Ranked cause row

- Show ordinal rank, cause name, one-line interpretation, and evidence strength.
- Use **Strong, Moderate, or Weak evidence** in the primary view. Raw deterministic scores may appear in details when their calculation is available.
- Do not label an uncalibrated value as “confidence.”
- Only the selected cause expands.
- Expanded content separates supporting, conflicting, and missing evidence.
- Agent findings appear as concise specialist briefs with citations, never as chat messages.

### Evidence thread

- Render relationships only for the selected cause.
- Solid teal: supporting relationship.
- Red branch plus label/icon: conflicting relationship.
- Dashed neutral line: missing or unresolved relationship.
- Keyboard focus and row selection must reveal the same relationships as pointer interaction.
- Provide a non-visual text list containing the same relationship information.

### Next best test panel

- Contains one primary action.
- States the recommended test, expected time, procedure authority, and current safety status.
- **Why this test** explains which competing causes or evidence gaps the test separates.
- If the test is unavailable, retain the panel and explain why; do not silently hide it.
- A completed test cannot remain the next recommendation unless a repeat is explicitly required and explained.

### Phase rail

- Uses the canonical five phases and always exposes the current phase as text.
- Completed phases use a check plus completed label treatment.
- Future phases remain readable but inactive.
- The rail is navigation only when returning to that phase is permitted by the case state.

### Guided procedure step

- Anatomy: step number, title, instruction, rationale, caution, model target, progress, and response controls.
- The instruction is primary; rationale and caution are visually distinct but not hidden.
- Controls include text labels alongside icons.
- Every 3D highlight has an equivalent text label.
- Provide camera reset and a text-only fallback.
- Inspection outcomes require confirmation before they alter the ranked causes.

### Verification comparison

- Show pre-action, post-action, golden range, units, and sample count.
- Use direct labels where practical and provide a table alternative.
- Do not use green alone to indicate recovery.
- Resolution requires an explicit textual statement such as **Within golden range — verification passed**.

### Buttons and inputs

- One primary action per view or decision region.
- Standard button height is 40px; high-consequence procedure actions are 48px.
- Inputs have persistent visible labels and helper text where needed.
- Validate on blur or submission, not on every keystroke.
- Errors state the cause and a recovery action beside the relevant field.
- Loading buttons remain labelled, become non-repeatable, and announce progress.

## 6. Responsive behavior

The MVP is desktop-first and optimized for approximately 1440×900. It must remain usable at 1280×720.

| Width | Behavior |
|---|---|
| `>= 1280px` | Three-pane investigation workspace |
| `1024–1279px` | Evidence ledger plus cause workspace; next test becomes a persistent right drawer |
| `768–1023px` | One primary pane with labelled tabs and persistent phase/status header |
| `< 768px` | Case review and simple response capture only; do not compress the full investigation workspace into a phone dashboard |

Avoid nested scrolling. Sticky headers and action bars must not obscure keyboard focus or the final ledger row.

## 7. Accessibility, safety, and honesty

- Meet WCAG AA contrast: 4.5:1 for normal text and 3:1 for large text and meaningful UI boundaries.
- Show a visible 2–4px focus indicator with at least 3:1 state contrast.
- Ensure logical keyboard order matches the visual pane order.
- Provide accessible names and state for every icon control.
- Do not rely on hover, color, animation, or 3D position alone.
- Provide text and keyboard alternatives to drag, orbit, and gesture interactions.
- Use polite live announcements for ranking and status updates without moving focus unexpectedly.
- Respect reduced motion and browser zoom.
- Keep **Simulated data**, **AI-generated finding**, **Illustrative model**, and **Provisional evidence** labels persistent wherever applicable.
- Never imply that FlowPilot initiated machine control.
- Site procedure and domain-expert authority outrank generated guidance.

## 8. Content style

Write like a precise colleague documenting an investigation.

- Prefer: **Flow rate declined over 2 hours.**
- Avoid: **AI detected an exciting insight in your data!**
- Prefer: **This test separates nozzle restriction from insufficient dispense pressure.**
- Avoid: **Run this test to improve confidence.**
- Prefer: **Missing: last nozzle-clean timestamp.**
- Avoid: **More data needed.**

Use direct verbs for actions: **Start inspection**, **Record result**, **Apply approved action**, **Run verification**. Reserve **Confirm** for a user acknowledging a specific, visible consequence.

## 9. Implementation review checklist

Before considering a surface complete, verify:

- The current phase and one primary next action are obvious.
- Supporting, conflicting, missing, rejected, provisional, and verified evidence are distinguishable without color alone.
- Every displayed claim resolves to evidence or a cited source.
- Simulated, illustrative, heuristic, and AI-generated content is labelled.
- A completed test is not incorrectly presented as the next test.
- Negative and positive inspection outcomes are both reachable.
- The interface uses structural dividers and whitespace rather than unnecessary cards.
- No deferred feature appears as functioning navigation.
- Keyboard, focus, zoom, reduced-motion, error, loading, empty, and offline states work.
- The layout works at 1440×900 and 1280×720 without horizontal page scrolling.
- The full report-to-verification journey can be completed without developer-only controls.

