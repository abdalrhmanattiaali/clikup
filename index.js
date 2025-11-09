// ========================= Load Environment Variables ========================= //
require('dotenv').config();

const express = require('express');
const axios = require('axios');
const cron = require('node-cron');
const fs = require('fs').promises;
const path = require('path');
const { initializeWhatsApp, sendMessage, getClient } = require('./src/whatsapp');
const { initializeScheduler } = require('./src/scheduler');
const TEAM = require('./src/team');
const { generateSmartNotification, generateCompletionNotification } = require('./ai-notifications');

const app = express();
const PORT = process.env.PORT || 5014;

axios.defaults.timeout = 60000;

app.use(express.raw({ type: 'application/json' }));

initializeWhatsApp();
initializeScheduler();
const client = getClient();

const CLICKUP_TOKEN = process.env.CLICKUP_TOKEN || 'pk_62585187_VZCCTKCU9501T8G8KJHVGT9FSXPVTU11';
const CLICKUP_TEAM_ID = process.env.CLICKUP_TEAM_ID || '9015343430';
const SAMPLE_LIST_ID = process.env.CLICKUP_LIST_ID || '901515500888';

// ========================= حالات المهام المكتملة ========================= //
// ملاحظة مهمة: ClickUp يرسل الحالات بحروف كبيرة (مثل: COMPLETE)
// لكن الكود يحولها تلقائياً لحروف صغيرة قبل المقارنة (.toLowerCase())
// لذلك نضيف الحالات بحروف صغيرة فقط في هذه القائمة

const NON_OPEN_STATUSES = [
    // الحالة الأساسية من ClickUp
    'complete',              // ← الحالة الرئيسية - COMPLETE → complete

    // حالات إضافية شائعة
    'completed',
    'complete & not invoiced',
    'closed',
    'canceled',
    'cancelled',
    'done',
    'finished',

    // حالات عربية
    'مكتمل',
    'منتهي',
    'مغلق',
    'ملغي'
];

// طباعة الحالات المدعومة عند بدء التشغيل
console.log('✅ Supported completion statuses:', NON_OPEN_STATUSES.length, 'statuses');
console.log('   Including: complete, completed, done, finished, closed, etc.');

const PROMPTS_FILE = path.join(__dirname, 'prompts.txt');
const MEMORY_FILE = path.join(__dirname, 'memory.log');
const INSPIRATION_LOG_FILE = path.join(__dirname, 'inspiration_log.txt');
const PRODUCTIVITY_DATA_FILE = path.join(__dirname, 'productivity_data.json');

let GROUP_CHAT_ID = null;

// ========================= Notification Pausing System ========================= //
let notificationsPaused = false;
let notificationPauseTimeout = null;

function pauseNotifications(duration = 600000) {
    console.log(`Pausing notifications for ${duration / 60000} minutes.`);
    notificationsPaused = true;
    if (notificationPauseTimeout) {
        clearTimeout(notificationPauseTimeout);
    }
    notificationPauseTimeout = setTimeout(() => {
        notificationsPaused = false;
        console.log('Notifications resumed. Processing any backlogged queue items.');
        if (notificationQueue.length > 0) {
            processAndSendBatchNotifications();
        }
    }, duration);
}

// ========================= Notification Batching System ========================= //
let notificationQueue = [];
let queueProcessingTimeout = null;
const NOTIFICATION_BATCH_DELAY = 60000;
const sentDirectNotifications = new Set();

async function shortenUrl(longUrl) {
    if (!longUrl) return '';
    try {
        const response = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`);
        return response.data;
    } catch (error) {
        console.error('Error shortening URL:', error.message);
        return longUrl;
    }
}

async function processAndSendBatchNotifications() {
    try {
        if (notificationsPaused) {
            console.log('Queue processing deferred: Notifications are currently paused.');
            clearTimeout(queueProcessingTimeout);
            queueProcessingTimeout = null;
            return;
        }

        if (notificationQueue.length === 0) {
            queueProcessingTimeout = null;
            return;
        }

        console.log(`Processing ${notificationQueue.length} notifications from queue.`);
        const batch = [...notificationQueue];
        notificationQueue = [];

        const userActivity = {};
        const ensureUserActivity = (userName) => {
            if (!userActivity[userName]) {
                userActivity[userName] = {
                    task_completed: [],
                    task_assigned: [],
                    status_changed: [],
                    comment_added: []
                };
            }
        };

        batch.forEach(item => {
            const assignees = (item.data.assignees || '').split('، ').map(name => name.replace('@', '').trim()).filter(Boolean);
            const mainAssignee = assignees.length > 0 ? assignees[0] : (item.data.updaterName || item.data.commenterName || 'General');
            ensureUserActivity(mainAssignee);

            switch (item.type) {
                case 'task_completed':
                    userActivity[mainAssignee].task_completed.push(item);
                    break;
                case 'task_created':
                case 'assignee_changed':
                    userActivity[mainAssignee].task_assigned.push(item);
                    break;
                case 'status_changed':
                    userActivity[item.data.updaterName || 'General'].status_changed.push(item);
                    break;
                case 'comment_added':
                    userActivity[item.data.commenterName || 'General'].comment_added.push(item);
                    break;
            }
        });

        let summaryMessage = '📢 *ملخص التحديثات الأخيرة:*\n';
        let hasContent = false;

        for (const userName of Object.keys(userActivity)) {
            const activity = userActivity[userName];
            let userBlock = '';

            const groupTasksByParent = async (tasks) => {
                const grouped = new Map();
                for (const item of tasks) {
                    const parentId = item.task.parent || 'independent';
                    if (!grouped.has(parentId)) {
                        grouped.set(parentId, { parentTask: null, children: [] });
                    }
                    grouped.get(parentId).children.push(item);
                }
                for (const [parentId, group] of grouped.entries()) {
                    if (parentId !== 'independent') {
                        group.parentTask = await getTaskDetails(parentId);
                    }
                }
                return grouped;
            };

            const assignedGroups = await groupTasksByParent([...activity.task_assigned]);
            const completedGroups = await groupTasksByParent([...activity.task_completed]);
            let assignedContent = '';
            let completedContent = '';

            for (const [parentId, group] of assignedGroups.entries()) {
                if (parentId === 'independent') {
                    for (const item of group.children) {
                        const shortUrl = await shortenUrl(`https://app.clickup.com/t/${item.task.id}`);
                        assignedContent += `- ${item.task.name} 🔗 ${shortUrl}\n`;
                    }
                } else {
                    assignedContent += `\n  *في المهمة: ${group.parentTask?.name || 'مهمة رئيسية'}*\n`;
                    for (const item of group.children) {
                        const shortUrl = await shortenUrl(`https://app.clickup.com/t/${item.task.id}`);
                        assignedContent += `  - ${item.task.name} 🔗 ${shortUrl}\n`;
                    }
                }
            }
            if (assignedContent) {
                hasContent = true;
                userBlock += `\n✅ *تم إسناد ${activity.task_assigned.length} ${activity.task_assigned.length > 1 ? 'مهام' : 'مهمة'} إلى ${userName}:*\n${assignedContent}`;
            }

            // ✨ IMPROVED: Better completion notifications without links (no preview)
            for (const [parentId, group] of completedGroups.entries()) {
                if (parentId === 'independent') {
                    for (const item of group.children) {
                        const completedBy = item.data.updaterName ? ` ✓ بواسطة: ${item.data.updaterName}` : '';
                        completedContent += `- ${item.task.name}${completedBy}\n`;
                    }
                } else {
                    const parentName = group.parentTask?.name || 'مهمة رئيسية';
                    completedContent += `\n  *تابعة للمهمة: ${parentName}*\n`;
                    for (const item of group.children) {
                        const completedBy = item.data.updaterName ? ` ✓ بواسطة: ${item.data.updaterName}` : '';
                        completedContent += `    ◦ ${item.task.name}${completedBy}\n`;
                    }
                }
            }
            if (completedContent) {
                hasContent = true;
                userBlock += `\n🏆 *${userName} أنجز ${activity.task_completed.length} ${activity.task_completed.length > 1 ? 'مهام' : 'مهمة'}:*\n${completedContent}`;
            }

            if (activity.status_changed.length > 0 || activity.comment_added.length > 0) hasContent = true;
            for (const item of activity.status_changed) {
                userBlock += `\n📊 *${item.task.name}*: ${item.data.before} ⬅️ ${item.data.after}\n`;
            }
            for (const item of activity.comment_added) {
                userBlock += `\n💬 تعليق على *${item.task.name}*: "${item.data.commentText.substring(0, 50)}..."\n`;
            }

            if (userBlock) {
                summaryMessage += `\n-------------------\n${userBlock}`;
            }
        }

        if (hasContent && GROUP_CHAT_ID) {
            await cleanAndSendMessage(GROUP_CHAT_ID, summaryMessage);
        }

        clearTimeout(queueProcessingTimeout);
        queueProcessingTimeout = null;
        console.log('Notification batch sent and timer cleared.');
    } catch (error) {
        console.error("CRITICAL ERROR in processAndSendBatchNotifications:", error);
        if (queueProcessingTimeout) {
            clearTimeout(queueProcessingTimeout);
            queueProcessingTimeout = null;
        }
    }
}

