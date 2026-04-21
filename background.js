// Doğan HTS Extension - Background Service Worker
const SERVER_URL = 'https://doganhts-server.onrender.com';

// Extension güncellemelerini kontrol et
chrome.runtime.onInstalled.addListener(() => {
  console.log('Doğan HTS Extension yüklendi');
});

// Popup'tan gelen mesajları dinle
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  if (request.action === 'analyzeDocuments') {
    analyzeDocuments(request.documents, request.formFields)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // async response için
  }

  if (request.action === 'getStatus') {
    fetch(`${SERVER_URL}/status`)
      .then(r => r.json())
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

// Evrakları analiz et
async function analyzeDocuments(documents, formFields) {
  const response = await fetch(`${SERVER_URL}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documents, formFields })
  });
  
  if (!response.ok) {
    throw new Error(`Sunucu hatası: ${response.status}`);
  }
  
  return await response.json();
}
