# Simple Reader — Privacy Policy

_Last updated: 2026-06-22_

Simple Reader reads web pages aloud and highlights words as they are spoken. It is designed to do
this **entirely on your device**.

## What Simple Reader does NOT do

- It does **not** collect, sell, or share any personal information.
- It does **not** send your browsing data, the pages you read, or any usage analytics to us or
  to any third-party server. **Simple Reader makes no network requests of its own.**
- It contains **no ads, no trackers, and no analytics**.

## What Simple Reader stores (locally, on your device)

- **Preferences** (voice, reading speed, highlight color, overlay/in-place mode) via
  `chrome.storage.sync`. If you have Chrome Sync enabled, Chrome itself may sync these small
  settings across your signed-in devices — this is a Google/Chrome feature, not a transfer to us.
- **Reading positions** so it can offer to resume where you left off, via `chrome.storage.local`.
  These are keyed by site origin and path only — **query strings and URL fragments are never
  stored**. You can erase all saved positions at any time with **"Clear saved reading positions"**
  in the extension popup.

This data never leaves your device through Simple Reader.

## Page content

To read a page, Simple Reader reads the text of the page you explicitly activate it on (via the toolbar
popup or the right-click "Read selection" menu). This text is processed **in memory on your
device** to generate speech and word highlighting. It is not stored or transmitted by Simple Reader.

## Voices (Web Speech API)

Simple Reader speaks using your browser/operating system's built-in text-to-speech voices. Some voices
are **"online/network" voices** (shown with a ☁ marker in the voice list). If you choose one of
those, your browser or operating system may send the text to its own TTS provider to synthesize
audio. This is handled by your browser/OS, not by Simple Reader, and is outside Simple Reader's control —
choose a **local** voice if you wish to avoid it.

## Permissions

Simple Reader requests the minimum permissions needed: `activeTab` and `scripting` (to read and narrate
the page **only when you activate it**), `storage` (for the preferences and reading positions
above), and `contextMenus` (for the "Read selection" menu item). It requests **no host
permissions** and has no background access to your browsing.

## Contact

Questions about this policy: please open an issue at https://github.com/kerbe42/lectern/issues