function addNotificationToQueue(notification) {
    notificationQueue.push(notification);
    console.log(`Notification added to queue. Queue size: ${notificationQueue.length}`);

    if (queueProcessingTimeout || notificationsPaused) {
        return;
    }

    console.log(`Starting notification batch timer (${NOTIFICATION_BATCH_DELAY / 1000}s)`);
    queueProcessingTimeout = setTimeout(processAndSendBatchNotifications, NOTIFICATION_BATCH_DELAY);
}

async function sendDirectAssignmentNotification(task) {
    if (!task || !task.assignees || task.assignees.length === 0) return;

    for (const u of task.assignees) {
        const tm = TEAM.find(m => m.email === u.email || m.id === u.id);
        if (tm && tm.phone) {
            const chatId = `${tm.phone}@c.us`;
            const directKey = `assign-${task.id}-${tm.id}`;

            if (sentDirectNotifications.has(directKey)) continue;
            sentDirectNotifications.add(directKey);
            setTimeout(() => sentDirectNotifications.delete(directKey), 60000);

            let parentInfo = '';
            if (task.parent) {
                const parentTask = await getTaskDetails(task.parent);
                parentInfo = `\n(تابعة لـ: ${parentTask?.name || 'مهمة رئيسية'})`;
            }
            const taskUrl = `https://app.clickup.com/t/${task.id}`;
            const shortUrl = await shortenUrl(taskUrl);
            const directMsg = `👋 @${tm.name}، تم إسناد مهمة جديدة إليك:\n📝 *${task.name}*${parentInfo}\n🔗 ${shortUrl}`;

            await cleanAndSendMessage(chatId, directMsg);
        }
    }
}

async function createTaskCompletionNotification(task, updaterName) {
    if (!task) {
        console.log("Cannot create completion notification: task is null");
        return;
    }
    console.log(`✅ Creating completion notification for task: "${task.name}" (ID: ${task.id}), completed by ${updaterName}`);

    // Save completion data for analytics
    await saveProductivityData({
        type: 'task_completed',
        taskId: task.id,
        taskName: task.name,
        userId: updaterName,
        timestamp: Date.now(),
        isSubtask: !!task.parent,
        parentId: task.parent || null
    });

    addNotificationToQueue({
        type: 'task_completed',
        task: task,
        data: {
            updaterName: updaterName,
            assignees: getAssigneeTags(task)
        }
    });
}

// ========================= AI Smart Notifications ========================= //
/**
 * إنشاء إشعار ذكي باستخدام AI لأي تغيير في المهمة
 * @param {Object} task - بيانات المهمة
 * @param {Object} change - معلومات التغيير
 * @param {string} change.field - نوع التغيير
 * @param {any} change.before - القيمة قبل التغيير
 * @param {any} change.after - القيمة بعد التغيير
 * @param {string} change.userName - اسم المستخدم
 */
async function createAISmartNotification(task, change) {
    if (!task) {
        console.log("Cannot create AI notification: task is null");
        return;
    }

    console.log(`🤖 Creating AI-powered notification for task: "${task.name}"`);
    console.log(`   Change type: ${change.field}`);
    console.log(`   Changed by: ${change.userName}`);

    try {
        // جلب المهمة الرئيسية إذا كانت فرعية
        let parentTask = null;
        if (task.parent) {
            try {
                parentTask = await getTaskDetails(task.parent);
            } catch (error) {
                console.log('Could not fetch parent task:', error.message);
            }
        }

        // توليد الإشعار باستخدام AI
        const aiNotification = await generateSmartNotification(task, change, parentTask);

        // حفظ البيانات للإحصائيات
        await saveProductivityData({
            type: `task_${change.field}_changed`,
            taskId: task.id,
            taskName: task.name,
            userId: change.userName,
            timestamp: Date.now(),
            field: change.field,
            before: change.before,
            after: change.after
        });

        // إرسال الإشعار مباشرة (لا نضيفه للqueue للحصول على رد فوري)
        if (GROUP_CHAT_ID) {
            await cleanAndSendMessage(GROUP_CHAT_ID, aiNotification);
            console.log('✅ AI notification sent successfully');
        } else {
            console.warn('⚠️  GROUP_CHAT_ID not set, notification not sent');
        }

    } catch (error) {
        console.error('❌ AI notification failed:', error.message);

        // fallback: إضافة إلى queue بدون AI
        addNotificationToQueue({
            type: `${change.field}_changed`,
            task: task,
            data: {
                updaterName: change.userName,
                before: change.before,
                after: change.after,
                assignees: getAssigneeTags(task)
            }
        });
    }
}

// ========================= Productivity Analytics System ========================= //
async function saveProductivityData(data) {
    try {
        let productivityData = [];
        try {
            const existingData = await fs.readFile(PRODUCTIVITY_DATA_FILE, 'utf-8');
            productivityData = JSON.parse(existingData);
        } catch (error) {
            console.log('Creating new productivity data file.');
        }

        productivityData.push(data);

        // ✅ Keep all data forever - no deletion
        // Removed 90-day limit to preserve all productivity history

        await fs.writeFile(PRODUCTIVITY_DATA_FILE, JSON.stringify(productivityData, null, 2));
    } catch (error) {
        console.error('Error saving productivity data:', error.message);
    }
}

