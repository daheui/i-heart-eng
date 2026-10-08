import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY, INVITE_CODE, DAY_ROLLOVER_HOUR } from "./config.js";
import { ONBOARDING, GUIDE_HTML, LANDMARKS, MILESTONES, REWARDS, STICKERS } from "./content.js";

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

/* ================= date helpers (local) ================= */
const pad = n => String(n).padStart(2, "0");
const iso = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const parse = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const today = () => iso(new Date(Date.now() - DAY_ROLLOVER_HOUR * 3600 * 1000));
const mondayOf = s => { const d = parse(s); const k = (d.getDay() + 6) % 7; d.setDate(d.getDate() - k); return iso(d); };
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const fmtShort = s => { const d = parse(s); return MONTHS[d.getMonth()].slice(0, 3) + " " + d.getDate(); };
const fmtLong = s => { const d = parse(s); return DOW[(d.getDay() + 6) % 7] + ", " + MONTHS[d.getMonth()] + " " + d.getDate(); };
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const AVATAR_FALLBACK = "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#E2F3FD"/><circle cx="32" cy="26" r="12" fill="#FFB6D9"/><path d="M10 60a22 22 0 0 1 44 0z" fill="#FFB6D9"/></svg>`);

/* ================= state ================= */
const S = {
  user: null, me: null, profiles: [], entries: [], treasures: [], messages: [], pokes: [],
  tab: "today", weekStart: mondayOf(today()), calMonth: today().slice(0, 7), calMode: "grid", calWho: null,
  readerKey: null, editDate: today(), dirty: false, onbIndex: 0
};
const byId = id => S.profiles.find(p => p.id === id);
const myEntries = () => S.entries.filter(e => e.user_id === S.user.id);
const entryOf = (uid, date) => S.entries.find(e => e.user_id === uid && e.date === date);

/* ================= toast / confirm ================= */
let toastT; function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2000); }
function confirmBox(title, msg, okLabel = "OK") {
  return new Promise(res => {
    $("#confirm-title").textContent = title; $("#confirm-msg").textContent = msg; $("#confirm-ok").textContent = okLabel;
    const m = $("#confirm-modal"); m.hidden = false;
    const done = v => { m.hidden = true; $("#confirm-ok").onclick = null; $("#confirm-cancel").onclick = null; res(v); };
    $("#confirm-ok").onclick = () => done(true); $("#confirm-cancel").onclick = () => done(false);
  });
}

/* ================= auth ================= */
let authMode = "login";
$$(".tab2").forEach(b => b.addEventListener("click", () => {
  authMode = b.dataset.auth; $$(".tab2").forEach(x => x.classList.toggle("on", x === b));
  $$(".signup-only").forEach(x => x.hidden = authMode !== "signup");
  $("#auth-submit").textContent = authMode === "signup" ? "Create account" : "Log in";
  $("#auth-err").hidden = true;
}));
$("#auth-form").addEventListener("submit", async e => {
  e.preventDefault();
  const email = $("#a-email").value.trim(), pass = $("#a-pass").value;
  const err = $("#auth-err"); err.hidden = true; $("#auth-submit").disabled = true;
  try {
    if (authMode === "signup") {
      const nick = $("#a-nick").value.trim(); const code = $("#a-invite").value.trim();
      if (!nick) throw new Error("Pick a nickname first.");
      if (code !== INVITE_CODE) throw new Error("Invite code doesn't match.");
      const { data, error } = await sb.auth.signUp({ email, password: pass, options: { data: { nickname: nick } } });
      if (error) throw error;
      if (!data.session) { err.textContent = "Check your email for a confirmation link, then log in."; err.hidden = false; }
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password: pass });
      if (error) throw error;
    }
  } catch (ex) { err.textContent = friendlyAuthError(ex.message); err.hidden = false; }
  $("#auth-submit").disabled = false;
});
function friendlyAuthError(m) {
  if (/Invalid login/i.test(m)) return "Email or password doesn't match.";
  if (/already registered/i.test(m)) return "That email already has an account — log in instead.";
  if (/Password should be/i.test(m)) return "Password needs at least 6 characters.";
  return m;
}
$("#btn-logout").addEventListener("click", async () => { if (await confirmBox("Log out?", "You'll need your email and password to get back in.", "Log out")) await sb.auth.signOut(); });

sb.auth.onAuthStateChange(async (_evt, session) => {
  if (session?.user) { if (!S.user || S.user.id !== session.user.id) { S.user = session.user; await boot(); } }
  else { S.user = null; S.me = null; teardown(); showScreen("auth"); }
});
function showScreen(name) { ["auth", "onboard", "app"].forEach(n => $("#screen-" + n).hidden = n !== name); }

/* ================= boot / data ================= */
let channel = null;
async function boot() {
  await loadAll();
  if (!S.me) { toast("Profile not ready yet — try again in a moment"); return; }
  if (!S.me.onboarded) { startOnboarding(); return; }
  enterApp();
}
async function loadAll() {
  const since = addDays(today(), -400);
  const [p, e, t, m, k] = await Promise.all([
    sb.from("profiles").select("*").order("created_at"),
    sb.from("entries").select("*").gte("date", since),
    sb.from("treasures").select("*"),
    sb.from("messages").select("*").order("created_at", { ascending: false }).limit(200),
    sb.from("pokes").select("*").eq("date", today())
  ]);
  S.profiles = p.data || []; S.entries = e.data || []; S.treasures = t.data || []; S.messages = (m.data || []).reverse(); S.pokes = k.data || [];
  S.me = byId(S.user.id) || null;
  if (!S.calWho) S.calWho = S.user.id;
}
function enterApp() {
  showScreen("app"); renderAll(); subscribe(); checkMilestones(); maybeWeeklyRecap();
}
function teardown() { if (channel) { sb.removeChannel(channel); channel = null; } }
function subscribe() {
  teardown();
  channel = sb.channel("room")
    .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, payload => {
      if (payload.eventType === "INSERT") { if (!S.messages.find(x => x.id === payload.new.id)) { S.messages.push(payload.new); renderLounge(true); } }
      if (payload.eventType === "DELETE") { S.messages = S.messages.filter(x => x.id !== payload.old.id); renderLounge(); }
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "entries" }, payload => {
      if (payload.eventType === "DELETE") S.entries = S.entries.filter(x => x.id !== payload.old.id);
      else { const i = S.entries.findIndex(x => x.id === payload.new.id); if (i >= 0) S.entries[i] = payload.new; else S.entries.push(payload.new); }
      renderAll();
    })
    .subscribe();
}

/* ================= onboarding ================= */
function startOnboarding() { S.onbIndex = 0; showScreen("onboard"); renderOnb(); }
function renderOnb() {
  const s = ONBOARDING[S.onbIndex];
  $("#onb-dots").innerHTML = ONBOARDING.map((_, i) => `<i class="${i === S.onbIndex ? "on" : ""}"></i>`).join("");
  $("#onb-body").innerHTML = `<div class="art">${s.art}</div><h2>${s.title}</h2>${s.body}`;
  $("#onb-prev").style.visibility = S.onbIndex === 0 ? "hidden" : "visible";
  $("#onb-next").textContent = S.onbIndex === ONBOARDING.length - 1 ? "시작하기 ♥" : "다음";
}
$("#onb-prev").addEventListener("click", () => { if (S.onbIndex > 0) { S.onbIndex--; renderOnb(); } });
$("#onb-next").addEventListener("click", async () => {
  if (S.onbIndex < ONBOARDING.length - 1) { S.onbIndex++; renderOnb(); return; }
  await sb.from("profiles").update({ onboarded: true }).eq("id", S.user.id); S.me.onboarded = true;
  enterApp(); showTab("me"); toast("프로필 사진이랑 한 줄 다짐을 채워보세요!");
});
function openGuide() { $("#guide-body").innerHTML = GUIDE_HTML; $("#guide-modal").hidden = false; }
$("#btn-guide").addEventListener("click", openGuide); $("#btn-guide2").addEventListener("click", openGuide);
$("#guide-close").addEventListener("click", () => $("#guide-modal").hidden = true);

/* ================= streak / progress math ================= */
function calcStreak(uid) {
  const done = S.entries.filter(e => e.user_id === uid && e.completed).map(e => e.date).sort();
  const set = new Set(done); if (!done.length) return { streak: 0, restUsed: {} };
  const t = today(); let cur = set.has(t) ? t : addDays(t, -1); let streak = 0; const restUsed = {}; const earliest = done[0];
  for (let g = 0; g < 2000; g++) {
    if (cur < earliest) break;
    if (set.has(cur)) { streak++; cur = addDays(cur, -1); continue; }
    const wk = mondayOf(cur); if (!restUsed[wk]) { restUsed[wk] = cur; cur = addDays(cur, -1); continue; }
    break;
  }
  return { streak, restUsed };
}
function completedCount(uid) { return S.entries.filter(e => e.user_id === uid && e.completed).length; }
function fullHouseDates() {
  if (S.profiles.length < 2) return [];
  const byDate = {};
  S.entries.filter(e => e.completed).forEach(e => { (byDate[e.date] ||= new Set()).add(e.user_id); });
  return Object.keys(byDate).filter(d => byDate[d].size >= S.profiles.length).sort();
}
function position(uid) { return Math.min(100, completedCount(uid) + Math.floor(fullHouseDates().length / 2)); }
const nextMilestone = s => MILESTONES.find(m => m > s) || null;
const nextLandmark = pos => LANDMARKS.find(l => l.at > pos) || null;

/* ================= render: all ================= */
function renderAll() { renderToday(); renderJourney(); renderLounge(); renderArchive(); renderMe(); }
function avatarUrl(p) { return p?.avatar_url ? sb.storage.from("avatars").getPublicUrl(p.avatar_url).data.publicUrl + "?v=" + encodeURIComponent(p.updated || "") : AVATAR_FALLBACK; }

/* ---------- today ---------- */
function renderToday() {
  const uid = S.user.id; const { streak, restUsed } = calcStreak(uid); const t = today();
  $("#streak-n").textContent = streak;
  const nm = nextMilestone(streak);
  $("#streak-sub").textContent = nm ? `Next chest in ${nm - streak} day${nm - streak === 1 ? "" : "s"}` : "Every chest is open — legend.";
  $("#rest-pill").textContent = restUsed[mondayOf(t)] ? "Rest card used this week" : "Rest card: 1 left this week";
  const pos = position(uid); const nl = nextLandmark(pos);
  $("#pos-pill").textContent = nl ? `${nl.at - pos} to ${nl.name} ${nl.art}` : "🗽 In New York!";
  $("#hero-chest").innerHTML = `<div class="pet">${nm ? "🎁" : "🏆"}</div>`;

  // friends today
  const hour = new Date().getHours();
  $("#friends-row").innerHTML = S.profiles.map(p => {
    const e = entryOf(p.id, t); const done = !!(e && e.completed); const isMe = p.id === uid;
    const poked = S.pokes.find(k => k.from_user === uid && k.to_user === p.id);
    const canPoke = !isMe && !done && hour >= 21;
    return `<div class="friend ${done ? "done" : ""}"><img class="av" src="${avatarUrl(p)}" alt=""><span class="nm">${esc(p.nickname)}${isMe ? " (me)" : ""}</span>
      <span class="st">${done ? "done ✓" : (e ? "in progress" : "not yet")}</span>
      ${canPoke ? (poked ? `<span class="st">poked</span>` : `<button class="poke" data-poke="${p.id}">poke 👉</button>`) : ""}</div>`;
  }).join("");
  const fh = fullHouseDates(); if (fh.includes(t)) $("#friends-row").insertAdjacentHTML("beforeend", `<div class="friend"><div class="av" style="display:grid;place-items:center;font-size:24px;border-color:#F2C94C;background:var(--lemon)">🏠</div><span class="nm">Full house!</span><span class="st">+½ tile each</span></div>`);

  // week strip
  const ws = S.weekStart; const thisWk = mondayOf(t);
  $("#week-title").textContent = ws === thisWk ? "this week" : `${fmtShort(ws)} – ${fmtShort(addDays(ws, 6))}`;
  $("#week-next").disabled = ws >= thisWk;
  $("#week").innerHTML = [0, 1, 2, 3, 4, 5, 6].map(i => {
    const d = addDays(ws, i); const e = entryOf(uid, d); const done = !!(e && e.completed); const rest = restUsed[mondayOf(d)] === d;
    let cls = "stamp"; if (done) cls += " done"; else if (rest) cls += " rest"; if (d === t) cls += " today"; if (d > t) cls += " future";
    return `<div class="day"><span class="lbl">${DOW[i]}</span><button class="${cls}" data-open="${d}" aria-label="${fmtLong(d)}">${done ? "✓" : rest ? "rest" : (e ? "·" : "")}</button><span class="num">${parse(d).getDate()}</span></div>`;
  }).join("");

  // today card
  const te = entryOf(uid, t); const tc = $("#today-card");
  if (!te || (!te.script && !te.title)) {
    tc.innerHTML = `<div class="eyebrow">${fmtLong(t)}</div><h2>Nothing saved yet today</h2><p class="sub" style="margin:4px 0 12px">Shadow today's clip, paste the script, then stamp the day.</p><button class="gel pink wide" data-edit="${t}">Write today's script ✎</button>`;
  } else {
    tc.innerHTML = `<div class="row between"><div><div class="eyebrow">${fmtLong(t)}</div><h2>${esc(te.title || "Untitled script")}</h2></div>${te.starred ? '<span class="pill">★</span>' : ""}</div>
      <p class="script-preview">${esc(te.script)}</p>
      <div class="row wrap" style="gap:8px">
        ${te.completed ? `<button class="gel mint" data-undone="${t}">Done ✓ (tap to undo)</button>` : `<button class="gel pink" data-done="${t}">Mark today done 🎉</button>`}
        <button class="gel ghost small" data-edit="${t}">Edit</button>
        <button class="gel ghost small" data-open="${t}">Read</button>
        ${videoLink(te)}
      </div>`;
  }
}
function toSecs(t) { if (!t) return 0; const m = String(t).trim().match(/^(?:(\d+):)?(\d+):(\d{1,2})$|^(\d+):(\d{1,2})$|^(\d+)$/); if (!m) return 0; if (m[6]) return +m[6]; if (m[4]) return +m[4] * 60 + +m[5]; return (+(m[1] || 0)) * 3600 + +m[2] * 60 + +m[3]; }
function videoUrl(e) { let u = /^https?:\/\//i.test(e.video_url) ? e.video_url : "https://" + e.video_url; const s = toSecs(e.start_at); if (s > 0) { try { const url = new URL(u); url.searchParams.set("t", s + "s"); u = url.toString(); } catch { u += (u.includes("?") ? "&" : "?") + "t=" + s + "s"; } } return u; }
function videoLink(e) { if (!e.video_url) return ""; return `<a class="vlink" href="${esc(videoUrl(e))}" target="_blank" rel="noopener">▶ Open video${toSecs(e.start_at) ? " · " + esc(e.start_at.trim()) : ""}</a>`; }

/* ---------- journey map (pixel world map, horizontal) ---------- */
const MAP_W = 1180, MAP_H = 380;
const LAND = [ // [x,y,w,h] in 8px cells
  // Korea
  [3,9,5,9],[5,7,4,3],[2,17,4,3],[7,12,2,4],
  // Japan
  [13,11,3,8],[15,7,3,5],[12,19,3,3],[17,5,2,3],
  // Guam
  [38,31,2,2],
  // Hawaii
  [72,23,2,1],[74,24,2,1],[76,25,3,2],
  // USA
  [104,3,40,22],[100,9,5,12],[98,14,3,6],[140,25,5,6],[122,25,9,4],[144,5,3,8]
];
const WAYPOINTS = [[62,112],[150,172],[250,242],[308,252],[368,222],[458,190],[570,200],[650,170],[770,150],[830,112],[910,112],[1000,82],[1100,60]];
function smoothPath(p) { let d = `M${p[0][0]} ${p[0][1]}`; for (let i = 0; i < p.length - 1; i++) { const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2; d += ` C${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]} ${p2[1]}`; } return d; }
function renderJourney() {
  const uid = S.user.id; const pos = position(uid); const nl = nextLandmark(pos);
  $("#journey-title").textContent = `Day ${pos} of 100`;
  $("#journey-sub").textContent = nl ? `${nl.at - pos} more to ${nl.name} ${nl.art}` : "You made it to New York 🗽";
  $("#hp").innerHTML = Array.from({ length: 20 }, (_, i) => `<i class="${i < Math.round(pos / 5) ? "" : "off"}"></i>`).join("");
  let out = `<rect width="${MAP_W}" height="${MAP_H}" fill="#BFD9FF"/>`;
  for (let y = 24; y < MAP_H; y += 36) for (let x = ((y / 36) % 2) * 24; x < MAP_W; x += 72) out += `<rect x="${x}" y="${y}" width="16" height="4" fill="#A9C8F5"/>`;
  // clouds / boat / fish decorations
  [[330, 40], [520, 300], [900, 300], [700, 40]].forEach(([x, y]) => out += `<rect x="${x}" y="${y}" width="40" height="12" fill="#fff"/><rect x="${x + 8}" y="${y - 8}" width="20" height="8" fill="#fff"/>`);
  out += `<text x="420" y="330" font-size="16">⛵</text><text x="820" y="250" font-size="14">🐟</text><text x="200" y="330" font-size="14">🐳</text>`;
  LAND.forEach(([x, y, w, h]) => out += `<rect x="${x * 8}" y="${y * 8}" width="${w * 8}" height="${h * 8}" fill="#8BBF7A"/><rect x="${x * 8 + 2}" y="${y * 8 + 2}" width="${w * 8 - 4}" height="${h * 8 - 4}" fill="#CFEBC2"/>`);
  out += `<text x="34" y="62" font-family="Pixelify Sans" font-weight="600" font-size="12" fill="#4A3B6B">KOREA</text><text x="100" y="150" font-family="Pixelify Sans" font-weight="600" font-size="11" fill="#4A3B6B">JAPAN</text><text x="980" y="200" font-family="Pixelify Sans" font-weight="600" font-size="14" fill="#4A3B6B">USA</text>`;
  const d = smoothPath(WAYPOINTS);
  out += `<path id="route" d="${d}" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#9B7BFF" stroke-width="3" stroke-dasharray="6 6"/>`;
  const map = $("#map"); map.innerHTML = `<svg viewBox="0 0 ${MAP_W} ${MAP_H}" width="${MAP_W}" height="${MAP_H}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">${out}<g id="route-dots"></g><g id="route-tokens"></g></svg>`;
  const path = map.querySelector("#route"); const L = path.getTotalLength(); const at = n => path.getPointAtLength(L * Math.min(100, Math.max(0, n)) / 100);
  const lmAt = Object.fromEntries(LANDMARKS.map(l => [l.at, l]));
  let dots = "";
  for (let i = 0; i <= 100; i++) {
    const p = at(i); const lm = lmAt[i]; const reached = i <= pos;
    if (i === 0) { dots += `<circle cx="${p.x}" cy="${p.y}" r="13" fill="#B59CFF" stroke="#4A3B6B" stroke-width="2"/><text x="${p.x}" y="${p.y + 5}" text-anchor="middle" font-size="13">🇰🇷</text><text x="${p.x}" y="${p.y + 28}" text-anchor="middle" font-family="Pixelify Sans" font-weight="600" font-size="11" fill="#4A3B6B">Seoul</text>`; continue; }
    if (lm) dots += `<circle cx="${p.x}" cy="${p.y}" r="14" fill="${reached ? "#FFEBB0" : "#fff"}" stroke="#4A3B6B" stroke-width="2"/><text x="${p.x}" y="${p.y + 5}" text-anchor="middle" font-size="14">${lm.art}</text><text x="${p.x}" y="${p.y + 28}" text-anchor="middle" font-family="Pixelify Sans" font-weight="600" font-size="11" fill="#4A3B6B">${i} ${esc(lm.name)}</text>`;
    else { const r = i % 5 === 0 ? 5 : 3.5; dots += `<rect x="${p.x - r}" y="${p.y - r}" width="${r * 2}" height="${r * 2}" fill="${reached ? "#9B7BFF" : "#fff"}" stroke="#4A3B6B" stroke-width="1.5"/>`; }
  }
  map.querySelector("#route-dots").innerHTML = dots;
  const groups = {}; S.profiles.forEach(p => { const n = position(p.id); (groups[n] ||= []).push(p); });
  let tokens = "", defs = ""; const placed = [];
  Object.keys(groups).map(Number).sort((a, b) => a - b).forEach(n => {
    const ps = groups[n]; const base = at(n);
    ps.forEach((p, k) => {
      const x = base.x + (k - (ps.length - 1) / 2) * 36; let y = base.y - 36;
      while (placed.some(q => Math.abs(q.x - x) < 40 && Math.abs(q.y - y) < 48)) y -= 50; placed.push({ x, y }); const id = "clip" + p.id.slice(0, 8); const me = p.id === uid;
      defs += `<clipPath id="${id}"><rect x="${x - 14}" y="${y - 14}" width="28" height="28"/></clipPath>`;
      tokens += `<g class="token ${me ? "me" : ""}"><rect x="${x - 16}" y="${y - 16}" width="32" height="32" fill="#fff" stroke="#4A3B6B" stroke-width="2"/><image href="${avatarUrl(p)}" x="${x - 14}" y="${y - 14}" width="28" height="28" clip-path="url(#${id})" preserveAspectRatio="xMidYMid slice"/><path d="M${x - 5} ${y + 16}L${x} ${y + 23}L${x + 5} ${y + 16}z" fill="#4A3B6B"/><rect x="${x - 26}" y="${y - 32}" width="52" height="14" fill="${me ? "#FFEBB0" : "#fff"}" stroke="#4A3B6B" stroke-width="1.5"/><text x="${x}" y="${y - 21}" text-anchor="middle" font-family="Pixelify Sans" font-weight="600" font-size="10" fill="#4A3B6B">${esc(p.nickname.slice(0, 9))}</text></g>`;
    });
  });
  map.querySelector("#route-tokens").innerHTML = `<defs>${defs}</defs>` + tokens;
  const fh = fullHouseDates().length;
  $("#journey-legend").innerHTML = `<div class="legend">${LANDMARKS.map(l => `<div class="lm ${pos >= l.at ? "reached" : ""}"><b>${l.at}</b><span>${l.art} ${esc(l.name)} · <span class="ko">${esc(l.ko)}</span>${pos >= l.at ? " ✓" : ""}</span></div>`).join("")}</div>
    <p class="tiny" style="margin:10px 0 0">Position = days completed${fh ? ` + ${Math.floor(fh / 2)} bonus from ${fh} full-house day${fh === 1 ? "" : "s"}` : ""}. Streaks can break; the map never goes backwards.</p>`;
}
function scrollMapToMe() { const map = $("#map"); const t = map.querySelector(".token.me rect"); if (!t) return; const x = +t.getAttribute("x"); map.scrollTo({ left: Math.max(0, x - map.clientWidth / 2 + 16), behavior: "smooth" }); }

