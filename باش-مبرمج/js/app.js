// ==================================================================================
//  علوم البرمجة — منطق التطبيق
//  © Ahmed Rami — جميع الحقوق محفوظة
// ==================================================================================

// 🔔 رقم إصدار المنصة — غيّر القيمة دي لأي رقم جديد (مثلاً "1.1.0") في كل مرة تعمل فيها
// تحديث حقيقي على المنصة (دروس/أسئلة/فيتشرز جديدة). كل طالب فتح المنصة قبل كده هيشوف
// تنبيه صوتي تلقائي بوجود تحديث، وهيتشجّع ياخد نسخة احتياطية من تقدمه قبل ما يكمل.
const APP_VERSION = "1.15.0";

// 💬 رابط جروب الواتساب الرسمي — غيّره من هنا لو عملت جروب جديد لاحقًا
const WHATSAPP_GROUP_URL = "https://chat.whatsapp.com/J8aima2bxNU7gHRHBp3B45";

const FINAL_TEST_SIZE = 8;      // عدد الأسئلة التي تُعرض في كل محاولة اختبار شامل
const PASS_THRESHOLD  = 0.7;    // نسبة النجاح المطلوبة لفتح الوحدة التالية (70%)

// 🗓️ فتح "الترم الثاني" و"الصف الثاني بكالوريا" تلقائيًا بتاريخ معيّن — المكانان بيفضلوا مقفولين
// (شاشة "قريبًا") لحد ما يوصل التاريخ اللي تحدده هنا، وساعتها بيتفتحوا لوحدهم من غير ما تحتاج ترفع
// أي تحديث تاني وقتها (بشرط يكون المحتوى نفسه اتضاف مسبقًا في TERM2_UNITS / BAC2_UNITS بملف data.js).
// اكتب التاريخ بصيغة "YYYY-MM-DDTHH:mm:ss" (بتوقيت جهاز الطالب)، أو سيبه null عشان يفضل مقفول لحد
// ما تحدد تاريخ.
const UNLOCK_DATE_TERM2 = null;   // مثال: "2026-02-01T00:00:00"
const UNLOCK_DATE_BAC2  = "2020-01-01T00:00:00";   // مفتوح الآن — غيّره لتاريخ مستقبلي لو عاوز تقفله لحد ميعاد معين، أو null للقفل الكامل
function isTimeUnlocked(dateStr){
  if(!dateStr) return false;
  return new Date() >= new Date(dateStr);
}

// ============ حالة التطبيق (في الذاكرة + محاولة الحفظ عبر window.storage إن توفر) ============
let STATE = {
  userName: '',
  studentId: '',
  currentTerm: 1,
  currentGrade: '1sec',    // '1sec' = الصف الأول الثانوي | '2bac' = الصف الثاني بكالوريا
  gradeChosen: false,      // false لحد ما الطالب يجاوب على مودال "انت في أي صف؟" أول مرة
  theme: 'default',        // 'default' | 'light' (أبيض) | 'black' (أسود)
  completedLessons: {},    // key: "u1-l0" -> true
  answeredQuiz: {},        // key: "lq-u-l-qi" -> true  (تم الإجابة عليه، صح أو غلط)
  answeredPractice: {},    // key: "lp-u-l-qi" -> true
  finalTestResults: {},    // key: unitId -> {passed:bool, bestScore:0-1, total:n, attempts:n}
  examResults: {},         // key: examId -> {bestScore:0-1, attempts:n, passed:bool}
  badgeLog: [],            // [{type:'unit'|'exam', id, name, icon, earnedAt}] بترتيب الحدوث
  quizCorrect: 0,
  quizCorrectBy: {'1sec':0,'2bac':0},  // إجابات صحيحة لكل صف على حدة
  xpBy: {'1sec':0,'2bac':0},           // نقاط خبرة (XP) لكل صف على حدة — أساس نظام المستويات
  startGrade: null,                    // أول صف اختاره الطالب فعليًا على الإطلاق (لا يتغيّر بعد أول اختيار)
  loyaltyBonusGiven: false,            // مكافأة "بدأت من الأول" — تُمنح مرة واحدة فقط
  currentUnit: null,
  currentLessonIdx: 0,
  finalTestSession: null,  // {unitId, questions:[...], answeredCount, correctCount}
  examSession: null,       // {examId, questions:[...], answeredCount, correctCount}
  history: ['screen-home']
};

let QREG = {}; // سجل مؤقت لأسئلة الشاشة الحالية: key -> {type, correct, kind, locked}

// ---------- تخزين دائم: نظام "ملف لكل طالب" عبر localStorage (يشتغل بدون إنترنت وبين الجلسات) ----------
const REGISTRY_KEY = 'zakera_registry';
const ACTIVE_ID_KEY = 'zakera_active_id';
const PROFILE_PREFIX = 'zakera_profile_';

// ============ المظهر: يُطبَّق فورًا (Sync) قبل أي رسم للواجهة، لتفادي وميض بلون غلط ============
(function applyThemeEarly(){
  try{
    if(typeof localStorage === 'undefined') return;
    const activeId = localStorage.getItem(ACTIVE_ID_KEY);
    if(!activeId) return;
    const raw = localStorage.getItem(PROFILE_PREFIX + activeId);
    if(!raw) return;
    const parsed = JSON.parse(raw);
    if(parsed && parsed.theme && parsed.theme !== 'default'){
      document.documentElement.setAttribute('data-theme', parsed.theme);
    }
  }catch(e){ /* هيتطبق المظهر لاحقًا بشكل عادي مع باقي البيانات */ }
})();

function generateStudentId(){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // بدون حروف/أرقام ملبسة زي O و0 وI و1
  let id = '';
  for(let i=0;i<6;i++){ id += chars[Math.floor(Math.random()*chars.length)]; }
  return 'ST-' + id;
}
function getRegistry(){
  try{ return JSON.parse(localStorage.getItem(REGISTRY_KEY) || '[]'); }
  catch(e){ return []; }
}
function updateRegistry(id, name){
  try{
    const reg = getRegistry();
    const now = new Date().toISOString();
    const idx = reg.findIndex(r=>r.id===id);
    if(idx>=0){ reg[idx].name = name || reg[idx].name; reg[idx].lastActive = now; }
    else { reg.push({ id, name: name || 'طالب', createdAt: now, lastActive: now }); }
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(reg));
  }catch(e){ /* التخزين المحلي غير متاح */ }
}

async function saveState(){
  try{
    if(STATE.studentId && typeof localStorage !== 'undefined'){
      localStorage.setItem(PROFILE_PREFIX + STATE.studentId, JSON.stringify(STATE));
      localStorage.setItem(ACTIVE_ID_KEY, STATE.studentId);
      updateRegistry(STATE.studentId, STATE.userName);
    }
  }catch(e){ /* تجاهل بصمت لو التخزين المحلي ممتلئ أو غير متاح */ }
  try{
    if(window.storage){ await window.storage.set('progress', JSON.stringify(STATE)); }
  }catch(e){ /* تجاهل بصمت — التخزين السحابي غير متاح خارج بيئة Artifacts */ }
}
async function loadState(){
  let loaded = false;
  try{
    if(typeof localStorage !== 'undefined'){
      const activeId = localStorage.getItem(ACTIVE_ID_KEY);
      if(activeId){
        const raw = localStorage.getItem(PROFILE_PREFIX + activeId);
        if(raw){ applyLoadedState(JSON.parse(raw)); loaded = true; }
      }
    }
  }catch(e){ /* لا توجد بيانات محفوظة محليًا بعد */ }
  if(!loaded){
    try{
      if(window.storage){
        const res = await window.storage.get('progress');
        if(res && res.value){ applyLoadedState(JSON.parse(res.value)); }
      }
    }catch(e){ /* لا توجد بيانات محفوظة بعد */ }
  }
  refreshHome();
  applyTheme(STATE.theme);
  checkGrade();
}
// ترحيل المستخدمين القدامى: ملف محفوظ قبل نظام XP (مفيهوش xpBy) — نحسب له نقاطه من تقدّمه الفعلي.
// نفس قواعد المنح: درس +10 | إجابة صح +2 (حدّ أدنى، لأن النوع مش متسجّل) | وحدة 100% +50 | امتحان ناجح +100
// اللي مبدأش أي حاجة فعليًا بيطلع 0 تلقائيًا.
function computeLegacyXP(){
  const xp = {'1sec':0,'2bac':0};
  const unitGrade = id => Number(id) >= 100 ? '2bac' : '1sec';
  Object.keys(STATE.completedLessons||{}).forEach(k=>{
    const m = /^u(\d+)-l/.exec(k); if(m) xp[unitGrade(m[1])] += 10;
  });
  xp['1sec'] += ((STATE.quizCorrectBy||{})['1sec']||0) * 2;
  xp['2bac'] += ((STATE.quizCorrectBy||{})['2bac']||0) * 2;
  Object.keys(STATE.finalTestResults||{}).forEach(id=>{
    if(STATE.finalTestResults[id] && STATE.finalTestResults[id].bestScore === 1) xp[unitGrade(id)] += 50;
  });
  Object.keys(STATE.examResults||{}).forEach(id=>{
    if(STATE.examResults[id] && STATE.examResults[id].passed) xp['1sec'] += 100;
  });
  return xp;
}
function applyLoadedState(parsed){
  STATE.userName           = parsed.userName          || STATE.userName || '';
  STATE.studentId          = parsed.studentId          || STATE.studentId || '';
  STATE.currentGrade       = parsed.currentGrade       || STATE.currentGrade || '1sec';
  STATE.gradeChosen        = parsed.gradeChosen        || false;
  STATE.theme              = parsed.theme              || 'default';
  STATE.completedLessons  = parsed.completedLessons  || {};
  STATE.answeredQuiz      = parsed.answeredQuiz      || {};
  STATE.answeredPractice  = parsed.answeredPractice  || {};
  STATE.finalTestResults  = parsed.finalTestResults  || {};
  STATE.examResults       = parsed.examResults        || {};
  STATE.badgeLog          = parsed.badgeLog           || [];
  STATE.quizCorrect       = parsed.quizCorrect       || 0;
  STATE.quizCorrectBy     = parsed.quizCorrectBy     || {'1sec': parsed.quizCorrect || 0, '2bac': 0};
  STATE.xpBy               = parsed.xpBy               || computeLegacyXP();
  STATE.startGrade          = parsed.startGrade          || null;
  STATE.loyaltyBonusGiven    = parsed.loyaltyBonusGiven    || false;
}

// ============ المظهر: الأساسي (افتراضي) / أبيض (فاتح) / أسود (داكن بالكامل) ============
function applyTheme(theme){
  const t = theme || 'default';
  if(t === 'default'){ document.documentElement.removeAttribute('data-theme'); }
  else{ document.documentElement.setAttribute('data-theme', t); }
  document.querySelectorAll('#themeSwatches .theme-swatch').forEach(b=>{
    b.classList.toggle('active', b.dataset.theme === t);
  });
}
function chooseTheme(theme){
  STATE.theme = theme;
  applyTheme(theme);
  saveState();
}

// ============ الصف الدراسي (يتسأل عنه مرة واحدة بدل تبويب يتبدّل بينهم) ============
const GRADE_NAMES = { '1sec': 'الصف الأول الثانوي', '2bac': 'الصف الثاني بكالوريا' };
const GRADE_LABELS = {
  '1sec': '// الصف الأول الثانوي — البرمجة والذكاء الاصطناعي',
  '2bac': '// الصف الثاني بكالوريا — قريبًا'
};
function checkGrade(){
  applyGradeView(STATE.currentGrade);
  if(!STATE.gradeChosen){
    const modal = document.getElementById('gradeModal');
    if(modal) modal.style.display = 'flex';
  }else{
    checkUserName();
  }
}
function chooseGrade(grade){
  STATE.currentGrade = grade;
  STATE.gradeChosen = true;
  if(!STATE.startGrade) STATE.startGrade = grade;  // يُسجَّل أول اختيار فقط، ولا يتغيّر بعد كده أبدًا
  const modal = document.getElementById('gradeModal');
  if(modal) modal.style.display = 'none';
  applyGradeView(grade);
  saveState();
  checkUserName();
}
function openGradeModal(){
  const modal = document.getElementById('gradeModal');
  if(modal) modal.style.display = 'flex';
}
function applyGradeView(grade){
  const g1 = document.getElementById('grade1secContent');
  const g2 = document.getElementById('grade2bacPlaceholder');
  if(g1) g1.style.display = grade==='1sec' ? '' : 'none';
  if(g2) g2.style.display = grade==='2bac' ? '' : 'none';
  const hd = document.getElementById('heroDesc');
  if(hd) hd.textContent = grade==='2bac'
    ? 'البرمجة والذكاء الاصطناعي — الجزء الأول: التقنية والمجتمع، الأمن السيبراني، تطبيقات الويب، وتصميم الويب والوسائط.'
    : '13 وحدة، من مفهوم المعلومات إلى الذكاء الاصطناعي التوليدي وبرمجة الويب — بطاقات مركّزة، أمثلة واقعية، واختبارات فورية تناسب موبايلك.';
  refreshHome();
  if(grade==='2bac') renderBac2();
  const eyebrow = document.getElementById('heroEyebrow');
  if(eyebrow) eyebrow.textContent = GRADE_LABELS[grade] || GRADE_LABELS['1sec'];
  const gradeLbl = document.getElementById('profGradeLbl');
  if(gradeLbl) gradeLbl.textContent = GRADE_NAMES[grade] || GRADE_NAMES['1sec'];
}

// ============ اسم المستخدم (يُستخدم عند مشاركة التقدّم) ============
function checkUserName(){
  if(!STATE.userName){
    const modal = document.getElementById('nameModal');
    if(modal) modal.style.display = 'flex';
  }
}
function openNameModal(){
  const input = document.getElementById('nameInput');
  if(input) input.value = STATE.userName || '';
  document.getElementById('nameModal').style.display = 'flex';
}
function saveUserName(){
  const input = document.getElementById('nameInput');
  const val = (input.value || '').trim();
  STATE.userName = val || 'طالب';
  if(!STATE.studentId){ STATE.studentId = generateStudentId(); }
  saveState();
  document.getElementById('nameModal').style.display = 'none';
  renderProfile();
  showToast(`أهلًا بيك يا ${STATE.userName}! معرفك: ${STATE.studentId} 🪪`);
  setTimeout(checkWhatsappReminder, 400);
}

// ============ أدوات مساعدة عامة ============
function lessonKey(uId,lIdx){ return `u${uId}-l${lIdx}`; }
function quizKey(uId,lIdx,qi){ return `lq-${uId}-${lIdx}-${qi}`; }
function practiceKey(uId,lIdx,qi){ return `lp-${uId}-${lIdx}-${qi}`; }
function findUnit(id){ return UNITS.find(x=>x.id===id) || TERM2_UNITS.find(x=>x.id===id) || BAC2_UNITS.find(x=>x.id===id); }
function totalLessons(){ return UNITS.reduce((s,u)=>s+u.lessons.length,0); }
function doneLessonsCount(){ return Object.keys(STATE.completedLessons).length; }
// ---- إحصائيات مقصورة على صف الطالب الحالي فقط (بدون خلط بين الصفوف) ----
function scopeUnitIds(){ return certScope().units.map(u=>u.id); }
function totalLessonsScope(){ return certScope().units.reduce((s,u)=>s+u.lessons.length,0); }
function doneLessonsScope(){
  const ids = new Set(scopeUnitIds());
  return Object.keys(STATE.completedLessons).filter(k=>{
    const m = /^u(\d+)-l/.exec(k); return m && ids.has(Number(m[1]));
  }).length;
}
function gradeOfUnitId(id){ return Number(id) >= 100 ? '2bac' : '1sec'; }
function quizCorrectScope(){
  if(!STATE.quizCorrectBy) STATE.quizCorrectBy = {'1sec': STATE.quizCorrect||0, '2bac':0};
  return STATE.quizCorrectBy[STATE.currentGrade] || 0;
}
function bumpQuizCorrect(key, xpPoints){
  STATE.quizCorrect++;
  if(!STATE.quizCorrectBy) STATE.quizCorrectBy = {'1sec':0,'2bac':0};
  const m = /^l[qp]-(\d+)-/.exec(key);
  const g = m ? gradeOfUnitId(m[1]) : STATE.currentGrade;
  STATE.quizCorrectBy[g] = (STATE.quizCorrectBy[g]||0) + 1;
  addXP(g, xpPoints || 2);
}

