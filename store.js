/* ==========================================================================
   2. Application State, Actions, Offline Queue & Google Sheets Sync

   Two modes:
   - Local (no Sheet URL): demo/single-device. All data lives in this browser.
   - Connected: the Google Sheet server is the source of truth. The app logs in
     there, keeps only what this person may see, and sends each change as an
     action. Actions wait in an outbox (saved on the device) until the server
     accepts them, so slips sent with bad internet are not lost.
   ========================================================================== */

let S;
let role = "tenant";
let tab = "home";
let me = "";
let editing = false;
let draft = {};
let sess = null;
let loginMode = "tenant";
let delMode = false;
let payDraft = {};
let payFilter = "all";
let askCb = null;

const VIEW_KEY = "courtyard_view";
const OUTBOX_KEY = "courtyard_outbox";
const CLOCK_KEY = "courtyard_clock";
const SESS_KEY = "courtyard_sess";

const lsGet = (k, fallback) => {
  try {
    const v = localStorage.getItem(k);
    return v === null ? fallback : JSON.parse(v);
  } catch (e) {
    return fallback;
  }
};
const lsSet = (k, v) => {
  try {
    if (v === undefined || v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(v));
  } catch (e) {}
};

let gsUrl = DEFAULT_GS_URL;
try {
  gsUrl = localStorage.getItem(GS_KEY) || DEFAULT_GS_URL;
} catch (e) {}
const remote = () => !!gsUrl;

let syncState = "idle";
let outbox = lsGet(OUTBOX_KEY, []);
// Server time minus device time: the app uses the server's clock, so a phone set to
// the wrong date still shows (and files slips under) the right month.
let clockOffset = Number(lsGet(CLOCK_KEY, 0)) || 0;
const nowMs = () => Date.now() + clockOffset;
const clockWrong = () => remote() && Math.abs(clockOffset) > 12 * 36e5;

function isoDate(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function seed() {
  const rooms = [];
  let k = 0;
  for (let i = 1; i <= 12; i++) {
    const occ = k < NAMES.length && i % 9 !== 0;
    rooms.push({
      n: String(i),
      floor: 1,
      rent: RENT,
      t: occ
        ? {
            name: NAMES[k],
            dob: 1985 + (k % 18) + "-" + String((k % 12) + 1).padStart(2, "0") + "-" + String(((k * 3) % 27) + 1).padStart(2, "0"),
            phone: "020 5" + (100000 + k * 3517),
            idno: "ID" + (7000000 + k * 913),
            emerg: "ຄອບຄົວ · 020 9" + (200000 + k * 711),
            elec: "E-" + (41000 + k * 37),
            water: "W-" + (82000 + k * 29),
            since: isoDate(new Date(nowMs() - (40 + k * 37) * 864e5)),
            photo: "",
            deposit: RENT,
            pin: "1234"
          }
        : null
    });
    if (occ) k++;
  }
  return {
    rooms,
    pending: [
      { id: 1, room: "1", ts: nowMs() - 36e5 * 5, ch: { phone: "020 5551 2288" } },
      { id: 2, room: "6", ts: nowMs() - 36e5 * 20, ch: { emerg: "ເອື້ອຍ · 020 9988 1100", name: "Mali Keomany" } }
    ],
    notices: {},
    nid: 1000,
    pay: rooms
      .filter(r => r.t)
      .map((r, i) => ({
        id: 100 + i,
        room: r.n,
        month: thisMonth(),
        items: { rent: r.rent, elec: 90000 + ((i * 47000) % 260000), water: 25000 + ((i * 13000) % 70000), garbage: GARBAGE },
        amount: r.rent + 90000 + ((i * 47000) % 260000) + 25000 + ((i * 13000) % 70000) + GARBAGE,
        img: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><rect width='40' height='40' fill='%23cfe0f1'/></svg>",
        ts: nowMs() - i * 36e5 * 7,
        status: i < 8 ? "confirmed" : "pending"
      })),
    admin: { user: "admin", pass: "admin123" }
  };
}

// Context for Logic.apply on this device. In local mode PINs are kept as "plain:…"
// (demo only); when connected, the server re-checks everything with real hashes.
function localCtx() {
  const d = new Date(nowMs());
  const plain = p => "plain:" + p;
  return {
    role: sess ? sess.role : "",
    room: sess ? sess.room : "",
    now: nowMs(),
    month: thisMonth(),
    day: d.getDate(),
    today: isoDate(d),
    secure: false,
    hashPin: plain,
    checkPin: (h, p) => h === plain(p),
    hashPass: plain,
    checkPass: (h, p) => h === plain(p),
    upload: dataUrl => dataUrl,
    newTid: () => "t" + nowMs().toString(36) + Math.random().toString(36).slice(2, 7)
  };
}

const emptyView = () => Logic.normalize({ rooms: [] });

function saveLocal() {
  lsSet(remote() ? VIEW_KEY : KEY, S);
}

const saveOutbox = () => lsSet(OUTBOX_KEY, outbox);

const room = n => S.rooms.find(r => r.n === n);
const pendFor = n => S.pending.find(p => p.room === n);
const dueActive = r => Logic.dueActive(r, thisMonth());
const dueOf = n => Logic.dueFor(room(n), thisMonth());

// Unique id for anything an action creates, so it keeps the same id on the server.
const genId = () => nowMs() * 1000 + Math.floor(Math.random() * 1000);

/* ---------- Actions ---------- */

// Every change goes through here. The rules in Logic run first (errors are shown and
// nothing changes); when connected the action is also queued for the server.
function act(type, args) {
  args = Object.assign({}, args || {});
  if (args.id === undefined) args.id = genId();
  try {
    Logic.apply(S, { type, args }, localCtx());
  } catch (e) {
    toast(e.message || String(e));
    return false;
  }
  saveLocal();
  if (remote()) {
    outbox.push({ type, args });
    saveOutbox();
    sync();
  }
  return true;
}

/* ---------- Server calls ---------- */

async function post(body) {
  const res = await fetch(gsUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body)
  });
  return res.json();
}

