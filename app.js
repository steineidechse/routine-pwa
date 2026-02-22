/* Routine PWA – IndexedDB (Bilder als Blobs), Kind-Modus, Auto-Reset täglich, Sternenschauer
   + Export/Import als Datei (.json) inkl. Bilder (Base64 DataURLs) */

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
  // getAllKeys ist breit unterstützt; fallback per cursor
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

let store;
async function loadStore() {
  const raw = await kvGet(STORE_KEY);
  if (!raw) return defaultStore();
  try { return JSON.parse(raw); } catch { return defaultStore(); }
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
  // alle Bilder aus images-Store einsammeln
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

  // Sicherheitsabfrage (überschreibt alles)
  const ok = confirm("Import überschreibt ALLE aktuellen Routinen & Bilder auf diesem Gerät. Fortfahren?");
  if (!ok) return;

  // Stores leeren
  await kvClear();
  await imgClear();

  // Bilder zurückschreiben (mit denselben IDs)
  const images = payload.images || {};
  const ids = Object.keys(images);
  for (const id of ids) {
    const dataURL = images[id];
    if (typeof dataURL !== "string" || !dataURL.startsWith("data:")) continue;
    const blob = dataURLToBlob(dataURL);
    await imgPutWithId(id, blob);
  }

  // Store setzen
  store = payload.store || defaultStore();
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
  const r = store.routines