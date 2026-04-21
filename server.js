
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Başlangıçta anahtar kontrolü
if (!CLAUDE_API_KEY) {
  console.error('KRİTİK HATA: CLAUDE_API_KEY tanımlanmamış! Lütfen Render panelinden Environment Variables kısmını kontrol edin.');
} else {
  console.log('API Anahtarı tespit edildi. Uzunluk:', CLAUDE_API_KEY.length);
}

app.get('/status', (req, res) => {
  res.json({ status: 'ok', version: '1.0', message: 'Dogan HTS Sunucu aktif' });
});

app.post('/analyze', async (req, res) => {
  try {
    const { documents, formFields } = req.body;

    if (!documents || documents.length === 0) {
      return res.status(400).json({ error: 'Evrak bulunamadi' });
    }

    const content = [];

    documents.forEach(function(doc) {
      if (!doc.base64) return;
      
      content.push({ type: 'text', text: 'Evrak adi: ' + doc.name + ', Turu: ' + doc.type });

      if (doc.mimeType === 'application/pdf') {
        content.push({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: doc.base64 }
        });
      } else {
        content.push({
          type: 'image',
          source: { type: 'base64', media_type: doc.mimeType || 'image/jpeg', data: doc.base64 }
        });
      }
    });

    content.push({
      type: 'text',
      text: 'Bu evraklari incele. Asagidaki bilgileri JSON formatinda dondur, baska aciklama ekleme:\n{\n  "surucu_ad": "",\n  "surucu_soyad": "",\n  "surucu_tc": "",\n  "plaka": "",\n  "arac_marka": "",\n  "arac_model": "",\n  "arac_yil": "",\n  "motor_no": "",\n  "sasi_no": "",\n  "kaza_tarihi": "",\n  "kusur_orani": "",\n  "hasar_miktari": "",\n  "karsi_taraf_tc": "",\n  "karsi_taraf_ad": "",\n  "karsi_taraf_soyad": "",\n  "karsi_taraf_plaka": "",\n  "karsi_sigorta_sirketi": "",\n  "karsi_police_no": "",\n  "degisen_parcalar": "",\n  "eksper_rapor_no": ""\n}'
    });

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 1000,
        messages: [{ role: 'user', content: content }]
      })
    });

    const claudeData = await claudeResponse.json();

    if (!claudeResponse.ok) {
      console.error('Anthropic API Detayli Hata:', JSON.stringify(claudeData, null, 2));
      throw new Error(claudeData.error ? claudeData.error.message : 'Claude API hatasi');
    }

    const text = claudeData.content[0].text;
    
    // JSON'ı temizle (AI bazen ```json ... ``` içinde gönderir)
    let cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    // Eğer metnin başında/sonunda JSON dışı karakterler varsa temizle
    const firstBrace = cleanText.indexOf('{');
    const lastBrace = cleanText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleanText = cleanText.substring(firstBrace, lastBrace + 1);
    }
    
    const result = JSON.parse(cleanText);

    res.json(result);

  } catch (err) {
    console.error('Analiz hatasi:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, function() {
  console.log('Dogan HTS Sunucu calisiyor: port ' + PORT);
});
