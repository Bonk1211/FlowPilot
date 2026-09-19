# FlowPilot Design System

This document is the single source of truth for FlowPilot's product interface. It covers the hackathon MVP from operator-reported defect through diagnosis, guided inspection, corrective action, and verified recovery.

The system is intentionally compact. Add a separate design document only when a shipped surface cannot be described clearly here.

**Revision 0.2 — Calibrated editorial instrument:** incorporates lessons from the supplied editorial landing pages, operational dark console, and decision-traceability interface without copying their marketing scale or decorative behavior.

## 1. Experience direction

### Precision Lab, with editorial discipline

FlowPilot should feel like a calm industrial investigation workspace: part laboratory instrument, part technical case file. It is evidence-led software that happens to use AI, not an AI chat product wearing an industrial theme.

The interface should help a user answer three questions at a glance:

1. What do we know?
2. What remains uncertain?
3. What should I do next, and why?

The visual direction is a **calibrated editorial instrument**:

- **Editorial** for orientation: decisive phase headlines, generous whitespace, strong black-on-paper contrast, and concise explanatory copy.
- **Instrument-like** for work: aligned data, visible units, tabular figures, restrained controls, and exact source references.
- **Focused dark surfaces** for immersive tasks: raw event inspection and guided 3D procedures may use a dark instrument stage, while the surrounding application remains light and legible.

Aim for an approximate visual balance of **70% light case file, 20% dark instrument stage, and 10% accent/state color**. This is a composition guardrail, not a pixel quota.

### Reference translation

| Reference lesson                                                       | FlowPilot adaptation                                                          | Do not copy                                                                       |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Oversized editorial type creates a clear point of entry                | Use one 32–40px phase headline on overview, transition, and completion states | Cropped 100px+ words inside evidence-heavy workspaces                             |
| Large quiet margins make a few elements feel intentional               | Increase spacing between task regions and reduce unnecessary containers       | Empty space that pushes the active evidence or next action below the fold         |
| High-contrast black, off-white, and one saturated accent feel decisive | Use paper, graphite, and teal; keep state colors semantic                     | Coral/red as a general brand accent because red already means conflict/failure    |
| Dark operational panels make live systems feel focused                 | Use a bounded dark instrument stage for 3D inspection and raw-log detail      | Turning every screen into a low-contrast dark dashboard                           |
| Fine rules and aligned list rows scan better than card piles           | Prefer ledger rows, split panes, and horizontal dividers                      | A bento card for every metric, finding, or sentence                               |
| A visible logic graph makes traceability tangible                      | Make the selected evidence thread a primary workspace object                  | Decorative nodes, invented confidence badges, or showing the entire graph at once |
| Large rounded feature frames can create one visual anchor              | Allow one 12–16px focus frame per view                                        | 24–40px rounding on every panel and control                                       |
| Compact uppercase labels help operational scanning                     | Use them only for short metadata categories                                   | Long uppercase prose, compressed tracking, or low-contrast grey labels            |

### Expressive-budget rule

Each view gets at most **one expressive device**: a phase headline, a dark instrument stage, an evidence graph, or a quantitative comparison. Everything else supports that device. Do not combine a giant headline, decorative grid, ticker, carousel, glow, and multiple floating cards on the same view.

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
- Do not use scrolling marquees, diagonal ribbons, auto-rotating carousels, handwritten labels, or parallax as product decoration.
- Do not use giant clipped typography inside the active investigation workspace.
- Do not use dark mode to hide weak hierarchy or render normal body text in low-contrast grey.
- Do not create decorative charts, invented metrics, or confidence values without a defined calculation.
- Do not use color, animation, or icons merely to make the screen look busy.
- Do not repeat the dot-grid motif outside contexts where it conveys dispensing or measurement information.
- Do not hide uncertainty. Supporting, conflicting, missing, rejected, provisional, and verified evidence must remain distinguishable.