/* ---------- lounge ---------- */
function renderLounge(scroll) {
  const box = $("#msgs"); const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  box.innerHTML = S.messages.map(m => {
    const p = byId(m.user_id); const me = m.user_id === S.user.id; const time = new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (m.kind === "system") return `<div class="msg sys"><div class="bubble">${esc(m.text)}</div></div>`;
    if (m.kind === "recap") return `<div class="msg sys recap"><div class="bubble">${esc(m.text)}</div></div>`;
    let body = m.kind === "photo" ? `<img src="${sb.storage.from("photos").getPublicUrl(m.image_path).data.publicUrl}" alt="" loading="lazy">` : m.kind === "sticker" ? esc(m.text) : esc(m.text);
    return `<div class="msg ${me ? "me" : ""}"><img class="av" src="${avatarUrl(p)}" alt=""><div><div class="bubble ${m.kind === "sticker" ? "sticker" : ""}">${body}</div><div class="meta">${esc(p?.nickname || "?")} · ${time}${me ? ` · <button class="linkbtn" data-delmsg="${m.id}">delete</button>` : ""}</div></div></div>`;
  }).join("") || `<div class="empty">The guestbook is empty. Say hi ♥</div>`;
  if (scroll || atBottom) box.scrollTop = box.scrollHeight;
}
async function postMessage(kind, text, extra = {}) {
  const { error } = await sb.from("messages").insert({ user_id: S.user.id, kind, text, ...extra });
  if (error) toast("Couldn't send");
}
$("#msg-form").addEventListener("submit", async e => { e.preventDefault(); const v = $("#msg-text").value.trim(); if (!v) return; $("#msg-text").value = ""; await postMessage("chat", v); });
$("#msg-sticker").addEventListener("click", () => { const t = $("#sticker-tray"); if (!t.innerHTML) t.innerHTML = STICKERS.map(s => `<button type="button" data-stk="${s}">${s}</button>`).join(""); t.hidden = !t.hidden; });
$("#sticker-tray").addEventListener("click", async e => { const b = e.target.closest("[data-stk]"); if (!b) return; $("#sticker-tray").hidden = true; await postMessage("sticker", b.dataset.stk); });
$("#msg-photo").addEventListener("change", async e => {
  const f = e.target.files[0]; if (!f) return; e.target.value = "";
  if (f.size > 8 * 1024 * 1024) return toast("Photo is over 8MB — pick a smaller one");
  const path = `${S.user.id}/${Date.now()}.${(f.name.split(".").pop() || "jpg").toLowerCase()}`;
  toast("Uploading…"); const { error } = await sb.storage.from("photos").upload(path, f, { contentType: f.type });
  if (error) return toast("Upload failed"); await postMessage("photo", "", { image_path: path });
});

