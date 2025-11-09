#!/bin/bash

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║       🔍 تشخيص شامل لمشكلة إشعارات إنجاز المهام             ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

echo "📋 الخطوة 1: التحقق من حالة النظام"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
pm2 status | grep clikup-bot
if [ $? -eq 0 ]; then
    echo "✅ النظام يعمل"
else
    echo "❌ النظام لا يعمل - يجب تشغيله أولاً!"
    echo "   تشغيل النظام: pm2 start index.js --name clikup-bot"
    exit 1
fi
echo ""

echo "📋 الخطوة 2: التحقق من اتصال WhatsApp"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
pm2 logs clikup-bot --lines 200 --nostream | grep "WhatsApp Ready"
if [ $? -eq 0 ]; then
    echo "✅ WhatsApp متصل"
else
    echo "❌ WhatsApp غير متصل - يحتاج مسح QR Code"
    echo "   راجع السجلات: pm2 logs clikup-bot --lines 50"
fi
echo ""

echo "📋 الخطوة 3: التحقق من المجموعة"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
pm2 logs clikup-bot --lines 200 --nostream | grep "Group chat found"
if [ $? -eq 0 ]; then
    echo "✅ المجموعة موجودة"
    pm2 logs clikup-bot --lines 200 --nostream | grep "Group chat found" | tail -1
else
    echo "❌ المجموعة غير موجودة"
    echo "   تأكد من وجود مجموعة باسم: Click Up notification 📢"
fi
echo ""

echo "📋 الخطوة 4: التحقق من وصول Webhooks من ClickUp"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
WEBHOOK_COUNT=$(pm2 logs clikup-bot --lines 500 --nostream | grep -c "POST /task-updated-webhook")
echo "عدد webhooks المستلمة في آخر 500 سطر: $WEBHOOK_COUNT"
if [ $WEBHOOK_COUNT -gt 0 ]; then
    echo "✅ Webhooks تصل من ClickUp"
    echo "آخر webhook:"
    pm2 logs clikup-bot --lines 500 --nostream | grep "POST /task-updated-webhook" | tail -1
else
    echo "⚠️ لا توجد webhooks في السجلات الأخيرة"
    echo "   تحقق من:"
    echo "   1. إعداد Webhook في ClickUp"
    echo "   2. URL: http://147.93.94.125:5014/task-updated-webhook"
    echo "   3. Events: تأكد من اختيار 'taskUpdated'"
fi
echo ""

echo "📋 الخطوة 5: التحقق من اكتشاف تغيير الحالة"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
STATUS_CHANGE_COUNT=$(pm2 logs clikup-bot --lines 500 --nostream | grep -c "Status Change Detected")
echo "عدد تغييرات الحالة المكتشفة: $STATUS_CHANGE_COUNT"
if [ $STATUS_CHANGE_COUNT -gt 0 ]; then
    echo "✅ النظام يكتشف تغييرات الحالة"
    echo "آخر تغيير حالة:"
    pm2 logs clikup-bot --lines 500 --nostream | grep -A 5 "Status Change Detected" | tail -6
else
    echo "⚠️ لا توجد تغييرات حالة مكتشفة"
fi
echo ""

echo "📋 الخطوة 6: التحقق من التعرف على حالة COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
COMPLETE_COUNT=$(pm2 logs clikup-bot --lines 500 --nostream | grep -c "STATUS IS COMPLETE")
echo "عدد المهام المكتملة المكتشفة: $COMPLETE_COUNT"
if [ $COMPLETE_COUNT -gt 0 ]; then
    echo "✅ النظام يتعرف على حالة COMPLETE"
    echo "آخر مهمة مكتملة:"
    pm2 logs clikup-bot --lines 500 --nostream | grep -B 3 "STATUS IS COMPLETE" | tail -4
else
    echo "⚠️ لم يتم اكتشاف مهام مكتملة"
    echo "   قد يكون السبب:"
    echo "   - لم يتم تغيير حالة مهمة إلى Complete بعد"
    echo "   - اسم الحالة في ClickUp مختلف"
