# V2 creative review — what V1 got wrong, and what replaces it

V1 was structurally sound but compositionally repetitive: almost every section
followed *eyebrow → serif headline → paragraph → grid of bordered boxes*, inside
the same 1320px container, with a single fade-up entrance. The site had no visual
device of its own (generic concentric circles) and nothing moved unless scrolled.

| V1 section | Problem | V2 replacement |
|---|---|---|
| Home hero | Annual-report cover: headline, lede, two buttons, decorative circles | Full-bleed **market canvas**: Nusantara lattice, an abstract market line that keeps drawing, cycling indicator read-outs with status/timestamp |
| Static ticker strip (dashboard only) | Did not move; read as a table header | Continuous **market ribbon** under the hero (pause on hover/focus, pause button, swipe carousel on mobile) |
| Market Pulse (10 boxes) | Card grid; numbers without a view | **Nusantara Market State** — six dimensions with gauges and a selectable reading; and a **Market Lens** linking any instrument to a view and a related insight |
| About (split text) | Exposition | One oversized statement revealed on scroll |
| Access → Allocation progression + comparison table | Report-like | Moved to Investment Approach; homepage no longer explains everything |
| Six-stage ring + text | Static diagram beside text | **Sticky scroll story**: a persistent allocation-system visual that transforms per stage |
| Capabilities list | List of seven rows | Removed from homepage; Strategies becomes an **allocation universe** |
| Market Intelligence tiles | 4×2 card grid | Folded into Market State / Lens and the dashboard |
| Nusantara View (2×3 grid) | Static text grid | Contextual: view changes with the selected market |
| Latest insights | Image + list | **Research rail** — full-bleed horizontal, featured piece with live chart |
| Governance stack + Venn | Text blocks | **Governance signal**: a decision travels through gates |
| Dashboard | Report page: chart, filters, card grid, indicator cards | **Intelligence workspace**: left rail, morphing centre chart, right Nusantara View panel, cross-asset matrix, market map, related markets, history comparison |
| Insights index | Featured card + blog grid | Featured research with interactive chart, **Latest signals**, **Deep dives** index, **Themes we are watching** |
| Article | Static long-form | Reading progress, active contents, margin notes (takeaways + market signal pull-outs), charts that draw on view, expandable methodology/sources |
| Strategies | Seven tiles | **Allocation universe** selector with a changing central canvas |
| Governance page | Text stack + placeholders | Interactive decision flow + function architecture |

## Visual DNA — the Nusantara lattice

Derived from the logo's geometry (without altering the logo): four interlocking
arched bands arranged as a pinwheel around a cross-axis, converging on a concave
four-point star. Used as:

- the four-point **star marker** (replaces diamonds/bullets, nav indicator, status);
- the **lattice** glyph (hero canvas, process visual, governance, loading);
- the **cross-axis rule** (section transitions).

## Motion principles

Motion carries information: values tween when the subject changes, charts morph
between periods, the process visual changes with the stage being read, a decision
token travels through governance gates. Everything respects
`prefers-reduced-motion`. Illustrative values never tick or update — only the
*selection* changes.

## Scenario demo

The hypothetical 100 → 153.9 allocation-index path is removed. Scenario analysis is
demonstrated with a macro, non-performance variable (an illustrative inflation-
pressure composite) in the market outlook.