/* ---------- archive ---------- */
function renderArchive() {
  const sel = $("#cal-who"); sel.innerHTML = S.profiles.map(p => `<option value="${p.id}" ${p.id === S.calWho ? "selected" : ""}>${p.id === S.user.id ? "Me" : esc(p.nickname)}</option>`).join("");
  const who = S.calWho; const [y, m] = S.calMonth.split("-").map(Number); const t = today();
  $("#cal-title").textContent = MONTHS[m - 1] + " " + y; $("#cal-next").disabled = S.calMonth >= t.slice(0, 7);
  $$("#cal-mode button").forEach(b => b.classList.toggle("on", b.dataset.mode === S.calMode));
  const body = $("#cal-body");
  if (S.calMode === "grid") {
    const first = new Date(y, m - 1, 1); const off = (first.getDay() + 6) % 7; const dim = new Date(y, m, 0).getDate();
    let html = DOW.map(d => `<div class="wd">${d[0]}</div>`).join(""); for (let i = 0; i < off; i++) html += `<div class="cal-day blank"></div>`;
    for (let d = 1; d <= dim; d++) { const s = `${y}-${pad(m)}-${pad(d)}`; const e = entryOf(who, s); let cls = "cal-day"; if (e) cls += " has"; if (e?.completed) cls += " done"; if (s === t) cls += " today"; html += `<button class="${cls}" data-open="${s}" data-who="${who}" ${e || (who === S.user.id && s <= t) ? "" : "disabled"}><span>${d}</span><span class="dot ${e?.starred ? "" : "none"}"></span></button>`; }
    body.innerHTML = `<div class="cal">${html}</div>`;
  } else {
    let list = S.entries.filter(e => e.user_id === who).sort((a, b) => b.date < a.date ? -1 : 1); if (S.calMode === "star") list = list.filter(e => e.starred);
    body.innerHTML = list.length ? `<div class="list">${list.map(e => `<button class="entry" data-open="${e.date}" data-who="${who}"><span class="d">${fmtShort(e.date)}<br><span style="font-weight:400;color:var(--muted)">${e.date.slice(0, 4)}</span></span><span class="t">${e.starred ? "★ " : ""}${e.video_url ? "▶ " : ""}${esc(e.title || "Untitled")}</span><span class="m">${e.completed ? "✓ " : ""}${e.reviews || 0}/3 rev</span></button>`).join("")}</div>` : `<div class="empty">${S.calMode === "star" ? "No starred scripts yet." : "No scripts yet."}</div>`;
  }
  renderReader();
}
function renderReader() {
  const r = $("#reader"); const rw = $("#reader-win"); if (!S.readerKey) { rw.hidden = true; return; }
  const [who, date] = S.readerKey.split("|"); const e = entryOf(who, date); const mine = who === S.user.id;
  if (!e) { rw.hidden = true; return; }
  rw.hidden = false; const p = byId(who);
  r.innerHTML = `<div class="row between"><div><div class="eyebrow">${mine ? "my script" : esc(p?.nickname || "") + "'s script"} · ${fmtLong(date)}</div><h2>${esc(e.title || "Untitled script")}</h2></div>${mine ? `<button class="star ${e.starred ? "on" : ""}" id="r-star" aria-label="Star">★</button>` : (e.starred ? `<span class="star on">★</span>` : "")}</div>
    <div class="script-text" style="margin-top:8px">${esc(e.script) || "<i>No script text.</i>"}</div>
    ${e.notes ? `<div class="eyebrow" style="margin-top:10px">notes</div><div class="notes">${esc(e.notes)}</div>` : ""}
    <div class="row between wrap" style="margin-top:12px;gap:8px">
      <div class="reviews"><span class="eyebrow">review</span>${[0, 1, 2].map(i => `<button class="stamp ${e.reviews > i ? "done" : ""}" ${mine ? `data-rev="${i + 1}"` : "disabled"}>${e.reviews > i ? "✓" : i + 1}</button>`).join("")}</div>
      ${e.completed ? `<span class="pill mint">stamped ✓</span>` : (mine ? `<button class="gel mint small" data-done="${date}">Stamp this day</button>` : `<span class="pill">not stamped</span>`)}
    </div>
    <div class="row wrap" style="margin-top:12px;gap:8px">${videoLink(e)}${mine ? `<button class="gel ghost small" data-edit="${date}">Edit</button>` : ""}<button class="linkbtn" id="r-close">Close</button></div>`;
  $("#r-close").addEventListener("click", () => { S.readerKey = null; renderReader(); });
  const st = $("#r-star"); if (st) st.addEventListener("click", async () => { await saveEntry({ ...e, starred: !e.starred }); });
  r.querySelectorAll("[data-rev]").forEach(b => b.addEventListener("click", async () => { const n = +b.dataset.rev; const v = e.reviews >= n ? n - 1 : n; await saveEntry({ ...e, reviews: v }); if (v === 3) toast("3 reviews — that one's yours now ✨"); }));
}
$("#cal-prev").addEventListener("click", () => { S.calMonth = shiftMonth(S.calMonth, -1); renderArchive(); });
$("#cal-next").addEventListener("click", () => { S.calMonth = shiftMonth(S.calMonth, 1); renderArchive(); });
$("#cal-mode").addEventListener("click", e => { const b = e.target.closest("[data-mode]"); if (b) { S.calMode = b.dataset.mode; renderArchive(); } });
$("#cal-who").addEventListener("change", e => { S.calWho = e.target.value; S.readerKey = null; renderArchive(); });
function shiftMonth(ym, n) { const [y, m] = ym.split("-").map(Number); const d = new Date(y, m - 1 + n, 1); return d.getFullYear() + "-" + pad(d.getMonth() + 1); }

