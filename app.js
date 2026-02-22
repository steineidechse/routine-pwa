/* Routine PWA – IndexedDB (Bilder als Blobs), Kind-Modus, Auto-Reset täglich, Sternenschauer
   + Export/Import als Datei (.json) inkl. Bilder (Base64 DataURLs)
   + Belohnungs-Screen wenn Routine komplett */

const ROUTINES = [
  { id: "MORNING", icon: "🌞", defaultTitle: "Morgen" },
  { id: "EVENING", icon: "🌙", defaultTitle: "Abend" },
  { id: "WEEKEND", icon: "🛋️", defaultTitle: "Wochenende" },
];

const todayISO = () => new Date().toISOString().slice(0, 10);

const $ = (id) => document.getElementById(id);
const app = $("app");

const backBtn = $("backBtn");
const editBtn = $("editBtn");
const resetBtn = $("resetBtn");
const saveBtn = $("saveBtn");
const addBtn  = $("addBtn");
const exportBtn = $("exportBtn");
const importBtn = $("importBtn");
const titleEl = $("title");

const sparkles = $("sparkles");

// ---------- Small CSS injection (so we don't need index.html changes) ----------
function injectRewardStyles() {
  const css = `
  .rewardOverlay{
    position:fixed; inset:0; z-index:2000;
    background: rgba(0,0,0,.55);
    display:flex; align-items:center; justify-content:center;
    padding:18px;
  }
  .rewardCard{
    width:min(560px, 100%);
    border-radius:22px;
    background:#fff;
    border:1px solid rgba(0,0,0,.08);
    box-shadow: 0 18px 50px rgba(0,0,0,.22);
    padding:18px;
    text-align:center;
  }
  .rewardTitle{
    font-size:22px; font-weight:900; margin:8px 0 6px 0;
  }
  .rewardSub{
    font-size:14px; opacity:.75; margin:0 0 14px 0;
  }
  .rewardBig{
    font-size:56px; line-height:1; margin:8px 0 12px 0;
  }
  .rewardBtns{
    display:flex; gap:10px; justify-content:center; flex-wrap:wrap;
    margin-top:10px;
  }
  .rewardBtn{
    border:1px solid #e6e6e6;
    background:#fff;
    padding:10px 14px;
    border-radius:14px;
    font-weight:800;
  }
  .rewardBtn.primary{
    background:#111; color:#fff; border-color:#111;
  }
  .confetti{
    position:fixed; inset:0; pointer-events:none; z-index:2100;
  }
  .conf{
    position:absolute; width:10px; height:10px; opacity:0;
    transform: translate(-50%,-50%);
    animation: confPop 950ms ease-out forwards;
  }
  .conf::before{
    content:"✦";
    font-size:18px;
    display:block;
    filter: drop-shadow(0 6px 14px rgba(0,0,0,.18));
  }
  @keyframes confPop{
    0%{ opacity:0; transform: translate(-50%,-50%) scale(.7); }
    10%{ opacity:1; }
    100%{ opacity:0; transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) rotate(25deg) scale(1.4); }
  }
  `;
  const el = document.createElement("style");
  el.textContent = css;
  document.head.appendChild(el);
}

// ---------- IndexedDB ----------
const DB_NAME = "routinepwa";
const DB_VER  = 1;
let db;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains("kv")) d.createObjectStore("kv");
      if (!d.objectStoreNames.contains("images")) d.createObjectStore("images");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function kvGet(key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("kv", "readonly");
    const st = tx.objectStore("kv");
    const r = st.get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
function kvSet(key, val) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("kv", "readwrite");
    const st = tx.objectStore("kv");
    const r = st.put(val, key);
    r.onsuccess = () => resolve(true);
    r.onerror = () => reject(r.error);
  });
}
function kvClear() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("kv", "readwrite");
    const st = tx.objectStore("kv");
    const r = st.clear();
    r.onsuccess = () => resolve(true);
    r.onerror = () => reject(r.error);
  });
}

