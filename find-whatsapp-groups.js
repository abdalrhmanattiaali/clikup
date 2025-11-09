#!/usr/bin/env node

// ====================== أداة للعثور على مجموعات WhatsApp ====================== //
// هذا السكريبت يعرض جميع مجموعات WhatsApp المتاحة لمساعدتك في العثور على الاسم الصحيح

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║       🔍 البحث عن مجموعات WhatsApp المتاحة                  ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log('');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    }
});

client.on('qr', (qr) => {
    console.log('📱 امسح QR Code للاتصال بـ WhatsApp:');
    console.log('');
    qrcode.generate(qr, { small: true });
    console.log('');
});

client.on('authenticated', () => {
    console.log('✅ تمت المصادقة بنجاح!');
});

client.on('ready', async () => {
    console.log('');
    console.log('✅ WhatsApp متصل!');
    console.log('');
    console.log('🔍 جاري البحث عن المجموعات...');
    console.log('');

    try {
        const chats = await client.getChats();
        const groups = chats.filter(chat => chat.isGroup);

        if (groups.length === 0) {
            console.log('⚠️  لم يتم العثور على أي مجموعات!');
            console.log('   تأكد من أن حسابك عضو في مجموعات WhatsApp.');
        } else {
            console.log('╔══════════════════════════════════════════════════════════════╗');
            console.log(`║  📋 تم العثور على ${groups.length} مجموعة/مجموعات:                          `);
            console.log('╚══════════════════════════════════════════════════════════════╝');
            console.log('');

            groups.forEach((group, index) => {
                console.log(`${index + 1}. اسم المجموعة: "${group.name}"`);
                console.log(`   ID: ${group.id._serialized}`);
                console.log(`   عدد الأعضاء: ${group.participants?.length || 'غير معروف'}`);
                console.log('   ─────────────────────────────────────────────────────');
            });

            console.log('');
            console.log('╔══════════════════════════════════════════════════════════════╗');
            console.log('║  📝 كيفية الاستخدام:                                        ║');
            console.log('╚══════════════════════════════════════════════════════════════╝');
            console.log('');
            console.log('1. انسخ الاسم الدقيق للمجموعة من القائمة أعلاه');
            console.log('');
            console.log('2. افتح ملف .env:');
            console.log('   nano .env');
            console.log('');
            console.log('3. عدّل السطر:');
            console.log('   WHATSAPP_GROUP_NAME=Click Up notification 📢');
            console.log('');
            console.log('   إلى (استخدم الاسم الدقيق من القائمة):');
            console.log('   WHATSAPP_GROUP_NAME=الاسم الذي نسخته');
            console.log('');
            console.log('4. احفظ واخرج (Ctrl+O, Enter, Ctrl+X)');
            console.log('');
            console.log('5. أعد تشغيل النظام:');
            console.log('   pm2 restart clikup-bot');
            console.log('');

            // البحث عن مجموعة تحتوي على "Click Up" أو "notification"
            const possibleGroups = groups.filter(g =>
                g.name.toLowerCase().includes('click') ||
                g.name.toLowerCase().includes('up') ||
                g.name.toLowerCase().includes('notification') ||
                g.name.toLowerCase().includes('إشعار') ||
                g.name.toLowerCase().includes('تنبيه')
            );

            if (possibleGroups.length > 0) {
                console.log('╔══════════════════════════════════════════════════════════════╗');
                console.log('║  💡 مجموعات محتملة:                                         ║');
                console.log('╚══════════════════════════════════════════════════════════════╝');
                console.log('');
                possibleGroups.forEach(group => {
                    console.log(`   ✅ "${group.name}"`);
                });
                console.log('');
                console.log('يبدو أن هذه المجموعات قد تكون المجموعة الصحيحة.');
                console.log('');
            }
        }

    } catch (error) {
        console.error('❌ حدث خطأ أثناء جلب المجموعات:', error.message);
    }

    console.log('');
    console.log('✅ انتهى البحث. يمكنك إغلاق البرنامج الآن (Ctrl+C)');

    // لا نغلق تلقائياً لإعطاء الوقت للقراءة
});

client.on('auth_failure', (msg) => {
    console.error('❌ فشلت المصادقة:', msg);
    process.exit(1);
});

client.on('disconnected', (reason) => {
    console.log('⚠️  تم قطع الاتصال:', reason);
});

console.log('⏳ جاري الاتصال بـ WhatsApp...');
client.initialize();
