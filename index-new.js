// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║                     ClickUp WhatsApp AI Notification System               ║
// ║                         All-in-One Implementation                         ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

// ========================= Dependencies ========================= //
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cron = require('node-cron');
const fs = require('fs').promises;
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const Anthropic = require('@anthropic-ai/sdk');

// ========================= Configuration ========================= //
const CONFIG = {
    // API Keys
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    CLICKUP_TOKEN: process.env.CLICKUP_TOKEN || 'pk_62585187_VZCCTKCU9501T8G8KJHVGT9FSXPVTU11',
    CLICKUP_TEAM_ID: process.env.CLICKUP_TEAM_ID || '9015343430',
    CLICKUP_LIST_ID: process.env.CLICKUP_LIST_ID || '901515500888',

    // Server
    PORT: process.env.PORT || 5014,

    // WhatsApp
    WHATSAPP_GROUP_NAME: process.env.WHATSAPP_GROUP_NAME || 'Click Up notification 📢',

    // Features
    ENABLE_AI: process.env.ENABLE_AI !== 'false',
    ENABLE_MOTIVATION: process.env.ENABLE_MOTIVATION !== 'false',
    ENABLE_ANALYTICS: process.env.ENABLE_ANALYTICS !== 'false',

    // Files
    PRODUCTIVITY_DATA_FILE: path.join(__dirname, 'productivity_data.json'),
    BADGES_FILE: path.join(__dirname, 'badges_data.json'),
};

// ========================= Global Variables ========================= //
let whatsappClient = null;
let GROUP_CHAT_ID = null;
let anthropicClient = null;

// Initialize Anthropic if API key exists
if (CONFIG.ANTHROPIC_API_KEY && CONFIG.ANTHROPIC_API_KEY !== 'sk-ant-api03-your-key-here') {
    anthropicClient = new Anthropic({ apiKey: CONFIG.ANTHROPIC_API_KEY });
}

// ========================= Express Setup ========================= //
const app = express();
app.use(express.json());
app.use(express.static('public'));

axios.defaults.timeout = 60000;

// ========================= WhatsApp Client Setup ========================= //
function initializeWhatsApp() {
    console.log('🔄 Initializing WhatsApp client...');

    whatsappClient = new Client({
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

    whatsappClient.on('qr', (qr) => {
        console.log('📱 Scan this QR code to connect WhatsApp:');
        qrcode.generate(qr, { small: true });
    });

    whatsappClient.on('authenticated', () => {
        console.log('✅ WhatsApp client is authenticated!');
    });

    whatsappClient.on('ready', async () => {
        console.log('✅ WhatsApp client is ready!');

        // Find group
        const chats = await whatsappClient.getChats();
        const group = chats.find(c => c.isGroup && c.name === CONFIG.WHATSAPP_GROUP_NAME);

        if (group) {
            GROUP_CHAT_ID = group.id._serialized;
            console.log(`📢 Group found: ${group.name} (${GROUP_CHAT_ID})`);

            // Send startup message
            await sendWhatsAppMessage(GROUP_CHAT_ID, '🚀 Bot is online! AI-powered notifications ready! 🤖');
        } else {
            console.warn(`⚠️  Group '${CONFIG.WHATSAPP_GROUP_NAME}' not found.`);
        }
    });

    whatsappClient.on('disconnected', (reason) => {
        console.log('⚠️  WhatsApp disconnected:', reason);
    });

    whatsappClient.initialize();
}

// ========================= WhatsApp Helper Functions ========================= //
async function sendWhatsAppMessage(chatId, message) {
    if (!whatsappClient || !chatId) {
        console.log('⚠️  WhatsApp not ready or no chat ID');
        return false;
    }

    try {
        // Clean message
        const cleanMessage = message
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .trim();

        await whatsappClient.sendMessage(chatId, cleanMessage);
        console.log('✅ Message sent to', chatId);
        return true;
    } catch (error) {
        console.error('❌ Failed to send WhatsApp message:', error.message);
        return false;
    }
}

// ========================= AI Notification System ========================= //
async function generateAINotification(task, change) {
    // If AI not available, use simple notification
    if (!anthropicClient) {
        return generateSimpleNotification(task, change);
    }

    try {
        console.log('🤖 Generating AI notification...');

        const prompt = buildAIPrompt(task, change);

        const message = await anthropicClient.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 500,
            temperature: 0.7,
            messages: [{ role: 'user', content: prompt }]
        });

        const notification = message.content[0].text.trim();
        console.log('✅ AI notification generated');

        return notification;

    } catch (error) {
        console.error('❌ AI generation failed:', error.message);
        return generateSimpleNotification(task, change);
    }
}

