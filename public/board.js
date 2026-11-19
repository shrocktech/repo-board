// GitHub Repo Board: client. Plain ES module, no framework or build step.
const $=s=>document.querySelector(s),node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e};
let state=null,cards=[],busy=false,dragged='',editing='',baseline='',account=null;

$('#theme').onclick=()=>{const v=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=v;try{localStorage.setItem('repo-board-theme',v)}catch{}};

// ---- Status tags (fixed list; the server validates the same list)
const repoLabels=['security','qa','docs','blocked','needs review','deployment','maintenance','bug','high priority'];
const labelChip=name=>{const chip=node('span',name);chip.className='label-chip label-'+repoLabels.indexOf(name);return chip};
for(const name of repoLabels){const label=node('label'),check=node('input');check.type='checkbox';check.value=name;label.append(check,labelChip(name));$('#repo-labels').append(label)}
const selectedLabels=()=>[...$('#repo-labels').querySelectorAll('input:checked')].map(c=>c.value);

// ---- Avatars: twelve Lucide-style presets or an uploaded image (cropped to 96px WebP in the browser)
const avatarPresets=[
 ['Person','M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M8 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0'],
 ['Dog','M11.25 16.25h1.5L12 17zM16 14v.5M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444a11.702 11.702 0 0 0-.493-3.309M8 14v.5M8.5 8.5c-.384 1.05-1.083 2.028-2.344 2.5-1.931.722-3.576-.297-3.656-1-.113-.994 1.177-6.53 4-7 1.923-.321 3.651.845 3.651 2.235A7.497 7.497 0 0 1 14 5.277c0-1.39 1.844-2.598 3.767-2.277 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.855-1.45-2.239-2.5'],
 ['Box','M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16ZM3.3 7l8.7 5 8.7-5M12 22V12'],
 ['Rocket','M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09M9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2zM9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05'],
 ['Gear','M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0'],
 ['Leaf','M11 20a10 10 0 0010-10 25.9 25.9 0 00-1.04-7.281 1 1 0 00-1.755-.325C15.833 5.5 13 5.5 9.8 6.1A7 7 0 0011 20M2 21a5 5 0 012.911-4.544C7.613 15.212 8.351 15.24 11 13'],
 ['Star','M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z'],
 ['Heart','M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5'],
 ['Bolt','M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z'],
 ['Flag','M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528'],
 ['Globe','M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20'],
 ['Database','M3 5a9 3 0 1 0 18 0a9 3 0 1 0 -18 0M3 5V19A9 3 0 0 0 21 19V5M3 12A9 3 0 0 0 21 12']
];
let avatarValue='';
function drawAvatar(target,value){target.replaceChildren();const preset=value.startsWith('preset:')?Number(value.slice(7)):value?-1:0;
 if(preset>=0&&avatarPresets[preset]){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),path=document.createElementNS(svg.namespaceURI,'path');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');path.setAttribute('d',avatarPresets[preset][1]);svg.append(path);target.append(svg)}
 else{const img=node('img');img.alt='';img.referrerPolicy='no-referrer';img.onerror=()=>drawAvatar(target,'');img.src=value;target.append(img)}}