// ============ نظام المستويات ونقاط الخبرة (XP) — مقصور على صف الطالب الحالي ============
// مصدر كل نقطة خبرة: درس مكتمل +10 | إجابة كويز صح +2 | إجابة تدريب صح +3 |
// اختبار وحدة شامل بـ100% أول مرة +50 | امتحان شامل بـ90%+ أول مرة +100
const LEVELS = [
  {min:0,   title:'🌱 مبتدئ',   color:'#8FA0C0'},
  {min:80,  title:'📘 مجتهد',   color:'#7C9CFF'},
  {min:220, title:'⚡ متمكن',   color:'#33E0C2'},
  {min:450, title:'🔥 خبير',    color:'#FFB94D'},
  {min:800, title:'👑 أسطورة',  color:'#FF6E8F'}
];
function currentLevel(xp){ let lvl = LEVELS[0]; for(const l of LEVELS){ if(xp>=l.min) lvl=l; } return lvl; }
function nextLevelInfo(xp){
  const nxt = LEVELS.find(l=>l.min>xp);
  if(!nxt) return null;
  const cur = currentLevel(xp);
  return { title:nxt.title, remaining: nxt.min-xp, pct: Math.round(((xp-cur.min)/(nxt.min-cur.min))*100) };
}
// هل عند الطالب تقدّم حقيقي في الصف الأول الثانوي (مش مجرد اختياره في المودال)؟ شرط لمكافأة الاستمرارية
function hasReal1secProgress(){
  return Object.keys(STATE.completedLessons).some(k=>{ const m=/^u(\d+)-l/.exec(k); return m && Number(m[1])<100; });
}
// مكافأة "بدأت من الأول": لو الطالب بدأ فعليًا بالصف الأول الثانوي وله تقدّم حقيقي فيه، ثم انتقل
// لتانية بكالوريا، ياخد 25% نقاط خبرة إضافية على كل حاجة يعملها هناك + مكافأة فورية لمرة واحدة.
function hasLoyaltyBonus(){
  return STATE.startGrade === '1sec' && hasReal1secProgress();
}
function xpScope(){ return (STATE.xpBy && STATE.xpBy[STATE.currentGrade]) || 0; }
function addXP(grade, baseAmount){
  if(!STATE.xpBy) STATE.xpBy = {'1sec':0,'2bac':0};
  let amount = baseAmount;
  if(grade === '2bac' && hasLoyaltyBonus()) amount = Math.round(baseAmount * 1.25);
  STATE.xpBy[grade] = (STATE.xpBy[grade]||0) + amount;
  if(grade === '2bac' && hasLoyaltyBonus() && !STATE.loyaltyBonusGiven){
    STATE.loyaltyBonusGiven = true;
    STATE.xpBy['2bac'] += 150;
    showToast('🌟 مكافأة "بدأت من الأول"! +150 نقطة خبرة إضافية');
  }
}
function unitDoneCount(u){ return u.lessons.filter((l,i)=>STATE.completedLessons[lessonKey(u.id,i)]).length; }

function shuffleArray(arr){
  for(let i=arr.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]] = [arr[j],arr[i]];
  }
  return arr;
}
function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(()=>t.classList.remove('show'), 2000);
}

// ============ منطق قفل/فتح الوحدات ============
function unitAllLessonsDone(u){
  return u.lessons.every((l,i)=>STATE.completedLessons[lessonKey(u.id,i)]);
}
function unitAllQuizDone(u){
  return u.lessons.every((l,i)=> (l.quiz||[]).every((q,qi)=> STATE.answeredQuiz[quizKey(u.id,i,qi)]));
}
function unitAllPracticeDone(u){
  return u.lessons.every((l,i)=> (l.practice||[]).every((q,qi)=> STATE.answeredPractice[practiceKey(u.id,i,qi)]));
}
function unitFinalTestPassed(u){
  const r = STATE.finalTestResults[u.id];
  return !!(r && r.passed);
}
function unitFullyComplete(u){
  return unitAllLessonsDone(u) && unitAllPracticeDone(u) && unitFinalTestPassed(u);
}
function isUnitUnlocked(u){
  if(u.id===1) return true;
  const prev = findUnit(u.id-1);
  return prev ? unitFullyComplete(prev) : true;
}
function canTakeFinalTest(u){
  return unitAllLessonsDone(u) && unitAllPracticeDone(u);
}
function unitProgressCounts(u){
  const lessonsTotal = u.lessons.length, lessonsDone = unitDoneCount(u);
  let quizTotal=0, quizDone=0, practTotal=0, practDone=0;
  u.lessons.forEach((l,i)=>{
    (l.quiz||[]).forEach((q,qi)=>{ quizTotal++; if(STATE.answeredQuiz[quizKey(u.id,i,qi)]) quizDone++; });
    (l.practice||[]).forEach((q,qi)=>{ practTotal++; if(STATE.answeredPractice[practiceKey(u.id,i,qi)]) practDone++; });
  });
  return {lessonsTotal,lessonsDone,quizTotal,quizDone,practTotal,practDone};
}

// ============ التنقل بين الشاشات ============
function navTo(screenId, title, sub, pushHistory=true){
  if(screenId !== 'screen-finaltest' && screenId !== 'screen-examtest'){ clearActiveTimer(); }
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
  document.getElementById('topTitle').textContent = title;
  document.getElementById('topSub').textContent = sub || '';
  document.getElementById('backBtn').style.display = screenId==='screen-home' ? 'none' : 'flex';
  if(pushHistory) STATE.history.push(screenId);
  window.scrollTo(0,0);
}
function goBack(){
  STATE.history.pop();
  const prev = STATE.history[STATE.history.length-1] || 'screen-home';
  if(prev==='screen-home'){ showTab('home'); }
  else if(prev==='screen-unit' && STATE.currentUnit){ openUnit(STATE.currentUnit.id, false); }
  else if(prev==='screen-glossary'){ showTab('glossary'); }
  else if(prev==='screen-research'){ showTab('research'); }
  else if(prev==='screen-research-write'){ showTab('research'); }
  else if(prev==='screen-exams'){ showTab('exams'); }
  else if(prev==='screen-profile'){ showTab('profile'); }
  else if(prev==='screen-certificate'){ showTab('profile'); }
  else if(prev==='screen-admin'){ showTab('profile'); }
  else { navTo('screen-home','علوم البرمجة','ملخص تفاعلي لمنهج المعلومات وتكنولوجيا الاتصالات', false); STATE.history=['screen-home']; setActiveTab('home'); }
}
function showTab(tab){
  setActiveTab(tab);
  if(tab==='home'){ navTo('screen-home','علوم البرمجة','ملخص تفاعلي لمنهج المعلومات وتكنولوجيا الاتصالات'); STATE.history=['screen-home']; refreshHome(); }
  if(tab==='glossary'){ navTo('screen-glossary','قاموس المصطلحات','ابحث وتعلم بسرعة'); STATE.history=['screen-glossary']; renderGlossary(''); }
  if(tab==='research'){ navTo('screen-research','الأبحاث','طبية · علمية · مدرسية · برمجية · وأي حاجة تانية'); STATE.history=['screen-research']; renderResearchScreen(); }
  if(tab==='exams'){ navTo('screen-exams','الامتحانات الشاملة', STATE.currentGrade==='2bac' ? 'مقفولة لحد ما المنهج ينزل كامل' : '5 امتحانات × 100 سؤال لمراجعة كل المنهج'); STATE.history=['screen-exams']; renderExamList(); }
  if(tab==='profile'){ navTo('screen-profile','تقدّمي','رحلتك في الكتاب بالكامل'); STATE.history=['screen-profile']; renderProfile(); }
}
function setActiveTab(tab){
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active', b.dataset.tab===tab));
}

// ============ HOME ============
function unitCardHTML(u){
  const done = unitDoneCount(u), tot = u.lessons.length;
  const ringPct = tot? (done/tot)*100 : 0;
  const circ = 2*Math.PI*15;
  const offset = circ - (ringPct/100)*circ;
  const unlocked = isUnitUnlocked(u);
  const testPassed = unitFinalTestPassed(u);
  const cardCls = unlocked ? 'unit-card' : 'unit-card locked';
  const clickAttr = unlocked ? `onclick="openUnit(${u.id})"` : `onclick="lockedTap(${u.id})"`;
  return `<div class="${cardCls}" ${clickAttr}>
    <div class="num" style="background:${unlocked?u.color:'#3a4864'}">${unlocked? u.icon : '🔒'}</div>
    <div class="meta">
      <h4>الوحدة ${u.id} — ${u.title} ${testPassed?'<span class="badge-ok">✓ مكتملة</span>':''}</h4>
      <p>${u.lessons.length} دروس · ${unlocked ? u.intro : 'أكمل الوحدة السابقة بالكامل (دروس + تدريبات + اختبار شامل) لفتحها'}</p>
    </div>
    ${unlocked ? `<div class="prog-ring">
      <svg width="34" height="34">
        <circle cx="17" cy="17" r="15" stroke="var(--panel-2)" stroke-width="4" fill="none"/>
        <circle cx="17" cy="17" r="15" stroke="${u.color}" stroke-width="4" fill="none"
          stroke-dasharray="${circ}" stroke-dashoffset="${offset}" stroke-linecap="round"/>
      </svg>
    </div>` : `<div class="lock-ic">🔒</div>`}
  </div>`;
}
function buildUnitsGridHTML(units){
  return units.map(unitCardHTML).join('');
}
function refreshHome(){
  document.getElementById('statUnits').textContent = certScope().units.length;
  document.getElementById('statLessons').textContent = doneLessonsScope();
  const pct = totalLessonsScope() ? Math.round((doneLessonsScope()/totalLessonsScope())*100) : 0;
  document.getElementById('statPct').textContent = pct+'%';
  document.getElementById('unitCountLbl').textContent = UNITS.length + ' وحدات';
  document.getElementById('unitGrid').innerHTML = buildUnitsGridHTML(UNITS);
  if(STATE.currentGrade==='2bac') renderBac2();
}
function lockedTap(uId){
  showToast('🔒 أكمل دروس وتدريبات واختبار الوحدة السابقة أولًا لفتح هذه الوحدة');
}

// ============ UNIT SCREEN ============
function openUnit(id, push=true){
  const u = findUnit(id);
  if(!isUnitUnlocked(u)){ lockedTap(id); return; }
  STATE.currentUnit = u;
  navTo('screen-unit', `الوحدة ${u.id}`, u.title, push);
  document.getElementById('unitHeroBox').innerHTML = `
    <div style="display:flex; align-items:center; gap:12px;">
      <div style="width:50px;height:50px;border-radius:14px;background:${u.color};display:flex;align-items:center;justify-content:center;font-size:24px;flex:none;">${u.icon}</div>
      <div><div style="font-size:11px;color:var(--ink-dim);font-family:'IBM Plex Mono',monospace;">الوحدة ${u.id}</div>
      <div style="font-weight:800;font-size:16px;">${u.title}</div></div>
    </div><p>${u.intro}</p>`;

  document.getElementById('lessonList').innerHTML = u.lessons.map((l,i)=>{
    const done = STATE.completedLessons[lessonKey(u.id,i)];
    return `<div class="lesson-item" onclick="openLesson(${u.id},${i})">
      <div class="lnum">${i+1}</div>
      <h5>${l.title}</h5>
      <div class="tick ${done?'done':''}">${done?'✓':''}</div>
    </div>`;
  }).join('');

  // ------- بطاقة الاختبار الشامل -------
  const counts = unitProgressCounts(u);
  const canTest = canTakeFinalTest(u);
  const result = STATE.finalTestResults[u.id];
  const passed = result && result.passed;

  let checklistHtml = `
    <div class="ft-checklist">
      <div class="ft-item ${counts.lessonsDone===counts.lessonsTotal?'ok':''}">${counts.lessonsDone===counts.lessonsTotal?'✅':'⬜'} الدروس: ${counts.lessonsDone}/${counts.lessonsTotal}</div>
      <div class="ft-item ${counts.practDone===counts.practTotal?'ok':''}">${counts.practDone===counts.practTotal?'✅':'⬜'} التدريبات: ${counts.practDone}/${counts.practTotal}</div>
      <div class="ft-item soft">💡 اختبر نفسك داخل كل درس اختياري ومفيد للمراجعة، لكنه مش شرط لفتح الاختبار الشامل</div>
    </div>`;

  let ftCard = `<div class="card ft-card">
    <span class="card-tag" style="background:rgba(255,185,77,.14); color:var(--accent-2);">🏁 الاختبار الشامل للوحدة</span>
    <p style="margin:0 0 10px;">أكمل كل دروس وتدريبات الوحدة أولًا، ثم اجتز الاختبار الشامل (${PASS_THRESHOLD*100}% للنجاح) لفتح الوحدة التالية.</p>
    ${checklistHtml}`;

  if(passed){
    ftCard += `<div class="ft-result ft-pass">🎉 اجتزت الاختبار! أفضل نتيجة: ${Math.round(result.bestScore*100)}% (${result.attempts} محاولة)</div>
      <button class="btn btn-ghost" style="width:100%; margin-top:10px;" onclick="openFinalTest(${u.id})">إعادة الاختبار لتحسين نتيجتك</button>`;
  } else if(canTest){
    ftCard += `<button class="btn btn-primary" style="width:100%; margin-top:10px;" onclick="openFinalTest(${u.id})">🚀 ابدأ الاختبار الشامل</button>`;
    if(result) ftCard += `<div class="ft-result ft-fail">آخر محاولة: ${Math.round(result.bestScore*100)}% — حاول مرة أخرى!</div>`;
  } else {
    ftCard += `<button class="btn btn-ghost" style="width:100%; margin-top:10px;" disabled>أكمل المتطلبات أعلاه أولًا</button>`;
  }
  ftCard += `</div>`;

  ftCard += `<div class="card">
    <span class="card-tag" style="background:rgba(124,156,255,.14); color:#A9BEFF;">🖨️ طباعة وتصدير PDF</span>
    <div class="nav-btns" style="margin-top:8px;">
      <button class="btn btn-ghost" onclick="printUnitBooklet(${u.id})">📘 كل دروس الوحدة</button>
      <button class="btn btn-ghost" onclick="printUnitTestBank(${u.id})">📝 بنك أسئلة المراجعة</button>
    </div>
    <button class="btn btn-ghost" style="width:100%; margin-top:8px;" onclick="openUnitTestFromPaper(${u.id})">📥 حليت بنك الأسئلة على ورقة؟ سلّمه هنا</button>
  </div>`;

  const existing = document.getElementById('unitFtCardSlot');
  if(existing) existing.remove();
  const slot = document.createElement('div');
  slot.id = 'unitFtCardSlot';
  slot.innerHTML = ftCard;
  document.getElementById('lessonList').insertAdjacentElement('afterend', slot);
}

