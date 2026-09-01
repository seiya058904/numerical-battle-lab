# Pokémon Showdown provenance

- Upstream repository: `smogon/pokemon-showdown`
- Audited / pinned commit: `833d0da4431cb58bda485ba2204d6066a87e773c`
- License: MIT
- Imported concepts/code: Gen 5 deterministic RNG arithmetic; action priority ordering and deterministic tie shuffling; relay-value event dispatch semantics and recursion-guard pattern.
- Not imported: Pokémon species/moves/items/abilities/Dex/game formats/client/server/content.

Local code is generalized for `CombatEntity` and generic action/status sources. See `src/kernel.js`.
