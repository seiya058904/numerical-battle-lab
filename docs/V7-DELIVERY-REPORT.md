# V7 Delivery Report

> STATUS: **PARTIAL / V7 REDEFINED AS STAT-ONLY** — the project direction was
> simplified to "Stat-Only Numerical Battle": V7 cards now carry 20 stats and a
> single Basic Attack; all mechanism-era complexity (victoryPath, skeletons,
> skills, statuses, triggers, resources, action-policy model, mechanism gates)
> was removed. The stat-only V7 core passes its product gates and reality checks;
> two acceptance items remain open (anti-God-Stat breadth and the final default
> switch), so V6 stays the product default.
>
> Every number below comes from an actual run of the committed code.

## Stat-Only V7 results (this round)

* Generator: Level + Rarity -> TargetTheta -> budget B(theta); Seed -> normalized
  continuous allocation weights; per-stat convex price curves + the allowed single
  global-scale power correction -> every seed at a tier is ANALYTICALLY iso-power
  with distinct stat shapes. 20 stats, each documented in the numerical knowledge
  registry (4 new: HP_REGEN, RES_PEN, TOUGHNESS, CRIT_RES).
* Battle: one unified Basic Attack per living unit per round; initiative/hit/
  crit/penetration/DEF-RES/barrier/HP/lifesteal/regen; deterministic; draws ~0
  (late-round damage escalation); no skill AI.
* GeneralStrength: content-only analytic geometric model (effectiveDamage x
  survival x tempo x luck); BattlePower = monotone display (Lv50 A ~ 1000).
* Reality (37,440 stat battles, 1,560 edges, mirrored, 12 paired seeds):
  Spearman(TargetTheta, EmpiricalTheta) = **0.9946** (>=0.95); pairwise direction
  accuracy 0.99; same-tier p95-p5 dispersion **0.14-1.25 theta** across the 12
  canonical tiers (down from 3.0-8.4 in the mechanism era; the 1.249 peak at
  Lv70 XS is the single soft-exceedance of the 1.2 note).
* gate:v7-product: **13/13 PASS** — Lv100 C vs Lv40 C 100%, Lv100 C vs Lv40 XS
  Collector 100%, Lv70 XS_COLLECTOR vs Lv100 C 71.9% (suspense window),
  same-level C vs XS_COLLECTOR 100%, iso-power, diversity, BP content-only,
  legacy, naming.
* Tests: **349/349**; verify / verify:release PASS (static checks, manifest 341
  files, gate, diversity).
* Open items (not switched to default): (1) anti-God-Stat breadth — the +10%
  battle sensitivity measurement found ~5 of 15 stats with a clear effect
  (ATK/MAX_HP ~+30pp, DEF/SPD/CRIT_DMG ~+10pp; ACC/EVA/CRIT/PEN/sustain axes
  read ~0 at that sample size), so the ">=10 meaningful stats" acceptance item is
  not met and needs battle-formula amplification; (2) the default switch stays
  pending until the acceptance list above is confirmed.