// ============ عداد الوقت التقديري (لاختبارات الوحدات والامتحانات الشاملة) ============
// الوقت هنا "مدة مقترحة" لطالب متوسط، مش حد أقصى إجباري — الاختبار بيفضل مفتوح حتى لو خلص الوقت.
const AVG_SECS_PER_TYPE = { mcq: 40, tf: 25, fill: 55 };
function estimateTestSeconds(questions){
  return questions.reduce((sum,q)=> sum + (AVG_SECS_PER_TYPE[q.type] || 35), 0);
}
function formatMMSS(totalSeconds){
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s/60);
  const sec = s%60;
  return `${m}:${String(sec).padStart(2,'0')}`;
}
let activeTimerInterval = null;
function clearActiveTimer(){
  if(activeTimerInterval){ clearInterval(activeTimerInterval); activeTimerInterval = null; }
}
function startCountdown(seconds, displayElId, onExpire){
  clearActiveTimer();
  let remaining = seconds;
  const el = document.getElementById(displayElId);
  if(!el) return;
  el.classList.remove('timer-warn','timer-expired');
  el.textContent = `⏱️ ${formatMMSS(remaining)}`;
  activeTimerInterval = setInterval(()=>{
    remaining--;
    if(remaining <= 0){
      el.textContent = `⏱️ انتهى الوقت المقترح`;
      el.classList.add('timer-expired');
      clearActiveTimer();
      if(onExpire) onExpire();
      return;
    }
    el.textContent = `⏱️ ${formatMMSS(remaining)}`;
    if(remaining <= 60) el.classList.add('timer-warn');
  }, 1000);
}

// ============ LESSON SCREEN ============
// ---------- روابط شرح الفيديو/المحاضرات (تظهر فقط للمنصات اللي فيها رابط فعلي) ----------
const LINK_META = {
  tiktok:     { label:'TikTok',       icon:'🎵' },
  youtube:    { label:'YouTube',      icon:'▶️' },
  facebook:   { label:'Facebook',     icon:'📘' },
  zoom:       { label:'محاضرة Zoom',  icon:'💻' },
  googleMeet: { label:'Google Meet',  icon:'🗓️' }
};
function renderLessonLinks(l){
  const links = l.links || {};
  const active = Object.keys(LINK_META).filter(k => links[k] && links[k].trim());
  if(!active.length) return '';
  return `<div class="card">
    <span class="card-tag" style="background:rgba(255,110,143,.14); color:var(--accent-3);">🎬 فيديوهات ومحاضرات شرح</span>
    <div class="lesson-links">
      ${active.map(k=>`<a class="lesson-link-btn" href="${links[k]}" target="_blank" rel="noopener">
        <span>${LINK_META[k].icon}</span><span>${LINK_META[k].label}</span>
      </a>`).join('')}
    </div>
  </div>`;
}

function openLesson(uId, lIdx){
  const u = findUnit(uId);
  STATE.currentUnit = u; STATE.currentLessonIdx = lIdx;
  const l = u.lessons[lIdx];
  navTo('screen-lesson', l.title, `الوحدة ${u.id} — درس ${lIdx+1} من ${u.lessons.length}`);
  document.getElementById('lessonProg').style.width = `${((lIdx)/u.lessons.length)*100 + (100/u.lessons.length)*0.15}%`;

  QREG = {};
  let html = '';
  html += `<div class="card">
    <span class="card-tag tag-goal">🎯 هدف الدرس</span>
    <p>${l.goal}</p>
  </div>`;

  html += `<div class="card">
    <span class="card-tag tag-concept">📌 النقاط الرئيسية</span>
    <ul>${l.points.map(p=>`<li>${p}</li>`).join('')}</ul>
  </div>`;

  html += renderLessonLinks(l);

  if(l.terms && l.terms.length){
    html += `<div class="card">
      <span class="card-tag tag-term">🃏 بطاقات مصطلحات — اضغط لقلب البطاقة</span>
      <div class="flip-grid">
        ${l.terms.map((t)=>`
          <div class="flip" onclick="this.classList.toggle('on')">
            <div class="flip-inner">
              <div class="flip-face flip-front">${t.t}</div>
              <div class="flip-face flip-back">${t.d}</div>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
  }

  html += `<div class="card">
    <span class="card-tag tag-example">💡 مثال توضيحي</span>
    <div class="example-box"><p style="margin:0">${l.example}</p></div>
  </div>`;

  if(l.remember){
    html += `<div class="card">
      <span class="card-tag tag-remember">🧠 تذكّر</span>
      <p style="margin:0">${l.remember}</p>
    </div>`;
  }

  if(l.quiz && l.quiz.length){
    html += `<div class="card">
      <span class="card-tag tag-concept">✏️ اختبر نفسك</span>
      ${l.quiz.map((q,qi)=>renderQuestion(q, quizKey(uId,lIdx,qi), 'quiz', qi, l.quiz.length)).join('')}
    </div>`;
  }

  if(l.practice && l.practice.length){
    html += `<div class="card">
      <span class="card-tag" style="background:rgba(124,156,255,.14); color:#A9BEFF;">🧩 تدريبات إضافية</span>
      ${l.practice.map((q,qi)=>renderQuestion(q, practiceKey(uId,lIdx,qi), 'practice', qi, l.practice.length)).join('')}
    </div>`;
  }

  html += `<div class="nav-btns" style="margin-bottom:8px;">
    <button class="btn btn-ghost" style="flex:none; width:100%;" onclick="printLessonContent(${uId},${lIdx})">🖨️ طباعة/تصدير هذا الدرس PDF</button>
  </div>`;

  html += `<div class="nav-btns">
    <button class="btn btn-ghost" onclick="prevLesson()">${lIdx>0?'الدرس السابق':'رجوع للوحدة'}</button>
    <button class="btn btn-primary" onclick="completeLesson()">✓ إنهاء الدرس ${lIdx<u.lessons.length-1?'والتالي':''}</button>
  </div>`;

  document.getElementById('lessonBody').innerHTML = html;
}

// ============ محرك الأسئلة الموحّد (يدعم quiz + practice + الاختبار الشامل) ============
// يتطلب "تأكيد" صريح قبل قفل الإجابة، لتفادي الضغط بالخطأ على اختيار.
function renderQuestion(q, key, kind, qi, total){
  const marginBottom = (qi<total-1) ? '22px' : '4px';
  const type = q.type || 'mcq';
  QREG[key] = {type, correct: type==='mcq'? q.a : (type==='tf'? q.a : null), kind, locked:false};

  let body = '';
  if(type === 'mcq'){
    body = `<div class="opts" id="opts-${key}">
      ${q.opts.map((o,oi)=>`<button class="opt" data-idx="${oi}" onclick="selectOpt(this,'${key}')">${o}</button>`).join('')}
    </div>
    <button class="btn-confirm" id="confirm-${key}" disabled onclick="confirmAnswer('${key}')">تأكيد الإجابة ✓</button>`;
  } else if(type === 'tf'){
    body = `<div class="opts" id="opts-${key}">
      <button class="opt" data-val="true" onclick="selectOpt(this,'${key}')">✅ صح</button>
      <button class="opt" data-val="false" onclick="selectOpt(this,'${key}')">❌ خطأ</button>
    </div>
    <button class="btn-confirm" id="confirm-${key}" disabled onclick="confirmAnswer('${key}')">تأكيد الإجابة ✓</button>`;
  } else if(type === 'fill'){
    const hintText = q.hint ? q.hint : 'اكتب الكلمة أو المصطلح المناسب لسد الفراغ — تُقبل الإجابة حتى لو كتبتها كاملة مع الكلمات المجاورة لها في نص السؤال.';
    body = `
      <div class="fill-hint">💡 <b>ملاحظة قبل الحل:</b> ${hintText}</div>
      <div style="display:flex; gap:8px;">
        <input type="text" id="in-${key}" placeholder="اكتب إجابتك هنا…"
          style="flex:1; padding:11px 14px; border-radius:12px; border:1px solid var(--line); background:var(--panel-2); color:var(--ink); font-family:'Tajawal'; font-size:13px;">
        <button class="btn btn-primary" style="flex:none; padding:11px 16px;" onclick="answerFill('${key}','${(q.answer||'').replace(/'/g,"\\'")}','${kind}')">تحقق</button>
      </div>`;
  }

  return `<div style="margin-bottom:${marginBottom}" class="q-block">
    <div class="quiz-q">${qi+1}. ${q.q}</div>
    ${body}
    <div class="quiz-explain" id="ex-${key}">${q.ex||''}</div>
  </div>`;
}

function selectOpt(btn, key){
  const reg = QREG[key];
  if(!reg || reg.locked) return;
  const wrap = document.getElementById('opts-'+key);
  wrap.querySelectorAll('.opt').forEach(o=>o.classList.remove('selected'));
  btn.classList.add('selected');
  wrap.dataset.chosen = btn.dataset.idx !== undefined ? btn.dataset.idx : btn.dataset.val;
  const confirmBtn = document.getElementById('confirm-'+key);
  if(confirmBtn) confirmBtn.disabled = false;
}

function confirmAnswer(key){
  const reg = QREG[key];
  if(!reg || reg.locked) return;
  const wrap = document.getElementById('opts-'+key);
  if(wrap.dataset.chosen === undefined) return;
  let isCorrect = false;

  if(reg.type === 'mcq'){
    const chosenIdx = parseInt(wrap.dataset.chosen, 10);
    isCorrect = chosenIdx === reg.correct;
    wrap.querySelectorAll('.opt').forEach((o,i)=>{
      o.disabled = true;
      if(i===reg.correct) o.classList.add('correct');
      else if(i===chosenIdx) o.classList.add('wrong');
    });
  } else if(reg.type === 'tf'){
    const chosenVal = wrap.dataset.chosen === 'true';
    isCorrect = chosenVal === reg.correct;
    wrap.querySelectorAll('.opt').forEach(o=>{
      o.disabled = true;
      const wasTrue = o.dataset.val === 'true';
      if(wasTrue === reg.correct) o.classList.add('correct');
      else if(o.classList.contains('selected')) o.classList.add('wrong');
    });
  }

  const confirmBtn = document.getElementById('confirm-'+key);
  if(confirmBtn) confirmBtn.style.display = 'none';
  document.getElementById('ex-'+key).classList.add('show');
  reg.locked = true;
  onQuestionAnswered(key, isCorrect, reg.kind);
}

function answerFill(key, correctAnswer, kind){
  const reg = QREG[key];
  if(reg && reg.locked) return;
  const input = document.getElementById(`in-${key}`);
  const given = (input.value||'').trim();
  const norm = s => s.trim().toLowerCase().replace(/[إأآا]/g,'ا').replace(/ة/g,'ه').replace(/\s+/g,'');
  const ng = norm(given), nc = norm(correctAnswer);
  // نقبل التطابق الكامل، أو لو الطالب كتب الإجابة ضمن عبارة أطول (زي "إدمان الإنترنت" بدل "إدمان")،
  // أو العكس لو كانت إجابته جزء معقول من الإجابة الصحيحة (نص طولها 60% على الأقل لتفادي التخمين).
  const isCorrect = given.length>0 && (
    ng === nc ||
    ng.includes(nc) ||
    (nc.includes(ng) && ng.length >= Math.max(2, Math.ceil(nc.length*0.6)))
  );
  input.disabled = true;
  input.style.borderColor = isCorrect ? 'var(--accent)' : 'var(--accent-3)';
  input.style.background = isCorrect ? 'rgba(51,224,194,.12)' : 'rgba(255,110,143,.12)';
  const wrap = input.parentElement;
  wrap.querySelector('button').disabled = true;
  if(!isCorrect){
    const hint = document.createElement('div');
    hint.style.cssText='font-size:11.5px; color:var(--accent-2); margin-top:6px;';
    hint.textContent = `الإجابة الصحيحة: ${correctAnswer}`;
    wrap.insertAdjacentElement('afterend', hint);
  }
  document.getElementById(`ex-${key}`).classList.add('show');
  if(reg) reg.locked = true;
  onQuestionAnswered(key, isCorrect, kind);
}

// ============ معالجة مركزية بعد الإجابة على أي سؤال ============
function onQuestionAnswered(key, isCorrect, kind){
  if(kind === 'quiz'){
    if(!STATE.answeredQuiz[key] && isCorrect) bumpQuizCorrect(key, 2);
    STATE.answeredQuiz[key] = true;
    saveState();
  } else if(kind === 'practice'){
    if(!STATE.answeredPractice[key] && isCorrect) bumpQuizCorrect(key, 3);
    STATE.answeredPractice[key] = true;
    saveState();
  } else if(kind === 'final'){
    const s = STATE.finalTestSession;
    if(s && !s.answered[key]){
      s.answered[key] = true;
      s.answeredCount++;
      if(isCorrect) s.correctCount++;
      updateFinalTestFooter();
    }
  } else if(kind === 'exam'){
    const s = STATE.examSession;
    if(s && !s.answered[key]){
      s.answered[key] = true;
      s.answeredCount++;
      if(isCorrect) s.correctCount++;
      updateExamFooter();
    }
  }
}

function prevLesson(){
  const u = STATE.currentUnit;
  if(STATE.currentLessonIdx>0){ openLesson(u.id, STATE.currentLessonIdx-1); }
  else { openUnit(u.id, false); }
}

function completeLesson(){
  const u = STATE.currentUnit, i = STATE.currentLessonIdx;
  const key = lessonKey(u.id,i);
  const wasNew = !STATE.completedLessons[key];
  STATE.completedLessons[key] = true;
  if(wasNew) addXP(gradeOfUnitId(u.id), 10);
  saveState();
  if(wasNew) showToast('أحسنت! تم إنهاء الدرس ✓ (+10 XP)');

  if(i < u.lessons.length-1){
    openLesson(u.id, i+1);
  } else {
    const lessonsDone = unitAllLessonsDone(u);
    const practDone = unitAllPracticeDone(u);
    const readyForTest = lessonsDone && practDone;
    let msg = 'استمر في باقي دروس الكتاب.';
    if(readyForTest) msg = 'أنت جاهز الآن لخوض الاختبار الشامل لهذه الوحدة! 🏁';
    else if(lessonsDone) msg = 'أكمل باقي التدريبات في دروس الوحدة قبل خوض الاختبار الشامل.';

    document.getElementById('lessonBody').innerHTML = `
      <div class="card done-badge">
        <div class="ico">🎉</div>
        <h4>أتممت دروس وحدة "${u.title}"!</h4>
        <p>${msg}</p>
        <div class="nav-btns" style="margin-top:16px;">
          <button class="btn btn-ghost" onclick="openUnit(${u.id},false)">قائمة الدروس والاختبار الشامل</button>
          <button class="btn btn-primary" onclick="goHomeAfterUnit()">الوحدات</button>
        </div>
      </div>`;
    document.getElementById('lessonProg').style.width='100%';
  }
}
function goHomeAfterUnit(){ showTab('home'); }

// ============ الاختبار الشامل (Final Test) ============
function openFinalTest(uId, fromPaper){
  const u = findUnit(uId);
  if(!canTakeFinalTest(u) && !unitFinalTestPassed(u)){ showToast('أكمل الدروس والتدريبات أولًا'); return; }
  STATE.currentUnit = u;

  let chosen;
  if(fromPaper){
    // نفس ترتيب الأسئلة المطبوعة بالضبط (بدون خلط) عشان تطابق اللي الطالب حلّه على الورق
    chosen = (u.finalTest || []).map((q, idx)=>{ const c = JSON.parse(JSON.stringify(q)); c._sessionIdx = idx; return c; });
  } else {
    const pool = (u.finalTest || []).slice();
    shuffleArray(pool);
    const size = Math.min(FINAL_TEST_SIZE, pool.length);
    chosen = pool.slice(0, size).map((q, idx)=>{
      const clone = JSON.parse(JSON.stringify(q));
      if(clone.type === 'mcq'){
        const order = clone.opts.map((_,i)=>i);
        shuffleArray(order);
        const newOpts = order.map(i=>clone.opts[i]);
        const newCorrect = order.indexOf(clone.a);
        clone.opts = newOpts; clone.a = newCorrect;
      }
      clone._sessionIdx = idx;
      return clone;
    });
  }

  STATE.finalTestSession = { unitId: uId, questions: chosen, answered:{}, answeredCount:0, correctCount:0, fromPaper: !!fromPaper, timeExpired:false };
  navTo('screen-finaltest', fromPaper ? 'إدخال حل ورقي' : `اختبار شامل`, `الوحدة ${u.id} — ${u.title}`);
  renderFinalTest();
}
function openUnitTestFromPaper(uId){ openFinalTest(uId, true); }

