'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const STORE='worknote_state_v1';
const pad=n=>String(n).padStart(2,'0');
const isoDate=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2);
const nowISO=()=>new Date().toISOString();
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const DEFAULT={
 version:1,profile:{name:'ヒガ'},settings:{notifications:false,carryMode:'nextShift',lastBackup:null},
 shiftTypes:[{id:'early',name:'早番',start:'09:30',end:'18:30',color:'#7dc6ff'},{id:'late',name:'遅番',start:'11:00',end:'20:00',color:'#9e8cff'},{id:'full',name:'フル',start:'09:30',end:'20:00',color:'#55c9a5'},{id:'off',name:'休み',start:'',end:'',color:'#aeb9c5'}],
 shifts:{},
 rules:[
  {id:uid(),title:'セルナビ更新',enabled:true,scope:'work',timing:'退勤前',notify:false},
  {id:uid(),title:'クレカ実績更新',enabled:true,scope:'work',timing:'退勤前',notify:false},
  {id:uid(),title:'当日実績確認',enabled:true,scope:'work',timing:'退勤前',notify:false},
  {id:uid(),title:'未完了案件確認',enabled:true,scope:'work',timing:'退勤前',notify:false},
  {id:uid(),title:'予約内容の確認',enabled:true,scope:'early',timing:'出勤時',notify:false}
 ],tasks:[],notes:[],events:[],focus:{},dayClosed:{},trash:[]
};
let state=load(), currentView='home', calCursor=new Date(), selectedDate=isoDate(new Date()), deferredPrompt=null;
function clone(v){return JSON.parse(JSON.stringify(v))}
function load(){try{const x=JSON.parse(localStorage.getItem(STORE));return x?Object.assign(clone(DEFAULT),x):clone(DEFAULT)}catch{return clone(DEFAULT)}}
function save(){localStorage.setItem(STORE,JSON.stringify(state))}
function toast(t){const e=$('#toast');e.textContent=t;e.classList.remove('hidden');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.add('hidden'),1800)}
function formatDate(d){return new Intl.DateTimeFormat('ja-JP',{month:'long',day:'numeric',weekday:'long'}).format(d)}
function shiftByDate(date){const id=state.shifts[date];return state.shiftTypes.find(x=>x.id===id)}
function isWorkShift(s){return s&&s.id!=='off'}
function ensureTasksForDate(date){const shift=shiftByDate(date);if(!isWorkShift(shift))return;
 state.rules.filter(r=>r.enabled&&(r.scope==='work'||r.scope===shift.id||r.scope==='daily')).forEach(r=>{
  const key=`${date}:${r.id}`;
  if(!state.tasks.some(t=>t.autoKey===key))state.tasks.push({id:uid(),title:r.title,date,done:false,createdAt:nowISO(),auto:true,autoKey:key,ruleId:r.id,timing:r.timing,carriedFrom:null});
 });save()}
function reconcileDate(date){const shift=shiftByDate(date);const allowed=new Set();if(isWorkShift(shift))state.rules.filter(r=>r.enabled&&(r.scope==='work'||r.scope===shift.id||r.scope==='daily')).forEach(r=>allowed.add(`${date}:${r.id}`));
 state.tasks=state.tasks.filter(t=>{if(t.date!==date||!t.auto||t.done)return true;if(t.manuallyEdited)return true;return allowed.has(t.autoKey)});ensureTasksForDate(date);save()}
