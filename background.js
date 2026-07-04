// background.js — Recollect Extension Service Worker (Fāze 1)
// Sends Capture Package to Recollect Core API

const DEFAULT_API_URL = 'http://localhost:5000/api/capture';

// --- Initialization ---
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'save-highlight',
      title: 'Save selection to Recollect',
      contexts: ['selection']
    });
    chrome.contextMenus.create({
      id: 'save-page',
      title: 'Save page to Recollect',
      contexts: ['page']
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
      title: 'Save selection to Recollect',
      contexts: ['selection']
    });
    chrome.contextMenus.create({
      id: 'save-page',
      title: 'Save page to Recollect',
      contexts: ['page']
    });
  });
});

// --- Context Menu ---
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'save-highlight' && info.selectionText) {
    chrome.tabs.sendMessage(tab.id, { action: 'buildCapturePackage', captureType: 'snippet' }, (response) => {
      if (response && response.package) {
        sendCapturePackage(response.package, tab.id);
      } else {
        // Fallback: basic text-only capture
        sendBasicCapture(tab, info.selectionText);
      }
    });
  }
  if (info.menuItemId === 'save-page') {
    chrome.tabs.sendMessage(tab.id, { action: 'buildCapturePackage', captureType: 'page' }, (response) => {
      if (response && response.package) {
        sendCapturePackage(response.package, tab.id);
      } else {
        sendBasicCapture(tab, '');
      }
    });
  }
});

// --- Keyboard Command ---
chrome.commands.onCommand.addListener((command) => {
  if (command === 'save-selection') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      chrome.tabs.sendMessage(tabs[0].id, { action: 'buildCapturePackage', captureType: 'snippet' }, (response) => {
        if (response && response.package) {
          sendCapturePackage(response.package, tabs[0].id);
        } else {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'getSelection' }, (r2) => {
            if (r2 && r2.text) sendBasicCapture(tabs[0], r2.text);
          });
        }
      });
    });
  }
  if (command === 'save-page') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      chrome.tabs.sendMessage(tabs[0].id, { action: 'buildCapturePackage', captureType: 'page' }, (response) => {
        if (response && response.package) {
          sendCapturePackage(response.package, tabs[0].id);
        }
      });
    });
  }
  if (command === 'open-recollect') {
    chrome.tabs.create({ url: 'http://localhost:5000' });
  }
});

// --- Message handler ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // From content.js — save Capture Package
  if (request.action === 'saveCapturePackage' && request.package) {
    const tabId = sender.tab?.id;
    sendCapturePackage(request.package, tabId);
    sendResponse({ success: true });
    return true;
  }

  // From popup — save current selection
  if (request.action === 'saveCurrentSelection') {
    if (request.text) {
      chrome.tabs.sendMessage(sender.tab?.id || request.tab?.id, {
        action: 'buildCapturePackage',
        captureType: 'snippet'
      }, (response) => {
        if (response && response.package) {
          sendCapturePackage(response.package, sender.tab?.id || request.tab?.id);
        } else {
          sendBasicCapture(request.tab, request.text);
        }
      });
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, message: 'No selection' });
    }
    return true;
  }

  // From popup — save current page
  if (request.action === 'saveCurrentPage') {
    const tab = sender.tab || request.tab;
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, { action: 'buildCapturePackage', captureType: 'page' }, (response) => {
        if (response && response.package) {
          sendCapturePackage(response.package, tab.id);
        }
      });
    }
    sendResponse({ success: true });
    return true;
  }

  // From popup — open Recollect
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

// --- Send Capture Package to API ---
function sendCapturePackage(pkg, tabId) {
  chrome.storage.sync.get(['apiUrl', 'apiToken'], (settings) => {
    const apiUrl = settings.apiUrl || DEFAULT_API_URL;

    const headers = { 'Content-Type': 'application/json' };
    if (settings.apiToken) {
      headers['Authorization'] = 'Bearer ' + settings.apiToken;
    }

    fetch(apiUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(pkg)
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        // Store in local history
        chrome.storage.local.get({ highlights: [] }, (result) => {
          const entry = {
            id: data.id,
            type: pkg.capture_type || 'page',
            title: pkg.source?.title || '',
            url: pkg.source?.url || '',
            date: new Date().toISOString().split('T')[0],
            text: pkg.anchor?.selected_text?.substring(0, 100) || ''
          };
          const highlights = [entry, ...result.highlights].slice(0, 100);
          chrome.storage.local.set({ highlights });
        });
        showToast(tabId, 'Saved to Recollect', false);
        console.log('Recollect: saved', data.id);
      } else {
        console.error('Recollect API error:', data);
        showToast(tabId, 'Save failed', true);
      }
    })
    .catch(err => {
      console.error('Recollect API unavailable:', err);
      showToast(tabId, 'Recollect server unavailable', true);
    });
  });
}

// --- Fallback: basic text-only capture ---
function sendBasicCapture(tab, text) {
  const now = new Date().toISOString();
  let siteName = '';
  try { siteName = new URL(tab.url).hostname.replace('www.', ''); } catch (e) {}

  const pkg = {
    version: '1.0',
    capture_type: 'snippet',
    source: {
      url: tab.url || '',
      title: tab.title || '',
      site_name: siteName
    },
    anchor: {
      selected_text: text || null
    },
    tags: [],
    project: ''
  };
  sendCapturePackage(pkg, tab.id);
}

function showToast(tabId, msg, isError) {
  if (tabId) {
    chrome.tabs.sendMessage(tabId, { action: 'showToast', message: msg, isError }).catch(() => {});
  }
}