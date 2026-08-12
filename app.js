'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const STORE='worknote_state_v1';
const APP_VERSION='31.0.0';
const REPORT_DRAFT_STORE='worknote_report_drafts_v1';
const GEMINI_KEY_STORE='worknote_gemini_api_key_v1';
const V15_CLEANUP_STORE='worknote_v15_cleanup_done';
const DEFAULT_GEMINI_MODEL='gemini-3.1-flash-lite';
const pad=n=>String(n).padStart(2,'0');
const isoDate=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2);
const nowISO=()=>new Date().toISOString();
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function sanitizeRichHTML(html){
 const t=document.createElement('template');t.innerHTML=String(html||'');
 const allowed=new Set(['B','STRONG','I','EM','U','SPAN','MARK','UL','OL','LI','BR','DIV','P','FONT']);
 const walk=node=>{[...node.childNodes].forEach(ch=>{if(ch.nodeType!==1)return;if(!allowed.has(ch.tagName)){ch.replaceWith(...ch.childNodes);return}if(ch.tagName==='FONT'){const span=document.createElement('span');const size=ch.getAttribute('size'),color=ch.getAttribute('color');if(size)span.style.fontSize=({1:'12px',2:'13px',3:'16px',4:'19px',5:'23px',6:'28px',7:'34px'}[size]||'16px');if(color)span.style.color=color;span.innerHTML=ch.innerHTML;ch.replaceWith(span);ch=span}[...ch.attributes].forEach(a=>{if(a.name!=='style')ch.removeAttribute(a.name)});if(ch.hasAttribute('style')){const st=ch.style,safe=[];if(st.fontWeight)safe.push(`font-weight:${st.fontWeight}`);if(st.fontSize)safe.push(`font-size:${st.fontSize}`);if(st.color)safe.push(`color:${st.color}`);if(st.backgroundColor)safe.push(`background-color:${st.backgroundColor}`);if(st.textDecoration)safe.push(`text-decoration:${st.textDecoration}`);ch.setAttribute('style',safe.join(';'))}walk(ch)})};walk(t.content);return t.innerHTML
}
function htmlToPlainText(html){const d=document.createElement('div');d.innerHTML=sanitizeRichHTML(html||'');return (d.innerText||d.textContent||'').replace(/\u00a0/g,' ').trim()}
function richTextHTML(text,html){return html?sanitizeRichHTML(html):displayMultiline(text||'')}
function richToolbarHTML(){return `<div class="rich-toolbar"><button type="button" data-rich="bold"><b>B</b></button><select id="richSize" aria-label="文字サイズ"><option value="2">小</option><option value="3" selected>標準</option><option value="4">大</option><option value="5">見出し</option></select><button type="button" class="rich-color red" data-color="#d11a2a" title="赤">A</button><button type="button" class="rich-color blue" data-color="#1769aa" title="青">A</button><button type="button" class="rich-color green" data-color="#1f7a4c" title="緑">A</button><button type="button" class="rich-color orange" data-color="#d97706" title="オレンジ">A</button><button type="button" class="rich-marker" data-highlight="#fff19b" title="マーカー">▰</button><button type="button" data-rich="insertUnorderedList">•</button><button type="button" data-rich="insertOrderedList">1.</button><button type="button" data-rich="underline"><u>U</u></button></div>`}
function execRich(cmd,value=null){document.execCommand(cmd,false,value);queueSimpleDraft()}
function bindRichToolbar(){$$('[data-rich]').forEach(b=>b.onclick=()=>execRich(b.dataset.rich));if($('#richSize'))$('#richSize').onchange=e=>execRich('fontSize',e.target.value);$$('[data-color]').forEach(b=>b.onclick=()=>execRich('foreColor',b.dataset.color));$$('[data-highlight]').forEach(b=>b.onclick=()=>execRich('hiliteColor',b.dataset.highlight));$('#quickRichText')?.addEventListener('input',queueSimpleDraft)}
function staffSelectorHTML(selectedIds=[]){const selected=new Set(selectedIds||[]);return `<div class="field note-editor-options"><label>スタッフ（複数選択可）</label><div class="staff-multi-select">${activeStaffMembers().map(m=>`<label class="staff-check"><input type="checkbox" data-staff-select value="${m.id}" ${selected.has(m.id)?'checked':''}><span>${esc(m.name)}</span></label>`).join('')||'<span class="small">登録スタッフはいません</span>'}</div></div>`}
function selectedStaffIdsFromEditor(){return [...$$('[data-staff-select]:checked')].map(x=>x.value)}
let simpleDraftTimer=null;
function simpleDraftKey(existing,type,date){return `worknote_simple_draft_${existing?.id||'new'}_${type}_${date}`}
function loadSimpleDraft(existing,type,date){try{return JSON.parse(localStorage.getItem(simpleDraftKey(existing,type,date))||'null')}catch{return null}}
function saveSimpleDraft(existing,type,date){const ed=$('#quickRichText');if(!ed)return;const richHTML=sanitizeRichHTML(ed.innerHTML),staffIds=selectedStaffIdsFromEditor();localStorage.setItem(simpleDraftKey(existing,type,date),JSON.stringify({richHTML,text:htmlToPlainText(richHTML),staffIds,savedAt:nowISO()}));const x=$('#simpleDraftStatus');if(x)x.textContent='✓ 保存済み'}
function clearSimpleDraft(existing,type,date){localStorage.removeItem(simpleDraftKey(existing,type,date))}

let plainDraftTimer=null;
function savePlainDraft(existing,type,date){const ed=$('#quickText');if(!ed)return;const staffIds=selectedStaffIdsFromEditor();localStorage.setItem(simpleDraftKey(existing,type,date),JSON.stringify({text:ed.value,staffIds,savedAt:nowISO()}));const x=$('#simpleDraftStatus');if(x)x.textContent='✓ 保存済み'}
function queuePlainDraft(){const x=$('#simpleDraftStatus');if(x)x.textContent='保存中…';clearTimeout(plainDraftTimer);plainDraftTimer=setTimeout(()=>{const type=$('#noteType')?.value,date=$('#noteDate')?.value;if(type&&date)savePlainDraft(window.__worknoteEditingNote||null,type,date)},700)}
function queueSimpleDraft(){const x=$('#simpleDraftStatus');if(x)x.textContent='保存中…';clearTimeout(simpleDraftTimer);simpleDraftTimer=setTimeout(()=>{const type=$('#noteType')?.value,date=$('#noteDate')?.value;if(type&&date)saveSimpleDraft(window.__worknoteEditingNote||null,type,date)},800)}

const DEFAULT={
 version:1,profile:{name:'ヒガ'},settings:{notifications:false,notificationMaster:true,carryMode:'nextShift',lastBackup:null,notificationLog:{},reportReminderEnabled:true,reportReminderTime:'22:00'},
 ai:{mode:'local',endpoint:'',chat:[],rules:[],staffInsights:{},connectionStatus:'未接続',lastError:'',model:DEFAULT_GEMINI_MODEL},
 shiftTypes:[{id:'early',name:'早番',start:'09:30',end:'18:30',color:'#7dc6ff'},{id:'late',name:'遅番',start:'11:00',end:'20:00',color:'#9e8cff'},{id:'full',name:'フル',start:'09:30',end:'20:00',color:'#55c9a5'},{id:'off',name:'休み',start:'',end:'',color:'#aeb9c5'}],
 shifts:{},
 rules:[
  {id:uid(),title:'セルナビ更新',enabled:true,scope:'work',timing:'退勤前',notify:false},
  {id:uid(),title:'クレカ実績更新',enabled:true,scope:'work',timing:'退勤前',notify:false},
  {id:uid(),title:'当日実績確認',enabled:true,scope:'work',timing:'退勤前',notify:false},
  {id:uid(),title:'未完了案件確認',enabled:true,scope:'work',timing:'退勤前',notify:false},
  {id:uid(),title:'予約内容の確認',enabled:true,scope:'early',timing:'出勤時',notify:false}
 ],tasks:[],notes:[],events:[],focus:{},dayClosed:{},trash:[],staff:{members:[],goals:{},followups:[]}
};
let state=load();
state.settings=Object.assign({},clone(DEFAULT.settings),state.settings||{});
state.trash=state.trash||[];
state.staff=Object.assign({members:[],goals:{},followups:[]},state.staff||{});state.staff.members=state.staff.members||[];state.staff.goals=state.staff.goals||{};state.staff.followups=state.staff.followups||[];
state.ai=Object.assign({},clone(DEFAULT.ai),state.ai||{});state.ai.chat=state.ai.chat||[];state.ai.rules=state.ai.rules||[];state.ai.staffInsights=state.ai.staffInsights||{};state.ai.mentor=Object.assign({issues:{},weeklyReviews:[],monthlyReports:[],lastWeeklyAt:'',memories:[],roleupTasks:[]},state.ai.mentor||{});state.ai.mentor.issues=state.ai.mentor.issues||{};state.ai.mentor.weeklyReviews=state.ai.mentor.weeklyReviews||[];state.ai.mentor.monthlyReports=Array.isArray(state.ai.mentor.monthlyReports)?state.ai.mentor.monthlyReports:[];state.ai.mentor.roleupTasks=Array.isArray(state.ai.mentor.roleupTasks)?state.ai.mentor.roleupTasks:[];state.ai.mentor.memories=Array.isArray(state.ai.mentor.memories)?state.ai.mentor.memories:[];delete state.ai.inbox;delete state.ai.weekly;delete state.ai.lastDigestKey;delete state.ai.lastRun;delete state.ai.automationLevel;delete state.ai.enabled;if(state.ai.mode==='openai'||state.ai.mode==='gemini')state.ai.mode='geminiDirect';state.ai.model=state.ai.model||DEFAULT_GEMINI_MODEL;
state.notes.forEach(n=>{if(n.type==='fixed'||n.type==='report')n.type='normal'});
if(!localStorage.getItem(V15_CLEANUP_STORE)){const today=isoDate(new Date());state.tasks=state.tasks.filter(t=>!t.date||t.date>=today);localStorage.setItem(V15_CLEANUP_STORE,'1')}
migrateStaffMaster();save();
let currentView='home', calCursor=new Date(), selectedDate=isoDate(new Date());
let swRegistration=null, updateReloading=false;
function clone(v){return JSON.parse(JSON.stringify(v))}
function load(){try{const x=JSON.parse(localStorage.getItem(STORE));return x?Object.assign(clone(DEFAULT),x):clone(DEFAULT)}catch{return clone(DEFAULT)}}
function save(){localStorage.setItem(STORE,JSON.stringify(state))}
function toast(t,actionLabel='',action=null,duration=2200){const e=$('#toast');e.innerHTML=`<span>${esc(t)}</span>${actionLabel?`<button id="toastAction">${esc(actionLabel)}</button>`:''}`;e.classList.remove('hidden');clearTimeout(toast.t);if(actionLabel&&$('#toastAction'))$('#toastAction').onclick=()=>{clearTimeout(toast.t);e.classList.add('hidden');action?.()};toast.t=setTimeout(()=>e.classList.add('hidden'),duration)}
function formatDate(d){return new Intl.DateTimeFormat('ja-JP',{month:'long',day:'numeric',weekday:'long'}).format(d)}
function shiftByDate(date){const id=state.shifts[date];return state.shiftTypes.find(x=>x.id===id)}
function isWorkShift(s){return s&&s.id!=='off'}

function autoRuleAppliesToDate(rule,date){
 const shift=shiftByDate(date);
 if(!rule||rule.enabled===false)return false;
 if(rule.scope==='daily')return true;
 if(rule.scope==='work')return isWorkShift(shift);
 return !!shift&&rule.scope===shift.id
}

function ensureTasksForDate(date){
 state.rules.filter(r=>autoRuleAppliesToDate(r,date)).forEach(r=>{
  const key=`${date}:${r.id}`;
  if(!state.tasks.some(t=>t.autoKey===key))state.tasks.push({id:uid(),title:r.title,date,done:false,createdAt:nowISO(),auto:true,autoKey:key,ruleId:r.id,timing:r.timing,carriedFrom:null});
 });
 save()
}
function reconcileDate(date){
 const allowed=new Set();
 state.rules.filter(r=>autoRuleAppliesToDate(r,date)).forEach(r=>allowed.add(`${date}:${r.id}`));
 state.tasks=state.tasks.filter(t=>{
  if(t.date!==date||!t.auto||t.done)return true;
  if(t.manuallyEdited)return true;
  return allowed.has(t.autoKey)
 });
 ensureTasksForDate(date);
 save()
}
function nextWorkDate(from){let d=new Date(from+'T12:00:00');for(let i=0;i<370;i++){d.setDate(d.getDate()+1);const k=isoDate(d);if(isWorkShift(shiftByDate(k)))return k}return null}
function render(){ensureTasksForDate(isoDate(new Date()));$('#headerDate').textContent=formatDate(new Date());
 const titles={home:'WORKNOTE',notes:'メモ',calendar:'カレンダー',ai:'AI副店長メンター',settings:'設定'};$('#pageTitle').textContent=titles[currentView];
 $$('.view').forEach(v=>v.classList.remove('active'));$(`#view-${currentView}`).classList.add('active');$$('.bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===currentView));
 ({home:renderHome,notes:renderNotes,calendar:renderCalendar,ai:renderAI,settings:renderSettings}[currentView])();
}
function homeUpcomingEvents(date){
 const items=state.events.filter(e=>eventEndDate(e)>=date).sort((a,b)=>eventStartDate(a).localeCompare(eventStartDate(b))||eventEndDate(a).localeCompare(eventEndDate(b))||a.title.localeCompare(b.title,'ja'));
 return items.slice(0,6);
}
function homeEventStatus(e,date){
 const start=eventStartDate(e),end=eventEndDate(e);
 if(start<=date&&date<=end)return '実施中';
 const days=Math.ceil((new Date(start+'T12:00:00')-new Date(date+'T12:00:00'))/86400000);
 if(days===0)return '今日';
 if(days===1)return '明日';
 return `${days}日後`;
}
function homeEventHTML(e,date){
 const start=eventStartDate(e),end=eventEndDate(e),status=homeEventStatus(e,date),range=start===end?start.replaceAll('-','/'):eventRangeLabel(e).replaceAll('-','/');
 return `<button class="home-event-row" data-home-event="${esc(e.id)}"><span class="home-event-mark">${eventCategoryIcon(e.category)}</span><span class="home-event-main"><b>${esc(e.title)}</b><small>${esc(eventCategoryLabel(e.category))}・${esc(range)}</small></span><span class="home-event-status ${status==='実施中'?'active':''}">${esc(status)}</span><span class="home-event-arrow">›</span></button>`;
}
function dailyReportForDate(date){return state.notes.find(n=>!n.archived&&n.type==='dailyReport'&&n.date===date)||null}
function dailyGoalForDate(date){return (dailyReportForDate(date)?.reportData?.goal||'').trim()}
function openTodayGoalEditor(date){const n=dailyReportForDate(date);if(n)return openQuickNote(n);openQuickNote(null);setTimeout(()=>{if(!$('#noteType'))return;$('#noteType').value='dailyReport';$('#noteType').dispatchEvent(new Event('change'));if($('#noteDate')){$('#noteDate').value=date;$('#noteDate').dispatchEvent(new Event('change'))}setTimeout(()=>$('#noteEditorDynamic [data-report-field="goal"]')?.focus(),40)},40)}
function renderHome(){const date=isoDate(new Date());ensureTasksForDate(date);const tasks=state.tasks.filter(t=>t.date===date),done=tasks.filter(t=>t.done).length,notes=state.notes.filter(n=>n.date===date&&!n.archived),reports=notes.filter(n=>n.type==='dailyReport').length,shift=shiftByDate(date),upcomingEvents=homeUpcomingEvents(date),todayGoal=dailyGoalForDate(date),insights=localInsights(date);
 $('#view-home').innerHTML=`<section class="hero"><div class="hero-row"><div class="hero-greeting-wrap"><h2 class="hero-greeting"><span>${greeting()}、</span><strong>${esc(state.profile.name)}さん</strong></h2><p>${formatDate(new Date())}</p></div><div class="shift-pill">${shift?`${esc(shift.name)}${shift.start?` ${shift.start}〜${shift.end}`:''}`:'シフト未登録'}</div></div><div class="stats"><div class="stat"><strong>${done}/${tasks.length}</strong><span>タスク</span></div><div class="stat"><strong>${notes.length}</strong><span>今日のメモ</span></div><div class="stat"><strong>${reports}</strong><span>日報</span></div></div></section>
 <section class="section"><div class="section-head"><h2>🎯 今日の重点</h2>${todayGoal?'<button class="link-btn" id="editTodayGoal">日報で編集</button>':''}</div><button class="card focus-card home-goal-card" id="todayGoalCard">${todayGoal?`<div class="home-goal-text">${displayMultiline(todayGoal)}</div>`:'<div class="home-goal-empty"><strong>今日の目標を入力</strong><span>朝一の日報に書いた「今日の目標」がここに表示されます</span></div>'}</button></section>
 <section class="section"><div class="section-head"><h2>📅 イベント</h2><button class="link-btn" id="openCalendarEvents">カレンダーを見る</button></div><div class="card home-events-card">${upcomingEvents.length?upcomingEvents.map(e=>homeEventHTML(e,date)).join(''):'<div class="home-events-empty">予定されているイベントはありません</div>'}</div></section>
 <section class="section"><div class="section-head"><h2>💡 AIからの気づき</h2><span class="small">端末内判定</span></div>${insights.length?insights.map(x=>`<button class="card local-insight-card clickable" data-insight-action="${x.action||''}" data-insight-key="${x.key||''}" data-insight-id="${x.id||''}"><div class="local-insight-icon">${x.icon}</div><div><strong>${esc(x.title)}</strong><p>${esc(x.text)}</p></div><b class="insight-arrow">›</b></button>`).join(''):'<div class="empty compact-empty">今すぐ注意する項目はありません</div>'}</section>
 <section class="section"><div class="section-head"><h2>今日のタスク</h2><button class="link-btn" id="addTaskBtn">＋追加</button></div>${tasks.length?tasks.sort((a,b)=>a.done-b.done).map(taskHTML).join(''):'<div class="empty">今日のタスクはありません</div>'}</section>
 <section class="section"><div class="section-head"><h2>業務連絡</h2><button class="link-btn" data-goto="notes">すべて見る</button></div>${notes.filter(n=>n.type==='inbox').slice(0,3).map(noteHTML).join('')||'<div class="empty">思いついたことを右下の＋からメモできます</div>'}</section>
 <section class="section"><button class="primary" id="closeDayBtn" style="width:100%">本日の業務を終了</button></section>`;
 $('#todayGoalCard').onclick=()=>openTodayGoalEditor(date);if($('#editTodayGoal'))$('#editTodayGoal').onclick=e=>{e.stopPropagation();openTodayGoalEditor(date)};$('#addTaskBtn').onclick=()=>openTaskModal(date);$('#closeDayBtn').onclick=()=>openCloseDay(date);if($('#openCalendarEvents'))$('#openCalendarEvents').onclick=()=>switchView('calendar');$$('[data-home-event]').forEach(b=>b.onclick=()=>{const e=state.events.find(x=>x.id===b.dataset.homeEvent);if(e){const today=isoDate(new Date()),start=eventStartDate(e),end=eventEndDate(e);selectedDate=start<=today&&today<=end?today:start;calCursor=new Date(selectedDate+'T12:00:00');switchView('calendar')}});$$('[data-goto]').forEach(x=>x.onclick=()=>switchView(x.dataset.goto));bindTaskButtons();bindNoteMenus();
$$('[data-insight-action]').forEach(b=>b.onclick=()=>{
 const action=b.dataset.insightAction;
 if(action==='metric')openMetricProgressDetail(b.dataset.insightKey,date);
 else if(action==='tasks')document.querySelector('[data-task]')?.scrollIntoView({behavior:'smooth',block:'center'});
 else if(action==='staff')openStaffReport(b.dataset.insightId);
 else if(action==='notes')switchView('notes')
});
}
function greeting(){const h=new Date().getHours();return h<11?'おはようございます':h<17?'こんにちは':'こんばんは'}
function taskHTML(t){return `<div class="card task ${t.done?'done':''}" data-task="${t.id}"><button class="check">${t.done?'✓':''}</button><div><div class="task-title">${esc(t.title)}</div><div class="task-meta">${esc(t.timing||'')}${t.priority?'・優先度 '+esc(t.priority):''} ${t.auto?'・自動':''}${t.carriedFrom?'・繰り越し':''}${t.doneAt?'・'+new Date(t.doneAt).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})+'完了':''}</div></div><button class="more-btn">…</button></div>`}
function bindTaskButtons(){$$('[data-task]').forEach(el=>{const id=el.dataset.task;$('.check',el).onclick=()=>toggleTask(id);$('.more-btn',el).onclick=()=>openTaskMenu(id)})}
function toggleTask(id){const t=state.tasks.find(x=>x.id===id);if(!t)return;t.done=!t.done;t.doneAt=t.done?nowISO():null;if(t.staffFollowupId){const f=state.staff.followups.find(x=>x.id===t.staffFollowupId);if(f)f.done=t.done}save();render();toast(t.done?'完了しました':'未完了に戻しました')}
function openTaskMenu(id){const t=state.tasks.find(x=>x.id===id);openModal(`<h2>${esc(t.title)}</h2><div class="btn-row"><button class="secondary" id="editTask">編集</button><button class="secondary" id="moveTask">日付変更</button><button class="danger" id="deleteTask">削除</button></div>`);$('#editTask').onclick=()=>openTaskModal(t.date,t);$('#moveTask').onclick=()=>openMoveTask(t);$('#deleteTask').onclick=()=>{state.tasks=state.tasks.filter(x=>x.id!==id);save();closeModal();render();toast('削除しました')}}
function openTaskModal(date,t=null){openModal(`<h2>${t?'タスクを編集':'タスクを追加'}</h2><div class="field"><label>内容</label><input id="taskTitle" value="${esc(t?.title||'')}"></div><div class="grid2"><div class="field"><label>日付</label><input id="taskDate" type="date" value="${t?.date||date}"></div><div class="field"><label>タイミング</label><select id="taskTiming"><option>終日</option><option>出勤時</option><option>昼</option><option>退勤前</option></select></div></div><div class="btn-row"><button class="secondary" id="cancel">キャンセル</button><button class="primary" id="saveTask">保存</button></div>`);$('#taskTiming').value=t?.timing||'終日';$('#cancel').onclick=closeModal;$('#saveTask').onclick=()=>{const title=$('#taskTitle').value.trim();if(!title)return toast('内容を入力してください');if(t){t.title=title;t.date=$('#taskDate').value;t.timing=$('#taskTiming').value;t.manuallyEdited=true}else state.tasks.push({id:uid(),title,date:$('#taskDate').value,done:false,createdAt:nowISO(),auto:false,timing:$('#taskTiming').value});save();closeModal();render();toast('保存しました')}}
function openMoveTask(t){openModal(`<h2>タスクを移動</h2><button class="card" id="nextShift" style="width:100%;text-align:left">次回出勤日へ</button><button class="card" id="tomorrow" style="width:100%;text-align:left">明日へ</button><div class="field"><label>日付を指定</label><input type="date" id="moveDate" value="${t.date}"></div><button class="primary" id="moveSave" style="width:100%">移動</button>`);$('#nextShift').onclick=()=>move(nextWorkDate(t.date));$('#tomorrow').onclick=()=>{const d=new Date(t.date+'T12:00:00');d.setDate(d.getDate()+1);move(isoDate(d))};$('#moveSave').onclick=()=>move($('#moveDate').value);function move(date){if(!date)return toast('次の出勤日が未登録です');t.carriedFrom=t.date;t.date=date;save();closeModal();render();toast('移動しました')}}
function openCloseDay(date){const undone=state.tasks.filter(t=>t.date===date&&!t.done);openModal(`<h2>本日の終了確認</h2>${undone.length?`<div class="warning">未完了タスクが${undone.length}件あります。次回出勤日へ繰り越しますか？</div>${undone.map(t=>`<div class="list-row"><span>□</span><div class="grow">${esc(t.title)}</div></div>`).join('')}`:'<div class="card">今日のタスクはすべて完了しています。</div>'}<div class="btn-row"><button class="secondary" id="cancel">戻る</button>${undone.length?'<button class="primary" id="carry">繰り越して終了</button>':'<button class="primary" id="finish">終了する</button>'}</div>`);$('#cancel').onclick=closeModal;const finish=()=>{state.dayClosed[date]=nowISO();save();closeModal();render();toast('本日の記録を保存しました')};if($('#finish'))$('#finish').onclick=finish;if($('#carry'))$('#carry').onclick=()=>{const next=nextWorkDate(date);if(!next)return toast('次の出勤日を先に登録してください');undone.forEach(t=>{t.carriedFrom=t.date;t.date=next});finish()}}
function noteDisplayTitle(n){if(n.title)return n.title;const first=(n.text||'').split(/\n/).find(Boolean)||'無題のメモ';return first.length>46?first.slice(0,46)+'…':first}
function noteHTML(n){const inboxTag=n.type==='inbox'?`<span class="tag ${n.confirmed?'confirmed':'unconfirmed'}">${n.confirmed?'確認済み':'未確認'}</span>`:'';const md=n.type==='meeting'?(n.meetingData||{}):null,ai=md?.aiMinutes||null;const mtgMeta=ai?`<span class="tag">決定 ${(ai.decisions||[]).length}</span><span class="tag">タスク ${(ai.actions||[]).length}</span><span class="tag">未完 ${(ai.actions||[]).filter(x=>!x.done).length}</span>`:'';const dateText=(n.type==='dailyReport'||n.type==='meeting')?esc((n.date||'').replaceAll('-','/')):new Date(n.createdAt).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});return `<div class="card note-card" data-note="${n.id}"><button class="more-btn note-menu">…</button><h3>${n.pinned?'<span class="pin">★</span> ':''}${esc(noteDisplayTitle(n))}</h3><div class="note-meta"><span>${dateText}</span><span class="tag">${labelType(n.type)}</span>${inboxTag}${mtgMeta}${n.staff?`<span class="tag">${esc(n.staff)}</span>`:''}</div></div>`}
function labelType(t){return({inbox:'業務連絡',normal:'通常',staff:'スタッフ',dailyReport:'日報',meeting:'MTG'}[t]||'メモ')}
function renderNotes(){const filter=renderNotes.filter||'all',q=renderNotes.q||'';let notes=state.notes.filter(n=>!n.archived);if(filter!=='all')notes=notes.filter(n=>n.type===filter);if(q)notes=notes.filter(n=>(n.text||'').toLowerCase().includes(q.toLowerCase())||(n.title||'').toLowerCase().includes(q.toLowerCase())||(n.staff||'').includes(q));const sortKey=n=>(n.type==='dailyReport'||n.type==='meeting')?`${n.date||'0000-00-00'}T23:59:59`:(n.updatedAt||n.createdAt||'');notes.sort((a,b)=>sortKey(b).localeCompare(sortKey(a)));$('#view-notes').innerHTML=`<div class="search-box"><input id="noteSearch" placeholder="メモを検索" value="${esc(q)}"></div><div class="chip-row">${[['all','すべて'],['inbox','業務連絡'],['normal','通常'],['dailyReport','日報'],['meeting','MTG'],['staff','スタッフ']].map(([k,v])=>`<button class="chip ${filter===k?'active':''}" data-filter="${k}">${v}</button>`).join('')}</div><section class="section">${notes.map(noteHTML).join('')||'<div class="empty">該当するメモはありません</div>'}</section>`;$('#noteSearch').oninput=e=>{renderNotes.q=e.target.value;renderNotes()};$$('[data-filter]').forEach(b=>b.onclick=()=>{renderNotes.filter=b.dataset.filter;renderNotes()});bindNoteMenus()}
function bindNoteMenus(){
 $$('[data-note]').forEach(el=>{const id=el.dataset.note,menu=$('.note-menu',el);el.onclick=e=>{if(e.target.closest('.note-menu'))return;openNoteViewer(id)};if(menu)menu.onclick=e=>{e.stopPropagation();openNoteMenu(id)}})
}
function deleteNote(id){const index=state.notes.findIndex(x=>x.id===id);if(index<0)return;const removed=state.notes.splice(index,1)[0];state.trash.push({kind:'note',item:removed,deletedAt:nowISO()});save();closeModal();render();toast('削除しました','元に戻す',()=>{const hit=state.trash.findIndex(x=>x.item?.id===id);if(hit>=0){state.notes.push(state.trash.splice(hit,1)[0].item);save();render();toast('元に戻しました')}},5000)}
function confirmDeleteNote(id){const n=state.notes.find(x=>x.id===id);if(!n)return;openModal(`<h2>削除の確認</h2><div class="warning">「${esc(noteDisplayTitle(n))}」を削除しますか？</div><div class="btn-row"><button class="secondary" id="cancelDelete">キャンセル</button><button class="danger" id="confirmDelete">削除する</button></div>`);$('#cancelDelete').onclick=closeModal;$('#confirmDelete').onclick=()=>deleteNote(id)}
function openNoteMenu(id){
 const n=state.notes.find(x=>x.id===id);if(!n)return;openModal(`<h2>メモの操作</h2><div class="list-row"><button class="secondary grow" id="viewNote">読む</button></div><div class="list-row"><button class="secondary grow" id="editNote">編集</button></div>${n.type==='inbox'?`<div class="list-row"><button class="secondary grow" id="toggleConfirmed">${n.confirmed?'未確認に戻す':'確認済みにする'}</button></div>`:''}${n.type!=='meeting'?'<div class="list-row"><button class="secondary grow" id="taskify">タスクにする</button></div>':''}<div class="list-row"><button class="danger grow" id="deleteNote">削除</button></div>`);
 const view=$('#viewNote'),edit=$('#editNote'),toggle=$('#toggleConfirmed'),task=$('#taskify'),del=$('#deleteNote');if(view)view.onclick=()=>openNoteViewer(id);if(edit)edit.onclick=()=>openQuickNote(n);if(toggle)toggle.onclick=()=>{n.confirmed=!n.confirmed;n.updatedAt=nowISO();save();closeModal();render();toast(n.confirmed?'確認済みにしました':'未確認に戻しました')};if(task)task.onclick=()=>{state.tasks.push({id:uid(),title:n.title||n.text,date:n.date||isoDate(new Date()),done:false,createdAt:nowISO(),auto:false,timing:'終日'});save();closeModal();render();toast('タスクにしました')};if(del)del.onclick=()=>confirmDeleteNote(id)
}
function displayMultiline(text){return esc(text||'').replace(/\n/g,'<br>')}
function openNoteViewer(id){
 const n=state.notes.find(x=>x.id===id);if(!n)return;if(n.type==='dailyReport')return openReportViewer(n);if(n.type==='meeting')return openMeetingViewer(n);
 const names=(n.staffIds?.length?n.staffIds:(n.staffId?[n.staffId]:[])).map(x=>staffMemberById(x)?.name).filter(Boolean);
 openModal(`<div class="viewer-head"><button class="secondary" id="closeViewer">閉じる</button><div class="viewer-actions"><button class="secondary" id="editViewer">編集</button><button class="danger" id="deleteViewer">削除</button></div></div><article class="note-viewer simple-fullscreen-note"><div class="note-viewer-type">${esc(labelType(n.type))}</div><h1>${esc(noteDisplayTitle(n))}</h1><div class="note-viewer-meta">${esc(n.date||'')}・更新 ${new Date(n.updatedAt||n.createdAt).toLocaleString('ja-JP')}${names.length?`・${names.map(esc).join(' / ')}`:''}</div><div class="note-viewer-body">${displayMultiline(n.text||htmlToPlainText(n.richHTML||''))}</div></article>`,'note-viewer');
 const c=$('#closeViewer'),e=$('#editViewer'),d=$('#deleteViewer');if(c)c.onclick=closeModal;if(e)e.onclick=()=>openQuickNote(n);if(d)d.onclick=()=>confirmDeleteNote(id)
}
function metricNumber(v){const n=Number(String(v??'').replace(/,/g,''));return Number.isFinite(n)?n:0}
const PERFORMANCE_FIELDS=[
 ['new','新規'],['deviceChange','機種変更'],['cellUp','セルアップ'],['cellDown','セルダウン'],
 ['supportFixed','サポート定額'],['paidSupport','有償サポート'],['plusOne','+1Collection'],['card','クレカ'],['gold','内GOLD'],
 ['bank','じぶん銀行'],['hikari','光'],['electricity','でんき'],['pixel','Pixel']
];
const MONTHLY_GOAL_STORAGE_KEY='worknote_monthly_goals_v1';
function loadMonthlyGoals(){try{return JSON.parse(localStorage.getItem(MONTHLY_GOAL_STORAGE_KEY)||'{}')}catch{return {}}}
function saveMonthlyGoals(x){localStorage.setItem(MONTHLY_GOAL_STORAGE_KEY,JSON.stringify(x||{}))}
function monthKey(date=isoDate(new Date())){return String(date).slice(0,7)}
function monthlyGoalFor(key,date=isoDate(new Date())){const all=loadMonthlyGoals();return Number(all[monthKey(date)]?.[key]||0)}
function monthlyActualFor(key,date=isoDate(new Date())){const reports=performanceReportsForMonth(monthKey(date));return reports.reduce((sum,n)=>sum+Number(n.reportData?.metrics?.[key]||0),0)}
function monthlyProgressData(date=isoDate(new Date())){return PERFORMANCE_FIELDS.map(([key,label])=>{const goal=monthlyGoalFor(key,date),actual=monthlyActualFor(key,date),remain=Math.max(0,goal-actual),rate=goal>0?Math.round(actual/goal*100):0;return{key,label,goal,actual,remain,rate}})}
function remainingWorkDaysEstimate(date=isoDate(new Date())){
 const start=new Date(date+'T12:00:00');
 const y=start.getFullYear(),m=start.getMonth(),lastDay=new Date(y,m+1,0).getDate();
 let workDays=0,registeredDays=0,unknownDays=0;
 for(let day=start.getDate();day<=lastDay;day++){
  const cur=new Date(y,m,day),iso=isoDate(cur),shift=shiftByDate(iso);
  if(!shift){unknownDays++;continue}
  registeredDays++;
  if(isWorkShift(shift))workDays++
 }
 return {workDays,registeredDays,unknownDays,complete:unknownDays===0}
}
function monthlyPaceSignals(date=isoDate(new Date())){
 const wd=remainingWorkDaysEstimate(date);
 return monthlyProgressData(date)
  .filter(x=>x.goal>0&&x.actual<x.goal)
  .map(x=>({...x,workDays:wd.workDays,shiftComplete:wd.complete,unknownDays:wd.unknownDays,neededPerDay:wd.workDays>0?x.remain/wd.workDays:null}))
  .sort((a,b)=>(b.remain/b.goal)-(a.remain/a.goal))
}

