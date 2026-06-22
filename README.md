# Recollect Chrome Extension

Save highlighted text from websites as organized markdown files with metadata.

## Installation

1. Open `chrome://extensions`
2. Enable `Developer mode` (toggle in top right)
3. Click `Load unpacked`
4. Select the `Recollect-Extension` folder

## Features

### Save Highlights

**Method 1: Context Menu**
- Select text on any website
- Right-click and choose "Save highlight to Recollect"
- Choose where to save the markdown file

**Method 2: Keyboard Shortcut**
- Select text anywhere on a website
- Press `Ctrl+E` (or `Cmd+E` on Mac)
- A notification confirms the save

### Metadata Included

Each saved highlight is stored as a markdown file with YAML frontmatter containing:
- Source URL and base domain
- Page title
- Date and timestamp
- Author (extracted from domain)
- The selected text

### File Format

Files are saved as `.md` with the format:
```markdown
---
title: "Page Title"
source: https://example.com
author: example.com
date: 2026-05-16
baseUrl: https://example.com
timestamp: 2026-05-16T10:30:00.000Z
---

Your highlighted text goes here...
```

Files are saved to your Downloads folder by default with the naming pattern:
`recollect-YYYY-MM-DD-page-title.md`

## Usage Tips

- Files are compatible with Obsidian and other markdown editors
- The popup shows how many highlights you've saved
- Click "Open Downloads Folder" in the popup to access your files
- All highlights are tracked locally in the extension's storage
