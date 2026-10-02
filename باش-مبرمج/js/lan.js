// علوم البرمجة — غرفة المذاكرة الجماعية (بدون سيرفر وبدون إنترنت)
// الأجهزة على نفس الشبكة بتتوصل ببعض مباشرة عبر WebRTC: الربط بكود/QR، ومفيش أي بيانات بتروح أي مكان بره الغرفة.
// صاحب الغرفة (المضيف) هو نقطة الوصل: بيشغّل المسابقة ويصحّحها، وتقدّم كل طالب بيتحسب ويتحفظ على جهازه هو.
// © Ahmed Rami
(function(){
'use strict';

const SHARED_KEY = 'zlan_shared', NAME_KEY = 'zlan_name';
const CHUNK = 4000;               // حجم الجزء الواحد (حروف) — أقل من حد رسائل WebRTC الآمن
const XP_PER_CORRECT = 2;         // نفس قيمة سؤال الكويز العادي
const REVEAL_MS = 5500;           // مدة عرض الإجابة الصحيحة قبل السؤال التالي

const $ = id => document.getElementById(id);
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// أي محتوى جاي من جهاز تاني: نهرّب كل الـHTML ونسمح بس بـ <b> و <code> و <br>
const safeHTML = s => esc(s).replace(/&lt;(\/?)(b|code)&gt;/g,'<$1$2>').replace(/&lt;br\s*\/?&gt;/g,'<br>');
const uid = () => Math.random().toString(36).slice(2,8);
const toast = m => { try{ showToast(m); }catch(_){ } };
const allUnits = () => [].concat(UNITS, TERM2_UNITS, BAC2_UNITS).filter(u=>u && u.lessons && u.lessons.length);
const gradeOfUnit = id => Number(id) >= 100 ? '2bac' : '1sec';

// ============ ترميز كود الربط (SDP مضغوط) ============
const hex2b64 = h => btoa(h.split(':').map(x=>String.fromCharCode(parseInt(x,16))).join('')).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const b642hex = b => { b=b.replace(/-/g,'+').replace(/_/g,'/'); while(b.length%4) b+='='; return atob(b).split('').map(c=>c.charCodeAt(0).toString(16).toUpperCase().padStart(2,'0')).join(':'); };

function pack(sdp, kind, pid){
  const g = r => (sdp.match(r)||[])[1];
  const u = g(/a=ice-ufrag:(\S+)/), p = g(/a=ice-pwd:(\S+)/), f = g(/a=fingerprint:sha-256 (\S+)/);
  if(!u || !p || !f) throw new Error('bad sdp');
  let c = [...sdp.matchAll(/a=candidate:\S+ \d+ udp \d+ (\S+) (\d+) typ host/g)].map(m=>m[1]+'/'+m[2]);
  c = [...new Set(c)];
  c = c.filter(x=>!x.includes(':')).concat(c.filter(x=>x.includes(':'))).slice(0,4);
  if(!c.length) throw new Error('no candidates');
  return ['Z1', kind, pid, u, p, hex2b64(f), c.join(',')].join('~');
}
function unpack(code){
  const a = String(code).trim().split('~');
  if(a.length !== 7 || a[0] !== 'Z1' || (a[1] !== 'o' && a[1] !== 'a')) throw new Error('bad code');
  return {k:a[1], pid:a[2], u:a[3], p:a[4], f:b642hex(a[5]), c:a[6].split(',')};
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
  const m = /zlan=([^&\s]+)/.exec(text);
  if(m){ try{ return decodeURIComponent(m[1]); }catch(_){ return m[1]; } }
  const z = /Z1~[^\s]+/.exec(text);
  return z ? z[0] : text;
}
function toLink(code){
  return /^https?:/.test(location.protocol) ? location.href.split('#')[0] + '#zlan=' + encodeURIComponent(code) : code;
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

// ============ طبقة الرسائل (JSON مقسّم لأجزاء) ============
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
      if(!(n>0 && n<=200 && idx>=0 && idx<n)) return;
      const b = bufs[id] || (bufs[id] = {parts:[], c:0});
      if(b.parts[idx] === undefined){ b.parts[idx] = d.slice(i3+1); b.c++; }
      if(b.c === n){ delete bufs[id]; onmsg(JSON.parse(b.parts.join(''))); }
    }catch(_){}
  };
}

// ============ الحالة ============
const R = {
  role: null,          // 'host' | 'client' | null
  name: '', room: '', myId: '',
  peers: {},           // (المضيف) id -> {id, name, pc, dc, open, code}
  roster: [],          // [{id, name, h}]
  hostPC: null, hostDC: null,
  view: 'home', vd: null,
  C: null,             // (المضيف) حالة المسابقة
  cur: null,           // السؤال الحالي عند الكل
  me: {ok:0, players:0, unitId:null},
  tm: null, to: null
};
const bc = ('BroadcastChannel' in window) ? new BroadcastChannel('zlan') : null;

const loadShared = () => { try{ return JSON.parse(localStorage.getItem(SHARED_KEY)||'[]'); }catch(_){ return []; } };
const saveShared = a => { try{ localStorage.setItem(SHARED_KEY, JSON.stringify(a.slice(0,30))); }catch(_){ } };
const defName = () => { try{ return localStorage.getItem(NAME_KEY) || (STATE && STATE.userName) || ''; }catch(_){ return (STATE&&STATE.userName)||''; } };