function imgPut(blob) {
  const id = crypto.randomUUID();
  return imgPutWithId(id, blob).then(() => id);
}
function imgPutWithId(id, blob) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("images", "readwrite");
    const st = tx.objectStore("images");
    const r = st.put(blob, id);
    r.onsuccess = () => resolve(true);
    r.onerror = () => reject(r.error);
  });
}
function imgGet(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("images", "readonly");
    const st = tx.objectStore("images");
    const r = st.get(id);
    r.onsuccess = () => resolve(r.result || null);
    r.onerror = () => reject(r.error);
  });
}
function imgDel(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("images", "readwrite");
    const st = tx.objectStore("images");
    const r = st.delete(id);
    r.onsuccess = () => resolve(true);
    r.onerror = () => reject(r.error);
  });
}
function imgClear() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("images", "readwrite");
    const st = tx.objectStore("images");
    const r = st.clear();
    r.onsuccess = () => resolve(true);
    r.onerror = () => reject(r.error);
  });
}
function imgKeys() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("images", "readonly");
    const st = tx.objectStore("images");
    if (st.getAllKeys) {
      const r = st.getAllKeys();
      r.onsuccess = () => resolve(r.result || []);
      r.onerror = () => reject(r.error);
    } else {
      const keys = [];
      const cursorReq = st.openCursor();
      cursorReq.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) { keys.push(cursor.key); cursor.continue(); }
        else resolve(keys);
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    }
  });
}

// ---------- Store ----------
const STORE_KEY = "store_v1";

function defaultStore() {
  return {
    routines: {
      MORNING: {
        id: "MORNING",
        title: "Morgen",
        kidMode: false,
        autoResetDaily: true,
        rewardEnabled: true, // NEW (optional)
        progress: { lastDateIso: null, doneIds: [] },
        items: [
          { id: "wake", title: "Aufstehen", imageId: null },
          { id: "toilet", title: "Toilette", imageId: null },
          { id: "wash", title: "Waschen", imageId: null },
          { id: "teeth", title: "Zähne putzen", imageId: null },
          { id: "dress", title: "Anziehen", imageId: null },
          { id: "breakfast", title: "Frühstück", imageId: null },
          { id: "bag", title: "Tasche packen", imageId: null },
        ]
      },
      EVENING: {
        id: "EVENING",
        title: "Abend",
        kidMode: false,
        autoResetDaily: true,
        rewardEnabled: true, // NEW (optional)
        progress: { lastDateIso: null, doneIds: [] },
        items: [
          { id: "dinner", title: "Abendessen", imageId: null },
          { id: "tidy", title: "Aufräumen", imageId: null },
          { id: "bath", title: "Duschen / Baden", imageId: null },
          { id: "pajamas", title: "Pyjama an", imageId: null },
          { id: "teeth", title: "Zähne putzen", imageId: null },
          { id: "story", title: "Geschichte", imageId: null },
          { id: "sleep", title: "Schlafen", imageId: null },
        ]
      },
      WEEKEND: {
        id: "WEEKEND",
        title: "Wochenende",
        kidMode: false,
        autoResetDaily: true,
        rewardEnabled: true, // NEW (optional)
        progress: { lastDateIso: null, doneIds: [] },
        items: [
          { id: "slowbreak", title: "Langsam frühstücken", imageId: null },
          { id: "out", title: "Rausgehen", imageId: null },
          { id: "play", title: "Spielen", imageId: null },
          { id: "family", title: "Familienzeit", imageId: null },
          { id: "help", title: "Mithelfen", imageId: null },
          { id: "rest", title: "Pause / Ruhe", imageId: null },
        ]
      }
    }
  };
}

