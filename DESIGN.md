---
name: Numerical Battle Lab — twelve visual editions
description: One deterministic duel, twelve complete material systems.
colors:
  collector-bg: "#080c0d"
  collector-ink: "#e6e7df"
  collector-accent: "#e8c98c"
  lumen-bg: "#edf2f5"
  lumen-ink: "#1c3547"
  lumen-accent: "#275eb0"
  folio-bg: "#eee8d9"
  folio-ink: "#203c32"
  folio-accent: "#26503c"
  pulse-bg: "#18121d"
  pulse-ink: "#f4e6d8"
  pulse-accent: "#ffc28b"
  nocturne-bg: "#101e32"
  nocturne-ink: "#e5edf4"
  nocturne-accent: "#c4d9ee"
  sumi-bg: "#eeefed"
  sumi-ink: "#242e34"
  sumi-accent: "#343e43"
  arcade-bg: "#ecebe5"
  arcade-ink: "#292e46"
  arcade-accent: "#424b9b"
  verdant-bg: "#eeeee5"
  verdant-ink: "#384238"
  verdant-accent: "#875340"
  brutal-bg: "#e3e1dc"
  brutal-ink: "#141414"
  brutal-accent: "#ad3307"
  lacquer-bg: "#170e0d"
  lacquer-ink: "#f3e6d0"
  lacquer-accent: "#d9b25f"
  blueprint-bg: "#f1f4f7"
  blueprint-ink: "#11335a"
  blueprint-accent: "#173f6e"
  aurora-bg: "#0e1219"
  aurora-ink: "#e8f1f6"
  aurora-accent: "#c9b8ff"
typography:
  body:
    fontFamily: '"Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif'
    fontSize: "0.875rem"
    lineHeight: 1.6
rounded:
  folio: "2px"
  lumen-card: "14px"
  pulse-card: "12px"
---

# Twelve editions — Numerical Battle Lab

## Overview

The current product has exactly twelve peer editions: **典藏 / Collector**, **光谱 / LUMEN**, **印记 / FOLIO**, **脉冲 / PULSE**, **星图 / NOCTURNE**, **墨境 / SUMI**, **街机 / ARCADE**, **生息 / VERDANT**, **混凝 / BRUTAL**, **漆金 / LACQUER**, **蓝图 / BLUEPRINT**, and **极光 / AURORA**. Preserve one DOM, one card pool, one simulation and one playback state. The material world changes; the match never does. First visits still use Collector. The original material sources below remain preserved history and the authority for Collector, not a requirement to make every edition metallic.

## Colors

`styles.css` owns the original Collector system. `themes.css` owns shared accessibility refinements and scoped edition rules. Semantic `--blue`, `--red`, `--green` always mean teams and healing; `--gold` is the existing compatibility name for the edition's action accent. New editions additionally use `--surface`, `--surface-muted`, `--edition`, `--shape` and `--panel-shadow`. Native color-scheme, theme-color, caret, selection, focus, scrollbar and disabled states belong to the edition too. Canvas feedback reads the same semantic palette.

## Typography

Collector keeps serif ceremonial lettering; LUMEN uses light optical sans numerals; FOLIO pairs Songti/SimSun names with Georgia figures and left-aligned identities; PULSE uses tabular Consolas/Cascadia instrument figures with readable Chinese sans labels. Local fallbacks avoid font-loading dependencies. Key functional annotations use a 12px floor at normal root size; compact battle rarity/role labels use 11px, while engraving and redundant attribute abbreviations can be smaller. Losing a match dims the crest, never the card's identity text.

## Layout

Two cards, the central controller and lower settlement/log/statistics retain their locations. At 1000px and below, retain the established stacked cards and compact battle identities. A named inline-size container on `.app` adds a 50rem space check above 1000px: enlarged text falls back to a centered single column, rather than squeezing cards around a fixed-width instrument. This is separate from browser zoom's normal viewport reflow. The native theme select is compact and in normal flow on small screens; it contains all eight names and uses platform keyboard/touch behavior.

## Elevation & Depth

Collector retains photographed metal, marble and restrained foil fields. Its background wash is slightly stronger to protect data contrast. LUMEN retains optical glass behind opaque porcelain cards, with a clearer directional card shadow. FOLIO uses quiet generated cotton paper with fine inset ink rules and minimal paper lift. PULSE uses dark polymer, inset signal windows and top/bottom cartridge seams; the thick seams intentionally express that enclosure rather than an alert accent.