// ============ الشبكة: المضيف ============
async function hostInvite(){
  Object.keys(R.peers).forEach(k=>{ if(!R.peers[k].open){ try{ R.peers[k].pc.close(); }catch(_){} delete R.peers[k]; } });
  const pid = uid(), pc = newPC(), dc = pc.createDataChannel('z');
  const peer = {id:pid, name:'', pc, dc, open:false, code:''};
  R.peers[pid] = peer;
  listen(dc, m => onHostMsg(peer, m));
  dc.onopen = () => { peer.open = true; };
  dc.onclose = () => dropPeer(pid);
  pc.onconnectionstatechange = () => { if(pc.connectionState === 'failed' || pc.connectionState === 'closed') dropPeer(pid); };
  await pc.setLocalDescription(await pc.createOffer());
  await waitICE(pc);
  peer.code = pack(pc.localDescription.sdp, 'o', pid);
  return peer;
}
async function hostAccept(text){
  const x = unpack(extractCode(text));
  const peer = R.peers[x.pid];
  if(x.k !== 'a' || !peer) throw new Error('no peer');
  await peer.pc.setRemoteDescription({type:'answer', sdp:buildSDP(x)});
}
function rosterList(){
  const l = [{id:'host', name:R.name, h:1}];
  Object.values(R.peers).forEach(p=>{ if(p.open && p.name) l.push({id:p.id, name:p.name}); });
  return l;
}
function broadcast(obj, exceptId){
  Object.values(R.peers).forEach(p=>{ if(p.open && p.name && p.id !== exceptId) send(p.dc, obj); });
}
function pushRoster(){
  R.roster = rosterList();
  broadcast({t:'roster', list:R.roster});
  paintRoster();
}
function dropPeer(pid){
  const p = R.peers[pid]; if(!p) return;
  const was = p.open && p.name;
  try{ p.pc.close(); }catch(_){}
  delete R.peers[pid];
  if(was){ toast('👋 '+p.name+' خرج من الغرفة'); pushRoster(); if(R.C && R.C.phase==='q') checkAllAnswered(); }
}
function onHostMsg(peer, m){
  if(!m || typeof m.t !== 'string') return;
  if(m.t === 'join'){
    peer.name = String(m.name||'طالب').replace(/[<>]/g,'').trim().slice(0,20) || 'طالب';
    send(peer.dc, {t:'welcome', id:peer.id, room:R.room, host:R.name});
    toast('✅ '+peer.name+' انضم للغرفة');
    pushRoster();
    if(R.view === 'hostAdd') go('host');
  } else if(m.t === 'share' && peer.name){
    const d = cleanShare(m.data); if(!d) return;
    storeShared(peer.name, d);
    broadcast({t:'share', from:peer.name, data:d}, peer.id);
  } else if(m.t === 'ans' && peer.name){
    onAns(peer.id, m);
  } else if(m.t === 'bye'){
    dropPeer(peer.id);
  }
}

// ============ الشبكة: المنضم ============
async function clientJoin(text){
  const x = unpack(extractCode(text));
  if(x.k !== 'o') throw new Error('not offer');
  resetNet();
  R.role = 'client';
  const pc = newPC(); R.hostPC = pc;
  pc.ondatachannel = e=>{
    const dc = e.channel; R.hostDC = dc;
    listen(dc, onClientMsg);
    dc.onopen = () => send(dc, {t:'join', name:R.name});
    dc.onclose = () => { if(R.role === 'client'){ toast('⚠️ الاتصال بصاحب الغرفة اتقطع'); leave(true); } };
  };
  await pc.setRemoteDescription({type:'offer', sdp:buildSDP(x)});
  await pc.setLocalDescription(await pc.createAnswer());
  await waitICE(pc);
  return pack(pc.localDescription.sdp, 'a', x.pid);
}
function onClientMsg(m){
  if(!m || typeof m.t !== 'string') return;
  if(m.t === 'welcome'){ R.myId = String(m.id); R.room = String(m.room||'').slice(0,40); go('client'); }
  else if(m.t === 'roster'){ R.roster = (Array.isArray(m.list)?m.list:[]).slice(0,60).map(x=>({id:String(x.id), name:String(x.name||'').slice(0,20), h:x.h?1:0})); paintRoster(); }
  else if(m.t === 'share'){ const d = cleanShare(m.data); if(d) storeShared(String(m.from||'؟').slice(0,20), d); }
  else if(m.t === 'cstart') handleCStart(m);
  else if(m.t === 'q') handleQ(m);
  else if(m.t === 'rev') handleRev(m);
  else if(m.t === 'cend') handleCEnd(m);
  else if(m.t === 'bye'){ toast('🔒 صاحب الغرفة قفلها'); leave(true); }
}
function resetNet(){
  Object.values(R.peers).forEach(p=>{ try{ p.pc.close(); }catch(_){} });
  try{ if(R.hostPC) R.hostPC.close(); }catch(_){}
  R.peers = {}; R.hostPC = R.hostDC = null; R.roster = []; R.role = null; R.myId = '';
  clearTimeout(R.to); clearInterval(R.tm); R.C = null; R.cur = null;
}
function leave(silent){
  if(R.role === 'host') broadcast({t:'bye'});
  else if(R.hostDC) send(R.hostDC, {t:'bye'});
  resetNet();
  go('home');
  if(!silent) toast('خرجت من الغرفة');
}

