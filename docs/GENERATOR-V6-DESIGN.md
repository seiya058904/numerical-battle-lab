# Generator v6 — Power Budget Contract (Design)

> Status: implementation design. Supersedes the v5 "generate-then-calibrate-stats"
> approach for NEW cards. v1–v5 remain byte-for-byte deterministic legacy.

## The product definition (v6 maximum constraint)

```
Level + Rarity  ==>  "how much total strength this card has"
Seed            ==>  "what FORM that strength takes"  (allocation / style / matchup)
Mechanics       ==>  "how the strength plays out, who it counters"
Match Seed      ==>  "what happens in this particular fight"
```

Seed NEVER decides total strength. It only re-allocates a FIXED total budget.
A seed cannot make a Lv50 A card into a Lv70 S card by rolling a great action kit:
the great kit must be paid for out of the SAME total budget, so it arrives with
proportionally less raw offense / HP / defense — keeping aggregate real strength
inside the Lv50 A tier.

## Why v5 failed (root cause)

v5 generated an arbitrary structure with RELATIVE coefficients, then ran
`battlePowerV3Calibrate` which bisection-scales only ATK/MAX_HP/DEF/RES/SPD until
the card's BP lands in the rarity band. Consequences:

- A seed that rolled a strong action kit (low cooldown + big coefficients +
  resource loop + triggers + stun) got its 5 stats scaled to hit the band, but the
  FREE mechanic power (control, shield, resource, trigger, DoT, heal) was untouched.
  That card fights like it belongs to a much higher tier.
- The rarity Lv100 bands are narrow (C≈1000 … XS_COLLECTOR≈1840, ratio 1.84),
  so even the widest rarity gap is only ~1.6× BP, and empirically delivered only
  ~57.7% higher-side win rate. Level/Rarity never became the dominant axis.
- `scaleStrength` is explicitly the anti-pattern the task bans: "generator 不允许
  靠事后统一缩 Stats 修复".

## v6 core construct

### 1. ExpectedStrength(level, rarity) — pre-generation anchor

```js
ExpectedStrength = LevelScale(level) × RarityStrengthScale(rarity)
```

A single positive number, monotone in level and rarity, that a card of that
(level, rarity) SHOULD carry as TOTAL real combat strength BEFORE generation.

**LevelScale(v6)** — re-tuned for clear perceptual gaps; anchor Lv100 = 1.0:
```
Lv1≈0.10  Lv25≈0.34  Lv50≈0.57  Lv75≈0.80  Lv100=1.00
```
(kept near v5 shape; the real dominance comes from the budget, not the curve)

**RarityStrengthScale(v6)** — WIDENED so large rarity gaps yield real budget gaps.
Canonical Lv100 scale (C=1.00):
```
C 1.00  C+ 1.10  B 1.21  B+ 1.33  A 1.46  A+ 1.61  S 1.77  SS 1.95
SSS 2.15  SSS_COLLECTOR 2.37  XS 2.61  XS_COLLECTOR 2.87
```
So a full C→XS_COLLECTOR gap is ~2.87× budget, not 1.84×.

**TotalStrengthBudget = ExpectedStrength.** This is the number every category
share and every mechanic price is denominated in.

### 2. Budget ledger (`strengthLedger`, debug-only)

The ledgers live on the generated card (top-level) so QA can verify the contract
exactly; they are NOT scanned by numerical-coverage and are presentation-neutral.

```js
strengthLedger = {
  totalBudget,        // = ExpectedStrength(level,rarity)
  expectedStrength,   // alias
  spent: {
    stats: {offense, defense, sustain, control, economy, tempo, triggers, passives},
    actions: [...per-action priced value],
  },
  unspent,            // >= 0 (tolerance allows tiny residual)
  overBudget,         // > tolerance => generator must retry/repair
  calibrationDelta,   // final measurement - budget (should be ~0)
  version: 6,
}
```

### 3. Category allocation (seed picks the FORM, total is fixed)