## Shapes

| Edition | Card / rank | Central instrument | Settlement and feedback |
| --- | --- | --- | --- |
| Collector | Beveled metal frame, rank-specific metal die and reliquary | Brass circular dial | Metal medal, foil glow and radial impact |
| LUMEN | Porcelain card and V1 circular optical instrument with graded ticks | Pearl circular dial | Open light panel and spectral team ink |
| FOLIO | Paper stock and V1 square print frame with a quiet central diamond | Printed mark with twelve rank pips | Printed verdict, ink strike and square impact |
| PULSE | Dark polymer card and V1 rounded oscilloscope cartridge | Amber monospaced mark over one waveform | Signal readout, trace pulse and square impact |

All 12 ranks retain their exact names and numbered progression. Collector has twelve distinct rank dies; LUMEN progresses through dial markings, and FOLIO/PULSE use their original progress pips. No rank glyph or business value is baked into a bitmap.

## Components

The frozen head registry resolves all twelve stable IDs before CSS. It owns names, short descriptions, browser colors, light/dark scheme, shared surface family, and bounded feedback capabilities. Static native options and renderer keys have explicit consistency tests. The original four module entry order stays unchanged; no shared module or dependency is needed. Best-effort storage uses the existing `nbl.visual-theme` key, defaults to Collector, and safely rejects unknown IDs.

`initTheme()` binds the native selector and one delegated catalogue listener. Both use one application path and emit a presentation notification. The default-collapsed native details catalogue contains only CSS material samples. Switching preserves business DOM, focus, selection, level drafts, Seed intent, expanded statistics, match events, HP interpolation, playback waits and log position.

`themedEmblemMarkup()` mounts exactly one SVG per card/result container. A string-only cache has at most 432 keys (12 themes × 12 tiers × A/B/Result), with no detached nodes. Before replacing a crest, only its own CSS/Web Animations and tracked references are cancelled. Old material particles are discarded without clearing HP counters or replay waits. Neutral DRAW uses a separate mark, never a winner crest. Collector V3, LUMEN V1, FOLIO V1 and PULSE V1 geometry and lettering stay unchanged.

Collector keeps the existing 400-element / 32 KB ceiling, LUMEN its 110-element / 12 KB ceiling, and FOLIO/PULSE their 40-element / 5 KB ceilings. Each new crest has a 110-element / 12 KB ceiling. The one shared canvas remains bounded to 180 particles / 3.5 million pixels. There are no new ambient animation loops, external SVG references, SVG scripts or filters, or raster assets.

## Do's and Don'ts

- Keep the registry, scoped CSS, bounded rank generator, native options and tests consistent. Do not copy the page or initialize a second battle.
- Keep real controls and values in DOM/SVG/Canvas. Images contain only material, light and peripheral space.
- Preserve `src/cards.js`, `src/power.js`, `src/battle.js`, all original assets and the frozen 1,920-simulation digest.
- Keep exact static file manifests in sync. Evidence and exploratory concepts stay outside the production root.
- Distinguish a synthetic DRAW UI fixture from a natural simulated draw; neither the fixture nor instrumentation runs in the product entry point.

## Finishing pass and atelier editions — 2026-10-31

All eight earlier editions received a CSS-only finishing pass: one shared interaction state language (hover, active, disabled, focus-visible) for the start key, speed keys, text buttons and inputs; themed native select arrows and range accent; float numbers drawn with a surface-coloured halo rather than a full-width band over the crest; log round dividers and a current-row marker; ledger striping in the summary table; and a clearer settlement hierarchy (verdict, then winner, then remaining HP) with a single reduced-motion-safe entrance. Static texture now comes from layered CSS gradients only: NOCTURNE star field and survey grid, SUMI paper fibre, ARCADE molded speckle and VERDANT chalk grain. FOLIO carries its cotton stock into archive and settlement; LUMEN uses two-layer porcelain light; PULSE adds recessed windows and one phosphor glow. Collector/LUMEN/FOLIO/PULSE crest geometry and layout are unchanged.

