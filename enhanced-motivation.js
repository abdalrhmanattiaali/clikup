// ========================= ENHANCED MOTIVATION SYSTEM ========================= //
// نظام التحفيز المتقدم مع تحليل المهام وترشيح الكورسات

require('dotenv').config();

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const CLAUDE_API_KEY = process.env.ANTHROPIC_API_KEY || "sk-ant-api03-YOUR-API-KEY-HERE";
const ACHIEVEMENTS_FILE = path.join(__dirname, 'achievements.json');
const COURSES_DATA_FILE = path.join(__dirname, 'course_recommendations.json');

// ========================= Task Analysis & Categorization ========================= //

/**
 * تحليل نوع المهمة بناءً على الاسم والوصف
 */
function analyzeTaskCategory(task) {
    const taskText = `${task.name} ${task.description || ''}`.toLowerCase();

    const categories = {
        'تصميم': ['design', 'ui', 'ux', 'تصميم', 'واجهة', 'جرافيك', 'graphic', 'mockup', 'prototype', 'figma', 'photoshop'],
        'برمجة': ['code', 'coding', 'برمجة', 'develop', 'programming', 'javascript', 'python', 'react', 'api', 'backend', 'frontend', 'bug', 'fix'],
        'تسويق': ['marketing', 'تسويق', 'إعلان', 'campaign', 'social media', 'seo', 'content', 'محتوى'],
        'مبيعات': ['sales', 'مبيعات', 'عميل', 'client', 'deal', 'proposal', 'عرض'],
        'إدارة مشاريع': ['project', 'مشروع', 'meeting', 'اجتماع', 'planning', 'تخطيط', 'coordination'],
        'كتابة محتوى': ['writing', 'كتابة', 'article', 'مقال', 'blog', 'copywriting', 'محتوى'],
        'تحليل بيانات': ['data', 'analytics', 'تحليل', 'report', 'تقرير', 'statistics', 'metrics'],
        'دعم فني': ['support', 'دعم', 'help', 'مساعدة', 'issue', 'ticket', 'customer service'],
        'محاسبة': ['accounting', 'محاسبة', 'invoice', 'فاتورة', 'finance', 'مالية', 'budget'],
        'موارد بشرية': ['hr', 'hiring', 'توظيف', 'recruitment', 'interview', 'مقابلة']
    };

    const detectedCategories = [];
    for (const [category, keywords] of Object.entries(categories)) {
        if (keywords.some(keyword => taskText.includes(keyword))) {
            detectedCategories.push(category);
        }
    }

    return detectedCategories.length > 0 ? detectedCategories : ['عام'];
}

/**
 * تحليل مهارات المستخدم بناءً على المهام المنجزة
 */
async function analyzeUserSkills(userId, productivityData) {
    const userTasks = productivityData.filter(d => d.userId === userId);
    const skillsMap = {};

    for (const task of userTasks) {
        const categories = task.categories || ['عام'];
        categories.forEach(cat => {
            skillsMap[cat] = (skillsMap[cat] || 0) + 1;
        });
    }

    // ترتيب المهارات حسب التكرار
    const sortedSkills = Object.entries(skillsMap)
        .sort((a, b) => b[1] - a[1])
        .map(([skill, count]) => ({ skill, count }));

    return sortedSkills;
}

// ========================= Course Recommendations System ========================= //

