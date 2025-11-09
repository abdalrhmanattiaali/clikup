#!/bin/bash

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║       🔍 تشخيص مشكلة POST Webhook                           ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

SERVER="http://147.93.94.125:5014"

# الخطوة 1: تحقق من حالة السيرفر
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 الخطوة 1: هل السيرفر شغّال؟"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

pm2 status | grep clikup-bot > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ السيرفر شغّال في pm2"
    pm2 status | grep clikup-bot
else
    echo "❌ السيرفر مش شغّال في pm2!"
    echo ""
    echo "🔧 الحل: شغّل السيرفر"
    echo "   pm2 start index.js --name clikup-bot"
    echo ""
    exit 1
fi
echo ""

# الخطوة 2: تحقق من البورت
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 الخطوة 2: هل البورت 5014 مفتوح؟"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

netstat -tuln | grep 5014 > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ البورت 5014 مفتوح ويستمع"
    netstat -tuln | grep 5014
else
    echo "⚠️  البورت 5014 مش ظاهر في netstat"
    echo "   قد يكون الـ listening على 0.0.0.0 فقط"
fi
echo ""

# الخطوة 3: اختبار GET بسيط
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 الخطوة 3: اختبار GET /webhook-test"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$SERVER/webhook-test")

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ GET endpoint شغّال (HTTP $HTTP_CODE)"
    echo ""
    echo "Response:"
    curl -s "$SERVER/webhook-test" | python3 -m json.tool 2>/dev/null
else
    echo "❌ GET endpoint مش شغّال (HTTP $HTTP_CODE)"
    echo ""
    echo "🔧 الحل المحتمل:"
    echo "   1. السيرفر مش شغّال بشكل صحيح"
    echo "   2. البورت مقفول من الـ firewall"
    echo "   3. الـ IP غير صحيح"
    echo ""
    echo "جرّب:"
    echo "   pm2 restart clikup-bot"
    echo "   pm2 logs clikup-bot --lines 20"
    echo ""
    exit 1
fi
echo ""

# الخطوة 4: اختبار POST على localhost
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 الخطوة 4: اختبار POST على localhost"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  -X POST "http://localhost:5014/task-updated-webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "test-123",
    "history_items": [{
      "field": "status",
      "before": {"status": "In Progress"},
      "user": {"username": "Test User"}
    }]
  }')

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE/d')

echo "HTTP Code: $HTTP_CODE"
echo "Response: $BODY"
echo ""

if [ "$HTTP_CODE" = "404" ]; then
    echo "✅ Endpoint يستجيب! (404 = task not found, وهذا طبيعي)"
    echo "   معناه الـ webhook endpoint شغّال ويقبل POST requests"
elif [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Endpoint يستجيب ويعالج الطلب! (200 = success)"
elif [ "$HTTP_CODE" = "500" ]; then
    echo "⚠️  Endpoint يستجيب لكن حصل خطأ داخلي (500)"
    echo "   شوف السجلات: pm2 logs clikup-bot --lines 20"
else
    echo "❌ استجابة غير متوقعة: HTTP $HTTP_CODE"
fi
echo ""

# الخطوة 5: اختبار POST على الـ IP الخارجي
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 الخطوة 5: اختبار POST على IP الخارجي"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  -X POST "$SERVER/task-updated-webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "test-456",
    "history_items": [{
      "field": "status",
      "before": {"status": "In Progress"},
      "user": {"username": "External Test"}
    }]
  }')

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE/d')

echo "HTTP Code: $HTTP_CODE"
echo "Response: $BODY"
echo ""

if [ "$HTTP_CODE" = "404" ] || [ "$HTTP_CODE" = "200" ]; then
    echo "✅ POST من الخارج يشتغل!"
elif [ -z "$HTTP_CODE" ]; then
    echo "❌ مافيش استجابة! المشكلة محتملة:"
    echo "   1. Firewall بيمنع الاتصال"
    echo "   2. السيرفر مش listening على 0.0.0.0"
    echo "   3. الـ IP غير صحيح"
else
    echo "⚠️  HTTP $HTTP_CODE"
fi
echo ""

# الخطوة 6: فحص السجلات
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 الخطوة 6: آخر 10 أسطر من السجلات"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
pm2 logs clikup-bot --lines 10 --nostream
echo ""

# الخطوة 7: فحص هل وصلت webhooks من ClickUp
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 الخطوة 7: هل وصلت webhooks من ClickUp؟"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

WEBHOOK_COUNT=$(pm2 logs clikup-bot --lines 200 --nostream | grep -c "POST /task-updated-webhook")
echo "عدد webhooks في آخر 200 سطر: $WEBHOOK_COUNT"

if [ $WEBHOOK_COUNT -gt 0 ]; then
    echo "✅ webhooks وصلت من ClickUp!"
    echo ""
    echo "آخر webhook:"
    pm2 logs clikup-bot --lines 200 --nostream | grep "POST /task-updated-webhook" | tail -1
else
    echo "⚠️  مافيش webhooks من ClickUp في السجلات"
    echo ""
    echo "🔧 تحقق من:"
    echo "   1. Webhook مُعد في ClickUp؟"
    echo "   2. URL صحيح: $SERVER/task-updated-webhook"
    echo "   3. Events تحتوي على 'taskUpdated'؟"
    echo "   4. Status = Active؟"
fi
echo ""

# ملخص
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    📊 الملخص                                ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# تحديد المشكلة
if pm2 status | grep -q clikup-bot && [ "$HTTP_CODE" = "404" ] || [ "$HTTP_CODE" = "200" ]; then
    echo "✅ ✅ ✅ كل شيء يعمل بشكل صحيح! ✅ ✅ ✅"
    echo ""
    echo "السيرفر شغّال والـ webhook endpoint يستقبل POST requests"
    echo ""
    echo "🎯 الخطوة التالية:"
    echo "   1. تأكد من إعداد Webhook في ClickUp"
    echo "   2. غيّر حالة مهمة للاختبار"
    echo "   3. راقب السجلات: pm2 logs clikup-bot --follow"
    echo ""
elif ! pm2 status | grep -q clikup-bot; then
    echo "❌ المشكلة: السيرفر مش شغّال"
    echo ""
    echo "🔧 الحل:"
    echo "   pm2 start index.js --name clikup-bot"
    echo ""
elif [ -z "$HTTP_CODE" ]; then
    echo "❌ المشكلة: مافيش استجابة من السيرفر"
    echo ""
    echo "🔧 الأسباب المحتملة:"
    echo "   1. Firewall بيمنع البورت 5014"
    echo "   2. السيرفر مش listening على الـ IP الصحيح"
    echo "   3. مشكلة في الشبكة"
    echo ""
    echo "جرّب:"
    echo "   sudo ufw allow 5014"
    echo "   pm2 restart clikup-bot"
    echo ""
else
    echo "⚠️  فيه مشكلة في الاستجابة"
    echo ""
    echo "شوف السجلات للتفاصيل:"
    echo "   pm2 logs clikup-bot --lines 50"
    echo ""
fi

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  📝 معلومات مفيدة:                                          ║"
echo "║                                                              ║"
echo "║  URL للاختبار من المتصفح:                                   ║"
echo "║  http://147.93.94.125:5014/webhook-test                      ║"
echo "║                                                              ║"
echo "║  URL للـ ClickUp webhook:                                    ║"
echo "║  http://147.93.94.125:5014/task-updated-webhook              ║"
echo "║                                                              ║"
echo "║  مراقبة السجلات:                                            ║"
echo "║  pm2 logs clikup-bot --follow                                ║"
echo "╚══════════════════════════════════════════════════════════════╝"