// Migration: makes older stores/backups compatible (fills missing fields)
function migrateStore(s) {
  if (!s || typeof s !== "object") return defaultStore();
  if (!s.routines || typeof s.routines !== "object") return defaultStore();

  for (const rid of Object.keys(s.routines)) {
    const r = s.routines[rid];
    if (!r || typeof r !== "object") continue;

    if (typeof r.kidMode !== "boolean") r.kidMode = false;
    if (typeof r.autoResetDaily !== "boolean") r.autoResetDaily = true;

    // NEW optional field
    if (typeof r.rewardEnabled !== "boolean") r.rewardEnabled = true;

    if (!r.progress || typeof r.progress !== "object") r.progress = { lastDateIso: null, doneIds: [] };
    if (!Array.isArray(r.progress.doneIds)) r.progress.doneIds = [];
    if (typeof r.progress.lastDateIso !== "string" && r.progress.lastDateIso !== null) r.progress.lastDateIso = null;

    if (!Array.isArray(r.items)) r.items = [];
    for (const it of r.items) {
      if (!it || typeof it !== "object") continue;
      if (typeof it.id !== "string") it.id = crypto.randomUUID();
      if (typeof it.title !== "string") it.title = "Item";
      if (typeof it.imageId !== "string") it.imageId = null;
    }
  }
  return s;
}

let store;
async function loadStore() {
  const raw = await kvGet(STORE_KEY);
  if (!raw) return defaultStore();
  try { return migrateStore(JSON.parse(raw)); } catch { return defaultStore(); }
}
async function saveStore() {
  await kvSet(STORE_KEY, JSON.stringify(store));
}

// ---------- Routing / State ----------
let view = "pick"; // pick | routine | edit
let currentRid = null;

function setHeader({ title, showBack, showEdit, showReset, showSave, showAdd, showExport, showImport }) {
  titleEl.textContent = title;
  backBtn.style.display = showBack ? "" : "none";
  editBtn.style.display = showEdit ? "" : "none";
  resetBtn.style.display = showReset ? "" : "none";
  saveBtn.style.display = showSave ? "" : "none";
  addBtn.style.display  = showAdd  ? "" : "none";
  exportBtn.style.display = showExport ? "" : "none";
  importBtn.style.display = showImport ? "" : "none";
}

// ---------- Sparkles ----------
function triggerSparkles() {
  if (!sparkles) return;
  sparkles.innerHTML = "";
  sparkles.style.display = "block";
  const n = 48;
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 3;

  for (let i = 0; i < n; i++) {
    const el = document.createElement("div");
    el.className = "spark";
    const dx = (Math.random() - 0.5) * 340;
    const dy = (Math.random() - 0.5) * 460;
    el.style.left = `${cx + (Math.random()-0.5)*80}px`;
    el.style.top  = `${cy + (Math.random()-0.5)*80}px`;
    el.style.setProperty("--dx", `${dx}px`);
    el.style.setProperty("--dy", `${dy}px`);
    sparkles.appendChild(el);
  }
  setTimeout(() => { sparkles.style.display = "none"; }, 680);
}

// ---------- Reward Screen ----------
function confettiBurst() {
  const layer = document.createElement("div");
  layer.className = "confetti";
  document.body.appendChild(layer);

  const n = 80;
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 3;

  for (let i = 0; i < n; i++) {
    const el = document.createElement("div");
    el.className = "conf";
    const dx = (Math.random() - 0.5) * 560;
    const dy = (Math.random() - 0.5) * 760;
    el.style.left = `${cx + (Math.random()-0.5)*120}px`;
    el.style.top  = `${cy + (Math.random()-0.5)*120}px`;
    el.style.setProperty("--dx", `${dx}px`);
    el.style.setProperty("--dy", `${dy}px`);
    layer.appendChild(el);
  }

  setTimeout(() => layer.remove(), 1100);
}

