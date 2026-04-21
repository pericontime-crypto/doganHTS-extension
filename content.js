// Dogan HTS Extension - Content Script

function collectDocuments() {
  const documents = [];
  
  // data-fancybox="gallery" olan linkleri bul
  const fileLinks = document.querySelectorAll('a[data-fancybox="gallery"]');
  
  fileLinks.forEach((link, index) => {
    const url = link.href;
    const fileName = url.split('/').pop();
    
    // Evrak türünü bul - yakın td'den al
    const row = link.closest('tr');
    const cells = row ? row.querySelectorAll('td') : [];
    let fileType = 'Evrak';
    let displayName = fileName;
    
    // Satırdaki metin içeriklerini topla
    cells.forEach(cell => {
      const text = cell.innerText?.trim();
      if (text && text.length > 2 && !cell.querySelector('img')) {
        if (!displayName || displayName === fileName) {
          displayName = text;
        }
        fileType = text;
      }
    });

    // Tablo başlık satırından evrak türü bul
    const table = link.closest('table');
    if (table) {
      const prevHeader = getPreviousHeader(link);
      if (prevHeader) fileType = prevHeader;
    }

    // Filtrele: Hasar ve onarım fotoğraflarını alma
    const forbiddenKeywords = ['hasar', 'onarim', 'foto', 'resim', 'goruntu', 'ekspertiz'];
    const isForbidden = forbiddenKeywords.some(key => 
      (fileType || '').toLowerCase().includes(key) || 
      (displayName || '').toLowerCase().includes(key)
    );

    if (!isForbidden) {
      documents.push({
        name: displayName || `Evrak_${index + 1}`,
        url: url,
        type: fileType
      });
    }
  });

  // PDF linkleri de ekle
  const pdfLinks = document.querySelectorAll('a[href$=".pdf"]');
  pdfLinks.forEach((link, index) => {
    const url = link.href;
    const fileName = url.split('/').pop();
    const row = link.closest('tr');
    let fileType = 'PDF Evrak';
    
    if (row) {
      const cells = row.querySelectorAll('td');
      cells.forEach(cell => {
        const text = cell.innerText?.trim();
        if (text && text.length > 2 && !cell.querySelector('a')) {
          fileType = text;
        }
      });
    }

    // Duplicate ve Filtre kontrolü
    const exists = documents.find(d => d.url === url);
    const forbiddenKeywords = ['hasar', 'onarim', 'foto', 'resim', 'goruntu', 'ekspertiz'];
    const isForbidden = forbiddenKeywords.some(key => 
      (fileType || '').toLowerCase().includes(key) || 
      (fileName || '').toLowerCase().includes(key)
    );

    if (!exists && !isForbidden) {
      documents.push({
        name: fileName,
        url: url,
        type: fileType
      });
    }
  });

  return documents;
}

function getPreviousHeader(element) {
  // Önceki grup başlığını bul
  let current = element.closest('tr');
  while (current) {
    current = current.previousElementSibling;
    if (current) {
      const headerCell = current.querySelector('td[colspan], th[colspan], .group-header');
      if (headerCell) return headerCell.innerText?.trim();
    }
  }
  return null;
}

function collectFormFields() {
  const fields = {};
  const inputs = document.querySelectorAll('input[type="text"], input[type="number"], select, textarea');
  
  inputs.forEach(input => {
    const label = input.closest('.form-group')?.querySelector('label')?.innerText?.trim()
                 || input.getAttribute('placeholder')
                 || input.getAttribute('name')
                 || input.id;
    if (label) {
      fields[label] = {
        element: input.id || input.name,
        value: input.value,
        type: input.tagName.toLowerCase()
      };
    }
  });
  return fields;
}

function fillForm(formData) {
  let filledCount = 0;
  
  for (const [fieldName, value] of Object.entries(formData)) {
    let element = document.getElementById(fieldName);
    if (!element) element = document.querySelector(`[name="${fieldName}"]`);
    if (!element) element = document.querySelector(`[placeholder*="${fieldName}"]`);
    
    if (element && value) {
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      filledCount++;
    }
  }
  return filledCount;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'collectDocuments') {
    const docs = collectDocuments();
    sendResponse({ success: true, documents: docs });
  }
  if (request.action === 'collectFormFields') {
    const fields = collectFormFields();
    sendResponse({ success: true, fields });
  }
  if (request.action === 'fillForm') {
    const count = fillForm(request.formData);
    sendResponse({ success: true, filledCount: count });
  }
  if (request.action === 'getCurrentUrl') {
    sendResponse({ success: true, url: window.location.href });
  }
});
