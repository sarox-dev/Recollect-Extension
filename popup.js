// popup.js — Recollect Extension Popup

const saveSelectionBtn = document.getElementById('saveSelectionBtn');
const savePageBtn = document.getElementById('savePageBtn');
const openRecollectBtn = document.getElementById('openRecollectBtn');
const settingsBtn = document.getElementById('settingsBtn');
const statusMessage = document.getElementById('statusMessage');
const savedCountElement = document.getElementById('savedCount');

// --- Status updates ---
function setStatus(msg, isError) {
  statusMessage.textContent = msg;
  statusMessage.style.color = isError ? '#ef4444' : '#6b7280';
}

// --- Count tracking ---
function updateSavedCount() {
  chrome.storage.local.get({ highlights: [] }, (result) => {
    savedCountElement.textContent = result.highlights.length;
  });
}

// --- Save current selection ---
saveSelectionBtn.addEventListener('click', () => {
  setStatus('Saving selection...');
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return setStatus('No active tab', true);

    chrome.tabs.sendMessage(tabs[0].id, { action: 'captureWithContext' }, (response) => {
      if (chrome.runtime.lastError || !response || !response.fullData) {
        setStatus('No text selected', true);
        return;
      }

      const data = response.fullData;
      chrome.runtime.sendMessage({
        action: 'saveCurrentSelection',
        text: data.content,
        tab: { title: data.pageTitle, url: data.pageUrl },
        siteName: data.siteName,
        beforeText: data.beforeText,
        afterText: data.afterText,
        selectionHtml: data.selectionHtml
      }, (res) => {
        if (res && res.success) {
          setStatus('Saved to Recollect ✓');
          updateSavedCount();
        } else {
          setStatus('Save failed', true);
        }
      });
    });
  });
});

// --- Save current page ---
savePageBtn.addEventListener('click', () => {
  setStatus('Saving page...');
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return setStatus('No active tab', true);

    chrome.runtime.sendMessage({
      action: 'saveCurrentPage',
      tab: { title: tabs[0].title, url: tabs[0].url, id: tabs[0].id }
    }, (res) => {
      if (res && res.success) {
        setStatus('Page saved ✓');
        updateSavedCount();
      } else {
        setStatus(res?.message || 'Save failed', true);
      }
    });
  });
});

// --- Open Recollect (via background to resolve URL) ---
openRecollectBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'openRecollect' });
  window.close();
});

// --- Open Settings ---
settingsBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// --- Storage changes ---
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.highlights) {
    updateSavedCount();
  }
});

// --- Initialization ---
updateSavedCount();
setStatus('Ready');