| Edition | Material and typography | Crest / controller | Event and result language |
| --- | --- | --- | --- |
| BRUTAL | Board-marked concrete with tie holes, Arial Black display, square everything, hard offset shadows; red team shifted to crimson so it never reads as the orange accent | Chamfered block whose chamfer and stroke grow with rank, barcode ticks, corner bolts from S; black controller block with orange figures | Two-step slab drop; result panel casts the winner's colour as an offset shadow |
| LACQUER | Black-red urushi, gold line, Songti names, Georgia figures; coral red team for contrast on red-black | Round lacquer box with one to six gilded rings and cloud strokes; lacquer-disc controller with dashed inner ring | Gold glint on the detail ring; double gilded settlement frame |
| BLUEPRINT | White drafting grid, cobalt ink, Consolas figures, dashed rules and a tick ruler under BP | Machined plate with bolt circle (4–14 holes), centrelines and a dimension line; crosshair dial controller | Dash trace on the measurement ring; title-block result with team-coloured edge |
| AURORA | Polar-night gradients under frosted panels (backdrop-filter is progressive; opaque fallback stays readable), light sans, lavender action light kept distinct from healing green | Hexagonal ice crystal; branch count and length grow with rank; glass orb controller | Crystal flare on the inner hexagon; wide-tracked light verdict |

`atelierEmblemMarkup(tier, theme)` renders the four families with the same contract as `naturalEmblemMarkup`: ≤110 elements / 12 KB, no IDs, filters, images, scripts or animation elements, a central reading plane, `rank-detail`/`rank-core` hooks, and COLLECTOR labels on tiers 9 and 11. Impact shapes reuse the existing circle/square/diamond/leaf canvas paths. The catalogue shows twelve tiles, each with a four-colour palette strip.

## Previous extension brief — 2026-10-24

| Edition | Material and typography | Crest / controller | Event and result language |
| --- | --- | --- | --- |
| NOCTURNE | Matte navy survey plate, thin silver rules, clear light sans and tabular figures | Increasing axial constellation polygons, connected stars; open diamond coordinate instrument | Short dashed star traces and diamond expansion; observation-style confirmation panel |
| SUMI | Cool white clean paper, dark ink, spacious Songti names with system UI labels | Six irregular seal families with paired broken-line treatments; offset ink seal controller | Brief ink cut, recovery line plus explicit REGEN/LIFE STEAL and amount; restrained signed verdict |
| ARCADE | Pale molded plastic, indigo controls, warm display windows; bold sans names and monospaced BP | Twelve stepped medals with pixel progress, separate Collector label; inset tactile controller | Short stepped pop and square segments; score-display result, no scanlines or flashing background |
| VERDANT | Chalk specimen plate, muted terracotta action accent, botanical linework; serif names and readable UI | Seed/leaf lobes and veins increase across ranks; organic section controller | Brief unfolding arc and leaf-shaped expansion; specimen result panel, explicit healing text distinct from decorative green |

New theme assets are original deterministic SVG geometry and CSS authored in this repository. No generated bitmap, stock icon, remote font or third-party art is added. Every central rank plane remains quiet and large, including SSS and Collector labels. Teams retain blue/red labels and HP bars; recovery retains the green semantic palette and text/amount cues. Background colors remain usable without any asset requests.

The shared `data-surface=edition` component baseline covers FOLIO/PULSE and the four additions; individual theme selectors own their geometry, borders, typography, controls and response. It does not change the established optical or metal styles. Browser surfaces (selection, caret, scrollbar, focus, invalid/disabled inputs) follow the same tokens. New motion uses the existing event lifecycle and is disabled with reduced motion or paused offscreen/hidden. Short desktop auto-positioning brings both HP rows and the round into view when they fit, without shrinking cards or altering READY composition.

The historical sections below document earlier iterations. For the original four themes, **Final visual decision — 2026-10-14** remains the shape authority; the V2/V3 drafts for LUMEN/FOLIO/PULSE remain superseded. The current eight-theme architecture and catalogue above replace the old four-SVG mounting descriptions.

## Retained Collector provenance and construction

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

Silver frames use grayscale only on the material layer. Data and semantic team colors retain their original colors. The two raster sculptures remain reference assets only; runtime emblems load no bitmap. Hall, frame, dial and console materials remain as established in the collector workbench.

## Collector procedural rarity assets