function metricProgressDetail(key,date=isoDate(new Date())){
 const field=PERFORMANCE_FIELDS.find(([k])=>k===key);
 if(!field)return null;
 const [,label]=field;
 const month=monthKey(date);
 const monthStart=`${month}-01`;
 const today=isoDate(new Date());
 const calcDate=today.slice(0,7)===month?today:monthStart;
 const goal=monthlyGoalFor(key,monthStart);
 const actual=monthlyActualFor(key,monthStart);
 const remain=Math.max(0,goal-actual);
 const wd=remainingWorkDaysEstimate(calcDate);
 const needed=wd.workDays>0?remain/wd.workDays:null;
 const rate=goal>0?Math.round(actual/goal*100):0;
 const reports=performanceReportsForMonth(month)
  .filter(n=>metricNumber(n.reportData?.metrics?.[key])!==0)
  .sort((a,b)=>b.date.localeCompare(a.date));
 return {key,label,goal,actual,remain,rate,reports,month,workDays:wd.workDays,shiftComplete:wd.complete,unknownDays:wd.unknownDays,needed}
}
function metricNeedLabel(key,value){
 if(value==null||!Number.isFinite(Number(value)))return '計算不可';
 if(key==='paidSupport'||key==='plusOne')return `${Math.ceil(value).toLocaleString('ja-JP')}円 / 出勤`;
 return `${Number(value).toLocaleString('ja-JP',{maximumFractionDigits:2})} / 出勤`
}
function openMetricProgressDetail(key,date=isoDate(new Date())){
 const d=metricProgressDetail(key,date);
 if(!d)return toast('実績項目が見つかりません');
 const calcText=d.workDays>0?metricNeedLabel(d.key,d.needed):'計算不可';
 const shiftNote=d.shiftComplete
  ?`今月の残り出勤日 ${d.workDays}日で計算`
  :`今月の残りシフトに未登録日が${d.unknownDays}日あります。未登録日は出勤扱いせず計算しています。`;
 openModal(`<div class="viewer-head"><button class="secondary" id="backMetricDetail">‹ 実績管理</button><button class="secondary" id="closeMetricDetail">閉じる</button></div><article class="performance-dashboard metric-detail"><header class="performance-head"><span class="tag">目標進捗</span><h1>${esc(d.label)}</h1><p>${esc(d.month.replace('-','年'))}月</p></header><section class="metric-hero"><span>1出勤あたり必要</span><strong>${esc(calcText)}</strong><small>${esc(shiftNote)}</small></section><section class="metric-detail-grid"><div class="card"><span>月目標</span><strong>${esc(performanceFormat(d.key,d.goal))}</strong></div><div class="card"><span>現在実績</span><strong>${esc(performanceFormat(d.key,d.actual))}</strong></div><div class="card"><span>残り</span><strong>${esc(performanceFormat(d.key,d.remain))}</strong></div><div class="card"><span>残り出勤日</span><strong>${d.workDays}日</strong><small>${d.shiftComplete?'登録済みシフトのみ':'未登録日あり'}</small></div></section><section class="section"><div class="section-head"><h2>達成率</h2><strong>${d.rate}%</strong></div><div class="metric-detail-progress"><i style="width:${Math.min(100,Math.max(0,d.rate))}%"></i></div></section><section class="section"><div class="section-head"><h2>直近の実績</h2></div>${d.reports.slice(0,8).map(n=>`<button class="card metric-history-row" data-metric-report="${n.id}"><span>${esc(n.date.replaceAll('-','/'))}</span><strong>${esc(performanceFormat(d.key,n.reportData?.metrics?.[d.key]||0))}</strong><b>›</b></button>`).join('')||'<div class="empty">この項目の実績はまだありません</div>'}</section></article>`,'note-viewer');
 $('#backMetricDetail').onclick=()=>openPerformanceDashboard(d.month);
 $('#closeMetricDetail').onclick=closeModal;
 $$('[data-metric-report]').forEach(b=>b.onclick=()=>{const n=state.notes.find(x=>x.id===b.dataset.metricReport);if(n)openReportViewer(n)})
}

function overdueTasks(date=isoDate(new Date())){
 return state.tasks.filter(t=>{
  if(t.done||!t.date||t.date>=date)return false;
  if(t.auto)return false;
  return true;
 })
}
function todayOpenTasks(date=isoDate(new Date())){return state.tasks.filter(t=>!t.done&&t.date===date)}
function staleStaffRecords(date=isoDate(new Date()),days=7){const now=new Date(date+'T12:00:00').getTime();return buildStaffReports().filter(r=>r.active&&r.latest).map(r=>({...r,staleDays:Math.floor((now-new Date(r.latest+'T12:00:00').getTime())/86400000)})).filter(r=>r.staleDays>=days).sort((a,b)=>b.staleDays-a.staleDays)}
function localInsights(date=isoDate(new Date())){
 const out=[];
 const pace=monthlyPaceSignals(date)[0];
 if(pace){
  const paceText=pace.workDays>0&&pace.neededPerDay!=null
   ?`${formatPerformanceValue(pace.key,pace.actual)} / ${formatPerformanceValue(pace.key,pace.goal)}。残り${formatPerformanceValue(pace.key,pace.remain)}、残り出勤${pace.workDays}日で1出勤あたり${formatPerformanceValue(pace.key,pace.neededPerDay)}必要。`
   :`${formatPerformanceValue(pace.key,pace.actual)} / ${formatPerformanceValue(pace.key,pace.goal)}。残りシフトが未登録のため、1出勤あたり必要数は計算できません。`;
  out.push({type:'pace',icon:'📉',title:`${pace.label} 月目標ペース`,text:paceText,action:'metric',key:pace.key});
 }
 const overdue=overdueTasks(date);
 if(overdue.length)out.push({type:'task',icon:'⏰',title:'期限超過タスク',text:`未完了が${overdue.length}件あります。最古は「${[...overdue].sort((a,b)=>a.date.localeCompare(b.date))[0].title}」。`,action:'tasks'});
 const stale=staleStaffRecords(date)[0];
 if(stale)out.push({type:'staff',icon:'👤',title:`${stale.name}さん`,text:`最終育成記録から${stale.staleDays}日。次回確認のタイミングです。`,action:'staff',id:stale.id});
 const meetingPending=state.notes.filter(n=>!n.archived&&n.type==='meeting').reduce((c,n)=>c+(n.meetingData?.aiMinutes?.actions||[]).filter(a=>!a.done&&!a.applied).length,0);
 if(meetingPending)out.push({type:'meeting',icon:'📋',title:'MTG未反映アクション',text:`議事録に未反映のアクションが${meetingPending}件あります。`,action:'notes'});
 return out.slice(0,3)
}
function compactWorknoteContext(date=isoDate(new Date())){const goals=monthlyProgressData(date).filter(x=>x.goal>0).map(x=>({label:x.label,goal:x.goal,actual:x.actual,remain:x.remain,rate:x.rate}));return{date,todayGoal:dailyGoalForDate(date),todayTasks:todayOpenTasks(date).map(t=>t.title),overdueTasks:overdueTasks(date).map(t=>({title:t.title,date:t.date})),monthlyGoals:goals,upcoming:homeUpcomingEvents(date).slice(0,5).map(e=>({title:e.title,start:e.start,end:e.end})),staffFollowup:staleStaffRecords(date).slice(0,3).map(r=>({name:r.name,staleDays:r.staleDays}))}}
function tomorrowISO(date){const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+1);return isoDate(d)}
function upsertTomorrowGoal(fromDate,text){const date=tomorrowISO(fromDate),goal=String(text||'').trim();if(!goal)return false;let n=dailyReportForDate(date);if(n){n.reportData=n.reportData||{};n.reportData.goal=goal;n.text=reportText(n.reportData);n.updatedAt=nowISO()}else{const data={goal,metrics:{},next:['','','']};n={id:uid(),title:reportTitleForDate(date),text:reportText(data),type:'dailyReport',date,reportData:data,staff:'',staffId:'',staffIds:[],pinned:false,archived:false,createdAt:nowISO(),updatedAt:nowISO()};state.notes.push(n)}save();return true}
function addStaffNextActionTask(staffId,title,date=isoDate(new Date())){const member=staffMemberById(staffId);if(!member||!title)return false;if(!state.tasks.some(t=>!t.done&&t.staffId===staffId&&t.title===title)){state.tasks.push({id:uid(),title,date,done:false,createdAt:nowISO(),auto:false,timing:'終日',priority:'中',staffId,assignee:member.name,source:'staffAI'})}save();return true}

function performanceValue(data,key){return metricNumber(data?.metrics?.[key])}
function performanceFormat(key,value){
 const n=metricNumber(value);
 return (key==='paidSupport'||key==='plusOne')?`${n.toLocaleString('ja-JP',{maximumFractionDigits:2})}円`:n.toLocaleString('ja-JP',{maximumFractionDigits:2})
}

function formatPerformanceValue(key,value){return performanceFormat(key,value)}
function performanceCompactSummary(metrics){
 const rows=PERFORMANCE_FIELDS
  .map(([k,l])=>({k,l,v:metricNumber(metrics?.[k])}))
  .filter(x=>x.v!==0);
 if(!rows.length)return '実績 0';
 return rows.slice(0,4).map(x=>`${x.l} ${performanceFormat(x.k,x.v)}`).join('・')+(rows.length>4?` ほか${rows.length-4}項目`:'')
}

function performanceLines(data,{nonZeroOnly=false}={}){return PERFORMANCE_FIELDS.filter(([k])=>!nonZeroOnly||performanceValue(data,k)!==0).map(([k,l])=>`${l} ${performanceFormat(k,performanceValue(data,k))}`)}
function performanceEditorHTML(data){const metrics=data.metrics||{};return `<div class="performance-editor"><div class="performance-editor-head"><div><h3>実績・結果</h3><p>数字だけ入力してください。月間実績へ自動集計されます。</p></div></div><div class="performance-input-grid">${PERFORMANCE_FIELDS.map(([k,l])=>`<label class="performance-input-row"><span>${esc(l)}</span><div class="performance-input-wrap"><input type="number" step="any" inputmode="decimal" data-performance="${k}" value="${esc(metrics[k]??'')}" placeholder="0">${k==='paidSupport'?'<em>円</em>':''}</div></label>`).join('')}</div><div class="field performance-comment"><label>実績コメント（任意）</label><textarea id="resultComment" placeholder="数字以外の振り返り・補足">${esc(data.resultComment??data.results??'')}</textarea></div></div>`}
function performanceViewerHTML(data){const rows=PERFORMANCE_FIELDS.map(([k,l])=>`<div class="performance-view-row"><span>${esc(l)}</span><strong>${esc(performanceFormat(k,performanceValue(data,k)))}</strong></div>`).join('');return `<section class="report-view-section performance-view-section"><h3>実績・結果</h3><div class="performance-view-grid">${rows}</div>${(data.resultComment??data.results??'').trim()?`<div class="performance-view-comment">${displayMultiline(data.resultComment??data.results??'')}</div>`:''}</section>`}

const SELLNAVI_BRIDGE_KEY='worknote_sellnavi_bridge_v1';

function loadSellNaviBridge(){
 try{return JSON.parse(localStorage.getItem(SELLNAVI_BRIDGE_KEY)||'null')}catch{return null}
}
function sellNaviSnapshotForDate(date){
 const bridge=loadSellNaviBridge();if(!bridge?.snapshots)return null;
 if(bridge.snapshots[date])return structuredClone?structuredClone(bridge.snapshots[date]):JSON.parse(JSON.stringify(bridge.snapshots[date]));
 const month=String(date).slice(0,7);
 const candidates=Object.keys(bridge.snapshots).filter(k=>k<=date&&k.startsWith(month)).sort();
 const key=candidates[candidates.length-1];
 if(!key)return null;
 const snap=JSON.parse(JSON.stringify(bridge.snapshots[key]));snap.fallbackFromDate=key;return snap
}
function sellNaviRelevantMetrics(snapshot,text=''){
 if(!snapshot?.metrics)return [];
 const mentioned=snapshot.metrics.filter(m=>String(text||'').includes(m.name));
 const shortage=snapshot.metrics.filter(m=>m.target!=null&&m.remain>0).sort((a,b)=>(a.pct??999)-(b.pct??999)).slice(0,6);
 const all=[...mentioned,...shortage],seen=new Set();
 return all.filter(m=>!seen.has(m.key)&&seen.add(m.key)).slice(0,8)
}

function refreshSellNaviEditorCard(date,existingData={}){
 const holder=$('#sellNaviSyncHolder');
 if(!holder)return false;
 const current=sellNaviSnapshotForDate(date);
 holder.innerHTML=sellNaviEditorCard(date,{...existingData,sellNaviSnapshot:current||existingData.sellNaviSnapshot||null});
 bindSellNaviRefreshButton(date,existingData);
 toast(current?'セルナビ最新値に更新しました':'セルナビの最新データが見つかりません');
 return !!current
}
function bindSellNaviRefreshButton(date,existingData={}){
 const btn=$('#refreshSellNaviBtn');
 if(btn)btn.onclick=()=>refreshSellNaviEditorCard(date,existingData)
}

function sellNaviEditorCard(date,data={}){
 const snap=sellNaviSnapshotForDate(date)||data.sellNaviSnapshot||null;
 if(!snap)return `<div class="sellnavi-sync-card not-synced"><div class="sellnavi-sync-head"><div><strong>セルナビ未同期</strong><p>セルナビで実績を保存すると自動で読み取れます。</p></div><button type="button" class="sellnavi-refresh-mini" id="refreshSellNaviBtn">更新</button></div></div>`;
 const metrics=sellNaviRelevantMetrics(snap,data.storeAction||'');
 const updated=snap.createdAt?new Date(snap.createdAt).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'}):'';
 return `<details class="sellnavi-sync-card"><summary><span>セルナビ同期済み ✓</span><span class="sellnavi-summary-right"><small>${esc(snap.snapshotDate||date)}${updated?`・${updated}`:''}</small><button type="button" class="sellnavi-refresh-mini" id="refreshSellNaviBtn">更新</button></span></summary><div class="sellnavi-sync-list">${metrics.map(m=>`<div><span>${esc(m.name)}</span><strong>${m.target==null?esc(performanceFormat(m.key,m.actual)):`${esc(performanceFormat(m.key,m.actual))} / ${esc(performanceFormat(m.key,m.target))}`}</strong>${m.remain!=null?`<small>残 ${esc(performanceFormat(m.key,m.remain))}・${m.pct??0}%</small>`:''}</div>`).join('')||'<p class="small">表示対象なし</p>'}</div><p class="small">数字はセルナビから自動取得。日報には数字ではなく「不足に対して何を考え、誰にどう働きかけたか」を書いてください。</p></details>`
}
function captureSellNaviSnapshot(date,existingSnapshot=null){
 return sellNaviSnapshotForDate(date)||existingSnapshot||null
}
function sellNaviAIContext(data){
 const snap=data?.sellNaviSnapshot;if(!snap)return null;
 const relevant=sellNaviRelevantMetrics(snap,`${data.storeAction||''}\n${data.actions||''}\n${data.staffRelation||''}`);
 return {snapshotDate:snap.snapshotDate,latestInputDate:snap.latestInputDate,period:snap.period,metrics:relevant.map(m=>({name:m.name,unit:m.unit,actual:m.actual,target:m.target,remain:m.remain,pct:m.pct,status:m.status}))}
}


function workModeForDate(date){
 const shift=shiftByDate(date);
 if(!shift)return {mode:'unknown',label:'シフト未登録',shift:null,isHoliday:false,isWorkday:false};
 const id=String(shift.id||shift.name||shift.label||'').trim(),name=String(shift.name||'').trim();
 const holiday=id==='off'||/^(OFF|希望休|休日)$/i.test(id)||/^(OFF|希望休|休日)$/i.test(name);
 if(holiday)return {mode:'holiday',label:name||id||'休日',shift,isHoliday:true,isWorkday:false};
 if(isWorkShift(shift))return {mode:'work',label:name||id||'出勤',shift,isHoliday:false,isWorkday:true};
 return {mode:'unknown',label:name||id||'未判定',shift,isHoliday:false,isWorkday:false}
}
function holidayReportSignals(data={}){
 const texts=[
  data.actions||'', data.results||'', data.resultComment||'', data.learn||'',
  data.reflection||'', data.improvement||'', data.goal||'',
  ...(Array.isArray(data.next)?data.next:[])
 ].join('\n');
 return {
  hasTraining:/訓練|練習|音読|ロープレ|勉強|学習|復習|知識|トーク|振り返|整理|読ん|覚え|試した/.test(texts),
  hasPreparation:/次回|次の出勤|明日|準備|計画|考えた|整理|方針|対応/.test(texts),
  hasStaffTheme:/スタッフ|青木|飯島|藤生|林|星野|倉谷|育成|指導|共有/.test(texts),
  hasStoreAction:!!String(data.storeAction||'').trim()
 }
}
function holidayModeBanner(date){
 const wm=workModeForDate(date);
 if(!wm.isHoliday)return '';
 return `<div class="holiday-mode-banner"><span>休日モード</span><strong>${esc(wm.label)}</strong><p>今日は勤務評価をしません。書いた訓練・学習・振り返り・次回準備だけをAIメンターが評価します。</p></div>`
}


const ROLEUP_LOG_KEY='roleplayProLogs';
const ROLEUP_ASSIGNMENT_KEY='roleup_worknote_assignment_v1';
const ROLEUP_RESULT_KEY='worknote_roleup_result_bridge_v1';
function loadRoleupLogs(){try{return JSON.parse(localStorage.getItem(ROLEUP_LOG_KEY)||'[]')||[]}catch{return[]}}
function roleupDateISO(log){
 const s=String(log?.date||'');let m=s.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
 return m?`${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`:''
}
function roleupLogsThrough(date=isoDate(new Date()),days=60){
 const end=new Date(date+'T12:00:00'),start=new Date(end);start.setDate(start.getDate()-days);
 const sk=isoDate(start);return loadRoleupLogs().filter(x=>{const d=roleupDateISO(x);return d&&d>=sk&&d<=date}).sort((a,b)=>(b.id||0)-(a.id||0))
}
function roleupTaskResult(task){
 if(!task)return null;return loadRoleupLogs().find(x=>String(x.worknoteAssignmentId||'')===String(task.id))||null
}
function roleupActiveTask(){
 const tasks=(state.ai.mentor?.roleupTasks||[]).filter(t=>t.status!=='graduated'&&t.status!=='cancelled').sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
 for(const t of tasks){const result=roleupTaskResult(t);if(!result)return {...t,status:'assigned'};if(t.status!=='reviewed')return {...t,status:'completed',result}}
 return tasks[0]||null
}
function roleupRecentSummary(date=isoDate(new Date()),days=14){
 return roleupLogsThrough(date,days).slice(0,12).map(x=>({id:x.id,date:roleupDateISO(x),productId:x.productId,productName:x.productName,difficulty:x.difficulty,score:x.score,breakdown:x.breakdown||{},good:x.good||[],improve:x.improve||[],advice:x.advice||'',worknoteAssignmentId:x.worknoteAssignmentId||'',worknoteFocus:x.worknoteFocus||''}))
}
function normalizeRoleupProductId(v=''){
 const x=String(v).toLowerCase(),map={機種変更:'device',pixel:'pixel',マネ活:'money','uq':'uq',でんき:'electric',電気:'electric',光:'hikari','auひかり':'hikari',サポート定額:'support',プラスワン:'plusone','+1collection':'plusone',タブレット:'tablet'};
 const id=map[v]||map[x]||x||'device';return id==='plusone'?'device':id
}
function createRoleupAssignment(task,source='ai'){
 const t={id:uid(),title:task.title||task.issueTitle||'ROLEUP訓練',reason:task.reason||task.purpose||'',focus:task.focus||task.method||task.measure||'',productId:normalizeRoleupProductId(task.productId||task.product||'device'),difficulty:task.difficulty||'auto',source,sourceDate:task.sourceDate||isoDate(new Date()),createdAt:nowISO(),status:'assigned'};
 state.ai.mentor.roleupTasks.push(t);localStorage.setItem(ROLEUP_ASSIGNMENT_KEY,JSON.stringify(t));save();return t
}
function launchRoleupTask(task){
 const t=task?.id?task:createRoleupAssignment(task||{},'manual');localStorage.setItem(ROLEUP_ASSIGNMENT_KEY,JSON.stringify(t));save();
 window.open('/roleup/','_blank')
}
function syncRoleupTaskResults(){
 let changed=false;(state.ai.mentor.roleupTasks||[]).forEach(t=>{const r=roleupTaskResult(t);if(r&&t.status==='assigned'){t.status='completed';t.completedAt=nowISO();changed=true}});
 if(changed)save();return changed
}
function roleupTrainingCardHTML(){
 syncRoleupTaskResults();const task=roleupActiveTask(),recent=roleupRecentSummary(undefined,30);
 if(!task)return `<div class="roleup-training-empty"><strong>現在のROLEUP課題はありません</strong><p>日報AIやAIメンターが、実践練習が必要と判断した時にここへ課題を出します。</p><button class="secondary" id="askRoleupTask">AIに次のROLEUP課題を決めてもらう</button></div>${recent.length?`<div class="roleup-recent"><span>直近の訓練</span>${recent.slice(0,3).map(r=>`<div><b>${esc(r.productName||r.productId)} ${Number(r.score)||0}点</b><small>${esc(r.date||'')}</small></div>`).join('')}</div>`:''}`;
 const result=task.result||roleupTaskResult(task);
 return `<div class="roleup-training-status"><span class="tag">${result?'実施済み':'現在の重点課題'}</span><h3>${esc(task.title)}</h3><p>${esc(task.reason||'')}</p>${task.focus?`<div class="roleup-focus"><b>今回の重点</b>${displayMultiline(task.focus)}</div>`:''}${result?`<div class="roleup-result-mini"><strong>${Number(result.score)||0}点</strong><span>${esc(result.productName||task.productId)}・${esc(result.difficulty||'')}</span><p>改善点：${esc((result.improve||[]).join('、')||result.advice||'記録なし')}</p></div><button class="primary" id="roleupNextReview">この結果から次の課題を考える</button>`:`<button class="primary" id="launchRoleupCurrent">🎭 ROLEUPで練習</button>`}</div>${recent.length?`<div class="roleup-recent"><span>直近の訓練</span>${recent.slice(0,3).map(r=>`<div><b>${esc(r.productName||r.productId)} ${Number(r.score)||0}点</b><small>${esc(r.date||'')}</small></div>`).join('')}</div>`:''}`
}