function nextWorkDate(from){let d=new Date(from+'T12:00:00');for(let i=0;i<370;i++){d.setDate(d.getDate()+1);const k=isoDate(d);if(isWorkShift(shiftByDate(k)))return k}return null}
function render(){ensureTasksForDate(isoDate(new Date()));$('#headerDate').textContent=formatDate(new Date());
 const titles={home:'WORKNOTE',notes:'メモ',calendar:'カレンダー',history:'履歴・分析',settings:'設定'};$('#pageTitle').textContent=titles[currentView];
 $$('.view').forEach(v=>v.classList.remove('active'));$(`#view-${currentView}`).classList.add('active');$$('.bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===currentView));
 ({home:renderHome,notes:renderNotes,calendar:renderCalendar,history:renderHistory,settings:renderSettings}[currentView])();
}
function renderHome(){const date=isoDate(new Date()),tasks=state.tasks.filter(t=>t.date===date),done=tasks.filter(t=>t.done).length,notes=state.notes.filter(n=>n.date===date&&!n.archived),reports=notes.filter(n=>n.type==='report').length,shift=shiftByDate(date);
 $('#view-home').innerHTML=`<section class="hero"><div class="hero-row"><div><h2>${greeting()}、${esc(state.profile.name)}さん</h2><p>${formatDate(new Date())}</p></div><div class="shift-pill">${shift?`${esc(shift.name)}${shift.start?` ${shift.start}〜${shift.end}`:''}`:'シフト未登録'}</div></div><div class="stats"><div class="stat"><strong>${done}/${tasks.length}</strong><span>タスク</span></div><div class="stat"><strong>${notes.length}</strong><span>今日のメモ</span></div><div class="stat"><strong>${reports}</strong><span>店長報告</span></div></div></section>
 <section class="section"><div class="section-head"><h2>🎯 今日の重点</h2></div><div class="card focus-card"><textarea id="focusInput" rows="2" placeholder="今日いちばん大切にすること">${esc(state.focus[date]||'')}</textarea></div></section>
 <section class="section"><div class="section-head"><h2>今日のタスク</h2><button class="link-btn" id="addTaskBtn">＋追加</button></div>${tasks.length?tasks.sort((a,b)=>a.done-b.done).map(taskHTML).join(''):'<div class="empty">今日のタスクはありません</div>'}</section>
 <section class="section"><div class="section-head"><h2>未整理メモ</h2><button class="link-btn" data-goto="notes">すべて見る</button></div>${notes.filter(n=>n.type==='inbox').slice(0,3).map(noteHTML).join('')||'<div class="empty">思いついたことを右下の＋からメモできます</div>'}</section>
 <section class="section"><button class="primary" id="closeDayBtn" style="width:100%">本日の業務を終了</button></section>`;
 $('#focusInput').addEventListener('change',e=>{state.focus[date]=e.target.value.trim();save()});$('#addTaskBtn').onclick=()=>openTaskModal(date);$('#closeDayBtn').onclick=()=>openCloseDay(date);$$('[data-goto]').forEach(x=>x.onclick=()=>switchView(x.dataset.goto));bindTaskButtons();bindNoteMenus();}
function greeting(){const h=new Date().getHours();return h<11?'おはようございます':h<17?'こんにちは':'こんばんは'}
function taskHTML(t){return `<div class="card task ${t.done?'done':''}" data-task="${t.id}"><button class="check">${t.done?'✓':''}</button><div><div class="task-title">${esc(t.title)}</div><div class="task-meta">${esc(t.timing||'')} ${t.auto?'・自動':''}${t.carriedFrom?'・繰り越し':''}${t.doneAt?'・'+new Date(t.doneAt).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})+'完了':''}</div></div><button class="more-btn">…</button></div>`}
function bindTaskButtons(){$$('[data-task]').forEach(el=>{const id=el.dataset.task;$('.check',el).onclick=()=>toggleTask(id);$('.more-btn',el).onclick=()=>openTaskMenu(id)})}
function toggleTask(id){const t=state.tasks.find(x=>x.id===id);if(!t)return;t.done=!t.done;t.doneAt=t.done?nowISO():null;save();render();toast(t.done?'完了しました':'未完了に戻しました')}
function openTaskMenu(id){const t=state.tasks.find(x=>x.id===id);openModal(`<h2>${esc(t.title)}</h2><div class="btn-row"><button class="secondary" id="editTask">編集</button><button class="secondary" id="moveTask">日付変更</button><button class="danger" id="deleteTask">削除</button></div>`);$('#editTask').onclick=()=>openTaskModal(t.date,t);$('#moveTask').onclick=()=>openMoveTask(t);$('#deleteTask').onclick=()=>{state.tasks=state.tasks.filter(x=>x.id!==id);save();closeModal();render();toast('削除しました')}}
function openTaskModal(date,t=null){openModal(`<h2>${t?'タスクを編集':'タスクを追加'}</h2><div class="field"><label>内容</label><input id="taskTitle" value="${esc(t?.title||'')}"></div><div class="grid2"><div class="field"><label>日付</label><input id="taskDate" type="date" value="${t?.date||date}"></div><div class="field"><label>タイミング</label><select id="taskTiming"><option>終日</option><option>出勤時</option><option>昼</option><option>退勤前</option></select></div></div><div class="btn-row"><button class="secondary" id="cancel">キャンセル</button><button class="primary" id="saveTask">保存</button></div>`);$('#taskTiming').value=t?.timing||'終日';$('#cancel').onclick=closeModal;$('#saveTask').onclick=()=>{const title=$('#taskTitle').value.trim();if(!title)return toast('内容を入力してください');if(t){t.title=title;t.date=$('#taskDate').value;t.timing=$('#taskTiming').value;t.manuallyEdited=true}else state.tasks.push({id:uid(),title,date:$('#taskDate').value,done:false,createdAt:nowISO(),auto:false,timing:$('#taskTiming').value});save();closeModal();render();toast('保存しました')}}
function openMoveTask(t){openModal(`<h2>タスクを移動</h2><button class="card" id="nextShift" style="width:100%;text-align:left">次回出勤日へ</button><button class="card" id="tomorrow" style="width:100%;text-align:left">明日へ</button><div class="field"><label>日付を指定</label><input type="date" id="moveDate" value="${t.date}"></div><button class="primary" id="moveSave" style="width:100%">移動</button>`);$('#nextShift').onclick=()=>move(nextWorkDate(t.date));$('#tomorrow').onclick=()=>{const d=new Date(t.date+'T12:00:00');d.setDate(d.getDate()+1);move(isoDate(d))};$('#moveSave').onclick=()=>move($('#moveDate').value);function move(date){if(!date)return toast('次の出勤日が未登録です');t.carriedFrom=t.date;t.date=date;save();closeModal();render();toast('移動しました')}}
function openCloseDay(date){const undone=state.tasks.filter(t=>t.date===date&&!t.done);openModal(`<h2>本日の終了確認</h2>${undone.length?`<div class="warning">未完了タスクが${undone.length}件あります。次回出勤日へ繰り越しますか？</div>${undone.map(t=>`<div class="list-row"><span>□</span><div class="grow">${esc(t.title)}</div></div>`).join('')}`:'<div class="card">今日のタスクはすべて完了しています。</div>'}<div class="btn-row"><button class="secondary" id="cancel">戻る</button>${undone.length?'<button class="primary" id="carry">繰り越して終了</button>':'<button class="primary" id="finish">終了する</button>'}</div>`);$('#cancel').onclick=closeModal;const finish=()=>{state.dayClosed[date]=nowISO();save();closeModal();render();toast('本日の記録を保存しました')};if($('#finish'))$('#finish').onclick=finish;if($('#carry'))$('#carry').onclick=()=>{const next=nextWorkDate(date);if(!next)return toast('次の出勤日を先に登録してください');undone.forEach(t=>{t.carriedFrom=t.date;t.date=next});finish()}}
function noteHTML(n){return `<div class="card note-card" data-note="${n.id}"><button class="more-btn note-menu">…</button><h3>${n.pinned?'<span class="pin">★</span> ':''}${esc(n.text)}</h3><div class="note-meta"><span>${new Date(n.createdAt).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</span><span class="tag">${labelType(n.type)}</span>${n.staff?`<span class="tag">${esc(n.staff)}</span>`:''}</div></div>`}
function labelType(t){return({inbox:'受信箱',normal:'通常',report:'店長報告',staff:'スタッフ',fixed:'固定'}[t]||'メモ')}
function renderNotes(){const filter=renderNotes.filter||'all',q=renderNotes.q||'';let notes=state.notes.filter(n=>!n.archived);if(filter!=='all')notes=notes.filter(n=>n.type===filter||(filter==='fixed'&&n.pinned));if(q)notes=notes.filter(n=>n.text.toLowerCase().includes(q.toLowerCase())||(n.staff||'').includes(q));
 $('#view-notes').innerHTML=`<div class="search-box"><input id="noteSearch" placeholder="メモを検索" value="${esc(q)}"></div><div class="chip-row">${[['all','すべて'],['inbox','受信箱'],['fixed','固定'],['report','報告'],['staff','スタッフ']].map(([k,v])=>`<button class="chip ${filter===k?'active':''}" data-filter="${k}">${v}</button>`).join('')}</div><section class="section">${notes.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(noteHTML).join('')||'<div class="empty">該当するメモはありません</div>'}</section>`;
 $('#noteSearch').oninput=e=>{renderNotes.q=e.target.value;renderNotes()};$$('[data-filter]').forEach(b=>b.onclick=()=>{renderNotes.filter=b.dataset.filter;renderNotes()});bindNoteMenus()}
function bindNoteMenus(){$$('[data-note]').forEach(el=>$('.note-menu',el).onclick=()=>openNoteMenu(el.dataset.note))}
function openNoteMenu(id){const n=state.notes.find(x=>x.id===id);openModal(`<h2>メモの操作</h2><div class="list-row"><button class="secondary grow" id="editNote">編集</button></div><div class="list-row"><button class="secondary grow" id="taskify">タスクにする</button></div><div class="list-row"><button class="secondary grow" id="reportify">${n.type==='report'?'通常メモへ戻す':'店長報告に入れる'}</button></div><div class="list-row"><button class="secondary grow" id="pinNote">${n.pinned?'固定を解除':'ホームに固定'}</button></div><div class="list-row"><button class="danger grow" id="archiveNote">アーカイブ</button></div>`);$('#editNote').onclick=()=>openQuickNote(n);$('#taskify').onclick=()=>{state.tasks.push({id:uid(),title:n.text,date:n.date||isoDate(new Date()),done:false,createdAt:nowISO(),auto:false,timing:'終日'});save();closeModal();render();toast('タスクにしました')};$('#reportify').onclick=()=>{n.type=n.type==='report'?'normal':'report';save();closeModal();render();toast('変更しました')};$('#pinNote').onclick=()=>{n.pinned=!n.pinned;save();closeModal();render();};$('#archiveNote').onclick=()=>{n.archived=true;save();closeModal();render();toast('アーカイブしました')}}
function openQuickNote(existing=null){openModal(`<h2>${existing?'メモを編集':'すぐメモ'}</h2><div class="field"><textarea id="quickText" placeholder="何を残しますか？">${esc(existing?.text||'')}</textarea></div><div class="grid2"><div class="field"><label>種類</label><select id="noteType"><option value="inbox">受信箱</option><option value="normal">通常メモ</option><option value="report">店長報告</option><option value="staff">スタッフメモ</option></select></div><div class="field"><label>日付</label><input type="date" id="noteDate" value="${existing?.date||isoDate(new Date())}"></div></div><div class="field" id="staffField"><label>スタッフ名（任意）</label><input id="staffName" value="${esc(existing?.staff||'')}"></div><div class="danger-note">個人情報・電話番号・契約情報は入力しないでください。</div><div class="btn-row"><button class="secondary" id="cancel">キャンセル</button><button class="primary" id="saveNote">保存</button></div>`);$('#noteType').value=existing?.type||'inbox';$('#cancel').onclick=closeModal;setTimeout(()=>$('#quickText').focus(),100);$('#saveNote').onclick=()=>{const text=$('#quickText').value.trim();if(!text)return toast('内容を入力してください');if(existing){existing.text=text;existing.type=$('#noteType').value;existing.date=$('#noteDate').value;existing.staff=$('#staffName').value.trim()}else state.notes.push({id:uid(),text,type:$('#noteType').value,date:$('#noteDate').value,staff:$('#staffName').value.trim(),pinned:false,archived:false,createdAt:nowISO()});save();closeModal();render();toast('メモを保存しました')}}
function renderCalendar(){const y=calCursor.getFullYear(),m=calCursor.getMonth(),first=new Date(y,m,1),start=new Date(y,m,1-first.getDay());let cells='';for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);const key=isoDate(d),shift=shiftByDate(key),tasks=state.tasks.filter(t=>t.date===key),events=state.events.filter(e=>e.date===key);cells+=`<button class="day ${d.getMonth()!==m?'other':''} ${key===isoDate(new Date())?'today':''} ${key===selectedDate?'selected':''}" data-date="${key}"><div class="day-num">${d.getDate()}</div><div class="day-shift">${shift?esc(shift.name):''}</div><div class="day-count">${tasks.length?`✓${tasks.filter(t=>t.done).length}/${tasks.length}`:''}</div>${events.length?'<div class="dots">'+events.slice(0,3).map(()=>'<i class="dot"></i>').join('')+'</div>':''}</button>`}
 const dTasks=state.tasks.filter(t=>t.date===selectedDate),dNotes=state.notes.filter(n=>n.date===selectedDate&&!n.archived),dEvents=state.events.filter(e=>e.date===selectedDate),selShift=shiftByDate(selectedDate);
 $('#view-calendar').innerHTML=`<div class="calendar-head"><button id="prevMonth">‹</button><h2>${y}年${m+1}月</h2><button id="nextMonth">›</button></div><div class="calendar"><div class="weekdays">${'日月火水木金土'.split('').map(x=>`<div>${x}</div>`).join('')}</div><div class="calendar-grid">${cells}</div></div><section class="section day-detail"><div class="section-head"><h2>${selectedDate.replaceAll('-','/')} ${selShift?'・'+selShift.name:''}</h2><button class="link-btn" id="addEvent">＋予定</button></div>${dEvents.map(e=>`<div class="card"><strong>${esc(e.title)}</strong><div class="small">${esc(e.time||'終日')}・予定</div></div>`).join('')}${dTasks.map(taskHTML).join('')}${dNotes.map(noteHTML).join('')||(!dTasks.length&&!dEvents.length?'<div class="empty">この日の記録はありません</div>':'')}</section>`;
 $('#prevMonth').onclick=()=>{calCursor.setMonth(m-1);renderCalendar()};$('#nextMonth').onclick=()=>{calCursor.setMonth(m+1);renderCalendar()};$$('[data-date]').forEach(b=>b.onclick=()=>{selectedDate=b.dataset.date;renderCalendar()});$('#addEvent').onclick=()=>openEventModal(selectedDate);bindTaskButtons();bindNoteMenus()}