function buildAIPrompt(task, change) {
    const { field, before, after, userName } = change;

    let prompt = `أنت مساعد ذكي لفريق عمل. اكتب إشعار واضح ومختصر بالعربية (2-3 أسطر فقط).

المهمة: "${task.name}"
التغيير: ${getChangeTypeArabic(field)}
من قام به: ${userName}
`;

    if (field === 'status') {
        prompt += `من: ${before}\nإلى: ${after}\n`;

        const isComplete = ['complete', 'completed', 'done', 'finished', 'مكتمل'].includes(after?.toLowerCase());
        if (isComplete) {
            prompt += '\nهذه مهمة مكتملة - احتفل بالإنجاز!';
        }
    } else if (field === 'assignee') {
        prompt += `المسؤول الجديد: ${after || 'تمت الإزالة'}\n`;
    } else {
        prompt += `من: ${before}\nإلى: ${after}\n`;
    }

    prompt += `\nالتعليمات:
- emoji واحد فقط في البداية
- اذكر اسم المهمة واسم الشخص
- لغة عربية بسيطة وودودة
- لا تكتب أي شيء قبل أو بعد الإشعار
- 2-3 أسطر فقط

مثال: ✅ رائع! أنجز ${userName} مهمة "${task.name}". أحسنت! 🎉`;

    return prompt;
}

function getChangeTypeArabic(field) {
    const types = {
        'status': 'تغيير الحالة',
        'assignee': 'تعيين مسؤول',
        'priority': 'تغيير الأولوية',
        'due_date': 'تغيير الموعد النهائي',
        'description': 'تعديل الوصف',
        'name': 'تغيير العنوان'
    };
    return types[field] || field;
}

function generateSimpleNotification(task, change) {
    const { field, before, after, userName } = change;

    if (field === 'status') {
        const isComplete = ['complete', 'completed', 'done', 'finished', 'مكتمل'].includes(after?.toLowerCase());

        if (isComplete) {
            return `✅ رائع! أنجز ${userName} مهمة "${task.name}"\nأحسنت! 🎉`;
        } else {
            return `🔄 ${userName} نقل مهمة "${task.name}" إلى "${after}"`;
        }
    } else if (field === 'assignee') {
        if (after) {
            return `📋 تم تعيين مهمة "${task.name}" لـ ${after}`;
        } else {
            return `📋 تمت إزالة ${before} من مهمة "${task.name}"`;
        }
    } else if (field === 'priority') {
        return `⚡ ${userName} غيّر أولوية "${task.name}" إلى ${after}`;
    } else {
        return `🔔 ${userName} قام بتحديث مهمة "${task.name}"`;
    }
}

// ========================= ClickUp API Helpers ========================= //
async function getTaskDetails(taskId) {
    try {
        const response = await axios.get(`https://api.clickup.com/api/v2/task/${taskId}`, {
            headers: { Authorization: CONFIG.CLICKUP_TOKEN }
        });
        return response.data;
    } catch (error) {
        console.error('❌ Failed to get task details:', error.message);
        return null;
    }
}

async function getTeamMembers() {
    try {
        const response = await axios.get(
            `https://api.clickup.com/api/v2/team/${CONFIG.CLICKUP_TEAM_ID}/user`,
            { headers: { Authorization: CONFIG.CLICKUP_TOKEN } }
        );
        return response.data.members || [];
    } catch (error) {
        console.error('❌ Failed to get team members:', error.message);
        return [];
    }
}

// ========================= Analytics & Data Storage ========================= //
async function saveProductivityData(data) {
    if (!CONFIG.ENABLE_ANALYTICS) return;

    try {
        let productivityData = [];

        try {
            const existingData = await fs.readFile(CONFIG.PRODUCTIVITY_DATA_FILE, 'utf-8');
            productivityData = JSON.parse(existingData);
        } catch (error) {
            // File doesn't exist, start fresh
        }

        productivityData.push({
            ...data,
            timestamp: Date.now(),
            date: new Date().toISOString()
        });

        await fs.writeFile(CONFIG.PRODUCTIVITY_DATA_FILE, JSON.stringify(productivityData, null, 2));
        console.log('📊 Productivity data saved');
    } catch (error) {
        console.error('❌ Failed to save productivity data:', error.message);
    }
}

async function getProductivityStats() {
    try {
        const data = await fs.readFile(CONFIG.PRODUCTIVITY_DATA_FILE, 'utf-8');
        const allData = JSON.parse(data);

        // Calculate stats
        const completedTasks = allData.filter(d => d.type === 'task_completed');
        const today = new Date().toDateString();
        const todayTasks = completedTasks.filter(d => new Date(d.timestamp).toDateString() === today);

        return {
            totalTasks: completedTasks.length,
            todayTasks: todayTasks.length,
            allData: allData
        };
    } catch (error) {
        return { totalTasks: 0, todayTasks: 0, allData: [] };
    }
}

