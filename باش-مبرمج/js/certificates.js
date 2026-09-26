// ==================================================================================
//  علوم البرمجة — نظام المراكز والشهادات
//  المركز يُحسب من أداء الطالب في كل الاختبارات: اختبارات الوحدات الـ13 الشاملة
//  + الامتحانات الشاملة الخمسة (إجمالي 18 تقييمًا).
//  © Ahmed Rami
// ==================================================================================

const CERT_TIERS = [
  {
    id: 'gold',
    title: 'المركز الأول — شرف التفوّق',
    icon: '🥇',
    ribbon: '#FFD700',
    minScore: 0.95,
    requireAllUnits: true,
    requireAllExams: true,
    message: (name, s)=> `تُشهد منصة "علوم البرمجة" بأن الطالب/ة ${name} حقق/حققت المركز الأول بامتياز مذهل في ${(s&&s.gradeLabel)||'المنهج'}، ` +
      `باجتياز كل الوحدات${s&&s.unitsCount?` (${s.unitsCount})`:''}${s&&s.examsCount?` وكل الامتحانات الشاملة (${s.examsCount})`:''} بتفوّق واضح. إنجاز استثنائي يستحق كل التقدير — استمر/ي على هذا المستوى الرائع! 🏆`
  },
  {
    id: 'silver',
    title: 'المركز الثاني — تفوّق',
    icon: '🥈',
    ribbon: '#C9CED6',
    minScore: 0.90,
    requireAllUnits: true,
    requireAllExams: false,
    message: (name, s)=> `تُشهد منصة "علوم البرمجة" بأن الطالب/ة ${name} حقق/حققت المركز الثاني بتفوّق ملحوظ في ${(s&&s.gradeLabel)||'المنهج'}، ` +
      `بعد إتمام كل وحدات المنهج بنجاح وتحقيق نتائج قوية في الامتحانات الشاملة. مجهود رائع، وخطوة كمان تعمل الشرف الأعلى! 🌟`
  },
  {
    id: 'bronze',
    title: 'المركز الثالث — امتياز',
    icon: '🥉',
    ribbon: '#CD7F32',
    minScore: 0.80,
    requireAllUnits: true,
    requireAllExams: false,
    message: (name, s)=> `تُشهد منصة "علوم البرمجة" بأن الطالب/ة ${name} حقق/حققت المركز الثالث بتقدير امتياز في ${(s&&s.gradeLabel)||'المنهج'}، ` +
      `بعد إنهاء كل وحدات المنهج بنتيجة قوية وثابتة. استمر/ي في المراجعة عشان توصل/ي لأعلى مركز ممكن! 💪`
  },
  {
    id: 'honor',
    title: 'شهادة تفوّق',
    icon: '🎖️',
    ribbon: '#8A5AD6',
    minScore: 0.70,
    minAttempted: 14,
    message: (name, s)=> `تُشهد منصة "علوم البرمجة" بأن الطالب/ة ${name} حصل/حصلت على شهادة تفوّق في ${(s&&s.gradeLabel)||'المنهج'} ` +
      `لأداء قوي عبر معظم اختبارات المنهج. خطوات كويسة جدًا — كمّل بقية الوحدات والامتحانات عشان توصل لمركز أعلى! 👏`
  },
  {
    id: 'achievement',
    title: 'شهادة إنجاز',
    icon: '📜',
    ribbon: '#3AA0FF',
    minScore: 0.5,
    minAttempted: 9,
    message: (name, s)=> `تُشهد منصة "علوم البرمجة" بأن الطالب/ة ${name} حصل/حصلت على شهادة إنجاز في ${(s&&s.gradeLabel)||'المنهج'} ` +
      `لتقدّم ملموس في مذاكرة ومراجعة المنهج. استمر/ي، كل درس ونتيجة بتقربك من الشهادات الأعلى! 🚀`
  },
  {
    id: 'participation',
    title: 'شهادة مشاركة',
    icon: '✏️',
    ribbon: '#4FBF8B',
    minScore: 0,
    minAttempted: 1,
    message: (name, s)=> `تُشهد منصة "علوم البرمجة" بأن الطالب/ة ${name} بدأ/بدأت رحلة المراجعة على المنصة في ${(s&&s.gradeLabel)||'المنهج'}. ` +
      `أول خطوة دايمًا الأهم — كمّل باقي الوحدات والامتحانات عشان تفتح شهادات ومراكز أعلى! 🌱`
  }
];

