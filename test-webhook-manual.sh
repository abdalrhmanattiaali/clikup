#!/bin/bash

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║          🧪 اختبار Webhook يدوياً                          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

SERVER_URL="http://147.93.94.125:5014"

echo "📍 Server URL: $SERVER_URL"
echo ""

# اختبار 1: محاكاة webhook من ClickUp
echo "1️⃣ إرسال webhook تجريبي (محاكاة ClickUp)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

RESPONSE=$(curl -s -X POST "$SERVER_URL/task-updated-webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "taskUpdated",
    "task_id": "test-task-123",
    "history_items": [{
      "field": "status",
      "before": {"status": "In Progress"},
      "after": {"status": "Complete"},
      "user": {"username": "Test User"}
    }]
  }')

echo "Response: $RESPONSE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# اختبار 2: التحقق من حالة COMPLETE
echo "2️⃣ التحقق من دعم حالة COMPLETE..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

COMPLETE_CHECK=$(curl -s "$SERVER_URL/debug/status-check/COMPLETE")
echo "$COMPLETE_CHECK" | python3 -m json.tool 2>/dev/null || echo "$COMPLETE_CHECK"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# اختبار 3: Dashboard stats
echo "3️⃣ التحقق من Dashboard stats..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

STATS=$(curl -s "$SERVER_URL/api/dashboard-stats")
echo "$STATS" | python3 -m json.tool 2>/dev/null || echo "$STATS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  ⚠️  ملاحظة: الاختبار اليدوي لن يرسل لـ WhatsApp           ║"
echo "║  لأن task_id تجريبي. لكن يمكنك رؤية إذا كان يستقبل          ║"
echo "║  الطلبات بشكل صحيح.                                         ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

echo "📋 الخطوات التالية:"
echo "   1. راجع السجلات على السيرفر:"
echo "      pm2 logs clikup-bot --lines 50"
echo ""
echo "   2. تأكد من إعداد Webhook في ClickUp على:"
echo "      http://147.93.94.125:5014/task-updated-webhook"
echo ""
echo "   3. تأكد من Events في ClickUp Webhook تحتوي على: taskUpdated"
