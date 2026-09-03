const SUPABASE_URL='https://cvcidgsknjsfidkswdbu.supabase.co';
const SUPABASE_KEY='sb_publishable_AEuYWYFf0daG77iem8TCnA_SMuS2dPX';
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const defaultState={bucket:[],memories:[],events:[],photos:[]};
let state=defaultState,page='home',bucketFilter='All',session=null,member=null,realtimeChannel=null;
const app=document.querySelector('#app'),backdrop=document.querySelector('#modalBackdrop'),modal=document.querySelector('#modal');

function completed(){return state.bucket.filter(x=>x.done).length}
function pct(){return Math.round(completed()/Math.max(state.bucket.length,1)*100)||0}
function esc(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function iconFor(c){return ({Food:'🍝',Adventure:'☀',Memories:'♡','Nights Out':'✦',Roommates:'⌂',Chaos:'☻'})[c]||'♡'}
function setNavVisible(show){document.querySelector('.bottom-nav').style.display=show?'':'none'}
function showMessage(text){openModal(`<h2>1002</h2><p class="sub">${esc(text)}</p><div class="modal-actions"><button class="primary" onclick="closeModal()">Okay</button></div>`)}

async function boot(){
  const {data}=await db.auth.getSession();session=data.session;
  db.auth.onAuthStateChange(async(_event,newSession)=>{session=newSession;if(session)await afterSignIn();else showLogin()});
  if(!session){showLogin();return}
  await afterSignIn();
}

function showLogin(){
  member=null;state=defaultState;setNavVisible(false);
  app.innerHTML=`<p class="eyebrow">ELLA · KEIRA · MEGAN · TRISTAN</p><h1 class="hero-title">Welcome to <em>1002.</em></h1><p class="sub">Sign in with your email so the four of you can share the same bucket list, photos, calendar and memories.</p><section class="hero-card"><div class="field"><label>Email</label><input id="loginEmail" type="email" inputmode="email" autocomplete="email" placeholder="you@email.com"></div><button class="primary" style="width:100%" onclick="sendMagicLink()">Email me a sign-in link</button><p class="item-meta" style="margin-top:12px">No password needed. You'll open the link from your email once.</p></section>`;
}

async function sendMagicLink(){
  const email=document.querySelector('#loginEmail').value.trim();if(!email)return;
  const btn=document.querySelector('.hero-card .primary');btn.disabled=true;btn.textContent='Sending…';
  const {error}=await db.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname}});
  if(error){btn.disabled=false;btn.textContent='Email me a sign-in link';showMessage(error.message);return}
  app.innerHTML=`<p class="eyebrow">check your inbox</p><h1 class="hero-title">Your link is <em>on the way.</em></h1><p class="sub">Open the email from Supabase and tap the sign-in link. It will bring you straight back to 1002.</p>`;
}

async function afterSignIn(){
  const {data,error}=await db.from('members').select('name').maybeSingle();
  if(error){showMessage(error.message);return}
  if(!data){showChooseMember();return}
  member=data.name;setNavVisible(true);await loadSharedState();subscribeRealtime();render();
}

function showChooseMember(){
  setNavVisible(false);
  app.innerHTML=`<p class="eyebrow">one last step</p><h1 class="hero-title">Who are <em>you?</em></h1><p class="sub">Pick your name once. That connects this phone to your 1002 profile.</p><div class="quick-grid">${['Ella','Keira','Megan','Tristan'].map(n=>`<button class="quick-card" onclick="claimMember('${n}')"><span class="icon">${n[0]}</span><strong>${n}</strong><small>Join 1002</small></button>`).join('')}</div><div style="margin-top:18px"><button class="secondary" onclick="signOut()">Use a different email</button></div>`;
}

async function claimMember(name){
  const {data:{user}}=await db.auth.getUser();if(!user)return;
  const {error}=await db.from('members').insert({user_id:user.id,name});
  if(error){showMessage(error.code==='23505'?`${name} has already been claimed on another account.`:error.message);return}
  member=name;setNavVisible(true);await loadSharedState();subscribeRealtime();render();
}

async function signOut(){await db.auth.signOut()}

async function loadSharedState(){
  const {data,error}=await db.from('shared_state').select('bucket,memories,events,photos').eq('id',true).single();
  if(error){showMessage(error.message);return}
  state={bucket:data.bucket||[],memories:data.memories||[],events:data.events||[],photos:data.photos||[]};
  localStorage.setItem('1002-state-cache',JSON.stringify(state));
}

async function save(){
  if(!session||!member)return;
  localStorage.setItem('1002-state-cache',JSON.stringify(state));
  const {data:{user}}=await db.auth.getUser();
  const {error}=await db.from('shared_state').update({bucket:state.bucket,memories:state.memories,events:state.events,photos:state.photos,updated_by:user.id,updated_at:new Date().toISOString()}).eq('id',true);
  if(error)showMessage('Could not sync that change. '+error.message);
}

