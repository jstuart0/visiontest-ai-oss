# VisionTest.ai — Design Proofs

Five standalone design directions, each a single HTML file that shows a
landing hero + a realistic test-result report so you can compare them
apples-to-apples. Every proof has a light/dark toggle in the top-right.

## Preview

```sh
# From the repo root
cd design-proofs && python3 -m http.server 8765
# Open http://localhost:8765/ for the index, or any /0N-*.html directly.
```

Or just open any `.html` file in a browser — fonts load from Google
Fonts, no build step.

## The five

| # | Direction | One-liner | Typography |
|---|---|---|---|
| 01 | **Darkroom** | Analog darkroom — film grain, safelight, sprocket frames, phosphor-green pass | Fraunces · Instrument Sans · Fragment Mono |
| 02 | **Editorial** | New Yorker tech longform — drop caps, columns, pull-quotes, single cadmium red | Fraunces · Newsreader · Manrope · IBM Plex Mono |
| 03 | **Observatory** | Hi-vis brutalist — monumental condensed type, hazard tape, offset shadows | Unbounded · Archivo · Space Mono |
| 04 | **Lab Notebook** | Field journal — graph paper, handwritten brand, red pen corrections | Caveat · Source Serif 4 · Inter Tight · Courier Prime |
| 05 | **Cinema** | Title-card noir — letterboxed, Italiana caps + Bodoni italic, teal on ink | Italiana · Bodoni Moda · Manrope · JetBrains Mono |

## Picking one

Open `index.html` and click each card to compare. When you've picked,
I'll build the full design language (tokens, globals.css, component
updates, key pages) against the real Next.js app.

Each proof is intentionally opinionated — none is "safe." The goal is
to leave AI-slop behind; you pick the direction the product should live
in for the next year.
