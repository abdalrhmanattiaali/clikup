// ========================= ADVANCED FEATURES - ULTRA POWERFUL SYSTEM ========================= //
// الميزات المتقدمة: كورسات عربية، شارات، تحديات، AI Coach، لوحة تحكم

require('dotenv').config();

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const CLAUDE_API_KEY = process.env.ANTHROPIC_API_KEY || "sk-ant-api03-YOUR-API-KEY-HERE";
const BADGES_FILE = path.join(__dirname, 'badges.json');
const CHALLENGES_FILE = path.join(__dirname, 'challenges.json');
const MONTHLY_REPORTS_FILE = path.join(__dirname, 'monthly_reports.json');

// ========================= EXPANDED ARABIC COURSES DATABASE ========================= //

const ARABIC_COURSES = {
    'تصميم': [
        {
            title: 'تعلم Figma من الصفر',
            platform: 'YouTube - Mizko Design',
            url: 'https://www.youtube.com/watch?v=FTFaQWZBqQ8',
            arabicTitle: 'دورة Figma الشاملة بالعربي',
            level: 'مبتدئ',
            duration: '3 ساعات',
            rating: 4.7,
            free: true
        },
        {
            title: 'تصميم الجرافيك الاحترافي',
            platform: 'إدراك',
            url: 'https://www.edraak.org/course/graphic-design/',
            arabicTitle: 'أساسيات تصميم الجرافيك',
            level: 'مبتدئ',
            duration: '6 أسابيع',
            rating: 4.6,
            free: true
        },
        {
            title: 'Adobe Photoshop بالعربي',
            platform: 'YouTube - Nour Homsi',
            url: 'https://www.youtube.com/playlist?list=PLYpJKvLDuJhgC7uNTCq-Bsl8rJYxeXhFy',
            arabicTitle: 'دورة فوتوشوب كاملة بالعربي',
            level: 'مبتدئ إلى متقدم',
            duration: '15 ساعة',
            rating: 4.8,
            free: true
        },
        {
            title: 'تصميم المواقع - UI/UX',
            platform: 'Coursera بالعربية',
            url: 'https://www.coursera.org/learn/ui-ux-design-ar',
            arabicTitle: 'مبادئ تصميم تجربة المستخدم',
            level: 'متوسط',
            duration: '4 أسابيع',
            rating: 4.5,
            free: false
        }
    ],
    'برمجة': [
        {
            title: 'تعلم Python بالعربي',
            platform: 'YouTube - Elzero Web School',
            url: 'https://www.youtube.com/playlist?list=PLDoPjvoNmBAyE_gei5d18qkfIe-Z8mocs',
            arabicTitle: 'مسار Python الشامل بالعربي',
            level: 'مبتدئ',
            duration: '20 ساعة',
            rating: 4.9,
            free: true
        },
        {
            title: 'تطوير الويب الحديث',
            platform: 'YouTube - Elzero Web School',
            url: 'https://www.youtube.com/c/ElzeroWebSchool',
            arabicTitle: 'HTML, CSS, JavaScript الشامل',
            level: 'مبتدئ إلى متقدم',
            duration: '50+ ساعة',
            rating: 4.9,
            free: true
        },
        {
            title: 'برمجة تطبيقات الموبايل',
            platform: 'Udemy بالعربية',
            url: 'https://www.udemy.com/course/flutter-arabic/',
            arabicTitle: 'تعلم Flutter بالعربي',
            level: 'متوسط',
            duration: '12 ساعة',
            rating: 4.6,
            free: false
        },
        {
            title: 'أساسيات البرمجة',
            platform: 'إدراك',
            url: 'https://www.edraak.org/course/introduction-to-programming/',
            arabicTitle: 'مقدمة في البرمجة',
            level: 'مبتدئ',
            duration: '8 أسابيع',
            rating: 4.7,
            free: true
        },
        {
            title: 'تعلم React.js',
            platform: 'YouTube - Unique Coderz Academy',
            url: 'https://www.youtube.com/playlist?list=PLtFbQRDJ11kEjXWZmwkOV-vfXmrEEsuEW',
            arabicTitle: 'دورة React الكاملة بالعربي',
            level: 'متوسط',
            duration: '10 ساعات',
            rating: 4.7,
            free: true
        }
    ],
    'تسويق': [
        {
            title: 'التسويق الرقمي المتكامل',
            platform: 'إدراك',
            url: 'https://www.edraak.org/course/digital-marketing/',
            arabicTitle: 'أساسيات التسويق الرقمي',
            level: 'مبتدئ',
            duration: '5 أسابيع',
            rating: 4.6,
            free: true
        },
        {
            title: 'التسويق بالمحتوى',
            platform: 'مهارات من Google',
            url: 'https://learndigital.withgoogle.com/maharatgoogle',
            arabicTitle: 'أساسيات التسويق الرقمي من جوجل',
            level: 'مبتدئ',
            duration: '40 ساعة',
            rating: 4.8,
            free: true
        },
        {
            title: 'إعلانات فيسبوك وإنستجرام',
            platform: 'YouTube - Ahmed Ghanem',
            url: 'https://www.youtube.com/c/AhmedGhanem',
            arabicTitle: 'احتراف إعلانات السوشيال ميديا',
            level: 'متوسط',
            duration: '8 ساعات',
            rating: 4.7,
            free: true
        },
        {
            title: 'SEO بالعربي',
            platform: 'YouTube - Digital Marketing',
            url: 'https://www.youtube.com/watch?v=XkuWU47S49M',
            arabicTitle: 'تحسين محركات البحث للمبتدئين',
            level: 'مبتدئ',
            duration: '6 ساعات',
            rating: 4.5,
            free: true
        }
    ],
    'كتابة محتوى': [
        {
            title: 'كتابة المحتوى الإبداعي',
            platform: 'إدراك',
            url: 'https://www.edraak.org/course/content-writing/',
            arabicTitle: 'أساسيات كتابة المحتوى',
            level: 'مبتدئ',
            duration: '4 أسابيع',
            rating: 4.6,
            free: true
        },
        {
            title: 'الكتابة للسوشيال ميديا',
            platform: 'YouTube - محمد الأمين',
            url: 'https://www.youtube.com/watch?v=social-writing',
            arabicTitle: 'فن كتابة المحتوى الجذاب',
            level: 'مبتدئ',
            duration: '3 ساعات',
            rating: 4.5,
            free: true
        }
    ],
    'إدارة مشاريع': [
        {
            title: 'إدارة المشاريع الاحترافية',
            platform: 'إدراك',
            url: 'https://www.edraak.org/course/project-management/',
            arabicTitle: 'مبادئ إدارة المشاريع',
            level: 'متوسط',
            duration: '6 أسابيع',
            rating: 4.7,
            free: true
        },
        {
            title: 'Agile و Scrum بالعربي',
            platform: 'YouTube',
            url: 'https://www.youtube.com/watch?v=agile-scrum',
            arabicTitle: 'منهجيات Agile للمبتدئين',
            level: 'مبتدئ',
            duration: '4 ساعات',
            rating: 4.6,
            free: true
        }
    ],
    'تحليل بيانات': [
        {
            title: 'تحليل البيانات باستخدام Excel',
            platform: 'إدراك',
            url: 'https://www.edraak.org/course/data-analysis-excel/',
            arabicTitle: 'Excel للمحللين',
            level: 'مبتدئ',
            duration: '5 أسابيع',
            rating: 4.7,
            free: true
        },
        {
            title: 'Power BI بالعربي',
            platform: 'YouTube - Data Science Arabia',
            url: 'https://www.youtube.com/watch?v=powerbi-arabic',
            arabicTitle: 'تصور البيانات مع Power BI',
            level: 'متوسط',
            duration: '8 ساعات',
            rating: 4.8,
            free: true
        },
        {
            title: 'علم البيانات بالعربي',
            platform: 'Coursera بالعربية',
            url: 'https://www.coursera.org/learn/data-science-ar',
            arabicTitle: 'مقدمة في علم البيانات',
            level: 'متوسط',
            duration: '6 أسابيع',
            rating: 4.6,
            free: false
        }
    ],
    'محاسبة': [
        {
            title: 'المحاسبة المالية',
            platform: 'إدراك',
            url: 'https://www.edraak.org/course/accounting/',
            arabicTitle: 'أساسيات المحاسبة',
            level: 'مبتدئ',
            duration: '6 أسابيع',
            rating: 4.5,
            free: true
        }
    ],
    'موارد بشرية': [
        {
            title: 'إدارة الموارد البشرية',
            platform: 'إدراك',
            url: 'https://www.edraak.org/course/human-resources/',
            arabicTitle: 'أساسيات الموارد البشرية',
            level: 'مبتدئ',
            duration: '5 أسابيع',
            rating: 4.6,
            free: true
        }
    ]
};