Use typography, alignment, thin rules, indentation, and whitespace before introducing another container.

## 2. Users and task modes

FlowPilot supports a person performing both process-engineering and maintenance responsibilities. It should not require a role toggle. The interface adapts to the current investigation phase.

| Phase    | Interface emphasis                      | User need                                 |
| -------- | --------------------------------------- | ----------------------------------------- |
| Report   | Clear intake and source labelling       | Describe the symptom and attach evidence  |
| Diagnose | Evidence-dense investigation workspace  | Compare evidence, causes, and uncertainty |
| Inspect  | Focused procedure workspace             | Safely perform and record the next test   |
| Correct  | Controlled action recording             | Apply only the approved corrective action |
| Verify   | Pre/post comparison and resolution gate | Prove recovery before resolving the case  |

The hackathon flow assumes one user can perform the entire journey. Preserve handoff metadata such as **Action owner**, **Requested by**, and **Recorded by** so separate roles can be supported later.

## 3. Information architecture

### Persistent application frame

- A compact dark graphite command bar establishes the product boundary without wrapping the entire workspace in dark chrome.
- The case identifier, defect summary, current phase, and simulation status remain visible.
- The phase rail uses the canonical sequence: **Report, Diagnose, Inspect, Correct, Verify**.
- Navigation contains implemented destinations: Investigation and Learning Database. Uploaded-document ingestion remains deferred.
- **Reset demo** is available but visually separated from normal case actions.

The command bar should occupy 56–64px on desktop. It is orientation chrome, not a dashboard region: do not add KPIs, decorative status lights, or a second navigation hierarchy to it.

### Phase masthead

Each phase starts with a shallow editorial masthead that answers **where am I, what changed, and what is next**.

- Use a short eyebrow such as `DIAGNOSE · CASE FP-024`, followed by a 32–40px phase headline and a one-sentence state summary.
- Place one phase-critical value or action opposite the headline when space permits; do not build a KPI strip.
- Keep the masthead between 120px and 184px high at desktop sizes so the active workspace remains above the fold.
- A faint technical grid may appear behind phase-entry or empty states at 2–4% contrast. It must disappear behind tables, prose, and controls.
- During routine work, collapse the masthead to the workspace title and phase summary rather than leaving presentation-scale type on screen.

### Investigation workspace

Use three coordinated panes rather than a dashboard of independent widgets:

1. **Evidence ledger:** source, observation, status, provenance, and time.
2. **Ranked causes:** ordered hypotheses and the selected cause's evidence thread.
3. **Next best test:** one recommended action, its rationale, what it separates, and what evidence is still missing.

A chronological investigation timeline spans the workspace without competing with the primary task.

At `>= 1280px`, use a 12-column grid with a starting allocation of **4 columns evidence / 5 columns causes / 3 columns next test**. Pane proportions may change when the selected cause opens, but alignment lines must remain stable. Separate panes with rules and whitespace; do not place all three inside unrelated floating cards.

### Instrument stage

Dark presentation is a bounded mode, not a global theme choice for the MVP.

- Use the instrument stage for the guided 3D inspection and an optional raw machine-event viewer.
- Keep the phase, safety status, and exit/back action outside or at the stable edge of the dark region.
- Inside the stage, reserve the brightest value for the current target or primary action. Teal shows selection/active linkage; amber and red retain their caution/conflict meanings.
- Dark panels use real separators, direct labels, and high-contrast text. Do not imitate radar screens, glowing dots, or terminal decoration unless the underlying data requires that representation.
- Never move evidence verification, corrective-action authorization, or final resolution into an immersive surface that hides provenance.

### Guided procedure workspace

Inspection is a deliberate mode change, not a small panel inside diagnosis.

- Give the semantic 3D assembly the largest region.
- Show one current step with instruction, rationale, caution, and progress.
- Keep previous, next, play/pause, and reset-camera controls consistently placed.
- Provide a complete text-step fallback beside or below the 3D viewer.
- Keep **Illustrative model — not OEM-certified guidance** and site-procedure dependencies visible.
- Make **obstruction found** and **no obstruction found** explicit, equally reachable outcomes.