// ---------- حساب المركز الحالي بناءً على كل نتائج الاختبارات المسجّلة ----------
// النطاق (أي مجموعة الوحدات/الامتحانات المُعتمَدة في الحساب) يتغيّر تلقائيًا حسب صف الطالب
// الحالي (STATE.currentGrade) عبر certScope() — راجع تعريفها في data.js.
function computeCertRank(){
  const scope = certScope();
  const scopeUnits = scope.units, scopeExams = scope.exams;
  if(!scopeUnits.length) return null; // لسه مفيش محتوى مُضاف لصف الطالب الحالي، فمفيش شهادة تُحسب

  const unitScores = scopeUnits.map(u => (STATE.finalTestResults[u.id] && STATE.finalTestResults[u.id].bestScore) || 0);
  const examScores  = scopeExams.map(ex => (STATE.examResults[ex.id] && STATE.examResults[ex.id].bestScore) || 0);
  const allScores = unitScores.concat(examScores);
  const attemptedCount = allScores.filter(s => s > 0).length +
    scopeUnits.filter(u => STATE.finalTestResults[u.id] && STATE.finalTestResults[u.id].bestScore === 0 && STATE.finalTestResults[u.id].attempts > 0).length; // يحسب حتى محاولة بنتيجة صفر كمحاولة
  const overallScore = allScores.length ? (allScores.reduce((a,b)=>a+b,0) / allScores.length) : 0;
  const unitAvgScore = unitScores.length ? (unitScores.reduce((a,b)=>a+b,0) / unitScores.length) : 0;
  const examAvgScore = examScores.length ? (examScores.reduce((a,b)=>a+b,0) / examScores.length) : 0;

  const allUnitsPassed = scopeUnits.every(u => unitFinalTestPassed(u));
  const allExamsPassed = scopeExams.length ? scopeExams.every(ex => examPassed(ex.id)) : true; // لو صف الطالب لسه من غير امتحانات شاملة، الشرط ده مش عائق

  const meetsTier = (tier)=>{
    if(overallScore < tier.minScore) return false;
    if(tier.requireAllUnits && !allUnitsPassed) return false;
    if(tier.requireAllExams && !allExamsPassed) return false;
    if(tier.minAttempted && attemptedCount < tier.minAttempted) return false;
    return true;
  };

  const achievedTiers = CERT_TIERS.filter(meetsTier);
  if(!achievedTiers.length) return null; // لسه محدش حل أي اختبار يفتح أي مركز

  const bestTier = achievedTiers[0]; // CERT_TIERS مرتبة من الأعلى للأقل بالفعل
  return {
    tier: bestTier,
    overallScore, unitAvgScore, examAvgScore,
    attemptedCount, totalAssessments: allScores.length,
    allUnitsPassed, allExamsPassed,
    gradeLabel: scope.gradeLabel, // اسم صف الطالب — يُستخدم في نص الشهادة والتقرير
    achievedTiers // كل المراكز اللي الطالب حققها فعليًا (للتبديل بينها في الواجهة)
  };
}