const COURSE_DATABASE = {
    'تصميم': [
        {
            title: 'UI/UX Design Masterclass',
            platform: 'Udemy',
            url: 'https://www.udemy.com/course/ui-ux-web-design-using-figma/',
            arabicTitle: 'دورة تصميم واجهات المستخدم المتقدمة',
            level: 'متوسط',
            duration: '12 ساعة',
            rating: 4.7
        },
        {
            title: 'Google UX Design Professional Certificate',
            platform: 'Coursera',
            url: 'https://www.coursera.org/professional-certificates/google-ux-design',
            arabicTitle: 'شهادة جوجل الاحترافية في تصميم تجربة المستخدم',
            level: 'مبتدئ إلى متقدم',
            duration: '6 أشهر',
            rating: 4.8
        },
        {
            title: 'Figma للمبتدئين',
            platform: 'YouTube - Mizko Design',
            url: 'https://www.youtube.com/watch?v=FTFaQWZBqQ8',
            arabicTitle: 'تعلم Figma من الصفر بالعربي',
            level: 'مبتدئ',
            duration: '3 ساعات',
            rating: 4.6
        }
    ],
    'برمجة': [
        {
            title: 'The Complete JavaScript Course',
            platform: 'Udemy',
            url: 'https://www.udemy.com/course/the-complete-javascript-course/',
            arabicTitle: 'الدورة الكاملة لتعلم JavaScript',
            level: 'مبتدئ إلى متقدم',
            duration: '69 ساعة',
            rating: 4.7
        },
        {
            title: 'CS50: Introduction to Computer Science',
            platform: 'Harvard - edX',
            url: 'https://www.edx.org/course/cs50s-introduction-to-computer-science',
            arabicTitle: 'مقدمة علوم الحاسب من جامعة هارفارد',
            level: 'مبتدئ',
            duration: '12 أسبوع',
            rating: 4.9
        },
        {
            title: 'فري كود كامب - تعلم البرمجة بالعربي',
            platform: 'FreeCodeCamp Arabic',
            url: 'https://www.freecodecamp.org/arabic/',
            arabicTitle: 'منصة تعليم البرمجة المجانية بالعربي',
            level: 'جميع المستويات',
            duration: 'ذاتي',
            rating: 4.8
        }
    ],
    'تسويق': [
        {
            title: 'Digital Marketing Specialization',
            platform: 'Coursera',
            url: 'https://www.coursera.org/specializations/digital-marketing',
            arabicTitle: 'تخصص التسويق الرقمي',
            level: 'متوسط',
            duration: '6 أشهر',
            rating: 4.6
        },
        {
            title: 'إدارة وسائل التواصل الاجتماعي',
            platform: 'إدراك',
            url: 'https://www.edraak.org/course/social-media-marketing/',
            arabicTitle: 'التسويق عبر وسائل التواصل الاجتماعي',
            level: 'مبتدئ',
            duration: '4 أسابيع',
            rating: 4.5
        }
    ],
    'تحليل بيانات': [
        {
            title: 'Google Data Analytics Professional Certificate',
            platform: 'Coursera',
            url: 'https://www.coursera.org/professional-certificates/google-data-analytics',
            arabicTitle: 'شهادة جوجل الاحترافية في تحليل البيانات',
            level: 'مبتدئ',
            duration: '6 أشهر',
            rating: 4.8
        },
        {
            title: 'Python for Data Science',
            platform: 'DataCamp',
            url: 'https://www.datacamp.com/tracks/data-scientist-with-python',
            arabicTitle: 'بايثون لعلوم البيانات',
            level: 'متوسط',
            duration: '88 ساعة',
            rating: 4.7
        }
    ],
    'إدارة مشاريع': [
        {
            title: 'PMP Certification Training',
            platform: 'Simplilearn',
            url: 'https://www.simplilearn.com/pmp-certification-exam-prep-training-course',
            arabicTitle: 'دورة شهادة إدارة المشاريع الاحترافية',
            level: 'متقدم',
            duration: '35 ساعة',
            rating: 4.6
        },
        {
            title: 'Agile & Scrum Masterclass',
            platform: 'Udemy',
            url: 'https://www.udemy.com/course/agile-scrum-master-certification/',
            arabicTitle: 'إتقان منهجيات Agile و Scrum',
            level: 'متوسط',
            duration: '14 ساعة',
            rating: 4.5
        }
    ],
    'كتابة محتوى': [
        {
            title: 'Content Writing Masterclass',
            platform: 'Udemy',
            url: 'https://www.udemy.com/course/content-writing-masterclass/',
            arabicTitle: 'إتقان كتابة المحتوى',
            level: 'مبتدئ إلى متوسط',
            duration: '10 ساعات',
            rating: 4.6
        },
        {
            title: 'SEO Content Writing',
            platform: 'HubSpot Academy',
            url: 'https://academy.hubspot.com/courses/content-marketing',
            arabicTitle: 'كتابة المحتوى التسويقي',
            level: 'مبتدئ',
            duration: '5 ساعات',
            rating: 4.7
        }
    ]
};

