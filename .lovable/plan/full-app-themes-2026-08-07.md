# Full app themes

Today Settings only changes the highlight (accent) color. This adds full **themes** that change the whole look — background, text, cards, borders, corners, and fonts — not just the accent.

## Themes

1. **Warm Boutique** (current default) — cream background, taupe accents, Cormorant serif headings.
2. **Classic Light** — crisp white, cool grays, blue accent, clean sans headings.
3. **Midnight** — dark charcoal/navy background, light text, soft accent glow.
4. **Noir & Gold** — near-black with gold accents, high-end editorial serif.
5. **Paper & Ink** — off-white with rich black, Swiss/minimal, tighter corners.
6. **Sage Calm** — muted greens and warm cream, rounded and soft.

Each theme sets its own background, card, text, border, muted, destructive, accent, corner radius, and heading/body font pairing.

## Settings page changes

- New "Theme" section at the top, above the existing highlight color section.
- Themes shown as tappable preview cards with a mini swatch strip (background, card, text, accent) plus the theme name, with a check on the active one.
- Highlight color stays and continues to work — it overrides the theme's accent so you can, for example, run Midnight with red highlights.
- A "Use theme's own accent" option so the highlight picker can be left alone.
- Choice is saved on the device and applied instantly across every screen.

## Technical notes

- Extend `src/hooks/useSettings.tsx`: add a `THEMES` record keyed by theme id, each with a full set of HSL CSS variable values (`--background`, `--foreground`, `--card`, `--popover`, `--secondary`, `--muted`, `--border`, `--input`, `--accent`, `--destructive`, `--radius`, plus sidebar tokens) and font stack values for `--font-sans` / `--font-serif`.
- Add `theme: ThemeKey` and `accent: AccentKey | "theme"` to the persisted settings object in `localStorage` (`noted.settings.v1`), defaulting to `warm` / current accent for existing users.
- New `applyTheme(theme, accent)` sets all theme vars on `document.documentElement`, then applies accent vars on top when accent is not `"theme"`. Called in the provider effect in place of the current `applyAccent`-only call.
- Add `--font-sans` / `--font-serif` variables in `src/index.css` and reference them from the `body` and heading rules so themes can swap typography; add the needed Google Font links in `index.html`.
- Dark themes toggle the `dark` class on `<html>` so shadcn components resolve correctly.
- No component-level changes needed — all screens already use semantic tokens.
