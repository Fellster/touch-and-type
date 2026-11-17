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
  the entire file before replacing the notebook and asks for one restore confirmation before replacing records. Maximum backup size is 64 MiB. Backups are not encrypted.
- Local fonts (Inter, Lora, Manrope, Kalam), themes, and highlight-aware logo.
- On-device Android dictation, with no network speech fallback. Review text before
  saving. Device/language support and microphone permission must be tested on the Pixel.
  Dates are chosen explicitly; the text is not sent to an AI provider for interpretation.

## Original-app appearance (test build 1.1)

The personal app now uses the original compact To-Do page and shortcuts, two-step
Add Customer flow, read-only customer page with pencil to open the full editor,
size/width row, designer and wants tags, separate drawings/photos, designer search,
and theme/font/highlight controls. Task titles edit inline, grouped tasks reorder
with drag handles, and deletion can save the task to customer notes atomically.
Customer changes require Save Changes; Done/Back confirm discarding unsaved edits.
Existing storage/backup schemas and application identity are unchanged. Version code
10 installs over the first test APK with the preserved signing key. Calendar/Gmail/
Drive integration is a later stage; this build remains fully offline.

## 1.2 refinements

My customer notes is removed from read and edit pages; existing text is combined
into Customer Notes for display and consolidated there when explicitly edited.
The backup schema is unchanged. Scheduled tasks show a localized date and time,
with the native date/time picker still available by tapping the schedule. Dragging
uses a floating overlay, larger handle, shorter activation distance, and immediate
local order on drop while the transactional save completes. A failed save restores
the previous order and displays an error. Reordering stays within date groups.

## 1.3 typography correction

Use the original shared font stacks for the full app and headings, match its heading
tracking and font-choice weight, bundle the original 400/500/600 faces for Inter,
Lora and Manrope and 400 for Kalam, and allow the same browser synthesis as the
online app. Fontsource's complete language-subset definitions keep extended
characters available locally. No remote stylesheet is requested. Browser checks
verify each font really renders as a custom font and every requested face loads.

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
`personal/tests/parity.mjs` requires Playwright/Chromium and a production preview at
127.0.0.1:5182. Set PLAYWRIGHT_CHROMIUM_EXECUTABLE if Chromium is installed outside Playwright.
The browser smoke test covers records/tasks, actual pictures and drawings, reload,
backup/restore, restore protection, settings, ordering, and absence of external requests.

Validation completed: 23 existing/voice/migration unit tests plus 26 local-storage, backup, appearance, Android-draft, and task-order tests passed; both TypeScript checks and production builds passed. The browser smoke test passed. Native assembleDebug and APK signature verification passed; packaged permissions exclude INTERNET.

## Remaining acceptance gates

- Pixel: Backup and Restore confirmed by the user on the first test build. Install this update over Noted Personal Test (do not uninstall). Verify the original-app screens and create sample records, force-close/reopen,
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

## 1.4 screenshot parity correction

The original compiled font-serif utility resolves to the system serif stack,
independent of the selected body font. Match this actual cascade rather than just
its settings variables. Settings uses its compact back/title row, 24px title,
20px section headings, 14px theme labels, and two-column font choices. Text-size
adjustment and 24px pinstripe spacing match the original stylesheet. Browser checks
verify heading typography, font grid geometry, and the actual custom font used in
each font choice.

## 1.5 additional personal themes and compact text

Add Hardcore Punk (black/bone, blue-violet, bundled stencil face and photocopy
background), Gallery (monochrome, sans headings and open task rows), and Botanical
(sage, forest green and local vector foliage) only to the separate personal app.
Existing themes and font choices remain. Body/task text is reduced to 14px, customer
names to 28px, Settings title to 22px, without reducing touch targets. New theme keys
round-trip through the same version-1 backup format; older test builds should not
be used to restore backups with the new themes. No customer data migration occurs.

## 1.6 editable field names

Settings has Field names with editable Designers, Shoe size, Width and Wants labels,
Save field names, and Reset. Labels apply to customer reading/editing, tag entry,
customer summaries and designer navigation/search. Customer data keys and values
stay unchanged. Labels are stored locally and included in complete backups. Older
notebooks/backups without labels open using original defaults; older app builds
cannot restore backups containing this new settings field.

## 1.7 camera, photo gallery, mark and Android Google actions

Photos in customer reading/editing has separate Take photo and Upload controls.
Capture uses Capacitor's built-in capture-enabled image file chooser, handing off
to the installed camera through a FileProvider URI. Upload remains a standard file
picker. No broad photo-library or camera permission is requested. Images normalize
through the existing local resize/storage path. Clean square thumbnails open full
images; edit mode keeps a small delete control. The in-app and Android launcher
marks contain only the handwritten n, without paper, background badge or period.
Android's launcher still supplies its normal adaptive icon background/mask.

