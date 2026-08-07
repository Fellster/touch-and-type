# Add preview link to main navigation

## Goal
Make the public `/preview` page reachable from the app’s main navigation so users (and anyone they share the app with) can easily find the demo.

## Current state
- The main app navigation lives in the header of `src/pages/Index.tsx` (the To-Do page).
- It currently has icon buttons for: Customer notebook, Settings, and Sign out.
- Other protected pages (`/customers`, `/designers`, `/settings`, `/c/:id`) use a back arrow to return to `/`.
- `/preview` is a public route showing sample customers with working search.

## Plan
1. **Add a Preview icon button** to the top-right icon row in `src/pages/Index.tsx`, next to the existing Customer notebook button.
   - Use a Lucide icon that suggests preview/demo (e.g., `Eye` or `PlayCircle`).
   - Label it "Preview" with an `aria-label` and `title`.
   - Navigate to `/preview` on click.
2. **Verify responsive layout** — the header icon row has room; confirm spacing on mobile.
3. **Update sitemap if needed** — `/preview` is already listed; no change required.
4. **Build check** — run the build to ensure no import or type errors.

## Files to edit
- `src/pages/Index.tsx` — add Preview icon button and import the chosen icon.

## Out of scope
- No new routes or pages.
- No changes to the Preview page content.
- No shared nav component refactor unless needed for spacing.
