const LS_KEY = 'sb_leaderboard_v1';
let room = null;
let currentUser = null;
let myRecord = null;

function getLocalScores() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch { return []; }
}
function saveLocalScores(arr) { localStorage.setItem(LS_KEY, JSON.stringify(arr)); }
export function addLocalScore(score) {
  const arr = getLocalScores();
  arr.push({ score, at: Date.now() });
  arr.sort((a,b)=>b.score-a.score);
  saveLocalScores(arr.slice(0, 50));
  renderLocal();
}
function renderLocal() {
  const list = document.getElementById('local-scores'); if (!list) return;
  const arr = getLocalScores().slice(0, 10);
  list.innerHTML = '';
  arr.forEach((e,i)=>{
    const li = document.createElement('li');
    const d = new Date(e.at);
    li.textContent = `${e.score} — ${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
    list.appendChild(li);
  });
}
function renderGlobalFromRecords(records) {
  const list = document.getElementById('global-scores'); if (!list) return;
  const items = [];
  for (const r of records) {
    try {
      const data = JSON.parse(r.data || '{}');
      if (typeof data.highScore === 'number') {
        items.push({ user: r.username, score: data.highScore });
      }
    } catch {}
  }
  items.sort((a,b)=>b.score-a.score);
  list.innerHTML = '';
  items.slice(0, 10).forEach((e,i)=>{
    const li = document.createElement('li');
    li.textContent = `${e.user}: ${e.score}`;
    list.appendChild(li);
  });
}
async function ensureRoom() {
  if (!room) room = new WebsimSocket();
  if (!currentUser) currentUser = await window.websim.getCurrentUser();
}
async function ensureMyRecord() {
  await ensureRoom();
  const coll = room.collection('player_v1');
  const list = coll.filter({ username: currentUser.username }).getList();
  if (list.length === 0) {
    myRecord = await coll.create({ data: JSON.stringify({ highScore: 0, recent: [] }) });
  } else {
    myRecord = list[0];
  }
}
export async function submitScoreToDB(score) {
  try {
    await ensureMyRecord();
    const coll = room.collection('player_v1');
    let data = {};
    try { data = JSON.parse(myRecord.data || '{}'); } catch { data = {}; }
    const recent = Array.isArray(data.recent) ? data.recent : [];
    recent.unshift({ score, at: Date.now() });
    const highScore = Math.max(Number(data.highScore||0), score);
    const newData = { highScore, recent: recent.slice(0, 50) };
    await coll.update(myRecord.id, { data: JSON.stringify(newData) });
    // refresh myRecord
    const updated = coll.filter({ username: currentUser.username }).getList();
    myRecord = updated[0] || myRecord;
  } catch (e) {
    console.warn('Submit failed:', e);
  }
}
async function subscribeGlobal() {
  await ensureRoom();
  const coll = room.collection('player_v1');
  coll.subscribe(renderGlobalFromRecords);
  renderGlobalFromRecords(coll.getList());
}
function bindModal() {
  const btn = document.getElementById('leaderboard-button');
  const modal = document.getElementById('leaderboard-modal');
  const close = document.getElementById('lb-close');
  if (btn && modal && close) {
    btn.addEventListener('click', ()=>{ renderLocal(); modal.classList.remove('hidden'); });
    close.addEventListener('click', ()=> modal.classList.add('hidden'))
  }
}
function bindSubmit() {
  const submit = document.getElementById('submit-score-btn');
  submit?.addEventListener('click', async ()=>{
    submit.disabled = true;
    const scoreText = document.getElementById('final-score')?.textContent || '0';
    const score = parseInt(scoreText, 10) || 0;
    await submitScoreToDB(score);
    // open modal to show updated global
    document.getElementById('leaderboard-modal')?.classList.remove('hidden');
  });
}
window.addEventListener('DOMContentLoaded', () => {
  bindModal();
  bindSubmit();
  renderLocal();
  subscribeGlobal();
});