async function getProductivityAnalytics(userId = null, days = 7) {
    try {
        const data = await fs.readFile(PRODUCTIVITY_DATA_FILE, 'utf-8');
        let productivityData = JSON.parse(data);

        const cutoffDate = Date.now() - (days * 24 * 60 * 60 * 1000);
        productivityData = productivityData.filter(d => d.timestamp > cutoffDate);

        if (userId) {
            productivityData = productivityData.filter(d => d.userId === userId);
        }

        // Analyze by day of week
        const dayStats = {};
        const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

        productivityData.forEach(item => {
            const date = new Date(item.timestamp);
            const dayName = dayNames[date.getDay()];

            if (!dayStats[dayName]) {
                dayStats[dayName] = { count: 0, tasks: [] };
            }
            dayStats[dayName].count++;
            dayStats[dayName].tasks.push(item.taskName);
        });

        // Find most productive day
        let mostProductiveDay = null;
        let maxTasks = 0;
        Object.entries(dayStats).forEach(([day, stats]) => {
            if (stats.count > maxTasks) {
                maxTasks = stats.count;
                mostProductiveDay = day;
            }
        });

        return {
            totalCompleted: productivityData.length,
            dayStats,
            mostProductiveDay,
            mostProductiveDayCount: maxTasks,
            recentTasks: productivityData.slice(-10).reverse()
        };
    } catch (error) {
        console.error('Error reading productivity data:', error.message);
        return null;
    }
}

// ========================= Claude API Integration ========================= //
const CLAUDE_API_KEY = "sk-ant-api03-YOUR-API-KEY-HERE"; // ⚠️ Replace with your Claude API key

async function claudeCompose(style, payload, userStats = null) {
    try {
        let systemPrompt = `أنت مساعد تحفيزي احترافي ومبدع للفرق العربية. مهمتك إنشاء رسائل تحفيزية شخصية وإنسانية تلهم الفريق وتحتفي بإنجازاتهم.

خصائصك:
- تكتب بأسلوب دافئ وشخصي وإنساني
- تستخدم العربية الفصحى الجميلة
- تحلل الأنماط وتقدم رؤى ذكية
- تربط الإنجازات بالسياق والأهداف
- تستخدم إيموجي بذكاء وبساطة
- رسائلك قصيرة ومؤثرة (2-4 جمل)`;

        let userMessage = `النوع: ${style}\nالبيانات:\n${payload}`;

        if (userStats) {
            const { mostProductiveDay, mostProductiveDayCount, totalCompleted, recentTasks } = userStats;
            userMessage += `\n\nتحليل الإنتاجية:\n`;
            userMessage += `- إجمالي المهام المنجزة (آخر 7 أيام): ${totalCompleted}\n`;
            if (mostProductiveDay) {
                userMessage += `- اليوم الأكثر إنتاجية: ${mostProductiveDay} (${mostProductiveDayCount} مهمة)\n`;
            }
            if (recentTasks && recentTasks.length > 0) {
                userMessage += `- آخر الإنجازات: ${recentTasks.slice(0, 3).map(t => t.taskName).join('، ')}\n`;
            }
        }

        userMessage += `\n\nاكتب رسالة تحفيزية شخصية ومؤثرة تناسب هذا السياق.`;

        const response = await axios.post(
            'https://api.anthropic.com/v1/messages',
            {
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 1024,
                messages: [
                    { role: 'user', content: userMessage }
                ],
                system: systemPrompt
            },
            {
                headers: {
                    'x-api-key': CLAUDE_API_KEY,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json'
                }
            }
        );

        return response.data?.content?.[0]?.text?.trim() || '💪 عمل رائع! استمر في التقدم!';
    } catch (error) {
        console.error('Claude API Error:', error.response?.data || error.message);
        return '💪 عمل رائع! استمر في التقدم!';
    }
}

// ========================= Helper Utils ========================= //
function chunkMessage(text, maxLen = 3000) {
    const chunks = [];
    let i = 0;
    while (i < text.length) {
        chunks.push(text.slice(i, i + maxLen));
        i += maxLen;
    }
    return chunks;
}

async function cleanAndSendMessage(chatId, text, opts = {}) {
    if (!text || !chatId) return;

    const shouldPin = opts.pin && chatId === GROUP_CHAT_ID;
    if (opts.pin) delete opts.pin;

    const messageOptions = { linkPreview: false, ...opts };

    const chunks = chunkMessage(text, 3000);
    for (let i = 0; i < chunks.length; i++) {
        const part = chunks[i];
        try {
            const sentMessage = await sendMessage(chatId, part, messageOptions);
            if (i === 0 && shouldPin && sentMessage && typeof sentMessage.pin === 'function') {
                await sentMessage.pin();
                console.log(`📌 Message pinned successfully.`);
            }
        } catch (err) {
            console.error(`❌ Failed to send message to ${chatId}:`, err.message);
        }
    }
}

function isToday(ts) {
    const d = new Date(Number(ts));
    const t = new Date();
    return d.toDateString() === t.toDateString();
}

const getPriorityDisplay = (priority) => {
    if (!priority || !priority.priority) return 'غير محدد';
    switch (priority.priority.toLowerCase()) {
        case 'urgent': return 'عاجل';
        case 'high': return 'مرتفع';
        case 'normal': return 'عادي';
        case 'low': return 'منخفض';
        default: return priority.priority;
    }
};

// ========================= ClickUp API ========================= //
async function getTaskDetails(taskId) {
    if (!taskId) return null;
    try {
        const response = await axios.get(
            `https://api.clickup.com/api/v2/task/${taskId}?custom_task_ids=true&team_id=${CLICKUP_TEAM_ID}`,
            { headers: { Authorization: CLICKUP_TOKEN } }
        );
        return response.data;
    } catch (error) {
        console.error(`Failed to get details for task ${taskId}:`, error.message);
        return null;
    }
}

async function getTaskComments(taskId) {
    try {
        const response = await axios.get(
            `https://api.clickup.com/api/v2/task/${taskId}/comment`,
            { headers: { Authorization: CLICKUP_TOKEN } }
        );
        return response.data.comments || [];
    } catch (error) {
        console.error(`Failed to get comments for task ${taskId}:`, error.message);
        return [];
    }
}

async function getUserTasks(userId) {
    try {
        let allTasks = [];
        let page = 0;
        let hasMore = true;

        while (hasMore) {
            const response = await axios.get(
                `https://api.clickup.com/api/v2/team/${CLICKUP_TEAM_ID}/task`, {
                params: {
                    'assignees[]': userId,
                    'include_closed': true,
                    'subtasks': true,
                    'page': page
                },
                headers: { Authorization: CLICKUP_TOKEN }
            }
            );
            const tasks = response.data.tasks || [];
            if (tasks.length > 0) {
                allTasks = allTasks.concat(tasks);
                page++;
            } else {
                hasMore = false;
            }
        }
        return allTasks;
    } catch (err) {
        console.error(`❌ Failed to get tasks for user ${userId}:`, err.message);
        return [];
    }
}

async function getOpenUserTasks(userId) {
    try {
        let allTasks = [];
        let page = 0;
        let hasMore = true;

        while (hasMore) {
            const response = await axios.get(
                `https://api.clickup.com/api/v2/team/${CLICKUP_TEAM_ID}/task`, {
                params: {
                    'assignees[]': userId,
                    'include_closed': false,
                    'subtasks': true,
                    'page': page
                },
                headers: { Authorization: CLICKUP_TOKEN }
            }
            );
            const tasks = response.data.tasks || [];
            if (tasks.length > 0) {
                allTasks = allTasks.concat(tasks);
                page++;
            } else {
                hasMore = false;
            }
        }
        return allTasks;
    } catch (err) {
        console.error(`❌ Failed to get open tasks for user ${userId}:`, err.message);
        return [];
    }
}

