# Noted repair notes — 2026-09-06

Changes made in this repaired source package:

- Added Netlify build configuration and SPA fallback routing for BrowserRouter routes.
- Added baseline response security headers for Netlify.
- Removed `.env` from the package, added `.env` patterns to `.gitignore`, and added `.env.example`.
- Removed the Bun-only prebuild/predev requirement; npm scripts now use the local `tsx` dependency.
- Made sitemap and robots generation use the deployment URL (`VITE_SITE_URL` or Netlify `URL`).
- Made in-app canonical/share URLs follow the actual deployed origin rather than the old Lovable URL.
- Corrected stale "Atelier" branding to "Noted" in current user-facing/MCP text.
- Added a Supabase migration that hardens shared media: immutable media identity fields, no photo-row updates, drawing OCR-only updates, and no storage-object UPDATE policy.

Important: the new Supabase migration must be applied to the live Supabase project before the database hardening is active in production.
