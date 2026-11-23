/* ==========================================================================
   3. Views, Actions & Event Handlers
   ========================================================================== */

function setRole(r) {
  role = r;
  tab = r === "admin" ? "dash" : "home";
  editing = false;
  render();
}

function setTab(t) {
  tab = t;
  delMode = false;
  render();
}

function render() {
  $("lo").style.display = sess ? "" : "none";
  document.querySelector("header").style.display = sess ? "" : "none";
  if (sess && sess.role === "tenant") {
    const rr = room(sess.room);
    if (!rr || !rr.t) {
      logout();
      return;
    }
    me = sess.room;
  }
  if (!sess) {
    $("sub").textContent = "";
    $("nav").innerHTML = "";
    $("app").innerHTML = vLogin();
    loadLoginRooms();
    return;
  }
  role = sess.role;
  $("rt").classList.toggle("on", role === "tenant");
  $("ra").classList.toggle("on", role === "admin");
  $("sub").textContent = role === "admin" ? "ແຜງຄວບຄຸມແອດມິນ" : "ຫ້ອງ " + me;
  setSyncBadge(syncState);
  const nav = $("nav");
  if (role === "admin") {
    const p = S.pending.length + S.pay.filter(x => x.status === "pending").length;
    nav.innerHTML = [
      ["dash", "ພາບລວມ"],
      ["appr", "ການອະນຸມັດ" + (p ? `<span class="dot">${p}</span>` : "")],
      ["rooms", "ຫ້ອງ"],
      ["ten", "ຜູ້ເຊົ່າ"]
    ]
      .map(([k, l]) => `<button class="${tab === k ? "on" : ""}" onclick="setTab('${k}')">${l}</button>`)
      .join("");
    $("app").innerHTML = clockWarn() + { dash: vDash, appr: vAppr, rooms: vRooms, ten: vTen }[tab]();
  } else {
    nav.innerHTML = "";
    $("app").innerHTML = clockWarn() + vTenant();
  }
}

// Shown when this phone's date is far from the server's (the app uses server time).
const clockWarn = () =>
  clockWrong()
    ? `<div class="card" style="background:var(--warnbg)"><b>ວັນທີ/ເວລາໃນເຄື່ອງນີ້ບໍ່ຖືກຕ້ອງ</b><div class="mute">ແອັບໃຊ້ເວລາຂອງເຊີບເວີແທນ. ກະລຸນາຕັ້ງວັນທີໃນໂທລະສັບໃຫ້ຖືກ.</div></div>`
    : "";

/* ---------- Tenant Portal ---------- */

function vTenant() {
  const r = room(me);
  const t = r.t;
  const p = pendFor(me);
  const nt = S.notices[me];
  if (editing) {
    return `<div class="card"><h2>ແກ້ໄຂໂປຣໄຟລ໌</h2>
   <div class="up">${ava({ name: draft.name, photo: draft.photo })}<div><label class="btn ghost" style="display:inline-block;margin:0;padding:11px 14px;border:1px solid var(--line);border-radius:11px;color:var(--ink);cursor:pointer">ອັບໂຫຼດຮູບ<input type="file" accept="image/*" onchange="pick(this)"></label><div class="mute" style="margin-top:4px">ປັບຂະໜາດໃຫ້ອັດຕະໂນມັດ</div></div></div>
   ${FIELDS.map(([k, l]) =>
     ADMIN_ONLY.includes(k)
       ? `<label for="f_${k}">${l} <span class="mute">(ແອດມິນເທົ່ານັ້ນ)</span></label><input id="f_${k}" value="${esc(draft[k])}" disabled>`
       : `<label for="f_${k}">${l}</label><input id="f_${k}" ${k === "dob" ? 'type="date"' : ""} value="${esc(draft[k])}" oninput="draft.${k}=this.value" ${k === "phone" ? 'inputmode="tel"' : ""}>`
   ).join("")}
   <p class="mute">ການປ່ຽນແປງຈະຖືກສົ່ງໃຫ້ແອດມິນ. ຂໍ້ມູນປັດຈຸບັນຍັງໃຊ້ໄດ້ຈົນກວ່າຈະໄດ້ຮັບການອະນຸມັດ.</p>
   <div class="row"><button class="btn ghost" onclick="editing=false;render()">ຍົກເລີກ</button><button class="btn" onclick="submitEdit()">ສົ່ງເພື່ອອະນຸມັດ</button></div></div>`;
  }
  return `${
    nt
      ? `<div class="card" style="background:var(--${nt.ok ? "okbg" : "badbg"})"><b>${
          nt.ok ? "ການປ່ຽນແປງໄດ້ຮັບອະນຸມັດ" : "ການປ່ຽນແປງໂປຣໄຟລ໌ຖືກປະຕິເສດ"
        }</b>${
          nt.ok
            ? `<div class="mute">${esc(nt.msg)}</div>`
            : `<div class="reason"><b>ເຫດຜົນຈາກແອດມິນ:</b> ${esc(nt.msg)}</div><div class="mute" style="margin-top:6px">ກະລຸນາແກ້ໄຂແລ້ວສົ່ງໃໝ່ອີກຄັ້ງ.</div>`
        }<button class="btn ghost" style="margin-top:8px;min-height:38px;padding:6px 12px" onclick="act('dismiss');render()">ປິດ</button></div>`
      : ""
  }
  ${
    p
      ? `<div class="card" style="background:var(--warnbg)"><span class="badge b-warn">ລໍຖ້າແອດມິນອະນຸມັດ</span><div class="mute" style="margin-top:6px">ສົ່ງເມື່ອ ${ago(
          p.ts
        )} · ${Object.keys(p.ch).length} ລາຍການລໍຖ້າກວດສອບ.</div></div>`
      : ""
  }
  <div class="card"><div class="prof"><label style="position:relative;cursor:pointer;flex:none;margin:0" aria-label="ອັບໂຫຼດຮູບໂປຣໄຟລ໌">${ava({
    name: t.name,
    photo: p && p.ch.photo !== undefined ? p.ch.photo : t.photo
  })}<span style="position:absolute;right:-2px;bottom:-2px;background:var(--brand);color:var(--brand-ink);border-radius:50%;width:26px;height:26px;display:grid;place-items:center;font-size:16px;font-weight:700">+</span><input type="file" accept="image/*" style="display:none" onchange="quickPhoto(this)"></label><div><h2 style="margin:0">${esc(
    t.name
  )}</h2><div class="mute">ຫ້ອງ ${r.n}</div><div class="mute" style="color:var(--brand);font-weight:600">ແຕະຮູບເພື່ອອັບໂຫຼດຮູບໂປຣໄຟລ໌</div></div></div>
  <dl><dt>ວັນເລີ່ມເຂົ້າພັກ</dt><dd>${fmtDate(t.since)}${
    t.since ? ` <span class="mute">(ພັກມາແລ້ວ ${stayLen(t.since)})</span>` : ""
  }</dd>${FIELDS.slice(1)
    .map(
      ([k, l]) =>
        `<dt>${l}</dt><dd>${k === "dob" ? (t[k] ? fmtDate(t[k]) : "—") : esc(t[k]) || "—"}${copyBtn(k, t[k])}${
          p && p.ch[k] !== undefined ? ` <span class="badge b-warn">ລໍຖ້າ</span>` : ""
        }</dd>`
    )
    .join("")}</dl>
  <button class="btn" style="width:100%;margin-top:16px" onclick="startEdit()">ແກ້ໄຂໂປຣໄຟລ໌</button></div>
  ${payCard(me)}<div id="installSlot" style="margin-bottom:10px">${installBtn()}</div>`;
}

// Copy button for the electricity meter and water bill numbers (used when paying bills).
const copyBtn = (k, v) =>
  ADMIN_ONLY.includes(k) && v
    ? ` <button type="button" class="copy-btn" data-copy="${esc(v)}" onclick="copyText(this.dataset.copy)" aria-label="ຄັດລອກ ${esc(
        v
      )}">ຄັດລອກ</button>`
    : "";

function copyText(v) {
  const done = () => toast("ຄັດລອກແລ້ວ: " + v);
  const fallback = () => {
    // Older phones / non-HTTPS: copy through a temporary text box.
    const ta = document.createElement("textarea");
    ta.value = v;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      done();
    } catch (e) {
      toast("ຄັດລອກບໍ່ໄດ້");
    }
    ta.remove();
  };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(v).then(done, fallback);
  else fallback();
}

function startEdit() {
  const t = room(me).t;
  const p = pendFor(me);
  draft = { ...t, ...(p ? p.ch : {}) };
  editing = true;
  render();
}

function resizeImage(inp, scaleFor, quality, done) {
  const f = inp.files[0];
  if (!f) return;
  const fr = new FileReader();
  fr.onload = () => {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement("canvas");
      const s = scaleFor(im);
      c.width = im.width * s;
      c.height = im.height * s;
      c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
      done(c.toDataURL("image/jpeg", quality));
    };
    im.src = fr.result;
  };
  fr.readAsDataURL(f);
}

const avatarScale = im => Math.min(1, 200 / Math.min(im.width, im.height));

function pick(inp) {
  resizeImage(inp, avatarScale, 0.7, data => {
    draft.photo = data;
    render();
  });
}

function quickPhoto(inp) {
  resizeImage(inp, avatarScale, 0.7, data => {
    if (!act("profile", { ch: { photo: data }, merge: true })) return;
    render();
    toast("ສົ່ງຮູບເພື່ອອະນຸມັດແລ້ວ");
  });
}

function submitEdit() {
  const t = room(me).t;
  const ch = {};
  for (const k of [...FIELDS.map(f => f[0]), "photo"]) {
    if (ADMIN_ONLY.includes(k)) continue;
    if ((draft[k] || "") !== (t[k] || "")) ch[k] = draft[k] || "";
  }
  if (!draft.name || !draft.name.trim()) {
    toast("ກະລຸນາໃສ່ຊື່");
    return;
  }
  if (!act("profile", { ch })) return;
  editing = false;
  render();
  toast(Object.keys(ch).length ? "ສົ່ງເພື່ອອະນຸມັດແລ້ວ" : "ບໍ່ມີການປ່ຽນແປງທີ່ຈະສົ່ງ");
}

/* ---------- Admin Portal ---------- */