The model viewport may use the dark instrument stage. The current instruction remains on a light or clearly separated high-contrast document surface so safety text never competes with the 3D scene.

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

| Token          |     Value | Purpose                                      |
| -------------- | --------: | -------------------------------------------- |
| `graphite-975` | `#080B0D` | Deep instrument-stage background             |
| `graphite-950` | `#0B1117` | Application command bar and primary action   |
| `graphite-900` | `#13202A` | Instrument panel and primary hover           |
| `graphite-875` | `#1D292D` | Dark nested surface and divider              |
| `slate-900`    | `#132331` | Primary light-theme text                     |
| `slate-700`    | `#344955` | Secondary text                               |
| `slate-600`    | `#52616B` | Muted text                                   |
| `slate-500`    | `#6F8088` | Dark-theme structural line and tertiary text |
| `slate-400`    | `#8FA0A8` | Dark-theme muted text                        |
| `slate-300`    | `#B7C5CC` | Strong divider                               |
| `slate-200`    | `#D4DEE3` | Standard divider                             |
| `slate-100`    | `#E8EEF1` | Muted surface                                |
| `paper-100`    | `#E9EAE6` | Warm grouped surface                         |
| `paper-50`     | `#F4F4F1` | Main editorial workspace                     |
| `lab-50`       | `#F4F7F8` | Cool measurement inset                       |
| `white`        | `#FFFFFF` | Active document surface                      |
| `teal-700`     | `#006B70` | Selection hover/active                       |
| `teal-600`     | `#007F84` | Selection and evidence linkage               |
| `teal-400`     | `#35C4B8` | Active linkage and focus on dark surfaces    |
| `teal-100`     | `#D9F0F0` | Selected background                          |
| `amber-800`    | `#8A5600` | Provisional text and icon                    |
| `amber-300`    | `#F4C15D` | Provisional/caution on dark surfaces         |
| `amber-100`    | `#FFF1CC` | Provisional surface                          |
| `green-700`    | `#157A52` | Verified text and icon                       |
| `green-400`    | `#4DCB91` | Verified text and icon on dark surfaces      |
| `green-100`    | `#DDF3E8` | Verified surface                             |
| `red-700`      | `#B33A3A` | Conflict, failure, danger                    |
| `red-300`      | `#FF8585` | Conflict, failure, danger on dark surfaces   |
| `red-100`      | `#FBE3E3` | Conflict surface                             |

#### Semantic assignments

| Token                             | Assignment                                |
| --------------------------------- | ----------------------------------------- |
| `surface-shell`                   | `graphite-950`                            |
| `surface-workspace`               | `paper-50`                                |
| `surface-document`                | `white`                                   |
| `surface-muted`                   | `paper-100`                               |
| `surface-measurement`             | `lab-50`                                  |
| `surface-instrument`              | `graphite-975`                            |
| `surface-instrument-panel`        | `graphite-900`                            |
| `text-primary`                    | `slate-900`                               |
| `text-secondary`                  | `slate-700`                               |
| `text-muted`                      | `slate-600`                               |
| `text-on-instrument`              | `white`                                   |
| `text-secondary-on-instrument`    | `slate-300`                               |
| `text-muted-on-instrument`        | `slate-400`                               |
| `border-default`                  | `slate-200`                               |
| `border-strong`                   | `slate-300`                               |
| `border-on-instrument`            | `slate-500`                               |
| `action-primary`                  | `graphite-950`                            |
| `action-primary-hover`            | `graphite-900`                            |
| `action-on-instrument`            | `white`                                   |
| `text-on-action-instrument`       | `graphite-950`                            |
| `selection-active`                | `teal-600` on light, `teal-400` on dark   |
| `focus-ring`                      | `teal-600` on light, `teal-400` on dark   |
| `state-verified`                  | `green-700`                               |
| `state-verified-on-instrument`    | `green-400`                               |
| `state-provisional`               | `amber-800`                               |
| `state-provisional-on-instrument` | `amber-300`                               |
| `state-conflicting`               | `red-700`                                 |
| `state-conflicting-on-instrument` | `red-300`                                 |
| `state-missing`                   | `slate-600`                               |
| `state-rejected`                  | `slate-700` with strike or rejection icon |

