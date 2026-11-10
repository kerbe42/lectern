# Simple Reader

A Chrome and Edge extension that reads the current page aloud and **highlights each word as it's spoken** — free, and it all runs in your browser. Audio uses the browser's built-in Web Speech API, so there are **no API keys and nothing to pay for**.

## Features

- 🔊 Reads the main article aloud (Mozilla Readability strips nav/ads)
- ✨ Word + sentence highlighting, synced to the voice, with auto-scroll
- 🪟 Two modes: **in-place** (highlights on the live page, the default) and **reader panel** (a clean side panel) — toggle with the ▤ button. If a page has nothing readable in place, the panel opens instead.
- 🎚️ Controls: play/pause, stop, ⏮/⏭ by sentence, speed 0.5×–4×, voice picker, click-to-seek progress bar
- 👆 **Tap any word** on the page to start reading from there. Links, buttons and expandable sections keep working as normal; open a collapsed section, tap a word in it, and it reads from there.
- 🔄 **Keeps up with the page**: when a page loads more text, or you move to another page on the same site, the reader picks up the new text by itself. No re-scan click: tap a word and it reads.
- 📑 **Headings** are read on their own with a short pause before and after, instead of running into the next paragraph
- 🗣️ **Natural voice by default**: picks a natural-sounding voice in the page's language (in Edge, the "Natural" voices) instead of the robotic built-in ones
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

**Updating:** when a new version is out, the icon shows **NEW**. Open the popup and click **Update now**. The first time, the browser asks you to pick Simple Reader's folder (the one with `manifest.json` in it, the folder you chose in Load unpacked) and to allow editing it; after that, updating is one click. The update is downloaded from this repo's releases, checked against GitHub's published checksum, written into the folder, and the extension restarts. Settings and reading positions are kept.

**Coming from v0.2.0 or older?** Those versions can't update themselves, so do this once: remove the old Simple Reader from the extensions page, then install v0.3.0 or later as above.

**Why not a one-click install?** On Windows and Mac, Chrome and Edge only install packaged (`.crx`) extensions from their web stores, or ones an IT admin pushes by policy. Loading the unzipped folder is the supported way to add an extension from anywhere else.

## Voices

Simple Reader uses the voices the browser offers. By default it picks one in the page's language, preferring natural-sounding voices: Edge's **Natural** voices, or Chrome's online voices, over the built-in robotic ones (a ☁ marks online voices). Pick any other voice from the control bar and it's remembered.

Edge has the best free natural voices. To add more built-in voices on Windows: **Settings → Time & Language → Speech → Manage voices → Add voices**, then restart the browser.

If a voice doesn't report word timing, highlighting follows an estimated pace so it never freezes (it may drift slightly).

## Build from source

```bash
npm install
npm test          # unit tests
npm run typecheck # tsc --noEmit
npm run build     # bundle to dist/ (load that folder unpacked)
npm run package   # build + zip dist/ into lectern.zip
```

Releases are automatic: bump `version` in `public/manifest.json` and `package.json`, then push a matching tag (`git tag v0.3.1 && git push --tags`). GitHub Actions tests, builds and attaches `simple-reader.zip` to the release.

The bug-prone core logic (text → tokens → sentence chunks → word timing) is pure and unit-tested. The browser-dependent pieces (DOM extraction, speech engine, highlighters, UI) are verified manually in the browser.

## Architecture

`src/content` is injected on demand (no broad host permissions). It extracts page text into a **token map**, builds sentence-aligned **speech chunks**, speaks them via `speechSynthesis`, and maps `boundary` events back to word tokens for highlighting. Two highlighters share one interface: overlay (wrapped `<span>`s in a Shadow-DOM panel) and in-place (CSS Custom Highlight API on the live page).

## Known limitations

- Text inside cross-origin iframes can't be read (browser security).
- Tapping a link or button follows it rather than starting there: tap a nearby word instead.
- In-place mode reads what's open on screen. Collapsed sections are skipped until you open one (or use the reader panel, which reads everything).
- The reader follows you from page to page on the same site. When the tab goes to a different site, the browser withdraws the extension's access to the tab, so open the reader again there (icon or Alt+Shift+S).
- Cloud TTS is intentionally not included — it needs a paid API key and doesn't provide word timings. Simple Reader stays free and local.
