# Noted Personal — separate offline Android test app

## Separation

- App ID: `com.keithfell.noted.personal`; display name: **Noted Personal Test**.
- Android loads **personal/dist**, not the online app's **dist**. Running `npm run build`
  still builds the existing online app for Netlify; `npm run build:personal` builds the
  separate personal app. Never point Netlify at personal/dist by accident.
- The Android manifest explicitly removes INTERNET permission. The personal entry
  imports no Supabase client, cloud OCR, remote fonts, analytics, or online auth.
- Both copies remain separate. There is no automatic synchronization.

## Implemented

- Customer name, formatted phone, email, designers, shoe size/width, wants, notes,
  personal notes, and searchable records; custom data is preserved and readable.
- To-dos linked to customers, dates/times, completion, editing, deletion, and ordering.
- Pictures resized locally and stored with the record; local drawing canvas. Deleting
  a customer removes their to-dos and media in the same transaction.
- Local SQLite storage on Android; IndexedDB for the browser test copy. Both use
  revision checks, atomic writes, and errors rather than silently replacing corrupt data.
- Complete JSON backups include media bytes and settings, a version and SHA-256
  integrity check. Android's document picker handles Save and Restore. Restore validates
  the entire file before replacing the notebook and requires a current backup if it
  would overwrite records. Maximum backup size is 64 MiB. Backups are not encrypted.
- Local fonts (Inter, Lora, Manrope, Kalam), themes, and highlight-aware logo.
- On-device Android dictation, with no network speech fallback. Review text before
  saving. Device/language support and microphone permission must be tested on the Pixel.
  Dates are chosen explicitly; the text is not sent to an AI provider for interpretation.

## Read-only migration from the online app

The online build adds `/personal-export`, linked from Settings. Sign in to the existing
account and choose **Copy my notebook**. It exports only that account's own customer
records and contributions. By default team customers are excluded; an explicit
checkbox includes team customers where the signed-in account is the recorded owner.
Other users' records and contributions are excluded. The screen reports excluded
customer/task counts. Stop editing while making the copy.

Actual photos/drawings are downloaded, embedded, and checked by a backup round trip.
If a media download fails, no partial backup is produced. This feature never inserts,
updates, deletes, or changes access to online data. Transfer this JSON to the Pixel and
Restore it in Noted Personal **after** the sample-data acceptance test. Keep Supabase
and the online app until the copied records and pictures have been verified on-device.

## Build and tests

```sh
npm ci
npm test
npx vitest run --config personal/vitest.config.ts
npx tsc --noEmit -p personal/tsconfig.json
npm run android:sync
cd android
./gradlew assembleDebug
```

Use a full JDK 21 and Android SDK 36/build-tools 36.0.0. The developer workspace built
an APK after installing those prerequisites. The browser test in
`personal/tests/smoke.mjs` requires Playwright/Chromium and a production preview at
127.0.0.1:5182. Set PLAYWRIGHT_CHROMIUM_EXECUTABLE if Chromium is installed outside Playwright.
The browser smoke test covers records/tasks, actual pictures and drawings, reload,
backup/restore, restore protection, settings, ordering, and absence of external requests.

Validation completed: 23 existing/voice/migration unit tests plus 7 local-storage and backup tests passed; both TypeScript checks and production builds passed. The browser smoke test passed. Native assembleDebug and APK signature verification passed; packaged permissions exclude INTERNET.

## Remaining acceptance gates

- Pixel: install alongside current Noted, create sample records, force-close/reopen,
  airplane-mode creation/edit/delete, photos/drawings, denied microphone permission,
  on-device speech/language availability, and Android document-picker backup/restore.
- Verify the migration file contains the expected customer/task/media counts and
  review all copied attachments on the Pixel. No production data has been migrated.
- This is a debug-signed test build. Preserve its signing key for future test updates.
  Production signing and final upgrade path must be settled before relying on it as
  the only copy of real customer data. Do not uninstall a populated app without backup.
- Advanced custom-field editing and calendar export are not included in this first
  personal test build. Imported custom data and calendar preference are retained.
- ChatGPT, Gemini, and Claude integrations are not connected. Optional AI would need
  a separate explicit online action, selected-record disclosure, and review-before-save;
  no provider keys are embedded in either app.
