// Leonida Legend — guide & tracker behaviour.
// Runs entirely on the reader's machine: the trophy list ships beside this file,
// progress is stored in localStorage, and export/import move it as a JSON file.

const STORAGE_KEY = 'leonida-legend-tracker-v1';
const RING_CIRCUMFERENCE = 320.4; // 2 * pi * 51, the dashboard dial's radius

const KIND_NAMES = {
  story: 'Story',
  side: 'Side strands',
  activities: 'Activities',
  world: 'World & collectibles',
  crime: 'Crime',
  money: 'Money',
  secrets: 'Secrets',
  completion: 'Completion',
};

const GRADE_ORDER = ['platinum', 'gold', 'silver', 'bronze'];
const GRADE_RANK = { platinum: 0, gold: 1, silver: 2, bronze: 3 };

const el = {
  cards: document.getElementById('cards'),
  tpl: document.getElementById('cardTpl'),
  q: document.getElementById('q'),
  status: document.getElementById('statusSel'),
  sort: document.getElementById('sortSel'),
  gradeChips: document.getElementById('gradeChips'),
  kindChips: document.getElementById('kindChips'),
  shield: document.getElementById('shieldToggle'),
  shieldNote: document.getElementById('shieldNote'),
  headline: document.getElementById('dashHeadline'),
  sub: document.getElementById('dashSub'),
  pills: document.getElementById('gradePills'),
  meter: document.getElementById('meterFill'),
  dialArc: document.getElementById('dialArc'),
  dialPct: document.getElementById('dialPct'),
  nextUp: document.getElementById('nextUp'),
  heading: document.getElementById('listHeading'),
  meta: document.getElementById('listMeta'),
  noMatch: document.getElementById('noMatch'),
  toolMsg: document.getElementById('toolMsg'),
  file: document.getElementById('importFile'),
};

function readState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return {
      earned: new Set(Array.isArray(raw.earned) ? raw.earned : []),
      revealed: new Set(Array.isArray(raw.revealed) ? raw.revealed : []),
      shield: raw.shield !== false,
    };
  } catch {
    return { earned: new Set(), revealed: new Set(), shield: true };
  }
}

const state = readState();
const expandedGuides = new Set();
let allTrophies = [];
let activeGrade = 'all';
let activeKind = 'all';

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    earned: [...state.earned],
    revealed: [...state.revealed],
    shield: state.shield,
  }));
}

function makeChip(text, value, group, current) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'chip' + (group === 'grade' && value !== 'all' ? ' g-' + value : '');
  b.textContent = text;
  b.setAttribute('aria-pressed', String(current === value));
  b.addEventListener('click', () => {
    if (group === 'grade') activeGrade = value;
    else activeKind = value;
    drawChips();
    drawCards();
  });
  return b;
}

function drawChips() {
  el.gradeChips.replaceChildren(
    makeChip('All grades', 'all', 'grade', activeGrade),
    ...GRADE_ORDER.map((g) => makeChip(g[0].toUpperCase() + g.slice(1), g, 'grade', activeGrade)),
  );
  const kindsPresent = [...new Set(allTrophies.map((t) => t.kind))];
  el.kindChips.replaceChildren(
    makeChip('All kinds', 'all', 'kind', activeKind),
    ...kindsPresent.map((k) => makeChip(KIND_NAMES[k] ?? k, k, 'kind', activeKind)),
  );
}

function shielded(t) {
  return state.shield && t.spoiler && !state.revealed.has(t.id);
}