Color never carries meaning alone. Every state includes a text label and, where space allows, a consistent icon.

Dark surfaces remap state text to `green-400`, `amber-300`, and `red-300`. Do not simply invert the light palette. Measure text, focus, divider, and control-boundary contrast against the composed dark surface.

Validated key pairs:

| Foreground / background      |  Contrast |
| ---------------------------- | --------: |
| `white` / `graphite-950`     | `18.97:1` |
| `slate-300` / `graphite-900` |  `9.36:1` |
| `slate-400` / `graphite-900` |  `6.12:1` |
| `teal-400` / `graphite-975`  |  `9.15:1` |
| `white` / `teal-600`         |  `4.81:1` |

These checks do not replace testing the final composed state, especially when opacity, imagery, or overlays are involved.

#### Component token assignments

Components reference semantic tokens; raw primitives never appear in component styles.

| Component token                           | Semantic assignment                                |
| ----------------------------------------- | -------------------------------------------------- |
| `command-bar-background`                  | `surface-shell`                                    |
| `phase-masthead-background`               | `surface-workspace`                                |
| `focus-frame-background`                  | `surface-document` or `surface-instrument` by mode |
| `focus-frame-radius`                      | `radius-focus-frame`                               |
| `pane-divider`                            | `border-default`                                   |
| `event-viewer-background`                 | `surface-instrument`                               |
| `event-viewer-row-background`             | `surface-instrument-panel`                         |
| `event-viewer-row-selected-border`        | `selection-active`                                 |
| `evidence-connector-supporting`           | `selection-active`                                 |
| `evidence-connector-conflicting`          | `state-conflicting`                                |
| `button-primary-background`               | `action-primary`                                   |
| `button-primary-background-hover`         | `action-primary-hover`                             |
| `button-primary-on-instrument-background` | `action-on-instrument`                             |
| `button-primary-on-instrument-text`       | `text-on-action-instrument`                        |
| `control-focus-ring`                      | `focus-ring`                                       |

Non-color semantic tokens follow the same three-layer rule:

| Semantic token           |                 Primitive value |
| ------------------------ | ------------------------------: |
| `radius-control`         |                           `6px` |
| `radius-pane`            |                           `8px` |
| `radius-focus-frame`     |                          `16px` |
| `space-workspace-gutter` | `48px` desktop / `24px` compact |
| `space-phase-entry`      |                          `64px` |
| `duration-feedback`      |                         `120ms` |
| `duration-expand`        |                         `200ms` |

### 4.2 Typography

- Interface and prose: **IBM Plex Sans**, with a system sans-serif fallback.
- Measurements, tolerances, evidence IDs, timestamps, and source rows: **IBM Plex Mono**, with a system monospace fallback.
- Keep IBM Plex rather than adopting an all-monospace or geometric marketing face. The paired Sans/Mono family already supplies the technical precision identified by the UI/UX search without making headings resemble code.
- Use sentence case for headings and actions. Reserve uppercase for compact metadata labels such as `SOURCE` or `NEXT BEST TEST`.
- Use tabular figures for measurements, scores, times, and chart labels.
- Short phase-entry headlines may use tighter leading and balanced wrapping. Active workspace headings use normal wrapping and never force decorative line breaks.

