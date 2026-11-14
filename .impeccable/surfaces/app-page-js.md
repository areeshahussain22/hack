---
version: 1
slug: "app-page-js"
primary_target: "app/page.js"
related_targets: ["app/globals.css","app/layout.js"]
---

# Chat (app/page.js)

Mode: Operate. Shoppers on phones (EN / Urdu / Roman Urdu) get a checkable policy answer; judges watch a 1920×1080 recording. UI-only: lib/ and app/api/ untouched. Mic, language tag, Listen/Stop and translation_note are slots until the teammate's code lands.

## Direction contract

THESIS: Airport wayfinding for a support chat: every bot reply opens with one sign band that states the kind of answer before it is read. Refuses the grey-bubble AI chat.

OWN-WORLD: White ground, warm-tinted neutrals, ink #161714 panels with white type, black pictogram squares, yellow #FFC915 reserved for "your move" (clarify band, send). Source Sans 3 in sentence case, tabular numerals; Noto Nastaliq Urdu. 2px corners, 1px rules, no shadows.

STORY: Shopper asks, sees the band (answer / your turn / not covered / limited / error), reads the answer, taps a § chip to see the exact quote, checks the receipt total, trusts it.

FIRST VIEWPORT: Ink header (NovaBot, promise, status dot). 760px column: empty state with four example questions; composer pinned bottom with textarea, mic + EN/اردو tag, yellow Send.

FORM: Wayfinding bands (challenger wayfinding-cartography-signage-terminal-yellow-wayfinding, chosen over assigned candidate 5). seed:33aadd397043eb73. Signature: band text wipes in like a sign update (180ms, none under reduced motion).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
