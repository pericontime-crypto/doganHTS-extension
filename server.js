
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
      text: `Sen bir sigorta hukuku uzmanısın. Sana verilen evrakları dikkatle incele ve bilgileri çıkar.

ÖNEMLİ KURALLAR:
1. "Bizim müvekkil" = zarar gören taraf, yani ruhsatname (araç tescil belgesi) ve vekaletname evraklarındaki kişidir.
2. "Karşı taraf" = kazaya sebep olan, kusurlu olan, sigorta poliçesi bizden tazminat talep edilen taraftır.
3. Kaza tutanağında (tespit tutanağı) genellikle iki taraf vardır: 
   - "1. Sürücü / Taraf A" ve "2. Sürücü / Taraf B" şeklinde olabilir
   - Ruhsatnamedeki plaka ile eşleşen taraf BİZİM taraftır
   - Diğer taraf KARŞI taraftır
4. Eğer vekaletnamedeki TC kimlik numarası tutanaktaki bir tarafla eşleşiyorsa, o taraf BİZİM müvekkildir.
5. Plaka bilgisi: Ruhsatnamede yazan plaka = bizim plaka. Tutanakta yazan diğer plaka = karşı taraf plaka.

SİGORTALI ve SÜRÜCÜ AYRIMI:
- RUHSATNAMEDEKİ kişi bilgileri = SİGORTALI (araç sahibi) bilgileridir
- KTT (Kaza Tespit Tutanağı) daki sürücü bilgileri = SÜRÜCÜ bilgileridir
- Sigortalı ve sürücü farklı kişiler olabilir, ayrı ayrı çıkar

KARŞI TARAF POLİÇE BİLGİLERİ:
- Karşı tarafın sigorta poliçesinden: poliçe no, yenileme no, başlangıç tarihi, bitiş tarihi bilgilerini çıkar

RAYİÇ BEDEL:
- Evraklarda rayiç bedel, piyasa değeri veya araç değeri olarak geçen tutarı "rayic_bedel" alanına yaz

HASAR YERİ:
- KTT veya eksper raporundan kazanın olduğu il ve ilçeyi çıkar

KM BİLGİSİ:
- Eksper raporundan veya diğer evraklardan aracın kilometre bilgisini çıkar

Aşağıdaki bilgileri JSON formatında döndür. Başka hiçbir açıklama veya yorum ekleme, sadece JSON döndür:
{
  "sigortali_ad": "Ruhsatnamedeki araç sahibinin adı",
  "sigortali_soyad": "Ruhsatnamedeki araç sahibinin soyadı",
  "sigortali_tc": "Ruhsatnamedeki araç sahibinin TC kimlik no",
  "surucu_ad": "KTT deki sürücünün adı (bizim taraf)",
  "surucu_soyad": "KTT deki sürücünün soyadı (bizim taraf)",
  "surucu_tc": "KTT deki sürücünün TC kimlik no (bizim taraf)",
  "plaka": "Bizim aracın plakası (ruhsatnameden)",
  "arac_marka": "Bizim aracın markası",
  "arac_model": "Bizim aracın modeli",
  "arac_yil": "Bizim aracın model yılı",
  "motor_no": "Bizim aracın motor numarası",
  "sasi_no": "Bizim aracın şasi numarası",
  "arac_km": "Aracın kilometre bilgisi",
  "kaza_tarihi": "Kazanın tarihi (GG.AA.YYYY)",
  "hasar_il": "Kazanın olduğu il",
  "hasar_ilce": "Kazanın olduğu ilçe",
  "kusur_orani": "Karşı tarafın kusur oranı (% olarak)",
  "hasar_miktari": "Hasar tutarı (TL)",
  "rayic_bedel": "Aracın rayiç/piyasa değeri (TL)",
  "karsi_taraf_tc": "Karşı tarafın TC kimlik no",
  "karsi_taraf_ad": "Karşı tarafın adı",
  "karsi_taraf_soyad": "Karşı tarafın soyadı",
  "karsi_taraf_plaka": "Karşı tarafın plakası",
  "karsi_sigorta_sirketi": "Karşı tarafın sigorta şirketi adı",
  "karsi_police_no": "Karşı tarafın poliçe numarası",
  "karsi_yenileme_no": "Karşı tarafın poliçe yenileme numarası",
  "karsi_police_baslangic": "Karşı tarafın poliçe başlangıç tarihi (GG.AA.YYYY)",
  "karsi_police_bitis": "Karşı tarafın poliçe bitiş tarihi (GG.AA.YYYY)",
  "degisen_parcalar": "Değişen/onarılan parçalar listesi",
  "eksper_rapor_no": "Ekspertiz rapor numarası"
}`
    });

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
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
