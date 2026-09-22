const CFG = window.ALMANARA_CONFIG || {};
const DEMO = CFG.DEMO_MODE !== false;
const DEMO_KEY = 'almanara_v4_demo_data';
const DEMO_SESSION = 'almanara_v4_session';
const LOGIN_EMAIL_KEY = 'almanara_login_email';
const LOGIN_REMEMBER_KEY = 'almanara_login_remember';
const PARENT_CODE_KEY = 'manara_parent_saved_code';
const FCM_TOKEN_KEY = 'manara_fcm_token';
const PUBLIC_PARENT_PORTAL_URL = 'https://abdoali07979-collab.github.io/manara-school/';
const APP_VERSION_CODE = 15;
const APP_VERSION_LABEL = '6.11';
const UPDATE_CACHE_KEY = 'manara_android_update_config_v1';
let sb = null;
let state = { screen:'parent', user:null, role:null, tab:'home', portal:null, data:null, sidebar:false, loginNotice:'', portalPoll:null, pendingAuthUser:null, pendingAuthProfile:null, mfaEnroll:null };

function uid(){ return (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)+Math.random().toString(36).slice(2)); }
function makeStudentCode(){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const part=n=>Array.from({length:n},()=>chars[Math.floor(Math.random()*chars.length)]).join('');
  return `MN-${part(4)}-${part(4)}-${part(4)}`;
}
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function today(){return new Date().toISOString().slice(0,10);}
function logo(){return `<img src="logo.jpg" alt="شعار مدرسة المنارة">`;}
function moneyLike(n){return Number(n||0).toLocaleString('ar');}
function statusBadge(s){const cls=s==='حاضر'?'present':s==='غائب'?'absent':'late'; return `<span class="badge ${cls}">${esc(s)}</span>`;}