`RARITY_FINISHES` in `src/app.js` is the presentation-only source of truth for all 12 tiers. Each token row owns metal highlight/shadow, enamel, radial assembly count/reach, ring count, aura strength, orbital period and bounded dust count. These values do not read or change the numerical rarity multiplier.

Collector crests share one manufacturing language: a machined reverse, indexed concentric rings, recessed fasteners, eight-sided bevel planes, enamel inset, extruded path lettering and certification engraving. Polished cuts and a fixed upper-left light make the material recognizable without raster textures. C/C+ start complete; titanium and enamel ranks gain bridges and secondary orbits; S/SS add an imperial field; SSS adds a faceted outer mount; Collector variants add wings and a crown; XS extends cardinal spires; XS Collector adds crossed astrolabe ellipses and the strongest field. Labels and silhouettes carry rank in addition to color.

`emblemMarkup(tier, side)` generates self-contained SVG. Every paint/clip ID is namespaced for A, B or Result. It uses no external references, random values, SVG blur filters or frame-by-frame path mutation. Contract tests cap a crest at 400 nodes / 32 KB, five field rings and 22 ambient dust elements. Unknown tiers fail explicitly; callers receive copies of frozen material tokens. To iterate, change the token row for material/field behavior or the shared geometry helper for the common construction; do not add tier-specific bitmap exceptions.

The field has three responsibilities: a static volumetric ring behind the crest, slower secondary orbital light, and restrained high-tier energy arcs. Rank increases geometry and surrounding space rather than turning up every surface. Card corners, inner rails, certification plates, enamel reflection and the BP plate inherit the same tokens. The eight gameplay attributes retain their typography and interaction layout.

## Motion and accessibility

Keep the existing READY → ENGAGE → BATTLE → RESULT presentation states, attack anticipation and impulse, HP interpolation, selection reveal and result choreography. Hover tilts the collectible face only, leaving selection and attribute controls stationary; focused controls suppress tilt. HP follows its own card rather than floating beside the instrument. The start label announces the locked playback state. Environmental motion is subordinate to the two cards. The event-driven particle canvas remains capped at 180 particles / 3.5 million pixels. Hidden pages clear transient work. Reduced motion disables particles, transforms and ambient loops without changing any combat output.

Collector selection keeps its three timed beats: held core, assembled chassis, released field. Restored LUMEN activates its orbit and PULSE its signal trace; FOLIO uses a bounded card reveal. `activateCrest` reuses available theme details for engagement, critical attacks and recovery; attack beams inherit the source rarity metal, with green reserved for healing and team colors reserved for HP/identity. Victory settles Collector's orbital speed and defeated metal recedes. The motion registry cancels removed crest surfaces before replacing their SVG. Offscreen cards pause both descendants and pseudo-elements. Reduced-motion changes also cancel in-flight Web Animations; every static crest remains present.

Labelled inputs, native selectors, keyboard focus and all three playback speeds remain functional. Seed is directly visible in READY without a focus-driven toggle. Card names wrap in flow when needed. Disabled controls stay visible on desktop during playback. Full stats do not require a separate overlay. Maintain regression checks for all 96 heroes at level 100, all 12 rarity emblems, 320/390/768/1024/1536/3840 widths, repeated mobile replay and reduced motion.

## Numerical boundary

Do not change `src/cards.js`, `src/power.js` or `src/battle.js` for this presentation task. Preserve the frozen 1,920-simulation digest and identical event lists across playback speeds. Compact summary metrics derive only from the same immutable battle events as the full summary table.

## Multi-theme extension — 2026-10-14 (previous visual iteration)

The hall/frame/dial/console files and rarity material tokens are retained. This section records the earlier multi-theme proposal; the final visual decision below is authoritative for crest geometry. Shared refinements in `themes.css` improve annotation size, text zoom, defeated identity readability and theme selection. The existing blue/red identities, card selection, input, playback and summary remain authoritative in all four editions.

**LUMEN / 光谱实验室** adds an optical workbench: porcelain cards, pearl glass, cool blue measurement instruments, dark ink data, and matte open archives. ION was rejected for being too close to the existing dark scene; SIGNAL was rejected because a flat editorial treatment would give up too much of the card-as-object experience. LUMEN changes the material world, typography, crest geometry, control instrument, feedback and settlement, with the original two-card composition intact.

### LUMEN tokens and components