// ========================= Webhook Endpoints ========================= //

// Test endpoint
app.get('/webhook-test', (req, res) => {
    res.json({
        status: 'ok',
        message: '✅ Server is running!',
        timestamp: new Date().toISOString(),
        config: {
            whatsapp_connected: !!GROUP_CHAT_ID,
            ai_enabled: !!anthropicClient,
            group_name: CONFIG.WHATSAPP_GROUP_NAME
        }
    });
});

// Task Status Updated Webhook (from ClickUp)
app.post('/task-updated-webhook', async (req, res) => {
    try {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📥 Webhook received from ClickUp');

        const body = req.body;
        const taskId = body.task_id || body.payload?.id;
        const historyItem = body.history_items?.[0];

        console.log('   Task ID:', taskId);
        console.log('   Has history_items:', !!historyItem);
        console.log('   Event:', body.event);

        // Handle case where there's no history_items (automation webhook)
        if (!historyItem) {
            console.log('⚠️  No history_items - skipping (this is likely an automation webhook)');
            return res.send('ok - no history items');
        }

        // Get task details
        const task = await getTaskDetails(taskId);
        if (!task) {
            console.log('❌ Task not found:', taskId);
            return res.status(404).send('Task not found');
        }

        console.log('✅ Task found:', task.name);

        // Extract change information
        const userName = historyItem.user?.username || 'Unknown';
        const field = historyItem.field;

        let beforeValue, afterValue;

        // Extract values based on field type
        switch (field) {
            case 'status':
                beforeValue = historyItem.before?.status || 'غير محدد';
                afterValue = historyItem.after?.status || task.status?.status || 'غير محدد';
                break;
            case 'assignee':
                beforeValue = historyItem.before?.username;
                afterValue = historyItem.after?.username;
                break;
            case 'priority':
                beforeValue = historyItem.before?.priority;
                afterValue = historyItem.after?.priority || task.priority?.priority;
                break;
            case 'due_date':
                beforeValue = historyItem.before?.due_date;
                afterValue = historyItem.after?.due_date || task.due_date;
                break;
            default:
                beforeValue = JSON.stringify(historyItem.before);
                afterValue = JSON.stringify(historyItem.after);
        }

        console.log('📊 Change detected:');
        console.log('   Field:', field);
        console.log('   Before:', beforeValue);
        console.log('   After:', afterValue);
        console.log('   By:', userName);

        // Generate AI notification
        const change = { field, before: beforeValue, after: afterValue, userName };
        const notification = await generateAINotification(task, change);

        // Send to WhatsApp
        if (GROUP_CHAT_ID) {
            await sendWhatsAppMessage(GROUP_CHAT_ID, notification);
            console.log('✅ Notification sent to WhatsApp');
        } else {
            console.log('⚠️  No WhatsApp group configured');
        }

        // Save analytics
        await saveProductivityData({
            type: `task_${field}_changed`,
            taskId: task.id,
            taskName: task.name,
            userId: userName,
            field: field,
            before: beforeValue,
            after: afterValue
        });

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        res.send('ok');

    } catch (error) {
        console.error('❌ Error in webhook:', error.message);
        res.status(500).send('Error');
    }
});

// Task Created Webhook
app.post('/task-created-webhook', async (req, res) => {
    try {
        console.log('📥 Task Created webhook received');

        const body = req.body;
        const taskId = body.task_id || body.payload?.id;

        const task = await getTaskDetails(taskId);
        if (!task) {
            return res.status(404).send('Task not found');
        }

        const creator = task.creator?.username || 'Unknown';
        const assignees = task.assignees?.map(a => a.username).join(', ') || 'لا يوجد';

        const notification = `📋 مهمة جديدة: "${task.name}"\nأنشأها: ${creator}\nالمسؤول: ${assignees}`;

        if (GROUP_CHAT_ID) {
            await sendWhatsAppMessage(GROUP_CHAT_ID, notification);
        }

        await saveProductivityData({
            type: 'task_created',
            taskId: task.id,
            taskName: task.name,
            creator: creator
        });

        res.send('ok');
    } catch (error) {
        console.error('❌ Error in task-created webhook:', error.message);
        res.status(500).send('Error');
    }
});

// ========================= Dashboard API ========================= //