// ========================= COLORFUL BADGES SYSTEM ========================= //

const BADGE_SYSTEM = {
    // شارات الإنجاز (Achievement Badges)
    achievement: {
        'المبتدئ النشيط': {
            emoji: '🌱',
            color: '#4CAF50',
            tasks: 5,
            description: 'أول 5 مهام - رحلة الألف ميل تبدأ بخطوة!',
            rarity: 'common'
        },
        'المنجز الطموح': {
            emoji: '🔥',
            color: '#FF6B6B',
            tasks: 10,
            description: '10 مهام منجزة - الطموح يتحول إلى واقع!',
            rarity: 'common'
        },
        'المحترف الماهر': {
            emoji: '⚡',
            color: '#FFD700',
            tasks: 25,
            description: '25 مهمة - أنت محترف حقيقي!',
            rarity: 'rare'
        },
        'الخبير المتمكن': {
            emoji: '🏆',
            color: '#FF8C00',
            tasks: 50,
            description: '50 مهمة - خبرة لا تقدر بثمن!',
            rarity: 'rare'
        },
        'الأسطورة الحية': {
            emoji: '👑',
            color: '#9C27B0',
            tasks: 100,
            description: '100 مهمة - أنت أسطورة حقيقية!',
            rarity: 'epic'
        },
        'المايسترو الخارق': {
            emoji: '🌟',
            color: '#2196F3',
            tasks: 200,
            description: '200 مهمة - إتقان استثنائي!',
            rarity: 'epic'
        },
        'البطل الخارق': {
            emoji: '🦸',
            color: '#E91E63',
            tasks: 500,
            description: '500 مهمة - قوة خارقة!',
            rarity: 'legendary'
        },
        'الإمبراطور': {
            emoji: '⚜️',
            color: '#000000',
            tasks: 1000,
            description: '1000 مهمة - إمبراطور الإنتاجية!',
            rarity: 'legendary'
        }
    },

    // شارات السرعة (Speed Badges)
    speed: {
        'صاروخ اليوم': {
            emoji: '🚀',
            color: '#00BCD4',
            tasksInDay: 5,
            description: '5 مهام في يوم واحد - سرعة صاروخية!',
            rarity: 'rare'
        },
        'آلة الإنتاج': {
            emoji: '⚙️',
            color: '#607D8B',
            tasksInDay: 10,
            description: '10 مهام في يوم واحد - آلة لا تتوقف!',
            rarity: 'epic'
        },
        'البرق الأزرق': {
            emoji: '⚡',
            color: '#3F51B5',
            tasksInWeek: 30,
            description: '30 مهمة في أسبوع - سرعة البرق!',
            rarity: 'epic'
        }
    },

    // شارات التخصص (Specialty Badges)
    specialty: {
        'أسطورة التصميم': {
            emoji: '🎨',
            color: '#E91E63',
            category: 'تصميم',
            tasks: 50,
            description: 'خبير تصميم - 50 مهمة تصميم!',
            rarity: 'rare'
        },
        'ساحر الأكواد': {
            emoji: '💻',
            color: '#4CAF50',
            category: 'برمجة',
            tasks: 50,
            description: 'ساحر البرمجة - 50 مهمة برمجية!',
            rarity: 'rare'
        },
        'عبقري التسويق': {
            emoji: '📱',
            color: '#FF9800',
            category: 'تسويق',
            tasks: 50,
            description: 'خبير تسويق - 50 حملة ناجحة!',
            rarity: 'rare'
        }
    },

    // شارات السلسلة (Streak Badges)
    streak: {
        'النار المشتعلة': {
            emoji: '🔥',
            color: '#FF5722',
            days: 7,
            description: '7 أيام متواصلة من الإنجاز!',
            rarity: 'rare'
        },
        'الماراثون': {
            emoji: '🏃',
            color: '#009688',
            days: 30,
            description: '30 يوم متواصل - عزيمة لا تلين!',
            rarity: 'epic'
        },
        'السلسلة الذهبية': {
            emoji: '💫',
            color: '#FFD700',
            days: 100,
            description: '100 يوم متواصل - أسطوري!',
            rarity: 'legendary'
        }
    }
};

