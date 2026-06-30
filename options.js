// options.js — Recollect Extension Settings

const apiUrlInput = document.getElementById('apiUrl');
const shortcutKeyInput = document.getElementById('shortcutKey');
const autoSaveCheckbox = document.getElementById('autoSaveOnSelect');
const markdownPathInput = document.getElementById('markdownPath');
const saveBtn = document.getElementById('saveBtn');
const saveStatus = document.getElementById('saveStatus');
const testApiBtn = document.getElementById('testApiBtn');
const testResult = document.getElementById('testResult');

const DEFAULT_API_URL = 'http://localhost:5000/api/capture';

// --- Load settings ---
function loadSettings() {
  chrome.storage.sync.get(['apiUrl', 'shortcutKey', 'autoSaveOnSelect', 'markdownPath'], (settings) => {
    apiUrlInput.value = settings.apiUrl || DEFAULT_API_URL;
    shortcutKeyInput.value = settings.shortcutKey || 'Alt+Shift+R';
    autoSaveCheckbox.checked = settings.autoSaveOnSelect || false;
    markdownPathInput.value = settings.markdownPath || '';
  });
}

// --- Save settings ---
function saveSettings() {
  const apiUrl = apiUrlInput.value.trim() || DEFAULT_API_URL;
  const shortcutKey = shortcutKeyInput.value.trim() || 'Alt+Shift+R';
  const autoSaveOnSelect = autoSaveCheckbox.checked;
  const markdownPath = markdownPathInput.value.trim() || '';

  chrome.storage.sync.set({
    apiUrl,
    shortcutKey,
    autoSaveOnSelect,
    markdownPath
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

  fetch(apiUrl, {
    method: 'GET'
  })
  .then(res => res.json())
  .then(data => {
    testResult.textContent = 'Connected ✓ (' + (data.captures?.length || 0) + ' saved items)';
    testResult.className = 'test-result success';
  })
  .catch(err => {
    testResult.textContent = 'Connection failed — is Recollect Core running?';
    testResult.className = 'test-result error';
  });
}

// --- Event listeners ---
saveBtn.addEventListener('click', saveSettings);
testApiBtn.addEventListener('click', testApiConnection);

// Auto-save on Enter in inputs
apiUrlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveSettings(); });
shortcutKeyInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveSettings(); });

// --- Initialize ---
document.addEventListener('DOMContentLoaded', loadSettings);