function renderFinalTest(){
  const s = STATE.finalTestSession;
  const u = findUnit(s.unitId);
  QREG = {};
  let html = '';

  if(s.fromPaper){
    html += `<div class="card ft-intro">
      <span class="card-tag" style="background:rgba(124,156,255,.14); color:#A9BEFF;">📥 تسليم حل ورقي — ${u.title}</span>
      <p style="margin:0;">حلّيت الاختبار على ورقة مطبوعة؟ اختار نفس الإجابات هنا بالظبط وهنحسبلك درجتك تلقائيًا زي ما لو حليتها في الموقع مباشرة.</p>
      <label class="paper-upload-label">📎 إرفاق صورة/PDF لورقة إجابتك (اختياري، للمراجعة الشخصية فقط)</label>
      <input type="file" id="paperPhotoInput" accept="image/*,application/pdf" onchange="previewPaperPhoto(this)">
      <div id="paperPhotoPreview"></div>
    </div>`;
  } else {
    const estSecs = estimateTestSeconds(s.questions);
    html += `<div class="card ft-intro">
      <span class="card-tag" style="background:rgba(255,185,77,.14); color:var(--accent-2);">🏁 اختبار شامل — ${u.title}</span>
      <p style="margin:0 0 8px;">أجب على كل الأسئلة (${s.questions.length} سؤال) واضغط "تأكيد" لكل إجابة. الأسئلة عشوائية وتتغيّر في كل محاولة، ونسبة النجاح ${PASS_THRESHOLD*100}%.</p>
      <div class="test-timer" id="finalTestTimer">⏱️ ${formatMMSS(estSecs)}</div>
      <p style="margin:6px 0 0; font-size:10.5px; color:var(--ink-dim);">الوقت ده تقديري لطالب متوسط. تقدر تكمّل حتى بعد ما يخلص، لكن النتيجة وقتها هتتعرض للمراجعة بس ومش هتتحسب في تقدمك.</p>
    </div>`;
  }

  html += `<div class="card">`;
  html += s.questions.map((q,qi)=> renderQuestion(q, `ft-${u.id}-${qi}`, 'final', qi, s.questions.length)).join('');
  html += `</div>`;

  html += `<div class="nav-btns" style="margin-top:6px;">
    <button class="btn btn-ghost" onclick="openUnit(${u.id},false)">إلغاء والرجوع للوحدة</button>
    <button class="btn btn-primary" id="ftSubmitBtn" disabled onclick="submitFinalTest()">إنهاء الاختبار (0/${s.questions.length})</button>
  </div>`;

  document.getElementById('finalTestBody').innerHTML = html;
  document.getElementById('finalTestProg').style.width = '0%';
  if(!s.fromPaper){
    const estSecs = estimateTestSeconds(s.questions);
    startCountdown(estSecs, 'finalTestTimer', markFinalTestExpired);
  }
}

function markFinalTestExpired(){
  const s = STATE.finalTestSession;
  if(!s) return;
  s.timeExpired = true;
  showToast('⏰ خلص الوقت المقترح — كمّل الحل للمراجعة، بس النتيجة دي مش هتتحسب في تقدمك.');
}

function updateFinalTestFooter(){
  const s = STATE.finalTestSession;
  const btn = document.getElementById('ftSubmitBtn');
  if(!btn) return;
  btn.textContent = `إنهاء الاختبار (${s.answeredCount}/${s.questions.length})`;
  btn.disabled = s.answeredCount < s.questions.length;
  const prog = document.getElementById('finalTestProg');
  if(prog) prog.style.width = `${(s.answeredCount/s.questions.length)*100}%`;
}

// معاينة صورة/PDF ورقة الحل (للمراجعة الشخصية فقط أثناء الجلسة، مش بتتحفظ)
function previewPaperPhoto(input){
  const file = input.files && input.files[0];
  const prev = document.getElementById('paperPhotoPreview');
  if(!file || !prev) return;
  if(file.type === 'application/pdf'){
    prev.innerHTML = `<p style="font-size:12px; color:var(--accent); margin-top:8px;">📄 تم إرفاق ملف PDF: ${file.name}</p>`;
    return;
  }
  const reader = new FileReader();
  reader.onload = (e)=>{ prev.innerHTML = `<img src="${e.target.result}" style="max-width:100%; border-radius:10px; margin-top:8px;">`; };
  reader.readAsDataURL(file);
}

function submitFinalTest(){
  const s = STATE.finalTestSession;
  if(s.answeredCount < s.questions.length) return;
  clearActiveTimer();
  const u = findUnit(s.unitId);
  const score = s.correctCount / s.questions.length;
  const passed = score >= PASS_THRESHOLD;
  const pct = Math.round(score*100);
  const nextUnit = findUnit(u.id+1);

  // انتهى الوقت المقترح في محاولة حية (مش ورقية): نعرض النتيجة للمراجعة بس من غير احتساب
  if(s.timeExpired && !s.fromPaper){
    document.getElementById('finalTestBody').innerHTML = `
      <div class="card done-badge">
        <div class="ico">⏰</div>
        <h4>خلص الوقت المقترح</h4>
        <p style="font-size:22px; font-weight:900; color:var(--accent-3); margin:8px 0;">${pct}%</p>
        <p>${s.correctCount} إجابة صحيحة من ${s.questions.length} — النتيجة دي للمراجعة فقط ومش هتتحسب في تقدمك.</p>
        <div class="nav-btns" style="margin-top:16px;">
          <button class="btn btn-ghost" onclick="openFinalTest(${u.id})">إعادة المحاولة من جديد</button>
          <button class="btn btn-primary" onclick="openUnit(${u.id},false)">رجوع للوحدة</button>
        </div>
      </div>`;
    document.getElementById('finalTestProg').style.width = '100%';
    STATE.finalTestSession = null;
    return;
  }

  const prevResult = STATE.finalTestResults[u.id] || {passed:false, bestScore:0, total:s.questions.length, attempts:0};
  const hadPerfectBefore = prevResult.bestScore === 1;
  STATE.finalTestResults[u.id] = {
    passed: passed || prevResult.passed,
    bestScore: Math.max(score, prevResult.bestScore),
    total: s.questions.length,
    attempts: prevResult.attempts + 1
  };
  if(!hadPerfectBefore && STATE.finalTestResults[u.id].bestScore === 1){
    logBadgeEarned('unit', u.id, `وحدة ${u.id} — ${u.title} — بلا أخطاء`, '🏅');
    addXP(gradeOfUnitId(u.id), 50);
  }
  saveState();

  const wasPaper = s.fromPaper;
  document.getElementById('finalTestBody').innerHTML = `
    <div class="card done-badge">
      <div class="ico">${passed ? '🏆' : '💪'}</div>
      <h4>${passed ? 'مبروك! اجتزت الاختبار الشامل' : 'لم تصل لنسبة النجاح بعد'}</h4>
      <p style="font-size:22px; font-weight:900; color:${passed?'var(--accent)':'var(--accent-3)'}; margin:8px 0;">${pct}%</p>
      <p>${s.correctCount} إجابة صحيحة من ${s.questions.length} (النجاح يتطلب ${PASS_THRESHOLD*100}%)</p>
      ${passed && nextUnit ? `<p style="color:var(--accent);">🔓 تم فتح الوحدة التالية: "${nextUnit.title}"</p>` : ''}
      ${!passed && !wasPaper ? `<p style="color:var(--ink-dim); font-size:12px;">الأسئلة تتغيّر عشوائيًا في كل محاولة — حاول مرة أخرى!</p>` : ''}
      ${wasPaper ? `<button class="btn btn-ghost" style="width:100%; margin-top:10px;" onclick="printAnswerKey('unit', ${u.id})">🔑 اعرض نموذج الإجابة الآن</button>` : ''}
      <div class="nav-btns" style="margin-top:16px;">
        <button class="btn btn-ghost" onclick="${wasPaper ? `openUnitTestFromPaper(${u.id})` : `openFinalTest(${u.id})`}">إعادة المحاولة</button>
        <button class="btn btn-primary" onclick="openUnit(${u.id},false)">رجوع للوحدة</button>
      </div>
    </div>`;
  document.getElementById('finalTestProg').style.width = '100%';
  STATE.finalTestSession = null;
}

// ============ الامتحانات الشاملة الخمسة (100 سؤال لكل امتحان) ============
function examResult(examId){ return STATE.examResults[examId]; }
function examPassed(examId){ const r = examResult(examId); return !!(r && r.passed); }

function bac2ExamsLocked(){ return STATE.currentGrade==='2bac' && !(BAC2_CURRICULUM_COMPLETE && BAC2_EXAMS.length>0); }
function renderExamList(){
  const list = document.getElementById('examList');
  const intro = document.getElementById('examIntroText');
  if(STATE.currentGrade==='2bac'){
    if(intro) intro.textContent = 'امتحانات الصف الثاني بكالوريا هتتفتح هنا أول ما المنهج ينزل كامل.';
    if(bac2ExamsLocked()){
      list.innerHTML = `<div class="card" style="text-align:center; padding:34px 20px;">
        <div style="font-size:40px; margin-bottom:10px;">🔒</div>
        <h4 style="margin:0 0 6px;">امتحانات الصف الثاني بكالوريا مقفولة</h4>
        <p style="color:var(--ink-dim); font-size:12.5px; margin:0;">لسه الجزء الأول بس من المنهج نزل — الامتحانات الشاملة هتتفتح لما باقي الأجزاء تتضاف.</p>
      </div>`;
      return;
    }
  } else if(intro){
    intro.textContent = '5 امتحانات مختلفة، كل امتحان 100 سؤال يغطي كل الوحدات الـ13، وأصعب شوية من اختبارات الوحدات — للمراجعة الشاملة قبل الامتحان الحقيقي. سجّل 90% أو أكثر في أي امتحان عشان تفتح جائزته 🏆.';
  }
  const EXAMS = STATE.currentGrade==='2bac' ? BAC2_EXAMS : FINAL_EXAMS;
  list.innerHTML = EXAMS.map(ex=>{
    const r = examResult(ex.id);
    const passed = r && r.passed;
    const bestPct = r ? Math.round(r.bestScore*100) : null;
    return `<div class="exam-card">
      <div class="exnum" onclick="openExam(${ex.id})">${ex.id}</div>
      <div class="exmeta" onclick="openExam(${ex.id})">
        <h4>${ex.title} ${passed?'<span class=\"badge-ok\">✓ 🏆</span>':''}</h4>
        <p>${ex.questions.length} سؤال · تغطي كل الوحدات الـ13 ${r? `· أفضل نتيجة: ${bestPct}% (${r.attempts} محاولة)` : '· لم تُحل بعد'}</p>
      </div>
      <button class="exam-print-btn" onclick="event.stopPropagation(); printExamPaper(${ex.id})" title="طباعة/تصدير PDF">🖨️</button>
      <button class="exam-print-btn" onclick="event.stopPropagation(); openExamFromPaper(${ex.id})" title="تسليم حل ورقي">📥</button>
      <div class="exbadge" onclick="openExam(${ex.id})">${passed?'🏆':'▶️'}</div>
    </div>`;
  }).join('');
}

function openExam(examId, fromPaper){
  if(bac2ExamsLocked()){ showToast('امتحانات تانية بكالوريا مقفولة لحد ما المنهج ينزل كامل 🔒'); return; }
  const ex = FINAL_EXAMS.find(x=>x.id===examId);
  let pool;
  if(fromPaper){
    pool = ex.questions.map(q=>JSON.parse(JSON.stringify(q))); // نفس الترتيب المطبوع بالضبط
  } else {
    pool = ex.questions.map(q=>JSON.parse(JSON.stringify(q)));
    shuffleArray(pool);
    pool.forEach(q=>{
      if(q.type === 'mcq'){
        const order = q.opts.map((_,i)=>i);
        shuffleArray(order);
        const newOpts = order.map(i=>q.opts[i]);
        const newCorrect = order.indexOf(q.a);
        q.opts = newOpts; q.a = newCorrect;
      }
    });
  }
  STATE.examSession = { examId, questions: pool, answered:{}, answeredCount:0, correctCount:0, fromPaper: !!fromPaper };
  navTo('screen-examtest', fromPaper ? 'إدخال حل ورقي' : ex.title, fromPaper ? ex.title : `${pool.length} سؤال — امتحان مراجعة شامل`);
  renderExamScreen();
}
function openExamFromPaper(examId){ openExam(examId, true); }

function renderExamScreen(){
  const s = STATE.examSession;
  const ex = FINAL_EXAMS.find(x=>x.id===s.examId);
  QREG = {};
  let html = '';

  if(s.fromPaper){
    html += `<div class="card exams-intro">
      <span class="card-tag" style="background:rgba(124,156,255,.14); color:#A9BEFF;">📥 تسليم حل ورقي — ${ex.title}</span>
      <p style="margin:0;">حلّيت الامتحان على ورقة مطبوعة؟ اختار نفس إجاباتك هنا وهنحسبلك درجتك ونضيفها لتقدمك زي ما لو حليتها في الموقع.</p>
      <label class="paper-upload-label">📎 إرفاق صورة/PDF لورقة إجابتك (اختياري، للمراجعة الشخصية فقط)</label>
      <input type="file" id="paperPhotoInput" accept="image/*,application/pdf" onchange="previewPaperPhoto(this)">
      <div id="paperPhotoPreview"></div>
    </div>`;
  } else {
    const estSecs = estimateTestSeconds(s.questions);
    html += `<div class="card exams-intro">
      <span class="card-tag" style="background:rgba(255,110,143,.14); color:var(--accent-3);">🏁 ${ex.title}</span>
      <p style="margin:0 0 8px;">${s.questions.length} سؤال، أجب وأكّد كل سؤال. النجاح بجائزة 🏆 يتطلب 90% أو أكثر.</p>
      <div class="test-timer" id="examTestTimer">⏱️ ${formatMMSS(estSecs)}</div>
      <p style="margin:6px 0 0; font-size:10.5px; color:var(--ink-dim);">الوقت ده تقديري لطالب متوسط (حوالي ${Math.round(estSecs/60)} دقيقة). ⚠️ بعد ما الوقت يخلص، الامتحان هيتقفل تلقائيًا ويتسلّم بإجاباتك لحد وقتها.</p>
    </div>`;
  }

  html += `<div class="card">`;
  html += s.questions.map((q,qi)=> renderQuestion(q, `ex-${ex.id}-${qi}`, 'exam', qi, s.questions.length)).join('');
  html += `</div>`;
  html += `<div class="nav-btns" style="margin-top:6px;">
    <button class="btn btn-ghost" onclick="showTab('exams')">إلغاء والرجوع لقائمة الامتحانات</button>
    <button class="btn btn-primary" id="examSubmitBtn" disabled onclick="submitExam()">إنهاء الامتحان (0/${s.questions.length})</button>
  </div>`;
  document.getElementById('examBody').innerHTML = html;
  document.getElementById('examProg').style.width = '0%';
  if(!s.fromPaper){
    const estSecs = estimateTestSeconds(s.questions);
    startCountdown(estSecs, 'examTestTimer', lockExamOnTimeout);
  }
}

