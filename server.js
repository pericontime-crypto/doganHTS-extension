
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

    documents.forEach(function (doc) {
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
      text: `Sen bir sigorta hukuku uzmanısın. Sana verilen tüm belgeleri (PDF ve görsel) çok titiz bir şekilde analiz et ve aşağıdaki kurallara göre JSON verisi oluştur.

ÖNEMLİ KURALLAR:

1. TARAF BELİRLEME (PLAKA ÜZERİNDEN):
   - "Bizim Aracımız": "Bizim Ruhsat" belgesindeki plakadır.
   - KTT (Kaza Tespit Tutanağı) içindeki Taraf A ve Taraf B'yi plakalarla karşılaştır. Bizim ruhsat plakasıyla eşleşen bölüm BİZİM TARAFIMIZDIR. Diğer plaka KARŞI TARAFTIR.

2. BİZİM SÜRÜCÜ BİLGİLERİ (Sadece KTT):
   - Bizim plakamızla eşleşen KTT bölümündeki Sürücü bilgilerini al.
   - İSİM VE SOYİSMİ AYIR: İsmi ve Soyismi mutlaka iki ayrı alana böl. (Örn: "Mehmet Ali Yılmaz" -> Ad: Mehmet Ali, Soyad: Yılmaz).
   - Sürücü TC numarasını KTT üzerinden oku.

3. KARŞI TARAF SİGORTALI VE SÜRÜCÜ AYRIMI:
   - KARŞI SİGORTALI (Araç Sahibi): Karşı tarafın ruhsatındaki araç sahibidir. Ad, Soyad ve TC/VKN bilgilerini çıkar.
   - KARŞI SÜRÜCÜ: KTT'de karşı tarafın plakasıyla eşleşen sürücü bilgileridir. Ad, Soyad ve TC bilgilerini çıkar.
   - ŞİRKET/VKN KONTROLÜ: Karşı sigortalı bir şahıs değilse (şirketse), şirket adını "karsi_sigortali_ad" alanına yaz, Vergi Numarasını ise "karsi_sigortali_tc_vkn" alanına yaz. Şirket durumunda soyadı boş bırak.

4. KARŞI POLİÇE DETAYLARI:
   - ÖNCELİK "Karşı Poliçe" isimli belgededir. Bu belgeden: Poliçe No, Yenileme No, Poliçe Başlangıç ve Bitiş tarihlerini al.

5. RAYİÇ / PİYASA DEĞERLERİ:
   - Bulduğun 3 farklı miktar bilgisini sırasıyla "fiyat_01", "fiyat_02" ve "fiyat_03" alanlarına yaz. Eğer 3'ten az varsa, olanları yaz, diğerlerini boş bırak.

6. VEKALETNAME ANALİZİ:
   - "Vekalet" belgesinden: Başlangıç tarihini çıkar. Varsa Bitiş tarihini çıkar, yoksa "süresiz" yaz.

7. HASAR YERİ VE KİLOMETRE:
   - KTT veya Eksper Raporundan: Kazanın olduğu IL ve ILÇE bilgisini çıkar.
   - Eksper raporu veya ruhsat eklerinden aracın KİLOMETRE (KM) bilgisini "arac_km" alanına yaz.

LÜTFEN SADECE AŞAĞIDAKİ JSON YAPISINDA CEVAP VER:
{
  "surucu_ad": "",
  "surucu_soyad": "",
  "surucu_tc": "",
  "plaka": "Bizim Plakamız",
  "arac_marka": "",
  "arac_model": "",
  "arac_yil": "",
  "motor_no": "",
  "sasi_no": "",
  "arac_km": "",
  "kaza_tarihi": "GG.AA.YYYY",
  "hasar_il": "",
  "hasar_ilce": "",
  "kusur_orani": "",
  "hasar_miktari": "",
  "fiyat_01": "",
  "fiyat_02": "",
  "fiyat_03": "",
  "karsi_sigortali_ad": "Şahıs adı veya Şirket Ünvanı",
  "karsi_sigortali_soyad": "Şirketse boş bırak",
  "karsi_sigortali_tc_vkn": "TC veya Vergi No",
  "karsi_surucu_ad": "",
  "karsi_surucu_soyad": "",
  "karsi_surucu_tc": "",
  "karsi_taraf_plaka": "",
  "karsi_sigorta_sirketi": "",
  "karsi_police_no": "",
  "karsi_yenileme_no": "",
  "karsi_police_baslangic": "GG.AA.YYYY",
  "karsi_police_bitis": "GG.AA.YYYY",
  "vekalet_baslangic": "GG.AA.YYYY",
  "vekalet_bitis": "GG.AA.YYYY veya süresiz"
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

app.listen(PORT, function () {
  console.log('Dogan HTS Sunucu calisiyor: port ' + PORT);
});
