# V7 Mechanism Attribution — Analysis Framework

Status: analysis document (round 3, user decision gate). Experimental numbers are
filled in from `qa/v7-scheduling-magnitude-attribution.json` when the C0-C4 runs
complete. This page records the parts that are derivable from source alone.

## 0. Causal variance decomposition — RESULT (96 unsolved Lv50 A cards)

Same shared graph (768 edges, 8 opponents/card) and same paired Match Seeds
(3/card) across all variants; each variant = 4,608 mirrored canonical-AI battles,
Bradley-Terry fitted, all converged. Card scalars are normalized to per-slot
medians; skeleton/effects/statuses/triggers/targets are never changed.

| variant | what changed | p95−p5 | variance reduction | spread reduction | Spearman(C0θ, Ckθ) |
|---|---|---|---|---|---|
| C0 | baseline | **6.642** | — | — | — |
| C1 | cost/cooldown/priority → medians | **7.356** | **−5.3%** | −10.8% | 0.920 |
| C2 | damage/heal/barrier coeffs, accuracy, chance, drainRatio, gain → medians | **6.150** | **+15.7%** | +7.4% | 0.962 |
| C3 | C1 + C2 | **6.214** | **+21.3%** | **+6.4%** | 0.899 |
| C4 | deterministic permutation of scalar bundles across cards (card i ← donor i+1) | **6.386** | +13.4% | +3.9% | 0.801 (vs donor C0θ: **0.229**) |

**Decision gate (user §4): C3 spread reduction = 6.4% ≤ 40% → "hypothesis not
supported; continue Mechanism-Aware StrengthModel."** An action-numeric solver
prototype is therefore NOT justified by this evidence.

Readings:

* Normalizing BOTH random scheduling and scalar magnitudes leaves ~6.2 theta of
  the original 6.64 — roughly **79% of the variance** survives as
  topology/interactions. The same-tier spread is dominated by the mechanic
  skeleton (family, effects, statuses, triggers, targets, sustain-vs-damage
  races), not by the drawn numbers.
* C1 *increased* the spread (−5.3% variance): the random scheduling partially
  equalised mechanism classes; removing it made cards more different. Scheduling
  randomness is not the driver and is not a promising solver knob.
* C2 (magnitude scalars) is the largest single contributor (+15.7%) but still
  modest.
* C4 is the strongest causal signal: after permuting the scalar bundles, the new
  ranking correlates 0.801 with the ORIGINAL cards' ranking but only **0.229**
  with the DONOR cards' ranking — i.e. strength stays with the skeleton and does
  NOT follow the numbers.
* Q4 answer: pure mechanic topology after normalization still produces **≈6.2
  theta** of spread — large. Mechanisms genuinely differ hugely in long-grind
  value; the StrengthModel must learn to value them (it currently ranks them at
  ≈0 or worse, see `qa/v7-mechanism-ranking-96.json`).

## 1. What the V7 skeleton draws randomly vs structurally (from `src/gen-v7.js`)

Every non-backbone action is constructed with
`cost=1+random(5), cooldown=1+random(4), priority=random(5)-2` from ONE shared
PRNG stream, and each family case may override some fields:

| action (family) | cost | cooldown | priority | other drawn scalars |
|---|---|---|---|---|
| 基础攻势 backbone | 0 fixed | 1 fixed | 10 fixed | status chance `0.55+0.3·triggers` (genome) |
| 精确打击 direct | random 1-5 | random 1-4 | random -2..2 | dmg `24+24·pressure` (genome) |
| 裂变突袭 burst | random | 3 fixed | random | dmg `16+16·pressure` ×2 hits (genome) |
| 蚀印扩散 dot | random | random | random | stacks `1+random(2)` (RANDOM), chance `0.65+0.3·reliability` |
| 汲取 drain | random | random | random | dmg `20+20·pressure`, drainRatio `0.08+0.22·sustain` |
| 压制 control | 0 fixed | 2 fixed | random | dmg `14+14·pressure`, status pick (RANDOM), chance `0.6+0.3·control` |
| 屏障 barrier | 0 fixed | 2 fixed | random | type pick shield/ward (RANDOM), coeff `0.58+0.24·endurance` |
| 再生 sustain | 0 fixed | 2 fixed | random | heal coeff `0.62+0.24·sustain` |
| 蓄能轰击 resource | random | random | random | gain `2+random(3)` (RANDOM), dmg `18+20·pressure` |
| 先制 tempo | random | 1 fixed | `2+3·tempo` fixed | dmg `18+20·pressure` |
| 反射架势 reflect | random | random | random | (status only) |

`accuracy = 0.72+0.24·reliability` for every non-backbone action (genome). The
anchor `55·(ATK+1)·(0.02+ACC/100)·(0.70+PEN/100)` is prepended to every action
(structural). Resource type, damage type, trigger event, victory path, action
family set, statuses and durations all come from the seed-driven skeleton and are
structural.

## 2. Parameter classification (Q6)

| parameter | continuous/discrete | monotonic in strength | strength-only / identity-affecting | safe as solver knob? |
|---|---|---|---|---|
| damage coefficient (`ATK * X`) | continuous | monotonic ↑ | strength-only | YES (continuous marginal-value knob) |
| heal coefficient (`MAX_HP * X`) | continuous | monotonic ↑ | strength/sustain | YES |
| barrier coefficient | continuous | monotonic ↑ | strength/durability | YES |
| periodic magnitude (`ATK * X`) | continuous | monotonic ↑ | strength (dot) | YES |
| drainRatio | continuous | monotonic ↑ | strength/sustain | YES |
| effect chance | continuous | monotonic ↑ | strength/delivery | YES (bounded 0..1) |
| action accuracy | continuous | monotonic ↑ | strength/delivery | YES |
| energy cost | discrete int | monotonic ↓ | strength/availability | borderline — discrete, but monotonic |
| cooldown | discrete int | monotonic ↓ | strength/availability | borderline — discrete, but monotonic |
| priority | discrete int | NON-monotonic (order, not magnitude) | **identity/behavior** (changes AI action choice and initiative order) | NO as plain strength knob |
| shield-vs-ward type | categorical | — | identity | NO |
| stun/slow/silence pick | categorical | — | identity (control flavour) | NO |
| dot stacks | discrete int | monotonic ↑ | strength (dot magnitude) | borderline |
| action family / target / effect topology / statuses / triggers / damage type / resource | structural | — | **Frozen Identity** | NEVER |

## 3. Seed Identity Invariants (Q7)

Proposed split for any future action-numeric prototype:

* **Frozen Identity** (solver never touches): action family set and count,
  victory path, target types, trigger topology, status/debuff identity,
  conditional structure, periodic topology, resource mechanic, damage type,
  signature action identity, shield-vs-ward kind, control status flavour.
* **Shape-Preserving Numeric Freedom**: per-mechanism relative shape (e.g. the
  ratios between a kit's own action magnitudes, its cooldown/resource tendency,
  its sustain tendency) stays as the seed drew it; the solver may only apply
  FAMILY/GLOBAL scaling factors so General Strength reaches TargetTheta.
* **Free Strength Scalars**: absolute magnitudes that do not change any relative
  shape or identity (global coefficients, global availability level), free for
  iso-power convergence.

The three-way split is a candidate architecture, not yet approved; this round
only produces the causal evidence (C0-C4) and the solver-utilization audit that
inform whether an action-numeric prototype is justified at all.
