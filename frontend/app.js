// Change this if your frontend is hosted separately from the backend.
// If served from the same origin, keep as ''.
// If frontend is opened as a static file (file://) or on a different port,
// hardcoding helps avoid empty-base URL issues. Update only if your backend uses
// a different host/port.
const API_BASE = 'http://127.0.0.1:8000';



const pages = {
  chat: 'chat',
  budget: 'budget',
  viz: 'viz',
  topics: 'topics',
  about: 'about'

};

const popularTopics = [
  '50/30/20 Rule',
  'Emergency Fund',
  'EMI Basics',
  'Saving vs Investing',
  'Tax Saving (80C)',
  'Health Insurance Basics',
  'Credit Card Management',
  'Zero-Based Budgeting'
];

function $(id){ return document.getElementById(id); }

function toast(msg){
  const t = $('toast');
  if(!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2200);
}

let pageCache = 'chat';

function setActivePage(page){
  pageCache = page;
  document.querySelectorAll('.nav-item').forEach(b=>{
    b.classList.toggle('active', b.dataset.page === page);
  });

  // Center view switch
  // For budget view we keep CHAT view hidden so only the calculator is visible,
  // but the shared topbar remains because it's outside the view containers.
  document.querySelectorAll('[data-view]').forEach(v=>{
    // For non-budget pages, show exactly the active view.
    if(page !== 'budget'){
      v.classList.toggle('hidden', v.dataset.view !== page);
      return;
    }

    // For budget page, show only budget view.
    v.classList.toggle('hidden', v.dataset.view !== 'budget');
  });


  // Right sidebar switch
  const right = $('rightSidebar');
  if(!right) return;
  document.querySelectorAll('.right-panel').forEach(p=>p.classList.add('hidden'));
  $('rightPopular').classList.toggle('hidden', false);

  if(page === 'budget'){
    // hide right sidebar content for budget so the calculator is truly centered
    if(document.querySelector('[data-right="budget"]')){
      document.querySelector('[data-right="budget"]').classList.add('hidden');
    }
    right.style.visibility = 'hidden';
    $('rightPopular').classList.add('hidden');
    hideWelcomeIfNeeded();
    return;
  }

  // For all other pages, keep the right sidebar visible.
  right.style.visibility = 'visible';

  // Hide all right panels by default.
  document.querySelectorAll('.right-panel').forEach(p=>p.classList.add('hidden'));

  if(page === 'topics'){
    // Show popular topics in the right sidebar for the topics page.
    const topicsPanel = document.querySelector('[data-right="topics"]');
    if(topicsPanel) topicsPanel.classList.remove('hidden');

    $('rightPopular').classList.remove('hidden');
  } else {
    const emptyPanel = document.querySelector('[data-right="empty"]');
    if(emptyPanel) emptyPanel.classList.remove('hidden');

    // Keep the Popular Topics card visible on non-budget pages.
    $('rightPopular').classList.remove('hidden');
  }


  // Topbar visible always (keeps UI simple)
}

function hideWelcomeIfNeeded(){
  const welcome = $('welcomeScreen');
  const chatArea = $('chatArea');
  if(welcome && chatArea && chatArea.children.length > 0){
    welcome.classList.add('hidden');
  }
}

function appendMessage(role, text){
  const area = $('chatArea');
  const welcome = $('welcomeScreen');
  if(welcome) welcome.classList.add('hidden');

  const wrap = document.createElement('div');
  wrap.className = `message ${role}`;

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;

  wrap.appendChild(bubble);
  area.appendChild(wrap);
  area.scrollTop = area.scrollHeight;
}

// --- History in right sidebar ---
const HISTORY_KEY = 'fincoach_history_v1';
let __history = [];

function loadHistory(){
  try{
    const raw = localStorage.getItem(HISTORY_KEY);
    __history = raw ? JSON.parse(raw) : [];
    if(!Array.isArray(__history)) __history = [];
  }catch(e){
    __history = [];
  }
}

function saveHistory(){
  try{ localStorage.setItem(HISTORY_KEY, JSON.stringify(__history)); }catch(e){}
}

function addHistoryQuestion(q){
  const question = String(q || '').trim();
  if(!question) return;

  __history.push({ id: Date.now() + Math.random().toString(16).slice(2), q: question });
  // keep only last 50 items
  if(__history.length > 50) __history = __history.slice(__history.length - 50);
  saveHistory();
  renderHistory();
}

