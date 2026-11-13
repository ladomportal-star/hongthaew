/* ==========================================================================
   0. Shared Rules — runs in the app AND in Google Apps Script (copied into
   GoogleAppsScript.gs by build.py). Every change to the data goes
   through Logic.apply(state, {type, args}, ctx), so the server enforces the
   same rules the app shows. Keep this plain JavaScript (no DOM, no ?. / ??).
   ========================================================================== */

const RENT = 3500000;
const GARBAGE = 80000; // fixed monthly garbage fee (kip)
const MAX_ROOMS = 50;
const DEFAULT_PIN = "1234"; // used when the admin adds a tenant without choosing a PIN

const FIELDS = [
  ["name", "ຊື່ ແລະ ນາມສະກຸນ"],
  ["dob", "ວັນເດືອນປີເກີດ"],
  ["phone", "ເບີໂທ"],
  ["idno", "ເລກບັດປະຊາຊົນ / ໜັງສືຜ່ານແດນ"],
  ["emerg", "ຜູ້ຕິດຕໍ່ສຸກເສີນ"],
  ["elec", "ເລກມິເຕີໄຟຟ້າ"],
  ["water", "ເລກບິນນ້ຳ"]
];

// Profile fields only the admin can change (tenants see them read-only).
const ADMIN_ONLY = ["elec", "water"];

// What a payment slip is for. Payments saved before this existed count as rent.
const PAY_KINDS = [
  ["rent", "ຄ່າເຊົ່າ", "Rent"],
  ["elec", "ຄ່າໄຟຟ້າ", "Electric"],
  ["water", "ຄ່ານ້ຳ", "Water"],
  ["garbage", "ຄ່າຂີ້ເຫຍື້ອ", "Garbage"]
];
const kindLabel = k => (PAY_KINDS.find(x => x[0] === k) || PAY_KINDS[0])[1];
// How the admin received a payment they record by hand.
const PAY_METHODS = { cash: "ເງິນສົດ", transfer: "ໂອນ" };
const methodLabel = p => (p.manual ? PAY_METHODS[p.method || "cash"] || PAY_METHODS.cash : "");

// One slip can cover several types: p.items = { rent: 3500000, water: 50000 }.
const kindsOf = p => (p.items ? Object.keys(p.items) : [p.kind || "rent"]);
const hasKind = (p, k) => kindsOf(p).indexOf(k) >= 0;
const kindsLabel = p => kindsOf(p).map(kindLabel).join(" + ");
// Amount of one type on a slip (older single-type slips use kind, or nothing = rent).
const amtFor = (p, k) => (p.items ? Number(p.items[k]) || 0 : (p.kind || "rent") === k ? Number(p.amount) || 0 : 0);

