// ========================= INTEGRATION EXAMPLE ========================= //
// مثال على كيفية دمج النظام المحسّن مع index.js الحالي

const {
    analyzeTaskCategory,
    analyzeUserSkills,
    recommendCourses,
    formatCourseRecommendations,
    checkAndAwardAchievements,
    formatAchievementMessage,
    getRandomQuote,
    generateEnhancedMotivation
} = require('./enhanced-motivation');

// ========================= Integration Functions ========================= //

/**
 * دالة محسّنة لحفظ بيانات الإنتاجية مع تحليل نوع المهمة
 */
async function saveProductivityDataEnhanced(data, task) {
    const fs = require('fs').promises;
    const path = require('path');
    const PRODUCTIVITY_DATA_FILE = path.join(__dirname, 'productivity_data.json');

    try {
        let productivityData = [];
        try {
            const existingData = await fs.readFile(PRODUCTIVITY_DATA_FILE, 'utf-8');
            productivityData = JSON.parse(existingData);
        } catch (error) {
            console.log('Creating new productivity data file.');
        }

        // تحليل نوع المهمة
        const categories = analyzeTaskCategory(task);

        const enhancedData = {
            ...data,
            categories, // إضافة التصنيفات
            taskName: task.name,
            taskDescription: task.description || ''
        };

        productivityData.push(enhancedData);

        // Keep only last 90 days of data
        const ninetyDaysAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);
        productivityData = productivityData.filter(d => d.timestamp > ninetyDaysAgo);

        await fs.writeFile(PRODUCTIVITY_DATA_FILE, JSON.stringify(productivityData, null, 2));

        return enhancedData;
    } catch (error) {
        console.error('Error saving enhanced productivity data:', error.message);
    }
}

/**
 * إرسال رسالة صباحية محسّنة مع اقتباس وترشيح كورسات
 */
async function sendEnhancedAIMorning(member, stats, analytics, sendMessageFunc) {
    try {
        const { completedToday, openTasks, todayDue } = stats;

        // فحص الإنجازات
        const totalCompleted = analytics?.totalCompleted || 0;
        const weeklyCompleted = completedToday.length;
        const achievements = await checkAndAwardAchievements(member.name, totalCompleted, weeklyCompleted);

        // تحليل المهارات وترشيح الكورسات (مرة واحدة في الأسبوع)
        let courseRecommendations = null;
        const dayOfWeek = new Date().getDay();
        if (dayOfWeek === 1 && analytics) { // الإثنين فقط
            const fs = require('fs').promises;
            const path = require('path');
            const PRODUCTIVITY_DATA_FILE = path.join(__dirname, 'productivity_data.json');

            try {
                const data = await fs.readFile(PRODUCTIVITY_DATA_FILE, 'utf-8');
                const productivityData = JSON.parse(data);
                const userSkills = await analyzeUserSkills(member.name, productivityData);
                if (userSkills.length > 0) {
                    courseRecommendations = await recommendCourses(userSkills, member.name);
                }
            } catch (error) {
                console.log('No productivity data yet for course recommendations.');
            }
        }

        // بناء البيانات للـ AI
        const userData = `@${member.name} | مفتوحة: ${openTasks.length} | مستحقة اليوم: ${todayDue.length} | مكتملة البارحة: ${completedToday.length}`;

        // توليد رسالة تحفيزية قوية
        const motivationMsg = await generateEnhancedMotivation('morning', userData, achievements, courseRecommendations);

        // إضافة اقتباس عشوائي
        const quote = getRandomQuote();

        // بناء الرسالة الكاملة
        let fullMessage = `🌅 *صباح النشاط والإنجاز*\n\n`;
        fullMessage += `${motivationMsg}\n\n`;
        fullMessage += `---\n${quote}`;

        // إرسال رسالة الإنجازات إن وجدت
        if (achievements && achievements.length > 0) {
            const achievementMsg = formatAchievementMessage(achievements, member.name);
            if (achievementMsg && member.phone) {
                await sendMessageFunc(`${member.phone}@c.us`, achievementMsg);
                await new Promise(resolve => setTimeout(resolve, 2000)); // انتظار ثانيتين
            }
        }

        // إرسال الرسالة الصباحية
        if (member.phone) {
            await sendMessageFunc(`${member.phone}@c.us`, fullMessage);
        }

        // إرسال ترشيحات الكورسات (مرة واحدة في الأسبوع)
        if (courseRecommendations && courseRecommendations.length > 0 && member.phone) {
            await new Promise(resolve => setTimeout(resolve, 3000)); // انتظار 3 ثواني
            const coursesMsg = formatCourseRecommendations(courseRecommendations);
            if (coursesMsg) {
                await sendMessageFunc(`${member.phone}@c.us`, coursesMsg);
            }
        }

        return { success: true, achievements };
    } catch (error) {
        console.error(`Error in enhanced morning message for ${member.name}:`, error.message);
        return { success: false, error: error.message };
    }
}