/**
 * ترشيح كورسات بناءً على المهارات المستخدمة
 */
async function recommendCourses(userSkills, userId) {
    const recommendations = [];

    for (const { skill, count } of userSkills.slice(0, 3)) {
        if (COURSE_DATABASE[skill]) {
            const courses = COURSE_DATABASE[skill];
            // اختيار كورس واحد أو اثنين من كل مهارة
            const selectedCourses = courses.slice(0, 2);
            recommendations.push({
                skill,
                taskCount: count,
                courses: selectedCourses
            });
        }
    }

    // حفظ الترشيحات
    await saveCourseRecommendations(userId, recommendations);

    return recommendations;
}

async function saveCourseRecommendations(userId, recommendations) {
    try {
        let allRecommendations = {};
        try {
            const data = await fs.readFile(COURSES_DATA_FILE, 'utf-8');
            allRecommendations = JSON.parse(data);
        } catch (error) {
            console.log('Creating new course recommendations file.');
        }

        allRecommendations[userId] = {
            timestamp: Date.now(),
            recommendations
        };

        await fs.writeFile(COURSES_DATA_FILE, JSON.stringify(allRecommendations, null, 2));
    } catch (error) {
        console.error('Error saving course recommendations:', error.message);
    }
}

/**
 * تنسيق رسالة ترشيح الكورسات
 */
function formatCourseRecommendations(recommendations) {
    if (!recommendations || recommendations.length === 0) {
        return null;
    }

    let message = '📚 *كورسات مُرشّحة لك بناءً على مهامك:*\n\n';

    for (const rec of recommendations) {
        message += `🎯 *مهارة: ${rec.skill}* (استخدمتها في ${rec.taskCount} مهمة)\n\n`;

        for (const course of rec.courses) {
            message += `📖 *${course.arabicTitle}*\n`;
            message += `   المنصة: ${course.platform}\n`;
            message += `   المستوى: ${course.level}\n`;
            message += `   المدة: ${course.duration}\n`;
            message += `   التقييم: ${course.rating}/5 ⭐\n`;
            message += `   🔗 ${course.url}\n\n`;
        }
    }

    message += '💡 *نصيحة:* الاستثمار في تطوير مهاراتك اليوم سيضاعف إنتاجيتك غداً!';

    return message;
}

// ========================= Achievement & Milestones System ========================= //

const ACHIEVEMENT_MILESTONES = {
    'المبتدئ': { tasks: 5, emoji: '🌱', message: 'بداية رائعة! أول 5 مهام مكتملة' },
    'الطموح': { tasks: 10, emoji: '🔥', message: 'قوة لا تُصدق! 10 مهام منجزة' },
    'المحترف': { tasks: 25, emoji: '⚡', message: 'أنت محترف حقيقي! 25 مهمة' },
    'الخبير': { tasks: 50, emoji: '🏆', message: 'خبير ماهر! نصف المئة' },
    'الأسطورة': { tasks: 100, emoji: '👑', message: 'أسطورة حية! 100 مهمة مكتملة' },
    'المايسترو': { tasks: 200, emoji: '🌟', message: 'مايسترو الإنتاجية! 200 مهمة' },
    'البطل الخارق': { tasks: 500, emoji: '🦸', message: 'بطل خارق! 500 مهمة منجزة' }
};

