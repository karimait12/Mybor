require('dotenv').config();
const { default: makeWASocket } = require('@whiskeysockets/Baileys');
const { useMultiFileAuthState } = require('@whiskeysockets/Baileys'); // تم التعديل هنا
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ... (باقي الكود يبقى كما هو بدون تغيير)

// إعدادات البوت
const config = {
  sessionFolder: 'auth_info',
  botName: process.env.BOT_NAME || 'البوت الذكي',
  adminNumber: process.env.ADMIN_NUMBER || '212679894168'
};

// إنشاء واجهة إدخال
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function initWhatsApp() {
  console.log('جاري تهيئة اتصال واتساب...');
  
  try {
    // تحميل الجلسة إن وجدت
    const { state, saveCreds } = await useMultiFileAuthState(config.sessionFolder);
    
    // إنشاء اتصال السوكيت
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: ['Ubuntu', config.botName, '1.0.0'],
      logger: console
    });

    // معالجة أحداث الاتصال
    sock.ev.on('connection.update', handleConnectionUpdate(sock, saveCreds));
    
    // معالجة الرسائل
    sock.ev.on('messages.upsert', handleMessages(sock));
    
    // حفظ بيانات الجلسة
    sock.ev.on('creds.update', saveCreds);

  } catch (error) {
    console.error('حدث خطأ في التهيئة:', error);
    process.exit(1);
  }
}

function handleConnectionUpdate(sock, saveCreds) {
  return async (update) => {
    const { connection, isNewLogin } = update;
    
    if (connection === 'open') {
      console.log('✅ تم الاتصال بنجاح');
      await sendWelcomeMessage(sock);
    }
    
    if (connection === 'close') {
      console.log('🔄 محاولة إعادة الاتصال...');
      setTimeout(initWhatsApp, 5000);
    }

    if (!sock.authState.creds.registered && !fs.existsSync(path.join(config.sessionFolder, 'creds.json'))) {
      requestPairingCode(sock);
    }
  };
}

function handleMessages(sock) {
  return async ({ messages }) => {
    for (const msg of messages) {
      try {
        if (msg.message?.conversation) {
          console.log(`📩 رسالة من ${msg.key.remoteJid}: ${msg.message.conversation}`);
          await processMessage(sock, msg);
        }
      } catch (err) {
        console.error('خطأ في معالجة الرسالة:', err);
      }
    }
  };
}

async function requestPairingCode(sock) {
  rl.question('📱 أدخل رقم الهاتف مع مفتاح الدولة (مثال: 20123456789): ', async (number) => {
    if (!/^\d+$/.test(number)) {
      console.log('❌ رقم الهاتف غير صحيح! يجب أن يحتوي على أرقام فقط');
      return requestPairingCode(sock);
    }
    
    try {
      const code = await sock.requestPairingCode(number);
      console.log(`\n🔢 رمز الاقتران: ${code}\n`);
      console.log('1. افتح واتساب على هاتفك');
      console.log('2. اذهب إلى الإعدادات > الأجهزة المرتبطة');
      console.log('3. اختر "إربط جهازًا" وأدخل الرمز أعلاه\n');
    } catch (error) {
      console.error('❌ حدث خطأ:', error.message);
      requestPairingCode(sock);
    }
  });
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
  
  // الرد التلقائي الأساسي
  let reply = '🤖 أنا بوت واتساب تجريبي\nأرسل "مساعدة" للخيارات المتاحة';
  
  if (text.includes('مرحبا') || text.includes('اهلا')) {
    reply = 'أهلاً وسهلاً بك! كيف يمكنني مساعدتك اليوم؟';
  } else if (text.includes('مساعدة') || text === 'help') {
    reply = '📚 أوامر متاحة:\n- "الوقت" لمعرفة الوقت الحالي\n- "التاريخ" لمعرفة التاريخ\n- "مطور" لمعلومات المطور';
  } else if (text.includes('وقت') || text.includes('time')) {
    reply = `⏰ الوقت الحالي: ${new Date().toLocaleTimeString()}`;
  } else if (text.includes('تاريخ') || text.includes('date')) {
    reply = `📅 التاريخ اليوم: ${new Date().toLocaleDateString()}`;
  } else if (text.includes('مطور') || text.includes('dev')) {
    reply = '👨‍💻 المطور: ArabDevs Team\nhttps://github.com/ArabDevs';
  }
  
  await sock.sendMessage(jid, { text: reply });
}

// بدء التشغيل
initWhatsApp();