function deleteHistoryItem(id){
  __history = __history.filter(x => x.id !== id);
  saveHistory();
  renderHistory();
}

function clearHistory(){
  __history = [];
  saveHistory();
  renderHistory();
}

function renderHistory(){
  const list = $('historyList');
  const rightPanel = $('rightHistoryPanel');
  if(!list || !rightPanel) return;

  // show only when we have items
  rightPanel.classList.toggle('hidden', __history.length === 0);

  if(__history.length === 0){
    list.innerHTML = '';
    return;
  }

  list.innerHTML = __history
    .slice()
    .reverse()
    .map(item => {
      const escQ = escapeHtml(item.q);
      return `
        <div class="history-item" data-id="${item.id}">
          <div class="history-q">Question</div>
          <div class="history-text">${escQ}</div>
          <div class="history-actions">
            <span style="color:rgba(234,243,255,.6);font-weight:650;font-size:11px">${new Date(item.id).toLocaleString()}</span>
            <button class="history-del" type="button" data-del="${item.id}">Delete</button>
          </div>
        </div>
      `;
    })
    .join('');

  list.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', ()=>{
      const id = btn.dataset.del;
      deleteHistoryItem(id);
    });
  });
}


async function apiGetTopics(){
  const res = await fetch(`${API_BASE}/api/topics`, { cache: 'no-store' });

  if(!res.ok) throw new Error('Failed to fetch topics');
  return res.json();
}

async function apiChat(message){
  const res = await fetch(`${API_BASE}/api/chat`, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({message})
  });
  if(!res.ok) throw new Error('Chat request failed');
  return res.json();
}

async function apiBudgetCalc(payload){
  const res = await fetch(`${API_BASE}/api/budget-calc`, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify(payload)
  });
  if(!res.ok) throw new Error('Budget calc request failed');
  return res.json();
}

function renderPopularPills(){
  const left = $('popularTopics');
  const right = $('rightPopularTopics');
  if(left){ left.innerHTML = ''; }
  if(right){ right.innerHTML = ''; }

  popularTopics.forEach(t=>{

    const pill = document.createElement('button');
    pill.className = 'pill';
    pill.type = 'button';
    pill.textContent = t;
    pill.addEventListener('click', ()=>{
      setActivePage('chat');
      const prompt = `Explain: ${t}`;
      $('messageInput').value = prompt;
      sendMessage();
    });
    if(left) left.appendChild(pill.cloneNode(true));

    const pill2 = pill.cloneNode(true);
    pill2.addEventListener('click', ()=>{
      setActivePage('chat');
      const prompt = `Explain: ${t}`;
      $('messageInput').value = prompt;
      sendMessage();
    });
    if(right) right.appendChild(pill2);
  });
}

async function uploadAndAsk(){
  const input = $('messageInput');
  const filePicker = document.createElement('input');
  filePicker.type = 'file';
  filePicker.accept = '.pdf,.docx,.txt';

  filePicker.onchange = async () => {
    const file = filePicker.files && filePicker.files[0];
    if(!file){ return; }

    appendMessage('user', `Uploaded file: ${file.name}`);
    appendMessage('ai', 'Extracting and answering from your file...');
    const last = $('chatArea').lastChild;

    try{
      const resp = await fetch(`${API_BASE}/api/upload-chat`, {
        method: 'POST',
        body: (()=>{
          const fd = new FormData();
          fd.append('file', file);
          fd.append('message', (input.value || '').trim());
          return fd;
        })()
      });
      if(!resp.ok){
        const t = await resp.text();
        throw new Error(`Upload failed (${resp.status}). ${t}`);
      }
      const data = await resp.json();
      if(last && last.classList.contains('ai')){
        last.querySelector('.bubble').textContent = data.reply || 'No response.';
      }
      toast(data.extracted_type ? `Extracted: ${data.extracted_type}` : 'File processed');

      // clear the input after successful upload usage
      input.value = '';
    }catch(e){
      if(last){ last.querySelector('.bubble').textContent = 'Error uploading/processing file. Check backend endpoint.'; }
      toast(e && e.message ? e.message : 'Upload error');
    }
  };

  filePicker.click();
}