function showRewardScreen({ title, onAgain, onHome }) {
  // avoid duplicate overlays
  const existing = document.getElementById("rewardOverlay");
  if (existing) existing.remove();

  confettiBurst();

  const overlay = document.createElement("div");
  overlay.className = "rewardOverlay";
  overlay.id = "rewardOverlay";

  overlay.innerHTML = `
    <div class="rewardCard" role="dialog" aria-modal="true">
      <div class="rewardBig">🏆</div>
      <div class="rewardTitle">Alles geschafft!</div>
      <p class="rewardSub">${escapeHtml(title)} ist komplett erledigt.</p>
      <div class="rewardBtns">
        <button class="rewardBtn primary" id="rewardAgain">Nochmal</button>
        <button class="rewardBtn" id="rewardHome">Zur Auswahl</button>
      </div>
    </div>
  `;

  // click outside closes -> go home
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      overlay.remove();
      onHome?.();
    }
  });

  document.body.appendChild(overlay);

  overlay.querySelector("#rewardAgain").addEventListener("click", () => {
    overlay.remove();
    onAgain?.();
  });

  overlay.querySelector("#rewardHome").addEventListener("click", () => {
    overlay.remove();
    onHome?.();
  });
}

// ---------- Helpers ----------
function routineMeta(rid) {
  return ROUTINES.find(r => r.id === rid) || { icon: "✅", defaultTitle: rid };
}

function applyAutoReset(r) {
  if (!r.autoResetDaily) return false;
  const today = todayISO();
  if (r.progress.lastDateIso !== today) {
    r.progress = { lastDateIso: today, doneIds: [] };
    return true;
  }
  return false;
}

async function imageUrlFromId(imageId) {
  if (!imageId) return null;
  const blob = await imgGet(imageId);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

// ---------- Export / Import ----------
function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}

function dataURLToBlob(dataURL) {
  const [meta, base64] = dataURL.split(",");
  const mime = (meta.match(/data:(.*?);base64/) || [])[1] || "application/octet-stream";
  const bin = atob(base64);
  const len = bin.length;
  const u8 = new Uint8Array(len);
  for (let i = 0; i < len; i++) u8[i] = bin.charCodeAt(i);
  return new Blob([u8], { type: mime });
}

