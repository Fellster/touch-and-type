Add a "Send a Link" button to the Settings page that shares the public published app URL via the device's native share sheet, with a clipboard fallback.

What will change
- A new "Share Noted" section will appear on `/settings`, below the existing Account / Log Out section.
- The section contains a single button labeled "Send a link".
- Tapping the button invokes `navigator.share` with:
  - Title: "Noted"
  - Text: "Try Noted for keeping track of customers."
  - URL: `https://touch-and-type.lovable.app` (the project's published URL)
- If `navigator.share` is unavailable (desktop browsers without support, etc.), the button falls back to copying the URL to the clipboard and showing a toast confirmation.
- The existing Log Out button and settings sections remain unchanged.

Technical approach
- Import `LogOut` and `Share2` (or similar) icons from `lucide-react` in `src/pages/Settings.tsx`.
- Add a `handleShare` helper that:
  1. Checks for `navigator.share`.
  2. Calls `navigator.share({ title, text, url })` and catches `AbortError` silently if the user cancels.
  3. Otherwise writes the URL to the clipboard and uses the existing `use-toast` hook (or `sonner`) to confirm.
- Wrap the button in a new `<section>` matching the current Settings card layout (`px-5 max-w-2xl mx-auto mt-10`).
- Hard-code the published URL as a constant in the component; no backend or environment change is needed.