function subscribeRealtime(){
  if(realtimeChannel)db.removeChannel(realtimeChannel);
  realtimeChannel=db.channel('1002-shared-state').on('postgres_changes',{event:'UPDATE',schema:'public',table:'shared_state',filter:'id=eq.true'},payload=>{
    const n=payload.new;state={bucket:n.bucket||[],memories:n.memories||[],events:n.events||[],photos:n.photos||[]};
    localStorage.setItem('1002-state-cache',JSON.stringify(state));render();
  }).subscribe();
}

function setPage(p){page=p;document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.page===p));render();window.scrollTo({top:0,behavior:'smooth'})}
document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>setPage(b.dataset.page));document.querySelector('[data-go]').onclick=()=>{if(member)setPage('home')};
function render(){if(!member)return;({home:renderHome,bucket:renderBucket,album:renderAlbum,year:renderYear,memories:renderMemories}[page])()}

function renderHome(){app.innerHTML=`<p class="eyebrow">Ella · Keira · Megan · Tristan</p><h1 class="hero-title">Our <em>last year.</em><br>Let's make it count.</h1><p class="sub">One place for everything we want to do, every photo we take, and all the little things we never want to forget.</p><section class="hero-card"><div class="progress-row"><div><div class="progress-number">${completed()} / ${state.bucket.length}</div><div class="progress-label">memories waiting to happen</div></div><strong>${pct()}%</strong></div><div class="progress-track"><div class="progress-fill" style="width:${pct()}%"></div></div></section><div class="section-head"><h2>What are we doing?</h2></div><div class="quick-grid"><button class="quick-card" onclick="setPage('bucket')"><span class="icon">✓</span><strong>Bucket List</strong><small>${state.bucket.length-completed()} left to do</small></button><button class="quick-card" onclick="setPage('album')"><span class="icon">▧</span><strong>1002 Album</strong><small>${state.photos.length} photos</small></button><button class="quick-card" onclick="setPage('year')"><span class="icon">♡</span><strong>Our Year</strong><small>${state.events.length} moments planned</small></button><button class="quick-card" onclick="setPage('memories')"><span class="icon">✦</span><strong>Memories</strong><small>${state.memories.length} things saved</small></button></div><div class="section-head"><h2>Note to us</h2></div><div class="quote-card"><p>“These are the days we'll wish we could come back to.”</p><small>— 1002, one last year</small></div><div style="margin-top:20px;text-align:center"><button class="secondary" onclick="signOut()">Signed in as ${esc(member)} · Sign out</button></div>`}

function renderBucket(){let cats=['All',...new Set(state.bucket.map(x=>x.category))];let items=bucketFilter==='All'?state.bucket:state.bucket.filter(x=>x.category===bucketFilter);app.innerHTML=`<div class="page-head"><div><p class="eyebrow">${completed()} of ${state.bucket.length} complete</p><h1 class="page-title">Bucket List</h1></div><button class="add-btn" onclick="openBucketModal()">+</button></div><div class="filter-row">${cats.map(c=>`<button class="chip ${c===bucketFilter?'active':''}" onclick="bucketFilter='${c}';renderBucket()">${c}</button>`).join('')}</div><div class="bucket-list">${items.map(x=>`<article class="bucket-item ${x.done?'done':''}"><button class="check" onclick="toggleBucket(${JSON.stringify(x.id)})">${x.done?'✓':''}</button><div><div class="item-title">${esc(x.title)}</div><div class="item-meta">${esc(x.category)}</div></div><span class="category-dot">${iconFor(x.category)}</span></article>`).join('')}</div>`}
async function toggleBucket(id){let x=state.bucket.find(x=>String(x.id)===String(id));if(!x)return;x.done=!x.done;if(x.done)x.completedAt=new Date().toISOString();await save();renderBucket()}