async function getTasksCompletedToday(userId) {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startOfTodayTimestamp = today.getTime();

        const response = await axios.get(
            `https://api.clickup.com/api/v2/team/${CLICKUP_TEAM_ID}/task`, {
            params: {
                'assignees[]': userId,
                'statuses[]': 'complete',
                'date_done_gt': startOfTodayTimestamp,
                'include_closed': true,
                'subtasks': true,
            },
            headers: { Authorization: CLICKUP_TOKEN }
        }
        );
        return response.data.tasks || [];
    } catch (err) {
        console.error(`❌ Error fetching completed tasks for user ${userId}:`, err.message);
        return [];
    }
}

// ========================= Formatting ========================= //
function getAssigneeTags(task) {
    return (task.assignees || [])
        .map(u => {
            const tm = TEAM.find(m => m.email === u.email || m.id === u.id);
            return tm ? `@${tm.name}` : (u.username ? `@${u.username}` : 'غير معروف');
        })
        .join('، ') || 'غير محدد';
}

// ========================= Daily/AI Reports ========================= //
async function sendDailyGroupStats() {
    console.log('📊 Running Daily Group Stats report...');
    let report = `📊 *إحصائيات الإنجاز اليومية (تشمل المهام الفرعية)*\n`;
    let topPerformer = null;
    let maxCompleted = 0;

    for (const member of TEAM) {
        const allAssignedTasks = (await getUserTasks(member.id)).filter(t =>
            (t.assignees || []).some(a => a.id === member.id)
        );
        const completedTasksToday = await getTasksCompletedToday(member.id);
        const completedTodayCount = completedTasksToday.length;
        const openTasks = allAssignedTasks.filter(t => !NON_OPEN_STATUSES.includes((t.status?.status || '').toLowerCase().trim()));
        const addedToday = allAssignedTasks.filter(t => t.date_created && isToday(Number(t.date_created))).length;
        const allTimeCompleted = allAssignedTasks.filter(t => NON_OPEN_STATUSES.includes((t.status?.status || '').toLowerCase().trim())).length;

        report += `\n@${member.name}\n✅ مكتملة اليوم: ${completedTodayCount}\n📌 مفتوحة: ${openTasks.length}\n➕ مضافة: ${addedToday}\n📦 الإجمالي المكتمل: ${allTimeCompleted}`;

        if (completedTodayCount > maxCompleted) {
            maxCompleted = completedTodayCount;
            topPerformer = member.name;
        }
    }
    if (topPerformer) {
        report += `\n\n🎖️ *Top Performer*: @${topPerformer} (${maxCompleted} مهام)`;
    }
    if (GROUP_CHAT_ID) await cleanAndSendMessage(GROUP_CHAT_ID, report, { pin: true });
    console.log('✅ Daily Group Stats report finished.');
}

async function sendDailyUserTasks(forceTestUser = null) {
    console.log(`🌅 Running Daily User Tasks report... (User: ${forceTestUser || 'All'})`);

    const processMember = async (member) => {
        try {
            const assignedTasks = (await getUserTasks(member.id)).filter(t =>
                (t.assignees || []).some(a => a.id === member.id)
            );
            const completedTasksToday = await getTasksCompletedToday(member.id);
            const completedToday = completedTasksToday.length;
            const openTasks = assignedTasks.filter(t => !NON_OPEN_STATUSES.includes((t.status?.status || '').toLowerCase().trim()));
            const overdue = openTasks.filter(t => t.due_date && Number(t.due_date) < Date.now());
            const todayTasks = openTasks.filter(t => t.due_date && isToday(Number(t.due_date)));

            const relevantTotal = openTasks.length + completedToday;
            const completionRate = relevantTotal > 0 ? Math.round((completedToday / relevantTotal) * 100) : 0;
            const barLength = 10;
            const filledLength = Math.round((completionRate / 100) * barLength);
            const progressBar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);

            let msg = `🌅 *ملخص مهامك لليوم (تشمل المهام الفرعية)*\n@${member.name}\n\n`;
            msg += `🎯 الإجمالي المفتوح: ${openTasks.length}\n✅ مكتملة اليوم: ${completedToday}\n⚠️ متأخرة: ${overdue.length}\n\n📈 نسبة إنجاز اليوم: ${completionRate}%\n[${progressBar}]\n`;

            const formatTaskList = async (tasks) => {
                let formattedList = '';
                for (const t of tasks) {
                    const shortUrl = await shortenUrl(`https://app.clickup.com/t/${t.id}`);
                    const subtaskLabel = t.parent ? '(فرعية)' : '';
                    formattedList += `- ${t.name} ${subtaskLabel} 🔗 ${shortUrl}\n`;
                }
                return formattedList.trim();
            };

            if (openTasks.length) { msg += `\n📌 *المهام المفتوحة:*\n${await formatTaskList(openTasks)}`; }
            if (todayTasks.length) { msg += `\n\n🗓️ *مهام تستحق اليوم:*\n${await formatTaskList(todayTasks)}`; }
            if (overdue.length) { msg += `\n\n⚠️ *مهام متأخرة:*\n${await formatTaskList(overdue)}`; }

            if ((openTasks.length > 0 || completedToday > 0) && member.phone) {
                await cleanAndSendMessage(`${member.phone}@c.us`, msg);
            }
        } catch (e) {
            console.error(`Failed to process Daily User Tasks for ${member.name}:`, e.message);
        }
    };

    if (forceTestUser) {
        const member = TEAM.find(m => m.name === forceTestUser);
        if (member) await processMember(member);
    } else {
        console.log('Processing all users sequentially...');
        for (let i = 0; i < TEAM.length; i++) {
            console.log(`[${i + 1}/${TEAM.length}] Processing tasks for @${TEAM[i].name}`);
            await processMember(TEAM[i]);
            if (i < TEAM.length - 1) {
                console.log('Waiting 1 minute before next user...');
                await new Promise(resolve => setTimeout(resolve, 60000));
            }
        }
    }

    console.log('✅ Daily User Tasks report finished.');
}

// ========================= AI-POWERED FEATURES WITH CLAUDE ========================= //
async function aiGetUserStats(memberId) {
    const openTasks = await getOpenUserTasks(memberId);
    const completedToday = await getTasksCompletedToday(memberId);
    const overdue = openTasks.filter(t => t.due_date && Number(t.due_date) < Date.now());
    const todayDue = openTasks.filter(t => t.due_date && isToday(Number(t.due_date)));
    return { openTasks, completedToday, overdue, todayDue };
}

async function sendAIMorning(userName = null) {
    console.log(`🌅 Running AI Morning report... (User: ${userName || 'All'})`);

    const processMember = async (member) => {
        try {
            const { completedToday, openTasks, todayDue } = await aiGetUserStats(member.id);
            const analytics = await getProductivityAnalytics(member.name, 7);

            const summary = `@${member.name} | مفتوحة: ${openTasks.length} | مستحقة اليوم: ${todayDue.length} | مكتملة اليوم: ${completedToday.length}`;
            const aiMsg = await claudeCompose('morning', summary, analytics);

            if (member.phone) {
                await cleanAndSendMessage(`${member.phone}@c.us`, `🌅 *صباح النشاط*\n${aiMsg}`);
            }
        } catch (e) {
            console.error(`Failed to process AI Morning for ${member.name}:`, e.message);
        }
    };

    if (userName) {
        const member = TEAM.find(m => m.name === userName);
        if (member) await processMember(member);
    } else {
        console.log('Processing all users sequentially for AI Morning...');
        for (let i = 0; i < TEAM.length; i++) {
            console.log(`[${i + 1}/${TEAM.length}] Processing AI Morning for @${TEAM[i].name}`);
            await processMember(TEAM[i]);
            if (i < TEAM.length - 1) {
                console.log('Waiting 1 minute before next user...');
                await new Promise(resolve => setTimeout(resolve, 60000));
            }
        }
    }

    console.log('✅ AI Morning report finished.');
}

