// قاموس المصطلحات — يُبنى تلقائيًا من كل بطاقات "terms" في الوحدات، بالإضافة لمصطلحات عامة إضافية
const EXTRA_GLOSSARY = [
  {t:"مجتمع المعلومات", d:"مجتمع تعتمد فيه الأنشطة اليومية والاقتصادية بشكل جوهري على تقنيات المعلومات والاتصالات."},
  {t:"الخصوصية الرقمية", d:"حق الفرد في التحكم بمن يرى بياناته الشخصية وكيف تُستخدم عبر الإنترنت."},
  {t:"الحوسبة", d:"معالجة البيانات وإجراء العمليات الحسابية والمنطقية عليها باستخدام الحاسوب."},
];

function buildGlossary(units, includeExtra){
  const map = new Map();
  (units||[]).forEach(u=>{
    u.lessons.forEach(l=>{
      (l.terms||[]).forEach(term=>{
        if(!map.has(term.t)) map.set(term.t, {t:term.t, d:term.d, unit:u.title});
      });
    });
  });
  if(includeExtra) EXTRA_GLOSSARY.forEach(g=>{ if(!map.has(g.t)) map.set(g.t, g); });
  return Array.from(map.values()).sort((a,b)=> a.t.localeCompare(b.t,'ar'));
}

// قاموس مقصور على صف الطالب الحالي فقط (يُحسب مرة لكل صف ويُخزَّن)
const _glossCache = {};
function getGlossary(){
  const s = certScope();
  const key = (typeof STATE !== 'undefined' && STATE.currentGrade) || '1sec';
  if(!_glossCache[key]) _glossCache[key] = buildGlossary(s.units, key === '1sec');
  return _glossCache[key];
}
