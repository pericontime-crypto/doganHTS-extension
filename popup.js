let scannedDocuments = [];
let analyzedData = {};

document.addEventListener('DOMContentLoaded', async () => {
  // Önceki analiz sonuçlarını yükle
  const stored = await chrome.storage.local.get(['analyzedData', 'scannedDocuments']);
  
  if (stored.analyzedData && Object.keys(stored.analyzedData).length > 0) {
    analyzedData = stored.analyzedData;
    showResults(analyzedData);
    document.getElementById('fillBtn').disabled = false;
    setStatus('✅ Önceki analiz sonuçları yüklendi', 'success');
  }

  if (stored.scannedDocuments && stored.scannedDocuments.length > 0) {
    scannedDocuments = stored.scannedDocuments;
    const docList = document.getElementById('docList');
    docList.innerHTML = scannedDocuments.map(d => 
      `<div class="doc-item">${d.name.substring(0,40)} — <b>${d.type}</b></div>`
    ).join('');
    document.getElementById('analyzeBtn').disabled = false;
    if (!stored.analyzedData) {
      setStatus(`✅ ${scannedDocuments.length} evrak hazır (önceden taranmış)`, 'success');
    }
  }

  if (!stored.analyzedData && !stored.scannedDocuments) {
    setStatus('✅ Hazır', 'success');
  }
});

function setStatus(message, type) {
  const bar = document.getElementById('status');
  if (!bar) return;
  bar.textContent = message;
  bar.className = type === 'error' ? 'error' : type === 'loading' ? 'loading' : '';
}

function showResults(data) {
  const results = document.getElementById('results');
  results.style.display = 'block';
  results.innerHTML = Object.entries(data)
    .filter(([k, v]) => v)
    .map(([k, v]) => `<div class="r-item"><span class="r-key">${k}</span><span class="r-val">${v}</span></div>`)
    .join('');
}

document.getElementById('scanBtn').addEventListener('click', async () => {
  setStatus('🔍 Taranıyor...', 'loading');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'collectDocuments' });
    
    if (response.success && response.documents.length > 0) {
      scannedDocuments = response.documents;

      // Taranan evrakları kaydet (base64 hariç, sadece meta bilgi)
      await chrome.storage.local.set({ 
        scannedDocuments: scannedDocuments.map(d => ({ name: d.name, url: d.url, type: d.type }))
      });

      const docList = document.getElementById('docList');
      docList.innerHTML = scannedDocuments.map(d => 
        `<div class="doc-item">${d.name.substring(0,40)} — <b>${d.type}</b></div>`
      ).join('');
      document.getElementById('analyzeBtn').disabled = false;
      setStatus(`✅ ${scannedDocuments.length} evrak bulundu`, 'success');
    } else {
      setStatus('⚠️ Evrak bulunamadı', 'error');
    }
  } catch (err) {
    setStatus('❌ Hata: ' + err.message, 'error');
  }
});

document.getElementById('analyzeBtn').addEventListener('click', async () => {
  setStatus('⚡ Evraklar hazırlanıyor...', 'loading');
  document.getElementById('analyzeBtn').disabled = true;

  try {
    const documentsWithData = await Promise.all(scannedDocuments.map(async (doc) => {
      try {
        const response = await fetch(doc.url);
        const blob = await response.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result.split(',')[1];
            const mimeType = blob.type || (doc.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
            resolve({ ...doc, base64, mimeType });
          };
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        console.error('Dosya okunamadi:', doc.name, e);
        return null;
      }
    }));

    const validDocs = documentsWithData.filter(d => d !== null);
    if (validDocs.length === 0) throw new Error('Evraklar okunamadı');

    setStatus('⚡ AI Analizi yapılıyor...', 'loading');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const formResponse = await chrome.tabs.sendMessage(tab.id, { action: 'collectFormFields' });

    const response = await chrome.runtime.sendMessage({
      action: 'analyzeDocuments',
      documents: validDocs,
      formFields: formResponse.fields || {}
    });

    if (response.success) {
      analyzedData = response.data;
      
      // Sonuçları chrome.storage.local'a kaydet
      await chrome.storage.local.set({ analyzedData: analyzedData });
      
      showResults(analyzedData);
      document.getElementById('fillBtn').disabled = false;
      setStatus('✅ Analiz tamamlandı! (Sonuçlar kaydedildi)', 'success');
    } else {
      setStatus('❌ ' + response.error, 'error');
      document.getElementById('analyzeBtn').disabled = false;
    }
  } catch (err) {
    setStatus('❌ Hata: ' + err.message, 'error');
    document.getElementById('analyzeBtn').disabled = false;
  }
});

document.getElementById('fillBtn').addEventListener('click', async () => {
  setStatus('✏️ Dolduruluyor...', 'loading');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'fillForm',
      formData: analyzedData
    });
    if (response.success) {
      setStatus(`✅ ${response.filledCount} alan dolduruldu!`, 'success');
    } else {
      setStatus('⚠️ Bazı alanlar doldurulamadı', 'error');
    }
  } catch (err) {
    setStatus('❌ Hata: ' + err.message, 'error');
  }
});

// Temizle butonu - yeni dosya için sıfırla
document.getElementById('clearBtn')?.addEventListener('click', async () => {
  await chrome.storage.local.remove(['analyzedData', 'scannedDocuments']);
  analyzedData = {};
  scannedDocuments = [];
  document.getElementById('results').style.display = 'none';
  document.getElementById('results').innerHTML = '';
  document.getElementById('docList').innerHTML = '';
  document.getElementById('fillBtn').disabled = true;
  document.getElementById('analyzeBtn').disabled = true;
  setStatus('🗑️ Temizlendi. Yeni tarama yapabilirsiniz.', 'success');
});
