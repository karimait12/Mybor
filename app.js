require('dotenv').config();
const { default: makeWASocket, useSingleFileAuthState, DisconnectReason } = require('@whiskeysockets/Baileys');
const pino = require('pino');
const fs = require('fs');

const config = {
  authFile: './sessions/creds.json',
  botName: process.env.BOT_NAME || 'MyBot',
  adminNumber: process.env.ADMIN_NUMBER || '212679894168'
};

function validateSession(creds) {
  const requiredFields = ['me', 'noiseKey', 'signedPreKey', 'registrationId'];
  return requiredFields.every(field => creds[field]);
}

async function initWhatsApp() {
  try {
    console.log('🔍 التحقق من ملف الجلسة...');
    
    // إنشاء ملف جلسة جديد إذا لم يوجد
    if (!fs.existsSync(config.authFile)) {
      fs.writeFileSync(config.authFile, '{}');
      console.log('📄 تم إنشاء ملف جلسة جديد');
    }

    const { state, saveState } = useSingleFileAuthState(config.authFile);
    
    // التحقق من صحة الجلسة
    if (!validateSession(state.creds)) {
      throw new Error('جلسة غير صالحة');
    }

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      connectTimeoutMs: 30000,
      shouldIgnoreJid: jid => jid === 'status@broadcast'
    });

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;
      
      if (connection === 'open') {
        console.log('✅ اتصال ناجح باسم:', state.creds.me?.name || 'غير معروف');
      }
      
      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        if (statusCode === DisconnectReason.loggedOut) {
          console.log('🔒 تم تسجيل الخروج، جاري تنظيف الجلسة...');
          fs.unlinkSync(config.authFile);
        }
        setTimeout(initWhatsApp, 5000);
      }
    });

    sock.ev.on('creds.update', () => {
      if (validateSession(state.creds)) {
        saveState();
        console.log('💾 تم حفظ الجلسة بأمان');
      }
    });

  } catch (error) {
    console.error('🔥 خطأ حرج:', error.message);
    
    if (error.message.includes('جلسة غير صالحة')) {
      console.log('🔄 جاري إنشاء جلسة جديدة...');
      fs.unlinkSync(config.authFile);
      setTimeout(initWhatsApp, 2000);
    } else {
      setTimeout(initWhatsApp, 10000);
    }
  }
}

// تشغيل البوت
initWhatsApp();