// الامتحانات الشاملة الكبيرة (5×100 سؤال): بعد انتهاء الوقت المقترح يتقفل الامتحان فورًا ويتسلّم تلقائيًا
function lockExamOnTimeout(){
  const s = STATE.examSession;
  if(!s) return;
  document.querySelectorAll('#examBody .opt, #examBody .btn-confirm, #examBody input, #examBody button').forEach(el=>{ el.disabled = true; });
  showToast('⏰ انتهى الوقت المقترح — تم قفل الامتحان وتسليمه تلقائيًا بإجاباتك لحد الآن');
  submitExam(true);
}

function updateExamFooter(){
  const s = STATE.examSession;
  const btn = document.getElementById('examSubmitBtn');
  if(!btn) return;
  btn.textContent = `إنهاء الامتحان (${s.answeredCount}/${s.questions.length})`;
  btn.disabled = s.answeredCount < s.questions.length;
  const prog = document.getElementById('examProg');
  if(prog) prog.style.width = `${(s.answeredCount/s.questions.length)*100}%`;
}

function submitExam(force){
  const s = STATE.examSession;
  if(!force && s.answeredCount < s.questions.length) return;
  clearActiveTimer();
  const ex = FINAL_EXAMS.find(x=>x.id===s.examId);
  const score = s.correctCount / s.questions.length;
  const passed = score >= 0.9;

  const prev = STATE.examResults[ex.id] || {bestScore:0, attempts:0, passed:false};
  const hadPassedBefore = prev.passed;
  STATE.examResults[ex.id] = {
    bestScore: Math.max(score, prev.bestScore),
    attempts: prev.attempts + 1,
    passed: passed || prev.passed
  };
  if(!hadPassedBefore && STATE.examResults[ex.id].passed){
    logBadgeEarned('exam', ex.id, `${ex.title} — 90% فأكثر`, '🏆');
    addXP('1sec', 100);
  }
  saveState();

  const wasPaper = s.fromPaper;
  const pct = Math.round(score*100);
  document.getElementById('examBody').innerHTML = `
    <div class="card done-badge">
      <div class="ico">${passed ? '🏆' : (force ? '⏰' : '💪')}</div>
      <h4>${passed ? 'مبروك! فتحت جائزة هذا الامتحان' : (force ? 'انتهى الوقت وتم تسليم الامتحان تلقائيًا' : 'قريب! جرّب تاني عشان توصل 90%')}</h4>
      <p style="font-size:22px; font-weight:900; color:${passed?'var(--accent)':'var(--accent-3)'}; margin:8px 0;">${pct}%</p>
      <p>${s.correctCount} إجابة صحيحة من ${s.questions.length}</p>
      ${!passed && !wasPaper ? `<p style="color:var(--ink-dim); font-size:12px;">الأسئلة تتغيّر ترتيبًا واختياراتها في كل محاولة — حاول مرة أخرى!</p>` : ''}
      ${wasPaper ? `<button class="btn btn-ghost" style="width:100%; margin-top:10px;" onclick="printAnswerKey('exam', ${ex.id})">🔑 اعرض نموذج الإجابة الآن</button>` : ''}
      <div class="nav-btns" style="margin-top:16px;">
        <button class="btn btn-ghost" onclick="${wasPaper ? `openExamFromPaper(${ex.id})` : `openExam(${ex.id})`}">إعادة المحاولة</button>
        <button class="btn btn-primary" onclick="showTab('exams')">قائمة الامتحانات</button>
      </div>
    </div>`;
  document.getElementById('examProg').style.width = '100%';
  STATE.examSession = null;
}

// ============ نظام الجوائز (Badges) ============
// ---------- تسجيل لحظة تحقق كل جائزة (لعرض "آخر جائزة" وعدد الجوائز الكلي على الشهادة) ----------
function logBadgeEarned(type, id, name, icon){
  if(!STATE.badgeLog) STATE.badgeLog = [];
  const already = STATE.badgeLog.some(b => b.type===type && b.id===id);
  if(already) return;
  STATE.badgeLog.push({ type, id, name, icon, earnedAt: new Date().toISOString() });
}
function totalBadgesEarned(){
  const scope = certScope();
  const unitBadges = scope.units.filter(u => STATE.finalTestResults[u.id] && STATE.finalTestResults[u.id].bestScore === 1).length;
  const examBadges = scope.exams.filter(ex => examPassed(ex.id)).length;
  return unitBadges + examBadges;
}
function latestBadgeEarned(){
  if(!STATE.badgeLog || !STATE.badgeLog.length) return null;
  return STATE.badgeLog.slice().sort((a,b)=> new Date(b.earnedAt) - new Date(a.earnedAt))[0];
}

function renderBadges(){
  const grid = document.getElementById('badgesGrid');
  if(!grid) return;
  const scope = certScope();
  let html = '';
  scope.units.forEach(u=>{
    const r = STATE.finalTestResults[u.id];
    const unlocked = r && r.bestScore === 1;
    html += `<div class="badge-cell ${unlocked?'unlocked':''}">
      <div class="bic">${unlocked?'🏅':'🔒'}</div>
      <div class="blb">وحدة ${u.id} بلا أخطاء</div>
    </div>`;
  });
  scope.exams.forEach(ex=>{
    const unlocked = examPassed(ex.id);
    html += `<div class="badge-cell ${unlocked?'unlocked':''}">
      <div class="bic">${unlocked?'🏆':'🔒'}</div>
      <div class="blb">امتحان ${ex.id} — 90%+</div>
    </div>`;
  });
  if(!scope.units.length && !scope.exams.length){
    html = `<p style="color:var(--ink-dim); font-size:12.5px; text-align:center; grid-column:1/-1;">لسه مفيش وحدات مُضافة لـ${scope.gradeLabel} — الجوائز هتظهر هنا أول ما يتضاف المحتوى.</p>`;
  }
  grid.innerHTML = html;
}

// ---------- تصدير كل الجوائز والشهادة في ملف JSON ----------
// ---------- رسم تقرير الجوائز والشهادة على Canvas (خلفية بيضاء تناسب الطباعة/الأرشفة) ----------
function drawAchievementsReportCanvas(canvas, data){
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle = '#C9A24B'; ctx.lineWidth = 6;
  ctx.strokeRect(14,14,W-28,H-28);

  ctx.textAlign = 'right';
  let y = 66;
  ctx.fillStyle = '#111';
  ctx.font = 'bold 30px Tajawal, sans-serif';
  ctx.fillText('تقرير الجوائز والشهادة — علوم البرمجة', W-44, y); y += 42;

  ctx.font = '16px Tajawal, sans-serif'; ctx.fillStyle = '#555';
  ctx.fillText(`الاسم: ${data.student.name}`, W-44, y); y += 26;
  ctx.fillText(`معرف الطالب: ${data.student.id || '—'}`, W-44, y); y += 26;
  ctx.fillText(`تاريخ التصدير: ${new Date(data.student.exportDate).toLocaleDateString('ar-EG', {year:'numeric', month:'long', day:'numeric'})}`, W-44, y); y += 40;

  ctx.font = 'bold 21px Tajawal, sans-serif'; ctx.fillStyle = '#B8860B';
  ctx.fillText(`🎓 المركز المحقق: ${data.certificate.title}`, W-44, y); y += 30;
  ctx.font = '15px Tajawal, sans-serif'; ctx.fillStyle = '#333';
  ctx.fillText(`نسبة الأداء العام: ${data.certificate.overallScorePercent}%`, W-44, y); y += 44;

  ctx.font = 'bold 19px Tajawal, sans-serif'; ctx.fillStyle = '#111';
  ctx.fillText('🏅 جوائز الوحدات (بلا أخطاء):', W-44, y); y += 30;
  ctx.font = '14px Tajawal, sans-serif';
  data.unitBadges.forEach(b=>{
    ctx.fillStyle = b.earned ? '#1a7d3a' : '#999';
    ctx.fillText(`${b.earned ? '✅' : '🔒'}  ${b.title} — ${b.bestScorePercent}%`, W-44, y);
    y += 25;
  });

  y += 16;
  ctx.font = 'bold 19px Tajawal, sans-serif'; ctx.fillStyle = '#111';
  ctx.fillText('🏆 جوائز الامتحانات الشاملة (90%+):', W-44, y); y += 30;
  ctx.font = '14px Tajawal, sans-serif';
  data.examBadges.forEach(b=>{
    ctx.fillStyle = b.earned ? '#1a7d3a' : '#999';
    ctx.fillText(`${b.earned ? '✅' : '🔒'}  ${b.title} — ${b.bestScorePercent}%`, W-44, y);
    y += 25;
  });

  ctx.textAlign = 'center'; ctx.font = '12px Tajawal, sans-serif'; ctx.fillStyle = '#999';
  ctx.fillText('علوم البرمجة — إعداد: أحمد رامي © 2026 جميع الحقوق محفوظة', W/2, H-24);
}

function buildAchievementsData(){
  const name = STATE.userName || 'طالب';
  const rank = computeCertRank();
  const scope = certScope();
  return {
    student: { name, id: STATE.studentId || '', exportDate: new Date().toISOString() },
    certificate: rank ? {
      tierId: rank.tier.id, title: rank.tier.title,
      congratulation: rank.tier.message(name, { gradeLabel: rank.gradeLabel, unitsCount: scope.units.length, examsCount: scope.exams.length }),
      overallScorePercent: Math.round(rank.overallScore * 100)
    } : { tierId:'none', title:'لا يوجد مركز محقق بعد', overallScorePercent:0 },
    unitBadges: scope.units.map(u=>{
      const r = STATE.finalTestResults[u.id];
      return { unitId:u.id, title:`وحدة ${u.id} — ${u.title} — بلا أخطاء`, earned: !!(r && r.bestScore===1), bestScorePercent: r?Math.round(r.bestScore*100):0 };
    }),
    examBadges: scope.exams.map(ex=>{
      const r = STATE.examResults[ex.id];
      return { examId:ex.id, title:`${ex.title} — 90% فأكثر`, earned: examPassed(ex.id), bestScorePercent: r?Math.round(r.bestScore*100):0 };
    })
  };
}

