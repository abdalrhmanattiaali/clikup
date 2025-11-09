#!/bin/bash

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           🧪 اختبار Webhook Endpoints                       ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

SERVER="http://147.93.94.125:5014"

echo "📍 السيرفر: $SERVER"
echo ""

# Test 1: اختبار بسيط
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Test 1: اختبار بسيط - هل السيرفر شغّال؟"
echo "   GET /webhook-test"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$SERVER/webhook-test")
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE/d')

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ نجح! (HTTP $HTTP_CODE)"
    echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
else
    echo "❌ فشل! (HTTP $HTTP_CODE)"
    echo "$BODY"
fi
echo ""

# Test 2: معلومات webhook
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Test 2: معلومات Webhook"
echo "   GET /task-updated-webhook"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$SERVER/task-updated-webhook")
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE/d')

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ نجح! (HTTP $HTTP_CODE)"
    echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
else
    echo "❌ فشل! (HTTP $HTTP_CODE)"
    echo "$BODY"
fi
echo ""

# Test 3: اختبار POST webhook (محاكاة ClickUp)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Test 3: اختبار POST webhook (محاكاة ClickUp)"
echo "   POST /task-updated-webhook"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  هذا الاختبار يحتاج task_id حقيقي من ClickUp"
echo "   سيفشل بدون task_id صحيح، لكن يثبت أن endpoint يعمل"
echo ""

RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  -X POST "$SERVER/task-updated-webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "taskUpdated",
    "task_id": "test-12345",
    "history_items": [{
      "field": "status",
      "before": {"status": "In Progress"},
      "user": {"username": "Test User"}
    }]
  }')

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE/d')

if [ "$HTTP_CODE" = "404" ] || [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Endpoint يعمل! (HTTP $HTTP_CODE)"
    echo "   404 = طبيعي (task_id غير موجود)"
    echo "   200 = ممتاز (تم معالجة الطلب)"
else
    echo "⚠️  استجابة غير متوقعة (HTTP $HTTP_CODE)"
fi
echo "Response: $BODY"
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 الملخص"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ إذا نجح Test 1 و Test 2:"
echo "   → السيرفر شغّال و webhooks جاهزة!"
echo ""
echo "✅ إذا نجح Test 3 (200 أو 404):"
echo "   → ClickUp يقدر يرسل webhooks للسيرفر"
echo ""
echo "❌ إذا فشل Test 1:"
echo "   → السيرفر مش شغّال أو البورت مقفول"
echo "   → شغّل: pm2 start index.js --name clikup-bot"
echo ""
echo "🔧 للمزيد من التشخيص:"
echo "   ./diagnose-webhook.sh"
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  📝 إعداد ClickUp Webhook:                                  ║"
echo "║                                                              ║"
echo "║  URL: $SERVER/task-updated-webhook           ║"
echo "║  Method: POST                                                ║"
echo "║  Events: taskUpdated ✓                                       ║"
echo "╚══════════════════════════════════════════════════════════════╝"