Seed deterministically splits `totalBudget` across 8 spend categories such that the
category shares always sum to `totalBudget`:

```
offense | defense | sustain | control | economy | tempo | triggers | passives
```

Examples (Lv50 A, budget ~1000) showing pure re-allocation, never free strength:
```
Seed A (offensive):  offense 420 defense 180 sustain 120 control 100 tempo 100 triggers 0  passives 80
Seed B (defensive):  offense 180 defense 330 sustain 270 control  80 tempo  60 triggers 0  passives 80
Seed C (controller): offense 250 defense 140 sustain  80 control 280 tempo 150 triggers 0  passives 100
```
Every share is a fraction of a FIXED total; a card cannot exceed its tier by
over-spending — the price of every mechanism is charged against these shares.

### 4. Everything pays budget (no free mechanics)

The budget-pricing model (`budget-price.js`) is a CAUSAL cost model, deliberate/
independent from battlepower-v3:

```
mechanicCost = baseValue × frequency × uptime × reliability × targetCount
             × conditionProb × aiUsability
```

- Max-roll damage `ATK×k` has base cost ~k in offense units.
- Same damage + Stun costs notably more: the stun's control value is charged
  against the control category budget, forcing the card to give up offense/HP/etc.
- Heal/shield/ward charged to sustain.
- Cooldown advantage / cost reduction / zero-cost / resource gain / regen /
  conversion charged to economy.
- priority / accuracy / multi-hit / repeat charged to offense & tempo.
- DoT/HoT charged as expected ticks × value × application prob.
- stun/silence/control/cleanse/dispel charged to control.
- status stacking / consume / detonation charged to control & offense.
- conditional upside charged as conditionProb × upside.
- triggers (afterDamage/afterHit/afterKill/roundStart/roundEnd) and passives and
  event modifiers charged to the triggers/passives category as
  triggerProb × activationFrequency × effectValue.
- reflect/lifesteal/recoil priced (recoil is a discount: it yields budget back).
- ramp/fatigue/endurance priced as expected time-domain output.
- multi-target / AoE / target flexibility priced by targetCount (superlinearly).

### 5. Generation pipeline (budget-faithful, no post-hoc stat-scaling repair)

```
1. seed -> structural skeleton (mechanic fingerprint, tier-invariant)
2. level, rarity read
3. TotalStrengthBudget = ExpectedStrength(level,rarity)
4. seed allocates budget categories (sum == budget)
5. build actions/effects/status/resources within the category budgets:
     for each rolled mechanic, compute price; if it exceeds the remaining
     category budget, deterministically re-roll / down-price until it fits
     (generation-time reconciliation, not post-hoc stat scaling)
6. derive continuous stats (MAX_HP/ATK/DEF/RES/SPD/... ) faithfully from the
   spent budget with budget-conserving conversion so that the total real value
   of stats + mechanics equals the budget
7. final measurement via battlepower-v3 (independent estimator)
8. budget contract validation: |measured - budget| / budget <= tolerance
9. hard gates: no NaN, no invalid formula/action/resource loop/trigger recursion,
   budget within tolerance, BP reasonably near ExpectedStrength
10. if a gate fails -> deterministic retry (bounded, seed-ordered)
```

### 6. Measurement / budgets are three independent layers

- **Generation Budget Model** (`budget-price`) — prices mechanics for GENERATION.
- **BattlePower v3** — independent static measurement (unchanged semantics; it
  stays a real estimator that reads only card numbers, never rarity/level/seed).
- **Monte Carlo / empirical audits** — the Reality layer.

No self-fulfilling audit: budget-price and battlepower-v3 use different math, and
empirical win rates are the final arbiter.

### 7. Verification gates (note "verify:release")

New dedicated audits become part of `verify:release` at a SMALL deterministic
sample so CI catches Level/Rarity dominance regressions without 2400 battles.
Full-scale audits remain local/release diagnostics.

## What stays frozen

