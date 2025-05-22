require('dotenv').config();
const { default: makeWASocket } = require('@whiskeysockets/Baileys');
const { useMultiFileAuthState } = require('@whiskeysockets/Baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

// إعدادات البوت
const config = {
  sessionFolder: 'auth_info',
  botName: process.env.BOT_NAME || 'البوت الذكي',
  adminNumber: process.env.ADMIN_NUMBER || '212679894168', // رقمك كمشرف
  pairingPhoneNumber: process.env.PAIRING_NUMBER || '212679894168' // رقم الهاتف للربط
};

async function initWhatsApp() {
  console.log('جاري تهيئة اتصال واتساب...');
  
  try {
    // تحميل الجلسة إن وجدت
    const { state, saveCreds } = await useMultiFileAuthState(config.sessionFolder);
    
    // إنشاء اتصال السوكيت
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false, // تعطيل QR
      browser: ['Ubuntu', config.botName, '1.0.0'],
      logger: pino({ level: 'silent' })
    });

    // معالجة أحداث الاتصال
    sock.ev.on('connection.update', async (update) => {
      const { connection, isNewLogin } = update;
      
      if (connection === 'open') {
        console.log('✅ تم الاتصال بنجاح!');
        await sendWelcomeMessage(sock);
      }
      
      if (connection === 'close') {
        console.log('🔄 محاولة إعادة الاتصال...');
        setTimeout(initWhatsApp, 5000);
      }

      // إذا لم يكن الحساب مسجل
      if (!sock.authState.creds.registered && !fs.existsSync(path.join(config.sessionFolder, 'creds.json'))) {
        try {
          console.log(`📱 جاري طلب رمز الاقتران للرقم: ${config.pairingPhoneNumber}`);
          
          // طلب رمز الـ 8 أرقام
          const code = await sock.requestPairingCode(config.pairingPhoneNumber);
          
          console.log('\n----------------------------');
          console.log('🔢 رمز الاقتران:', code);
          console.log('----------------------------\n');
          console.log('1. افتح واتساب على هاتفك');
          console.log('2. اذهب إلى الإعدادات > الأجهزة المرتبطة');
          console.log('3. اختر "إربط جهازًا" وأدخل الرمز أعلاه');
          console.log('----------------------------\n');
        } catch (error) {
          console.error('❌ حدث خطأ:', error.message);
        }
      }
    });

    // معالجة الرسائل الواردة
    sock.ev.on('messages.upsert', ({ messages }) => {
      messages.forEach(msg => {
        if (msg.message?.conversation) {
          console.log(`📩 رسالة من ${msg.key.remoteJid}: ${msg.message.conversation}`);
          processMessage(sock, msg);
        }
      });
    });

    // حفظ بيانات الجلسة
    sock.ev.on('creds.update', saveCreds);

  } catch (error) {
    console.error('حدث خطأ في التهيئة:', error);
    setTimeout(initWhatsApp, 5000);
  }
}

async function sendWelcomeMessage(sock) {
  try {
    await sock.sendMessage(
      `${config.adminNumber}@s.whatsapp.net`, 
      { text: `🔄 ${config.botName} يعمل الآن!\nتاريخ التشغيل: ${new Date().toLocaleString()}` }
    );
  } catch (error) {
    console.error('تعذر إرسال رسالة الترحيب:', error);
  }
}

async function processMessage(sock, msg) {
  const jid = msg.key.remoteJid;
  const text = msg.message.conversation.toLowerCase();
  
  let reply = '🤖 أنا بوت واتساب تجريبي\nأرسل "مساعدة" للخيارات المتاحة';
  
  if (text.includes('مرحبا') || text.includes('اهلا')) {
    reply = 'أهلاً وسهلاً بك! كيف يمكنني مساعدتك اليوم؟';
  } else if (text.includes('مساعدة') || text === 'help') {
    reply = '📚 أوامر متاحة:\n- "الوقت" لمعرفة الوقت الحالي\n- "التاريخ" لمعرفة التاريخ\n- "مطور" لمعلومات المطور';
  }
  
  try {
    await sock.sendMessage(jid, { text: reply });
  } catch (error) {
    console.error('خطأ في إرسال الرد:', error);
  }
}

// بدء التشغيل
initWhatsApp();