// ========================= WEEKLY CHALLENGES SYSTEM ========================= //

const CHALLENGE_TEMPLATES = [
    {
        name: 'تحدي السرعة',
        description: 'أنجز 20 مهمة هذا الأسبوع',
        type: 'speed',
        target: 20,
        reward: { points: 100, badge: 'صاروخ الأسبوع 🚀' },
        difficulty: 'medium'
    },
    {
        name: 'تحدي التنوع',
        description: 'أنجز مهام من 3 فئات مختلفة',
        type: 'diversity',
        target: 3,
        reward: { points: 150, badge: 'متعدد المواهب 🌈' },
        difficulty: 'hard'
    },
    {
        name: 'تحدي الاستمرارية',
        description: 'أنجز مهمة واحدة على الأقل كل يوم',
        type: 'consistency',
        target: 7,
        reward: { points: 200, badge: 'الماراثوني 🏃' },
        difficulty: 'hard'
    },
    {
        name: 'تحدي المبتدئين',
        description: 'أنجز 10 مهام هذا الأسبوع',
        type: 'beginner',
        target: 10,
        reward: { points: 50, badge: 'البداية القوية 💪' },
        difficulty: 'easy'
    },
    {
        name: 'تحدي الجودة',
        description: 'أنجز 5 مهام معقدة (تحتوي على subtasks)',
        type: 'quality',
        target: 5,
        reward: { points: 120, badge: 'محب التحديات 🎯' },
        difficulty: 'medium'
    }
];