// ---------- تصدير الجوائز والشهادة كملف PDF (أصعب في التعديل من JSON، ومقروء مباشرة بدون التطبيق) ----------
function exportAchievementsPDF(){
  const name = STATE.userName || 'طالب';
  const data = buildAchievementsData();

  const badgeCount = data.unitBadges.length + data.examBadges.length;
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 330 + badgeCount * 25 + 90;
  drawAchievementsReportCanvas(canvas, data);

  const jsPDFCtor = window.jspdf && window.jspdf.jsPDF;
  if(jsPDFCtor){
    try{
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDFCtor({ orientation:'portrait', unit:'px', format:[canvas.width, canvas.height] });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`جوائز-وشهادة-${name}.pdf`);
      showToast('تم تصدير ملف الجوائز والشهادة (PDF) 📄');
      return;
    }catch(e){ /* نكمل على البديل تحت */ }
  }
  // بديل آمن لو مكتبة jsPDF مش متاحة (بدون إنترنت مثلًا): نافذة طباعة يحفظها المستخدم يدويًا كـ PDF
  try{
    const imgData = canvas.toDataURL('image/png');
    const win = window.open('', '_blank');
    if(!win){ showToast('اسمح للمتصفح بفتح نافذة منبثقة عشان تقدر تصدّر PDF'); return; }
    win.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>تقرير الجوائز</title>
      <style>*{margin:0;padding:0;} body{display:flex;justify-content:center;background:#fff;} img{width:100%;max-width:800px;}
      @media print{ @page{margin:0.5cm;} }</style></head>
      <body><img src="${imgData}" onload="setTimeout(()=>window.print(),300)"></body></html>`);
    win.document.close();
    showToast('افتح نافذة الطباعة واختر "حفظ كـ PDF" 🖨️');
  }catch(e){ showToast('تعذّر التصدير، حاول مرة أخرى'); }
}

// ============ GLOSSARY ============
function printGlossaryPDF(){
  const GL = getGlossary();
  let body = `<h1>قاموس مصطلحات علوم البرمجة — ${certScope().gradeLabel}</h1><div class="meta">عدد المصطلحات: ${GL.length}</div>`;
  GL.forEach(g=>{
    body += `<div class="q"><b>${g.t}</b><p style="margin:2px 0 0; font-size:12.5px;">${g.d}</p></div>`;
  });
  openPrintWindow('قاموس المصطلحات', body);
}

function renderGlossary(query){
  const q = (query||'').trim();
  const GL = getGlossary();
  const filtered = q ? GL.filter(g=> g.t.includes(q) || g.d.includes(q)) : GL;
  const list = document.getElementById('glossList');
  if(!filtered.length && !q){
    list.innerHTML = `<p style="color:var(--ink-dim); text-align:center; margin-top:30px; font-size:13px;">لسه مفيش مصطلحات مُضافة لـ${certScope().gradeLabel}.</p>`;
    return;
  }
  if(!filtered.length){
    list.innerHTML = `<p style="color:var(--ink-dim); text-align:center; margin-top:30px; font-size:13px;">لا توجد نتائج لـ "${q}"</p>`;
    return;
  }
  list.innerHTML = filtered.map(g=>`
    <div class="gloss-item">
      <b>${g.t}</b>
      <span>${g.d}</span>
    </div>`).join('');
}

// ============ جروب الواتساب الرسمي ============
function openWhatsappGroup(){
  window.open(WHATSAPP_GROUP_URL, '_blank');
}
function closeWhatsappModal(){
  const modal = document.getElementById('whatsappModal');
  if(modal) modal.style.display = 'none';
  try{ localStorage.setItem('zakera_whatsapp_seen', '1'); }catch(e){}
}
function checkWhatsappReminder(){
  try{
    const nameModal = document.getElementById('nameModal');
    if(nameModal && nameModal.style.display === 'flex') return; // ننتظر لحد ما الطالب يخلّص إدخال اسمه الأول
    const seen = localStorage.getItem('zakera_whatsapp_seen');
    if(!seen){
      const modal = document.getElementById('whatsappModal');
      if(modal) modal.style.display = 'flex';
    }
  }catch(e){ /* لا يوجد localStorage متاح، تجاهل بصمت */ }
}

// ============ قسم الأبحاث ============
let currentResearchCategory = null; // null = عرض كل التصنيفات

function renderResearchScreen(){
  currentResearchCategory = null;
  renderResearchCategoryGrid();
  renderResearchList();
}

function renderResearchCategoryGrid(){
  const grid = document.getElementById('researchCategoryGrid');
  if(!grid) return;
  grid.innerHTML = RESEARCH_CATEGORIES.map(c=>{
    const count = RESEARCH_LIBRARY.filter(r=>r.category===c.id).length;
    const active = currentResearchCategory === c.id;
    return `<div class="research-cat-item ${active?'active':''}" onclick="selectResearchCategory('${c.id}')">
      <div class="rci-icon">${c.icon}</div>
      <div class="rci-title">${c.title}</div>
      <div class="rci-count">${count} بحث</div>
    </div>`;
  }).join('');
}

function selectResearchCategory(catId){
  currentResearchCategory = (currentResearchCategory === catId) ? null : catId;
  renderResearchCategoryGrid();
  renderResearchList();
}

function renderResearchList(){
  const list = document.getElementById('researchList');
  if(!list) return;
  const items = currentResearchCategory
    ? RESEARCH_LIBRARY.filter(r=>r.category===currentResearchCategory)
    : RESEARCH_LIBRARY;

  if(!items.length){
    list.innerHTML = `<div class="card" style="text-align:center; padding:28px 16px;">
      <div style="font-size:32px; margin-bottom:8px;">🗂️</div>
      <h4 style="margin:0 0 6px;">لسه مفيش أبحاث جاهزة هنا</h4>
      <p style="color:var(--ink-dim); font-size:12.5px; margin:0;">الأبحاث الجاهزة هتتضاف تباعًا — تقدر ترسل بحثك على جروب الواتساب وممكن يتعرض هنا لباقي الطلاب.</p>
    </div>`;
    return;
  }

  list.innerHTML = items.map(r=>{
    const cat = RESEARCH_CATEGORIES.find(c=>c.id===r.category);
    return `<a class="research-item" href="${r.url}" target="_blank" rel="noopener">
      <div class="ri-icon">${cat ? cat.icon : '📄'}</div>
      <div class="ri-meta">
        <b>${r.title}</b>
        <span>${r.description || ''}${r.author ? ' — ' + r.author : ''}</span>
      </div>
      <div class="ri-arrow">‹</div>
    </a>`;
  }).join('');
}

// ============ كتابة بحث بنفسك (Research Composer) ============
const DEFAULT_RESEARCH_SECTIONS = [
  { title:'المقدمة', content:'' },
  { title:'العرض / صلب الموضوع', content:'' },
  { title:'الخاتمة', content:'' },
  { title:'المراجع', content:'' },
];

function researchDraftKey(){
  return 'zakera_research_draft_' + (STATE.studentId || 'guest');
}

function loadResearchDraft(){
  try{
    const raw = localStorage.getItem(researchDraftKey());
    if(raw){
      const d = JSON.parse(raw);
      if(!d.attachments) d.attachments = [];
      return d;
    }
  }catch(e){}
  return { title:'', category: RESEARCH_CATEGORIES[0].id, sections: JSON.parse(JSON.stringify(DEFAULT_RESEARCH_SECTIONS)), attachments: [], updatedAt:null };
}

function saveResearchDraft(draft){
  try{ localStorage.setItem(researchDraftKey(), JSON.stringify(draft)); }
  catch(e){ showToast('⚠️ المسودة كبيرة جدًا (غالبًا بسبب صور كتير)، جرّب تقلل حجم الصور أو تصدّر PDF دلوقتي'); }
}

let currentResearchDraft = null;

function openResearchComposer(){
  currentResearchDraft = loadResearchDraft();
  navTo('screen-research-write', 'اعمل بحثك بنفسك', 'اكتب بحثك وضيف صور وأدلة وصدّره PDF جاهز للإرسال');
  renderResearchComposer();
}

function renderResearchComposer(){
  const d = currentResearchDraft;
  document.getElementById('rwTitle').value = d.title || '';

  const catSelect = document.getElementById('rwCategory');
  catSelect.innerHTML = RESEARCH_CATEGORIES.map(c=>`<option value="${c.id}" ${c.id===d.category?'selected':''}>${c.icon} ${c.title}</option>`).join('');

  const wrap = document.getElementById('rwSections');
  wrap.innerHTML = d.sections.map((s, i)=>`
    <div class="card rw-section">
      <div class="rw-section-head">
        <input type="text" class="rw-sec-title" value="${(s.title||'').replace(/"/g,'&quot;')}" placeholder="عنوان القسم" oninput="updateResearchSection(${i}, 'title', this.value)">
        ${d.sections.length>1 ? `<button class="rw-sec-remove" onclick="removeResearchSection(${i})">✕</button>` : ''}
      </div>
      <textarea class="rw-sec-content" placeholder="اكتب محتوى هذا القسم هنا…" rows="5" oninput="updateResearchSection(${i}, 'content', this.value)">${s.content||''}</textarea>
    </div>`).join('');

  renderResearchAttachments();
}

function renderResearchAttachments(){
  const d = currentResearchDraft;
  const wrap = document.getElementById('rwAttachments');
  if(!wrap) return;
  wrap.innerHTML = (d.attachments||[]).map((a, i)=>{
    if(a.type === 'image'){
      return `<div class="card rw-section">
        <div class="rw-section-head"><b style="font-size:12.5px;">🖼️ صورة</b><button class="rw-sec-remove" onclick="removeResearchAttachment(${i})">✕</button></div>
        <input type="file" accept="image/*" onchange="onResearchImageSelected(${i}, this)">
        ${a.imageData ? `<img src="${a.imageData}" style="max-width:100%; border-radius:10px; margin-top:8px;">` : ''}
        <input type="text" class="rw-sec-title" style="margin-top:8px;" placeholder="وصف الصورة (اختياري)" value="${(a.caption||'').replace(/"/g,'&quot;')}" oninput="updateResearchAttachment(${i}, 'caption', this.value)">
      </div>`;
    }
    const meta = a.type === 'fact' ? { icon:'🔎', label:'دليل / حقيقة علمية' } : { icon:'🧪', label:'تجربة' };
    return `<div class="card rw-section">
      <div class="rw-section-head">
        <input type="text" class="rw-sec-title" placeholder="عنوان ${meta.label}" value="${(a.title||'').replace(/"/g,'&quot;')}" oninput="updateResearchAttachment(${i}, 'title', this.value)">
        <button class="rw-sec-remove" onclick="removeResearchAttachment(${i})">✕</button>
      </div>
      <textarea class="rw-sec-content" rows="4" placeholder="${a.type==='fact' ? 'اكتب الحقيقة أو الدليل العلمي وتفاصيله هنا…' : 'اكتب خطوات التجربة والملاحظات والنتيجة هنا…'}" oninput="updateResearchAttachment(${i}, 'content', this.value)">${a.content||''}</textarea>
    </div>`;
  }).join('');
}

function onResearchDraftChange(){
  const d = currentResearchDraft;
  d.title = document.getElementById('rwTitle').value;
  d.category = document.getElementById('rwCategory').value;
  d.updatedAt = new Date().toISOString();
  saveResearchDraft(d);
}

function updateResearchSection(idx, field, value){
  currentResearchDraft.sections[idx][field] = value;
  currentResearchDraft.updatedAt = new Date().toISOString();
  saveResearchDraft(currentResearchDraft);
}

function addResearchSection(){
  currentResearchDraft.sections.push({ title:'قسم جديد', content:'' });
  saveResearchDraft(currentResearchDraft);
  renderResearchComposer();
}

function removeResearchSection(idx){
  if(currentResearchDraft.sections.length <= 1) return;
  currentResearchDraft.sections.splice(idx, 1);
  saveResearchDraft(currentResearchDraft);
  renderResearchComposer();
}

// ---------- الإضافات: صور، أدلة/حقائق علمية، تجارب ----------
function addResearchAttachment(type){
  if(!currentResearchDraft.attachments) currentResearchDraft.attachments = [];
  const item = type === 'image' ? { type, caption:'', imageData:null } : { type, title:'', content:'' };
  currentResearchDraft.attachments.push(item);
  saveResearchDraft(currentResearchDraft);
  renderResearchAttachments();
}

function removeResearchAttachment(idx){
  currentResearchDraft.attachments.splice(idx, 1);
  saveResearchDraft(currentResearchDraft);
  renderResearchAttachments();
}

function updateResearchAttachment(idx, field, value){
  currentResearchDraft.attachments[idx][field] = value;
  currentResearchDraft.updatedAt = new Date().toISOString();
  saveResearchDraft(currentResearchDraft);
}

function onResearchImageSelected(idx, fileInput){
  const file = fileInput.files && fileInput.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (e)=>{
    currentResearchDraft.attachments[idx].imageData = e.target.result;
    saveResearchDraft(currentResearchDraft);
    renderResearchAttachments();
  };
  reader.readAsDataURL(file);
}

function deleteResearchDraft(){
  if(!confirm('متأكد إنك عايز تمسح البحث ده كله وتبدأ من جديد؟ الإجراء ده لا يمكن التراجع عنه.')) return;
  try{ localStorage.removeItem(researchDraftKey()); }catch(e){}
  currentResearchDraft = loadResearchDraft();
  renderResearchComposer();
  showToast('تم حذف المسودة، ابدأ بحث جديد');
}

function exportResearchPDF(){
  const d = currentResearchDraft;
  const title = d.title && d.title.trim() ? d.title.trim() : 'بحث بدون عنوان';
  const cat = RESEARCH_CATEGORIES.find(c=>c.id===d.category);
  const dateStr = new Date().toLocaleDateString('ar-EG', { year:'numeric', month:'long', day:'numeric' });

  let body = `<h1>${title}</h1>`;
  body += `<div class="meta">إعداد: ${STATE.userName || 'طالب'} &nbsp;·&nbsp; التصنيف: ${cat ? cat.icon+' '+cat.title : ''} &nbsp;·&nbsp; ${dateStr}</div>`;
  d.sections.forEach(s=>{
    if(!s.title && !s.content) return;
    body += `<h2>${s.title || ''}</h2><p>${(s.content||'').replace(/\n/g,'<br>')}</p>`;
  });

  (d.attachments||[]).forEach(a=>{
    if(a.type === 'image' && a.imageData){
      body += `<div style="margin:16px 0;"><img src="${a.imageData}" style="max-width:100%; border-radius:8px;">${a.caption ? `<div class="meta" style="margin-top:6px;">${a.caption}</div>` : ''}</div>`;
    } else if(a.type === 'fact'){
      body += `<h2>🔎 ${a.title || 'دليل / حقيقة علمية'}</h2><p>${(a.content||'').replace(/\n/g,'<br>')}</p>`;
    } else if(a.type === 'experiment'){
      body += `<h2>🧪 ${a.title || 'تجربة'}</h2><p>${(a.content||'').replace(/\n/g,'<br>')}</p>`;
    }
  });

  openPrintWindow(title, body);
  showToast('جهّزنا ملف البحث — احفظه كـ PDF من نافذة الطباعة، وابعته على الجروب 📲');
}

// ============ PROFILE ============
function renderProfile(){
  const greetEl = document.getElementById('profGreeting');
  const idEl = document.getElementById('profStudentId');
  if(greetEl) greetEl.textContent = STATE.userName ? `أهلًا بيك يا ${STATE.userName} 👋` : 'أهلًا بيك 👋 (اضغط تعديل الاسم)';
  if(idEl) idEl.textContent = STATE.studentId ? `معرفك: ${STATE.studentId}` : '';
  const gradeLbl = document.getElementById('profGradeLbl');
  if(gradeLbl) gradeLbl.textContent = GRADE_NAMES[STATE.currentGrade] || GRADE_NAMES['1sec'];
  renderBadges();
  renderCertTeaser();
  const done = doneLessonsScope(), tot = totalLessonsScope();
  const pct = tot? Math.round((done/tot)*100) : 0;
  document.getElementById('profPct').textContent = pct+'%';
  document.getElementById('profDone').textContent = done;
  document.getElementById('profQuiz').textContent = quizCorrectScope();

  // المستوى ونقاط الخبرة (XP) — مقصور على صف الطالب الحالي
  const xp = xpScope();
  const lvl = currentLevel(xp);
  const nxt = nextLevelInfo(xp);
  const lvlBadgeEl = document.getElementById('levelBadge');
  if(lvlBadgeEl){
    lvlBadgeEl.textContent = lvl.title.split(' ')[0];
    document.getElementById('levelTitle').textContent = lvl.title.split(' ').slice(1).join(' ');
    document.getElementById('levelXp').textContent = xp + ' XP';
    document.getElementById('xpBarFill').style.width = (nxt ? nxt.pct : 100) + '%';
    document.getElementById('xpNextLbl').textContent = nxt
      ? `${nxt.remaining} XP كمان عشان توصل لمستوى ${nxt.title}`
      : 'وصلت لأعلى مستوى — أسطورة! 👑';
    const loyaltyEl = document.getElementById('loyaltyNote');
    if(loyaltyEl) loyaltyEl.style.display = (STATE.currentGrade==='2bac' && hasLoyaltyBonus()) ? '' : 'none';
  }
  const circ = 2*Math.PI*56;
  document.getElementById('profRing').setAttribute('stroke-dasharray', circ);
  document.getElementById('profRing').setAttribute('stroke-dashoffset', circ - (pct/100)*circ);

  document.getElementById('profUnitList').innerHTML = (certScope().units.length ? certScope().units.map(u=>{
    const d = unitDoneCount(u), t = u.lessons.length;
    const unlocked = isUnitUnlocked(u);
    const testPassed = unitFinalTestPassed(u);
    const clickAttr = unlocked ? `onclick="openUnit(${u.id})"` : `onclick="lockedTap(${u.id})"`;
    return `<div class="unit-card ${unlocked?'':'locked'}" ${clickAttr}>
      <div class="num" style="background:${unlocked?u.color:'#3a4864'}">${unlocked?u.icon:'🔒'}</div>
      <div class="meta"><h4>${u.title}</h4><p>${d} / ${t} دروس ${testPassed?'· اختبار شامل ✓':''}</p></div>
      <div class="chev">${testPassed? '🏆': (unlocked?'‹':'🔒')}</div>
    </div>`;
  }).join('') : `<p style="color:var(--ink-dim); font-size:12.5px; text-align:center;">لسه مفيش وحدات مُضافة لـ${certScope().gradeLabel}.</p>`);
}

async function resetProgress(){
  const gl = certScope().gradeLabel;
  if(!confirm(`هل تريد بالتأكيد إعادة ضبط تقدّمك في ${gl} فقط؟ (تقدّم باقي الصفوف مش هيتأثر). لا يمكن التراجع عن هذا.`)) return;
  const ids = new Set(scopeUnitIds());
  const inScope = k => { const m = /^(?:u|l[qp]-)?(\d+)/.exec(k); return m && ids.has(Number(m[1])); };
  [STATE.completedLessons, STATE.answeredQuiz, STATE.answeredPractice, STATE.finalTestResults].forEach(o=>{
    Object.keys(o).forEach(k=>{ if(inScope(k)) delete o[k]; });
  });
  if(STATE.currentGrade==='1sec') STATE.examResults = {};
  STATE.quizCorrect = Math.max(0, (STATE.quizCorrect||0) - quizCorrectScope());
  if(!STATE.quizCorrectBy) STATE.quizCorrectBy = {'1sec':0,'2bac':0};
  STATE.quizCorrectBy[STATE.currentGrade] = 0;
  if(!STATE.xpBy) STATE.xpBy = {'1sec':0,'2bac':0};
  STATE.xpBy[STATE.currentGrade] = 0;
  if(STATE.currentGrade==='2bac') STATE.loyaltyBonusGiven = false;
  await saveState();
  renderProfile(); refreshHome();
  showToast('تم إعادة ضبط التقدّم');
}

// ============ تصدير / استيراد التقدّم (نسخة احتياطية محلية) ============
// هذا هو الضمان الحقيقي ضد فقدان التقدم عند مسح ذاكرة التخزين المؤقت للمتصفح بالخطأ،
// لأن حفظ المتصفح وحده (localStorage/window.storage) قد لا يبقى بعد مسح الكاش.
async function exportProgress(){
  try{
    if(!STATE.studentId){ showToast('لازم يكون عندك معرّف طالب الأول'); return; }
    const data = await ZBK.encryptState(STATE);
    const blob = new Blob([data], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0,10);
    a.href = url; a.download = `علوم-البرمجة-تقدمي-${stamp}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url), 2000);
    showToast('تم تصدير نسخة احتياطية مُشفّرة من تقدّمك 📤');
  }catch(e){ showToast((e && e.message) || 'تعذّر التصدير، حاول مرة أخرى'); }
}
function triggerImport(){ document.getElementById('importFileInput').click(); }
function importProgress(fileInput){
  const file = fileInput.files && fileInput.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = async (e)=>{
    try{
      const parsed = await ZBK.decryptFile(e.target.result);
      applyLoadedState(parsed);
      await saveState();
      refreshHome(); renderProfile();
      showToast('تم استيراد تقدّمك بنجاح ✅');
    }catch(err){
      showToast('⚠️ ' + ((err && err.zbkCode) ? err.message : 'ملف غير صالح، تأكد أنه ملف النسخة الاحتياطية الصحيح'));
    }
    fileInput.value = '';
  };
  reader.readAsText(file);
}

