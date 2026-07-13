// background.js — Nodecast Extension Service Worker (Fāze 1 + Layout)
// Sends Capture Package to Nodecast Core API
// Supports Capture Layout — domain-specific capture types

const DEFAULT_API_URL = 'http://localhost:5000/api/capture';

// --- Initialization ---
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    // Selection context — always
    chrome.contextMenus.create({
      id: 'save-selection',
      title: 'Save selection to Nodecast',
      contexts: ['selection']
    });
    // Page context — basic
    chrome.contextMenus.create({
      id: 'save-page',
      title: 'Save page to Nodecast',
      contexts: ['page']
    });
    // Link context
    chrome.contextMenus.create({
      id: 'save-link',
      title: 'Save link to Nodecast',
      contexts: ['link']
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
    chrome.contextMenus.create({ id: 'save-selection', title: 'Save selection to Nodecast', contexts: ['selection'] });
    chrome.contextMenus.create({ id: 'save-page', title: 'Save page to Nodecast', contexts: ['page'] });
    chrome.contextMenus.create({ id: 'save-link', title: 'Save link to Nodecast', contexts: ['link'] });
  });
});

// --- Context Menu ---
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'save-selection' && info.selectionText) {
    chrome.tabs.sendMessage(tab.id, { action: 'buildCapturePackage', captureType: 'snippet' }, (response) => {
      if (response && response.package) {
        sendCapturePackage(response.package, tab.id);
      } else {
        sendBasicCapture(tab, info.selectionText, 'snippet');
      }
    });
  }
  if (info.menuItemId === 'save-page') {
    chrome.tabs.sendMessage(tab.id, { action: 'buildCapturePackage', captureType: 'page' }, (response) => {
      if (response && response.package) {
        sendCapturePackage(response.package, tab.id);
      } else {
        sendBasicCapture(tab, '', 'page');
      }
    });
  }
  if (info.menuItemId === 'save-link' && info.linkUrl) {
    // Link save — create a basic capture from the link info
    sendBasicCapture(tab, info.linkUrl, 'link');
  }
});

// --- Keyboard Commands ---
chrome.commands.onCommand.addListener((command) => {
  if (command === 'save-selection') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      chrome.tabs.sendMessage(tabs[0].id, { action: 'buildCapturePackage', captureType: 'snippet' }, (response) => {
        if (response && response.package) {
          sendCapturePackage(response.package, tabs[0].id);
        } else {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'getSelection' }, (r2) => {
            if (r2 && r2.text) sendBasicCapture(tabs[0], r2.text, 'snippet');
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
  if (command === 'open-nodecast') {
    chrome.tabs.create({ url: 'http://localhost:5000' });
  }
});

// --- Message handler ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // From content.js — save Capture Package
  if (request.action === 'saveCapturePackage' && request.package) {
    let tabId = sender.tab?.id;
    // Fallback: try to find active tab
    if (!tabId) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          sendCapturePackage(request.package, tabs[0].id);
        } else {
          sendCapturePackage(request.package, null);
        }
      });
    } else {
      sendCapturePackage(request.package, tabId);
    }
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
          sendBasicCapture(request.tab, request.text, 'snippet');
        }
      });
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, message: 'No selection' });
    }
    return true;
  }

  // From popup — save current page (with layout awareness)
  if (request.action === 'saveCurrentPage') {
    const tab = sender.tab || request.tab;
    const captureType = request.captureType || 'page';
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, { action: 'buildCapturePackage', captureType: captureType }, (response) => {
        if (response && response.package) {
          sendCapturePackage(response.package, tab.id);
        }
      });
    }
    sendResponse({ success: true });
    return true;
  }

  // From popup — get layout info for current tab
  if (request.action === 'getLayout') {
    chrome.tabs.sendMessage(sender.tab?.id || request.tab?.id, { action: 'getLayout' }, (response) => {
      sendResponse(response?.layout || null);
    });
    return true;
  }

  // From popup — open Nodecast
  if (request.action === 'openNodecast') {
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
        showToast(tabId, 'Saved to Nodecast', false);
        console.log('Nodecast: saved', data.id);
      } else {
        console.error('Nodecast API error:', data);
        showToast(tabId, 'Save failed', true);
      }
    })
    .catch(err => {
      console.error('Nodecast API unavailable:', err);
      showToast(tabId, 'Nodecast server unavailable', true);
    });
  });
}

// --- Fallback: basic text-only capture ---
function sendBasicCapture(tab, text, captureType) {
  const now = new Date().toISOString();
  let siteName = '';
  try { siteName = new URL(tab.url).hostname.replace('www.', ''); } catch (e) {}

  const pkg = {
    version: '1.0',
    capture_type: captureType || 'snippet',
    source: {
      url: tab.url || '',
      title: tab.title || '',
      site_name: siteName
    },
    anchor: text ? { selected_text: text } : null,
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