// The sync status is a colored dot (green = saved, yellow = syncing, red = offline or
// error). Its full wording is in the tooltip and the screen-reader label.
function setSyncBadge(st, txt) {
  syncState = st;
  const b = $("syncBadge");
  if (!b) return;
  const show = (cls, label) => {
    b.className = "sync-dot " + cls;
    b.title = label;
    b.setAttribute("aria-label", label);
    b.setAttribute("role", "status");
    b.textContent = "";
  };
  if (!remote()) {
    b.style.display = role === "admin" ? "inline-flex" : "none";
    show("b-warn", "ຍັງບໍ່ໄດ້ເຊື່ອມຕໍ່ Google Sheet");
    return;
  }
  // Tenants only see the dot while something is still waiting to be sent.
  if (role !== "admin" && !outbox.length) {
    b.style.display = "none";
    return;
  }
  b.style.display = "inline-flex";
  const waiting = outbox.length ? " · ລໍຖ້າສົ່ງ " + outbox.length : "";
  const map = {
    syncing: ["b-warn is-syncing", (txt || "ກຳລັງຊິ້ງ...") + waiting],
    ok: ["b-ok", "Google Sheet: " + (txt || "ເຊື່ອມຕໍ່ແລ້ວ")],
    err: ["b-bad", (txt || "ອອບລາຍ") + waiting],
    idle: ["b-ok", "Google Sheet: ເຊື່ອມຕໍ່ແລ້ວ" + waiting]
  };
  const m = map[st] || map.idle;
  show(m[0], m[1]);
}

// The shared rules' version in this page (from build.py's ?v= on logic.js) and in the
// Google Apps Script. Different = the script is an old copy that may refuse new actions.
const APP_LV = (() => {
  const el = document.querySelector('script[src*="logic.js?v="]');
  const m = el && /v=([0-9a-f]+)/.exec(el.getAttribute("src"));
  return m ? m[1] : "";
})();
let serverLv = null;
const scriptOld = () => remote() && !!APP_LV && serverLv !== null && serverLv !== APP_LV;

function takeServer(j) {
  serverLv = j.lv || "";
  if (typeof j.now === "number") {
    clockOffset = j.now - Date.now();
    lsSet(CLOCK_KEY, clockOffset);
  }
  if (j.view) S = Logic.normalize(j.view);
  if (j.token && sess) {
    sess.token = j.token;
    sess.role = j.role;
    sess.room = j.room;
    lsSet(SESS_KEY, sess);
  }
}

let syncing = null;
let syncAgain = false;

// Sends queued actions (if any) and fetches this person's latest data.
function sync() {
  if (!remote() || !sess || !sess.token) return Promise.resolve();
  if (syncing) {
    syncAgain = true;
    return syncing;
  }
  syncing = doSync().finally(() => {
    syncing = null;
    if (syncAgain) {
      syncAgain = false;
      sync();
    }
  });
  return syncing;
}