| Role               | Size / line height |        Weight |
| ------------------ | ------------------ | ------------: |
| Phase display      | `40px / 44px`      |           600 |
| Workspace title    | `28px / 36px`      |           600 |
| Key measured value | `28px / 32px`      | 500–600, mono |
| Section title      | `20px / 28px`      |           600 |
| Subsection title   | `16px / 24px`      |           600 |
| Body               | `16px / 24px`      |           400 |
| Compact body       | `14px / 20px`      |           400 |
| Label              | `13px / 16px`      |       500–600 |
| Caption / metadata | `12px / 16px`      |       400–500 |

Keep long-form content between 60 and 75 characters per line. Do not use text smaller than 12px.

Phase display type is allowed only in phase entry, empty, transition, and completion states. At widths below 768px it steps down to `32px / 36px`; it never scales beyond 40px inside the application.

### 4.3 Spacing and density

Use a 4px base scale: `4, 8, 12, 16, 24, 32, 48, 64, 96`.

- Ledger row height: 48–56px.
- Standard control height: 40px.
- Primary procedure/action control: 48px.
- Minimum pointer target: 44px when controls may be used on a touch display.
- Pane padding: 16px at compact widths, 24px at standard desktop widths.
- Major workspace separation: 32px, or a structural divider plus 24px padding.
- Phase-entry separation: 48–64px; use 96px only on an empty or completion view with no active work competing below it.

Density should come from alignment and grouping, not tiny type or reduced hit targets.

The investigation workspace targets **density 8/10**: compact rows and aligned figures, but not 12px body copy or 36px table rows. Phase mastheads and completion states target **density 4/10**. Do not apply one density setting to the entire product.

### 4.4 Shape, borders, and elevation

- Default control radius: 6px.
- Standard pane or inset radius: 8px.
- One primary focus frame may use a 12–16px radius.
- Status chips may use a full radius only when their compact shape aids scanning.
- Use 1px dividers to structure the primary workspace.
- Use shadows only for content that genuinely overlays another layer: dialogs, popovers, and menus.
- A single focus frame may use one restrained shadow to separate it from the case-file surface. Nested content inside that frame returns to borders and tonal contrast.
- Do not apply shadows to every evidence item or hypothesis.
- Do not use glow, inner neon strokes, glass blur, or neumorphic shadows.

### 4.5 Grid and imagery

- The application grid is structural: 12 columns on wide desktop, 8 on tablet, and 4 on small screens.
- A decorative technical grid is optional only on phase-entry, empty, or logic-overview surfaces. Use a 32px or 40px repeat with lines no stronger than 4% against the background.
- Fade the grid before it crosses long-form text, tables, or form controls.
- Product imagery must show real evidence, a clearly labelled synthetic inspection image, or the illustrative machine model. Do not use atmospheric stock landscapes or abstract AI imagery inside the investigation flow.
- Data graphics use direct labels and a table/text alternative. Do not reproduce decorative radar plots or charts without meaningful axes and values.

### 4.6 Motion

| Motion                      |  Duration | Intent                                     |
| --------------------------- | --------: | ------------------------------------------ |
| Press and hover feedback    | 100–150ms | Confirm direct manipulation                |
| Expand or collapse          | 180–220ms | Preserve local continuity                  |
| Cause reorder               | 280–340ms | Make ranking change understandable         |
| Phase transition            | 240–320ms | Show movement through the investigation    |
| Instrument-stage enter/exit | 220–280ms | Preserve mode continuity without spectacle |

Animate transform and opacity rather than layout properties. A ranking must reach its correct state even when animation is interrupted. Respect `prefers-reduced-motion`; never delay access to evidence for animation.

Do not add marketing scroll reveals, marquee motion, parallax, auto-advancing carousels, or ambient pulsing. Animate at most one or two causally relevant elements in a view: for example, the cause that reorders and the evidence relationship that changed.

## 5. Core component specifications

### Phase masthead

