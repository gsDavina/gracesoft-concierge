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

## Where the apps use them

Files are copied as-is into each app's `public/` folder (the apps can't import from `_internal-docs/`). If an asset here changes, copy it over again.

| App | Favicon (`public/favicon.svg`) | Header wordmark (`public/brand/`) | Where the wordmark appears |
|---|---|---|---|
| `apps/admin-owner` | `logo-a.svg` | `wm-a-w.svg` | Dark sidebar, and the dark brand panel on the login screen |
| `apps/admin-kiosk` | `logo-k.svg` | `wm-k-w.svg` | Purple header band, and the purple login screen |
| `apps/demo` | `logo-d.svg` | `wm-d-w.svg` | Top of the home and pricing pages — white, so it only shows on a dark background |

Each app also has older inlined `src/brand/Wordmark.tsx` / `Mark.tsx` components (fills from CSS variables). They're no longer rendered anywhere and can be deleted when the assets are next tidied.