function openEventModal(date){openModal(`<h2>予定を追加</h2><div class="field"><label>予定名</label><input id="eventTitle" placeholder="販売開始・会議・提出期限など"></div><div class="grid2"><div class="field"><label>日付</label><input type="date" id="eventDate" value="${date}"></div><div class="field"><label>時間</label><input type="time" id="eventTime"></div></div><div class="btn-row"><button class="secondary" id="cancel">キャンセル</button><button class="primary" id="saveEvent">保存</button></div>`);$('#cancel').onclick=closeModal;$('#saveEvent').onclick=()=>{const title=$('#eventTitle').value.trim();if(!title)return toast('予定名を入力してください');state.events.push({id:uid(),title,date:$('#eventDate').value,time:$('#eventTime').value,createdAt:nowISO()});save();closeModal();render();toast('予定を保存しました')}}
function renderHistory(){const month=isoDate(new Date()).slice(0,7),tasks=state.tasks.filter(t=>t.date.startsWith(month)),done=tasks.filter(t=>t.done),carried=tasks.filter(t=>t.carriedFrom),workDays=Object.entries(state.shifts).filter(([d,s])=>d.startsWith(month)&&s!=='off').length,rate=tasks.length?Math.round(done.length/tasks.length*100):0;
 const byRule=state.rules.map(r=>{const ts=tasks.filter(t=>t.ruleId===r.id);return {name:r.title,total:ts.length,done:ts.filter(t=>t.done).length}}).filter(x=>x.total);
 $('#view-history').innerHTML=`<div class="history-summary"><div class="card"><span class="small">今月の出勤</span><strong>${workDays}日</strong></div><div class="card"><span class="small">タスク実施率</span><strong>${rate}%</strong></div><div class="card"><span class="small">完了タスク</span><strong>${done.length}</strong></div><div class="card"><span class="small">繰り越し</span><strong>${carried.length}</strong></div></div><section class="section"><div class="section-head"><h2>定型タスク実施状況</h2></div>${byRule.map(x=>`<div class="card"><div class="hero-row"><strong>${esc(x.name)}</strong><span>${x.done}/${x.total}</span></div><div class="progress" style="margin-top:10px"><i style="width:${Math.round(x.done/x.total*100)}%"></i></div></div>`).join('')||'<div class="empty">今月の記録はまだありません</div>'}</section><section class="section"><div class="section-head"><h2>最近の完了履歴</h2></div>${done.sort((a,b)=>(b.doneAt||'').localeCompare(a.doneAt||'')).slice(0,20).map(t=>`<div class="card"><strong>✓ ${esc(t.title)}</strong><div class="small">${t.date} ${t.doneAt?new Date(t.doneAt).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'}):''}</div></div>`).join('')}</section>`}
function renderSettings(){$('#view-settings').innerHTML=`<div class="card settings-card" data-setting="shift"><div class="settings-icon">▦</div><div><h3>勤務・シフト</h3><p>月間登録、CSV取込、勤務種類</p></div><button>›</button></div><div class="card settings-card" data-setting="rules"><div class="settings-icon">↻</div><div><h3>自動タスク</h3><p>出勤日ごとの継続業務</p></div><button>›</button></div><div class="card settings-card" data-setting="profile"><div class="settings-icon">✎</div><div><h3>表示・プロフィール</h3><p>名前、表示設定</p></div><button>›</button></div><div class="card settings-card" data-setting="data"><div class="settings-icon">⇩</div><div><h3>データ管理</h3><p>バックアップ、復元、CSV出力</p></div><button>›</button></div><div class="card settings-card" data-setting="notification"><div class="settings-icon">◉</div><div><h3>通知</h3><p>権限と通知設定</p></div><button>›</button></div><div class="danger-note">WORKNOTEは個人用メモです。お客様の氏名・電話番号・契約情報などの個人情報は保存しないでください。</div>`;$$('[data-setting]').forEach(x=>x.onclick=()=>({shift:openShiftSettings,rules:openRules,profile:openProfile,data:openData,notification:openNotifications}[x.dataset.setting])())}
function openShiftSettings(){openModal(`<h2>勤務・シフト</h2><div class="btn-row"><button class="primary" id="csvImport">CSV取込</button><button class="secondary" id="manualShift">手入力</button></div><section class="section"><h3>シフト種類</h3>${state.shiftTypes.map(s=>`<div class="list-row"><i style="width:12px;height:12px;border-radius:50%;background:${s.color}"></i><div class="grow"><strong>${esc(s.name)}</strong><div class="small">${s.start?`${s.start}〜${s.end}`:'休日'}</div></div><button class="secondary" data-edit-shift="${s.id}">編集</button></div>`).join('')}</section><button class="secondary" id="shiftTemplate" style="width:100%;margin-top:10px">CSVテンプレートを保存</button>`);$('#csvImport').onclick=()=>importCSV();$('#manualShift').onclick=()=>openManualShift();$('#shiftTemplate').onclick=downloadShiftTemplate;$$('[data-edit-shift]').forEach(b=>b.onclick=()=>openShiftTypeEdit(b.dataset.editShift))}
function openManualShift(){const month=isoDate(new Date()).slice(0,7);openModal(`<h2>シフトを手入力</h2><div class="field"><label>日付</label><input type="date" id="shiftDate" value="${month}-01"></div><div class="field"><label>勤務</label><select id="shiftType">${state.shiftTypes.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div><div class="btn-row"><button class="secondary" id="cancel">キャンセル</button><button class="primary" id="saveShift">登録</button></div>`);$('#cancel').onclick=closeModal;$('#saveShift').onclick=()=>{const d=$('#shiftDate').value;state.shifts[d]=$('#shiftType').value;reconcileDate(d);closeModal();render();toast('シフトを登録しました')}}
function openShiftTypeEdit(id){const s=state.shiftTypes.find(x=>x.id===id);openModal(`<h2>シフト種類を編集</h2><div class="field"><label>名称</label><input id="stName" value="${esc(s.name)}"></div><div class="grid2"><div class="field"><label>開始</label><input type="time" id="stStart" value="${s.start}"></div><div class="field"><label>終了</label><input type="time" id="stEnd" value="${s.end}"></div></div><div class="field"><label>表示色</label><input type="color" id="stColor" value="${s.color}"></div><button class="primary" id="saveST" style="width:100%">保存</button>`);$('#saveST').onclick=()=>{s.name=$('#stName').value.trim();s.start=$('#stStart').value;s.end=$('#stEnd').value;s.color=$('#stColor').value;save();closeModal();render();toast('保存しました')}}
function importCSV(){const input=$('#fileInput');input.accept='.csv,text/csv';input.onchange=async()=>{const text=await input.files[0].text();const rows=parseCSV(text);if(!rows.length)return toast('CSVを読み込めませんでした');openCSVPreview(rows);input.value=''};input.click()}
function parseCSV(text){const lines=text.replace(/^\uFEFF/,'').trim().split(/\r?\n/);if(lines.length<2)return[];const head=lines[0].split(',').map(x=>x.trim());return lines.slice(1).map(line=>{const vals=line.split(',').map(x=>x.trim());return Object.fromEntries(head.map((h,i)=>[h,vals[i]||'']))}).filter(r=>r.date)}
function openCSVPreview(rows){const normalized=rows.map(r=>{const name=r.shift||r.shift_type||r.type;const st=state.shiftTypes.find(s=>s.name===name||s.id===name);return {date:r.date,shiftId:st?.id||'',name:name||'不明'}});openModal(`<h2>シフト取込プレビュー</h2>${normalized.map((r,i)=>`<div class="list-row"><div class="grow"><strong>${esc(r.date)}</strong><div class="small">${esc(r.name)}</div></div><select data-csv-i="${i}">${state.shiftTypes.map(s=>`<option value="${s.id}" ${s.id===r.shiftId?'selected':''}>${esc(s.name)}</option>`).join('')}</select></div>`).join('')}<div class="btn-row"><button class="secondary" id="cancel">キャンセル</button><button class="primary" id="applyCSV">この内容で登録</button></div>`);$('#cancel').onclick=closeModal;$('#applyCSV').onclick=()=>{normalized.forEach((r,i)=>{const id=$(`[data-csv-i="${i}"]`).value;state.shifts[r.date]=id;reconcileDate(r.date)});save();closeModal();render();toast(`${normalized.length}日分を登録しました`)}}
function downloadShiftTemplate(){download('worknote_shift_template.csv','date,shift,start_time,end_time,note\n2026-08-01,早番,09:30,18:30,\n2026-08-02,遅番,11:00,20:00,\n2026-08-03,休み,,,')}
function openRules(){openModal(`<h2>自動タスク設定</h2>${state.rules.map(r=>`<div class="list-row"><label class="switch"><input type="checkbox" data-rule-toggle="${r.id}" ${r.enabled?'checked':''}><i></i></label><div class="grow"><strong>${esc(r.title)}</strong><div class="small">${scopeLabel(r.scope)}・${esc(r.timing)}</div></div><button class="secondary" data-rule-edit="${r.id}">編集</button></div>`).join('')}<button class="primary" id="addRule" style="width:100%;margin-top:12px">＋自動タスクを追加</button>`);$$('[data-rule-toggle]').forEach(x=>x.onchange=()=>{const r=state.rules.find(a=>a.id===x.dataset.ruleToggle);r.enabled=x.checked;Object.keys(state.shifts).forEach(reconcileDate);save()});$$('[data-rule-edit]').forEach(x=>x.onclick=()=>openRuleEdit(x.dataset.ruleEdit));$('#addRule').onclick=()=>openRuleEdit()}
function scopeLabel(s){return s==='work'?'毎出勤日':s==='daily'?'毎日':(state.shiftTypes.find(x=>x.id===s)?.name||s)}
function openRuleEdit(id=null){const r=id?state.rules.find(x=>x.id===id):{title:'',enabled:true,scope:'work',timing:'退勤前',notify:false};openModal(`<h2>${id?'自動タスクを編集':'自動タスクを追加'}</h2><div class="field"><label>タスク名</label><input id="ruleTitle" value="${esc(r.title)}"></div><div class="grid2"><div class="field"><label>対象</label><select id="ruleScope"><option value="work">毎出勤日</option><option value="daily">毎日</option>${state.shiftTypes.filter(s=>s.id!=='off').map(s=>`<option value="${s.id}">${esc(s.name)}のみ</option>`).join('')}</select></div><div class="field"><label>タイミング</label><select id="ruleTiming"><option>出勤時</option><option>昼</option><option>退勤前</option><option>終日</option></select></div></div><div class="btn-row">${id?'<button class="danger" id="deleteRule">削除</button>':''}<button class="primary" id="saveRule">保存</button></div>`);$('#ruleScope').value=r.scope;$('#ruleTiming').value=r.timing;$('#saveRule').onclick=()=>{const title=$('#ruleTitle').value.trim();if(!title)return toast('タスク名を入力してください');if(id){r.title=title;r.scope=$('#ruleScope').value;r.timing=$('#ruleTiming').value}else state.rules.push({id:uid(),title,enabled:true,scope:$('#ruleScope').value,timing:$('#ruleTiming').value,notify:false});Object.keys(state.shifts).forEach(reconcileDate);save();closeModal();render();toast('保存しました')};if($('#deleteRule'))$('#deleteRule').onclick=()=>{state.rules=state.rules.filter(x=>x.id!==id);state.tasks=state.tasks.filter(t=>t.ruleId!==id||t.done||t.manuallyEdited);save();closeModal();render();toast('削除しました')}}
function openProfile(){openModal(`<h2>表示・プロフィール</h2><div class="field"><label>表示名</label><input id="profileName" value="${esc(state.profile.name)}"></div><button class="primary" id="saveProfile" style="width:100%">保存</button>`);$('#saveProfile').onclick=()=>{state.profile.name=$('#profileName').value.trim()||'ヒガ';save();closeModal();render();toast('保存しました')}}
function openData(){openModal(`<h2>データ管理</h2><div class="warning">端末やブラウザのデータを消すと記録も消える可能性があります。定期的にバックアップしてください。</div><button class="card" id="backup" style="width:100%;text-align:left"><strong>バックアップを保存</strong><div class="small">全データをJSONで保存</div></button><button class="card" id="restore" style="width:100%;text-align:left"><strong>バックアップから復元</strong><div class="small">復元前に内容を確認</div></button><button class="card" id="exportTasks" style="width:100%;text-align:left"><strong>タスク履歴をCSV出力</strong></button><button class="danger" id="resetAll" style="width:100%">全データを初期化</button>`);$('#backup').onclick=()=>{state.settings.lastBackup=nowISO();save();download(`worknote_backup_${isoDate(new Date())}.json`,JSON.stringify(state,null,2));toast('バックアップを保存しました')};$('#restore').onclick=restoreBackup;$('#exportTasks').onclick=exportTasks;$('#resetAll').onclick=()=>{if(confirm('すべてのデータを削除します。元に戻せません。')){state=clone(DEFAULT);save();closeModal();render();toast('初期化しました')}}}
function restoreBackup(){const input=$('#fileInput');input.accept='.json,application/json';input.onchange=async()=>{try{const data=JSON.parse(await input.files[0].text());if(!data.tasks||!data.notes||!data.settings)throw Error();if(confirm(`タスク${data.tasks.length}件、メモ${data.notes.length}件を復元しますか？`)){state=data;save();closeModal();render();toast('復元しました')}}catch{toast('正しいバックアップではありません')}input.value=''};input.click()}
function exportTasks(){const rows=[['date','title','status','completed_at','source','carried_from'],...state.tasks.map(t=>[t.date,t.title,t.done?'done':'open',t.doneAt||'',t.auto?'auto':'manual',t.carriedFrom||''])];download(`worknote_tasks_${isoDate(new Date())}.csv`,rows.map(r=>r.map(csvCell).join(',')).join('\n'))}
function csvCell(v){return `"${String(v??'').replaceAll('"','""')}"`}
function download(name,text){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\uFEFF'+text],{type:'text/plain;charset=utf-8'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function openNotifications(){openModal(`<h2>通知</h2><p class="small">PWAの通知は端末・ブラウザ設定により動作が異なります。アプリ内の未完了表示も併用します。</p><button class="primary" id="requestNotify" style="width:100%">通知を許可する</button><div class="small" style="margin-top:10px">現在：${'Notification'in window?Notification.permission:'非対応'}</div>`);$('#requestNotify').onclick=async()=>{if(!('Notification'in window))return toast('この端末では通知を利用できません');const p=await Notification.requestPermission();state.settings.notifications=p==='granted';save();toast(p==='granted'?'通知を許可しました':'通知は許可されませんでした')}}
function switchView(v){currentView=v;render();window.scrollTo(0,0)}
function openModal(html){$('#modalContent').innerHTML=html;$('#modal').classList.remove('hidden')}
function closeModal(){$('#modal').classList.add('hidden');$('#modalContent').innerHTML=''}
function globalSearch(){openModal(`<h2>検索</h2><div class="field"><input id="globalQ" placeholder="メモ・タスク・予定を検索"></div><div id="searchResults"></div>`);$('#globalQ').oninput=e=>{const q=e.target.value.trim().toLowerCase();if(!q)return $('#searchResults').innerHTML='';const notes=state.notes.filter(n=>n.text.toLowerCase().includes(q)).slice(0,10),tasks=state.tasks.filter(t=>t.title.toLowerCase().includes(q)).slice(0,10),events=state.events.filter(x=>x.title.toLowerCase().includes(q)).slice(0,10);$('#searchResults').innerHTML=[...notes.map(n=>`<div class="card"><strong>メモ</strong><div>${esc(n.text)}</div><div class="small">${n.date}</div></div>`),...tasks.map(t=>`<div class="card"><strong>${t.done?'✓ ':''}タスク</strong><div>${esc(t.title)}</div><div class="small">${t.date}</div></div>`),...events.map(x=>`<div class="card"><strong>予定</strong><div>${esc(x.title)}</div><div class="small">${x.date}</div></div>`)].join('')||'<div class="empty">見つかりません</div>'}}
function isInstalled(){
 return window.matchMedia('(display-mode: fullscreen)').matches ||
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true;
}
let installClickPending=false;
let installWaitTimer=null;
function setInstallUI(){
 const installed=isInstalled();
 const buttons=[$('#installBtn'),$('#installPanelBtn')].filter(Boolean);
 const panel=$('#installPanel');
 if(installed){
  buttons.forEach(button=>button.classList.add('hidden'));
  panel?.classList.add('hidden');
  return;
 }
 panel?.classList.remove('hidden');
 buttons.forEach(button=>{
  button.classList.remove('hidden');
  button.disabled=false;
  button.textContent=installClickPending?'準備中…':'インストール';
  button.removeAttribute('aria-disabled');
 });
}
async function showInstallPrompt(){
 if(!deferredPrompt)return false;
 const promptEvent=deferredPrompt;
 deferredPrompt=null;
 installClickPending=false;
 clearTimeout(installWaitTimer);
 setInstallUI();
 try{
  await promptEvent.prompt();
  const choice=await promptEvent.userChoice;
  if(choice.outcome!=='accepted')setInstallUI();
  return choice.outcome==='accepted';
 }catch(error){
  console.error('Install prompt failed:',error);
  setInstallUI();
  toast('インストールを開始できませんでした');
  return false;
 }
}
async function requestInstall(){
 if(isInstalled())return;
 if(deferredPrompt){await showInstallPrompt();return;}
 installClickPending=true;
 setInstallUI();
 try{
  const registration=await navigator.serviceWorker?.getRegistration('/worknote/');
  await registration?.update();
 }catch(error){console.warn('Install preparation update failed:',error)}
 clearTimeout(installWaitTimer);
 installWaitTimer=setTimeout(()=>{
  if(!installClickPending)return;
  installClickPending=false;
  setInstallUI();
  toast('インストール準備が完了していません。少し待ってから押してください');
 },8000);
}
window.addEventListener('beforeinstallprompt',event=>{
 event.preventDefault();
 deferredPrompt=event;
 setInstallUI();
 if(installClickPending)showInstallPrompt();
});
window.addEventListener('appinstalled',()=>{
 deferredPrompt=null;
 installClickPending=false;
 clearTimeout(installWaitTimer);
 setInstallUI();
 toast('WORKNOTEをインストールしました');
});
window.matchMedia('(display-mode: standalone)').addEventListener?.('change',setInstallUI);
window.matchMedia('(display-mode: fullscreen)').addEventListener?.('change',setInstallUI);
$('#installBtn').onclick=requestInstall;
$('#installPanelBtn').onclick=requestInstall;
$$('.bottom-nav button').forEach(b=>b.onclick=()=>switchView(b.dataset.view));$('#quickAdd').onclick=()=>openQuickNote();$('#searchBtn').onclick=globalSearch;$('#modal').onclick=e=>{if(e.target===$('#modal'))closeModal()};
function startApp(){
 try{
  $('#splash')?.classList.add('hidden');
  $('#app')?.classList.remove('hidden');
  render();
  setInstallUI();
  const params=new URLSearchParams(location.search);
  if(params.get('action')==='quick-note')openQuickNote();
  if(params.get('view')&&['home','notes','calendar','history','settings'].includes(params.get('view')))switchView(params.get('view'));
 }catch(error){
  console.error('WORKNOTE startup failed:',error);
  const splash=$('#splash');
  if(splash){splash.innerHTML='<h1>WORKNOTE</h1><p>起動処理で問題が発生しました。ページを再読み込みしてください。</p><button onclick="location.reload()">再読み込み</button>';}
 }
}

window.addEventListener('load',()=>{
 setTimeout(startApp,250);
 setInstallUI();
 if('serviceWorker' in navigator){
  navigator.serviceWorker.register('/worknote/sw.js', {scope:'/worknote/'})
   .then(async registration=>{
    try{await registration.update()}catch(error){console.warn('Service Worker update failed:',error)}
    setInstallUI();
   })
   .catch(error=>{
    console.error('Service Worker registration failed:',error);
    setInstallUI();
   });
 }
});
