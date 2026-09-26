# Asset Mapping

## Wordmarks

Ideal for large screen primary headers and footers.

- `wm.png|svg` - Wordmark in brand colours.
- `wm-b.png|svg` - Wordmark in black.
- `wm-w.png|svg` - Wordmark in white.

## Logos

Ideal for mobile screen primary headers and footers and favicons.

- `logo.png|svg` - Logo in brand colours.
- `logo-b.png|svg` - Logo in black.
- `logo-w.png|svg` - Logo in white.
- `logo-s.png` - Logo in brand colours on a 1:1 canvas. Meant to be the site's favicon.

## Per-App Variants

Same colourways as above (brand colours / `-b` black / `-w` white), with the app name on an extra line (wordmark) or a second row of letters (logo).

- `wm-a*`, `logo-a*` - Concierge Admin (`apps/admin-owner`). Logo reads CC / AN.
- `wm-k*`, `logo-k*` - Concierge Kiosk (`apps/admin-kiosk`). Logo reads CC / KO.
- `wm-d*`, `logo-d*` - Concierge Demo (`apps/demo`). Logo reads CC / DM.

The apps inline these vectors as React components (`src/brand/Wordmark.tsx` and `src/brand/Mark.tsx`). Their fills come from CSS variables, so a single component covers all three colourways and dark mode.
