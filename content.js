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
    showGlow(request.message, request.isError);
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
    const parentFullText = (parentEl.parentElement?.textContent || '');
    const offset2 = parentFullText.indexOf(text);
    if (offset2 >= 0) {
      beforeText = parentFullText.substring(0, offset2).slice(-CONTEXT_CHARS);
      afterText = parentFullText.substring(offset2 + text.length).slice(0, CONTEXT_CHARS);
    }
  }

  // Get selection HTML
  const selectionHtml = getSelectionHtml(sel, range);

  // Determine the HTML tag type of the selected element
  let selectedTagName = '';
  let selectedTagsAncestry = [];
  try {
    let node = range.startContainer;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    if (node) {
      selectedTagName = node.tagName ? node.tagName.toLowerCase() : '';
      let el = node;
      while (el && el !== document.body) {
        const tag = el.tagName ? el.tagName.toLowerCase() : '';
        if (['h1','h2','h3','h4','h5','h6','p','li','blockquote','pre','code','td','th','dt','dd','figcaption'].includes(tag)) {
          selectedTagsAncestry.push(tag);
        }
        el = el.parentElement;
      }
    }
  } catch (e) {}

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
    capturedAt: new Date().toISOString(),
    selectedTagName,
    selectedTagsAncestry
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

// --- Glowing notification ---
function showGlow(message, isError) {
  const existing = document.getElementById('recollect-glow');
  if (existing) existing.remove();

  chrome.storage.sync.get(['glowPosition'], (settings) => {
    const position = settings.glowPosition || 'top-center';
    const positions = {
      'top-left': { top: '16px', left: '16px', transform: 'none' },
      'top-center': { top: '16px', left: '50%', transform: 'translateX(-50%)' },
      'top-right': { top: '16px', right: '16px', transform: 'none' },
      'bottom-left': { bottom: '16px', left: '16px', transform: 'none' },
      'bottom-center': { bottom: '16px', left: '50%', transform: 'translateX(-50%)' },
      'bottom-right': { bottom: '16px', right: '16px', transform: 'none' },
    };
    const pos = positions[position] || positions['top-center'];

    const glow = document.createElement('div');
    glow.id = 'recollect-glow';
    glow.textContent = message;
    Object.assign(glow.style, {
      position: 'fixed',
      zIndex: '2147483647',
      padding: '10px 18px',
      borderRadius: '10px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '14px',
      fontWeight: '600',
      pointerEvents: 'none',
      opacity: '0',
      transition: 'opacity 0.25s ease, box-shadow 0.25s ease',
      background: isError ? '#dc2626' : '#059669',
      color: '#fff',
      boxShadow: isError
        ? '0 0 20px rgba(220,38,38,0.6), 0 4px 12px rgba(0,0,0,0.2)'
        : '0 0 20px rgba(5,150,105,0.6), 0 4px 12px rgba(0,0,0,0.2)',
    });
    if (pos.top) glow.style.top = pos.top;
    if (pos.bottom) glow.style.bottom = pos.bottom;
    if (pos.left) glow.style.left = pos.left;
    if (pos.right) glow.style.right = pos.right;
    glow.style.transform = pos.transform || 'none';

    document.body.appendChild(glow);
    requestAnimationFrame(() => { glow.style.opacity = '1'; });

    setTimeout(() => {
      glow.style.opacity = '0';
      glow.style.boxShadow = 'none';
      setTimeout(() => glow.remove(), 300);
    }, 2000);
  });
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
  } catch (e) {}
});

// --- Keyboard shortcut listener ---
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
          showGlow('Select text first', true);
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
  } catch (e) {}
});