// ========================= AI-Powered Smart Notifications ========================= //
// نظام إشعارات ذكي يستخدم Claude AI لفهم تغييرات المهام وتوليد إشعارات سياقية

require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

/**
 * توليد إشعار ذكي باستخدام AI لأي تغيير في المهمة
 * @param {Object} task - بيانات المهمة من ClickUp API
 * @param {Object} change - التغيير الذي حدث
 * @param {string} change.field - نوع التغيير (status, assignee, priority, etc)
 * @param {any} change.before - القيمة قبل التغيير
 * @param {any} change.after - القيمة بعد التغيير
 * @param {string} change.userName - اسم المستخدم الذي قام بالتغيير
 * @param {Object} parentTask - المهمة الرئيسية (إذا كانت فرعية)
 * @returns {Promise<string>} - الإشعار المولّد بواسطة AI
 */
async function generateSmartNotification(task, change, parentTask = null) {
    try {
        console.log('🤖 AI: Generating smart notification...');
        console.log('   Task:', task.name);
        console.log('   Change:', change.field);
        console.log('   By:', change.userName);

        // بناء السياق للـ AI
        const context = buildTaskContext(task, change, parentTask);

        // إرسال الطلب لـ Claude AI
        const message = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 500,
            temperature: 0.7,
            messages: [{
                role: 'user',
                content: context
            }]
        });

        const notification = message.content[0].text.trim();

        console.log('✅ AI: Notification generated');
        console.log('   Message:', notification.substring(0, 100) + '...');

        return notification;

    } catch (error) {
        console.error('❌ AI notification generation failed:', error.message);

        // fallback: إشعار بسيط بدون AI
        return generateFallbackNotification(task, change, parentTask);
    }
}

/**
 * بناء السياق للـ AI
 */
function buildTaskContext(task, change, parentTask) {
    let context = `أنت مساعد ذكي لفريق عمل يستخدم ClickUp لإدارة المهام.

مهمتك: كتابة إشعار واضح ومختصر وودود بالعربية عن التغيير التالي في مهمة.

معلومات المهمة:
- اسم المهمة: "${task.name}"
- الوصف: ${task.description || 'لا يوجد وصف'}
- المسؤولون: ${getAssigneeNames(task)}
- الأولوية: ${getPriorityText(task.priority)}
`;

    // إذا كانت مهمة فرعية
    if (parentTask) {
        context += `- مهمة فرعية من: "${parentTask.name}"\n`;
    }

    // التغيير الذي حدث
    context += `\nالتغيير الذي حدث:
- نوع التغيير: ${getChangeTypeArabic(change.field)}
- من قام بالتغيير: ${change.userName}
`;

    // تفاصيل التغيير حسب النوع
    if (change.field === 'status') {
        context += `- الحالة قبل: ${change.before}
- الحالة بعد: ${change.after}
`;
    } else if (change.field === 'assignee') {
        context += `- تم ${change.after ? 'تعيين' : 'إزالة'} المسؤول: ${change.after || change.before}
`;
    } else if (change.field === 'priority') {
        context += `- الأولوية قبل: ${getPriorityText(change.before)}
- الأولوية بعد: ${getPriorityText(change.after)}
`;
    } else if (change.field === 'due_date') {
        context += `- الموعد النهائي ${change.after ? 'تم تحديده إلى' : 'تم إزالته'}: ${change.after ? formatDate(change.after) : ''}
`;
    } else {
        context += `- قبل: ${JSON.stringify(change.before)}
- بعد: ${JSON.stringify(change.after)}
`;
    }

    context += `\nالتعليمات:
1. اكتب إشعار واحد فقط (2-4 أسطر)
2. استخدم emoji واحد مناسب في البداية فقط
3. اذكر اسم المهمة واسم الشخص
4. وضح ما حدث بشكل واضح
5. إذا كانت مهمة مكتملة، احتفل بالإنجاز
6. إذا كانت مهمة جديدة أو مهمة، شجع الفريق
7. استخدم لغة عربية بسيطة وودودة
8. لا تكتب أي نص قبل أو بعد الإشعار

مثال 1 (إنجاز مهمة):
✅ رائع! أنجز محمد مهمة "تصميم الواجهة الرئيسية"
المهمة الفرعية من: تطوير تطبيق الموبايل
أحسنت يا محمد! 🎉

مثال 2 (تغيير حالة):
🔄 حمد نقل مهمة "مراجعة الكود" إلى "قيد المراجعة"
استمروا في العمل الرائع!

مثال 3 (تعيين مهمة):
📋 تم تعيين مهمة جديدة "كتابة التوثيق" لـ سارة
الموعد النهائي: خلال 3 أيام

الآن اكتب الإشعار:`;

    return context;
}

