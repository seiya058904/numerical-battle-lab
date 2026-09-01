# Third-Party Notices

## Pokémon Showdown

This project contains code and algorithms derived from Pokémon Showdown (`smogon/pokemon-showdown`), pinned for audit at commit `833d0da4431cb58bda485ba2204d6066a87e773c`.

Used/derived portions: deterministic Gen 5 PRNG arithmetic, battle action ordering/tie semantics, and relay-event dispatch concepts. The Pokémon game model and Pokémon content are not included.

License: MIT. The upstream license is preserved at `third_party/pokemon-showdown/LICENSE`.

## Acorn 8.15.0

The offline formula DSL uses the official Acorn 8.15.0 distribution as its mature JavaScript expression parser. The vendored parser is stored at `vendor/acorn-8.15.0.js`; project code then applies a strict AST whitelist and pure evaluator. No arbitrary JavaScript execution is exposed to content.

Upstream: `https://github.com/acornjs/acorn`

License: MIT. The license and package metadata are preserved under `third_party/acorn/`.

Vendored SHA-256: `fdb08546776ec6228b03e8d02b40d4ab3255bae5f401adba7ff5dad927ac5c9c`.

## Design references — no redistributed source

The following projects/libraries were reviewed for battle-system mechanics, expression-language conventions, data modeling or architecture. Their source is not intentionally redistributed in this package:

- Cataclysm-DDA — composite damage units, penetration/resistance concepts.
- Battle for Wesnoth — weapon-special parameter modification.
- Tales of Maj'Eyal / ToME-style systems — multiple resources, sustains, resistance/penetration patterns.
- Freeciv / Unciv — data-driven requirements and effects.
- Smogon Damage Calc — staged numerical calculation patterns.
- XMage / Forge — trigger/replacement/static-effect architecture references.
- math.js and expr-eval/expr-eval-fork — expression-language and parser-safety references.

Only the third-party code explicitly listed in the sections above is redistributed in this package.