function vDash() {
  const occ = S.rooms.filter(r => r.t).length;
  const tot = S.rooms.length;
  const inc = S.rooms.filter(r => r.t).reduce((a, r) => a + r.rent, 0);
  const td = new Date(nowMs());
  return `${
    S.admin && S.admin.isDefault
      ? `<div class="card" style="background:var(--badbg)"><b style="color:var(--bad)">ກະລຸນາປ່ຽນລະຫັດຜ່ານແອດມິນ</b><div class="mute">ຍັງໃຊ້ລະຫັດຜ່ານເລີ່ມຕົ້ນ admin123 ຢູ່ — ໃຜກໍເຂົ້າໄດ້.</div><button class="btn" style="margin-top:8px;min-height:38px;padding:6px 14px" onclick="passDlg()">ປ່ຽນລະຫັດຜ່ານ</button></div>`
      : ""
  }<div class="sec" style="margin:4px 0 12px"><h2 style="margin:0">ພາບລວມ</h2><span class="mute">${td.getDate()} ${
    LM[td.getMonth()]
  } ${td.getFullYear()}</span></div>${periodBar()}<div class="stats">
  <div class="stat"><b>${occ}/${tot}</b><span class="mute">ຫ້ອງທີ່ມີຜູ້ເຊົ່າ</span><div class="bar"><i style="width:${
    tot ? (occ / tot) * 100 : 0
  }%"></i></div></div>
  <div class="stat"><b>${tot - occ}</b><span class="mute">ຫ້ອງຫວ່າງ</span></div>
  <div class="stat" onclick="setTab('appr')" style="cursor:pointer"><b style="color:var(--warn)">${
    S.pending.length + S.pay.filter(x => x.status === "pending").length
  }</b><span class="mute">ລໍຖ້າການອະນຸມັດ</span></div>
  ${dashMode === "year" ? yearStats(dashY()) : monthStats(dashM(), occ, inc)}</div>
  ${dashMode === "year" ? yearTable(dashY()) : ""}
  <div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h3 style="margin:0">ຈັດການຫ້ອງ · ${tot} ຫ້ອງ</h3><div style="display:flex;gap:6px"><button class="btn ${
    delMode ? "bad" : "ghost"
  }" style="min-height:40px;padding:6px 12px" onclick="delMode=!delMode;render()">${
    delMode ? "ສຳເລັດ" : "ລຶບຫ້ອງ"
  }</button><button class="btn" style="min-height:40px;padding:6px 14px" onclick="delMode=false;addRoomDlg()">+ ເພີ່ມຫ້ອງ</button></div></div>
  <div class="mute" style="margin:6px 0 8px">${
    delMode
      ? `<b style="color:var(--bad)">ໂໝດລຶບ: ແຕະຫ້ອງທີ່ຕ້ອງການລຶບ</b>`
      : "ແຕະຫ້ອງເພື່ອແກ້ໄຂ · ສີຂຽວ = ມີຜູ້ເຊົ່າ · ສີເທົາ = ຫວ່າງ · ກອບສີສົ້ມ = ລໍຖ້າອະນຸມັດ"
  }</div>${roomGrid()}</div>
  <div class="card"><h3>ຄຳຂໍຫຼ້າສຸດ</h3>${
    S.pending.length
      ? S.pending
          .slice(0, 3)
          .map(
            p =>
              `<div style="display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid var(--line)"><span>ຫ້ອງ ${
                p.room
              } · ${esc(room(p.room).t.name)}</span><span class="mute">${ago(p.ts)}</span></div>`
          )
          .join("")
      : `<p class="mute">ບໍ່ມີຄຳຂໍທີ່ລໍຖ້າ. ເມື່ອຜູ້ເຊົ່າແກ້ໄຂຂໍ້ມູນ ຈະສະແດງຢູ່ບ່ອນນີ້.</p>`
  }</div>
  ${dashMode === "year" ? "" : usageChart() + payList(dashM())}<div class="row" style="margin-bottom:10px"><button class="btn ghost" onclick="sheetDlg()">ຕັ້ງຄ່າ Google Sheet</button><button class="btn ghost" onclick="passDlg()">ປ່ຽນລະຫັດຜ່ານແອດມິນ</button></div>${
    remote() ? "" : `<div class="row" style="margin-bottom:10px"><button class="btn ghost" onclick="resetDemo()">ຣີເຊັດຂໍ້ມູນທົດລອງ</button></div>`
  }<div id="installSlot" style="margin-bottom:10px">${installBtn()}</div>`;
}

// Money tiles count only slips the admin has approved; slips still waiting are listed
// underneath so nothing is hidden.
const STAT_EMOJI = { water: "💧", elec: "⚡", garbage: "🗑️" };

function moneyStat(k, occ, note, month) {
  const m = month || thisMonth();
  const mine = allPay().filter(p => p.month === m && hasKind(p, k));
  const ok = mine.filter(p => p.status === "confirmed");
  const total = ok.reduce((a, p) => a + amtFor(p, k), 0);
  const rooms = new Set(ok.map(p => p.room)).size;
  const waiting = new Set(mine.filter(p => p.status === "pending").map(p => p.room)).size;
  const chart = k === "water" || k === "elec";
  return `<div class="stat" ${
    chart ? `onclick="openUsage()" style="cursor:pointer" title="ເບິ່ງກຣາຟ"` : ""
  }><b style="font-size:20px;padding:4px 0">${kipShort(total)}</b><span class="mute">${STAT_EMOJI[k] ? STAT_EMOJI[k] + " " : ""}${kindLabel(k)} ${monthLabel(
    m
  )} (ກີບ)</span><small class="stat-sub">ອະນຸມັດແລ້ວ ${rooms}/${occ} ຫ້ອງ${waiting ? ` · ລໍຖ້າ ${waiting}` : ""}${
    note ? `<br>${note}` : ""
  }</small></div>`;
}

/* ---------- Dashboard period: month by month, or a whole year ---------- */

let dashMode = "month"; // "month" | "year"
let dashMonth = "";
let dashYear = "";

// Payments of current and moved-out tenants: money received stays in the totals.
const allPay = () => S.pay.concat(S.payArchive || []);
const dashM = () => dashMonth || thisMonth();
const dashY = () => dashYear || thisMonth().slice(0, 4);
const paidSum = (k, test) => allPay().filter(p => p.status === "confirmed" && test(p)).reduce((a, p) => a + amtFor(p, k), 0);

function dashMonths() {
  const c = thisMonth();
  return [...new Set([c, Logic.nextMonth(c), ...allPay().map(p => p.month)])].filter(Boolean).sort().reverse();
}

function dashYears() {
  return [...new Set([thisMonth().slice(0, 4), ...allPay().map(p => String(p.month).slice(0, 4))])].sort().reverse();
}

function setDash(mode, v) {
  dashMode = mode;
  if (mode === "month") {
    dashMonth = v || dashM();
    usageMonth = dashMonth; // the water/electricity chart follows the chosen month
  } else {
    dashYear = v || dashY();
  }
  render();
}

function periodBar() {
  const month = dashMode === "month";
  const opts = month
    ? dashMonths().map(m => `<option value="${m}" ${m === dashM() ? "selected" : ""}>${monthLabel(m)}${m === thisMonth() ? " (ເດືອນນີ້)" : ""}</option>`)
    : dashYears().map(y => `<option value="${y}" ${y === dashY() ? "selected" : ""}>ປີ ${y}</option>`);
  return `<div class="period"><div class="period-seg" role="group" aria-label="ເບິ່ງຕາມ">${[
    ["month", "ເດືອນ"],
    ["year", "ປີ"]
  ]
    .map(
      ([k, l]) =>
        `<button type="button" class="${dashMode === k ? "on" : ""}" aria-pressed="${dashMode === k}" onclick="setDash('${k}')">${l}</button>`
    )
    .join("")}</div><select aria-label="${month ? "ເລືອກເດືອນ" : "ເລືອກປີ"}" onchange="setDash('${dashMode}',this.value)">${opts.join(
    ""
  )}</select>${
    month && dashM() !== thisMonth() ? `<button type="button" class="btn ghost period-now" onclick="setDash('month','${thisMonth()}')">ເດືອນນີ້</button>` : ""
  }</div>`;
}

function monthStats(m, occ, inc) {
  const rentRooms = new Set(allPay().filter(p => p.status === "confirmed" && p.month === m && hasKind(p, "rent")).map(p => p.room));
  const unpaid = S.rooms.filter(r => r.t && !rentRooms.has(r.n)).length;
  return `${moneyStat("rent", occ, `ຈາກທັງໝົດ ${kipShort(inc)}`, m)}
  <div class="stat"><b style="color:var(--ok)">${rentRooms.size}</b><span class="mute">ຊຳລະຄ່າເຊົ່າແລ້ວ ${monthLabel(m)}</span></div>
  <div class="stat"><b style="color:var(--bad)">${unpaid}</b><span class="mute">ຍັງບໍ່ໄດ້ຊຳລະ ${monthLabel(m)}</span></div>
  ${["water", "elec", "garbage"].map(k => moneyStat(k, occ, "", m)).join("")}`;
}

function yearStats(y) {
  const inYear = p => String(p.month).slice(0, 4) === y;
  const kinds = PAY_KINDS.map(x => x[0]);
  const total = kinds.reduce((a, k) => a + paidSum(k, inYear), 0);
  return `<div class="stat"><b style="font-size:20px;padding:4px 0;color:var(--ok)">${kipShort(total)}</b><span class="mute">💰 ລວມທັງໝົດ ປີ ${y} (ກີບ)</span><small class="stat-sub">ສະເພາະທີ່ອະນຸມັດແລ້ວ</small></div>
  ${kinds
    .map(
      k =>
        `<div class="stat"><b style="font-size:20px;padding:4px 0">${kipShort(paidSum(k, inYear))}</b><span class="mute">${
          STAT_EMOJI[k] ? STAT_EMOJI[k] + " " : ""
        }${kindLabel(k)} ປີ ${y} (ກີບ)</span></div>`
    )
    .join("")}`;
}

// Month-by-month table for one year; tap a month to open it in month view.
function yearTable(y) {
  const kinds = PAY_KINDS.map(x => x[0]);
  const last = Logic.nextMonth(thisMonth());
  const months = Array.from({ length: 12 }, (_, i) => y + "-" + String(i + 1).padStart(2, "0")).filter(
    m => m <= last || allPay().some(p => p.month === m)
  );
  const rows = months.map(m => {
    const v = {};
    kinds.forEach(k => (v[k] = paidSum(k, p => p.month === m)));
    v.total = kinds.reduce((a, k) => a + v[k], 0);
    v.rooms = new Set(allPay().filter(p => p.status === "confirmed" && p.month === m && hasKind(p, "rent")).map(p => p.room)).size;
    return { m, v };
  });
  const max = Math.max(1, ...rows.map(r => r.v.total));
  const sum = k => rows.reduce((a, r) => a + r.v[k], 0);
  return `<div class="card"><h3 style="margin-top:0">ລາຍຮັບແຕ່ລະເດືອນ · ປີ ${y}</h3><div class="mute" style="margin:-4px 0 8px">ສະເພາະທີ່ອະນຸມັດແລ້ວ · ແຕະເດືອນເພື່ອເບິ່ງລາຍລະອຽດ</div>
  <div class="ytable"><table><thead><tr><th>ເດືອນ</th>${kinds.map(k => `<th>${STAT_EMOJI[k] || "🏠"} ${kindLabel(k)}</th>`).join("")}<th>ລວມ</th><th>ຫ້ອງຈ່າຍຄ່າເຊົ່າ</th></tr></thead><tbody>${rows
    .map(
      ({ m, v }) =>
        `<tr tabindex="0" onclick="setDash('month','${m}')" onkeydown="if(event.key==='Enter')this.click()"><td>${monthLabel(m)}</td>${kinds
          .map(k => `<td>${v[k] ? v[k].toLocaleString() : "—"}</td>`)
          .join("")}<td class="ytot"><span class="ybar" style="width:${Math.round((v.total / max) * 100)}%"></span><b>${
          v.total ? v.total.toLocaleString() : "—"
        }</b></td><td>${v.rooms}</td></tr>`
    )
    .join("")}</tbody><tfoot><tr><td>ລວມປີ ${y}</td>${kinds.map(k => `<td>${sum(k).toLocaleString()}</td>`).join("")}<td class="ytot"><b>${sum(
    "total"
  ).toLocaleString()}</b></td><td></td></tr></tfoot></table></div></div>`;
}

function openUsage() {
  if (!usageOpen) toggleUsage();
  const c = document.querySelector(".u-toggle");
  if (c) c.closest(".card").scrollIntoView({ behavior: "smooth", block: "start" });
}

function vAppr() {
  const pp = S.pay.filter(p => p.status === "pending");
  if (!S.pending.length && !pp.length) {
    return `<div class="card"><h2>ກວດສອບໝົດແລ້ວ</h2><p class="mute">ສະລິບການຊຳລະ ແລະ ການປ່ຽນແປງໂປຣໄຟລ໌ຈາກຜູ້ເຊົ່າ ຈະສະແດງຢູ່ບ່ອນນີ້ເພື່ອກວດສອບ.</p></div>`;
  }
  return (pp.length ? `<h2>ສະລິບການຊຳລະເງິນ</h2>` + vPay(pp) : "") + (S.pending.length ? vProf() : "");
}

