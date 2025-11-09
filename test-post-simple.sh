#!/bin/bash

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║         🧪 اختبار POST بسيط للـ webhook                     ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# يمكنك تغيير الـ SERVER هنا
SERVER="${1:-http://147.93.94.125:5014}"

echo "📍 السيرفر: $SERVER"
echo ""

# اختبار 1: POST بسيط جداً
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Test 1: POST request بسيط"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔄 جاري الإرسال..."
echo ""

# عرض الـ request
echo "📤 Request:"
echo "POST $SERVER/task-updated-webhook"
echo "Content-Type: application/json"
echo ""
echo "Body:"
cat << 'EOF'
{
  "task_id": "test-123",
  "history_items": [{
    "field": "status",
    "before": {"status": "In Progress"},
    "user": {"username": "Test User"}
  }]
}
EOF
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# إرسال الـ request
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}\nTIME:%{time_total}" \
  -X POST "$SERVER/task-updated-webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "test-123",
    "history_items": [{
      "field": "status",
      "before": {"status": "In Progress"},
      "user": {"username": "Test User"}
    }]
  }')

# استخراج المعلومات
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
TIME=$(echo "$RESPONSE" | grep "TIME" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE/d' | sed '/TIME/d')

# عرض النتيجة
echo "📥 Response:"
echo "   HTTP Code: $HTTP_CODE"
echo "   Time: ${TIME}s"
echo "   Body: $BODY"
echo ""

# تحليل النتيجة
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ ✅ ✅ نجح! ✅ ✅ ✅"
    echo ""
    echo "السيرفر استقبل الـ request ومعالجها بنجاح!"
    echo ""
elif [ "$HTTP_CODE" = "404" ]; then
    echo "✅ Endpoint يعمل! (404 = Task not found)"
    echo ""
    echo "هذا طبيعي لأن task_id 'test-123' مش موجود في ClickUp"
    echo "لكن معناه الـ webhook endpoint شغّال ويقبل POST requests ✓"
    echo ""
elif [ "$HTTP_CODE" = "500" ]; then
    echo "⚠️  السيرفر استجاب لكن حصل خطأ داخلي"
    echo ""
    echo "شوف السجلات للتفاصيل:"
    echo "   pm2 logs clikup-bot --lines 30"
    echo ""
elif [ -z "$HTTP_CODE" ]; then
    echo "❌ مافيش استجابة من السيرفر!"
    echo ""
    echo "🔧 الأسباب المحتملة:"
    echo "   1. السيرفر مش شغّال"
    echo "   2. البورت مقفول"
    echo "   3. الـ IP غير صحيح"
    echo "   4. مشكلة في الشبكة"
    echo ""
    echo "جرّب:"
    echo "   1. تحقق من حالة السيرفر: pm2 status"
    echo "   2. شغّل السيرفر: pm2 start index.js --name clikup-bot"
    echo "   3. اختبر من localhost: $0 http://localhost:5014"
    echo ""
else
    echo "⚠️  استجابة غير متوقعة: HTTP $HTTP_CODE"
    echo ""
    echo "Response body:"
    echo "$BODY"
    echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# اختبار إضافي: GET /webhook-test
echo "🧪 Test 2: اختبار GET /webhook-test (للتأكد)"
echo ""

GET_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$SERVER/webhook-test")

if [ "$GET_CODE" = "200" ]; then
    echo "✅ GET endpoint شغّال (HTTP $GET_CODE)"
    echo ""
    echo "يمكنك فتح المتصفح على:"
    echo "   $SERVER/webhook-test"
    echo ""
else
    echo "❌ GET endpoint مش شغّال (HTTP $GET_CODE)"
    echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 نصائح:"
echo ""
echo "1. إذا نجح Test 1 (200 أو 404):"
echo "   ✅ الـ webhook endpoint شغّال ويمكن لـ ClickUp إرسال webhooks"
echo ""
echo "2. إذا فشل Test 1:"
echo "   ❌ شغّل التشخيص الشامل: ./diagnose-post-webhook.sh"
echo ""
echo "3. لاختبار من localhost:"
echo "   ./test-post-simple.sh http://localhost:5014"
echo ""
echo "4. لمراقبة السجلات أثناء الاختبار:"
echo "   pm2 logs clikup-bot --follow"
echo ""
