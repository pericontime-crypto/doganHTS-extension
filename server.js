
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
      text: `Sen bir sigorta hukuku uzmanısın. Sana verilen belgeleri çok titiz analiz et.

KRİTİK ÖNCELİK KURALI:
- BİRİNCİL KAYNAK: Eğer belgeler arasında "Eksper Raporu" varsa, tüm bilgiler için MUTLAK ÖNCELİĞİ bu rapora ver. 
- Diğer belgeler (KTT, Ruhsat, Poliçe) ile Eksper Raporu arasında çelişki varsa, her zaman EKSPER RAPORU'ndaki bilgiyi doğru kabul et. 
- Diğer belgeleri sadece Eksper Raporu'nda bulunmayan veya okunamayan bilgiler için kullan.

EKSPER RAPORU ÖZEL KURALLARI:
1. TARAF AYRIMI:
   - "TAZMİNAT TALEP EDEN" veya "MAĞDUR ARAÇ" başlığı altındaki tüm bilgiler BİZİM tarafımızdır.
   - "SİGORTALI ARACA İLİŞKİN BİLGİLER" başlığı altındakiler KARŞI tarafın bilgileridir.
   - "MAĞDUR ARAÇ SÜRÜCÜ BİLGİLERİ" = BİZİM sürücümüzdür.
   - "SİGORTALI ARACIN SÜRÜCÜSÜNE İLİŞKİN BİLGİLER" = KARŞI tarafın sürücüsüdür.

2. HASAR VE ONARIM BİLGİLERİ:
   - "HASAR BİLGİLERİ" bölümünden: Kaza Tarihi, Hasar İli/İlçesi ve "Hasar Onarım Süresi" (İş Günü olarak) bilgilerini al.
   - "HASAR TUTARI" Tablosundan: "Toplam Tutar" bilgisini hasar miktarı olarak al.

3. DİĞER KURALLAR:
   - İsim ve Soyismi mutlaka ayır.
   - Karşı taraf sigortalı kısmında şirket ünvanı varsa (Örn: ... LTD ŞTİ), ünvanı "karsi_sigortali_ad" kısmına, Vergi No'yu "karsi_sigortali_tc_vkn" kısmına yaz.
   - Vekalet belgesinden başlangıç/bitiş tarihlerini al (bitiş yoksa "süresiz").

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
  "onarim_suresi": "Gündüz sayısı",
  "kusur_orani": "",
  "hasar_miktari": "TL tutarı",
  "fiyat_01": "",
  "fiyat_02": "",
  "fiyat_03": "",
  "karsi_sigortali_ad": "",
  "karsi_sigortali_soyad": "",
  "karsi_sigortali_tc_vkn": "",
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
  "vekalet_bitis": "GG.AA.YYYY veya süresiz",
  "degisen_parcalar": "",
  "eksper_rapor_no": ""
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