function vProf() {
  if (!S.pending.length) {
    return `<div class="card"><h2>ກວດສອບໝົດແລ້ວ</h2><p class="mute">ເມື່ອຜູ້ເຊົ່າແກ້ໄຂໂປຣໄຟລ໌ ຈະສະແດງຢູ່ບ່ອນນີ້ເພື່ອກວດສອບ.</p></div>`;
  }
  return (
    `<h2>ການປ່ຽນແປງໂປຣໄຟລ໌ທີ່ຕ້ອງກວດສອບ</h2>` +
    S.pending
      .map(p => {
        const t = room(p.room).t;
        return `<div class="card"><div class="prof" style="margin:0">${ava(t)}<div><h3 style="margin:0">${esc(
          t.name
        )}</h3><div class="mute">ຫ້ອງ ${p.room} · ${ago(p.ts)}</div></div></div>
   <div class="diff">${Object.entries(p.ch)
     .map(([k, v]) =>
       k === "photo"
         ? `<span class="mute">ຮູບພາບ</span><span>${ava(
             t
           )} → <span class="avatar" style="display:inline-grid;vertical-align:middle"><img ${img(v, 160)} alt="New photo"></span></span>`
         : `<span class="mute">${(FIELDS.find(f => f[0] === k) || [k, k])[1]}</span><span><s>${
             (k === "dob" && t[k] ? fmtDate(t[k]) : esc(t[k])) || "ຫວ່າງເປົ່າ"
           }</s><br><span class="n">${(k === "dob" && v ? fmtDate(v) : esc(v)) || "ຫວ່າງເປົ່າ"}</span></span>`
     )
     .join("")}</div>
   <div class="row"><button class="btn bad" onclick="rejectDlg('prof',${
     p.id
   })">ປະຕິເສດ</button><button class="btn ok" onclick="decide(${p.id},true)">ອະນຸມັດ</button></div></div>`;
      })
      .join("")
  );
}

function decide(id, ok, reason) {
  if (!act("decideProfile", { id, ok, reason })) return;
  render();
  toast(ok ? "ອະນຸມັດແລ້ວ" : "ປະຕິເສດ ແລະ ແຈ້ງຜູ້ເຊົ່າແລ້ວ");
}

function vRooms() {
  let h = `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h2 style="margin:0">ຫ້ອງທັງໝົດ ${S.rooms.length}</h2><button class="btn" style="min-height:40px;padding:6px 14px" onclick="addRoomDlg()">+ ເພີ່ມຫ້ອງ</button></div><div class="mute" style="margin:6px 0">ສູງສຸດ 50 ຫ້ອງ</div><div class="mute" style="margin-bottom:6px">ສີຂຽວ = ມີຜູ້ເຊົ່າ · ສີເທົາ = ຫວ່າງ · ກອບສີສົ້ມ = ມີການປ່ຽນແປງລໍຖ້າ</div>`;
  return h + roomGrid();
}

function roomGrid() {
  const fl = [...new Set(S.rooms.map(r => r.floor))].sort((a, b) => a - b);
  if (!S.rooms.length) return `<p class="mute">ຍັງບໍ່ມີຫ້ອງ. ກົດ "+ ເພີ່ມຫ້ອງ" ເພື່ອເລີ່ມ.</p>`;
  return fl
    .map(
      f =>
        `${fl.length > 1 ? `<div class="floor">ຊັ້ນ ${f}</div>` : ""}<div class="grid" style="margin-bottom:8px">${S.rooms
          .filter(r => r.floor === f)
          .map(
            r =>
              `<button class="room ${r.t ? "" : "vac"} ${pendFor(r.n) ? "pend" : ""}" ${
                delMode ? `style="outline:2px dashed var(--bad)"` : ""
              } onclick="${delMode ? "delRoom" : "openRoom"}('${r.n}')">${r.n}<small>${
                r.t ? esc(r.t.name) : "ຫວ່າງ"
              }</small></button>`
          )
          .join("")}</div>`
    )
    .join("");
}

function editRoomDlg(n) {
  const r = room(n);
  $("dlg").innerHTML = `<h2>ແກ້ໄຂຫ້ອງ ${n}</h2><p class="mute">${r.t ? "ຜູ້ເຊົ່າ: " + esc(r.t.name) : "ຫ້ອງຫວ່າງ"}</p>
  <label for="er_n">ເລກຫ້ອງ</label><input id="er_n" value="${esc(r.n)}" autocapitalize="characters">
  <label for="er_r">ຄ່າເຊົ່າລາຍເດືອນ (ກີບ)</label><input id="er_r" inputmode="numeric" value="${esc(r.rent)}">
  <label for="er_d">ຍອດທີ່ຕ້ອງຈ່າຍເດືອນນີ້ (ກີບ)</label><input id="er_d" inputmode="numeric" value="${esc(
    dueActive(r) ? r.due : ""
  )}" placeholder="ປ່ອຍວ່າງ = ໃຊ້ຄ່າເຊົ່າ">
  <div class="row" style="margin-top:16px"><button class="btn ghost" onclick="openRoom('${n}')">ຍົກເລີກ</button><button class="btn" onclick="saveRoom('${n}')">ບັນທຶກ</button></div>
  <button class="btn bad" style="width:100%;margin-top:8px" onclick="delRoom('${n}')">ລຶບຫ້ອງນີ້</button>`;
  if (!$("dlg").open) $("dlg").showModal();
}

function saveRoom(old) {
  const nn = $("er_n").value.trim().toUpperCase();
  if (!act("editRoom", { old, nn, rent: $("er_r").value, due: $("er_d").value })) return;
  if (me === old) me = nn;
  $("dlg").close();
  render();
  toast("ອັບເດດຫ້ອງ " + nn + " ແລ້ວ");
}

