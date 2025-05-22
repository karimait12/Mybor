require('dotenv').config();
const { default: makeWASocket } = require('@whiskeysockets/Baileys');
const { useMultiFileAuthState } = require('@whiskeysockets/Baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

// إعدادات البوت
const config = {
  sessionFolder: 'auth_info',
  botName: process.env.BOT_NAME || 'MyBot',
  adminNumber: process.env.ADMIN_NUMBER || '212710329510', // رقم المشرف
  pairingPhoneNumber: process.env.PAIRING_NUMBER || '212679894168'
};

let sock; // تعريف متغير السوكيت خارج الدوال

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
    
    const { state, saveCreds } = await useMultiFileAuthState(config.sessionFolder);
    
    sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: ['Ubuntu', config.botName, '1.0.0'],
      logger: pino({ level: 'silent' }),
      connectTimeoutMs: 30000
    });

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;
      
      if (connection === 'open') {
        console.log('✅ تم الاتصال بنجاح!');
        
        // إرسال رسالة إلى المشرف عند الاتصال الناجح
        await sendAdminMessage(
          `🔔 إشعار تشغيل البوت\n\n` +
          `✅ تم الاتصال بنجاح\n` +
          `🖥️ اسم البوت: ${config.botName}\n` +
          `⏰ وقت التشغيل: ${new Date().toLocaleString()}\n\n` +
          `📱 رقم البوت: ${config.pairingPhoneNumber}`
        );
      }
      
      if (connection === 'close') {
        console.log('🔄 محاولة إعادة الاتصال...');
        setTimeout(initWhatsApp, 5000);
      }

      if (!sock.authState.creds.registered && !fs.existsSync(path.join(config.sessionFolder, 'creds.json'))) {
        try {
          console.log(`📱 جاري طلب رمز الاقتران للرقم: ${config.pairingPhoneNumber}`);
          const code = await sock.requestPairingCode(config.pairingPhoneNumber);
          
          console.log('\n══════════════════════════════');
          console.log('🔢 رمز الاقتران:', code);
          console.log('══════════════════════════════\n');
          
          // إرسال رمز الاقتران إلى المشرف
          await sendAdminMessage(
            `🔐 رمز اقتران جديد\n\n` +
            `📱 رقم البوت: ${config.pairingPhoneNumber}\n` +
            `🔢 رمز الاقتران: ${code}\n\n` +
            `الرجاء إدخال هذا الرمز في واتساب > إعدادات > الأجهزة المرتبطة`
          );
          
        } catch (error) {
          console.error('❌ فشل طلب رمز الاقتران:', error.message);
        }
      }
    });

    sock.ev.on('creds.update', saveCreds);

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
