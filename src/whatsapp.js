// ========================= WhatsApp Client ========================= //
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

let client;

function initializeWhatsApp() {
    client = new Client({
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
                '--disable-gpu'
            ]
        }
    });

    client.on('qr', (qr) => {
        console.log('🔐 QR Code received. Please scan:');
        qrcode.generate(qr, { small: true });
    });

    client.on('authenticated', () => {
        console.log('✅ WhatsApp authenticated successfully');
    });

    client.on('auth_failure', (msg) => {
        console.error('❌ WhatsApp authentication failed:', msg);
    });

    client.on('disconnected', (reason) => {
        console.log('⚠️ WhatsApp client disconnected:', reason);
    });

    client.initialize();
    console.log('✅ WhatsApp Client Initialized');
}

async function sendMessage(chatId, message, options = {}) {
    if (!client) {
        throw new Error('WhatsApp client not initialized');
    }

    try {
        await client.sendMessage(chatId, message, options);
        console.log(`📤 Message sent to ${chatId}`);
    } catch (error) {
        console.error('❌ Error sending message:', error);
        throw error;
    }
}

function getClient() {
    return client;
}

module.exports = {
    initializeWhatsApp,
    sendMessage,
    getClient
};