function openRoom(n) {
  const r = room(n);
  const d = $("dlg");
  d.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px"><div><h2 style="margin:0">ຫ້ອງ ${n}</h2><div class="mute">${r.rent.toLocaleString()} ກີບ / ເດືອນ</div></div>${payStatus(
    n
  )}</div>
  ${
    r.t
      ? `<div class="prof" style="margin:6px 0"><div class="avatar" style="width:52px;height:52px;font-size:20px">${
          r.t.photo ? `<img ${img(r.t.photo, 160)} alt="">` : esc((r.t.name || "?")[0])
        }</div><div><b>${esc(r.t.name)}</b><div class="mute">${
          esc(r.t.phone) || "ບໍ່ມີເບີໂທ"
        }${r.t.dob ? ` · ວັນເກີດ ${fmtDate(r.t.dob)}` : ""}</div><div class="mute">ເຂົ້າພັກ ${fmtDate(r.t.since)}${
          r.t.since ? ` (${stayLen(r.t.since)})` : ""
        }</div></div></div>
  <dl class="kv"><div><dt>ວັນເດືອນປີເກີດ</dt><dd>${r.t.dob ? fmtDate(r.t.dob) : "—"}</dd></div><div><dt>ເງິນມັດຈຳ</dt><dd>${
    r.t.deposit ? kip(r.t.deposit) : "—"
  }</dd></div>${FIELDS.slice(3)
    .map(([k, l]) => `<div><dt>${l}</dt><dd>${esc(r.t[k]) || "—"}${copyBtn(k, r.t[k])}</dd></div>`)
    .join("")}</dl>`
      : `<p class="mute" style="margin:10px 0">ຫ້ອງນີ້ຫວ່າງ.</p>`
  }
  ${r.t ? `<button class="btn ghost" style="width:100%;margin-top:10px" onclick="recordDlg('${n}')">+ ບັນທຶກການຊຳລະ (ເງິນສົດ / ບໍ່ມີສະລິບ)</button>` : ""}
  ${payHist(n, true)}
  <div class="row" style="margin-top:10px">${
    r.t
      ? `<button class="btn" onclick="adminEdit('${n}')">ແກ້ໄຂຜູ້ເຊົ່າ</button><button class="btn ghost" onclick="editRoomDlg('${n}')">ແກ້ໄຂຫ້ອງ</button>`
      : `<button class="btn" onclick="moveIn('${n}')">ເພີ່ມຜູ້ເຊົ່າ</button><button class="btn ghost" onclick="editRoomDlg('${n}')">ແກ້ໄຂຫ້ອງ</button>`
  }</div>
  <div class="row" style="margin-top:6px">${
    r.t ? `<button class="btn bad" onclick="moveOut('${n}')">ຍ້າຍອອກ</button>` : ""
  }<button class="btn bad" onclick="delRoom('${n}')">ລຶບຫ້ອງ</button><button class="btn ghost" onclick="$('dlg').close()">ປິດ</button></div>`;
  if (!d.open) d.showModal();
}

function adminEdit(n, fresh) {
  const r = room(n);
  if (fresh !== false) draft = { ...r.t, pin: "", rent: r.rent, due: dueActive(r) ? r.due : "", deposit: r.t.deposit || "" };
  $("dlg").innerHTML = `<h2>ແກ້ໄຂຜູ້ເຊົ່າ · ຫ້ອງ ${n}</h2>
  <div class="up" style="margin-bottom:4px"><div class="avatar" style="width:52px;height:52px;font-size:20px">${
    draft.photo ? `<img ${img(draft.photo, 160)} alt="">` : esc((draft.name || "?")[0])
  }</div><div><label style="display:inline-block;margin:0;padding:8px 12px;border:1px solid var(--line);border-radius:10px;color:var(--ink);cursor:pointer;font-size:13px">ປ່ຽນຮູບ<input type="file" accept="image/*" onchange="apick(this,'${n}')"></label>${
    draft.photo
      ? ` <button class="btn ghost" style="min-height:36px;padding:6px 10px" onclick="draft.photo='';adminEdit('${n}',false)">ລົບ</button>`
      : ""
  }</div></div>
  <div class="row">${FIELDS.slice(0, 2)
    .map(
      ([k, l]) =>
        `<div><label for="f_${k}">${l}</label><input id="f_${k}" ${k === "dob" ? 'type="date"' : ""} value="${esc(
          draft[k]
        )}" oninput="draft.${k}=this.value"></div>`
    )
    .join("")}</div>
  <div class="row">${FIELDS.slice(2, 4)
    .map(
      ([k, l]) =>
        `<div><label for="f_${k}">${l}</label><input id="f_${k}" value="${esc(
          draft[k]
        )}" oninput="draft.${k}=this.value"></div>`
    )
    .join("")}</div>
  <div class="row">${FIELDS.slice(4, 6)
    .map(
      ([k, l]) =>
        `<div><label for="f_${k}">${l}</label><input id="f_${k}" value="${esc(
          draft[k]
        )}" oninput="draft.${k}=this.value"></div>`
    )
    .join("")}</div>
  <div class="row"><div><label for="f_water">${FIELDS[6][1]}</label><input id="f_water" value="${esc(
    draft.water
  )}" oninput="draft.water=this.value"></div><div><label for="f_pin">PIN ໃໝ່</label><input id="f_pin" inputmode="numeric" maxlength="6" placeholder="ປ່ອຍວ່າງ = ບໍ່ປ່ຽນ" value="${esc(
    draft.pin
  )}" oninput="draft.pin=this.value"></div></div>
  <div class="row"><div><label for="f_since">ວັນເຂົ້າພັກ</label><input id="f_since" type="date" value="${esc(
    draft.since
  )}" oninput="draft.since=this.value"></div><div><label for="f_rent">ຄ່າເຊົ່າ/ເດືອນ (ກີບ)</label><input id="f_rent" inputmode="numeric" value="${esc(
    draft.rent
  )}" oninput="draft.rent=this.value"></div></div>
  <div class="row"><div><label for="f_due">ຍອດຕ້ອງຈ່າຍເດືອນນີ້ (ກີບ)</label><input id="f_due" inputmode="numeric" value="${esc(
    draft.due
  )}" placeholder="ປ່ອຍວ່າງ = ໃຊ້ຄ່າເຊົ່າ" oninput="draft.due=this.value"></div><div><label for="f_dep">ເງິນມັດຈຳ (ກີບ)</label><input id="f_dep" inputmode="numeric" value="${esc(
    draft.deposit
  )}" oninput="draft.deposit=this.value"></div></div>
  <div class="row" style="margin-top:12px"><button class="btn ghost" onclick="openRoom('${n}')">ຍົກເລີກ</button><button class="btn" onclick="adminSave('${n}')">ບັນທຶກ</button></div>`;
}

function apick(inp, n) {
  resizeImage(inp, avatarScale, 0.7, data => {
    draft.photo = data;
    adminEdit(n, false);
  });
}

function adminSave(n) {
  const f = {};
  for (const k of [...FIELDS.map(x => x[0]), "photo"]) f[k] = draft[k] || "";
  const ok = act("editTenant", {
    n,
    f,
    pin: String(draft.pin || "").trim(),
    since: draft.since,
    rent: draft.rent,
    due: draft.due,
    deposit: draft.deposit
  });
  if (!ok) return;
  $("dlg").close();
  render();
  toast("ອັບເດດຫ້ອງ " + n + " ແລ້ວ");
}

// Move-out records the tenant in "past tenants" with how much deposit was returned.
function moveOut(n) {
  const r = room(n);
  if (!r || !r.t) return;
  const dep = r.t.deposit || 0;
  ask(
    `ຍ້າຍອອກຈາກຫ້ອງ ${esc(n)}?`,
    `<b>${esc(r.t.name)}</b> ຈະຖືກຍ້າຍໄປລາຍຊື່ຜູ້ເຊົ່າເກົ່າ ແລະ ຫ້ອງຈະກາຍເປັນຫ້ອງຫວ່າງ.
    <label for="mo_r">ຄືນເງິນມັດຈຳ (ກີບ) · ມັດຈຳທີ່ຮັບໄວ້ ${dep.toLocaleString()}</label><input id="mo_r" inputmode="numeric" value="${dep}">
    <label for="mo_n">ໝາຍເຫດ (ເຊັ່ນ: ຫັກຄ່າເສຍຫາຍ)</label><input id="mo_n" maxlength="300">`,
    "ຍ້າຍອອກ",
    () => {
      if (!act("moveOut", { n, refund: $("mo_r").value, note: $("mo_n").value })) return;
      if (me === n) me = "";
      $("dlg").close();
      render();
      toast("ຫ້ອງ " + n + " ຫວ່າງແລ້ວ");
    }
  );
}

function moveIn(n) {
  const r = room(n);
  const today = localCtx().today;
  $("dlg").innerHTML = `<h2>ເພີ່ມຜູ້ເຊົ່າ · ຫ້ອງ ${esc(n)}</h2><p class="mute">ສາມາດແກ້ໄຂຂໍ້ມູນເພີ່ມເຕີມໄດ້ພາຍຫຼັງ.</p>
  <label for="mi_n">ຊື່ ແລະ ນາມສະກຸນ</label><input id="mi_n" autocomplete="off">
  <div class="row"><div><label for="mi_dob">ວັນເດືອນປີເກີດ</label><input id="mi_dob" type="date"></div><div><label for="mi_p">ເບີໂທ</label><input id="mi_p" inputmode="tel" autocomplete="off"></div></div>
  <div class="row"><div><label for="mi_s">ວັນເລີ່ມເຂົ້າພັກ</label><input id="mi_s" type="date" value="${today}" onchange="prorateHint('${n}')"></div><div><label for="mi_pin">ລະຫັດ PIN (4-6 ຕົວເລກ)</label><input id="mi_pin" inputmode="numeric" maxlength="6" value="${DEFAULT_PIN}"></div></div>
  <label for="mi_d">ເງິນມັດຈຳ (ກີບ)</label><input id="mi_d" inputmode="numeric" value="${r.rent}">
  <label class="check" style="margin-top:10px"><input type="checkbox" id="mi_pr" checked onchange="prorateHint('${n}')"><span>ເດືອນທຳອິດ ຄິດຄ່າເຊົ່າຕາມຈຳນວນມື້ທີ່ພັກ</span></label>
  <div class="mute" id="mi_ph"></div>
  <div class="row" style="margin-top:18px"><button class="btn ghost" onclick="openRoom('${n}')">ຍົກເລີກ</button><button class="btn" onclick="moveInSave('${n}')">ເພີ່ມຜູ້ເຊົ່າ</button></div>`;
  prorateHint(n);
  $("mi_n").focus();
}

function prorateHint(n) {
  const since = $("mi_s").value;
  const part = since && $("mi_pr").checked ? Logic.prorated(room(n).rent, since) : 0;
  $("mi_ph").textContent = part
    ? `ຄ່າເຊົ່າ${monthLabel(since.slice(0, 7))}: ${kip(part)} (ແທນ ${kip(room(n).rent)})`
    : "ເດືອນທຳອິດ ຈ່າຍຄ່າເຊົ່າເຕັມເດືອນ";
}

function moveInSave(n) {
  const ok = act("moveIn", {
    n,
    name: $("mi_n").value,
    dob: $("mi_dob").value,
    phone: $("mi_p").value,
    since: $("mi_s").value,
    pin: $("mi_pin").value.replace(/\D/g, ""),
    deposit: $("mi_d").value,
    prorate: $("mi_pr").checked
  });
  if (!ok) return;
  $("dlg").close();
  render();
  toast("ເພີ່ມຜູ້ເຊົ່າໃນຫ້ອງ " + n + " ແລ້ວ");
}

function vTen() {
  return `<h2>ຜູ້ເຊົ່າ</h2><div class="card" style="padding:4px 14px">${S.rooms
    .filter(r => r.t)
    .map(
      r =>
        `<div style="display:flex;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line);cursor:pointer" onclick="openRoom('${
          r.n
        }')"><div class="avatar" style="width:44px;height:44px;font-size:18px">${
          r.t.photo ? `<img ${img(r.t.photo, 160)} alt="">` : esc(r.t.name[0])
        }</div><div style="flex:1"><b>${esc(r.t.name)}</b><div class="mute">${
          esc(r.t.phone) || "ບໍ່ມີເບີໂທ"
        } · ${fmtDate(r.t.since)}</div></div><span class="badge ${pendFor(r.n) ? "b-warn" : "b-ok"}">${
          r.n
        }</span></div>`
    )
    .join("")}</div>${pastTenants()}`;
}

function pastTenants() {
  const list = (S.pastTenants || []).slice().reverse();
  if (!list.length) return "";
  return `<h2 style="margin-top:18px">ຜູ້ເຊົ່າເກົ່າ</h2><div class="card" style="padding:4px 14px">${list
    .map(
      x => `<div style="padding:10px 0;border-bottom:1px solid var(--line)"><b>${esc(x.name)}</b> <span class="badge b-ok">${esc(
        x.room
      )}</span><div class="mute">${fmtDate(x.since)} → ${fmtDate(x.out)}${x.phone ? " · " + esc(x.phone) : ""}</div><div class="mute">ມັດຈຳ ${kip(
        x.deposit || 0
      )} · ຄືນແລ້ວ ${kip(x.refund || 0)}${x.note ? " · " + esc(x.note) : ""}</div></div>`
    )
    .join("")}</div>`;
}

/* ---------- Payments & Slips ---------- */

function payStatus(n) {
  const p = S.pay
    .filter(x => hasKind(x, "rent") && x.room === n && x.month === thisMonth())
    .sort((a, b) => b.ts - a.ts)[0];
  return (
    `<span class="mute">ຄ່າເຊົ່າ ${monthLabel(thisMonth())}:</span> ` +
    (p ? `<span class="badge ${PB[p.status][0]}">${PB[p.status][1]}</span>` : `<span class="badge b-bad">ຍັງບໍ່ໄດ້ຊຳລະ</span>`)
  );
}

function payCard(n) {
  const r = room(n);
  const cur = thisMonth();
  const next = Logic.nextMonth(cur);
  if (payDraft.month !== next) payDraft.month = cur;
  const m = payDraft.month;
  const ahead = m === next;
  const kinds = payDraft.kinds || (payDraft.kinds = ["rent"]);
  const nextSlips = S.pay.filter(p => p.room === n && p.month === next && p.status !== "rejected");
  const mine = S.pay.filter(p => p.room === n).sort((a, b) => b.ts - a.ts);
  const rj = mine.find(
    p =>
      p.status === "rejected" &&
      !mine.some(q => q.month === p.month && q.ts > p.ts && kindsOf(q).some(k => hasKind(p, k)))
  );
  return `${
    rj
      ? `<div class="card" style="background:var(--badbg)"><b style="color:var(--bad)">ສະລິບ${kindsLabel(rj)} ${monthLabel(rj.month)} ຖືກປະຕິເສດ</b><div class="reason"><b>ເຫດຜົນຈາກແອດມິນ:</b> ${esc(
          rj.reason || "ກະລຸນາອັບໂຫຼດສະລິບທີ່ຊັດກວ່າ"
        )}</div><div class="mute" style="margin-top:6px">ກະລຸນາອັບໂຫຼດສະລິບໃໝ່ຂ້າງລຸ່ມ.</div></div>`
      : ""
  }<div class="card"><h2>ການຊຳລະລາຍເດືອນ</h2><p class="mute" style="margin-top:-6px">ອັບໂຫຼດສະລິບໂອນເງິນ ຫຼື ໃບຮັບເງິນ. ${payStatus(
    n
  )}</p>
  <label>ຈ່າຍສຳລັບເດືອນ</label><div class="row">${[
    [cur, "ເດືອນນີ້"],
    [next, "ລ່ວງໜ້າ"]
  ]
    .map(
      ([v, l]) =>
        `<button type="button" class="btn ${m === v ? "" : "ghost"}" style="min-height:52px;line-height:1.25" onclick="setPayMonth('${v}')">${monthLabel(
          v
        )}<br><span style="font-size:12px;font-weight:500">${l}</span></button>`
    )
    .join("")}</div>${
    nextSlips.length
      ? `<div class="mute" style="margin-top:6px">${monthLabel(next)}: ${nextSlips
          .map(p => kindsLabel(p) + " · " + PB[p.status][1])
          .join(" / ")}</div>`
      : ""
  }${ahead ? `<div class="mute" style="margin-top:6px">ຈ່າຍລ່ວງໜ້າໄດ້ສະເພາະ ຄ່າເຊົ່າ ແລະ ຄ່າຂີ້ເຫຍື້ອ</div>` : ""}
  <label>ປະເພດການຊຳລະ <span style="font-weight:400">(ເລືອກໄດ້ຫຼາຍອັນ)</span></label>
  <div class="kinds">${PAY_KINDS.filter(([k]) => !ahead || Logic.ADVANCE_KINDS.includes(k)).map(([k, l]) => {
    const on = kinds.includes(k);
    return `<div class="kind ${on ? "on" : ""}"><label class="check"><input type="checkbox" ${
      on ? "checked" : ""
    } onchange="togglePayKind('${k}',this.checked)"><span>${l}</span></label>${
      !on
        ? ""
        : fixedAmt(k, n)
          ? `<div class="kind-amt">${fixedAmt(k, n).toLocaleString()} ກີບ</div>`
          : `<input class="kind-amt" inputmode="numeric" placeholder="ຈຳນວນເງິນຕາມບິນ (ກີບ)" aria-label="ຈຳນວນເງິນ${l}" value="${esc(
              (payDraft.amts || {})[k]
            )}" oninput="setPayAmt('${k}',this.value)">`
    }</div>`;
  }).join("")}</div>
  <div class="kind-total">ລວມ: <b id="pay_total">${payTotal(n).toLocaleString()}</b> ກີບ</div>
  <label style="margin-top:12px;display:block;border:2px dashed var(--line);border-radius:12px;padding:${
    payDraft.img ? "8px" : "22px 10px"
  };text-align:center;cursor:pointer;color:var(--ink)">${
    payDraft.img
      ? `<img src="${esc(payDraft.img)}" alt="Payment slip preview" style="max-width:100%;max-height:220px;border-radius:8px"><div class="mute">ແຕະເພື່ອເລືອກຮູບອື່ນ</div>`
      : `<b>ແຕະເພື່ອອັບໂຫຼດສະລິບການຊຳລະ</b><div class="mute">ຮູບຖ່າຍ ຫຼື ແຄັບໜ້າຈໍການຊຳລະບິນຂອງທ່ານ</div>`
  }<input type="file" accept="image/*" style="display:none" onchange="payPick(this)"></label>
  <button class="btn" style="width:100%;margin-top:12px" onclick="paySubmit()">ສົ່ງສະລິບການຊຳລະ</button>
  ${payHist(n)}</div>`;
}

function payPick(inp) {
  resizeImage(inp, im => Math.min(1, 900 / Math.max(im.width, im.height)), 0.6, data => {
    payDraft.img = data;
    render();
  });
}

// This month or next month (paying ahead: rent and garbage only).
function setPayMonth(v) {
  payDraft.month = v;
  if (v !== thisMonth()) {
    payDraft.kinds = (payDraft.kinds || ["rent"]).filter(k => Logic.ADVANCE_KINDS.includes(k));
    if (!payDraft.kinds.length) payDraft.kinds = ["rent"];
  }
  render();
}

