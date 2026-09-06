const CFG = window.ALMANARA_CONFIG || {};
const DEMO = CFG.DEMO_MODE !== false;
const DEMO_KEY = 'almanara_v4_demo_data';
const DEMO_SESSION = 'almanara_v4_session';
const LOGIN_EMAIL_KEY = 'almanara_login_email';
const LOGIN_REMEMBER_KEY = 'almanara_login_remember';
let sb = null;
let state = { screen:'parent', user:null, role:null, tab:'home', portal:null, data:null, sidebar:false, loginNotice:'', portalPoll:null };

function uid(){ return (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)+Math.random().toString(36).slice(2)); }
function makeStudentCode(){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const part=n=>Array.from({length:n},()=>chars[Math.floor(Math.random()*chars.length)]).join('');
  return `MN-${part(4)}-${part(4)}`;
}
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function today(){return new Date().toISOString().slice(0,10);}
function logo(){return `<img src="assets/logo.jpg" alt="شعار مدرسة المنارة">`;}
function moneyLike(n){return Number(n||0).toLocaleString('ar');}
function statusBadge(s){const cls=s==='حاضر'?'present':s==='غائب'?'absent':'late'; return `<span class="badge ${cls}">${esc(s)}</span>`;}

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
    settings:{school_name:'مدرسة المنارة الخاصة',school_name_en:'MANARA PRIVATE SCHOOL',established_year:'2007',phone:'',address:'',academic_year:'2026/2027'},
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
  render();
}
function setupError(){return `<div class="public-page"><div class="public-shell"><div class="auth-card"><h2>إعداد قاعدة البيانات غير مكتمل</h2><p>ضع SUPABASE_URL و SUPABASE_ANON_KEY داخل <b>config.js</b> أو أعد DEMO_MODE إلى true.</p></div></div></div>`;}