/* ---------- me ---------- */
function renderMe() {
  const me = S.me; $("#me-avatar").src = avatarUrl(me); $("#me-nick").value = me.nickname; $("#me-motto").value = me.motto || "";
  const mine = myEntries(); const { streak } = calcStreak(S.user.id); const done = mine.filter(e => e.completed).length; const rev3 = mine.filter(e => e.reviews >= 3).length; const best = bestStreak(S.user.id);
  $("#me-stats").innerHTML = [[done, "days done"], [streak, "streak"], [best, "best streak"], [position(S.user.id), "map tile"], [rev3, "3× reviewed"], [mine.filter(e => e.starred).length, "starred"]].map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join("");
  const un = Object.fromEntries(S.treasures.filter(t => t.user_id === S.user.id).map(t => [t.milestone, t.opened_at])); const nm = nextMilestone(streak);
  $("#chests").innerHTML = MILESTONES.map(m => `<button class="chest ${un[m] ? "open" : ""} ${m === nm ? "next" : ""}" data-chest="${m}"><span class="art">${un[m] ? "🎁" : "🔒"}</span><span class="n">${m} days</span><span class="s">${un[m] ? fmtShort(un[m]) : m === nm ? `${m - streak} to go` : "locked"}</span></button>`).join("");
}
function bestStreak(uid) { const ds = S.entries.filter(e => e.user_id === uid && e.completed).map(e => e.date).sort(); let best = 0, cur = 0, prev = null; ds.forEach(d => { cur = prev && addDays(prev, 1) === d ? cur + 1 : 1; best = Math.max(best, cur); prev = d; }); return best; }
$("#me-save").addEventListener("click", async () => {
  const nickname = $("#me-nick").value.trim() || S.me.nickname; const motto = $("#me-motto").value.trim();
  const { error } = await sb.from("profiles").update({ nickname, motto }).eq("id", S.user.id);
  if (error) return toast("Couldn't save"); S.me.nickname = nickname; S.me.motto = motto; toast("Profile saved ♥"); renderAll();
});
$("#me-avatar-file").addEventListener("change", async e => {
  const f = e.target.files[0]; if (!f) return; e.target.value = "";
  const blob = await squareImage(f, 256); const path = `${S.user.id}/avatar.jpg`;
  const { error } = await sb.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg", upsert: true });
  if (error) return toast("Upload failed");
  await sb.from("profiles").update({ avatar_url: path }).eq("id", S.user.id); S.me.avatar_url = path; S.me.updated = Date.now(); toast("Photo updated"); renderAll();
});
function squareImage(file, size) {
  return new Promise(res => { const img = new Image(); img.onload = () => { const c = document.createElement("canvas"); c.width = c.height = size; const x = c.getContext("2d"); const s = Math.min(img.width, img.height); x.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size); c.toBlob(b => res(b), "image/jpeg", .88); URL.revokeObjectURL(img.src); }; img.src = URL.createObjectURL(file); });
}
$("#btn-export").addEventListener("click", () => {
  const mine = myEntries().sort((a, b) => a.date < b.date ? -1 : 1);
  let out = `I ♥ ENG — ${S.me.nickname} — exported ${new Date().toLocaleString()}\nDays done: ${mine.filter(e => e.completed).length}\n\n`;
  mine.forEach(e => { out += `=== ${fmtLong(e.date)} (${e.date})${e.starred ? " ★" : ""}\nTitle: ${e.title || "-"}\nVideo: ${e.video_url ? videoUrl(e) : "-"}\nDone: ${e.completed ? "yes" : "no"} · Reviews: ${e.reviews}/3\n\n${e.script || "(no script)"}\n${e.notes ? "\nNotes:\n" + e.notes + "\n" : ""}\n`; });
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([out], { type: "text/plain" })); a.download = `i-heart-eng-${today()}.txt`; a.click();
});