- Anatomy: metadata eyebrow, phase headline, one-sentence state summary, optional critical value, and at most one primary action.
- The headline names the task state, not a slogan: **Compare the evidence**, **Inspect the cartridge path**, or **Verification passed**.
- When the workspace becomes active, collapse the display headline to a 28px workspace title while preserving phase and case orientation.
- Decorative grid lines are `aria-hidden`; the semantic heading order remains sequential.

### Focus frame

- Use one focus frame when a view needs a dominant object such as the selected evidence thread, 3D model, annotated inspection image, or verification comparison.
- The frame may be light or use the dark instrument surface. Its title, current state, and escape/back action remain visible.
- Do not place a second equally dominant frame beside it. Supporting information becomes rows, a narrow rail, or a drawer.

### Container discipline

Create a bordered or filled container only when at least one is true:

1. The content has an independent interaction state.
2. It needs a distinct background for legibility or mode separation.
3. It is a movable/resizable pane.
4. It must remain grouped when surrounding layout collapses.

Otherwise use alignment, whitespace, indentation, or a divider. This prevents the dense operational reference from turning FlowPilot into a generic bento dashboard.

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
- Use a sticky column header only when the ledger itself is the primary scroll region; otherwise keep one page scroll.
- Hover may preview linked claims, but click/keyboard selection establishes the persistent selection.

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
- Use compact labelled nodes, restrained curves, and generous negative space similar to a decision diagram—not a network map.
- Keep evidence IDs and relationship labels outside connector crossings. Never place an uncalibrated confidence percentage in the center of the graph.
- Keyboard focus and row selection must reveal the same relationships as pointer interaction.
- Provide a non-visual text list containing the same relationship information.

### Machine-event viewer

- The import preview remains a light document surface. A user may open **View raw events** into a bounded dark instrument stage.
- Columns: local timestamp, event family, normalized summary, recognition state, and source line. Raw payload expands inline or in a detail rail.
- Use IBM Plex Mono for timestamps, source references, and raw payload; keep event summaries in IBM Plex Sans.
- Recognized, unknown, out-of-order, and continuation states use a text label plus icon. A small status dot may reinforce the label but never replace it.
- Preserve source order. If sorted by event time, show the active sort and explain timestamp regressions.
- Do not render a decorative terminal, fake command prompt, scan line, radar, or glow.

### Next best test panel

- Contains one primary action.
- States the recommended test, expected time, procedure authority, and current safety status.
- **Why this test** explains which competing causes or evidence gaps the test separates.
- If the test is unavailable, retain the panel and explain why; do not silently hide it.
- A completed test cannot remain the next recommendation unless a repeat is explicitly required and explained.
- Give this panel the strongest action contrast in the diagnosis workspace. Other panes use selection color, not competing primary buttons.

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
- On the dark model stage, keep instruction and caution text on an opaque high-contrast surface rather than directly over the model.

### Verification comparison

- Show pre-action, post-action, golden range, units, and sample count.
- Use direct labels where practical and provide a table alternative.
- Do not use green alone to indicate recovery.
- Resolution requires an explicit textual statement such as **Within golden range — verification passed**.

### Operational metric

- Use a large measured value only when it changes the current decision: deviation, elapsed time, or post-action result.
- Pair the number with a plain-language label, unit, reference range, and state. Do not create an “overall health score” merely to imitate a dashboard.
- A row may contain at most three peer metrics. More values belong in a table or measurement detail.

### Buttons and inputs

- One primary action per view or decision region.
- Standard button height is 40px; high-consequence procedure actions are 48px.
- On light surfaces, the primary action is graphite with white text. On dark instrument surfaces, it reverses to white with graphite text. Teal indicates selection, focus, and evidence linkage rather than competing with every call to action.
- Buttons use 6px corners by default. Reserve pill shapes for compact status/filter chips, not standard actions.
- Inputs have persistent visible labels and helper text where needed.
- Validate on blur or submission, not on every keystroke.
- Errors state the cause and a recovery action beside the relevant field.
- Loading buttons remain labelled, become non-repeatable, and announce progress.