`themes.css` owns the surface, scoped to `html[data-theme=lumen]`. The original `styles.css` is unchanged. Tokens: background `#edf2f5`; solid surface `#fafdff`; muted surface `#e7eff4`; ink `#1c3547`; secondary `#4c6373`; annotation `#566c7b`; separator `#bacbd6`; focus `#174ea5`; blue team `#2463a6`; red team `#af3d4b`; healing `#166d50`. Existing `--gold` is a compatibility alias for LUMEN's blue action accent `#275eb0`, not a gold material. Sans typography uses local Segoe UI / Microsoft YaHei / PingFang, without a font download. BP is light-weight tabular type, names medium-weight; functional annotation text now has a 12px floor. Small SVG engravings are decorative, with the complete rarity repeated in DOM text.

Cards have a 14px porcelain edge, subtle directional shadow, visible team index line and opaque numeric surface. The V1 optical instrument has 60 measuring ticks, 12 rank indicators, one to five outer rings and Collector diamond fiducials. `lumenEmblemMarkup()` stays below 110 nodes / 12KB per crest, namespaces its paint ID and rejects invalid namespaces/ranks. The previous iteration's additional geometric editions are retained in this history; the final visual decision below restores the original print and signal forms.

The central instrument is a pearl lens with a fine rotating index. The action button is solid cobalt, speed state has both fill and a bottom indicator, form fields are opaque white. Logs, summary metrics, tables and result actions use the same surface/ink system. Red and blue victories carry the winner's semantic color; draw uses neutral slate and a paired VS seal. Live attack beams use the source team's ink; healing uses green and explicit text. All effects use the existing bounded canvas, motion registry and visibility/reduced-motion handling. No new permanent animation loop or dependency is added.

### Theme state and startup

The small inline head bootstrap is intentionally before both stylesheets. Its frozen four-entry registry contains labels, browser color and color scheme. Missing, obsolete or inaccessible `localStorage['nbl.visual-theme']` defaults to Collector. The native select applies `data-theme`, native `color-scheme` and `meta theme-color`, then attempts persistence. Storage write failure leaves the current session usable. The selected native option exposes the current theme to assistive technology. `initTheme()` has a binding guard and does not call `initApp`, `refreshAll`, `simulate`, a timer or navigation. Battle state, inputs, event queue, log, HP and seed are outside its ownership.

To add another theme, add one registry entry and a separately scoped material system with an explicitly bounded emblem if needed; extend the behavioral/browser matrix and exact static file manifest. Do not put battle state in the theme registry. Do not switch through page reload or reconstruct the main DOM.

### Generated image and fallback

Two separate images were generated with the built-in imagegen tool. Candidate A was a symmetrical white architectural hall; candidate B was a close optical-glass composition. B was selected because the peripheral glass disks leave a quiet central field and reduce competition with the two card instruments. The actual UI places data on opaque panels. Candidate A stays outside the repository as design exploration, not a shipped unused resource.

`assets/lumen-optics.webp` is the selected 1672×941 image, 48,478 bytes, encoded by FFmpeg/libwebp at quality 82. It contains no text or fake UI. Desktop uses a centered cover crop; mobile uses a 60% horizontal crop. A pearl base color and translucent lower wash remain readable if the image is slow or missing. All URLs are relative and work beneath a Pages subpath. Original Collector assets are untouched.

Exact production generation prompt (candidate B):

> Use case: stylized-concept. Production background for LUMEN, precision optical experiment web game. One seamless wide 16:9 image. Composition B, unlike a symmetrical palace: an abstract macro photograph of a huge layered milky optical glass disk sweeping into frame from the upper RIGHT corner and cropped beyond the image; a second thin blue translucent lens at the far lower LEFT. Oblique overhead view, matte pearl ceramic laboratory table, fine brushed aluminium edges, gentle physically rendered caustic light. Overall dominant warm porcelain white with desaturated pale blue. Center 75 percent of composition quiet empty pearl surface, no distracting edges. Foreground webpage contains dense left/right cards and central battle instrument, so decoration confined to outer margins. Art-directed high-end optical equipment advertisement, tactile, restrained, no room or palace, no neon, no dark areas, no rainbow blobs. Mobile center crop calm. NO TEXT, LETTERS, NUMBERS, CARDS, BUTTONS, CHARTS, ICONS, WATERMARK OR FAKE UI.