async function createWeeklyChallenges() {
    try {
        // اختيار 3 تحديات عشوائية
        const shuffled = [...CHALLENGE_TEMPLATES].sort(() => Math.random() - 0.5);
        const selectedChallenges = shuffled.slice(0, 3);

        const weekNumber = getWeekNumber();
        const challenges = {
            week: weekNumber,
            startDate: Date.now(),
            endDate: Date.now() + (7 * 24 * 60 * 60 * 1000),
            challenges: selectedChallenges,
            participants: {}
        };

        let allChallenges = {};
        try {
            const data = await fs.readFile(CHALLENGES_FILE, 'utf-8');
            allChallenges = JSON.parse(data);
        } catch (error) {
            console.log('Creating new challenges file.');
        }

        allChallenges[weekNumber] = challenges;
        await fs.writeFile(CHALLENGES_FILE, JSON.stringify(allChallenges, null, 2));

        return challenges;
    } catch (error) {
        console.error('Error creating challenges:', error.message);
        return null;
    }
}

function getWeekNumber() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now - start;
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    return Math.floor(diff / oneWeek);
}

async function formatWeeklyChallenges() {
    const weekNumber = getWeekNumber();
    try {
        const data = await fs.readFile(CHALLENGES_FILE, 'utf-8');
        const allChallenges = JSON.parse(data);
        const weekChallenges = allChallenges[weekNumber];

        if (!weekChallenges) {
            const newChallenges = await createWeeklyChallenges();
            return formatChallengesMessage(newChallenges);
        }

        return formatChallengesMessage(weekChallenges);
    } catch (error) {
        const newChallenges = await createWeeklyChallenges();
        return formatChallengesMessage(newChallenges);
    }
}

function formatChallengesMessage(challenges) {
    if (!challenges) return null;

    let message = '🎯 *تحديات هذا الأسبوع*\n\n';
    message += `📅 الأسبوع رقم: ${challenges.week}\n\n`;

    challenges.challenges.forEach((challenge, index) => {
        const difficultyEmoji = challenge.difficulty === 'easy' ? '🟢' :
                               challenge.difficulty === 'medium' ? '🟡' : '🔴';
        message += `${index + 1}. ${difficultyEmoji} *${challenge.name}*\n`;
        message += `   ${challenge.description}\n`;
        message += `   المكافأة: ${challenge.reward.points} نقطة + ${challenge.reward.badge}\n\n`;
    });

    message += '💪 هل أنت مستعد للتحدي؟ ابدأ الآن!';

    return message;
}

// ========================= AI PERSONAL COACH ========================= //