### Icons

- Use one outline icon family, preferably Phosphor, with consistent 1.5–2px stroke at each hierarchy level.
- Standard sizes are 16px for inline metadata, 20px for controls, and 24px for prominent actions.
- Icons beside visible text are decorative and hidden from assistive technology. Standalone icon controls require an accessible name and state.
- Do not use emoji, sparkle symbols, or pseudo-industrial pictograms.

## 6. Responsive behavior

The MVP is desktop-first and optimized for approximately 1440×900. It must remain usable at 1280×720.

| Width         | Behavior                                                                                                              |
| ------------- | --------------------------------------------------------------------------------------------------------------------- |
| `>= 1280px`   | Three-pane 12-column investigation workspace; phase masthead may use split composition                                |
| `1024–1279px` | Evidence ledger plus cause workspace; next test becomes a persistent right drawer                                     |
| `768–1023px`  | One primary pane with labelled tabs and persistent phase/status header                                                |
| `< 768px`     | Case review and simple response capture only; do not compress the full investigation workspace into a phone dashboard |

Avoid nested scrolling. Sticky headers and action bars must not obscure keyboard focus or the final ledger row.

At widths below 768px, remove decorative grids, flatten focus-frame shadows, reduce phase display type to 32px, and prioritize the current observation/action over relationship graphics. A dark instrument stage may become edge-to-edge, but its close/back control and safety label remain visible and outside gesture-conflict zones.

## 7. Accessibility, safety, and honesty

- Meet WCAG AA contrast: 4.5:1 for normal text and 3:1 for large text and meaningful UI boundaries.
- Test light and dark instrument surfaces independently. Muted text on dark panels still requires 4.5:1 when it conveys content; “muted” is not an accessibility exemption.
- Show a visible 2–4px focus indicator with at least 3:1 state contrast.
- Ensure logical keyboard order matches the visual pane order.
- Provide accessible names and state for every icon control.
- Do not rely on hover, color, animation, or 3D position alone.
- Provide text and keyboard alternatives to drag, orbit, and gesture interactions.
- Use polite live announcements for ranking and status updates without moving focus unexpectedly.
- Decorative grids, connector flourishes, and background imagery are hidden from the accessibility tree. The evidence thread exposes the same relationships as structured text.
- Respect reduced motion and browser zoom.
- Keep **Simulated data**, **AI-generated finding**, **Illustrative model**, and **Provisional evidence** labels persistent wherever applicable.
- Never imply that FlowPilot initiated machine control.
- Site procedure and domain-expert authority outrank generated guidance.
- No content auto-scrolls, auto-rotates, or advances without a visible pause/stop mechanism; the MVP should avoid such behavior entirely.

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

### M0 prototype handoff

The `/prototype` storyboard uses the existing paper workspace and bounded dark
procedure stage. Report, Log, Questions, Diagnose, Inspect, Correct, Verify, and
Summary show the golden journey; Back and Restart operate only on local preview
state. Later phase labels indicate progress rather than bypassing confirmation gates.
The negative inspection branch stops at the next material-check recommendation.

The semantic assembly registry uses these stable IDs and labels:

| Node ID             | Visible label     |
| ------------------- | ----------------- |
| `fluid_reservoir`   | Fluid reservoir   |
| `feed_tube`         | Feed tube         |
| `jet_actuator`      | Jet actuator      |
| `service_cartridge` | Service cartridge |
| `nozzle`            | Nozzle            |
| `vision_camera`     | Vision camera     |
| `substrate_tray`    | Substrate tray    |

Procedure presets are `assembly_overview`, `cartridge_closeup`, and `nozzle_closeup`.
Future model coordinates use Y up, with explicit camera position and look-at target.
The 2D diagram and text instructions share the current procedure step. A textual
current-part label accompanies the outline highlight; all steps remain accessible
without interacting with the graphic. Play/pause and orbit controls belong to M2.