/**
 * إرسال رسالة نهاية اليوم محسّنة مع احتفال بالإنجازات
 */
async function sendEnhancedAIDaily(member, stats, analytics, sendMessageFunc) {
    try {
        const { completedToday, openTasks, overdue } = stats;

        // فحص الإنجازات
        const totalCompleted = analytics?.totalCompleted || 0;
        const weeklyCompleted = completedToday.length;
        const achievements = await checkAndAwardAchievements(member.name, totalCompleted, weeklyCompleted);

        const total = openTasks.length + completedToday.length;
        const rate = total ? Math.round((completedToday.length / total) * 100) : 0;

        const userData = `@${member.name} | مكتملة اليوم: ${completedToday.length} | مفتوحة: ${openTasks.length} | متأخرة: ${overdue.length} | نسبة الإنجاز: ${rate}%`;

        // توليد رسالة تحفيزية
        const motivationMsg = await generateEnhancedMotivation('daily_summary', userData, achievements, analytics?.dayStats);

        // اختيار اقتباس مناسب
        const quote = completedToday.length > 3 ? getRandomQuote('نجاح') : getRandomQuote('مثابرة');

        let fullMessage = `🌙 *ملخص يومك*\n\n`;
        fullMessage += `${motivationMsg}\n\n`;

        if (achievements && achievements.length > 0) {
            fullMessage += `\n🎊 *إنجازات جديدة!*\n`;
            achievements.forEach(a => {
                fullMessage += `${a.emoji} ${a.name}: ${a.message}\n`;
            });
            fullMessage += `\n`;
        }

        fullMessage += `---\n${quote}`;

        if (member.phone) {
            await sendMessageFunc(`${member.phone}@c.us`, fullMessage);
        }

        return { success: true, achievements };
    } catch (error) {
        console.error(`Error in enhanced daily message for ${member.name}:`, error.message);
        return { success: false, error: error.message };
    }
}

/**
 * إرسال ملخص الفريق مع أقوال مأثورة وإنجازات جماعية
 */
async function sendEnhancedGroupSummary(teamStats, sendMessageFunc, GROUP_CHAT_ID) {
    try {
        const { totalCompleted, topPerformer, topCount, teamMembers } = teamStats;

        // بناء البيانات
        let userData = `إجمالي المهام المنجزة: ${totalCompleted}\n`;
        userData += `أفضل أداء: @${topPerformer} (${topCount} مهام)\n\n`;
        userData += `أعضاء الفريق:\n`;
        teamMembers.forEach(m => {
            userData += `- ${m.name}: ${m.completed} مهمة\n`;
        });

        // توليد رسالة تحفيزية جماعية
        const motivationMsg = await generateEnhancedMotivation('team_summary', userData);

        // اختيار اقتباس ملهم
        const quote = getRandomQuote('نجاح');

        let fullMessage = `🎯 *ملخص إنجازات الفريق*\n\n`;
        fullMessage += `${motivationMsg}\n\n`;
        fullMessage += `📊 *الإحصائيات:*\n`;
        fullMessage += `• إجمالي المهام: ${totalCompleted} مهمة\n`;
        fullMessage += `• نجم اليوم: @${topPerformer} 🌟 (${topCount} مهام)\n\n`;
        fullMessage += `---\n${quote}`;

        if (GROUP_CHAT_ID) {
            await sendMessageFunc(GROUP_CHAT_ID, fullMessage);
        }

        return { success: true };
    } catch (error) {
        console.error('Error in enhanced group summary:', error.message);
        return { success: false, error: error.message };
    }
}

// ========================= Examples of Usage ========================= //

/**
 * مثال على الاستخدام في نظام الإشعارات
 */
