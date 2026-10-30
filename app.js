const STORAGE_KEY = window.daybookUser?.uid ? `daybook-homework-v1-${window.daybookUser.uid}` : 'daybook-homework-v1';
const $ = (s) => document.querySelector(s);
const dateInput = $('#assignedDate');
const dialog = $('#homeworkDialog');
const form = $('#homeworkForm');
const accountButton = $('#accountButton');
const dayNames = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
let data = loadData();
let weekOffset = 0;
let selectedDay = 0;
let view = 'week';
let chosenFile = null;
let fileDbPromise = null;

accountButton.title='Sign out';
accountButton.setAttribute('aria-label','Sign out');
accountButton.addEventListener('click',()=>window.daybookSignOut?.());

function loadData(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {items:[]}}catch{return {items:[]}}}
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(data))}
function fileDb(){
 if(!fileDbPromise) fileDbPromise=new Promise((resolve,reject)=>{const request=indexedDB.open('daybook-files-v1',1);request.onupgradeneeded=()=>request.result.createObjectStore('files');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
 return fileDbPromise;
}
async function putFile(id,file){const db=await fileDb();return new Promise((resolve,reject)=>{const tx=db.transaction('files','readwrite');tx.objectStore('files').put(file,id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}
async function getFile(id){const db=await fileDb();return new Promise((resolve,reject)=>{const tx=db.transaction('files');const request=tx.objectStore('files').get(id);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}
async function removeFile(id){if(!id)return;const db=await fileDb();const tx=db.transaction('files','readwrite');tx.objectStore('files').delete(id)}
function localDate(date){return new Date(date.getFullYear(),date.getMonth(),date.getDate())}
function addDays(date,n){const d=new Date(date);d.setDate(d.getDate()+n);return d}
function dateKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function fromKey(s){const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)}
function mondayOf(date){const d=localDate(date);d.setDate(d.getDate()-((d.getDay()+6)%7));return d}
function weekStart(){return addDays(mondayOf(new Date()),weekOffset*7)}
function fmt(d,opts={month:'short',day:'numeric'}){return new Intl.DateTimeFormat('en-GB',opts).format(d)}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function itemStart(item){return fromKey(item.start)}
function itemDue(item){return addDays(itemStart(item),Number(item.days)-1)}
function dayItems(date){const key=dateKey(date);return data.items.filter(x=>x.start<=key&&dateKey(itemDue(x))>=key)}
function clearPreviousWeeks(){const cutoff=dateKey(mondayOf(new Date()));const expired=data.items.filter(item=>item.start<cutoff);if(!expired.length)return;expired.forEach(item=>removeFile(item.fileId));data.items=data.items.filter(item=>item.start>=cutoff);save()}
function scheduleWeeklyReset(){const now=new Date(), next=mondayOf(addDays(now,7));next.setHours(0,0,0,0);setTimeout(()=>{clearPreviousWeeks();weekOffset=0;selectedDay=0;render();scheduleWeeklyReset()},Math.max(1000,next-now))}
function render(){
 const monday=weekStart(), today=localDate(new Date());
 const weekEnd=addDays(monday,6);
 $('#weekLabel').textContent=weekOffset===0?'This week':`${fmt(monday)} – ${fmt(weekEnd)}`;
 $('#dateRange').textContent=`${fmt(monday)} – ${fmt(weekEnd)}`;
 $('#sectionTitle').innerHTML=`${weekOffset===0?'The week ahead':'Your week'} <span id="dateRange">${fmt(monday)} – ${fmt(weekEnd)}</span>`;
 const weekItems=data.items.filter(x=>itemStart(x)<=weekEnd&&itemDue(x)>=monday);
 $('#weekCount').textContent=weekItems.filter(x=>!x.done).length;
 $('#crumbView').textContent=view==='all'?'All homework':'This week';
 $('#pageTitle').innerHTML=view==='all'?'All your <em>homework.</em>':'Your <em>homework.</em>';
 const strip=$('#dayStrip');strip.innerHTML='';
 for(let i=0;i<7;i++){
   const d=addDays(monday,i), items=dayItems(d), button=document.createElement('button');
   button.className=`day-button ${i===selectedDay?'selected ':''}${dateKey(d)===dateKey(today)?'today':''}`;
   button.innerHTML=`<span class="day-name">${dayNames[i].slice(0,3)}</span><span class="day-num">${d.getDate()}</span>${items.length?'<i class="day-marker"></i>':''}`;
   button.addEventListener('click',()=>{selectedDay=i;view='week';render()});strip.append(button);
 }
 const selectedDate=addDays(monday,selectedDay);
 $('#selectedDayTitle').textContent=dayNames[selectedDay];$('#selectedDate').textContent=fmt(selectedDate,{month:'long',day:'numeric'});
 let items=dayItems(selectedDate);
 if(view==='all') items=[...data.items].sort((a,b)=>itemDue(a)-itemDue(b));
 $('#dayStrip').hidden=view==='all';
 $('.day-heading').hidden=view==='all';
 if(view==='all'){$('#sectionTitle').innerHTML=`Everything you’ve added <span>${items.length} ${items.length===1?'assignment':'assignments'}</span>`}
 $('#dayLoad').textContent=items.length?`${items.length} ${items.length===1?'assignment':'assignments'}`:'A fresh start';
 const list=$('#assignmentList');list.innerHTML='';
 items.forEach(item=>list.append(makeCard(item,view==='all'?localDate(new Date()):selectedDate)));
 $('#emptyState').classList.toggle('visible',items.length===0);
}
function makeCard(item,date){
 const card=document.createElement('article');card.className=`assignment-card ${item.done?'completed':''}`;
 const due=itemDue(item), remaining=Math.max(0,Math.ceil((localDate(due)-localDate(date))/86400000));
 let countdown=item.done?'Done':remaining===0?'Due today':remaining===1?'1 day left':`${remaining} days left`;
 card.innerHTML=`<button class="check-button" aria-label="${item.done?'Mark incomplete':'Mark complete'}">${item.done?'✓':''}</button><div class="assignment-main"><div class="assignment-title">${escapeHtml(item.title)}</div><div class="assignment-meta"><span class="subject-tag">Homework</span><span>Added ${fmt(itemStart(item),{month:'short',day:'numeric'})}</span></div></div>${item.fileName?`<a class="file-chip" ${item.fileId?`data-file-id="${escapeHtml(item.fileId)}"`:''} title="${escapeHtml(item.fileName)}">▧ ${escapeHtml(item.fileName)}</a>`:''}<div class="countdown ${remaining===0&&!item.done?'due-today':''} ${item.done?'done-text':''}"><strong>${countdown}</strong><small>Due ${fmt(due,{month:'short',day:'numeric'})}</small></div><div class="card-actions"><button class="icon-button delete-button" aria-label="Delete assignment" title="Delete">×</button></div>`;
 const fileLink=card.querySelector('[data-file-id]');if(fileLink){getFile(item.fileId).then(blob=>{if(blob){fileLink.href=URL.createObjectURL(blob);fileLink.download=item.fileName}}).catch(()=>{})}
 card.querySelector('.check-button').addEventListener('click',()=>{item.done=!item.done;save();render()});
 card.querySelector('.delete-button').addEventListener('click',()=>{data.items=data.items.filter(x=>x.id!==item.id);removeFile(item.fileId);save();render()});return card;
}
function openDialog(){const start=addDays(weekStart(),selectedDay);dateInput.value=dateKey(start);$('#titleInput').value='';$('#daysInput').value='3';$('#fileInput').value='';chosenFile=null;$('#filePrompt').textContent='Take a photo or choose an image';$('#photoPreview').hidden=true;const preview=$('#previewImage');if(preview.dataset.url){URL.revokeObjectURL(preview.dataset.url);delete preview.dataset.url}$('#aiStatus').textContent='Photo ready';updateDuePreview();dialog.showModal();setTimeout(()=>$('#titleInput').focus(),50)}
function updateDuePreview(){if(!dateInput.value)return;const start=fromKey(dateInput.value),days=Math.max(1,Number($('#daysInput').value)||1);$('#duePreviewText').textContent=fmt(addDays(start,days-1),{weekday:'long',month:'short',day:'numeric'})}
$('#addHomework').addEventListener('click',openDialog);$('#emptyAdd').addEventListener('click',openDialog);
$('#closeDialog').addEventListener('click',()=>dialog.close());$('#cancelDialog').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
dateInput.addEventListener('input',updateDuePreview);$('#daysInput').addEventListener('input',updateDuePreview);
$('#fileInput').addEventListener('change',e=>{chosenFile=e.target.files[0]||null;$('#filePrompt').textContent=chosenFile?chosenFile.name:'Take a photo or choose an image';if(chosenFile){const preview=$('#previewImage');if(preview.dataset.url)URL.revokeObjectURL(preview.dataset.url);preview.dataset.url=URL.createObjectURL(chosenFile);preview.src=preview.dataset.url;$('#photoPreview').hidden=false;identifyHomework(chosenFile)}else $('#photoPreview').hidden=true});
$('#retryAi').addEventListener('click',()=>{if(chosenFile)identifyHomework(chosenFile)});
async function identifyHomework(file){
 const status=$('#aiStatus'), retry=$('#retryAi');
 if(!file.type.startsWith('image/')){status.textContent='Choose an image to get an AI title';return}
 if(location.hostname.endsWith('github.io')){status.textContent='AI titles need paid API access. Type the homework title below; saving and tracking stay free.';return}
 status.textContent='AI is reading your photo…';retry.disabled=true;
 try{
   const image=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file)});
   const response=await fetch('/api/identify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image})});
   const payload=await response.json();if(!response.ok){if(response.status===503){status.textContent='AI titles need API billing. Type the homework title below; saving and tracking stay free.';return}throw new Error(payload.error||'Could not read the photo')}
   const title=String(payload.title||'').trim();if(!title)throw new Error('AI could not find a homework title in this photo');
   $('#titleInput').value=title;status.textContent='AI suggestion added — you can edit it';
 }catch(error){status.textContent=error.message==='Failed to fetch'?'AI isn’t connected yet. Start the app server to name photos.':error.message}
 finally{retry.disabled=false}
}
form.addEventListener('submit',async e=>{e.preventDefault();const start=dateInput.value;const days=Math.max(1,Math.min(90,Number($('#daysInput').value)||1));const id=crypto.randomUUID?crypto.randomUUID():String(Date.now());if(chosenFile)await putFile(id,chosenFile);data.items.push({id,title:$('#titleInput').value.trim(),start,days,done:false,fileName:chosenFile?.name||'',fileId:chosenFile?id:''});save();weekOffset=Math.round((mondayOf(fromKey(start))-mondayOf(new Date()))/604800000);selectedDay=(fromKey(start).getDay()+6)%7;view='week';dialog.close();render()});
$('#prevWeek').addEventListener('click',()=>{weekOffset--;selectedDay=0;render()});$('#nextWeek').addEventListener('click',()=>{weekOffset++;selectedDay=0;render()});$('#jumpToday').addEventListener('click',()=>{weekOffset=0;selectedDay=(new Date().getDay()+6)%7;view='week';render()});
document.querySelectorAll('.nav-item').forEach(button=>button.addEventListener('click',()=>{view=button.dataset.view;document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x===button));render()}));
clearPreviousWeeks();render();scheduleWeeklyReset();