async function doSync() {
  const ops = outbox.slice();
  setSyncBadge("syncing", ops.length ? "ກຳລັງບັນທຶກ..." : "ກຳລັງໂຫຼດ...");
  let j;
  try {
    j = await post({ action: "sync", token: sess.token, ops });
  } catch (e) {
    setSyncBadge("err", "ອອບລາຍ");
    return;
  }
  if (!j || !j.ok) {
    if (j && j.auth) return forceLogout(j.error);
    setSyncBadge("err", "ຊິ້ງຜິດພາດ");
    if (j && j.error) toast(j.error);
    return;
  }
  const before = JSON.stringify(S) + clockWrong();
  takeServer(j);
  outbox.splice(0, ops.length);
  saveOutbox();
  (j.results || []).forEach(r => {
    if (!r.ok) toast("ບໍ່ສຳເລັດ: " + r.error);
  });
  // Actions made while this request was in flight are shown on top of the new data.
  const ctx = localCtx();
  outbox.forEach(op => {
    try {
      Logic.apply(S, op, ctx);
    } catch (e) {}
  });
  saveLocal();
  setSyncBadge(outbox.length ? "syncing" : "ok", outbox.length ? "ກຳລັງບັນທຶກ..." : "Google Sheet");
  if (outbox.length) syncAgain = true;
  // Re-draw only when something changed, so a background refresh does not
  // interrupt someone typing.
  if (JSON.stringify(S) + clockWrong() !== before) render();
}

function forceLogout(msg) {
  outbox = [];
  saveOutbox();
  clearSession();
  render();
  toast(msg || "ກະລຸນາເຂົ້າສູ່ລະບົບໃໝ່");
}

function clearSession() {
  sess = null;
  lsSet(SESS_KEY, null);
  if (remote()) {
    S = emptyView();
    lsSet(VIEW_KEY, null);
  }
  editing = false;
  payDraft = {};
}

async function remoteLogin(mode, id, secret) {
  let j;
  try {
    j = await post({ action: "login", mode, id, secret });
  } catch (e) {
    toast("ເຊື່ອມຕໍ່ບໍ່ໄດ້. ກວດສອບອິນເຕີເນັດແລ້ວລອງໃໝ່.");
    return false;
  }
  if (!j || !j.ok) {
    toast((j && j.error) || "ເຂົ້າສູ່ລະບົບບໍ່ສຳເລັດ");
    return false;
  }
  sess = { role: j.role, room: j.room, token: j.token };
  outbox = [];
  saveOutbox();
  takeServer(j);
  saveLocal();
  setSyncBadge("ok");
  return true;
}

// Keep data fresh while the app is open, and send waiting actions when the
// connection comes back.
setInterval(() => {
  if (document.visibilityState === "visible") sync();
}, 60000);
window.addEventListener("online", () => sync());
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") sync();
});

/* ---------- Google Sheet settings ---------- */

function sheetDlg() {
  const d = $("dlg");
  const local = lsGet(KEY, null);
  const canImport = remote() && sess && sess.role === "admin" && local && Array.isArray(local.rooms);
  d.innerHTML = `<h2>ເຊື່ອມຕໍ່ Google Sheet</h2>
  <p class="mute" style="margin-top:-4px">ເມື່ອເຊື່ອມຕໍ່ແລ້ວ ຂໍ້ມູນທັງໝົດຈະເກັບໄວ້ໃນ Google Sheet ຂອງທ່ານ. ທຸກຄົນຕ້ອງເຂົ້າສູ່ລະບົບຜ່ານ Sheet.</p>
  <label for="gs_u">Web App URL (ຈາກ Apps Script)</label>
  <input id="gs_u" placeholder="https://script.google.com/macros/s/.../exec" value="${esc(gsUrl)}">
  ${
    remote()
      ? `<div class="mute" style="margin-top:6px">${
          outbox.length ? `ລໍຖ້າສົ່ງ ${outbox.length} ລາຍການ · ` : ""
        }<a href="#" onclick="sync();return false">ຊິ້ງດຽວນີ້</a></div>`
      : ""
  }
  <div class="mute" style="margin-top:8px;line-height:1.5">
    <b>ວິທີຕັ້ງຄ່າ:</b><br>
    1. ເປີດ Google Sheet → <b>Extensions → Apps Script</b><br>
    2. ວາງໂຄ້ດຈາກໄຟລ໌ <b>GoogleAppsScript.gs</b> (ຫຼື ກົດປຸ່ມຄັດລອກໂຄ້ດຂ້າງລຸ່ມ)<br>
    3. ກົດ <b>Deploy → New deployment → Web app</b> · Execute as = <b>Me</b> · Who has access = <b>Anyone</b><br>
    4. ຄັດລອກ URL ມາວາງໃສ່ຊ່ອງຂ້າງເທິງ<br>
    5. ເຂົ້າສູ່ລະບົບແອດມິນ (ຄັ້ງທຳອິດ: admin / admin123) ແລ້ວ<b>ປ່ຽນລະຫັດຜ່ານທັນທີ</b>
  </div>
  <button class="btn ghost" style="width:100%;margin-top:10px" onclick="copyGsCode()">ຄັດລອກໂຄ້ດ Apps Script</button>
  ${
    canImport
      ? `<button class="btn ghost" style="width:100%;margin-top:8px" onclick="importLocal()">ອັບໂຫຼດຂໍ້ມູນຈາກເຄື່ອງນີ້ຂຶ້ນ Sheet</button>`
      : ""
  }
  <div class="row" style="margin-top:14px"><button class="btn ghost" onclick="$('dlg').close()">ປິດ</button><button class="btn" onclick="saveGsUrl()">ບັນທຶກ & ເຊື່ອມຕໍ່</button></div>`;
  loadGsCode();
  if (!d.open) d.showModal();
}