// ---------- رسم الشهادة على Canvas ----------
function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight){
  const words = text.split(' ');
  let line = '';
  const lines = [];
  for(const w of words){
    const test = line ? line + ' ' + w : w;
    if(ctx.measureText(test).width > maxWidth && line){
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if(line) lines.push(line);
  lines.forEach((l,i)=> ctx.fillText(l, x, y + i*lineHeight));
  return lines.length * lineHeight;
}

function drawCertificate(canvas, data, overrideName){
  const { tier, overallScore, unitAvgScore, examAvgScore, gradeLabel, totalAssessments } = data;
  const name = overrideName || STATE.userName || 'طالب';
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,W,H);

  // خلفية متدرجة داكنة
  const bg = ctx.createLinearGradient(0,0,0,H);
  bg.addColorStop(0,'#232323'); bg.addColorStop(1,'#121212');
  ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);

  // إطار ذهبي مزدوج
  ctx.strokeStyle = tier.ribbon; ctx.lineWidth = W*0.008;
  ctx.strokeRect(W*0.035, H*0.03, W*0.93, H*0.94);
  ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = W*0.002;
  ctx.strokeRect(W*0.05, H*0.042, W*0.9, H*0.916);

  ctx.textAlign = 'center';

  // شعار المنصة + الصف الدراسي
  ctx.fillStyle = '#999';
  ctx.font = `${Math.round(W*0.022)}px Tajawal, sans-serif`;
  ctx.fillText(`علوم البرمجة — ${gradeLabel || 'الصف الأول الثانوي'}`, W/2, H*0.10);

  // الأيقونة الكبيرة
  ctx.font = `${Math.round(W*0.095)}px sans-serif`;
  ctx.fillText(tier.icon, W/2, H*0.225);

  // عنوان المركز
  ctx.fillStyle = tier.ribbon;
  ctx.font = `bold ${Math.round(W*0.042)}px Tajawal, sans-serif`;
  ctx.fillText(tier.title, W/2, H*0.295);

  // شهادة تقدير
  ctx.fillStyle = '#fff';
  ctx.font = `${Math.round(W*0.023)}px Tajawal, sans-serif`;
  ctx.fillText('هذه الشهادة ممنوحة إلى', W/2, H*0.35);

  // اسم الطالب
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.round(W*0.046)}px Tajawal, sans-serif`;
  ctx.fillText(name, W/2, H*0.415);

  // خط تحت الاسم
  ctx.strokeStyle = tier.ribbon; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W*0.30, H*0.435); ctx.lineTo(W*0.70, H*0.435); ctx.stroke();

  // نص التهنئة (متعدد الأسطر)
  ctx.fillStyle = '#ddd';
  ctx.font = `${Math.round(W*0.019)}px Tajawal, sans-serif`;
  const msgScope = certScope();
  wrapCanvasText(ctx, tier.message(name, { gradeLabel, unitsCount: msgScope.units.length, examsCount: msgScope.exams.length }), W/2, H*0.485, W*0.8, W*0.028);

  // ---------- تفصيل النسب: كل فئة + الإجمالي العام ----------
  ctx.fillStyle = '#bbb';
  ctx.font = `${Math.round(W*0.019)}px Tajawal, sans-serif`;
  ctx.fillText(
    `متوسط اختبارات الوحدات: ${Math.round((unitAvgScore||0)*100)}%   ·   متوسط الامتحانات الشاملة: ${Math.round((examAvgScore||0)*100)}%`,
    W/2, H*0.635
  );
  ctx.fillStyle = tier.ribbon;
  ctx.font = `bold ${Math.round(W*0.028)}px Tajawal, sans-serif`;
  ctx.fillText(`نسبة الأداء العام: ${Math.round(overallScore*100)}%`, W/2, H*0.675);

  // ---------- عدد الجوائز وآخر جائزة تحققت ----------
  const totalBadges = typeof totalBadgesEarned === 'function' ? totalBadgesEarned() : 0;
  const latestBadge = typeof latestBadgeEarned === 'function' ? latestBadgeEarned() : null;
  ctx.fillStyle = '#ddd';
  ctx.font = `${Math.round(W*0.02)}px Tajawal, sans-serif`;
  ctx.fillText(`🏅 إجمالي الجوائز المكتسبة: ${totalBadges} من ${totalAssessments || 18}`, W/2, H*0.725);
  if(latestBadge){
    ctx.fillStyle = '#999';
    ctx.font = `${Math.round(W*0.017)}px Tajawal, sans-serif`;
    ctx.fillText(`${latestBadge.icon} آخر جائزة: ${latestBadge.name}`, W/2, H*0.755);
  }

  // التاريخ والتوقيع
  const dateStr = new Date().toLocaleDateString('ar-EG', { year:'numeric', month:'long', day:'numeric' });
  ctx.fillStyle = '#888';
  ctx.font = `${Math.round(W*0.016)}px Tajawal, sans-serif`;
  ctx.fillText(dateStr, W/2, H*0.885);

  ctx.fillStyle = '#666';
  ctx.font = `${Math.round(W*0.014)}px Tajawal, sans-serif`;
  ctx.fillText('إعداد: أحمد رامي — © 2026 جميع الحقوق محفوظة', W/2, H*0.935);
}
