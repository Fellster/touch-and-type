# Noted Personal for Android — development status

This branch starts the Android conversion. It is **not yet an offline edition**.
Customers, media, authentication, and to-dos still use the existing Supabase backend.
Do not remove the backend, uninstall the working app, or import production records into this test app yet.

## Implemented in this milestone

- Capacitor Android shell with separate app ID `com.keithfell.noted.personal`.
- On-device Android speech recognition (Android 12+). It deliberately never falls
  back to the network speech recognizer. Speech service/language availability still
  depends on the device; errors explain that typing or keyboard dictation remains available.
- Browser dictation replaces the missing `voice-parse` cloud function. Before recording,
  the dialog explains that browser speech may send audio online. No recordings are
  sent to Supabase or Lovable by the new voice code.
- An editable text fallback, review-before-save, permission/error handling, microphone
  cleanup, timeout, and duplicate-save protection.
- Free text remains free text. A spoken date is not automatically converted; set the
  due date in the review. Dictating on a customer record appends a note. Global
  dictation asks the user to choose the intended entry type and fill customer fields.
- Optional future AI actions should be separate from dictation, show the selected
  provider and exactly which text/images will be sent, and require user review of
  proposed edits. No AI provider is connected by this change.

## Validation

TypeScript, the Vite production build, and all 20 Vitest tests pass.
Capacitor Android sync passes. Native compilation could not run in the development
workspace because the Gradle distribution download was network-blocked. Native
speech permission, lifecycle, and airplane-mode tests on the Pixel remain required.

## Build a development APK

Use Node 24, the Android SDK, and the Java version required by this Capacitor release.
Do not put secret keys in `VITE_*` variables. This intermediate shell needs the same
public Supabase configuration as the web app while data migration is unfinished.

```sh
npm ci
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

The debug APK is not a production release. It currently needs internet for records.

## Remaining migration milestones

1. Export the signed-in user's personal customers, linked to-dos, custom fields,
   personal notes/wants, and actual media bytes. Check counts and per-file checksums.
   Do not assume a list of storage paths is a media backup. Do not silently import
   other team members' records or revoke any team permissions.
2. Implement native local storage and migrate the existing screens to it. Remove
   sign-in, teams, invitation/sharing controls, cloud OCR, remote fonts, and backend
   calls from the offline build. Preserve the web build separately.
3. Backup/Restore using Android's file picker, versioned schema, complete embedded
   media, validation, and atomic restore. Reject corrupted backups before modifying
   current records. Verify restoration on a clean installation before retiring Supabase.
4. Test restart, airplane mode, lost permissions, low storage, photo/drawing import,
   deletion, task ordering, and a full backup-to-replacement-device round trip.
5. Add an update-signing process so future APKs preserve app data. Deliver the APK
   only after the offline checks pass; the Pixel test is the acceptance gate.