async function sendMessage(){

  const input = $('messageInput');
  // quick sanity check for endpoint
  if(!API_BASE || !String(API_BASE).trim()){
    toast('API_BASE missing. Update frontend/app.js');
  }

  const msg = (input.value || '').trim();
  if(!msg){ toast('Type a message first'); return; }

  appendMessage('user', msg);
  addHistoryQuestion(msg);
  input.value = '';

  input.style.height = 'auto';

  appendMessage('ai', 'Thinking...');
  const last = $('chatArea').lastChild;

  try{
    const data = await apiChat(msg);
    // replace last message (update the actual bubble text)

    if(last && last.classList.contains('ai')){
      last.querySelector('.bubble').textContent = data.reply || 'No response.';
    } else {
      // fallback
      $('chatArea').lastChild.querySelector('.bubble').textContent = data.reply || 'No response.';
    }
  }catch(e){
    if(last){ last.querySelector('.bubble').textContent = 'Error contacting backend. Check API URL and server.'; }
  }
}

function autosizeTextArea(el){
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 140) + 'px';
}

function renderTopics(topics){
  const grid = $('topicsGrid');
  if(!grid) return;
  grid.innerHTML = '';

  const q = ($('topicSearch').value || '').trim().toLowerCase();
  const filtered = topics.filter(t=>{
    if(!q) return true;
    const hay = `${t.topic} ${t.explanation} ${(t.tips||[]).join(' ')} ${(t.mistakes||[]).join(' ')}`.toLowerCase();
    return hay.includes(q);
  });

  filtered.forEach(t=>{
    const card = document.createElement('div');
    card.className = 'glass card topic-card';

    const header = document.createElement('div');
    header.className = 'topic-head';

    const name = document.createElement('div');
    name.className = 'topic-name';
    name.textContent = t.topic;

    const action = document.createElement('button');
    action.className = 'pill';
    action.type = 'button';
    action.textContent = 'Ask';
    action.addEventListener('click', ()=>{
      setActivePage('chat');
      $('messageInput').value = `How does ${t.topic} work in India? Give examples and tips.`;
      sendMessage();
    });

    header.appendChild(name);
    header.appendChild(action);

    const desc = document.createElement('div');
    desc.className = 'topic-desc';
    desc.textContent = t.explanation || '';

    const tips = document.createElement('div');
    tips.className = 'topic-section';
    tips.innerHTML = `<div class="topic-label">Actionable Tips</div><ul class="bullets">${(t.tips||[]).slice(0,3).map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul>`;

    const mistakes = document.createElement('div');
    mistakes.className = 'topic-section';
    mistakes.innerHTML = `<div class="topic-label">Common Mistakes</div><ul class="bullets">${(t.mistakes||[]).slice(0,3).map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul>`;

    // Examples
    const examples = document.createElement('div');
    examples.className = 'topic-section';
    examples.innerHTML = `<div class="topic-label">Examples (₹)</div><div class="analysis">${(t.examples||[]).slice(0,2).map(x=>`• ${escapeHtml(x)}`).join('<br/>')}</div>`;

    card.appendChild(header);
    card.appendChild(desc);
    card.appendChild(examples);
    card.appendChild(tips);
    card.appendChild(mistakes);

    grid.appendChild(card);
  });
}

function escapeHtml(str){
  return String(str)
    .replaceAll('&','&amp;')
    .replaceAll('<','<')
    .replaceAll('>','>')
    .replaceAll('"','"')
    .replaceAll("'",'&#039;');
}

function renderBudget(payload, resp){
  const a = $('budgetAnalysis');

  // Support richer backend payloads if available, while keeping backward compatibility.
  const healthScore = resp.budget_health_score ?? null;
  const needsStatus = resp.needs_status ?? null;
  const wantsStatus = resp.wants_status ?? null;
  const savingsStatus = resp.savings_status ?? null;

  const recommendations = resp.recommendations;

  const hasRicherFields =
    typeof healthScore === 'number' && Array.isArray(recommendations);

  a.innerHTML = `
    <div class="analysis">
      <div><b>Income:</b> ₹${payload.monthly_income.toFixed(0)}</div>

      <div style="margin-top:8px"><b>Recommended Allocation:</b></div>
      <div style="margin-top:4px">Needs (50%) = ₹${(resp.needs_target ?? 0).toFixed(0)}</div>
      <div>Wants (30%) = ₹${(resp.wants_target ?? 0).toFixed(0)}</div>
      <div>Savings (20%) = ₹${(resp.savings_target ?? 0).toFixed(0)}</div>

      <div style="margin-top:12px; padding-top:10px; border-top:1px solid rgba(255,255,255,.10)">
        Your current split: Needs=${Math.round((resp.needs_ratio ?? 0)*100)}% • Wants=${Math.round((resp.wants_ratio ?? 0)*100)}% • Savings=${Math.round((resp.savings_ratio ?? 0)*100)}%
      </div>

      ${hasRicherFields ? `
        <div style="margin-top:10px"><b>Budget Health Score:</b> ${healthScore}/100</div>
        <div class="analysis" style="margin-top:6px">
          • Needs: ${needsStatus ?? '—'}
          <br/>• Wants: ${wantsStatus ?? '—'}
          <br/>• Savings: ${savingsStatus ?? '—'}
        </div>
      ` : ''}
    </div>
  `;

  const r = $('budgetRecommendations');
  if(Array.isArray(recommendations) && recommendations.length){
    r.innerHTML = `
      <div>
        ${resp.suggestion ? `<div style="margin-bottom:10px">${resp.suggestion}</div>` : ''}
        <div><b>Top Recommendations</b></div>
        <ul class="bullets">
          ${recommendations.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}
        </ul>
      </div>
    `;
  }else{
    r.innerHTML = resp.suggestion ? `<div>${resp.suggestion}</div>` : '';
  }
}