async function sendAIDaily(userName = null) {
    console.log(`📊 Running AI Daily report... (User: ${userName || 'All'})`);

    const processMember = async (member) => {
        try {
            const { completedToday, openTasks, overdue } = await aiGetUserStats(member.id);
            const analytics = await getProductivityAnalytics(member.name, 7);

            const total = openTasks.length + completedToday.length;
            const rate = total ? Math.round((completedToday.length / total) * 100) : 0;
            const summary = `@${member.name} | مكتملة اليوم: ${completedToday.length} | مفتوحة: ${openTasks.length} | متأخرة: ${overdue.length} | نسبة الإنجاز: ${rate}%`;
            const aiMsg = await claudeCompose('daily', summary, analytics);

            if (member.phone) {
                await cleanAndSendMessage(`${member.phone}@c.us`, `📊 *تقرير نهاية اليوم*\n${aiMsg}`);
            }
        } catch (e) {
            console.error(`Failed to process AI Daily for ${member.name}:`, e.message);
        }
    };

    if (userName) {
        const member = TEAM.find(m => m.name === userName);
        if (member) await processMember(member);
    } else {
        console.log('Processing all users sequentially for AI Daily...');
        for (let i = 0; i < TEAM.length; i++) {
            console.log(`[${i + 1}/${TEAM.length}] Processing AI Daily for @${TEAM[i].name}`);
            await processMember(TEAM[i]);
            if (i < TEAM.length - 1) {
                console.log('Waiting 1 minute before next user...');
                await new Promise(resolve => setTimeout(resolve, 60000));
            }
        }
    }

    console.log('✅ AI Daily report finished.');
}

async function sendAIGroupHighlights() {
    console.log('🔥 Running AI Group Highlights report...');
    let lines = [];
    let best = { name: null, count: -1 };

    for (const member of TEAM) {
        const { completedToday, openTasks } = await aiGetUserStats(member.id);
        lines.push(`@${member.name} | مكتملة: ${completedToday.length} | مفتوحة: ${openTasks.length}`);
        if (completedToday.length > best.count) best = { name: member.name, count: completedToday.length };
    }

    const analytics = await getProductivityAnalytics(null, 7);
    const payload = lines.join('\n') + (best.name ? `\nTop Performer: @${best.name} (${best.count})` : '');
    const aiMsg = await claudeCompose('group', payload, analytics);

    if (GROUP_CHAT_ID) await cleanAndSendMessage(GROUP_CHAT_ID, `🔥 *ملخص الفريق (AI)*\n${aiMsg}`, { pin: true });
    console.log('✅ AI Group Highlights report finished.');
}

async function sendAIGroupGoodnight() {
    console.log('🌙 Running AI Group Goodnight message...');
    let totalCompleted = 0;
    let best = { name: null, count: -1 };

    for (const member of TEAM) {
        const { completedToday } = await aiGetUserStats(member.id);
        const completedCount = completedToday.length;
        totalCompleted += completedCount;
        if (completedCount > best.count) {
            best = { name: member.name, count: completedCount };
        }
    }

    const analytics = await getProductivityAnalytics(null, 7);
    const summary = `إجمالي المهام المنجزة اليوم: ${totalCompleted}` + (best.name && best.count > 0 ? `\nأفضل أداء: @${best.name} (${best.count} مهام)` : '\nلا توجد مهام منجزة اليوم.');
    const aiMsg = await claudeCompose('goodnight', summary, analytics);

    if (GROUP_CHAT_ID) {
        await cleanAndSendMessage(GROUP_CHAT_ID, aiMsg, { pin: true });
        pauseNotifications(600000);
    }
    console.log('✅ AI Group Goodnight message finished.');
}

async function sendAIWeekly(userName = null) {
    console.log(`📅 Running AI Weekly report... (User: ${userName || 'All'})`);
    const now = Date.now();
    const weekEnd = now + 7 * 24 * 3600 * 1000;

    const processMember = async (member) => {
        try {
            const openTasks = await getOpenUserTasks(member.id);
            const nextWeekDue = openTasks.filter(t => t.due_date && Number(t.due_date) >= now && Number(t.due_date) <= weekEnd);
            const analytics = await getProductivityAnalytics(member.name, 7);

            const summary = `@${member.name} | مهام الأسبوع القادم: ${nextWeekDue.length}`;
            const aiMsg = await claudeCompose('weekly', summary, analytics);

            if (member.phone) {
                await cleanAndSendMessage(`${member.phone}@c.us`, `📅 *نظرة للأسبوع*\n${aiMsg}`);
            }
        } catch (e) {
            console.error(`Failed to process AI Weekly for ${member.name}:`, e.message);
        }
    };

    if (userName) {
        const member = TEAM.find(m => m.name === userName);
        if (member) await processMember(member);
    } else {
        console.log('Processing all users sequentially for AI Weekly...');
        for (let i = 0; i < TEAM.length; i++) {
            console.log(`[${i + 1}/${TEAM.length}] Processing AI Weekly for @${TEAM[i].name}`);
            await processMember(TEAM[i]);
            if (i < TEAM.length - 1) {
                console.log('Waiting 1 minute before next user...');
                await new Promise(resolve => setTimeout(resolve, 60000));
            }
        }
    }
    console.log('✅ AI Weekly report finished.');
}

// ========================= INSPIRATIONAL CONTENT (REFACTORED & SMARTER) ========================= //
async function getContextualInfo() {
    try {
        let weatherInfo = 'غير متاح حالياً';
        try {
            const weatherResponse = await axios.get('http://api.weatherapi.com/v1/current.json?key=a3c4672951e74b39866114144232509&q=Cairo');
            const { current } = weatherResponse.data;
            weatherInfo = `${current.condition.text}, درجة الحرارة ${current.temp_c}°C`;
        } catch (weatherError) {
            console.error('Could not fetch weather data:', weatherError.message);
        }

        let history = [];
        try {
            await fs.access(INSPIRATION_LOG_FILE);
            const logContent = await fs.readFile(INSPIRATION_LOG_FILE, 'utf-8');
            history = logContent.split('\n').filter(Boolean).slice(-10);
        } catch (error) {
            console.log('Inspiration log not found, will be created.');
        }

        const date = new Date();
        const month = date.getMonth();
        const hour = date.getHours();

        let season = 'الشتاء';
        if (month >= 2 && month <= 4) season = 'الربيع';
        if (month >= 5 && month <= 7) season = 'الصيف';
        if (month >= 8 && month <= 10) season = 'الخريف';

        let timeOfDay = 'الليل';
        if (hour >= 4 && hour < 12) timeOfDay = 'الصباح';
        if (hour >= 12 && hour < 17) timeOfDay = 'الظهيرة';
        if (hour >= 17 && hour < 21) timeOfDay = 'المساء';

        return { weatherInfo, season, timeOfDay, history };
    } catch (e) {
        console.error("Critical error in getContextualInfo:", e.message);
        return { weatherInfo: 'غير متاح', season: 'غير معروف', timeOfDay: 'غير معروف', history: [] };
    }
}