const avatarButton=$('#edit-avatar'),avatarPicker=$('#avatar-picker'),avatarGrid=avatarPicker.querySelector('.avatar-grid');
function showAvatarPicker(show){avatarPicker.hidden=!show;avatarButton.setAttribute('aria-expanded',String(show))}
function setAvatar(value,focus=true){avatarValue=value;drawAvatar(avatarButton,value);for(const [i,b] of [...avatarGrid.children].entries())b.setAttribute('aria-pressed',String(value===`preset:${i}`||(!value&&i===0)));showAvatarPicker(false);if(focus)avatarButton.focus()}
avatarButton.onclick=()=>showAvatarPicker(avatarPicker.hidden);
avatarPresets.forEach(([name],i)=>{const b=node('button');b.type='button';b.className='avatar-choice';b.setAttribute('aria-label',name+' avatar');b.title=name;drawAvatar(b,`preset:${i}`);b.onclick=()=>setAvatar(`preset:${i}`);avatarGrid.append(b)});
$('#upload').onclick=()=>$('#file').click();
$('#file').onchange=async()=>{const input=$('#file'),file=input.files[0];if(busy||!file)return;busy=true;$('#upload').disabled=true;
 try{if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5e6)throw Error('Choose a PNG, JPEG or WebP image under 5 MB.');const bitmap=await createImageBitmap(file);
  try{const canvas=document.createElement('canvas');canvas.width=canvas.height=96;const side=Math.min(bitmap.width,bitmap.height);canvas.getContext('2d').drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,96,96);const value=canvas.toDataURL('image/webp',.8);if(value.length>16000)throw Error('Image is too detailed. Choose a simpler image.');setAvatar(value);$('#detail-message').textContent='Avatar ready. Save changes to keep it.'}finally{bitmap.close()}}
 catch(e){$('#detail-message').textContent=e.message}finally{busy=false;$('#upload').disabled=false;input.value=''}};

