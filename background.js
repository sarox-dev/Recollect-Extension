// background.js — Recollect Extension Service Worker
// Sends captured content to local Recollect Core API

const DEFAULT_API_URL = 'http://localhost:5000/api/capture';

// --- Initialization ---
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'save-highlight',
      title: 'Save to Recollect',
      contexts: ['selection']
    });
  });
  // Set defaults if first install
  chrome.storage.sync.get(['apiUrl'], (r) => {
    if (!r.apiUrl) {
      chrome.storage.sync.set({
        apiUrl: DEFAULT_API_URL,
        autoSaveOnSelect: false,
        shortcutKey: 'Alt+Shift+R'
      });
    }
  });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'save-highlight',
      title: 'Save to Recollect',
      contexts: ['selection']
    });
  });
});

// --- Context Menu ---
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'save-highlight' && info.selectionText) {
    chrome.tabs.sendMessage(tab.id, { action: 'captureWithContext' }, (response) => {
      if (response && response.fullData) {
        saveToApi(response.fullData.content, tab, response.fullData);
      } else {
        saveToApi(info.selectionText, tab);
      }
    });
  }
});

// --- Keyboard Command (from manifest) ---
chrome.commands.onCommand.addListener((command) => {
  if (command === 'save-selection') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      chrome.tabs.sendMessage(tabs[0].id, { action: 'captureWithContext' }, (response) => {
        if (response && response.fullData) {
          saveToApi(response.fullData.content, tabs[0], response.fullData);
        } else {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'getSelection' }, (r2) => {
            if (r2 && r2.text) saveToApi(r2.text, tabs[0]);
          });
        }
      });
    });
  }
  if (command === 'save-page') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      savePage(tabs[0]);
    });
  }
  if (command === 'open-recollect') {
    chrome.tabs.create({ url: 'http://localhost:5000' });
  }
});

// --- Single unified message handler ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // From content.js — save with full context
  if (request.action === 'saveHighlightWithContext') {
    const tab = { title: request.title, url: request.url, id: sender.tab?.id };
    saveToApi(request.text, tab, {
      content: request.text,
      pageTitle: request.title,
      pageUrl: request.url,
      siteName: request.siteName,
      beforeText: request.beforeText,
      afterText: request.afterText,
      selectionHtml: request.selectionHtml,
      capturedAt: request.capturedAt
    });
    sendResponse({ success: true });
    return true;
  }

  // Simple save (fallback)
  if (request.action === 'saveToApi') {
    const tab = { title: request.title, url: request.url };
    saveToApi(request.text, tab);
    sendResponse({ success: true });
    return true;
  }

  // From popup — save current selection
  if (request.action === 'saveCurrentSelection') {
    if (request.text) {
      saveToApi(request.text, request.tab, {
        content: request.text,
        pageTitle: request.tab?.title,
        pageUrl: request.tab?.url,
        siteName: request.siteName,
        beforeText: request.beforeText,
        afterText: request.afterText,
        selectionHtml: request.selectionHtml,
        selectedTagName: request.selectedTagName,
        selectedTagsAncestry: request.selectedTagsAncestry,
        capturedAt: new Date().toISOString()
      });
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, message: 'No selection' });
    }
    return true;
  }

  // From popup — save current page
  if (request.action === 'saveCurrentPage') {
    savePage(sender.tab || request.tab, sendResponse);
    return true;
  }

  // From popup — open Recollect in new tab
  if (request.action === 'openRecollect') {
    chrome.storage.sync.get(['apiUrl'], (s) => {
      const baseUrl = s.apiUrl || DEFAULT_API_URL;
      const origin = baseUrl.replace(/\/api\/capture.*$/, '').replace(/\/api$/, '') || 'http://localhost:5000';
      chrome.tabs.create({ url: origin });
    });
    sendResponse({ success: true });
    return true;
  }
});

// --- Core API save function ---
function saveToApi(text, tab, fullData) {
  chrome.storage.sync.get(['apiUrl', 'defaultProject'], (settings) => {
    const apiUrl = settings.apiUrl || DEFAULT_API_URL;
    const now = new Date().toISOString();
    const siteName = (() => { try { return new URL(tab.url).hostname.replace('www.', ''); } catch(e) { return ''; } })();

    const payload = {
      type: 'snippet',
      content: text,
      source: {
        url: tab.url || '',
        title: tab.title || '',
        site_name: fullData?.siteName || siteName,
        captured_at: fullData?.capturedAt || now
      },
      context: {
        before: fullData?.beforeText || '',
        after: fullData?.afterText || '',
        selection_html: fullData?.selectionHtml || '',
        selected_tag: fullData?.selectedTagName || '',
        tag_ancestry: (fullData?.selectedTagsAncestry || []).join('/')
      },
      project: settings.defaultProject || ''
    };

    fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        chrome.storage.local.get({ highlights: [] }, (result) => {
          const entry = {
            id: data.id,
            title: payload.source.title,
            url: payload.source.url,
            date: new Date().toISOString().split('T')[0],
            text: text.substring(0, 100)
          };
          const highlights = [entry, ...result.highlights].slice(0, 100);
          chrome.storage.local.set({ highlights });
        });
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, { action: 'showToast', message: 'Saved to Recollect' }).catch(() => {});
        }
        console.log('Recollect: saved', data.id);
      } else {
        console.error('Recollect API error:', data);
        notifyFailure(tab.id, 'Save failed');
      }
    })
    .catch(err => {
      console.error('Recollect API unavailable:', err);
      notifyFailure(tab.id, 'Recollect server unavailable');
    });
  });
}

function notifyFailure(tabId, msg) {
  if (tabId) {
    chrome.tabs.sendMessage(tabId, { action: 'showToast', message: msg, isError: true }).catch(() => {});
  }
}

// --- Save current page ---
function savePage(tab, sendResponse) {
  chrome.storage.sync.get(['apiUrl'], (settings) => {
    const apiUrl = settings.apiUrl || DEFAULT_API_URL;
    const now = new Date().toISOString();

    let siteName = '';
    try { siteName = new URL(tab.url).hostname.replace('www.', ''); } catch (e) {}

    const payload = {
      type: 'page',
      content: '',
      source: {
        url: tab.url || '',
        title: tab.title || '',
        site_name: siteName,
        captured_at: now
      },
      context: { before: '', after: '', selection_html: '' }
    };

    fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
      if (sendResponse) sendResponse({ success: true, id: data.id, message: 'Page saved' });
    })
    .catch(err => {
      console.error('Recollect API unavailable:', err);
      if (sendResponse) sendResponse({ success: false, message: 'Recollect server unavailable' });
    });
  });
  return true;
}