/* ================= editor ================= */
function openEditor(date) {
  S.editDate = date; const e = entryOf(S.user.id, date) || { date, title: "", video_url: "", start_at: "", script: "", notes: "", starred: false };
  $("#ed-title").textContent = date === today() ? "Today's script" : fmtLong(date);
  $("#ed-date").value = date; $("#ed-name").value = e.title; $("#ed-video").value = e.video_url; $("#ed-start").value = e.start_at; $("#ed-script").value = e.script; $("#ed-notes").value = e.notes;
  $("#ed-star").classList.toggle("on", !!e.starred); $("#ed-delete").hidden = !e.id; $("#ed-err").hidden = true; S.dirty = false;
  $("#editor").hidden = false; setTimeout(() => $("#ed-script").focus(), 50);
}
["ed-date", "ed-name", "ed-video", "ed-start", "ed-script", "ed-notes"].forEach(id => $("#" + id).addEventListener("input", () => S.dirty = true));
$("#ed-star").addEventListener("click", () => { $("#ed-star").classList.toggle("on"); S.dirty = true; });
$("#ed-close").addEventListener("click", async () => { if (S.dirty && !(await confirmBox("Discard changes?", "You haven't saved this script yet.", "Discard"))) return; $("#editor").hidden = true; });
$("#ed-save").addEventListener("click", async () => {
  const date = $("#ed-date").value || today(); const prev = entryOf(S.user.id, S.editDate);
  const obj = { ...(entryOf(S.user.id, date) || prev || {}), user_id: S.user.id, date, title: $("#ed-name").value.trim(), video_url: $("#ed-video").value.trim(), start_at: $("#ed-start").value.trim(), script: $("#ed-script").value.trim(), notes: $("#ed-notes").value.trim(), starred: $("#ed-star").classList.contains("on") };
  if (!obj.script && !obj.title) { $("#ed-err").textContent = "Add a title or a script first."; $("#ed-err").hidden = false; return; }
  if (date !== S.editDate && prev && !entryOf(S.user.id, date)) { await sb.from("entries").delete().eq("id", prev.id); delete obj.id; }
  $("#ed-save").disabled = true; const ok = await saveEntry(obj); $("#ed-save").disabled = false;
  if (ok) { S.dirty = false; $("#editor").hidden = true; toast("Saved"); }
});
$("#ed-delete").addEventListener("click", async () => {
  const e = entryOf(S.user.id, S.editDate); if (!e) return;
  if (!(await confirmBox("Delete this day?", "The script, notes and stamp for this day will be removed.", "Delete"))) return;
  await sb.from("entries").delete().eq("id", e.id); S.entries = S.entries.filter(x => x.id !== e.id); $("#editor").hidden = true; toast("Deleted"); renderAll();
});
async function saveEntry(obj) {
  const row = { ...obj, updated_at: new Date().toISOString() }; delete row.updated;
  const { data, error } = await sb.from("entries").upsert(row, { onConflict: "user_id,date" }).select().single();
  if (error) { toast("Couldn't save — check your connection"); console.error(error); return false; }
  const i = S.entries.findIndex(x => x.id === data.id); if (i >= 0) S.entries[i] = data; else S.entries.push(data);
  renderAll(); return true;
}
async function setDone(date, done) {
  const e = entryOf(S.user.id, date); if (!e) { openEditor(date); return; }
  const posBefore = position(S.user.id); const ok = await saveEntry({ ...e, completed: done }); if (!ok) return;
  if (done) {
    toast("Stamped! +1 tile 🎉");
    postMessage("system", `${S.me.nickname} finished today's shadowing ✓`);
    const posAfter = position(S.user.id); const lm = LANDMARKS.find(l => l.at > posBefore && l.at <= posAfter);
    if (lm) { postMessage("system", `${lm.art} ${S.me.nickname} arrived at ${lm.name}!`); setTimeout(() => showChest(lm.art, `Arrived: ${lm.name}`, lm.ko, lm.msg), 400); }
    const fh = fullHouseDates(); if (fh.includes(date)) postMessage("system", `🏠 Full house! Everyone finished on ${fmtShort(date)} — +½ tile each`);
    checkMilestones();
  }
}

