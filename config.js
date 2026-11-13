/* ==========================================================================
   1. Configuration, Constants & Helpers
   ========================================================================== */

const KEY = "courtyard_v2";

// Netlify's free-plan badge covers the bottom menu; css lifts the menu on netlify.app.
if (/\.netlify\.app$/.test(location.hostname)) document.documentElement.classList.add("on-netlify");
const GS_KEY = "courtyard_gs_url";

// Optional: Paste your deployed Google Apps Script Web App URL here for production
// so all devices connect automatically without needing manual setup.
const DEFAULT_GS_URL = "https://script.google.com/macros/s/AKfycbwWEDZf9rmS0yY64h9jWybgppH74-OuUkgvwy58HDjilRv9JVvuVh0Kyxy4ELbo7cJT/exec";

// Phone numbers shown on the login page for tenants who forgot their PIN.
const CONTACT_PHONES = ["02056037361"];

const NAMES = [
  "Somsak P.", "Anna Weber", "Khamla S.", "Li Wei", "Noy V.", "David Park",
  "Mali K.", "Tran Minh", "Sengdao L.", "Emma Rossi", "Bounmy X.", "Kenji Ito",
  "Phet D.", "Sara Ahmed", "Vilay S.", "Tom Hughes", "Dara N.", "Yuki Sato",
  "Souk M.", "Nina Costa", "Thong K.", "Ben Carter", "Lai Y.", "Amy Tan",
  "Keo P.", "Omar Ali", "Bee S.", "Luca Bianchi"
];

// RENT, GARBAGE, FIELDS, ADMIN_ONLY, PAY_KINDS and the kind helpers live in logic.js.

const LM = [
  "ມັງກອນ", "ກຸມພາ", "ມີນາ", "ເມສາ", "ພຶດສະພາ", "ມິຖຸນາ",
  "ກໍລະກົດ", "ສິງຫາ", "ກັນຍາ", "ຕຸລາ", "ພະຈິກ", "ທັນວາ"
];

const PB = {
  confirmed: ["b-ok", "ຊຳລະແລ້ວ"],
  pending: ["b-warn", "ກຳລັງກວດສອບ"],
  rejected: ["b-bad", "ຖືກປະຕິເສດ"]
};

const REASONS = {
  pay: [
    "ສະລິບບໍ່ຊັດ ອ່ານບໍ່ໄດ້",
    "ຍອດເງິນບໍ່ຖືກຕ້ອງ",
    "ບໍ່ພົບເງິນເຂົ້າບັນຊີ",
    "ສະລິບຜິດເດືອນ ຫຼື ສະລິບຊ້ຳ",
    "ຊື່ຜູ້ໂອນບໍ່ກົງກັນ"
  ],
  prof: [
    "ຂໍ້ມູນບໍ່ຖືກຕ້ອງ",
    "ເບີໂທບໍ່ຖືກຕ້ອງ",
    "ເລກບັດບໍ່ກົງກັບເອກະສານ",
    "ຮູບບໍ່ຊັດ ຫຼື ບໍ່ເໝາະສົມ",
    "ກະລຸນາຕິດຕໍ່ຫ້ອງການ"
  ]
};

// DOM & Formatting Helpers
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Dates use the server's clock when connected (nowMs, store.js).
const thisMonth = () => {
  const d = new Date(nowMs());
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
};

const monthLabel = m => {
  const [y, mo] = m.split("-");
  return LM[+mo - 1] + " " + y;
};

const fmtDate = s => {
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  return d + "/" + m + "/" + y;
};

const stayLen = s => {
  if (!s) return "";
  const a = new Date(s), b = new Date(nowMs());
  let mo = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth();
  if (b.getDate() < a.getDate()) mo--;
  if (mo < 0) mo = 0;
  const y = Math.floor(mo / 12), m = mo % 12;
  return y
    ? y + " ປີ" + (m ? " " + m + " ເດືອນ" : "")
    : m
      ? m + " ເດືອນ"
      : Math.max(0, Math.floor((b - a) / 864e5)) + " ມື້";
};

const ago = t => {
  const h = Math.round((nowMs() - t) / 36e5);
  return h < 1 ? "ຫາກໍ່ນີ້" : h < 24 ? h + " ຊມ. ກ່ອນ" : Math.round(h / 24) + " ມື້ກ່ອນ";
};

function toast(m) {
  const d = document.createElement("div");
  d.className = "toast";
  d.textContent = m;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 2200);
}

// Image attributes. Drive photos are requested at the size they are shown (=w<width>),
// so lists of slips and avatars do not download full-size pictures; off-screen images
// load lazily.
function img(u, w, eager) {
  u = String(u || "");
  const src = /^https:\/\/lh3\.googleusercontent\.com\/d\/[\w-]+$/.test(u) ? u + "=w" + w : u;
  return `src="${esc(src)}"${eager ? "" : ' loading="lazy"'} decoding="async"`;
}

function ava(t) {
  return `<div class="avatar">${t.photo ? `<img ${img(t.photo, 160)} alt="">` : esc((t.name || "?")[0])}</div>`;
}
