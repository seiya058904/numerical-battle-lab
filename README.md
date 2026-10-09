<h1 align="center">⚔️ Numerical Battle Lab</h1>

<p align="center">
  <strong>Choose the cards. Shape the power. Watch the numbers fight.</strong>
</p>

<p align="center">
  A collectible-card arena where levels, rarities, and twelve combat attributes<br>
  meet in reproducible, turn-based duels.
</p>

<p align="center">
  <a href="https://seiya058904.github.io/numerical-battle-lab/"><strong>▶ Enter the Arena</strong></a>
  &nbsp;·&nbsp;
  <a href="#how-to-play">🎮 How to Play</a>
  &nbsp;·&nbsp;
  <a href="#the-numbers">💎 The Numbers</a>
  &nbsp;·&nbsp;
  <a href="#run-locally">⚙️ Run Locally</a>
</p>

<p align="center">
  <sub>96 FIXED CARDS &nbsp; · &nbsp; 12 RARITIES &nbsp; · &nbsp; 12 ATTRIBUTES &nbsp; · &nbsp; SEEDED 1v1 COMBAT</sub>
</p>

<p align="center">
  <img width="780" alt="Numerical Battle Lab — original fantasy card artwork" src="https://github.com/user-attachments/assets/7ca1b5eb-2d0e-47a2-bd7f-1e668e39ee11" />
</p>

---

> **A battle is decided by its rules, not by its animation.**
>
> Numerical Battle Lab simulates the entire match first, then brings its events to life. Change the playback speed, and the presentation changes. The result does not.

<a name="how-to-play"></a>
## 🎮 How to Play

No account, deck-building process, or character editor is required. Every contender comes from a fixed card collection.

1. **Choose your contenders.** Search or select a card for the blue side and another for the red side.
2. **Set their levels.** Adjust each card from **Lv. 1 to Lv. 100** and compare the resulting attributes and Battle Power (BP).
3. **Start the duel.** Watch the simulated match at **Slow**, **Fast**, or **Instant** speed. Explore the round-by-round log and post-battle summary afterward.