const WEEKLY_ACHIEVEMENTS = {
    'المنجز': { tasks: 10, emoji: '💪', message: 'أسبوع مثمر! 10 مهام في أسبوع واحد' },
    'النجم': { tasks: 20, emoji: '⭐', message: 'نجم الأسبوع! 20 مهمة' },
    'الآلة': { tasks: 30, emoji: '🚀', message: 'آلة إنتاجية! 30 مهمة في أسبوع' },
    'الإعجوبة': { tasks: 50, emoji: '🎯', message: 'إعجوبة الإنتاجية! 50 مهمة أسبوعياً' }
};

/**
 * فحص وإضافة الإنجازات الجديدة
 */
async function checkAndAwardAchievements(userId, totalCompleted, weeklyCompleted) {
    let achievements = await loadAchievements();

    if (!achievements[userId]) {
        achievements[userId] = {
            milestones: [],
            weeklyRecords: [],
            totalTasks: 0,
            lastUpdated: Date.now()
        };
    }

    const userAchievements = achievements[userId];
    const newAchievements = [];

    // فحص الإنجازات الإجمالية
    for (const [name, milestone] of Object.entries(ACHIEVEMENT_MILESTONES)) {
        if (totalCompleted >= milestone.tasks && !userAchievements.milestones.includes(name)) {
            userAchievements.milestones.push(name);
            newAchievements.push({
                type: 'milestone',
                name,
                emoji: milestone.emoji,
                message: milestone.message,
                timestamp: Date.now()
            });
        }
    }

    // فحص الإنجازات الأسبوعية
    for (const [name, achievement] of Object.entries(WEEKLY_ACHIEVEMENTS)) {
        if (weeklyCompleted >= achievement.tasks) {
            const achievementKey = `weekly_${name}_${getWeekNumber()}`;
            if (!userAchievements.weeklyRecords.includes(achievementKey)) {
                userAchievements.weeklyRecords.push(achievementKey);
                newAchievements.push({
                    type: 'weekly',
                    name,
                    emoji: achievement.emoji,
                    message: achievement.message,
                    timestamp: Date.now()
                });
            }
        }
    }

    userAchievements.totalTasks = totalCompleted;
    userAchievements.lastUpdated = Date.now();

    await saveAchievements(achievements);

    return newAchievements;
}

function getWeekNumber() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now - start;
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    return Math.floor(diff / oneWeek);
}

