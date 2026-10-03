// علوم البرمجة — تشفير ملفات النسخة الاحتياطية (بدون إنترنت، عبر Web Crypto API المدمجة في المتصفح)
// الفكرة: مفتاح التشفير مُشتَق من معرّف الطالب (studentId) نفسه. يعني:
//  - أي تعديل على محتوى الملف (حتى حرف واحد) بيبوّظ "ختم" AES-GCM فيترفض الملف تلقائيًا (تلاعب = رفض).
//  - أي محاولة لتغيير المعرّف المكتوب في الملف عشان "يتقمّص" طالب تاني هتفشل، لأن المفتاح هيتغيّر
//    ومفتاح غلط = فك تشفير فاشل = رفض. فالملف مربوط فعليًا بصاحب الـID اللي اتصدّر منه.
//  - أي ملف JSON عادي (مش من تصدير التطبيق ده) بيترفض فورًا لأنه مش بالشكل المتوقع.
// ملاحظة أمانة: التشفير هنا بيمنع التلاعب العرضي أو بأدوات بسيطة (محرر نصوص)، لأن الكود كله شغال
// في متصفح الطالب نفسه. مش حماية مطلقة ضد شخص عنده خبرة برمجية يقرأ الكود المصدري.
(function(global){
'use strict';
const APP_TAG = 'zakera-backup';
const FORMAT_VERSION = 1;
const PEPPER = 'zakera-raqmeya::backup-key::v1'; // ثابت فى الكود — يزيد صعوبة إعادة بناء المفتاح يدويًا

function hasCrypto(){ return !!(global.crypto && global.crypto.subtle); }
function b64(buf){ return btoa(String.fromCharCode(...new Uint8Array(buf))); }
function unb64(s){ const bin = atob(s); const a = new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) a[i]=bin.charCodeAt(i); return a; }

async function deriveKey(id){
  const data = new TextEncoder().encode(PEPPER + '::' + String(id||''));
  const hash = await crypto.subtle.digest('SHA-256', data);
  return crypto.subtle.importKey('raw', hash, {name:'AES-GCM'}, false, ['encrypt','decrypt']);
}

class BackupError extends Error{ constructor(code, msg){ super(msg); this.zbkCode = code; } }

// تشفير كائن الحالة الكامل (STATE) إلى نص جاهز يُحفظ كملف .json
async function encryptState(state){
  if(!hasCrypto()) throw new BackupError('nocrypto', 'التشفير غير متاح في هذا المتصفح');
  const id = state && state.studentId;
  if(!id) throw new BackupError('noid', 'لا يوجد معرّف طالب لربط النسخة به');
  const key = await deriveKey(id);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(state));
  const ct = await crypto.subtle.encrypt({name:'AES-GCM', iv}, key, plain);
  return JSON.stringify({ app: APP_TAG, v: FORMAT_VERSION, id: String(id), iv: b64(iv), ct: b64(ct) });
}

// فك تشفير نص ملف مُصدَّر، مع رفض أي ملف غير صالح أو متلاعَب به أو منتمي لمعرّف آخر
async function decryptFile(text){
  if(!hasCrypto()) throw new BackupError('nocrypto', 'التشفير غير متاح في هذا المتصفح');
  let obj;
  try{ obj = JSON.parse(text); }catch(e){ throw new BackupError('format', 'الملف مش بصيغة JSON صالحة'); }
  if(!obj || typeof obj !== 'object' || obj.app !== APP_TAG || !obj.id || !obj.iv || !obj.ct){
    throw new BackupError('format', 'الملف ده مش من نسخ التطبيق الاحتياطية');
  }
  let iv, ct;
  try{ iv = unb64(obj.iv); ct = unb64(obj.ct); }
  catch(e){ throw new BackupError('format', 'محتوى الملف تالف'); }
  const key = await deriveKey(obj.id);
  let plainBuf;
  try{ plainBuf = await crypto.subtle.decrypt({name:'AES-GCM', iv}, key, ct); }
  catch(e){ throw new BackupError('tamper', 'الملف اتعدّل أو تالف — فشل التحقق من سلامته'); }
  let parsed;
  try{ parsed = JSON.parse(new TextDecoder().decode(plainBuf)); }
  catch(e){ throw new BackupError('tamper', 'محتوى الملف بعد الفك مش سليم'); }
  if(!parsed || parsed.studentId !== obj.id){
    throw new BackupError('tamper', 'الملف غير متّسق مع المعرّف المرتبط به');
  }
  return parsed;
}

global.ZBK = { encryptState, decryptFile, BackupError };
})(typeof window !== 'undefined' ? window : globalThis);