function normalizeStudentCode(raw=''){
  let v=String(raw||'').trim();
  try{
    const u=new URL(v);
    const hp=new URLSearchParams((u.hash||'').replace(/^#/,''));
    v=u.searchParams.get('code')||u.searchParams.get('student_code')||hp.get('code')||hp.get('student_code')||v;
  }catch(_){}
  const upper=String(v||'').trim().toUpperCase();
  const m=upper.match(/MN-[A-Z0-9]{4}-[A-Z0-9]{4}(?:-[A-Z0-9]{4})?/);
  return m?m[0]:upper;
}
function studentPortalLink(code){
  // Fragment keeps the student code out of server logs and HTTP referrers.
  return `${PUBLIC_PARENT_PORTAL_URL}#code=${encodeURIComponent(String(code||'').trim().toUpperCase())}`;
}
function studentQrImageUrl(code){
  const payload=studentPortalLink(code);
  return `https://quickchart.io/qr?text=${encodeURIComponent(payload)}&size=320&margin=2&ecLevel=M&dark=0b4f2c&light=ffffff`;
}
function scanParentQr(){
  const msg=document.getElementById('portalMessage');
  if(isAndroidApp() && window.ManaraAndroid && typeof window.ManaraAndroid.scanStudentQr==='function'){
    if(msg)msg.innerHTML='<div class="message">افتح الكاميرا ووجّهها نحو QR الخاص بالطالب...</div>';
    try{window.ManaraAndroid.scanStudentQr();}catch(e){if(msg)msg.innerHTML='<div class="message error">تعذر فتح ماسح QR.</div>';}
    return;
  }
  if(msg)msg.innerHTML='<div class="message ok">على المتصفح: افتح كاميرا الهاتف العادية وامسح QR. سيفتح ملف الطالب مباشرة.</div>';
}
function chooseParentQrImage(){
  const msg=document.getElementById('portalMessage');
  if(isAndroidApp() && window.ManaraAndroid && typeof window.ManaraAndroid.chooseStudentQrImage==='function'){
    if(msg)msg.innerHTML='<div class="message">اختر صورة QR من الاستديو...</div>';
    try{window.ManaraAndroid.chooseStudentQrImage();}catch(e){if(msg)msg.innerHTML='<div class="message error">تعذر فتح الاستديو.</div>';}
    return;
  }
  if(msg)msg.innerHTML='<div class="message error">اختيار صورة QR من الجهاز متاح حالياً داخل تطبيق Android.</div>';
}
window.onManaraQrScanned=function(raw){
  const code=normalizeStudentCode(raw);
  const input=document.getElementById('portalCode');
  const msg=document.getElementById('portalMessage');
  if(!code || !code.startsWith('MN-')){
    if(msg)msg.innerHTML='<div class="message error">هذا QR ليس تابعاً لطالب في مدرسة المنارة.</div>';
    return;
  }
  if(input)input.value=code;
  findStudentPortal();
};
window.onManaraQrScanError=function(message){
  const msg=document.getElementById('portalMessage');
  if(msg)msg.innerHTML=`<div class="message error">${esc(message||'تعذر قراءة QR. حاول مرة أخرى.')}</div>`;
};
function safeFilePart(v='student'){
  return String(v||'student').trim().replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,'-').slice(0,70)||'student';
}
async function downloadStudentQr(id){
  const st=state.data?.students?.find(x=>x.id===id);
  if(!st?.access_code)return alert('لا يوجد كود للطالب.');
  const code=String(st.access_code).trim().toUpperCase();
  const payload=studentPortalLink(code);
  const filename=`QR-${safeFilePart(st.full_name)}-${code}.png`;
  if(isAndroidApp() && window.ManaraAndroid && typeof window.ManaraAndroid.downloadStudentQr==='function'){
    try{window.ManaraAndroid.downloadStudentQr(payload,filename);return;}catch(_){}
  }
  try{
    const res=await fetch(studentQrImageUrl(code),{cache:'no-store'}); if(!res.ok)throw new Error('download');
    const blob=await res.blob(); const url=URL.createObjectURL(blob); const a=document.createElement('a');
    a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  }catch(_){window.open(studentQrImageUrl(code),'_blank','noopener');}
}
window.onManaraQrDownloaded=function(){alert('تم حفظ QR الطالب في الجهاز.');};
window.onManaraQrDownloadError=function(m){alert(m||'تعذر حفظ QR.');};
function showStudentQr(id){
  const st=state.data?.students?.find(x=>x.id===id);
  if(!st || !st.access_code)return alert('لا يوجد كود للطالب.');
  const code=String(st.access_code).trim().toUpperCase();
  const qr=studentQrImageUrl(code);
  const link=studentPortalLink(code);
  document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="modal"><div class="modalbox" style="max-width:520px;text-align:center">
    <div class="row between"><div style="text-align:right"><h2 class="section-title">QR الطالب</h2><div class="muted">${esc(st.full_name||'')}</div></div><button class="btn outline" onclick="closeModal()">إغلاق</button></div>
    <div class="message ok" style="text-align:right">هذا الـ QR مرتبط بنفس كود الطالب، ولا ينشئ حساباً أو كوداً ثانياً.</div>
    <img src="${esc(qr)}" alt="QR الطالب" style="display:block;width:280px;height:280px;max-width:82vw;margin:18px auto;border:12px solid #fff;border-radius:18px;box-shadow:0 6px 24px #0002">
    <div class="code" style="font-size:20px;margin:10px 0">${esc(code)}</div>
    <div class="hint">عند مسح QR تفتح بوابة الطالب مباشرة. يمكنك تنزيله كصورة وإرساله لولي الأمر.</div>
    <div class="row" style="justify-content:center;margin-top:14px;flex-wrap:wrap">
      <button class="btn" onclick="downloadStudentQr('${st.id}')">⬇ تحميل QR</button>
      <button class="btn secondary" onclick="navigator.clipboard?.writeText('${esc(code)}');alert('تم نسخ كود الطالب')">نسخ الكود</button>
      <button class="btn outline" onclick="navigator.clipboard?.writeText('${esc(link)}');alert('تم نسخ رابط بوابة الطالب')">نسخ رابط الطالب</button>
    </div>
  </div></div>`);
}
function schoolStructureDemo(){
  const buildings=[
    {id:'b1',code:'B1',name:'الكتلة الأولى - البنات',audience:'بنات',total_rooms:11,notes:'تم تثبيت 11 غرفة. التوزيع الذي وصلنا يحدد 9 غرف، لذلك بقيت غرفتان غير مخصصتين.'},
    {id:'b2',code:'B2',name:'الكتلة الثانية',audience:'عام',total_rooms:13,notes:'تم تثبيت 13 غرفة. التوزيع المذكور يحدد 8 غرف، لذلك بقيت 5 غرف غير مخصصة.'},
    {id:'b3',code:'B3',name:'الكتلة الثالثة',audience:'عام',total_rooms:28,notes:'7 غرف أرضي + 8 غرف طابق أول + 13 غرفة طابق ثان.'}
  ];
  const floors=[
    {id:'b1_main',building_id:'b1',name:'الطابق الرئيسي',floor_order:0},
    {id:'b2_ground',building_id:'b2',name:'الطابق الأرضي',floor_order:0},
    {id:'b2_first',building_id:'b2',name:'الطابق الأول',floor_order:1},
    {id:'b3_ground',building_id:'b3',name:'الطابق الأرضي',floor_order:0},
    {id:'b3_first',building_id:'b3',name:'الطابق الأول',floor_order:1},
    {id:'b3_second',building_id:'b3',name:'الطابق الثاني',floor_order:2}
  ];
  const rooms=[];
  const add=(floor,prefix,grades)=>grades.forEach((grade,i)=>rooms.push({id:`${prefix}${i+1}`,floor_id:floor,code:`${prefix.toUpperCase()}-${String(i+1).padStart(2,'0')}`,name:`غرفة ${i+1}`,grade:grade||'',section_label:'',active:true}));
  add('b1_main','b1r',['التاسع','التاسع','البكالوريا','البكالوريا','البكالوريا','السابع','السابع','الثامن','الثامن','','']);
  add('b2_ground','b2g',['الأول','الأول','الأول','الأول']);
  add('b2_first','b2f',['الأول','الثاني','الثالث','الثالث','','','','','']);
  add('b3_ground','b3g',['البكالوريا','البكالوريا','التاسع','التاسع','التاسع','العاشر','الثامن']);
  add('b3_first','b3f',['الثالث','الثالث','الرابع','الرابع','الخامس','الخامس','السادس','السادس']);
  add('b3_second','b3s',['السابع','السابع','الثامن','السادس','السادس','الخامس','الخامس','الرابع','الرابع','','','','']);
  return {buildings,floors,rooms};
}
function defaultDemo(){
  const structure=schoolStructureDemo();
  return {
    settings:{school_name:'مدرسة المنارة الخاصة',school_name_en:'MANARA PRIVATE SCHOOL',established_year:'2007',phone:'',phone2:'',address:'',academic_year:'2026/2027'},
    students:[], attendance:[], grades:[], announcements:[], studentNotes:[], notifications:[],
    buildings:structure.buildings,floors:structure.floors,rooms:structure.rooms,teacherAssignments:[{teacher_id:'teacher_demo',room_id:'b1r1'}],
    subjects:[
      {id:'sub_math',name:'الرياضيات'},
      {id:'sub_en',name:'اللغة الإنكليزية'},
      {id:'sub_fr',name:'اللغة الفرنسية'},
      {id:'sub_ar',name:'اللغة العربية'},
      {id:'sub_sport',name:'رياضة'},
      {id:'sub_religion',name:'ديانة'},
      {id:'sub_physics',name:'فيزياء'},
      {id:'sub_chemistry',name:'كيمياء'},
      {id:'sub_sci',name:'علوم'},
      {id:'sub_social',name:'اجتماعيات'}
    ],
    teachers:[{id:'teacher_demo',full_name:'أستاذ تجريبي',username:'teacher1',email:'teacher1@demo.local',password:'Teacher@2026',active:true}],
    audit:[]
  };
}
function getDemo(){
  let d; try{d=JSON.parse(localStorage.getItem(DEMO_KEY)||'null');}catch(e){}
  if(!d) d=defaultDemo();
  const base=defaultDemo();
  d.settings ||= base.settings; d.students ||= []; d.attendance ||= []; d.grades ||= []; d.announcements ||= []; d.subjects ||= base.subjects; d.teachers ||= base.teachers; d.audit ||= [];
  d.buildings ||= base.buildings; d.floors ||= base.floors; d.rooms ||= base.rooms; d.studentNotes ||= []; d.notifications ||= []; d.teacherAssignments ||= base.teacherAssignments;
  return d;
}
function saveDemo(){ if(DEMO && state.data) localStorage.setItem(DEMO_KEY,JSON.stringify(state.data)); }
function audit(action,entity,details=''){
  if(DEMO){ state.data.audit.unshift({id:uid(),created_at:new Date().toISOString(),actor:state.user?.name||'النظام',action,entity,details}); state.data.audit=state.data.audit.slice(0,300); saveDemo(); }
}

async function init(){
  if(!DEMO){
    if(!CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY){ document.getElementById('app').innerHTML=setupError(); return; }
    if(!window.supabase || typeof window.supabase.createClient!=='function'){
      document.getElementById('app').innerHTML=`<div class="public-page"><div class="public-shell"><div class="auth-card"><h2>تعذر تشغيل التطبيق</h2><p>ملف Supabase المحلي غير موجود داخل APK. شغّل PREPARE_SUPABASE_JS.bat ثم أعد بناء التطبيق.</p></div></div></div>`;
      return;
    }
    sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY,{
      auth:{
        persistSession:true,
        autoRefreshToken:true,
        detectSessionInUrl:true,
        storage:window.localStorage
      }
    });
    sb.auth.onAuthStateChange((event,session)=>{
      if(event==='PASSWORD_RECOVERY'){
        state.user=null; state.role=null; state.screen='reset';
        setTimeout(render,0);
      }
    });
    const recoveryHint = new URLSearchParams(window.location.search).get('recovery')==='1' || window.location.hash.includes('type=recovery');
    const {data:{session}} = await sb.auth.getSession();
    if(recoveryHint){
      state.screen='reset';
    }else if(session){
      try{await establishSupabaseUser(session.user);}catch(e){state.screen='login';state.loginNotice=e.message||'';}
    }
  }else{
    state.data=getDemo();
    const s=JSON.parse(localStorage.getItem(DEMO_SESSION)||'null');
    if(s){state.user=s.user;state.role=s.role;state.screen='app';}
  }
  const hashParams=new URLSearchParams((window.location.hash||'').replace(/^#/,''));
  const initialCode=normalizeStudentCode(new URLSearchParams(window.location.search).get('code')||hashParams.get('code')||'');
  const savedParentCode=normalizeStudentCode(localStorage.getItem(PARENT_CODE_KEY)||'');
  const parentAutoCode=initialCode||(state.screen==='parent'?savedParentCode:'');
  if(parentAutoCode && parentAutoCode.startsWith('MN-')){
    state.screen='parent'; state.portal=null; render();
    setTimeout(()=>{
      const el=document.getElementById('portalCode'); if(el)el.value=parentAutoCode;
      try{ if(window.location.protocol.startsWith('http')) history.replaceState({},'',window.location.pathname); }catch(_){}
      findStudentPortal(true);
    },120);
  }else render();
}
function setupError(){return `<div class="public-page"><div class="public-shell"><div class="auth-card"><h2>إعداد قاعدة البيانات غير مكتمل</h2><p>ضع SUPABASE_URL و SUPABASE_ANON_KEY داخل <b>config.js</b> أو أعد DEMO_MODE إلى true.</p></div></div></div>`;}

function render(){
  const app=document.getElementById('app');
  if(state.screen==='parent') app.innerHTML=parentPage();
  else if(state.screen==='login') app.innerHTML=loginPage();
  else if(state.screen==='reset') app.innerHTML=resetPasswordPage();
  else if(state.screen==='mfa') app.innerHTML=mfaLoginPage();
  else if(state.screen==='mfa-enroll') app.innerHTML=mfaEnrollPage();
  else app.innerHTML=appPage();
  renderDesignerCredit();
  setTimeout(applyMobileUi,0);
}
function renderDesignerCredit(){
  const app=document.getElementById('app');if(!app)return;
  document.getElementById('manaraDesignerCredit')?.remove();
  app.insertAdjacentHTML('beforeend',`<div id="manaraDesignerCredit" style="position:fixed;left:8px;bottom:calc(env(safe-area-inset-bottom, 0px) + 6px);z-index:9999;font-size:10px;line-height:1.2;color:#365047;background:rgba(255,255,255,.78);border:1px solid rgba(11,107,58,.12);border-radius:8px;padding:4px 7px;box-shadow:0 2px 8px #0001;pointer-events:none;opacity:.78">تصميم التطبيق: الأستاذ عبد الغني العلي</div>`);
}
function applyMobileUi(){
  document.querySelectorAll('.table-wrap table').forEach(table=>{
    const labels=[...table.querySelectorAll('thead th')].map(th=>th.textContent.trim());
    table.querySelectorAll('tbody tr').forEach(tr=>{
      [...tr.children].forEach((td,i)=>{if(td.tagName==='TD')td.dataset.label=labels[i]||'';});
    });
  });
}
function goParent(){state.screen='parent';state.portal=null;render();}
function goLogin(){state.screen='login';render();}
function recoveryRedirectUrl(){
  if(isAndroidApp()) return 'manara://reset-password';
  if(window.location.protocol==='file:') return 'http://localhost:8080/index.html?recovery=1';
  const clean=window.location.href.split('#')[0].split('?')[0];
  return clean+'?recovery=1';
}
function authErrorArabic(message=''){
  const m=String(message||'').toLowerCase();
  if(m.includes('invalid login credentials')) return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
  if(m.includes('email not confirmed')) return 'البريد الإلكتروني غير مؤكد بعد.';
  if(m.includes('rate limit')) return 'تم إرسال محاولات كثيرة. انتظر قليلاً ثم أعد المحاولة.';
  if(m.includes('password should be')) return 'كلمة المرور الجديدة قصيرة. استخدم 8 أحرف على الأقل.';
  return message||'حدث خطأ غير متوقع.';
}
function toggleSidebar(force){
  state.sidebar = typeof force==='boolean' ? force : !state.sidebar;
  document.querySelector('.sidebar')?.classList.toggle('open',state.sidebar);
  document.querySelector('.drawer-backdrop')?.classList.toggle('show',state.sidebar);
}
function isAndroidApp(){return /ManaraAndroidApp/i.test(navigator.userAgent||'');}
function cachedUpdateConfig(){try{return JSON.parse(localStorage.getItem(UPDATE_CACHE_KEY)||'null');}catch(_){return null;}}
function saveUpdateConfig(v){try{localStorage.setItem(UPDATE_CACHE_KEY,JSON.stringify(v||{}));}catch(_){}}
function mandatoryUpdateHtml(cfg={}){
  const latest=esc(cfg.latest_version_name||'الإصدار الجديد');
  return `<div class="public-page"><div class="public-shell" style="max-width:560px"><div class="auth-card" style="margin-top:7vh;text-align:center">
    ${logo().replace('<img','<img style="width:105px;height:105px;border-radius:50%;object-fit:cover;margin-bottom:12px"')}
    <h2 style="margin-bottom:8px">يتوفر تحديث إلزامي للتطبيق</h2>
    <div class="message warning" style="text-align:right;line-height:1.9">تم إصدار <b>منارة العلم V${latest}</b>. يجب تحديث التطبيق قبل المتابعة لضمان عمل النظام والبيانات بشكل صحيح.</div>
    <div class="hint" style="margin:12px 0">الإصدار الموجود على جهازك: V${esc(APP_VERSION_LABEL)}</div>
    <button class="btn" style="width:100%;font-size:17px" onclick="openMandatoryAndroidUpdate()">⬇ تحميل التحديث الآن</button>
    <div class="hint" style="margin-top:12px">لن يتم حذف حسابك أو بياناتك عند تثبيت التحديث فوق النسخة الحالية.</div>
  </div></div></div>`;
}
function openMandatoryAndroidUpdate(){
  const cfg=cachedUpdateConfig()||{};
  const url=String(cfg.android_download_url||'https://github.com/abdoali07979-collab/manara-school/releases/latest/download/almanara-school.apk');
  try{window.location.href=url;}catch(_){window.open(url,'_blank','noopener');}
}
async function enforceMandatoryAndroidUpdate(){
  if(DEMO || !isAndroidApp() || !sb)return true;
  let cfg=cachedUpdateConfig();
  try{
    const {data,error}=await sb.from('app_update_config').select('latest_version_code,latest_version_name,minimum_version_code,force_update,android_download_url,updated_at').eq('id',1).maybeSingle();
    if(!error && data){cfg=data;saveUpdateConfig(data);}
  }catch(_){}
  const min=Number(cfg?.minimum_version_code||0);
  const forced=cfg?.force_update!==false;
  if(forced && min>APP_VERSION_CODE){document.getElementById('app').innerHTML=mandatoryUpdateHtml(cfg);return false;}
  return true;
}
if(isAndroidApp()) document.documentElement.classList.add('android-native');
let pendingParentPushCode='';
function requestAndroidParentPush(code){
  if(!isAndroidApp() || !code || DEMO)return;
  pendingParentPushCode=String(code).trim().toUpperCase();
  try{ window.ManaraAndroid?.enableParentPush(); }catch(e){}
}
window.onManaraFcmToken=async function(token){
  if(!token || !pendingParentPushCode || DEMO)return;
  try{
    const {data,error}=await sb.functions.invoke('parent-portal',{body:{action:'register_device',code:pendingParentPushCode,device_token:token,platform:'android'}});
    if(error)throw error;if(data?.error)throw new Error(data.error);
    localStorage.setItem(FCM_TOKEN_KEY,token);
    localStorage.setItem('manara_parent_push_code',pendingParentPushCode);
    localStorage.setItem('manara_parent_push_enabled','1');
    const el=document.getElementById('pushStatus'); if(el)el.innerHTML='<span class="badge active">🔔 إشعارات الهاتف مفعلة</span>';
  }catch(e){const el=document.getElementById('pushStatus');if(el)el.innerHTML='<span class="badge warning">تعذر تسجيل إشعارات الهاتف</span>';}
};
window.onManaraFcmPermissionDenied=function(){
  const el=document.getElementById('pushStatus');if(el)el.innerHTML='<span class="badge warning">يجب السماح بالإشعارات من الهاتف</span>';
};
window.onManaraFcmError=function(){
  const el=document.getElementById('pushStatus');if(el)el.innerHTML='<span class="badge warning">تعذر تفعيل إشعارات الهاتف</span>';
};

function brandLockup(){return `<div class="brand-lockup">${logo()}<div><b>${esc(state.data?.settings?.school_name||CFG.SCHOOL_NAME||'مدرسة المنارة الخاصة')}</b><small>${esc(state.data?.settings?.school_name_en||CFG.SCHOOL_NAME_EN||'MANARA PRIVATE SCHOOL')}</small></div></div>`;}
function parentPage(){
  return `<div class="public-page"><div class="public-shell">
    <div class="public-header">${brandLockup()}<button class="btn outline" onclick="goLogin()">دخول الإدارة / المدرسين</button></div>
    <div class="portal-grid">
      <section class="portal-hero">${logo()}<h1>بوابة ولي الأمر</h1><p>تابع حضور الطالب وغيابه وتأخيره ونتائجه وإعلانات المدرسة باستخدام الكود الخاص بالطالب.</p><div class="hint" style="color:#bcd4c5">الكود خاص بالطالب ولا يمنح صلاحية تعديل أي بيانات.</div></section>
      <section class="auth-card"><h2>عرض ملف الطالب</h2><p class="muted">اختر الطريقة الأسهل للدخول: اكتب كود الطالب أو امسح QR الخاص به.</p><div class="field"><label>كود الطالب</label><input id="portalCode" autocomplete="off" placeholder="MN-ABCD-2345" onkeydown="if(event.key==='Enter') findStudentPortal()"></div><div class="row" style="gap:10px;flex-wrap:wrap"><button class="btn" onclick="findStudentPortal()">عرض الملف</button><button class="btn secondary" onclick="scanParentQr()">📷 مسح QR</button><button class="btn secondary" onclick="chooseParentQrImage()">🖼️ اختيار صورة QR</button></div><div class="hint" style="margin-top:10px">QR يستخدم نفس كود الطالب الحالي؛ لا يوجد كود ثانٍ أو تسجيل جديد.</div><div id="portalMessage"></div></section>
    </div>
    <div id="portalResult" class="section">${state.portal?portalHtml(state.portal):''}</div>
  </div></div>`;
}
async function findStudentPortal(auto=false){
  const code=normalizeStudentCode(document.getElementById('portalCode')?.value||localStorage.getItem(PARENT_CODE_KEY)||'');
  const msg=document.getElementById('portalMessage');
  if(!code){if(msg)msg.innerHTML='<div class="message error">أدخل كود الطالب أولاً.</div>';return;}
  if(msg)msg.innerHTML='<div class="message">جاري البحث الآمن...</div>';
  try{
    let p;
    if(DEMO){
      const st=state.data.students.find(x=>x.access_code===code && x.active!==false);
      if(!st)throw new Error('الكود غير صحيح أو الطالب غير موجود.');
      p={student:st,attendance:state.data.attendance.filter(x=>x.student_id===st.id).sort((a,b)=>b.date.localeCompare(a.date)),grades:state.data.grades.filter(x=>x.student_id===st.id).sort((a,b)=>(b.date||'').localeCompare(a.date||'')),announcements:state.data.announcements.slice().reverse(),notes:state.data.studentNotes.filter(x=>x.student_id===st.id&&x.visible_to_parent!==false).sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||'')),notifications:state.data.notifications.filter(x=>x.student_id===st.id).sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||'')),settings:state.data.settings||{}};
    }else{
      const {data,error}=await sb.functions.invoke('parent-portal',{body:{action:'get',code}});
      if(error)throw error;if(data?.error)throw new Error(data.error);p=data?.portal;
      if(!p?.student)throw new Error('الكود غير صحيح أو الطالب غير موجود.');
    }
    localStorage.setItem(PARENT_CODE_KEY,code);
    state.portal=p; render();
    if(isAndroidApp())setTimeout(()=>requestAndroidParentPush(code),150);
    if(!auto)setTimeout(()=>document.getElementById('portalResult')?.scrollIntoView({behavior:'smooth'}),30);
  }catch(e){if(msg)msg.innerHTML=`<div class="message error">${esc(authErrorArabic(e.message||'تعذر العثور على الطالب.'))}</div>`;}
}
function portalHtml(p){
  const s=p.student||{}, at=p.attendance||[], gr=p.grades||[], notes=p.notes||[], notifications=p.notifications||[];
  const present=at.filter(x=>x.status==='حاضر').length, absent=at.filter(x=>x.status==='غائب').length, late=at.filter(x=>x.status==='متأخر').length;
  const avg=gr.length?(gr.reduce((a,g)=>a+(Number(g.score)/(Number(g.max_score||g.max||100))*100),0)/gr.length).toFixed(1):'—';
  const unread=notifications.filter(n=>!n.seen_at).length;
  const pst=p.settings||{},phone1=String(pst.phone||'').trim(),phone2=String(pst.phone2||'').trim();
  const phoneCard=(phone1||phone2)?`<div class="section"><div class="card"><h3 style="margin-top:0">التواصل مع مدير مدرسة منارة العلم الخاصة</h3><div class="row" style="gap:10px;flex-wrap:wrap">${phone1?`<a class="btn secondary" href="tel:${esc(phone1)}">📞 ${esc(phone1)}</a>`:''}${phone2?`<a class="btn secondary" href="tel:${esc(phone2)}">📞 ${esc(phone2)}</a>`:''}</div></div></div>`:'';
  setTimeout(()=>notifyParentDevice(notifications.filter(n=>!n.seen_at)),80);
  return `<div class="public-card"><div class="student-banner"><div class="student-avatar">${esc((s.full_name||'ط')[0])}</div><div><h2 style="margin:0">${esc(s.full_name)}</h2><div class="muted">الصف ${esc(s.grade||'—')} — الشعبة ${esc(s.class_name||'—')}</div><div class="hint">اسم الجد: ${esc(s.grandfather_name||'—')} ${s.location_label?`— ${esc(s.location_label)}`:''}</div></div>${unread?`<span class="notification-count">${unread} جديد</span>`:''}</div>
  <div class="portal-actions section">${isAndroidApp()?'<span id="pushStatus"><button class="btn secondary" onclick="requestAndroidParentPush(localStorage.getItem(\'manara_parent_push_code\')||pendingParentPushCode)">🔔 تفعيل إشعارات الهاتف</button></span>':'<button class="btn secondary" onclick="enableParentNotifications()">🔔 تفعيل إشعارات المتصفح</button>'}${unread?'<button class="btn outline" onclick="markPortalNotificationsSeen()">تحديد الإشعارات كمقروءة</button>':''}<button class="btn danger" onclick="logoutParentPortal()">تسجيل الخروج</button></div>
  ${notes.length?`<div class="section"><div class="row between"><h3>ملاحظات الطالب</h3><span class="badge warning">تصل مباشرة على كود الطالب</span></div>${notes.map(n=>`<div class="student-note ${n.importance==='مهم'?'important':''}"><div class="row between"><b>${esc(n.title||'ملاحظة من المدرسة')}</b><small>${esc((n.created_at||'').slice(0,10))}</small></div><div>${esc(n.content)}</div>${n.image_url?`<a href="${esc(n.image_url)}" target="_blank" rel="noopener"><img src="${esc(n.image_url)}" alt="صورة مرفقة بالملاحظة" style="display:block;width:100%;max-width:520px;max-height:520px;object-fit:contain;border-radius:16px;margin-top:12px;background:#f3f5f4"></a>`:''}<small class="muted">${esc(n.category||'ملاحظة عامة')}</small></div>`).join('')}</div>`:''}
  <div class="portal-kpis section"><div class="card"><span class="muted">الحضور</span><strong>${present}</strong></div><div class="card"><span class="muted">الغياب</span><strong>${absent}</strong></div><div class="card"><span class="muted">التأخير</span><strong>${late}</strong></div><div class="card"><span class="muted">المعدل</span><strong>${avg}${avg==='—'?'':'%'}</strong></div></div>
  <div class="section"><h3>النتائج</h3><div class="table-wrap"><table><thead><tr><th>المادة</th><th>الاختبار</th><th>التاريخ</th><th>العلامة</th></tr></thead><tbody>${gr.map(g=>`<tr><td>${esc(g.subject_name||g.subject||'')}</td><td>${esc(g.exam_name||g.exam||'')}</td><td>${esc(g.date||'—')}</td><td>${esc(g.score)}/${esc(g.max_score||g.max||100)}</td></tr>`).join('')||'<tr><td colspan="4" class="empty">لا توجد نتائج بعد</td></tr>'}</tbody></table></div></div>
  <div class="section"><h3>الحضور والغياب والتأخير</h3><div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>الحالة</th><th>دقائق التأخير</th><th>ملاحظة</th></tr></thead><tbody>${at.map(a=>`<tr><td>${esc(a.date)}</td><td>${statusBadge(a.status)}</td><td>${esc(a.late_minutes||0)}</td><td>${esc(a.note||'—')}</td></tr>`).join('')||'<tr><td colspan="4" class="empty">لا يوجد سجل حتى الآن</td></tr>'}</tbody></table></div></div>
  ${phoneCard}
  <div class="section"><h3>إعلانات المدرسة</h3>${(p.announcements||[]).map(a=>`<div class="notice"><b>${esc(a.title)}</b><div>${esc(a.content)}</div><small class="muted">${esc(a.created_date||a.date||'')}</small></div>`).join('')||'<div class="empty">لا توجد إعلانات</div>'}</div></div>`;
}
async function enableParentNotifications(){
  if(!('Notification' in window))return alert('هذا الجهاز لا يدعم إشعارات المتصفح.');
  const permission=await Notification.requestPermission();
  alert(permission==='granted'?'تم تفعيل إشعارات الجهاز.':'لم يتم السماح بالإشعارات.');
}
function notifyParentDevice(items){
  if(!items?.length || !('Notification' in window) || Notification.permission!=='granted')return;
  const n=items[0]; try{new Notification(n.title||'مدرسة المنارة',{body:n.body||'لديك ملاحظة جديدة تخص الطالب.',icon:'logo.jpg'});}catch(e){}
}
async function markPortalNotificationsSeen(){
  if(!state.portal?.student)return;
  const code=normalizeStudentCode(localStorage.getItem(PARENT_CODE_KEY)||document.getElementById('portalCode')?.value||'');
  if(DEMO){const sid=state.portal.student.id;state.data.notifications.filter(n=>n.student_id===sid).forEach(n=>n.seen_at=n.seen_at||new Date().toISOString());saveDemo();state.portal.notifications=state.data.notifications.filter(n=>n.student_id===sid);render();return;}
  try{
    const {data,error}=await sb.functions.invoke('parent-portal',{body:{action:'mark_seen',code}});if(error)throw error;if(data?.error)throw new Error(data.error);
    const fresh=await sb.functions.invoke('parent-portal',{body:{action:'get',code}});if(fresh.error)throw fresh.error;state.portal=fresh.data?.portal;render();
  }catch(e){alert(authErrorArabic(e.message));}
}
async function logoutParentPortal(){
  const code=normalizeStudentCode(localStorage.getItem(PARENT_CODE_KEY)||'');
  const token=localStorage.getItem(FCM_TOKEN_KEY)||'';
  try{if(!DEMO&&code&&token)await sb.functions.invoke('parent-portal',{body:{action:'unregister_device',code,device_token:token}});}catch(_){}
  localStorage.removeItem(PARENT_CODE_KEY);localStorage.removeItem('manara_parent_push_code');localStorage.removeItem('manara_parent_push_enabled');localStorage.removeItem(FCM_TOKEN_KEY);
  pendingParentPushCode='';state.portal=null;state.screen='parent';render();
}
function strongPassword(p=''){return String(p).length>=10 && /[A-Za-z\u0600-\u06FF]/.test(p) && /[0-9]/.test(p) && /[^A-Za-z0-9\u0600-\u06FF]/.test(p);}
function teacherPasswordValid(p=''){return String(p||'').length>=6;}
function loginPage(){
  const notice=state.loginNotice?`<div class="message ok">${esc(state.loginNotice)}</div>`:'';
  state.loginNotice='';
  const savedLogin=DEMO?'admin':(localStorage.getItem(LOGIN_EMAIL_KEY)||'');
  const rememberLogin=localStorage.getItem(LOGIN_REMEMBER_KEY)!=='0';
  return `<div class="public-page"><div class="public-shell" style="max-width:520px"><div class="auth-card" style="margin-top:6vh;text-align:center">${logo().replace('<img','<img style="width:100px;height:100px;border-radius:50%;object-fit:cover;margin-bottom:10px"')}<h2>دخول النظام</h2><p class="muted">للإدارة والمدرسين المصرح لهم فقط</p>
  ${DEMO?'<div class="role-note">تجربة: الإدارة admin / Almanara@2026 — المدرس teacher1 / Teacher@2026</div>':''}
  ${notice}<div id="loginMsg"></div>
  <div class="field" style="text-align:right"><label>${DEMO?'اسم المستخدم':'البريد الإلكتروني'}</label><input id="loginUser" type="${DEMO?'text':'email'}" autocomplete="username" value="${esc(savedLogin)}"></div>
  <div class="field" style="text-align:right"><label>كلمة المرور</label><input id="loginPass" type="password" autocomplete="current-password" onkeydown="if(event.key==='Enter') doLogin()"></div>
  ${!DEMO?`<label style="display:flex;align-items:center;gap:10px;justify-content:flex-start;margin:8px 0 14px;cursor:pointer;text-align:right">
    <input id="rememberLogin" type="checkbox" ${rememberLogin?'checked':''} style="width:20px;height:20px">
    <span><b>حفظ تسجيل الدخول على هذا الجهاز</b><br><span class="muted" style="font-size:13px">بعد أول دخول لن تحتاج لكتابة البريد وكلمة المرور كل مرة، إلا إذا ضغطت «تسجيل الخروج».</span></span>
  </label>`:''}
  <div class="row" style="justify-content:center;gap:8px"><button class="btn" onclick="doLogin()">دخول</button><button class="btn outline" onclick="goParent()">بوابة الأهل</button></div>${!DEMO?'<button class="link-button" onclick="forgotPassword()">نسيت كلمة المرور؟</button>':''}</div></div></div>`;
}
async function doLogin(){
  const u=document.getElementById('loginUser').value.trim(), p=document.getElementById('loginPass').value, msg=document.getElementById('loginMsg');
  if(!u||!p){msg.innerHTML='<div class="message error">أدخل البريد الإلكتروني وكلمة المرور.</div>';return;}
  msg.innerHTML='<div class="message">جاري تسجيل الدخول...</div>';
  try{
    if(DEMO){
      if(u==='admin'&&p==='Almanara@2026'){state.user={id:'admin',name:'مدير النظام',username:'admin'};state.role='admin';}
      else{const t=state.data.teachers.find(x=>x.username===u&&x.password===p&&x.active!==false);if(!t)throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة.');state.user={id:t.id,name:t.full_name,username:t.username};state.role='teacher';}
      localStorage.setItem(DEMO_SESSION,JSON.stringify({user:state.user,role:state.role}));state.screen='app';state.tab='home';audit('تسجيل دخول','الحساب',state.role);render();
    }else{
      const remember=document.getElementById('rememberLogin')?.checked!==false;
      const {data,error}=await sb.auth.signInWithPassword({email:u,password:p}); if(error)throw error;
      if(remember){
        localStorage.setItem(LOGIN_EMAIL_KEY,u);
        localStorage.setItem(LOGIN_REMEMBER_KEY,'1');
      }else{
        localStorage.removeItem(LOGIN_EMAIL_KEY);
        localStorage.setItem(LOGIN_REMEMBER_KEY,'0');
      }
      await establishSupabaseUser(data.user); render();
    }
  }catch(e){msg.innerHTML=`<div class="message error">${esc(authErrorArabic(e.message))}</div>`;}
}
async function forgotPassword(){
  const email=document.getElementById('loginUser')?.value.trim();
  const msg=document.getElementById('loginMsg');
  if(window.location.protocol==='file:'&&!isAndroidApp()){
    msg.innerHTML='<div class="message error"><b>شغّل التطبيق عبر localhost أولاً.</b><br>لا تستخدم فتح index.html مباشرة من القرص. استخدم START_ALMANARA.bat الموجود داخل المجلد.</div>';
    return;
  }
  if(!email){msg.innerHTML='<div class="message error">اكتب بريدك الإلكتروني أولاً ثم اضغط «نسيت كلمة المرور؟».</div>';return;}
  msg.innerHTML='<div class="message">جاري إرسال رابط الاستعادة...</div>';
  try{
    const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:recoveryRedirectUrl()});
    if(error)throw error;
    msg.innerHTML='<div class="message ok"><b>تم إرسال رابط الاستعادة.</b><br>افتح بريدك الإلكتروني واضغط الرابط ثم اكتب كلمة المرور الجديدة. افحص مجلد Spam إذا لم تجد الرسالة.</div>';
  }catch(e){msg.innerHTML=`<div class="message error">${esc(authErrorArabic(e.message))}</div>`;}
}
function resetPasswordPage(){
  return `<div class="public-page"><div class="public-shell" style="max-width:520px"><div class="auth-card" style="margin-top:6vh;text-align:center">${logo().replace('<img','<img style="width:100px;height:100px;border-radius:50%;object-fit:cover;margin-bottom:10px"')}<h2>تعيين كلمة مرور جديدة</h2><p class="muted">اكتب كلمة مرور جديدة لحساب مدرسة المنارة.</p><div id="resetMsg"></div><div class="field" style="text-align:right"><label>كلمة المرور الجديدة</label><input id="newPass" type="password" autocomplete="new-password"></div><div class="field" style="text-align:right"><label>تأكيد كلمة المرور</label><input id="newPass2" type="password" autocomplete="new-password" onkeydown="if(event.key==='Enter') saveNewPassword()"></div><button class="btn" onclick="saveNewPassword()">حفظ كلمة المرور</button></div></div></div>`;
}
async function saveNewPassword(){
  const p1=document.getElementById('newPass').value,p2=document.getElementById('newPass2').value,msg=document.getElementById('resetMsg');
  if(p1.length<8){msg.innerHTML='<div class="message error">استخدم كلمة مرور من 8 أحرف على الأقل.</div>';return;}
  if(p1!==p2){msg.innerHTML='<div class="message error">كلمتا المرور غير متطابقتين.</div>';return;}
  msg.innerHTML='<div class="message">جاري حفظ كلمة المرور...</div>';
  try{
    const {error}=await sb.auth.updateUser({password:p1}); if(error)throw error;
    await sb.auth.signOut();
    history.replaceState({},document.title,window.location.pathname);
    state.user=null;state.role=null;state.screen='login';state.loginNotice='تم تغيير كلمة المرور بنجاح. سجل الدخول بكلمة المرور الجديدة.';render();
  }catch(e){msg.innerHTML=`<div class="message error">${esc(authErrorArabic(e.message))}</div>`;}
}
async function completeSupabaseUser(user,profile){
  state.pendingAuthUser=null;state.pendingAuthProfile=null;state.mfaEnroll=null;
  state.user={id:user.id,name:profile.full_name||user.email,email:user.email};state.role=profile.role;state.screen='app';state.tab='home';await loadSupabaseData();
}
async function establishSupabaseUser(user){
  const {data:profile,error}=await sb.from('profiles').select('id,full_name,role,active').eq('id',user.id).single();
  if(error||!profile||!profile.active){await sb.auth.signOut();throw new Error('هذا الحساب غير فعال أو غير مصرح له.');}
  if(profile.role==='admin'){
    const [{data:aal,error:aalErr},{data:factors,error:fErr}]=await Promise.all([sb.auth.mfa.getAuthenticatorAssuranceLevel(),sb.auth.mfa.listFactors()]);
    if(aalErr||fErr)throw (aalErr||fErr);
    const verified=[...(factors?.totp||[]),...(factors?.phone||[])].filter(f=>f.status==='verified');
    state.pendingAuthUser=user;state.pendingAuthProfile=profile;
    if(!verified.length){state.screen='mfa-enroll';return;}
    if(aal?.currentLevel!=='aal2'){state.screen='mfa';return;}
  }
  await completeSupabaseUser(user,profile);
}
function mfaLoginPage(){
  return `<div class="public-page"><div class="public-shell" style="max-width:520px"><div class="auth-card" style="margin-top:6vh;text-align:center">${logo().replace('<img','<img style="width:100px;height:100px;border-radius:50%;object-fit:cover;margin-bottom:10px"')}<h2>التحقق بخطوتين</h2><p class="muted">افتح تطبيق المصادقة وأدخل الرمز المكوّن من 6 أرقام. هذه الخطوة إلزامية لحساب الإدارة.</p><div id="mfaMsg"></div><div class="field" style="text-align:right"><label>رمز التحقق</label><input id="mfaCode" inputmode="numeric" maxlength="8" autocomplete="one-time-code" onkeydown="if(event.key==='Enter') verifyAdminMfaLogin()"></div><button class="btn" onclick="verifyAdminMfaLogin()">تحقق ودخول</button><button class="link-button" onclick="logout()">تسجيل الخروج</button></div></div></div>`;
}
async function verifyAdminMfaLogin(){
  const code=document.getElementById('mfaCode')?.value.trim(),msg=document.getElementById('mfaMsg');if(!code){msg.innerHTML='<div class="message error">أدخل رمز التحقق.</div>';return;}
  try{const {data:f}=await sb.auth.mfa.listFactors();const factor=[...(f?.totp||[]),...(f?.phone||[])].find(x=>x.status==='verified');if(!factor)throw new Error('لا يوجد عامل تحقق مفعل.');const {error}=await sb.auth.mfa.challengeAndVerify({factorId:factor.id,code});if(error)throw error;await completeSupabaseUser(state.pendingAuthUser,state.pendingAuthProfile);render();}catch(e){msg.innerHTML=`<div class="message error">${esc(authErrorArabic(e.message))}</div>`;}
}
function mfaEnrollPage(){
  const e=state.mfaEnroll;
  return `<div class="public-page"><div class="public-shell" style="max-width:620px"><div class="auth-card" style="margin-top:4vh;text-align:center">${logo().replace('<img','<img style="width:95px;height:95px;border-radius:50%;object-fit:cover;margin-bottom:10px"')}<h2>حماية حساب الإدارة</h2><div class="message warning" style="text-align:right">لأعلى حماية، التحقق بخطوتين إلزامي للإدارة. استخدم Google Authenticator أو Microsoft Authenticator أو أي تطبيق TOTP.</div><div id="mfaEnrollMsg"></div>${e?`<img src="${esc(e.qr)}" alt="QR التحقق" style="width:240px;max-width:80%;background:#fff;padding:12px;border-radius:16px"><div class="field" style="text-align:right"><label>المفتاح اليدوي — احتفظ به بمكان آمن</label><input readonly value="${esc(e.secret)}" onclick="this.select()"></div><div class="field" style="text-align:right"><label>الرمز من تطبيق المصادقة</label><input id="mfaEnrollCode" inputmode="numeric" maxlength="8" autocomplete="one-time-code"></div><button class="btn" onclick="verifyAdminMfaEnrollment()">تفعيل الحماية والدخول</button>`:`<button class="btn" onclick="startAdminMfaEnrollment()">إنشاء QR التحقق</button>`}<button class="link-button" onclick="logout()">إلغاء وتسجيل الخروج</button></div></div></div>`;
}
async function startAdminMfaEnrollment(){
  const msg=document.getElementById('mfaEnrollMsg');try{const {data,error}=await sb.auth.mfa.enroll({factorType:'totp',friendlyName:'Manara Admin'});if(error)throw error;state.mfaEnroll={id:data.id,qr:data.totp?.qr_code||'',secret:data.totp?.secret||''};render();}catch(e){if(msg)msg.innerHTML=`<div class="message error">${esc(authErrorArabic(e.message))}</div>`;}
}
async function verifyAdminMfaEnrollment(){
  const code=document.getElementById('mfaEnrollCode')?.value.trim(),msg=document.getElementById('mfaEnrollMsg');if(!code||!state.mfaEnroll?.id){if(msg)msg.innerHTML='<div class="message error">أدخل الرمز من تطبيق المصادقة.</div>';return;}
  try{const {error}=await sb.auth.mfa.challengeAndVerify({factorId:state.mfaEnroll.id,code});if(error)throw error;await completeSupabaseUser(state.pendingAuthUser,state.pendingAuthProfile);render();}catch(e){if(msg)msg.innerHTML=`<div class="message error">${esc(authErrorArabic(e.message))}</div>`;}
}
async function logout(){ if(DEMO){localStorage.removeItem(DEMO_SESSION);}else if(sb){await sb.auth.signOut();} state.user=null;state.role=null;state.screen='parent';state.portal=null;render(); }

function storagePathFromLegacyUrl(url=''){
  const s=String(url||'');const key='/student-note-images/';const i=s.indexOf(key);return i>=0?decodeURIComponent(s.slice(i+key.length).split('?')[0]):'';
}
async function hydrateNoteImages(notes=[]){
  if(DEMO||!sb)return notes;
  return await Promise.all(notes.map(async n=>{const path=n.image_path||storagePathFromLegacyUrl(n.image_url);if(!path)return {...n,image_url:''};try{const {data,error}=await sb.storage.from('student-note-images').createSignedUrl(path,3600);return {...n,image_path:path,image_url:error?'':(data?.signedUrl||'')};}catch(_){return {...n,image_path:path,image_url:''};}}));
}
async function loadSupabaseData(){
  if(DEMO)return;
  if(state.role==='admin'){
    const [st,at,gr,an,su,pr,se,au,bu,fl,ro,sn,pn,ta]=await Promise.all([
      sb.from('students').select('*,rooms(id,code,name,grade,section_label,floor_id,floors(name,building_id,buildings(name)))').order('created_at',{ascending:false}),
      sb.from('attendance').select('*').order('date',{ascending:false}).limit(2000),
      sb.from('grades').select('*,grade_items(title,max_score,exam_date,subjects(name))').order('created_at',{ascending:false}).limit(2000),
      sb.from('announcements').select('*').order('created_at',{ascending:false}),
      sb.from('subjects').select('*').order('name'),
      sb.from('profiles').select('id,full_name,role,active,created_at').eq('role','teacher').order('created_at',{ascending:false}),
      sb.from('school_settings').select('*').limit(1).maybeSingle(),
      sb.from('audit_logs').select('*').order('created_at',{ascending:false}).limit(300),
      sb.from('buildings').select('*').order('code'),
      sb.from('floors').select('*').order('floor_order'),
      sb.from('rooms').select('*').order('room_order'),
      sb.from('student_notes').select('*').order('created_at',{ascending:false}).limit(1000),
      sb.from('parent_notifications').select('*').order('created_at',{ascending:false}).limit(1000),
      sb.from('teacher_room_assignments').select('*')
    ]);
    const students=(st.data||[]).map(x=>({...x,room_name:x.rooms?.name,room_code:x.rooms?.code,floor_name:x.rooms?.floors?.name,building_name:x.rooms?.floors?.buildings?.name,location_label:x.rooms?`${x.rooms?.floors?.buildings?.name||''} / ${x.rooms?.name||''}`:''}));
    state.data={students,attendance:at.data||[],grades:(gr.data||[]).map(x=>({...x,exam_name:x.grade_items?.title,max_score:x.grade_items?.max_score,date:x.grade_items?.exam_date,subject_name:x.grade_items?.subjects?.name})),announcements:an.data||[],subjects:su.data||[],teachers:pr.data||[],settings:se.data||{},audit:au.data||[],buildings:bu.data||[],floors:fl.data||[],rooms:ro.data||[],studentNotes:await hydrateNoteImages(sn.data||[]),notifications:pn.data||[],teacherAssignments:ta.data||[]};
  }else{
    const [st,at,se,bu,fl,ro,sn,ta]=await Promise.all([
      sb.from('students').select('*,rooms(id,code,name,grade,section_label,floor_id,floors(name,building_id,buildings(name)))').order('created_at',{ascending:false}),
      sb.from('attendance').select('*').order('date',{ascending:false}).limit(2000),
      sb.from('school_settings').select('*').limit(1).maybeSingle(),
      sb.from('buildings').select('*').order('code'),
      sb.from('floors').select('*').order('floor_order'),
      sb.from('rooms').select('*').order('room_order'),
      sb.from('student_notes').select('*').order('created_at',{ascending:false}).limit(1000),
      sb.from('teacher_room_assignments').select('*').eq('teacher_id',state.user.id)
    ]);
    const teacherAssignments=ta.data||[];
    const allowedRooms=new Set(teacherAssignments.map(x=>x.room_id));
    const students=(st.data||[]).map(x=>({...x,room_name:x.rooms?.name,room_code:x.rooms?.code,floor_name:x.rooms?.floors?.name,building_name:x.rooms?.floors?.buildings?.name,location_label:x.rooms?`${x.rooms?.floors?.buildings?.name||''} / ${x.rooms?.name||''}`:''})).filter(x=>allowedRooms.has(x.room_id));
    const allowedStudentIds=new Set(students.map(x=>x.id));
    const attendance=(at.data||[]).filter(x=>allowedStudentIds.has(x.student_id));
    const teacherNotes=(sn.data||[]).filter(x=>allowedStudentIds.has(x.student_id));
    state.data={students,attendance,grades:[],announcements:[],subjects:[],teachers:[],settings:se.data||{},audit:[],buildings:bu.data||[],floors:fl.data||[],rooms:ro.data||[],studentNotes:await hydrateNoteImages(teacherNotes),notifications:[],teacherAssignments};
  }
}
function navItems(){
  if(state.role==='teacher') return [['home','⌂','الرئيسية'],['students','♟','طلابي'],['attendance','✓','الحضور والغياب'],['notes','✎','ملاحظات الطلاب']];
  return [['home','⌂','الرئيسية'],['buildings','▦','الصفوف والشعب'],['students','♟','الطلاب'],['attendance','✓','الحضور والغياب'],['notes','✎','ملاحظات الطلاب'],['grades','▤','النتائج'],['announcements','◉','الإعلانات'],['teachers','♙','المدرسون'],['audit','≡','سجل العمليات'],['settings','⚙','الإعدادات']];
}
function appPage(){
  const labels={home:'الرئيسية',buildings:'الصفوف والشعب',students:'الطلاب',attendance:'الحضور والغياب',notes:'ملاحظات الطلاب',grades:'النتائج',announcements:'الإعلانات',teachers:'إدارة المدرسين',audit:'سجل العمليات',settings:'الإعدادات'};
  if(state.role==='teacher'&&!['home','students','attendance','notes'].includes(state.tab))state.tab='home';
  return `<div class="app-shell"><aside class="sidebar ${state.sidebar?'open':''}"><div class="side-brand">${logo()}<div><b>${esc(state.data?.settings?.school_name||'مدرسة المنارة الخاصة')}</b><small>MANARA PRIVATE SCHOOL</small></div><button class="drawer-close" onclick="toggleSidebar(false)" aria-label="إغلاق">×</button></div><div class="user-card"><b>${esc(state.user?.name||'')}</b><small>${state.role==='admin'?'مدير النظام — تحكم كامل':'مدرس — طلاب + حضور + ملاحظات للأهل'}</small></div><div class="side-label">القائمة الرئيسية</div><nav class="side-nav">${navItems().map(n=>`<button class="${state.tab===n[0]?'active':''}" onclick="setTab('${n[0]}')"><i class="nav-icon">${n[1]}</i>${n[2]}</button>`).join('')}</nav><div class="side-label" style="margin-top:16px">الحساب</div><nav class="side-nav"><button onclick="goParent()"><i class="nav-icon">◫</i>معاينة بوابة الأهل</button><button onclick="logout()"><i class="nav-icon">↪</i>تسجيل الخروج</button></nav></aside><div class="drawer-backdrop ${state.sidebar?'show':''}" onclick="toggleSidebar(false)"></div>
  <main class="main"><header class="topbar"><div class="row"><button class="btn outline mobile-menu" onclick="toggleSidebar()">☰</button><div class="page-title"><b>${labels[state.tab]||''}</b><small>${state.role==='admin'?'لوحة الإدارة الرئيسية':'إدارة الطلاب والحضور والملاحظات ضمن الشعب المخصصة'}</small></div></div><img class="top-logo" src="logo.jpg" alt=""><div class="top-actions"><span class="badge ${state.role}">${state.role==='admin'?'الإدارة':'مدرس'}</span></div></header><section class="content"><img class="content-watermark" src="logo.jpg" alt="">${pageContent()}</section></main></div>`;
}
function setTab(t){state.tab=t;state.sidebar=false;render();}
function pageContent(){ const fn=window[`page_${state.tab}`]; return fn?fn():'<div class="card">الصفحة غير موجودة</div>'; }

function page_home(){
  const d=state.data||{}, at=(d.attendance||[]).filter(x=>x.date===today());
  if(state.role==='teacher'){
    return `<div class="role-note">صلاحيتك محصورة بالشعب التي حددتها الإدارة. تستطيع إضافة طلاب جدد إلى شعبك وتسجيل الحضور والغياب والتأخير وإرسال ملاحظات على طلابك إلى أولياء الأمور، ولا تستطيع تغيير الشعب المخصصة لك أو تعديل إعدادات المدرسة.</div><div class="kpi-grid section"><div class="card kpi"><div><b>الطلاب المسموحون</b><strong>${d.students?.length||0}</strong></div><div class="kpi-icon">♟</div></div><div class="card kpi"><div><b>غائب اليوم</b><strong>${at.filter(x=>x.status==='غائب').length}</strong></div><div class="kpi-icon">×</div></div><div class="card kpi"><div><b>متأخر اليوم</b><strong>${at.filter(x=>x.status==='متأخر').length}</strong></div><div class="kpi-icon">⏱</div></div><div class="card kpi"><div><b>سجلات اليوم</b><strong>${at.length}</strong></div><div class="kpi-icon">✓</div></div></div><div class="card section"><div class="row between"><div><h3 class="section-title">التسجيل اليومي</h3><div class="muted">انتقل إلى صفحة الغياب والتأخير لتسجيل الحالات.</div></div><button class="btn" onclick="setTab('attendance')">فتح سجل اليوم</button></div></div>`;
  }
  const gr=d.grades||[], unread=(d.notifications||[]).filter(n=>!n.seen_at).length;
  const blocks=(d.buildings||[]).map(b=>{const fs=d.floors.filter(f=>f.building_id===b.id),rs=d.rooms.filter(r=>fs.some(f=>f.id===r.floor_id)),st=d.students.filter(s=>rs.some(r=>r.id===s.room_id)).length;return `<tr><td><b>${esc(b.name)}</b></td><td>${rs.length}</td><td>${rs.filter(r=>r.grade).length}</td><td>${st}</td><td><button class="btn small secondary" onclick="setTab('buildings')">فتح</button></td></tr>`}).join('');
  return `<div class="kpi-grid"><div class="card kpi"><div><b>إجمالي الطلاب</b><strong>${moneyLike(d.students?.length)}</strong></div><div class="kpi-icon">♟</div></div><div class="card kpi"><div><b>حاضر اليوم</b><strong>${at.filter(x=>x.status==='حاضر').length}</strong></div><div class="kpi-icon">✓</div></div><div class="card kpi"><div><b>غائب / متأخر</b><strong>${at.filter(x=>x.status==='غائب'||x.status==='متأخر').length}</strong></div><div class="kpi-icon">⏱</div></div><div class="card kpi"><div><b>إشعارات أهل غير مقروءة</b><strong>${unread}</strong></div><div class="kpi-icon">🔔</div></div></div>
  <div class="two-col section"><div class="card"><div class="row between"><h3 class="section-title">الأقسام والصفوف</h3><button class="btn small secondary" onclick="setTab('buildings')">إدارة الصفوف والشعب</button></div><div class="table-wrap"><table><thead><tr><th>القسم</th><th>الشعب</th><th>المحددة</th><th>الطلاب</th><th></th></tr></thead><tbody>${blocks}</tbody></table></div></div><div class="card"><h3 class="section-title">ملخص النظام</h3><div class="stack"><div class="row between"><span>المدرسون النشطون</span><b>${(d.teachers||[]).filter(t=>t.active!==false).length}</b></div><div class="row between"><span>ملاحظات الطلاب</span><b>${(d.studentNotes||[]).length}</b></div><div class="row between"><span>النتائج المسجلة</span><b>${gr.length}</b></div><div class="row between"><span>السنة الدراسية</span><b>${esc(d.settings?.academic_year||'—')}</b></div></div></div></div>
  <div class="card section"><div class="row between"><h3 class="section-title">آخر الطلاب المضافين</h3><button class="btn small secondary" onclick="setTab('students')">عرض الكل</button></div><div class="table-wrap"><table><thead><tr><th>الطالب</th><th>اسم الجد</th><th>الصف</th><th>الموقع</th><th>الكود</th></tr></thead><tbody>${(d.students||[]).slice(0,8).map(s=>`<tr><td><b>${esc(s.full_name)}</b></td><td>${esc(s.grandfather_name||'—')}</td><td>${esc(s.grade||'—')}</td><td>${esc(s.location_label||roomLocation(s.room_id))}</td><td><span class="code">${esc(s.access_code||'')}</span></td></tr>`).join('')||'<tr><td colspan="5" class="empty">لا يوجد طلاب بعد</td></tr>'}</tbody></table></div></div>`;
}
function page_students(){
  if(!['admin','teacher'].includes(state.role))return noAccess();
  const teacher=state.role==='teacher';
  return `<div class="toolbar"><div><h2 class="section-title">${teacher?'طلاب الشعب المخصصة لي':'سجل الطلاب'}</h2><div class="muted">${teacher?'تستطيع إضافة الطلاب وتعديل ملفاتهم ضمن الشعب التي حددتها الإدارة لك.':'تحكم كامل بملفات الطلاب وربط كل طالب بالصف والشعبة الصحيحة.'}</div></div><button class="btn" onclick="openStudentModal()">+ تسجيل طالب جديد</button></div>${teacher?`<div class="role-note">الشعب المخصصة لك: <b>${assignedRoomsLabel(state.user.id)}</b></div>`:''}<div class="card"><div class="toolbar"><div class="field search"><label>بحث سريع</label><input id="studentSearch" placeholder="الاسم، الجد، الكود، الصف..." oninput="filterStudentTable()"></div><div class="hint">عدد الطلاب: <b>${state.data.students.length}</b></div></div><div id="studentTable">${studentTableHtml()}</div></div>`;
}
function roomLocation(roomId){const r=state.data.rooms?.find(x=>x.id===roomId);if(!r)return '—';const f=state.data.floors?.find(x=>x.id===r.floor_id),b=state.data.buildings?.find(x=>x.id===f?.building_id);return `${b?.name||''} / ${r.name||r.code}`;}
function studentTableHtml(q=''){
  q=q.toLowerCase(); const rows=(state.data.students||[]).filter(st=>!q||[st.full_name,st.father_name,st.grandfather_name,st.family_name,st.access_code,st.grade,st.class_name,st.building_name,st.floor_name,st.room_name,roomLocation(st.room_id)].some(v=>String(v||'').toLowerCase().includes(q)));
  return `<div class="table-wrap"><table><thead><tr><th>الطالب</th><th>الأب</th><th>الجد</th><th>الصف</th><th>الموقع</th><th>الكود</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>${rows.map(st=>`<tr><td><b>${esc(st.full_name)}</b></td><td>${esc(st.father_name||'—')}</td><td><b>${esc(st.grandfather_name||'—')}</b></td><td>${esc(st.grade||'—')} ${st.class_name?`/ ${esc(st.class_name)}`:''}</td><td>${esc(st.location_label||roomLocation(st.room_id))}</td><td><span class="code">${esc(st.access_code||'')}</span></td><td><span class="badge ${st.active===false?'inactive':'active'}">${st.active===false?'موقوف':'فعال'}</span></td><td>${state.role==='admin'?`<div class="row"><button class="btn small secondary" onclick="openStudentModal('${st.id}')">تعديل</button><button class="btn small warning" onclick="regenerateCode('${st.id}')">كود جديد</button><button class="btn small secondary" onclick="showStudentQr('${st.id}')">QR</button><button class="btn small" onclick="openNoteModal('${st.id}')">ملاحظة</button><button class="btn small danger" onclick="deleteStudent('${st.id}')">حذف</button></div>`:`<div class="row"><button class="btn small secondary" onclick="openStudentModal('${st.id}')">تعديل</button><button class="btn small secondary" onclick="showStudentQr('${st.id}')">QR</button><button class="btn small" onclick="openNoteModal('${st.id}')">ملاحظة للأهل</button><button class="btn small danger" onclick="deleteStudent('${st.id}')">حذف</button></div>`}</td></tr>`).join('')||'<tr><td colspan="8" class="empty">لا توجد نتائج</td></tr>'}</tbody></table></div>`;
}
function filterStudentTable(){document.getElementById('studentTable').innerHTML=studentTableHtml(document.getElementById('studentSearch').value.trim());applyMobileUi();}
function assignedRoomIds(teacherId=state.user?.id){return (state.data.teacherAssignments||[]).filter(a=>a.teacher_id===teacherId).map(a=>a.room_id);}
function assignedRoomsLabel(teacherId){const ids=assignedRoomIds(teacherId);if(!ids.length)return 'لا توجد شعب مخصصة';return ids.map(id=>roomLocation(id)).join(' • ');}
function roomOptions(selected=''){
  const allowed=state.role==='teacher'?new Set(assignedRoomIds()):null;
  const rooms=(state.data.rooms||[]).filter(r=>!allowed||allowed.has(r.id));
  return `<option value="">— اختر الصف والشعبة —</option>`+rooms.map(r=>{const f=state.data.floors.find(x=>x.id===r.floor_id),b=state.data.buildings.find(x=>x.id===f?.building_id);return `<option value="${r.id}" ${selected===r.id?'selected':''}>${esc(b?.name||'')} — ${esc(r.name||'')} </option>`}).join('');
}
function syncStudentRoom(){
  const id=document.getElementById('s_room')?.value,r=state.data.rooms?.find(x=>x.id===id);
  if(!r)return;
  const grade=document.getElementById('s_grade'),cls=document.getElementById('s_class');
  if(grade && r.grade)grade.value=r.grade;
  if(cls)cls.value=r.section_label||'';
}
function openStudentModal(id=''){
  const st=state.data.students.find(x=>x.id===id)||{}, teacher=state.role==='teacher';
  if(teacher && assignedRoomIds().length===0){alert('لا توجد شعبة مخصصة لحسابك بعد. اطلب من الإدارة تحديد شعبتك أولاً.');return;}
  document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="modal"><div class="modalbox"><div class="row between"><div><h2 class="section-title">${id?'تعديل ملف الطالب':'تسجيل طالب جديد'}</h2><div class="muted">${teacher?'يمكنك إضافة الطالب أو تعديل ملفه، لكن فقط ضمن الشعب المخصصة لك.':'الإدارة تستطيع تعديل بيانات الطالب وموقعه.'}</div></div><button class="btn outline" onclick="closeModal()">إغلاق</button></div><div id="modalMsg"></div>

  <div class="section"><h3 class="section-title">المعلومات الشخصية</h3><div class="mini-grid">
    <div class="field"><label>اسم الطالب الكامل *</label><input id="s_full" value="${esc(st.full_name||'')}"></div>
    <div class="field"><label>اسم الأب</label><input id="s_father" value="${esc(st.father_name||'')}"></div>
    <div class="field"><label>اسم الأم الكامل</label><input id="s_mother" value="${esc(st.mother_name||'')}"></div>
    <div class="field"><label>اسم الجد *</label><input id="s_grand" value="${esc(st.grandfather_name||'')}" placeholder="اسم جد الطالب"></div>
    <div class="field"><label>تاريخ الميلاد</label><input id="s_birth" type="date" value="${esc(st.date_of_birth||'')}"></div>
    <div class="field"><label>الجنس</label><select id="s_gender"><option value="">—</option><option ${st.gender==='ذكر'?'selected':''}>ذكر</option><option ${st.gender==='أنثى'?'selected':''}>أنثى</option></select></div>
  </div></div>

  <div class="section"><h3 class="section-title">معلومات الشعبة</h3><div class="mini-grid">
    <div class="field"><label>الصف *</label><input id="s_grade" value="${esc(st.grade||'')}" readonly></div>
    <div class="field"><label>الشعبة *</label><input id="s_class" value="${esc(st.class_name||'')}" readonly></div>
    <div class="field"><label>اختيار الصف والشعبة *</label><select id="s_room" onchange="syncStudentRoom()">${roomOptions(st.room_id||'')}</select></div>
  </div></div>

  <div class="section"><h3 class="section-title">معلومات الاتصال</h3><div class="mini-grid">
    <div class="field"><label>رقم هاتف ولي الأمر</label><input id="s_phone" inputmode="tel" value="${esc(st.parent_phone||'')}"></div>
    <div class="field"><label>العنوان</label><input id="s_address" value="${esc(st.address||'')}"></div>
    <div class="field"><label>الحالة</label><select id="s_active"><option value="true" ${st.active!==false?'selected':''}>فعال</option><option value="false" ${st.active===false?'selected':''}>موقوف</option></select></div>
  </div></div>

  <div class="section"><h3 class="section-title">المواصلات</h3><div class="mini-grid">
    <div class="field"><label>رقم السيارة — اختياري</label><input id="s_transport" value="${esc(st.transport_car_number||'')}" placeholder="اتركه فارغاً إذا لم يكن الطالب ضمن المواصلات"></div>
  </div></div>

  <div class="field"><label>ملاحظة</label><textarea id="s_notes" placeholder="أي ملاحظة داخلية عن الطالب...">${esc(st.notes||'')}</textarea></div>
  <button class="btn" onclick="saveStudent('${id}')">${id?'حفظ التعديلات':'حفظ وإنشاء كود الطالب'}</button></div></div>`);
}
function closeModal(){document.getElementById('modal')?.remove();}
function normalizeIdentityValue(v=''){return String(v||'').trim().replace(/\s+/g,' ').toLowerCase();}
function duplicateStudentLocal(row,id=''){
  return (state.data.students||[]).find(x=>x.id!==id&&normalizeIdentityValue(x.full_name)===normalizeIdentityValue(row.full_name)&&normalizeIdentityValue(x.father_name)===normalizeIdentityValue(row.father_name)&&normalizeIdentityValue(x.mother_name)===normalizeIdentityValue(row.mother_name)&&normalizeIdentityValue(x.grandfather_name)===normalizeIdentityValue(row.grandfather_name)&&String(x.date_of_birth||'')===String(row.date_of_birth||''));
}
async function invokeSecureFunction(name,body){
  const {data,error}=await sb.functions.invoke(name,{body});
  if(error){let detail=error.message||`تعذر تشغيل ${name}`;try{const j=await error.context?.json();if(j?.error)detail=j.error;}catch(_){}throw new Error(detail);}
  if(data?.error)throw new Error(data.error);return data;
}
async function saveStudent(id=''){
  const msg=document.getElementById('modalMsg');let newStudentId='';
  const full=document.getElementById('s_full').value.trim(),grand=document.getElementById('s_grand').value.trim(),grade=document.getElementById('s_grade').value.trim(),room_id=document.getElementById('s_room').value||null;
  if(!full||!grand||!grade||!room_id){msg.innerHTML='<div class="message error">اسم الطالب واسم الجد والصف والشعبة حقول إلزامية.</div>';return;}
  if(state.role==='teacher'&&!assignedRoomIds().includes(room_id)){msg.innerHTML='<div class="message error">لا يمكنك إضافة طالب إلى شعبة غير مخصصة لك.</div>';return;}
  const row={full_name:full,father_name:document.getElementById('s_father').value.trim(),mother_name:document.getElementById('s_mother').value.trim(),grandfather_name:grand,grade,class_name:document.getElementById('s_class').value.trim(),room_id,gender:document.getElementById('s_gender').value,date_of_birth:document.getElementById('s_birth').value||null,parent_phone:document.getElementById('s_phone').value.trim(),address:document.getElementById('s_address').value.trim(),active:document.getElementById('s_active')?.value!=='false',transport_car_number:document.getElementById('s_transport').value.trim(),notes:document.getElementById('s_notes')?.value.trim()||''};
  const dup=duplicateStudentLocal(row,id);if(!id&&dup){msg.innerHTML=`<div class="message error"><b>الطالب موجود مسبقاً.</b><br>تم العثور على نفس اسم الطالب والأب والأم والجد وتاريخ الميلاد، لذلك لن يتم إنشاء نسخة مكررة.</div>`;return;}
  try{
    if(DEMO){const room=state.data.rooms.find(r=>r.id===room_id),f=state.data.floors.find(x=>x.id===room?.floor_id),b=state.data.buildings.find(x=>x.id===f?.building_id);Object.assign(row,{room_name:room?.name,room_code:room?.code,floor_name:f?.name,building_name:b?.name,location_label:roomLocation(room_id)});if(id){Object.assign(state.data.students.find(x=>x.id===id),row);audit('تعديل','طالب',full);}else{row.id=uid();newStudentId=row.id;row.access_code=makeStudentCode();row.created_at=new Date().toISOString();state.data.students.unshift(row);audit('إضافة','طالب',full+' / '+row.access_code);}saveDemo();}
    else{const data=await invokeSecureFunction('manage-student',{action:id?'update':'create',student_id:id||undefined,student:row});newStudentId=data?.student?.id||id||'';await loadSupabaseData();}
    closeModal();render();if(!id&&newStudentId)setTimeout(()=>showStudentQr(newStudentId),120);
  }catch(e){msg.innerHTML=`<div class="message error">${esc(authErrorArabic(e.message))}</div>`;}
}
async function regenerateCode(id){
  if(state.role!=='admin')return alert('تغيير كود الطالب متاح للإدارة فقط.');
  if(!confirm('إنشاء كود دخول جديد؟ سيتوقف الكود القديم عن العمل.'))return;
  if(DEMO){const c=makeStudentCode(),st=state.data.students.find(x=>x.id===id);st.access_code=c;audit('تغيير كود','طالب',st.full_name);saveDemo();render();alert('الكود الجديد: '+c);return;}
  try{const data=await invokeSecureFunction('manage-student',{action:'regenerate_code',student_id:id});await loadSupabaseData();render();alert('الكود الجديد: '+(data?.access_code||''));}catch(e){alert(authErrorArabic(e.message));}
}
async function deleteStudent(id){
  const st=state.data.students.find(x=>x.id===id);if(!st)return;
  if(!confirm(`حذف الطالب ${st.full_name}؟ سيتم حذف سجلاته المرتبطة بعد التأكيد.`))return;
  if(DEMO){state.data.students=state.data.students.filter(x=>x.id!==id);state.data.attendance=state.data.attendance.filter(x=>x.student_id!==id);state.data.grades=state.data.grades.filter(x=>x.student_id!==id);audit('حذف','طالب',st.full_name);saveDemo();render();return;}
  try{await invokeSecureFunction('manage-student',{action:'delete',student_id:id});await loadSupabaseData();render();}catch(e){alert(authErrorArabic(e.message));}
}
function allowedAttendanceStudents(){
  // المدرس يرى فقط الطلاب الموجودين ضمن الشعب المخصصة له.
  return state.data.students||[];
}
function page_attendance(){
  const date=state.attDate||today(); const roster=allowedAttendanceStudents(); const records=(state.data.attendance||[]).filter(x=>x.date===date);
  const bopts=(state.data.buildings||[]).map(b=>`<option value="${b.id}">${esc(b.name)}</option>`).join('');
  return `<div class="toolbar"><div><h2 class="section-title">سجل الحضور والغياب والتأخير</h2><div class="muted">${state.role==='teacher'?'يمكنك تسجيل الحضور والغياب والتأخير للشعب المخصصة لك فقط.':'يمكن للإدارة والمدرسين المصرح لهم تحديث السجل.'}</div></div><div class="row"><div class="field" style="margin:0"><label>التاريخ</label><input id="attDate" type="date" value="${date}" onchange="changeAttDate(this.value)"></div></div></div>
  <div class="card"><div class="toolbar"><div class="row filters"><div class="field search"><label>بحث</label><input id="attSearch" placeholder="اسم الطالب أو الصف" oninput="filterAttendanceRoster()"></div><div class="field"><label>القسم</label><select id="attBuilding" onchange="filterAttendanceRoster()"><option value="">كل الأقسام</option>${bopts}</select></div><div class="field"><label>الشعبة</label><select id="attRoom" onchange="filterAttendanceRoster()"><option value="">كل الشعب</option>${(state.data.rooms||[]).filter(r=>state.role!=='teacher'||assignedRoomIds().includes(r.id)).map(r=>`<option value="${r.id}">${esc(roomLocation(r.id))}</option>`).join('')}</select></div></div><div class="hint">اختر الحالة ثم احفظ صف الطالب.</div></div><div id="attRoster">${attendanceTableHtml(roster,records,'','','')}</div></div>`;
}
function attendanceTableHtml(roster,records,q='',buildingId='',roomId=''){
  q=q.toLowerCase(); const rows=roster.filter(s=>{const r=state.data.rooms?.find(x=>x.id===s.room_id),f=state.data.floors?.find(x=>x.id===r?.floor_id);return(!q||[s.full_name,s.grade,s.class_name,roomLocation(s.room_id)].some(v=>String(v||'').toLowerCase().includes(q)))&&(!buildingId||f?.building_id===buildingId)&&(!roomId||s.room_id===roomId)});
  return `<div class="table-wrap"><table><thead><tr><th>الطالب</th><th>الصف</th><th>الموقع</th><th>الحالة</th><th>دقائق التأخير</th><th>ملاحظة</th><th>حفظ</th></tr></thead><tbody>${rows.map(s=>{const r=records.find(x=>x.student_id===s.id)||{};return `<tr><td><b>${esc(s.full_name)}</b></td><td>${esc(s.grade||'—')}</td><td>${esc(s.location_label||roomLocation(s.room_id))}</td><td><select id="st_${s.id}"><option ${r.status==='حاضر'?'selected':''}>حاضر</option><option ${r.status==='غائب'?'selected':''}>غائب</option><option ${r.status==='متأخر'?'selected':''}>متأخر</option></select></td><td><input id="min_${s.id}" type="number" min="0" value="${esc(r.late_minutes||0)}" style="width:85px"></td><td><input id="note_${s.id}" value="${esc(r.note||'')}" placeholder="اختياري"></td><td><button class="btn small" onclick="saveAttendanceRow('${s.id}')">حفظ</button></td></tr>`}).join('')||'<tr><td colspan="7" class="empty">لا يوجد طلاب ضمن هذا الاختيار</td></tr>'}</tbody></table></div>`;
}
function changeAttDate(v){state.attDate=v;render();}
function filterAttendanceRoster(){const date=state.attDate||today(),records=(state.data.attendance||[]).filter(x=>x.date===date);document.getElementById('attRoster').innerHTML=attendanceTableHtml(allowedAttendanceStudents(),records,document.getElementById('attSearch')?.value.trim()||'',document.getElementById('attBuilding')?.value||'',document.getElementById('attRoom')?.value||'');applyMobileUi();}
async function saveAttendanceRow(studentId){
  const date=state.attDate||today(), status=document.getElementById('st_'+studentId).value, late_minutes=status==='متأخر'?(Number(document.getElementById('min_'+studentId).value)||0):0, note=document.getElementById('note_'+studentId).value.trim();
  try{
    if(DEMO){let r=state.data.attendance.find(x=>x.student_id===studentId&&x.date===date);if(r)Object.assign(r,{status,late_minutes,note,recorded_by:state.user.id});else state.data.attendance.unshift({id:uid(),student_id:studentId,date,status,late_minutes,note,recorded_by:state.user.id,created_at:new Date().toISOString()});audit('تسجيل حضور','سجل طالب',`${studentName(studentId)} / ${date} / ${status}`);saveDemo();}
    else{const {error}=await sb.from('attendance').upsert({student_id:studentId,date,status,late_minutes,note,recorded_by:state.user.id},{onConflict:'student_id,date'});if(error)throw error;await loadSupabaseData();}
    render();
  }catch(e){alert('تعذر الحفظ: '+e.message);}
}
function page_buildings(){
  if(state.role!=='admin')return noAccess();
  const cards=(state.data.buildings||[]).map(b=>{const fs=state.data.floors.filter(f=>f.building_id===b.id),rs=state.data.rooms.filter(r=>fs.some(f=>f.id===r.floor_id)),students=state.data.students.filter(st=>rs.some(r=>r.id===st.room_id)).length;return `<div class="card building-card"><div class="row between"><div><h3 style="margin:0">${esc(b.name)}</h3><div class="hint">${esc(b.audience||'')}</div></div><span class="badge active">${rs.length} شعبة</span></div><div class="building-stats"><div><b>${rs.length}</b><span>شعبة</span></div><div><b>${students}</b><span>طالب</span></div></div></div>`}).join('');
  const rows=(state.data.rooms||[]).map(r=>{const f=state.data.floors.find(x=>x.id===r.floor_id),b=state.data.buildings.find(x=>x.id===f?.building_id),count=state.data.students.filter(st=>st.room_id===r.id).length,teachers=(state.data.teacherAssignments||[]).filter(a=>a.room_id===r.id).length;return `<tr><td><b>${esc(b?.name||'')}</b></td><td>${esc(r.grade||'—')}</td><td>${esc(r.section_label||'—')}</td><td>${count}</td><td>${teachers}</td><td><div class="row"><button class="btn small secondary" onclick="openRoomModal('${r.id}')">تعديل</button><button class="btn small danger" onclick="deleteRoom('${r.id}')">حذف</button></div></td></tr>`}).join('');
  return `<div class="toolbar"><div><h2 class="section-title">الصفوف والشعب</h2><div class="muted">يمكنك إضافة صف/شعبة جديدة أو تعديلها أو حذف الشعبة الفارغة بدون تحديث البرنامج.</div></div><button class="btn" onclick="openRoomModal()">+ إضافة صف / شعبة</button></div><div class="building-grid">${cards}</div><div class="card section"><div class="row between"><h3 class="section-title">دليل الصفوف والشعب</h3><span class="hint">إجمالي الشعب: <b>${(state.data.rooms||[]).length}</b></span></div><div class="table-wrap"><table><thead><tr><th>القسم</th><th>الصف</th><th>الشعبة</th><th>الطلاب</th><th>المدرسون</th><th>إجراء</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}
function buildingOptions(selected=''){return (state.data.buildings||[]).map(b=>`<option value="${b.id}" ${selected===b.id?'selected':''}>${esc(b.name)}</option>`).join('');}
function openRoomModal(id=''){
  const r=id?state.data.rooms.find(x=>x.id===id):null;const f=r?state.data.floors.find(x=>x.id===r.floor_id):null;
  document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="modal"><div class="modalbox" style="max-width:620px"><div class="row between"><div><h2 class="section-title">${id?'تعديل الصف والشعبة':'إضافة صف وشعبة'}</h2><div class="muted">لن يتم حذف أو تغيير أي طالب عند الإضافة. عند التعديل يتم تحديث اسم الصف والشعبة للطلاب الموجودين فيها.</div></div><button class="btn outline" onclick="closeModal()">إغلاق</button></div><div id="modalMsg"></div><div class="field"><label>القسم *</label><select id="r_building">${buildingOptions(f?.building_id||state.data.buildings?.[0]?.id||'')}</select></div><div class="field"><label>اسم الصف *</label><input id="r_grade" value="${esc(r?.grade||'')}" placeholder="مثال: الصف الحادي عشر"></div><div class="field"><label>اسم الشعبة *</label><input id="r_section" value="${esc(r?.section_label||'')}" placeholder="مثال: شعبة أولى"></div><button class="btn" onclick="saveRoom('${id}')">${id?'حفظ التعديل':'إضافة الشعبة'}</button></div></div>`);
}
async function saveRoom(id=''){
  const building_id=document.getElementById('r_building').value,grade=document.getElementById('r_grade').value.trim(),section_label=document.getElementById('r_section').value.trim(),msg=document.getElementById('modalMsg');
  if(!building_id||!grade||!section_label){msg.innerHTML='<div class="message error">القسم والصف والشعبة مطلوبة.</div>';return;}
  try{if(DEMO)throw new Error('التعديل الدائم متاح في النسخة المتصلة فقط.');await invokeSecureFunction('manage-section',{action:id?'update':'create',room_id:id||undefined,building_id,grade,section_label});await loadSupabaseData();closeModal();render();}catch(e){msg.innerHTML=`<div class="message error">${esc(authErrorArabic(e.message))}</div>`;}
}
async function deleteRoom(id){
  const r=state.data.rooms.find(x=>x.id===id);if(!r)return;if(!confirm(`حذف ${r.grade} — ${r.section_label}؟ لا يمكن الحذف إذا كان فيها طلاب أو مدرسون.`))return;
  try{if(DEMO)throw new Error('غير متاح في التجربة.');await invokeSecureFunction('manage-section',{action:'delete',room_id:id});await loadSupabaseData();render();}catch(e){alert(authErrorArabic(e.message));}
}
function page_notes(){
  if(!['admin','teacher'].includes(state.role))return noAccess(); const allowedIds=new Set((state.data.students||[]).map(s=>s.id)); const notes=(state.data.studentNotes||[]).filter(n=>state.role==='admin'||allowedIds.has(n.student_id));
  return `<div class="toolbar"><div><h2 class="section-title">ملاحظات الطلاب</h2><div class="muted">${state.role==='teacher'?'يمكنك إضافة ملاحظة فقط لطلاب الشعب المخصصة لك، وتصل مباشرة إلى ولي الأمر.':'كل ملاحظة تُرسل إلزامياً إلى كود الطالب وتظهر كإشعار غير مقروء في بوابة ولي الأمر.'}</div></div><button class="btn" onclick="openNoteModal()">+ ملاحظة جديدة</button></div><div class="card"><div class="table-wrap"><table><thead><tr><th>الطالب</th><th>العنوان</th><th>التصنيف</th><th>الأهمية</th><th>الصورة</th><th>للأهل</th><th>التاريخ</th><th>إجراء</th></tr></thead><tbody>${notes.map(n=>`<tr><td><b>${esc(studentName(n.student_id))}</b></td><td>${esc(n.title||'ملاحظة')}</td><td>${esc(n.category||'عامة')}</td><td><span class="badge ${n.importance==='مهم'?'absent':'active'}">${esc(n.importance||'عادي')}</span></td><td>${n.image_url?`<a href="${esc(n.image_url)}" target="_blank" rel="noopener">📷 عرض</a>`:'—'}</td><td>${n.visible_to_parent===false?'لا':'نعم 🔔'}</td><td>${esc((n.created_at||'').slice(0,10))}</td><td>${state.role==='admin'?`<button class="btn small danger" onclick="deleteStudentNote('${n.id}')">حذف</button>`:'<span class="badge teacher">مرسلة للأهل</span>'}</td></tr>`).join('')||'<tr><td colspan="8" class="empty">لا توجد ملاحظات بعد</td></tr>'}</tbody></table></div></div>`;
}
function updateNoteStudentCode(){const sid=document.getElementById('n_student')?.value,st=state.data.students.find(x=>x.id===sid);const el=document.getElementById('n_code');if(el)el.value=st?.access_code||'';}
function previewNoteImage(){
  const file=document.getElementById('n_image')?.files?.[0],box=document.getElementById('n_image_preview');
  if(!box)return;
  if(!file){box.innerHTML='';return;}
  if(!file.type.startsWith('image/')){box.innerHTML='<div class="message error">اختر ملف صورة فقط.</div>';return;}
  if(file.size>10*1024*1024){box.innerHTML='<div class="message error">حجم الصورة كبير. الحد الأقصى 10 MB.</div>';return;}
  const r=new FileReader();r.onload=()=>box.innerHTML=`<img src="${r.result}" alt="معاينة الصورة" style="display:block;width:100%;max-width:420px;max-height:360px;object-fit:contain;border-radius:14px;margin-top:10px;background:#f3f5f4">`;r.readAsDataURL(file);
}
function openNoteModal(studentId=''){
  if(state.role==='teacher'&&!(state.data.students||[]).length){alert('لا يوجد طلاب ضمن الشعب المخصصة لك.');return;}
  document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="modal"><div class="modalbox"><div class="row between"><div><h2 class="section-title">إضافة ملاحظة على الطالب</h2><div class="muted">${state.role==='teacher'?'الملاحظة ستُرسل لولي أمر الطالب مباشرة، ويمكنك اختيار طلاب شعبك فقط.':'كل ملاحظة هنا تصل إلزامياً إلى بوابة ولي الأمر المرتبطة بكود الطالب وتُسجل كإشعار غير مقروء.'}</div></div><button class="btn outline" onclick="closeModal()">إغلاق</button></div><div id="modalMsg"></div><div class="mini-grid section"><div class="field"><label>الطالب *</label><select id="n_student" onchange="updateNoteStudentCode()">${state.data.students.map(st=>`<option value="${st.id}" ${studentId===st.id?'selected':''}>${esc(st.full_name)} — ${esc(st.access_code)}</option>`).join('')}</select></div><div class="field"><label>كود الطالب *</label><input id="n_code" readonly value="${esc((state.data.students.find(st=>st.id===(studentId||state.data.students[0]?.id))?.access_code)||'')}"></div><div class="field"><label>التصنيف</label><select id="n_category"><option>ملاحظة عامة</option><option>سلوك</option><option>دراسة</option><option>التزام</option><option>تميز</option><option>تنبيه</option><option>تكريم</option><option>شهادة</option></select></div><div class="field"><label>الأهمية</label><select id="n_importance"><option>عادي</option><option>مهم</option></select></div></div><div class="message ok">🔔 الإرسال لولي الأمر إجباري لهذه الملاحظات.</div><div class="field"><label>عنوان الملاحظة *</label><input id="n_title" placeholder="مثال: تكريم الطالب أو شهادة تقدير"></div><div class="field"><label>نص الملاحظة *</label><textarea id="n_content" placeholder="اكتب الملاحظة التي تريد أن تصل إلى ولي الأمر..."></textarea></div><div class="field"><label>صورة مرفقة (اختياري)</label><input id="n_image" type="file" accept="image/*" capture="environment" onchange="previewNoteImage()"><div class="hint">يمكنك تصوير شهادة/تكريم مباشرة أو اختيار صورة من الهاتف. الحد الأقصى 10 MB.</div><div id="n_image_preview"></div></div><button class="btn" onclick="saveStudentNote()">حفظ وإرسال لولي الأمر</button></div></div>`);
}
async function uploadStudentNoteImage(student_id,file){
  if(!file)return '';
  if(!file.type.startsWith('image/'))throw new Error('الملف المرفق يجب أن يكون صورة.');
  if(file.size>10*1024*1024)throw new Error('حجم الصورة كبير. الحد الأقصى 10 MB.');
  const ext=(file.name?.split('.').pop()||'jpg').replace(/[^a-zA-Z0-9]/g,'').toLowerCase()||'jpg';
  const path=`${student_id}/${Date.now()}-${uid()}.${ext}`;
  const {error}=await sb.storage.from('student-note-images').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type||'image/jpeg'});
  if(error)throw error;
  return path;
}
async function saveStudentNote(){
  const student_id=document.getElementById('n_student').value,
        title=document.getElementById('n_title').value.trim(),
        content=document.getElementById('n_content').value.trim(),
        category=document.getElementById('n_category').value,
        importance=document.getElementById('n_importance').value,
        file=document.getElementById('n_image')?.files?.[0]||null,
        msg=document.getElementById('modalMsg');
  if(!student_id||!title||!content){msg.innerHTML='<div class="message error">اختر الطالب واكتب العنوان والملاحظة.</div>';return;}
  try{
    let image_url='';
    if(DEMO){
      if(file){const r=new FileReader();image_url=await new Promise((resolve,reject)=>{r.onload=()=>resolve(String(r.result||''));r.onerror=()=>reject(new Error('تعذر قراءة الصورة.'));r.readAsDataURL(file);});}
      const note={id:uid(),student_id,title,content,category,importance,image_url,visible_to_parent:true,created_by:state.user.id,created_at:new Date().toISOString()};
      state.data.studentNotes.unshift(note);state.data.notifications.unshift({id:uid(),student_id,source_type:'student_note',source_id:note.id,title:'ملاحظة جديدة من مدرسة المنارة',body:title,created_at:new Date().toISOString(),seen_at:null});audit('إضافة','ملاحظة طالب',`${studentName(student_id)} / ${title}`);saveDemo();
    }else{
      let image_path='';if(file){msg.innerHTML='<div class="message">جاري رفع الصورة وحفظ الملاحظة...</div>';image_path=await uploadStudentNoteImage(student_id,file);}
      const {data:note,error}=await sb.from('student_notes').insert({student_id,title,content,category,importance,image_path:image_path||null,image_url:null,visible_to_parent:true,created_by:state.user.id}).select().single();
      if(error)throw error;
      let pushMsg='';
      try{const {data:push,error:pushError}=await sb.functions.invoke('send-parent-push',{body:{student_id,title:'مدرسة المنارة الخاصة',body:(title+' — '+content).slice(0,260),note_id:note?.id||''}});if(pushError)pushMsg='تم حفظ الملاحظة، لكن تعذر إرسال إشعار الهاتف.';else if(!push?.sent)pushMsg='تم حفظ الملاحظة، لكن لا يوجد جهاز ولي أمر مسجل للإشعارات بعد.';}catch(_){pushMsg='تم حفظ الملاحظة، لكن تعذر إرسال إشعار الهاتف.';}
      await loadSupabaseData();if(pushMsg)setTimeout(()=>alert(pushMsg),100);else setTimeout(()=>alert(image_path?'تم حفظ الملاحظة والصورة وإرسال إشعار لولي الأمر.':'تم حفظ الملاحظة وإرسال إشعار لولي الأمر.'),100);
    }
    closeModal();render();
  }catch(e){msg.innerHTML=`<div class="message error">${esc(e.message)}</div>`;}
}
async function deleteStudentNote(id){if(!confirm('حذف الملاحظة؟'))return;if(DEMO){state.data.studentNotes=state.data.studentNotes.filter(x=>x.id!==id);state.data.notifications=state.data.notifications.filter(x=>x.source_id!==id);saveDemo();render();}else{const {error}=await sb.from('student_notes').delete().eq('id',id);if(error)return alert(error.message);await loadSupabaseData();render();}}
function page_grades(){
  if(state.role!=='admin')return noAccess(); const gr=state.data.grades||[];
  return `<div class="toolbar"><div><h2 class="section-title">النتائج والاختبارات</h2><div class="muted">صلاحية حصرية للإدارة.</div></div><button class="btn" onclick="openGradeModal()">+ إضافة نتيجة</button></div><div class="card"><div class="table-wrap"><table><thead><tr><th>الطالب</th><th>المادة</th><th>الاختبار</th><th>التاريخ</th><th>العلامة</th><th>إجراء</th></tr></thead><tbody>${gr.map(g=>`<tr><td>${esc(studentName(g.student_id))}</td><td>${esc(g.subject_name||g.subject||'')}</td><td>${esc(g.exam_name||g.exam||'')}</td><td>${esc(g.date||'—')}</td><td><b>${esc(g.score)}/${esc(g.max_score||g.max||100)}</b></td><td><button class="btn small danger" onclick="deleteGrade('${g.id}')">حذف</button></td></tr>`).join('')||'<tr><td colspan="6" class="empty">لا توجد نتائج</td></tr>'}</tbody></table></div></div>`;
}
function studentName(id){return state.data.students.find(s=>s.id===id)?.full_name||'—';}
function openGradeModal(){document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="modal"><div class="modalbox"><div class="row between"><h2 class="section-title">إضافة نتيجة</h2><button class="btn outline" onclick="closeModal()">إغلاق</button></div><div id="modalMsg"></div><div class="mini-grid section"><div class="field"><label>الطالب</label><select id="g_student">${state.data.students.map(s=>`<option value="${s.id}">${esc(s.full_name)}</option>`).join('')}</select></div><div class="field"><label>المادة</label><select id="g_subject">${state.data.subjects.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div><div class="field"><label>اسم الاختبار</label><input id="g_exam"></div><div class="field"><label>التاريخ</label><input id="g_date" type="date" value="${today()}"></div><div class="field"><label>العلامة</label><input id="g_score" type="number"></div><div class="field"><label>العلامة الكاملة</label><input id="g_max" type="number" value="100"></div></div><button class="btn" onclick="saveGrade()">حفظ النتيجة</button></div></div>`);}
async function saveGrade(){const student_id=document.getElementById('g_student').value,subjectId=document.getElementById('g_subject').value,exam=document.getElementById('g_exam').value.trim(),date=document.getElementById('g_date').value,score=Number(document.getElementById('g_score').value),max=Number(document.getElementById('g_max').value)||100,msg=document.getElementById('modalMsg');if(!student_id||!exam||Number.isNaN(score)){msg.innerHTML='<div class="message error">أكمل بيانات الاختبار والعلامة.</div>';return;}try{if(DEMO){const subject=state.data.subjects.find(s=>s.id===subjectId)?.name||'';state.data.grades.unshift({id:uid(),student_id,subject_id:subjectId,subject_name:subject,exam_name:exam,date,score,max_score:max,created_at:new Date().toISOString()});audit('إضافة','نتيجة',`${studentName(student_id)} / ${subject}`);saveDemo();}else{let {data:item,error:e1}=await sb.from('grade_items').insert({subject_id:subjectId,title:exam,max_score:max,exam_date:date}).select().single();if(e1)throw e1;let {error:e2}=await sb.from('grades').insert({student_id,grade_item_id:item.id,score});if(e2)throw e2;await loadSupabaseData();}closeModal();render();}catch(e){msg.innerHTML=`<div class="message error">${esc(e.message)}</div>`;}}
async function deleteGrade(id){if(!confirm('حذف النتيجة؟'))return;if(DEMO){state.data.grades=state.data.grades.filter(x=>x.id!==id);audit('حذف','نتيجة',id);saveDemo();render();}else{const {error}=await sb.from('grades').delete().eq('id',id);if(error)return alert(error.message);await loadSupabaseData();render();}}

