// ========================= DASHBOARD API ENDPOINTS ========================= //
// Endpoints لتشغيل لوحة التحكم وجميع الميزات المتقدمة

const express = require('express');
const path = require('path');
const fs = require('fs').promises;

const {
    ARABIC_COURSES,
    BADGE_SYSTEM,
    createWeeklyChallenges,
    formatWeeklyChallenges,
    getPersonalCoachAdvice,
    generateMonthlyReport,
    formatMonthlyReport
} = require('./advanced-features');

// ========================= Add Endpoints to Express App ========================= //

function addDashboardEndpoints(app) {
    const TEAM = require('./src/team');
    const PRODUCTIVITY_DATA_FILE = path.join(__dirname, 'productivity_data.json');

    // ========================= Dashboard Page ========================= //

    /**
     * عرض لوحة التحكم الرئيسية
     */
    app.get('/dashboard', (req, res) => {
        res.sendFile(path.join(__dirname, 'dashboard.html'));
    });

    // ========================= Stats API ========================= //

    /**
     * إحصائيات لوحة التحكم الرئيسية
     */
    app.get('/api/dashboard-stats', async (req, res) => {
        try {
            const data = await fs.readFile(PRODUCTIVITY_DATA_FILE, 'utf-8');
            const productivityData = JSON.parse(data);

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayStart = today.getTime();

            const weekAgo = todayStart - (7 * 24 * 60 * 60 * 1000);

            const todayTasks = productivityData.filter(d => d.timestamp >= todayStart);
            const weekTasks = productivityData.filter(d => d.timestamp >= weekAgo);

            const activeUsers = new Set(weekTasks.map(d => d.userId));

            res.json({
                totalTasks: productivityData.length,
                todayTasks: todayTasks.length,
                weekTasks: weekTasks.length,
                activeMembers: activeUsers.size
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * لوحة الصدارة
     */
    app.get('/api/leaderboard', async (req, res) => {
        try {
            const data = await fs.readFile(PRODUCTIVITY_DATA_FILE, 'utf-8');
            const productivityData = JSON.parse(data);

            const userStats = {};
            productivityData.forEach(item => {
                if (!userStats[item.userId]) {
                    userStats[item.userId] = { total: 0, week: 0, today: 0 };
                }
                userStats[item.userId].total++;

                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const weekAgo = today.getTime() - (7 * 24 * 60 * 60 * 1000);

                if (item.timestamp >= today.getTime()) {
                    userStats[item.userId].today++;
                }
                if (item.timestamp >= weekAgo) {
                    userStats[item.userId].week++;
                }
            });

            const leaderboard = Object.entries(userStats)
                .map(([user, stats]) => ({ user, ...stats }))
                .sort((a, b) => b.total - a.total)
                .slice(0, 10);

            res.json(leaderboard);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ========================= Badges API ========================= //

    /**
     * الحصول على جميع الشارات المتاحة
     */
    app.get('/api/badges', (req, res) => {
        res.json(BADGE_SYSTEM);
    });

    /**
     * الحصول على شارات مستخدم محدد
     */
    app.get('/api/badges/:userName', async (req, res) => {
        try {
            const userName = req.params.userName;
            const BADGES_FILE = path.join(__dirname, 'badges.json');

            const data = await fs.readFile(BADGES_FILE, 'utf-8');
            const allBadges = JSON.parse(data);
            const userBadges = allBadges[userName] || [];

            res.json(userBadges);
        } catch (error) {
            res.json([]);
        }
    });

    // ========================= Challenges API ========================= //

    /**
     * الحصول على تحديات الأسبوع الحالي
     */
    app.get('/api/challenges/current', async (req, res) => {
        try {
            const challenges = await formatWeeklyChallenges();
            res.send(challenges);
        } catch (error) {
            res.status(500).send(error.message);
        }
    });

    /**
     * إنشاء تحديات جديدة (يدوياً)
     */
    app.post('/api/challenges/create', async (req, res) => {
        try {
            const challenges = await createWeeklyChallenges();
            res.json(challenges);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ========================= Courses API ========================= //

    /**
     * الحصول على جميع الكورسات العربية
     */
    app.get('/api/courses/arabic', (req, res) => {
        res.json(ARABIC_COURSES);
    });

    /**
     * الحصول على كورسات حسب الفئة
     */
    app.get('/api/courses/:category', (req, res) => {
        const category = req.params.category;
        const courses = ARABIC_COURSES[category] || [];
        res.json(courses);
    });

    /**
     * البحث في الكورسات
     */
    app.get('/api/courses/search/:query', (req, res) => {
        const query = req.params.query.toLowerCase();
        const results = [];

        Object.entries(ARABIC_COURSES).forEach(([category, courses]) => {
            courses.forEach(course => {
                if (course.arabicTitle.toLowerCase().includes(query) ||
                    course.title.toLowerCase().includes(query)) {
                    results.push({ ...course, category });
                }
            });
        });

        res.json(results);
    });

    // ========================= AI Coach API ========================= //

    /**
     * الحصول على نصيحة شخصية من AI Coach
     */
    app.get('/api/coach/:userName', async (req, res) => {
        try {
            const userName = req.params.userName;

            // جمع إحصائيات المستخدم
            const data = await fs.readFile(PRODUCTIVITY_DATA_FILE, 'utf-8');
            const productivityData = JSON.parse(data);

            const userTasks = productivityData.filter(d => d.userId === userName);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const weekAgo = today.getTime() - (7 * 24 * 60 * 60 * 1000);

            const todayTasks = userTasks.filter(d => d.timestamp >= today.getTime());
            const weekTasks = userTasks.filter(d => d.timestamp >= weekAgo);

            const userStats = {
                totalCompleted: userTasks.length,
                todayCompleted: todayTasks.length,
                weekCompleted: weekTasks.length
            };

            // تحليل الإنتاجية
            const dayStats = {};
            userTasks.forEach(task => {
                const date = new Date(task.timestamp);
                const dayName = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][date.getDay()];
                dayStats[dayName] = (dayStats[dayName] || 0) + 1;
            });

            let mostProductiveDay = null;
            let maxCount = 0;
            Object.entries(dayStats).forEach(([day, count]) => {
                if (count > maxCount) {
                    maxCount = count;
                    mostProductiveDay = day;
                }
            });

            const skillsMap = {};
            userTasks.forEach(task => {
                if (task.categories) {
                    task.categories.forEach(cat => {
                        skillsMap[cat] = (skillsMap[cat] || 0) + 1;
                    });
                }
            });

            const topSkill = Object.entries(skillsMap).sort((a, b) => b[1] - a[1])[0];

            const productivity = {
                mostProductiveDay,
                topSkill: topSkill ? topSkill[0] : null
            };

            const advice = await getPersonalCoachAdvice(userName, userStats, productivity);

            res.json({
                userName,
                stats: userStats,
                productivity,
                advice
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ========================= Monthly Reports API ========================= //

    /**
     * توليد تقرير شهري
     */
    app.get('/api/report/monthly/:year/:month', async (req, res) => {
        try {
            const year = parseInt(req.params.year);
            const month = parseInt(req.params.month);

            const report = await generateMonthlyReport(month, year);
            const formatted = formatMonthlyReport(report);

            res.json({ report, formatted });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * الحصول على التقرير الشهري الحالي
     */
    app.get('/api/report/monthly/current', async (req, res) => {
        try {
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth() + 1;

            const report = await generateMonthlyReport(month, year);
            const formatted = formatMonthlyReport(report);

            res.json({ report, formatted });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * إرسال التقرير الشهري عبر WhatsApp
     */
    app.post('/api/report/monthly/send', async (req, res) => {
        try {
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth() + 1;

            const report = await generateMonthlyReport(month, year);
            const formatted = formatMonthlyReport(report);

            const GROUP_CHAT_ID = global.GROUP_CHAT_ID || req.body.groupChatId;

            if (GROUP_CHAT_ID && formatted) {
                const { cleanAndSendMessage } = require('./index');
                await cleanAndSendMessage(GROUP_CHAT_ID, formatted, { pin: true });
                res.json({ success: true, message: 'Report sent to WhatsApp group' });
            } else {
                res.status(400).json({ error: 'Group chat ID not found' });
            }
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ========================= Testing Endpoints ========================= //

    /**
     * اختبار إرسال تحديات الأسبوع
     */
    app.get('/test-weekly-challenges', async (req, res) => {
        try {
            const challenges = await formatWeeklyChallenges();
            res.send(`<pre>${challenges}</pre>`);
        } catch (error) {
            res.status(500).send(error.message);
        }
    });

    /**
     * اختبار AI Coach
     */
    app.get('/test-ai-coach/:userName', async (req, res) => {
        try {
            const result = await getPersonalCoachAdvice(
                req.params.userName,
                { totalCompleted: 45, todayCompleted: 3, weekCompleted: 12 },
                { mostProductiveDay: 'الإثنين', topSkill: 'تصميم' }
            );
            res.send(`<pre>${result}</pre>`);
        } catch (error) {
            res.status(500).send(error.message);
        }
    });

    console.log('✅ Dashboard API endpoints added successfully!');
    console.log('📊 Dashboard available at: http://localhost:5014/dashboard');
    console.log('🔗 API Documentation:');
    console.log('   GET  /api/dashboard-stats');
    console.log('   GET  /api/leaderboard');
    console.log('   GET  /api/badges');
    console.log('   GET  /api/badges/:userName');
    console.log('   GET  /api/challenges/current');
    console.log('   GET  /api/courses/arabic');
    console.log('   GET  /api/coach/:userName');
    console.log('   GET  /api/report/monthly/current');
}

module.exports = { addDashboardEndpoints };