fi
echo ""

echo "📋 الخطوة 7: التحقق من إرسال الإشعارات"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
NOTIFICATION_COUNT=$(pm2 logs clikup-bot --lines 500 --nostream | grep -c "Completion notification sent")
echo "عدد إشعارات الإنجاز المرسلة: $NOTIFICATION_COUNT"
if [ $NOTIFICATION_COUNT -gt 0 ]; then
    echo "✅ الإشعارات تُرسل بنجاح"
else
    echo "⚠️ لا توجد إشعارات مرسلة"
fi
echo ""

echo "📋 الخطوة 8: البحث عن أخطاء"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ERROR_COUNT=$(pm2 logs clikup-bot --lines 500 --nostream | grep -ic "error")
echo "عدد الأخطاء في آخر 500 سطر: $ERROR_COUNT"
if [ $ERROR_COUNT -gt 0 ]; then
    echo "⚠️ توجد أخطاء - آخر 3 أخطاء:"
    pm2 logs clikup-bot --lines 500 --nostream | grep -i "error" | tail -3
else
    echo "✅ لا توجد أخطاء"
fi
echo ""

echo "📋 الخطوة 9: اختبار endpoint التشخيص"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
RESPONSE=$(curl -s http://localhost:5014/debug/status-check/COMPLETE)
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    📊 ملخص التشخيص                          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# تحليل النتائج
ISSUES=0

pm2 status | grep -q clikup-bot
if [ $? -ne 0 ]; then
    echo "❌ النظام لا يعمل"
    ISSUES=$((ISSUES + 1))
fi

pm2 logs clikup-bot --lines 200 --nostream | grep -q "WhatsApp Ready"
if [ $? -ne 0 ]; then
    echo "❌ WhatsApp غير متصل"
    ISSUES=$((ISSUES + 1))
fi

if [ $WEBHOOK_COUNT -eq 0 ]; then
    echo "⚠️ لا تصل webhooks من ClickUp"
    ISSUES=$((ISSUES + 1))
fi

if [ $COMPLETE_COUNT -eq 0 ] && [ $STATUS_CHANGE_COUNT -gt 0 ]; then
    echo "⚠️ تصل webhooks لكن لا يتم التعرف على COMPLETE"
    ISSUES=$((ISSUES + 1))
fi

if [ $COMPLETE_COUNT -gt 0 ] && [ $NOTIFICATION_COUNT -eq 0 ]; then
    echo "⚠️ يتم اكتشاف COMPLETE لكن لا تُرسل إشعارات"
    ISSUES=$((ISSUES + 1))
fi

if [ $ISSUES -eq 0 ]; then
    echo ""
    echo "✅ ✅ ✅ النظام يعمل بشكل صحيح! ✅ ✅ ✅"
    echo ""
    echo "إذا لم تصلك إشعارات بعد تغيير حالة مهمة:"
    echo "1. تأكد من تغيير الحالة إلى 'Complete' بالضبط"
    echo "2. راقب السجلات مباشرة: pm2 logs clikup-bot --follow"
    echo "3. جرب تغيير حالة مهمة أخرى للاختبار"
else
    echo ""
    echo "⚠️ تم العثور على $ISSUES مشكلة/مشاكل"
    echo ""
    echo "الخطوات التالية:"
    echo "1. راجع الأخطاء أعلاه"
    echo "2. استخدم الأمر: pm2 logs clikup-bot --lines 100"
    echo "3. راجع ملف: تشخيص-حالة-المهام.md"
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  📝 لمتابعة السجلات مباشرة:                                 ║"
echo "║     pm2 logs clikup-bot --follow                             ║"
echo "║                                                              ║"
echo "║  🔄 ثم غيّر حالة مهمة في ClickUp إلى 'Complete'            ║"
echo "╚══════════════════════════════════════════════════════════════╝"