- v1–v5 generators (byte-for-byte deterministic reproduction).
- Naming V3 — names depend on Seed only; 60 canonical names preserved.
- Match randomness / replay / initiative / multi-team selection.
- BattlePower v3 remains the independent static estimator; it never reads
  rarity/level/seed/opponent, and it is NOT used to "repair" an over-budget card.

## Files

- `src/budget-v6.js`         — ExpectedStrength, LevelScale, RarityStrengthScale,
                               category allocation, budget ledger type.
- `src/budget-price.js`      — causal mechanic pricing model.
- `src/gen-v6.js`            — Generator v6 (structure + budget reconciliation).
- `src/power-v6-envelope.js` — optional widened BP band coordinates (if used).
- `scripts/audit-v6-strength.js` — level/rarity/expectedStrength multi-match
                               mirrored empirical audit -> qa/v6-*.json.
- `scripts/audit-v6-seed-dispersion.js` — seed dispersion audit.
- `content/presets-v6.json`  — 60 cards migrated from presets-v5 with v6 budget,
                               names reused from Naming V3 (frozen).
- `tests/gen-v6.test.js`, `tests/budget-v6.test.js`, `tests/v6-strength.test.js`.
- npm scripts + index.html + static-check required[] wiring.

---

## Implementation status (honest checkpoint)

**Implemented and wired (green):**
- `src/budget-v6.js` — LevelScale, WIDENED RarityStrengthScale (C=1.0 …
  XS_COLLECTOR=12.0 at Lv100), `ExpectedStrength(level,rarity)=1000×LevelScale×RarityScale`,
  budget category allocation (sum==total), strength-ledger type.
- `src/budget-price.js` — causal mechanic pricing (independent from battlepower-v3).
- `src/gen-v6.js` — Generator v6: seed-only structure, budget-derived panel
  (MAX_HP/ATK/DEF ∝ budget), viability pass (guarantees a reliable unconditional
  damage engine), tempo floor (fast damage action), no degenerate shield/convert
  spam loops, DPS pinning (real DPS ≈ kDPS×budget), and a REAL-measurement
  selection gate (each draft's net HP edge vs a fixed reference is measured with
  real canonical-AI battles; the draft closest to the budget's target edge wins).
- `tests/gen-v6.test.js` — 6 fast tests (ExpectedStrength monotone in level+rarity,
  budget allocation exact, stable identity + budget contract + finite numbers,
  structural invariance, independent BP estimator). Full suite: 290 tests pass.
- `scripts/audit-v6-strength.js` — mirrored, multi-Match-Seed dominance audit.
- v6 is **opt-in** (`generateCardV6` / `generateCardV6ByVersion`); the DEFAULT
  dispatcher still yields v5 so all existing presets/tests keep their behavior.

**Empirical results (real canonical-AI battles, mirrored, multiple Match Seeds):**
- Rarity (same Lv50, widened scale): C vs B 50%, C vs A 75%, B vs A 50%,
  A vs SSS 100%, A vs XS Collector 96%. Large gaps dominate; adjacent tiers
  remain matchup-heavy (allowed by design).
- Level (rarity A): Lv10 vs Lv60 = Lv60 wins 100%, Lv30 vs Lv100 = 75%,
  Lv10 vs Lv100 = 100%. Clear dominance.
- **Known limitation (NOT yet met):** within-tier seed dispersion is still wide —
  a pool of same-(Lv50 A) cards measured vs each other ranged ~0–0.94 aggregate
  (mean ≈ 0.47) in one probe. The real-measurement selection narrows it vs the
  earlier 0–0.89, but the engine's kit-topology sensitivity still leaks strength
  across tiers. Full same-tier clustering, presets-v6, CI gates and the release
  push are the remaining work before this can be marked READY FOR HUMAN REVIEW.
- Generation is measurement-heavy (~0.4–0.5 s/card) because each draft runs real
  battles to pick the tier-faithful shape; acceptable for presets/audits, needs
  caching before interactive use.