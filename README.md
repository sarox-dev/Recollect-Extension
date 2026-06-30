<h1 align="center">Recollect Browser Extension</h1>
<p align="center">
  <img src="recollect-logo.png" width="120" height="120" alt="Recollect logo" />
</p>
<p align="center">
  Save web content directly to your private Recollect knowledge base with a single shortcut.
</p>

<div align="center">

[![License: AGPL-3.0][license-badge]][license-url]
[![Version][version-badge]][extension-url]

</div>

---

## What is this?

The **Recollect browser extension** bridges your web browsing to your self-hosted Recollect server. Select text on any page, save it with a click and it becomes instantly searchable in your personal knowledge base.

No tracking. Local-first. Your data stays on your machine.

---

## Features
- **Save highlights** — Select text and save directly to Recollect
- **Markdown storage** — Highlights are saved as standard Markdown files.
- **Keyboard shortcut** — `Alt+Shift+R` to save without leaving your flow
- **Context menu** — Right-click any selection and choose "Save highlight to Recollect"
- **Quick stats** — Popup shows how many highlights you've saved
- **Organized** — Each save includes source URL, page title, timestamp, and domain

---

## Installation

### Prerequisite

A running Recollect server is required.

### From source (developer mode)

1. **Download** the extension:
   ```bash
   git clone https://github.com/sarox-dev/Recollect-Extension.git
   ```

2. **Open Chrome** and go to `chrome://extensions`

3. **Enable Developer mode** (toggle in top right)

4. **Click "Load unpacked"** and select the `Recollect-Extension` folder

5. The extension icon appears in your toolbar, pin it for easy access.

### From Chrome Web Store

Coming soon once the developer account is set up.

---

## Architecture
```
Browser
     │
     ▼
Extension
     │
     ▼
Recollect Server
     │
     ▼
Markdown Knowledge Base
```


---

## Usage

### Save a highlight

**Method 1 — Keyboard shortcut:**
1. Select text on any webpage
2. Press `Alt+Shift+R`
3. A confirmation notification appears

**Method 2 — Context menu:**
1. Select text on any webpage
2. Right-click → "Save highlight to Recollect"
3. The content is saved to your Recollect server

**Method 3 — Auto-Save (optional):**
1. Enable "Auto-Save" in extension settings
2. Select text on any webpage
3. Highlighted text is automatically saved to Recollect

### View saved content

The extension communicates with your local Recollect server at `http://localhost:5000`. Make sure the server is running (see [Recollect setup](https://github.com/sarox-dev/Recollect)).

Click the extension icon to see:
- Total highlights saved
- Quick links to search your Recollect knowledge base

---

## Saved Format

Each saved highlight is stored on your Recollect server as markdown:

```markdown
---
title: "Page Title"
source: https://example.com/page
author: example.com
date: 2026-05-16
baseUrl: https://example.com
timestamp: 2026-05-16T10:30:00.000Z
---

Your highlighted text goes here...
```

Compatible with Obsidian, VS Code, and any markdown editor.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Alt+Shift+R` | Save selected text to Recollect |
| Click extension icon | Open popup with stats |

To customize shortcuts: `chrome://extensions/shortcuts`

---

## Permissions

Why the extension needs certain permissions:

| Permission | Why |
|---|---|
| `storage` | Track highlight count locally |
| `activeTab` | Read selected text on current page |
| `contextMenus` | Add right-click menu option |
| `scripting` | Inject save logic into web pages |
| `http://localhost/*` | Connect to your local Recollect server |

No data is sent to third parties. No browsing history is collected. Everything stays local.

---

## Development

```bash
git clone https://github.com/sarox-dev/Recollect-Extension.git
cd Recollect-Extension
# Edit files directly
# Load unpacked in Chrome to test
```

No build step required — the extension uses vanilla JavaScript, HTML, and CSS.

---

## Requirements

- **Chrome** (version 88+) or any Chromium-based browser (Edge, Brave, Opera)
- **Recollect server** running at `http://localhost:5000` ([setup guide](https://github.com/sarox-dev/Recollect))
- Firefox support is planned.
---

## License

**AGPL-3.0** — Copyright (c) 2026 Saroxtech / Valters

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3, or (at your option) any later version.

Commercial licenses for proprietary use are available from the author.

---

## Roadmap

### Upcoming

- Firefox support
- Chrome Web Store release
- Tags
- Screenshots
- Premium sync

---

## Links

- 🌍 **Website**: [recollect.saroxtech.com](https://recollect.saroxtech.com)
- 🔌 **Recollect server**: [github.com/sarox-dev/Recollect](https://github.com/sarox-dev/Recollect)
- 💬 **Discord**: [Join the community](https://discord.gg/BXEDCJP7mT)

[license-badge]: https://img.shields.io/badge/License-AGPL--3.0-blue?logo=gnu
[license-url]: LICENSE
[version-badge]: https://img.shields.io/badge/Version-1.1.0-orange
[extension-url]: https://github.com/sarox-dev/Recollect-Extension
