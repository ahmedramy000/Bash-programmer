// علوم البرمجة — مزامنة التقدّم بين جهازي نفس الطالب (موبايل + كمبيوتر مثلًا)
// بدون سيرفر وبدون إنترنت: اتصال مباشر (WebRTC) بين الجهازين وهما على نفس الشبكة، بنفس أسلوب
// الربط في غرفة المذاكرة (QR / كود يدوي). الشرط الأساسي: لازم يكون نفس معرّف الطالب (ID) على
// الجهازين — لو مختلفين الاتصال بيتقفل فورًا، عشان محدش يزامن (يدمج) تقدمه مع تقدّم حد تاني.
// المزامنة بتاخد "الأفضل من الاثنين" في كل بند (دروس، XP، نتائج) مش استبدال — فمفيش فقدان بيانات.
(function(){
'use strict';
const $ = id => document.getElementById(id);
const toast = m => { try{ showToast(m); }catch(_){ } };
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// ============ ترميز كود الربط (نفس أسلوب غرفة المذاكرة، بعلامة مختلفة ZS1 عشان الأكواد متتلخبطش) ============
const hex2b64 = h => btoa(h.split(':').map(x=>String.fromCharCode(parseInt(x,16))).join('')).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const b642hex = b => { b=b.replace(/-/g,'+').replace(/_/g,'/'); while(b.length%4) b+='='; return atob(b).split('').map(c=>c.charCodeAt(0).toString(16).toUpperCase().padStart(2,'0')).join(':'); };
function pack(sdp, kind){
  const g = r => (sdp.match(r)||[])[1];
  const u = g(/a=ice-ufrag:(\S+)/), p = g(/a=ice-pwd:(\S+)/), f = g(/a=fingerprint:sha-256 (\S+)/);
  if(!u || !p || !f) throw new Error('bad sdp');
  let c = [...sdp.matchAll(/a=candidate:\S+ \d+ udp \d+ (\S+) (\d+) typ host/g)].map(m=>m[1]+'/'+m[2]);
  c = [...new Set(c)];
  c = c.filter(x=>!x.includes(':')).concat(c.filter(x=>x.includes(':'))).slice(0,4);
  if(!c.length) throw new Error('no candidates');
  return ['ZS1', kind, u, p, hex2b64(f), c.join(',')].join('~');
}
function unpack(code){
  const a = String(code).trim().split('~');
  if(a.length !== 6 || a[0] !== 'ZS1' || (a[1] !== 'o' && a[1] !== 'a')) throw new Error('bad code');
  return {k:a[1], u:a[2], p:a[3], f:b642hex(a[4]), c:a[5].split(',')};
}
function buildSDP(x){
  const L = ['v=0','o=- 4611731400430051336 2 IN IP4 127.0.0.1','s=-','t=0 0','a=group:BUNDLE 0','a=msid-semantic: WMS',
    'm=application 9 UDP/DTLS/SCTP webrtc-datachannel','c=IN IP4 0.0.0.0',
    'a=ice-ufrag:'+x.u,'a=ice-pwd:'+x.p,'a=fingerprint:sha-256 '+x.f,
    'a=setup:'+(x.k==='o' ? 'actpass' : 'active'),'a=mid:0','a=sctp-port:5000','a=max-message-size:262144'];
  x.c.forEach((hp,i)=>{ const j = hp.lastIndexOf('/'); L.push('a=candidate:'+(i+1)+' 1 udp '+(2122260223-i)+' '+hp.slice(0,j)+' '+hp.slice(j+1)+' typ host'); });
  L.push('a=end-of-candidates');
  return L.join('\r\n') + '\r\n';
}
function extractCode(text){
  text = String(text||'').trim();
  const z = /ZS1~[^\s]+/.exec(text);
  return z ? z[0] : text;
}
const newPC = () => new RTCPeerConnection({iceServers: []});
function waitICE(pc){
  return new Promise(res=>{
    if(pc.iceGatheringState === 'complete') return res();
    const t = setTimeout(done, 3000);
    function done(){ clearTimeout(t); pc.removeEventListener('icegatheringstatechange', ch); res(); }
    function ch(){ if(pc.iceGatheringState === 'complete') done(); }
    pc.addEventListener('icegatheringstatechange', ch);
  });
}
const uid = () => Math.random().toString(36).slice(2,8);
const CHUNK = 4000;
function send(dc, obj){
  if(!dc || dc.readyState !== 'open') return false;
  try{
    const s = JSON.stringify(obj);
    if(s.length <= CHUNK){ dc.send('0'+s); return true; }
    const id = uid(), n = Math.ceil(s.length/CHUNK);
    for(let i=0;i<n;i++) dc.send('1'+id+'|'+i+'|'+n+'|'+s.slice(i*CHUNK,(i+1)*CHUNK));
    return true;
  }catch(_){ return false; }
}
function listen(dc, onmsg){
  const bufs = {};
  dc.onmessage = e=>{
    const d = e.data; if(typeof d !== 'string') return;
    try{
      if(d[0] === '0'){ onmsg(JSON.parse(d.slice(1))); return; }
      if(d[0] !== '1') return;
      const i1 = d.indexOf('|'), i2 = d.indexOf('|',i1+1), i3 = d.indexOf('|',i2+1);
      const id = d.slice(1,i1), idx = +d.slice(i1+1,i2), n = +d.slice(i2+1,i3);
      if(!(n>0 && n<=400 && idx>=0 && idx<n)) return;
      const b = bufs[id] || (bufs[id] = {parts:[], c:0});
      if(b.parts[idx] === undefined){ b.parts[idx] = d.slice(i3+1); b.c++; }
      if(b.c === n){ delete bufs[id]; onmsg(JSON.parse(b.parts.join(''))); }
    }catch(_){}
  };
}

// ============ دمج التقدّم: "الأفضل من الجهازين" لكل بند — مفيش استبدال ولا فقدان ============
function mergeStates(a, b){
  const obj = x => (x && typeof x === 'object' && !Array.isArray(x)) ? x : {};
  const num = x => (typeof x === 'number' && isFinite(x)) ? x : 0;
  const pickStr = (x,y) => { x=String(x||''); y=String(y||''); if(!x) return y; if(!y) return x; return x<=y ? x : y; };
  const gradeRank = { '1sec':1, '2bac':2 };
  const bools = obj(a.completedLessons), boolsB = obj(b.completedLessons);
  const mergeBoolMap = (m1,m2) => Object.assign({}, obj(m1), obj(m2));
  const mergeMax = (m1,m2,field) => {
    const out = {}; const ks = new Set([...Object.keys(obj(m1)), ...Object.keys(obj(m2))]);
    ks.forEach(k=>{ out[k] = Math.max(num(obj(m1)[k]), num(obj(m2)[k])); });
    return out;
  };
  const mergeResultMap = (m1,m2) => {
    const out = {}; const ks = new Set([...Object.keys(obj(m1)), ...Object.keys(obj(m2))]);
    ks.forEach(k=>{
      const r1 = obj(m1)[k]||{}, r2 = obj(m2)[k]||{};
      out[k] = {
        passed: !!(r1.passed || r2.passed),
        bestScore: Math.max(num(r1.bestScore), num(r2.bestScore)),
        total: Math.max(num(r1.total), num(r2.total)),
        attempts: Math.max(num(r1.attempts), num(r2.attempts))
      };
    });
    return out;
  };
  const badgeKey = x => (x.type||'')+'|'+(x.id!=null?x.id:'');
  const badges = {};
  [].concat(Array.isArray(a.badgeLog)?a.badgeLog:[], Array.isArray(b.badgeLog)?b.badgeLog:[]).forEach(x=>{
    if(!x) return; const k = badgeKey(x);
    if(!badges[k] || new Date(x.earnedAt||0) < new Date(badges[k].earnedAt||0)) badges[k] = x;
  });
  const badgeLog = Object.values(badges).sort((x,y)=> new Date(x.earnedAt||0) - new Date(y.earnedAt||0));
  return {
    studentId: a.studentId,
    userName: pickStr(a.userName, b.userName),
    theme: pickStr(a.theme, b.theme) || 'default',
    currentGrade: (gradeRank[b.currentGrade]||0) > (gradeRank[a.currentGrade]||0) ? b.currentGrade : (a.currentGrade || b.currentGrade),
    gradeChosen: !!(a.gradeChosen || b.gradeChosen),
    completedLessons: mergeBoolMap(bools, boolsB),
    answeredQuiz: mergeBoolMap(a.answeredQuiz, b.answeredQuiz),
    answeredPractice: mergeBoolMap(a.answeredPractice, b.answeredPractice),
    finalTestResults: mergeResultMap(a.finalTestResults, b.finalTestResults),
    examResults: mergeResultMap(a.examResults, b.examResults),
    badgeLog,
    quizCorrect: Math.max(num(a.quizCorrect), num(b.quizCorrect)),
    quizCorrectBy: mergeMax(a.quizCorrectBy, b.quizCorrectBy),
    xpBy: mergeMax(a.xpBy, b.xpBy),
    startGrade: a.startGrade && b.startGrade ? (a.startGrade==='1sec'?a.startGrade:b.startGrade) : (a.startGrade || b.startGrade || null),
    loyaltyBonusGiven: !!(a.loyaltyBonusGiven || b.loyaltyBonusGiven)
  };
}
function diffSummary(before, after){
  const lessons = Object.keys(after.completedLessons||{}).length - Object.keys(before.completedLessons||{}).length;
  const xp1 = (after.xpBy['1sec']||0) - (before.xpBy['1sec']||0);
  const xp2 = (after.xpBy['2bac']||0) - (before.xpBy['2bac']||0);
  const parts = [];
  if(lessons > 0) parts.push(`+${lessons} درس`);
  if(xp1 > 0) parts.push(`+${xp1} XP (أول ثانوي)`);
  if(xp2 > 0) parts.push(`+${xp2} XP (بكالوريا)`);
  return parts.length ? parts.join(' · ') : 'الجهازين كانوا متزامنين فعلاً';
}

// ============ الحالة والواجهة ============
const S = { role:null, pc:null, dc:null, view:'home', vd:null, done:false };
function resetConn(){
  try{ if(S.pc) S.pc.close(); }catch(_){}
  S.role = null; S.pc = null; S.dc = null; S.done = false;
}
function go(view, vd){ S.view = view; if(vd!==undefined) S.vd = vd; render(); }
function render(){
  const root = $('syncRoot'); if(!root) return;
  root.innerHTML = (VIEWS[S.view]||VIEWS.home)();
}
function copy(id){
  const el = $(id); if(!el) return;
  el.select();
  try{ navigator.clipboard.writeText(el.value).then(()=>toast('اتنسخ ✓')).catch(()=>{ document.execCommand('copy'); toast('اتنسخ ✓'); }); }
  catch(_){ try{ document.execCommand('copy'); toast('اتنسخ ✓'); }catch(__){ toast('حدد الكود وانسخه يدويًا'); } }
}
function drawQR(canvasId, code){
  const cv = $(canvasId); if(!cv || !window.ZQR) return;
  try{ ZQR.draw(cv, code, 720, 'M'); }catch(_){ cv.style.display='none'; }
}

const VIEWS = {
  home(){
    const rtc = !!window.RTCPeerConnection;
    return `<div class="card">
      <span class="card-tag" style="background:rgba(124,156,255,.14); color:#A9BEFF;">🔄 مزامنة بين جهازيك</span>
      <p style="margin:8px 0 12px; line-height:1.9;">عندك موبايل ولابتوب وعايز تقدّمك يبقى واحد في الاتنين؟ وصّل الجهازين على نفس الواي فاي وزامنهم من هنا. بيتاخد <b>الأفضل من الاثنين</b> في كل حاجة (دروس وXP ونتائج) — مفيش حاجة بتتمسح.</p>
      <p style="margin:0 0 12px; font-size:12px; color:var(--ink-dim);">لازم يكون نفس معرّف الطالب (<b>${esc(STATE.studentId||'—')}</b>) على الجهازين، وإلا هيترفض الاتصال.</p>
      ${rtc ? `<div class="nav-btns">
        <button class="btn btn-primary" onclick="ZSYNC.hostStart()">📡 اعرض كود من هنا</button>
        <button class="btn btn-ghost" onclick="ZSYNC.go('join')">📷 اتصل بجهاز معروض عنده كود</button>
      </div>` : '<p style="color:var(--accent-3);">المتصفح ده مش بيدعم الاتصال المباشر — جرّب Chrome أو Safari حديث.</p>'}
    </div>`;
  },
  wait(){
    return `<div class="card">
      <b>كود المزامنة</b>
      <p style="margin:8px 0; color:var(--ink-dim); font-size:12.5px; line-height:1.8;">وري الـQR للجهاز التاني يمسحه (أو ابعتله الكود)، وبعدين الصق كود الرد اللي هيطلعله هنا تحت.</p>
      <canvas id="syncQR" class="lan-qr"></canvas>
      <textarea id="syncOfferOut" class="lan-code" readonly>${esc(S.vd||'')}</textarea>
      <div class="nav-btns" style="margin:8px 0 14px;"><button class="btn btn-ghost" onclick="ZSYNC.copy('syncOfferOut')">📋 نسخ الكود</button></div>
      <b style="font-size:13px;">كود رد الجهاز التاني</b>
      <textarea id="syncAnsIn" class="lan-code" placeholder="الصق كود الرد هنا" style="margin-top:6px;"></textarea>
      <div class="nav-btns" style="margin-top:8px;">
        <button class="btn btn-ghost" onclick="ZSYNC.scanAnswer()">📷 مسح QR الرد</button>
        <button class="btn btn-primary" onclick="ZSYNC.acceptAnswer()">ربط ✓</button>
      </div>
    </div>
    <div class="nav-btns">${back('إلغاء')}</div>`;
  },
  join(){
    return `<div class="card">
      <b>الاتصال بالجهاز الأول</b>
      <textarea id="syncCodeIn" class="lan-code" placeholder="الصق كود الجهاز الأول هنا"></textarea>
      <div class="nav-btns" style="margin-top:8px;">
        <button class="btn btn-ghost" onclick="ZSYNC.scanJoin()">📷 مسح QR</button>
        <button class="btn btn-primary" onclick="ZSYNC.doJoin()">التالي ▶</button>
      </div>
    </div>
    <div class="nav-btns">${back('إلغاء')}</div>`;
  },
  joinAnswer(){
    return `<div class="card">
      <b>كود الرد</b>
      <p style="margin:8px 0; color:var(--ink-dim); font-size:12.5px;">وري الـQR ده للجهاز الأول أو ابعتله الكود.</p>
      <canvas id="syncQR" class="lan-qr"></canvas>
      <textarea id="syncAnsOut" class="lan-code" readonly>${esc(S.vd||'')}</textarea>
      <div class="nav-btns" style="margin-top:8px;"><button class="btn btn-ghost" onclick="ZSYNC.copy('syncAnsOut')">📋 نسخ الكود</button></div>
      <p style="margin:10px 0 0; color:var(--ink-dim); font-size:12px;">⏳ مستني الجهاز الأول يربط…</p>
    </div>
    <div class="nav-btns">${back('إلغاء')}</div>`;
  },
  busy(){
    return `<div class="card" style="text-align:center;"><div style="font-size:34px;">🔄</div><p style="margin:10px 0 0;">${esc(S.vd||'بنزامن…')}</p></div>`;
  },
  rejected(){
    return `<div class="card" style="text-align:center;">
      <div style="font-size:34px;">⛔</div>
      <h3 style="margin:8px 0;">مش نفس الطالب</h3>
      <p style="margin:0; color:var(--ink-dim); line-height:1.8;">الجهازين عليهم معرّفين مختلفين، فمينفعش نزامنهم — المزامنة لازم تكون بين جهازين لنفس الطالب بس.</p>
    </div>
    <div class="nav-btns">${back('حسنًا')}</div>`;
  },
  done(){
    return `<div class="card" style="text-align:center;">
      <div style="font-size:34px;">✅</div>
      <h3 style="margin:8px 0;">اتزامن بنجاح</h3>
      <p style="margin:0; color:var(--ink-dim);">${esc(S.vd||'')}</p>
    </div>
    <div class="nav-btns">${back('تمام')}</div>`;
  }
};
const back = lb => `<button class="btn btn-ghost" onclick="ZSYNC.go('home')">${lb||'رجوع'}</button>`;

// ============ تدفّق الاتصال ============
async function hostStart(){
  if(!STATE.studentId){ toast('لازم يكون عندك معرّف طالب الأول'); return; }
  resetConn(); S.role = 'host';
  const pc = newPC(); S.pc = pc;
  const dc = pc.createDataChannel('s'); S.dc = dc;
  listen(dc, onMsg);
  dc.onopen = () => send(dc, {t:'hello', id: STATE.studentId});
  await pc.setLocalDescription(await pc.createOffer());
  await waitICE(pc);
  const code = pack(pc.localDescription.sdp, 'o');
  go('wait', code);
  drawQR('syncQR', code);
}
async function acceptAnswer(text){
  try{
    const x = unpack(extractCode(text !== undefined ? text : (($('syncAnsIn')||{}).value)));
    if(x.k !== 'a') throw new Error('not answer');
    await S.pc.setRemoteDescription({type:'answer', sdp:buildSDP(x)});
    toast('⏳ بربط الجهاز…');
  }catch(_){ toast('كود الرد مش مظبوط'); }
}
async function doJoin(text){
  const code = extractCode(text !== undefined ? text : (($('syncCodeIn')||{}).value));
  if(!code) return toast('الصق الكود الأول');
  try{
    const x = unpack(code);
    if(x.k !== 'o') throw new Error('not offer');
    resetConn(); S.role = 'client';
    const pc = newPC(); S.pc = pc;
    pc.ondatachannel = e=>{
      S.dc = e.channel;
      listen(S.dc, onMsg);
      S.dc.onopen = () => send(S.dc, {t:'hello', id: STATE.studentId});
    };
    await pc.setRemoteDescription({type:'offer', sdp:buildSDP(x)});
    await pc.setLocalDescription(await pc.createAnswer());
    await waitICE(pc);
    const ans = pack(pc.localDescription.sdp, 'a');
    go('joinAnswer', ans);
    drawQR('syncQR', ans);
  }catch(_){ toast('الكود مش صحيح أو قديم'); }
}
function onMsg(m){
  if(!m || typeof m.t !== 'string' || S.done) return;
  if(m.t === 'hello'){
    if(String(m.id) !== String(STATE.studentId)){
      send(S.dc, {t:'reject'});
      S.done = true; go('rejected');
      return;
    }
    send(S.dc, {t:'state', data: STATE});
  } else if(m.t === 'reject'){
    S.done = true; go('rejected');
  } else if(m.t === 'state'){
    go('busy', 'بندمج التقدّم…');
    const before = STATE;
    const merged = mergeStates(STATE, m.data||{});
    const summary = diffSummary(before, merged);
    applyLoadedState(merged);
    saveState().then(()=>{
      try{ refreshHome(); renderProfile(); }catch(_){}
      S.done = true; go('done', summary);
    });
  }
}
async function scanQR(){
  if(!('BarcodeDetector' in window) || !navigator.mediaDevices){ toast('المسح مش متاح — الصق الكود بدل كده'); return null; }
  let stream;
  try{ stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}, audio:false}); }
  catch(_){ toast('مقدرتش أفتح الكاميرا'); return null; }
  const ov = document.createElement('div');
  ov.className = 'lan-scan';
  ov.innerHTML = '<video playsinline muted></video><button class="btn btn-primary">إلغاء</button>';
  document.body.appendChild(ov);
  const video = ov.querySelector('video'); video.srcObject = stream; await video.play().catch(()=>{});
  const det = new BarcodeDetector({formats:['qr_code']});
  return new Promise(res=>{
    let done = false;
    const fin = v => { if(done) return; done = true; stream.getTracks().forEach(t=>t.stop()); ov.remove(); res(v); };
    ov.querySelector('button').onclick = () => fin(null);
    (async function loop(){
      while(!done){
        try{ const r = await det.detect(video); if(r.length){ fin(r[0].rawValue); return; } }catch(_){}
        await new Promise(r=>setTimeout(r,200));
      }
    })();
  });
}

function openSync(){
  navTo('screen-sync', 'مزامنة بين جهازيك', 'بدون إنترنت — على نفس الشبكة');
  resetConn(); go('home');
}
window.ZSYNC = {
  open: openSync, go, copy,
  hostStart, acceptAnswer: ()=>acceptAnswer(), doJoin: ()=>doJoin(),
  scanJoin: async()=>{ const v = await scanQR(); if(v) doJoin(v); },
  scanAnswer: async()=>{ const v = await scanQR(); if(v) acceptAnswer(v); }
};
})();