### Validation boundary

Theme tests cover all four prepaint restorations, invalid IDs, blocked reads/writes, repeated single-listener activation, asset paths and all 12 rank contracts. Browser evidence, matrix results and acceptance logs are stored outside this Git root under the task's Codex visualizations directory. The fixed engine digest is unchanged. Natural draw samples must come from the real engine. Clearly labelled, isolated synthetic DRAW UI fixtures may verify presentation and controls; they are not natural browser draw evidence.

### FOLIO and PULSE generated sources — 2026-10-14

Each new edition has a separately generated material concept and production background, using the built-in imagegen tool (four actual calls). Concept boards stay in the external evidence directory; only the following selected material backgrounds ship. No old asset was replaced. Both have CSS base-color fallbacks and relative paths.

- `assets/folio-paper.webp`: 1672×941, 114,424 bytes; warm cotton print stock, restrained forest ink at extreme corners, empty center. Encoded with libwebp quality 82. Card faces use a mostly opaque wash over this material to protect numbers.
- `assets/pulse-surface.webp`: 1672×941, 15,894 bytes; matte aubergine polymer with peripheral layered edges and a tiny amber reflection. Encoded with libwebp quality 82. Cards use opaque signal surfaces.

Production generation prompts:

> FOLIO: Use case: texture asset. Production wide 16:9 web background for FOLIO letterpress numerical card archive. Top down macro photograph of warm uncoated ivory cotton paper spread across an entire large printmaker work surface. Very subtle fine paper fibers, cream #eee8d9, neutral diffuse daylight, almost uniform, broad quiet central 85 percent for live UI. Only at extreme upper left and lower right edges: cropped overlapping edges of ivory paper sheets with a tiny deep forest-green ink trace, gentle paper-thin physical shadow. No recognizable symbols, no text, numbers, letters, grid, cards, tools, fake UI, frames, vignettes, dark areas or buttons. Extremely restrained texture, crafted high quality print stock, not yellow parchment or stained antique paper. Calm center crop must work on phone.

> PULSE: Use case: texture asset. Production wide 16:9 background for PULSE numerical battle web application. Abstract close up flat rectilinear surfaces of vintage precision electronic test equipment: matte aubergine-black polymer #18121d with very subtle fine ceramic texture, softly beveled dark plum horizontal layers ONLY cropped in far upper right and far lower left margins; a narrow restrained amber light reflection on a single outer bevel. Entire central 85 percent quiet uniform almost-black plum, no objects or patterns in center. Sophisticated industrial material photography with warm grazing light, low contrast, finely crafted. No metal gold circles, neon, cities, stars, screens, buttons, cards, UI, symbols, graphs, lettering, numbers, text or watermark. Not a moodboard, one continuous background with no split panels. Mobile center crop must stay quiet.

## Retained V2 rarity identity evolution — 2026-10-14

This section records the V2 construction for history. Its geometry and lettering are superseded by the final visual decision below.

This revision supersedes the concentric-crest construction described in the provenance sections above. No numerical metadata, gameplay phase, playback timing or engine file changes. The original four material worlds and all raster assets stay intact.

| Rank | Collector | LUMEN | FOLIO | PULSE |
| --- | --- | --- | --- | --- |
| C / C+ | milled token / transverse clamps | lens / lateral mounts | stamp / registration bars | chip / contact buses |
| B / B+ | shield / side braces | prism / satellite feet | hexagonal die / side registration | tall cartridge / buses |
| A / A+ | diamond enamel / detached facets | refractive diamond / offset lenses | lozenge / corner registration | octagonal case / top and bottom rails |
| S | ceremonial long shield | separated triangular optical assembly | heraldic shield | four-way processor |
| SS | paired metal wings | opposed curved lenses | workshop plate and ribbon | duplex separated processors |
| SSS | eight-point radiant die | hexagonal multi-axis prism | scalloped engraved rosette | six-way signal hub |
| SSS Collector | crown and archival ribbons | registered optical specimen | archival sheet and separate seal | certified instrument enclosure |
| XS | detached satellites and elongated star | four-axis refractor | six-point geometric die | diagonal core and isolated corner buses |
| XS Collector | twin-spire reliquary and suspended core | exploded optical stack | bound folio with authentication seal | twin-tower signal laboratory |