async function generateBudgetPlan(){
  const monthly_income = parseFloat($('incomeInput').value || '0');

  const rent = parseFloat($('needsInput').value || '0');
  const emi = parseFloat($('emiInput')?.value || '0');
  const food = parseFloat($('wantsInput').value || '0');
  const transport = parseFloat($('transportInput')?.value || '0');
  const subscriptions = parseFloat($('subscriptionsInput')?.value || '0');
  const other_expenses = parseFloat($('otherExpensesInput')?.value || '0');
  const savings = parseFloat($('savingsInput').value || '0');

  // 50/30/20 mapping:
  // - Needs (50%): Rent + EMI
  // - Wants (30%): Food + Transport + Subscriptions + Other Expenses
  const needs = rent + emi;
  const wants = food + transport + subscriptions + other_expenses;

  try{
    $('generateBudgetBtn').disabled = true;
    const resp = await apiBudgetCalc({ monthly_income, needs, wants, savings });
    renderBudget({monthly_income, needs, wants, savings}, resp);
  }catch(e){
    $('budgetRecommendations').innerHTML =
      'Error calculating budget. ' +
      (e && e.message ? e.message : 'Unknown error');
  }finally{
    $('generateBudgetBtn').disabled = false;
  }
}


let __vizCharts = null;

function safeDestroyVizCharts(){
  if(__vizCharts && Array.isArray(__vizCharts)){
    __vizCharts.forEach(c=>{
      try{ c && c.destroy && c.destroy(); }catch(e){}
    });
  }
  __vizCharts = null;
}