async function getInspirationalContentFromClaude() {
    console.log('🧠 Generating smart, contextual inspirational content with Claude...');
    try {
        const { weatherInfo, season, timeOfDay, history } = await getContextualInfo();

        const systemPrompt = `
أنت منشئ محتوى إبداعي محترف ومتخصص في صناعة محتوى تحفيزي وملهم عالي الجودة لفريق عمل في القاهرة، مصر. مهمتك هي إنتاج محتوى أصيل ومؤثر ومناسب للسياق الحالي.

## 🎯 الهدف الأساسي
إنتاج محتوى أصيل ومؤثر يلامس القلوب ويحرك المشاعر ويلهم التغيير الإيجابي، مع مراعاة السياق الزمني والمناخي.

## 📋 أنواع المحتوى
- **اقتباسات تحفيزية:** قصيرة وقوية أو متوسطة وعميقة.
- **قصص إلهام:** قصص رمزية أو واقعية قصيرة (2-4 جمل).
- **حكم وعبر:** جمل موجزة محملة بالحكمة.

## 🎨 معايير الجودة
- **الأصالة والتفرد:** تجنب العبارات المستهلكة. ابتكر زوايا جديدة.
- **اللغة والأسلوب:** استخدم العربية الفصحى المبسطة بأسلوب مؤثر.
- **العمق والمعنى:** يجب أن يحمل المحتوى رسالة واضحة وهادفة.
- **التأثير العاطفي:** أثر مشاعر الأمل، القوة، والإلهام.

## 🌤️ التكيف مع السياق (قواعد صارمة)
- **اربط المحتوى بالسياق:** استخدم معلومات الطقس والفصل والوقت من اليوم بذكاء لإنشاء رسالة متناغمة.
- **الخريف:** تأمل، تغيير، استعداد للجديد.
- **الشتاء:** صبر، قوة داخلية، دفء إنساني.
- **الربيع:** أمل، بدايات جديدة، نمو.
- **الصيف:** نشاط، عطاء، حصاد.
- **الصباح:** تفاؤل، طاقة، بدايات.
- **الظهيرة:** استمرارية، تركيز.
- **المساء والليل:** تأمل، حكمة، هدوء.

## 🔧 إرشادات تقنية
- **الإيجاز:** الرسالة يجب ألا تتجاوز 3-4 جمل قوية ومترابطة.
- **التنوع:** نوع في الأسلوب والمواضيع والمشاعر.
- **عدم التكرار:** لا تكرر الأفكار أو الصياغات من الرسائل السابقة المقدمة لك.
`;

        const userQuery = `
- **السياق الحالي:**
  - **الوقت:** ${timeOfDay}
  - **الفصل:** ${season}
  - **الطقس في القاهرة:** ${weatherInfo}

- **الرسائل السابقة (لتجنب التكرار):**
${history.map(h => `- ${h}`).join('\n')}

- **المطلوب:**
بناءً على السياق والرسائل السابقة، اكتب محتوى إبداعي جديد (اقتباس، حكمة، أو قصة قصيرة جداً) يتوافق مع القواعد الصارمة المحددة لك. يجب أن يكون فريداً ومبتكراً.
`;

        const response = await axios.post(
            'https://api.anthropic.com/v1/messages',
            {
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 1024,
                messages: [
                    { role: 'user', content: userQuery }
                ],
                system: systemPrompt
            },
            {
                headers: {
                    'x-api-key': CLAUDE_API_KEY,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json'
                }
            }
        );

        const text = response.data?.content?.[0]?.text?.trim();

        if (text) {
            await fs.appendFile(INSPIRATION_LOG_FILE, text + '\n');
            return text;
        } else {
            return '✨ *تذكر دائماً:* كل إنجاز عظيم يبدأ بخطوة واحدة صغيرة.';
        }

    } catch (e) {
        console.error('Error fetching inspirational content from Claude:', e.response ? e.response.data : e.message);
        return '✨ *تذكر دائماً:* كل إنجاز عظيم يبدأ بخطوة واحدة صغيرة.';
    }
}

async function sendInspirationalContent() {
    try {
        console.log('💡 Running Inspirational Content job...');
        const content = await getInspirationalContentFromClaude();
        const hasUrl = content.includes('http://') || content.includes('https://');
        const msg = `💡 *رسالة اليوم*\n\n${content}`;
        if (GROUP_CHAT_ID) {
            await cleanAndSendMessage(GROUP_CHAT_ID, msg, { pin: true, linkPreview: hasUrl });
            pauseNotifications(600000);
        }
        console.log('✅ Inspirational Content job finished.');
    } catch(e) {
        console.error("Failed to execute sendInspirationalContent job:", e.message);
    }
}

// ========================= HTTP API (Tests) ========================= //
app.get('/test-daily-report/:user', async (req, res) => {
    try {
        const user = req.params.user;
        await sendDailyUserTasks(user);
        res.send(`✅ Report sent to @${user}`);
    } catch (err) {
        res.status(500).send('Error sending test report: ' + err.message);
    }
});

app.get('/test-daily-report-all', async (_req, res) => {
    try {
        await sendDailyUserTasks();
        res.send('✅ Reports sent to all users');
    } catch (err) {
        res.status(500).send('Error sending all reports: ' + err.message);
    }
});

app.get('/test-daily-report-group', async (_req, res) => {
    try {
        await sendDailyGroupStats();
        res.send('✅ Group report sent');
    } catch (err) {
        res.status(500).send('Error sending group report: ' + err.message);
    }
});