function activeMentorMemories(date=isoDate(new Date())){
 const d=String(date);
 return (state.ai.mentor?.memories||[]).filter(m=>{
  if(m.status==='archived'||m.status==='superseded')return false;
  if(m.startDate&&m.startDate>d)return false;
  if(m.endDate&&m.endDate<d)return false;
  return true
 }).sort((a,b)=>({high:0,medium:1,low:2}[a.priority]??1)-({high:0,medium:1,low:2}[b.priority]??1))
}
function applyMentorMemoryUpdates(updates,sourceDate){
 state.ai.mentor.memories=state.ai.mentor.memories||[];
 (updates||[]).forEach(u=>{
  const content=String(u.content||'').trim();if(!content)return;
  const key=String(u.key||`${u.category||'memory'}:${content.slice(0,40)}`).trim();
  if(u.action==='archive'){
   state.ai.mentor.memories.forEach(m=>{if(m.key===key&&m.status==='active')m.status='archived'});
   return;
  }
  state.ai.mentor.memories.forEach(m=>{if(m.key===key&&m.status==='active')m.status='superseded'});
  state.ai.mentor.memories.push({
   id:uid(),key,category:u.category||'継続方針',scope:u.scope||'ongoing',
   content,priority:u.priority||'medium',certainty:u.certainty||'confirmed',
   startDate:u.startDate||sourceDate,endDate:u.endDate||'',
   status:'active',sourceDate,createdAt:nowISO()
  })
 });
}
function mentorMemoryHTML(memories){
 if(!memories.length)return '<div class="empty">現在有効な継続記憶はありません。日報で「今月の店舗目標は〜」「これから〜する」など明確に書くと、AIメンターが期間を理解して記憶します。</div>';
 return `<div class="mentor-memory-list">${memories.map(m=>`<article><div><span class="tag">${esc(m.category)}</span><small>${esc(m.scope==='month'?'今月':m.scope==='week'?'今週':m.scope==='ongoing'?'継続':'期間指定')}</small></div><strong>${esc(m.content)}</strong><p>${m.endDate?`有効期限 ${esc(m.endDate)}`:'期限なし'}・優先度 ${esc(m.priority)}</p><button class="secondary" data-archive-memory="${m.id}">この記憶を終了</button></article>`).join('')}</div>`
}
function openMentorMemory(){
 const memories=activeMentorMemories();
 openModal(`<div class="viewer-head"><button class="secondary" id="backMentorMemory">‹ AI</button><button class="secondary" id="closeMentorMemory">閉じる</button></div><article class="performance-dashboard"><header class="performance-head"><span class="tag">AIメンター</span><h1>継続記憶</h1><p>期限・意味を理解して、必要な日報だけで参照します。</p></header>${mentorMemoryHTML(memories)}</article>`,'note-viewer');
 $('#backMentorMemory').onclick=()=>{closeModal();switchView('ai')};$('#closeMentorMemory').onclick=closeModal;
 $$('[data-archive-memory]').forEach(b=>b.onclick=()=>{const m=state.ai.mentor.memories.find(x=>x.id===b.dataset.archiveMemory);if(m){m.status='archived';save();openMentorMemory()}})
}