function page_announcements(){
  if(state.role!=='admin')return noAccess(); return `<div class="toolbar"><div><h2 class="section-title">إعلانات المدرسة</h2><div class="muted">تظهر الإعلانات في بوابة ولي الأمر.</div></div><button class="btn" onclick="openAnnouncementModal()">+ إعلان جديد</button></div><div class="stack">${state.data.announcements.map(a=>`<div class="card"><div class="row between"><div><h3 style="margin:0 0 7px">${esc(a.title)}</h3><div>${esc(a.content)}</div><small class="muted">${esc(a.created_date||a.date||new Date(a.created_at||Date.now()).toLocaleDateString('ar'))}</small></div><button class="btn small danger" onclick="deleteAnnouncement('${a.id}')">حذف</button></div></div>`).join('')||'<div class="card empty">لا توجد إعلانات</div>'}</div>`;
}
function openAnnouncementModal(){document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="modal"><div class="modalbox"><div class="row between"><h2 class="section-title">إعلان جديد</h2><button class="btn outline" onclick="closeModal()">إغلاق</button></div><div class="field"><label>العنوان</label><input id="a_title"></div><div class="field"><label>النص</label><textarea id="a_content"></textarea></div><button class="btn" onclick="saveAnnouncement()">نشر الإعلان</button></div></div>`);}
async function saveAnnouncement(){const title=document.getElementById('a_title').value.trim(),content=document.getElementById('a_content').value.trim();if(!title||!content)return alert('أكمل العنوان والنص.');if(DEMO){state.data.announcements.unshift({id:uid(),title,content,date:new Date().toLocaleDateString('ar'),created_at:new Date().toISOString()});audit('نشر','إعلان',title);saveDemo();}else{const {error}=await sb.from('announcements').insert({title,content,target_type:'all',active:true,created_by:state.user.id});if(error)return alert(error.message);await loadSupabaseData();}closeModal();render();}
async function deleteAnnouncement(id){if(!confirm('حذف الإعلان؟'))return;if(DEMO){state.data.announcements=state.data.announcements.filter(x=>x.id!==id);saveDemo();render();}else{const {error}=await sb.from('announcements').delete().eq('id',id);if(error)return alert(error.message);await loadSupabaseData();render();}}

function teacherRoomCheckboxes(selected=[]){
  const set=new Set(selected||[]);
  const groups=(state.data.buildings||[]).map(b=>{
    const floorIds=new Set((state.data.floors||[]).filter(f=>f.building_id===b.id).map(f=>f.id));
    const rooms=(state.data.rooms||[]).filter(r=>floorIds.has(r.floor_id));
    if(!rooms.length)return '';
    return `<div class="section"><div class="row between"><b>${esc(b.name)}</b><span class="hint">${rooms.length} شعبة</span></div><div class="room-check-grid">${rooms.map(r=>`<label class="room-check"><input type="checkbox" name="teacher_room" value="${r.id}" ${set.has(r.id)?'checked':''}><span><b>${esc(r.name)}</b><small>${esc(r.grade||'')} — ${esc(r.section_label||'')}</small></span></label>`).join('')}</div></div>`;
  }).join('');
  return `<div>${groups}</div>`;
}
function selectedTeacherRooms(){return [...document.querySelectorAll('input[name="teacher_room"]:checked')].map(x=>x.value);}
function teacherTableHtml(q=''){
  q=String(q||'').trim().toLowerCase();const list=(state.data.teachers||[]).filter(t=>!q||[t.full_name,t.email,t.username,t.id,assignedRoomsLabel(t.id)].some(v=>String(v||'').toLowerCase().includes(q)));
  return `<div class="table-wrap"><table><thead><tr><th>اسم الأستاذ</th><th>${DEMO?'اسم المستخدم':'الحساب'}</th><th>الشعب المخصصة</th><th>الصلاحية</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>${list.map(t=>`<tr><td><b>${esc(t.full_name)}</b></td><td>${esc(t.username||t.email||t.id)}</td><td><div class="assignment-list">${assignedRoomIds(t.id).map(id=>`<span class="badge active">${esc(roomLocation(id))}</span>`).join(' ')||'<span class="badge warning">لم تحدد شعب</span>'}</div></td><td><span class="badge teacher">طلاب + حضور + ملاحظات</span></td><td><span class="badge ${t.active===false?'inactive':'active'}">${t.active===false?'موقوف':'فعال'}</span></td><td><div class="row"><button class="btn small secondary" onclick="openTeacherEditModal('${t.id}')">تعديل</button><button class="btn small secondary" onclick="openTeacherPasswordModal('${t.id}')">كلمة السر</button><button class="btn small ${t.active===false?'secondary':'danger'}" onclick="toggleTeacher('${t.id}',${t.active===false?'true':'false'})">${t.active===false?'تفعيل':'إيقاف'}</button><button class="btn small danger" onclick="deleteTeacher('${t.id}')">حذف</button></div></td></tr>`).join('')||'<tr><td colspan="6" class="empty">لا يوجد مدرسون مطابقون للبحث</td></tr>'}</tbody></table></div>`;
}
function filterTeacherTable(){const el=document.getElementById('teacherTable');if(el)el.innerHTML=teacherTableHtml(document.getElementById('teacherSearch')?.value||'');applyMobileUi();}
function page_teachers(){
  if(state.role!=='admin')return noAccess();
  return `<div class="toolbar"><div><h2 class="section-title">حسابات المدرسين وتوزيع الشعب</h2><div class="muted">ابحث بالاسم، وأدر الحسابات والشعب من مكان واحد.</div></div><button class="btn" onclick="openTeacherModal()">+ إضافة أستاذ</button></div><div class="role-note">كل العمليات الحساسة محمية بحساب الإدارة والتحقق بخطوتين.</div><div class="card section"><div class="toolbar"><div class="field search"><label>بحث عن أستاذ</label><input id="teacherSearch" placeholder="اكتب اسم الأستاذ..." oninput="filterTeacherTable()"></div><div class="hint">عدد المدرسين: <b>${(state.data.teachers||[]).length}</b></div></div><div id="teacherTable">${teacherTableHtml()}</div></div>`;
}
function openTeacherModal(){document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="modal"><div class="modalbox"><div class="row between"><div><h2 class="section-title">إضافة أستاذ</h2><div class="muted">يمكن اختيار أكثر من شعبة للأستاذ نفسه.</div></div><button class="btn outline" onclick="closeModal()">إغلاق</button></div><div id="modalMsg"></div><div class="mini-grid section"><div class="field"><label>اسم الأستاذ *</label><input id="t_name"></div><div class="field"><label>${DEMO?'اسم المستخدم *':'البريد الإلكتروني *'}</label><input id="t_login" inputmode="email"></div><div class="field"><label>كلمة المرور المؤقتة * (6 أحرف أو أرقام على الأقل)</label><input id="t_password" type="password" minlength="6"></div></div><div class="field"><label>الشعب المخصصة للأستاذ * — يمكنك اختيار أكثر من شعبة</label>${teacherRoomCheckboxes([])}</div><button class="btn" onclick="saveTeacher()">إنشاء الحساب وحفظ الشعب</button></div></div>`);}
async function saveTeacher(){const full_name=document.getElementById('t_name').value.trim(),login=document.getElementById('t_login').value.trim(),password=document.getElementById('t_password').value,room_ids=selectedTeacherRooms(),msg=document.getElementById('modalMsg');if(!full_name||!login||!teacherPasswordValid(password)){msg.innerHTML='<div class="message error">أدخل الاسم والحساب وكلمة مرور من 6 أحرف أو أرقام على الأقل.</div>';return;}if(!room_ids.length){msg.innerHTML='<div class="message error">اختر شعبة واحدة على الأقل للأستاذ.</div>';return;}try{if(DEMO){if(state.data.teachers.some(x=>x.username===login))throw new Error('اسم المستخدم موجود مسبقاً.');const id=uid();state.data.teachers.unshift({id,full_name,username:login,password,active:true});room_ids.forEach(room_id=>state.data.teacherAssignments.push({teacher_id:id,room_id}));audit('إضافة','مدرس',full_name);saveDemo();}else{const {data,error}=await sb.functions.invoke('create-teacher',{body:{email:login,password,full_name,room_ids}});if(error){let detail=error.message||'تعذر تشغيل خدمة إنشاء المدرس.';try{const body=await error.context?.json();if(body?.error)detail=body.error;}catch(_){}if(/not found|404|function/i.test(detail))detail+=' تأكد من نشر Edge Function create-teacher في Supabase.';throw new Error(detail);}if(data?.error)throw new Error(data.error);await loadSupabaseData();}closeModal();render();}catch(e){msg.innerHTML=`<div class="message error">${esc(authErrorArabic(e.message))}</div>`;}}