function renderViz(){
  const pieCtx = $('pieChart');
  const barCtx = $('barChart');
  const lineCtx = $('lineChart');
  if(!pieCtx || !barCtx || !lineCtx) return;

  // Demo data (used by charts and analysis)
  const catLabels = ['Rent/Housing','Food','Transport','Utilities','Shopping','Entertainment','Savings'];
  const catValues = [24000,14000,6000,4000,3000,2000,10000];

  const wantsExpense = 3000 + 2000 + 14000; // Shopping + Entertainment + Food (demo)
  const needsExpense = 24000 + 6000 + 4000; // Rent + Transport + Utilities (demo)
  const savingsExpense = 10000;
  const total = wantsExpense + needsExpense + savingsExpense;

  safeDestroyVizCharts();

  // Give the browser a beat to lay out the visible view.
  requestAnimationFrame(()=>{
    requestAnimationFrame(()=>{
      const charts = [];

      charts.push(new Chart(pieCtx, {
        type:'pie',
        data:{
          labels: catLabels,
          datasets:[{data: catValues, backgroundColor:[
            'rgba(45,212,191,.85)','rgba(34,197,94,.75)','rgba(56,189,248,.75)',
            'rgba(59,130,246,.65)','rgba(99,102,241,.65)','rgba(236,72,153,.55)','rgba(255,255,255,.15)'
          ], borderWidth:1, borderColor:'rgba(255,255,255,.2)'}]
        },
        options:{plugins:{legend:{labels:{color:'rgba(234,243,255,.85)'}}}
        }
      }));

      charts.push(new Chart(barCtx, {
        type:'bar',
        data:{
          labels:['Needs','Wants','Savings'],
          datasets:[{label:'₹', data:[needsExpense, wantsExpense, savingsExpense], backgroundColor:['rgba(45,212,191,.55)','rgba(56,189,248,.55)','rgba(34,197,94,.55)'], borderColor:'rgba(255,255,255,.2)', borderWidth:1}]
        },
        options:{plugins:{legend:{labels:{color:'rgba(234,243,255,.85)'}}},
          scales:{x:{ticks:{color:'rgba(234,243,255,.85)'}}, y:{ticks:{color:'rgba(234,243,255,.85)'}}}
        }
      }));

      charts.push(new Chart(lineCtx, {
        type:'line',
        data:{
          labels:['Jan','Feb','Mar','Apr','May','Jun'],
          datasets:[{label:'Savings (₹)', data:[7000,8200,7600,8800,9200,10000], borderColor:'rgba(45,212,191,.95)', backgroundColor:'rgba(45,212,191,.15)', tension:.35, fill:true}]
        },
        options:{plugins:{legend:{labels:{color:'rgba(234,243,255,.85)'}}},
          scales:{x:{ticks:{color:'rgba(234,243,255,.85)'}}, y:{ticks:{color:'rgba(234,243,255,.85)'}}}
        }
      }));

      __vizCharts = charts;

      // Force a resize after initial draw so it fills the card properly.
      charts.forEach(c=>{ try{ c.resize && c.resize(); }catch(e){} });

      // Category analysis (computed from demo data)
      const analysis = $('categoryAnalysis');
      if(analysis){
        const pairs = catLabels.map((l,i)=>({label:l, value:catValues[i]}));
        const sortedDesc = [...pairs].sort((a,b)=>b.value-a.value);
        const sortedAsc = [...pairs].sort((a,b)=>a.value-b.value);

        const top3 = sortedDesc.slice(0,3);
        const lowest = sortedAsc[0];

        const wantsShare = total > 0 ? (wantsExpense/total)*100 : 0;
        const needsShare = total > 0 ? (needsExpense/total)*100 : 0;
        const savingsShare = total > 0 ? (savingsExpense/total)*100 : 0;

        const top3Text = top3.map(x=>`• ${x.label}: ₹${x.value.toLocaleString('en-IN')}`).join('<br/>');

        analysis.innerHTML = `
          <div><b>Top spending categories</b></div>
          <div class="analysis">${top3Text}</div>
          <div style="margin-top:10px"><b>Lowest category</b></div>
          <div class="analysis">• ${lowest.label}: ₹${lowest.value.toLocaleString('en-IN')}</div>
          <div style="margin-top:10px"><b>Essentials vs discretionary vs savings</b></div>
          <div class="analysis">
            • Needs: ${needsShare.toFixed(0)}% • Wants: ${wantsShare.toFixed(0)}% • Savings: ${savingsShare.toFixed(0)}%
          </div>
          <div style="margin-top:10px" class="analysis">
            • Savings trend looks steady in the demo dataset. Use real transaction data to verify if this holds.
          </div>
          <div style="margin-top:10px" class="analysis">
            • Next step: track expenses for 30 days to replace demo values with your numbers.
          </div>
        `;
      }
    });
  });
}


async function init(){
  renderPopularPills();

  document.querySelectorAll('.nav-item').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const page = btn.dataset.page;
      setActivePage(page);

      // load viz when needed
      if(page === 'viz'){
        renderViz();
      } else {

        // avoid hidden-view chart drawing issues when switching away
        safeDestroyVizCharts();
      }

      if(page === 'topics'){

        $('topicSearch').value='';
      }
    });
  });

  window.addEventListener('resize', ()=>{
    if(__vizCharts && pageCache && pageCache === 'viz'){
      __vizCharts.forEach(c=>{ try{ c.resize && c.resize(); }catch(e){} });
    }
  });

  $('newChatBtn').addEventListener('click', ()=>{

    $('chatArea').innerHTML='';
    $('welcomeScreen').classList.remove('hidden');
    $('messageInput').value='';
    toast('New chat started');
    setActivePage('chat');
  });

