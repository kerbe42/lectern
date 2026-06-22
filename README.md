# Lectern

A Chrome extension that reads the current page aloud and **highlights each word as it's spoken** — free, and it all runs in your browser. Audio uses the browser's built-in Web Speech API, so there are **no API keys and nothing to pay for**.

## Features

- 🔊 Reads the main article aloud (Mozilla Readability strips nav/ads)
- ✨ Word + sentence highlighting, synced to the voice, with auto-scroll
- 🪟 Two modes: **reader overlay** (a clean panel) and **in-place** (highlights on the live page) — toggle with the ▤ button
- 🎚️ Controls: play/pause, stop, ⏮/⏭ by sentence, speed 0.5×–4×, voice picker, click-to-seek progress bar
- 👆 **Click any word** to start reading from there
- 🖱️ **Read selection**: highlight text → right-click → *Read selection with Lectern*
- 💾 **Remembers your position** per page and offers to resume

## Install (developer / unpacked)

```bash
npm install
npm run build      # or: npm run watch
```

Then in Chrome:

1. Go to `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked** and choose the **`dist/`** folder

Pin the Lectern icon, open any article, click it, and hit **▶ Read this page**.

## Voices

Lectern uses whatever voices Chrome exposes. **Local** voices are listed first because they reliably report word timing (a ☁ marks network voices). To add higher-quality voices on Windows: **Settings → Time & Language → Speech → Manage voices → Add voices**, then restart Chrome.

If you pick a network voice that doesn't report word boundaries, highlighting falls back to an estimated pace so it never freezes (it may drift slightly).

## Development

```bash
npm test          # unit tests (tokenizer, token map, chunker, estimator)
npm run typecheck # tsc --noEmit
npm run build     # bundle to dist/
```

The bug-prone core logic (text → tokens → sentence chunks → word timing) is pure and unit-tested. The browser-dependent pieces (DOM extraction, speech engine, highlighters, UI) are verified manually in the browser.

## Architecture

`src/content` is injected on demand (no broad host permissions). It extracts page text into a **token map**, builds sentence-aligned **speech chunks**, speaks them via `speechSynthesis`, and maps `boundary` events back to word tokens for highlighting. Two highlighters share one interface: overlay (wrapped `<span>`s in a Shadow-DOM panel) and in-place (CSS Custom Highlight API on the live page).

## Known limitations (v1)

- Text inside cross-origin iframes can't be read (browser security).
- No keyboard shortcuts yet.
- Cloud TTS is intentionally not included — it needs a paid API key and doesn't provide word timings. Lectern stays free and local.