function render(){
  const app=document.getElementById('app');
  if(state.screen==='parent') app.innerHTML=parentPage();
  else if(state.screen==='login') app.innerHTML=loginPage();
  else if(state.screen==='reset') app.innerHTML=resetPasswordPage();
  else app.innerHTML=appPage();
  setTimeout(applyMobileUi,0);
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
    const {data,error}=await sb.rpc('register_parent_device',{p_code:pendingParentPushCode,p_device_token:token,p_platform:'android'});
    if(error)throw error;
    if(data){
      localStorage.setItem('manara_parent_push_code',pendingParentPushCode);
      localStorage.setItem('manara_parent_push_enabled','1');
      const el=document.getElementById('pushStatus'); if(el)el.innerHTML='<span class="badge active">🔔 إشعارات الهاتف مفعلة</span>';
    }
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
      <section class="auth-card"><h2>عرض ملف الطالب</h2><p class="muted">أدخل كود الطالب كما استلمته من الإدارة.</p><div class="field"><label>كود الطالب</label><input id="portalCode" autocomplete="off" placeholder="MN-ABCD-2345" onkeydown="if(event.key==='Enter') findStudentPortal()"></div><button class="btn" onclick="findStudentPortal()">عرض الملف</button><div id="portalMessage"></div></section>
    </div>
    <div id="portalResult" class="section">${state.portal?portalHtml(state.portal):''}</div>
  </div></div>`;
}
async function findStudentPortal(){
  const code=document.getElementById('portalCode').value.trim().toUpperCase();
  const msg=document.getElementById('portalMessage');
  if(!code){msg.innerHTML='<div class="message error">أدخل كود الطالب أولاً.</div>';return;}
  msg.innerHTML='<div class="message">جاري البحث...</div>';
  try{
    let p;
    if(DEMO){
      const s=state.data.students.find(x=>x.access_code===code && x.active!==false);
      if(!s) throw new Error('الكود غير صحيح أو الطالب غير موجود.');
      p={student:s,attendance:state.data.attendance.filter(x=>x.student_id===s.id).sort((a,b)=>b.date.localeCompare(a.date)),grades:state.data.grades.filter(x=>x.student_id===s.id).sort((a,b)=>(b.date||'').localeCompare(a.date||'')),announcements:state.data.announcements.slice().reverse(),notes:state.data.studentNotes.filter(x=>x.student_id===s.id&&x.visible_to_parent!==false).sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||'')),notifications:state.data.notifications.filter(x=>x.student_id===s.id).sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||''))};
    }else{
      const {data,error}=await sb.rpc('get_student_portal',{p_code:code}); if(error) throw error; if(!data || !data.student) throw new Error('الكود غير صحيح أو الطالب غير موجود.'); p=data;
    }
    state.portal=p; render(); if(isAndroidApp())setTimeout(()=>requestAndroidParentPush(code),150); setTimeout(()=>document.getElementById('portalResult')?.scrollIntoView({behavior:'smooth'}),30);
  }catch(e){msg.innerHTML=`<div class="message error">${esc(e.message||'تعذر العثور على الطالب.')}</div>`;}
}
function portalHtml(p){
  const s=p.student||{}, at=p.attendance||[], gr=p.grades||[], notes=p.notes||[], notifications=p.notifications||[];
  const present=at.filter(x=>x.status==='حاضر').length, absent=at.filter(x=>x.status==='غائب').length, late=at.filter(x=>x.status==='متأخر').length;
  const avg=gr.length?(gr.reduce((a,g)=>a+(Number(g.score)/(Number(g.max_score||g.max||100))*100),0)/gr.length).toFixed(1):'—';
  const unread=notifications.filter(n=>!n.seen_at).length;
  setTimeout(()=>notifyParentDevice(notifications.filter(n=>!n.seen_at)),80);
  return `<div class="public-card"><div class="student-banner"><div class="student-avatar">${esc((s.full_name||'ط')[0])}</div><div><h2 style="margin:0">${esc(s.full_name)}</h2><div class="muted">الصف ${esc(s.grade||'—')} — الشعبة ${esc(s.class_name||'—')}</div><div class="hint">اسم الجد: ${esc(s.grandfather_name||'—')} ${s.location_label?`— ${esc(s.location_label)}`:''}</div></div>${unread?`<span class="notification-count">${unread} جديد</span>`:''}</div>
  <div class="portal-actions section">${isAndroidApp()?'<span id="pushStatus"><button class="btn secondary" onclick="requestAndroidParentPush(localStorage.getItem(\'manara_parent_push_code\')||pendingParentPushCode)">🔔 تفعيل إشعارات الهاتف</button></span>':'<button class="btn secondary" onclick="enableParentNotifications()">🔔 تفعيل إشعارات المتصفح</button>'}${unread?'<button class="btn outline" onclick="markPortalNotificationsSeen()">تحديد الإشعارات كمقروءة</button>':''}</div>
  ${notes.length?`<div class="section"><div class="row between"><h3>ملاحظات الطالب</h3><span class="badge warning">تصل مباشرة على كود الطالب</span></div>${notes.map(n=>`<div class="student-note ${n.importance==='مهم'?'important':''}"><div class="row between"><b>${esc(n.title||'ملاحظة من المدرسة')}</b><small>${esc((n.created_at||'').slice(0,10))}</small></div><div>${esc(n.content)}</div>${n.image_url?`<a href="${esc(n.image_url)}" target="_blank" rel="noopener"><img src="${esc(n.image_url)}" alt="صورة مرفقة بالملاحظة" style="display:block;width:100%;max-width:520px;max-height:520px;object-fit:contain;border-radius:16px;margin-top:12px;background:#f3f5f4"></a>`:''}<small class="muted">${esc(n.category||'ملاحظة عامة')}</small></div>`).join('')}</div>`:''}
  <div class="portal-kpis section"><div class="card"><span class="muted">الحضور</span><strong>${present}</strong></div><div class="card"><span class="muted">الغياب</span><strong>${absent}</strong></div><div class="card"><span class="muted">التأخير</span><strong>${late}</strong></div><div class="card"><span class="muted">المعدل</span><strong>${avg}${avg==='—'?'':'%'}</strong></div></div>
  <div class="section"><h3>النتائج</h3><div class="table-wrap"><table><thead><tr><th>المادة</th><th>الاختبار</th><th>التاريخ</th><th>العلامة</th></tr></thead><tbody>${gr.map(g=>`<tr><td>${esc(g.subject_name||g.subject||'')}</td><td>${esc(g.exam_name||g.exam||'')}</td><td>${esc(g.date||'—')}</td><td>${esc(g.score)}/${esc(g.max_score||g.max||100)}</td></tr>`).join('')||'<tr><td colspan="4" class="empty">لا توجد نتائج بعد</td></tr>'}</tbody></table></div></div>
  <div class="section"><h3>الحضور والغياب والتأخير</h3><div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>الحالة</th><th>دقائق التأخير</th><th>ملاحظة</th></tr></thead><tbody>${at.map(a=>`<tr><td>${esc(a.date)}</td><td>${statusBadge(a.status)}</td><td>${esc(a.late_minutes||0)}</td><td>${esc(a.note||'—')}</td></tr>`).join('')||'<tr><td colspan="4" class="empty">لا يوجد سجل حتى الآن</td></tr>'}</tbody></table></div></div>
  <div class="section"><h3>إعلانات المدرسة</h3>${(p.announcements||[]).map(a=>`<div class="notice"><b>${esc(a.title)}</b><div>${esc(a.content)}</div><small class="muted">${esc(a.created_date||a.date||'')}</small></div>`).join('')||'<div class="empty">لا توجد إعلانات</div>'}</div></div>`;
}
async function enableParentNotifications(){
  if(!('Notification' in window))return alert('هذا الجهاز لا يدعم إشعارات المتصفح.');
  const permission=await Notification.requestPermission();
  alert(permission==='granted'?'تم تفعيل إشعارات الجهاز.':'لم يتم السماح بالإشعارات.');
}
function notifyParentDevice(items){
  if(!items?.length || !('Notification' in window) || Notification.permission!=='granted')return;
  const n=items[0]; try{new Notification(n.title||'مدرسة المنارة',{body:n.body||'لديك ملاحظة جديدة تخص الطالب.',icon:'assets/logo.jpg'});}catch(e){}
}
async function markPortalNotificationsSeen(){
  if(!state.portal?.student)return;
  if(DEMO){const sid=state.portal.student.id; state.data.notifications.filter(n=>n.student_id===sid).forEach(n=>n.seen_at=n.seen_at||new Date().toISOString()); saveDemo(); state.portal.notifications=state.data.notifications.filter(n=>n.student_id===sid); render();}
  else{const code=document.getElementById('portalCode')?.value||''; const {error}=await sb.rpc('mark_student_notifications_seen',{p_code:code}); if(error)return alert(error.message); const {data}=await sb.rpc('get_student_portal',{p_code:code}); state.portal=data; render();}
}
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
async function establishSupabaseUser(user){
  const {data:profile,error}=await sb.from('profiles').select('id,full_name,role,active').eq('id',user.id).single();
  if(error||!profile||!profile.active){await sb.auth.signOut();throw new Error('هذا الحساب غير فعال أو غير مصرح له.');}
  state.user={id:user.id,name:profile.full_name||user.email,email:user.email}; state.role=profile.role; state.screen='app'; state.tab='home'; await loadSupabaseData();
}
async function logout(){ if(DEMO){localStorage.removeItem(DEMO_SESSION);}else if(sb){await sb.auth.signOut();} state.user=null;state.role=null;state.screen='parent';state.portal=null;render(); }

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
      sb.from('rooms').select('*').order('code'),
      sb.from('student_notes').select('*').order('created_at',{ascending:false}).limit(1000),
      sb.from('parent_notifications').select('*').order('created_at',{ascending:false}).limit(1000),
      sb.from('teacher_room_assignments').select('*')
    ]);
    const students=(st.data||[]).map(x=>({...x,room_name:x.rooms?.name,room_code:x.rooms?.code,floor_name:x.rooms?.floors?.name,building_name:x.rooms?.floors?.buildings?.name,location_label:x.rooms?`${x.rooms?.floors?.buildings?.name||''} / ${x.rooms?.floors?.name||''} / ${x.rooms?.name||''}`:''}));
    state.data={students,attendance:at.data||[],grades:(gr.data||[]).map(x=>({...x,exam_name:x.grade_items?.title,max_score:x.grade_items?.max_score,date:x.grade_items?.exam_date,subject_name:x.grade_items?.subjects?.name})),announcements:an.data||[],subjects:su.data||[],teachers:pr.data||[],settings:se.data||{},audit:au.data||[],buildings:bu.data||[],floors:fl.data||[],rooms:ro.data||[],studentNotes:sn.data||[],notifications:pn.data||[],teacherAssignments:ta.data||[]};
  }else{
    const [st,at,se,bu,fl,ro,sn,ta]=await Promise.all([
      sb.from('students').select('*,rooms(id,code,name,grade,section_label,floor_id,floors(name,building_id,buildings(name)))').order('created_at',{ascending:false}),
      sb.from('attendance').select('*').order('date',{ascending:false}).limit(2000),
      sb.from('school_settings').select('*').limit(1).maybeSingle(),
      sb.from('buildings').select('*').order('code'),
      sb.from('floors').select('*').order('floor_order'),
      sb.from('rooms').select('*').order('code'),
      sb.from('student_notes').select('*').order('created_at',{ascending:false}).limit(1000),
      sb.from('teacher_room_assignments').select('*').eq('teacher_id',state.user.id)
    ]);
    const students=(st.data||[]).map(x=>({...x,room_name:x.rooms?.name,room_code:x.rooms?.code,floor_name:x.rooms?.floors?.name,building_name:x.rooms?.floors?.buildings?.name,location_label:x.rooms?`${x.rooms?.floors?.buildings?.name||''} / ${x.rooms?.floors?.name||''} / ${x.rooms?.name||''}`:''}));
    state.data={students,attendance:at.data||[],grades:[],announcements:[],subjects:[],teachers:[],settings:se.data||{},audit:[],buildings:bu.data||[],floors:fl.data||[],rooms:ro.data||[],studentNotes:sn.data||[],notifications:[],teacherAssignments:ta.data||[]};
  }
}
function navItems(){
  if(state.role==='teacher') return [['home','⌂','الرئيسية'],['students','♟','طلابي'],['attendance','✓','الحضور والغياب'],['notes','✎','ملاحظات الطلاب']];
  return [['home','⌂','الرئيسية'],['buildings','▦','الكتل والغرف'],['students','♟','الطلاب'],['attendance','✓','الحضور والغياب'],['notes','✎','ملاحظات الطلاب'],['grades','▤','النتائج'],['announcements','◉','الإعلانات'],['teachers','♙','المدرسون'],['audit','≡','سجل العمليات'],['settings','⚙','الإعدادات']];
}
function appPage(){
  const labels={home:'الرئيسية',buildings:'الكتل والغرف',students:'الطلاب',attendance:'الحضور والغياب',notes:'ملاحظات الطلاب',grades:'النتائج',announcements:'الإعلانات',teachers:'إدارة المدرسين',audit:'سجل العمليات',settings:'الإعدادات'};
  if(state.role==='teacher'&&!['home','students','attendance','notes'].includes(state.tab))state.tab='home';
  return `<div class="app-shell"><aside class="sidebar ${state.sidebar?'open':''}"><div class="side-brand">${logo()}<div><b>${esc(state.data?.settings?.school_name||'مدرسة المنارة الخاصة')}</b><small>MANARA PRIVATE SCHOOL</small></div><button class="drawer-close" onclick="toggleSidebar(false)" aria-label="إغلاق">×</button></div><div class="user-card"><b>${esc(state.user?.name||'')}</b><small>${state.role==='admin'?'مدير النظام — تحكم كامل':'مدرس — طلاب + حضور + ملاحظات للأهل'}</small></div><div class="side-label">القائمة الرئيسية</div><nav class="side-nav">${navItems().map(n=>`<button class="${state.tab===n[0]?'active':''}" onclick="setTab('${n[0]}')"><i class="nav-icon">${n[1]}</i>${n[2]}</button>`).join('')}</nav><div class="side-label" style="margin-top:16px">الحساب</div><nav class="side-nav"><button onclick="goParent()"><i class="nav-icon">◫</i>معاينة بوابة الأهل</button><button onclick="logout()"><i class="nav-icon">↪</i>تسجيل الخروج</button></nav></aside><div class="drawer-backdrop ${state.sidebar?'show':''}" onclick="toggleSidebar(false)"></div>
  <main class="main"><header class="topbar"><div class="row"><button class="btn outline mobile-menu" onclick="toggleSidebar()">☰</button><div class="page-title"><b>${labels[state.tab]||''}</b><small>${state.role==='admin'?'لوحة الإدارة الرئيسية':'إدارة الطلاب والحضور والملاحظات ضمن الشعب المخصصة'}</small></div></div><img class="top-logo" src="assets/logo.jpg" alt=""><div class="top-actions"><span class="badge ${state.role}">${state.role==='admin'?'الإدارة':'مدرس'}</span></div></header><section class="content"><img class="content-watermark" src="assets/logo.jpg" alt="">${pageContent()}</section></main></div>`;
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
  <div class="two-col section"><div class="card"><div class="row between"><h3 class="section-title">الكتل المدرسية</h3><button class="btn small secondary" onclick="setTab('buildings')">إدارة الكتل</button></div><div class="table-wrap"><table><thead><tr><th>الكتلة</th><th>الغرف</th><th>المخصصة</th><th>الطلاب</th><th></th></tr></thead><tbody>${blocks}</tbody></table></div></div><div class="card"><h3 class="section-title">ملخص النظام</h3><div class="stack"><div class="row between"><span>المدرسون النشطون</span><b>${(d.teachers||[]).filter(t=>t.active!==false).length}</b></div><div class="row between"><span>ملاحظات الطلاب</span><b>${(d.studentNotes||[]).length}</b></div><div class="row between"><span>النتائج المسجلة</span><b>${gr.length}</b></div><div class="row between"><span>السنة الدراسية</span><b>${esc(d.settings?.academic_year||'—')}</b></div></div></div></div>
  <div class="card section"><div class="row between"><h3 class="section-title">آخر الطلاب المضافين</h3><button class="btn small secondary" onclick="setTab('students')">عرض الكل</button></div><div class="table-wrap"><table><thead><tr><th>الطالب</th><th>اسم الجد</th><th>الصف</th><th>الموقع</th><th>الكود</th></tr></thead><tbody>${(d.students||[]).slice(0,8).map(s=>`<tr><td><b>${esc(s.full_name)}</b></td><td>${esc(s.grandfather_name||'—')}</td><td>${esc(s.grade||'—')}</td><td>${esc(s.location_label||roomLocation(s.room_id))}</td><td><span class="code">${esc(s.access_code||'')}</span></td></tr>`).join('')||'<tr><td colspan="5" class="empty">لا يوجد طلاب بعد</td></tr>'}</tbody></table></div></div>`;
}
function page_students(){
  if(!['admin','teacher'].includes(state.role))return noAccess();
  const teacher=state.role==='teacher';
  return `<div class="toolbar"><div><h2 class="section-title">${teacher?'طلاب الشعب المخصصة لي':'سجل الطلاب'}</h2><div class="muted">${teacher?'تستطيع إضافة الطلاب وتعديل ملفاتهم ضمن الشعب التي حددتها الإدارة لك.':'تحكم كامل بملفات الطلاب وربط كل طالب بالكتلة والطابق والغرفة.'}</div></div><button class="btn" onclick="openStudentModal()">+ تسجيل طالب جديد</button></div>${teacher?`<div class="role-note">الشعب المخصصة لك: <b>${assignedRoomsLabel(state.user.id)}</b></div>`:''}<div class="card"><div class="toolbar"><div class="field search"><label>بحث سريع</label><input id="studentSearch" placeholder="الاسم، الجد، الكود، الصف..." oninput="filterStudentTable()"></div><div class="hint">عدد الطلاب: <b>${state.data.students.length}</b></div></div><div id="studentTable">${studentTableHtml()}</div></div>`;
}
function roomLocation(roomId){const r=state.data.rooms?.find(x=>x.id===roomId);if(!r)return '—';const f=state.data.floors?.find(x=>x.id===r.floor_id),b=state.data.buildings?.find(x=>x.id===f?.building_id);return `${b?.name||''} / ${f?.name||''} / ${r.name||r.code}`;}
function studentTableHtml(q=''){
  q=q.toLowerCase(); const rows=(state.data.students||[]).filter(st=>!q||[st.full_name,st.father_name,st.grandfather_name,st.family_name,st.access_code,st.grade,st.class_name,st.building_name,st.floor_name,st.room_name,roomLocation(st.room_id)].some(v=>String(v||'').toLowerCase().includes(q)));
  return `<div class="table-wrap"><table><thead><tr><th>الطالب</th><th>الأب</th><th>الجد</th><th>الصف</th><th>الموقع</th><th>الكود</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>${rows.map(st=>`<tr><td><b>${esc(st.full_name)}</b></td><td>${esc(st.father_name||'—')}</td><td><b>${esc(st.grandfather_name||'—')}</b></td><td>${esc(st.grade||'—')} ${st.class_name?`/ ${esc(st.class_name)}`:''}</td><td>${esc(st.location_label||roomLocation(st.room_id))}</td><td><span class="code">${esc(st.access_code||'')}</span></td><td><span class="badge ${st.active===false?'inactive':'active'}">${st.active===false?'موقوف':'فعال'}</span></td><td>${state.role==='admin'?`<div class="row"><button class="btn small secondary" onclick="openStudentModal('${st.id}')">تعديل</button><button class="btn small warning" onclick="regenerateCode('${st.id}')">كود جديد</button><button class="btn small" onclick="openNoteModal('${st.id}')">ملاحظة</button><button class="btn small danger" onclick="deleteStudent('${st.id}')">حذف</button></div>`:`<div class="row"><button class="btn small secondary" onclick="openStudentModal('${st.id}')">تعديل</button><button class="btn small" onclick="openNoteModal('${st.id}')">ملاحظة للأهل</button></div>`}</td></tr>`).join('')||'<tr><td colspan="8" class="empty">لا توجد نتائج</td></tr>'}</tbody></table></div>`;
}
function filterStudentTable(){document.getElementById('studentTable').innerHTML=studentTableHtml(document.getElementById('studentSearch').value.trim());applyMobileUi();}
function assignedRoomIds(teacherId=state.user?.id){return (state.data.teacherAssignments||[]).filter(a=>a.teacher_id===teacherId).map(a=>a.room_id);}
function assignedRoomsLabel(teacherId){const ids=assignedRoomIds(teacherId);if(!ids.length)return 'لا توجد شعب مخصصة';return ids.map(id=>roomLocation(id)).join(' • ');}
function roomOptions(selected=''){
  const allowed=state.role==='teacher'?new Set(assignedRoomIds()):null;
  return `<option value="">— اختر الشعبة / الغرفة —</option>`+(state.data.rooms||[]).filter(r=>!allowed||allowed.has(r.id)).map(r=>{const f=state.data.floors.find(x=>x.id===r.floor_id),b=state.data.buildings.find(x=>x.id===f?.building_id);return `<option value="${r.id}" ${selected===r.id?'selected':''}>${esc(b?.name||'')} — ${esc(f?.name||'')} — ${esc(r.name)} ${r.grade?`(${esc(r.grade)}${r.section_label?' / '+esc(r.section_label):''})`:''}</option>`}).join('');
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
    <div class="field"><label>الصف *</label><input id="s_grade" value="${esc(st.grade||'')}" ${teacher?'readonly':''}></div>
    <div class="field"><label>الغرفة المخصصة *</label><select id="s_room" onchange="syncStudentRoom()">${roomOptions(st.room_id||'')}</select></div>
    <div class="field"><label>الشعبة</label><input id="s_class" value="${esc(st.class_name||'')}" ${teacher?'readonly':''}></div>
  </div></div>

  <div class="section"><h3 class="section-title">معلومات الاتصال</h3><div class="mini-grid">
    <div class="field"><label>رقم هاتف ولي الأمر</label><input id="s_phone" inputmode="tel" value="${esc(st.parent_phone||'')}"></div>
    <div class="field"><label>العنوان</label><input id="s_address" value="${esc(st.address||'')}"></div>
    <div class="field"><label>الحالة</label><select id="s_active"><option value="true" ${st.active!==false?'selected':''}>فعال</option><option value="false" ${st.active===false?'selected':''}>موقوف</option></select></div>
  </div></div>

  <div class="section"><h3 class="section-title">المواصلات</h3><div class="mini-grid">
    <div class="field"><label>رقم السيارة</label><input id="s_transport" value="${esc(st.transport_car_number||'')}" placeholder="مثال: 12 أو رقم/اسم السيارة"></div>
  </div></div>

  <div class="field"><label>ملاحظة</label><textarea id="s_notes" placeholder="أي ملاحظة داخلية عن الطالب...">${esc(st.notes||'')}</textarea></div>
  <button class="btn" onclick="saveStudent('${id}')">${id?'حفظ التعديلات':'حفظ وإنشاء كود الطالب'}</button></div></div>`);
}
function closeModal(){document.getElementById('modal')?.remove();}
async function saveStudent(id=''){
  const msg=document.getElementById('modalMsg');
  const full=document.getElementById('s_full').value.trim(), grand=document.getElementById('s_grand').value.trim(), grade=document.getElementById('s_grade').value.trim(), room_id=document.getElementById('s_room').value||null;
  if(!full||!grand||!grade||!room_id){msg.innerHTML='<div class="message error">اسم الطالب واسم الجد والصف والشعبة حقول إلزامية.</div>';return;}
  if(state.role==='teacher'&&!assignedRoomIds().includes(room_id)){msg.innerHTML='<div class="message error">لا يمكنك إضافة طالب إلى شعبة غير مخصصة لك.</div>';return;}
  const row={
    full_name:full,
    father_name:document.getElementById('s_father').value.trim(),
    mother_name:document.getElementById('s_mother').value.trim(),
    grandfather_name:grand,
    grade,
    class_name:document.getElementById('s_class').value.trim(),
    room_id,
    gender:document.getElementById('s_gender').value,
    date_of_birth:document.getElementById('s_birth').value||null,
    parent_phone:document.getElementById('s_phone').value.trim(),
    address:document.getElementById('s_address').value.trim(),
    active:document.getElementById('s_active')?.value!=='false',
    transport_car_number:document.getElementById('s_transport').value.trim(),
    notes:document.getElementById('s_notes')?.value.trim()||''
  };
  try{
    if(DEMO){
      const room=state.data.rooms.find(r=>r.id===room_id),f=state.data.floors.find(x=>x.id===room?.floor_id),b=state.data.buildings.find(x=>x.id===f?.building_id);Object.assign(row,{room_name:room?.name,room_code:room?.code,floor_name:f?.name,building_name:b?.name,location_label:roomLocation(room_id)});
      if(id){Object.assign(state.data.students.find(x=>x.id===id),row);audit('تعديل','طالب',full);}else{row.id=uid();row.access_code=makeStudentCode();row.created_at=new Date().toISOString();state.data.students.unshift(row);audit('إضافة','طالب',full+' / '+row.access_code);} saveDemo();
    }else{
      let res;if(id)res=await sb.from('students').update(row).eq('id',id).select().single();else{row.access_code=makeStudentCode();res=await sb.from('students').insert(row).select().single();} if(res.error)throw res.error; await loadSupabaseData();
    }
    closeModal();render();
  }catch(e){msg.innerHTML=`<div class="message error">${esc(e.message)}</div>`;}
}
async function regenerateCode(id){if(!confirm('إنشاء كود دخول جديد؟ سيتوقف الكود القديم عن العمل.'))return; const c=makeStudentCode(); if(DEMO){const s=state.data.students.find(x=>x.id===id);s.access_code=c;audit('تغيير كود','طالب',s.full_name);saveDemo();render();}else{const {error}=await sb.from('students').update({access_code:c}).eq('id',id);if(error)return alert(error.message);await loadSupabaseData();render();} alert('الكود الجديد: '+c);}
async function deleteStudent(id){if(!confirm('سيتم حذف الطالب وسجلاته المرتبطة. هل أنت متأكد؟'))return;if(DEMO){const s=state.data.students.find(x=>x.id===id);state.data.students=state.data.students.filter(x=>x.id!==id);state.data.attendance=state.data.attendance.filter(x=>x.student_id!==id);state.data.grades=state.data.grades.filter(x=>x.student_id!==id);audit('حذف','طالب',s?.full_name||id);saveDemo();render();}else{const {error}=await sb.from('students').delete().eq('id',id);if(error)return alert(error.message);await loadSupabaseData();render();}}

function allowedAttendanceStudents(){
  // المدرس يرى فقط الطلاب الموجودين ضمن الشعب المخصصة له.
  return state.data.students||[];
}
function page_attendance(){
  const date=state.attDate||today(); const roster=allowedAttendanceStudents(); const records=(state.data.attendance||[]).filter(x=>x.date===date);
  const bopts=(state.data.buildings||[]).map(b=>`<option value="${b.id}">${esc(b.name)}</option>`).join('');
  return `<div class="toolbar"><div><h2 class="section-title">سجل الحضور والغياب والتأخير</h2><div class="muted">${state.role==='teacher'?'يمكنك تسجيل الحضور والغياب والتأخير للشعب المخصصة لك فقط.':'يمكن للإدارة والمدرسين المصرح لهم تحديث السجل.'}</div></div><div class="row"><div class="field" style="margin:0"><label>التاريخ</label><input id="attDate" type="date" value="${date}" onchange="changeAttDate(this.value)"></div></div></div>
  <div class="card"><div class="toolbar"><div class="row filters"><div class="field search"><label>بحث</label><input id="attSearch" placeholder="اسم الطالب أو الصف" oninput="filterAttendanceRoster()"></div><div class="field"><label>الكتلة</label><select id="attBuilding" onchange="filterAttendanceRoster()"><option value="">كل الكتل</option>${bopts}</select></div><div class="field"><label>الغرفة</label><select id="attRoom" onchange="filterAttendanceRoster()"><option value="">كل الغرف</option>${(state.data.rooms||[]).filter(r=>state.role!=='teacher'||assignedRoomIds().includes(r.id)).map(r=>`<option value="${r.id}">${esc(roomLocation(r.id))}</option>`).join('')}</select></div></div><div class="hint">اختر الحالة ثم احفظ صف الطالب.</div></div><div id="attRoster">${attendanceTableHtml(roster,records,'','','')}</div></div>`;
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
  const cards=(state.data.buildings||[]).map(b=>{const fs=state.data.floors.filter(f=>f.building_id===b.id),rs=state.data.rooms.filter(r=>fs.some(f=>f.id===r.floor_id)),assigned=rs.filter(r=>r.grade).length,students=state.data.students.filter(s=>rs.some(r=>r.id===s.room_id)).length;return `<div class="card building-card"><div class="row between"><div><div class="building-code">${esc(b.code)}</div><h3>${esc(b.name)}</h3></div><span class="badge active">${esc(b.audience||'عام')}</span></div><div class="building-stats"><div><b>${rs.length}</b><span>غرفة</span></div><div><b>${assigned}</b><span>مخصصة</span></div><div><b>${students}</b><span>طالب</span></div></div><p class="hint">${esc(b.notes||'')}</p></div>`}).join('');
  const rows=(state.data.rooms||[]).map(r=>{const f=state.data.floors.find(x=>x.id===r.floor_id),b=state.data.buildings.find(x=>x.id===f?.building_id),count=state.data.students.filter(s=>s.room_id===r.id).length;return `<tr><td>${esc(b?.name||'')}</td><td>${esc(f?.name||'')}</td><td><span class="code">${esc(r.code)}</span></td><td>${esc(r.name)}</td><td>${r.grade?esc(r.grade):'<span class="badge warning">غير مخصص</span>'}</td><td>${esc(r.section_label||'—')}</td><td>${count}</td><td><button class="btn small secondary" onclick="openRoomModal('${r.id}')">تعديل</button></td></tr>`}).join('');
  return `<div class="toolbar"><div><h2 class="section-title">الكتل والغرف</h2><div class="muted">هيكل المدرسة مثبت على 3 كتل ويمكنك تعديل تخصيص أي غرفة بنفسك.</div></div></div><div class="building-grid">${cards}</div><div class="card section"><div class="row between"><h3 class="section-title">دليل الغرف</h3><span class="hint">الغرف غير المحددة بقيت "غير مخصصة" بدل اختراع صفوف لم تذكرها.</span></div><div class="table-wrap"><table><thead><tr><th>الكتلة</th><th>الطابق</th><th>الكود</th><th>الغرفة</th><th>الصف</th><th>الشعبة</th><th>الطلاب</th><th>إجراء</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}