app.get('/api/dashboard-stats', async (req, res) => {
    try {
        const stats = await getProductivityStats();

        res.json({
            totalTasks: stats.totalTasks,
            todayTasks: stats.todayTasks,
            weekTasks: stats.allData.filter(d => {
                const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
                return d.timestamp > weekAgo && d.type === 'task_completed';
            }).length,
            monthTasks: stats.allData.filter(d => {
                const monthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
                return d.timestamp > monthAgo && d.type === 'task_completed';
            }).length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/recent-activity', async (req, res) => {
    try {
        const stats = await getProductivityStats();
        const recentActivity = stats.allData
            .slice(-20)
            .reverse()
            .map(item => ({
                type: item.type,
                taskName: item.taskName,
                user: item.userId || item.creator,
                timestamp: item.timestamp,
                date: item.date
            }));

        res.json(recentActivity);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/team-stats', async (req, res) => {
    try {
        const stats = await getProductivityStats();
        const userStats = {};

        stats.allData.forEach(item => {
            const user = item.userId || item.creator;
            if (!user) return;

            if (!userStats[user]) {
                userStats[user] = { completed: 0, created: 0, total: 0 };
            }

            if (item.type === 'task_completed') userStats[user].completed++;
            if (item.type === 'task_created') userStats[user].created++;
            userStats[user].total++;
        });

        const teamArray = Object.entries(userStats).map(([name, data]) => ({
            name,
            ...data
        })).sort((a, b) => b.total - a.total);

        res.json(teamArray);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========================= Scheduled Jobs (Cron) ========================= //

if (CONFIG.ENABLE_MOTIVATION) {
    // Daily motivation - 9 AM
    cron.schedule('0 9 * * *', async () => {
        if (!GROUP_CHAT_ID) return;

        const stats = await getProductivityStats();
        const message = `🌅 صباح الخير يا فريق!

📊 إحصائيات الأمس:
✅ ${stats.todayTasks} مهمة مكتملة

💪 لنجعل اليوم أفضل من الأمس!`;

        await sendWhatsAppMessage(GROUP_CHAT_ID, message);
        console.log('📅 Daily motivation sent');
    }, { timezone: 'Africa/Cairo' });

    // Weekly report - Friday 5 PM
    cron.schedule('0 17 * * 5', async () => {
        if (!GROUP_CHAT_ID) return;

        const stats = await getProductivityStats();
        const weekStart = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const weekTasks = stats.allData.filter(d =>
            d.timestamp > weekStart && d.type === 'task_completed'
        );

        const message = `📊 تقرير الأسبوع

✅ إجمالي المهام المكتملة: ${weekTasks.length}
🎯 متوسط يومي: ${Math.round(weekTasks.length / 7)}

عمل رائع هذا الأسبوع! 🎉`;

        await sendWhatsAppMessage(GROUP_CHAT_ID, message);
        console.log('📅 Weekly report sent');
    }, { timezone: 'Africa/Cairo' });
}

// ========================= Test Endpoints ========================= //

app.get('/test-ai', async (req, res) => {
    const testTask = { name: 'اختبار المهمة', id: 'test-123' };
    const testChange = {
        field: 'status',
        before: 'In Progress',
        after: 'Complete',
        userName: 'أحمد'
    };

    const notification = await generateAINotification(testTask, testChange);
    res.json({ notification });
});

app.get('/test-whatsapp', async (req, res) => {
    if (!GROUP_CHAT_ID) {
        return res.json({ error: 'WhatsApp group not found' });
    }

    const sent = await sendWhatsAppMessage(GROUP_CHAT_ID, '🧪 Test message from server!');
    res.json({ sent, groupId: GROUP_CHAT_ID });
});

// ========================= Server Start ========================= //

initializeWhatsApp();

app.listen(CONFIG.PORT, '0.0.0.0', () => {
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║              ClickUp WhatsApp AI Notification System                      ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`🚀 Server running on: http://0.0.0.0:${CONFIG.PORT}`);
    console.log('');
    console.log('Features:');
    console.log(`   🤖 AI Notifications: ${anthropicClient ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   💪 Motivation: ${CONFIG.ENABLE_MOTIVATION ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   📊 Analytics: ${CONFIG.ENABLE_ANALYTICS ? '✅ Enabled' : '❌ Disabled'}`);
    console.log('');
    console.log('Endpoints:');
    console.log(`   GET  /webhook-test`);
    console.log(`   POST /task-updated-webhook`);
    console.log(`   POST /task-created-webhook`);
    console.log(`   GET  /api/dashboard-stats`);
    console.log(`   GET  /api/recent-activity`);
    console.log(`   GET  /api/team-stats`);
    console.log('');
    console.log('⏳ Waiting for WhatsApp to connect...');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    if (whatsappClient) {
        await whatsappClient.destroy();
    }
    process.exit(0);
});