function togglePayKind(k, on) {
  const ks = new Set(payDraft.kinds || ["rent"]);
  on ? ks.add(k) : ks.delete(k);
  payDraft.kinds = PAY_KINDS.map(x => x[0]).filter(x => ks.has(x));
  render();
}

function setPayAmt(k, v) {
  payDraft.amts = payDraft.amts || {};
  payDraft.amts[k] = v;
  const el = $("pay_total");
  if (el) el.textContent = payTotal(me).toLocaleString();
}

// Rent (set by the admin) and garbage (flat fee) have fixed amounts; electricity and
// water are typed from the bill.
const fixedAmt = (k, n) =>
  k === "rent" ? Logic.dueFor(room(n), payDraft.month || thisMonth()) : k === "garbage" ? GARBAGE : 0;

function payItems(n) {
  const items = {};
  for (const k of payDraft.kinds || ["rent"]) {
    items[k] = fixedAmt(k, n) || parseInt(String((payDraft.amts || {})[k] || "").replace(/\D/g, ""), 10) || 0;
  }
  return items;
}

const payTotal = n => Object.values(payItems(n)).reduce((a, b) => a + b, 0);

function paySubmit() {
  const ok = act("slip", {
    kinds: payDraft.kinds || ["rent"],
    amts: payDraft.amts || {},
    img: payDraft.img || "",
    month: payDraft.month || thisMonth()
  });
  if (!ok) return;
  payDraft = {};
  render();
  toast(remote() && syncState === "err" ? "ບັນທຶກໄວ້ແລ້ວ · ຈະສົ່ງເມື່ອມີອິນເຕີເນັດ" : "ສົ່ງສະລິບການຊຳລະແລ້ວ");
}

// "Rent 3,500,000 + Water 50,000" for slips that list amounts per type.
const payBreakdown = p =>
  p.items && kindsOf(p).length > 1
    ? `<div class="mute">${kindsOf(p)
        .map(k => kindLabel(k) + " " + Number(p.items[k]).toLocaleString())
        .join(" + ")}</div>`
    : "";

function vPay(list) {
  return list
    .map(p => {
      const r = room(p.room);
      const t = r.t || {};
      return `<div class="card"><div style="display:flex;justify-content:space-between;gap:8px"><h3>ຫ້ອງ ${
        p.room
      } · ${esc(t.name)}</h3><span class="mute">${ago(p.ts)}</span></div>
  <div class="mute"><span class="badge b-warn">${kindsLabel(p)}</span> ${monthLabel(p.month)} · ລວມ ${Number(
        p.amount
      ).toLocaleString()} ກີບ</div>${payBreakdown(p)}
  ${["elec", "water"]
    .filter(k => p.items && p.items[k] !== undefined)
    .map(
      k =>
        `<label for="pa_${p.id}_${k}">${kindLabel(k)} (ກີບ) <span style="font-weight:400">· ແກ້ໄດ້ຖ້າຜູ້ເຊົ່າໃສ່ຜິດ</span></label><input id="pa_${p.id}_${k}" inputmode="numeric" value="${p.items[k]}">`
    )
    .join("")}
  <img ${img(p.img, 800)} alt="Payment slip" onclick="viewSlip(${
        p.id
      })" style="width:100%;max-height:200px;object-fit:contain;background:var(--vac);border-radius:10px;margin:10px 0;cursor:zoom-in">
  <div class="row"><button class="btn bad" onclick="rejectDlg('pay',${
    p.id
  })">ປະຕິເສດ</button><button class="btn ok" onclick="decidePay(${p.id},true)">ຢືນຢັນການຊຳລະ</button></div></div>`;
    })
    .join("");
}

function payHist(n, back) {
  const mine = S.pay.filter(p => p.room === n).sort((a, b) => b.month.localeCompare(a.month) || b.ts - a.ts);
  if (!mine.length) return back ? `<div class="mute" style="margin-top:10px">ຍັງບໍ່ມີປະຫວັດການຊຳລະ.</div>` : "";
  const rows = mine
    .map(
      p =>
        `<div role="button" tabindex="0" onclick="viewSlip(${p.id},${
          back ? `'${n}'` : "null"
        })" onkeydown="if(event.key==='Enter')this.click()" style="display:flex;gap:10px;align-items:center;padding:6px 0;border-top:1px solid var(--line);cursor:pointer">${
          p.img
            ? `<img ${img(p.img, 120)} alt="Slip" style="width:40px;height:40px;object-fit:cover;border-radius:8px;border:1px solid var(--line)">`
            : `<div aria-hidden="true" style="width:40px;height:40px;flex:none;display:grid;place-items:center;border-radius:8px;border:1px solid var(--line);background:var(--vac)">🧾</div>`
        }<div style="flex:1;min-width:0"><b>${kindsLabel(p)} · ${monthLabel(
          p.month
        )}</b><div class="mute">${Number(p.amount).toLocaleString()} ກີບ · ${ago(p.ts)}${
          p.manual ? ` · ແອດມິນບັນທຶກ · ${methodLabel(p)}${p.note ? ": " + esc(p.note) : ""}` : ""
        }</div>${
          p.status === "rejected"
            ? `<div class="reason">${esc(p.reason || "ກະລຸນາອັບໂຫຼດສະລິບທີ່ຊັດກວ່າ")}</div>`
            : ""
        }</div><span class="badge ${PB[p.status][0]}">${PB[p.status][1]}</span></div>`
    )
    .join("");
  return (
    `<h3 style="margin-top:12px;margin-bottom:2px">ປະຫວັດການຊຳລະ <span class="mute" style="font-weight:400">(ແຕະເພື່ອເບິ່ງຮູບ)</span></h3>` +
    (back ? `<div class="hist-box">${rows}</div>` : rows)
  );
}

function viewSlip(id, back) {
  const p = S.pay.find(x => x.id === id);
  if (!p) return;
  const d = $("dlg");
  d.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h3 style="margin:0">ຫ້ອງ ${
    p.room
  } · ${kindsLabel(p)} · ${monthLabel(p.month)}</h3><span class="badge ${PB[p.status][0]}">${PB[p.status][1]}</span></div>
  ${payBreakdown(p)}<div class="mute" style="margin:4px 0 10px">ລວມ ${Number(p.amount).toLocaleString()} ກີບ · ສົ່ງເມື່ອ ${new Date(
    p.ts
  ).toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  })}</div>
  ${
    p.manual ? `<div class="mute" style="margin-bottom:8px">🧾 ແອດມິນບັນທຶກ · ${methodLabel(p)}${p.note ? ": " + esc(p.note) : ""}</div>` : ""
  }${
    p.img
      ? `<a href="${esc(p.img)}" target="_blank" rel="noopener"><img ${img(p.img, 1600, true)} alt="Payment slip" style="width:100%;max-height:65vh;object-fit:contain;background:var(--vac);border-radius:10px"></a>`
      : ""
  }
  ${p.status === "rejected" && p.reason ? `<div class="reason">${esc(p.reason)}</div>` : ""}
  ${
    sess && sess.role === "admin" && p.status === "confirmed" && !p.manual
      ? `<button class="btn ghost" style="width:100%;margin-top:12px" onclick="undoPay(${p.id},${back ? `'${back}'` : "null"})">ຍົກເລີກການອະນຸມັດ</button>`
      : ""
  }${
    sess && sess.role === "admin"
      ? `<button class="btn bad" style="width:100%;margin-top:8px" onclick="delPayDlg(${p.id},${back ? `'${back}'` : "null"})">🗑 ລຶບລາຍການນີ້ອອກຈາກປະຫວັດ</button>`
      : ""
  }
  <button class="btn ghost" style="width:100%;margin-top:12px" onclick="${
    back ? `openRoom('${back}')` : "$('dlg').close()"
  }">${back ? "ກັບຄືນ" : "ປິດ"}</button>`;
  if (!d.open) d.showModal();
}

function decidePay(id, ok, reason) {
  const amts = {};
  ["elec", "water"].forEach(k => {
    const el = $("pa_" + id + "_" + k);
    if (el) amts[k] = el.value;
  });
  if (!act("decidePay", { id, ok, reason, amts })) return;
  render();
  toast(ok ? "ຢືນຢັນການຊຳລະແລ້ວ" : "ປະຕິເສດ ແລະ ແຈ້ງຜູ້ເຊົ່າແລ້ວ");
}

/* ---------- Record a payment by hand (admin) ---------- */

let rp = {};

// What is already settled for a room and month: paid, or a slip waiting for review
// (that slip must be approved or rejected instead). Those are not offered again.
const rpStatus = (n, m) => {
  const mine = S.pay.filter(p => p.room === n && p.month === m && p.status !== "rejected");
  const of = st => PAY_KINDS.map(x => x[0]).filter(k => mine.some(p => p.status === st && hasKind(p, k)));
  return { paid: of("confirmed"), waiting: of("pending") };
};
const rpOpen = (n, m) => {
  const st = rpStatus(n, m);
  return PAY_KINDS.map(x => x[0]).filter(k => !st.paid.includes(k) && !st.waiting.includes(k));
};
// Room list: rooms that have not paid rent for the month. A room opened directly (from
// its own details) stays available for its other unpaid types.
const rpRooms = m =>
  S.rooms.filter(r => r.t && (rpOpen(r.n, m).includes("rent") || (r.n === rp.only && rpOpen(r.n, m).length)));

function recordDlg(n) {
  if (!S.rooms.some(r => r.t)) {
    toast("ຍັງບໍ່ມີຜູ້ເຊົ່າ");
    return;
  }
  rp = { n: n || "", only: n || "", month: thisMonth(), kinds: ["rent"], amts: {}, method: "cash", note: "", img: "" };
  drawRecord();
}

function rpMonths() {
  const c = thisMonth(), p1 = Logic.prevMonth(c);
  return [Logic.prevMonth(p1), p1, c, Logic.nextMonth(c)];
}

const rpDefault = k => (k === "rent" ? Logic.dueFor(room(rp.n), rp.month) : k === "garbage" ? GARBAGE : "");

