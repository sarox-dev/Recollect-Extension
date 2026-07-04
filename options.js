// options.js — Recollect Extension Settings

const apiUrlInput = document.getElementById('apiUrl');
const apiTokenInput = document.getElementById('apiToken');
const themeToggle = document.getElementById('themeToggle');
const glowPosition = document.getElementById('glowPosition');
const saveBtn = document.getElementById('saveBtn');
const saveStatus = document.getElementById('saveStatus');
const testApiBtn = document.getElementById('testApiBtn');
const testResult = document.getElementById('testResult');

const DEFAULT_API_URL = 'http://localhost:5000/api/capture';

// --- Load settings ---
function loadSettings() {
  chrome.storage.sync.get(['apiUrl', 'shortcutKey', 'theme', 'glowPosition', 'apiToken'], (settings) => {
    apiUrlInput.value = settings.apiUrl || DEFAULT_API_URL;
    if (apiTokenInput) apiTokenInput.value = settings.apiToken || '';
    
    glowPosition.value = settings.glowPosition || 'top-center';
    applyTheme(settings.theme);
  });
}

// --- Save settings ---
function saveSettings() {
  const apiUrl = apiUrlInput.value.trim() || DEFAULT_API_URL;
    const apiToken = apiTokenInput ? apiTokenInput.value.trim() : '';

    const theme = themeToggle.checked ? 'dark' : '';
    const glowPos = glowPosition.value;

    chrome.storage.sync.set({
      apiUrl,
      apiToken,
    theme,
    glowPosition: glowPos
  }, () => {
    saveStatus.textContent = 'Settings saved ✓';
    saveStatus.className = 'save-status';
    setTimeout(() => { saveStatus.textContent = ''; }, 2500);
  });
}

// --- Test API connection ---
function testApiConnection() {
  const apiUrl = apiUrlInput.value.trim() || DEFAULT_API_URL;
  testResult.textContent = 'Testing...';
  testResult.className = 'test-result';

  fetch(apiUrl, { method: 'GET' })
    .then(res => res.json())
    .then(data => {
      testResult.textContent = 'Connected ✓ (' + (data.captures?.length || 0) + ' saved items)';
      testResult.className = 'test-result success';
    })
    .catch(() => {
      testResult.textContent = 'Connection failed — is Recollect Core running?';
      testResult.className = 'test-result error';
    });
}

// --- Theme ---
function applyTheme(theme) {
  const isDark = theme === 'dark';
  if (themeToggle) themeToggle.checked = isDark;
  document.body.setAttribute('data-theme', theme || '');
}

if (themeToggle) {
  themeToggle.addEventListener('change', () => {
    const theme = themeToggle.checked ? 'dark' : '';
    document.body.setAttribute('data-theme', theme);
  });
}

// --- Event listeners ---
saveBtn.addEventListener('click', saveSettings);
testApiBtn.addEventListener('click', testApiConnection);
apiUrlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveSettings(); });

document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    loadShortcuts();
});

function loadShortcuts() {
    chrome.commands.getAll((commands) => {
        commands.forEach(cmd => {
            const el = document.getElementById('shortcut-' + cmd.name);
            if (el) el.textContent = cmd.shortcut || '(not set)';
        });
    });
}

const openShortcutsBtn = document.getElementById('openShortcutsBtn');
if (openShortcutsBtn) {
    openShortcutsBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    });
}