#!/bin/bash

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║         🔧 إصلاح سريع لإشعارات إنجاز المهام                 ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

echo "🔍 الخطوة 1: التحقق من حالة النظام..."
pm2 status | grep clikup-bot > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "✅ النظام يعمل"
    echo "🔄 إعادة تشغيل النظام لتطبيق التحديثات..."
    pm2 restart clikup-bot
    echo "✅ تم إعادة التشغيل"
else
    echo "❌ النظام لا يعمل"
    echo "🚀 تشغيل النظام..."
    pm2 start index.js --name clikup-bot
    echo "✅ تم التشغيل"
fi

echo ""
echo "⏳ انتظار 5 ثوان لتهيئة النظام..."
sleep 5

echo ""
echo "🔍 الخطوة 2: التحقق من اتصال WhatsApp..."
pm2 logs clikup-bot --lines 50 --nostream | grep "WhatsApp Ready" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "✅ WhatsApp متصل"
else
    echo "⚠️ WhatsApp لم يتصل بعد"
    echo "📱 إذا لم يظهر QR Code، قد تحتاج لحذف المصادقة القديمة:"
    echo "   rm -rf .wwebjs_auth .wwebjs_cache"
    echo "   pm2 restart clikup-bot"
fi

echo ""
echo "🔍 الخطوة 3: اختبار endpoint التشخيص..."
RESPONSE=$(curl -s http://localhost:5014/debug/status-check/COMPLETE 2>/dev/null)

if [ -n "$RESPONSE" ]; then
    echo "✅ Server يعمل"
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
else
    echo "⚠️ Server لم يستجب بعد - قد يحتاج ثواني إضافية"
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    ✅ الإصلاح اكتمل                         ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "📋 الخطوات التالية:"
echo ""
echo "1️⃣ راقب السجلات:"
echo "   pm2 logs clikup-bot --follow"
echo ""
echo "2️⃣ في ClickUp، غيّر حالة أي مهمة إلى 'Complete'"
echo ""
echo "3️⃣ يجب أن ترى في السجلات:"
echo "   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   📊 Status Change Detected for task: ..."
echo "   ✅ STATUS IS COMPLETE!"
echo "   ✅ Completion notification sent successfully!"
echo "   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "4️⃣ إذا لم تعمل، شغّل التشخيص الشامل:"
echo "   ./diagnose-webhook.sh"
echo ""
