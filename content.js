// Listen for keyboard shortcut message from background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSelection') {
    const selectedText = window.getSelection().toString();
    sendResponse({ text: selectedText });
  }
});

// Optional: Add keyboard listener for local shortcut handling
document.addEventListener('keydown', (event) => {
  // Check for Ctrl+E (or Cmd+E on Mac)
  const isSaveShortcut = (event.ctrlKey || event.metaKey) && event.code === 'KeyE';
  
  if (isSaveShortcut) {
    event.preventDefault();
    const selectedText = window.getSelection().toString();
    
    if (selectedText.trim()) {
      // Send to background script
      chrome.runtime.sendMessage(
        {
          action: 'saveHighlight',
          text: selectedText,
          title: document.title,
          url: window.location.href
        },
        (response) => {
          if (response && response.success) {
            showNotification('Highlight saved!');
          }
        }
      );
    }
  }
});

// Show temporary notification
function showNotification(message) {
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #10b981;
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    z-index: 10000;
    font-family: system-ui, sans-serif;
    font-size: 14px;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 2000);
}
