# TabKing - Smart Tab & Session Manager (Chrome Extension)

**TabKing** is a high-performance Chrome Extension built with **Manifest V3** to manage tab overload with automated regex grouping, full workspace session snapshots, visual tab previews, and advanced Regular Expression tab searching.

---

## Key Features

### 📸 1. Visual Tab Finder Web Page (`finder/finder.html`)
* **Live Thumb Print Snapshots**: Real-time visual screenshot cards for open tabs across browser windows.
* **Advanced Regular Expressions Search**: Full RegExp pattern matching (`/pattern/flags`) with live syntax error detection and feedback.
* **Smart Filter Chips**: Quick filtering by Group Status, Thumbnail availability, and auto-discovered Domain pills (e.g. `github.com`, `google.com`).
* **Visual Card Grid & Compact List Views**: Switch seamlessly between visual thumbnail cards and list view.

### ⚡ 2. Automated Rule-Based Tab Grouping
* **Regex & Pattern Rules**: Match open tabs against custom patterns (e.g., `google.com/search`, `github.com`, `docs.google.com`) and automatically bundle them into native Chrome Tab Groups with custom titles and colors (`blue`, `purple`, `green`, `pink`, etc.).
* **Dynamic Domain Fallback**: Unhandled tabs can be automatically grouped by hostname domain.
* **Keyboard Shortcuts**: Trigger tab grouping anytime via `Ctrl+Shift+G` (or `Cmd+Shift+G` on Mac).

### 💾 3. Persistent Workspace Session Saver
* **Save Sessions & Free RAM**: Save open tab groups and window layouts to local storage and optionally close open tabs to free system memory.
* **1-Click Workspace Restore**: Re-open saved sessions at any time, complete with reconstructed native groups, titles, and color tags.

### 🛠️ 4. Full Options & Settings Dashboard (`options/options.html`)
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
├── background.js            # Service worker (tab listeners, thumbnail capture, command routing)
├── popup/
│   ├── popup.html           # Popup window HTML
│   ├── popup.css            # Dark mode glassmorphic popup styling
│   └── popup.js             # Fast tab controls, group collapse/expand, search
├── finder/
│   ├── finder.html          # Visual Tab Finder & Advanced Search web page
│   ├── finder.css           # Visual card grid layout & responsive styling
│   └── finder.js            # Advanced Regex search engine & visual card renderer
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