async function renderAlbum(){
  app.innerHTML=`<div class="page-head"><div><p class="eyebrow">our shared camera roll</p><h1 class="page-title">1002 Album</h1></div></div><div class="upload-card"><div style="font-size:28px;margin-bottom:8px">▧</div><strong>Add a memory</strong><p class="sub" style="margin:5px 0 14px">Photos sync privately for all four of us.</p><input id="photoInput" type="file" accept="image/*" hidden onchange="addPhoto(event)"><button onclick="document.querySelector('#photoInput').click()">Choose photo</button></div><div id="albumContent"><div class="empty">Loading the album…</div></div>`;
  if(!state.photos.length){document.querySelector('#albumContent').innerHTML=`<div class="empty">Your shared scrapbook starts here.<br>Add the first photo of the year ♡</div>`;return}
  const cards=await Promise.all(state.photos.map(async(p,i)=>{const {data}=await db.storage.from('1002-photos').createSignedUrl(p.path,3600);return `<article class="photo-card" style="--r:${i%2?1.5:-1.2}deg"><div class="photo-placeholder"><img src="${data?.signedUrl||''}" alt="1002 memory"></div><p>${esc(p.caption||'1002 ♡')}</p></article>`}));
  document.querySelector('#albumContent').innerHTML=`<div class="album-grid">${cards.join('')}</div>`;
}
function addPhoto(e){let f=e.target.files[0];if(!f)return;openModal(`<h2>Caption this memory</h2><div class="field"><label>Caption</label><input id="caption" placeholder="What happened?"></div><div class="modal-actions"><button class="secondary" onclick="closeModal()">Cancel</button><button class="primary" id="savePhoto">Save photo</button></div>`);document.querySelector('#savePhoto').onclick=()=>uploadPhoto(f)}
async function uploadPhoto(file){
  const btn=document.querySelector('#savePhoto');btn.disabled=true;btn.textContent='Uploading…';
  const ext=(file.name.split('.').pop()||'jpg').toLowerCase();const path=`${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const {error}=await db.storage.from('1002-photos').upload(path,file,{cacheControl:'3600',upsert:false});
  if(error){btn.disabled=false;btn.textContent='Save photo';showMessage(error.message);return}
  state.photos.unshift({id:Date.now(),path,caption:document.querySelector('#caption').value||'1002 ♡',by:member,date:new Date().toISOString()});await save();closeModal();renderAlbum();
}

function renderYear(){app.innerHTML=`<div class="page-head"><div><p class="eyebrow">september → graduation</p><h1 class="page-title">Our Year</h1></div><button class="add-btn" onclick="openEventModal()">+</button></div><div class="timeline">${state.events.map(e=>`<article class="event"><div class="event-date">${esc(e.date)}</div><h3>${esc(e.title)}</h3><div class="item-meta">${esc(e.note||'')}</div></article>`).join('')}</div>`}
function renderMemories(){app.innerHTML=`<div class="page-head"><div><p class="eyebrow">don't forget this</p><h1 class="page-title">Memories</h1></div><button class="add-btn" onclick="openMemoryModal()">+</button></div><div class="memory-grid">${state.memories.map((m,i)=>`<article class="memory" style="--r:${[-.6,.5,-.2][i%3]}deg"><p>${esc(m.text)}</p><small>${esc(m.by)} · ${esc(m.date)}</small></article>`).join('')}</div>`}

function openBucketModal(){openModal(`<h2>Add to the list</h2><div class="field"><label>What should 1002 do?</label><input id="newBucket" placeholder="e.g. Go to a concert"></div><div class="field"><label>Category</label><select id="newCat"><option>Roommates</option><option>Adventure</option><option>Food</option><option>Nights Out</option><option>Memories</option><option>Chaos</option></select></div><div class="modal-actions"><button class="secondary" onclick="closeModal()">Cancel</button><button class="primary" onclick="addBucket()">Add it</button></div>`)}
async function addBucket(){let v=document.querySelector('#newBucket').value.trim();if(!v)return;state.bucket.push({id:Date.now(),title:v,category:document.querySelector('#newCat').value,done:false,addedBy:member});await save();closeModal();renderBucket()}
function openMemoryModal(){openModal(`<h2>Save this forever</h2><div class="field"><label>Memory / quote / inside joke</label><textarea id="memoryText" placeholder="Remember when..."></textarea></div><div class="modal-actions"><button class="secondary" onclick="closeModal()">Cancel</button><button class="primary" onclick="addMemory()">Save memory</button></div>`)}
async function addMemory(){let v=document.querySelector('#memoryText').value.trim();if(!v)return;state.memories.unshift({id:Date.now(),text:v,by:member,date:new Date().toLocaleDateString('en-CA',{month:'long',year:'numeric'})});await save();closeModal();renderMemories()}
function openEventModal(){openModal(`<h2>Add to our year</h2><div class="field"><label>Plan</label><input id="eventTitle" placeholder="e.g. 1002 Christmas Dinner"></div><div class="field"><label>Date</label><input id="eventDate" type="date"></div><div class="field"><label>Note</label><input id="eventNote" placeholder="Optional"></div><div class="modal-actions"><button class="secondary" onclick="closeModal()">Cancel</button><button class="primary" onclick="addEvent()">Add plan</button></div>`)}
async function addEvent(){let t=document.querySelector('#eventTitle').value.trim(),d=document.querySelector('#eventDate').value;if(!t||!d)return;let formatted=new Date(d+'T12:00:00').toLocaleDateString('en-CA',{month:'long',day:'numeric',year:'numeric'});state.events.push({id:Date.now(),title:t,date:formatted,note:document.querySelector('#eventNote').value,addedBy:member});await save();closeModal();renderYear()}
function openModal(html){modal.innerHTML=html;backdrop.classList.remove('hidden')}
function closeModal(){backdrop.classList.add('hidden')}
backdrop.onclick=e=>{if(e.target===backdrop)closeModal()};

boot();
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));}
