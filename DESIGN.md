---
name: NovaBot
description: Policy answers for NovaCart shoppers, signposted like an airport and backed by sources.
colors:
  ground: "#ffffff"
  page: "#f7f7f4"
  ink: "#161714"
  muted: "#4f524c"
  rule: "#dcddd8"
  rule-strong: "#9c9f98"
  pale: "#e8e8e3"
  action: "#ffc915"
  action-hover: "#f2b800"
  brick: "#9a3324"
  on-ink: "#ffffff"
  on-ink-muted: "#c9cbc4"
typography:
  headline:
    fontFamily: "Source Sans 3, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Source Sans 3, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.3
  band:
    fontFamily: "Source Sans 3, system-ui, sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 700
    lineHeight: 1.35
  answer:
    fontFamily: "Source Sans 3, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "Source Sans 3, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "\"tnum\""
  label:
    fontFamily: "Source Sans 3, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 700
    lineHeight: 1.4
  urdu:
    fontFamily: "Noto Nastaliq Urdu, serif"
    fontSize: "1.15em"
    fontWeight: 400
    lineHeight: 2.2
rounded:
  sm: "2px"
spacing:
  s1: "4px"
  s2: "8px"
  s3: "12px"
  s4: "16px"
  s6: "24px"
  s8: "32px"
  s12: "48px"
components:
  band-answer:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
    typography: "{typography.band}"
    rounded: "{rounded.sm}"
    padding: "8px 16px 8px 8px"
    height: "56px"
  band-clarify:
    backgroundColor: "{colors.action}"
    textColor: "{colors.ink}"
    typography: "{typography.band}"
    rounded: "{rounded.sm}"
    padding: "8px 16px 8px 8px"
    height: "56px"
  band-muted:
    backgroundColor: "{colors.pale}"
    textColor: "{colors.ink}"
    typography: "{typography.band}"
    rounded: "{rounded.sm}"
    padding: "8px 16px 8px 8px"
    height: "56px"
  band-limited:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    typography: "{typography.band}"
    rounded: "{rounded.sm}"
    padding: "8px 16px 8px 8px"
    height: "56px"
  band-error:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.brick}"
    typography: "{typography.band}"
    rounded: "{rounded.sm}"
    padding: "8px 16px 8px 8px"
    height: "56px"
  band-pictogram:
    backgroundColor: "{colors.on-ink}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    size: "40px"
  button-send:
    backgroundColor: "{colors.action}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "48px"
  button-send-hover:
    backgroundColor: "{colors.action-hover}"
  button-icon:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    size: "48px"
  button-icon-on:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
  button-retry:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "40px"
  chip-source:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "4px 12px"
    height: "32px"
  chip-source-pressed:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
  segmented-option:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.muted}"
    padding: "0 12px"
    height: "28px"
  segmented-option-pressed:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
  input-composer:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "11px 12px"
    height: "48px"
  top-bar:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
    height: "64px"
  user-message:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
  receipt:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    width: "560px"
  quote-block:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "16px"
  source-panel:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    padding: "24px"
    width: "400px"
---

# Design System: NovaBot

## Overview

**Creative North Star: "The Wayfinding Terminal"**

NovaBot reads like airport signage applied to a support chat. Every bot reply opens with one sign band that tells the shopper what kind of answer is coming (answer, your turn, not covered, limited, error) before a word of it is read. Below the band the answer sits as plain, generous text on a white ground, followed by the evidence: source chips, a receipt-style calculation, and an expandable account of how the answer was worked out.

The world is flat, ruled, and high-contrast. Ink panels with white type, black pictogram squares, warm-tinted greys, 1px rules and 2px corners. Terminal yellow is reserved for "your move": the clarify band, the Send button, text selection, and the focus halo. There are no bubbles, no gradients and no drop shadows; depth comes from ink versus white and from rules.

It is bilingual by construction. English and Roman Urdu set in Source Sans 3; Urdu set in Noto Nastaliq Urdu with much larger line height, with file names, section refs, rupee amounts, dates and percentages isolated left-to-right inside Urdu runs.