async function exampleTaskCompletionHandler(task, updaterName) {
    // 1. حفظ البيانات مع التحليل
    const data = {
        type: 'task_completed',
        taskId: task.id,
        userId: updaterName,
        timestamp: Date.now(),
        isSubtask: !!task.parent,
        parentId: task.parent || null
    };

    await saveProductivityDataEnhanced(data, task);

    // 2. فحص الإنجازات الجديدة
    const fs = require('fs').promises;
    const path = require('path');
    const PRODUCTIVITY_DATA_FILE = path.join(__dirname, 'productivity_data.json');

    try {
        const allData = JSON.parse(await fs.readFile(PRODUCTIVITY_DATA_FILE, 'utf-8'));
        const userTasks = allData.filter(d => d.userId === updaterName && d.type === 'task_completed');
        const totalCompleted = userTasks.length;

        // فحص الإنجازات
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const weeklyTasks = userTasks.filter(d => d.timestamp >= today.getTime() - 7 * 24 * 60 * 60 * 1000);

        const achievements = await checkAndAwardAchievements(updaterName, totalCompleted, weeklyTasks.length);

        // إرسال رسالة فورية عند تحقيق إنجاز جديد
        if (achievements && achievements.length > 0) {
            const achievementMsg = formatAchievementMessage(achievements, updaterName);
            console.log('🎊 New Achievement:', achievementMsg);
            // هنا يمكن إرسال الرسالة عبر WhatsApp
        }
    } catch (error) {
        console.error('Error checking achievements:', error.message);
    }
}

// ========================= Express Endpoints ========================= //

/**
 * Endpoints جديدة للاختبار
 */
function addEnhancedEndpoints(app) {
    const TEAM = require('./src/team');

    // اختبار رسالة صباحية محسّنة
    app.get('/test-enhanced-morning/:user', async (req, res) => {
        try {
            const member = TEAM.find(m => m.name === req.params.user);
            if (!member) return res.status(404).send('User not found');

            // بيانات تجريبية
            const stats = {
                completedToday: [],
                openTasks: Array(5).fill({}),
                todayDue: Array(2).fill({})
            };

            const analytics = {
                totalCompleted: 25,
                mostProductiveDay: 'الإثنين',
                mostProductiveDayCount: 5
            };

            const result = await sendEnhancedAIMorning(member, stats, analytics, async (chatId, msg) => {
                console.log(`[SEND TO ${chatId}]\n${msg}\n`);
            });

            res.json(result);
        } catch (error) {
            res.status(500).send(error.message);
        }
    });

    // اختبار ترشيحات الكورسات
    app.get('/test-course-recommendations/:user', async (req, res) => {
        try {
            const userName = req.params.user;
            const fs = require('fs').promises;
            const path = require('path');
            const PRODUCTIVITY_DATA_FILE = path.join(__dirname, 'productivity_data.json');

            const data = await fs.readFile(PRODUCTIVITY_DATA_FILE, 'utf-8');
            const productivityData = JSON.parse(data);

            const userSkills = await analyzeUserSkills(userName, productivityData);
            const recommendations = await recommendCourses(userSkills, userName);
            const message = formatCourseRecommendations(recommendations);

            res.send(`<pre>${message}</pre>`);
        } catch (error) {
            res.status(500).send(error.message);
        }
    });

    // اختبار الإنجازات
    app.get('/test-achievements/:user', async (req, res) => {
        try {
            const userName = req.params.user;
            const totalTasks = parseInt(req.query.total || '10');
            const weeklyTasks = parseInt(req.query.weekly || '5');

            const achievements = await checkAndAwardAchievements(userName, totalTasks, weeklyTasks);
            const message = formatAchievementMessage(achievements, userName);

            res.send(`<pre>${message || 'لا توجد إنجازات جديدة'}</pre>`);
        } catch (error) {
            res.status(500).send(error.message);
        }
    });

    // اختبار اقتباس عشوائي
    app.get('/test-quote/:category?', async (req, res) => {
        try {
            const category = req.params.category;
            const quote = getRandomQuote(category);
            res.send(`<pre>${quote}</pre>`);
        } catch (error) {
            res.status(500).send(error.message);
        }
    });

    // عرض جميع الإنجازات
    app.get('/achievements/:user', async (req, res) => {
        try {
            const userName = req.params.user;
            const fs = require('fs').promises;
            const path = require('path');
            const ACHIEVEMENTS_FILE = path.join(__dirname, 'achievements.json');

            const data = await fs.readFile(ACHIEVEMENTS_FILE, 'utf-8');
            const allAchievements = JSON.parse(data);
            const userAchievements = allAchievements[userName];

            if (!userAchievements) {
                return res.json({ message: 'لا توجد إنجازات بعد' });
            }

            res.json(userAchievements);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    console.log('✅ Enhanced endpoints added successfully!');
}

// ========================= Exports ========================= //

module.exports = {
    saveProductivityDataEnhanced,
    sendEnhancedAIMorning,
    sendEnhancedAIDaily,
    sendEnhancedGroupSummary,
    exampleTaskCompletionHandler,
    addEnhancedEndpoints
};