**[Play now →](https://seiya058904.github.io/numerical-battle-lab/)**

### ✨ Inside the Arena

<table>
  <tr>
    <td width="50%" valign="top">
      <h3>🃏 The Collection</h3>
      <p><strong>96 authored cards</strong> across twelve rarity tiers, each with its own role and fixed attributes. Search, compare, and experiment with matchups.</p>
    </td>
    <td width="50%" valign="top">
      <h3>💎 The Collector Finish</h3>
      <p>Machined frames, enamel, tier-specific crests, and restrained light effects give the collection a shared visual language—from C to XS Collector.</p>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h3>⚡ The Duel</h3>
      <p>Turn order, hits, dodges, critical damage, penetration, lifesteal, and regeneration play out through an event-driven combat system.</p>
    </td>
    <td width="50%" valign="top">
      <h3>🔁 The Replay</h3>
      <p>Enter a Match Seed to reproduce the same encounter. Change playback speed freely without changing the simulated events or winner.</p>
    </td>
  </tr>
</table>

<a name="the-numbers"></a>
## 💎 The Numbers Behind the Battle

The outcome comes from **level, rarity, the card's fixed attributes, and seeded combat randomness**—not from a hidden score that decides who *should* win.

| System | What it means |
| --- | --- |
| **Level** | Nonlinear growth from 1 to 100, scaling the four core attributes. |
| **Rarity** | Twelve explicit multipliers, applied alongside level growth. |
| **Combat attributes** | HP, Attack, Defense, Speed, Accuracy, Evasion, Critical Rate, Critical Damage, Penetration, Lifesteal, Regeneration, and Volatility. |
| **Match Seed** | A reproducible random sequence for the same cards and levels. |
| **Battle Power (BP)** | A read-only evaluation of final attributes—**not damage, not a win probability, and not a rule for selecting the winner**. |

### Rarity, at a Glance

| Rarity | Multiplier | Rarity | Multiplier |
| :--- | ---: | :--- | ---: |
| C | 1.00× | S | 2.90× |
| C+ | 1.15× | SS | 3.75× |
| B | 1.35× | SSS | 4.90× |
| B+ | 1.60× | SSS Collector | 6.60× |
| A | 1.90× | XS | 9.10× |
| A+ | 2.30× | XS Collector | 13.20× |

For perspective: the **level × rarity** factor of a Lv. 55 XS Collector card is close to that of a Lv. 100 C card. Their actual matchup still depends on card attributes and combat events.

### ⚙️ What Happens in a Turn?

```text
Regeneration → Hit / Dodge → Critical Check → Defense & Penetration
             → Damage → Lifesteal → Next Action
```

Speed influences who acts first. The engine uses a seeded pseudorandom generator throughout the battle; matches are simulated before their event logs are replayed. If neither contender is defeated by the 120-round limit, the remaining HP proportions determine the result, with a possible draw.

<details>
<summary><strong>📐 Expand the numerical model</strong></summary>

The four scaled core attributes use a level curve and an explicit rarity multiplier:

```text
g(L) = exp(0.02143 × L + 0.0002253 × L²)
scale = g(level) × rarityMultiplier
```

Each core attribute also has its own base value and fixed card-specific shape. The unscaled secondary attributes continue to describe each card's combat style.

A base damage term, before critical hits and random variation, is:

```text
ATK² / (ATK + DEF × max(0.05, 1 − PEN))
```

**BP is separate from this battle calculation.** It estimates a card's general offensive and survival capability using fixed reference conditions and the final attributes. It never enters the combat engine as a multiplier or overrides a seeded result.

- [Card definitions](src/cards.js)
- [Level, rarity, and BP calculations](src/power.js)
- [Deterministic battle simulation](src/battle.js)
- [Product constraints](PRODUCT.md)

</details>

<a name="run-locally"></a>
## 🚀 Run Locally

This is a **static HTML/CSS/JavaScript project with no runtime packages or build step**. Clone or download the repository, then either open [`index.html`](index.html) directly or start its included local server.

```bash
npm run serve
```

Open **http://127.0.0.1:8774/**. The UI uses Chinese text; this English README documents the project without changing its interface language.

<details>
<summary><strong>🛠️ Tests, verification, and project structure</strong></summary>

From the repository root:

```bash
npm test         # Node.js regression tests
npm run verify   # Static checks, regression tests, acceptance, and BP audit
```

| Path | Responsibility |
| --- | --- |
| [`index.html`](index.html) | Browser entry point |
| [`src/cards.js`](src/cards.js) | Fixed 96-card collection and rarity definitions |
| [`src/power.js`](src/power.js) | Level scaling, final attributes, and Battle Power |
| [`src/battle.js`](src/battle.js) | Seeded simulation and event generation |
| [`src/app.js`](src/app.js) | Card selection, presentation, and replay |
| [`tests/`](tests/) · [`scripts/`](scripts/) | Regression tests, acceptance checks, and local tooling |

The GitHub Actions verification workflow runs on pushes and pull requests to `main`. Its checks protect the numeric model, deterministic output, and the separation between simulation and visual replay.

The project supports keyboard interaction, responsive layouts, and `prefers-reduced-motion`. Reduced motion changes how events are shown, not how they are calculated.

</details>

## 📚 Design & Source Notes

- **[Design system](DESIGN.md)** — the collector workbench, card materials, layout, motion, and accessibility rules.
- **[Product definition](PRODUCT.md)** — what the game does, and the boundaries it deliberately keeps.
- **[Agent guidance](AGENTS.md)** — project-specific engineering and verification constraints.

> **Same cards. Same levels. Same seed. Same battle.**
>
> The arena is built to make the numbers visible—not to change them behind the scenes.

---

<p align="center">
  <sub>A small experiment in the relationship between numbers, presentation, and competition.</sub><br>
  <sub>No repository-wide open-source license has been declared.</sub>
</p>