function openRoomModal(id){const r=state.data.rooms.find(x=>x.id===id);if(!r)return;document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="modal"><div class="modalbox" style="max-width:560px"><div class="row between"><h2 class="section-title">تعديل الغرفة</h2><button class="btn outline" onclick="closeModal()">إغلاق</button></div><div id="modalMsg"></div><div class="field"><label>اسم الغرفة</label><input id="r_name" value="${esc(r.name)}"></div><div class="field"><label>الصف / المرحلة</label><input id="r_grade" value="${esc(r.grade||'')}" placeholder="اتركها فارغة إذا غير مخصصة"></div><div class="field"><label>الشعبة</label><input id="r_section" value="${esc(r.section_label||'')}"></div><button class="btn" onclick="saveRoom('${id}')">حفظ</button></div></div>`);}
async function saveRoom(id){const row={name:document.getElementById('r_name').value.trim(),grade:document.getElementById('r_grade').value.trim(),section_label:document.getElementById('r_section').value.trim()};if(DEMO){Object.assign(state.data.rooms.find(x=>x.id===id),row);audit('تعديل','غرفة',roomLocation(id));saveDemo();closeModal();render();}else{const {error}=await sb.from('rooms').update(row).eq('id',id);if(error)return document.getElementById('modalMsg').innerHTML=`<div class="message error">${esc(error.message)}</div>`;await loadSupabaseData();closeModal();render();}}

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
  const {data}=sb.storage.from('student-note-images').getPublicUrl(path);
  return data?.publicUrl||'';
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
      if(file){msg.innerHTML='<div class="message">جاري رفع الصورة وحفظ الملاحظة...</div>';image_url=await uploadStudentNoteImage(student_id,file);}
      const {data:note,error}=await sb.from('student_notes').insert({student_id,title,content,category,importance,image_url:image_url||null,visible_to_parent:true,created_by:state.user.id}).select().single();
      if(error)throw error;
      let pushMsg='';
      try{const {data:push,error:pushError}=await sb.functions.invoke('send-parent-push',{body:{student_id,title:'مدرسة المنارة الخاصة',body:(title+' — '+content).slice(0,260),note_id:note?.id||''}});if(pushError)pushMsg='تم حفظ الملاحظة، لكن تعذر إرسال إشعار الهاتف.';else if(!push?.sent)pushMsg='تم حفظ الملاحظة، لكن لا يوجد جهاز ولي أمر مسجل للإشعارات بعد.';}catch(_){pushMsg='تم حفظ الملاحظة، لكن تعذر إرسال إشعار الهاتف.';}
      await loadSupabaseData();if(pushMsg)setTimeout(()=>alert(pushMsg),100);else setTimeout(()=>alert(image_url?'تم حفظ الملاحظة والصورة وإرسال إشعار لولي الأمر.':'تم حفظ الملاحظة وإرسال إشعار لولي الأمر.'),100);
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
async function saveAnnouncement(){const title=document.getElementById('a_title').value.trim(),content=document.getElementById('a_content').value.trim();if(!title||!content)return alert('أكمل العنوان والنص.');if(DEMO){state.data.announcements.unshift({id:uid(),title,content,date:new Date().toLocaleDateString('ar'),created_at:new Date().toISOString()});audit('نشر','إعلان',title);saveDemo();}else{const {error}=await sb.from('announcements').insert({title,content,target_type:'all',created_by:state.user.id});if(error)return alert(error.message);await loadSupabaseData();}closeModal();render();}
async function deleteAnnouncement(id){if(!confirm('حذف الإعلان؟'))return;if(DEMO){state.data.announcements=state.data.announcements.filter(x=>x.id!==id);saveDemo();render();}else{const {error}=await sb.from('announcements').delete().eq('id',id);if(error)return alert(error.message);await loadSupabaseData();render();}}

function teacherRoomCheckboxes(selected=[]){
  const set=new Set(selected||[]);
  return `<div class="room-check-grid">${(state.data.rooms||[]).map(r=>`<label class="room-check"><input type="checkbox" name="teacher_room" value="${r.id}" ${set.has(r.id)?'checked':''}><span><b>${esc(roomLocation(r.id))}</b><small>${r.grade?`الصف ${esc(r.grade)}${r.section_label?' — الشعبة '+esc(r.section_label):''}`:'غرفة غير مخصصة'}</small></span></label>`).join('')}</div>`;
}
function selectedTeacherRooms(){return [...document.querySelectorAll('input[name="teacher_room"]:checked')].map(x=>x.value);}
function page_teachers(){
  if(state.role!=='admin')return noAccess();
  return `<div class="toolbar"><div><h2 class="section-title">حسابات المدرسين وتوزيع الشعب</h2><div class="muted">يمكنك إضافة الأستاذ وتعديل اسمه أو بريده أو كلمة مروره أو شعبه، كما يمكنك حذف الحساب نهائياً.</div></div><button class="btn" onclick="openTeacherModal()">+ إضافة أستاذ</button></div><div class="role-note">توزيع الشعب يبقى بيد الإدارة فقط. حذف الأستاذ يحذف حساب دخوله ويزيل توزيعه على الشعب، ولا يحذف سجلات حضور الطلاب السابقة.</div><div class="card section"><div class="table-wrap"><table><thead><tr><th>اسم الأستاذ</th><th>${DEMO?'اسم المستخدم':'الحساب'}</th><th>الشعب المخصصة</th><th>الصلاحية</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>${state.data.teachers.map(t=>`<tr><td><b>${esc(t.full_name)}</b></td><td>${esc(t.username||t.email||t.id)}</td><td><div class="assignment-list">${assignedRoomIds(t.id).map(id=>`<span class="badge active">${esc(roomLocation(id))}</span>`).join(' ')||'<span class="badge warning">لم تحدد شعب</span>'}</div></td><td><span class="badge teacher">إضافة طلاب + حضور ضمن شعبه</span></td><td><span class="badge ${t.active===false?'inactive':'active'}">${t.active===false?'موقوف':'فعال'}</span></td><td><div class="row"><button class="btn small secondary" onclick="openTeacherEditModal('${t.id}')">تعديل</button><button class="btn small ${t.active===false?'secondary':'danger'}" onclick="toggleTeacher('${t.id}',${t.active===false?'true':'false'})">${t.active===false?'تفعيل':'إيقاف'}</button><button class="btn small danger" onclick="deleteTeacher('${t.id}')">حذف</button></div></td></tr>`).join('')||'<tr><td colspan="6" class="empty">لا يوجد مدرسون</td></tr>'}</tbody></table></div></div>`;
}
function openTeacherModal(){document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="modal"><div class="modalbox"><div class="row between"><div><h2 class="section-title">إضافة أستاذ</h2><div class="muted">يمكن اختيار أكثر من شعبة للأستاذ نفسه.</div></div><button class="btn outline" onclick="closeModal()">إغلاق</button></div><div id="modalMsg"></div><div class="mini-grid section"><div class="field"><label>اسم الأستاذ *</label><input id="t_name"></div><div class="field"><label>${DEMO?'اسم المستخدم *':'البريد الإلكتروني *'}</label><input id="t_login" inputmode="email"></div><div class="field"><label>كلمة المرور المؤقتة *</label><input id="t_password" type="password"></div></div><div class="field"><label>الشعب المخصصة للأستاذ * — يمكنك اختيار أكثر من شعبة</label>${teacherRoomCheckboxes([])}</div><button class="btn" onclick="saveTeacher()">إنشاء الحساب وحفظ الشعب</button></div></div>`);}
async function saveTeacher(){const full_name=document.getElementById('t_name').value.trim(),login=document.getElementById('t_login').value.trim(),password=document.getElementById('t_password').value,room_ids=selectedTeacherRooms(),msg=document.getElementById('modalMsg');if(!full_name||!login||password.length<6){msg.innerHTML='<div class="message error">أدخل الاسم والحساب وكلمة مرور 6 أحرف على الأقل.</div>';return;}if(!room_ids.length){msg.innerHTML='<div class="message error">اختر شعبة واحدة على الأقل للأستاذ.</div>';return;}try{if(DEMO){if(state.data.teachers.some(x=>x.username===login))throw new Error('اسم المستخدم موجود مسبقاً.');const id=uid();state.data.teachers.unshift({id,full_name,username:login,password,active:true});room_ids.forEach(room_id=>state.data.teacherAssignments.push({teacher_id:id,room_id}));audit('إضافة','مدرس',full_name);saveDemo();}else{const {data,error}=await sb.functions.invoke('create-teacher',{body:{email:login,password,full_name,room_ids}});if(error){let detail=error.message||'تعذر تشغيل خدمة إنشاء المدرس.';try{const body=await error.context?.json();if(body?.error)detail=body.error;}catch(_){}if(/not found|404|function/i.test(detail))detail+=' تأكد من نشر Edge Function create-teacher في Supabase.';throw new Error(detail);}if(data?.error)throw new Error(data.error);await loadSupabaseData();}closeModal();render();}catch(e){msg.innerHTML=`<div class="message error">${esc(authErrorArabic(e.message))}</div>`;}}

