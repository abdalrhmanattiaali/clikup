# 🤖 ClickUp WhatsApp AI Notification System

## ✨ النظام الجديد - كل شيء في ملف واحد!

نظام إشعارات ذكي يربط ClickUp بـ WhatsApp باستخدام الذكاء الاصطناعي (Claude AI).

---

## 🎯 المميزات

### ✅ إشعارات ذكية بالـ AI
- **توليد تلقائي** للإشعارات باستخدام Claude AI
- **لغة عربية** طبيعية وودودة
- **سياقية** - تفهم نوع التغيير وتكتب إشعار مناسب
- **Fallback تلقائي** - إشعارات بسيطة إذا AI غير متاح

### 📊 تتبع التغييرات
- تغيير حالة المهمة (Task Status)
- تعيين/إزالة مسؤول (Assignee)
- تغيير الأولوية (Priority)
- تغيير الموعد النهائي (Due Date)
- أي تحديث آخر

### 📈 تحليلات وإحصائيات
- عدد المهام المكتملة (يومي، أسبوعي، شهري)
- إحصائيات الفريق
- سجل النشاطات
- Dashboard API

### 💪 تحفيز الفريق
- رسائل صباحية تلقائية (9 صباحاً)
- تقرير أسبوعي (الجمعة 5 مساءً)

---

## 🚀 التثبيت والتشغيل

### 1. تثبيت الـ Dependencies
```bash
npm install
```

### 2. إعداد ملف `.env`
```env
# API Keys
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here

# ClickUp
CLICKUP_TOKEN=pk_xxxxx
CLICKUP_TEAM_ID=xxxxx

# Server
PORT=5014

# WhatsApp
WHATSAPP_GROUP_NAME=Click Up notification 📢

# Features
ENABLE_AI=true
ENABLE_MOTIVATION=true
ENABLE_ANALYTICS=true
```

### 3. تشغيل السيرفر
```bash
# Production
pm2 start index.js --name clikup-bot

# Development
npm run dev

# Direct
node index.js
```

### 4. مسح QR Code للـ WhatsApp
بعد بدء التشغيل، سيظهر QR Code في الـ terminal.
امسحه بتطبيق WhatsApp على هاتفك.

---

## 🔗 إعداد ClickUp Webhook

1. افتح **ClickUp** → Settings → Integrations → Webhooks
2. اضغط **"+ Add Webhook"**
3. الإعدادات:
   ```
   Name: Task Status Updates
   Endpoint: http://your-server-ip:5014/task-updated-webhook
   Events: ✓ Task Status Updated
   Status: Active
   ```
4. **احفظ**

---

## 📡 API Endpoints

### Webhooks
- `POST /task-updated-webhook` - استقبال تحديثات المهام من ClickUp
- `POST /task-created-webhook` - استقبال مهام جديدة

### Dashboard API
- `GET /api/dashboard-stats` - إحصائيات عامة
- `GET /api/recent-activity` - آخر النشاطات
- `GET /api/team-stats` - إحصائيات الفريق

### Testing
- `GET /webhook-test` - اختبار السيرفر
- `GET /test-ai` - اختبار AI
- `GET /test-whatsapp` - اختبار WhatsApp

---

## 🧪 الاختبار

### 1. اختبار السيرفر
```bash
curl http://localhost:5014/webhook-test
```

### 2. اختبار AI
```bash
curl http://localhost:5014/test-ai
```

### 3. اختبار WhatsApp
```bash
curl http://localhost:5014/test-whatsapp
```

### 4. اختبار من ClickUp
- غيّر حالة أي مهمة في ClickUp
- يجب أن تصل إشعار في WhatsApp خلال ثوانِ!

---

## 📊 مثال على إشعار AI

### عند إنجاز مهمة:
```
✅ رائع! أنجز أحمد مهمة "تصميم الواجهة الرئيسية"
المهمة كانت بأولوية عاجلة 🔴
أحسنت يا أحمد! 🎉
```

### عند تعيين مهمة:
```
📋 تم تعيين مهمة "كتابة التوثيق" لـ سارة
الموعد النهائي: خلال 3 أيام
بالتوفيق! 💪
```

### عند تغيير الأولوية:
```
⚡ رفع علي أولوية مهمة "إصلاح Bug" إلى عاجلة جداً 🔴
المهمة تحتاج انتباه فوري!
```

---

## 📁 بنية المشروع

```
clikup/
├── index.js              ← كل شيء هنا! 🎯
├── .env                  ← الإعدادات
├── package.json          ← Dependencies
├── productivity_data.json ← البيانات (يُنشأ تلقائياً)
├── .wwebjs_auth/         ← WhatsApp session (يُنشأ تلقائياً)
└── public/               ← Dashboard files (اختياري)
```

**كل شيء في ملف `index.js` واحد! لا ملفات منفصلة! 🚀**

---

## 🔧 الإعدادات المتقدمة

### تعطيل AI
إذا لم يكن لديك مفتاح Anthropic:
```env
ENABLE_AI=false
```
سيستخدم النظام إشعارات بسيطة بدون AI.

### تعطيل التحفيز
```env
ENABLE_MOTIVATION=false
```

### تعطيل التحليلات
```env
ENABLE_ANALYTICS=false
```

---

## 🐛 استكشاف الأخطاء

### المشكلة: مافيش إشعارات

**التحقق 1:** السيرفر شغال؟
```bash
pm2 status
```

**التحقق 2:** WhatsApp متصل؟
```bash
pm2 logs clikup-bot --lines 20 | grep "WhatsApp Ready"
```

**التحقق 3:** المجموعة موجودة؟
```bash
pm2 logs clikup-bot --lines 20 | grep "Group found"
```

**التحقق 4:** Webhook يصل؟
```bash
pm2 logs clikup-bot --follow
# ثم غيّر حالة مهمة في ClickUp
```

---

## 📝 السجلات (Logs)

```bash
# آخر 50 سطر
pm2 logs clikup-bot --lines 50

# متابعة مباشرة
pm2 logs clikup-bot --follow

# مسح السجلات
pm2 flush clikup-bot
```

---

## 🔄 التحديث

```bash
# أوقف السيرفر
pm2 stop clikup-bot

# سحب التحديثات
git pull

# ثبّت dependencies جديدة
npm install

# أعد التشغيل
pm2 restart clikup-bot
```

---

## 💡 نصائح

1. **استخدم PM2** للتشغيل في production
2. **راقب السجلات** عند الاختبار
3. **تأكد من Webhook type** في ClickUp (`Task Status Updated`)
4. **احتفظ بـ backup** من `.env`

---

## 🎉 المميزات الجديدة

### ✅ كل شيء في ملف واحد
- لا ملفات منفصلة
- سهل القراءة والتعديل
- منظم مع تعليقات واضحة

### ✅ نظام AI مبسط
- توليد ذكي للإشعارات
- Fallback تلقائي
- سريع وموثوق

### ✅ إلغاء Queue System
- إشعارات فورية (لا انتظار)
- لا batch processing
- أبسط وأسرع

---

## 📞 الدعم

راجع السجلات عند حدوث مشكلة:
```bash
pm2 logs clikup-bot --lines 100
```

---

**🚀 النظام جاهز! استمتع بإشعارات ذكية وفورية!**