async function loadAchievements() {
    try {
        const data = await fs.readFile(ACHIEVEMENTS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        return {};
    }
}

async function saveAchievements(achievements) {
    try {
        await fs.writeFile(ACHIEVEMENTS_FILE, JSON.stringify(achievements, null, 2));
    } catch (error) {
        console.error('Error saving achievements:', error.message);
    }
}

/**
 * تنسيق رسالة الإنجازات الجديدة
 */
function formatAchievementMessage(achievements, userName) {
    if (!achievements || achievements.length === 0) return null;

    let message = `🎊 *تهانينا ${userName}!* 🎊\n\n`;
    message += `لقد حققت إنجازات جديدة:\n\n`;

    for (const achievement of achievements) {
        message += `${achievement.emoji} *${achievement.name}*\n`;
        message += `   ${achievement.message}\n\n`;
    }

    message += `✨ استمر في هذا الإبداع! كل خطوة تقربك من النجاح الأكبر.`;

    return message;
}

// ========================= Famous Quotes & Powerful Messages ========================= //

const FAMOUS_QUOTES = [
    { quote: 'النجاح ليس نهائياً، والفشل ليس قاتلاً، الشجاعة للاستمرار هي ما يهم.', author: 'وينستون تشرشل', category: 'نجاح' },
    { quote: 'الطريقة الوحيدة للقيام بعمل عظيم هي أن تحب ما تفعله.', author: 'ستيف جوبز', category: 'شغف' },
    { quote: 'لا تشاهد الساعة، افعل ما تفعله. استمر في المضي قدماً.', author: 'سام ليفنسون', category: 'مثابرة' },
    { quote: 'المستقبل ملك لأولئك الذين يؤمنون بجمال أحلامهم.', author: 'إليانور روزفلت', category: 'أحلام' },
    { quote: 'الطريق إلى النجاح والطريق إلى الفشل متطابقان تقريباً.', author: 'كولين ديفيس', category: 'نجاح' },
    { quote: 'لا تخف من التخلي عن الجيد من أجل العظيم.', author: 'جون روكفلر', category: 'طموح' },
    { quote: 'أنا لم أفشل، بل وجدت 10,000 طريقة لا تعمل.', author: 'توماس إديسون', category: 'إصرار' },
    { quote: 'إما أن تدير يومك أو أن يديرك اليوم.', author: 'جيم رون', category: 'إدارة وقت' },
    { quote: 'لا يُقاس النجاح بالموقع الذي بلغه المرء في الحياة، بقدر ما يُقاس بالصعاب التي تغلب عليها.', author: 'بوكر واشنطن', category: 'تحدي' },
    { quote: 'ابدأ من حيث أنت، استخدم ما لديك، افعل ما تستطيع.', author: 'آرثر آش', category: 'بداية' },
    { quote: 'النجاح هو المعلم السيء، إنه يُغري الأذكياء بالاعتقاد أنهم لا يمكن أن يخسروا.', author: 'بيل غيتس', category: 'تواضع' },
    { quote: 'الأشخاص الذين يكونون مجانين بما يكفي للاعتقاد بأنهم يستطيعون تغيير العالم، هم من يفعلون ذلك.', author: 'ستيف جوبز', category: 'تغيير' },
    { quote: 'إذا أردت شيئاً لم تحصل عليه من قبل، عليك أن تفعل شيئاً لم تفعله من قبل.', author: 'توماس جيفرسون', category: 'تغيير' },
    { quote: 'ليس الأقوى من البقاء على قيد الحياة، ولا الأذكى، بل الأكثر استجابة للتغيير.', author: 'تشارلز داروين', category: 'تكيف' },
    { quote: 'كل إنجاز عظيم كان في البداية مستحيلاً.', author: 'مجهول', category: 'إنجاز' },
    { quote: 'النجاح لا يأتي من ما تفعله أحياناً، بل من ما تفعله دائماً.', author: 'مجهول', category: 'استمرارية' },
    { quote: 'لا تنتظر الفرصة، اصنعها.', author: 'جورج برنارد شو', category: 'مبادرة' },
    { quote: 'القيادة هي القدرة على ترجمة الرؤية إلى واقع.', author: 'وارن بينيس', category: 'قيادة' },
    { quote: 'التفاؤل هو الإيمان الذي يؤدي إلى الإنجاز.', author: 'هيلين كيلر', category: 'تفاؤل' },
    { quote: 'أنت أشجع مما تعتقد، وأقوى مما تبدو، وأذكى مما تعتقد.', author: 'أ.أ. ميلن', category: 'قوة' }
];

const ARABIC_QUOTES = [
    { quote: 'من جد وجد، ومن سار على الدرب وصل.', author: 'مثل عربي', category: 'مثابرة' },
    { quote: 'العلم في الصغر كالنقش على الحجر.', author: 'مثل عربي', category: 'تعلم' },
    { quote: 'إن غداً لناظره قريب.', author: 'مثل عربي', category: 'أمل' },
    { quote: 'خير الكلام ما قل ودل.', author: 'مثل عربي', category: 'حكمة' },
    { quote: 'الصبر مفتاح الفرج.', author: 'مثل عربي', category: 'صبر' },
    { quote: 'لا تؤجل عمل اليوم إلى الغد.', author: 'مثل عربي', category: 'عمل' },
    { quote: 'من طلب العلا سهر الليالي.', author: 'مثل عربي', category: 'طموح' },
    { quote: 'الوقت كالسيف إن لم تقطعه قطعك.', author: 'مثل عربي', category: 'وقت' },
    { quote: 'العقل السليم في الجسم السليم.', author: 'مثل عربي', category: 'صحة' },
    { quote: 'ليس الذكاء أن تعرف كل شيء، بل أن تعرف أين تجد ما تريد.', author: 'حكمة عربية', category: 'ذكاء' }
];

/**
 * اختيار اقتباس عشوائي مناسب
 */
function getRandomQuote(category = null) {
    const allQuotes = [...FAMOUS_QUOTES, ...ARABIC_QUOTES];

    let filteredQuotes = allQuotes;
    if (category) {
        filteredQuotes = allQuotes.filter(q => q.category === category);
        if (filteredQuotes.length === 0) filteredQuotes = allQuotes;
    }

    const randomIndex = Math.floor(Math.random() * filteredQuotes.length);
    const quote = filteredQuotes[randomIndex];

    return `💭 *"${quote.quote}"*\n\n— ${quote.author}`;
}

// ========================= Enhanced Motivation with Claude ========================= //

async function generateEnhancedMotivation(type, userData, achievements = null, courses = null) {
    try {
        const systemPrompt = `أنت مدرب تحفيز ونجاح عالمي، متخصص في إلهام الفرق العربية بأسلوب قوي ومؤثر.

مهمتك:
- كتابة رسائل تحفيزية قوية جداً تُلهم وتُحفز
- استخدام لغة قوية وحماسية ولكن صادقة وإنسانية
- ربط الإنجازات بالنجاحات المستقبلية
- إضافة رؤى ذكية ونصائح عملية
- الاحتفاء بالإنجازات مهما كانت صغيرة

خصائص رسائلك:
- قوية ومباشرة وملهمة
- تستخدم العربية الفصحى الجميلة
- تحتوي على رؤى ونصائح عملية
- شخصية ومخصصة للمستخدم
- متفائلة ولكن واقعية
- طول الرسالة: 3-5 جمل قوية

استخدم:
✨ أمثلة من الواقع
🎯 نصائح عملية قابلة للتطبيق
💪 كلمات تحفيزية قوية
🌟 ربط بالأهداف والطموحات`;

        let userMessage = `نوع الرسالة: ${type}\n\n`;
        userMessage += `بيانات المستخدم:\n${userData}\n\n`;

        if (achievements && achievements.length > 0) {
            userMessage += `الإنجازات الجديدة:\n`;
            achievements.forEach(a => {
                userMessage += `- ${a.name}: ${a.message}\n`;
            });
            userMessage += `\n`;
        }

        if (courses && courses.length > 0) {
            userMessage += `لديه خبرة في المهارات التالية:\n`;
            courses.forEach(c => {
                userMessage += `- ${c.skill} (${c.taskCount} مهمة)\n`;
            });
            userMessage += `\n`;
        }

        userMessage += `اكتب رسالة تحفيزية قوية جداً ومؤثرة تناسب هذا السياق وتحتفي بالإنجازات.`;

        const response = await axios.post(
            'https://api.anthropic.com/v1/messages',
            {
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 1024,
                messages: [{ role: 'user', content: userMessage }],
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

        return response.data?.content?.[0]?.text?.trim() || '💪 عمل رائع! استمر في هذا التقدم المذهل!';
    } catch (error) {
        console.error('Enhanced Motivation Error:', error.response?.data || error.message);
        return getRandomQuote(); // استخدام اقتباس عشوائي كبديل
    }
}

// ========================= Exports ========================= //

module.exports = {
    analyzeTaskCategory,
    analyzeUserSkills,
    recommendCourses,
    formatCourseRecommendations,
    checkAndAwardAchievements,
    formatAchievementMessage,
    getRandomQuote,
    generateEnhancedMotivation,
    COURSE_DATABASE,
    ACHIEVEMENT_MILESTONES,
    WEEKLY_ACHIEVEMENTS
};