function filtered() {
  const needle = el.q.value.trim().toLowerCase();
  const list = allTrophies.filter((t) => {
    if (activeGrade !== 'all' && t.grade !== activeGrade) return false;
    if (activeKind !== 'all' && t.kind !== activeKind) return false;
    if (el.status.value === 'done' && !state.earned.has(t.id)) return false;
    if (el.status.value === 'todo' && state.earned.has(t.id)) return false;
    if (needle) {
      const haystack = `${t.name} ${t.description} ${t.guide} ${KIND_NAMES[t.kind] ?? ''}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
  const mode = el.sort.value;
  if (mode === 'grade') list.sort((a, b) => GRADE_RANK[a.grade] - GRADE_RANK[b.grade] || a.id - b.id);
  else if (mode === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
  else if (mode === 'todo') list.sort((a, b) => Number(state.earned.has(a.id)) - Number(state.earned.has(b.id)) || a.id - b.id);
  else list.sort((a, b) => a.id - b.id);
  return list;
}

function drawDashboard() {
  const total = allTrophies.length;
  const done = state.earned.size;
  const pct = total ? Math.round((done / total) * 100) : 0;
  el.headline.textContent = `${done} of ${total} trophies earned`;
  el.sub.textContent =
    done === 0 ? 'Your legend starts with a single tick. The maths above keeps itself.'
    : done === total ? 'Every last one of them. You are, officially, a Leonida Legend.'
    : done === total - 1 ? 'One to go — the platinum is already clearing its throat.'
    : 'Good momentum. The sunset is not going anywhere, and neither is that platinum.';
  el.dialPct.textContent = `${pct}%`;
  el.dialArc.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - (total ? done / total : 0)));
  el.meter.style.width = `${pct}%`;
  el.pills.replaceChildren(...GRADE_ORDER.map((g) => {
    const inGrade = allTrophies.filter((t) => t.grade === g);
    const got = inGrade.filter((t) => state.earned.has(t.id)).length;
    const span = document.createElement('span');
    span.className = `pill ${g}`;
    span.textContent = `${g[0].toUpperCase() + g.slice(1)} ${got}/${inGrade.length}`;
    return span;
  }));
  const next = allTrophies.find((t) => !state.earned.has(t.id));
  el.nextUp.textContent = next
    ? `Next up on the official list: ${next.name} — ${next.description}`
    : 'Nothing left on the list. Frame this page.';
}

function drawCards() {
  const list = filtered();
  el.cards.replaceChildren();
  for (const t of list) {
    const frag = el.tpl.content.cloneNode(true);
    const card = frag.querySelector('.card');
    const hidden = shielded(t);
    card.classList.add('grade-' + t.grade);
    if (state.earned.has(t.id)) card.classList.add('is-earned');
    if (hidden) card.classList.add('is-shielded');
    frag.querySelector('.badge').classList.add(t.grade);
    frag.querySelector('h3').textContent = hidden ? 'Hidden trophy' : t.name;
    frag.querySelector('.meta').textContent =
      `${t.grade} · ${KIND_NAMES[t.kind] ?? t.kind} · #${t.id} of 55`;
    frag.querySelector('.desc').textContent = hidden ? '• • • • • • • •' : t.description;
    const veil = frag.querySelector('.veil');
    veil.hidden = !hidden;
    if (hidden) {
      frag.querySelector('.reveal-btn').addEventListener('click', () => {
        state.revealed.add(t.id);
        persist();
        drawCards();
      });
    }
    const howto = frag.querySelector('.howto');
    howto.querySelector('p').textContent = t.guide;
    howto.open = expandedGuides.has(t.id);
    howto.addEventListener('toggle', () => {
      if (howto.open) expandedGuides.add(t.id);
      else expandedGuides.delete(t.id);
    });
    const box = frag.querySelector('.check input');
    box.checked = state.earned.has(t.id);
    box.setAttribute('aria-label', `Mark ${t.name} as earned`);
    box.addEventListener('change', () => {
      if (box.checked) state.earned.add(t.id);
      else state.earned.delete(t.id);
      persist();
      drawDashboard();
      drawCards();
    });
    el.cards.append(frag);
  }
  el.noMatch.hidden = list.length > 0;
  el.meta.textContent = `Showing ${list.length} of ${allTrophies.length}`;
  el.heading.textContent =
    activeGrade !== 'all' ? `${activeGrade[0].toUpperCase() + activeGrade.slice(1)} trophies`
    : activeKind !== 'all' ? `${KIND_NAMES[activeKind] ?? activeKind} trophies`
    : 'All 55 trophies';
}

function drawShield() {
  el.shield.checked = state.shield;
  el.shieldNote.textContent = state.shield
    ? 'On — story and secret trophies stay hidden until you reveal them'
    : 'Off — everything is out in the open, spoilers and all';
}

function exportProgress() {
  const payload = {
    game: 'Grand Theft Auto VI',
    platform: 'PlayStation 5',
    tool: 'Leonida Legend — GTA VI trophy tracker',
    exported_at: new Date().toISOString(),
    earned: [...state.earned].sort((a, b) => a - b),
  };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  a.download = 'gta6-trophy-progress.json';
  a.click();
  URL.revokeObjectURL(a.href);
  el.toolMsg.textContent = `Exported ${state.earned.size} earned trophies. Keep the file safe — it is your whole checklist.`;
}

async function importProgress(file) {
  try {
    const data = JSON.parse(await file.text());
    const raw = Array.isArray(data) ? data : data.earned;
    if (!Array.isArray(raw)) throw new Error('no earned list in file');
    const idByName = new Map(allTrophies.map((t) => [t.name.toLowerCase(), t.id]));
    const restored = new Set();
    for (const item of raw) {
      if (typeof item === 'number' && allTrophies.some((t) => t.id === item)) restored.add(item);
      else if (typeof item === 'string' && idByName.has(item.toLowerCase())) restored.add(idByName.get(item.toLowerCase()));
    }
    state.earned = restored;
    persist();
    drawDashboard();
    drawCards();
    el.toolMsg.textContent = `Import complete: ${restored.size} earned trophies restored from the file.`;
  } catch {
    el.toolMsg.textContent = 'That file did not parse as trophy progress, so nothing was changed.';
  }
}

async function boot() {
  const res = await fetch('data/trophies.json');
  const doc = await res.json();
  allTrophies = doc.trophies;
  drawChips();
  drawShield();
  drawDashboard();
  drawCards();
}

el.q.addEventListener('input', drawCards);
el.status.addEventListener('change', drawCards);
el.sort.addEventListener('change', drawCards);
el.shield.addEventListener('change', () => {
  state.shield = el.shield.checked;
  persist();
  drawShield();
  drawCards();
});
document.getElementById('exportBtn').addEventListener('click', exportProgress);
document.getElementById('importBtn').addEventListener('click', () => el.file.click());
el.file.addEventListener('change', () => {
  const f = el.file.files[0];
  if (f) importProgress(f);
  el.file.value = '';
});
document.getElementById('resetBtn').addEventListener('click', () => {
  if (!confirm('Reset the whole checklist? Exported files stay safe, but this browser copy goes back to zero.')) return;
  state.earned = new Set();
  state.revealed = new Set();
  persist();
  drawDashboard();
  drawCards();
  el.toolMsg.textContent = 'Checklist reset. A fresh sunset, a fresh start.';
});

boot();