const REPORT_FIELDS=[['goal','今日の目標'],['actions','今日行ったこと'],['good','良かった点'],['improve','改善点・反省'],['staffRelation','スタッフとの関わり'],['insight','成功事例・気づき']];
function reportText(data){
 const metrics=performanceLines(data).join('\n'),comment=(data.resultComment??data.results??'').trim();
 return [
  ...REPORT_FIELDS.slice(0,2).map(([k,l])=>`【${l}】\n${data[k]||''}`),
  `【店舗状況に対して考えたこと・行動したこと】\n${data.storeAction||''}`,
  `【実績・結果】\n${metrics}${comment?`\n\n${comment}`:''}`,
  ...REPORT_FIELDS.slice(2).map(([k,l])=>`【${l}】\n${data[k]||''}`),
  `【明日やること】\n${(data.next||[]).filter(Boolean).join('\n')}`,
  `【自己評価】\n${data.score||''}/10`
 ].join('\n\n')
}
function reportTitleForDate(date){const d=new Date(date+'T12:00:00');return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日 日報`}
function reportFeedbackHTML(n){
 const a=n.aiFeedback;
 if(!a)return `<section class="daily-ai-feedback"><div class="daily-ai-title"><span>AI副店長メンター</span><strong>1日の育成フィードバック</strong></div><div class="empty">まだAIフィードバックはありません。</div><button class="secondary" id="retryDailyFeedback">Geminiでメンター分析を生成</button></section>`;
 if(!a.mentorVersion){
  return `<section class="daily-ai-feedback"><div class="daily-ai-title"><span>AI副店長メンター</span><strong>旧フィードバック</strong></div>${a.workMode==='holiday'?`<div class="feedback-block holiday-feedback"><span>休日モード</span><p>今日は勤務評価ではなく、自己成長・訓練・振り返りを中心に評価しています。</p></div>${a.holidayLearningEvaluation?`<div class="feedback-block holiday-learning"><span>休日の学び・訓練評価</span><p>${displayMultiline(a.holidayLearningEvaluation)}</p></div>`:''}`:''}
  <div class="feedback-block"><span>総合評価</span><p>${displayMultiline(a.overall||'')}</p></div><div class="feedback-block goal-eval"><span>今日の目標 → 結果</span><p>${displayMultiline(a.goalEvaluation||'')}</p></div><div class="feedback-block"><span>数字への評価</span><p>${displayMultiline(a.numbers||'')}</p></div><div class="feedback-block strict"><span>改善すべき点</span><p>${displayMultiline(a.issues||'')}</p></div><button class="primary" id="retryDailyFeedback">新しいAIメンターで再分析</button></section>`
 }
 const ratings=(a.areaRatings||[]);
 const diagnoses=(a.issueDiagnosis||[]);
 const trainings=(a.trainingPlan||[]);
 return `<section class="daily-ai-feedback mentor-feedback">
  <div class="daily-ai-title"><span>AI副店長メンター</span><strong>副店長としての1日を育成分析</strong></div>
  ${n.aiFeedbackError?`<div class="mentor-ai-error"><strong>再分析できませんでした</strong><p>${esc(n.aiFeedbackError)}</p><button class="primary" id="retryDailyFeedback">もう一度再分析する</button></div>`:'<button class="secondary mentor-reanalyze-top" id="retryDailyFeedbackTop">この日報をもう一度AI分析</button>'}
  <div class="feedback-block mentor-prev"><span>前回からの約束・課題</span><p>${displayMultiline(a.previousCommitmentReview||'')}</p></div>
  <div class="feedback-block"><span>総合評価</span><p>${displayMultiline(a.overall||'')}</p></div>
  <div class="feedback-block goal-eval"><span>今日の目標 → 結果</span><p>${displayMultiline(a.goalEvaluation||'')}</p></div>
  <div class="feedback-block mentor-role"><span>販売スタッフとして</span><p>${displayMultiline(a.salesEvaluation||'')}</p></div>
  <div class="feedback-block mentor-role"><span>副店長として</span><p>${displayMultiline(a.deputyManagerEvaluation||'')}</p></div>
  <div class="feedback-block"><span>1日の時間・動き方</span><p>${displayMultiline(a.dayManagement||'')}</p></div>
  <div class="feedback-block"><span>数字管理・実績</span><p>${displayMultiline(a.numbers||'')}</p></div>
  <div class="feedback-block"><span>スタッフ育成・店舗管理</span><p>${displayMultiline(a.staffManagement||'')}</p></div>
  <div class="feedback-block"><span>発言・報連相・コミュニケーション</span><p>${displayMultiline(a.communicationEvaluation||'')}</p></div>
  ${ratings.length?`<div class="feedback-block mentor-ratings"><span>副店長8領域</span><div class="mentor-rating-list">${ratings.map(x=>`<div><div>${mentorEvaluationBadge(x.grade)}<strong>${esc(x.area)}</strong></div><p>${esc(x.reason)}</p></div>`).join('')}</div></div>`:''}
  <div class="feedback-block"><span>良かった判断・行動</span><p>${displayMultiline(a.good||'')}</p></div>
  <div class="feedback-block strict"><span>改善すべき点</span><p>${displayMultiline(a.issues||'')}</p></div>
  ${diagnoses.length?`<div class="feedback-block mentor-diagnosis"><span>課題の原因分析</span>${diagnoses.map(x=>`<article><div class="mentor-issue-head"><b>${esc(x.category)}</b><strong>${esc(x.title)}</strong><em>${esc(x.status)}</em></div><p><b>根拠：</b>${esc(x.evidence)}</p><p><b>原因仮説：</b>${esc(x.hypothesis)}</p><p><b>放置した場合：</b>${esc(x.impact)}</p></article>`).join('')}</div>`:''}
  ${trainings.length?`<div class="feedback-block mentor-training"><span>実用的な訓練メニュー</span>${trainings.map((x,i)=>`<article><strong>${esc(x.title)}</strong><p><b>目的：</b>${esc(x.purpose)}</p><p><b>やり方：</b>${esc(x.method)}</p><div class="mentor-training-meta"><span>⏱ ${esc(x.duration)}</span><span>📏 ${esc(x.measure)}</span></div><p><b>次の段階：</b>${esc(x.nextLevel)}</p><button class="secondary mentor-training-task" data-training-rule="${i}">毎日の自動タスクに追加</button></article>`).join('')}</div>`:''}
  ${(a.tomorrowActions||[]).length?`<div class="feedback-block action"><span>次の勤務で実行すること</span><ol>${a.tomorrowActions.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></div>`:''}
  <div class="feedback-priority"><span>次回の最優先</span><strong>${esc(a.topPriority||'')}</strong></div>
  ${(a.memoryUpdates||[]).filter(x=>x.action==='upsert').length?`<div class="feedback-block mentor-memory-captured"><span>AIが継続して覚えること</span><ul>${a.memoryUpdates.filter(x=>x.action==='upsert').map(x=>`<li><b>${esc(x.category)}</b>：${esc(x.content)} <small>（${esc(x.scope)}）</small></li>`).join('')}</ul></div>`:''}
  ${a.roleupTask?.shouldAssign?`<div class="feedback-block roleup-recommend"><span>🎭 推奨ROLEUP</span><h4>${esc(a.roleupTask.title||'実践ロープレ')}</h4><p>${displayMultiline(a.roleupTask.reason||'')}</p><small>${displayMultiline(a.roleupTask.focus||'')}</small><button class="primary roleup-from-report" data-roleup-report="${n.id}">ROLEUPで練習</button></div>`:''}
  <div class="feedback-block mentor-comment"><span>メンターコメント</span><p>${displayMultiline(a.mentorComment||'')}</p></div>
  ${a.topPriority?'<button class="primary tomorrow-priority-btn" id="sendTomorrowPriority">明日の重点に設定</button>':''}
  <button class="secondary" id="retryDailyFeedback">Geminiで再分析</button>
 </section>`
}
function openReportViewer(n){
 if(!n)return;
 const data=n.reportData||{},next=(data.next||[]).filter(Boolean),workMode=workModeForDate(n.date),latestSellNavi=sellNaviSnapshotForDate(n.date)||data.sellNaviSnapshot||null;
 openModal(`<div class="viewer-head"><button class="secondary" id="closeViewer">閉じる</button><div class="viewer-actions"><button class="secondary" id="editViewer">編集</button><button class="danger" id="deleteViewer">削除</button></div></div><article class="report-viewer"><header><div class="note-viewer-type">日報</div><h1>${esc(n.title||reportTitleForDate(n.date))}</h1>${data.score?`<div class="report-score">自己評価 ${esc(data.score)}／10</div>`:''}</header>${REPORT_FIELDS.slice(0,2).filter(([k])=>(data[k]||'').trim()).map(([k,l])=>`<section class="report-view-section"><h3>${esc(l)}</h3><div>${displayMultiline(data[k])}</div></section>`).join('')}${(data.storeAction||'').trim()?`<section class="report-view-section store-action-view"><h3>🏪 店舗状況に対して考えたこと・行動したこと</h3><div>${displayMultiline(data.storeAction)}</div></section>`:''}${workMode.isHoliday?`<section class="report-view-section holiday-view-note"><h3>休日モード</h3><p>今日は勤務評価をしません。店舗数字・スタッフ介入の有無はAI評価対象外です。</p></section>`:`<section class="report-view-section sellnavi-snapshot-view"><h3>セルナビ店舗数字 <button type="button" class="sellnavi-refresh-mini" id="viewerRefreshSellNaviBtn">更新</button></h3><div id="viewerSellNaviHolder">${sellNaviEditorCard(n.date,{...data,sellNaviSnapshot:latestSellNavi})}</div></section>`}${performanceViewerHTML(data)}${REPORT_FIELDS.slice(2).filter(([k])=>(data[k]||'').trim()).map(([k,l])=>`<section class="report-view-section"><h3>${esc(l)}</h3><div>${displayMultiline(data[k])}</div></section>`).join('')}${next.length?`<section class="report-view-section"><h3>明日やること</h3><ol>${next.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></section>`:''}${reportFeedbackHTML(n)}</article>`,'note-viewer');
 const close=$('#closeViewer'),edit=$('#editViewer'),del=$('#deleteViewer');if(close)close.onclick=closeModal;if(edit)edit.onclick=()=>openQuickNote(n);if(del)del.onclick=()=>confirmDeleteNote(n.id);
 const runDailyReanalysis=async()=>{
  const buttons=['#retryDailyFeedback','#retryDailyFeedbackTop'].map(x=>$(x)).filter(Boolean);buttons.forEach(x=>{x.disabled=true;x.textContent='Geminiが分析中…'});
  try{if(state.ai.mode!=='geminiDirect'||!getGeminiApiKey())throw Error('設定からGemini APIキーを設定してください');await requestDailyReportFeedback(n);state.ai.lastError='';save();toast('日報メンター分析を更新しました');openReportViewer(n)}
  catch(e){const msg=friendlyGeminiError(e,e?.status||0);n.aiFeedbackError=msg;state.ai.lastError=msg;save();openReportViewer(n)}
 };
 ['#retryDailyFeedback','#retryDailyFeedbackTop'].forEach(sel=>{const x=$(sel);if(x)x.onclick=runDailyReanalysis});
 $$('[data-add-training]').forEach(btn=>btn.onclick=()=>{const i=Number(btn.dataset.addTraining),training=n.aiFeedback?.trainingPlan?.[i];if(training)addMentorTrainingRule(training)});
 $$('.roleup-from-report').forEach(btn=>btn.onclick=()=>{const rt=n.aiFeedback?.roleupTask;if(!rt)return;let existing=(state.ai.mentor.roleupTasks||[]).find(t=>t.source==='daily:'+n.id&&t.status!=='cancelled');if(!existing){existing=createRoleupAssignment({...rt,sourceDate:n.date},'daily:'+n.id)}launchRoleupTask(existing)});
 if(!workMode.isHoliday){const vbtn=$('#viewerRefreshSellNaviBtn');if(vbtn)vbtn.onclick=()=>{const fresh=sellNaviSnapshotForDate(n.date),holder=$('#viewerSellNaviHolder');if(holder)holder.innerHTML=sellNaviEditorCard(n.date,{...data,sellNaviSnapshot:fresh||data.sellNaviSnapshot||null});toast(fresh?'セルナビ最新値に更新しました':'セルナビの最新データが見つかりません')}}
}
function loadReportDraft(date){try{return JSON.parse(localStorage.getItem(REPORT_DRAFT_STORE)||'{}')[date]||null}catch{return null}}
function saveReportDraft(date,draft){try{const all=JSON.parse(localStorage.getItem(REPORT_DRAFT_STORE)||'{}');all[date]=draft;localStorage.setItem(REPORT_DRAFT_STORE,JSON.stringify(all))}catch{}}
function clearReportDraft(date){try{const all=JSON.parse(localStorage.getItem(REPORT_DRAFT_STORE)||'{}');delete all[date];localStorage.setItem(REPORT_DRAFT_STORE,JSON.stringify(all))}catch{}}
function collectReportEditorData(){
 const data={};$$('[data-report-field]').forEach(x=>data[x.dataset.reportField]=x.value);
 data.storeAction=$('#storeAction')?.value||'';
 data.metrics={};$$('[data-performance]').forEach(x=>data.metrics[x.dataset.performance]=metricNumber(x.value));
 data.resultComment=$('#resultComment')?.value||'';
 data.next=$$('.next-task-input').map(x=>x.value);data.score=$('#reportScore')?.value||'';
 data.addTomorrowTasks=!!$('#addTomorrowTasks')?.checked;return data
}
function openQuickNote(existing=null){
 window.__worknoteEditingNote=existing||null;
 const initialType=existing?.type||'inbox';
 openModal(`<div class="note-editor-head"><button class="secondary note-editor-close" id="cancel">閉じる</button><h2>${existing?'メモを編集':'メモを追加'}</h2><button class="primary note-editor-save" id="saveNote">保存</button></div><div class="grid2 note-editor-options"><div class="field"><label>種類</label><select id="noteType"><option value="inbox">業務連絡</option><option value="normal">通常メモ</option><option value="staff">スタッフメモ</option><option value="dailyReport">日報</option><option value="meeting">MTG</option></select></div><div class="field"><label>日付</label><input type="date" id="noteDate" value="${existing?.date||isoDate(new Date())}"></div></div><div id="noteEditorDynamic" class="note-editor-dynamic"></div><div class="danger-note note-editor-options">個人情報・電話番号・契約情報は入力しないでください。</div>`, 'note-editor');
 $('#noteType').value=initialType;$('#cancel').onclick=closeModal;
 const renderDynamic=()=>{const type=$('#noteType').value,date=$('#noteDate').value||isoDate(new Date()),box=$('#noteEditorDynamic');
  if(type==='dailyReport'){const draft=!existing?loadReportDraft(date):null;const data=existing?.type==='dailyReport'?(existing.reportData||{}):(draft?.data||{});const next=data.next||['','',''];box.innerHTML=`<div class="draft-status" id="draftStatus">${draft?'下書きを復元しました':'入力内容は自動保存されます'}</div><div class="field note-editor-options"><label>タイトル</label><input id="reportTitle" value="${esc(existing?.type==='dailyReport'?(existing.title||reportTitleForDate(date)):(draft?.title||reportTitleForDate(date)))}"></div><div class="staff-picker-block"><div class="small staff-picker-label">スタッフ名入力ショートカット</div><p class="small">スタッフについて書く行の先頭に名前を入れてください。改行したらそのスタッフの話は終了します。</p><div class="staff-picker">${activeStaffMembers().map(m=>`<button type="button" class="staff-pick" data-insert-report-staff="${m.id}">${esc(m.name)}</button>`).join('')||'<span class="small">スタッフ管理から登録するとワンタップ入力できます</span>'}</div></div><div class="report-grid">${holidayModeBanner(date)}${REPORT_FIELDS.slice(0,2).map(([k,l])=>`<div class="field report-field"><label>${l}</label><textarea data-report-field="${k}">${esc(data[k]||'')}</textarea></div>`).join('')}<div class="field report-field store-action-field"><label>🏪 店舗状況に対して考えたこと・行動したこと</label><textarea id="storeAction" placeholder="数字はセルナビから自動取得します。例：GOLDの進捗が弱いため未獲得スタッフへ声掛け。17時に再確認する。">${esc(data.storeAction||'')}</textarea><p class="small">目標・残数の再入力は不要。足りない数字を見て「どう考えた・誰に何を伝えた・次にどう確認する」を書いてください。</p></div><div id="sellNaviSyncHolder">${workModeForDate(date).isHoliday?'<div class="sellnavi-sync-card holiday-sellnavi-note"><strong>今日は休日</strong><p>店舗数字は日報AIの評価対象外です。必要な時だけセルナビ側で確認してください。</p></div>':sellNaviEditorCard(date,data)}</div>${performanceEditorHTML(data)}${REPORT_FIELDS.slice(2).map(([k,l])=>`<div class="field report-field"><label>${l}</label><textarea data-report-field="${k}">${esc(data[k]||'')}</textarea></div>`).join('')}<div class="field report-field"><label>明日やること</label>${[0,1,2].map(i=>`<input class="next-task-input" value="${esc(next[i]||'')}">`).join('')}<label class="check-row"><input type="checkbox" id="addTomorrowTasks" ${data.addTomorrowTasks?'checked':''}> 翌日のタスクに追加</label></div><div class="field report-field"><label>自己評価</label><select id="reportScore"><option value="">未選択</option>${Array.from({length:10},(_,i)=>`<option value="${i+1}" ${String(data.score||'')===String(i+1)?'selected':''}>${i+1}/10</option>`).join('')}</select></div></div>`;}
  else if(type==='meeting'){renderMeetingEditor(box,existing,date);}
  else{const draft=loadSimpleDraft(existing,type,date);const selectedIds=existing?(existing.staffIds?.length?existing.staffIds:(existing.staffId?[existing.staffId]:[])):(draft?.staffIds||[]);const rawText=existing?.text||draft?.text||htmlToPlainText(existing?.richHTML||draft?.richHTML||'');box.innerHTML=`<div class="draft-status" id="simpleDraftStatus">${draft&&!existing?'下書きを復元しました':'入力内容は自動保存されます'}</div>${staffSelectorHTML(selectedIds)}<div class="field note-editor-body simple-memo-editor"><label>本文</label><textarea id="quickText" placeholder="メモを入力">${esc(rawText)}</textarea></div>`;$$('[data-staff-select]').forEach(x=>x.addEventListener('change',queuePlainDraft));$('#quickText')?.addEventListener('input',queuePlainDraft);setTimeout(()=>$('#quickText')?.focus(),50);}
 };
 const bindStaffPickers=()=>{let lastReportArea=null;$$('[data-report-field],#storeAction,#resultComment').forEach(x=>x.addEventListener('focus',()=>lastReportArea=x));$$('[data-insert-report-staff]').forEach(b=>b.onclick=()=>{const m=staffMemberById(b.dataset.insertReportStaff);const target=lastReportArea||$('[data-report-field="staffRelation"]')||$('[data-report-field]');if(!m||!target)return;const token=`${m.name}さん `,value=target.value||'',start=target.selectionStart??value.length,end=target.selectionEnd??value.length,before=value.slice(0,start),after=value.slice(end),lineStart=before.lastIndexOf('\n')+1,prefix=before.slice(lineStart).trim()?'\n':'';target.value=before+prefix+token+after;const pos=(before+prefix+token).length;target.focus();target.setSelectionRange(pos,pos);target.dispatchEvent(new Event('input',{bubbles:true}))})};
 $('#noteType').onchange=()=>{renderDynamic();bindStaffPickers();bindReportAutosave();bindMeetingAutosave();if($('#noteType').value==='dailyReport'&&!workModeForDate($('#noteDate').value).isHoliday)bindSellNaviRefreshButton($('#noteDate').value,existing?.reportData||{})};
 $('#noteDate').onchange=()=>{const was=$('#noteType').value;renderDynamic();bindStaffPickers();if(was==='dailyReport'&&$('#reportTitle'))$('#reportTitle').value=reportTitleForDate($('#noteDate').value);bindReportAutosave();bindMeetingAutosave();if($('#noteType').value==='dailyReport'&&!workModeForDate($('#noteDate').value).isHoliday)bindSellNaviRefreshButton($('#noteDate').value,existing?.reportData||{})};
 renderDynamic();bindStaffPickers();bindReportAutosave();bindMeetingAutosave();if($('#noteType').value==='dailyReport'&&!workModeForDate($('#noteDate').value).isHoliday)bindSellNaviRefreshButton($('#noteDate').value,existing?.reportData||{});
 function bindReportAutosave(){if($('#noteType').value!=='dailyReport')return;const handler=()=>{const date=$('#noteDate').value,title=$('#reportTitle')?.value||reportTitleForDate(date),data=collectReportEditorData();saveReportDraft(date,{title,data,savedAt:nowISO()});if($('#draftStatus'))$('#draftStatus').textContent='下書きを自動保存しました'};$$('#noteEditorDynamic input,#noteEditorDynamic textarea,#noteEditorDynamic select,#noteEditorDynamic button[data-insert-report-staff]').forEach(x=>x.addEventListener('input',handler));}
 function bindMeetingAutosave(){if($('#noteType').value!=='meeting')return;const handler=()=>{const d=collectMeetingEditorData();localStorage.setItem('worknote_meeting_draft_'+($('#noteDate').value||date),JSON.stringify(d));const x=$('#meetingDraftStatus');if(x)x.textContent='下書きを自動保存しました'};$$('#noteEditorDynamic input,#noteEditorDynamic textarea,#noteEditorDynamic select').forEach(x=>x.addEventListener('input',handler));}
 $('#saveNote').onclick=async()=>{const type=$('#noteType').value,date=$('#noteDate').value;let addedCount=0,savedDailyReport=null;
  if(type==='dailyReport'){const data=collectReportEditorData();REPORT_FIELDS.forEach(([k])=>data[k]=(data[k]||'').trim());data.storeAction=(data.storeAction||'').trim();data.resultComment=(data.resultComment||'').trim();data.next=(data.next||[]).map(x=>x.trim());data.sellNaviSnapshot=workModeForDate(date).isHoliday?(existing?.reportData?.sellNaviSnapshot||null):(sellNaviSnapshotForDate(date)||existing?.reportData?.sellNaviSnapshot||null);const title=$('#reportTitle').value.trim()||reportTitleForDate(date),text=reportText(data);if(existing){existing.title=title;existing.text=text;existing.type=type;existing.date=date;existing.reportData=data;existing.staff='';existing.staffId='';existing.staffIds=[];existing.updatedAt=nowISO();savedDailyReport=existing}else{savedDailyReport={id:uid(),title,text,type,date,reportData:data,staff:'',staffId:'',staffIds:[],pinned:false,archived:false,createdAt:nowISO(),updatedAt:nowISO()};state.notes.push(savedDailyReport)}clearReportDraft(date);if(data.addTomorrowTasks){addedCount=data.next.filter(Boolean).length;const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+1);const tomorrow=isoDate(d);data.next.filter(Boolean).forEach(title=>{if(!state.tasks.some(t=>t.date===tomorrow&&t.title===title))state.tasks.push({id:uid(),title,date:tomorrow,done:false,createdAt:nowISO(),auto:false,timing:'終日',priority:'中'})})}}
  else if(type==='meeting'){const m=collectMeetingEditorData();if(!m.title.trim())return toast('MTGタイトルを入力してください');if(!m.rawMemo.trim())return toast('MTGメモを入力してください');const target=existing||{id:uid(),createdAt:nowISO(),pinned:false,archived:false};const aiMinutes=existing?.meetingData?.aiMinutes||null;Object.assign(target,{title:m.title.trim(),text:aiMinutes?.summary||m.rawMemo,type:'meeting',date,meetingData:{...m,aiMinutes},staff:'',staffId:'',staffIds:[],updatedAt:nowISO()});if(!existing)state.notes.push(target);localStorage.removeItem('worknote_meeting_draft_'+date);save();closeModal();render();toast('MTGメモを保存しました');setTimeout(()=>openMeetingViewer(target),50);return;}
  else{const text=($('#quickText')?.value||'').trim(),staffIds=selectedStaffIdsFromEditor();if(!text)return toast('内容を入力してください');if(type==='staff'&&!staffIds.length)return toast('スタッフを1名以上選択してください');const names=staffIds.map(id=>staffMemberById(id)?.name).filter(Boolean);if(existing){existing.title='';existing.text=text;delete existing.richHTML;existing.type=type;existing.date=date;existing.staffIds=staffIds;existing.staffId=staffIds[0]||'';existing.staff=names.join('・');existing.confirmed=type==='inbox'?(existing.confirmed??false):undefined;existing.updatedAt=nowISO();delete existing.reportData;delete existing.meetingData}else{state.notes.push({id:uid(),text,type,date,staffIds,staffId:staffIds[0]||'',staff:names.join('・'),confirmed:type==='inbox'?false:undefined,pinned:false,archived:false,createdAt:nowISO(),updatedAt:nowISO()})}clearSimpleDraft(existing,type,date);}
  save();closeModal();render();if(addedCount)toast(`日報を保存し、明日のタスクを${addedCount}件登録しました`,'明日のタスクを見る',()=>{const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+1);selectedDate=isoDate(d);switchView('calendar')},5000);else toast(type==='dailyReport'?'日報を保存しました':'メモを保存しました');if(savedDailyReport&&state.ai.mode==='geminiDirect'&&getGeminiApiKey()){toast('日報を保存しました・Geminiが1日を評価中…','',null,3500);try{await requestDailyReportFeedback(savedDailyReport);toast('Geminiの厳しいフィードバックを保存しました')}catch(e){state.ai.lastError=e.message||'日報フィードバックに失敗しました';save();toast('日報は保存済みです・Gemini評価のみ失敗しました')}}};

}
function eventStartDate(e){return e.startDate||e.date||''}
function eventEndDate(e){return e.endDate||e.startDate||e.date||''}
function eventAppliesToDate(e,date){const start=eventStartDate(e),end=eventEndDate(e);return !!start&&date>=start&&date<=end}
function eventCategoryLabel(c){return({campaign:'施策',discount:'割引',device:'端末発売',reservation:'予約',other:'予定'}[c]||'予定')}
function eventCategoryIcon(c){return({campaign:'◎',discount:'¥',device:'▣',reservation:'◷',other:'•'}[c]||'•')}
function eventRangeLabel(e){const start=eventStartDate(e),end=eventEndDate(e);if(!start)return '';return start===end?start:`${start}〜${end}`}
function isValidISODate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false;const [y,m,d]=value.split('-').map(Number),x=new Date(y,m-1,d);return x.getFullYear()===y&&x.getMonth()===m-1&&x.getDate()===d}
function addAIPeriodEvent(data,sourceText=''){
 const title=(data?.title||'').trim(),startDate=data?.startDate||'',endDate=data?.endDate||startDate,category=data?.category||'other',detail=(data?.detail||'').trim();
 if(!title||!isValidISODate(startDate)||!isValidISODate(endDate))return{ok:false,reason:'日付またはタイトルを確認できませんでした'};
 if(endDate<startDate)return{ok:false,reason:'終了日が開始日より前になっています'};
 const duplicate=state.events.find(e=>e.title===title&&eventStartDate(e)===startDate&&eventEndDate(e)===endDate);
 if(duplicate)return{ok:true,duplicate:true,event:duplicate};
 const event={id:uid(),title,date:startDate,startDate,endDate,category,detail,allDay:true,source:'aiChat',sourceText,createdAt:nowISO()};
 state.events.push(event);save();return{ok:true,duplicate:false,event};
}
function renderCalendar(){const y=calCursor.getFullYear(),m=calCursor.getMonth(),first=new Date(y,m,1),start=new Date(y,m,1-first.getDay());let cells='';for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);const key=isoDate(d),shift=shiftByDate(key),tasks=state.tasks.filter(t=>t.date===key),events=state.events.filter(e=>eventAppliesToDate(e,key));cells+=`<button class="day ${d.getMonth()!==m?'other':''} ${key===isoDate(new Date())?'today':''} ${key===selectedDate?'selected':''}" data-date="${key}"><div class="day-num">${d.getDate()}</div><div class="day-shift">${shift?esc(shift.name):''}</div><div class="day-count">${tasks.length?`✓${tasks.filter(t=>t.done).length}/${tasks.length}`:''}</div>${events.length?'<div class="dots">'+events.slice(0,3).map(()=>'<i class="dot"></i>').join('')+'</div>':''}</button>`}
 const dTasks=state.tasks.filter(t=>t.date===selectedDate),dEvents=state.events.filter(e=>eventAppliesToDate(e,selectedDate)),selShift=shiftByDate(selectedDate);
 $('#view-calendar').innerHTML=`<div class="calendar-head"><button id="prevMonth">‹</button><h2>${y}年${m+1}月</h2><button id="nextMonth">›</button></div><div class="calendar"><div class="weekdays">${'日月火水木金土'.split('').map(x=>`<div>${x}</div>`).join('')}</div><div class="calendar-grid">${cells}</div></div><section class="section day-detail"><div class="section-head"><h2>${selectedDate.replaceAll('-','/')} ${selShift?'・'+selShift.name:''}</h2><button class="link-btn" id="addEvent">＋追加</button></div>${dEvents.map(e=>`<div class="card calendar-event-card"><div class="event-title-row"><span class="tag event-category">${eventCategoryIcon(e.category)} ${esc(eventCategoryLabel(e.category))}</span><strong>${esc(e.title)}</strong></div><div class="small">${e.startDate||e.endDate?esc(eventRangeLabel(e)):esc(e.time||'終日')}${e.detail?'・'+esc(e.detail):''}</div></div>`).join('')}${dTasks.map(taskHTML).join('')||(!dTasks.length&&!dEvents.length?'<div class="empty">この日の予定・タスクはありません</div>':'')}</section>`;
 $('#prevMonth').onclick=()=>{calCursor.setMonth(m-1);renderCalendar()};$('#nextMonth').onclick=()=>{calCursor.setMonth(m+1);renderCalendar()};$$('[data-date]').forEach(b=>b.onclick=()=>{selectedDate=b.dataset.date;renderCalendar()});$('#addEvent').onclick=()=>openEventModal(selectedDate);bindTaskButtons()}
function openEventModal(date){
 openModal(`<h2>予定・タスクを追加</h2><div class="field"><label>種類</label><select id="entryType"><option value="event">予定</option><option value="task">タスク</option></select></div><div id="entryFields"></div><div class="btn-row"><button class="secondary" id="cancel">キャンセル</button><button class="primary" id="saveEntry">保存</button></div>`);
 const draw=()=>{const task=$('#entryType').value==='task';$('#entryFields').innerHTML=`<div class="field"><label>${task?'タスク名':'予定名'}</label><input id="entryTitle"></div><div class="grid2"><div class="field"><label>日付</label><input type="date" id="entryDate" value="${date}"></div>${task?`<div class="field"><label>タイミング</label><select id="entryTiming"><option>終日</option><option>出勤時</option><option>昼</option><option>退勤前</option></select></div>`:`<div class="field"><label>時間</label><input type="time" id="entryTime"></div>`}</div>${task?`<div class="field"><label>優先度</label><select id="entryPriority"><option>高</option><option selected>中</option><option>低</option></select></div>`:''}<div class="field"><label>詳細</label><textarea id="entryDetail"></textarea></div>`};
 $('#entryType').onchange=draw;draw();$('#cancel').onclick=closeModal;$('#saveEntry').onclick=()=>{const title=$('#entryTitle').value.trim();if(!title)return toast('内容を入力してください');const d=$('#entryDate').value,detail=$('#entryDetail').value.trim(),isTask=$('#entryType').value==='task';if(isTask){state.tasks.push({id:uid(),title,date:d,done:false,createdAt:nowISO(),auto:false,timing:$('#entryTiming').value,priority:$('#entryPriority').value,detail})}else state.events.push({id:uid(),title,date:d,time:$('#entryTime').value,detail,createdAt:nowISO()});save();closeModal();render();toast(isTask?'タスクを保存しました':'予定を保存しました')};
}
function normalizeStaffName(name){return String(name||'').trim().replace(/[　\s]+/g,'').replace(/(さん|くん|君|氏|様)$/,'')}
function activeStaffMembers(){return state.staff.members.filter(m=>m.active!==false).sort((a,b)=>a.name.localeCompare(b.name,'ja'))}
function archivedStaffMembers(){return state.staff.members.filter(m=>m.active===false).sort((a,b)=>(b.archivedAt||'').localeCompare(a.archivedAt||''))}
function staffMemberById(id){return state.staff.members.find(m=>m.id===id)}
function staffMemberByName(name){const n=normalizeStaffName(name);return state.staff.members.find(m=>normalizeStaffName(m.name)===n||(m.aliases||[]).some(a=>normalizeStaffName(a)===n))}
function createStaffMember(name,{active=true,legacy=false}={}){name=String(name||'').trim();if(!normalizeStaffName(name))return null;const existing=staffMemberByName(name);if(existing){if(active&&existing.active===false){existing.active=true;existing.archivedAt=null}return existing}const m={id:uid(),name:normalizeStaffName(name),aliases:[],active,legacy,createdAt:nowISO(),archivedAt:null};state.staff.members.push(m);return m}
function migrateStaffMaster(){if(state.staff.members.length)return;const names=new Set();for(const n of state.notes||[]){if(n.type==='staff'&&n.staff)names.add(normalizeStaffName(n.staff));const text=n.type==='dailyReport'?Object.values(n.reportData||{}).filter(v=>typeof v==='string').join('\n'):n.type==='meeting'?(n.text||''):'';text.match(/[一-龯々ヶヵ]{1,8}(?:さん|くん|君|氏)/g)?.forEach(x=>names.add(normalizeStaffName(x)))}names.delete(normalizeStaffName(state.profile?.name));['店長','副店長','スタッフ','お客様'].forEach(x=>names.delete(x));names.forEach(name=>createStaffMember(name,{legacy:true}));}
function leadingStaffForLine(line){const raw=String(line||'').trimStart();if(!raw)return null;const members=[...state.staff.members].sort((a,b)=>b.name.length-a.name.length);for(const m of members){const names=[m.name,...(m.aliases||[])].map(normalizeStaffName).filter(Boolean).sort((a,b)=>b.length-a.length);for(const name of names){for(const suffix of ['さん','くん','君','氏','様']){const token=name+suffix;if(raw.startsWith(token))return {member:m,text:raw.slice(token.length).replace(/^[\s　:：、・\-—]+/,'').trim()}}if(raw.startsWith(name)){const rest=raw.slice(name.length);if(!rest||/^[\s　:：、・\-—]/.test(rest))return {member:m,text:rest.replace(/^[\s　:：、・\-—]+/,'').trim()}}}}return null}
function extractStaffMembers(text){const found=new Set();String(text||'').split(/\r?\n/).forEach(line=>{const hit=leadingStaffForLine(line);if(hit)found.add(hit.member.id)});return [...found].map(staffMemberById).filter(Boolean)}
function selfOnlyReportText(data){
 const parts=[];
 REPORT_FIELDS.forEach(([key,label])=>{
  const lines=String(data[key]||'').split(/\r?\n/).filter(line=>!leadingStaffForLine(line)).map(x=>x.trim()).filter(Boolean);
  if(lines.length)parts.push(`【${label}】\n${lines.join('\n')}`)
 });
 const store=String(data.storeAction||'').split(/\r?\n/).filter(line=>!leadingStaffForLine(line)).map(x=>x.trim()).filter(Boolean);
 if(store.length)parts.push(`【店舗状況に対して考えたこと・行動したこと】\n${store.join('\n')}`);
 const comment=String(data.resultComment??data.results??'').split(/\r?\n/).filter(line=>!leadingStaffForLine(line)).map(x=>x.trim()).filter(Boolean);
 if(comment.length)parts.push(`【実績コメント】\n${comment.join('\n')}`);
 return parts.join('\n\n')
}
function buildStaffReports(){
 const reports={};
 state.staff.members.forEach(m=>reports[m.id]={id:m.id,name:m.name,active:m.active!==false,entries:[]});
 const add=(member,entry)=>{if(!member)return;reports[member.id]=reports[member.id]||{id:member.id,name:member.name,active:member.active!==false,entries:[]};reports[member.id].entries.push(entry)};
 state.notes.filter(n=>!n.archived).forEach(n=>{
  const date=n.date||String(n.createdAt||'').slice(0,10)||'';
  if(['staff','normal','inbox'].includes(n.type)){const ids=n.staffIds?.length?n.staffIds:(n.staffId?[n.staffId]:[]);ids.forEach(id=>{const member=staffMemberById(id);if(member)add(member,{date,type:labelType(n.type),text:n.text||'',sourceId:n.id})})}
  if(n.type==='dailyReport'){
   const data=n.reportData||{},byStaff=new Map();
   const consume=(label,text)=>String(text||'').split(/\r?\n/).forEach(line=>{const hit=leadingStaffForLine(line);if(!hit)return;const arr=byStaff.get(hit.member.id)||[];arr.push(`【${label}】${hit.text||'(記載のみ)'}`);byStaff.set(hit.member.id,arr)});
   REPORT_FIELDS.forEach(([key,label])=>consume(label,data[key]||''));consume('実績コメント',data.resultComment??data.results??'');
   byStaff.forEach((lines,id)=>add(staffMemberById(id),{date,type:'日報',text:lines.join('\n'),sourceId:n.id}));
  }
  if(n.type==='meeting'){const ids=new Set([...(n.meetingData?.staffIds||[]),...extractStaffMembers(n.text||'').map(m=>m.id)]);ids.forEach(id=>add(staffMemberById(id),{date,type:'MTG',text:n.text||'',sourceId:n.id}))}
 });
 return Object.values(reports).map(r=>{r.entries.sort((a,b)=>(b.date||'').localeCompare(a.date||''));r.latest=r.entries[0]?.date||'';return r}).sort((a,b)=>Number(b.active)-Number(a.active)||(b.latest||'').localeCompare(a.latest||'')||a.name.localeCompare(b.name,'ja'));
}
const SELF_REPORT_ID='__self__';
function buildSelfReport(){
 const entries=[];
 state.notes.filter(n=>!n.archived&&n.type==='dailyReport').forEach(n=>{
  const text=selfOnlyReportText(n.reportData||{});
  if(text.trim())entries.push({date:n.date||'',type:'日報',text,sourceId:n.id});
 });
 entries.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
 return {id:SELF_REPORT_ID,name:state.profile.name||'ヒガ',active:true,isSelf:true,entries,latest:entries[0]?.date||''};
}
function staffSentenceList(report){return report.entries.flatMap(x=>String(x.text||'').split(/[。\n]+/).map(v=>v.trim()).filter(Boolean)).slice(0,80)}
function analyzeStaffReport(report){
 const sentences=staffSentenceList(report),positive=['成功','良かった','できた','できる','獲得','達成','成長','積極','強み','改善した','好調'],negative=['課題','苦手','できない','未達','注意','不足','失敗','要改善','フォロー','遅れ','不安'];
 const hit=(words)=>sentences.filter(x=>words.some(w=>x.includes(w))),pos=hit(positive),neg=hit(negative);const today=new Date(),recent30=report.entries.filter(x=>{if(!x.date)return false;const d=new Date(x.date+'T12:00:00');return !Number.isNaN(d.getTime())&&(today-d)<=30*86400000&&(today-d)>=0}).length;
 let status='順調',statusClass='good';if(report.entries.length<2||recent30===0){status='記録不足';statusClass='muted'}else if(neg.length>=3&&neg.length>pos.length*1.5){status='注意';statusClass='danger'}else if(neg.length>pos.length){status='要フォロー';statusClass='warn'}
 const score=s=>positive.reduce((n,w)=>n+(s.includes(w)?1:0),0)-negative.reduce((n,w)=>n+(s.includes(w)?1:0),0),recent=sentences.slice(0,8).reduce((n,x)=>n+score(x),0),older=sentences.slice(8,16).reduce((n,x)=>n+score(x),0);let trend='横ばい';if(sentences.length<6)trend='記録を増やすと変化を判定できます';else if(recent>older+1)trend='改善傾向';else if(recent<older-1)trend='要継続確認';
 const clean=x=>x.replace(/^【[^】]+】/,'').trim();const strengths=[...new Set(pos.map(clean))].slice(0,3),challenges=[...new Set(neg.map(clean))].slice(0,3);let nextAction='次回の関わりを1件記録し、変化を確認する';if(status==='注意')nextAction='直近の課題を1つに絞り、次回の確認日を決めてフォローする';else if(status==='要フォロー')nextAction='課題の原因をヒアリングし、小さな次回目標を1つ設定する';else if(status==='順調')nextAction='できている行動を具体的に称賛し、次の一段高い目標を設定する';
 return {status,statusClass,trend,strengths,challenges,nextAction,recent30};
}
function staffReportCardHTML(r){const a=analyzeStaffReport(r);return `<button class="card staff-report-card" data-staff-report="${r.id}"><div class="staff-report-head"><div><h3>${esc(r.name)}さん</h3><div class="small">最終記録：${esc(r.latest||'未記録')}・${r.entries.length}件</div></div><span class="staff-status ${a.statusClass}">${esc(a.status)}</span></div><div class="staff-card-foot"><span>最近30日 ${a.recent30}件</span><span>変化：${esc(a.trend)}</span><b>›</b></div></button>`}
function teamSummary(){const active=buildStaffReports().filter(r=>r.active),analyses=active.map(r=>({report:r,a:analyzeStaffReport(r)}));return{total:active.length,follow:analyses.filter(x=>['要フォロー','注意'].includes(x.a.status)).length,noRecord:analyses.filter(x=>x.report.entries.length===0||x.a.status==='記録不足').length}}
function openStaffDirectory(){
 const selfReport=buildSelfReport(),reports=buildStaffReports().filter(r=>r.active),sum=teamSummary(),selfA=analyzeStaffReport(selfReport);
 openModal(`<div class="viewer-head"><button class="secondary" id="backAIFromStaff">‹ AI</button><div class="viewer-actions"><button class="secondary" id="manageStaff">スタッフ管理</button><button class="secondary" id="closeStaffDirectory">閉じる</button></div></div><article class="staff-directory"><header><h1>スタッフ育成</h1><p>自分自身と登録スタッフの記録・分析をまとめます。</p></header><div class="staff-directory-stats"><div><strong>${sum.total}</strong><span>在籍スタッフ</span></div><div><strong>${sum.follow}</strong><span>要フォロー</span></div><div><strong>${sum.noRecord}</strong><span>記録不足</span></div></div><section class="section"><div class="section-head"><h2>スタッフ一覧</h2><button class="link-btn" id="addStaffFromDirectory">＋追加</button></div><button class="card staff-report-card self-report-card" data-staff-report="${SELF_REPORT_ID}"><div class="staff-report-head"><div><h3>${esc(selfReport.name)} <span class="tag self-tag">自分</span></h3><div class="small">最終記録：${esc(selfReport.latest||'未記録')}・${selfReport.entries.length}件</div></div><span class="staff-status ${selfA.statusClass}">${esc(selfA.status)}</span></div><div class="staff-card-foot"><span>本人の日報記録</span><span>副店長として分析</span><b>›</b></div></button>${reports.map(staffReportCardHTML).join('')||'<div class="empty">スタッフを追加すると育成管理を始められます</div>'}</section></article>`,'note-viewer');
 $('#backAIFromStaff').onclick=()=>{closeModal();switchView('ai')};$('#closeStaffDirectory').onclick=closeModal;$('#manageStaff').onclick=openStaffManager;$('#addStaffFromDirectory').onclick=()=>openStaffEditor(null,openStaffDirectory);$$('[data-staff-report]').forEach(b=>b.onclick=()=>openStaffReport(b.dataset.staffReport));
}
function openStaffManager(){const active=activeStaffMembers(),past=archivedStaffMembers();openModal(`<div class="viewer-head"><button class="secondary" id="backStaffDirectory">‹ スタッフ育成</button><button class="primary compact" id="addStaff">＋追加</button></div><article class="staff-directory"><header><h1>スタッフ管理</h1><p>削除しても過去の記録・分析・育成履歴は消えません。</p></header><section class="section"><h2>在籍スタッフ</h2>${active.map(m=>`<div class="card staff-manage-row"><button class="staff-name-btn" data-edit-staff="${m.id}">${esc(m.name)}</button><button class="danger compact" data-archive-staff="${m.id}">削除</button></div>`).join('')||'<div class="empty">在籍スタッフはいません</div>'}</section><section class="section"><h2>過去のスタッフ</h2>${past.map(m=>`<div class="card staff-manage-row"><button class="staff-name-btn" data-view-past="${m.id}">${esc(m.name)}<span class="small">過去履歴を見る</span></button><button class="secondary compact" data-restore-staff="${m.id}">再登録</button></div>`).join('')||'<div class="empty">過去のスタッフはいません</div>'}</section></article>`,'note-viewer');$('#backStaffDirectory').onclick=openStaffDirectory;$('#addStaff').onclick=()=>openStaffEditor(null,openStaffManager);$$('[data-edit-staff]').forEach(b=>b.onclick=()=>openStaffEditor(b.dataset.editStaff,openStaffManager));$$('[data-view-past]').forEach(b=>b.onclick=()=>openStaffReport(b.dataset.viewPast));$$('[data-archive-staff]').forEach(b=>b.onclick=()=>archiveStaff(b.dataset.archiveStaff));$$('[data-restore-staff]').forEach(b=>b.onclick=()=>restoreStaff(b.dataset.restoreStaff));}
function openStaffEditor(id=null,onDone=openStaffManager){const m=id?staffMemberById(id):null;openModal(`<h2>${m?'スタッフを編集':'スタッフを追加'}</h2><div class="field"><label>名前</label><input id="staffEditName" value="${esc(m?.name||'')}" placeholder="例：青木"></div><div class="field"><label>呼び方・別名（任意）</label><input id="staffAliases" value="${esc((m?.aliases||[]).join('、'))}" placeholder="例：あおき、青木さん"></div><p class="small">名前だけで登録できます。別名は日報やMTGからの自動認識に使います。</p><div class="btn-row"><button class="secondary" id="cancelStaffEdit">キャンセル</button><button class="primary" id="saveStaffEdit">保存</button></div>`);$('#cancelStaffEdit').onclick=onDone;$('#saveStaffEdit').onclick=()=>{const name=$('#staffEditName').value.trim();if(!name)return toast('名前を入力してください');const dup=staffMemberByName(name);if(dup&&dup.id!==m?.id)return toast('同じスタッフがすでに登録されています');const target=m||createStaffMember(name);const previousName=target.name;target.name=normalizeStaffName(name);target.aliases=[...new Set([...(previousName&&previousName!==target.name?[previousName]:[]),...$('#staffAliases').value.split(/[、,\n]/).map(normalizeStaffName).filter(Boolean)])].filter(x=>x!==target.name);target.active=true;target.archivedAt=null;save();toast('スタッフを保存しました');onDone()};}
function archiveStaff(id){const m=staffMemberById(id);if(!m)return;openModal(`<h2>スタッフを一覧から外しますか？</h2><div class="warning">${esc(m.name)}さんを「過去のスタッフ」へ移動します。日報・MTG・スタッフメモ・育成目標・分析履歴は削除されません。</div><div class="btn-row"><button class="secondary" id="cancelArchive">キャンセル</button><button class="danger" id="confirmArchive">移動する</button></div>`);$('#cancelArchive').onclick=openStaffManager;$('#confirmArchive').onclick=()=>{m.active=false;m.archivedAt=nowISO();save();toast('過去のスタッフへ移動しました');openStaffManager()};}
function restoreStaff(id){const m=staffMemberById(id);if(!m)return;m.active=true;m.archivedAt=null;save();toast('在籍スタッフへ戻しました');openStaffManager()}
function staffInsightHTML(report){
 const isSelf=report.id===SELF_REPORT_ID,local=analyzeStaffReport(report),remote=state.ai.staffInsights?.[report.id]||state.ai.staffInsights?.[report.name];const useRemote=remote&&remote.version===1&&remote.summary;
 const status=useRemote?(remote.status||local.status):local.status,cls=status==='注意'?'danger':status==='要フォロー'?'warn':status==='記録不足'?'muted':'good';
 const strengths=useRemote?(remote.strengths||[]):local.strengths,challenges=useRemote?(remote.challenges||[]):local.challenges,trend=useRemote?(remote.trend||local.trend):local.trend,nextAction=useRemote?(remote.nextAction||local.nextAction):local.nextAction,summary=useRemote?remote.summary:`${report.entries.length}件の記録を端末内で整理しました。記録内容の傾向から、現在は「${local.status}」と判定しています。`;
 return `<section class="staff-analysis"><div class="staff-analysis-top"><div><span class="small">${isSelf?'自己成長ステータス':'育成ステータス'}</span><div class="staff-status ${cls}">${esc(status)}</div></div><div class="staff-trend"><span class="small">最近の変化</span><strong>${esc(trend)}</strong></div></div><div class="staff-analysis-summary">${displayMultiline(summary)}</div><div class="staff-analysis-grid"><div><h3>強み</h3>${strengths.length?`<ul>${strengths.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<p class="small">強みを判断できる記録がまだ十分ではありません。</p>'}</div><div><h3>課題</h3>${challenges.length?`<ul>${challenges.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<p class="small">明確な課題はまだ抽出されていません。</p>'}</div></div><div class="staff-next-action"><span>${isSelf?'次に改善すること':'次回の関わり方'}</span><strong>${esc(nextAction)}</strong></div>${isSelf&&useRemote&&remote.selfGrowth?`<div class="self-growth-ai"><span class="small">副店長としての自己成長</span><div>${displayMultiline(remote.selfGrowth)}</div></div>`:''}${isSelf&&!useRemote?'<div class="self-growth-ai"><span class="small">副店長としての自己成長</span><div>Geminiで分析を更新すると、判断・数字管理・スタッフ育成・商談・報連相・行動改善の6観点から分析します。</div></div>':''}${useRemote?`<div class="small staff-analysis-date">Gemini分析：${new Date(remote.updatedAt).toLocaleString('ja-JP')}</div>`:''}</section>`;
}
const AI_SELF_GROWTH_SCHEMA={type:'OBJECT',properties:{status:{type:'STRING',enum:['順調','要フォロー','注意','記録不足']},summary:{type:'STRING'},strengths:{type:'ARRAY',maxItems:3,items:{type:'STRING'}},challenges:{type:'ARRAY',maxItems:3,items:{type:'STRING'}},trend:{type:'STRING'},nextAction:{type:'STRING'},selfGrowth:{type:'STRING'}},required:['status','summary','strengths','challenges','trend','nextAction','selfGrowth']};
const AI_STAFF_SCHEMA={type:'OBJECT',properties:{status:{type:'STRING',enum:['順調','要フォロー','注意','記録不足']},summary:{type:'STRING'},strengths:{type:'ARRAY',maxItems:3,items:{type:'STRING'}},challenges:{type:'ARRAY',maxItems:3,items:{type:'STRING'}},trend:{type:'STRING'},nextAction:{type:'STRING'}},required:['status','summary','strengths','challenges','trend','nextAction']};
async function requestStaffAnalysis(id){
 const isSelf=id===SELF_REPORT_ID,report=isSelf?buildSelfReport():buildStaffReports().find(x=>x.id===id);if(!report)throw Error('報告書が見つかりません');
 const prompt=isSelf?`WORKNOTEユーザー本人「${report.name}」の副店長としての自己成長を分析してください。入力は日報からスタッフ行を除外した本人自身の記録だけです。人格評価はせず、記録された仕事上の行動だけを根拠にしてください。特に「判断」「数字管理」「スタッフ育成」「商談」「報連相」「行動改善」の6観点から、強み・課題・最近の変化・次に改善する具体的行動を分析してください。過剰に褒めず、記録不足なら断定しないでください。selfGrowthには6観点を横断した副店長としての成長評価を書いてください。\n${JSON.stringify(report.entries.slice(0,30))}`:`スタッフ「${report.name}」の育成記録を分析してください。人格評価はせず、記録された仕事上の行動だけを根拠にしてください。強み・課題・最近の変化・次回の具体的な関わり方を簡潔に返してください。記録不足なら断定しないでください。\n${JSON.stringify(report.entries.slice(0,30))}`;
 const data=await callGeminiDirect({input:prompt,schema:isSelf?AI_SELF_GROWTH_SCHEMA:AI_STAFF_SCHEMA});state.ai.staffInsights[id]={...data,version:1,updatedAt:nowISO()};state.ai.connectionStatus='接続済み';state.ai.lastError='';save();return data;
}
function staffGoals(id){return state.staff.goals[id]||[]}
function addStaffGoal(id){const goals=staffGoals(id);if(goals.filter(g=>g.status!=='達成').length>=3)return toast('進行中の育成目標は最大3つです');openModal(`<h2>育成目標を追加</h2><div class="field"><label>目標</label><input id="goalTitle" placeholder="例：クレカのクロージング"></div><div class="btn-row"><button class="secondary" id="cancelGoal">キャンセル</button><button class="primary" id="saveGoal">追加</button></div>`);$('#cancelGoal').onclick=()=>openStaffReport(id);$('#saveGoal').onclick=()=>{const title=$('#goalTitle').value.trim();if(!title)return toast('目標を入力してください');state.staff.goals[id]=[...goals,{id:uid(),title,status:'進行中',createdAt:nowISO(),updatedAt:nowISO()}];save();toast('育成目標を追加しました');openStaffReport(id)}}
function cycleGoal(id,goalId){const g=staffGoals(id).find(x=>x.id===goalId);if(!g)return;g.status=g.status==='進行中'?'達成':g.status==='達成'?'保留':'進行中';g.updatedAt=nowISO();save();openStaffReport(id)}
function removeGoal(id,goalId){state.staff.goals[id]=staffGoals(id).filter(x=>x.id!==goalId);save();openStaffReport(id)}
function staffFollowups(id){return state.staff.followups.filter(f=>f.staffId===id).sort((a,b)=>(a.done-b.done)||(a.date||'').localeCompare(b.date||''))}
function addStaffFollowup(id){openModal(`<h2>次回確認を設定</h2><div class="field"><label>確認日</label><input type="date" id="followDate" value="${isoDate(new Date())}"></div><div class="field"><label>確認すること</label><input id="followTitle" placeholder="例：クレカ提案をもう一度確認"></div><label class="check-row"><input type="checkbox" id="followTask" checked> 通常タスクにも追加</label><div class="btn-row"><button class="secondary" id="cancelFollow">キャンセル</button><button class="primary" id="saveFollow">保存</button></div>`);$('#cancelFollow').onclick=()=>openStaffReport(id);$('#saveFollow').onclick=()=>{const date=$('#followDate').value,title=$('#followTitle').value.trim();if(!date||!title)return toast('日付と内容を入力してください');const f={id:uid(),staffId:id,date,title,done:false,createdAt:nowISO(),taskId:null};if($('#followTask').checked){const m=staffMemberById(id),task={id:uid(),title:`${m?.name||'スタッフ'}：${title}`,date,done:false,createdAt:nowISO(),auto:false,timing:'終日',priority:'中',staffId:id,staffFollowupId:f.id};state.tasks.push(task);f.taskId=task.id}state.staff.followups.push(f);save();toast('次回確認を登録しました');openStaffReport(id)}}
function toggleStaffFollowup(id,followId){const f=state.staff.followups.find(x=>x.id===followId);if(!f)return;f.done=!f.done;const t=state.tasks.find(x=>x.id===f.taskId);if(t){t.done=f.done;t.doneAt=f.done?nowISO():null}save();openStaffReport(id)}
function removeStaffFollowup(id,followId){const f=state.staff.followups.find(x=>x.id===followId);if(f?.taskId)state.tasks=state.tasks.filter(t=>t.id!==f.taskId);state.staff.followups=state.staff.followups.filter(x=>x.id!==followId);save();openStaffReport(id)}
function openStaffReport(id){
 const isSelf=id===SELF_REPORT_ID,report=isSelf?buildSelfReport():buildStaffReports().find(x=>x.id===id);if(!report)return toast('報告書が見つかりません');const member=isSelf?null:staffMemberById(id);const entries=report.entries.map(x=>`<section class="staff-report-entry"><div class="staff-report-entry-meta"><b>${esc(x.date||'日付なし')}</b><span>${esc(x.type)}</span></div><div>${displayMultiline(x.text)}</div></section>`).join('');const canGemini=state.ai.mode==='geminiDirect'&&!!getGeminiApiKey(),goals=isSelf?[]:staffGoals(id),follows=isSelf?[]:staffFollowups(id);
 openModal(`<div class="viewer-head"><button class="secondary" id="backStaffList">‹ スタッフ一覧</button><button class="secondary" id="closeStaffReport">閉じる</button></div><article class="report-viewer staff-report-viewer"><header><div class="note-viewer-type">${isSelf?'自分・副店長成長':'スタッフ育成'}</div><h1>${esc(report.name)} ${isSelf?'<span class="tag self-tag">自分</span>':`さん ${member?.active===false?'<span class="tag">過去スタッフ</span>':''}`}</h1><div class="note-viewer-meta">記録 ${report.entries.length}件・最終更新 ${esc(report.latest||'未記録')}</div></header>${isSelf?'<section class="self-growth-intro"><h2>副店長としての自己成長</h2><p>日報のうち、スタッフ名が行頭にない「自分自身の文章」だけを分析対象にしています。</p></section>':`<section class="staff-control-section"><div class="section-head"><h2>育成目標</h2>${member?.active===false?'':`<button class="link-btn" id="addStaffGoal">＋追加</button>`}</div>${goals.map(g=>`<div class="card goal-row">${member?.active===false?`<div class="goal-main"><span class="goal-status ${g.status==='達成'?'done':g.status==='保留'?'hold':''}">${esc(g.status)}</span><b>${esc(g.title)}</b></div><span></span>`:`<button class="goal-main" data-cycle-goal="${g.id}"><span class="goal-status ${g.status==='達成'?'done':g.status==='保留'?'hold':''}">${esc(g.status)}</span><b>${esc(g.title)}</b></button><button class="more-btn" data-remove-goal="${g.id}">×</button>`}</div>`).join('')||'<div class="empty compact-empty">育成目標はまだありません</div>'}</section><section class="staff-control-section"><div class="section-head"><h2>次回確認</h2>${member?.active===false?'':`<button class="link-btn" id="addStaffFollowup">＋設定</button>`}</div>${follows.map(f=>`<div class="card follow-row ${f.done?'done':''}">${member?.active===false?`<span class="check">${f.done?'✓':''}</span><div class="grow"><b>${esc(f.title)}</b><div class="small">${esc(f.date)}</div></div><span></span>`:`<button class="check" data-toggle-follow="${f.id}">${f.done?'✓':''}</button><div class="grow"><b>${esc(f.title)}</b><div class="small">${esc(f.date)}</div></div><button class="more-btn" data-remove-follow="${f.id}">×</button>`}</div>`).join('')||'<div class="empty compact-empty">次回確認はありません</div>'}</section>`}${staffInsightHTML(report)}${canGemini?`<button class="secondary staff-ai-refresh" id="refreshStaffAI">${isSelf?'Geminiで自己成長を分析':'Geminiで分析を更新'}</button>`:''}${!isSelf&&state.ai.staffInsights?.[id]?.nextAction?'<button class="secondary staff-ai-refresh" id="staffAiToTask">次回の関わり方をタスクにする</button>':''}<section class="section"><div class="section-head"><h2>記録履歴</h2><span class="small">新しい順</span></div>${entries||'<div class="empty">記録はありません</div>'}</section></article>`,'note-viewer');
 $('#backStaffList').onclick=openStaffDirectory;$('#closeStaffReport').onclick=closeModal;if(!isSelf){if($('#addStaffGoal'))$('#addStaffGoal').onclick=()=>addStaffGoal(id);if($('#addStaffFollowup'))$('#addStaffFollowup').onclick=()=>addStaffFollowup(id);$$('[data-cycle-goal]').forEach(b=>b.onclick=()=>cycleGoal(id,b.dataset.cycleGoal));$$('[data-remove-goal]').forEach(b=>b.onclick=()=>removeGoal(id,b.dataset.removeGoal));$$('[data-toggle-follow]').forEach(b=>b.onclick=()=>toggleStaffFollowup(id,b.dataset.toggleFollow));$$('[data-remove-follow]').forEach(b=>b.onclick=()=>removeStaffFollowup(id,b.dataset.removeFollow))}if($('#refreshStaffAI'))$('#refreshStaffAI').onclick=async()=>{const b=$('#refreshStaffAI');b.disabled=true;b.textContent='分析中…';try{await requestStaffAnalysis(id);toast(isSelf?'自己成長分析を更新しました':'スタッフ分析を更新しました');openStaffReport(id)}catch(e){state.ai.connectionStatus='接続失敗';state.ai.lastError=e.message||'Gemini分析に失敗しました';save();toast('Gemini分析に失敗しました');openStaffReport(id)}};
if($('#staffAiToTask'))$('#staffAiToTask').onclick=()=>{const action=state.ai.staffInsights?.[id]?.nextAction||'';if(addStaffNextActionTask(id,action))toast('スタッフ育成タスクへ追加しました')};}
let performanceMonthCursor=monthKey(isoDate(new Date()));
function monthKeyFromDate(d){
 if(typeof d==='string')return d.slice(0,7);
 const x=d instanceof Date?d:new Date(d);
 return `${x.getFullYear()}-${pad(x.getMonth()+1)}`
}
function performanceReportsForMonth(monthKey){return state.notes.filter(n=>!n.archived&&n.type==='dailyReport'&&String(n.date||'').startsWith(monthKey)).sort((a,b)=>(b.date||'').localeCompare(a.date||''))}
function aggregatePerformance(reports){const out={};PERFORMANCE_FIELDS.forEach(([k])=>out[k]=0);reports.forEach(n=>PERFORMANCE_FIELDS.forEach(([k])=>out[k]+=performanceValue(n.reportData||{},k)));return out}
function performanceSummaryGrid(metrics){return `<div class="performance-summary-grid">${PERFORMANCE_FIELDS.map(([k,l])=>`<div class="performance-summary-item"><span>${esc(l)}</span><strong>${esc(performanceFormat(k,metrics[k]||0))}</strong></div>`).join('')}</div>`}
function openPerformanceDashboard(targetMonth=null){
 if(targetMonth)performanceMonthCursor=typeof targetMonth==='string'?targetMonth.slice(0,7):monthKeyFromDate(targetMonth);
 const m=typeof performanceMonthCursor==='string'?performanceMonthCursor:monthKeyFromDate(performanceMonthCursor);
 performanceMonthCursor=m;
 const reports=performanceReportsForMonth(m),totals=aggregatePerformance(reports),goals=loadMonthlyGoals()[m]||{};
 openModal(`<div class="viewer-head"><button class="secondary" id="backAIFromPerformance">‹ AI</button><button class="secondary" id="closePerformance">閉じる</button></div><article class="performance-dashboard"><header class="performance-head"><span class="tag">実績管理</span><h1>月間実績</h1><div class="performance-month-nav"><button class="secondary" id="prevPerformanceMonth">‹</button><strong>${esc(m.replace('-','年'))}月</strong><button class="secondary" id="nextPerformanceMonth">›</button></div></header><section class="section"><div class="section-head"><h2>今月の目標</h2><span class="small">13項目</span></div><div class="monthly-goal-grid">${PERFORMANCE_FIELDS.map(([k,l])=>`<label class="monthly-goal-item"><span>${esc(l)}</span><input type="number" step="any" inputmode="decimal" data-month-goal="${k}" value="${goals[k]??''}" placeholder="0"></label>`).join('')}</div><button class="primary monthly-goal-save" id="saveMonthlyGoals">目標を保存</button></section><section class="section"><div class="section-head"><h2>進捗</h2><span class="small">${reports.length}日分</span></div><div class="performance-summary-grid">${PERFORMANCE_FIELDS.map(([k,l])=>{const goal=Number(goals[k]||0),actual=Number(totals[k]||0),rate=goal>0?Math.round(actual/goal*100):0;return `<button class="performance-summary-card clickable" data-metric-detail="${k}"><span>${esc(l)}</span><strong>${esc(performanceFormat(k,actual))}${goal>0?` / ${esc(performanceFormat(k,goal))}`:''}</strong>${goal>0?`<div class="goal-progress"><i style="width:${Math.min(100,Math.max(0,rate))}%"></i></div><small>${rate}%・残り ${esc(performanceFormat(k,Math.max(0,goal-actual)))}</small>`:''}</button>`}).join('')}</div></section><section class="section"><div class="section-head"><h2>日別実績</h2></div>${reports.map(n=>`<button class="card performance-day-row" data-performance-day="${n.date}"><div><strong>${esc(n.date.replaceAll('-','/'))}</strong><p>${esc(performanceCompactSummary(n.reportData?.metrics||{}))}</p></div><span>›</span></button>`).join('')||'<div class="empty">この月の日報実績はまだありません</div>'}</section></article>`,'note-viewer');
 $('#backAIFromPerformance').onclick=()=>{if(history.state?.worknoteRoute?.type==='performance')history.back();else{closeModal();switchView('ai')}};
 $('#closePerformance').onclick=closeModal;
 $('#prevPerformanceMonth').onclick=()=>{const d=new Date(m+'-01T12:00:00');d.setMonth(d.getMonth()-1);performanceMonthCursor=monthKeyFromDate(d);openPerformanceDashboard(performanceMonthCursor)};
 $('#nextPerformanceMonth').onclick=()=>{const d=new Date(m+'-01T12:00:00');d.setMonth(d.getMonth()+1);performanceMonthCursor=monthKeyFromDate(d);openPerformanceDashboard(performanceMonthCursor)};
 $('#saveMonthlyGoals').onclick=()=>{const all=loadMonthlyGoals();all[m]=all[m]||{};$$('[data-month-goal]').forEach(x=>all[m][x.dataset.monthGoal]=metricNumber(x.value));saveMonthlyGoals(all);toast('今月の目標を保存しました');openPerformanceDashboard(m)};
 $$('[data-performance-day]').forEach(b=>b.onclick=()=>openPerformanceDay(b.dataset.performanceDay,m))
$$('[data-metric-detail]').forEach(b=>b.onclick=()=>openMetricProgressDetail(b.dataset.metricDetail,`${m}-01`));}
function openPerformanceDay(date,selectedMonth=null){
 const m=selectedMonth||monthKeyFromDate(date);
 const reports=state.notes.filter(n=>!n.archived&&n.type==='dailyReport'&&n.date===date),totals=aggregatePerformance(reports);
 openModal(`<div class="viewer-head"><button class="secondary" id="backPerformanceMonth">‹ ${esc(m.replace('-','/'))}</button><h3>${esc(date.replaceAll('-','/'))}</h3></div><article class="performance-dashboard"><section class="section"><div class="section-head"><h2>当日実績</h2></div>${performanceSummaryGrid(totals)}</section><section class="section"><div class="section-head"><h2>日報</h2></div>${reports.map(n=>`<button class="card performance-report-link" data-performance-report="${n.id}"><div><strong>${esc(n.title||reportTitleForDate(n.date))}</strong><p class="small">日報を開く</p></div><span>›</span></button>`).join('')||'<div class="empty">日報がありません</div>'}</section></article>`,'note-viewer');
 $('#backPerformanceMonth').onclick=()=>openPerformanceDashboard(m);
 $$('[data-performance-report]').forEach(b=>b.onclick=()=>{const n=state.notes.find(x=>x.id===b.dataset.performanceReport);if(n)openReportViewer(n)})
}



const AI_ROLEUP_ASSIGNMENT_SCHEMA={type:'OBJECT',properties:{
 shouldAssign:{type:'BOOLEAN'},title:{type:'STRING'},reason:{type:'STRING'},focus:{type:'STRING'},productId:{type:'STRING'},difficulty:{type:'STRING',enum:['auto','level1','level2','level3']},mentorComment:{type:'STRING'}
},required:['shouldAssign','title','reason','focus','productId','difficulty','mentorComment']};
async function requestRoleupAssignmentFromMentor(){
 if(state.ai.mode!=='geminiDirect'||!getGeminiApiKey())throw Error('Gemini直接接続を設定してください');
 const date=isoDate(new Date()),reports=recentMentorReports(date,14).map(n=>({date:n.date,workMode:workModeForDate(n.date),selfText:selfOnlyReportText(n.reportData||{}),feedback:n.aiFeedback||null}));
 const input=`あなたはWORKNOTE専属の副店長育成AIメンターです。
直近の日報・日次フィードバック・継続課題・ROLEUP履歴を見て、今このユーザーにROLEUP実践練習が本当に必要なら1つだけ課題を作ってください。
知識暗記や数字管理などROLEUPに不向きな課題なら shouldAssign=false。
接客会話、ヒアリング、質問、説明、切り返し、クロージング、提案の自然さなど、会話練習で改善できる課題を優先してください。
既にROLEUPで改善し、実務確認待ちの課題を惰性的に再練習させないでください。
productId は device/pixel/money/uq/electric/hikari/support/tablet のいずれか。difficultyは原則auto。

${JSON.stringify({reports,activeIssues:activeMentorIssues(),activeMemories:activeMentorMemories(date),roleup:roleupRecentSummary(date,30)})}`;
 const d=await callGeminiDirect({schema:AI_ROLEUP_ASSIGNMENT_SCHEMA,input});
 if(d.shouldAssign)return createRoleupAssignment({...d,sourceDate:date},'ai-dashboard');
 return d
}

const AI_ROLEUP_NEXT_SCHEMA={type:'OBJECT',properties:{
 decision:{type:'STRING',enum:['repeat','work_check','level_up','graduate']},
 title:{type:'STRING'},reason:{type:'STRING'},focus:{type:'STRING'},productId:{type:'STRING'},difficulty:{type:'STRING',enum:['auto','level1','level2','level3']},mentorComment:{type:'STRING'}
},required:['decision','title','reason','focus','productId','difficulty','mentorComment']};
async function requestRoleupNextTask(task){
 if(state.ai.mode!=='geminiDirect'||!getGeminiApiKey())throw Error('Gemini直接接続を設定してください');
 const result=roleupTaskResult(task);if(!result)throw Error('ROLEUP結果がまだありません');
 const input=`あなたはWORKNOTE専属の副店長育成AIメンターです。
WORKNOTEで出したロープレ課題と、ROLEUPで実施した結果を比較して次の1手を決めてください。
点数だけで判断せず、breakdown、improve、advice、会話全文、元の重点課題を見てください。
decision:
- repeat: 同じ基礎課題を再練習する必要がある
- level_up: 同テーマで難易度を上げる
- work_check: ROLEUPでは十分改善したので、次の出勤で実商談定着を確認する
- graduate: ROLEUPと既存の実務記録の両方から安定が確認できる時だけ
同じ課題を惰性的に繰り返させないでください。work_check の場合はROLEUP再実行を必須にしません。
productId は device/pixel/money/uq/electric/hikari/support/tablet のいずれか。

${JSON.stringify({assignment:task,result,recentRoleup:roleupRecentSummary(isoDate(new Date()),30),recentReports:recentMentorReports(isoDate(new Date()),7).map(n=>({date:n.date,selfText:selfOnlyReportText(n.reportData||{}),feedback:n.aiFeedback||null}))})}`;
 return await callGeminiDirect({schema:AI_ROLEUP_NEXT_SCHEMA,input})
}
async function applyRoleupNextDecision(task){
 const next=await requestRoleupNextTask(task);task.status=next.decision==='graduate'?'graduated':'reviewed';task.reviewedAt=nowISO();task.review=next;save();
 if(next.decision==='repeat'||next.decision==='level_up'){
  createRoleupAssignment({title:next.title,reason:next.reason,focus:next.focus,productId:next.productId,difficulty:next.difficulty},'ai-followup')
 }
 return next
}

const AI_MONTHLY_MENTOR_SCHEMA={type:'OBJECT',properties:{
 period:{type:'STRING'},overall:{type:'STRING'},growthSummary:{type:'STRING'},
 areaRatings:{type:'ARRAY',maxItems:8,items:{type:'OBJECT',properties:{area:{type:'STRING'},grade:{type:'STRING',enum:['◎','○','△','×','？']},reason:{type:'STRING'},change:{type:'STRING'}},required:['area','grade','reason','change']}},
 behaviorPatterns:{type:'ARRAY',maxItems:6,items:{type:'STRING'}},
 staffDevelopment:{type:'STRING'},storeManagement:{type:'STRING'},managerInstructions:{type:'STRING'},trainingGrowth:{type:'STRING'},roleupGrowth:{type:'STRING'},
 recurringIssues:{type:'ARRAY',maxItems:6,items:{type:'STRING'}},graduatedIssues:{type:'ARRAY',maxItems:6,items:{type:'STRING'}},
 nextMonthSkills:{type:'ARRAY',maxItems:2,items:{type:'OBJECT',properties:{skill:{type:'STRING'},reason:{type:'STRING'},practice:{type:'STRING'},measure:{type:'STRING'}},required:['skill','reason','practice','measure']}},
 mentorComment:{type:'STRING'}
},required:['period','overall','growthSummary','areaRatings','behaviorPatterns','staffDevelopment','storeManagement','managerInstructions','trainingGrowth','roleupGrowth','recurringIssues','graduatedIssues','nextMonthSkills','mentorComment']};
function monthKeyFromDate(date=isoDate(new Date())){return String(date).slice(0,7)}
function latestMonthlyReport(){return [...(state.ai.mentor.monthlyReports||[])].sort((a,b)=>String(b.month||'').localeCompare(String(a.month||'')))[0]||null}
function monthlySourcePayload(month){
 const notes=state.notes.filter(n=>!n.archived&&String(n.date||'').startsWith(month)).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
 const allNotes=notes.map(n=>({date:n.date,type:n.type,title:n.title||'',text:n.text||'',reportData:n.reportData||null,meetingData:n.meetingData||null,aiFeedback:n.aiFeedback||null,staff:n.staff||''}));
 const memories=(state.ai.mentor.memories||[]).filter(m=>String(m.sourceDate||'').startsWith(month)||String(m.startDate||'').startsWith(month)||(!m.endDate&&m.status==='active'));
 const weekly=(state.ai.mentor.weeklyReviews||[]).filter(x=>String(x.endDate||'').startsWith(month));
 const roleup=loadRoleupLogs().filter(x=>roleupDateISO(x).startsWith(month));
 return {month,allNotes,memories,weeklyReviews:weekly,roleupLogs:roleup,activeIssues:activeMentorIssues()}
}
async function requestMonthlyMentorReport(month=monthKeyFromDate()){
 if(state.ai.mode!=='geminiDirect'||!getGeminiApiKey())throw Error('Gemini直接接続を設定してください');
 const src=monthlySourcePayload(month);if(!src.allNotes.length&&!src.roleupLogs.length)throw Error('この月の記録がありません');
 const input=`あなたはWORKNOTE専属の副店長育成AIメンターです。これは販売実績報告ではなく「1か月の副店長成長報告書」です。
対象月にWORKNOTEへ入力された全記録（日報、通常メモ、スタッフ記録、MTG、AI日次結果、週次結果、継続記憶、休日の学習）とROLEUPロープレ結果を横断し、1日単位では見えない成長・再発・行動パターンを分析してください。
販売数字は副店長が店舗の基準になれているかを見る一要素。報告書の主役は管理職としての成長です。
休日は勤務評価をせず、休日に記録された学習・訓練のみ成長材料にしてください。
ROLEUPは「実施回数」だけでなく、breakdown・improve・advice・会話内容の変化から能力改善を見てください。ROLEUPで高得点でも、日報の実務記録がなければ「実務定着済み」と断定しないでください。
来月鍛える能力は最大2つ。精神論ではなく具体的な訓練と測定方法を示してください。
記録にないことは推測で断定しないでください。

${JSON.stringify(src)}`;
 const d=await callGeminiDirect({schema:AI_MONTHLY_MENTOR_SCHEMA,input}),report={...d,month,createdAt:nowISO(),mentorMonthlyVersion:1};
 state.ai.mentor.monthlyReports=(state.ai.mentor.monthlyReports||[]).filter(x=>x.month!==month);state.ai.mentor.monthlyReports.push(report);save();return report
}
function monthlyReportHTML(r){
 if(!r)return '<div class="empty">まだ月間レポートはありません。</div>';
 return `<article class="monthly-mentor-report"><header><span class="tag">月間成長レポート</span><h1>${esc(r.period||r.month)}</h1><p>${displayMultiline(r.overall||'')}</p></header><section><h3>1か月でできるようになったこと</h3><p>${displayMultiline(r.growthSummary||'')}</p></section><section><h3>管理職8領域</h3>${(r.areaRatings||[]).map(x=>`<div class="monthly-rating"><b>${esc(x.area)} <span>${esc(x.grade)}</span></b><p>${esc(x.reason)}</p><small>${esc(x.change||'')}</small></div>`).join('')}</section><section><h3>行動パターン</h3><ul>${(r.behaviorPatterns||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section><section><h3>スタッフ育成</h3><p>${displayMultiline(r.staffDevelopment||'')}</p></section><section><h3>店舗管理</h3><p>${displayMultiline(r.storeManagement||'')}</p></section><section><h3>店長指示・継続方針</h3><p>${displayMultiline(r.managerInstructions||'')}</p></section><section><h3>訓練・自己成長</h3><p>${displayMultiline(r.trainingGrowth||'')}</p></section><section><h3>ROLEUP成長</h3><p>${displayMultiline(r.roleupGrowth||'')}</p></section><section><h3>繰り返した課題</h3><ul>${(r.recurringIssues||[]).map(x=>`<li>${esc(x)}</li>`).join('')||'<li>なし</li>'}</ul></section><section><h3>卒業できた課題</h3><ul>${(r.graduatedIssues||[]).map(x=>`<li>${esc(x)}</li>`).join('')||'<li>なし</li>'}</ul></section><section><h3>来月鍛える能力</h3>${(r.nextMonthSkills||[]).map(x=>`<div class="monthly-next"><b>${esc(x.skill)}</b><p>${esc(x.reason)}</p><small>訓練：${esc(x.practice)}<br>判定：${esc(x.measure)}</small></div>`).join('')}</section><section class="mentor-comment"><h3>AIメンターからの月末コメント</h3><p>${displayMultiline(r.mentorComment||'')}</p></section></article>`
}
function openMonthlyMentor(){
 const now=monthKeyFromDate(),saved=state.ai.mentor.monthlyReports||[];
 openModal(`<div class="viewer-head"><button class="secondary" id="backMonthly">‹ AI</button><button class="secondary" id="closeMonthly">閉じる</button></div><article class="performance-dashboard"><header class="performance-head"><span class="tag">副店長育成</span><h1>月間成長レポート</h1><p>当月に入力した全記録＋ROLEUPを元に、1か月の成長を報告書にします。</p></header><div class="field"><label>対象月</label><input type="month" id="monthlyMentorMonth" value="${now}"></div><button class="primary" id="generateMonthlyMentor">月間レポートを生成</button><div id="monthlyMentorResult">${monthlyReportHTML(saved.find(x=>x.month===now)||latestMonthlyReport())}</div></article>`,'note-viewer');
 const back=$('#backMonthly'),close=$('#closeMonthly'),gen=$('#generateMonthlyMentor'),month=$('#monthlyMentorMonth');if(back)back.onclick=()=>{closeModal();switchView('ai')};if(close)close.onclick=closeModal;
 if(month)month.onchange=()=>{const holder=$('#monthlyMentorResult');if(holder)holder.innerHTML=monthlyReportHTML((state.ai.mentor.monthlyReports||[]).find(x=>x.month===month.value))};
 if(gen)gen.onclick=async()=>{gen.disabled=true;gen.textContent='1か月を分析中…';try{const r=await requestMonthlyMentorReport(month.value);$('#monthlyMentorResult').innerHTML=monthlyReportHTML(r);toast('月間成長レポートを保存しました')}catch(e){toast(friendlyGeminiError(e,e?.status||0))}finally{gen.disabled=false;gen.textContent='月間レポートを生成'}}
}

function renderAI(){
 syncRoleupTaskResults();const staffReports=buildStaffReports().filter(r=>r.active),aiErr=state.ai.lastError?friendlyGeminiError(state.ai.lastError):'',monthly=latestMonthlyReport(),task=roleupActiveTask();
 $('#view-ai').innerHTML=`<div class="ai-dashboard"><div class="viewer-head"><div><h1>AI副店長メンター</h1><p class="small">日報・店舗状況・ROLEUP訓練をつなぎ、副店長として継続育成します。</p></div><div class="viewer-actions"><button class="secondary" id="aiChatBtn">AIチャット</button><button class="secondary" id="aiRulesBtn">記憶ルール</button></div></div><div class="ai-status-row"><span>接続：${state.ai.mode==='geminiDirect'?'Gemini直接接続':'端末内分析'}</span><span>Gemini：${esc(state.ai.mode==='geminiDirect'?(state.ai.connectionStatus||'未接続'):'必要時のみ使用')}</span></div>${aiErr?`<div class="warning ai-error-banner"><span>${esc(aiErr)}</span><button class="secondary" id="dismissAIError">閉じる</button></div>`:''}
 <section class="section"><div class="card roleup-command-card"><div class="section-head"><div><span class="tag">実践トレーニング</span><h2>🎭 ROLEUP訓練</h2></div><small>${task?esc(task.status):'待機中'}</small></div>${roleupTrainingCardHTML()}</div></section>
 <section class="section"><button class="card ai-directory-card" id="openPerformanceDashboard"><div class="ai-directory-icon">数</div><div class="grow"><span class="tag">実績管理</span><h2>月間・日別実績</h2><p>日報に入力した13項目を自動集計</p></div><span class="ai-directory-arrow">›</span></button></section>
 <section class="section"><button class="card ai-directory-card" id="openStaffDirectory"><div class="ai-directory-icon">人</div><div class="grow"><span class="tag">育成管理</span><h2>スタッフ別</h2><p>${staffReports.length?`${staffReports.length}名の育成記録・分析を見る`:'日報やMTGからスタッフ記録をまとめます'}</p></div><span class="ai-directory-arrow">›</span></button></section>
 <section class="section"><button class="card ai-directory-card mentor-memory-card" id="openMentorMemory"><div class="ai-directory-icon">記</div><div class="grow"><span class="tag">継続記憶</span><h2>今月・今週・これから</h2><p>${activeMentorMemories().length?`${activeMentorMemories().length}件の有効な目標・方針・指示を記憶中`:'日報から期間を理解して必要事項を記憶'}</p></div><span class="ai-directory-arrow">›</span></button></section>
 <section class="section"><button class="card ai-directory-card mentor-weekly-card" id="openWeeklyMentor"><div class="ai-directory-icon">週</div><div class="grow"><span class="tag">副店長育成</span><h2>直近7日の育成総括</h2><p>${latestWeeklyReview()?`最終更新 ${new Date(latestWeeklyReview().createdAt).toLocaleDateString('ja-JP')}`:'管理職としての成長・再発課題・訓練効果を分析'}</p></div><span class="ai-directory-arrow">›</span></button></section>
 <section class="section"><button class="card ai-directory-card mentor-monthly-card" id="openMonthlyMentor"><div class="ai-directory-icon">月</div><div class="grow"><span class="tag">月末報告書</span><h2>月間成長レポート</h2><p>${monthly?`${esc(monthly.month)} レポート保存済み`:'当月に入力した全記録＋ROLEUPを横断分析'}</p></div><span class="ai-directory-arrow">›</span></button></section>
 <section class="section"><div class="card ai-usage-card"><strong>Geminiを使うタイミング</strong><p class="small">AIチャット・スタッフ分析・日報メンター・7日総括・月間レポートの生成時に使用します。画面を開くだけでは分析しません。</p></div></section></div>`;
 const map={aiChatBtn:openAIChat,aiRulesBtn:openAIRules,openPerformanceDashboard:()=>openPerformanceDashboard(),openStaffDirectory:openStaffDirectory,openMentorMemory,openWeeklyMentor:openWeeklyMentorReview,openMonthlyMentor};
 Object.entries(map).forEach(([id,fn])=>{const el=$('#'+id);if(el)el.onclick=fn});const dis=$('#dismissAIError');if(dis)dis.onclick=()=>{state.ai.lastError='';save();renderAI()};
 const ask=$('#askRoleupTask');if(ask)ask.onclick=async()=>{ask.disabled=true;ask.textContent='AIが課題を選定中…';try{const x=await requestRoleupAssignmentFromMentor();if(x?.id){renderAI();toast('ROLEUP課題を作成しました')}else{toast(x?.mentorComment||'今はROLEUPより別の訓練を優先します');ask.disabled=false;ask.textContent='AIに次のROLEUP課題を決めてもらう'}}catch(e){toast(friendlyGeminiError(e,e?.status||0));ask.disabled=false;ask.textContent='AIに次のROLEUP課題を決めてもらう'}};
 const launch=$('#launchRoleupCurrent');if(launch&&task)launch.onclick=()=>launchRoleupTask(task);
 const review=$('#roleupNextReview');if(review&&task)review.onclick=async()=>{review.disabled=true;review.textContent='AIが次の課題を判断中…';try{const next=await applyRoleupNextDecision(task);renderAI();toast(next.decision==='work_check'?'次は実商談で定着確認です':next.decision==='graduate'?'この課題は卒業判定です':'次のROLEUP課題を作成しました')}catch(e){toast(friendlyGeminiError(e,e?.status||0));review.disabled=false;review.textContent='この結果から次の課題を考える'}}
}
function renderSettings(){$('#view-settings').innerHTML=`<div class="card settings-card" data-setting="shift"><div class="settings-icon">▦</div><div><h3>勤務・シフト</h3><p>月間登録、CSV取込、勤務種類</p></div><button>›</button></div><div class="card settings-card" data-setting="rules"><div class="settings-icon">↻</div><div><h3>自動タスク</h3><p>出勤日ごとの継続業務</p></div><button>›</button></div><div class="card settings-card" data-setting="staff"><div class="settings-icon">人</div><div><h3>スタッフ管理</h3><p>追加・削除・過去スタッフの復帰</p></div><button>›</button></div><div class="card settings-card" data-setting="ai"><div class="settings-icon">AI</div><div><h3>AI副店長補佐</h3><p>チャット、判断ルール、API接続</p></div><button>›</button></div><div class="card settings-card" data-setting="profile"><div class="settings-icon">✎</div><div><h3>表示・プロフィール</h3><p>名前、表示設定</p></div><button>›</button></div><div class="card settings-card" data-setting="update"><div class="settings-icon">⟳</div><div><h3>アプリ更新</h3><p>最新版を確認して更新・現在 v${APP_VERSION}</p></div><button>›</button></div><div class="card settings-card" data-setting="data"><div class="settings-icon">⇩</div><div><h3>データ管理</h3><p>バックアップ、復元、CSV出力</p></div><button>›</button></div><div class="card settings-card" data-setting="notification"><div class="settings-icon">◉</div><div><h3>通知</h3><p>通知全体・自動タスク別のON／OFF</p></div><button>›</button></div><div class="danger-note">WORKNOTEは個人用メモです。お客様の氏名・電話番号・契約情報などの個人情報は保存しないでください。</div>`;$$('[data-setting]').forEach(x=>x.onclick=()=>({shift:openShiftSettings,rules:openRules,staff:openStaffManager,ai:openAISettings,profile:openProfile,update:openAppUpdate,data:openData,notification:openNotifications}[x.dataset.setting])())}
function openShiftSettings(){openModal(`<h2>勤務・シフト</h2><div class="btn-row"><button class="primary" id="csvImport">CSV取込</button><button class="secondary" id="manualShift">手入力</button></div><section class="section"><h3>シフト種類</h3>${state.shiftTypes.map(s=>`<div class="list-row"><i style="width:12px;height:12px;border-radius:50%;background:${s.color}"></i><div class="grow"><strong>${esc(s.name)}</strong><div class="small">${s.start?`${s.start}〜${s.end}`:'休日'}</div></div><button class="secondary" data-edit-shift="${s.id}">編集</button></div>`).join('')}</section><button class="secondary" id="shiftTemplate" style="width:100%;margin-top:10px">CSVテンプレートを保存</button>`);$('#csvImport').onclick=()=>importCSV();$('#manualShift').onclick=()=>openManualShift();$('#shiftTemplate').onclick=downloadShiftTemplate;$$('[data-edit-shift]').forEach(b=>b.onclick=()=>openShiftTypeEdit(b.dataset.editShift))}
function openManualShift(){const month=isoDate(new Date()).slice(0,7);openModal(`<h2>シフトを手入力</h2><div class="field"><label>日付</label><input type="date" id="shiftDate" value="${month}-01"></div><div class="field"><label>勤務</label><select id="shiftType">${state.shiftTypes.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div><div class="btn-row"><button class="secondary" id="cancel">キャンセル</button><button class="primary" id="saveShift">登録</button></div>`);$('#cancel').onclick=closeModal;$('#saveShift').onclick=()=>{const d=$('#shiftDate').value;state.shifts[d]=$('#shiftType').value;reconcileDate(d);closeModal();render();toast('シフトを登録しました')}}
function openShiftTypeEdit(id){const s=state.shiftTypes.find(x=>x.id===id);openModal(`<h2>シフト種類を編集</h2><div class="field"><label>名称</label><input id="stName" value="${esc(s.name)}"></div><div class="grid2"><div class="field"><label>開始</label><input type="time" id="stStart" value="${s.start}"></div><div class="field"><label>終了</label><input type="time" id="stEnd" value="${s.end}"></div></div><div class="field"><label>表示色</label><input type="color" id="stColor" value="${s.color}"></div><button class="primary" id="saveST" style="width:100%">保存</button>`);$('#saveST').onclick=()=>{s.name=$('#stName').value.trim();s.start=$('#stStart').value;s.end=$('#stEnd').value;s.color=$('#stColor').value;save();closeModal();render();toast('保存しました')}}
function importCSV(){const input=$('#fileInput');input.accept='.csv,text/csv';input.onchange=async()=>{const text=await input.files[0].text();const rows=parseCSV(text);if(!rows.length)return toast('CSVを読み込めませんでした');openCSVPreview(rows);input.value=''};input.click()}
function parseCSV(text){const lines=text.replace(/^\uFEFF/,'').trim().split(/\r?\n/);if(lines.length<2)return[];const head=lines[0].split(',').map(x=>x.trim());return lines.slice(1).map(line=>{const vals=line.split(',').map(x=>x.trim());return Object.fromEntries(head.map((h,i)=>[h,vals[i]||'']))}).filter(r=>r.date)}
function openCSVPreview(rows){const normalized=rows.map(r=>{const name=r.shift||r.shift_type||r.type;const st=state.shiftTypes.find(s=>s.name===name||s.id===name);return {date:r.date,shiftId:st?.id||'',name:name||'不明'}});openModal(`<h2>シフト取込プレビュー</h2>${normalized.map((r,i)=>`<div class="list-row"><div class="grow"><strong>${esc(r.date)}</strong><div class="small">${esc(r.name)}</div></div><select data-csv-i="${i}">${state.shiftTypes.map(s=>`<option value="${s.id}" ${s.id===r.shiftId?'selected':''}>${esc(s.name)}</option>`).join('')}</select></div>`).join('')}<div class="btn-row"><button class="secondary" id="cancel">キャンセル</button><button class="primary" id="applyCSV">この内容で登録</button></div>`);$('#cancel').onclick=closeModal;$('#applyCSV').onclick=()=>{normalized.forEach((r,i)=>{const id=$(`[data-csv-i="${i}"]`).value;state.shifts[r.date]=id;reconcileDate(r.date)});save();closeModal();render();toast(`${normalized.length}日分を登録しました`)}}
function downloadShiftTemplate(){download('worknote_shift_template.csv','date,shift,start_time,end_time,note\n2026-08-01,早番,09:30,18:30,\n2026-08-02,遅番,11:00,20:00,\n2026-08-03,休み,,,')}
function openRules(){openModal(`<h2>自動タスク設定</h2>${state.rules.map(r=>`<div class="list-row"><label class="switch"><input type="checkbox" data-rule-toggle="${r.id}" ${r.enabled?'checked':''}><i></i></label><div class="grow"><strong>${esc(r.title)}</strong><div class="small">${scopeLabel(r.scope)}・${esc(r.timing)}</div></div><button class="secondary" data-rule-edit="${r.id}">編集</button></div>`).join('')}<button class="primary" id="addRule" style="width:100%;margin-top:12px">＋自動タスクを追加</button>`);$$('[data-rule-toggle]').forEach(x=>x.onchange=()=>{const r=state.rules.find(a=>a.id===x.dataset.ruleToggle);r.enabled=x.checked;Object.keys(state.shifts).forEach(reconcileDate);save()});$$('[data-rule-edit]').forEach(x=>x.onclick=()=>openRuleEdit(x.dataset.ruleEdit));$('#addRule').onclick=()=>openRuleEdit()}
function scopeLabel(s){return s==='work'?'毎出勤日':s==='daily'?'毎日':(state.shiftTypes.find(x=>x.id===s)?.name||s)}
function openRuleEdit(id=null){const r=id?state.rules.find(x=>x.id===id):{title:'',enabled:true,scope:'work',timing:'退勤前',notify:false};openModal(`<h2>${id?'自動タスクを編集':'自動タスクを追加'}</h2><div class="field"><label>タスク名</label><input id="ruleTitle" value="${esc(r.title)}"></div><div class="grid2"><div class="field"><label>対象</label><select id="ruleScope"><option value="work">毎出勤日</option><option value="daily">毎日</option>${state.shiftTypes.filter(s=>s.id!=='off').map(s=>`<option value="${s.id}">${esc(s.name)}のみ</option>`).join('')}</select></div><div class="field"><label>タイミング</label><select id="ruleTiming"><option>出勤時</option><option>昼</option><option>退勤前</option><option>終日</option></select></div></div><div class="list-row"><div class="grow"><strong>端末へ通知</strong><div class="small">設定したタイミングに未完了なら通知</div></div><label class="switch"><input type="checkbox" id="ruleNotify" ${r.notify?'checked':''}><i></i></label></div><div class="btn-row">${id?'<button class="danger" id="deleteRule">削除</button>':''}<button class="primary" id="saveRule">保存</button></div>`);$('#ruleScope').value=r.scope;$('#ruleTiming').value=r.timing;$('#saveRule').onclick=()=>{const title=$('#ruleTitle').value.trim();if(!title)return toast('タスク名を入力してください');if(id){r.title=title;r.scope=$('#ruleScope').value;r.timing=$('#ruleTiming').value;r.notify=$('#ruleNotify').checked}else state.rules.push({id:uid(),title,enabled:true,scope:$('#ruleScope').value,timing:$('#ruleTiming').value,notify:$('#ruleNotify').checked});Object.keys(state.shifts).forEach(reconcileDate);save();closeModal();render();toast('保存しました')};if($('#deleteRule'))$('#deleteRule').onclick=()=>{state.rules=state.rules.filter(x=>x.id!==id);state.tasks=state.tasks.filter(t=>t.ruleId!==id||t.done||t.manuallyEdited);save();closeModal();render();toast('削除しました')}}
function openProfile(){openModal(`<h2>表示・プロフィール</h2><div class="field"><label>表示名</label><input id="profileName" value="${esc(state.profile.name)}"></div><button class="primary" id="saveProfile" style="width:100%">保存</button>`);$('#saveProfile').onclick=()=>{state.profile.name=$('#profileName').value.trim()||'ヒガ';save();closeModal();render();toast('保存しました')}}
function openData(){openModal(`<h2>データ管理</h2><div class="warning">端末やブラウザのデータを消すと記録も消える可能性があります。定期的にバックアップしてください。</div><button class="card" id="backup" style="width:100%;text-align:left"><strong>バックアップを保存</strong><div class="small">全データをJSONで保存</div></button><button class="card" id="restore" style="width:100%;text-align:left"><strong>バックアップから復元</strong><div class="small">復元前に内容を確認</div></button><button class="card" id="exportTasks" style="width:100%;text-align:left"><strong>タスク履歴をCSV出力</strong></button><button class="danger" id="resetAll" style="width:100%">全データを初期化</button>`);$('#backup').onclick=()=>{state.settings.lastBackup=nowISO();save();download(`worknote_backup_${isoDate(new Date())}.json`,JSON.stringify(state,null,2));toast('バックアップを保存しました')};$('#restore').onclick=restoreBackup;$('#exportTasks').onclick=exportTasks;$('#resetAll').onclick=()=>{if(confirm('すべてのデータを削除します。元に戻せません。')){state=clone(DEFAULT);save();closeModal();render();toast('初期化しました')}}}
function restoreBackup(){const input=$('#fileInput');input.accept='.json,application/json';input.onchange=async()=>{try{const data=JSON.parse(await input.files[0].text());if(!data.tasks||!data.notes||!data.settings)throw Error();if(confirm(`タスク${data.tasks.length}件、メモ${data.notes.length}件を復元しますか？`)){state=data;state.settings=Object.assign({},clone(DEFAULT.settings),state.settings||{});state.ai=Object.assign({},clone(DEFAULT.ai),state.ai||{});state.staff=Object.assign({members:[],goals:{},followups:[]},state.staff||{});state.staff.members=state.staff.members||[];state.staff.goals=state.staff.goals||{};state.staff.followups=state.staff.followups||[];migrateStaffMaster();save();closeModal();render();toast('復元しました')}}catch{toast('正しいバックアップではありません')}input.value=''};input.click()}
function exportTasks(){const rows=[['date','title','status','completed_at','source','carried_from'],...state.tasks.map(t=>[t.date,t.title,t.done?'done':'open',t.doneAt||'',t.auto?'auto':'manual',t.carriedFrom||''])];download(`worknote_tasks_${isoDate(new Date())}.csv`,rows.map(r=>r.map(csvCell).join(',')).join('\n'))}
function csvCell(v){return `"${String(v??'').replaceAll('"','""')}"`}
function download(name,text){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\uFEFF'+text],{type:'text/plain;charset=utf-8'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function notificationStatus(){if(!('Notification'in window))return 'この端末では非対応';return Notification.permission==='granted'?'許可済み':Notification.permission==='denied'?'端末設定で拒否中':'未設定'}
async function showDeviceNotification(title,body,tag='worknote',url='./?view=home'){if(!('Notification'in window)||Notification.permission!=='granted')return false;try{const reg=swRegistration||await navigator.serviceWorker.ready;await reg.showNotification(title,{body,tag,renotify:true,icon:'./icon-192.png',badge:'./icon-192.png',data:{url},vibrate:[180,80,180]});return true}catch(error){console.error('Notification failed:',error);return false}}
function openNotifications(){const masterOn=state.settings.notificationMaster!==false;openModal(`<h2>通知</h2><div class="card"><strong>端末の通知権限：${notificationStatus()}</strong><div class="small" style="margin-top:6px">通知全体・自動タスク・日報リマインドをこの画面で設定できます。</div></div><div class="list-row"><div class="grow"><strong>WORKNOTEの通知を使用</strong><div class="small">OFFにすると、下の設定に関係なくすべて停止</div></div><label class="switch"><input type="checkbox" id="notificationMaster" ${masterOn?'checked':''}><i></i></label></div><div class="section-head" style="margin-top:16px"><h2 style="font-size:16px">日報リマインド</h2></div><div class="list-row"><div class="grow"><strong>出勤日の未入力通知</strong><div class="small">当日の日報が未保存の場合だけ通知</div></div><label class="switch"><input type="checkbox" id="reportReminderEnabled" ${state.settings.reportReminderEnabled!==false?'checked':''}><i></i></label></div><div class="field"><label>通知時刻</label><input type="time" id="reportReminderTime" value="${esc(state.settings.reportReminderTime||'22:00')}"></div><div class="section-head" style="margin-top:16px"><h2 style="font-size:16px">自動タスク別</h2></div>${state.rules.map(r=>`<div class="list-row"><div class="grow"><strong>${esc(r.title)}</strong><div class="small">${scopeLabel(r.scope)}・${esc(r.timing)}（${reminderLabelForRule(r)}）</div></div><label class="switch"><input type="checkbox" data-notify-rule="${r.id}" ${r.notify?'checked':''} ${!r.enabled?'disabled':''}><i></i></label></div>`).join('')||'<div class="empty">自動タスクがありません</div>'}<button class="primary" id="requestNotify" style="width:100%;margin-top:14px">通知を許可する</button><button class="secondary" id="testNotify" style="width:100%;margin-top:10px">テスト通知を送る</button><div class="warning" style="margin-top:12px">Android側でWORKNOTEを強制停止した場合や省電力制限が強い場合、通知が遅れることがあります。</div>`);$('#notificationMaster').onchange=e=>{state.settings.notificationMaster=e.target.checked;save();toast(e.target.checked?'通知全体をONにしました':'通知全体をOFFにしました')};$('#reportReminderEnabled').onchange=e=>{state.settings.reportReminderEnabled=e.target.checked;save();toast(`日報通知を${e.target.checked?'ON':'OFF'}にしました`)};$('#reportReminderTime').onchange=e=>{state.settings.reportReminderTime=e.target.value||'22:00';save();toast('日報の通知時刻を変更しました')};$$('[data-notify-rule]').forEach(x=>x.onchange=()=>{const r=state.rules.find(a=>a.id===x.dataset.notifyRule);if(!r)return;r.notify=x.checked;save();toast(`${r.title}の通知を${x.checked?'ON':'OFF'}にしました`)});$('#requestNotify').onclick=async()=>{if(!('Notification'in window))return toast('この端末では通知を利用できません');const p=await Notification.requestPermission();state.settings.notifications=p==='granted';if(p==='granted')state.settings.notificationMaster=true;save();toast(p==='granted'?'通知を許可しました':'通知は許可されませんでした');openNotifications()};$('#testNotify').onclick=async()=>{if(Notification.permission!=='granted')return toast('先に通知を許可してください');const ok=await showDeviceNotification('WORKNOTE テスト通知','通知機能は正常に動作しています。','worknote-test-'+Date.now());toast(ok?'テスト通知を送信しました':'通知の送信に失敗しました')}}
function reminderLabelForRule(rule){if(rule.timing==='出勤時')return 'シフト開始時刻';if(rule.timing==='昼')return '13:00';if(rule.timing==='退勤前')return '退勤30分前';return '10:00'}
function reminderTimeFor(task,shift){if(task.timing==='出勤時')return shift?.start||'09:30';if(task.timing==='昼')return '13:00';if(task.timing==='退勤前'){if(!shift?.end)return '18:00';const [h,m]=shift.end.split(':').map(Number);const d=new Date(2000,0,1,h,m-30);return `${pad(d.getHours())}:${pad(d.getMinutes())}`}return '10:00'}
async function checkTaskNotifications(){if(!state.settings.notifications||state.settings.notificationMaster===false||!('Notification'in window)||Notification.permission!=='granted')return;const date=isoDate(new Date()),shift=shiftByDate(date),now=`${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`;state.settings.notificationLog=state.settings.notificationLog||{};for(const task of state.tasks.filter(t=>t.date===date&&!t.done&&t.auto)){const rule=state.rules.find(r=>r.id===task.ruleId);if(!rule?.notify)continue;const due=reminderTimeFor(task,shift),key=`${date}:${task.id}:${due}`;if(now>=due&&!state.settings.notificationLog[key]){const ok=await showDeviceNotification('WORKNOTE 未完了タスク',task.title,`task-${task.id}`);if(ok){state.settings.notificationLog[key]=nowISO();save()}}}const cutoff=new Date();cutoff.setDate(cutoff.getDate()-14);for(const [key,value] of Object.entries(state.settings.notificationLog)){if(new Date(value)<cutoff)delete state.settings.notificationLog[key]}await checkReportNotification()}
function reportWorkday(date){const s=shiftByDate(date);if(!s)return false;return !/(OFF|休み|休日|希望休)/i.test(s.name||'')}
async function checkReportNotification(){if(!state.settings.notifications||state.settings.notificationMaster===false||state.settings.reportReminderEnabled===false||Notification.permission!=='granted')return;const date=isoDate(new Date());if(!reportWorkday(date))return;if(state.notes.some(n=>n.type==='dailyReport'&&n.date===date))return;const now=`${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`,due=state.settings.reportReminderTime||'22:00',key=`report:${date}:${due}`;state.settings.notificationLog=state.settings.notificationLog||{};if(now>=due&&!state.settings.notificationLog[key]){const ok=await showDeviceNotification('今日の日報が未入力です','1日の振り返りを記録しましょう。',`daily-report-${date}`,`./?action=daily-report&date=${date}`);if(ok){state.settings.notificationLog[key]=nowISO();save()}}}


const MTG_TYPES=['店舗ミーティング','個別面談','実績会議','朝礼・終礼','その他'];
const AI_MEETING_MINUTES_SCHEMA={type:'OBJECT',properties:{summary:{type:'STRING'},decisions:{type:'ARRAY',items:{type:'STRING'}},actions:{type:'ARRAY',items:{type:'OBJECT',properties:{title:{type:'STRING'},owner:{type:'STRING'},dueDate:{type:'STRING'},done:{type:'BOOLEAN'}},required:['title','owner','dueDate','done']}},issues:{type:'ARRAY',items:{type:'STRING'}},staffNotes:{type:'ARRAY',items:{type:'OBJECT',properties:{staffName:{type:'STRING'},text:{type:'STRING'}},required:['staffName','text']}}},required:['summary','decisions','actions','issues','staffNotes']};
async function generateMeetingMinutes(rawMemo,title,date){if(state.ai.mode!=='geminiDirect'||!getGeminiApiKey())throw Error('Gemini直接接続を設定してください');return await callGeminiDirect({schema:AI_MEETING_MINUTES_SCHEMA,input:`WORKNOTEのMTGメモを正式な議事録へ整理してください。殴り書きの意味を勝手に補完しすぎず、書かれている内容だけを構造化してください。決定事項と検討中を混同しないでください。担当者や期限が不明なら空文字にしてください。staffNotesには登録スタッフ名と明確に結びつく内容だけを入れてください。\n日付:${date}\nタイトル:${title}\n登録スタッフ:${JSON.stringify(activeStaffMembers().map(x=>x.name))}\n元メモ:${rawMemo}`})}
async function reviseMeetingMinutes(note,instruction){const m=note.meetingData||{};if(!m.aiMinutes)throw Error('先にAI議事録を作成してください');return await callGeminiDirect({schema:AI_MEETING_MINUTES_SCHEMA,input:`現在の議事録を、ユーザーの修正指示だけに従って更新してください。元メモにない内容を勝手に追加しないでください。\n元メモ:${m.rawMemo||''}\n現在の議事録:${JSON.stringify(m.aiMinutes)}\n修正指示:${instruction}`})}
function meetingMinutesHTML(m){const a=m.aiMinutes;if(!a)return '<div class="empty">AI議事録はまだ作成されていません</div>';return `<section class="meeting-minutes-section"><h2>MTG概要</h2><div>${displayMultiline(a.summary||'')}</div></section><section class="meeting-minutes-section"><h2>決まったこと</h2>${(a.decisions||[]).length?`<ul>${a.decisions.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<div class="small">決定事項なし</div>'}</section><section class="meeting-minutes-section"><h2>担当・アクション</h2>${(a.actions||[]).length?`<div class="meeting-action-list">${a.actions.map((x,i)=>`<label class="meeting-action-item"><input type="checkbox" data-meeting-action="${i}" ${x.done?'checked':''}><div><b>${esc(x.title)}</b><span>${esc([x.owner,x.dueDate].filter(Boolean).join('・')||'担当/期限未設定')}</span></div></label>`).join('')}</div>`:'<div class="small">アクションなし</div>'}</section><section class="meeting-minutes-section"><h2>課題・気になったこと</h2>${(a.issues||[]).length?`<ul>${a.issues.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<div class="small">記録なし</div>'}</section><section class="meeting-minutes-section"><h2>スタッフ記録候補</h2>${(a.staffNotes||[]).length?`<div class="meeting-staff-note-list">${a.staffNotes.map((x,i)=>`<label class="meeting-staff-note-item"><input type="checkbox" data-meeting-staff-note="${i}" ${x.applied?'checked disabled':''}><div><b>${esc(x.staffName)}</b><span>${esc(x.text)}</span></div></label>`).join('')}</div>`:'<div class="small">スタッフ記録候補なし</div>'}</section>`}
function renderMeetingEditor(box,existing,date){let draft={};try{draft=JSON.parse(localStorage.getItem('worknote_meeting_draft_'+date)||'{}')}catch{}const m=existing?.meetingData||draft||{};box.innerHTML=`<div class="draft-status" id="meetingDraftStatus">${Object.keys(draft).length&&!existing?'下書きを復元しました':'入力内容は自動保存されます'}</div><div class="field note-editor-options"><label>MTGタイトル</label><input id="meetingTitle" value="${esc(existing?.title||m.title||'')}"></div><div class="field meeting-raw-memo"><label>MTGメモ</label><textarea id="meetingRawMemo" placeholder="きれいに書かなくてOK。決まったこと、担当、期限、気になったことをそのままメモしてください。">${esc(m.rawMemo||'')}</textarea></div>${m.aiMinutes?'<div class="meeting-ai-preview"><span class="tag">AI議事録あり</span><p>元メモを編集しても、保存時は現在のAI議事録を保持します。</p></div>':''}`;setTimeout(()=>$('#meetingRawMemo')?.focus(),40)}
function bindMeetingDynamic(box){$$('[data-meeting-staff]',box).forEach(b=>b.onclick=()=>{b.classList.toggle('active');b.dispatchEvent(new Event('input',{bubbles:true}))});$('#addMeetingTask')?.addEventListener('click',()=>{$('#meetingTasks').insertAdjacentHTML('beforeend',meetingTaskEditor({},$$('.meeting-task-row').length))});$$('.remove-meeting-task',box).forEach(b=>b.onclick=()=>b.closest('.meeting-task-row').remove());$$('.remove-quick',box).forEach(b=>b.onclick=()=>{const i=Number(b.dataset.i),m=collectMeetingEditorData();m.quick.splice(i,1);renderMeetingEditor(box,{meetingData:m},$('#noteDate').value)});}
function quickMeetingRow(x,i){const labels={decision:'決定',task:'タスク',important:'重要',hold:'保留'};return `<div class="quick-record"><span class="quick-record-tag ${x.type}">${labels[x.type]||'記録'}</span><div>${esc(x.text)}</div><button type="button" class="remove-quick" data-i="${i}">×</button></div>`}
function meetingTaskEditor(x={},i=0){return `<div class="meeting-task-row card"><div class="field"><label>やること</label><input data-mtask="title" value="${esc(x.title||'')}"></div><div class="grid2"><div class="field"><label>担当者</label><input data-mtask="assignee" value="${esc(x.assignee||'')}"></div><div class="field"><label>期限日</label><input data-mtask="date" type="date" value="${esc(x.date||'')}"></div></div><div class="grid2"><div class="field"><label>優先度</label><select data-mtask="priority"><option ${x.priority==='高'?'selected':''}>高</option><option ${!x.priority||x.priority==='中'?'selected':''}>中</option><option ${x.priority==='低'?'selected':''}>低</option></select></div><label class="check-row"><input type="checkbox" data-mtask="notify" ${x.notify?'checked':''}> 通知</label></div><button type="button" class="danger remove-meeting-task">削除</button></div>`}
function collectMeetingEditorData(){return{title:$('#meetingTitle')?.value||'',rawMemo:$('#meetingRawMemo')?.value||''}}
function meetingText(m){return m.aiMinutes?.summary||m.rawMemo||''}
function createMeetingLinkedItems(n){let tasks=0,event=false;const m=n.meetingData||{};(m.tasks||[]).forEach(x=>{if(!x.title||!x.date)return;if(!state.tasks.some(t=>t.title===x.title&&t.date===x.date)){state.tasks.push({id:uid(),title:x.title,date:x.date,done:false,createdAt:nowISO(),auto:false,timing:'終日',priority:x.priority||'中',assignee:x.assignee||'',notify:!!x.notify,sourceMeetingId:n.id});tasks++}});if(m.addNextMeeting&&m.nextDate&&m.nextTopic&&!state.events.some(e=>e.date===m.nextDate&&e.title===m.nextTopic)){state.events.push({id:uid(),title:m.nextTopic,date:m.nextDate,allDay:true,createdAt:nowISO(),sourceMeetingId:n.id});event=true}return{tasks,event}}
function openMeetingViewer(n){const m=n.meetingData||{};openModal(`<div class="viewer-head"><button class="secondary" id="closeViewer">閉じる</button><div class="viewer-actions"><button class="secondary" id="editViewer">元メモ編集</button><button class="danger" id="deleteViewer">削除</button></div></div><article class="report-viewer meeting-viewer"><header><div class="note-viewer-type">MTG</div><h1>${esc(n.title||'MTG')}</h1><div class="note-viewer-meta">${esc(n.date||'')}</div></header>${meetingMinutesHTML(m)}<section class="meeting-tools"><button class="primary" id="generateMeetingAI">${m.aiMinutes?'AI議事録を再生成':'AIで議事録を作成'}</button>${m.aiMinutes?`<div class="meeting-revise-box"><input id="meetingReviseInput" placeholder="例：2番は決定ではなく検討中。期限は8/16"><button class="secondary" id="reviseMeetingAI">AIへ修正を頼む</button></div><div class="btn-row"><button class="secondary" id="applyMeetingTasks">選択したタスクを登録</button><button class="secondary" id="applyMeetingStaff">選択したスタッフ記録を反映</button></div>`:''}</section><details class="meeting-original"><summary>元メモを見る</summary><div>${displayMultiline(m.rawMemo||'')}</div></details></article>`,'note-viewer');$('#closeViewer').onclick=closeModal;$('#editViewer').onclick=()=>openQuickNote(n);$('#deleteViewer').onclick=()=>confirmDeleteNote(n.id);$$('[data-meeting-action]').forEach(x=>x.onchange=()=>{m.aiMinutes.actions[Number(x.dataset.meetingAction)].done=x.checked;save();render()});$('#generateMeetingAI').onclick=async()=>{const b=$('#generateMeetingAI');b.disabled=true;b.textContent='Geminiが整理中…';try{const generated=await generateMeetingMinutes(m.rawMemo||'',n.title||'',n.date||'');m.aiMinutes={...generated,createdAt:nowISO()};n.text=meetingText(m);n.updatedAt=nowISO();save();toast('AI議事録を作成しました');openMeetingViewer(n)}catch(e){state.ai.lastError=e.message||'AI議事録作成に失敗';save();toast('AI議事録の作成に失敗しました')}};if($('#reviseMeetingAI'))$('#reviseMeetingAI').onclick=async()=>{const inst=$('#meetingReviseInput').value.trim();if(!inst)return toast('修正内容を入力してください');try{const revised=await reviseMeetingMinutes(n,inst);m.aiMinutes={...revised,createdAt:nowISO()};n.text=meetingText(m);n.updatedAt=nowISO();save();toast('議事録を修正しました');openMeetingViewer(n)}catch(e){toast('議事録の修正に失敗しました')}};if($('#applyMeetingTasks'))$('#applyMeetingTasks').onclick=()=>{let c=0;$$('[data-meeting-action]:checked').forEach(x=>{const a=m.aiMinutes.actions[Number(x.dataset.meetingAction)];if(a.applied)return;if(!state.tasks.some(t=>t.title===a.title&&t.date===(a.dueDate||n.date))){state.tasks.push({id:uid(),title:a.title,date:a.dueDate||n.date||isoDate(new Date()),done:false,createdAt:nowISO(),auto:false,timing:'終日',priority:'中',assignee:a.owner||'',sourceMeetingId:n.id})}a.applied=true;c++});save();toast(c?`${c}件をタスク登録しました`:'新しく登録するタスクはありません');openMeetingViewer(n)};if($('#applyMeetingStaff'))$('#applyMeetingStaff').onclick=()=>{let c=0;$$('[data-meeting-staff-note]:checked').forEach(x=>{const sn=m.aiMinutes.staffNotes[Number(x.dataset.meetingStaffNote)];if(sn.applied)return;const mem=staffMemberByName(sn.staffName);if(!mem)return;if(!state.notes.some(nn=>nn.type==='staff'&&nn.sourceMeetingId===n.id&&nn.staffId===mem.id&&nn.text===sn.text)){state.notes.push({id:uid(),text:sn.text,type:'staff',date:n.date||isoDate(new Date()),staff:mem.name,staffId:mem.id,sourceMeetingId:n.id,pinned:false,archived:false,createdAt:nowISO(),updatedAt:nowISO()})}sn.applied=true;c++});save();toast(c?`${c}件をスタッフ記録へ反映しました`:'新しく反映する記録はありません');openMeetingViewer(n)}}
function getGeminiApiKey(){return localStorage.getItem(GEMINI_KEY_STORE)||''}
function setGeminiApiKey(value){const key=(value||'').trim();if(key)localStorage.setItem(GEMINI_KEY_STORE,key);else localStorage.removeItem(GEMINI_KEY_STORE)}
function aiSystemInstruction(isChat){return [
 'あなたはWORKNOTE専用のAI副店長メンターです。回答は日本語で具体的にしてください。通常会話は簡潔でよいですが、日報育成・週次育成では必要な分析を短縮しないでください。',
 '確認できない事実を作らず、記録にない人物・数字・期限を断定しないでください。',
 '顧客の個人情報は出力しないでください。スタッフへの人格評価ではなく、記録された行動と傾向だけを扱ってください。',
 'スタッフへの指示や既存データの削除・変更は勝手に確定しないでください。ただしユーザーが新しい施策・割引・端末発売・予約期間をカレンダーへ登録するよう明示した場合は、create_calendar_events を返して登録できます。',
 isChat?'通常の会話は短く回答してください。カレンダー登録を明示された場合だけ、期間を読み取り create_calendar_events を返してください。':'優先順位、期限超過、日報改善、MTGの抜け、スタッフ育成のうち必要なものだけを返してください。'
].join('\n')}
const AI_CHAT_SCHEMA={type:'OBJECT',properties:{reply:{type:'STRING'},action:{type:'STRING',enum:['chat','create_calendar_events']},calendarEvents:{type:'ARRAY',maxItems:10,items:{type:'OBJECT',properties:{title:{type:'STRING'},category:{type:'STRING',enum:['campaign','discount','device','reservation','other']},startDate:{type:'STRING'},endDate:{type:'STRING'},detail:{type:'STRING'}},required:['title','category','startDate','endDate','detail']}}},required:['reply','action']};
const AI_TEST_SCHEMA={type:'OBJECT',properties:{status:{type:'STRING',enum:['ok']},message:{type:'STRING'}},required:['status','message']};

const MENTOR_EVAL_AREAS=[
 ['sales','個人実績・販売力'],
 ['numbers','数字管理'],
 ['staff','スタッフ育成'],
 ['store','店舗全体を見る力'],
 ['judgment','判断・問題解決'],
 ['communication','報連相・発言'],
 ['priority','時間・優先順位'],
 ['growth','自己成長・訓練']
];
const MENTOR_ISSUE_CATEGORIES=['知識不足','技術不足','経験不足','習慣不足','優先順位ミス','判断ミス','コミュニケーション不足','自信不足','仕組み不足'];
function mentorIssueKey(category,title){
 return `${String(category||'課題').trim()}::${String(title||'').trim().toLowerCase().replace(/\s+/g,' ').slice(0,80)}`
}
function previousDailyReportWithFeedback(date){
 return state.notes.filter(n=>!n.archived&&n.type==='dailyReport'&&n.date<date&&n.aiFeedback).sort((a,b)=>b.date.localeCompare(a.date))[0]||null
}
function recentMentorReports(date,days=7){
 const end=new Date(date+'T12:00:00'),start=new Date(end);start.setDate(start.getDate()-(days-1));
 const min=isoDate(start);
 return state.notes.filter(n=>!n.archived&&n.type==='dailyReport'&&n.date>=min&&n.date<=date).sort((a,b)=>a.date.localeCompare(b.date))
}
function activeMentorIssues(){
 return Object.values(state.ai.mentor?.issues||{}).filter(x=>x.status!=='卒業').sort((a,b)=>(b.recurrence||0)-(a.recurrence||0)).slice(0,12)
}
function mentorContextForReport(n){
 const date=n.date||isoDate(new Date()),prev=previousDailyReportWithFeedback(date),recent=recentMentorReports(date,7);
 const prior=prev?.aiFeedback||{};
 const workMode=workModeForDate(date);
 return {workMode,
  previousReport:prev?{
   date:prev.date,
   topPriority:prior.topPriority||'',
   actionPlan:prior.tomorrowActions||prior.concreteActions||[],
   trainings:prior.trainingPlan||[],
   issues:(prior.issueDiagnosis||[]).map(x=>({category:x.category,title:x.title,status:x.status}))
  }:null,
  activeIssues:activeMentorIssues().map(x=>({category:x.category,title:x.title,recurrence:x.recurrence||1,status:x.status||'継続',lastSeen:x.lastSeen||'',training:x.lastTraining||''})),
  activeMemories:activeMentorMemories(date).map(m=>({key:m.key,category:m.category,scope:m.scope,content:m.content,priority:m.priority,startDate:m.startDate,endDate:m.endDate})),
  recentPattern:recent.slice(0,-1).map(r=>({
   date:r.date,
   goal:r.reportData?.goal||'',
   score:r.reportData?.score||'',
   topPriority:r.aiFeedback?.topPriority||'',
   issues:(r.aiFeedback?.issueDiagnosis||[]).map(x=>`${x.category}:${x.title}:${x.status}`)
  }))
 }
}
function updateMentorStateFromFeedback(n,feedback){
 state.ai.mentor=Object.assign({issues:{},weeklyReviews:[],lastWeeklyAt:''},state.ai.mentor||{});
 state.ai.mentor.issues=state.ai.mentor.issues||{};
 const seen=new Set();
 (feedback.issueDiagnosis||[]).forEach(x=>{
  const key=mentorIssueKey(x.category,x.title);if(!x.title||seen.has(key))return;seen.add(key);
  const old=state.ai.mentor.issues[key]||{key,category:x.category,title:x.title,firstSeen:n.date,recurrence:0};
  const isSameDay=old.lastSeen===n.date;
  const recurrence=isSameDay?(old.recurrence||1):(old.recurrence||0)+1;
  state.ai.mentor.issues[key]={...old,category:x.category,title:x.title,lastSeen:n.date,recurrence,status:x.status||'継続',evidence:x.evidence||'',lastTraining:(feedback.trainingPlan||[]).find(t=>t.issueTitle===x.title)?.title||old.lastTraining||'',graduatedAt:x.status==='卒業'?n.date:''}
 });
}
function trainingRuleExists(title){return state.rules.some(r=>r.title===title&&r.enabled!==false)}
function addMentorTrainingRule(training){
 const base=String(training?.title||'').trim();if(!base)return false;
 const duration=String(training?.duration||'').trim();
 const title=`訓練：${base}${duration?` ${duration}`:''}`;
 if(trainingRuleExists(title))return false;
 state.rules.push({id:uid(),title,enabled:true,scope:'daily',timing:'任意',notify:false,mentorTraining:true,trainingMeasure:training.measure||'',trainingPurpose:training.purpose||''});
 save();return true
}
function mentorEvaluationBadge(v){
 const val=String(v||'?');return `<span class="mentor-grade grade-${esc(val)}">${esc(val)}</span>`
}
function latestWeeklyReview(){return (state.ai.mentor?.weeklyReviews||[]).slice().sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''))[0]||null}

const AI_DAILY_FEEDBACK_SCHEMA={type:'OBJECT',properties:{
 workMode:{type:'STRING',enum:['work','holiday','unknown']},
 overall:{type:'STRING'},
 holidayLearningEvaluation:{type:'STRING'},
 previousCommitmentReview:{type:'STRING'},
 goalEvaluation:{type:'STRING'},
 salesEvaluation:{type:'STRING'},
 deputyManagerEvaluation:{type:'STRING'},
 dayManagement:{type:'STRING'},
 numbers:{type:'STRING'},
 staffManagement:{type:'STRING'},
 communicationEvaluation:{type:'STRING'},
 good:{type:'STRING'},
 issues:{type:'STRING'},
 areaRatings:{type:'ARRAY',maxItems:8,items:{type:'OBJECT',properties:{area:{type:'STRING'},grade:{type:'STRING',enum:['◎','○','△','×','？']},reason:{type:'STRING'}},required:['area','grade','reason']}},
 issueDiagnosis:{type:'ARRAY',maxItems:5,items:{type:'OBJECT',properties:{
  category:{type:'STRING',enum:['知識不足','技術不足','経験不足','習慣不足','優先順位ミス','判断ミス','コミュニケーション不足','自信不足','仕組み不足']},
  title:{type:'STRING'},evidence:{type:'STRING'},hypothesis:{type:'STRING'},impact:{type:'STRING'},
  status:{type:'STRING',enum:['新規','継続','改善','卒業']}
 },required:['category','title','evidence','hypothesis','impact','status']}},
 trainingPlan:{type:'ARRAY',maxItems:4,items:{type:'OBJECT',properties:{
  issueTitle:{type:'STRING'},title:{type:'STRING'},purpose:{type:'STRING'},method:{type:'STRING'},duration:{type:'STRING'},measure:{type:'STRING'},nextLevel:{type:'STRING'}
 },required:['issueTitle','title','purpose','method','duration','measure','nextLevel']}},
 tomorrowActions:{type:'ARRAY',maxItems:4,items:{type:'STRING'}},
 topPriority:{type:'STRING'},
 memoryUpdates:{type:'ARRAY',maxItems:8,items:{type:'OBJECT',properties:{
  action:{type:'STRING',enum:['upsert','archive']},
  key:{type:'STRING'},
  category:{type:'STRING',enum:['店舗目標','今週の重点','店長指示','長期方針','自分のルール','スタッフ育成方針','店舗ルール','その他']},
  scope:{type:'STRING',enum:['month','week','ongoing','date_range']},
  content:{type:'STRING'},priority:{type:'STRING',enum:['high','medium','low']},
  certainty:{type:'STRING',enum:['confirmed','tentative']},
  startDate:{type:'STRING'},endDate:{type:'STRING'}
 },required:['action','key','category','scope','content','priority','certainty','startDate','endDate']}},
 roleupTask:{type:'OBJECT',properties:{
  shouldAssign:{type:'BOOLEAN'},title:{type:'STRING'},reason:{type:'STRING'},focus:{type:'STRING'},productId:{type:'STRING'},difficulty:{type:'STRING',enum:['auto','level1','level2','level3']}
 },required:['shouldAssign','title','reason','focus','productId','difficulty']},
 mentorComment:{type:'STRING'}
},required:['workMode','overall','holidayLearningEvaluation','previousCommitmentReview','goalEvaluation','salesEvaluation','deputyManagerEvaluation','dayManagement','numbers','staffManagement','communicationEvaluation','good','issues','areaRatings','issueDiagnosis','trainingPlan','tomorrowActions','topPriority','memoryUpdates','roleupTask','mentorComment']};
async function requestDailyReportFeedback(n){
 if(state.ai.mode!=='geminiDirect'||!getGeminiApiKey())throw Error('Gemini直接接続を設定してください');
 const data=n.reportData||{},date=n.date||isoDate(new Date()),selfText=selfOnlyReportText(data),metrics=data.metrics||{};
 const monthly=monthlyProgressData(date).filter(x=>x.goal>0).map(x=>({label:x.label,goal:x.goal,actual:x.actual,remain:x.remain,rate:x.rate}));
 const mentor=mentorContextForReport(n),workMode=workModeForDate(date),holidaySignals=holidayReportSignals(data),storeSnapshot=workMode.isHoliday?null:sellNaviAIContext(data);
 const payload={
  date,
  role:'auショップの副店長。副店長としては初心者段階から育成する。個人販売実績でも店舗の基準・トップ水準を目指しつつ、自分の販売だけで店舗管理を失わないこと。',
  todayGoal:data.goal||'',
  todayMetrics:Object.fromEntries(PERFORMANCE_FIELDS.map(([k,l])=>[l,Number(metrics[k]||0)])),
  monthlyGoals:monthly,
  dailyReportSelfText:selfText,
  selfScore:data.score||'',
  tomorrowDraft:(data.next||[]).filter(Boolean),
  workMode,
  holidaySignals,
  storeManagementAction:workMode.isHoliday?'':(data.storeAction||''),
  sellNaviStoreContext:storeSnapshot,
  recentRoleup:roleupRecentSummary(date,14),
  mentorHistory:mentor
 };
 const prompt=`あなたはWORKNOTE専属の「副店長育成AIメンター」です。単なる販売実績コーチではありません。
ユーザーを副店長経験ゼロの段階から、最終的に「店長から任せられ、スタッフから頼られ、個人実績でも店舗の基準になり、数字・育成・判断・報連相・店舗運営を両立できる管理職」へ育ててください。

【最重要方針】
- 日報の数字だけを評価しない。dailyReportSelfTextに書かれた「行ったこと」「1日の流れ」「判断」「発言」「スタッフとの関わり」「できなかったこと」を必ず詳細に読む。

【勤務日 / 休日モードの絶対ルール】
- mentorHistory.workMode および workMode を最優先で確認してください。
- workMode.mode='holiday' の日は「勤務評価」ではなく「自己成長評価」に切り替えてください。
- 休日には、店舗実績の不足、個人販売未達、スタッフへの介入不足、店舗全体を見る力の不足、報連相不足などを「その日にやるべきだった」と評価しないでください。
- 休日に店舗状況欄が空白でも正常です。空白を欠点扱いしないでください。
- 休日は sellNaviStoreContext を評価材料に使わないでください。
- 休日は、日報に実際に書かれた「訓練・学習・振り返り・課題整理・次回出勤準備・自主的に考えたこと」を中心に評価してください。
- 休日でも、日報本文にスタッフ育成・判断・報連相などの明確な証拠がある場合だけ、その領域を評価して構いません。
- 証拠のない管理職領域は必ず「？」とし、低評価にはしないでください。
- 休日の日報は「やったか」だけでなく、「何が変わったか」「どこまでできるようになったか」「次の段階は何か」を評価してください。
- 休日に日報を書かなかった日について、後日の週次分析や日次分析で未実施・怠慢・継続不足などと評価しないでください。
- 休日の日報を自主的に書いたこと自体だけを過剰に褒めず、書かれた学習や訓練の質を具体的に評価してください。
- holidayLearningEvaluation には休日の学習・訓練・振り返りの質を具体的に記述してください。出勤日は空文字で構いません。

- sellNaviStoreContext はセルナビから自動取得した店舗の客観数字です。ユーザーに同じ数字を再入力させない前提です。
- storeManagementAction は、その店舗数字を見て副店長として何を考え、誰にどう伝え、どう動いたかの本人記録です。数字不足そのものより「把握→判断→働きかけ→再確認」が適切だったかを評価してください。
- セルナビ数字を理由にフィードバック全体を販売KPI中心へ戻さないでください。店舗数字は管理職行動を評価するための材料です。
- 「販売スタッフとしての1日」と「副店長としての1日」を分けて評価する。
- 個人販売実績は副店長自身が店舗の基準・トップ水準を目指す前提。ただし自分の接客に入りすぎて店舗管理・育成ができていない場合は明確に指摘する。
- 副店長として、数字確認、店舗全体把握、スタッフ育成、商談フォロー、優先順位、問題初動、店長への報連相、注意・依頼・称賛、任せる判断、終盤の着地確認まで見る。
- 日報に発言内容があれば、必要に応じて「実際にどう言えばよかったか」まで具体化する。
- 「頑張る」「意識する」「自分で考える」「振り返る」だけで終わらせない。必ず実行可能な方法・手順・タイミングに落とす。
- できなかったことは感情論ではなく、知識不足/技術不足/経験不足/習慣不足/優先順位ミス/判断ミス/コミュニケーション不足/自信不足/仕組み不足から原因候補を分類する。
- 原因を断定できない場合は必ず仮説と書く。
- 苦手には実用的な訓練メニューを作る。訓練は「何を・何分/何回・どうやる・何を測る・次の段階」を具体化する。
- 例：縦書き音読が苦手なら「30分読む」だけでなく、視線移動・初見読み・句読点・詰まり回数など改善指標を設け、段階訓練を提案する。
- mentorHistory.previousReport があれば、前回の最優先・行動・訓練が今日の日報に実行結果として現れているかを必ず確認する。記録がない場合は「確認できない」とする。
- activeIssues の recurrence が増えている課題は同じ助言を繰り返さない。再発2回なら訓練を具体化、3回以上なら意識ではなくタスク化・仕組み化を優先する。
- 改善が継続して基準を満たした課題は status=卒業 とし、次の難度へ進める。1回良かっただけで卒業にしない。
- 8領域（個人実績、数字管理、スタッフ育成、店舗全体、判断、報連相、時間優先順位、自己成長）を◎○△×？で評価。ただし材料がない領域は？とし、無理に作らない。
- tomorrowActions は翌勤務でそのまま実行できる行動を最大4つ。topPriorityはその中で最優先1つ。
- mentorCommentは短文化しない。現在の成長段階、何が伸びて何がまだ弱いか、次に何を身につける段階かをメンターとして詳しく説明する。
- 人格否定は禁止。甘い評価も禁止。記録された行動・結果に基づいて厳密に評価する。
- スタッフ名が行頭にあるスタッフ固有記録は本人実績として扱わない。

【継続記憶の抽出ルール】
- 日報に「今月の〜」「今週は〜」「これから〜」「今後〜」「毎日〜」「店長から〜と言われた」など、今後も評価に使うべき明確な目標・方針・指示があれば memoryUpdates に記録してください。
- 「今月」はその日報の暦月末まで。例：2026-08-12の日報で「今月」は endDate=2026-08-31。
- 「今週」は原則その週の日曜まで。
- 「これから」「今後」「毎日」は ongoing とし、endDateは空文字。
- 「8月中」「9/15まで」など明確な期限は date_range。
- 店舗目標・店長指示は原則 high。自分で試したい程度は tentative/low〜medium。
- 一時的な感想や単発の出来事は記憶しない。
- 同じ意味の方針が変更されたら同じ key を使って upsert し、旧内容を置き換えられるようにする。
- mentorHistory.activeMemories にある既存記憶を踏まえ、現在有効な目標・方針・指示に必要な時だけ触れてください。
- 期限切れ記憶は現在評価に使わないでください。

【ROLEUP訓練判断】
- recentRoleup は直近のロープレ結果です。前日にROLEUPを実施していれば、点数だけでなく improve / advice / breakdown を今日のフィードバックへ反映してください。
- 日報の課題が「知識を読むだけ」ではなく、接客会話・質問・説明・クロージング・切り返しなど実践練習で改善すべき場合だけ roleupTask.shouldAssign=true にしてください。
- ROLEUP課題は毎日無理に出さないでください。1つの重点課題に絞ってください。
- productId は device/pixel/money/uq/electric/hikari/support/tablet の中から最も近いもの。難易度は通常 auto、既に同テーマを反復している場合のみ level2/level3 を検討。
- 直近ROLEUPで改善した課題は、次は実商談での定着確認を優先し、同じロープレを惰性的に繰り返させないでください。

【出力モード】
- workMode.mode='holiday' の場合、出力 workMode は必ず holiday。
- workMode.mode='work' の場合、出力 workMode は work。
- シフト未登録など判定不能なら unknown。
- holiday の場合、salesEvaluation / numbers / staffManagement / communicationEvaluation は、その日の本文に証拠がなければ「休日のため評価対象外」または「？」相当の記述にしてください。
- areaRatings では証拠のない項目を grade='？' にしてください。

【今日の入力】
${JSON.stringify(payload)}`;
 const d=await callGeminiDirect({schema:AI_DAILY_FEEDBACK_SCHEMA,input:prompt});
 n.aiFeedback={...d,mentorVersion:2,updatedAt:nowISO()};delete n.aiFeedbackError;
 updateMentorStateFromFeedback(n,n.aiFeedback);
 applyMentorMemoryUpdates(n.aiFeedback.memoryUpdates||[],date);
 state.ai.connectionStatus='接続済み';state.ai.lastError='';save();return d
}


const AI_WEEKLY_MENTOR_SCHEMA={type:'OBJECT',properties:{
 period:{type:'STRING'},overall:{type:'STRING'},
 deputyGrowth:{type:'ARRAY',maxItems:6,items:{type:'STRING'}},
 managementRatings:{type:'ARRAY',maxItems:8,items:{type:'OBJECT',properties:{area:{type:'STRING'},grade:{type:'STRING',enum:['◎','○','△','×','？']},reason:{type:'STRING'}},required:['area','grade','reason']}},
 recurringIssues:{type:'ARRAY',maxItems:6,items:{type:'STRING'}},
 dayUseAnalysis:{type:'STRING'},
 staffDevelopmentAnalysis:{type:'STRING'},
 judgmentCommunicationAnalysis:{type:'STRING'},
 trainingEffect:{type:'ARRAY',maxItems:5,items:{type:'STRING'}},
 graduated:{type:'ARRAY',maxItems:5,items:{type:'STRING'}},
 nextWeekSkills:{type:'ARRAY',maxItems:2,items:{type:'OBJECT',properties:{skill:{type:'STRING'},reason:{type:'STRING'},practice:{type:'STRING'},measure:{type:'STRING'}},required:['skill','reason','practice','measure']}},
 mentorComment:{type:'STRING'}
},required:['period','overall','deputyGrowth','managementRatings','recurringIssues','dayUseAnalysis','staffDevelopmentAnalysis','judgmentCommunicationAnalysis','trainingEffect','graduated','nextWeekSkills','mentorComment']};
async function requestWeeklyMentorReview(date=isoDate(new Date())){
 if(state.ai.mode!=='geminiDirect'||!getGeminiApiKey())throw Error('Gemini直接接続を設定してください');
 const reports=recentMentorReports(date,7);
 if(reports.length<2)throw Error('直近7日の日報が2日分以上必要です');
 const compact=reports.map(n=>({
  date:n.date,
  goal:n.reportData?.goal||'',
  selfText:selfOnlyReportText(n.reportData||{}).slice(0,2600),
  workMode:workModeForDate(n.date),
  storeManagementAction:workModeForDate(n.date).isHoliday?'':(n.reportData?.storeAction||''),
  feedback:n.aiFeedback?{
   previousCommitmentReview:n.aiFeedback.previousCommitmentReview||'',
   deputyManagerEvaluation:n.aiFeedback.deputyManagerEvaluation||'',
   dayManagement:n.aiFeedback.dayManagement||'',
   staffManagement:n.aiFeedback.staffManagement||'',
   communicationEvaluation:n.aiFeedback.communicationEvaluation||'',
   areaRatings:n.aiFeedback.areaRatings||[],
   issues:n.aiFeedback.issueDiagnosis||[],
   trainings:n.aiFeedback.trainingPlan||[],
   tomorrowActions:n.aiFeedback.tomorrowActions||[],
   topPriority:n.aiFeedback.topPriority||'',
   mentorComment:n.aiFeedback.mentorComment||''
  }:null
 }));
 const input=`あなたはWORKNOTE専属の副店長育成AIメンターです。
これは販売実績レポートではありません。
休日（OFF・希望休）の日は勤務評価しないでください。休日の日報がある場合は学習・訓練・振り返り・次回準備のみを評価対象とし、日報がない休日は完全に無視してください。休日に店舗管理やスタッフ介入をしていないことを課題として扱わないでください。直近7日を使って「副店長としてどこまで成長したか」を育成面談レベルで分析してください。

【最重要】
- 主役は管理職としての成長です。販売件数・売上・商材獲得を週次総括の主テーマにしないでください。
- 個人販売力は「副店長自身が店舗の基準になれているか」を見る8領域の一要素にすぎません。販売目標の件数アップを nextWeekSkills の中心にしないでください。
- 日報本文にある1日の流れ、店舗全体を見る時間、数字確認、スタッフへの声掛け・育成、商談フォロー、任せる判断、問題初動、店長への報連相、注意・依頼・称賛、時間配分を中心に分析してください。
- 日次AIが前日に出した課題・最優先・訓練が翌日の日報でどうなったかを時系列で追ってください。
- 同じ課題が再発している場合は、知識・技術・経験・習慣・優先順位・判断・コミュニケーション・自信・仕組みのどこに問題がありそうかを考え、単なる「意識しましょう」にしないでください。
- trainingEffect は、訓練を「実施したか」ではなく「能力が改善したか」を評価してください。日報から確認できない場合は確認不可としてください。
- nextWeekSkills は1〜2個だけ。GOLD○件、Pixel○台など販売KPIそのものではなく、「管理職能力」を選んでください。
  例：店舗全体を定時確認する習慣、スタッフへの具体指示、任せる力、注意・称賛の伝え方、問題初動、報連相、優先順位判断。
- practice は次週に実際に行う訓練・行動を具体化し、measure は達成判定方法を書いてください。
- 販売成績が管理職行動に影響している場合のみ補足材料として触れてよいですが、独立した販売実績評価は不要です。
- 精神論ではなく、記録された行動から厳密に判断してください。

${JSON.stringify({reports:compact,activeIssues:activeMentorIssues(),activeMemories:activeMentorMemories(date),roleup:roleupRecentSummary(date,7)})}`;
 const d=await callGeminiDirect({schema:AI_WEEKLY_MENTOR_SCHEMA,input});
 const review={...d,mentorWeeklyVersion:2,createdAt:nowISO(),endDate:date};
 state.ai.mentor.weeklyReviews=(state.ai.mentor.weeklyReviews||[]).filter(x=>x.endDate!==date);
 state.ai.mentor.weeklyReviews.push(review);state.ai.mentor.lastWeeklyAt=review.createdAt;
 state.ai.lastError='';save();return review
}
function weeklyMentorHTML(r){
 if(!r)return '<div class="empty">まだ週次総括はありません。</div>';
 if(!r.mentorWeeklyVersion){
  return `<article class="weekly-mentor-review"><header><span class="tag">旧週次分析</span><h2>${esc(r.period||'メンター総括')}</h2></header><section><h3>以前の分析</h3><p>この結果は旧方式です。下のボタンから「副店長育成中心」で再分析してください。</p></section></article>`
 }
 return `<article class="weekly-mentor-review"><header><span class="tag">副店長育成・直近7日</span><h2>${esc(r.period||'メンター総括')}</h2></header>
 <section><h3>副店長としての総合評価</h3><p>${displayMultiline(r.overall||'')}</p></section>
 <section><h3>今週できるようになったこと</h3><ul>${(r.deputyGrowth||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section>
 ${(r.managementRatings||[]).length?`<section><h3>管理職8領域</h3><div class="mentor-rating-list">${r.managementRatings.map(x=>`<div><div>${mentorEvaluationBadge(x.grade)}<strong>${esc(x.area)}</strong></div><p>${esc(x.reason)}</p></div>`).join('')}</div></section>`:''}
 <section><h3>1日の使い方・優先順位</h3><p>${displayMultiline(r.dayUseAnalysis||'')}</p></section>
 <section><h3>スタッフ育成・店舗全体を見る力</h3><p>${displayMultiline(r.staffDevelopmentAnalysis||'')}</p></section>
 <section><h3>判断・報連相・発言</h3><p>${displayMultiline(r.judgmentCommunicationAnalysis||'')}</p></section>
 <section><h3>繰り返している課題</h3><ul>${(r.recurringIssues||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section>
 <section><h3>訓練の効果</h3><ul>${(r.trainingEffect||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section>
 ${(r.graduated||[]).length?`<section><h3>卒業できた課題</h3><ul>${r.graduated.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section>`:''}
 <section class="weekly-focus"><h3>来週鍛える管理職能力</h3>${(r.nextWeekSkills||[]).map(x=>`<article class="weekly-skill"><strong>${esc(x.skill)}</strong><p><b>理由：</b>${esc(x.reason)}</p><p><b>実践：</b>${esc(x.practice)}</p><p><b>判定：</b>${esc(x.measure)}</p></article>`).join('')}</section>
 <section><h3>メンターコメント</h3><p>${displayMultiline(r.mentorComment||'')}</p></section>
 </article>`
}
function openWeeklyMentorReview(){
 const r=latestWeeklyReview(),err=state.ai.weeklyMentorError||'';
 openModal(`<div class="viewer-head"><button class="secondary" id="backWeeklyMentor">‹ AI</button><button class="secondary" id="closeWeeklyMentor">閉じる</button></div>${err?`<div class="mentor-ai-error"><strong>週次分析できませんでした</strong><p>${esc(err)}</p></div>`:''}${weeklyMentorHTML(r)}<button class="primary" id="generateWeeklyMentor" style="width:100%">${r?'副店長育成として再分析':'直近7日を育成総括する'}</button>`,'note-viewer');
 $('#backWeeklyMentor').onclick=()=>{closeModal();switchView('ai')};$('#closeWeeklyMentor').onclick=closeModal;
 $('#generateWeeklyMentor').onclick=async()=>{
  const b=$('#generateWeeklyMentor');b.disabled=true;b.textContent='副店長としての7日間を分析中…';
  try{await requestWeeklyMentorReview();delete state.ai.weeklyMentorError;save();toast('副店長育成総括を更新しました');openWeeklyMentorReview()}
  catch(e){const msg=friendlyGeminiError(e,e?.status||0);state.ai.weeklyMentorError=msg;state.ai.lastError=msg;save();openWeeklyMentorReview()}
 }
}


function friendlyGeminiError(err,status=0){
 const raw=String(err?.message||err||'');
 const low=raw.toLowerCase();
 if(status===429||low.includes('resource_exhausted')||low.includes('quota'))return 'Geminiの利用が集中しているか、利用上限に達しています。少し時間を置いてから再試行してください。';
 if(status===503||low.includes('high demand')||low.includes('overloaded')||low.includes('unavailable'))return '現在Geminiが混雑しています。一時的なものなので、少し時間を置いて再試行してください。';
 if(status===401||status===403||low.includes('api key')||low.includes('permission'))return 'Gemini APIキーまたは接続権限を確認してください。';
 if(low.includes('failed to fetch')||low.includes('network'))return 'Geminiへ接続できませんでした。通信状態を確認して再試行してください。';
 if(low.includes('json'))return 'Geminiの回答形式を読み取れませんでした。もう一度再分析してください。';
 return raw&&raw.length<180?raw:'Geminiの処理に失敗しました。少し時間を置いて再試行してください。'
}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}

async function callGeminiDirect({input,schema,isChat=false}){
 const apiKey=getGeminiApiKey();if(!apiKey)throw Error('Gemini APIキーが未入力です');
 const model=state.ai.model||DEFAULT_GEMINI_MODEL;
 const url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
 let lastErr=null;
 for(let attempt=0;attempt<2;attempt++){
  try{
   const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},body:JSON.stringify({systemInstruction:{parts:[{text:aiSystemInstruction(isChat)}]},contents:[{role:'user',parts:[{text:input}]}],generationConfig:{responseMimeType:'application/json',responseSchema:schema}})});
   const data=await res.json().catch(()=>({}));
   if(!res.ok){
    const e=Error(friendlyGeminiError(data?.error?.message||`Gemini APIエラー（${res.status}）`,res.status));e.status=res.status;throw e
   }
   const text=(data?.candidates?.[0]?.content?.parts||[]).map(x=>x.text||'').join('').trim();
   if(!text)throw Error('Geminiから回答が返りませんでした');
   try{return JSON.parse(text)}catch{throw Error('Geminiの回答形式を読み取れませんでした。もう一度再分析してください。')}
  }catch(e){
   lastErr=e;
   const transient=e?.status===429||e?.status===503||/混雑|集中|一時的/.test(String(e.message||''));
   if(attempt===0&&transient){await sleep(1200);continue}
   throw Error(friendlyGeminiError(e,e?.status||0))
  }
 }
 throw Error(friendlyGeminiError(lastErr,lastErr?.status||0))
}
function openAIDashboard(){closeModal();switchView('ai')}
function openAIChat(){
 openModal(`<div class="viewer-head"><button class="secondary" id="backAI">戻る</button><h3>AIチャット</h3></div><div class="ai-chat-log">${state.ai.chat.slice(-30).map(x=>`<div class="chat-bubble ${x.role}">${displayMultiline(x.text)}</div>`).join('')}</div><div class="field"><textarea id="aiChatInput" placeholder="例：8月10日から31日までPixel予約キャンペーン。カレンダーに入れて"></textarea></div><div class="field"><label>反映範囲</label><select id="aiMemoryScope"><option value="once">今回だけ</option><option value="theme">このテーマで今後も</option><option value="global">全体ルールとして保存</option></select></div><button class="primary" id="sendAIChat" style="width:100%">送信</button>`, 'note-viewer');
 $('#backAI').onclick=openAIDashboard;
 $('#sendAIChat').onclick=async()=>{
  const text=$('#aiChatInput').value.trim();if(!text)return;
  const scope=$('#aiMemoryScope').value;
  state.ai.chat.push({role:'user',text,at:nowISO()});save();openAIChat();
  if(state.ai.mode!=='geminiDirect'||!getGeminiApiKey()){
   state.ai.chat.push({role:'assistant',text:'AIチャットとカレンダー自動登録にはGemini直接接続が必要です。設定からGemini APIキーを確認してください。',at:nowISO()});save();return openAIChat();
  }
  try{
   const today=isoDate(new Date());
   const d=await callGeminiDirect({isChat:true,schema:AI_CHAT_SCHEMA,input:`今日は${today}です。ユーザーの依頼を判断してください。\n通常の質問・相談なら action は chat。\n施策、割引、端末発売、予約開始などをカレンダーへ入れるよう明示された場合だけ action を create_calendar_events にし、calendarEvents を作成してください。1つの依頼に予約開始日と発売日など複数の予定が含まれる場合は、それぞれ別イベントにしてください。\n「今日」「明日」「今月末」「8/10」などは今日を基準に YYYY-MM-DD へ変換してください。終了日の指定がなければ開始日と同日にしてください。\ncategory は campaign=施策、discount=割引、device=端末発売、reservation=予約、other=その他。\n個人情報はcalendarEventsに含めないでください。\n${JSON.stringify({message:text,scope,rules:state.ai.rules})}`});
   let reply=d.reply||'了解しました。';
   if(d.action==='create_calendar_events'&&Array.isArray(d.calendarEvents)&&d.calendarEvents.length){
    const results=d.calendarEvents.map(x=>addAIPeriodEvent(x,text)),added=results.filter(x=>x.ok&&!x.duplicate),duplicates=results.filter(x=>x.ok&&x.duplicate),failed=results.filter(x=>!x.ok);
    const lines=added.map(x=>`✓ ${eventCategoryLabel(x.event.category)}：${x.event.title}（${eventRangeLabel(x.event)}）`);
    if(duplicates.length)lines.push(`重複のため追加なし：${duplicates.length}件`);
    if(failed.length)lines.push(`登録できなかった予定：${failed.length}件`);
    reply=`${reply}\n\n${lines.join('\n')}`;
   }else if(scope!=='once'){
    state.ai.rules.push({id:uid(),scope,text,createdAt:nowISO()});
   }
   state.ai.connectionStatus='接続済み';state.ai.lastError='';state.ai.chat.push({role:'assistant',text:reply,at:nowISO()});save();openAIChat();
  }catch(e){
   state.ai.connectionStatus='接続失敗';state.ai.lastError=e.message||'Gemini接続に失敗しました';state.ai.chat.push({role:'assistant',text:'Gemini接続に失敗したため、今回はカレンダーへ登録していません。',at:nowISO()});save();openAIChat();
  }
 }
}

function openAIRules(){openModal(`<h2>AIが覚えているルール</h2>${state.ai.rules.map(x=>`<div class="card rule-memory"><div><span class="tag">${x.scope==='global'?'全体':x.scope==='theme'?'テーマ':'今回'}</span><p>${esc(x.text)}</p></div><button class="danger" data-del-rule="${x.id}">削除</button></div>`).join('')||'<div class="empty">保存されたルールはありません</div>'}<button class="secondary" id="backAI" style="width:100%">戻る</button>`);$('#backAI').onclick=openAIDashboard;$$('[data-del-rule]').forEach(b=>b.onclick=()=>{state.ai.rules=state.ai.rules.filter(x=>x.id!==b.dataset.delRule);save();openAIRules()})}
function openAISettings(){const hasKey=!!getGeminiApiKey();openModal(`<h2>AI副店長メンター</h2><div class="card"><strong>API利用方針</strong><div class="small">GeminiはAIチャット・カレンダー登録・スタッフ分析更新・接続テスト・日報保存時の育成フィードバック・手動の週次メンター総括で呼び出します。対応候補の自動生成は行いません。</div></div><div class="field"><label>動作モード</label><select id="aiMode"><option value="local">端末内分析（Geminiは手動機能のみ）</option><option value="geminiDirect">Gemini直接接続</option></select></div><div class="field"><label>Gemini APIキー</label><input id="geminiApiKey" type="password" autocomplete="off" placeholder="AIza..." value=""><div class="small">${hasKey?'APIキーはこの端末に保存済みです。変更時だけ再入力してください。':'Google AI Studioで作成したAPIキーを入力してください。'} GitHubには保存されません。</div></div><div class="field"><label>モデル</label><select id="geminiModel"><option value="gemini-3.1-flash-lite">Gemini 3.1 Flash-Lite（推奨）</option><option value="gemini-3.5-flash">Gemini 3.5 Flash</option></select></div><div class="danger-note">直接接続ではAPIキーをこの端末のブラウザ内に保存します。共有端末では使用しないでください。</div><div class="card"><strong>接続状態</strong><div class="small">${esc(state.ai.mode==='geminiDirect'?(state.ai.connectionStatus||'未接続'):'端末内分析')}${state.ai.model?`・${esc(state.ai.model)}`:''}</div>${state.ai.lastError?`<div class="warning">${esc(state.ai.lastError)}</div>`:''}</div><div class="btn-row"><button class="secondary" id="testAIConnection">接続だけテスト</button><button class="primary" id="saveAISettings">保存</button></div>`);$('#aiMode').value=state.ai.mode;$('#geminiModel').value=state.ai.model||DEFAULT_GEMINI_MODEL;const readSettings=()=>{state.ai.mode=$('#aiMode').value;state.ai.model=$('#geminiModel').value;state.ai.endpoint='';const entered=$('#geminiApiKey').value.trim();if(entered)setGeminiApiKey(entered);save()};$('#testAIConnection').onclick=async()=>{readSettings();if(state.ai.mode!=='geminiDirect')return toast('Gemini直接接続を選択してください');if(!getGeminiApiKey())return toast('Gemini APIキーを入力してください');const button=$('#testAIConnection');button.disabled=true;button.textContent='接続確認中…';try{const d=await callGeminiDirect({input:'接続確認として status に ok、message に 接続できました を入れてください。',schema:AI_TEST_SCHEMA});state.ai.connectionStatus='接続済み';state.ai.lastError='';save();toast(d.message||'Geminiへの接続を確認しました');openAISettings()}catch(e){state.ai.connectionStatus='接続失敗';state.ai.lastError=e.message||'接続に失敗しました';save();toast('接続に失敗しました');openAISettings()}};$('#saveAISettings').onclick=()=>{readSettings();if(state.ai.mode==='geminiDirect'&&!getGeminiApiKey())return toast('Gemini APIキーを入力してください');closeModal();render();toast('AI設定を保存しました')}}

function switchView(v){currentView=v;render();window.scrollTo(0,0)}
function openModal(html,mode='default'){const modal=$('#modal');modal.classList.toggle('note-editor-modal',mode==='note-editor');modal.classList.toggle('note-viewer-modal',mode==='note-viewer');$('#modalContent').innerHTML=html;modal.classList.remove('hidden')}
function closeModal(){const modal=$('#modal');modal.classList.add('hidden');modal.classList.remove('note-editor-modal','note-viewer-modal');$('#modalContent').innerHTML=''}
function globalSearch(){openModal(`<h2>検索</h2><div class="field"><input id="globalQ" placeholder="メモ・タスク・予定を検索"></div><div id="searchResults"></div>`);$('#globalQ').oninput=e=>{const q=e.target.value.trim().toLowerCase();if(!q)return $('#searchResults').innerHTML='';const notes=state.notes.filter(n=>(n.text||'').toLowerCase().includes(q)||(n.title||'').toLowerCase().includes(q)).slice(0,10),tasks=state.tasks.filter(t=>t.title.toLowerCase().includes(q)).slice(0,10),events=state.events.filter(x=>x.title.toLowerCase().includes(q)).slice(0,10);$('#searchResults').innerHTML=[...notes.map(n=>`<div class="card"><strong>メモ</strong><div>${esc(noteDisplayTitle(n))}</div><div class="small">${n.date}</div></div>`),...tasks.map(t=>`<div class="card"><strong>${t.done?'✓ ':''}タスク</strong><div>${esc(t.title)}</div><div class="small">${t.date}</div></div>`),...events.map(x=>`<div class="card"><strong>予定</strong><div>${esc(x.title)}</div><div class="small">${eventRangeLabel(x)||x.date}</div></div>`)].join('')||'<div class="empty">見つかりません</div>'}}
async function openAppUpdate(){
 openModal(`<h2>アプリ更新</h2><div class="card"><strong>現在のバージョン</strong><div class="small">v${APP_VERSION}</div></div><p class="small">新しいバージョンが公開されているか確認します。メモやタスクのデータは消えません。</p><button class="primary" id="checkUpdateBtn" style="width:100%">最新版を確認</button>`);
 $('#checkUpdateBtn').onclick=async()=>{
  const button=$('#checkUpdateBtn');button.disabled=true;button.textContent='確認中…';
  try{
   if(!('serviceWorker' in navigator))throw new Error('unsupported');
   const registration=swRegistration || await navigator.serviceWorker.getRegistration('./');
   if(!registration)throw new Error('not-registered');
   await registration.update();
   const waiting=registration.waiting;
   if(waiting){button.textContent='更新しています…';waiting.postMessage({type:'SKIP_WAITING'});return;}
   if(registration.installing){
    button.textContent='更新を準備中…';
    registration.installing.addEventListener('statechange',()=>{
     if(registration.waiting)registration.waiting.postMessage({type:'SKIP_WAITING'});
     else if(registration.installing?.state==='activated'){updateReloading=true;location.reload();}
    });
    return;
   }
   button.textContent='最新版です';toast('WORKNOTEは最新版です');
  }catch(error){console.error('Update check failed:',error);button.disabled=false;button.textContent='もう一度確認';toast('更新確認に失敗しました');}
 };
}
function watchServiceWorker(registration){
 swRegistration=registration;
 registration.addEventListener('updatefound',()=>{
  const worker=registration.installing;if(!worker)return;
  worker.addEventListener('statechange',()=>{
   if(worker.state==='installed' && navigator.serviceWorker.controller)toast('新しい更新を利用できます');
  });
 });
}
navigator.serviceWorker?.addEventListener('controllerchange',()=>{
 if(updateReloading)return;updateReloading=true;location.reload();
});
$$('.bottom-nav button').forEach(b=>b.onclick=()=>switchView(b.dataset.view));$('#quickAdd').onclick=()=>openQuickNote();$('#searchBtn').onclick=globalSearch;$('#modal').onclick=e=>{if(e.target===$('#modal'))closeModal()};
function startApp(){
 try{
  $('#splash')?.classList.add('hidden');
  $('#app')?.classList.remove('hidden');
  render();
  checkTaskNotifications();
  const params=new URLSearchParams(location.search);
  if(params.get('action')==='quick-note')openQuickNote();if(params.get('action')==='daily-report'){const date=params.get('date')||isoDate(new Date());const existing=state.notes.find(n=>n.type==='dailyReport'&&n.date===date);openQuickNote(existing||null);setTimeout(()=>{if(!existing&&$('#noteType')){$('#noteType').value='dailyReport';$('#noteDate').value=date;$('#noteType').dispatchEvent(new Event('change'))}},50)}
  if(params.get('view')&&['home','notes','calendar','ai','settings'].includes(params.get('view')))switchView(params.get('view'));
 }catch(error){
  console.error('WORKNOTE startup failed:',error);
  const splash=$('#splash');
  if(splash){splash.innerHTML='<h1>WORKNOTE</h1><p>起動処理で問題が発生しました。ページを再読み込みしてください。</p><button onclick="location.reload()">再読み込み</button>';}
 }
}

document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')checkTaskNotifications()});
setInterval(checkTaskNotifications,30000);
window.addEventListener('load',()=>{
 setTimeout(startApp,250);
 if('serviceWorker' in navigator){
  navigator.serviceWorker.register('./sw.js', {scope:'./',updateViaCache:'none'})
   .then(async registration=>{
    watchServiceWorker(registration);
    try{await registration.update()}catch(error){console.warn('Service Worker update failed:',error)}
   })
   .catch(error=>console.error('Service Worker registration failed:',error));
 }
});


let worknoteRestoringHistory=false;
function worknotePushRoute(route){if(worknoteRestoringHistory)return;try{history.pushState({worknoteRoute:route},'',location.href)}catch{}}
function worknoteHideModal(){const modal=$('#modal');if(modal){modal.classList.add('hidden');modal.classList.remove('note-editor-modal','note-viewer-modal');if($('#modalContent'))$('#modalContent').innerHTML=''}}
function worknoteRestoreRoute(route){worknoteRestoringHistory=true;worknoteHideModal();try{if(!route||route.type==='view'){currentView=route?.view||'home';render();window.scrollTo(0,0)}else if(route.type==='noteViewer')openNoteViewer(route.id);else if(route.type==='reportViewer'){const n=state.notes.find(x=>x.id===route.id);if(n)openReportViewer(n)}else if(route.type==='meetingViewer'){const n=state.notes.find(x=>x.id===route.id);if(n)openMeetingViewer(n)}else if(route.type==='noteEdit'){const n=route.id?state.notes.find(x=>x.id===route.id):null;openQuickNote(n||null);if(route.noteType&&$('#noteType')){$('#noteType').value=route.noteType;$('#noteType').dispatchEvent(new Event('change'))}}else if(route.type==='staffDirectory')openStaffDirectory();else if(route.type==='staffReport')openStaffReport(route.id);else if(route.type==='performance')openPerformanceDashboard(route.month||null);else if(route.type==='performanceDay')openPerformanceDay(route.date,route.month||null);else if(route.type==='metricDetail')openMetricProgressDetail(route.key,route.date||isoDate(new Date()));else{currentView='home';render()}}finally{setTimeout(()=>worknoteRestoringHistory=false,0)}}
window.addEventListener('popstate',e=>worknoteRestoreRoute(e.state?.worknoteRoute||{type:'view',view:'home'}));
try{history.replaceState({worknoteRoute:{type:'view',view:currentView||'home'}},'',location.href)}catch{}
const __switchView_v26=switchView;switchView=function(v){__switchView_v26(v);worknotePushRoute({type:'view',view:v})};
const __closeModal_v26=closeModal;closeModal=function(){if(!worknoteRestoringHistory&&history.state?.worknoteRoute?.type&&history.state.worknoteRoute.type!=='view'){history.back();return}__closeModal_v26()};
const __openNoteViewer_v26=openNoteViewer;openNoteViewer=function(id){__openNoteViewer_v26(id);worknotePushRoute({type:'noteViewer',id})};
const __openReportViewer_v26=openReportViewer;openReportViewer=function(n){__openReportViewer_v26(n);worknotePushRoute({type:'reportViewer',id:n?.id})};
const __openMeetingViewer_v26=openMeetingViewer;openMeetingViewer=function(n){__openMeetingViewer_v26(n);worknotePushRoute({type:'meetingViewer',id:n?.id})};
const __openQuickNote_v26=openQuickNote;openQuickNote=function(existing=null){__openQuickNote_v26(existing);worknotePushRoute({type:'noteEdit',id:existing?.id||null,noteType:existing?.type||'inbox'})};
if(typeof openStaffDirectory==='function'){const __openStaffDirectory_v26=openStaffDirectory;openStaffDirectory=function(){__openStaffDirectory_v26();worknotePushRoute({type:'staffDirectory'})}}
if(typeof openStaffReport==='function'){const __openStaffReport_v26=openStaffReport;openStaffReport=function(id){__openStaffReport_v26(id);worknotePushRoute({type:'staffReport',id})}}
if(typeof openPerformanceDashboard==='function'){const __openPerformanceDashboard_v26=openPerformanceDashboard;openPerformanceDashboard=function(targetMonth=null){__openPerformanceDashboard_v26(targetMonth);worknotePushRoute({type:'performance',month:typeof performanceMonthCursor==='string'?performanceMonthCursor:monthKeyFromDate(performanceMonthCursor)})}}
if(typeof openPerformanceDay==='function'){const __openPerformanceDay_v26=openPerformanceDay;openPerformanceDay=function(date,selectedMonth=null){__openPerformanceDay_v26(date,selectedMonth);worknotePushRoute({type:'performanceDay',date,month:selectedMonth||monthKeyFromDate(date)})}}

if(typeof openMetricProgressDetail==='function'){const __openMetricProgressDetail_v28=openMetricProgressDetail;openMetricProgressDetail=function(key,date=isoDate(new Date())){__openMetricProgressDetail_v28(key,date);worknotePushRoute({type:'metricDetail',key,date})}}