function openTeacherEditModal(id){
  const t=state.data.teachers.find(x=>x.id===id);if(!t)return;
  document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="modal"><div class="modalbox"><div class="row between"><div><h2 class="section-title">تعديل الأستاذ</h2><div class="muted">يمكن تعديل الاسم والشعب، وتغيير البريد أو كلمة المرور عند الحاجة.</div></div><button class="btn outline" onclick="closeModal()">إغلاق</button></div><div id="modalMsg"></div><div class="mini-grid section"><div class="field"><label>اسم الأستاذ *</label><input id="te_name" value="${esc(t.full_name||'')}"></div><div class="field"><label>${DEMO?'اسم المستخدم الجديد — اختياري':'البريد الإلكتروني الجديد — اختياري'}</label><input id="te_login" inputmode="email" placeholder="اتركه فارغاً لعدم التغيير"></div><div class="field"><label>كلمة مرور جديدة — اختياري</label><input id="te_password" type="password" minlength="6" placeholder="6 أحرف أو أرقام على الأقل"></div></div><div class="field"><label>الشعب المخصصة للأستاذ *</label>${teacherRoomCheckboxes(assignedRoomIds(id))}</div><button class="btn" onclick="saveTeacherEdit('${id}')">حفظ التعديلات</button></div></div>`);
}
async function saveTeacherEdit(id){
  const full_name=document.getElementById('te_name').value.trim(),login=document.getElementById('te_login').value.trim(),password=document.getElementById('te_password').value,room_ids=selectedTeacherRooms(),msg=document.getElementById('modalMsg');
  if(!full_name){msg.innerHTML='<div class="message error">اسم الأستاذ مطلوب.</div>';return;}
  if(password&&!teacherPasswordValid(password)){msg.innerHTML='<div class="message error">كلمة مرور المدرس يجب أن تكون 6 أحرف أو أرقام على الأقل.</div>';return;}
  if(!room_ids.length){msg.innerHTML='<div class="message error">اختر شعبة واحدة على الأقل للأستاذ.</div>';return;}
  try{
    if(DEMO){const t=state.data.teachers.find(x=>x.id===id);if(!t)throw new Error('الأستاذ غير موجود.');t.full_name=full_name;if(login)t.username=login;if(password)t.password=password;state.data.teacherAssignments=state.data.teacherAssignments.filter(x=>x.teacher_id!==id);room_ids.forEach(room_id=>state.data.teacherAssignments.push({teacher_id:id,room_id}));audit('تعديل','مدرس',full_name);saveDemo();}
    else{const {data,error}=await sb.functions.invoke('manage-teacher',{body:{action:'update',teacher_id:id,full_name,email:login||undefined,password:password||undefined,room_ids}});if(error){let detail=error.message||'تعذر تعديل الأستاذ.';try{const body=await error.context?.json();if(body?.error)detail=body.error;}catch(_){}if(/not found|404|function/i.test(detail))detail+=' تأكد من نشر Edge Function manage-teacher في Supabase.';throw new Error(detail);}if(data?.error)throw new Error(data.error);await loadSupabaseData();}
    closeModal();render();
  }catch(e){msg.innerHTML=`<div class="message error">${esc(authErrorArabic(e.message))}</div>`;}
}
function openTeacherPasswordModal(id){
  const t=state.data.teachers.find(x=>x.id===id);if(!t)return;
  document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="modal"><div class="modalbox" style="max-width:560px"><div class="row between"><div><h2 class="section-title">تغيير كلمة مرور الأستاذ</h2><div class="muted">${esc(t.full_name||'')} — لا يتم تغيير الاسم أو الشعب.</div></div><button class="btn outline" onclick="closeModal()">إغلاق</button></div><div id="modalMsg"></div><div class="field"><label>كلمة المرور الجديدة * (6 أحرف أو أرقام على الأقل)</label><input id="tp_password" type="password" minlength="6" autocomplete="new-password"></div><div class="field"><label>تأكيد كلمة المرور *</label><input id="tp_confirm" type="password" autocomplete="new-password"></div><button class="btn" onclick="saveTeacherPassword('${id}')">حفظ كلمة المرور الجديدة</button></div></div>`);
}
async function saveTeacherPassword(id){
  const p=document.getElementById('tp_password').value,c=document.getElementById('tp_confirm').value,msg=document.getElementById('modalMsg');
  if(!teacherPasswordValid(p)){msg.innerHTML='<div class="message error">كلمة مرور المدرس يجب أن تكون 6 أحرف أو أرقام على الأقل.</div>';return;}
  if(p!==c){msg.innerHTML='<div class="message error">تأكيد كلمة المرور غير مطابق.</div>';return;}
  const t=state.data.teachers.find(x=>x.id===id);if(!t)return;
  try{
    if(DEMO){t.password=p;saveDemo();}
    else{const room_ids=assignedRoomIds(id);const {data,error}=await sb.functions.invoke('manage-teacher',{body:{action:'update',teacher_id:id,full_name:t.full_name,password:p,room_ids}});if(error){let detail=error.message||'تعذر تغيير كلمة المرور.';try{const body=await error.context?.json();if(body?.error)detail=body.error;}catch(_){}throw new Error(detail);}if(data?.error)throw new Error(data.error);}
    closeModal();alert('تم تغيير كلمة مرور الأستاذ بنجاح.');
  }catch(e){msg.innerHTML=`<div class="message error">${esc(authErrorArabic(e.message))}</div>`;}
}
async function deleteTeacher(id){
  const t=state.data.teachers.find(x=>x.id===id);if(!t)return;
  if(!confirm(`حذف الأستاذ ${t.full_name} نهائياً؟ سيتم حذف حساب دخوله وإزالة الشعب المخصصة له.`))return;
  try{
    if(DEMO){state.data.teachers=state.data.teachers.filter(x=>x.id!==id);state.data.teacherAssignments=state.data.teacherAssignments.filter(x=>x.teacher_id!==id);audit('حذف','مدرس',t.full_name);saveDemo();render();return;}
    const {data,error}=await sb.functions.invoke('manage-teacher',{body:{action:'delete',teacher_id:id}});if(error){let detail=error.message||'تعذر حذف الأستاذ.';try{const body=await error.context?.json();if(body?.error)detail=body.error;}catch(_){}if(/not found|404|function/i.test(detail))detail+=' تأكد من نشر Edge Function manage-teacher في Supabase.';throw new Error(detail);}if(data?.error)throw new Error(data.error);await loadSupabaseData();render();alert('تم حذف الأستاذ بنجاح.');
  }catch(e){alert(authErrorArabic(e.message));}
}
function openTeacherRoomsModal(id){const t=state.data.teachers.find(x=>x.id===id);if(!t)return;document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="modal"><div class="modalbox"><div class="row between"><div><h2 class="section-title">تعديل شعب الأستاذ</h2><div class="muted">${esc(t.full_name)} — الإدارة فقط تستطيع تعديل هذه الشعب.</div></div><button class="btn outline" onclick="closeModal()">إغلاق</button></div><div id="modalMsg"></div><div class="field section">${teacherRoomCheckboxes(assignedRoomIds(id))}</div><button class="btn" onclick="saveTeacherRooms('${id}')">حفظ الشعب وإقفال التوزيع</button></div></div>`);}
async function saveTeacherRooms(id){const room_ids=selectedTeacherRooms(),msg=document.getElementById('modalMsg');if(!room_ids.length){msg.innerHTML='<div class="message error">اختر شعبة واحدة على الأقل.</div>';return;}try{if(DEMO){state.data.teacherAssignments=state.data.teacherAssignments.filter(x=>x.teacher_id!==id);room_ids.forEach(room_id=>state.data.teacherAssignments.push({teacher_id:id,room_id}));saveDemo();}else{const t=state.data.teachers.find(x=>x.id===id);await invokeSecureFunction('manage-teacher',{action:'update',teacher_id:id,full_name:t?.full_name||'',room_ids});await loadSupabaseData();}closeModal();render();}catch(e){msg.innerHTML=`<div class="message error">${esc(authErrorArabic(e.message))}</div>`;}}
async function toggleTeacher(id,active){if(DEMO){const t=state.data.teachers.find(x=>x.id===id);t.active=active;audit(active?'تفعيل':'إيقاف','مدرس',t.full_name);saveDemo();render();}else{try{await invokeSecureFunction('manage-teacher',{action:'toggle',teacher_id:id,active});await loadSupabaseData();render();}catch(e){alert(authErrorArabic(e.message));}}}

function page_audit(){if(state.role!=='admin')return noAccess();return `<div class="toolbar"><div><h2 class="section-title">سجل العمليات</h2><div class="muted">مرجع لمعرفة من قام بالتعديل ومتى.</div></div></div><div class="card"><div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>المستخدم</th><th>العملية</th><th>القسم</th><th>التفاصيل</th></tr></thead><tbody>${(state.data.audit||[]).map(a=>`<tr><td>${esc(new Date(a.created_at).toLocaleString('ar'))}</td><td>${esc(a.actor_name||a.actor||'—')}</td><td>${esc(a.action)}</td><td>${esc(a.entity||a.entity_type||'—')}</td><td>${esc(a.details||'—')}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">لا توجد عمليات مسجلة</td></tr>'}</tbody></table></div></div>`;}

function page_settings(){
  if(state.role!=='admin')return noAccess();const st=state.data.settings||{};
  return `<div class="toolbar"><div><h2 class="section-title">إعدادات المدرسة والأمان</h2><div class="muted">إعدادات المدرسة والحساب الإداري المحمي بالتحقق بخطوتين.</div></div></div><div class="stack" style="max-width:900px">
  <div class="card"><div class="row" style="margin-bottom:15px">${logo().replace('<img','<img style="width:80px;height:80px;border-radius:50%;object-fit:cover"')}<div><b>الشعار الحالي</b><div class="hint">الشعار يظهر في صفحة الدخول وداخل واجهة النظام.</div></div></div><div class="mini-grid"><div class="field"><label>اسم المدرسة</label><input id="set_name" value="${esc(st.school_name||'مدرسة المنارة الخاصة')}"></div><div class="field"><label>الاسم بالإنكليزية</label><input id="set_en" value="${esc(st.school_name_en||'MANARA PRIVATE SCHOOL')}"></div><div class="field"><label>تأسست عام</label><input id="set_year" value="${esc(st.established_year||'2007')}"></div><div class="field"><label>السنة الدراسية</label><input id="set_academic" value="${esc(st.academic_year||'2026/2027')}"></div><div class="field"><label>رقم مدير المدرسة الأول</label><input id="set_phone" inputmode="tel" value="${esc(st.phone||'')}"></div><div class="field"><label>رقم مدير المدرسة الثاني</label><input id="set_phone2" inputmode="tel" value="${esc(st.phone2||'')}"></div><div class="field"><label>العنوان</label><input id="set_address" value="${esc(st.address||'')}"></div></div><button class="btn" onclick="saveSettings()">حفظ الإعدادات</button></div>
  <div class="card"><h3 class="section-title">حماية حساب الإدارة</h3><div class="message ok">🔐 التحقق بخطوتين (MFA) مفروض على حساب الإدارة قبل فتح لوحة التحكم أو تنفيذ العمليات الحساسة.</div><div class="hint">لا تشارك رمز تطبيق المصادقة أو كلمة المرور مع أي شخص.</div></div>
  <div class="card"><h3 class="section-title">تغيير كلمة مرور الإدارة</h3><div class="muted">يجب كتابة كلمة المرور الحالية أولاً. كلمة المرور الجديدة يجب أن تكون قوية.</div><div class="mini-grid"><div class="field"><label>كلمة المرور الحالية *</label><input id="admin_old_pass" type="password" autocomplete="current-password"></div><div class="field"><label>كلمة المرور الجديدة *</label><input id="admin_pass1" type="password" autocomplete="new-password"></div><div class="field"><label>تأكيد كلمة المرور *</label><input id="admin_pass2" type="password" autocomplete="new-password"></div></div><div id="adminPassMsg"></div><button class="btn" onclick="changeAdminPassword()">تغيير كلمة المرور</button></div>
  <div class="card"><h3 class="section-title">تعديل إيميل حساب الإدارة</h3><div class="muted">الحساب الحالي: <b>${esc(state.user?.email||'—')}</b>. يتطلب كلمة المرور الحالية والتحقق بخطوتين.</div><div class="mini-grid"><div class="field"><label>الإيميل الجديد *</label><input id="admin_new_email" type="email" autocomplete="email"></div><div class="field"><label>كلمة المرور الحالية *</label><input id="admin_email_old_pass" type="password" autocomplete="current-password"></div></div><div id="adminEmailMsg"></div><button class="btn" onclick="changeAdminEmail()">تغيير الإيميل</button></div>
  </div>`;
}
async function changeAdminPassword(){
  const oldp=document.getElementById('admin_old_pass').value,p1=document.getElementById('admin_pass1').value,p2=document.getElementById('admin_pass2').value,msg=document.getElementById('adminPassMsg');
  if(!oldp){msg.innerHTML='<div class="message error">اكتب كلمة المرور الحالية.</div>';return;}if(!strongPassword(p1)){msg.innerHTML='<div class="message error">كلمة المرور الجديدة يجب أن تكون 10 أحرف على الأقل وتحتوي حرفاً ورقماً ورمزاً.</div>';return;}if(p1!==p2){msg.innerHTML='<div class="message error">تأكيد كلمة المرور غير مطابق.</div>';return;}
  try{if(DEMO){msg.innerHTML='<div class="message ok">تم التغيير في النسخة التجريبية.</div>';return;}await invokeSecureFunction('manage-account',{action:'change_password',current_password:oldp,new_password:p1});document.getElementById('admin_old_pass').value='';document.getElementById('admin_pass1').value='';document.getElementById('admin_pass2').value='';msg.innerHTML='<div class="message ok">تم تغيير كلمة مرور الإدارة بنجاح.</div>';}catch(e){msg.innerHTML=`<div class="message error">${esc(authErrorArabic(e.message))}</div>`;}
}
async function changeAdminEmail(){
  const email=document.getElementById('admin_new_email').value.trim().toLowerCase(),oldp=document.getElementById('admin_email_old_pass').value,msg=document.getElementById('adminEmailMsg');if(!email||!email.includes('@')){msg.innerHTML='<div class="message error">اكتب إيميلاً صحيحاً.</div>';return;}if(!oldp){msg.innerHTML='<div class="message error">اكتب كلمة المرور الحالية.</div>';return;}
  try{const data=await invokeSecureFunction('manage-account',{action:'change_email',current_password:oldp,new_email:email});await sb.auth.refreshSession();state.user.email=email;document.getElementById('admin_email_old_pass').value='';document.getElementById('admin_new_email').value='';msg.innerHTML='<div class="message ok">تم تعديل إيميل الإدارة. استخدم الإيميل الجديد في تسجيل الدخول القادم.</div>';}catch(e){msg.innerHTML=`<div class="message error">${esc(authErrorArabic(e.message))}</div>`;}
}
async function saveSettings(){const row={school_name:document.getElementById('set_name').value.trim(),school_name_en:document.getElementById('set_en').value.trim(),established_year:document.getElementById('set_year').value.trim(),academic_year:document.getElementById('set_academic').value.trim(),phone:document.getElementById('set_phone').value.trim(),phone2:document.getElementById('set_phone2').value.trim(),address:document.getElementById('set_address').value.trim()};if(DEMO){Object.assign(state.data.settings,row);audit('تعديل','إعدادات المدرسة',row.school_name);saveDemo();render();}else{const id=state.data.settings?.id;let res=id?await sb.from('school_settings').update(row).eq('id',id):await sb.from('school_settings').insert(row);if(res.error)return alert(res.error.message);await loadSupabaseData();render();}}
window.manaraHandleBack=function(){
  if(document.getElementById('modal')){closeModal();return true;}
  if(state.sidebar){toggleSidebar(false);return true;}
  if(state.screen==='app'&&state.tab!=='home'){setTab('home');return true;}
  if(state.screen==='login'||state.screen==='reset'||state.screen==='mfa'||state.screen==='mfa-enroll'){goParent();return true;}
  if(state.screen==='parent'&&state.portal){state.portal=null;render();const code=localStorage.getItem(PARENT_CODE_KEY)||'';setTimeout(()=>{const el=document.getElementById('portalCode');if(el)el.value=code;},0);return true;}
  return false;
};
function noAccess(){return `<div class="card"><h3>لا توجد صلاحية</h3><p class="muted">هذا الحساب غير مخول لفتح هذه الصفحة.</p></div>`;}

/* =====================================================================
   MANARA V6.8 OVERRIDES
   - جلسة ثابتة حتى الضغط على تسجيل الخروج
   - لوحة إحصائيات الإدارة
   - الجرد الشهري + الفصلي + السنوي + طباعة/PDF
   - تقرير طالب PDF
   - أرشيف سنوي
   - نقل/ترقية الطالب
   - اسم الجد اختياري + هاتف دولي
   - QR محفوظ باسم الطالب داخل الصورة
   - اختيار QR من ألبوم iPhone/Windows
   ===================================================================== */
const V68_COUNTRY_CODES=[
  ['+963','سوريا'],['+971','الإمارات'],['+964','العراق'],['+966','السعودية'],['+962','الأردن'],['+961','لبنان'],['+965','الكويت'],['+974','قطر'],['+973','البحرين'],['+968','عُمان'],['+970','فلسطين'],['+20','مصر'],['+90','تركيا'],['+98','إيران'],['+962','الأردن'],['+212','المغرب'],['+213','الجزائر'],['+216','تونس'],['+218','ليبيا'],['+249','السودان'],['+967','اليمن'],['+252','الصومال'],['+253','جيبوتي'],['+269','جزر القمر'],['+31','هولندا'],['+32','بلجيكا'],['+33','فرنسا'],['+34','إسبانيا'],['+39','إيطاليا'],['+49','ألمانيا'],['+44','بريطانيا'],['+41','سويسرا'],['+43','النمسا'],['+45','الدنمارك'],['+46','السويد'],['+47','النرويج'],['+358','فنلندا'],['+353','إيرلندا'],['+351','البرتغال'],['+30','اليونان'],['+48','بولندا'],['+420','التشيك'],['+421','سلوفاكيا'],['+36','المجر'],['+40','رومانيا'],['+359','بلغاريا'],['+385','كرواتيا'],['+386','سلوفينيا'],['+381','صربيا'],['+387','البوسنة والهرسك'],['+389','مقدونيا الشمالية'],['+355','ألبانيا'],['+382','الجبل الأسود'],['+7','روسيا/كازاخستان'],['+380','أوكرانيا'],['+375','بيلاروس'],['+370','ليتوانيا'],['+371','لاتفيا'],['+372','إستونيا'],['+1','الولايات المتحدة/كندا'],['+52','المكسيك'],['+55','البرازيل'],['+54','الأرجنتين'],['+56','تشيلي'],['+57','كولومبيا'],['+51','بيرو'],['+58','فنزويلا'],['+593','الإكوادور'],['+591','بوليفيا'],['+595','باراغواي'],['+598','أوروغواي'],['+61','أستراليا'],['+64','نيوزيلندا'],['+86','الصين'],['+81','اليابان'],['+82','كوريا الجنوبية'],['+91','الهند'],['+92','باكستان'],['+880','بنغلادش'],['+94','سريلانكا'],['+977','نيبال'],['+93','أفغانستان'],['+62','إندونيسيا'],['+60','ماليزيا'],['+65','سنغافورة'],['+66','تايلاند'],['+63','الفلبين'],['+84','فيتنام'],['+852','هونغ كونغ'],['+886','تايوان'],['+27','جنوب أفريقيا'],['+234','نيجيريا'],['+254','كينيا'],['+251','إثيوبيا'],['+255','تنزانيا'],['+256','أوغندا'],['+233','غانا'],['+221','السنغال'],['+225','ساحل العاج'],['+237','الكاميرون']
];

function v68CountryOptions(){return V68_COUNTRY_CODES.map(x=>`<option value="${x[0]}">${x[0]} — ${esc(x[1])}</option>`).join('');}
function v68PhoneParts(v=''){
  const raw=String(v||'').trim();
  if(!raw)return {code:'+963',number:''};
  const ordered=V68_COUNTRY_CODES.slice().sort((a,b)=>b[0].length-a[0].length);
  const hit=ordered.find(x=>raw.startsWith(x[0]));
  if(hit)return {code:hit[0],number:raw.slice(hit[0].length).trim()};
  const m=raw.match(/^(\+\d{1,4})\s*(.*)$/);return m?{code:m[1],number:m[2]}:{code:'+963',number:raw};
}
function v68JoinPhone(code,number){
  const c=String(code||'').trim(),n=String(number||'').trim();
  if(!n)return '';
  const digits=n.replace(/\D/g,'');
  if(!digits)return '';
  if(n.startsWith('+'))return '+'+digits;
  const safeCode=/^\+\d{1,4}$/.test(c)?c:'';
  if(!safeCode)return digits;
  return safeCode+digits.replace(/^0+/,'');
}
function v611CleanName(v=''){return String(v||'').replace(/\s+/g,' ').trim();}
function v611CombineStudentName(name,family){
  const n=v611CleanName(name),f=v611CleanName(family);
  if(!f)return n;
  const nn=n.toLocaleLowerCase('ar'),ff=f.toLocaleLowerCase('ar');
  return (nn===ff||nn.endsWith(' '+ff))?n:`${n} ${f}`;
}
function v68Percent(score,max){score=Number(score||0);max=Number(max||0);return max>0?((score/max)*100).toFixed(1)+'%':'—';}
function v68AcademicYearForDate(dateStr){const d=new Date((dateStr||today())+'T00:00:00');const y=d.getFullYear(),m=d.getMonth()+1;return m>=9?`${y}/${y+1}`:`${y-1}/${y}`;}
function v68TeacherNamesForRoom(roomId){
  const ids=(state.data?.teacherAssignments||[]).filter(a=>String(a.room_id)===String(roomId)).map(a=>a.teacher_id);
  return ids.map(id=>state.data?.teachers?.find(t=>String(t.id)===String(id))?.full_name).filter(Boolean);
}
function v68EnsurePrintStyles(){
  if(document.getElementById('manaraV68PrintStyles'))return;
  const st=document.createElement('style');st.id='manaraV68PrintStyles';st.textContent=`
  @media print{
    @page{size:A4;margin:11mm}
    body *{visibility:hidden!important}
    .print-target,.print-target *{visibility:visible!important}
    .print-target{position:absolute!important;inset:0 auto auto 0!important;width:100%!important;max-width:none!important;background:#fff!important;color:#111!important;box-shadow:none!important;border:none!important;padding:0!important;margin:0!important}
    .print-hide{display:none!important}
    table{width:100%!important;border-collapse:collapse!important;font-size:11px!important}
    th,td{border:1px solid #bbb!important;padding:6px!important}
    .card{box-shadow:none!important;border:1px solid #ddd!important}
    #manaraDesignerCredit{display:none!important}
  }`;
  document.head.appendChild(st);
}
function printElement(id){
  v68EnsurePrintStyles();document.querySelectorAll('.print-target').forEach(x=>x.classList.remove('print-target'));
  const el=document.getElementById(id);if(!el)return alert('تعذر تجهيز التقرير للطباعة.');el.classList.add('print-target');
  if(isAndroidApp()&&window.ManaraAndroid&&typeof window.ManaraAndroid.printPage==='function'){try{window.ManaraAndroid.printPage();return;}catch(_){}}
  window.print();
}
function returnToDashboard(){if(state.user&&state.role){state.screen='app';state.tab=state.tab||'home';render();}else goLogin();}
function goParent(){state.screen='parent';state.portal=null;render();}
function goLogin(){if(state.user&&state.role){state.screen='app';render();return;}state.screen='login';render();}

async function establishSupabaseUser(user){
  let profile=null,lastError=null;
  for(let i=0;i<3;i++){
    const res=await sb.from('profiles').select('id,full_name,role,active').eq('id',user.id).maybeSingle();
    if(!res.error){profile=res.data;break;}lastError=res.error;if(i<2)await new Promise(r=>setTimeout(r,450*(i+1)));
  }
  if(lastError&&!profile)throw new Error('تعذر الاتصال للتحقق من الحساب. لم يتم تسجيل خروجك؛ تحقق من الإنترنت وحاول مرة أخرى.');
  if(!profile||!profile.active){await sb.auth.signOut();throw new Error('هذا الحساب غير فعال أو غير مصرح له.');}
  if(profile.role==='admin'){
    const [{data:aal,error:aalErr},{data:factors,error:fErr}]=await Promise.all([sb.auth.mfa.getAuthenticatorAssuranceLevel(),sb.auth.mfa.listFactors()]);
    if(aalErr||fErr)throw new Error('تعذر التحقق من حماية الحساب حالياً. لم يتم تسجيل خروجك.');
    const verified=[...(factors?.totp||[]),...(factors?.phone||[])].filter(f=>f.status==='verified');
    state.pendingAuthUser=user;state.pendingAuthProfile=profile;
    if(!verified.length){state.screen='mfa-enroll';return;}
    if(aal?.currentLevel!=='aal2'){state.screen='mfa';return;}
  }
  await completeSupabaseUser(user,profile);
}

async function loadSupabaseData(){
  if(DEMO)return;
  const safe=(r,def)=>r?.error?def:(r?.data??def);
  if(state.role==='admin'){
    const [st,at,gr,an,su,pr,se,au,bu,fl,ro,sn,pn,ta,yrs,yrrec,dash]=await Promise.all([
      sb.from('students').select('*,rooms(id,code,name,grade,section_label,floor_id,floors(name,building_id,buildings(name)))').order('created_at',{ascending:false}),
      sb.from('attendance').select('*').order('date',{ascending:false}).limit(5000),
      sb.from('grades').select('*,grade_items(title,max_score,exam_date,academic_year,subjects(name))').order('created_at',{ascending:false}).limit(5000),
      sb.from('announcements').select('*').order('created_at',{ascending:false}),
      sb.from('subjects').select('*').order('name'),
      sb.from('profiles').select('id,full_name,role,active,created_at').eq('role','teacher').order('created_at',{ascending:false}),
      sb.from('school_settings').select('*').limit(1).maybeSingle(),
      sb.from('audit_logs').select('*').order('created_at',{ascending:false}).limit(300),
      sb.from('buildings').select('*').order('code'),
      sb.from('floors').select('*').order('floor_order'),
      sb.from('rooms').select('*').order('room_order'),
      sb.from('student_notes').select('*').order('created_at',{ascending:false}).limit(1000),
      sb.from('parent_notifications').select('*').order('created_at',{ascending:false}).limit(1000),
      sb.from('teacher_room_assignments').select('*'),
      sb.from('academic_years').select('*').order('label',{ascending:false}),
      sb.from('student_year_records').select('*').order('student_name'),
      sb.rpc('report_dashboard_stats',{p_date:today()})
    ]);
    const students=safe(st,[]).map(x=>({...x,room_name:x.rooms?.name,room_code:x.rooms?.code,floor_name:x.rooms?.floors?.name,building_name:x.rooms?.floors?.buildings?.name,location_label:x.rooms?`${x.rooms?.floors?.buildings?.name||''} / ${x.rooms?.name||''}`:''}));
    state.data={students,attendance:safe(at,[]),grades:safe(gr,[]).map(x=>({...x,exam_name:x.grade_items?.title,max_score:x.grade_items?.max_score,date:x.grade_items?.exam_date,academic_year:x.grade_items?.academic_year,subject_name:x.grade_items?.subjects?.name})),announcements:safe(an,[]),subjects:safe(su,[]),teachers:safe(pr,[]),settings:safe(se,{}),audit:safe(au,[]),buildings:safe(bu,[]),floors:safe(fl,[]),rooms:safe(ro,[]),studentNotes:await hydrateNoteImages(safe(sn,[])),notifications:safe(pn,[]),teacherAssignments:safe(ta,[]),academicYears:safe(yrs,[]),studentYearRecords:safe(yrrec,[]),dashboardStats:safe(dash,null)};
  }else{
    const [st,at,se,bu,fl,ro,sn,ta,yrs]=await Promise.all([
      sb.from('students').select('*,rooms(id,code,name,grade,section_label,floor_id,floors(name,building_id,buildings(name)))').order('created_at',{ascending:false}),
      sb.from('attendance').select('*').order('date',{ascending:false}).limit(5000),
      sb.from('school_settings').select('*').limit(1).maybeSingle(),
      sb.from('buildings').select('*').order('code'),
      sb.from('floors').select('*').order('floor_order'),
      sb.from('rooms').select('*').order('room_order'),
      sb.from('student_notes').select('*').order('created_at',{ascending:false}).limit(1000),
      sb.from('teacher_room_assignments').select('*').eq('teacher_id',state.user.id),
      sb.from('academic_years').select('*').order('label',{ascending:false})
    ]);
    const teacherAssignments=safe(ta,[]),allowedRooms=new Set(teacherAssignments.map(x=>String(x.room_id)));
    const students=safe(st,[]).map(x=>({...x,room_name:x.rooms?.name,room_code:x.rooms?.code,floor_name:x.rooms?.floors?.name,building_name:x.rooms?.floors?.buildings?.name,location_label:x.rooms?`${x.rooms?.floors?.buildings?.name||''} / ${x.rooms?.name||''}`:''})).filter(x=>allowedRooms.has(String(x.room_id)));
    const allowedStudentIds=new Set(students.map(x=>String(x.id)));
    const attendance=safe(at,[]).filter(x=>allowedStudentIds.has(String(x.student_id))),teacherNotes=safe(sn,[]).filter(x=>allowedStudentIds.has(String(x.student_id)));
    state.data={students,attendance,grades:[],announcements:[],subjects:[],teachers:[],settings:safe(se,{}),audit:[],buildings:safe(bu,[]),floors:safe(fl,[]),rooms:safe(ro,[]),studentNotes:await hydrateNoteImages(teacherNotes),notifications:[],teacherAssignments,academicYears:safe(yrs,[]),studentYearRecords:[],dashboardStats:null};
  }
}

function navItems(){
  if(state.role==='teacher') return [['home','⌂','الرئيسية'],['students','♟','طلابي'],['attendance','✓','الحضور والغياب'],['reports','▥','الجرد الشهري'],['notes','✎','ملاحظات الطلاب']];
  return [['home','⌂','الرئيسية'],['buildings','▦','الصفوف والشعب'],['students','♟','الطلاب'],['attendance','✓','الحضور والغياب'],['reports','▥','الجرد الشهري'],['archive','▧','الأرشيف السنوي'],['notes','✎','ملاحظات الطلاب'],['grades','▤','النتائج'],['announcements','◉','الإعلانات'],['teachers','♙','المدرسون'],['audit','≡','سجل العمليات'],['settings','⚙','الإعدادات']];
}
function appPage(){
  const labels={home:'الرئيسية',buildings:'الصفوف والشعب',students:'الطلاب',attendance:'الحضور والغياب',reports:'الجرد الشهري',archive:'الأرشيف السنوي',notes:'ملاحظات الطلاب',grades:'النتائج',announcements:'الإعلانات',teachers:'إدارة المدرسين',audit:'سجل العمليات',settings:'الإعدادات'};
  if(state.role==='teacher'&&!['home','students','attendance','reports','notes'].includes(state.tab))state.tab='home';
  return `<div class="app-shell"><aside class="sidebar ${state.sidebar?'open':''}"><div class="side-brand">${logo()}<div><b>${esc(state.data?.settings?.school_name||'مدرسة المنارة الخاصة')}</b><small>MANARA PRIVATE SCHOOL</small></div><button class="drawer-close" onclick="toggleSidebar(false)" aria-label="إغلاق">×</button></div><div class="user-card"><b>${esc(state.user?.name||'')}</b><small>${state.role==='admin'?'مدير النظام — تحكم كامل':'مدرس — الشعب المخصصة فقط'}</small></div><div class="side-label">القائمة الرئيسية</div><nav class="side-nav">${navItems().map(n=>`<button class="${state.tab===n[0]?'active':''}" onclick="setTab('${n[0]}')"><i class="nav-icon">${n[1]}</i>${n[2]}</button>`).join('')}</nav><div class="side-label" style="margin-top:16px">الحساب</div><nav class="side-nav"><button onclick="goParent()"><i class="nav-icon">◫</i>معاينة بوابة الأهل</button><button onclick="logout()"><i class="nav-icon">↪</i>تسجيل الخروج</button></nav></aside><div class="drawer-backdrop ${state.sidebar?'show':''}" onclick="toggleSidebar(false)"></div>
  <main class="main"><header class="topbar"><div class="row"><button class="btn outline mobile-menu" onclick="toggleSidebar()">☰</button><div class="page-title"><b>${labels[state.tab]||''}</b><small>${state.role==='admin'?'لوحة الإدارة الرئيسية':'طلابك وشعبك فقط'}</small></div></div><img class="top-logo" src="logo.jpg" alt=""><div class="top-actions"><span class="badge ${state.role}">${state.role==='admin'?'الإدارة':'مدرس'}</span></div></header><section class="content"><img class="content-watermark" src="logo.jpg" alt="">${pageContent()}</section></main></div>`;
}

function parentPage(){
  const accountBtn=state.user&&state.role?`<button class="btn outline" onclick="returnToDashboard()">↩ العودة للوحة ${state.role==='admin'?'الإدارة':'المدرس'}</button>`:`<button class="btn outline" onclick="goLogin()">دخول الإدارة / المدرسين</button>`;
  return `<div class="public-page"><div class="public-shell"><div class="public-header">${brandLockup()}${accountBtn}</div><div class="portal-grid"><section class="portal-hero">${logo()}<h1>بوابة ولي الأمر</h1><p>تابع حضور الطالب وغيابه وتأخيره ونتائجه وإعلانات المدرسة باستخدام الكود الخاص بالطالب.</p><div class="hint" style="color:#bcd4c5">فتح بوابة ولي الأمر من حساب الإدارة أو المدرس لا يسجل خروج الحساب.</div></section><section class="auth-card"><h2>عرض ملف الطالب</h2><p class="muted">اكتب كود الطالب أو امسح QR أو اختر صورة QR من ألبوم الصور.</p><div class="field"><label>كود الطالب</label><input id="portalCode" autocomplete="off" placeholder="MN-ABCD-2345" onkeydown="if(event.key==='Enter') findStudentPortal()"></div><div class="row" style="gap:10px;flex-wrap:wrap"><button class="btn" onclick="findStudentPortal()">عرض الملف</button><button class="btn secondary" onclick="scanParentQr()">📷 مسح QR</button><button class="btn secondary" onclick="chooseParentQrImage()">🖼️ اختيار صورة QR</button></div><div class="hint" style="margin-top:10px">يدعم اختيار صورة QR على Android وiPhone وWindows والمتصفح.</div><div id="portalMessage"></div></section></div><div id="portalResult" class="section">${state.portal?portalHtml(state.portal):''}</div></div></div>`;
}

function page_home(){
  const d=state.data||{},at=(d.attendance||[]).filter(x=>x.date===today());
  if(state.role==='teacher'){
    return `<div class="role-note">حسابك يبقى مسجلاً حتى تضغط «تسجيل الخروج». صلاحيتك محصورة بالشعب التي حددتها الإدارة.</div><div class="kpi-grid section"><div class="card kpi"><div><b>الطلاب المسموحون</b><strong>${d.students?.length||0}</strong></div><div class="kpi-icon">♟</div></div><div class="card kpi"><div><b>غائب اليوم</b><strong>${at.filter(x=>x.status==='غائب').length}</strong></div><div class="kpi-icon">×</div></div><div class="card kpi"><div><b>متأخر اليوم</b><strong>${at.filter(x=>x.status==='متأخر').length}</strong></div><div class="kpi-icon">⏱</div></div><div class="card kpi"><div><b>سجلات اليوم</b><strong>${at.length}</strong></div><div class="kpi-icon">✓</div></div></div><div class="two-col section"><div class="card"><div class="row between"><div><h3 class="section-title">الجرد الشهري</h3><div class="muted">الجرد خاص بطلاب الشعب المخصصة لك فقط.</div></div><button class="btn" onclick="setTab('reports')">فتح الجرد</button></div></div><div class="card"><div class="row between"><div><h3 class="section-title">الحضور اليومي</h3><div class="muted">تسجيل الغياب والتأخير.</div></div><button class="btn secondary" onclick="setTab('attendance')">فتح السجل</button></div></div></div>`;
  }
  const s=d.dashboardStats||{},cmp=Number(s.month_compare_pct||0),cmpText=cmp===0?'لا تغيير':(cmp>0?`زيادة ${Math.abs(cmp)}%`:`انخفاض ${Math.abs(cmp)}%`),cmpBadge=cmp>0?'absent':cmp<0?'active':'warning';
  const gr=d.grades||[],unread=(d.notifications||[]).filter(n=>!n.seen_at).length;
  return `<div class="kpi-grid"><div class="card kpi"><div><b>إجمالي الطلاب</b><strong>${moneyLike(s.total_students??d.students?.length)}</strong></div><div class="kpi-icon">♟</div></div><div class="card kpi"><div><b>حاضر اليوم</b><strong>${moneyLike(s.present??at.filter(x=>x.status==='حاضر').length)}</strong></div><div class="kpi-icon">✓</div></div><div class="card kpi"><div><b>غائب اليوم</b><strong>${moneyLike(s.absent??at.filter(x=>x.status==='غائب').length)}</strong></div><div class="kpi-icon">×</div></div><div class="card kpi"><div><b>متأخر اليوم</b><strong>${moneyLike(s.late??at.filter(x=>x.status==='متأخر').length)}</strong></div><div class="kpi-icon">⏱</div></div></div>
  <div class="two-col section"><div class="card"><h3 class="section-title">إحصائيات اليوم</h3><div class="stack"><div class="row between"><span>غير مسجل حضورهم بعد</span><b>${moneyLike(s.unrecorded||0)}</b></div><div class="row between"><span>أكثر شعبة غياباً اليوم</span><b>${esc(s.most_absent_room||'—')} ${Number(s.most_absent_room_count||0)?`(${s.most_absent_room_count})`:''}</b></div><div class="row between"><span>غياب هذا الشهر</span><b>${moneyLike(s.current_month_absent||0)}</b></div><div class="row between"><span>مقارنة بالشهر السابق</span><span class="badge ${cmpBadge}">${cmpText}</span></div></div></div><div class="card"><h3 class="section-title">اختصارات التقارير</h3><div class="stack"><button class="btn" onclick="setTab('reports')">الجرد الشهري والمجاميع</button><button class="btn secondary" onclick="setTab('archive')">الأرشيف السنوي</button><div class="row between"><span>نتائج مسجلة محلياً</span><b>${gr.length}</b></div><div class="row between"><span>إشعارات أهل غير مقروءة</span><b>${unread}</b></div></div></div></div>
  <div class="card section"><div class="row between"><h3 class="section-title">آخر الطلاب المضافين</h3><button class="btn small secondary" onclick="setTab('students')">عرض الكل</button></div><div class="table-wrap"><table><thead><tr><th>الطالب</th><th>الصف</th><th>الموقع</th><th>الكود</th><th>تقرير</th></tr></thead><tbody>${(d.students||[]).slice(0,8).map(st=>`<tr><td><b>${esc(st.full_name)}</b></td><td>${esc(st.grade||'—')}</td><td>${esc(st.location_label||roomLocation(st.room_id))}</td><td><span class="code">${esc(st.access_code||'')}</span></td><td><button class="btn small" onclick="openStudentReport('${st.id}')">PDF</button></td></tr>`).join('')||'<tr><td colspan="5" class="empty">لا يوجد طلاب بعد</td></tr>'}</tbody></table></div></div>`;
}

function page_students(){
  if(!['admin','teacher'].includes(state.role))return noAccess();const teacher=state.role==='teacher';
  return `<div class="toolbar"><div><h2 class="section-title">${teacher?'طلاب الشعب المخصصة لي':'سجل الطلاب'}</h2><div class="muted">${teacher?'طلابك فقط مع إمكانية التقرير والطباعة.':'إدارة الطلاب، التقارير، النقل والترقية بين الشعب.'}</div></div><button class="btn" onclick="openStudentModal()">+ تسجيل طالب جديد</button></div>${teacher?`<div class="role-note">الشعب المخصصة لك: <b>${assignedRoomsLabel(state.user.id)}</b></div>`:''}<div class="card"><div class="toolbar"><div class="field search"><label>بحث سريع</label><input id="studentSearch" placeholder="الاسم، الكود، الصف..." oninput="filterStudentTable()"></div><div class="hint">عدد الطلاب: <b>${state.data.students.length}</b></div></div><div id="studentTable">${studentTableHtml()}</div></div>`;
}
function studentTableHtml(q=''){
  q=q.toLowerCase();const rows=(state.data.students||[]).filter(st=>!q||[st.full_name,st.father_name,st.grandfather_name,st.access_code,st.grade,st.class_name,st.location_label,roomLocation(st.room_id)].some(v=>String(v||'').toLowerCase().includes(q)));
  return `<div class="table-wrap"><table><thead><tr><th>الطالب</th><th>الأب</th><th>الجد</th><th>الصف</th><th>الموقع</th><th>الكود</th><th>إجراء</th></tr></thead><tbody>${rows.map(st=>`<tr><td><b>${esc(st.full_name)}</b></td><td>${esc(st.father_name||'—')}</td><td>${esc(st.grandfather_name||'—')}</td><td>${esc(st.grade||'—')} ${st.class_name?`/ ${esc(st.class_name)}`:''}</td><td>${esc(st.location_label||roomLocation(st.room_id))}</td><td><span class="code">${esc(st.access_code||'')}</span></td><td><div class="row" style="flex-wrap:wrap"><button class="btn small secondary" onclick="openStudentModal('${st.id}')">تعديل</button>${state.role==='admin'?`<button class="btn small warning" onclick="openMoveStudentModal('${st.id}')">نقل / ترقية</button><button class="btn small warning" onclick="regenerateCode('${st.id}')">كود جديد</button>`:''}<button class="btn small secondary" onclick="showStudentQr('${st.id}')">QR</button><button class="btn small" onclick="openStudentReport('${st.id}')">تقرير PDF</button><button class="btn small" onclick="openNoteModal('${st.id}')">ملاحظة</button><button class="btn small danger" onclick="deleteStudent('${st.id}')">حذف</button></div></td></tr>`).join('')||'<tr><td colspan="7" class="empty">لا توجد نتائج</td></tr>'}</tbody></table></div>`;
}

function openStudentModal(id=''){
  const st=state.data.students.find(x=>x.id===id)||{},teacher=state.role==='teacher',pp=v68PhoneParts(st.parent_phone||'');
  if(teacher&&assignedRoomIds().length===0){alert('لا توجد شعبة مخصصة لحسابك بعد.');return;}
  const codes=`<datalist id="countryCodes">${V68_COUNTRY_CODES.map(x=>`<option value="${x[0]}">${esc(x[1])}</option>`).join('')}</datalist>`;
  document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="modal"><div class="modalbox"><div class="row between"><div><h2 class="section-title">${id?'تعديل ملف الطالب':'تسجيل طالب جديد'}</h2><div class="muted">رقم ولي الأمر يدعم أي نداء دولي، واسم الجد اختياري.</div></div><button class="btn outline" onclick="closeModal()">إغلاق</button></div><div id="modalMsg"></div>
  <div class="section"><h3 class="section-title">المعلومات الشخصية</h3><div class="mini-grid"><div class="field"><label>اسم الطالب *</label><input id="s_full" value="${esc(st.full_name||'')}" autocomplete="off"></div><div class="field"><label>كنية الطالب / النسبة</label><input id="s_family" value="${esc(st.family_name||'')}" autocomplete="off" placeholder="مثال: بكاري"></div><div class="field"><label>اسم الأب</label><input id="s_father" value="${esc(st.father_name||'')}"></div><div class="field"><label>اسم الأم الكامل</label><input id="s_mother" value="${esc(st.mother_name||'')}"></div><div class="field"><label>اسم الجد — اختياري</label><input id="s_grand" value="${esc(st.grandfather_name||'')}" placeholder="اختياري"></div><div class="field"><label>تاريخ الميلاد</label><input id="s_birth" type="date" value="${esc(st.date_of_birth||'')}"></div><div class="field"><label>الجنس</label><select id="s_gender"><option value="">—</option><option ${st.gender==='ذكر'?'selected':''}>ذكر</option><option ${st.gender==='أنثى'?'selected':''}>أنثى</option></select></div></div></div>
  <div class="section"><h3 class="section-title">معلومات الشعبة</h3><div class="mini-grid"><div class="field"><label>الصف *</label><input id="s_grade" value="${esc(st.grade||'')}" readonly></div><div class="field"><label>الشعبة *</label><input id="s_class" value="${esc(st.class_name||'')}" readonly></div><div class="field"><label>اختيار الصف والشعبة *</label><select id="s_room" onchange="syncStudentRoom()">${roomOptions(st.room_id||'')}</select></div></div></div>
  <div class="section"><h3 class="section-title">معلومات الاتصال</h3><div class="mini-grid"><div class="field"><label>النداء الدولي</label><input id="s_country_code" list="countryCodes" inputmode="tel" value="${esc(pp.code)}" placeholder="+963">${codes}<div class="hint">يمكن كتابة أي نداء دولي حتى لو لم يظهر بالقائمة.</div></div><div class="field"><label>رقم هاتف ولي الأمر</label><input id="s_phone" inputmode="tel" value="${esc(pp.number)}" placeholder="مثال: 9XXXXXXXX"></div><div class="field"><label>العنوان</label><input id="s_address" value="${esc(st.address||'')}"></div><div class="field"><label>الحالة</label><select id="s_active"><option value="true" ${st.active!==false?'selected':''}>فعال</option><option value="false" ${st.active===false?'selected':''}>موقوف</option></select></div></div></div>
  <div class="section"><h3 class="section-title">المواصلات</h3><div class="mini-grid"><div class="field"><label>رقم السيارة — اختياري</label><input id="s_transport" value="${esc(st.transport_car_number||'')}" placeholder="اختياري"></div></div></div><div class="field"><label>ملاحظة</label><textarea id="s_notes">${esc(st.notes||'')}</textarea></div><button class="btn" onclick="saveStudent('${id}')">${id?'حفظ التعديلات':'حفظ وإنشاء كود الطالب'}</button></div></div>`);
}
async function saveStudent(id=''){
  const msg=document.getElementById('modalMsg');let newStudentId='';const full=document.getElementById('s_full').value.trim(),grand=document.getElementById('s_grand').value.trim(),grade=document.getElementById('s_grade').value.trim(),room_id=document.getElementById('s_room').value||null;
  if(!full||!grade||!room_id){msg.innerHTML='<div class="message error">اسم الطالب والصف والشعبة حقول إلزامية. اسم الجد اختياري.</div>';return;}
  if(state.role==='teacher'&&!assignedRoomIds().map(String).includes(String(room_id))){msg.innerHTML='<div class="message error">لا يمكنك إضافة طالب إلى شعبة غير مخصصة لك.</div>';return;}
  const row={full_name:full,family_name:family,father_name:document.getElementById('s_father').value.trim(),mother_name:document.getElementById('s_mother').value.trim(),grandfather_name:grand,grade,class_name:document.getElementById('s_class').value.trim(),room_id,gender:document.getElementById('s_gender').value,date_of_birth:document.getElementById('s_birth').value||null,parent_phone:v68JoinPhone(document.getElementById('s_country_code').value,document.getElementById('s_phone').value),address:document.getElementById('s_address').value.trim(),active:document.getElementById('s_active')?.value!=='false',transport_car_number:document.getElementById('s_transport').value.trim(),notes:document.getElementById('s_notes')?.value.trim()||''};
  const dup=duplicateStudentLocal(row,id);if(!id&&dup){msg.innerHTML='<div class="message error"><b>الطالب موجود مسبقاً.</b></div>';return;}
  try{if(DEMO){const room=state.data.rooms.find(r=>r.id===room_id),f=state.data.floors.find(x=>x.id===room?.floor_id),b=state.data.buildings.find(x=>x.id===f?.building_id);Object.assign(row,{room_name:room?.name,room_code:room?.code,floor_name:f?.name,building_name:b?.name,location_label:roomLocation(room_id)});if(id){Object.assign(state.data.students.find(x=>x.id===id),row);}else{row.id=uid();newStudentId=row.id;row.access_code=makeStudentCode();row.created_at=new Date().toISOString();state.data.students.unshift(row);}saveDemo();}else{const data=await invokeSecureFunction('manage-student',{action:id?'update':'create',student_id:id||undefined,student:row});newStudentId=data?.student?.id||id||'';await loadSupabaseData();}closeModal();render();if(!id&&newStudentId)setTimeout(()=>showStudentQr(newStudentId),120);}catch(e){msg.innerHTML=`<div class="message error">${esc(authErrorArabic(e.message))}</div>`;}
}

function openMoveStudentModal(id){
  if(state.role!=='admin')return alert('النقل والترقية متاحان للإدارة فقط.');const st=state.data.students.find(x=>x.id===id);if(!st)return;
  document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="modal"><div class="modalbox" style="max-width:650px"><div class="row between"><div><h2 class="section-title">نقل / ترقية الطالب</h2><div class="muted">${esc(st.full_name)} — حالياً: ${esc(st.grade||'')} / ${esc(st.class_name||'')}</div></div><button class="btn outline" onclick="closeModal()">إغلاق</button></div><div class="message ok">إذا كانت ترقية لسنة جديدة، غيّر أولاً «السنة الدراسية» من الإعدادات (مثلاً 2027/2028)، ثم انقل الطالب. ستبقى سنته القديمة محفوظة في الأرشيف.</div><div class="field"><label>الشعبة الجديدة *</label><select id="move_room">${roomOptions(st.room_id||'')}</select></div><div id="modalMsg"></div><button class="btn" onclick="saveMoveStudent('${id}')">تأكيد النقل / الترقية</button></div></div>`);
}
async function saveMoveStudent(id){const room=document.getElementById('move_room')?.value,msg=document.getElementById('modalMsg');if(!room){msg.innerHTML='<div class="message error">اختر الشعبة الجديدة.</div>';return;}try{await invokeSecureFunction('manage-student',{action:'move',student_id:id,target_room_id:room});await loadSupabaseData();closeModal();render();alert('تم نقل الطالب وحفظ السنة في الأرشيف.');}catch(e){msg.innerHTML=`<div class="message error">${esc(authErrorArabic(e.message))}</div>`;}}

function page_buildings(){
  if(state.role!=='admin')return noAccess();
  const sorted=(state.data.rooms||[]).slice().sort((a,b)=>String(a.grade||'').localeCompare(String(b.grade||''),'ar')||String(a.section_label||'').localeCompare(String(b.section_label||''),'ar'));
  const rows=sorted.map(r=>{const f=state.data.floors.find(x=>x.id===r.floor_id),b=state.data.buildings.find(x=>x.id===f?.building_id),count=state.data.students.filter(st=>String(st.room_id)===String(r.id)).length,names=v68TeacherNamesForRoom(r.id);return `<tr><td><b>${esc(b?.name||'')}</b></td><td>${esc(r.grade||'—')}</td><td>${esc(r.section_label||'—')}</td><td>${count}</td><td>${names.map(n=>`<span class="badge teacher" style="margin:2px">${esc(n)}</span>`).join('')||'<span class="badge warning">لا يوجد مدرس</span>'}</td><td><div class="row"><button class="btn small secondary" onclick="openRoomModal('${r.id}')">تعديل</button><button class="btn small danger" onclick="deleteRoom('${r.id}')">حذف</button></div></td></tr>`}).join('');
  const teacherCards=(state.data.teachers||[]).map(t=>`<div class="card"><div class="row between"><b>${esc(t.full_name)}</b><span class="badge ${t.active===false?'inactive':'active'}">${t.active===false?'موقوف':'فعال'}</span></div><div class="hint" style="margin-top:8px">${assignedRoomIds(t.id).map(id=>roomLocation(id)).join(' • ')||'لم تحدد شعب لهذا الحساب'}</div></div>`).join('');
  return `<div class="toolbar"><div><h2 class="section-title">الصفوف والشعب</h2><div class="muted">كل شعبة مرتبة مع أسماء حسابات المدرسين المخصصة لها.</div></div><button class="btn" onclick="openRoomModal()">+ إضافة صف / شعبة</button></div><div class="card"><div class="table-wrap"><table><thead><tr><th>القسم</th><th>الصف</th><th>الشعبة</th><th>الطلاب</th><th>المدرسون / الحسابات</th><th>إجراء</th></tr></thead><tbody>${rows||'<tr><td colspan="6" class="empty">لا توجد شعب</td></tr>'}</tbody></table></div></div><div class="section"><h3 class="section-title">حسابات المدرسين وتوزيع الشعب</h3><div class="building-grid">${teacherCards||'<div class="card empty">لا يوجد مدرسون</div>'}</div></div>`;
}

function reportRoomOptions(){const allowed=state.role==='teacher'?new Set(assignedRoomIds().map(String)):null;return `<option value="">كل الشعب المسموحة</option>`+(state.data.rooms||[]).filter(r=>!allowed||allowed.has(String(r.id))).map(r=>`<option value="${r.id}" ${String(state.reportRoom||'')===String(r.id)?'selected':''}>${esc(roomLocation(r.id))}</option>`).join('');}
function page_reports(){
  if(!['admin','teacher'].includes(state.role))return noAccess();const month=state.reportMonth||today().slice(0,7),rows=state.monthlyReport||[];
  const table=rows.length?`<div id="monthlyReportPrint" class="card section"><div style="text-align:center;margin-bottom:12px"><h2 style="margin:0">${esc(state.data.settings?.school_name||'مدرسة منارة العلم الخاصة')}</h2><div>الجرد الشهري — ${esc(month)} — السنة ${esc(v68AcademicYearForDate(month+'-01'))}</div></div><div class="table-wrap"><table><thead><tr><th>الطالب</th><th>الصف/الشعبة</th><th>حاضر</th><th>غائب</th><th>متأخر</th><th>مجموع الشهر</th><th>الفصل الأول</th><th>الفصل الثاني</th><th>السنوي</th></tr></thead><tbody>${rows.map(r=>`<tr><td><b>${esc(r.student_name)}</b></td><td>${esc(r.grade||'')} / ${esc(r.class_name||'')}</td><td>${r.present_count||0}</td><td>${r.absent_count||0}</td><td>${r.late_count||0}</td><td>${v68Percent(r.monthly_score,r.monthly_max)}</td><td>${v68Percent(r.term1_score,r.term1_max)}</td><td>${v68Percent(r.term2_score,r.term2_max)}</td><td><b>${v68Percent(r.year_score,r.year_max)}</b></td></tr>`).join('')}</tbody></table></div><div class="hint" style="margin-top:10px">المجاميع تحسب من النتائج المسجلة داخل النظام. الحضور والغياب حسب الشهر المختار.</div></div>`:'<div class="card empty">اختر الشهر والشعبة ثم اضغط «عرض الجرد».</div>';
  return `<div class="toolbar"><div><h2 class="section-title">الجرد الشهري والمجاميع</h2><div class="muted">${state.role==='teacher'?'يعرض فقط طلاب الشعب المخصصة لك.':'جرد شهري مع المجموع الفصلي والسنوي، قابل للطباعة والحفظ PDF.'}</div></div>${rows.length?`<button class="btn" onclick="printElement('monthlyReportPrint')">🖨 طباعة / PDF</button>`:''}</div><div class="card"><div class="row filters"><div class="field"><label>الشهر</label><input id="reportMonth" type="month" value="${esc(month)}"></div><div class="field"><label>الشعبة</label><select id="reportRoom">${reportRoomOptions()}</select></div><div class="field" style="align-self:end"><button class="btn" onclick="loadMonthlyReport()">عرض الجرد</button></div></div></div>${table}`;
}
async function loadMonthlyReport(){const month=document.getElementById('reportMonth')?.value||today().slice(0,7),room=document.getElementById('reportRoom')?.value||'';state.reportMonth=month;state.reportRoom=room;try{if(DEMO){state.monthlyReport=(state.data.students||[]).map(s=>({student_id:s.id,student_name:s.full_name,grade:s.grade,class_name:s.class_name,present_count:0,absent_count:0,late_count:0,monthly_score:0,monthly_max:0,term1_score:0,term1_max:0,term2_score:0,term2_max:0,year_score:0,year_max:0}));render();return;}const {data,error}=await sb.rpc('report_monthly_inventory',{p_month:month+'-01',p_room_id:room||null});if(error)throw error;state.monthlyReport=data||[];render();}catch(e){alert('تعذر تحميل الجرد: '+authErrorArabic(e.message));}}

function page_archive(){
  if(state.role!=='admin')return noAccess();const years=(state.data.academicYears||[]).map(x=>x.label),current=state.archiveYear||state.data.settings?.academic_year||years[0]||'2026/2027';state.archiveYear=current;const rows=(state.data.studentYearRecords||[]).filter(x=>x.academic_year===current);const active=rows.filter(x=>x.active!==false).length;
  return `<div class="toolbar"><div><h2 class="section-title">الأرشيف السنوي</h2><div class="muted">كل سنة دراسية تبقى محفوظة بشكل مستقل، مثل 2026/2027 وما بعدها.</div></div><div class="row"><button class="btn secondary" onclick="snapshotCurrentYear()">تثبيت السنة الحالية</button>${rows.length?`<button class="btn" onclick="printElement('archivePrint')">🖨 طباعة / PDF</button>`:''}</div></div><div class="card"><div class="row filters"><div class="field"><label>السنة الدراسية</label><select onchange="state.archiveYear=this.value;render()">${years.map(y=>`<option value="${esc(y)}" ${y===current?'selected':''}>${esc(y)}</option>`).join('')||`<option>${esc(current)}</option>`}</select></div><div class="hint">السنة النشطة حالياً: <b>${esc(state.data.settings?.academic_year||'—')}</b></div></div></div><div id="archivePrint" class="card section"><div style="text-align:center"><h2 style="margin:0">${esc(state.data.settings?.school_name||'مدرسة منارة العلم الخاصة')}</h2><div>أرشيف السنة الدراسية ${esc(current)}</div></div><div class="kpi-grid section"><div class="card kpi"><div><b>الطلاب في الأرشيف</b><strong>${rows.length}</strong></div></div><div class="card kpi"><div><b>الفعالون</b><strong>${active}</strong></div></div></div><div class="table-wrap"><table><thead><tr><th>الطالب</th><th>الأب</th><th>الجد</th><th>الصف</th><th>الشعبة</th><th>الموقع</th><th>الكود</th></tr></thead><tbody>${rows.map(r=>`<tr><td><b>${esc(r.student_name)}</b></td><td>${esc(r.father_name||'—')}</td><td>${esc(r.grandfather_name||'—')}</td><td>${esc(r.grade||'—')}</td><td>${esc(r.class_name||'—')}</td><td>${esc(r.location_label||'—')}</td><td>${esc(r.access_code||'—')}</td></tr>`).join('')||'<tr><td colspan="7" class="empty">لا توجد سجلات لهذه السنة بعد.</td></tr>'}</tbody></table></div></div>`;
}
async function snapshotCurrentYear(){try{const {data,error}=await sb.rpc('snapshot_current_academic_year');if(error)throw error;await loadSupabaseData();state.archiveYear=data?.academic_year||state.data.settings?.academic_year;render();alert('تم تثبيت السنة الحالية في الأرشيف.');}catch(e){alert(authErrorArabic(e.message));}}

async function openStudentReport(id){
  const year=state.data.settings?.academic_year||v68AcademicYearForDate(today());
  try{let p;if(DEMO){const s=state.data.students.find(x=>x.id===id);p={academic_year:year,student:s,attendance:(state.data.attendance||[]).filter(x=>x.student_id===id),grades:(state.data.grades||[]).filter(x=>x.student_id===id)};}else{const {data,error}=await sb.rpc('report_student_pdf',{p_student_id:String(id),p_academic_year:year});if(error)throw error;p=data;}
    const s=p?.student||{},at=p?.attendance||[],gr=p?.grades||[],present=at.filter(x=>x.status==='حاضر').length,absent=at.filter(x=>x.status==='غائب').length,late=at.filter(x=>x.status==='متأخر').length,score=gr.reduce((a,g)=>a+Number(g.score||0),0),max=gr.reduce((a,g)=>a+Number(g.max_score||0),0);
    document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="modal"><div class="modalbox" style="max-width:950px"><div class="row between print-hide"><h2 class="section-title">تقرير الطالب</h2><div class="row"><button class="btn" onclick="printElement('studentReportPrint')">🖨 طباعة / PDF</button><button class="btn outline" onclick="closeModal()">إغلاق</button></div></div><div id="studentReportPrint"><div style="text-align:center;margin-bottom:16px">${logo().replace('<img','<img style="width:80px;height:80px;object-fit:contain"')}<h2 style="margin:6px 0">${esc(state.data.settings?.school_name||'مدرسة منارة العلم الخاصة')}</h2><div>تقرير الطالب — السنة الدراسية ${esc(p.academic_year||year)}</div></div><div class="card"><div class="mini-grid"><div><b>اسم الطالب:</b> ${esc(s.full_name||'—')}</div><div><b>اسم الأب:</b> ${esc(s.father_name||'—')}</div><div><b>اسم الجد:</b> ${esc(s.grandfather_name||'—')}</div><div><b>الصف:</b> ${esc(s.grade||'—')}</div><div><b>الشعبة:</b> ${esc(s.class_name||'—')}</div><div><b>الموقع:</b> ${esc(s.location_label||'—')}</div><div><b>ولي الأمر:</b> ${esc(s.parent_phone||'—')}</div><div><b>الكود:</b> ${esc(s.access_code||'—')}</div></div></div><div class="kpi-grid section"><div class="card kpi"><div><b>حاضر</b><strong>${present}</strong></div></div><div class="card kpi"><div><b>غائب</b><strong>${absent}</strong></div></div><div class="card kpi"><div><b>متأخر</b><strong>${late}</strong></div></div><div class="card kpi"><div><b>المعدل</b><strong>${v68Percent(score,max)}</strong></div></div></div><div class="section"><h3>النتائج</h3><div class="table-wrap"><table><thead><tr><th>المادة</th><th>الاختبار</th><th>التاريخ</th><th>العلامة</th></tr></thead><tbody>${gr.map(g=>`<tr><td>${esc(g.subject_name||'')}</td><td>${esc(g.exam_name||'')}</td><td>${esc(g.date||'—')}</td><td>${esc(g.score)}/${esc(g.max_score||100)}</td></tr>`).join('')||'<tr><td colspan="4">لا توجد نتائج</td></tr>'}</tbody></table></div></div><div class="section"><h3>الحضور والغياب</h3><div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>الحالة</th><th>دقائق التأخير</th><th>ملاحظة</th></tr></thead><tbody>${at.map(a=>`<tr><td>${esc(a.date)}</td><td>${esc(a.status)}</td><td>${esc(a.late_minutes||0)}</td><td>${esc(a.note||'—')}</td></tr>`).join('')||'<tr><td colspan="4">لا يوجد سجل</td></tr>'}</tbody></table></div></div></div></div></div>`);
  }catch(e){alert('تعذر إنشاء التقرير: '+authErrorArabic(e.message));}
}

async function downloadStudentQr(id){
  const st=state.data?.students?.find(x=>String(x.id)===String(id));if(!st?.access_code)return alert('لا يوجد كود للطالب.');
  const code=String(st.access_code).trim().toUpperCase(),payload=studentPortalLink(code),filename=`QR-${safeFilePart(st.full_name)}-${code}.png`;
  if(isAndroidApp()&&window.ManaraAndroid&&typeof window.ManaraAndroid.downloadStudentQr==='function'){try{window.ManaraAndroid.downloadStudentQr(payload,filename,st.full_name||'');return;}catch(_){}}
  try{const res=await fetch(studentQrImageUrl(code),{cache:'no-store'});if(!res.ok)throw new Error('download');const blob=await res.blob(),img=await createImageBitmap(blob),w=1000,h=1180,canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(img,0,0,w,1000);ctx.fillStyle='#0b4f2c';ctx.textAlign='center';ctx.direction='rtl';ctx.font='bold 44px sans-serif';ctx.fillText(st.full_name||'',w/2,1080,900);ctx.font='30px monospace';ctx.fillText(code,w/2,1135,900);canvas.toBlob(b=>{if(!b)return;const url=URL.createObjectURL(b),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);},'image/png');}catch(_){window.open(studentQrImageUrl(code),'_blank','noopener');}
}

function chooseParentQrImage(){
  const msg=document.getElementById('portalMessage');
  if(isAndroidApp()&&window.ManaraAndroid&&typeof window.ManaraAndroid.chooseStudentQrImage==='function'){if(msg)msg.innerHTML='<div class="message">اختر صورة QR من الاستديو...</div>';try{window.ManaraAndroid.chooseStudentQrImage();}catch(e){if(msg)msg.innerHTML='<div class="message error">تعذر فتح الاستديو.</div>';}return;}
  const input=document.createElement('input');input.type='file';input.accept='image/*';input.style.display='none';document.body.appendChild(input);input.onchange=()=>{const file=input.files?.[0];if(!file){input.remove();return;}if(msg)msg.innerHTML='<div class="message">جاري قراءة QR من الصورة...</div>';const reader=new FileReader();reader.onload=()=>{const img=new Image();img.onload=async()=>{try{const max=1800,scale=Math.min(1,max/Math.max(img.naturalWidth||img.width,img.naturalHeight||img.height)),w=Math.max(1,Math.round((img.naturalWidth||img.width)*scale)),h=Math.max(1,Math.round((img.naturalHeight||img.height)*scale)),canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,w,h);const imageData=ctx.getImageData(0,0,w,h);let raw='';if(typeof window.jsQR==='function'){raw=window.jsQR(imageData.data,w,h,{inversionAttempts:'attemptBoth'})?.data||'';}else if('BarcodeDetector' in window){const bd=new BarcodeDetector({formats:['qr_code']});const rs=await bd.detect(canvas);raw=rs?.[0]?.rawValue||'';}if(!raw)throw new Error('NOT_FOUND');window.onManaraQrScanned(raw);}catch(_){if(msg)msg.innerHTML='<div class="message error">لم يتم العثور على QR واضح داخل الصورة. جرّب صورة أوضح.</div>';}finally{input.remove();}};img.onerror=()=>{if(msg)msg.innerHTML='<div class="message error">تعذر فتح الصورة المختارة.</div>';input.remove();};img.src=reader.result;};reader.readAsDataURL(file);};input.click();
}

async function saveSettings(){
  const row={school_name:document.getElementById('set_name').value.trim(),school_name_en:document.getElementById('set_en').value.trim(),established_year:document.getElementById('set_year').value.trim(),academic_year:document.getElementById('set_academic').value.trim(),phone:document.getElementById('set_phone').value.trim(),phone2:document.getElementById('set_phone2').value.trim(),address:document.getElementById('set_address').value.trim()};
  if(DEMO){Object.assign(state.data.settings,row);saveDemo();render();return;}
  const id=state.data.settings?.id,res=id?await sb.from('school_settings').update(row).eq('id',id):await sb.from('school_settings').insert(row);if(res.error)return alert(res.error.message);await loadSupabaseData();render();
}



async function retrySavedSession(){
  const msg=document.getElementById('loginMsg');if(msg)msg.innerHTML='<div class="message">جاري إعادة الاتصال بالحساب المحفوظ...</div>';
  try{const {data:{session}}=await sb.auth.getSession();if(!session)throw new Error('انتهت الجلسة المحفوظة. سجل الدخول مرة واحدة.');await establishSupabaseUser(session.user);state.savedSessionUser=null;render();}catch(e){if(msg)msg.innerHTML=`<div class="message error">${esc(e.message||'تعذر إعادة الاتصال.')}</div>`;}
}
function loginPage(){
  const notice=state.loginNotice?`<div class="message ok">${esc(state.loginNotice)}</div>`:'';state.loginNotice='';
  const savedLogin=DEMO?'admin':(localStorage.getItem(LOGIN_EMAIL_KEY)||''),rememberLogin=localStorage.getItem(LOGIN_REMEMBER_KEY)!=='0';
  const reconnect=(!DEMO&&state.savedSessionUser)?`<div class="message warning">جلسة الدخول ما زالت محفوظة على هذا الجهاز، ولم يتم تسجيل خروجك.</div><button class="btn" style="width:100%;margin-bottom:14px" onclick="retrySavedSession()">↻ إعادة الاتصال بالحساب المحفوظ</button><div class="hint" style="margin-bottom:10px">استخدم حقول الدخول فقط إذا انتهت الجلسة فعلاً.</div>`:'';
  return `<div class="public-page"><div class="public-shell" style="max-width:520px"><div class="auth-card" style="margin-top:6vh;text-align:center">${logo().replace('<img','<img style="width:100px;height:100px;border-radius:50%;object-fit:cover;margin-bottom:10px"')}<h2>دخول النظام</h2><p class="muted">للإدارة والمدرسين المصرح لهم فقط</p>${notice}${reconnect}<div id="loginMsg"></div><div class="field" style="text-align:right"><label>${DEMO?'اسم المستخدم':'البريد الإلكتروني'}</label><input id="loginUser" type="${DEMO?'text':'email'}" autocomplete="username" value="${esc(savedLogin)}"></div><div class="field" style="text-align:right"><label>كلمة المرور</label><input id="loginPass" type="password" autocomplete="current-password" onkeydown="if(event.key==='Enter') doLogin()"></div>${!DEMO?`<label style="display:flex;align-items:center;gap:10px;justify-content:flex-start;margin:8px 0 14px;cursor:pointer;text-align:right"><input id="rememberLogin" type="checkbox" ${rememberLogin?'checked':''} style="width:20px;height:20px"><span><b>حفظ تسجيل الدخول على هذا الجهاز</b><br><span class="muted" style="font-size:13px">لن يتم تسجيل الخروج إلا عند الضغط على زر تسجيل الخروج.</span></span></label>`:''}<div class="row" style="justify-content:center;gap:8px"><button class="btn" onclick="doLogin()">دخول</button><button class="btn outline" onclick="goParent()">بوابة الأهل</button></div>${!DEMO?'<button class="link-button" onclick="forgotPassword()">نسيت كلمة المرور؟</button>':''}</div></div></div>`;
}
async function init(){
  if(!DEMO){
    if(!CFG.SUPABASE_URL||!CFG.SUPABASE_ANON_KEY){document.getElementById('app').innerHTML=setupError();return;}
    if(!window.supabase||typeof window.supabase.createClient!=='function'){document.getElementById('app').innerHTML='<div class="public-page"><div class="public-shell"><div class="auth-card"><h2>تعذر تشغيل التطبيق</h2><p>ملف Supabase غير متاح.</p></div></div></div>';return;}
    sb=window.supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.localStorage}});
    if(!(await enforceMandatoryAndroidUpdate()))return;
    sb.auth.onAuthStateChange((event)=>{if(event==='PASSWORD_RECOVERY'){state.user=null;state.role=null;state.screen='reset';setTimeout(render,0);}});
    const recoveryHint=new URLSearchParams(window.location.search).get('recovery')==='1'||window.location.hash.includes('type=recovery');
    const {data:{session}}=await sb.auth.getSession();
    if(recoveryHint){state.screen='reset';}
    else if(session){try{await establishSupabaseUser(session.user);state.savedSessionUser=null;}catch(e){state.savedSessionUser=session.user;state.screen='login';state.loginNotice=e.message||'تعذر الاتصال بالحساب المحفوظ.';}}
  }else{state.data=getDemo();const s=JSON.parse(localStorage.getItem(DEMO_SESSION)||'null');if(s){state.user=s.user;state.role=s.role;state.screen='app';}}
  const hashParams=new URLSearchParams((window.location.hash||'').replace(/^#/,'')),initialCode=normalizeStudentCode(new URLSearchParams(window.location.search).get('code')||hashParams.get('code')||''),savedParentCode=normalizeStudentCode(localStorage.getItem(PARENT_CODE_KEY)||''),parentAutoCode=initialCode||(state.screen==='parent'?savedParentCode:'');
  if(parentAutoCode&&parentAutoCode.startsWith('MN-')){state.screen='parent';state.portal=null;render();setTimeout(()=>{const el=document.getElementById('portalCode');if(el)el.value=parentAutoCode;try{if(window.location.protocol.startsWith('http'))history.replaceState({},'',window.location.pathname);}catch(_){}findStudentPortal(true);},120);}else render();
}

init();


/* ============================================================
   MANARA V6.11 — إصلاح الهاتف الدولي + حفظ كنية الطالب
   ============================================================ */

function navItems(){
  if(state.role==='teacher') return [
    ['home','⌂','الرئيسية'],
    ['buildings','▦','الصفوف والشعب'],
    ['students','♟','طلابي'],
    ['attendance','✓','الحضور والغياب'],
    ['reports','▥','الجرد الشهري'],
    ['notes','✎','ملاحظات الطلاب']
  ];
  return [
    ['home','⌂','الرئيسية'],
    ['buildings','▦','الصفوف والشعب'],
    ['students','♟','الطلاب'],
    ['attendance','✓','الحضور والغياب'],
    ['reports','▥','الجرد الشهري'],
    ['archive','▧','الأرشيف السنوي'],
    ['notes','✎','ملاحظات الطلاب'],
    ['grades','▤','النتائج'],
    ['announcements','◉','الإعلانات'],
    ['teachers','♙','المدرسون'],
    ['audit','≡','سجل العمليات'],
    ['settings','⚙','الإعدادات']
  ];
}

function appPage(){
  const labels={home:'الرئيسية',buildings:'الصفوف والشعب',students:'الطلاب',attendance:'الحضور والغياب',reports:'الجرد الشهري',archive:'الأرشيف السنوي',notes:'ملاحظات الطلاب',grades:'النتائج',announcements:'الإعلانات',teachers:'إدارة المدرسين',audit:'سجل العمليات',settings:'الإعدادات'};
  if(state.role==='teacher'&&!['home','buildings','students','attendance','reports','notes'].includes(state.tab))state.tab='home';
  const topLogo=logo().replace('<img','<img class="top-logo"');
  const watermark=logo().replace('<img','<img class="content-watermark"');
  return `<div class="app-shell"><aside class="sidebar ${state.sidebar?'open':''}"><div class="side-brand">${logo()}<div><b>${esc(state.data?.settings?.school_name||'مدرسة المنارة الخاصة')}</b><small>MANARA PRIVATE SCHOOL</small></div><button class="drawer-close" onclick="toggleSidebar(false)" aria-label="إغلاق">×</button></div><div class="user-card"><b>${esc(state.user?.name||'')}</b><small>${state.role==='admin'?'مدير النظام — تحكم كامل':'مدرس — الشعب المخصصة فقط'}</small></div><div class="side-label">القائمة الرئيسية</div><nav class="side-nav">${navItems().map(n=>`<button class="${state.tab===n[0]?'active':''}" onclick="setTab('${n[0]}')"><i class="nav-icon">${n[1]}</i>${n[2]}</button>`).join('')}</nav><div class="side-label" style="margin-top:16px">الحساب</div><nav class="side-nav"><button onclick="goParent()"><i class="nav-icon">◫</i>معاينة بوابة الأهل</button><button onclick="logout()"><i class="nav-icon">↪</i>تسجيل الخروج</button></nav></aside><div class="drawer-backdrop ${state.sidebar?'show':''}" onclick="toggleSidebar(false)"></div>
  <main class="main"><header class="topbar"><div class="row"><button class="btn outline mobile-menu" onclick="toggleSidebar()">☰</button><div class="page-title"><b>${labels[state.tab]||''}</b><small>${state.role==='admin'?'لوحة الإدارة الرئيسية':'طلابك وشعبك فقط'}</small></div></div>${topLogo}<div class="top-actions"><span class="badge ${state.role}">${state.role==='admin'?'الإدارة':'مدرس'}</span></div></header><section class="content">${watermark}${pageContent()}</section></main></div>`;
}

function v610VisibleRooms(){
  let rooms=(state.data.rooms||[]).slice();
  if(state.role==='teacher'){
    const allowed=new Set(assignedRoomIds().map(String));
    rooms=rooms.filter(r=>allowed.has(String(r.id)));
  }
  return rooms.sort((a,b)=>String(a.grade||'').localeCompare(String(b.grade||''),'ar',{numeric:true})||String(a.section_label||a.name||'').localeCompare(String(b.section_label||b.name||''),'ar',{numeric:true}));
}
function v610RoomBuildingName(room){
  const f=(state.data.floors||[]).find(x=>String(x.id)===String(room?.floor_id));
  const b=(state.data.buildings||[]).find(x=>String(x.id)===String(f?.building_id));
  return b?.name||'';
}
function v610StudentsInRoom(roomId){
  return (state.data.students||[]).filter(st=>String(st.room_id)===String(roomId)).sort((a,b)=>String(a.full_name||'').localeCompare(String(b.full_name||''),'ar'));
}
function page_buildings(){
  if(!['admin','teacher'].includes(state.role))return noAccess();
  const rooms=v610VisibleRooms();
  const groups=[];
  for(const r of rooms){
    const g=String(r.grade||'غير محدد');
    let group=groups.find(x=>x.grade===g);
    if(!group){group={grade:g,rooms:[]};groups.push(group);}
    group.rooms.push(r);
  }
  const content=groups.map(g=>`<div class="section"><div class="row between" style="margin-bottom:10px"><h3 class="section-title" style="margin:0">${esc(g.grade)}</h3><span class="badge active">${g.rooms.reduce((n,r)=>n+v610StudentsInRoom(r.id).length,0)} طالب</span></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(235px,1fr));gap:14px">${g.rooms.map(r=>{const students=v610StudentsInRoom(r.id),building=v610RoomBuildingName(r),teachers=v68TeacherNamesForRoom(r.id);return `<div class="card" style="position:relative;border:1px solid #dfe8e2;overflow:hidden"><button onclick="openClassFolder('${r.id}')" style="width:100%;border:0;background:transparent;text-align:right;padding:0;cursor:pointer;color:inherit"><div style="display:flex;align-items:center;gap:12px"><div style="font-size:42px;line-height:1">📁</div><div style="min-width:0"><b style="font-size:17px;display:block">${esc(r.grade||'—')} — ${esc(r.section_label||r.name||'شعبة')}</b><div class="muted" style="margin-top:4px">${esc(building||'')} ${building?'• ':''}${students.length} طالب</div></div></div><div class="hint" style="margin-top:12px">اضغط لفتح المجلد ومشاهدة الطلاب ومعلوماتهم</div></button>${teachers.length?`<div style="margin-top:10px">${teachers.map(n=>`<span class="badge teacher" style="margin:2px">${esc(n)}</span>`).join('')}</div>`:''}${state.role==='admin'?`<div class="row" style="margin-top:12px"><button class="btn small secondary" onclick="openRoomModal('${r.id}')">تعديل الشعبة</button></div>`:''}</div>`}).join('')}</div></div>`).join('');
  return `<div class="toolbar"><div><h2 class="section-title">الصفوف والشعب</h2><div class="muted">كل صف وشعبة موجودان كمجلد مستقل. افتح أي مجلد لترى جميع الطلاب المسجلين فيه ومعلوماتهم.</div></div>${state.role==='admin'?'<button class="btn" onclick="openRoomModal()">+ إضافة صف / شعبة</button>':''}</div>${state.role==='teacher'?`<div class="role-note">تظهر لك فقط الشعب المخصصة لحسابك: <b>${assignedRoomsLabel(state.user.id)}</b></div>`:''}${content||'<div class="card empty">لا توجد صفوف أو شعب متاحة.</div>'}`;
}

function v610StudentAvatarHtml(st){
  const initial=esc((st.full_name||'ط').trim().charAt(0)||'ط');
  return `<div style="width:64px;height:64px;flex:0 0 64px;border-radius:50%;overflow:hidden;background:#e8f1ec;display:grid;place-items:center;font-size:25px;font-weight:800;color:#0b6b3a"><span id="v610_initial_${st.id}">${initial}</span><img id="v610_photo_${st.id}" alt="صورة الطالب" style="display:none;width:100%;height:100%;object-fit:cover"></div>`;
}
function v610StudentInfoCard(st){
  const actions=`<div class="row" style="gap:6px;flex-wrap:wrap;margin-top:12px"><button class="btn small secondary" onclick="v610FolderAction('edit','${st.id}')">تعديل</button>${state.role==='admin'?`<button class="btn small warning" onclick="v610FolderAction('move','${st.id}')">نقل / ترقية</button>`:''}<button class="btn small secondary" onclick="v610FolderAction('qr','${st.id}')">QR</button><button class="btn small" onclick="v610FolderAction('report','${st.id}')">تقرير PDF</button><button class="btn small" onclick="v610FolderAction('note','${st.id}')">ملاحظة</button></div>`;
  return `<div class="card" style="margin-bottom:12px"><div style="display:flex;gap:12px;align-items:flex-start">${v610StudentAvatarHtml(st)}<div style="flex:1;min-width:0"><div class="row between" style="align-items:flex-start;gap:10px"><div><b style="font-size:17px">${esc(st.full_name||'—')}</b><div class="hint">${esc(st.access_code||'—')}</div></div><span class="badge ${st.active===false?'inactive':'active'}">${st.active===false?'موقوف':'فعال'}</span></div><div class="mini-grid" style="margin-top:12px"><div><b>اسم الأب:</b> ${esc(st.father_name||'—')}</div><div><b>اسم الأم:</b> ${esc(st.mother_name||'—')}</div><div><b>اسم الجد:</b> ${esc(st.grandfather_name||'—')}</div><div><b>تاريخ الميلاد:</b> ${esc(st.date_of_birth||'—')}</div><div><b>ولي الأمر:</b> ${esc(st.parent_phone||'—')}</div><div><b>العنوان:</b> ${esc(st.address||'—')}</div><div><b>رقم السيارة:</b> ${esc(st.transport_car_number||'—')}</div><div><b>الصورة الشخصية:</b> ${st.photo_path?'محفوظة ✓':'غير مضافة'}</div></div>${st.notes?`<div class="hint" style="margin-top:9px"><b>ملاحظة:</b> ${esc(st.notes)}</div>`:''}${actions}</div></div></div>`;
}
function openClassFolder(roomId){
  const room=v610VisibleRooms().find(r=>String(r.id)===String(roomId));
  if(!room)return alert('هذه الشعبة غير متاحة لحسابك.');
  const students=v610StudentsInRoom(roomId),building=v610RoomBuildingName(room);
  document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="modal"><div class="modalbox" style="max-width:1050px"><div class="row between"><div><h2 class="section-title">📁 ${esc(room.grade||'—')} — ${esc(room.section_label||room.name||'شعبة')}</h2><div class="muted">${esc(building)}${building?' — ':''}${students.length} طالب مسجل</div></div><button class="btn outline" onclick="closeModal()">إغلاق</button></div><div class="section">${students.map(v610StudentInfoCard).join('')||'<div class="empty">لا يوجد طلاب داخل هذه الشعبة حالياً.</div>'}</div></div></div>`);
  if(students.some(s=>s.photo_path))setTimeout(()=>v610LoadFolderPhotos(roomId),30);
}
function v610FolderAction(action,id){
  closeModal();
  setTimeout(()=>{
    if(action==='edit')openStudentModal(id);
    else if(action==='move')openMoveStudentModal(id);
    else if(action==='qr')showStudentQr(id);
    else if(action==='report')openStudentReport(id);
    else if(action==='note')openNoteModal(id);
  },40);
}
async function v610LoadFolderPhotos(roomId){
  if(DEMO)return;
  const ids=v610StudentsInRoom(roomId).filter(s=>s.photo_path).map(s=>s.id);
  if(!ids.length)return;
  try{
    const data=await invokeSecureFunction('manage-student',{action:'photo_urls',student_ids:ids});
    const urls=data?.urls||{};
    Object.entries(urls).forEach(([id,url])=>{
      const img=document.getElementById(`v610_photo_${id}`),initial=document.getElementById(`v610_initial_${id}`);
      if(img&&url){img.src=String(url);img.style.display='block';if(initial)initial.style.display='none';}
    });
  }catch(_){}
}

function openStudentModal(id=''){
  const st=state.data.students.find(x=>x.id===id)||{},teacher=state.role==='teacher',pp=v68PhoneParts(st.parent_phone||'');
  if(teacher&&assignedRoomIds().length===0){alert('لا توجد شعبة مخصصة لحسابك بعد.');return;}
  const codes=`<datalist id="countryCodes">${V68_COUNTRY_CODES.map(x=>`<option value="${x[0]}">${esc(x[1])}</option>`).join('')}</datalist>`;
  document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="modal"><div class="modalbox"><div class="row between"><div><h2 class="section-title">${id?'تعديل ملف الطالب':'تسجيل طالب جديد'}</h2><div class="muted">الصورة الشخصية اختيارية، واسم الجد اختياري، ورقم ولي الأمر يدعم النداء الدولي.</div></div><button class="btn outline" onclick="closeModal()">إغلاق</button></div><div id="modalMsg"></div>
  <div class="section"><h3 class="section-title">الصورة الشخصية — اختيارية</h3><div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><div id="s_photo_preview" style="width:96px;height:96px;border-radius:50%;background:#eef4f0;display:grid;place-items:center;overflow:hidden;font-size:34px;font-weight:800;color:#0b6b3a">${esc((st.full_name||'ط').charAt(0)||'ط')}</div><div style="flex:1;min-width:220px"><div class="field"><label>اختر صورة الطالب</label><input id="s_photo" type="file" accept="image/*" onchange="previewStudentPhoto()"><div class="hint">اختياري — سيتم تصغير الصورة تلقائياً قبل الحفظ.</div></div>${st.photo_path?'<label style="display:flex;align-items:center;gap:8px;margin-top:6px"><input id="s_remove_photo" type="checkbox" style="width:19px;height:19px"> حذف الصورة الحالية</label>':''}</div></div></div>
  <div class="section"><h3 class="section-title">المعلومات الشخصية</h3><div class="mini-grid"><div class="field"><label>اسم الطالب *</label><input id="s_full" value="${esc(st.full_name||'')}" autocomplete="off"></div><div class="field"><label>كنية الطالب / النسبة</label><input id="s_family" value="${esc(st.family_name||'')}" autocomplete="off" placeholder="مثال: بكاري"></div><div class="field"><label>اسم الأب</label><input id="s_father" value="${esc(st.father_name||'')}"></div><div class="field"><label>اسم الأم الكامل</label><input id="s_mother" value="${esc(st.mother_name||'')}"></div><div class="field"><label>اسم الجد — اختياري</label><input id="s_grand" value="${esc(st.grandfather_name||'')}" placeholder="اختياري"></div><div class="field"><label>تاريخ الميلاد</label><input id="s_birth" type="date" value="${esc(st.date_of_birth||'')}"></div><div class="field"><label>الجنس</label><select id="s_gender"><option value="">—</option><option ${st.gender==='ذكر'?'selected':''}>ذكر</option><option ${st.gender==='أنثى'?'selected':''}>أنثى</option></select></div></div></div>
  <div class="section"><h3 class="section-title">معلومات الشعبة</h3><div class="mini-grid"><div class="field"><label>الصف *</label><input id="s_grade" value="${esc(st.grade||'')}" readonly></div><div class="field"><label>الشعبة *</label><input id="s_class" value="${esc(st.class_name||'')}" readonly></div><div class="field"><label>اختيار الصف والشعبة *</label><select id="s_room" onchange="syncStudentRoom()">${roomOptions(st.room_id||'')}</select></div></div></div>
  <div class="section"><h3 class="section-title">معلومات الاتصال</h3><div class="mini-grid"><div class="field"><label>النداء الدولي</label><input id="s_country_code" list="countryCodes" inputmode="tel" value="${esc(pp.code)}" placeholder="+963">${codes}<div class="hint">يمكن كتابة أي نداء دولي حتى لو لم يظهر بالقائمة.</div></div><div class="field"><label>رقم هاتف ولي الأمر</label><input id="s_phone" inputmode="tel" value="${esc(pp.number)}" placeholder="مثال: 9XXXXXXXX"></div><div class="field"><label>العنوان</label><input id="s_address" value="${esc(st.address||'')}"></div><div class="field"><label>الحالة</label><select id="s_active"><option value="true" ${st.active!==false?'selected':''}>فعال</option><option value="false" ${st.active===false?'selected':''}>موقوف</option></select></div></div></div>
  <div class="section"><h3 class="section-title">المواصلات</h3><div class="mini-grid"><div class="field"><label>رقم السيارة — اختياري</label><input id="s_transport" value="${esc(st.transport_car_number||'')}" placeholder="اختياري"></div></div></div><div class="field"><label>ملاحظة</label><textarea id="s_notes">${esc(st.notes||'')}</textarea></div><button class="btn" onclick="saveStudent('${id}')">${id?'حفظ التعديلات':'حفظ وإنشاء كود الطالب'}</button></div></div>`);
  if(id&&st.photo_path&&!DEMO)setTimeout(()=>v610LoadStudentPhotoPreview(id),30);
}
function previewStudentPhoto(){
  const file=document.getElementById('s_photo')?.files?.[0],box=document.getElementById('s_photo_preview');
  if(!file||!box)return;
  if(!String(file.type||'').startsWith('image/')){alert('اختر ملف صورة فقط.');return;}
  const r=new FileReader();r.onload=()=>{box.innerHTML=`<img src="${r.result}" alt="معاينة" style="width:100%;height:100%;object-fit:cover">`;};r.readAsDataURL(file);
}
async function v610LoadStudentPhotoPreview(id){
  try{
    const data=await invokeSecureFunction('manage-student',{action:'photo_urls',student_ids:[id]});
    const url=data?.urls?.[id],box=document.getElementById('s_photo_preview');
    if(url&&box)box.innerHTML=`<img src="${esc(url)}" alt="صورة الطالب" style="width:100%;height:100%;object-fit:cover">`;
  }catch(_){}
}
function v610CompressPhoto(file){
  return new Promise((resolve,reject)=>{
    if(!file){resolve('');return;}
    if(!String(file.type||'').startsWith('image/')){reject(new Error('الصورة الشخصية يجب أن تكون ملف صورة.'));return;}
    if(file.size>12*1024*1024){reject(new Error('حجم الصورة كبير جداً. اختر صورة أصغر من 12 MB.'));return;}
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error('تعذر قراءة الصورة.'));
    reader.onload=()=>{const img=new Image();img.onerror=()=>reject(new Error('تعذر فتح الصورة المختارة.'));img.onload=()=>{try{const max=1200,scale=Math.min(1,max/Math.max(img.naturalWidth||img.width,img.naturalHeight||img.height)),w=Math.max(1,Math.round((img.naturalWidth||img.width)*scale)),h=Math.max(1,Math.round((img.naturalHeight||img.height)*scale)),canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,w,h);resolve(canvas.toDataURL('image/jpeg',0.82));}catch(e){reject(e);}};img.src=String(reader.result||'');};
    reader.readAsDataURL(file);
  });
}
async function saveStudent(id=''){
  const msg=document.getElementById('modalMsg');let newStudentId='';
  const baseName=v611CleanName(document.getElementById('s_full').value),family=v611CleanName(document.getElementById('s_family')?.value||''),full=v611CombineStudentName(baseName,family),grand=document.getElementById('s_grand').value.trim(),grade=document.getElementById('s_grade').value.trim(),room_id=document.getElementById('s_room').value||null;
  if(!full||!grade||!room_id){msg.innerHTML='<div class="message error">اسم الطالب والصف والشعبة حقول إلزامية. الكنية واسم الجد والصورة الشخصية اختيارية.</div>';return;}
  if(state.role==='teacher'&&!assignedRoomIds().map(String).includes(String(room_id))){msg.innerHTML='<div class="message error">لا يمكنك إضافة طالب إلى شعبة غير مخصصة لك.</div>';return;}
  const row={full_name:full,family_name:family,father_name:document.getElementById('s_father').value.trim(),mother_name:document.getElementById('s_mother').value.trim(),grandfather_name:grand,grade,class_name:document.getElementById('s_class').value.trim(),room_id,gender:document.getElementById('s_gender').value,date_of_birth:document.getElementById('s_birth').value||null,parent_phone:v68JoinPhone(document.getElementById('s_country_code').value,document.getElementById('s_phone').value),address:document.getElementById('s_address').value.trim(),active:document.getElementById('s_active')?.value!=='false',transport_car_number:document.getElementById('s_transport').value.trim(),notes:document.getElementById('s_notes')?.value.trim()||''};
  const dup=duplicateStudentLocal(row,id);if(!id&&dup){msg.innerHTML='<div class="message error"><b>الطالب موجود مسبقاً.</b></div>';return;}
  const photoFile=document.getElementById('s_photo')?.files?.[0]||null,removePhoto=!!document.getElementById('s_remove_photo')?.checked;
  try{
    let photoBase64='';if(photoFile){msg.innerHTML='<div class="message">جاري تجهيز الصورة الشخصية...</div>';photoBase64=await v610CompressPhoto(photoFile);}
    if(DEMO){const room=state.data.rooms.find(r=>r.id===room_id),f=state.data.floors.find(x=>x.id===room?.floor_id),b=state.data.buildings.find(x=>x.id===f?.building_id);Object.assign(row,{room_name:room?.name,room_code:room?.code,floor_name:f?.name,building_name:b?.name,location_label:roomLocation(room_id)});if(id){Object.assign(state.data.students.find(x=>x.id===id),row);if(removePhoto)state.data.students.find(x=>x.id===id).photo_path='';}else{row.id=uid();newStudentId=row.id;row.access_code=makeStudentCode();row.created_at=new Date().toISOString();row.photo_path=photoBase64?'demo-photo':'';state.data.students.unshift(row);}saveDemo();}
    else{
      msg.innerHTML='<div class="message">جاري حفظ بيانات الطالب...</div>';
      const data=await invokeSecureFunction('manage-student',{action:id?'update':'create',student_id:id||undefined,student:row});newStudentId=data?.student?.id||id||'';
      if(removePhoto&&!photoBase64&&newStudentId)await invokeSecureFunction('manage-student',{action:'remove_photo',student_id:newStudentId});
      if(photoBase64&&newStudentId){msg.innerHTML='<div class="message">جاري رفع الصورة الشخصية...</div>';await invokeSecureFunction('manage-student',{action:'upload_photo',student_id:newStudentId,image_base64:photoBase64});}
      await loadSupabaseData();
    }
    closeModal();render();if(!id&&newStudentId)setTimeout(()=>showStudentQr(newStudentId),120);
  }catch(e){msg.innerHTML=`<div class="message error">${esc(authErrorArabic(e.message))}</div>`;}
}