async function saveGsUrl() {
  const u = $("gs_u").value.trim();
  if (u === gsUrl) {
    $("dlg").close();
    return;
  }
  if (u) {
    // Check it really is the new server before switching.
    try {
      const h = await fetch(u + (u.indexOf("?") >= 0 ? "&" : "?") + "t=" + Date.now()).then(r => r.json());
      if (!h || h.app !== "hongthaew" || !(h.v >= 2)) throw new Error();
    } catch (e) {
      toast("URL ບໍ່ຖືກຕ້ອງ ຫຼື Apps Script ຍັງເປັນເວີຊັນເກົ່າ");
      return;
    }
  }
  if (remote() && outbox.length) {
    toast("ຍັງມີ " + outbox.length + " ລາຍການລໍຖ້າສົ່ງ. ກະລຸນາຊິ້ງກ່ອນ.");
    return;
  }
  clearSession();
  outbox = [];
  saveOutbox();
  gsUrl = u;
  lsSet(GS_KEY, null);
  try {
    if (u) localStorage.setItem(GS_KEY, u);
  } catch (e) {}
  S = u ? emptyView() : loadLocalState();
  $("dlg").close();
  render();
  toast(u ? "ເຊື່ອມຕໍ່ແລ້ວ. ກະລຸນາເຂົ້າສູ່ລະບົບ." : "ຍົກເລີກການເຊື່ອມຕໍ່ Google Sheet ແລ້ວ");
}

function importLocal() {
  ask(
    "ອັບໂຫຼດຂໍ້ມູນຈາກເຄື່ອງນີ້?",
    "ຂໍ້ມູນ<b>ທັງໝົດ</b>ໃນ Google Sheet ຈະຖືກ<b>ແທນທີ່</b>ດ້ວຍຂໍ້ມູນທີ່ເກັບໄວ້ໃນເຄື່ອງນີ້ (ຫ້ອງ, ຜູ້ເຊົ່າ, ການຊຳລະ). ລະຫັດຜ່ານແອດມິນບໍ່ປ່ຽນ.",
    "ແທນທີ່ ແລະ ອັບໂຫຼດ",
    async () => {
      $("dlg").close();
      let j;
      try {
        j = await post({ action: "import", token: sess.token, state: lsGet(KEY, null) });
      } catch (e) {
        toast("ເຊື່ອມຕໍ່ບໍ່ໄດ້");
        return;
      }
      if (!j.ok) return j.auth ? forceLogout(j.error) : toast(j.error);
      takeServer(j);
      saveLocal();
      render();
      toast("ອັບໂຫຼດຂໍ້ມູນແລ້ວ");
    }
  );
}

// Copies the real GoogleAppsScript.gs so the button can never drift from it.
let gsCode = null;
function loadGsCode() {
  if (gsCode !== null) return;
  fetch("GoogleAppsScript.gs")
    .then(r => (r.ok ? r.text() : Promise.reject()))
    .then(t => (gsCode = t))
    .catch(() => {});
}

function copyGsCode() {
  if (!gsCode) {
    toast("ກະລຸນາເປີດໄຟລ໌ GoogleAppsScript.gs");
    return;
  }
  navigator.clipboard
    .writeText(gsCode)
    .then(() => toast("ຄັດລອກໂຄ້ດ Apps Script ແລ້ວ"))
    .catch(() => toast("ກະລຸນາເປີດໄຟລ໌ GoogleAppsScript.gs"));
}

/* ---------- Initialize State ---------- */

function loadLocalState() {
  const s = Logic.normalize(lsGet(KEY, null) || seed());
  if (Logic.migrate(s, localCtx())) lsSet(KEY, s);
  return s;
}

sess = lsGet(SESS_KEY, null);
// A session from the other mode is not valid here (connected sessions need a token).
if (sess && remote() !== !!sess.token) {
  sess = null;
  lsSet(SESS_KEY, null);
}
S = remote() ? Logic.normalize(lsGet(VIEW_KEY, null) || emptyView()) : loadLocalState();

if (sess) {
  role = sess.role;
  if (sess.room) me = sess.room;
  tab = role === "admin" ? "dash" : "home";
}