**Key Characteristics:**
- One sign band per bot reply, colour-coded by answer kind, with a pictogram square at its leading edge.
- Ink (#161714) and white carry the system; yellow means "act now" and nothing else.
- 2px corners everywhere, 1px rules, a 3px double rule for totals.
- Sentence case throughout, tabular numerals on by default.
- A single 760px reading column; sources open in a side panel (desktop) or bottom sheet (phone).
- Motion is short and directional (120 to 240ms, one ease-out curve) and disappears under reduced motion.

## Colors

A neutral, warm-tinted ink-and-paper palette with one signal yellow and one brick red for failure.

### Primary
- **Wayfinding Ink** (ink): the answer band, the top bar, pictogram squares, pressed chips and toggles, the 1px strong rules above lists, receipts and panel heads, and all body text.
- **Terminal Yellow** (action): "your move" only. The clarify band, the Send button, the loading progress bar, text selection, and the outer focus halo. Hover deepens to **Struck Yellow** (action-hover) on Send.

### Secondary
- **Brick** (brick): errors only. Error band text and 2px inset outline, its pictogram square, warning notes.

### Neutral
- **Ground White** (ground): the page, inputs, chips, buttons at rest, and the source panel.
- **Paper** (page): hover fill on rows and quiet buttons, disabled textarea, the quote block in the source panel.
- **Pale Stone** (pale): the not-covered band, the not-covered tag, pressed (active) fill on rows and chips.
- **Rule** (rule): hairline dividers between rows, parts, receipt lines, and the composer top edge.
- **Strong Rule** (rule-strong): 1px borders on interactive controls (chips, user message, textarea, icon buttons, segmented control), scrollbar thumb, the sheet handle.
- **Muted Ink** (muted): secondary text: hints, chip titles, sub-lines, meta, placeholders.
- **On-Ink White / On-Ink Muted** (on-ink, on-ink-muted): type on ink surfaces; muted for the header promise and band detail.

### Named Rules
**The Your-Move Rule.** Yellow appears only where the shopper must act or where focus is: clarify band, Send, selection, focus halo, progress. Never as decoration, never as a heading colour.

**The Band Tone Rule.** Each answer kind owns exactly one band treatment: ink fill (answer), yellow fill (your turn), pale fill (not covered), white with 2px ink inset (limited, loading), white with 2px brick inset (error). Do not invent a sixth tone without a sixth answer kind.

## Typography

**Body Font:** Source Sans 3, variable 400 to 700 (with system-ui, sans-serif)
**Urdu Font:** Noto Nastaliq Urdu, variable (with serif)

**Character:** One humanist sans does all Latin work, from header to receipt, in sentence case with tabular numerals; Nastaliq carries Urdu with the vertical room it needs. Hierarchy comes from weight and the band, not from a display face.

### Hierarchy
- **Headline** (700, 1.75rem, 1.2, -0.015em; 1.375rem on phones): the empty-state question prompt only, balanced, max 32ch.
- **Title** (700, 1.25rem, 1.3): source panel heading.
- **Band** (700, 1.1875rem, 1.35; 1.0625rem on phones): sign band label; band detail drops to 500.
- **Answer** (400, 1.25rem, 1.5; 1.125rem on phones): the main answer text, max 68ch.
- **Body** (400, 1rem, 1.5; 0.9375rem on phones): messages, hints, related rules, max 68ch.
- **Label** (700, 0.8125rem): chip refs, receipt summaries, step sources, status. Secondary small text (notes, step reasons, dates) sits at 0.875rem in muted ink.

### Named Rules
**The Nastaliq Room Rule.** Urdu text is set 1.15x the surrounding size with line height 2.1 to 2.2 (2 in the composer). Never let a component line height override it.

**The LTR Island Rule.** Inside Urdu, file names, § refs, Rs. amounts, ISO dates and percentages are wrapped as left-to-right isolates and set back in Source Sans 3 at 0.87em.

**The Sentence Case Rule.** No uppercase labels and no letterspaced small caps; the band carries the category.

## Layout

A single centred reading column of 760px plus 24px gutters (16px on phones), shared by the top bar, conversation, voice row and composer so all edges align. The top bar is sticky (64px; 60px on phones, where the promise wraps to a second row beside the status). The composer is sticky at the bottom with a 1px top rule and safe-area padding.

Spacing follows a 4px base scale (4, 8, 12, 16, 24, 32, 48). Replies are separated by 32px (24px on phones); within a reply, parts stack at 12 to 16px with a hairline between multi-part answers. User messages align to the trailing edge, max 560px.

At 1280px and wider an open source panel (400px) docks to the right without a scrim and the column slides left to stay centred in the remaining space (200ms). Below 1280px the panel overlays with a 35% ink scrim; at 640px and below it becomes a bottom sheet (max 80dvh) with a grab handle.

## Elevation & Depth

Flat. No drop shadows anywhere. Depth and grouping come from ink versus white, Paper fills, and rules: 1px hairlines between rows, 1px ink rules to open a list or panel, and a 3px double ink rule above a total. Outlined bands use a 2px inset ring rather than a border so every band keeps the same box size. Overlays (panel, sheet) separate by a 1px ink edge and, when modal, a scrim.

### Named Rules
**The Ruled Not Lifted Rule.** Separate things with a rule or a fill change, never a shadow. The only box-shadows are the focus halo and the 2px inset band outlines.

## Shapes

Near-square. Every container, button, chip, pictogram square and input uses a 2px radius; the sheet rounds its top corners only. Pictograms are square tiles (40px; 36px on phones; 24px numbered step tiles) holding 2px-stroke line icons. The only circles are the header status dot and its ring.

## Components

### Sign Band (signature)
The one element every reply opens with. Minimum 56px tall, 2px corners, band typography, a 40px pictogram square at the leading edge (inverse colours of the band), label then " · " detail runs, and a trailing down arrow on the clarify band pointing at the composer. Text wipes in left to right via clip-path (180ms ease-out), like a sign updating. Loading uses the limited treatment plus a 3px yellow progress sliver sliding along the bottom edge; under reduced motion the sliver is removed.

### Buttons
- **Shape:** 2px corners.
- **Send (primary):** Terminal Yellow fill, ink text, 1px ink border, 48px tall, 700 weight, label plus arrow; collapses to a 48px square icon on phones. Hover deepens to Struck Yellow; active nudges down 1px. Disabled loses the yellow emphasis to muted text and strong-rule border.
- **Icon button (mic):** 48px square, white with strong-rule border; hover borders ink; on-state fills ink.
- **Retry / close:** white, 1px border (ink for retry, strong rule for close), hover to Paper or ink border.
- **Listen:** quiet text button, transparent border that turns strong rule on hover, ink fill when pressed.

### Chips
- **Style:** source chips read "file §section" in bold then the short title in muted ink, always in that order. White, 1px strong-rule border, 32px min height, label size.
- **State:** hover borders ink; active fills Pale Stone; pressed (its source open) fills ink with white ref and on-ink-muted title.
- **Not-covered tag:** a Pale Stone pill with a dash icon, 0.875rem semibold, used per part in multi-part answers.

### Receipt
A ruled table under a "Working" disclosure, open by default, max 560px. 1px ink top rule, hairlines between rows, label plus muted sub-line (expression and source, LTR-isolated), amounts right-aligned with tabular figures. The final row is the total: 3px double ink rule, band size, bold.

### Disclosures
Summary rows in label type with a chevron that rotates 90° when open (150ms); hover underlines. "How this was worked out" lists numbered steps on 24px ink squares.

### Inputs / Fields
- **Composer textarea:** white, 1px strong-rule border, 2px corners, 48px min growing to six lines; hover borders ink; disabled fills Paper with muted text. Switches to Nastaliq when the text is Urdu.
- **Focus (all controls):** 2px ink outline offset 2px plus a 4px Terminal Yellow halo.
- **Voice language segmented control:** joined options in one strong-rule frame, 28px tall, 48px min width, divided by 1px inline-start rules; pressed option fills ink, hover fills Paper. The Urdu option is set in Nastaliq.

### Navigation
The ink top bar: wordmark (700, 1.125rem), muted promise line, and a trailing status with a 10px ringed dot (green available, amber limited, grey pending) and semibold label.

### Source Panel / Sheet
White, 1px ink leading edge, 24px padding. Head has the "File NN · §x" title, muted sub-title and a 40px close square over a 1px ink rule. The quote sits in a Paper block (1.125rem, 1.6) wrapped in typographic quotes, with the file path below in muted label size. Slides in from the right (200ms) or up from the bottom on phones (240ms).

### Example Rows (empty state)
Full-width ruled rows under a 1px ink top rule: 40px ink pictogram square, question text, muted language tag. Hover fills Paper and turns the pictogram yellow on ink text; active fills Pale Stone.

## Do's and Don'ts

### Do:
- **Do** open every bot reply with exactly one sign band in the tone that matches its answer kind.
- **Do** reserve Terminal Yellow (#ffc915) for clarify, Send, selection, focus and progress.
- **Do** use 2px corners, 1px rules and the 4px spacing scale on every new surface.
- **Do** show sources as "file §section · title" chips that open the exact quote.
- **Do** isolate file names, § refs, Rs. amounts, ISO dates and percentages as LTR runs inside Urdu, and give Urdu line height 2.1 or more.
- **Do** keep all motion on the single ease-out curve (cubic-bezier(0.16, 1, 0.3, 1)) between 120 and 240ms, and make it instant under reduced motion.
- **Do** use 2px-stroke line SVG icons in square pictogram tiles.

### Don't:
- **Don't** use chat bubbles, grey AI message fills or avatars for bot replies.
- **Don't** add drop shadows or gradients; separate with rules and fills.
- **Don't** use yellow as decoration, a heading colour, or a second accent.
- **Don't** set uppercase or letterspaced labels; sentence case only.
- **Don't** introduce a display typeface; hierarchy is weight, size and the band.
- **Don't** hard-code colours outside the :root tokens.