// ---- API
async function api(body,fresh=false){const r=await fetch('/api/repositories'+(fresh?'?fresh=1':''),{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Request failed');return d}

// ---- Rendering
function age(iso){const date=new Date(iso),days=Math.max(0,Math.floor((Date.now()-date.getTime())/864e5));if(!Number.isFinite(days))return ['Update unavailable',''];return [days===0?'Updated today':`Updated ${days>=365?Math.floor(days/365)+'y':days>=30?Math.floor(days/30)+'mo':days+'d'} ago`,date.toLocaleString()]}
function cardButton(c,stage){
 const [owner,...rest]=c.repo.split('/'),name=rest.join('/');
 const card=node('button');card.className='repo-card';card.type='button';card.draggable=!busy;card.setAttribute('aria-description','Open notes and controls');
 const heading=node('span'),icon=node('span'),title=node('strong',name);heading.className='repo-heading';icon.className='repo-symbol';icon.setAttribute('aria-hidden','true');title.title=name;drawAvatar(icon,c.avatar||'');
 const tags=node('span'),labels=c.labels||[];tags.className='repo-tags';tags.title=labels.join(', ');if(labels.length)tags.append(labelChip(labels[0]));if(labels.length>1){const more=node('span',`+${labels.length-1}`);more.className='label-chip';tags.append(more)}
 heading.append(icon,title,tags);
 const badges=node('span');badges.className='repo-badges';for(const t of [owner,c.private?'Private':'Public',...(c.notes?['Notes']:[])])badges.append(node('span',t));
 const description=node('span',c.description||'No repository description yet.');description.className='repo-description';
 const first=(c.notes||'').split('\n').map(l=>l.trim()).find(Boolean),note=first?node('span',first):null;if(note){note.className='repo-note';note.title=c.notes}
 const footer=node('span');footer.className='repo-footer';const branch=node('span',c.branch||'—');branch.className='repo-branch';branch.title='Default branch';const [text,when]=age(c.updated),updated=node('span',text);updated.title=when;footer.append(branch,updated);
 card.append(heading,badges,description,...(note?[note]:[]),footer);
 card.onclick=()=>open(c);
 card.ondragstart=e=>{if(busy){e.preventDefault();return}dragged=c.repo;e.dataTransfer.setData('text/plain',c.repo)};card.ondragend=()=>{dragged='';card.classList.remove('over')};
 card.ondragover=e=>{e.preventDefault();card.classList.add('over')};card.ondragleave=()=>card.classList.remove('over');
 card.ondrop=e=>{e.preventDefault();e.stopPropagation();card.classList.remove('over');move(dragged,stage,c.repo)};
 return card;
}
const folded=new Set(JSON.parse(localStorage.getItem('repo-board-folded')||'[]'));
function render(){
 const board=$('#board'),term=$('#search').value.toLowerCase();board.replaceChildren();
 for(const [i,stage] of state.stages.entries()){
  const column=node('section'),header=node('header'),list=node('div');column.className='column stage-'+Math.min(i,5);column.classList.toggle('folded',folded.has(stage));list.className='cards';
  const members=cards.filter(c=>c.stage===stage&&!c.hidden&&`${c.repo} ${c.description} ${c.notes}`.toLowerCase().includes(term));
  const toggle=node('button');toggle.type='button';toggle.className='fold';const sync=()=>{const f=column.classList.contains('folded');toggle.setAttribute('aria-expanded',String(!f));toggle.setAttribute('aria-label',`${f?'Expand':'Collapse'} ${stage}`)};sync();
  toggle.onclick=()=>{column.classList.toggle('folded');folded[column.classList.contains('folded')?'add':'delete'](stage);try{localStorage.setItem('repo-board-folded',JSON.stringify([...folded]))}catch{}sync()};
  header.append(node('h2',stage),node('span',String(members.length)),toggle);column.append(header,list);
  for(const c of members)list.append(cardButton(c,stage));
  column.ondragover=e=>e.preventDefault();column.ondrop=e=>{e.preventDefault();move(dragged,stage)};board.append(column);
 }
}

// ---- Saving: the whole ordered card list goes back with the revision it was based on
async function save(next){if(busy)throw Error('Save in progress.');busy=true;
 const controls=[...document.querySelectorAll('dialog input,dialog textarea,dialog select,dialog button')].map(e=>[e,e.disabled]);for(const [e] of controls)e.disabled=true;
 $('#message').textContent='Saving…';
 try{const r=await api({revision:state.revision,cards:next});state.revision=r.revision;cards=next;$('#message').textContent='';return true}
 catch(e){$('#message').textContent=e.message;throw e}
 finally{busy=false;for(const [e,d] of controls)e.disabled=d;render()}}
function moved(repo,stage,before){const next=structuredClone(cards),i=next.findIndex(c=>c.repo===repo);if(i<0)return null;const [card]=next.splice(i,1);card.stage=stage;const t=before?next.findIndex(c=>c.repo===before):-1;if(t>=0)next.splice(t,0,card);else next.push(card);return next}
async function move(repo,stage,before){if(busy||!repo||repo===before)return;try{await save(moved(repo,stage,before))}catch{}}

// ---- Card dialog
const formValue=()=>JSON.stringify([$('#stage').value,$('#notes').value,selectedLabels(),avatarValue]);
function open(c){editing=c.repo;setAvatar(c.avatar||'',false);$('#title').textContent=c.repo;$('#description').textContent=c.description||'No repository description yet.';$('#github').href=c.url;
 $('#stage').replaceChildren(...state.stages.map(s=>new Option(s,s)));$('#stage').value=c.stage;$('#notes').value=c.notes||'';
 for(const input of $('#repo-labels').querySelectorAll('input'))input.checked=(c.labels||[]).includes(input.value);
 baseline=formValue();$('#detail-message').textContent='';$('#detail').showModal()}
function close(){if(busy)return;if(formValue()!==baseline&&!confirm('Discard unsaved changes?'))return;$('#detail').close()}
$('#close').onclick=close;
$('#detail').addEventListener('cancel',e=>{e.preventDefault();if(!avatarPicker.hidden){showAvatarPicker(false);avatarButton.focus()}else close()});
$('#archive').onclick=()=>{$('#stage').value=state.stages.at(-1);$('#detail-message').textContent=`${state.stages.at(-1)} selected. Save changes to apply; GitHub stays unchanged.`};
$('#card-form').onsubmit=async e=>{e.preventDefault();if(busy)return;const next=structuredClone(cards),c=next.find(c=>c.repo===editing);c.stage=$('#stage').value;c.notes=$('#notes').value;c.labels=selectedLabels();c.avatar=avatarValue;
 try{await save(next);baseline=formValue();$('#detail').close()}catch(e){$('#detail-message').textContent=e.message}};
for(const [id,offset] of [['up',-1],['down',1]])$('#'+id).onclick=async()=>{if(busy)return;if(formValue()!==baseline){$('#detail-message').textContent='Save changes before changing priority.';return}
 const same=cards.filter(c=>c.stage===$('#stage').value&&!c.hidden),i=same.findIndex(c=>c.repo===editing),other=same[i+offset];if(!other)return;
 const next=structuredClone(cards),a=next.findIndex(c=>c.repo===editing),b=next.findIndex(c=>c.repo===other.repo);[next[a],next[b]]=[next[b],next[a]];
 try{await save(next);$('#detail-message').textContent=`Priority ${i+offset+1} of ${same.length}`}catch(e){$('#detail-message').textContent=e.message}};

// ---- Repository selection dialog
const syncAll=()=>{const boxes=[...$('#choices').querySelectorAll('input')];$('#all').checked=boxes.every(b=>b.checked);$('#all').indeterminate=!$('#all').checked&&boxes.some(b=>b.checked)};
$('#all').onchange=()=>{for(const b of $('#choices').querySelectorAll('input'))b.checked=$('#all').checked};
$('#choose').onclick=()=>{if(!state||busy)return;$('#choices').replaceChildren(...cards.map(c=>{const label=node('label'),check=node('input');check.type='checkbox';check.checked=!c.hidden;check.value=c.repo;check.onchange=syncAll;label.append(check,document.createTextNode(c.repo));return label}));syncAll();$('#selection-message').textContent='';$('#selection').showModal()};
$('#cancel-selection').onclick=()=>{if(!busy)$('#selection').close()};
$('#selection-form').onsubmit=async e=>{e.preventDefault();if(busy)return;const on=new Set([...$('#choices').querySelectorAll('input:checked')].map(c=>c.value));try{await save(cards.map(c=>({...c,hidden:!on.has(c.repo)})));$('#selection').close()}catch(e){$('#selection-message').textContent=e.message}};

// ---- Account state; not connected shows a blurred sample board behind the connect panel
function paintDemo(){const names=['website','mobile-app','api-server','docs','design-system','analytics','billing','support-bot','landing-page','dashboard','auth-service','cli-tools','marketing','infra','blog','shop','payments','search'];const stages=['Backlog','Ready','In Development','Review & Testing','Live & Maintaining','Archived'];
 state={stages};cards=names.map((n,i)=>({repo:'example/'+n,stage:stages[i%6],description:'Sample repository shown until GitHub is connected.',private:i%3>0,notes:i%4===0?'Next steps':'',labels:i%5===0?['high priority']:[],branch:'main',updated:new Date(Date.now()-i*864e5*3).toISOString(),hidden:false}));
 render();state=null;cards=[];$('#board').inert=true;$('#board').setAttribute('aria-hidden','true')}
function paintAccount(a){account=a;const on=!!a.connected;document.body.classList.toggle('gh-disconnected',!on);
 $('#gh-name').textContent=on?a.login:a.offline?'GitHub unreachable':'Not connected';$('#gh-account').classList.toggle('on',on);$('#gh-account').title=on?`Connected as ${a.login}`:'No GitHub account connected';
 $('#gh-empty').hidden=on;$('#gh-error').textContent=on?'':a.error||'';$('#search').disabled=!on;
 $('#board').inert=false;$('#board').removeAttribute('aria-hidden');if(!on){paintDemo();$('#message').textContent=''}}
async function refreshAccount(fresh=false){try{paintAccount(await (await fetch('/api/account'+(fresh?'?fresh=1':''))).json())}catch{paintAccount({connected:false,offline:true,error:'The board server is not answering.'})}return account}
async function load(fresh=false){if(busy)return;busy=true;$('#refresh').disabled=true;
 try{state=await api(null,fresh);cards=state.cards.sort((a,b)=>a.order-b.order);$('#message').textContent=''}catch(e){state=null;$('#message').textContent=e.message}
 finally{busy=false;$('#refresh').disabled=false;if(state)render()}}
$('#search').oninput=()=>{if(state)render()};
$('#refresh').onclick=()=>load(true);
$('#retry').onclick=async()=>{if((await refreshAccount(true)).connected)load(true)};
window.addEventListener('beforeunload',e=>{if(busy||($('#detail').open&&formValue()!==baseline)){e.preventDefault();e.returnValue=''}});
refreshAccount().then(a=>{if(a.connected)load()});