function drawRecord() {
  const d = $("dlg");
  const rooms = rpRooms(rp.month);
  // Keep the chosen room only while it still has something unpaid this month.
  if (!rooms.some(r => r.n === rp.n)) {
    rp.n = rooms.length ? rooms[0].n : "";
    rp.amts = {};
  }
  const open = rp.n ? rpOpen(rp.n, rp.month) : [];
  rp.kinds = rp.kinds.filter(k => open.includes(k));
  if (!rp.kinds.length && open.length) rp.kinds = [open[0]];
  const st = rp.n ? rpStatus(rp.n, rp.month) : { paid: [], waiting: [] };
  const monthPick = `<div><label for="rp_m">ເດືອນ</label><select id="rp_m" onchange="rp.month=this.value;rp.amts={};drawRecord()">${rpMonths()
    .map(m => `<option value="${m}" ${m === rp.month ? "selected" : ""}>${monthLabel(m)}</option>`)
    .join("")}</select></div>`;
  if (!rooms.length) {
    d.innerHTML = `<h2>ບັນທຶກການຊຳລະ</h2>${monthPick}
    <p class="mute" style="margin:14px 0">ທຸກຫ້ອງຊຳລະຄົບແລ້ວ (ຫຼື ລໍຖ້າກວດສອບ) ສຳລັບ${monthLabel(rp.month)}.</p>
    <button class="btn ghost" style="width:100%" onclick="$('dlg').close()">ປິດ</button>`;
    if (!d.open) d.showModal();
    return;
  }
  d.innerHTML = `<h2>ບັນທຶກການຊຳລະ</h2>
  <p class="mute" style="margin-top:-4px">ສຳລັບເງິນສົດ ຫຼື ໂອນໂດຍບໍ່ໄດ້ສົ່ງສະລິບ. ບັນທຶກເປັນ "ຊຳລະແລ້ວ" ທັນທີ.</p>
  <div class="row"><div><label for="rp_n">ຫ້ອງ</label><select id="rp_n" onchange="rp.n=this.value;rp.amts={};drawRecord()">${rooms
    .map(r => `<option value="${esc(r.n)}" ${r.n === rp.n ? "selected" : ""}>ຫ້ອງ ${esc(r.n)} · ${esc(r.t.name)}</option>`)
    .join("")}</select></div>
  ${monthPick}</div>
  ${
    st.paid.length || st.waiting.length
      ? `<div class="mute" style="margin-top:8px">${[
          st.paid.length ? "ຊຳລະແລ້ວ: " + st.paid.map(kindLabel).join(", ") : "",
          st.waiting.length ? "ລໍຖ້າກວດສອບ: " + st.waiting.map(kindLabel).join(", ") : ""
        ]
          .filter(Boolean)
          .join(" · ")}</div>`
      : ""
  }
  <label>ປະເພດການຊຳລະ</label><div class="kinds">${PAY_KINDS.filter(([k]) => open.includes(k)).map(([k, l]) => {
    const on = rp.kinds.includes(k);
    return `<div class="kind ${on ? "on" : ""}"><label class="check"><input type="checkbox" ${
      on ? "checked" : ""
    } onchange="rpToggle('${k}',this.checked)"><span>${l}</span></label>${
      on
        ? `<input class="kind-amt" inputmode="numeric" placeholder="ຈຳນວນເງິນ (ກີບ)" aria-label="ຈຳນວນເງິນ${l}" value="${esc(
            rp.amts[k] !== undefined ? rp.amts[k] : rpDefault(k)
          )}" oninput="rp.amts['${k}']=this.value">`
        : ""
    }</div>`;
  }).join("")}</div>
  <label>ຮັບເງິນແບບ</label><div class="row">${[
    ["cash", "💵 ເງິນສົດ"],
    ["transfer", "🏦 ໂອນ"]
  ]
    .map(
      ([k, l]) =>
        `<button type="button" class="btn ${rp.method === k ? "" : "ghost"}" aria-pressed="${rp.method === k}" onclick="rp.method='${k}';drawRecord()">${l}</button>`
    )
    .join("")}</div>
  <label for="rp_note">ໝາຍເຫດ <span style="font-weight:400">(ບໍ່ບັງຄັບ)</span></label><input id="rp_note" maxlength="200" placeholder="${
    rp.method === "transfer" ? "ເຊັ່ນ: BCEL, ໂອນຈາກບັນຊີພໍ່ແມ່" : "ເຊັ່ນ: ຈ່າຍໃຫ້ພະນັກງານ"
  }" value="${esc(rp.note)}" oninput="rp.note=this.value">
  <label>ຮູບໃບຮັບເງິນ <span style="font-weight:400">(ບໍ່ບັງຄັບ)</span></label>
  <label class="btn ghost" style="display:block;text-align:center;cursor:pointer;margin:0">${
    rp.img ? "✓ ມີຮູບແລ້ວ · ແຕະເພື່ອປ່ຽນ" : "ເລືອກຮູບ"
  }<input type="file" accept="image/*" style="display:none" onchange="rpPick(this)"></label>
  <div class="row" style="margin-top:14px"><button class="btn ghost" onclick="$('dlg').close()">ຍົກເລີກ</button><button class="btn ok" onclick="recordSave()">ບັນທຶກ</button></div>`;
  if (!d.open) d.showModal();
}

function rpToggle(k, on) {
  const ks = new Set(rp.kinds);
  on ? ks.add(k) : ks.delete(k);
  rp.kinds = PAY_KINDS.map(x => x[0]).filter(x => ks.has(x));
  drawRecord();
}

function rpPick(inp) {
  resizeImage(inp, im => Math.min(1, 900 / Math.max(im.width, im.height)), 0.6, data => {
    rp.img = data;
    drawRecord();
  });
}

function recordSave() {
  const amts = {};
  rp.kinds.forEach(k => (amts[k] = rp.amts[k] !== undefined ? rp.amts[k] : rpDefault(k)));
  const ok = act("recordPay", { n: rp.n, month: rp.month, kinds: rp.kinds, amts, method: rp.method, note: rp.note, img: rp.img });
  if (!ok) return;
  $("dlg").close();
  render();
  toast("ບັນທຶກການຊຳລະແລ້ວ");
}

// Admin removes a payment record from history for good (with a confirmation).
function delPayDlg(id, back) {
  const p = S.pay.find(x => x.id === id);
  if (!p) return;
  ask(
    "ລຶບລາຍການນີ້?",
    `<b>${esc(kindsLabel(p))} · ${monthLabel(p.month)}</b><br>ຫ້ອງ ${esc(p.room)} · ${kip(p.amount)} · ${esc(
      PB[p.status][1]
    )}<br><br>ລາຍການຈະຖືກລຶບອອກຈາກປະຫວັດ ແລະ Google Sheet ຖາວອນ${
      p.status === "confirmed" ? " ແລະ ຈະບໍ່ຖືກນັບເປັນເງິນທີ່ໄດ້ຮັບອີກ" : ""
    }. ກູ້ຄືນບໍ່ໄດ້.`,
    "ລຶບຖາວອນ",
    () => {
      if (!act("delPay", { id })) return;
      render();
      back ? openRoom(back) : $("dlg").close();
      toast("ລຶບລາຍການແລ້ວ");
    }
  );
}

// Undo an approval made by mistake (the slip goes back to waiting for review).
function undoPay(id, back) {
  const p = S.pay.find(x => x.id === id);
  if (!p) return;
  ask(
    p.manual ? "ລຶບລາຍການທີ່ບັນທຶກ?" : "ຍົກເລີກການອະນຸມັດ?",
    p.manual
      ? `ລາຍການ ${esc(kindsLabel(p))} ຫ້ອງ ${esc(p.room)} (${kip(p.amount)}) ທີ່ແອດມິນບັນທຶກ ຈະຖືກລຶບ ແລະ ບໍ່ຖືກນັບເປັນເງິນທີ່ໄດ້ຮັບ.`
      : `ສະລິບ ${esc(kindsLabel(p))} ຫ້ອງ ${esc(p.room)} (${kip(p.amount)}) ຈະກັບໄປເປັນ "ກຳລັງກວດສອບ" ແລະ ບໍ່ຖືກນັບເປັນເງິນທີ່ໄດ້ຮັບ.`,
    "ຍົກເລີກການອະນຸມັດ",
    () => {
      if (!act("undoPay", { id })) return;
      render();
      back ? openRoom(back) : $("dlg").close();
      toast("ຍົກເລີກການອະນຸມັດແລ້ວ");
    }
  );
}

function rejectDlg(kind, id) {
  const it = kind === "pay" ? S.pay.find(x => x.id === id) : S.pending.find(x => x.id === id);
  if (!it) return;
  const t = (room(it.room) || {}).t || {};
  $("dlg").innerHTML = `<h2>${kind === "pay" ? "ປະຕິເສດສະລິບການຊຳລະ" : "ປະຕິເສດການປ່ຽນແປງໂປຣໄຟລ໌"}</h2>
  <p class="mute">ຫ້ອງ ${it.room} · ${esc(t.name)}${kind === "pay" ? " · " + kindsLabel(it) + " " + monthLabel(it.month) : ""}</p>
  <label>ເລືອກເຫດຜົນດ່ວນ</label><div>${REASONS[kind]
    .map(r => `<button type="button" class="chip" onclick="addReason(this.textContent)">${esc(r)}</button>`)
    .join("")}</div>
  <label for="rj_t">ລາຍລະອຽດທີ່ຈະສົ່ງໃຫ້ຜູ້ເຊົ່າ</label><textarea id="rj_t" maxlength="300" placeholder="ອະທິບາຍບັນຫາ ແລະ ສິ່ງທີ່ຜູ້ເຊົ່າຕ້ອງເຮັດ..."></textarea>
  <div class="mute" style="margin-top:4px">ຜູ້ເຊົ່າຈະເຫັນຂໍ້ຄວາມນີ້ໃນໜ້າຂອງເຂົາເຈົ້າ.</div>
  <div class="row" style="margin-top:16px"><button class="btn ghost" onclick="$('dlg').close()">ຍົກເລີກ</button><button class="btn bad" onclick="confirmReject('${kind}',${id})">ປະຕິເສດ ແລະ ສົ່ງ</button></div>`;
  $("dlg").showModal();
  $("rj_t").focus();
}

function addReason(s) {
  const ta = $("rj_t");
  ta.value = ta.value.trim() ? ta.value.trim() + " · " + s : s;
  ta.focus();
}

function confirmReject(kind, id) {
  const v = $("rj_t").value.trim();
  if (!v) {
    toast("ກະລຸນາໃສ່ເຫດຜົນ");
    $("rj_t").focus();
    return;
  }
  $("dlg").close();
  kind === "pay" ? decidePay(id, false, v) : decide(id, false, v);
}