Scheduled to-dos offer an explicit Google Calendar draft (30-minute event titled
Noted follow-up with the linked customer name), with fallback to another installed
calendar. User reviews/saves and sets reminders there. Calendar events are copies,
not synchronization: changes/deletion must be made in the calendar too. Customer
email opens Gmail compose, falling back to another mail app; no message sends
automatically and no notebook/attachment content is added. These native intents
need no calendar/mail/account permissions and carry no tokens or keys.

Back up to phone targets local storage. Back up to Google Drive checks for the Drive
provider and opens Android's location picker starting at a writable Drive root
when available; user chooses account/folder and confirms Save. Restore accepts
phone or Drive files. Drive owns account sign-in, network upload and its completion;
a successful document-provider write is not proof that upload has finished. No
background/automatic Drive backup or direct Google API connection is implemented.
The notebook remains offline and the APK still excludes INTERNET permission.

Acceptance on Pixel: camera capture/cancellation, upload, new thumbnails/full view,
Gmail compose, Google Calendar draft date/time and reminder, local backup/restore,
and Drive write/upload confirmation plus restore. Native app handoffs cannot be
fully confirmed by browser tests.

## 1.8 zero-byte export repair

Stage the validated backup in an app-private file before opening Android's document
picker, rather than relying on a large PluginCall text argument after returning.
Remove the large text option before saved Activity state and restore the small pending
export flag after recreation. The result callback can complete from the staged file
even when the original JavaScript call is gone. Copy on the plugin worker thread
using standard write mode, close the destination, then reopen and compare byte count
and SHA-256 before resolving with verified=true and a nonzero size. Empty, truncated,
changed or unverified writes fail; remove the newly-created failed document where
possible. Never use an empty-string export fallback. Notebook SQLite is not modified.

Native JVM regressions cover complete UTF-8/media-like data, reopening staged content,
silent zero-byte providers, truncation, same-size corruption, absent/empty staging,
and destination close failure. Restore errors explicitly explain empty/ZIP/incomplete
files. JS requires native verification before confirming export or enabling overwrite.
Pixel acceptance still required: create a new phone backup, confirm nonzero size and
restore; then repeat through Drive and confirm upload.

## 1.9 simple restore

Remove the required extra export before restore at the user's request. The flow is
Restore backup, choose a file, review counts and the replacement notice, Restore.
Only a fully validated file can open this confirmation; replacement remains an
atomic storage write with revision checks. The prior notebook is replaced, not
merged; no automatic rollback copy is added. Independent backup remains available.
Browser regression verifies restore is enabled for a valid file on a populated
notebook, no extra-backup button appears, and invalid files still cannot restore.

## 1.10 offline notifications

Opt-in Notifications in Personal Settings: scheduled to-do alerts, optional weekly
backup reminders, Test notification and an optional Android precise-timing setting.
Permission is requested only from these controls. Without exact alarm access, alerts
use inexact scheduling and the UI explains possible delays. No internet, push server,
Supabase or daily digest is added. Calendar alerts remain separate copies.

Pinned Capacitor Local Notifications 8.3.1 persists alarms natively and restores them
after reboot. Reconcile after notebook changes and resume. Stable integer IDs and
content fingerprints avoid duplicates. Completion, deletion, rescheduling and
switching reminders off cancel obsolete scheduled AND delivered alerts. Enabling
never replays all past tasks. Task name/customer name are the only alert content;
channels default to secret lock-screen visibility. The monochrome status icon is n.

Tap to open the customer/to-do list. Complete and 15-minute/1-hour snooze open the app
and apply after notebook load. Guard changed due dates/titles, missing/completed tasks
and disabled reminders. Preserve active edit drafts. Snooze leaves the due date alone.
Choices/snoozes/backup freshness stay on this phone, outside imported notebooks.
Only verified successful native exports reset the weekly backup interval; failed or
canceled exports and browser downloads do not. Drive still owns upload completion.
Reminder errors never roll back a saved notebook or report a verified backup as failed.

Validation: planner/reconciliation regressions, existing notebook/browser tests,
TypeScript, Android unit tests/build. Pixel acceptance: allow notifications, test,
schedule a task a few minutes ahead, leave/lock phone, open alert, snooze, complete;
reschedule/delete and verify old alert is gone. Repeat after restart and in airplane
mode. Physical Pixel delivery remains to be tested. Android force-stop, Do Not
Disturb and battery restrictions can prevent/delay delivery.

## 1.11 calendar timestamp repair

Read event begin/end values as Number rather than PluginCall.getDouble, which ignores
Long values. Android's JSON decoder represents ordinary epoch millisecond timestamps
as Long; the old implementation therefore rejected valid scheduled tasks. Validate
finite, integral JavaScript-Date-range milliseconds and increasing begin/end before
opening the same user-reviewed calendar draft. Native tests cover realistic Long,
Double, Integer, missing/invalid/fractional dates and backwards/zero-length ranges.
