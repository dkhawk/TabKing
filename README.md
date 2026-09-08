# TabKing - Smart Tab & Session Manager (Chrome Extension)

**TabKing** is a high-performance Chrome Extension built with **Manifest V3** to manage tab overload with automated regex grouping, full workspace session snapshots, visual tab previews, and advanced Regular Expression tab searching.

---

## Key Features

### 📸 1. Visual Tab Finder & Preview Lightbox (`finder/finder.html`)
* **On-Demand Thumbnail Previews**: Tabs without pre-cached screenshots display a sleek `📸 Show Thumbnail` trigger. Click to capture in real time without losing your scroll or active window focus.
* **Interactive Full Preview Lightbox**: Zoom in on any tab screenshot in a high-resolution dialog modal equipped with live status badges (sleeping/RAM discarded, audio playing, window & group affiliations, tab age) and on-demand AI content summaries.
* **Bulk "Add All Thumbnails"**: One-click batch capturing across all currently filtered tabs or selected subsets. Background engine sequentially activates tabs, renders compositor frames, and restores the original tab seamlessly.
* **Smart Storage Compression**: Employs `OffscreenCanvas` in the service worker to compress captures into lightweight ~15KB JPEGs, preserving `chrome.storage.local` quotas.
* **Advanced Regular Expressions Search**: Full RegExp pattern matching (`/pattern/flags`) with live syntax error detection and feedback.
* **Smart Filter Chips**: Quick filtering by Group Status, Thumbnail availability, and auto-discovered Domain pills (e.g. `github.com`, `google.com`).
* **Visual Card Grid & Compact List Views**: Switch seamlessly between visual thumbnail cards and list view.

### 🗂️ 2. Extension Popup with Thumbnail Drawers (`popup/popup.html`)
* **Inline Thumbnail Drawers**: Click the `📸` camera icon next to any tab to open an inline preview drawer with on-demand capture, retake, and jump actions.
* **Bulk Thumbnail & Selection Bar**: Multi-select tabs to capture thumbnails in bulk (`Add Thumbnails`) or close tabs in one click.
* **Instant Filter & Group Navigation**: Filter tabs in real time, collapse/expand groups, and jump directly to any tab.

### ⚡ 3. Automated Rule-Based Tab Grouping
* **Regex & Pattern Rules**: Match open tabs against custom patterns (e.g., `google.com/search`, `github.com`, `docs.google.com`) and automatically bundle them into native Chrome Tab Groups with custom titles and colors (`blue`, `purple`, `green`, `pink`, etc.).
* **Dynamic Domain Fallback**: Unhandled tabs can be automatically grouped by hostname domain.
* **Keyboard Shortcuts**: Trigger tab grouping anytime via `Ctrl+Shift+G` (or `Cmd+Shift+G` on Mac).

### 💾 4. Persistent Workspace Session Saver
* **Save Sessions & Free RAM**: Save open tab groups and window layouts to local storage and optionally close open tabs to free system memory.
* **1-Click Workspace Restore**: Re-open saved sessions at any time, complete with reconstructed native groups, titles, and color tags.

### 🛠️ 5. Full Options & Settings Dashboard (`options/options.html`)
* Manage custom regex rules, import/export configuration JSON backups, and configure domain grouping options.

---

## Installation & Development Setup

1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** toggle in the top-right corner.
3. Click **Load unpacked** and select the root directory of this workspace: `/Users/dkhawk/Projects/TabKing`.
4. Click the extension puzzle icon and pin **TabKing**.

---

## File Architecture

```
TabKing/
├── manifest.json             # Manifest V3 configuration & permissions
├── background.js            # Service worker (tab listeners, thumbnail capture & compression, commands)
├── summary.js               # Page content extraction & AI summarizer engine
├── popup/
│   ├── popup.html           # Popup window HTML with thumbnail drawers & selection bar
│   ├── popup.css            # Dark mode glassmorphic popup styling
│   └── popup.js             # Fast tab controls, thumbnail toggles, group collapse/expand
├── finder/
│   ├── finder.html          # Visual Tab Finder & Preview Lightbox dialog
│   ├── finder.css           # Visual card grid, list view, and modal lightbox styling
│   └── finder.js            # Regex search engine, batch capture orchestrator, card renderer
├── options/
│   ├── options.html         # Dashboard & settings page HTML
│   ├── options.css          # Dashboard styling
│   └── options.js           # Rule builder, session manager, JSON backup handler
├── icons/                   # Real PNG icon assets (16x16, 48x48, 128x128)
│   ├── icon-16.png
│   ├── icon-48.png
│   ├── icon-128.png
│   └── icon.svg
└── CHROMEWEBSTORE.md        # Chrome Web Store submission & permissions justifications guide
```

---

## License & Copyright

Copyright (c) 2026 Google LLC. All Rights Reserved.