The wrappers preserve deterministic markup and independent A/B/Result paint IDs. Collector has real bevel strokes, directional metal gradients and die-clipped engraving; LUMEN uses light refractive planes and darker edges; FOLIO uses compound engraved curves with quiet paper fills; PULSE uses separated signal paths and restrained amber. All silhouettes and inner geometry survive removal of labels and color.

Activation now targets the currently visible theme, not a hidden Collector chassis. Paper reveals as an impression, electronics as a centered scan, optics and metal assemble from a bounded inset. Higher ranks receive a slightly longer reveal without locking selection or changing event timing. Switching themes cancels only old crest Web Animations; event queues, counters, HP and logs are untouched. Ambient detail uses CSS only, pauses offscreen/hidden, and is disabled under reduced motion. The compact battle crest fits inside a 5.4rem minimum identity region so it cannot extend into HP; long names may grow the region naturally.

One real imagegen concept board explored metal reliquaries, optical stacks, paper certification and split electronics. It informed material/structure only; it is not a runtime bitmap or a browser screenshot. No production image added. Browser evidence, baseline source copies, scripts and the Chinese handoff report live outside the repository in the current task visualizations directory.

The previous assertion that SSS Collector must have wings changes intentionally: wings identify SS, while SSS Collector has its own crown/ribbon die. All original node, byte, RNG, namespace and engine-digest budgets remain. Added tests require twelve distinct dies per theme and shared animation hooks; screenshot judgment, not string inequality, establishes visible differentiation.

## Superseded V3 reading hierarchy draft (historical)

The primary rank always occupies a quiet, opaque focal plane; outer shells carry the second-level identity. Collector combines the original custom extruded path letters with broad enamel/octagonal metal centers and the twelve V2 peripheral dies. LUMEN keeps its prisms, split lenses and separated optical modules, with a clean porcelain lens and dark sans reading. FOLIO restores large serif inscriptions within enlarged print dies; its book carries a separate paper title band. PULSE restores bold amber instrument readings with a dark display window and peripheral traces. Collector editions have a separate certification strip; the normal accessible rarity badge remains present at compact sizes.

`rankLabel` sizes by theme and string length; it must not be overridden by a small shared CSS font size. `collectorLetter` owns its custom paths and uses `crestLetter{side}` paint IDs: namespace checks must include surrounding HTML IDs, not only other SVGs. The last reading plane is independent of animated shell details, so a reveal or optical motion cannot move crossing lines over the letters. No new animation scheduler, asset, simulation call or dependency is added.

Regression evidence measures real desktop and compact DOM bounds, compares all 48 ranks against the retained V1 snapshot, and checks full-page paint references. Bounding-box size is a guard against shrinking letters, not an aesthetic score. Review all tiers in color, grayscale with lettering, and silhouettes, then actual READY/BATTLE/RESULT scenes before accepting a visual change. This draft was superseded by the final selection below.

## Final visual decision — 2026-10-14

Collector retains the V3 metal silhouettes, custom lettering, and reveal choreography. LUMEN, FOLIO, and PULSE restore their V1 overall visual forms while keeping the newer larger rarity marks and the later functional, layout, accessibility, and performance fixes.

| Edition | Final crest form | Rank progression |
| --- | --- | --- |
| Collector | V3 beveled metal die with enamel face and custom path lettering | Twelve V3 rank-specific silhouettes |
| LUMEN | V1 porcelain optical instrument with circular lens, measuring dial, fine ticks, and orbit | Sixty dial ticks, twelve graded marks, one to five finish rings |
| FOLIO | V1 paper-print frame with a quiet central diamond and serif mark | Twelve progress pips; Collector label on the two Collector tiers |
| PULSE | V1 dark rounded oscilloscope cartridge with one waveform and monospaced mark | Twelve progress pips and the original high-tier signal accents |

The updated LUMEN, FOLIO, and PULSE marks remain larger than their V1 counterparts. Their simple V1 structures remain intact around those marks; no V3 reading plane, rank die, or extra module is added. Theme switching, READY/BATTLE/RESULT presentation, card selection, Seed, playback, and summaries keep their current behavior. `src/cards.js`, `src/power.js`, and `src/battle.js` remain outside the change, and the frozen battle digest remains `a947f05e621e8223e5828f6d4235cd74cf6c34f0b4ad6f3d4a3a4c5699313743`.