$('sendBtn').addEventListener('click', sendMessage);

  // History init
  loadHistory();
  renderHistory();

  $('clearHistoryBtn')?.addEventListener('click', ()=>{
    clearHistory();
    toast('History deleted');
  });


  $('voiceBtn').addEventListener('click', ()=> toast('Voice input not implemented (UI-only)'));

  $('attachBtn').addEventListener('click', ()=> uploadAndAsk());


  $('messageInput').addEventListener('input', (e)=> autosizeTextArea(e.target));
  $('messageInput').addEventListener('keydown', (e)=>{
    if(e.key === 'Enter' && !e.shiftKey){
      e.preventDefault();
      sendMessage();
    }
  });

  document.querySelectorAll('[data-suggest]').forEach(b=>{
    b.addEventListener('click', ()=>{
      setActivePage('chat');
      $('messageInput').value = b.dataset.suggest;
      sendMessage();
    });
  });

  $('generateBudgetBtn').addEventListener('click', generateBudgetPlan);

  // Budget stepper controls (+/-)
  document.querySelectorAll('[data-stepper]').forEach(stepper => {
    const input = stepper.querySelector('input[type="number"]');
    const minusBtn = stepper.querySelector('[data-step="-"]');
    const plusBtn = stepper.querySelector('[data-step="+"]');
    if(!input) return;

    const stepSize = () => {
      const s = parseFloat(input.getAttribute('step') || '1');
      return Number.isFinite(s) ? s : 1;
    };

    function clampAndSet(next){
      const min = parseFloat(input.getAttribute('min') || '0');
      const value = Math.max(Number.isFinite(min) ? min : 0, next);
      input.value = String(Math.max(0, value));
    }

    function step(delta){
      const current = parseFloat(input.value || '0');
      const next = current + (stepSize() * delta);
      clampAndSet(next);
    }

    minusBtn?.addEventListener('click', ()=> step(-1));
    plusBtn?.addEventListener('click', ()=> step(1));
  });


  $('topicSearch').addEventListener('input', async ()=>{
    const topicsData = await window.__topics;
    renderTopics(topicsData);

    // Ensure scroll height updates after filtering.
    const grid = $('topicsGrid');
    if(grid){
      requestAnimationFrame(()=>{ try{ grid.scrollTop = 0; }catch(e){} });
    }
  });


  $('logoutBtn').addEventListener('click', ()=>{
    // UI-only logout: reset chat and return to chat view.
    try{
      $('chatArea').innerHTML = '';
      $('welcomeScreen').classList.remove('hidden');
      $('messageInput').value = '';
    }catch(e){}
    setActivePage('chat');
    toast('Logged out (UI reset)');
  });

  $('settingsBtn').addEventListener('click', ()=> toast('Settings is UI-only'));

  // Topbar switching logic: Budget Calculator keeps chat view visible, right panel opens.
  setActivePage('chat');

  $('topicsGrid').innerHTML = `
    <div class="analysis" style="padding:14px; opacity:.9">
      Loading topics...
    </div>
  `;

  // Fix for topics scroll: when switching to topics view, force layout/height recompute.
  const originalSetActivePage = setActivePage;
  setActivePage = function(page){
    originalSetActivePage(page);
    if(page === 'topics'){
      const grid = $('topicsGrid');
      const view = document.querySelector('[data-view="topics"]');
      if(grid && view){
        requestAnimationFrame(()=>{
          requestAnimationFrame(()=>{
            try{
              // Ensure content can scroll inside the topics view.
              view.style.overflow = 'auto';
              grid.style.flex = '1';
              // Keep current position if user is scrolling; otherwise go to top.
              if(grid.scrollTop < 5) grid.scrollTop = 0;
            }catch(e){}
          });
        });
      }
    }
  };


  try{
    const data = await apiGetTopics();
    window.__topics = data.topics || [];
    if(window.__topics.length){
      renderTopics(window.__topics);
    } else {
      $('topicsGrid').innerHTML = `
        <div class="glass card" style="padding:14px;">
          <div class="card-title">No topics available</div>
          <div class="analysis" style="margin-top:6px;">Backend returned an empty topics list.</div>
          <div class="analysis" style="margin-top:10px; opacity:.9">
            Check backend/data/finance_knowledge.json has a <code>topics</code> array.
          </div>
        </div>
      `;
    }
  }catch(e){
    // Make the failure visible + actionable for debugging.
    const msg = (e && e.message) ? e.message : String(e);
    const grid = $('topicsGrid');
    if(grid){
      grid.innerHTML = `
        <div class="glass card" style="padding:14px;">
          <div class="card-title">Topics could not load</div>
          <div class="analysis" style="margin-top:6px;">
            ${escapeHtml(msg)}
          </div>
          <div class="analysis" style="margin-top:10px; opacity:.9">
            Check that the backend is running at <b>${escapeHtml(API_BASE)}</b> and that <code>/api/topics</code> is reachable.
          </div>
        </div>
      `;
    }
    toast('Could not load topics from backend');
  }



  // Initial budget recommendations are not shown until user generates plan.
}

window.addEventListener('load', init);

