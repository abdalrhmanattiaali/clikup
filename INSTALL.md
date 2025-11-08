# 🚀 دليل التثبيت السريع

## 📦 الخطوة 1: تثبيت المكتبات

```bash
npm install
```

أو يدوياً:
```bash
npm install express axios node-cron @anthropic-ai/sdk whatsapp-web.js qrcode-terminal dotenv
```

---

## 🔑 الخطوة 2: إعداد ملف .env

### 1. انسخ الملف النموذجي:
```bash
cp .env.example .env
```

### 2. عدّل ملف .env وضع مفاتيحك:

```bash
nano .env
```

أو افتحه بأي محرر نصوص وعدّل:

```env
# ضع مفتاح Anthropic Claude هنا
ANTHROPIC_API_KEY=sk-ant-api03-your-real-key-here

# باقي الإعدادات (اختياري)
PORT=5014
WHATSAPP_GROUP_NAME=Click Up notification 📢
```

### 3. احصل على مفتاح Anthropic Claude:
1. اذهب إلى: https://console.anthropic.com/
2. سجّل دخول أو أنشئ حساب
3. اذهب إلى "API Keys"
4. انقر "Create Key"
5. انسخ المفتاح وضعه في `.env`

---

## 🚀 الخطوة 3: تشغيل النظام

```bash
npm start
```

أو مباشرة:
```bash
node index.js
```

---

## 📱 الخطوة 4: ربط WhatsApp

1. عند التشغيل سيظهر QR Code في الطرفية
2. افتح WhatsApp على هاتفك
3. اذهب إلى: **الإعدادات → الأجهزة المرتبطة → ربط جهاز**
4. امسح QR Code
5. انتظر رسالة: `✅ WhatsApp Ready`

---

## ✅ التأكد من التثبيت الصحيح

### 1. تحقق من السيرفر:
```bash
curl http://localhost:5014/api/dashboard-stats
```

### 2. افتح لوحة التحكم:
```
http://localhost:5014/dashboard
```

### 3. اختبر AI Coach:
```
http://localhost:5014/test-ai-coach/اسمك
```

---

## 🔧 حل المشاكل

### ❌ خطأ: Cannot find module 'dotenv'
```bash
npm install dotenv
```

### ❌ خطأ: ANTHROPIC_API_KEY is not set
تأكد من:
1. ملف `.env` موجود في نفس مجلد المشروع
2. المفتاح موجود فيه بدون أخطاء
3. لا توجد مسافات زائدة

### ❌ WhatsApp QR Code لا يظهر
```bash
rm -rf .wwebjs_auth .wwebjs_cache
node index.js
```

---

## 📊 ملفات البيانات

سيتم إنشاء هذه الملفات تلقائياً عند التشغيل:
- `productivity_data.json` - سجل المهام
- `achievements.json` - الإنجازات
- `badges.json` - الشارات
- `challenges.json` - التحديات
- `monthly_reports.json` - التقارير

**⚠️ لا تحذف هذه الملفات** - تحتوي على تاريخ إنجازاتك!

---

## 🎯 الخطوات التالية

بعد التثبيت الناجح:
1. ✅ افتح لوحة التحكم: http://localhost:5014/dashboard
2. ✅ أنجز مهمة في ClickUp لترى الإشعار
3. ✅ انتظر الرسالة الصباحية في 8:05 صباحاً
4. ✅ راجع التقرير اليومي في 11:35 مساءً

---

## 📚 التوثيق الكامل

- **دليل التشغيل**: `دليل-التشغيل.md`
- **الدليل الشامل**: `ULTIMATE-GUIDE.md`
- **دليل النشر**: `DEPLOYMENT-CHECKLIST.md`

---

## 🎉 تم التثبيت بنجاح!

استمتع بنظام التحفيز المتقدم! 🚀✨
