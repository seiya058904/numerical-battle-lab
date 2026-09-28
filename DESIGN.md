# Collector workbench — Numerical Battle Lab

## Visual authority

The approved ceremonial hall establishes the material language: black marble architecture, gold and platinum collectible cards, centered title, sculptural emblems and a brass VS instrument. The user's subsequent comparison supersedes a rigid screenshot composition: combine those materials with the earlier version's visible selection, complete attributes and useful controls. The product must work with all 96 cards, not just the two reference heroes.

Desktop uses two flowing card columns and a central command instrument. Each column begins with a persistent search and card selector, followed by the collectible face and its complete combat archive. BP comparison, editable level, primary attributes and exact HP remain on the card. The center provides start, speed, Seed, replay and a new match; full log and statistics remain visible below. Search feedback stays next to its input. Nothing essential depends on hovering over tiny decoration or opening an unlabeled drawer.

Use Segoe UI / Microsoft YaHei / PingFang for controls, Chinese names, labels and data. Reserve serif type for the English masthead, BP, large rarity lettering and VS. Root type never shrinks with viewport height. Above 2000px it scales within a bounded 16–28px range. Below 1000px, stack cards rather than compressing values into three columns; primary stats use two columns, secondary stats have an explicit disclosure, and transport stays fixed with 44px targets. Input type remains 16px on narrow screens. During mobile combat, compact identity/HP plates keep both contenders and the instrument visible. Result actions include same-Seed replay, new-Seed battle and adjustment.

Live values remain authoritative. The reference's illustrative levels, HP, stats, seed and English rarity labels do not override the real 96-card / 12-rarity product. The existing card pool and rarity assignment are read-only; users search/select heroes and change their levels. All visible controls are functional DOM elements.

## Materials and assets

Generated with the built-in imagegen tool using the approved image as the reference; converted to WebP with alpha preserved. No reference screenshot is used as an interactive page background or as fake numerical content.

Final production prompt briefs:

- `assets/hall.webp`: preserve the exact reference camera, black marble art deco hall, brass pilasters, overhead warm lights and reflective floor; remove every card, emblem, text and interface element, reconstruct the empty environment.
- `assets/star.webp`: isolate the left card's elongated faceted gold compass star and concentric machined rings, realistic scratched metal and recessed facets; transparent background, no lettering or card frame.
- `assets/shield.webp`: isolate the right card's platinum shield with central beveled spine and concentric rings; transparent background, no lettering or card frame.
- `assets/frame.webp`: reproduce the gold chamfered multi-beveled collectible frame, four recessed fasteners and blank black textured face; remove all emblem, text, numbers and controls; transparent outside the frame.
- `assets/dial.webp`: reproduce the concentric brass VS instrument and blank black enamel face, tick marks and metallic glints; remove VS/READY lettering and surrounding UI; transparent outside the dial.
- `assets/console.webp`: reproduce the wide blackened-brass console with a worn gold central button plate and black side plates; retain bevels and end caps, remove all text, inputs, buttons and icons; transparent background.

Silver frames use grayscale only on the material layer. Data and semantic team colors retain their original colors. Intermediate rarity seals preserve the existing deterministic engraved geometry; C/C+ and XS tiers use the physical hero sculptures. Rarity letters and actual labels remain visible independently of artwork.

## Motion and accessibility

Keep the existing READY → ENGAGE → BATTLE → RESULT presentation states, attack anticipation and impulse, HP interpolation, selection reveal and result choreography. Hover tilts the collectible face only, leaving selection and attribute controls stationary; focused controls suppress tilt. HP follows its own card rather than floating beside the instrument. The start label announces the locked playback state. Environmental motion is subordinate to the two cards. The event-driven particle canvas remains capped at 180 particles / 3.5 million pixels. Hidden pages clear transient work. Reduced motion disables particles, transforms and ambient loops without changing any combat output.

Labelled inputs, native selectors, keyboard focus and all three playback speeds remain functional. Seed is directly visible in READY without a focus-driven toggle. Card names wrap in flow when needed. Disabled controls stay visible on desktop during playback. Full stats do not require a separate overlay. Maintain regression checks for all 96 heroes at level 100, all 12 rarity emblems, 320/390/768/1024/1536/3840 widths, repeated mobile replay and reduced motion.

## Numerical boundary

Do not change `src/cards.js`, `src/power.js` or `src/battle.js` for this presentation task. Preserve the frozen 1,920-simulation digest and identical event lists across playback speeds. Compact summary metrics derive only from the same immutable battle events as the full summary table.