const Logic = (function () {
  // Tenants cannot change their own PIN; only the admin sets it (editTenant).
  const TENANT_ACTIONS = ["profile", "dismiss", "slip"];
  const ADMIN_ACTIONS = [
    "decideProfile", "decidePay", "undoPay", "recordPay", "addRooms", "editRoom", "delRoom",
    "moveIn", "moveOut", "editTenant", "adminPass"
  ];

  function fail(msg) {
    throw new Error(msg);
  }
  const num = v => parseInt(String(v === undefined || v === null ? "" : v).replace(/\D/g, ""), 10) || 0;
  const text = (v, max) => String(v === undefined || v === null ? "" : v).trim().slice(0, max || 200);
  const isDate = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
  const roomOf = (S, n) => S.rooms.find(r => r.n === n);

  function normalize(S) {
    S.rooms = S.rooms || [];
    S.pay = S.pay || [];
    S.payArchive = S.payArchive || [];
    S.pending = S.pending || [];
    S.notices = S.notices || {};
    S.pastTenants = S.pastTenants || [];
    S.admin = S.admin || {};
    S.nid = S.nid || 1000;
    return S;
  }

  function sortRooms(S) {
    S.rooms.sort((a, b) => {
      if ((a.floor || 1) !== (b.floor || 1)) return (a.floor || 1) - (b.floor || 1);
      const x = Number(a.n), y = Number(b.n);
      if (!isNaN(x) && !isNaN(y)) return x - y;
      return a.n < b.n ? -1 : a.n > b.n ? 1 : 0;
    });
  }

  // A "due" override only applies to the month it is for; otherwise the rent is due.
  const dueActive = (r, month) => !!(r && r.due && r.dueMonth === month);
  const dueFor = (r, month) => (dueActive(r, month) ? r.due : r.rent);
  function setDue(r, due, month) {
    if (due && due !== r.rent) {
      r.due = due;
      r.dueMonth = month;
    } else {
      delete r.due;
      delete r.dueMonth;
    }
  }

  function prevMonth(m) {
    const y = Number(m.slice(0, 4)), mo = Number(m.slice(5, 7));
    return mo === 1 ? y - 1 + "-12" : y + "-" + String(mo - 1).padStart(2, "0");
  }

  function nextMonth(m) {
    const y = Number(m.slice(0, 4)), mo = Number(m.slice(5, 7));
    return mo === 12 ? y + 1 + "-01" : y + "-" + String(mo + 1).padStart(2, "0");
  }

  // Paying ahead (next month) is for the fixed amounts only: bills for electricity
  // and water are not known yet.
  const ADVANCE_KINDS = ["rent", "garbage"];

  // Ids come from the device (so an offline action and its later references agree),
  // falling back to a server counter if that id is already taken.
  function newId(S, a) {
    const id = Number(a.id);
    const taken = x => S.pay.some(p => p.id === x) || S.pending.some(p => p.id === x);
    if (id && !taken(id)) return id;
    while (taken(S.nid)) S.nid++;
    return S.nid++;
  }

  // Images must be a real base64 photo (uploaded to Drive on the server) — never
  // arbitrary text, which could break out of an <img> tag on the admin's screen.
  function cleanImg(v, allowEmpty) {
    v = String(v || "");
    if (!v) {
      if (allowEmpty) return "";
      fail("ກະລຸນາອັບໂຫຼດຮູບ");
    }
    if (v.length < 4e6 && /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(v)) return v;
    fail("ຮູບບໍ່ຖືກຕ້ອງ");
  }

  function tenantRoom(S, ctx) {
    const r = roomOf(S, ctx.room);
    if (!r || !r.t) fail("ບໍ່ພົບຫ້ອງຂອງທ່ານ");
    return r;
  }

  const A = {};

  /* ---------- Tenant actions (always for the tenant's own room) ---------- */

  // Profile change request; the admin approves it. merge: add to an existing request.
  A.profile = (S, a, ctx) => {
    const r = tenantRoom(S, ctx);
    const t = r.t;
    const ch = {};
    const allowed = FIELDS.map(f => f[0]).filter(k => ADMIN_ONLY.indexOf(k) < 0);
    const src = a.ch || {};
    allowed.forEach(k => {
      if (src[k] === undefined) return;
      const v = text(src[k]);
      if (v !== (t[k] || "")) ch[k] = v;
    });
    if (src.photo !== undefined && src.photo !== t.photo) {
      const img = cleanImg(src.photo, true);
      ch.photo = img ? ctx.upload(img, "profile_room_" + r.n) : "";
    }
    if (ch.name !== undefined && !ch.name) fail("ກະລຸນາໃສ່ຊື່");
    const prev = S.pending.find(p => p.room === r.n);
    if (a.merge && prev) {
      Object.assign(prev.ch, ch);
      prev.ts = ctx.now;
    } else {
      S.pending = S.pending.filter(p => p.room !== r.n);
      if (Object.keys(ch).length) S.pending.push({ id: newId(S, a), room: r.n, ts: ctx.now, ch: ch });
    }
    delete S.notices[r.n];
    return { changed: Object.keys(ch).length };
  };

  A.dismiss = (S, a, ctx) => {
    delete S.notices[tenantRoom(S, ctx).n];
  };

  A.slip = (S, a, ctx) => {
    const r = tenantRoom(S, ctx);
    const kinds = PAY_KINDS.map(x => x[0]).filter(k => (a.kinds || []).indexOf(k) >= 0);
    if (!kinds.length) fail("ກະລຸນາເລືອກປະເພດການຊຳລະ");
    // The month is checked against the server's clock: a phone with a wrong date
    // cannot file a slip under another month. Allowed: this month, next month (paying
    // ahead), and — early in a new month — last month, for a slip queued offline.
    const m = String(a.month || ctx.month);
    const ahead = m === nextMonth(ctx.month);
    const ok = m === ctx.month || ahead || (m === prevMonth(ctx.month) && ctx.day <= 3);
    if (!ok && /^\d{4}-\d{2}$/.test(m) && m > nextMonth(ctx.month)) fail("ຈ່າຍລ່ວງໜ້າໄດ້ພຽງ 1 ເດືອນ");
    if (!ok) fail("ວັນທີໃນໂທລະສັບບໍ່ຖືກຕ້ອງ. ກະລຸນາກວດສອບວັນທີ ແລ້ວລອງໃໝ່.");
    if (ahead && kinds.some(k => ADVANCE_KINDS.indexOf(k) < 0))
      fail("ຈ່າຍລ່ວງໜ້າໄດ້ສະເພາະ ຄ່າເຊົ່າ ແລະ ຄ່າຂີ້ເຫຍື້ອ");
    const img = cleanImg(a.img);
    const items = {};
    kinds.forEach(k => {
      const v = k === "rent" ? dueFor(r, m) : k === "garbage" ? GARBAGE : num((a.amts || {})[k]);
      if (!v) fail(k === "rent" ? "ແອດມິນຍັງບໍ່ໄດ້ກຳນົດຍອດ" : "ກະລຸນາໃສ່ຈຳນວນເງິນ" + kindLabel(k));
      if (v > 50000000) fail("ຈຳນວນເງິນ" + kindLabel(k) + " ບໍ່ຖືກຕ້ອງ");
      items[k] = v;
    });
    const monthSlips = S.pay.filter(p => p.room === r.n && p.month === m);
    const paid = kinds.find(k => monthSlips.some(p => p.status === "confirmed" && hasKind(p, k)));
    if (paid) fail(kindLabel(paid) + " ເດືອນນີ້ຊຳລະແລ້ວ");
    // An earlier unconfirmed slip is replaced only when this one covers everything it
    // did; otherwise the types not being resent would be lost.
    const overlap = monthSlips.filter(p => p.status !== "confirmed" && kinds.some(k => hasKind(p, k)));
    const partial = overlap.find(p => p.status === "pending" && !kindsOf(p).every(k => kinds.indexOf(k) >= 0));
    if (partial) fail("ມີສະລິບ " + kindsLabel(partial) + " ລໍຖ້າກວດສອບຢູ່ແລ້ວ");
    const replace = overlap.filter(p => kindsOf(p).every(k => kinds.indexOf(k) >= 0)).map(p => p.id);
    S.pay = S.pay.filter(p => replace.indexOf(p.id) < 0);
    const id = newId(S, a);
    S.pay.push({
      id: id,
      room: r.n,
      month: m,
      items: items,
      amount: Object.keys(items).reduce((s, k) => s + items[k], 0),
      img: ctx.upload(img, "slip_room_" + r.n + "_" + m + "_" + id),
      ts: ctx.now,
      status: "pending"
    });
  };

  /* ---------- Admin actions ---------- */

  A.decideProfile = (S, a, ctx) => {
    const p = S.pending.find(x => x.id === a.id);
    if (!p) fail("ຄຳຂໍນີ້ຖືກກວດສອບແລ້ວ");
    const r = roomOf(S, p.room);
    if (a.ok && r && r.t) {
      const ch = Object.assign({}, p.ch);
      ADMIN_ONLY.forEach(k => delete ch[k]);
      Object.assign(r.t, ch);
    }
    S.notices[p.room] = {
      ok: !!a.ok,
      msg: a.ok ? "ໂປຣໄຟລ໌ຂອງທ່ານຖືກອັບເດດແລ້ວ." : text(a.reason, 300) || "ກະລຸນາກວດສອບຂໍ້ມູນແລ້ວລອງໃໝ່ ຫຼື ຕິດຕໍ່ຫ້ອງການ.",
      ts: ctx.now
    };
    S.pending = S.pending.filter(x => x.id !== a.id);
  };

  // Approve or reject a slip. When approving, the admin may correct the electricity
  // and water amounts typed by the tenant (rent and garbage are fixed).
  A.decidePay = (S, a, ctx) => {
    const p = S.pay.find(x => x.id === a.id);
    if (!p) fail("ບໍ່ພົບສະລິບ");
    if (p.status !== "pending") fail("ສະລິບນີ້ຖືກກວດສອບແລ້ວ");
    if (a.ok) {
      if (a.amts && p.items) {
        ["elec", "water"].forEach(k => {
          if (p.items[k] === undefined || a.amts[k] === undefined) return;
          const v = num(a.amts[k]);
          if (!v) fail("ກະລຸນາໃສ່ຈຳນວນເງິນ" + kindLabel(k));
          p.items[k] = v;
        });
        p.amount = Object.keys(p.items).reduce((s, k) => s + p.items[k], 0);
      }
      p.status = "confirmed";
      delete p.reason;
    } else {
      p.status = "rejected";
      p.reason = text(a.reason, 300);
    }
    p.decidedAt = ctx.now;
  };

  // Undo an approval made by mistake: the slip goes back to "waiting". A payment the
  // admin recorded by hand has no tenant slip to go back to, so it is removed.
  A.undoPay = (S, a) => {
    const p = S.pay.find(x => x.id === a.id);
    if (!p) fail("ບໍ່ພົບສະລິບ");
    if (p.status !== "confirmed") fail("ສະລິບນີ້ຍັງບໍ່ໄດ້ອະນຸມັດ");
    if (p.manual) {
      S.pay = S.pay.filter(x => x.id !== a.id);
      return;
    }
    p.status = "pending";
    delete p.reason;
    delete p.decidedAt;
  };

  // The admin records a payment received without a slip (cash, or a transfer the
  // tenant did not upload). It is saved as already paid.
  A.recordPay = (S, a, ctx) => {
    const r = roomOf(S, a.n);
    if (!r || !r.t) fail("ຫ້ອງນີ້ບໍ່ມີຜູ້ເຊົ່າ");
    const m = String(a.month || "");
    if (!/^\d{4}-\d{2}$/.test(m)) fail("ເດືອນບໍ່ຖືກຕ້ອງ");
    if (m > nextMonth(ctx.month)) fail("ບັນທຶກລ່ວງໜ້າໄດ້ພຽງ 1 ເດືອນ");
    const kinds = PAY_KINDS.map(x => x[0]).filter(k => (a.kinds || []).indexOf(k) >= 0);
    if (!kinds.length) fail("ກະລຸນາເລືອກປະເພດການຊຳລະ");
    const items = {};
    kinds.forEach(k => {
      const v = num((a.amts || {})[k]);
      if (!v) fail("ກະລຸນາໃສ່ຈຳນວນເງິນ" + kindLabel(k));
      if (v > 50000000) fail("ຈຳນວນເງິນ" + kindLabel(k) + " ບໍ່ຖືກຕ້ອງ");
      items[k] = v;
    });
    const monthSlips = S.pay.filter(p => p.room === r.n && p.month === m);
    const paid = kinds.find(k => monthSlips.some(p => p.status === "confirmed" && hasKind(p, k)));
    if (paid) fail(kindLabel(paid) + " ເດືອນນີ້ຊຳລະແລ້ວ");
    const waiting = monthSlips.find(p => p.status === "pending" && kinds.some(k => hasKind(p, k)));
    if (waiting) fail("ມີສະລິບ " + kindsLabel(waiting) + " ລໍຖ້າກວດສອບ. ກະລຸນາອະນຸມັດ ຫຼື ປະຕິເສດກ່ອນ.");
    // Rejected slips fully covered by this payment are no longer needed.
    S.pay = S.pay.filter(
      p => !(p.room === r.n && p.month === m && p.status === "rejected" && kindsOf(p).every(k => kinds.indexOf(k) >= 0))
    );
    const img = cleanImg(a.img, true);
    const id = newId(S, a);
    S.pay.push({
      id: id,
      room: r.n,
      month: m,
      items: items,
      amount: Object.keys(items).reduce((s2, k) => s2 + items[k], 0),
      img: img ? ctx.upload(img, "receipt_room_" + r.n + "_" + m + "_" + id) : "",
      ts: ctx.now,
      status: "confirmed",
      manual: true,
      method: PAY_METHODS[a.method] ? a.method : "cash",
      note: text(a.note, 200),
      decidedAt: ctx.now
    });
  };

  A.addRooms = (S, a) => {
    const first = num(a.num);
    const cnt = num(a.cnt) || 1;
    const rent = num(a.rent) || RENT;
    if (!first) fail("ກະລຸນາໃສ່ເລກຫ້ອງ");
    if (cnt < 1 || S.rooms.length + cnt > MAX_ROOMS) fail("ສູງສຸດ " + MAX_ROOMS + " ຫ້ອງ");
    for (let i = 0; i < cnt; i++) if (roomOf(S, String(first + i))) fail("ຫ້ອງ " + (first + i) + " ມີແລ້ວ");
    for (let i = 0; i < cnt; i++) S.rooms.push({ n: String(first + i), floor: 1, rent: rent, t: null });
    sortRooms(S);
  };

  A.editRoom = (S, a, ctx) => {
    const r = roomOf(S, a.old);
    if (!r) fail("ບໍ່ພົບຫ້ອງ");
    const nn = text(a.nn, 8).toUpperCase();
    const rent = num(a.rent);
    if (!/^[A-Z0-9-]{1,8}$/.test(nn)) fail("ເລກຫ້ອງບໍ່ຖືກຕ້ອງ");
    if (nn !== a.old && roomOf(S, nn)) fail("ຫ້ອງ " + nn + " ມີແລ້ວ");
    if (!rent) fail("ກະລຸນາໃສ່ຄ່າເຊົ່າທີ່ຖືກຕ້ອງ");
    r.floor = 1;
    r.rent = rent;
    setDue(r, num(a.due), ctx.month);
    if (nn !== a.old) {
      const old = a.old;
      r.n = nn;
      S.pending.concat(S.pay, S.payArchive).forEach(p => {
        if (p.room === old) p.room = nn;
      });
      if (S.notices[old]) {
        S.notices[nn] = S.notices[old];
        delete S.notices[old];
      }
    }
    sortRooms(S);
  };

  A.delRoom = (S, a) => {
    if (!roomOf(S, a.n)) fail("ບໍ່ພົບຫ້ອງ");
    S.rooms = S.rooms.filter(r => r.n !== a.n);
    S.pending = S.pending.filter(p => p.room !== a.n);
    S.pay = S.pay.filter(p => p.room !== a.n);
    S.payArchive = S.payArchive.filter(p => p.room !== a.n);
    delete S.notices[a.n];
  };

  // Part-month rent for a tenant moving in after the 1st: rent × days left ÷ days in
  // the month, rounded to 1,000 kip. Applies to the move-in month only.
  function prorated(rent, since) {
    const y = Number(since.slice(0, 4)), m = Number(since.slice(5, 7)), d = Number(since.slice(8, 10));
    const days = new Date(y, m, 0).getDate();
    return d > 1 ? Math.round((rent * (days - d + 1)) / days / 1000) * 1000 : 0;
  }

  A.moveIn = (S, a, ctx) => {
    const r = roomOf(S, a.n);
    if (!r) fail("ບໍ່ພົບຫ້ອງ");
    if (r.t) fail("ຫ້ອງນີ້ມີຜູ້ເຊົ່າແລ້ວ");
    const name = text(a.name, 100);
    const pin = String(a.pin || DEFAULT_PIN);
    if (!name) fail("ກະລຸນາໃສ່ຊື່");
    if (!/^\d{4,6}$/.test(pin)) fail("PIN ຕ້ອງມີ 4-6 ຕົວເລກ");
    const since = isDate(a.since) ? a.since : ctx.today;
    r.t = {
      name: name,
      dob: isDate(a.dob) ? a.dob : "",
      phone: text(a.phone, 40),
      idno: "",
      emerg: "",
      elec: "",
      water: "",
      since: since,
      photo: "",
      deposit: num(a.deposit),
      pinHash: ctx.hashPin(pin),
      pv: 0,
      tid: ctx.newTid()
    };
    delete S.notices[r.n];
    setDue(r, 0, ctx.month);
    if (a.prorate) {
      const part = prorated(r.rent, since);
      if (part) setDue(r, part, since.slice(0, 7));
    }
  };

  // Move out: the tenant is kept in "past tenants" with the deposit returned, and
  // their payments are archived so the next tenant starts clean.
  A.moveOut = (S, a, ctx) => {
    const r = roomOf(S, a.n);
    if (!r || !r.t) fail("ຫ້ອງນີ້ບໍ່ມີຜູ້ເຊົ່າ");
    const t = r.t;
    const deposit = t.deposit || 0;
    const refund = a.refund === undefined || a.refund === "" ? deposit : num(a.refund);
    S.pastTenants.push({
      room: r.n,
      name: t.name,
      phone: t.phone || "",
      idno: t.idno || "",
      since: t.since || "",
      out: isDate(a.out) ? a.out : ctx.today,
      deposit: deposit,
      refund: refund,
      note: text(a.note, 300)
    });
    S.payArchive = S.payArchive.concat(
      S.pay.filter(p => p.room === r.n).map(p => Object.assign({}, p, { archived: ctx.now }))
    );
    S.pay = S.pay.filter(p => p.room !== r.n);
    S.pending = S.pending.filter(p => p.room !== r.n);
    delete S.notices[r.n];
    setDue(r, 0, ctx.month);
    r.t = null;
  };

  A.editTenant = (S, a, ctx) => {
    const r = roomOf(S, a.n);
    if (!r || !r.t) fail("ຫ້ອງນີ້ບໍ່ມີຜູ້ເຊົ່າ");
    const f = a.f || {};
    const name = text(f.name, 100);
    const rent = num(a.rent);
    if (!name) fail("ກະລຸນາໃສ່ຊື່");
    if (!rent) fail("ກະລຸນາໃສ່ຄ່າເຊົ່າທີ່ຖືກຕ້ອງ");
    const pin = String(a.pin || "");
    if (pin && !/^\d{4,6}$/.test(pin)) fail("PIN ຕ້ອງມີ 4-6 ຕົວເລກ");
    FIELDS.forEach(x => (r.t[x[0]] = text(f[x[0]])));
    r.t.name = name;
    if (f.photo !== undefined && f.photo !== r.t.photo) {
      const img = cleanImg(f.photo, true);
      r.t.photo = img ? ctx.upload(img, "tenant_room_" + r.n) : "";
    }
    r.t.since = isDate(a.since) ? a.since : r.t.since;
    r.t.deposit = num(a.deposit);
    if (pin) {
      r.t.pinHash = ctx.hashPin(pin);
      r.t.pv = (r.t.pv || 0) + 1;
    }
    r.rent = rent;
    setDue(r, num(a.due), ctx.month);
  };

  A.adminPass = (S, a, ctx) => {
    if (!ctx.checkPass(S.admin.hash, String(a.old || ""))) fail("ລະຫັດຜ່ານປັດຈຸບັນບໍ່ຖືກຕ້ອງ");
    const user = text(a.user, 30) || S.admin.user;
    const pass = String(a.pass || "");
    if (user.length < 3) fail("ຊື່ຜູ້ໃຊ້ຕ້ອງມີຢ່າງໜ້ອຍ 3 ຕົວອັກສອນ");
    if (pass.length < 6) fail("ລະຫັດຜ່ານໃໝ່ຕ້ອງມີຢ່າງໜ້ອຍ 6 ຕົວອັກສອນ");
    if (pass === "admin123") fail("ກະລຸນາໃຊ້ລະຫັດຜ່ານອື່ນ");
    S.admin = { user: user, hash: ctx.hashPass(pass), v: (S.admin.v || 0) + 1, isDefault: false };
  };

  /* ---------- Entry points ---------- */

  function apply(S, action, ctx) {
    normalize(S);
    const type = action && action.type;
    const fn = A[type];
    if (!fn || !Object.prototype.hasOwnProperty.call(A, type)) fail("ຄຳສັ່ງບໍ່ຖືກຕ້ອງ");
    if (ADMIN_ACTIONS.indexOf(type) >= 0 && ctx.role !== "admin") fail("ບໍ່ມີສິດ");
    if (TENANT_ACTIONS.indexOf(type) >= 0 && ctx.role !== "tenant") fail("ບໍ່ມີສິດ");
    return fn(S, action.args || {}, ctx) || {};
  }

  function login(S, mode, id, secret, ctx) {
    normalize(S);
    if (mode === "admin") {
      if (text(id, 30) !== S.admin.user || !ctx.checkPass(S.admin.hash, String(secret || "")))
        fail("ຊື່ຜູ້ໃຊ້ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ");
      return { role: "admin", av: S.admin.v || 0 };
    }
    const r = roomOf(S, text(id, 8).toUpperCase());
    if (!r || !r.t || !ctx.checkPin(r.t.pinHash, String(secret || ""))) fail("ເລກຫ້ອງ ຫຼື PIN ບໍ່ຖືກຕ້ອງ");
    return { role: "tenant", room: r.n, tid: r.t.tid, pv: r.t.pv || 0 };
  }

  // What each person is allowed to see: never PIN/password hashes; a tenant only
  // gets their own room, payments, requests and notices.
  function viewFor(S, role, roomN) {
    normalize(S);
    const strip = r => {
      const c = Object.assign({}, r);
      if (c.t) {
        c.t = Object.assign({}, c.t);
        delete c.pinHash;
        delete c.t.pinHash;
      }
      return c;
    };
    let v;
    if (role === "admin") {
      v = {
        rooms: S.rooms.map(strip),
        pay: S.pay,
        payArchive: S.payArchive,
        pending: S.pending,
        notices: S.notices,
        pastTenants: S.pastTenants,
        admin: { user: S.admin.user, isDefault: !!S.admin.isDefault }
      };
    } else {
      const r = roomOf(S, roomN);
      const notices = {};
      if (S.notices[roomN]) notices[roomN] = S.notices[roomN];
      v = {
        rooms: r ? [strip(r)] : [],
        pay: S.pay.filter(p => p.room === roomN),
        payArchive: [],
        pending: S.pending.filter(p => p.room === roomN),
        notices: notices,
        pastTenants: [],
        admin: {}
      };
    }
    return JSON.parse(JSON.stringify(v));
  }

  // Upgrades older data: plain-text PINs/passwords become hashes, tenants get an id.
  function migrate(S, ctx) {
    normalize(S);
    let ch = false;
    S.rooms.forEach(r => {
      const t = r.t;
      if (!t) return;
      if (t.pinHash === undefined) {
        t.pinHash = ctx.hashPin(String(t.pin || "1234"));
        ch = true;
      } else if (ctx.secure && String(t.pinHash).indexOf("plain:") === 0) {
        t.pinHash = ctx.hashPin(t.pinHash.slice(6));
        ch = true;
      }
      if (t.pin !== undefined) {
        delete t.pin;
        ch = true;
      }
      if (!t.tid) {
        t.tid = ctx.newTid();
        ch = true;
      }
    });
    const ad = S.admin;
    const plainHash = ad.hash && String(ad.hash).indexOf("plain:") === 0;
    if (ad.pass !== undefined || !ad.hash || (ctx.secure && plainHash)) {
      const pw = ad.pass !== undefined ? String(ad.pass) : plainHash ? ad.hash.slice(6) : "admin123";
      S.admin = { user: ad.user || "admin", hash: ctx.hashPass(pw), v: ad.v || 0, isDefault: pw === "admin123" };
      ch = true;
    }
    return ch;
  }

  return {
    apply: apply,
    login: login,
    viewFor: viewFor,
    migrate: migrate,
    normalize: normalize,
    dueActive: dueActive,
    dueFor: dueFor,
    prevMonth: prevMonth,
    nextMonth: nextMonth,
    ADVANCE_KINDS: ADVANCE_KINDS,
    prorated: prorated
  };
})();