/* ================= milestones ================= */
async function checkMilestones() {
  const { streak } = calcStreak(S.user.id); const mine = new Set(S.treasures.filter(t => t.user_id === S.user.id).map(t => t.milestone));
  for (const m of MILESTONES) {
    if (streak >= m && !mine.has(m)) {
      const { error } = await sb.from("treasures").insert({ user_id: S.user.id, milestone: m, opened_at: today() });
      if (!error) { S.treasures.push({ user_id: S.user.id, milestone: m, opened_at: today() }); const [t, msg, gift] = REWARDS[m]; showChest("🎁", `${m}-day streak`, t, `${msg}\n\nUnlocked: ${gift}`); postMessage("system", `🎁 ${S.me.nickname} opened the ${m}-day treasure chest!`); renderMe(); return; }
    }
  }
}
function showChest(art, badge, title, msg) { $("#chest-art").textContent = art; $("#chest-badge").textContent = badge; $("#chest-title").textContent = title; $("#chest-msg").textContent = msg; $("#chest-modal").hidden = false; }
$("#chest-close").addEventListener("click", () => { $("#chest-modal").hidden = true; setTimeout(checkMilestones, 300); });

/* ================= weekly recap (Sunday 21:00+) ================= */
async function maybeWeeklyRecap() {
  const now = new Date(); const t = today(); const wk = mondayOf(t); const d = parse(t).getDay();
  if (!(d === 0 && now.getHours() >= 21)) return;
  if (S.messages.some(m => m.kind === "recap" && m.meta?.week === wk)) return;
  const lines = S.profiles.map(p => { const n = [0, 1, 2, 3, 4, 5, 6].filter(i => entryOf(p.id, addDays(wk, i))?.completed).length; return `${p.nickname}: ${n}/7 ${"●".repeat(n)}${"○".repeat(7 - n)}`; });
  const fh = fullHouseDates().filter(x => x >= wk && x <= addDays(wk, 6)).length;
  const text = `📊 Weekly recap · ${fmtShort(wk)} – ${fmtShort(addDays(wk, 6))}\n${lines.join("\n")}\nFull-house days: ${fh}\nNew week starts tomorrow — see you on the map ✈️`;
  await sb.from("messages").insert({ user_id: S.user.id, kind: "recap", text, meta: { week: wk } });
}

