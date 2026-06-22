const openDownloadsButton = document.getElementById('openDownloadsButton');
const savedCountElement = document.getElementById('savedCount');

// Open Downloads folder
openDownloadsButton.addEventListener('click', () => {
  chrome.downloads.showDefaultFolder();
});

// Track number of saved highlights
function updateSavedCount() {
  chrome.storage.local.get({ highlights: [] }, (result) => {
    savedCountElement.textContent = result.highlights.length;
  });
}

// Listen for changes to storage
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.highlights) {
    updateSavedCount();
  }
});

// Initialize
updateSavedCount();