function openTeacherEditModal(id){
  const t=state.data.teachers.find(x=>x.id===id);if(!t)return;
  document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="modal"><div class="modalbox"><div class="row between"><div><h2 class="section-title">تعديل الأستاذ</h2><div class="muted">يمكن تعديل الاسم والشعب، وتغيير البريد أو كلمة المرور عند الحاجة.</div></div><button class="btn outline" onclick="closeModal()">إغلاق</button></div><div id="modalMsg"></div><div class="mini-grid section"><div class="field"><label>اسم الأستاذ *</label><input id="te_name" value="${esc(t.full_name||'')}"></div><div class="field"><label>${DEMO?'اسم المستخدم الجديد — اختياري':'البريد الإلكتروني الجديد — اختياري'}</label><input id="te_login" inputmode="email" placeholder="اتركه فارغاً لعدم التغيير"></div><div class="field"><label>كلمة مرور جديدة — اختياري</label><input id="te_password" type="password" placeholder="اتركها فارغة لعدم التغيير"></div></div><div class="field"><label>الشعب المخصصة للأستاذ *</label>${teacherRoomCheckboxes(assignedRoomIds(id))}</div><button class="btn" onclick="saveTeacherEdit('${id}')">حفظ التعديلات</button></div></div>`);
}
async function saveTeacherEdit(id){
  const full_name=document.getElementById('te_name').value.trim(),login=document.getElementById('te_login').value.trim(),password=document.getElementById('te_password').value,room_ids=selectedTeacherRooms(),msg=document.getElementById('modalMsg');
  if(!full_name){msg.innerHTML='<div class="message error">اسم الأستاذ مطلوب.</div>';return;}
  if(password&&password.length<6){msg.innerHTML='<div class="message error">كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل.</div>';return;}
  if(!room_ids.length){msg.innerHTML='<div class="message error">اختر شعبة واحدة على الأقل للأستاذ.</div>';return;}
  try{
    if(DEMO){const t=state.data.teachers.find(x=>x.id===id);if(!t)throw new Error('الأستاذ غير موجود.');t.full_name=full_name;if(login)t.username=login;if(password)t.password=password;state.data.teacherAssignments=state.data.teacherAssignments.filter(x=>x.teacher_id!==id);room_ids.forEach(room_id=>state.data.teacherAssignments.push({teacher_id:id,room_id}));audit('تعديل','مدرس',full_name);saveDemo();}
    else{const {data,error}=await sb.functions.invoke('manage-teacher',{body:{action:'update',teacher_id:id,full_name,email:login||undefined,password:password||undefined,room_ids}});if(error){let detail=error.message||'تعذر تعديل الأستاذ.';try{const body=await error.context?.json();if(body?.error)detail=body.error;}catch(_){}if(/not found|404|function/i.test(detail))detail+=' تأكد من نشر Edge Function manage-teacher في Supabase.';throw new Error(detail);}if(data?.error)throw new Error(data.error);await loadSupabaseData();}
    closeModal();render();
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
async function saveTeacherRooms(id){const room_ids=selectedTeacherRooms(),msg=document.getElementById('modalMsg');if(!room_ids.length){msg.innerHTML='<div class="message error">اختر شعبة واحدة على الأقل.</div>';return;}try{if(DEMO){state.data.teacherAssignments=state.data.teacherAssignments.filter(x=>x.teacher_id!==id);room_ids.forEach(room_id=>state.data.teacherAssignments.push({teacher_id:id,room_id}));saveDemo();}else{let d=await sb.from('teacher_room_assignments').delete().eq('teacher_id',id);if(d.error)throw d.error;let i=await sb.from('teacher_room_assignments').insert(room_ids.map(room_id=>({teacher_id:id,room_id})));if(i.error)throw i.error;await loadSupabaseData();}closeModal();render();}catch(e){msg.innerHTML=`<div class="message error">${esc(e.message)}</div>`;}}
async function toggleTeacher(id,active){if(DEMO){const t=state.data.teachers.find(x=>x.id===id);t.active=active;audit(active?'تفعيل':'إيقاف','مدرس',t.full_name);saveDemo();render();}else{const {error}=await sb.from('profiles').update({active}).eq('id',id);if(error)return alert(error.message);await loadSupabaseData();render();}}

function page_audit(){if(state.role!=='admin')return noAccess();return `<div class="toolbar"><div><h2 class="section-title">سجل العمليات</h2><div class="muted">مرجع لمعرفة من قام بالتعديل ومتى.</div></div></div><div class="card"><div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>المستخدم</th><th>العملية</th><th>القسم</th><th>التفاصيل</th></tr></thead><tbody>${(state.data.audit||[]).map(a=>`<tr><td>${esc(new Date(a.created_at).toLocaleString('ar'))}</td><td>${esc(a.actor_name||a.actor||'—')}</td><td>${esc(a.action)}</td><td>${esc(a.entity||a.entity_type||'—')}</td><td>${esc(a.details||'—')}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">لا توجد عمليات مسجلة</td></tr>'}</tbody></table></div></div>`;}

function page_settings(){if(state.role!=='admin')return noAccess();const s=state.data.settings||{};return `<div class="toolbar"><div><h2 class="section-title">إعدادات المدرسة</h2><div class="muted">أنت تتحكم بالمعلومات الأساسية التي تظهر داخل النظام.</div></div></div><div class="card" style="max-width:850px"><div class="row" style="margin-bottom:15px">${logo().replace('<img','<img style="width:80px;height:80px;border-radius:50%;object-fit:cover"')}<div><b>الشعار الحالي</b><div class="hint">الشعار يظهر في صفحة الدخول، القائمة الجانبية، الشريط العلوي وداخل واجهة النظام.</div></div></div><div class="mini-grid"><div class="field"><label>اسم المدرسة</label><input id="set_name" value="${esc(s.school_name||'مدرسة المنارة الخاصة')}"></div><div class="field"><label>الاسم بالإنكليزية</label><input id="set_en" value="${esc(s.school_name_en||'MANARA PRIVATE SCHOOL')}"></div><div class="field"><label>تأسست عام</label><input id="set_year" value="${esc(s.established_year||'2007')}"></div><div class="field"><label>السنة الدراسية</label><input id="set_academic" value="${esc(s.academic_year||'2026/2027')}"></div><div class="field"><label>هاتف المدرسة</label><input id="set_phone" value="${esc(s.phone||'')}"></div><div class="field"><label>العنوان</label><input id="set_address" value="${esc(s.address||'')}"></div></div><button class="btn" onclick="saveSettings()">حفظ الإعدادات</button></div>`;}
async function saveSettings(){const row={school_name:document.getElementById('set_name').value.trim(),school_name_en:document.getElementById('set_en').value.trim(),established_year:document.getElementById('set_year').value.trim(),academic_year:document.getElementById('set_academic').value.trim(),phone:document.getElementById('set_phone').value.trim(),address:document.getElementById('set_address').value.trim()};if(DEMO){Object.assign(state.data.settings,row);audit('تعديل','إعدادات المدرسة',row.school_name);saveDemo();render();}else{const id=state.data.settings?.id;let res=id?await sb.from('school_settings').update(row).eq('id',id):await sb.from('school_settings').insert(row);if(res.error)return alert(res.error.message);await loadSupabaseData();render();}}
function noAccess(){return `<div class="card"><h3>لا توجد صلاحية</h3><p class="muted">هذا الحساب غير مخول لفتح هذه الصفحة.</p></div>`;}

init();
