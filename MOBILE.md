# Simple Reader on Android

Chrome (and every iOS browser) can't run extensions. On **Android** you need a Chromium
browser that supports them. Simple Reader's code runs as-is — the only mobile-specific change is a
responsive UI (full-width reader, bottom control bar, 44px touch targets).

## The browser landscape (mid-2026)

- **Kiwi Browser** — *dead* (shut down Jan 2025). Don't use it; no security updates.
- **Microsoft Edge Canary (Android)** — inherited Kiwi's extension engine, **maintained by
  Microsoft**. Most trustworthy. Installs extensions by **ID** (enable dev options → paste an
  extension ID), which in practice means the extension must be on the Chrome Web Store.
- **Mises** / **Quetta** — maintained Chromium forks that can install Web-Store extensions from
  the address bar. Some sideload `.zip` in a dev mode, but support is inconsistent; Mises has
  stability complaints and is web3-branded.

This leads to two paths. Pick based on whether you want it working *today* vs. cleanly *maintained*.

---

## Path A — Sideload the zip (works today, no Web Store)

Use a fork that still accepts an unpacked/`.zip` extension in developer mode (try **Mises** or
**Quetta**; verify the option still exists — this space changes fast).

1. Copy **`lectern.zip`** (produced by `npm run package`, or sent to you) to the phone.
2. In the browser, open its extensions page (e.g. `mises://extensions` or the menu → Extensions)
   and enable **Developer mode**.
3. Choose **Load / + from .zip** and select `lectern.zip`.
4. Open an article, then menu (⋮) → **Simple Reader** → **Read this page**.

> The zip must have `manifest.json` at its **root** (it does — it's a zip of `dist/`'s contents).

## Path B — Publish to the Chrome Web Store, install in Edge Canary (maintained)

Best long-term, and the trustworthy-vendor route.

1. One-time: create a Chrome Web Store developer account ($5). Zip `dist/` and upload it.
   **Publish as *Unlisted*** so only people with the link can install it (personal use).
2. After it's approved, note its **extension ID**.
3. On Android, install **Microsoft Edge Canary**.
4. Edge → `edge://flags` → enable the extensions/developer flag → in Extensions, **enable
   Developer mode** and add the extension by **ID** (or open its Web Store link).
5. Open an article → menu → **Simple Reader** → **Read this page**.

---

## Using it on the phone

- **Reader overlay** mode is the nicer mobile experience (full-screen clean reader, big text,
  auto-scroll). It's the default; toggle to in-place with ▤ if you want.
- The control bar sits across the bottom with large touch buttons; the progress bar is its own
  full-width row. Tap a word to start reading there (overlay mode).
- **Voices** come from your Android system TTS (Settings → Accessibility → Text-to-speech).
  Install/enable a good voice there; pick it in Simple Reader's voice dropdown.
- **Highlighting**: Android TTS doesn't always fire word-boundary events. When it doesn't,
  Simple Reader falls back to estimated timing, so highlighting still moves (it may drift slightly).

## Packaging

```bash
npm run package   # builds dist/ and writes lectern.zip (manifest at the zip root)
```