async function exportBackup() {
  const keys = await imgKeys();
  const images = {};
  for (const k of keys) {
    const blob = await imgGet(k);
    if (!blob) continue;
    images[k] = await blobToDataURL(blob);
  }

  const payload = {
    format: "routinepwa-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    store,
    images
  };

  const json = JSON.stringify(payload);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  const stamp = new Date().toISOString().replaceAll(":","-").slice(0,19);
  a.href = url;
  a.download = `routine-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function pickJSONFile() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = () => resolve(input.files?.[0] || null);
    input.click();
  });
}

async function importBackupFlow() {
  const file = await pickJSONFile();
  if (!file) return;

  const text = await file.text();
  let payload;
  try { payload = JSON.parse(text); }
  catch { alert("Import fehlgeschlagen: Datei ist kein gültiges JSON."); return; }

  if (!payload || payload.format !== "routinepwa-backup" || payload.version !== 1) {
    alert("Import fehlgeschlagen: Das sieht nicht nach einem Routine-PWA-Backup aus.");
    return;
  }

  const ok = confirm("Import überschreibt ALLE aktuellen Routinen & Bilder auf diesem Gerät. Fortfahren?");
  if (!ok) return;

  await kvClear();
  await imgClear();

  const images = payload.images || {};
  const ids = Object.keys(images);
  for (const id of ids) {
    const dataURL = images[id];
    if (typeof dataURL !== "string" || !dataURL.startsWith("data:")) continue;
    const blob = dataURLToBlob(dataURL);
    await imgPutWithId(id, blob);
  }

  store = migrateStore(payload.store || defaultStore());
  await saveStore();

  alert("Import fertig ✅");
  await renderPick();
}

// ---------- Views ----------
async function renderPick() {
  view = "pick"; currentRid = null;
  setHeader({
    title: "Routine auswählen",
    showBack:false, showEdit:false, showReset:false, showSave:false, showAdd:false,
    showExport:true, showImport:true
  });

  app.innerHTML = `
    <div class="grid" id="grid"></div>
    <p style="color:var(--muted);font-size:12px;margin-top:12px;">
      Tipp: <b>Long-Press</b> auf eine Kachel öffnet den Editor (praktisch bei Kind-Modus).
    </p>
  `;
  const grid = $("grid");

  for (const r of ROUTINES) {
    const data = store.routines[r.id];
    const kid = !!data.kidMode;

    const tile = document.createElement("div");
    tile.className = "tile";
    tile.innerHTML = `
      <div class="icon">${r.icon}</div>
      <div class="title">${escapeHtml(data.title || r.defaultTitle)}</div>
      <div class="sub">${kid ? "Kind-Modus aktiv" : ""}</div>
      <div class="row">
        <button class="btn primary">Start</button>
        <button class="btn">${kid ? "🔒" : "Bearbeiten"}</button>
      </div>
    `;

    tile.querySelector(".primary").addEventListener("click", () => {
      currentRid = r.id; renderRoutine();
    });

    tile.querySelectorAll(".btn")[1].addEventListener("click", () => {
      if (!kid) { currentRid = r.id; renderEdit(); }
    });

    attachLongPress(tile, () => { currentRid = r.id; renderEdit(); });
    grid.appendChild(tile);
  }
}

async function renderRoutine() {
  view = "routine";
  const r = store.routines[currentRid];
  const meta = routineMeta(currentRid);

  const resetHappened = applyAutoReset(r);
  if (resetHappened) await saveStore();

  const kid = !!r.kidMode;

  setHeader({
    title: r.title || meta.defaultTitle,
    showBack: !kid,
    showEdit: !kid,
    showReset: !kid,
    showSave: false,
    showAdd: false,
    showExport: false,
    showImport: false
  });

  const done = new Set(r.progress.doneIds || []);
  const items = r.items || [];

  app.innerHTML = `<div class="list" id="list"></div><div class="progress" id="prog"></div>`;
  const list = $("list");
  const prog = $("prog");

  async function rerenderProgress() {
    prog.textContent = `Fortschritt: ${done.size}/${items.length}`;
  }

  async function maybeReward() {
    if (!r.rewardEnabled) return;
    if (items.length > 0 && done.size === items.length) {
      showRewardScreen({
        title: r.title || meta.defaultTitle,
        onAgain: async () => {
          // reset progress
          r.progress = { lastDateIso: todayISO(), doneIds: [] };
          await saveStore();
          await renderRoutine();
        },
        onHome: async () => {
          await renderPick();
        }
      });
    }
  }

  for (const item of items) {
    const card = document.createElement("div");
    card.className = "card";
    if (done.has(item.id)) card.classList.add("done");

    const imgUrl = await imageUrlFromId(item.imageId);

    card.innerHTML = `
      <div class="imgbox">${imgUrl ? `<img alt="" />` : `<span style="font-size:22px;">🖼️</span>`}</div>
      <div class="meta">
        <p class="t">${escapeHtml(item.title)}</p>
        <p class="d">${done.has(item.id) ? "Erledigt" : "Antippen zum Bestätigen"}</p>
      </div>
      <div class="check">${done.has(item.id) ? "✓" : ""}</div>
    `;

    if (imgUrl) card.querySelector("img").src = imgUrl;

    card.addEventListener("click", async () => {
      if (!done.has(item.id)) {
        done.add(item.id);
        card.classList.add("done");
        card.querySelector(".d").textContent = "Erledigt";
        card.querySelector(".check").textContent = "✓";
        triggerSparkles();
        r.progress = { lastDateIso: todayISO(), doneIds: [...done] };
        await saveStore();
        await rerenderProgress();
        await maybeReward();
      } else {
        if (!kid) {
          done.delete(item.id);
          card.classList.remove("done");
          card.querySelector(".d").textContent = "Antippen zum Bestätigen";
          card.querySelector(".check").textContent = "";
          r.progress = { lastDateIso: todayISO(), doneIds: [...done] };
          await saveStore();
          await rerenderProgress();
        }
      }
    });

    list.appendChild(card);
  }

  await rerenderProgress();
  // in case user imported a completed routine
  await maybeReward();
}

async function renderEdit() {
  view = "edit";
  const r = store.routines[currentRid];
  const meta = routineMeta(currentRid);

  setHeader({
    title: `Bearbeiten: ${r.title || meta.defaultTitle}`,
    showBack: true,
    showEdit: false,
    showReset: false,
    showSave: true,
    showAdd: true,
    showExport: true,
    showImport: true
  });

  app.innerHTML = `
    <div class="panel">
      <label>Routine-Titel</label>
      <input id="rtTitle" type="text" value="${escapeAttr(r.title || meta.defaultTitle)}" />

      <div class="switchrow">
        <div>
          <div style="font-weight:800;">Kind-Modus</div>
          <div class="hint">Im Routine-Screen kein Zurück/Undo/Edit/Reset. Editor per Long-Press auf die Kachel.</div>
        </div>
        <input id="kidMode" type="checkbox" ${r.kidMode ? "checked" : ""} />
      </div>

      <div class="switchrow">
        <div>
          <div style="font-weight:800;">Auto-Reset täglich</div>
          <div class="hint">Löscht Haken am neuen Tag automatisch (pro Routine).</div>
        </div>
        <input id="autoReset" type="checkbox" ${r.autoResetDaily ? "checked" : ""} />
      </div>

      <div class="switchrow">
        <div>
          <div style="font-weight:800;">Belohnungs-Screen</div>
          <div class="hint">Zeigt eine Belohnung, wenn alle Aufgaben erledigt sind.</div>
        </div>
        <input id="rewardEnabled" type="checkbox" ${r.rewardEnabled ? "checked" : ""} />
      </div>
    </div>

    <div class="panel">
      <div style="font-weight:900;margin-bottom:8px;">Items</div>
      <div class="list" id="editList"></div>
    </div>
  `;

  const editList = $("editList");
  const rtTitle = $("rtTitle");
  const kidMode = $("kidMode");
  const autoReset = $("autoReset");
  const rewardEnabled = $("rewardEnabled");

  async function drawItems() {
    editList.innerHTML = "";
    for (const item of r.items) {
      const wrap = document.createElement("div");
      wrap.className = "itemedit";

      const imgUrl = await imageUrlFromId(item.imageId);

      wrap.innerHTML = `
        <div class="top">
          <div class="miniimg">${imgUrl ? `<img alt="" />` : `<span style="font-size:22px;">🖼️</span>`}</div>
          <div style="flex:1;">
            <label>Titel</label>
            <input type="text" value="${escapeAttr(item.title)}" />
          </div>
        </div>

        <div class="actions">
          <div class="left">
            <button class="btn">Bild wählen</button>
            <button class="btn">Bild löschen</button>
            <button class="btn">↑</button>
            <button class="btn">↓</button>
          </div>
          <button class="btn danger">Entfernen</button>
        </div>
      `;

      if (imgUrl) wrap.querySelector("img").src = imgUrl;

      const titleInput = wrap.querySelector('input[type="text"]');
      titleInput.addEventListener("input", () => {
        item.title = titleInput.value;
      });

      const btnChoose = wrap.querySelectorAll(".btn")[0];
      const btnDelImg = wrap.querySelectorAll(".btn")[1];
      const btnUp = wrap.querySelectorAll(".btn")[2];
      const btnDown = wrap.querySelectorAll(".btn")[3];
      const btnRemove = wrap.querySelector(".danger");

      btnChoose.addEventListener("click", async () => {
        const file = await pickImageFile();
        if (!file) return;

        if (item.imageId) await imgDel(item.imageId);

        const id = await imgPut(file);
        item.imageId = id;
        await saveStore();
        await drawItems();
      });

      btnDelImg.addEventListener("click", async () => {
        if (item.imageId) await imgDel(item.imageId);
        item.imageId = null;
        await saveStore();
        await drawItems();
      });

      btnUp.addEventListener("click", async () => {
        const idx = r.items.findIndex(x => x.id === item.id);
        if (idx > 0) {
          [r.items[idx - 1], r.items[idx]] = [r.items[idx], r.items[idx - 1]];
          await saveStore();
          await drawItems();
        }
      });

      btnDown.addEventListener("click", async () => {
        const idx = r.items.findIndex(x => x.id === item.id);
        if (idx >= 0 && idx < r.items.length - 1) {
          [r.items[idx + 1], r.items[idx]] = [r.items[idx], r.items[idx + 1]];
          await saveStore();
          await drawItems();
        }
      });

      btnRemove.addEventListener("click", async () => {
        if (item.imageId) await imgDel(item.imageId);
        r.items = r.items.filter(x => x.id !== item.id);
        r.progress.doneIds = (r.progress.doneIds || []).filter(id => id !== item.id);
        await saveStore();
        await drawItems();
      });

      editList.appendChild(wrap);
    }
  }

  await drawItems();

  saveBtn.onclick = async () => {
    r.title = rtTitle.value.trim() || meta.defaultTitle;
    r.kidMode = !!kidMode.checked;
    r.autoResetDaily = !!autoReset.checked;
    r.rewardEnabled = !!rewardEnabled.checked;
    await saveStore();
    await renderPick();
  };

  addBtn.onclick = async () => {
    const id = crypto.randomUUID();
    r.items.push({ id, title: "Neu", imageId: null });
    await saveStore();
    await drawItems();
  };
}

// ---------- Header Buttons wiring ----------
backBtn.onclick = () => {
  if (view === "routine") renderPick();
  else if (view === "edit") renderPick();
};

editBtn.onclick = () => {
  if (view === "routine") renderEdit();
};

resetBtn.onclick = async () => {
  if (view !== "routine") return;
  const r = store.routines[currentRid];
  r.progress = { lastDateIso: todayISO(), doneIds: [] };
  await saveStore();
  await renderRoutine();
};

exportBtn.onclick = async () => {
  try { await exportBackup(); }
  catch (e) { console.error(e); alert("Export fehlgeschlagen."); }
};

importBtn.onclick = async () => {
  try { await importBackupFlow(); }
  catch (e) { console.error(e); alert("Import fehlgeschlagen."); }
};

// ---------- File picking ----------
function pickImageFile() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => resolve(input.files?.[0] || null);
    input.click();
  });
}

// ---------- Long press ----------
function attachLongPress(el, onLongPress) {
  let t = null;
  const ms = 520;

  const start = () => {
    clearTimeout(t);
    t = setTimeout(() => { t = null; onLongPress(); }, ms);
  };
  const cancel = () => { clearTimeout(t); t = null; };

  el.addEventListener("touchstart", start, { passive:true });
  el.addEventListener("touchend", cancel);
  el.addEventListener("touchmove", cancel);
  el.addEventListener("mousedown", start);
  el.addEventListener("mouseup", cancel);
  el.addEventListener("mouseleave", cancel);
}

// ---------- Sanitizers ----------
function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function escapeAttr(s){ return escapeHtml(s).replaceAll("\n"," "); }

// ---------- Boot ----------
(async function boot(){
  injectRewardStyles();

  db = await openDB();
  store = await loadStore();

  let changed = false;
  for (const rid of Object.keys(store.routines)) {
    const r = store.routines[rid];
    if (applyAutoReset(r)) changed = true;
  }
  if (changed) await saveStore();

  await renderPick();
})();