// ============ مشاركة الدروس ============
function cleanShare(d){
  if(!d || typeof d !== 'object') return null;
  const S = (x,n) => String(x==null?'':x).slice(0,n);
  const ls = (Array.isArray(d.lessons)?d.lessons:[]).slice(0,12).map(l=>({
    title:S(l&&l.title,200), goal:S(l&&l.goal,600),
    points:(Array.isArray(l&&l.points)?l.points:[]).slice(0,40).map(x=>S(x,1500)),
    terms:(Array.isArray(l&&l.terms)?l.terms:[]).slice(0,40).map(t=>({t:S(t&&t.t,120), d:S(t&&t.d,600)})),
    example:S(l&&l.example,2500), remember:S(l&&l.remember,800)
  }));
  if(!ls.length) return null;
  return {title:S(d.title,200), icon:S(d.icon,4), color:/^#[0-9a-fA-F]{6}$/.test(d.color)?d.color:'#7C9CFF', lessons:ls};
}
function storeShared(from, d){
  const a = loadShared();
  a.unshift(Object.assign({id:uid()+Date.now().toString(36), from, at:Date.now()}, d));
  saveShared(a);
  toast('📥 وصلك درس من '+from);
  if(R.view === 'inbox') go('inbox'); else if(R.view === 'host' || R.view === 'client') go(R.view);
}
function buildShare(unitId, idxs){
  const u = allUnits().find(x=>x.id===unitId); if(!u) return null;
  const lessons = idxs.map(i=>u.lessons[i]).filter(Boolean).map(l=>({title:l.title, goal:l.goal, points:l.points||[], terms:l.terms||[], example:l.example||'', remember:l.remember||''}));
  return lessons.length ? {title:u.title, icon:u.icon, color:u.color, lessons} : null;
}

// ============ المسابقة — المضيف ============
const normAns = s => String(s).trim().toLowerCase().replace(/[إأآا]/g,'ا').replace(/ة/g,'ه').replace(/\s+/g,'');
function isRight(q, val){
  if(q.type === 'mcq') return typeof val === 'number' && val === q.a;
  if(q.type === 'tf') return typeof val === 'boolean' && val === q.a;
  if(q.type === 'fill'){
    if(typeof val !== 'string') return false;
    const ng = normAns(val.slice(0,200)), nc = normAns(q.answer||'');
    return ng.length>0 && (ng === nc || ng.includes(nc) || (nc.includes(ng) && ng.length >= Math.max(2, Math.ceil(nc.length*0.6))));
  }
  return false;
}
const players = () => ['host'].concat(Object.values(R.peers).filter(p=>p.open && p.name).map(p=>p.id));

function hostStartContest(unitId, count, secs){
  const u = allUnits().find(x=>x.id===unitId);
  const ids = players();
  if(!u || !(u.finalTest||[]).length) return toast('الوحدة دي مفيهاش أسئلة');
  if(ids.length < 2) return toast('ضيف جهاز واحد على الأقل قبل ما تبدأ المسابقة');
  const pool = u.finalTest.slice(); shuffleArray(pool);
  const qs = pool.slice(0, count).map(q=>{
    const c = JSON.parse(JSON.stringify(q)); c.type = c.type || 'mcq';
    if(c.type === 'mcq'){ const o = c.opts.map((_,i)=>i); shuffleArray(o); c.opts = o.map(i=>c.opts[i]); c.a = o.indexOf(c.a); }
    return c;
  });
  const scores = {};
  ids.forEach(id=>{ scores[id] = {name: id==='host' ? R.name : R.peers[id].name, score:0, ok:0}; });
  R.C = {unitId, title:u.title, qs, secs, i:-1, scores, ans:{}, phase:'start', t0:0};
  const msg = {t:'cstart', title:u.title, total:qs.length, secs, unitId, players:ids.length};
  broadcast(msg); handleCStart(msg);
  R.to = setTimeout(nextQ, 3000);
}
function nextQ(){
  const C = R.C; if(!C) return;
  C.i++;
  if(C.i >= C.qs.length) return endContest();
  C.ans = {}; C.phase = 'q'; C.t0 = Date.now();
  const q = C.qs[C.i];
  const msg = {t:'q', i:C.i, total:C.qs.length, secs:C.secs, q:{type:q.type, q:q.q, opts:q.opts}};
  broadcast(msg); handleQ(msg);
  clearTimeout(R.to); R.to = setTimeout(doReveal, C.secs*1000 + 1200);
}
function onAns(pid, m){
  const C = R.C;
  if(!C || C.phase !== 'q' || m.i !== C.i || C.ans[pid] || !C.scores[pid]) return;
  C.ans[pid] = {val:m.val, ms:Date.now()-C.t0};
  checkAllAnswered();
}
function checkAllAnswered(){
  const C = R.C; if(!C || C.phase !== 'q') return;
  if(players().every(id => !C.scores[id] || C.ans[id])){ clearTimeout(R.to); R.to = setTimeout(doReveal, 400); }
}
function doReveal(){
  const C = R.C; if(!C || C.phase !== 'q') return;
  C.phase = 'rev'; clearTimeout(R.to);
  const q = C.qs[C.i], res = {};
  Object.keys(C.scores).forEach(id=>{
    const a = C.ans[id], ok = !!a && isRight(q, a.val);
    const pts = ok ? 100 + Math.round(50 * Math.max(0, 1 - a.ms/(C.secs*1000))) : 0;
    C.scores[id].score += pts; if(ok) C.scores[id].ok++;
    res[id] = {ok, pts, answered:!!a};
  });
  const msg = {t:'rev', i:C.i, correct: q.type==='fill' ? q.answer : q.a, ex:q.ex||'', res, board:boardOf(C)};
  broadcast(msg); handleRev(msg);
  R.to = setTimeout(nextQ, REVEAL_MS);
}
const boardOf = C => Object.keys(C.scores).map(id=>({id, name:C.scores[id].name, score:C.scores[id].score, ok:C.scores[id].ok})).sort((a,b)=>b.score-a.score);
function endContest(){
  const C = R.C; clearTimeout(R.to);
  const msg = {t:'cend', board:boardOf(C), total:C.qs.length, unitId:C.unitId};
  broadcast(msg); handleCEnd(msg);
  R.C = null;
}
function skipNow(){ if(R.role==='host' && R.C && R.C.phase==='rev'){ clearTimeout(R.to); nextQ(); } }

// ============ المسابقة — عند الكل (المضيف نفسه لاعب) ============
function ensureScreen(){ if(!$('screen-lan').classList.contains('active')) openLan(); }
function handleCStart(m){
  R.me = {ok:0, players:+m.players||0, unitId:m.unitId, total:+m.total||0};
  R.cur = null; ensureScreen(); go('cwait', {title:String(m.title||'').slice(0,100), total:m.total, secs:m.secs});
}
function handleQ(m){
  const q = m.q||{};
  R.cur = {i:m.i, total:m.total, secs:m.secs, q:{type:q.type, q:String(q.q||''), opts:(q.opts||[]).map(String)}, deadline:Date.now()+m.secs*1000, answered:false, chosen:null};
  ensureScreen(); go('q');
}
function answer(val){
  const c = R.cur; if(!c || c.answered || Date.now() > c.deadline + 500) return;
  c.answered = true; c.chosen = val;
  if(R.role === 'host') onAns('host', {i:c.i, val}); else send(R.hostDC, {t:'ans', i:c.i, val});
  paintQ();
}
function answerFill(){ const el = $('lanFill'); if(el && el.value.trim()) answer(el.value.trim().slice(0,200)); }
function handleRev(m){
  const mine = (m.res||{})[R.myId || 'host'] || {};
  if(mine.ok) R.me.ok++;
  R.cur = R.cur || {q:{type:'mcq',q:'',opts:[]}};
  R.cur.rev = {correct:m.correct, ex:String(m.ex||''), mine, board:m.board||[]};
  clearInterval(R.tm); ensureScreen(); go('rev');
}
function handleCEnd(m){
  clearInterval(R.tm);
  const board = m.board||[];
  let xp = 0;
  if(R.me.players >= 2 && R.me.ok > 0){
    xp = R.me.ok * XP_PER_CORRECT;
    try{ addXP(gradeOfUnit(R.me.unitId || m.unitId), xp); saveState(); }catch(_){ xp = 0; }
  }
  ensureScreen(); go('end', {board, xp, ok:R.me.ok, total:m.total});
}

// ============ الواجهة ============
function go(view, vd){ R.view = view; if(vd !== undefined) R.vd = vd; render(); }
function render(){
  const root = $('lanRoot'); if(!root) return;
  clearInterval(R.tm);
  const V = VIEWS[R.view] || VIEWS.home;
  root.innerHTML = V();
  if(R.view === 'q') startTimer();
  if(R.view === 'hostAdd') paintPair();
  if(R.view === 'joinAnswer') paintAnswerQR();
}
function paintRoster(){
  const el = $('lanRoster'); if(el) el.innerHTML = rosterHTML();
}
const rosterHTML = () => (R.roster.length ? R.roster : rosterList()).map(p=>`<div class="lan-person"><span>${p.h?'👑':'🧑‍🎓'}</span><b>${esc(p.name)}</b>${p.id===R.myId||(R.role==='host'&&p.id==='host')?'<em>(أنا)</em>':''}</div>`).join('');
function boardHTML(board, limit){
  const me = R.role==='host' ? 'host' : R.myId;
  return (board||[]).slice(0, limit||20).map((b,i)=>`<div class="lan-person${b.id===me?' me':''}"><span>${['🥇','🥈','🥉'][i]||(i+1)}</span><b>${esc(b.name)}</b><em>${+b.score||0} نقطة</em></div>`).join('');
}
const nameField = () => `<input id="lanName" class="lan-input" maxlength="20" placeholder="اسمك في الغرفة" value="${esc(defName())}">`;
function readName(){
  const v = (($('lanName')||{}).value||'').replace(/[<>]/g,'').trim().slice(0,20);
  if(!v){ toast('اكتب اسمك الأول'); return ''; }
  R.name = v; try{ localStorage.setItem(NAME_KEY, v); }catch(_){}
  return v;
}
const back = (v,lb) => `<button class="btn btn-ghost" onclick="ZLAN.go('${v}')">${lb||'رجوع'}</button>`;
const inboxBtn = () => { const n = loadShared().length; return `<button class="btn btn-ghost" onclick="ZLAN.go('inbox')">📥 دروس مستلمة${n?' ('+n+')':''}</button>`; };

const VIEWS = {
  home(){
    const rtc = !!window.RTCPeerConnection;
    return `<div class="card">
      <span class="card-tag" style="background:rgba(124,156,255,.14); color:#A9BEFF;">👥 غرفة المذاكرة الجماعية</span>
      <p style="margin:8px 0 12px; line-height:1.9;">ذاكروا مع بعض وتسابقوا وابعتوا لبعض الدروس — <b>من غير إنترنت ومن غير سيرفر</b>. كل الأجهزة لازم تكون على نفس الواي فاي (أو هوت سبوت واحد).</p>
      ${rtc ? nameField() : '<p style="color:var(--accent-3);">المتصفح ده مش بيدعم الاتصال المباشر بين الأجهزة. جرّب Chrome أو Safari حديث.</p>'}
      ${rtc ? `<div class="nav-btns" style="margin-top:12px;">
        <button class="btn btn-primary" onclick="ZLAN.createRoom()">🏠 افتح غرفة</button>
        <button class="btn btn-ghost" onclick="ZLAN.go('join')">🔗 انضم لغرفة</button>
      </div>` : ''}
      <p style="font-size:11px; color:var(--ink-dim); margin:12px 0 0; line-height:1.8;">تقدّمك و XP بيتحسبوا ويتحفظوا على جهازك إنت بس. لو الشبكة (زي واي فاي مدارس كتير) بتمنع الأجهزة من بعضها، الربط مش هينجح — جرّب هوت سبوت من موبايل.</p>
    </div>
    ${loadShared().length ? `<div class="nav-btns">${inboxBtn()}</div>` : ''}`;
  },
  host(){
    return `<div class="card">
      <span class="card-tag" style="background:rgba(51,224,194,.14); color:var(--accent);">🏠 ${esc(R.room)}</span>
      <div id="lanRoster" style="margin:10px 0;">${rosterHTML()}</div>
      <div class="lan-grid">
        <button class="btn btn-primary" onclick="ZLAN.addDevice()">➕ إضافة جهاز</button>
        <button class="btn btn-primary" onclick="ZLAN.go('cSetup')">🏆 ابدأ مسابقة</button>
        <button class="btn btn-ghost" onclick="ZLAN.go('share')">📤 ابعت دروس</button>
        ${inboxBtn()}
      </div>
      <div class="nav-btns" style="margin-top:12px;"><button class="btn btn-ghost" style="color:var(--accent-3);" onclick="ZLAN.leave()">🔒 اقفل الغرفة</button></div>
    </div>`;
  },
  hostAdd(){
    return `<div class="card">
      <b>إضافة جهاز</b>
      <ol class="lan-steps">
        <li>الجهاز التاني يفتح التطبيق ← <b>انضم لغرفة</b> ← يمسح الـQR ده (أو يلصق الكود).</li>
        <li>هيظهرله كود رد — امسحه من عندك أو الصقه هنا تحت.</li>
      </ol>
      <div id="lanPairBox"><p style="color:var(--ink-dim);">⏳ بجهّز الكود…</p></div>
    </div>
    <div class="nav-btns">${back('host','إلغاء')}</div>`;
  },
  join(){
    return `<div class="card">
      <b>الانضمام لغرفة</b>
      <p style="margin:8px 0; color:var(--ink-dim); font-size:12.5px;">${nameField().replace('class="lan-input"','class="lan-input" style="margin-bottom:10px"')}</p>
      <ol class="lan-steps"><li>امسح الـQR اللي على جهاز صاحب الغرفة، أو الصق الكود اللي بعته.</li></ol>
      <textarea id="lanCodeIn" class="lan-code" placeholder="الصق كود الغرفة هنا"></textarea>
      <div class="nav-btns" style="margin-top:8px;">
        <button class="btn btn-ghost" onclick="ZLAN.scanJoin()">📷 مسح QR</button>
        <button class="btn btn-primary" onclick="ZLAN.doJoin()">ربط ✓</button>
      </div>
    </div>
    <div class="nav-btns">${back('home')}</div>`;
  },
  joinAnswer(){
    return `<div class="card">
      <b>كود الرد</b>
      <p style="margin:8px 0; color:var(--ink-dim); font-size:12.5px; line-height:1.8;">وري الـQR ده لصاحب الغرفة عشان يمسحه (أو ابعتله الكود). الاتصال هيتم لوحده بعد كده.</p>
      <canvas id="lanQR" class="lan-qr"></canvas>
      <textarea id="lanAnsOut" class="lan-code" readonly>${esc(R.vd||'')}</textarea>
      <div class="nav-btns" style="margin-top:8px;"><button class="btn btn-ghost" onclick="ZLAN.copy('lanAnsOut')">📋 نسخ الكود</button></div>
      <p style="margin:10px 0 0; color:var(--ink-dim); font-size:12px;">⏳ مستني صاحب الغرفة يربط…</p>
    </div>
    <div class="nav-btns">${back('home','إلغاء')}</div>`;
  },
  client(){
    return `<div class="card">
      <span class="card-tag" style="background:rgba(51,224,194,.14); color:var(--accent);">✅ متصل — ${esc(R.room)}</span>
      <div id="lanRoster" style="margin:10px 0;">${rosterHTML()}</div>
      <p style="margin:0 0 10px; color:var(--ink-dim); font-size:12.5px;">مستني صاحب الغرفة يبدأ مسابقة… تقدر تبعت وتستقبل دروس في الأثناء.</p>
      <div class="lan-grid">
        <button class="btn btn-ghost" onclick="ZLAN.go('share')">📤 ابعت دروس</button>
        ${inboxBtn()}
      </div>
      <div class="nav-btns" style="margin-top:12px;"><button class="btn btn-ghost" style="color:var(--accent-3);" onclick="ZLAN.leave()">🚪 اخرج من الغرفة</button></div>
    </div>`;
  },
  share(){
    const units = allUnits();
    const uid0 = (R.vd && R.vd.unitId) || units[0].id;
    const u = units.find(x=>x.id===uid0) || units[0];
    return `<div class="card">
      <b>📤 ابعت دروس لكل اللي في الغرفة</b>
      <select id="lanUnit" class="lan-input" style="margin:10px 0;" onchange="ZLAN.pickUnit(+this.value)">
        ${units.map(x=>`<option value="${x.id}"${x.id===u.id?' selected':''}>الوحدة ${x.id>=100?x.id-100:x.id} — ${esc(x.title)}</option>`).join('')}
      </select>
      ${u.lessons.map((l,i)=>`<label class="lan-check"><input type="checkbox" class="lanLes" value="${i}" checked> ${esc(l.title)}</label>`).join('')}
      <div class="nav-btns" style="margin-top:10px;"><button class="btn btn-primary" onclick="ZLAN.doShare()">إرسال ✓</button></div>
    </div>
    <div class="nav-btns">${back(R.role==='host'?'host':'client')}</div>`;
  },
  inbox(){
    const a = loadShared();
    return `<div class="card"><b>📥 دروس مستلمة</b>
      ${a.length ? a.map(x=>`<div class="lan-person" onclick="ZLAN.openLesson('${x.id}')" style="cursor:pointer;"><span>${esc(x.icon||'📘')}</span><b>${esc(x.title)}</b><em>من ${esc(x.from)} · ${x.lessons.length} درس</em></div>`).join('') : '<p style="color:var(--ink-dim);">لسه مفيش دروس وصلتك.</p>'}
    </div>
    <div class="nav-btns">${back(R.role==='host'?'host':R.role==='client'?'client':'home')}</div>`;
  },
  lesson(){
    const x = loadShared().find(s=>s.id===R.vd);
    if(!x) return VIEWS.inbox();
    return `<div class="card"><span class="card-tag" style="background:rgba(124,156,255,.14); color:#A9BEFF;">${esc(x.icon||'📘')} ${esc(x.title)} — من ${esc(x.from)}</span></div>` +
      x.lessons.map(l=>`<div class="card">
        <h3 style="margin:0 0 6px;">${esc(l.title)}</h3>
        ${l.goal?`<p style="color:var(--ink-dim); margin:0 0 8px;">🎯 ${safeHTML(l.goal)}</p>`:''}
        <ul style="padding-inline-start:18px; line-height:1.9; margin:0;">${l.points.map(p=>`<li>${safeHTML(p)}</li>`).join('')}</ul>
        ${l.terms.length?`<p style="margin:10px 0 4px;"><b>📖 مصطلحات</b></p>${l.terms.map(t=>`<div style="font-size:12.5px; line-height:1.8;"><b>${esc(t.t)}:</b> ${safeHTML(t.d)}</div>`).join('')}`:''}
        ${l.example?`<p style="margin:10px 0 0; line-height:1.9;"><b>💡 مثال:</b> ${safeHTML(l.example)}</p>`:''}
        ${l.remember?`<p style="margin:10px 0 0; line-height:1.9;"><b>📌 تذكّر:</b> ${safeHTML(l.remember)}</p>`:''}
      </div>`).join('') +
      `<div class="nav-btns">${back('inbox')}</div>`;
  },
  cSetup(){
    const units = allUnits().filter(u=>(u.finalTest||[]).length);
    const n = Object.values(R.peers).filter(p=>p.open&&p.name).length;
    return `<div class="card">
      <b>🏆 مسابقة جديدة</b>
      <p style="margin:6px 0 10px; color:var(--ink-dim); font-size:12.5px;">المشتركين: ${n+1} (إنت + ${n}). الأسئلة من الاختبار الشامل للوحدة، والنقاط بتزيد مع السرعة.</p>
      <select id="cUnit" class="lan-input" style="margin-bottom:8px;">${units.map(u=>`<option value="${u.id}">الوحدة ${u.id>=100?u.id-100:u.id} — ${esc(u.title)}</option>`).join('')}</select>
      <div class="lan-grid">
        <select id="cCount" class="lan-input"><option value="5">5 أسئلة</option><option value="10" selected>10 أسئلة</option><option value="15">15 سؤال</option></select>
        <select id="cSecs" class="lan-input"><option value="15">15 ثانية</option><option value="25" selected>25 ثانية</option><option value="40">40 ثانية</option></select>
      </div>
      <div class="nav-btns" style="margin-top:12px;"><button class="btn btn-primary" onclick="ZLAN.startContest()">ابدأ 🚀</button></div>
      <p style="margin:10px 0 0; font-size:11px; color:var(--ink-dim);">كل إجابة صح بتدّي صاحبها ${XP_PER_CORRECT} XP على جهازه (لازم يكون فيه لاعبين اتنين على الأقل).</p>
    </div>
    <div class="nav-btns">${back('host')}</div>`;
  },
  cwait(){
    const d = R.vd||{};
    return `<div class="card" style="text-align:center;">
      <div style="font-size:40px;">🏆</div>
      <h3 style="margin:6px 0;">المسابقة هتبدأ!</h3>
      <p style="margin:0; color:var(--ink-dim);">${esc(d.title)} — ${+d.total||0} سؤال · ${+d.secs||0} ثانية لكل سؤال</p>
    </div>`;
  },
  q(){
    const c = R.cur; if(!c) return VIEWS.home();
    return `<div class="card">
      <div class="lan-top"><span>سؤال ${c.i+1} / ${c.total}</span><span class="lan-timer" id="lanT">${c.secs}</span></div>
      <div class="quiz-q" style="margin:12px 0;">${safeHTML(c.q.q)}</div>
      <div id="lanQBody">${qBodyHTML()}</div>
    </div>`;
  },
  rev(){
    const c = R.cur||{}, r = c.rev||{}, q = c.q||{type:'mcq',opts:[]};
    const corr = q.type==='mcq' ? (q.opts[r.correct]||'') : q.type==='tf' ? (r.correct ? '✅ صح' : '❌ خطأ') : r.correct;
    const m = r.mine||{};
    return `<div class="card">
      <div style="font-size:15px; font-weight:800; color:${m.ok?'var(--accent)':'var(--accent-3)'};">${m.ok?'✅ إجابتك صح — '+(+m.pts||0)+' نقطة':(m.answered?'❌ إجابتك غلط':'⏰ خلص الوقت')}</div>
      <div class="quiz-q" style="margin:10px 0 4px;">${safeHTML(q.q||'')}</div>
      <p style="margin:0 0 6px;"><b>الإجابة الصحيحة:</b> ${safeHTML(corr)}</p>
      ${r.ex?`<div class="quiz-explain show">${safeHTML(r.ex)}</div>`:''}
    </div>
    <div class="card"><b>الترتيب</b><div style="margin-top:8px;">${boardHTML(r.board,5)}</div></div>
    ${R.role==='host'?`<div class="nav-btns"><button class="btn btn-primary" onclick="ZLAN.skip()">التالي ▶</button></div>`:''}`;
  },
  end(){
    const d = R.vd||{};
    return `<div class="card" style="text-align:center;">
      <div style="font-size:40px;">🏁</div>
      <h3 style="margin:6px 0;">انتهت المسابقة</h3>
      <p style="margin:0; color:var(--ink-dim);">جاوبت صح على ${+d.ok||0} من ${+d.total||0}${d.xp?` — حصلت على <b style="color:var(--accent);">${d.xp} XP</b> 🎉`:''}</p>
    </div>
    <div class="card"><b>النتيجة النهائية</b><div style="margin-top:8px;">${boardHTML(d.board)}</div></div>
    <div class="nav-btns"><button class="btn btn-primary" onclick="ZLAN.go('${R.role==='host'?'host':'client'}')">رجوع للغرفة</button></div>`;
  }
};

function qBodyHTML(){
  const c = R.cur, q = c.q, done = c.answered;
  if(done) return `<div class="quiz-explain show" style="display:block;">✔ تم إرسال إجابتك — مستني باقي اللاعبين…</div>`;
  if(q.type === 'mcq') return q.opts.map((o,i)=>`<button class="opt" onclick="ZLAN.ans(${i})">${safeHTML(o)}</button>`).join('');
  if(q.type === 'tf') return `<button class="opt" onclick="ZLAN.ans(true)">✅ صح</button><button class="opt" onclick="ZLAN.ans(false)">❌ خطأ</button>`;
  return `<div style="display:flex; gap:8px;"><input id="lanFill" class="lan-input" placeholder="اكتب إجابتك…" onkeydown="if(event.key==='Enter')ZLAN.fill()"><button class="btn btn-primary" style="flex:none; padding:11px 16px;" onclick="ZLAN.fill()">إرسال</button></div>`;
}
function paintQ(){ const el = $('lanQBody'); if(el && R.cur) el.innerHTML = qBodyHTML(); }
function startTimer(){
  const tick = () => {
    const c = R.cur, el = $('lanT'); if(!c || !el) return clearInterval(R.tm);
    const left = Math.max(0, Math.ceil((c.deadline - Date.now())/1000));
    el.textContent = left; el.classList.toggle('low', left <= 5);
  };
  tick(); R.tm = setInterval(tick, 250);
}

// ============ الربط: شاشات QR والمسح ============
function drawQR(canvasId, code){
  const cv = $(canvasId); if(!cv || !window.ZQR) return;
  try{ ZQR.draw(cv, toLink(code), 720, 'M'); }catch(_){ cv.style.display = 'none'; }
}
async function paintPair(){
  try{
    const peer = await hostInvite();
    const box = $('lanPairBox'); if(!box || R.view !== 'hostAdd') return;
    box.innerHTML = `<canvas id="lanQR" class="lan-qr"></canvas>
      <textarea id="lanOfferOut" class="lan-code" readonly>${esc(peer.code)}</textarea>
      <div class="nav-btns" style="margin:8px 0 14px;"><button class="btn btn-ghost" onclick="ZLAN.copy('lanOfferOut')">📋 نسخ الكود</button></div>
      <b style="font-size:13px;">كود رد الجهاز التاني</b>
      <textarea id="lanAnsIn" class="lan-code" placeholder="الصق كود الرد هنا" style="margin-top:6px;"></textarea>
      <div class="nav-btns" style="margin-top:8px;">
        <button class="btn btn-ghost" onclick="ZLAN.scanAnswer()">📷 مسح QR الرد</button>
        <button class="btn btn-primary" onclick="ZLAN.acceptAnswer()">ربط ✓</button>
      </div>`;
    drawQR('lanQR', peer.code);
  }catch(e){ const box = $('lanPairBox'); if(box) box.innerHTML = '<p style="color:var(--accent-3);">مقدرتش أجهّز الكود. اتأكد إنك على شبكة واي فاي وجرّب تاني.</p>'; }
}
function paintAnswerQR(){ drawQR('lanQR', R.vd||''); }

async function scanQR(){
  if(!('BarcodeDetector' in window) || !navigator.mediaDevices){ toast('المسح مش متاح في المتصفح ده — الصق الكود أو افتح الرابط بكاميرا الموبايل'); return null; }
  let stream;
  try{ stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}, audio:false}); }
  catch(_){ toast('مقدرتش أفتح الكاميرا — اتأكد من الصلاحية، أو الصق الكود'); return null; }
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
async function doJoin(text){
  if(!readName()) return;
  const code = extractCode(text !== undefined ? text : ($('lanCodeIn')||{}).value);
  if(!code) return toast('الصق كود الغرفة الأول');
  toast('⏳ بجهّز الاتصال…');
  try{ const ans = await clientJoin(code); go('joinAnswer', ans); }
  catch(_){ resetNet(); toast('الكود مش صحيح أو قديم — اطلب كود جديد من صاحب الغرفة'); }
}
async function acceptAnswer(text){
  try{ await hostAccept(text !== undefined ? text : ($('lanAnsIn')||{}).value); toast('⏳ بربط الجهاز…'); }
  catch(_){ toast('كود الرد مش مظبوط أو الجهاز ده مش مستني ربط'); }
}
function copy(id){
  const el = $(id); if(!el) return;
  el.select();
  try{ navigator.clipboard.writeText(el.value).then(()=>toast('اتنسخ ✓')).catch(()=>{ document.execCommand('copy'); toast('اتنسخ ✓'); }); }
  catch(_){ try{ document.execCommand('copy'); toast('اتنسخ ✓'); }catch(__){ toast('حدد الكود وانسخه يدويًا'); } }
}

