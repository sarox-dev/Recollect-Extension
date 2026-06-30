// content.js — Recollect Extension Content Script
// Captures selection with surrounding context

const CONTEXT_CHARS = 1500;

// --- Sentinel for homepage detection ---
const sentinel = document.createElement('meta');
sentinel.name = 'recollect-extension';
sentinel.content = 'installed';
document.head.appendChild(sentinel);

// --- Listen for background script requests ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSelection') {
    const selectedText = window.getSelection().toString();
    sendResponse({ text: selectedText });
  }

  if (request.action === 'captureWithContext') {
    const fullData = captureSelectionWithContext();
    sendResponse({ fullData });
  }

  if (request.action === 'showToast') {
    showToast(request.message, request.isError);
  }
});

// --- Captures selection with context ---
function captureSelectionWithContext() {
  const sel = window.getSelection();
  const text = sel.toString().trim();
  if (!text) return null;

  const range = sel.getRangeAt(0);
  const container = range.commonAncestorContainer;

  // Get surrounding text from the parent element
  const parentEl = container.nodeType === Node.TEXT_NODE
    ? container.parentElement
    : container;

  const fullText = parentEl.textContent || '';
  const textOffset = fullText.indexOf(text);

  let beforeText = '';
  let afterText = '';

  if (textOffset >= 0) {
    beforeText = fullText.substring(0, textOffset).slice(-CONTEXT_CHARS);
    afterText = fullText.substring(textOffset + text.length).slice(0, CONTEXT_CHARS);
  } else {
    // Fallback: try to find it in parent's parent
    const parentFullText = (parentEl.parentElement?.textContent || '');
    const offset2 = parentFullText.indexOf(text);
    if (offset2 >= 0) {
      beforeText = parentFullText.substring(0, offset2).slice(-CONTEXT_CHARS);
      afterText = parentFullText.substring(offset2 + text.length).slice(0, CONTEXT_CHARS);
    }
  }

  // Get selection HTML
  const selectionHtml = getSelectionHtml(sel, range);

  // Determine site name
  let siteName = '';
  try {
    siteName = new URL(window.location.href).hostname.replace('www.', '');
  } catch (e) {}

  return {
    content: text,
    pageTitle: document.title,
    pageUrl: window.location.href,
    siteName: siteName,
    beforeText: beforeText,
    afterText: afterText,
    selectionHtml: selectionHtml,
    capturedAt: new Date().toISOString()
  };
}

// --- Extract HTML of the selection ---
function getSelectionHtml(sel, range) {
  try {
    const fragment = range.cloneContents();
    const div = document.createElement('div');
    div.appendChild(fragment);
    return div.innerHTML;
  } catch (e) {
    return '';
  }
}

// --- Toast notification ---
function showToast(message, isError) {
  // Remove existing toast if any
  const existing = document.getElementById('recollect-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'recollect-toast';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${isError ? '#ef4444' : '#10b981'};
    color: white;
    padding: 12px 18px;
    border-radius: 8px;
    z-index: 10000;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    opacity: 0;
    transition: opacity 0.2s ease;
    pointer-events: none;
  `;
  document.body.appendChild(toast);

  requestAnimationFrame(() => { toast.style.opacity = '1'; });

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 200);
  }, 2000);
}

// --- Auto-save on selection (if enabled in settings) ---
let autoSaveTimer = null;

document.addEventListener('mouseup', () => {
  try {
    chrome.storage.sync.get(['autoSaveOnSelect'], (settings) => {
      if (!settings.autoSaveOnSelect) return;
      const text = window.getSelection().toString().trim();
      if (text.length < 10) return;

      clearTimeout(autoSaveTimer);
      autoSaveTimer = setTimeout(() => {
        const data = captureSelectionWithContext();
        if (!data) return;
        chrome.runtime.sendMessage({
          action: 'saveHighlightWithContext',
          text: data.content,
          title: data.pageTitle,
          url: data.pageUrl,
          siteName: data.siteName,
          beforeText: data.beforeText,
          afterText: data.afterText,
          selectionHtml: data.selectionHtml,
          capturedAt: data.capturedAt
        });
      }, 600);
    });
  } catch (e) {
    // storage API unavailable in this context (some restricted pages)
  }
});

// --- Keyboard shortcut listener (from settings) ---
document.addEventListener('keydown', (event) => {
  try {
    chrome.storage.sync.get(['shortcutKey'], (settings) => {
      const shortcut = settings.shortcutKey || 'Alt+Shift+R';
      const parts = shortcut.split('+');
      const key = parts.pop().toLowerCase();
      const needsCtrl = parts.includes('Ctrl');
      const needsAlt = parts.includes('Alt');
      const needsShift = parts.includes('Shift');
      const needsMeta = parts.includes('Meta');

      const ctrlOrCmd = event.ctrlKey || event.metaKey;
      const matchCtrl = needsCtrl ? ctrlOrCmd : !ctrlOrCmd && !needsMeta;
      const matchMeta = needsMeta ? event.metaKey : true;
      const matchAlt = needsAlt ? event.altKey : !event.altKey;
      const matchShift = needsShift ? event.shiftKey : !event.shiftKey;
      const matchKey = event.key.toLowerCase() === key;

      if (matchCtrl && matchAlt && matchShift && matchMeta && matchKey) {
        event.preventDefault();
        const text = window.getSelection().toString().trim();
        if (!text) {
          showToast('Select text first', true);
          return;
        }
        const data = captureSelectionWithContext();
        if (!data) return;
        chrome.runtime.sendMessage({
          action: 'saveHighlightWithContext',
          text: data.content,
          title: data.pageTitle,
          url: data.pageUrl,
          siteName: data.siteName,
          beforeText: data.beforeText,
          afterText: data.afterText,
          selectionHtml: data.selectionHtml,
          capturedAt: data.capturedAt
        });
      }
    });
  } catch (e) {
    // storage API unavailable in this context
  }
});