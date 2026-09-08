# Chrome Web Store Metadata & Publishing Guide for TabKing

**Last Updated:** July 15, 2026  
**Extension Name:** TabKing - Smart Tab & Session Manager  
**Version:** 1.0.0  
**Category:** Productivity / Workflow Tools  
**Primary Language:** English  

---

## 1. Store Listing Copy

### Short Description (Max 132 chars)
Automated tab grouping by regex & domain rules, saved workspace sessions, and lightning-fast tab search.

### Detailed Description
Take control of your tab overload with **TabKing**, the high-performance tab and workspace manager powered by Chrome Manifest V3 native APIs.

Whether you're juggling dozens of tabs for deep work, software engineering, academic research, or content creation, TabKing automatically organizes your tabs into clean, color-coded Chrome native Tab Groups and lets you save whole session snapshots to free up RAM.

#### Key Features
* ⚡ **Automated Tab Grouping Rules**: Set up custom domain or regex URL patterns (e.g. `google.com/search`, `github.com`, `docs.google.com`) to instantly group tabs into custom named & color-coded native tab groups.
* 🌐 **Dynamic Domain Fallback**: Unhandled tabs are automatically grouped by hostname domain with a single click.
* 📸 **On-Demand Visual Tab Thumbnails & Preview Lightbox**: Capture high-resolution tab screenshots on demand with zero browser disruption. Open the interactive Preview Modal to inspect full-size tab captures, live memory/audio status, and page content summaries.
* 🖼️ **Bulk "Add All Thumbnails" Capture**: Capture thumbnails for all filtered or selected tabs with a single click. Background orchestrator sequentially activates, captures, and restores tabs cleanly, compressing images via OffscreenCanvas to prevent storage bloat.
* 💾 **Session Saver & RAM Saver**: Save active tab groups and windows as persistent sessions in local storage. Close open tabs to free up system memory, and restore full workspaces with intact titles and group colors whenever you're ready.
* 🔍 **Instant Tab Search**: Filter all open tabs across your current browser window by title, domain, or group tag. Jump directly to any tab or close it from the search view.
* ⌨️ **Keyboard Shortcuts**: Auto-group open tabs anytime using `Ctrl+Shift+G` (or `Cmd+Shift+G` on Mac) or open the TabKing popup with `Cmd+Shift+K`.
* 🔒 **100% Private & Local**: All rule matching, session snapshots, and settings stay completely local on your device via Chrome extension storage. No tracking, external servers, or data collection.

---

## 2. Permissions Justification

Every permission declared in `manifest.json` is strictly required for core functionality:

| Permission | Plain-English Reason for Reviewers |
| :--- | :--- |
| **`tabs`** | Required to read open tab titles, URLs, and favicons in order to match grouping rules, allow real-time tab searching, and save/restore tab sessions. |
| **`tabGroups`** | Required to programmatically create native Chrome Tab Groups, customize group titles and colors, and toggle collapsed/expanded group states. |
| **`storage`** | Required to store custom user grouping rules, saved tab session snapshots, compressed tab thumbnails, and user preferences locally in browser storage (`chrome.storage.local`). |
| **`scripting`** | Required to safely read page article outlines and structured metadata in active tabs to power intelligent tab summaries without transmitting page data externally. |
| **`<all_urls>`** (host) | Required to capture tab screenshots via `chrome.tabs.captureVisibleTab` across user-selected web domains. |

---

## 3. Privacy & Data Use Disclosure

* **Does TabKing collect user data?** No. TabKing does not collect, record, or transmit any user data.
* **Does TabKing use external servers or web services?** No. All processing occurs locally inside the browser using standard Chrome APIs.
* **Third-Party Disclosures**: None.

---

## 4. Version History

### v1.1.0 (2026-09-08)
* Added on-demand tab thumbnail previews across Visual Tab Finder and popup UI.
* Added interactive Full Tab Preview Lightbox dialog with real-time memory/audio badges and content summaries.
* Added bulk "Add All Thumbnails" and "Add Selected Thumbnails" batch capture with non-disruptive tab activation and OffscreenCanvas compression.
* Added multi-tab selection action bar with thumbnail capture and bulk close support.

### v1.0.0 (2026-07-15)
* Initial public release of TabKing.
* Support for regex-based and domain-based native Chrome tab grouping.
* Session snapshot saver and restorer with RAM optimization tab closing.
* Full Options Dashboard with rule builder and JSON import/export configuration backup.
* Glassmorphism dark-mode UI with live tab search.

---

## 5. Pre-Publish Packaging Instructions

1. Zip the root directory containing `manifest.json`, `background.js`, `icons/`, `popup/`, and `options/`.
2. **Exclude** the following files from the published ZIP: `.git/`, `.DS_Store`, `node_modules/`, `CHROMEWEBSTORE.md`.
3. Command to build clean release package:
   ```bash
   zip -r tabking-v1.0.0.zip . -x "*.git*" -x "*CHROMEWEBSTORE.md*" -x "*.DS_Store"
   ```
4. Upload `tabking-v1.0.0.zip` to the Chrome Developer Dashboard.