// تشخيص حالات المهام
app.get('/debug/status-check/:status', async (req, res) => {
    try {
        const testStatus = req.params.status;
        const lowercaseStatus = testStatus.toLowerCase().trim();
        const isComplete = NON_OPEN_STATUSES.includes(lowercaseStatus);

        res.json({
            originalStatus: testStatus,
            lowercaseStatus: lowercaseStatus,
            isComplete: isComplete,
            supportedStatuses: NON_OPEN_STATUSES,
            message: isComplete ? '✅ هذه الحالة مكتملة' : '❌ هذه الحالة ليست مكتملة'
        });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.get('/test-ai-morning/:user', async (req, res) => {
    try { await sendAIMorning(req.params.user); res.send(`✅ AI Morning sent to @${req.params.user}`); }
    catch (e) { res.status(500).send(e.message); }
});
app.get('/test-ai-morning-all', async (_req, res) => {
    try { await sendAIMorning(); res.send('✅ AI Morning sent to all'); }
    catch (e) { res.status(500).send(e.message); }
});
app.get('/test-ai-daily/:user', async (req, res) => {
    try { await sendAIDaily(req.params.user); res.send(`✅ AI Daily sent to @${req.params.user}`); }
    catch (e) { res.status(500).send(e.message); }
});
app.get('/test-ai-daily-all', async (_req, res) => {
    try { await sendAIDaily(); res.send('✅ AI Daily sent to all'); }
    catch (e) { res.status(500).send(e.message); }
});
app.get('/test-ai-group-highlights', async (_req, res) => {
    try { await sendAIGroupHighlights(); res.send('✅ AI Group Highlights sent'); }
    catch (e) { res.status(500).send(e.message); }
});

app.get('/test-ai-group-goodnight', async (_req, res) => {
    try {
        await sendAIGroupGoodnight();
        res.send('✅ AI Group Goodnight message sent');
    } catch (e) {
        res.status(500).send(e.message);
    }
});

app.get('/test-ai-weekly/:user', async (req, res) => {
    try { await sendAIWeekly(req.params.user); res.send(`✅ AI Weekly sent to @${req.params.user}`); }
    catch (e) { res.status(500).send(e.message); }
});
app.get('/test-ai-weekly-all', async (_req, res) => {
    try { await sendAIWeekly(); res.send('✅ AI Weekly sent to all'); }
    catch (e) { res.status(500).send(e.message); }
});
app.get('/test-ai-quote', async (_req, res) => {
    try { await sendInspirationalContent(); res.send('✅ AI Quote sent'); }
    catch (e) { res.status(500).send(e.message); }
});

app.get('/test-task-complete/:taskId', async (req, res) => {
    try {
        const task = await getTaskDetails(req.params.taskId);
        if (!task) return res.status(404).send('Task not found');

        addNotificationToQueue({
            type: 'task_completed',
            task: task,
            data: {
                assignees: getAssigneeTags(task),
                updaterName: 'TestUser'
            }
        });

        res.send('Test completion added to queue.');
    } catch (e) {
        res.status(500).send(e.message);
    }
});

app.get('/test-inspiration', async (_req, res) => {
    try {
        await sendInspirationalContent();
        res.send('✅ Inspirational content sent to the group.');
    } catch (e) {
        res.status(500).send('Error sending inspirational content: ' + e.message);
    }
});

app.get('/test-analytics/:user?', async (req, res) => {
    try {
        const userName = req.params.user;
        const member = userName ? TEAM.find(m => m.name === userName) : null;
        const analytics = await getProductivityAnalytics(member?.name || null, 7);

        if (!analytics) {
            return res.send('No analytics data available yet.');
        }

        let report = `📊 تحليل الإنتاجية (آخر 7 أيام)\n\n`;
        report += `إجمالي المهام المنجزة: ${analytics.totalCompleted}\n\n`;

        if (analytics.mostProductiveDay) {
            report += `اليوم الأكثر إنتاجية: ${analytics.mostProductiveDay} (${analytics.mostProductiveDayCount} مهمة)\n\n`;
        }

        report += `إحصائيات الأيام:\n`;
        Object.entries(analytics.dayStats).forEach(([day, stats]) => {
            report += `${day}: ${stats.count} مهمة\n`;
        });

        res.send(report);
    } catch (e) {
        res.status(500).send('Error generating analytics: ' + e.message);
    }
});

// ========================= ERPNext Webhook ========================= //
app.post('/sample-request-webhook', async (req, res) => {
    try {
        const body = JSON.parse(req.body.toString('utf8'));
        const { customer, items, requestNo } = body;

        const mainTaskPayload = {
            name: `Sample Request - ${customer} - ${requestNo}`,
            description: `طلب عينات من العميل: ${customer}\nرقم الطلب: ${requestNo}`,
            status: 'to do'
        };
        const mainTaskRes = await axios.post(
            `https://api.clickup.com/api/v2/list/${SAMPLE_LIST_ID}/task`,
            mainTaskPayload,
            { headers: { Authorization: CLICKUP_TOKEN, 'Content-Type': 'application/json' } }
        );
        const mainTaskId = mainTaskRes.data.id;

        const checklistItems = (items || []).map(item => ({ name: `${item.item_name} (Code: ${item.item_code})` }));
        const fixedSubtaskNames = ['Print the papers and documents', 'Attach the labels', 'Load the order'];

        for (const subtaskName of fixedSubtaskNames) {
            const subTaskPayload = {
                name: subtaskName,
                description: `Part of sample request for ${customer} - ${requestNo}`,
                status: 'to do',
                parent: mainTaskId,
            };
            const subtaskRes = await axios.post(
                `https://api.clickup.com/api/v2/list/${SAMPLE_LIST_ID}/task`,
                subTaskPayload,
                { headers: { Authorization: CLICKUP_TOKEN, 'Content-Type': 'application/json' } }
            );
            const subtaskId = subtaskRes.data.id;

            if (checklistItems.length > 0) {
                const checklistPayload = { name: 'Order Items' };
                const checklistRes = await axios.post(
                    `https://api.clickup.com/api/v2/task/${subtaskId}/checklist`,
                    checklistPayload,
                    { headers: { Authorization: CLICKUP_TOKEN, 'Content-Type': 'application/json' } }
                );
                const checklistId = checklistRes.data.checklist.id;
                for (const item of checklistItems) {
                    await axios.post(
                        `https://api.clickup.com/api/v2/checklist/${checklistId}/checklist_item`,
                        { name: item.name },
                        { headers: { Authorization: CLICKUP_TOKEN, 'Content-Type': 'application/json' } }
                    );
                }
            }
        }

        for (const item of (items || [])) {
            const subTaskPayload = {
                name: `${item.item_name} (${item.item_code})`,
                description: item.description || `Subtask for item ${item.item_code}`,
                status: 'to do',
                parent: mainTaskId
            };
            await axios.post(
                `https://api.clickup.com/api/v2/list/${SAMPLE_LIST_ID}/task`,
                subTaskPayload,
                { headers: { Authorization: CLICKUP_TOKEN, 'Content-Type': 'application/json' } }
            );
        }
        res.send({ success: true, taskId: mainTaskId });
    } catch (err) {
        console.error('❌ Error creating sample request task:', err.response?.data || err.message);
        res.status(500).send('Error creating task');
    }
});

// ========================= Webhook Test Endpoints ========================= //
// نقاط اختبار للتأكد من أن السيرفر شغّال و webhooks تعمل

// اختبار بسيط - GET
app.get('/webhook-test', (req, res) => {
    res.json({
        status: 'ok',
        message: '✅ السيرفر شغّال والـ webhook endpoints جاهزة!',
        timestamp: new Date().toISOString(),
        endpoints: {
            'GET /webhook-test': 'اختبار بسيط (أنت هنا)',
            'GET /task-updated-webhook': 'معلومات عن webhook',
            'POST /task-updated-webhook': 'استقبال تحديثات المهام من ClickUp',
            'POST /task-created-webhook': 'استقبال مهام جديدة',
            'POST /task-comment-webhook': 'استقبال تعليقات'
        },
        server_info: {
            port: PORT,
            whatsapp_connected: !!GROUP_CHAT_ID,
            group_id: GROUP_CHAT_ID || 'غير متصل'
        }
    });
});

// معلومات عن webhook - GET
app.get('/task-updated-webhook', (req, res) => {
    res.json({
        endpoint: 'POST /task-updated-webhook',
        description: 'نقطة وصول webhook لاستقبال تحديثات المهام من ClickUp',
        method: 'POST',
        status: '✅ جاهز',
        expected_data: {
            task_id: 'معرّف المهمة',
            history_items: [
                {
                    field: 'نوع التغيير (status, assignee, priority, etc)',
                    before: 'القيمة قبل التغيير',
                    after: 'القيمة بعد التغيير',
                    user: {
                        username: 'اسم المستخدم'
                    }
                }
            ]
        },
        usage: 'استخدم POST request من ClickUp webhooks فقط',
        test_endpoint: 'استخدم GET /webhook-test للتأكد من أن السيرفر شغّال',
        server_status: {
            running: true,
            whatsapp_connected: !!GROUP_CHAT_ID,
            ai_enabled: !!process.env.ANTHROPIC_API_KEY,
            timestamp: new Date().toISOString()
        }
    });
});

// معلومات عن webhook - GET
app.get('/task-created-webhook', (req, res) => {
    res.json({
        endpoint: 'POST /task-created-webhook',
        description: 'نقطة وصول webhook لاستقبال مهام جديدة من ClickUp',
        method: 'POST',
        status: '✅ جاهز',
        usage: 'استخدم POST request من ClickUp webhooks فقط'
    });
});

// ========================= ClickUp Webhooks (REFACTORED) ========================= //
app.post('/task-created-webhook', async (req, res) => {
    try {
        const body = JSON.parse(req.body.toString('utf8'));
        const taskId = body.task_id || body.payload?.id;
        const task = await getTaskDetails(taskId);
        if (!task) return res.status(404).send('Task not found.');

        addNotificationToQueue({
            type: 'task_created',
            task: task,
            data: {
                creatorName: task.creator?.username || 'غير معروف',
                assignees: getAssigneeTags(task)
            }
        });

        if (task.assignees && task.assignees.length > 0) {
            await sendDirectAssignmentNotification(task);
        }

        res.send('ok');
    } catch (err) {
        console.error('Error in /task-created-webhook:', err.message);
        res.status(500).send('Error.');
    }
});

app.post('/task-updated-webhook', async (req, res) => {
    try {
        const body = JSON.parse(req.body.toString('utf8'));
        const taskId = body.task_id || body.payload?.id;
        const historyItem = body.history_items?.[0];

        const task = await getTaskDetails(taskId);
        if (!task) return res.status(404).send('Task not found.');
        if (!historyItem) return res.send('ok (no history item)');

        const updaterName = historyItem.user?.username || 'غير معروف';

        // ========================= AI-Powered Notification System ========================= //
        // نظام جديد: AI يفهم ويكتب إشعار لأي تغيير في المهمة

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 Task Update Detected');
        console.log('   Task:', task.name);
        console.log('   Task ID:', task.id);
        console.log('   Changed by:', updaterName);
        console.log('   Field changed:', historyItem.field);

        // استخراج القيم قبل وبعد التغيير حسب نوع الحقل
        let beforeValue, afterValue;

        switch (historyItem.field) {
            case 'status':
                beforeValue = historyItem.before?.status || 'غير محدد';
                afterValue = task.status?.status || 'غير محدد';
                console.log('   Before:', beforeValue);
                console.log('   After:', afterValue);
                break;

            case 'assignee':
                beforeValue = historyItem.before?.username || null;
                afterValue = historyItem.after?.username || null;
                console.log('   Assignee Before:', beforeValue || 'لا يوجد');
                console.log('   Assignee After:', afterValue || 'لا يوجد');

                // إرسال إشعار مباشر للمسؤول الجديد
                if (afterValue && task.assignees?.length > 0) {
                    await sendDirectAssignmentNotification(task);
                }
                break;

            case 'priority':
                beforeValue = historyItem.before?.priority;
                afterValue = task.priority?.priority;
                console.log('   Priority Before:', beforeValue);
                console.log('   Priority After:', afterValue);
                break;

            case 'due_date':
                beforeValue = historyItem.before?.due_date;
                afterValue = task.due_date;
                console.log('   Due Date Before:', beforeValue || 'لا يوجد');
                console.log('   Due Date After:', afterValue || 'لا يوجد');
                break;

            case 'description':
                beforeValue = 'تم التعديل';
                afterValue = 'وصف جديد';
                console.log('   Description updated');
                break;

            case 'name':
                beforeValue = historyItem.before?.name || 'غير معروف';
                afterValue = task.name;
                console.log('   Name Before:', beforeValue);
                console.log('   Name After:', afterValue);
                break;

            default:
                beforeValue = JSON.stringify(historyItem.before);
                afterValue = JSON.stringify(historyItem.after || 'تحديث');
                console.log('   Generic field update');
        }

        // إرسال للـ AI لتوليد إشعار ذكي
        console.log('🤖 Sending to AI for smart notification generation...');

        const change = {
            field: historyItem.field,
            before: beforeValue,
            after: afterValue,
            userName: updaterName
        };

        await createAISmartNotification(task, change);

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        res.send('ok');
    } catch (err) {
        console.error('Error in /task-updated-webhook:', err.message);
        res.status(500).send('Error.');
    }
});

app.post('/task-comment-webhook', async (req, res) => {
    try {
        const body = JSON.parse(req.body.toString('utf8'));
        const taskId = body.task_id;
        if (!taskId) return res.send('ok (no task id)');

        const [task, comments] = await Promise.all([
            getTaskDetails(taskId),
            getTaskComments(taskId)
        ]);

        if (!task || !comments || comments.length === 0) {
            return res.send('ok (task or comments not found)');
        }

        const latestComment = comments[0];

        addNotificationToQueue({
            type: 'comment_added',
            task: task,
            data: {
                commenterName: latestComment.user?.username || 'غير معروف',
                commentText: latestComment.comment_text || '',
                assignees: getAssigneeTags(task)
            }
        });

        res.send('ok');
    } catch (err) {
        console.error('>>> UNCAUGHT ERROR in /task-comment-webhook:', err.message);
        res.status(500).send('Error.');
    }
});

// ========================= CRON SCHEDULER ========================= //
cron.schedule('5 8 * * *', () => sendAIMorning(), { timezone: 'Africa/Cairo' });
cron.schedule('30 8 * * *', () => sendDailyUserTasks(), { timezone: 'Africa/Cairo' });

cron.schedule('35 23 * * *', () => sendAIDaily(), { timezone: 'Africa/Cairo' });
cron.schedule('45 23 * * *', () => sendDailyUserTasks(), { timezone: 'Africa/Cairo' });
cron.schedule('50 23 * * *', () => sendAIGroupHighlights(), { timezone: 'Africa/Cairo' });
cron.schedule('55 23 * * *', () => sendDailyGroupStats(), { timezone: 'Africa/Cairo' });
cron.schedule('58 23 * * *', () => sendAIGroupGoodnight(), { timezone: 'Africa/Cairo' });

cron.schedule('0 9 * * 5', () => sendAIWeekly(), { timezone: 'Africa/Cairo' });

cron.schedule('15 9 * * *', () => sendInspirationalContent(), { timezone: 'Africa/Cairo' });

// ========================= WhatsApp Client Ready ========================= //
client.on('ready', async () => {
    console.log('✅ WhatsApp Ready');
    const chats = await client.getChats();
    const groupName = process.env.WHATSAPP_GROUP_NAME || 'Click Up notification 📢';
    const group = chats.find(c => c.isGroup && c.name === groupName);
    if (group) {
        GROUP_CHAT_ID = group.id._serialized;
        global.GROUP_CHAT_ID = GROUP_CHAT_ID; // Make accessible for dashboard API
        console.log(`📢 Group chat found: ${group.name} (${GROUP_CHAT_ID})`);
        await cleanAndSendMessage(GROUP_CHAT_ID, '🚀 Bot connected with enhanced AI-powered motivation system! 🎯');
    } else {
        console.warn(`⚠️ Group '${groupName}' not found.`);
    }
});

// ========================= Dashboard API Integration ========================= //
const { addDashboardEndpoints } = require('./dashboard-api');
addDashboardEndpoints(app);

// ========================= Start Server ========================= //
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running at http://0.0.0.0:${PORT}`);
});

// ========================= Exports ========================= //
module.exports = {
    cleanAndSendMessage
};