// ============ نقاط الدخول ============
function openLan(){
  navTo('screen-lan', 'غرفة المذاكرة', 'بدون إنترنت — على نفس الشبكة');
  if(!R.role && !['home','join','joinAnswer','inbox','lesson'].includes(R.view)) R.view = 'home';
  if(R.role === 'host' && ['home','join','joinAnswer'].includes(R.view)) R.view = 'host';
  if(R.role === 'client' && ['home','join','joinAnswer'].includes(R.view) && R.myId) R.view = 'client';
  render();
}
window.ZLAN = {
  open: openLan, go,
  createRoom(){ if(!readName()) return; R.role = 'host'; R.myId = 'host'; R.room = 'غرفة '+R.name; R.roster = rosterList(); go('host'); },
  addDevice(){ go('hostAdd'); },
  scanJoin: async()=>{ const v = await scanQR(); if(v) doJoin(v); },
  scanAnswer: async()=>{ const v = await scanQR(); if(v) acceptAnswer(v); },
  doJoin: ()=>doJoin(), acceptAnswer: ()=>acceptAnswer(), copy, leave: ()=>leave(),
  pickUnit(id){ go('share', {unitId:id}); },
  doShare(){
    const unitId = +$('lanUnit').value;
    const idxs = [...document.querySelectorAll('.lanLes:checked')].map(x=>+x.value);
    const d = buildShare(unitId, idxs);
    if(!d) return toast('اختار درس واحد على الأقل');
    const ok = R.role === 'host' ? (broadcast({t:'share', from:R.name, data:d}), true) : send(R.hostDC, {t:'share', data:d});
    toast(ok ? '📤 اتبعتت لكل اللي في الغرفة' : 'مفيش اتصال بالغرفة');
    go(R.role === 'host' ? 'host' : 'client');
  },
  openLesson(id){ go('lesson', id); },
  startContest(){ hostStartContest(+$('cUnit').value, +$('cCount').value, +$('cSecs').value); },
  ans: answer, fill: answerFill, skip: skipNow
};

// ============ الرابط العميق (فتح كود من كاميرا الموبايل العادية) ============
if(bc) bc.onmessage = e => {
  if(R.role === 'host' && e.data && e.data.code){ acceptAnswer(e.data.code); }
};
window.addEventListener('load', ()=>setTimeout(()=>{
  const m = /^#zlan=(.+)$/.exec(location.hash); if(!m) return;
  let code = ''; try{ code = decodeURIComponent(m[1]); }catch(_){ return; }
  try{ history.replaceState(null, '', location.href.split('#')[0]); }catch(_){}
  let x; try{ x = unpack(code); }catch(_){ return toast('رابط الغرفة مش صحيح'); }
  openLan();
  if(x.k === 'o'){ R.view = 'join'; render(); const t = $('lanCodeIn'); if(t) t.value = code; toast('اكتب اسمك وبعدين اضغط ربط'); }
  else if(bc){ bc.postMessage({code}); R.view = 'home'; $('lanRoot').innerHTML = '<div class="card" style="text-align:center;"><div style="font-size:34px;">✅</div><p>اتبعت الرد لصاحب الغرفة. ارجع للتطبيق على جهازك.</p></div>'; }
}, 500));
})();