// ============ مشاركة التقدّم (باسم المستخدم) ============
async function shareProgress(){
  if(!STATE.userName){ openNameModal(); showToast('اكتب اسمك الأول عشان يظهر في المشاركة'); return; }
  const name = STATE.userName;

  // نبني نفس تقرير الجوائز والشهادة (اسم، مركز، نسب، كل الجوائز) كملف PDF قابل للمشاركة
  const data = buildAchievementsData();
  const badgeCount = data.unitBadges.length + data.examBadges.length;
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 330 + badgeCount * 25 + 90;
  drawAchievementsReportCanvas(canvas, data);

  const jsPDFCtor = window.jspdf && window.jspdf.jsPDF;
  let pdfBlob = null;
  if(jsPDFCtor){
    try{
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDFCtor({ orientation:'portrait', unit:'px', format:[canvas.width, canvas.height] });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdfBlob = pdf.output('blob');
    }catch(e){ pdfBlob = null; }
  }

  if(pdfBlob){
    const file = new File([pdfBlob], `تقدم-${name}-علوم-البرمجة.pdf`, { type:'application/pdf' });
    if(navigator.share && navigator.canShare && navigator.canShare({files:[file]})){
      try{
        await navigator.share({ files:[file], title:`تقدّم ${name} في علوم البرمجة`, text:'شوف تقدمي في علوم البرمجة 📚' });
        return;
      }catch(e){ /* المستخدم ألغى المشاركة، نكمل على تحميل الملف بدلًا */ }
    }
    try{
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url; a.download = `تقدم-${name}-علوم-البرمجة.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(()=>URL.revokeObjectURL(url), 2000);
      showToast('تم تحميل ملف تقدمك بصيغة PDF — شاركه من مكانه 📥');
    }catch(e){ showToast('تعذّرت المشاركة، حاول مرة أخرى'); }
    return;
  }

  // بديل أخير لو مكتبة jsPDF مش متاحة (بدون إنترنت مثلًا): نافذة طباعة يحفظها المستخدم يدويًا كـ PDF
  try{
    const imgData = canvas.toDataURL('image/png');
    const win = window.open('', '_blank');
    if(!win){ showToast('اسمح للمتصفح بفتح نافذة منبثقة عشان تقدر تشارك تقدمك'); return; }
    win.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>تقدمي</title>
      <style>*{margin:0;padding:0;} body{display:flex;justify-content:center;background:#fff;} img{width:100%;max-width:800px;}
      @media print{ @page{margin:0.5cm;} }</style></head>
      <body><img src="${imgData}" onload="setTimeout(()=>window.print(),300)"></body></html>`);
    win.document.close();
    showToast('افتح نافذة الطباعة واختر "حفظ كـ PDF" 🖨️');
  }catch(e){ showToast('تعذّرت المشاركة، حاول مرة أخرى'); }
}

// ============ الترم الثاني (مكان جاهز للمحتوى القادم، مقفول بتاريخ) ============
function switchTerm(term){
  STATE.currentTerm = term;
  document.querySelector('#grade1secContent .term-toggle').querySelectorAll('.term-btn').forEach(b=> b.classList.toggle('active', Number(b.dataset.term)===term));
  document.getElementById('term1Content').style.display = term===1 ? '' : 'none';
  document.getElementById('term2Content').style.display = term===2 ? '' : 'none';
  if(term===2) renderTerm2();
}
function renderBac2(){
  const grid = document.getElementById('bac2Grid');
  const soon = document.getElementById('bac2Soon');
  if(!grid || !soon) return;
  const unlocked = isTimeUnlocked(UNLOCK_DATE_BAC2) && BAC2_UNITS.length>0;
  if(unlocked){
    grid.innerHTML = buildUnitsGridHTML(BAC2_UNITS);
    grid.style.display = '';
    soon.style.display = 'none';
  }else{
    grid.style.display = 'none';
    soon.style.display = '';
  }
}
function renderTerm2(){
  const grid = document.getElementById('term2Grid');
  const placeholder = document.getElementById('term2Placeholder');
  const unlocked = isTimeUnlocked(UNLOCK_DATE_TERM2) && TERM2_UNITS.length>0;
  if(unlocked){
    grid.innerHTML = buildUnitsGridHTML(TERM2_UNITS);
    grid.style.display = '';
    placeholder.style.display = 'none';
  }else{
    grid.style.display = 'none';
    placeholder.style.display = '';
  }
}

// ============ الصف الثاني بكالوريا (مكان جاهز للمحتوى القادم، مقفول بتاريخ) ============
// ملحوظة: المكان ده مجمّد عمدًا لحد ما يتوصل محتوى الصف الثاني بكالوريا (وحدات، دروس، أسئلة) وبعد
// كمان ما يوصل التاريخ في UNLOCK_DATE_BAC2 أعلى الملف. أول ما يتضاف المحتوى في data.js (BAC2_UNITS)
// هيتم ربطه بنفس آلية الترم الثاني (renderTerm2/buildUnitsGridHTML) وقتها.


// ============ الشهادات والمراكز ============
function renderCertTeaser(){
  const icon = document.getElementById('certTeaserIcon');
  const title = document.getElementById('certTeaserTitle');
  const sub = document.getElementById('certTeaserSub');
  if(!icon) return;
  const result = computeCertRank();
  if(!result){
    icon.textContent = '🔒';
    title.textContent = 'لسه محققتش أي مركز';
    sub.textContent = 'حل أي اختبار أو امتحان عشان تفتح أول شهادة ليك';
    return;
  }
  icon.textContent = result.tier.icon;
  title.textContent = result.tier.title;
  sub.textContent = `نسبة الأداء العام: ${Math.round(result.overallScore*100)}% — اضغط لعرض الشهادة`;
}

let currentCertResult = null;
let currentCertTierId = null;

function openCertificateScreen(){
  navTo('screen-certificate', 'شهادتي ومركزي', 'بناءً على أداءك في كل الاختبارات والامتحانات');
  const result = computeCertRank();
  currentCertResult = result;
  const canvasWrap = document.querySelector('.cert-canvas-wrap');
  const lockedMsg = document.getElementById('certLockedMsg');
  const actions = document.getElementById('certActions');
  const switcher = document.getElementById('certTierSwitcher');

  if(!result){
    canvasWrap.style.display = 'none';
    lockedMsg.style.display = '';
    actions.style.display = 'none';
    if(switcher) switcher.style.display = 'none';
  } else {
    canvasWrap.style.display = '';
    lockedMsg.style.display = 'none';
    actions.style.display = '';
    currentCertTierId = result.tier.id; // نعرض أعلى مركز محقق افتراضيًا
    renderCertTierSwitcher(result);
    drawSelectedCertTier();
  }
  renderCertTiersList(result);
}

// ---------- شريط التبديل بين كل الشهادات/المراكز اللي الطالب حققها فعليًا ----------
function renderCertTierSwitcher(result){
  const switcher = document.getElementById('certTierSwitcher');
  if(!switcher) return;
  if(result.achievedTiers.length <= 1){
    switcher.style.display = 'none';
    return;
  }
  switcher.style.display = 'flex';
  switcher.innerHTML = result.achievedTiers.map(t=>`
    <button class="cert-pill ${t.id===currentCertTierId?'active':''}" onclick="selectCertTier('${t.id}')">
      ${t.icon} ${t.title.split('—')[0].trim()}
    </button>`).join('');
}

function selectCertTier(tierId){
  currentCertTierId = tierId;
  renderCertTierSwitcher(currentCertResult);
  drawSelectedCertTier();
}

function drawSelectedCertTier(){
  if(!currentCertResult) return;
  const tier = currentCertResult.achievedTiers.find(t=>t.id===currentCertTierId) || currentCertResult.tier;
  const canvas = document.getElementById('certCanvas');
  drawCertificate(canvas, { ...currentCertResult, tier });
}

function renderCertTiersList(currentResult){
  const wrap = document.getElementById('certTiersList');
  const achievedIds = currentResult ? currentResult.achievedTiers.map(t=>t.id) : [];
  wrap.innerHTML = CERT_TIERS.map(t=>{
    const reached = achievedIds.includes(t.id);
    let req = '';
    if(t.requireAllUnits && t.requireAllExams) req = `إتمام كل الوحدات وكل الامتحانات + ${Math.round(t.minScore*100)}% فأكثر`;
    else if(t.requireAllUnits) req = `إتمام كل الوحدات + ${Math.round(t.minScore*100)}% فأكثر`;
    else if(t.minAttempted) req = `حل ${t.minAttempted} اختبار على الأقل من أصل 18 + ${Math.round(t.minScore*100)}% فأكثر`;
    else req = `البدء في حل أي اختبار`;
    const clickAttr = reached ? `onclick="selectCertTier('${t.id}')" style="cursor:pointer;"` : '';
    return `<div class="cert-tier-item ${reached?'reached':''}" ${clickAttr}>
      <div class="cti-icon">${t.icon}</div>
      <div class="cti-meta"><b>${t.title}</b><span>${req}</span></div>
      ${reached? '<div style="color:var(--accent); font-size:18px;">✓</div>' : ''}
    </div>`;
  }).join('');
}

function downloadCertificate(canvasId, label){
  const canvas = document.getElementById(canvasId || 'certCanvas');
  try{
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url; a.download = `شهادة-${label || STATE.userName || 'طالب'}-علوم-البرمجة.png`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    showToast('تم تحميل الشهادة 📥');
  }catch(e){ showToast('تعذّر تحميل الشهادة، حاول مرة أخرى'); }
}

// ---------- تحميل الشهادة بصيغة PDF (جودة أعلى للطباعة والحفظ) ----------
function downloadCertificatePDF(canvasId, label){
  const canvas = document.getElementById(canvasId || 'certCanvas');
  const name = label || STATE.userName || 'طالب';
  const jsPDFCtor = window.jspdf && window.jspdf.jsPDF;
  if(!jsPDFCtor){
    // لو مكتبة jsPDF ما اتحمّلتش (مثلًا لعدم توفر إنترنت)، نستخدم الطباعة العادية كبديل تحفظ كـ PDF من نافذة الطباعة
    showToast('جاري تجهيز نافذة الطباعة (احفظها كـ PDF من هناك) 🖨️');
    printCertificate(canvasId);
    return;
  }
  try{
    const imgData = canvas.toDataURL('image/png');
    const orientation = canvas.width >= canvas.height ? 'landscape' : 'portrait';
    const pdf = new jsPDFCtor({ orientation, unit:'px', format:[canvas.width, canvas.height] });
    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
    pdf.save(`شهادة-${name}-علوم-البرمجة.pdf`);
    showToast('تم تحميل الشهادة بصيغة PDF 📄');
  }catch(e){
    showToast('تعذّر إنشاء PDF، جرّب زر الطباعة بدلًا منه');
  }
}

function shareCertificateImg(){
  const canvas = document.getElementById('certCanvas');
  canvas.toBlob(async (blob)=>{
    if(!blob){ showToast('تعذّرت المشاركة'); return; }
    const file = new File([blob], 'شهادتي.png', { type: 'image/png' });
    if(navigator.share && navigator.canShare && navigator.canShare({files:[file]})){
      try{ await navigator.share({ files:[file], title:'شهادتي في علوم البرمجة', text:`شوف مركزي في علوم البرمجة 🎓` }); }
      catch(e){ /* ألغى المستخدم */ }
    } else {
      downloadCertificate();
      showToast('متصفحك مش بيدعم مشاركة الصور مباشرة — تم تحميل الشهادة بدلًا من ذلك 📥');
    }
  }, 'image/png');
}

// ---------- طباعة الشهادة ----------
function printCertificate(canvasId){
  const canvas = document.getElementById(canvasId || 'certCanvas');
  let dataUrl;
  try{ dataUrl = canvas.toDataURL('image/png'); }
  catch(e){ showToast('تعذّرت الطباعة، حاول تاني'); return; }

  const win = window.open('', '_blank');
  if(!win){ showToast('اسمح للمتصفح بفتح نافذة منبثقة عشان تقدر تطبع'); return; }
  win.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">
    <title>طباعة الشهادة</title>
    <style>
      *{margin:0; padding:0; box-sizing:border-box;}
      body{display:flex; align-items:center; justify-content:center; min-height:100vh; background:#fff;}
      img{width:100%; max-width:950px; height:auto;}
      @media print{
        @page{ margin:0.5cm; }
        body{ min-height:auto; }
        img{ width:100%; }
      }
    </style>
    </head><body>
      <img src="${dataUrl}" alt="شهادتي" onload="setTimeout(()=>window.print(), 250)">
    </body></html>`);
  win.document.close();
}

// ============ تصدير الدروس والاختبارات والامتحانات كملفات PDF جاهزة للطباعة ============
// الطريقة: نفتح نافذة مُنسّقة للطباعة وندّي أمر طباعة تلقائي — المستخدم يختار "حفظ كـ PDF"
// من نافذة الطباعة نفسها (خيار موجود في كل المتصفحات الحديثة)، فمفيش حاجة تانية محتاجة.
function openPrintWindow(title, bodyHtml){
  const win = window.open('', '_blank');
  if(!win){ showToast('اسمح للمتصفح بفتح نافذة منبثقة عشان تقدر تطبع/تصدّر PDF'); return; }
  win.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">
    <title>${title}</title>
    <style>
      *{box-sizing:border-box;}
      body{font-family:'Tajawal',Arial,sans-serif; direction:rtl; padding:26px; color:#161616; line-height:1.85; max-width:800px; margin:0 auto;}
      h1{font-size:21px; border-bottom:3px solid #222; padding-bottom:10px; margin-bottom:6px;}
      h2{font-size:16px; margin-top:20px; margin-bottom:8px; color:#2a2a2a; border-right:4px solid #999; padding-right:8px;}
      p{margin:6px 0; font-size:13.5px;}
      ul{margin:6px 0; padding-right:22px;}
      li{margin:4px 0; font-size:13.5px;}
      .meta{color:#666; font-size:12px; margin-bottom:18px;}
      .q{margin:16px 0; page-break-inside:avoid; font-size:13.5px;}
      .q b{display:block; margin-bottom:6px;}
      .opts div{margin:4px 0 4px 0; padding-right:14px; font-size:13px;}
      .answer-key{margin-top:34px; border-top:2px dashed #999; padding-top:16px; font-size:12.5px; page-break-before:always;}
      .answer-key div{margin:3px 0;}
      .footer{margin-top:36px; text-align:center; color:#999; font-size:11px; border-top:1px solid #ddd; padding-top:10px;}
      @media print{ @page{ margin:1.4cm; } }
    </style>
    </head><body>
      ${bodyHtml}
      <div class="footer">علوم البرمجة — إعداد: أحمد رامي © 2026 جميع الحقوق محفوظة</div>
    </body></html>`);
  win.document.close();
  setTimeout(()=>{ try{ win.focus(); win.print(); }catch(e){} }, 350);
}

const AR_LETTERS = ['أ','ب','ج','د','هـ'];
function buildQuestionsPaperHtml(title, subtitle, questions, includeAnswerKey){
  let body = `<h1>${title}</h1><div class="meta">${subtitle} — عدد الأسئلة: ${questions.length}</div>`;
  questions.forEach((q,i)=>{
    body += `<div class="q"><b>${i+1}. ${q.q}</b>`;
    if(q.type === 'mcq'){
      body += `<div class="opts">${q.opts.map((o,oi)=>`<div>(${AR_LETTERS[oi]||oi+1}) ${o}</div>`).join('')}</div>`;
    } else if(q.type === 'tf'){
      body += `<div class="opts"><div>(   ) صح &nbsp;&nbsp;&nbsp;&nbsp; (   ) خطأ</div></div>`;
    } else if(q.type === 'fill'){
      body += `<div class="opts"><div>الإجابة: __________________________</div></div>`;
    }
    body += `</div>`;
  });
  if(includeAnswerKey){
    body += buildAnswerKeyHtml(questions);
  }
  return body;
}

