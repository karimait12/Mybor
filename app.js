require('dotenv').config();
const { default: makeWASocket } = require('@whiskeysockets/Baileys');
const { useSingleFileAuthState } = require('@whiskeysockets/Baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

// إعدادات البوت
const config = {
  authFile: 'creds.json', // استخدام ملف creds.json مباشرة
  botName: process.env.BOT_NAME || 'MyBot',
  adminNumber: process.env.ADMIN_NUMBER || '20123456789'
};

let sock; // متغير السوكيت العام

async function sendAdminMessage(message) {
  try {
    if (!sock) {
      console.log('⚠️ لم يتم الاتصال بعد، لا يمكن إرسال الرسالة');
      return;
    }
    
    const adminJid = `${config.adminNumber}@s.whatsapp.net`;
    await sock.sendMessage(adminJid, { text: message });
    console.log('✅ تم إرسال الرسالة إلى المشرف بنجاح');
  } catch (error) {
    console.error('❌ فشل إرسال الرسالة إلى المشرف:', error.message);
  }
}

async function initWhatsApp() {
  try {
    console.log('🚀 جاري تهيئة اتصال واتساب...');
    
    // استخدام ملف creds.json مباشرة
    const { state, saveState } = useSingleFileAuthState(config.authFile);
    
    sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: ['Ubuntu', config.botName, '1.0.0'],
      logger: pino({ level: 'silent' }),
      connectTimeoutMs: 30000,
      shouldIgnoreJid: jid => jid === 'status@broadcast'
    });

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;
      
      if (connection === 'open') {
        console.log('✅ تم الاتصال بنجاح باستخدام الجلسة المحفوظة!');
        
        // إرسال رسالة إلى المشرف
        await sendAdminMessage(
          `🔔 إشعار تشغيل البوت\n\n` +
          `✅ تم الاتصال بنجاح\n` +
          `🖥️ اسم البوت: ${config.botName}\n` +
          `⏰ وقت التشغيل: ${new Date().toLocaleString()}\n` +
          `📱 رقم البوت: ${sock.user?.id.split(':')[0] || 'غير معروف'}`
        );
      }
      
      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
        if (shouldReconnect) {
          console.log('🔄 محاولة إعادة الاتصال...');
          setTimeout(initWhatsApp, 5000);
        } else {
          console.log('❌ خطأ في المصادقة، يلزم إعادة الاقتران');
          fs.unlinkSync(config.authFile); // حذف ملف الجلسة إذا كان غير صالح
        }
      }
    });

    // معالجة الرسائل الواردة
    sock.ev.on('messages.upsert', ({ messages }) => {
      messages.forEach(msg => {
        if (msg.message?.conversation) {
          console.log(`📩 رسالة من ${msg.key.remoteJid}: ${msg.message.conversation}`);
        }
      });
    });

    // حفظ تحديثات الجلسة
    sock.ev.on('creds.update', () => {
      saveState();
      console.log('💾 تم حفظ تحديثات الجلسة');
    });

  } catch (error) {
    console.error('🔥 خطأ في التهيئة:', error.message);
    setTimeout(initWhatsApp, 10000);
  }
}

// بدء التشغيل
initWhatsApp();

// معالجة إغلاق التطبيق
process.on('SIGTERM', async () => {
  console.log('🛑 إيقاف البوت...');
  await sendAdminMessage('🛑 تم إيقاف البوت');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 تم إيقاف البوت بواسطة المستخدم');
  await sendAdminMessage('🛑 تم إيقاف البوت يدوياً');
  process.exit(0);
});