function payList(month) {
  const m = month || thisMonth();
  const rank = { none: 0, rejected: 1, pending: 2, confirmed: 3 };
  let rows = S.rooms
    .filter(r => r.t)
    .map(r => {
      const p = S.pay
        .filter(x => hasKind(x, "rent") && x.room === r.n && x.month === m)
        .sort((a, b) => b.ts - a.ts)[0];
      return { r, s: p ? p.status : "none" };
    });
  const paid = rows.filter(x => x.s === "confirmed").length;
  const total = rows.length;
  if (payFilter === "unpaid") rows = rows.filter(x => x.s !== "confirmed");
  rows.sort((a, b) => rank[a.s] - rank[b.s] || a.r.n.localeCompare(b.r.n, undefined, { numeric: true }));
  const fb = (k, l) =>
    `<button class="btn ${
      payFilter === k ? "" : "ghost"
    }" style="min-height:38px;padding:6px 14px" onclick="payFilter='${k}';render()">${l}</button>`;
  return `<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><h3 style="margin:0">ສະຖານະການຊຳລະຄ່າເຊົ່າ · ${monthLabel(
    m
  )}</h3><button class="btn" style="min-height:38px;padding:6px 12px" onclick="recordDlg()">+ ບັນທຶກການຊຳລະ</button></div><div class="mute">ຊຳລະແລ້ວ ${paid} / ${total} ຫ້ອງ</div><div class="bar" style="margin-bottom:10px"><i style="width:${
    total ? (paid / total) * 100 : 0
  }%"></i></div>
  <div class="row" style="margin-bottom:6px">${fb("all", "ທັງໝົດ")}${fb("unpaid", "ຍັງບໍ່ຈ່າຍ")}</div>
  ${
    rows.length
      ? rows
          .map(
            ({ r, s }) =>
              `<div style="display:flex;gap:10px;align-items:center;padding:9px 0;border-top:1px solid var(--line);cursor:pointer" onclick="openRoom('${
                r.n
              }')"><div style="flex:1;min-width:0"><b>ຫ້ອງ ${r.n}</b> · ${esc(
                r.t.name
              )}<div class="mute">${dueOf(r.n).toLocaleString()} ກີບ</div></div><span class="badge ${
                s === "none" ? "b-bad" : PB[s][0]
              }">${s === "none" ? "ຍັງບໍ່ໄດ້ຊຳລະ" : PB[s][1]}</span></div>`
          )
          .join("")
      : `<p class="mute">ທຸກຫ້ອງຊຳລະແລ້ວ</p>`
  }</div>`;
}

/* ---------- Auth & Room Management ---------- */

function vLogin() {
  const t = loginMode === "tenant";
  const tb = (k, l) => `<button class="btn ${loginMode === k ? "" : "ghost"}" onclick="loginMode='${k}';render()">${l}</button>`;
  return `<div class="login-brand"><div class="logo"><img src="icon-192.png" alt=""></div><h1>ຫ້ອງແຖວ🪿</h1></div><div class="card" style="max-width:420px;margin:0 auto;padding:22px"><h2 style="text-align:center;margin-top:0">ເຂົ້າສູ່ລະບົບ</h2><div class="row" style="margin-bottom:6px">${tb(
    "tenant",
    "ຜູ້ເຊົ່າ"
  )}${tb("admin", "ແອດມິນ")}</div>
  <label for="lg1">${t ? "ເລກຫ້ອງ" : "ຊື່ຜູ້ໃຊ້"}</label>${
    t && roomChoices().length
      ? `<input type="hidden" id="lg1" value=""><div class="room-pick" role="group" aria-label="ເລືອກຫ້ອງ">${roomChoices()
          .map(
            n =>
              `<button type="button" class="rp" data-n="${esc(n)}" aria-pressed="false" onclick="pickRoom(this)">${esc(n)}</button>`
          )
          .join("")}</div>`
      : `<input id="lg1" ${
          t ? 'inputmode="numeric"' : 'autocapitalize="none"'
        } autocomplete="username" onkeydown="if(event.key==='Enter')$('lg2').focus()">`
  }
  <label for="lg2">${t ? "ລະຫັດ PIN" : "ລະຫັດຜ່ານ"}</label><input id="lg2" type="password" ${
    t ? 'inputmode="numeric"' : ""
  } autocomplete="current-password" onkeydown="if(event.key==='Enter')doLogin()">
  <button id="lgb" class="btn" style="width:100%;margin-top:16px" onclick="doLogin()">ເຂົ້າສູ່ລະບົບ</button>
  ${(h => (h ? `<p class="mute" style="text-align:center;margin-bottom:0">${h}</p>` : ""))(
    remote()
      ? t
        ? "ໃຊ້ເລກຫ້ອງ ແລະ PIN ທີ່ແອດມິນໃຫ້<br>" + forgotPin()
        : ""
      : t
        ? "ທົດລອງ: ຫ້ອງ 5 · PIN 1234<br>" + forgotPin()
        : "ທົດລອງ: admin / admin123"
  )}<div id="installSlot">${installBtn()}</div></div>`;
}

// "Forgot PIN? Call …" with tappable phone numbers (CONTACT_PHONES in config.js).
const forgotPin = () =>
  "ຖ້າລືມ PIN ຕິດຕໍ່: " +
  CONTACT_PHONES.map(p => `<a href="tel:${esc(p)}" style="color:var(--brand);font-weight:600">${esc(p)}</a>`).join(", ");

// Room numbers for the tenant login dropdown: occupied rooms (connected: from the
// server's public check, remembered on the device; local demo: from local data).
const ROOMS_KEY = "courtyard_rooms";
let loginRooms = lsGet(ROOMS_KEY, []);
let loginRoomsAsked = false;

const roomChoices = () => (remote() ? loginRooms : S.rooms.filter(r => r.t).map(r => r.n));

// Tenant taps their room number; the PIN box is next.
function pickRoom(btn) {
  $("lg1").value = btn.dataset.n;
  document.querySelectorAll(".room-pick .rp").forEach(b => {
    const on = b === btn;
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", on);
  });
  $("lg2").focus();
}

async function loadLoginRooms() {
  if (!remote() || loginRoomsAsked) return;
  loginRoomsAsked = true;
  let h;
  try {
    h = await fetch(gsUrl + (gsUrl.indexOf("?") >= 0 ? "&" : "?") + "t=" + Date.now()).then(r => r.json());
  } catch (e) {
    return; // offline: keep the remembered list
  }
  if (!h || !Array.isArray(h.rooms) || JSON.stringify(h.rooms) === JSON.stringify(loginRooms)) return;
  loginRooms = h.rooms;
  lsSet(ROOMS_KEY, loginRooms);
  if (sess || !$("lg1")) return;
  // Redraw the login card, keeping what was already chosen and typed.
  const pick = $("lg1").value, pin = $("lg2").value;
  $("app").innerHTML = vLogin();
  const btn = [...document.querySelectorAll(".room-pick .rp")].find(b => b.dataset.n === pick);
  if (btn) pickRoom(btn);
  else if ($("lg1").type !== "hidden") $("lg1").value = pick;
  $("lg2").value = pin;
}

let loggingIn = false;

async function doLogin() {
  if (loggingIn) return;
  const mode = loginMode;
  const a = $("lg1").value.trim();
  const b = $("lg2").value;
  if (!a) {
    toast(mode === "tenant" ? "ກະລຸນາເລືອກຫ້ອງ" : "ກະລຸນາໃສ່ຊື່ຜູ້ໃຊ້");
    return;
  }
  if (remote()) {
    loggingIn = true;
    // The server can take a few seconds: show it is working so it does not look stuck.
    const btn = $("lgb");
    if (btn) {
      btn.disabled = true;
      btn.style.opacity = ".7";
      btn.textContent = "ກຳລັງເຂົ້າສູ່ລະບົບ…";
    }
    const ok = await remoteLogin(mode, a, b);
    loggingIn = false;
    if (!ok) {
      if (btn) {
        btn.disabled = false;
        btn.style.opacity = "";
        btn.textContent = "ເຂົ້າສູ່ລະບົບ";
      }
      return;
    }
  } else {
    try {
      const who = Logic.login(S, mode, a, b, localCtx());
      sess = who.role === "admin" ? { role: "admin" } : { role: "tenant", room: who.room };
    } catch (e) {
      toast(e.message);
      return;
    }
    lsSet(SESS_KEY, sess);
  }
  tab = sess.role === "admin" ? "dash" : "home";
  editing = false;
  payDraft = {};
  render();
  maybeInstallPopup();
}

function logout() {
  if (remote() && outbox.length) {
    return ask(
      "ອອກຈາກລະບົບ?",
      `ຍັງມີ <b>${outbox.length}</b> ລາຍການທີ່ຍັງບໍ່ໄດ້ສົ່ງໄປ Google Sheet (ບໍ່ມີອິນເຕີເນັດ). ຖ້າອອກຈາກລະບົບດຽວນີ້ ລາຍການເຫຼົ່ານີ້ຈະຫາຍໄປ.`,
      "ອອກ ແລະ ລຶບລາຍການ",
      () => {
        $("dlg").close();
        outbox = [];
        saveOutbox();
        logout();
      }
    );
  }
  clearSession();
  loginRoomsAsked = false;
  render();
}

// Change the admin username/password (needs the current password).
function passDlg() {
  $("dlg").innerHTML = `<h2>ປ່ຽນລະຫັດຜ່ານແອດມິນ</h2>
  <label for="ap_o">ລະຫັດຜ່ານປັດຈຸບັນ</label><input id="ap_o" type="password" autocomplete="current-password">
  <label for="ap_u">ຊື່ຜູ້ໃຊ້</label><input id="ap_u" autocapitalize="none" value="${esc((S.admin && S.admin.user) || "admin")}">
  <label for="ap_n">ລະຫັດຜ່ານໃໝ່ (ຢ່າງໜ້ອຍ 6 ຕົວ)</label><input id="ap_n" type="password" autocomplete="new-password">
  <label for="ap_c">ຢືນຢັນລະຫັດຜ່ານໃໝ່</label><input id="ap_c" type="password" autocomplete="new-password">
  <div class="row" style="margin-top:16px"><button class="btn ghost" onclick="$('dlg').close()">ຍົກເລີກ</button><button class="btn" onclick="savePass()">ບັນທຶກ</button></div>`;
  if (!$("dlg").open) $("dlg").showModal();
  $("ap_o").focus();
}

async function savePass() {
  if ($("ap_n").value !== $("ap_c").value) {
    toast("ລະຫັດຜ່ານໃໝ່ທັງສອງບໍ່ກົງກັນ");
    return;
  }
  const args = { old: $("ap_o").value, user: $("ap_u").value, pass: $("ap_n").value };
  if (!remote()) {
    if (!act("adminPass", args)) return;
  } else {
    // Only the server holds the password hash, so it must check the current password:
    // send this straight away and wait for its answer instead of queueing it.
    await sync();
    let j;
    try {
      j = await post({ action: "sync", token: sess.token, ops: [{ type: "adminPass", args }] });
    } catch (e) {
      toast("ເຊື່ອມຕໍ່ບໍ່ໄດ້. ກວດສອບອິນເຕີເນັດແລ້ວລອງໃໝ່.");
      return;
    }
    if (!j || !j.ok) return j && j.auth ? forceLogout(j.error) : toast((j && j.error) || "ບໍ່ສຳເລັດ");
    const r = (j.results || [])[0];
    if (!r || !r.ok) {
      toast((r && r.error) || "ບໍ່ສຳເລັດ");
      return;
    }
    takeServer(j);
    saveLocal();
  }
  $("dlg").close();
  render();
  toast("ປ່ຽນລະຫັດຜ່ານແລ້ວ");
}

function addRoomDlg() {
  const next = Math.max(0, ...S.rooms.map(r => parseInt(r.n, 10) || 0)) + 1;
  $("dlg").innerHTML = `<h2>ເພີ່ມຫ້ອງ</h2><p class="mute">ຕອນນີ້ມີ ${S.rooms.length} ຫ້ອງ (ສູງສຸດ 50)</p>
  <label for="ar_n">ເລກຫ້ອງ (ຫ້ອງທຳອິດ)</label><input id="ar_n" inputmode="numeric" value="${next}">
  <label for="ar_c">ຈຳນວນຫ້ອງທີ່ຈະເພີ່ມ (ເລກຕໍ່ເນື່ອງ)</label><input id="ar_c" inputmode="numeric" value="1">
  <label for="ar_r">ຄ່າເຊົ່າລາຍເດືອນ (ກີບ)</label><input id="ar_r" inputmode="numeric" value="${RENT}">
  <div class="row" style="margin-top:16px"><button class="btn ghost" onclick="$('dlg').close()">ຍົກເລີກ</button><button class="btn" onclick="addRoom()">ເພີ່ມຫ້ອງ</button></div>`;
  $("dlg").showModal();
}

function addRoom() {
  const cnt = parseInt($("ar_c").value, 10) || 1;
  if (!act("addRooms", { num: $("ar_n").value, cnt, rent: $("ar_r").value })) return;
  $("dlg").close();
  render();
  toast("ເພີ່ມ " + cnt + " ຫ້ອງແລ້ວ");
}

function delRoom(n, yes) {
  const r = room(n);
  if (!r) return;
  if (!yes) {
    return ask(
      `ລຶບຫ້ອງ ${esc(n)}?`,
      r.t
        ? `ຫ້ອງນີ້ມີຜູ້ເຊົ່າ <b>${esc(
            r.t.name
          )}</b>. ການລຶບຈະລົບຂໍ້ມູນຜູ້ເຊົ່າ ແລະ ປະຫວັດການຊຳລະທັງໝົດ ແລະ ບໍ່ສາມາດກູ້ຄືນໄດ້.`
        : "ການກະທຳນີ້ບໍ່ສາມາດກູ້ຄືນໄດ້.",
      "ລຶບຫ້ອງ",
      () => delRoom(n, true)
    );
  }
  if (!act("delRoom", { n })) return;
  if (me === n) me = "";
  if ($("dlg").open) $("dlg").close();
  render();
  toast("ລຶບຫ້ອງ " + n + " ແລ້ວ");
}

function resetDemo() {
  ask("ຣີເຊັດຂໍ້ມູນທົດລອງ?", "ຂໍ້ມູນທັງໝົດຈະຖືກແທນທີ່ດ້ວຍຂໍ້ມູນຕົວຢ່າງ.", "ຣີເຊັດ", () => {
    S = Logic.normalize(seed());
    Logic.migrate(S, localCtx());
    saveLocal();
    $("dlg").close();
    render();
    toast("ຣີເຊັດແລ້ວ");
  });
}

function ask(title, body, okLabel, cb) {
  askCb = cb;
  const d = $("dlg");
  d.innerHTML = `<h2>${title}</h2><p class="mute" style="font-size:14px;margin:0 0 4px">${body}</p>
  <div class="row" style="margin-top:18px"><button class="btn ghost" onclick="askCb=null;$('dlg').close()">ຍົກເລີກ</button><button class="btn bad" style="background:var(--bad);color:#fff" onclick="const f=askCb;askCb=null;f&&f()">${okLabel}</button></div>`;
  if (!d.open) d.showModal();
}

/* ---------- Water & Electricity Usage Chart (admin) ---------- */

let usageMonth = null;
// The chart card starts collapsed; the open/closed choice is remembered on this device.
let usageOpen = (() => {
  try {
    return localStorage.getItem("courtyard_usage_open") === "1";
  } catch (e) {
    return false;
  }
})();

function toggleUsage() {
  usageOpen = !usageOpen;
  try {
    localStorage.setItem("courtyard_usage_open", usageOpen ? "1" : "0");
  } catch (e) {}
  usageTip(null);
  render();
}
// Series order is fixed: slot 1 = water, slot 2 = electricity.
const USAGE = [
  ["water", "ຄ່ານ້ຳ"],
  ["elec", "ຄ່າໄຟຟ້າ"]
];

// Rounds the axis maximum up to 1, 2, 2.5 or 5 x 10^n.
function niceMax(v) {
  if (!v) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  return [1, 2, 2.5, 5, 10].map(x => x * p).find(x => x >= v);
}

const kip = v => Number(v).toLocaleString() + " ກີບ";
const kipShort = v => (v >= 1e6 ? +(v / 1e6).toFixed(2) + "M" : v >= 1e3 ? +(v / 1e3).toFixed(1) + "K" : String(v));

function usageChart() {
  const slips = S.pay.filter(p => p.status === "confirmed" && USAGE.some(([k]) => amtFor(p, k)));
  const cur = thisMonth();
  const months = [...new Set([cur, ...slips.map(p => p.month)])].sort().reverse();
  const m = months.includes(usageMonth) ? usageMonth : cur;
  const rows = S.rooms
    .map(r => {
      const mine = slips.filter(p => p.room === r.n && p.month === m);
      const row = { n: r.n, name: r.t ? r.t.name : "" };
      USAGE.forEach(([k]) => (row[k] = mine.reduce((a, p) => a + amtFor(p, k), 0)));
      return row;
    })
    .filter(x => USAGE.some(([k]) => x[k]));
  const max = niceMax(Math.max(0, ...rows.flatMap(x => USAGE.map(([k]) => x[k]))));
  const tot = k => rows.reduce((a, x) => a + x[k], 0);
  const pct = v => (v ? Math.max(1, (v / max) * 100) : 0);

  const picker = `<select class="usage-m" aria-label="ເລືອກເດືອນ" onchange="usageMonth=this.value;render()">${months
    .map(x => `<option value="${x}" ${x === m ? "selected" : ""}>${monthLabel(x)}</option>`)
    .join("")}</select>`;
  const legend = `<div class="u-legend">${USAGE.map(
    ([k, l], i) => `<span><i class="u-sw s${i + 1}"></i>${l}</span>`
  ).join("")}</div>`;

  const body = rows.length
    ? `<div class="u-chart" role="list" aria-label="ຄ່ານ້ຳ ແລະ ຄ່າໄຟຟ້າ ແຕ່ລະຫ້ອງ ${monthLabel(m)}">
    ${rows
      .map(
        x => `<div class="u-row" role="listitem" tabindex="0" data-room="${esc(x.n)}" aria-label="ຫ້ອງ ${esc(x.n)}: ${USAGE.map(
          ([k, l]) => l + " " + kip(x[k])
        ).join(", ")}"><span class="u-lab">${esc(x.n)}</span><span class="u-track">${USAGE.map(
          ([k], i) => `<i class="u-bar s${i + 1}" style="width:${pct(x[k])}%"></i>`
        ).join("")}</span></div>`
      )
      .join("")}
    <div class="u-axis"><span></span><span class="u-ticks"><span>0</span><span>${kipShort(max / 2)}</span><span>${kipShort(
        max
      )}</span></span></div>
  </div>
  <div class="mute" style="margin-top:8px">ລວມ: ຄ່ານ້ຳ ${kip(tot("water"))} · ຄ່າໄຟຟ້າ ${kip(tot("elec"))}${
        S.pay.some(p => p.month === m && p.status === "pending" && USAGE.some(([k]) => amtFor(p, k)))
          ? " · ສະລິບທີ່ລໍຖ້າກວດສອບຍັງບໍ່ນັບ"
          : ""
      }</div>
  <details class="u-table"><summary>ສະແດງເປັນຕາຕະລາງ</summary><table><thead><tr><th>ຫ້ອງ</th>${USAGE.map(
        ([, l]) => `<th>${l}</th>`
      ).join("")}</tr></thead><tbody>${rows
        .map(
          x => `<tr><td>${esc(x.n)}${x.name ? ` · ${esc(x.name)}` : ""}</td>${USAGE.map(([k]) => `<td>${x[k] ? x[k].toLocaleString() : "—"}</td>`).join("")}</tr>`
        )
        .join("")}</tbody></table></details>`
    : `<p class="mute">ຍັງບໍ່ມີສະລິບຄ່ານ້ຳ ຫຼື ຄ່າໄຟຟ້າ ໃນ${monthLabel(m)}.</p>`;

  const summary = rows.length ? `ຄ່ານ້ຳ ${kip(tot("water"))} · ຄ່າໄຟຟ້າ ${kip(tot("elec"))}` : "ຍັງບໍ່ມີຂໍ້ມູນ";
  return `<div class="card"><div class="u-head"><button type="button" class="u-toggle" aria-expanded="${usageOpen}" onclick="toggleUsage()"><span class="u-chev" aria-hidden="true">${
    usageOpen ? "▾" : "▸"
  }</span><span><b>ຄ່ານ້ຳ ແລະ ຄ່າໄຟຟ້າ ແຕ່ລະຫ້ອງ</b>${
    usageOpen ? "" : `<span class="mute u-sum">${monthLabel(m)} · ${summary} · ແຕະເພື່ອເບິ່ງກຣາຟ</span>`
  }</span></button>${usageOpen ? picker : ""}</div>${usageOpen ? legend + body : ""}</div>`;
}

// One tooltip for every chart row: hover, keyboard focus or tap shows the room's amounts.
function usageTip(row) {
  let tip = $("usageTip");
  if (!tip) {
    tip = document.createElement("div");
    tip.id = "usageTip";
    tip.className = "u-tip";
    tip.setAttribute("role", "tooltip");
    document.body.appendChild(tip);
  }
  if (!row) {
    tip.style.display = "none";
    return;
  }
  const n = row.dataset.room;
  const r = room(n);
  const m = $("app").querySelector(".usage-m").value;
  const mine = S.pay.filter(p => p.room === n && p.month === m && p.status === "confirmed");
  tip.innerHTML = `<b>ຫ້ອງ ${esc(n)}${r && r.t ? " · " + esc(r.t.name) : ""}</b>${USAGE.map(
    ([k, l], i) =>
      `<div><i class="u-sw s${i + 1}"></i>${l}: <b>${kip(mine.reduce((a, p) => a + amtFor(p, k), 0))}</b></div>`
  ).join("")}`;
  tip.style.display = "block";
  const b = row.getBoundingClientRect();
  const w = tip.offsetWidth;
  tip.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, b.left + b.width / 2 - w / 2)) + "px";
  tip.style.top = (b.top - tip.offsetHeight - 6 < 8 ? b.bottom + 6 : b.top - tip.offsetHeight - 6) + "px";
}

["mouseover", "focusin", "click"].forEach(ev =>
  document.addEventListener(ev, e => {
    const row = e.target.closest && e.target.closest(".u-row");
    if (row || ev !== "focusin") usageTip(row);
  })
);
document.addEventListener("scroll", () => usageTip(null), true);

/* ---------- Install as an App (PWA) ---------- */

let installEvt = null;
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

// Shown when the browser offers installing (Android/desktop Chrome, Edge) or on iPhone/iPad,
// where installing is done by hand from Safari's Share menu. Hidden once installed.
function installBtn() {
  if (isStandalone() || (!installEvt && !isIOS())) return "";
  return `<button class="btn ghost" style="width:100%;margin-top:10px" onclick="installApp()">📲 ຕິດຕັ້ງແອັບໃສ່ໜ້າຈໍ</button>`;
}

function refreshInstallSlot() {
  const s = $("installSlot");
  if (s) s.innerHTML = installBtn();
}

async function installApp() {
  if (installEvt) {
    if ($("dlg").open) $("dlg").close();
    installEvt.prompt();
    await installEvt.userChoice;
    installEvt = null;
    refreshInstallSlot();
    return;
  }
  const d = $("dlg");
  d.innerHTML = `<h2>ຕິດຕັ້ງແອັບໃສ່ iPhone / iPad</h2>
  <ol style="line-height:1.9;padding-left:20px;margin:8px 0">
    <li>ເປີດເວັບນີ້ໃນ <b>Safari</b></li>
    <li>ກົດປຸ່ມ <b>ແບ່ງປັນ</b> (ສີ່ຫຼ່ຽມມີລູກສອນຊີ້ຂຶ້ນ <span aria-hidden="true">⬆︎</span>)</li>
    <li>ເລືອກ <b>"ເພີ່ມໃສ່ໜ້າຈໍຫຼັກ"</b> (Add to Home Screen)</li>
    <li>ກົດ <b>ເພີ່ມ</b> (Add) — ໄອຄອນ 🪿 ຈະຢູ່ໜ້າຈໍຂອງທ່ານ</li>
  </ol>
  <button class="btn" style="width:100%;margin-top:10px" onclick="$('dlg').close()">ເຂົ້າໃຈແລ້ວ</button>`;
  if (!d.open) d.showModal();
}

// Popup asking logged-in people to install the app. Not shown when the app is already
// running installed (opened from the home screen), and after "ພາຍຫຼັງ" it waits a day.
// Chrome/Android only offer installing when the app is not installed yet; iPhone
// cannot tell, so Safari users who already installed may still see it once a day.
const INSTALL_LATER_KEY = "courtyard_install_later";
let installAsked = false;

function maybeInstallPopup() {
  if (installAsked || !sess || isStandalone() || (!installEvt && !isIOS())) return;
  let later = 0;
  try {
    later = Number(localStorage.getItem(INSTALL_LATER_KEY) || 0);
  } catch (e) {}
  if (Date.now() - later < 864e5) return;
  setTimeout(() => {
    const d = $("dlg");
    if (installAsked || !sess || d.open || isStandalone()) return;
    installAsked = true;
    d.innerHTML = `<div style="text-align:center"><div class="logo" style="width:64px;height:64px;margin:4px auto 10px"><img src="icon-192.png" alt=""></div>
    <h2 style="margin:0 0 6px">ຕິດຕັ້ງແອັບ ຫ້ອງແຖວ🪿</h2>
    <p class="mute" style="margin:0 0 4px;line-height:1.6">ເປີດໄດ້ໄວຈາກໜ້າຈໍໂທລະສັບ ຄືແອັບທົ່ວໄປ<br>ແລະ ເປີດໄດ້ເຖິງວ່າອິນເຕີເນັດບໍ່ດີ</p></div>
    <div class="row" style="margin-top:16px"><button class="btn ghost" onclick="installLater()">ພາຍຫຼັງ</button><button class="btn" onclick="installApp()">📲 ຕິດຕັ້ງ</button></div>`;
    d.showModal();
  }, 900);
}

function installLater() {
  try {
    localStorage.setItem(INSTALL_LATER_KEY, String(Date.now()));
  } catch (e) {}
  $("dlg").close();
}

window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  installEvt = e;
  refreshInstallSlot();
  maybeInstallPopup();
});

window.addEventListener("appinstalled", () => {
  installEvt = null;
  refreshInstallSlot();
  toast("ຕິດຕັ້ງແອັບແລ້ວ");
});

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  const hadWorker = !!navigator.serviceWorker.controller;
  navigator.serviceWorker
    .register("sw.js", { updateViaCache: "none" })
    .then(reg => {
      // Look for a new version whenever the app is brought back to the front.
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") reg.update().catch(() => {});
      });
    })
    .catch(() => {});
  // A new version finished downloading in the background: switch to it now if nobody
  // is in the middle of something, otherwise it is used the next time the app opens.
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadWorker || reloading) return;
    const a = document.activeElement;
    const busy = $("dlg").open || editing || payDraft.img || (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
    if (busy) return;
    reloading = true;
    location.reload();
  });
}

/* ---------- Modal Backdrop Dismiss & App Bootstrap ---------- */

$("dlg").addEventListener("click", e => {
  if (e.target === $("dlg")) {
    const r = $("dlg").getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
      askCb = null;
      $("dlg").close();
    }
  }
});

render();
sync();
maybeInstallPopup();
