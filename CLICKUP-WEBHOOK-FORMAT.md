# 📋 تنسيق ClickUp Webhook

## 🎯 ما هو التنسيق الصحيح؟

حسب [وثائق ClickUp الرسمية](https://clickup.com/api/developer-portal/webhooks/)، الـ webhook payload يكون بهذا الشكل:

---

## 📥 taskUpdated Webhook

عندما يتم تحديث مهمة، ClickUp يرسل:

### التنسيق الكامل:
```json
{
  "event": "taskUpdated",
  "task_id": "abc123xyz",
  "webhook_id": "webhook-uuid-here",
  "history_items": [
    {
      "id": "history-item-id",
      "type": 1,
      "date": "1592334073286",
      "field": "status",
      "parent_id": "abc123xyz",
      "data": {},
      "source": null,
      "user": {
        "id": 183,
        "username": "John Doe",
        "email": "john@company.com",
        "color": "#7b68ee",
        "initials": "JD",
        "profilePicture": null
      },
      "before": {
        "status": "Open",
        "color": "#d3d3d3",
        "orderindex": 0,
        "type": "open"
      },
      "after": {
        "status": "Complete",
        "color": "#6bc950",
        "orderindex": 1,
        "type": "closed"
      }
    }
  ]
}
```

### الحقول المهمة:

| الحقل | النوع | الوصف |
|-------|------|-------|
| `event` | string | نوع الحدث (`taskUpdated`) |
| `task_id` | string | معرّف المهمة |
| `webhook_id` | string | معرّف الـ webhook |
| `history_items` | array | قائمة التغييرات |

### history_items[0]:

| الحقل | النوع | الوصف |
|-------|------|-------|
| `field` | string | الحقل الذي تغير (`status`, `assignee`, `priority`, etc) |
| `user` | object | المستخدم الذي قام بالتغيير |
| `user.username` | string | اسم المستخدم |
| `before` | object | القيمة قبل التغيير |
| `after` | object | القيمة بعد التغيير |

---

## 📝 أمثلة حقيقية

### مثال 1: تغيير الحالة (status)
```json
{
  "event": "taskUpdated",
  "task_id": "abc123",
  "history_items": [{
    "field": "status",
    "user": {
      "username": "محمد"
    },
    "before": {
      "status": "In Progress"
    },
    "after": {
      "status": "Complete"
    }
  }]
}
```

**الكود الحالي:**
```javascript
const body = req.body;
const taskId = body.task_id;  // ✅ "abc123"
const historyItem = body.history_items?.[0];  // ✅ object
const updaterName = historyItem.user?.username;  // ✅ "محمد"
const afterStatus = historyItem.after?.status;  // ❌ undefined!
```

**المشكلة:**
- نحن نقرأ من `task.status.status` (من API)
- لكن في webhook، نحتاج قراءة من `historyItem.after.status` مباشرة!

---

### مثال 2: تعيين مسؤول (assignee)
```json
{
  "event": "taskUpdated",
  "task_id": "abc123",
  "history_items": [{
    "field": "assignee",
    "user": {
      "username": "علي"
    },
    "before": null,
    "after": {
      "id": 456,
      "username": "سارة",
      "email": "sara@company.com"
    }
  }]
}
```

**الكود الحالي:**
```javascript
const afterValue = historyItem.after?.username;  // ✅ "سارة"
```

---

### مثال 3: تغيير الأولوية (priority)
```json
{
  "event": "taskUpdated",
  "task_id": "abc123",
  "history_items": [{
    "field": "priority",
    "user": {
      "username": "أحمد"
    },
    "before": {
      "id": "3",
      "priority": "3",
      "color": "#ffcc00",
      "orderindex": "3"
    },
    "after": {
      "id": "1",
      "priority": "1",
      "color": "#f50000",
      "orderindex": "1"
    }
  }]
}
```

**الكود الحالي:**
```javascript
const beforeValue = historyItem.before?.priority;  // ✅ "3"
const afterValue = task.priority?.priority;  // ❌ نقرأ من API!
```

**يجب:**
```javascript
const afterValue = historyItem.after?.priority;  // ✅ من webhook مباشرة
```

---

## 🐛 المشكلة في الكود الحالي

### في index.js (السطر 1445+):

```javascript
case 'status':
    beforeValue = historyItem.before?.status || 'غير محدد';
    afterValue = task.status?.status || 'غير محدد';  // ❌ خطأ!
    // ...
```

**المشكلة:**
- `historyItem.before?.status` ← ❌ خطأ! يجب `historyItem.before.status`
- `task.status?.status` ← ❌ نقرأ من API بدلاً من webhook!

**الصحيح:**
```javascript
case 'status':
    beforeValue = historyItem.before?.status || 'غير محدد';
    afterValue = historyItem.after?.status || 'غير محدد';  // ✅
```

---

## ✅ الإصلاح المطلوب

### 1. تغيير الحالة (status)
```diff
  case 'status':
-     beforeValue = historyItem.before?.status || 'غير محدد';
-     afterValue = task.status?.status || 'غير محدد';
+     beforeValue = historyItem.before?.status || 'غير محدد';
+     afterValue = historyItem.after?.status || 'غير محدد';
      console.log('   Before:', beforeValue);
      console.log('   After:', afterValue);
      break;
```

### 2. تعيين المسؤول (assignee)
```diff
  case 'assignee':
-     beforeValue = historyItem.before?.username || null;
-     afterValue = historyItem.after?.username || null;
+     beforeValue = historyItem.before?.username || null;
+     afterValue = historyItem.after?.username || null;
      // ✅ هذا صحيح بالفعل!
```

### 3. الأولوية (priority)
```diff
  case 'priority':
      beforeValue = historyItem.before?.priority;
-     afterValue = task.priority?.priority;
+     afterValue = historyItem.after?.priority;
      break;
```

### 4. الموعد النهائي (due_date)
```diff
  case 'due_date':
      beforeValue = historyItem.before?.due_date;
-     afterValue = task.due_date;
+     afterValue = historyItem.after?.due_date;
      break;
```

### 5. العنوان (name)
```diff
  case 'name':
-     beforeValue = historyItem.before?.name || 'غير معروف';
-     afterValue = task.name;
+     beforeValue = historyItem.before || 'غير معروف';
+     afterValue = historyItem.after || task.name;
      break;
```

---

## 🧪 كيفية التحقق

### الخطوة 1: شغّل السيرفر مع logging
```bash
pm2 restart clikup-bot
pm2 logs clikup-bot --follow
```

### الخطوة 2: غيّر حالة مهمة في ClickUp

### الخطوة 3: شوف الـ logs

**يجب أن ترى:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📥 Webhook received from ClickUp
   Content-Type: application/json
   Body type: object
   Body: {
     "event": "taskUpdated",
     "task_id": "abc123",
     "history_items": [{
       "field": "status",
       "before": {"status": "In Progress"},
       "after": {"status": "Complete"},
       "user": {"username": "محمد"}
     }]
   }
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**انسخ هذا** وأرسله لنتأكد من التنسيق!

---

## 📚 المراجع

- [ClickUp Webhooks Documentation](https://clickup.com/api/developer-portal/webhooks/)
- [ClickUp API v2 - Webhooks](https://clickup.com/api/clickupreference/operation/Getwebhooks/)

---

## 🎯 الخلاصة

### المشكلة:
- نقرأ القيم من `task` object (من API) بدلاً من `historyItem` (من webhook)
- webhook يحتوي على القيم `before` و `after` مباشرة

### الحل:
- اقرأ من `historyItem.before` و `historyItem.after`
- **لا تقرأ** من `task` object إلا إذا لم تكن القيمة موجودة في `historyItem`

### الفائدة:
- ✅ أسرع (لا حاجة لـ API call)
- ✅ أدق (البيانات من webhook مباشرة)
- ✅ أكثر موثوقية

---

**الآن شوف الـ logs وأرسل الـ webhook payload الفعلي!** 🔍