/**
 * الحصول على أسماء المسؤولين
 */
function getAssigneeNames(task) {
    if (!task.assignees || task.assignees.length === 0) {
        return 'لا يوجد مسؤول';
    }
    return task.assignees.map(a => a.username).join('، ');
}

/**
 * تحويل الأولوية إلى نص عربي
 */
function getPriorityText(priority) {
    if (!priority) return 'عادية';

    const priorities = {
        1: 'عاجلة جداً 🔴',
        2: 'عاجلة 🟠',
        3: 'عادية 🟡',
        4: 'منخفضة 🟢'
    };

    return priorities[priority?.priority || priority] || 'عادية';
}

/**
 * تحويل نوع التغيير إلى عربي
 */
function getChangeTypeArabic(field) {
    const types = {
        'status': 'تغيير الحالة',
        'assignee': 'تعيين/إزالة مسؤول',
        'priority': 'تغيير الأولوية',
        'due_date': 'تغيير الموعد النهائي',
        'description': 'تعديل الوصف',
        'name': 'تغيير العنوان',
        'time_estimate': 'تقدير الوقت',
        'tag': 'الوسوم'
    };

    return types[field] || field;
}

/**
 * تنسيق التاريخ
 */
function formatDate(timestamp) {
    if (!timestamp) return '';

    const date = new Date(parseInt(timestamp));
    const now = new Date();
    const diffDays = Math.floor((date - now) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'اليوم';
    if (diffDays === 1) return 'غداً';
    if (diffDays === -1) return 'أمس';
    if (diffDays > 0) return `خلال ${diffDays} يوم`;
    if (diffDays < 0) return `قبل ${Math.abs(diffDays)} يوم`;

    return date.toLocaleDateString('ar-EG');
}

/**
 * إشعار احتياطي بدون AI (في حالة فشل AI)
 */
function generateFallbackNotification(task, change, parentTask) {
    let notification = '';

    if (change.field === 'status') {
        const isComplete = ['complete', 'completed', 'done', 'finished'].includes(
            change.after.toLowerCase()
        );

        if (isComplete) {
            notification = `✅ رائع! أنجز ${change.userName} مهمة "${task.name}"`;
            if (parentTask) {
                notification += `\nالمهمة الفرعية من: ${parentTask.name}`;
            }
            notification += `\nأحسنت! 🎉`;
        } else {
            notification = `🔄 ${change.userName} نقل مهمة "${task.name}" إلى "${change.after}"`;
        }
    } else if (change.field === 'assignee') {
        if (change.after) {
            notification = `📋 تم تعيين مهمة "${task.name}" لـ ${change.after}`;
        } else {
            notification = `📋 تمت إزالة ${change.before} من مهمة "${task.name}"`;
        }
    } else if (change.field === 'priority') {
        notification = `⚡ ${change.userName} غيّر أولوية مهمة "${task.name}" إلى ${getPriorityText(change.after)}`;
    } else {
        notification = `🔔 ${change.userName} قام بتحديث مهمة "${task.name}"`;
    }

    return notification;
}

/**
 * إشعار خاص بإنجاز المهام (للتوافق مع النظام القديم)
 */
async function generateCompletionNotification(task, userName, parentTask = null) {
    const change = {
        field: 'status',
        before: 'In Progress',
        after: 'Complete',
        userName: userName
    };

    return await generateSmartNotification(task, change, parentTask);
}

/**
 * إشعار خاص بتعيين مهمة جديدة
 */
async function generateAssignmentNotification(task, assignee, assigner, parentTask = null) {
    const change = {
        field: 'assignee',
        before: null,
        after: assignee,
        userName: assigner
    };

    return await generateSmartNotification(task, change, parentTask);
}

module.exports = {
    generateSmartNotification,
    generateCompletionNotification,
    generateAssignmentNotification
};