async function getPersonalCoachAdvice(userName, userStats, productivity) {
    try {
        const systemPrompt = `أنت مدرب شخصي محترف ومتخصص في تطوير الإنتاجية والأداء.

مهمتك:
- تحليل أداء المستخدم بعمق
- تقديم نصائح شخصية دقيقة ومفيدة
- تحديد نقاط القوة والضعف
- اقتراح خطوات عملية للتحسين
- التحفيز بأسلوب إيجابي وداعم

خصائص نصائحك:
- شخصية ومخصصة للمستخدم
- عملية وقابلة للتطبيق
- إيجابية ومحفزة
- مبنية على البيانات الفعلية
- قصيرة ومباشرة (3-5 جمل)`;

        let userData = `اسم المستخدم: ${userName}\n\n`;
        userData += `الإحصائيات:\n`;
        userData += `- إجمالي المهام المنجزة: ${userStats.totalCompleted}\n`;
        userData += `- مهام اليوم: ${userStats.todayCompleted}\n`;
        userData += `- مهام الأسبوع: ${userStats.weekCompleted}\n`;
        userData += `- اليوم الأكثر إنتاجية: ${productivity.mostProductiveDay || 'غير متاح'}\n`;
        userData += `- المجال الأكثر عملاً: ${productivity.topSkill || 'غير متاح'}\n\n`;
        userData += `اكتب نصيحة شخصية قوية تساعد ${userName} على التحسين.`;

        const response = await axios.post(
            'https://api.anthropic.com/v1/messages',
            {
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 512,
                messages: [{ role: 'user', content: userData }],
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

        return response.data?.content?.[0]?.text?.trim() || 'استمر في العمل الرائع! 💪';
    } catch (error) {
        console.error('AI Coach Error:', error.response?.data || error.message);
        return 'استمر في العمل الرائع! كل يوم تصبح أفضل. 💪';
    }
}

// ========================= MONTHLY REPORTS ========================= //

async function generateMonthlyReport(month, year) {
    try {
        const fs = require('fs').promises;
        const path = require('path');
        const PRODUCTIVITY_DATA_FILE = path.join(__dirname, 'productivity_data.json');

        const data = await fs.readFile(PRODUCTIVITY_DATA_FILE, 'utf-8');
        const productivityData = JSON.parse(data);

        // فلترة بيانات الشهر المحدد
        const monthStart = new Date(year, month - 1, 1).getTime();
        const monthEnd = new Date(year, month, 0, 23, 59, 59).getTime();

        const monthData = productivityData.filter(d =>
            d.timestamp >= monthStart && d.timestamp <= monthEnd
        );

        // تحليل البيانات
        const userStats = {};
        monthData.forEach(item => {
            if (!userStats[item.userId]) {
                userStats[item.userId] = {
                    total: 0,
                    categories: {},
                    days: new Set()
                };
            }
            userStats[item.userId].total++;
            const date = new Date(item.timestamp).toDateString();
            userStats[item.userId].days.add(date);

            if (item.categories) {
                item.categories.forEach(cat => {
                    userStats[item.userId].categories[cat] =
                        (userStats[item.userId].categories[cat] || 0) + 1;
                });
            }
        });

        // بناء التقرير
        const report = {
            month,
            year,
            totalTasks: monthData.length,
            users: userStats,
            topPerformer: null,
            generatedAt: Date.now()
        };

        // إيجاد أفضل مؤدي
        let maxTasks = 0;
        for (const [user, stats] of Object.entries(userStats)) {
            if (stats.total > maxTasks) {
                maxTasks = stats.total;
                report.topPerformer = user;
            }
        }

        // حفظ التقرير
        let allReports = {};
        try {
            const reportsData = await fs.readFile(MONTHLY_REPORTS_FILE, 'utf-8');
            allReports = JSON.parse(reportsData);
        } catch (error) {
            console.log('Creating new monthly reports file.');
        }

        const reportKey = `${year}-${String(month).padStart(2, '0')}`;
        allReports[reportKey] = report;
        await fs.writeFile(MONTHLY_REPORTS_FILE, JSON.stringify(allReports, null, 2));

        return report;
    } catch (error) {
        console.error('Error generating monthly report:', error.message);
        return null;
    }
}

function formatMonthlyReport(report) {
    if (!report) return null;

    const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
                       'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

    let message = `📊 *التقرير الشهري - ${monthNames[report.month - 1]} ${report.year}*\n\n`;
    message += `📈 إجمالي المهام المنجزة: ${report.totalTasks}\n`;
    message += `👤 عدد الأعضاء النشطين: ${Object.keys(report.users).length}\n\n`;

    if (report.topPerformer) {
        const topStats = report.users[report.topPerformer];
        message += `🏆 *نجم الشهر: ${report.topPerformer}*\n`;
        message += `   المهام المنجزة: ${topStats.total}\n`;
        message += `   أيام العمل: ${topStats.days.size} يوم\n\n`;
    }

    message += `📋 *ملخص الفريق:*\n`;
    for (const [user, stats] of Object.entries(report.users)) {
        const avgPerDay = (stats.total / stats.days.size).toFixed(1);
        message += `\n@${user}:\n`;
        message += `  • المهام: ${stats.total}\n`;
        message += `  • المعدل اليومي: ${avgPerDay}\n`;

        const topCategory = Object.entries(stats.categories)
            .sort((a, b) => b[1] - a[1])[0];
        if (topCategory) {
            message += `  • التخصص: ${topCategory[0]} (${topCategory[1]} مهمة)\n`;
        }
    }

    message += `\n✨ شكراً لجميع أعضاء الفريق على هذا الإنجاز الرائع!`;

    return message;
}

// ========================= EXPORTS ========================= //

module.exports = {
    ARABIC_COURSES,
    BADGE_SYSTEM,
    CHALLENGE_TEMPLATES,
    createWeeklyChallenges,
    formatWeeklyChallenges,
    getPersonalCoachAdvice,
    generateMonthlyReport,
    formatMonthlyReport
};