function buildAnswerKeyHtml(questions){
  let body = `<div class="answer-key"><h2>📝 نموذج الإجابة</h2>`;
  questions.forEach((q,i)=>{
    let ans = '';
    if(q.type === 'mcq') ans = `(${AR_LETTERS[q.a]}) ${q.opts[q.a]}`;
    else if(q.type === 'tf') ans = q.a ? 'صح' : 'خطأ';
    else if(q.type === 'fill') ans = q.answer;
    body += `<div>${i+1}. ${ans}</div>`;
  });
  body += `</div>`;
  return body;
}

// نموذج الإجابة بيتاح بس بعد ما الطالب يسلّم حله الورقي (مش موجود في ورقة الأسئلة الأصلية)
function printAnswerKey(type, id){
  let title, questions;
  if(type === 'exam'){
    const ex = FINAL_EXAMS.find(x=>x.id===id);
    if(!ex) return;
    title = `نموذج إجابة — ${ex.title}`;
    questions = ex.questions;
  } else {
    const u = findUnit(id);
    if(!u || !u.finalTest) return;
    title = `نموذج إجابة — بنك أسئلة الوحدة ${u.id}`;
    questions = u.finalTest;
  }
  const html = `<h1>${title}</h1>` + buildAnswerKeyHtml(questions);
  openPrintWindow(title, html);
}

function printExamPaper(examId){
  const ex = FINAL_EXAMS.find(x=>x.id===examId);
  if(!ex) return;
  const html = buildQuestionsPaperHtml(ex.title, 'امتحان شامل يغطي كل الوحدات الـ13 — ورقة امتحان جاهزة للطباعة', ex.questions, false);
  openPrintWindow(ex.title, html);
}

function printUnitTestBank(uId){
  const u = findUnit(uId);
  if(!u || !u.finalTest || !u.finalTest.length) return;
  const html = buildQuestionsPaperHtml(`بنك أسئلة اختبار الوحدة ${u.id} — ${u.title}`, 'مجموعة كاملة من أسئلة مراجعة هذه الوحدة', u.finalTest, false);
  openPrintWindow(u.title, html);
}

function printLessonContent(uId, lIdx){
  const u = findUnit(uId);
  if(!u) return;
  const l = u.lessons[lIdx];
  let body = `<h1>${l.title}</h1><div class="meta">الوحدة ${u.id} — ${u.title} — درس ${lIdx+1} من ${u.lessons.length}</div>`;
  body += `<h2>🎯 هدف الدرس</h2><p>${l.goal}</p>`;
  body += `<h2>📌 النقاط الرئيسية</h2><ul>${l.points.map(p=>`<li>${p}</li>`).join('')}</ul>`;
  if(l.terms && l.terms.length){
    body += `<h2>🃏 المصطلحات</h2>`;
    l.terms.forEach(t=>{ body += `<p><b>${t.t}:</b> ${t.d}</p>`; });
  }
  body += `<h2>💡 مثال توضيحي</h2><p>${l.example}</p>`;
  if(l.remember) body += `<h2>🧠 تذكّر</h2><p>${l.remember}</p>`;
  openPrintWindow(l.title, body);
}

function printUnitBooklet(uId){
  const u = findUnit(uId);
  if(!u) return;
  let body = `<h1>الوحدة ${u.id} — ${u.title}</h1><div class="meta">${u.intro}</div>`;
  u.lessons.forEach((l,li)=>{
    body += `<div style="${li>0?'page-break-before:always;':''}">`;
    body += `<h2>${li+1}. ${l.title}</h2>`;
    body += `<p><b>🎯 الهدف:</b> ${l.goal}</p>`;
    body += `<ul>${l.points.map(p=>`<li>${p}</li>`).join('')}</ul>`;
    if(l.terms && l.terms.length){
      l.terms.forEach(t=>{ body += `<p><b>${t.t}:</b> ${t.d}</p>`; });
    }
    body += `<p><b>💡 مثال:</b> ${l.example}</p>`;
    if(l.remember) body += `<p><b>🧠 تذكّر:</b> ${l.remember}</p>`;
    body += `</div>`;
  });
  openPrintWindow(u.title, body);
}

// ---------- مكان لعرض ملف جوائز (JSON) استلمته من حد تاني ----------
function viewAchievementsFile(fileInput){
  const file = fileInput.files && fileInput.files[0];
  if(!file) return;
  if(file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')){
    showToast('⚠️ من فضلك اختر ملف PDF (نفس صيغة تصدير الجوائز والشهادة)');
    fileInput.value = '';
    return;
  }
  try{
    const url = URL.createObjectURL(file);
    renderViewedAchievementsPDF(url, file.name);
    showToast('تم عرض ملف الجوائز ✅');
  }catch(e){
    showToast('تعذّر فتح الملف، حاول مرة أخرى');
  }
  fileInput.value = '';
}

function renderViewedAchievementsPDF(fileUrl, fileName){
  const wrap = document.getElementById('viewedAchWrap');
  wrap.innerHTML = `
    <div class="card" style="margin-top:12px;">
      <p style="margin:0 0 10px; font-size:12.5px;"><b>📄 ${fileName || 'ملف الجوائز'}</b></p>
      <div class="pdf-preview-wrap">
        <iframe src="${fileUrl}" title="عرض ملف الجوائز"></iframe>
      </div>
      <div class="nav-btns" style="margin-top:10px;">
        <a class="btn btn-ghost" href="${fileUrl}" download="${fileName||'جوائز.pdf'}" style="text-decoration:none; text-align:center;">📥 تحميل الملف</a>
        <a class="btn btn-primary" href="${fileUrl}" target="_blank" style="text-decoration:none; text-align:center;">🔍 فتح في تبويب كامل</a>
      </div>
    </div>`;
}

// ============ لوحة تحكم الأدمن ============
// ملحوظة مهمة: التطبيق ده موقع ثابت بدون سيرفر، فلوحة الأدمن دي بتشتغل محليًا فقط —
// بتعرض بيانات الطلاب اللي اتحفظت على "نفس الجهاز/المتصفح" ده تحديدًا (زي جهاز معمل مدرسي
// بيستخدمه أكتر من طالب بالتبادل). مفتاح الحماية الحقيقي الوحيد ضد فقد البيانات بالكامل (زي
// مسح الكاش) يفضل النسخة الاحتياطية (تصدير/استيراد JSON) — ولوحة الأدمن بتقدر تستورد أي نسخة
// زي دي وتعرضها فورًا لو الطالب بعتهالك أو كانت عندك نسخة محفوظة منها.
const ADMIN_PASSCODE = 'AhmedRami2026'; // غيّرها من هنا لأي كلمة سر تانية تفضّلها
let adminUnlocked = false;

function openAdminGate(){
  navTo('screen-admin', 'لوحة تحكم الأدمن', 'إدارة بيانات الطلاب المحفوظة على هذا الجهاز');
  adminUnlocked = false;
  renderAdminScreen();
}

function renderAdminScreen(){
  const body = document.getElementById('adminBody');
  if(!adminUnlocked){
    body.innerHTML = `
      <div class="card" style="text-align:center;">
        <div style="font-size:32px;">🔐</div>
        <h4 style="margin:8px 0 4px;">دخول الأدمن فقط</h4>
        <p style="color:var(--ink-dim); font-size:12px; line-height:1.8; margin:0 0 12px;">
          الصفحة دي مخصصة للمعلّم/المسؤول بس، لإدارة بيانات الطلاب اللي حُفظت على هذا الجهاز أو لاستعادة تقدّم طالب فقده بالخطأ.
        </p>
        <input type="password" id="adminPass" placeholder="كلمة السر"
          style="width:100%; padding:11px 14px; border-radius:12px; border:1px solid var(--line); background:var(--panel-2); color:var(--ink); text-align:center; font-family:'Tajawal'; margin-bottom:10px;">
        <button class="btn btn-primary" style="width:100%;" onclick="checkAdminPass()">دخول</button>
      </div>`;
    const input = document.getElementById('adminPass');
    if(input) input.addEventListener('keydown', (e)=>{ if(e.key==='Enter') checkAdminPass(); });
    return;
  }

  const reg = getRegistry().slice().sort((a,b)=> new Date(b.lastActive) - new Date(a.lastActive));
  let html = `
    <div class="card">
      <p style="margin:0 0 10px; font-size:12px; color:var(--ink-dim); line-height:1.8;">
        الطلاب اللي حفظوا تقدمهم على هذا الجهاز تحديدًا. لو طالب فقد بياناته من غير نسخة احتياطية،
        استورد ملف الـJSON بتاعه هنا لو موجود عندك نسخة منه، وهتظهر فورًا في القائمة تحت.
      </p>
      <input type="file" id="adminImportFile" accept="application/json" style="display:none" onchange="adminImportStudent(this)">
      <button class="btn btn-ghost" style="width:100%;" onclick="document.getElementById('adminImportFile').click()">📥 استيراد ملف تقدم طالب</button>
    </div>
    <div id="adminStudentList"></div>`;
  body.innerHTML = html;

  const list = document.getElementById('adminStudentList');
  if(!reg.length){
    list.innerHTML = `<p style="text-align:center; color:var(--ink-dim); font-size:12.5px; margin-top:24px;">مفيش أي طالب محفوظ على الجهاز ده لسه.</p>`;
    return;
  }

  list.innerHTML = reg.map(r=>{
    let pct = 0, examsAndUnitsInfo = '';
    try{
      const raw = localStorage.getItem(PROFILE_PREFIX + r.id);
      if(raw){
        const st = JSON.parse(raw);
        const done = Object.keys(st.completedLessons||{}).length;
        pct = totalLessons() ? Math.round((done/totalLessons())*100) : 0;
      }
    }catch(e){}
    const dateStr = r.lastActive ? new Date(r.lastActive).toLocaleDateString('ar-EG') : '—';
    return `<div class="admin-student-card">
      <div class="asc-meta">
        <b>${r.name || 'طالب'}</b>
        <span>معرف: ${r.id} · آخر نشاط: ${dateStr}</span>
        <div class="asc-bar"><i style="width:${pct}%"></i></div>
        <span>${pct}% من الدروس مكتمل</span>
      </div>
      <div class="asc-actions">
        <button onclick="adminViewStudent('${r.id}')">عرض</button>
        <button onclick="adminExportStudent('${r.id}')">تصدير</button>
        <button class="danger" onclick="adminDeleteStudent('${r.id}')">حذف</button>
      </div>
    </div>`;
  }).join('');
}

function checkAdminPass(){
  const input = document.getElementById('adminPass');
  const val = input ? input.value : '';
  if(val === ADMIN_PASSCODE){
    adminUnlocked = true;
    renderAdminScreen();
  } else {
    showToast('كلمة السر غلط ❌');
  }
}

function adminViewStudent(id){
  let raw;
  try{ raw = localStorage.getItem(PROFILE_PREFIX + id); }catch(e){}
  if(!raw){ showToast('لا توجد بيانات محفوظة لهذا الطالب على هذا الجهاز'); return; }
  try{
    const parsed = JSON.parse(raw);
    applyLoadedState(parsed);
    try{ localStorage.setItem(ACTIVE_ID_KEY, id); }catch(e){}
    refreshHome();
    showTab('profile');
    showToast(`دلوقتي بتعرض بيانات: ${STATE.userName || id}`);
  }catch(e){ showToast('تعذّرت قراءة بيانات هذا الطالب'); }
}

async function adminExportStudent(id){
  let raw;
  try{ raw = localStorage.getItem(PROFILE_PREFIX + id); }catch(e){}
  if(!raw){ showToast('لا توجد بيانات لهذا الطالب'); return; }
  try{
    const data = await ZBK.encryptState(JSON.parse(raw));
    const blob = new Blob([data], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `تقدم-الطالب-${id}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url), 2000);
    showToast('تم تصدير بيانات الطالب 📤');
  }catch(e){ showToast((e && e.message) || 'تعذّر التصدير'); }
}

function adminDeleteStudent(id){
  if(!confirm('متأكد إنك عايز تمسح بيانات الطالب ده من هذا الجهاز؟ الإجراء ده لا يمكن التراجع عنه (يفضل تصدّرها الأول لو مش متأكد).')) return;
  try{
    localStorage.removeItem(PROFILE_PREFIX + id);
    const reg = getRegistry().filter(r=>r.id!==id);
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(reg));
  }catch(e){}
  renderAdminScreen();
  showToast('تم حذف بيانات الطالب من هذا الجهاز');
}

function adminImportStudent(fileInput){
  const file = fileInput.files && fileInput.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = async (e)=>{
    try{
      const parsed = await ZBK.decryptFile(e.target.result);
      localStorage.setItem(PROFILE_PREFIX + parsed.studentId, JSON.stringify(parsed));
      updateRegistry(parsed.studentId, parsed.userName);
      renderAdminScreen();
      showToast(`تم استيراد بيانات الطالب (${parsed.userName || parsed.studentId}) بنجاح ✅`);
    }catch(err){
      showToast('⚠️ ' + ((err && err.zbkCode) ? err.message : 'ملف غير صالح، تأكد أنه ملف نسخة احتياطية صحيح'));
    }
    fileInput.value = '';
  };
  reader.readAsText(file);
}

// ============ تثبيت التطبيق (PWA) ============
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault();
  deferredInstallPrompt = e;
  const btn = document.getElementById('installBtn');
  if(btn) btn.style.display = '';
});
function triggerInstall(){
  if(deferredInstallPrompt){
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(()=>{ deferredInstallPrompt = null; });
  } else {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if(isIOS){
      showToast('لتثبيت التطبيق: اضغط زر المشاركة ⬆️ في Safari، ثم "إضافة إلى الشاشة الرئيسية"');
    } else {
      showToast('لتثبيت التطبيق: افتح قائمة المتصفح واختر "تثبيت التطبيق" أو "Install App"');
    }
  }
}

// ---------- تحديث التطبيق المثبّت يدويًا (لو الاسم/اللوجو/المحتوى اتغيّر ومحتاج يظهر فورًا) ----------
async function forceAppUpdate(){
  showToast('⏳ جاري تحديث التطبيق...');
  try{
    if('caches' in window){
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  }catch(e){ /* تجاهل بصمت لو الكاش مش متاح */ }
  try{
    if('serviceWorker' in navigator){
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
  }catch(e){ /* تجاهل بصمت */ }
  showToast('✅ تم التحديث، جاري إعادة تحميل التطبيق...');
  setTimeout(()=>{ location.reload(); }, 600);
}

// ============ تنبيه تحديث المنصة (صوتي + مرئي) ============
// بيقارن رقم الإصدار الحالي (APP_VERSION فوق) بآخر إصدار شافه الطالب على هذا الجهاز.
// لو مختلف، بيشغّل صوت تنبيه قصير ويطلب من الطالب ياخد نسخة احتياطية قبل ما يكمل.
const APP_VERSION_KEY = 'zakera_app_version';

function playUpdateChime(){
  try{
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if(!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.16);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.55);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.6);
  }catch(e){ /* المتصفح مايدعمش Web Audio، تجاهل بصمت */ }
}

function checkForPlatformUpdate(){
  try{
    const seen = localStorage.getItem(APP_VERSION_KEY);
    if(seen && seen !== APP_VERSION){
      playUpdateChime();
      const modal = document.getElementById('updateModal');
      if(modal) modal.style.display = 'flex';
    }
    localStorage.setItem(APP_VERSION_KEY, APP_VERSION);
  }catch(e){ /* لا يوجد localStorage متاح، تجاهل بصمت */ }
}
function closeUpdateModal(){
  const modal = document.getElementById('updateModal');
  if(modal) modal.style.display = 'none';
}
function backupThenCloseUpdateModal(){
  exportProgress();
  closeUpdateModal();
}

document.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('glossSearch').addEventListener('input', (e)=> renderGlossary(e.target.value));
  loadState();
  checkForPlatformUpdate();
  setTimeout(checkWhatsappReminder, 700); // تأخير بسيط عشان ميتزاحمش مع مودال الاسم لأول مرة
});
