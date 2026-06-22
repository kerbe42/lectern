# Lectern — Chrome Web Store submission notes

Everything you need to paste into the Developer Dashboard, plus the answers for the privacy forms.

## Single purpose (required field)

> Lectern reads the current web page aloud using the browser's built-in text-to-speech and
> highlights each word as it is spoken.

## Short description

> Read any web page aloud with synced word highlighting. Free, on-device, no account, no API keys.

## Detailed description (suggested)

> Lectern turns any article into audio and highlights each word as it's read — like a built-in
> audiobook for the web.
>
> • Reads the main article aloud with the current word + sentence highlighted and auto-scroll
> • Two modes: a clean reader overlay, or highlight in place on the live page
> • Tap any word to start reading from there
> • Read a selection via the right-click menu
> • Adjustable speed and voice; remembers where you left off
>
> 100% on-device: uses your browser's built-in voices, makes no network requests, has no ads,
> trackers, or analytics, and requests no broad website permissions.

## Permission justifications (required, per-permission)

- **activeTab** — To read and narrate the content of the tab **only when you click the Lectern
  icon or use its right-click menu**. No passive or background page access.
- **scripting** — To inject Lectern's reader into that active tab on your action so it can extract
  the article text and render the highlight/controls.
- **storage** — To save your preferences (voice, speed, highlight color, mode) and your reading
  position so it can offer to resume. Stored locally; never transmitted.
- **contextMenus** — To add the "Read selection with Lectern" right-click item.
- **Host permissions** — None requested. Access is gated by `activeTab` + a user gesture.

## "Reads or changes data on websites" disclosure

Lectern reads page text (to narrate it) on the tab you activate it on. It does **not** change
website content beyond a temporary in-page reader overlay/highlight, and it transmits nothing.

## Data safety / privacy practices form

- Personal/sensitive data collected or used: **None.**
- Data sold or shared with third parties: **No.**
- Data transmitted off device by the extension: **None** (no network requests).
- Local storage only: preferences (`storage.sync`) and reading positions (`storage.local`,
  origin+path only). A "Clear saved reading positions" control is provided.
- Note for reviewers: "online" Web Speech voices (☁) may route text through the browser/OS TTS
  provider — a platform feature outside the extension's control; local voices avoid it.
- **Privacy policy URL:** host `PRIVACY.md` at a public URL and paste it here
  (e.g. GitHub Pages, or https://jlwhite.ca/lectern/privacy).

## Assets checklist

- [x] Icons 16/48/128 (in `dist/icons`, declared in manifest)
- [ ] Store icon 128×128 (dashboard upload — can reuse `dist/icons/icon128.png`)
- [ ] At least 1 screenshot (1280×800 or 640×400) — capture the reader overlay + control bar
- [ ] Small promo tile 440×280 (optional but recommended)

## Pre-submission checks

- [ ] Confirm the name "Lectern" doesn't collide with an existing Web Store item; rename if so.
- [ ] Build with `npm ci && npm run package`; upload `lectern.zip`.
- [ ] Publish **Unlisted** first if you only want it for yourself / link-sharing.