/* ================= global clicks / tabs ================= */
function showTab(tab) { S.tab = tab; ["today", "journey", "lounge", "archive", "me"].forEach(t => $("#view-" + t).hidden = t !== tab); $$(".tab").forEach(b => b.classList.toggle("on", b.dataset.tab === tab)); window.scrollTo({ top: 0 }); if (tab === "lounge") renderLounge(true); if (tab === "journey") setTimeout(scrollMapToMe, 80); }
$$(".tab").forEach(b => b.addEventListener("click", () => showTab(b.dataset.tab)));
document.addEventListener("click", async e => {
  const ed = e.target.closest("[data-edit]"); if (ed) { openEditor(ed.dataset.edit); return; }
  const dn = e.target.closest("[data-done]"); if (dn) { await setDone(dn.dataset.done, true); return; }
  const un = e.target.closest("[data-undone]"); if (un) { if (await confirmBox("Undo today's stamp?", "Your tile and streak will update.", "Undo")) await setDone(un.dataset.undone, false); return; }
  const op = e.target.closest("[data-open]"); if (op && !op.disabled) {
    const who = op.dataset.who || S.user.id; const d = op.dataset.open; const ent = entryOf(who, d);
    if (ent) { S.readerKey = who + "|" + d; S.calWho = who; S.calMonth = d.slice(0, 7); showTab("archive"); renderArchive(); setTimeout(() => $("#reader-win").scrollIntoView({ behavior: "smooth", block: "start" }), 60); }
    else if (who === S.user.id && d <= today()) openEditor(d);
    return;
  }
  const pk = e.target.closest("[data-poke]"); if (pk) { const to = pk.dataset.poke; const { error } = await sb.from("pokes").insert({ from_user: S.user.id, to_user: to, date: today() }); if (!error) { S.pokes.push({ from_user: S.user.id, to_user: to }); postMessage("system", `👉 ${S.me.nickname} poked ${byId(to)?.nickname} — go shadow!`); renderToday(); } return; }
  const dm = e.target.closest("[data-delmsg]"); if (dm) { if (await confirmBox("Delete message?", "", "Delete")) await sb.from("messages").delete().eq("id", dm.dataset.delmsg); return; }
  const ch = e.target.closest("[data-chest]"); if (ch) { const m = +ch.dataset.chest; const op2 = S.treasures.find(t => t.user_id === S.user.id && t.milestone === m); if (op2) { const [t, msg, gift] = REWARDS[m]; showChest("🎁", `${m}-day streak · ${fmtShort(op2.opened_at)}`, t, `${msg}\n\n${gift}`); } else toast(`Reach a ${m}-day streak to open this one`); return; }
});
$("#week-prev").addEventListener("click", () => { S.weekStart = addDays(S.weekStart, -7); renderToday(); });
$("#week-next").addEventListener("click", () => { S.weekStart = addDays(S.weekStart, 7); renderToday(); });
$$(".modal").forEach(m => m.addEventListener("click", e => { if (e.target === m && m.id !== "confirm-modal") m.hidden = true; }));

/* ================= clock ================= */
function tickClock() { const d = new Date(); const c = $("#clock"); if (c) c.textContent = `${DOW[(d.getDay() + 6) % 7].toUpperCase()} ${pad(d.getMonth() + 1)}.${pad(d.getDate())}`; }
tickClock(); setInterval(tickClock, 60000);

/* ================= PWA ================= */
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

/* ================= start ================= */
(async () => {
  const { data } = await sb.auth.getSession();
  if (data.session?.user) { if (!S.user) { S.user = data.session.user; await boot(); } } else if (!S.user) showScreen("auth");
})();