Wireframe evidence, scores, images and outcomes are precomputed. Keep the prototype,
simulated-data, illustrative-model and pending-expert-review labels visible. The
completed summary is a preview, not a persisted case.

Before considering a surface complete, verify:

- The current phase and one primary next action are obvious.
- The view uses no more than one expressive device and one dominant focus frame.
- Supporting, conflicting, missing, rejected, provisional, and verified evidence are distinguishable without color alone.
- Every displayed claim resolves to evidence or a cited source.
- Simulated, illustrative, heuristic, and AI-generated content is labelled.
- A completed test is not incorrectly presented as the next test.
- Negative and positive inspection outcomes are both reachable.
- The interface uses structural dividers and whitespace rather than unnecessary cards.
- Phase-display typography disappears or collapses once it would compete with active evidence.
- Dark instrument stages remain bounded, high-contrast, and escapable; body text is not dimmed for atmosphere.
- No marquee, decorative radar, giant clipped word, fake terminal, glow, parallax, or auto-advancing carousel entered the product UI.
- Primary actions are graphite on light and reversed on dark; teal remains selection/linkage, and red/amber/green remain semantic.
- Icons use one vector family and consistent stroke/size tokens; no emoji acts as an icon.
- No deferred feature appears as functioning navigation.
- Keyboard, focus, zoom, reduced-motion, error, loading, empty, and offline states work.
- The layout works at 1440×900 and 1280×720 without horizontal page scrolling.
- The full report-to-verification journey can be completed without developer-only controls.

## Learning Database workspace

Use a graph-first three-pane layout: 246px searchable case browser, flexible central relation graph, and 330px source/review inspector. Desktop panes scroll independently within the available viewport. Under 1150px move the inspector below; on phones stack the browser, graph and details. Keep standard controls at least 44px tall. Keep existing paper, graphite and teal for the workspace. Graph-specific categorical tokens distinguish record types; they do not encode approval or repair success.

Show real Saved cases / Reusable experiences / Pending review totals, then a compact Recorded → Prepared → Reviewed → Reused lifecycle. One investigation remains one case through all updates. Group equivalent simulated experiences with accessible source links; never present these counts as probabilities.

Graph types have distinct colors, labels and shapes: blue rounded Case, amber diamond Symptom, slate hexagon Component, violet triangle Possible cause, green circular Finding, orange square Action and rose pentagon Outcome. Always show the complete legend. Selection preserves category fill and adds an outline; unrelated nodes fade. Compact case identifiers keep the overview readable, with full titles in the case browser and accessible list. Fit the layout to the available graph area; the keyboard list opens over the graph without collapsing its canvas. Dashed possible-cause edges are explicitly hypotheses. Node/edge selection highlights a neighborhood and opens provenance. Provide fit/focus/zoom controls and keyboard-operable node/relationship lists. The graph cannot edit or publish facts by dragging.

Experience details separate source facts, reviewer interpretation, generation mode and lifecycle state. Evidence and version history use progressive disclosure. Review requires visible reviewer/reason fields and explicit confirmation. Pending, live, cached and manually edited preparation are distinct. On desktop Diagnose, place Current assessment and Past experience together beneath the next-check action. Keep source links and the knowledge version visible; disclose the longer lesson and match conditions on demand. At narrow widths stack the panels. Historical references remain separate from current-case evidence.

## Guided Context intake

Show one active condition at a time with an explicit Continue action, a concise evidence-backed planning summary and an editable answer/source summary. Do not imply every click invokes AI: distinguish live AI-guided questions from rule guidance. Free-text interpretations require explicit technician confirmation. Show confirmed and remaining conditions instead of a fixed question count; clarification can change the number of turns. Keep log upload optional and collapse confirmed log details with a visible review/change control. Preserve keyboard focus, 44px targets and the existing paper/graphite/teal palette. Reduced-motion users receive the same immediate state transitions without decorative delays.
