// Initialize extension on install and create context menu safely
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['initialized'], (result) => {
    if (!result.initialized) {
      chrome.action.openPopup();
      chrome.storage.local.set({ initialized: true });
    }
  });
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'save-highlight',
      title: 'Save highlight to Recollect',
      contexts: ['selection']
    });
  });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'save-highlight',
      title: 'Save highlight to Recollect',
      contexts: ['selection']
    });
  });
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'save-highlight' && info.selectionText) {
    saveHighlight(info.selectionText, tab);
  }
});

// Handle keyboard shortcut
chrome.commands.onCommand.addListener((command) => {
  if (command === 'save-selection') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'getSelection' }, (response) => {
          if (response && response.text) {
            saveHighlight(response.text, tabs[0]);
          }
        });
      }
    });
  }
});

// Main save function
function saveHighlight(text, tab) {
  const metadata = {
    title: tab.title || 'Untitled',
    url: tab.url || 'Unknown URL',
    date: new Date().toISOString().split('T')[0],
    author: extractAuthor(tab.url),
    baseUrl: getBaseUrl(tab.url),
    source: tab.url || 'Unknown URL',
    timestamp: new Date().toISOString()
  };

  const markdown = generateMarkdown(text, metadata);
  const filename = generateFilename(metadata);

  // Track highlight in storage
  chrome.storage.local.get({ highlights: [] }, (result) => {
    const newHighlight = {
      id: Date.now(),
      title: metadata.title,
      url: metadata.url,
      date: metadata.date,
      filename: filename,
      text: text.substring(0, 100)
    };
    const highlights = [newHighlight, ...result.highlights];
    chrome.storage.local.set({ highlights: highlights });
  });

  // Trigger download with data URL
  const url = 'data:text/markdown;charset=utf-8,' + encodeURIComponent(markdown);
  chrome.downloads.download({
    url: url,
    filename: filename,
    saveAs: true
  });
}

// Generate markdown with obsidian properties
function generateMarkdown(text, metadata) {
  const properties = `---
title: "${metadata.title.replace(/"/g, '\\"')}"
source: ${metadata.source}
author: ${metadata.author || 'Unknown'}
date: ${metadata.date}
baseUrl: ${metadata.baseUrl}
timestamp: ${metadata.timestamp}
---

${text}
`;
  return properties;
}

// Generate filename from metadata
function generateFilename(metadata) {
  const safeTitle = metadata.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
  
  return `recollect-${metadata.date}-${safeTitle}.md`;
}

// Extract domain/author from URL
function extractAuthor(url) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return 'Unknown';
  }
}

function getBaseUrl(url) {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveHighlight') {
    saveHighlight(request.text, { title: request.title, url: request.url });
    sendResponse({ success: true });
  }
});
