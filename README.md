# Simple Reader

A Chrome and Edge extension that reads the current page aloud and **highlights each word as it's spoken** — free, and it all runs in your browser. Audio uses the browser's built-in Web Speech API, so there are **no API keys and nothing to pay for**.

## Features

- 🔊 Reads the main article aloud (Mozilla Readability strips nav/ads)
- ✨ Word + sentence highlighting, synced to the voice, with auto-scroll
- 🪟 Two modes: **reader overlay** (a clean panel) and **in-place** (highlights on the live page) — toggle with the ▤ button
- 🎚️ Controls: play/pause, stop, ⏮/⏭ by sentence, speed 0.5×–4×, voice picker, click-to-seek progress bar
- 👆 **Click any word** to start reading from there
- 🖱️ **Read selection**: highlight text → right-click → *Read selection with Simple Reader*
- 💾 **Remembers your position** per page and offers to resume
- ⌨️ **Keyboard shortcuts**: **Alt+Shift+S** (S for speak) reads the selected text or opens the reader on the page; **Alt+Shift+K** plays/pauses. Change them at `chrome://extensions/shortcuts`.

## Install

Nothing to build: download the ready-made extension and load it.

1. Download **[simple-reader.zip](https://github.com/kerbe42/lectern/releases/latest/download/simple-reader.zip)** (always the latest release).
2. Unzip it into a folder that can stay put. The browser runs the extension from that folder, so don't delete it afterwards.
3. Open the extensions page: `chrome://extensions` in Chrome, or `edge://extensions` in Edge.
4. Turn on **Developer mode** (top right in Chrome; bottom of the left-hand menu in Edge).
5. Click **Load unpacked** and choose the unzipped folder (the one with `manifest.json` in it).

Pin the Simple Reader icon, open any article, click the icon and choose **Open Simple Reader here**, then tap a word to start. Or just press **Alt+Shift+S**.

**Updating:** download the new zip, unzip it over the same folder, then click the reload button (↻) on Simple Reader's card in the extensions page.

**Why not a one-click install?** On Windows and Mac, Chrome and Edge only install packaged (`.crx`) extensions from their web stores, or ones an IT admin pushes by policy. Loading the unzipped folder is the supported way to add an extension from anywhere else.

## Voices

Simple Reader uses whatever voices Chrome exposes. **Local** voices are listed first because they reliably report word timing (a ☁ marks network voices). To add higher-quality voices on Windows: **Settings → Time & Language → Speech → Manage voices → Add voices**, then restart Chrome.

If you pick a network voice that doesn't report word boundaries, highlighting falls back to an estimated pace so it never freezes (it may drift slightly).

## Build from source

```bash
npm install
npm test          # unit tests
npm run typecheck # tsc --noEmit
npm run build     # bundle to dist/ (load that folder unpacked)
npm run package   # build + zip dist/ into lectern.zip
```

Releases are automatic: bump `version` in `public/manifest.json` and `package.json`, then push a matching tag (`git tag v0.3.0 && git push --tags`). GitHub Actions tests, builds and attaches `simple-reader.zip` to the release.

The bug-prone core logic (text → tokens → sentence chunks → word timing) is pure and unit-tested. The browser-dependent pieces (DOM extraction, speech engine, highlighters, UI) are verified manually in the browser.

## Architecture

`src/content` is injected on demand (no broad host permissions). It extracts page text into a **token map**, builds sentence-aligned **speech chunks**, speaks them via `speechSynthesis`, and maps `boundary` events back to word tokens for highlighting. Two highlighters share one interface: overlay (wrapped `<span>`s in a Shadow-DOM panel) and in-place (CSS Custom Highlight API on the live page).

## Known limitations

- Text inside cross-origin iframes can't be read (browser security).
- Cloud TTS is intentionally not included — it needs a paid API key and doesn't provide word timings. Simple Reader stays free and local.
