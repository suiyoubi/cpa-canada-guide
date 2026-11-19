/* ================= notes: highlight a passage, comment on it, suggest wording — alone or as a team =================
   My own items live in memory, in this browser's localStorage (automatic) and, when working alone, in a JSON
   block inside the HTML file ("Save my notes into this file").

   Shared mode needs no server. A folder on a shared drive holds one JSON file per person:
     - I only ever WRITE my own file (<my-id>.json), so two people can never overwrite each other.
     - I READ every file in the folder and merge them for display, again every 20 seconds.
     - A reply to, or a decision on, someone else's note is stored in MY file and points at THEIR note.
   Item kinds (field k): note (default), "sug" wording suggestion (r = replacement), "reply" (p = parent id),
   "st" status decision (p = target id, s = open | resolved | accepted | rejected). {id, del:1, u} is a tombstone. */
(function(){
"use strict";
const main = document.querySelector("main"); if(!main) return;
const LS_KEY = "cpa-guide-notes-v1", LS_ME = "cpa-guide-me-v1", FORMAT = "cpa-guide-notes/1";
const DEFAULT_NAME = "CPA-Professional-Program-Guide.html";
const FILE_NAME = (function(){ try{ const n = decodeURIComponent(location.pathname.split("/").pop()||""); return /\.html?$/i.test(n) ? n : DEFAULT_NAME; }catch(e){ return DEFAULT_NAME; } })();
const COLORS = [["y","Yellow"],["g","Green"],["p","Pink"],["b","Blue"]];
const PEOPLE = ["#6a51d8","#0b8a8a","#c2571a","#b0328f","#3f7f1f","#2f6fd0"];
const SKIP = "script,style,svg,button,select,option,textarea,input,.nt-ui,.nt-ins,.sr";
const POLL_MS = 20000;
const MARKER_FILE = "folder.js";                                   // tells the guide a notes folder sits next to it
const MARKER = "/* Marks this folder as the shared notes folder of the CPA guide. Please do not delete. */\nwindow.__cpaGuideNotesFolder = true;\n";
const DIR_KEY = "dir:" + location.pathname;
/* Reading without connecting: beside each person's <id>.json the guide also writes <id>.js, and people.js lists who
   has notes. A page may load scripts from its own folder without any permission, so everyone's notes can be shown
   as soon as the guide opens. Connecting (one folder pick and a name) is needed only to write. */
const PEOPLE_FILE = "people.js";
const safeJson = o => JSON.stringify(o).replace(/</g, "\\u003c");
const wrapNotes = d => "/* One person's notes, in a form the guide can read without being connected. Written by the guide: do not edit. */\nwindow.__cpaGuideNotes&&window.__cpaGuideNotes(" + safeJson(d) + ");\n";
const wrapPeople = l => "/* Who has notes in this folder. Written by the guide: do not edit. */\nwindow.__cpaGuidePeople&&window.__cpaGuidePeople(" + safeJson(l) + ");\n";                        // each copy of the guide remembers its own folder
const mk = (tag, attrs, html) => { const e=document.createElement(tag); if(attrs) for(const k in attrs){ if(k==="class") e.className=attrs[k]; else e.setAttribute(k,attrs[k]); } if(html!=null) e.innerHTML=html; return e; };
const esc = s => String(s).replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const now = () => Date.now();
const uid = () => "n"+now().toString(36)+Math.random().toString(36).slice(2,8);
const fmtDate = t => { try{ return new Date(t).toLocaleString(undefined,{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}); }catch(e){ return ""; } };
const fmtTime = t => { try{ return new Date(t).toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"}); }catch(e){ return ""; } };
const cut = (s, n) => s.length > n ? s.slice(0, n) + "…" : s;

let notes = [];                       // my own items and tombstones
let me = null;                        // {id, name} once I have joined a shared folder
const others = new Map();             // author id -> {name, items}
const owner = new WeakMap();          // item -> {id, name}, set only for other people's items
let threads = [], byId = new Map(), repliesBy = new Map(), statusBy = new Map();
let fileHandle = null, autoFile = false, fileDirty = false, storageOK = true;
let dir = null, share = "off", shareMsg = "", lastSync = 0, syncing = false, mineDirty = false, claimAsk = null;
let dirAuthors = new Map(); const fileCache = new Map();
let notesBeside = null, pendingPick = null, markerOK = false, hintOff = false;
let pubPeople = null, pubInbox = [], pubSig = "", pubBusy = false, localOnly = false;
let lastColor = "y", pending = null, editing = null, saveTimer = null, applyTimer = null, writeTimer = null;
let viewWho = "all", viewShow = "open", replyOpen = null, replyDraft = "", listStale = false;

/* ---------- storage ---------- */
function readEmbedded(){ try{ const v = JSON.parse(document.getElementById("guide-notes").textContent || "[]"); return Array.isArray(v) ? v : []; }catch(e){ return []; } }
function readLocal(){ try{ const v = JSON.parse(localStorage.getItem(LS_KEY) || "[]"); return Array.isArray(v) ? v : []; }catch(e){ storageOK = false; return []; } }
function writeLocal(){ try{ localStorage.setItem(LS_KEY, JSON.stringify(notes)); storageOK = true; }catch(e){ storageOK = false; } }
function readMe(){ try{ const v = JSON.parse(localStorage.getItem(LS_ME) || "null"); return v && v.id && v.name ? {id:String(v.id), name:String(v.name)} : null; }catch(e){ return null; } }
function writeMe(){ try{ if(me) localStorage.setItem(LS_ME, JSON.stringify(me)); else localStorage.removeItem(LS_ME); }catch(e){} }
function merge(a, b){ const m = new Map(); a.concat(b).forEach(n=>{ if(!n || !n.id) return; const o = m.get(n.id); if(!o || (n.u||0) > (o.u||0)) m.set(n.id, n); }); return Array.from(m.values()); }
const canon = list => JSON.stringify(list.slice().sort((x,y)=>x.id<y.id?-1:1));
const slug = s => String(s).trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 40);

/* ---------- people, threads ---------- */
const kind = n => n.k || "note";
const isMine = n => !owner.has(n);
const authorOf = n => owner.get(n) || {id: me ? me.id : "me", name: me ? me.name : "You"};
const colorOf = id => { let h = 0; for(let i=0;i<id.length;i++) h = (h*31 + id.charCodeAt(i)) >>> 0; return PEOPLE[h % PEOPLE.length]; };
function reindex(){
  threads = []; byId = new Map(); repliesBy = new Map(); statusBy = new Map();
  const all = notes.filter(n=>!n.del), seen = new Set();
  others.forEach((o, id)=>{ if(me && id === me.id) return; o.items.forEach(n=>{ if(!n.del) all.push(n); }); });
  all.forEach(n=>{ if(seen.has(n.id)) return; seen.add(n.id); const k = kind(n); if(k==="note" || k==="sug"){ threads.push(n); byId.set(n.id, n); } });
  seen.clear();
  all.forEach(n=>{ if(seen.has(n.id)) return; seen.add(n.id); const k = kind(n);
    if(k==="reply" && byId.has(n.p)){ if(!repliesBy.has(n.p)) repliesBy.set(n.p, []); repliesBy.get(n.p).push(n); }
    if(k==="st" && byId.has(n.p)){ const o = statusBy.get(n.p); if(!o || (n.u||0) > (o.u||0)) statusBy.set(n.p, n); }
  });
  repliesBy.forEach(l=>l.sort((a,b)=>(a.t||0)-(b.t||0)));
}
const statusOf = n => { const s = statusBy.get(n.id); return s && ["resolved","accepted","rejected"].indexOf(s.s) >= 0 ? s.s : "open"; };
const isOpen = n => statusOf(n) === "open";
/* An accepted wording suggestion is not finished when it is accepted: the guide's text only changes at the next
   rebuild. Until then it is "pending" and stays visible in the text. It counts as applied once the original
   words are gone from its section and the new words are there. */
const isAccSug = n => kind(n) === "sug" && statusOf(n) === "accepted";
let secTextCache = null;
function secText(sec){
  if(!secTextCache) secTextCache = new Map();
  if(!secTextCache.has(sec)){ const r = rootOf(sec); secTextCache.set(sec, r ? textNodes(r).map(x=>x.data).join("").replace(/\s+/g, " ") : ""); }
  return secTextCache.get(sec);
}
const isApplied = n => isAccSug(n) && !!n.r && !marksOf(n.id).length && secText(n.sec).includes(String(n.r).replace(/\s+/g, " ").trim());
const isPending = n => isAccSug(n) && !isApplied(n);
const isActive = n => isOpen(n) || isPending(n);

/* ---------- sections ---------- */
const mast = () => document.querySelector("header.mast");
const roots = () => [mast()].concat(Array.from(main.querySelectorAll("section[id]"))).filter(Boolean);
const rootOf = sec => sec==="top" ? mast() : document.getElementById(String(sec));
const secOf = root => root.matches("header.mast") ? "top" : root.id;
function secTitle(sec){
  if(sec==="top") return "Introduction";
  const r = rootOf(sec), h2 = r && r.querySelector("h2"); if(!h2) return String(sec);
  const c = h2.cloneNode(true); c.querySelectorAll(".n").forEach(x=>x.remove()); return c.textContent.trim();
}

/* ---------- text anchoring (quote + surrounding context) ---------- */
function textNodes(root){
  const out = [], w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode(n){ const p = n.parentElement; return (!p || p.closest(SKIP)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; } });
  let n; while((n = w.nextNode())) out.push(n); return out;
}
function selectionInfo(){
  const sel = window.getSelection(); if(!sel || sel.isCollapsed || !sel.rangeCount) return null;
  const range = sel.getRangeAt(0);
  const ca = range.commonAncestorContainer, anc = ca.nodeType===1 ? ca : ca.parentElement;
  if(!anc || anc.closest(".nt-ui")) return null;
  const root = anc.closest("section[id], header.mast"); if(!root || !main.contains(root)) return null;
  const nodes = textNodes(root); let full = "", start = -1, end = -1;
  for(const n of nodes){
    if(range.intersectsNode(n)){
      let s = 0, e = n.data.length;
      if(n === range.startContainer) s = range.startOffset;
      if(n === range.endContainer) e = range.endOffset;
      if(e > s){ if(start < 0) start = full.length + s; end = full.length + e; }
    }
    full += n.data;
  }
  if(start < 0 || end <= start) return null;
  let q = full.slice(start, end);
  const lead = q.length - q.trimStart().length, trail = q.length - q.trimEnd().length;
  start += lead; end -= trail; q = full.slice(start, end);
  if(!q || q.length > 3000) return null;
  let ctx = null; const det = anc.closest("#stepDetail,#ostepDetail");
  if(det){ const p = det.id==="ostepDetail" ? "o" : ""; const steps = Array.from(document.querySelectorAll("#"+p+"track .step")); const i = steps.findIndex(b=>b.getAttribute("aria-current")==="true"); if(i>=0) ctx = {p, i}; }
  return { sec: secOf(root), q, pre: full.slice(Math.max(0,start-40), start), suf: full.slice(end, end+40), ctx, rect: range.getBoundingClientRect() };
}
const cpre = (a,b) => { let i=0; while(i<a.length && i<b.length && a[i]===b[i]) i++; return i; };
const csuf = (a,b) => { let i=0; while(i<a.length && i<b.length && a[a.length-1-i]===b[b.length-1-i]) i++; return i; };
function locate(note){
  const root = rootOf(note.sec); if(!root || !note.q) return null;
  const nodes = textNodes(root), starts = []; let full = "";
  for(const n of nodes){ starts.push(full.length); full += n.data; }
  const q = String(note.q), pre = String(note.pre||""), suf = String(note.suf||"");
  let best = -1, bestScore = -1, idx = full.indexOf(q);
  while(idx >= 0){
    const score = csuf(full.slice(Math.max(0, idx-40), idx), pre) + cpre(full.slice(idx+q.length, idx+q.length+40), suf);
    if(score > bestScore){ bestScore = score; best = idx; }
    idx = full.indexOf(q, idx+1);
  }
  return best < 0 ? null : { nodes, starts, start: best, end: best + q.length };
}
const sigOf = n => kind(n) + "|" + (isMine(n) ? 1 : 0);
const marksOf = id => Array.from(document.querySelectorAll("mark.nt-hl")).filter(m=>m.dataset.note === id);
const insOf = id => Array.from(document.querySelectorAll("ins.nt-ins")).filter(m=>m.dataset.note === id);
function wrap(note, loc){
  const marks = [];
  for(let i=0; i<loc.nodes.length; i++){
    const n = loc.nodes[i], ns = loc.starts[i], ne = ns + n.data.length;
    if(ne <= loc.start || ns >= loc.end) continue;
    const s = Math.max(loc.start, ns) - ns, e = Math.min(loc.end, ne) - ns; if(e <= s) continue;
    /* Inside a flex or grid row every piece of text becomes its own item with a gap, so a highlight in the middle
       of a word would pull the word apart. Keep the whole text in one wrapper first. */
    const par = n.parentNode;
    if(par && par.nodeType === 1 && /flex|grid/.test(getComputedStyle(par).display)){ const keep = mk("span", {class:"nt-keep"}); par.insertBefore(keep, n); keep.appendChild(n); }
    let t = n; if(e < t.data.length) t.splitText(e); if(s > 0) t = t.splitText(s);
    if(!t.data.trim()) continue;
    const m = mk("mark", {class:"nt-hl", "data-note":note.id, "data-sig":sigOf(note), tabindex:"0", role:"button"});
    t.parentNode.insertBefore(m, t); m.appendChild(t); marks.push(m);
  }
  decorate(note, marks);
}
/* Only call while the observer is disconnected (inside applyAll): it changes the page. */
function decorate(note, marks){
  marks = marks || marksOf(note.id); if(!marks.length) return;
  const k = kind(note), mine = isMine(note), a = authorOf(note), talk = !!note.c || repliesBy.has(note.id), acc = isAccSug(note);
  const label = acc ? "Accepted change" : (mine ? "Your " : a.name + "’s ") + (k==="sug" ? "suggestion" : "note");
  const tip = label + (k==="sug" ? ": replace with “" + cut(String(note.r||"(delete)"), 200) + "”" : "") + (acc ? ". The guide’s own text changes at its next rebuild." : (note.c ? ": " + cut(String(note.c), 300) : ""));
  marks.forEach((m,i)=>{
    m.className = "nt-hl " + (k==="sug" ? "nt-sug" + (acc ? " nt-acc" : "") : mine ? "nt-"+(/^[ygpb]$/.test(note.col) ? note.col : "y") : "nt-other") + (talk && k!=="sug" && i===marks.length-1 ? " nt-has" : "");
    if(mine) m.style.removeProperty("--ac"); else m.style.setProperty("--ac", colorOf(a.id));
    m.setAttribute("aria-label", tip); m.title = tip;
  });
  let ins = insOf(note.id)[0];
  if(k==="sug"){
    const last = marks[marks.length-1];
    if(!ins){ ins = mk("ins", {class:"nt-ins", "data-note":note.id, tabindex:"0", role:"button"}); last.parentNode.insertBefore(ins, last.nextSibling); }
    const text = note.r ? String(note.r) : "(delete)"; if(ins.textContent !== text) ins.textContent = text;
    ins.className = "nt-ins" + (acc ? " nt-acc" : "");
    ins.title = tip; ins.setAttribute("aria-label", tip);
  } else if(ins) ins.remove();
}
function unwrap(id){
  insOf(id).forEach(x=>x.remove());
  marksOf(id).forEach(m=>{ const p = m.parentNode; while(m.firstChild) p.insertBefore(m.firstChild, m); p.removeChild(m); p.normalize(); });
}
const obs = new MutationObserver(()=>{ clearTimeout(applyTimer); applyTimer = setTimeout(applyAll, 160); });
function applyAll(){
  obs.disconnect();
  reindex(); secTextCache = null;
  const want = new Map(); threads.forEach(n=>{ if(n.q && (isOpen(n) || isAccSug(n))) want.set(n.id, n); });
  const drop = new Set(); document.querySelectorAll("mark.nt-hl").forEach(m=>{ const n = want.get(m.dataset.note); if(!n || m.dataset.sig !== sigOf(n)) drop.add(m.dataset.note); });
  document.querySelectorAll("ins.nt-ins").forEach(m=>{ if(!want.has(m.dataset.note)) drop.add(m.dataset.note); });
  drop.forEach(unwrap);
  want.forEach(n=>{ if(marksOf(n.id).length) decorate(n); else { const loc = locate(n); if(loc) wrap(n, loc); } });
  obs.observe(main, {childList:true, subtree:true});
  secTextCache = null;
  renderList();
}

/* ---------- UI ---------- */
const addBox = mk("div", {class:"nt-ui nt-addbox", hidden:"", role:"group", "aria-label":"Add to this text"}, '<button type="button" data-k="note">✎ Note</button><button type="button" data-k="sug">⇄ Suggest wording</button>');
const fab = mk("button", {class:"nt-ui nt-fab", type:"button", "aria-haspopup":"dialog"}, 'Notes <b id="ntBadge">0</b><i id="ntDot" hidden title="Not yet saved into the file"></i>');
const pop = mk("div", {class:"nt-ui nt-pop", hidden:"", role:"dialog", "aria-label":"Note"},
  '<div class="nt-q" id="ntQ"></div>'+
  '<label class="nt-lab" id="ntReplWrap" hidden>Replace with<textarea id="ntRepl" rows="3" placeholder="New wording (leave empty to delete the text)"></textarea></label>'+
  '<textarea id="ntText" rows="4" placeholder="Write your comment (optional)"></textarea>'+
  '<div class="nt-row"><div class="nt-colors" id="ntColors" role="group" aria-label="Highlight colour">'+COLORS.map(c=>'<button type="button" data-c="'+c[0]+'" class="nt-sw nt-'+c[0]+'" aria-label="'+c[1]+'"></button>').join("")+'</div>'+
  '<span class="nt-sp"></span><button type="button" class="nt-btn danger" id="ntDel">Delete</button><button type="button" class="nt-btn" id="ntCancel">Cancel</button><button type="button" class="nt-btn primary" id="ntSave">Save</button></div>'+
  '<div class="nt-hint">Ctrl or ⌘ + Enter saves · Esc closes</div>');
const drawer = mk("aside", {class:"nt-ui nt-drawer", hidden:"", "aria-label":"Notes"},
  '<div class="nt-dh"><b>Notes</b><span id="ntCount"></span><button type="button" id="ntClose" class="nt-x" aria-label="Close notes">×</button></div>'+
  '<div class="nt-share" id="ntShare" aria-live="polite"></div>'+
  '<div class="nt-actions"><button type="button" class="nt-btn primary" id="ntSaveFile">Save my notes into this file</button><button type="button" class="nt-btn" id="ntAddSec">+ Section note</button><button type="button" class="nt-btn" id="ntExportMd">Export .md</button><button type="button" class="nt-btn" id="ntExportAcc">Accepted changes</button><button type="button" class="nt-btn" id="ntExportJson">Backup .json</button><button type="button" class="nt-btn" id="ntImport">Import</button></div>'+
  '<p class="nt-status" id="ntStatus" aria-live="polite"></p>'+
  '<div class="nt-filters"><select id="ntWho" aria-label="Whose notes" hidden></select><select id="ntShow" aria-label="Which notes"><option value="open">Open or awaiting rebuild</option><option value="closed">Closed</option><option value="all">Open and closed</option></select><input type="search" id="ntSearch" placeholder="Search notes" aria-label="Search notes"></div>'+
  '<div class="nt-list" id="ntList"></div>'+
  '<p class="nt-help">Select any text in the guide, then choose <b>Note</b> or <b>Suggest wording</b>. Click a highlight to open it. An accepted wording change stays marked in the text until the guide is rebuilt with it. Your notes are kept in this browser as you type. Working alone, use <b>Save my notes into this file</b> so they travel with the HTML. Working as a team, everyone’s notes show by themselves when the guide is opened from the shared folder; connect once to add your own, which are saved to your own file there.</p>'+
  '<input type="file" id="ntFile" accept=".json,application/json" multiple hidden>');
const hintEl = mk("div", {class:"nt-ui nt-teamhint", hidden:"", role:"status"});
[addBox, fab, hintEl, pop, drawer].forEach(e=>document.body.appendChild(e));
const $ = id => document.getElementById(id);
/* tell the page when the panel is open, so it can make room for it */
new MutationObserver(()=>document.documentElement.classList.toggle("nt-open", !drawer.hidden)).observe(drawer, {attributes:true, attributeFilter:["hidden"]});

function place(el, rect){
  el.hidden = false;
  const w = el.offsetWidth, h = el.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
  let left = rect ? rect.left : (vw - w)/2, top = rect ? rect.bottom + 8 : (vh - h)/2;
  if(top + h > vh - 8) top = rect ? Math.max(8, rect.top - h - 8) : 8;
  el.style.left = Math.max(8, Math.min(vw - w - 8, left)) + "px";
  el.style.top = Math.max(8, top) + "px";
}
function openEditor(note, isNew, rect){
  editing = {note, isNew}; addBox.hidden = true;
  const sug = kind(note) === "sug";
  $("ntQ").textContent = note.q ? cut(String(note.q), 260) : "Note on: " + secTitle(note.sec);
  $("ntReplWrap").hidden = !sug; $("ntRepl").value = sug ? (note.r != null ? note.r : note.q) : "";
  $("ntText").value = note.c || ""; $("ntText").placeholder = sug ? "Why (optional)" : "Write your comment (optional)";
  $("ntColors").hidden = sug; $("ntDel").hidden = isNew;
  setColor(note.col || lastColor);
  place(pop, rect);
  setTimeout(()=>(sug ? $("ntRepl") : $("ntText")).focus(), 0);
}
function setColor(c){ if(editing) editing.col = c; Array.from($("ntColors").children).forEach(b=>b.setAttribute("aria-pressed", String(b.dataset.c===c))); }
function closeEditor(){ pop.hidden = true; editing = null; }
function saveEditor(){
  if(!editing) return;
  const n = editing.note, sug = kind(n) === "sug";
  n.c = $("ntText").value.trim(); n.u = now();
  if(sug) n.r = $("ntRepl").value.replace(/\s+/g, " ").trim(); else { n.col = editing.col || n.col || "y"; lastColor = n.col; }
  if(editing.isNew){
    if(sug ? (n.r === String(n.q).replace(/\s+/g, " ").trim() && !n.c) : (!n.q && !n.c)){ closeEditor(); return; }
    notes.push(n); try{ window.getSelection().removeAllRanges(); }catch(e){}
  }
  closeEditor(); commit(); applyAll();
}
function removeItem(id){ const i = notes.findIndex(n=>n.id===id); if(i < 0) return; notes[i] = {id, del:1, u:now()}; commit(); applyAll(); }
function addReply(n, text){ notes.push({id:uid(), k:"reply", p:n.id, c:text, t:now(), u:now()}); commit(); applyAll(); }
function setStatus(n, s){
  const st = notes.find(x=>!x.del && x.k==="st" && x.p===n.id);
  if(st){ st.s = s; st.u = now(); } else notes.push({id:uid(), k:"st", p:n.id, s, t:now(), u:now()});
  commit(); applyAll();
}
function commit(){
  writeLocal(); fileDirty = true; mineDirty = true; badges();
  if(share === "off" && notesBeside && !localOnly){ localOnly = true; hintOff = false; renderShare(); }
  if(dir && me && share === "on"){ clearTimeout(writeTimer); writeTimer = setTimeout(()=>{ writeMine().then(renderShare, ()=>setShare("error")); }, 500); }
  else if(autoFile && fileHandle){ clearTimeout(saveTimer); saveTimer = setTimeout(()=>saveToFile(true), 1200); }
}
function badges(){
  const open = threads.filter(isOpen).length, pend = threads.filter(isPending).length, total = threads.length, mineCount = notes.filter(n=>!n.del).length;
  $("ntBadge").textContent = open + pend; $("ntDot").hidden = !(share === "off" && fileDirty && notes.length > 0);
  $("ntCount").textContent = open + " open" + (pend ? " · " + pend + " accepted, awaiting rebuild" : "") + (total > open + pend ? " · " + (total - open - pend) + " closed" : "");
  const fs = !!window.showSaveFilePicker, parts = [];
  if(share !== "off"){
    parts.push(share === "on" ? "Your notes are written to your own file in the shared folder as you type, and kept in this browser as a backup." : "Your notes are kept in this browser and will be written to the shared folder once it is connected.");
  } else {
    parts.push(storageOK ? "Kept in this browser automatically." : "This browser is not keeping notes between visits, so save them into the file.");
    if(autoFile) parts.push(fileDirty ? "Writing to the file…" : "Saved into the file; further changes are written automatically.");
    else if(fileDirty && notes.length) parts.push(fs ? "Not yet saved into the file." : "Not yet in the file: your browser cannot overwrite it, so Save downloads an updated copy to put in place of the original.");
    else if(mineCount) parts.push("The file contains all your notes.");
  }
  $("ntStatus").textContent = parts.join(" ");
}

/* ---------- the list ---------- */
function visibleThreads(){
  const term = ($("ntSearch").value||"").trim().toLowerCase(), order = roots().map(secOf);
  return threads.filter(n=>{
    const a = authorOf(n);
    if(viewWho === "me" ? !isMine(n) : (viewWho !== "all" && (isMine(n) || a.id !== viewWho))) return false;
    const open = isActive(n); if(viewShow === "open" ? !open : (viewShow === "closed" && open)) return false;
    if(term){ const hay = [n.q, n.c, n.r, a.name].concat((repliesBy.get(n.id)||[]).map(r=>r.c)).join(" ").toLowerCase(); if(!hay.includes(term)) return false; }
    return true;
  }).sort((a,b)=>(order.indexOf(a.sec)-order.indexOf(b.sec)) || ((a.t||0)-(b.t||0)));
}
function renderList(){
  const list = $("ntList"); if(!list) return;
  const ae = document.activeElement;
  if(ae && ae.tagName === "TEXTAREA" && list.contains(ae)){ listStale = true; badges(); return; }   // do not redraw under someone typing a reply
  listStale = false;
  const who = $("ntWho"), team = others.size > 0 || share !== "off";
  who.hidden = others.size === 0;
  if(others.size){ const opts = [["all","Everyone"],["me","Mine"]].concat(Array.from(others, ([id,o])=>[id, o.name])); if(!opts.some(o=>o[0]===viewWho)) viewWho = "all"; who.innerHTML = opts.map(o=>'<option value="'+esc(o[0])+'">'+esc(o[1])+'</option>').join(""); who.value = viewWho; } else viewWho = "all";
  const items = visibleThreads(); list.textContent = "";
  if(!items.length){
    const any = threads.length > 0;
    list.appendChild(mk("p", {class:"nt-empty"}, any ? "Nothing matches this view. Try “Open and closed” or clear the search." : "No notes yet. Select a sentence in the guide to start."));
    badges(); return;
  }
  let lastSec = null;
  items.forEach(n=>{
    if(n.sec !== lastSec){ lastSec = n.sec; list.appendChild(mk("h5", null, esc(secTitle(n.sec)))); }
    const k = kind(n), mine = isMine(n), a = authorOf(n), st = statusOf(n), stItem = statusBy.get(n.id), open = st === "open", pend = isPending(n), appl = isApplied(n);
    const shown = !n.q || !(open || pend) || marksOf(n.id).length > 0, q = n.q ? String(n.q) : "";
    let h = "";
    if(team || k === "sug" || !open) h += '<div class="nt-who">' + (team ? '<i class="nt-dot"></i><b>'+esc(a.name)+(mine && me ? " (you)" : "")+'</b>' : "") + (k==="sug" ? '<span class="nt-kind">Suggestion</span>' : "") + (open ? "" : '<span class="nt-st nt-st-'+st+'">'+st.charAt(0).toUpperCase()+st.slice(1)+(team && stItem ? " by "+esc(authorOf(stItem).name) : "")+'</span>') + (pend ? '<span class="nt-st nt-st-wait">In the guide at its next rebuild</span>' : appl ? '<span class="nt-st">Now in the guide</span>' : "") + '</div>';
    if(k === "sug") h += '<p class="nt-change"><del>'+esc(cut(q, 220))+'</del> <span aria-hidden="true">→</span> <ins>'+(n.r ? esc(cut(String(n.r), 400)) : "<i>(delete)</i>")+'</ins></p>';
    else h += q ? '<blockquote>'+esc(cut(q, 220))+'</blockquote>' : '<blockquote class="sec">Section note</blockquote>';
    if(n.c) h += '<p>'+esc(n.c)+'</p>';
    (repliesBy.get(n.id)||[]).forEach(r=>{ const ra = authorOf(r); h += '<div class="nt-reply" style="--ac:'+colorOf(ra.id)+'"><b>'+esc(ra.name)+'</b> <span class="nt-when">'+esc(fmtDate(r.u||r.t))+'</span>'+(isMine(r) ? ' <button type="button" data-a="delreply" data-id="'+esc(r.id)+'">Delete</button>' : "")+'<p>'+esc(r.c||"")+'</p></div>'; });
    h += '<div class="nt-meta"><span>'+esc(fmtDate(n.u||n.t))+(shown ? "" : " · text not found in the current view")+'</span><span class="nt-sp"></span><button type="button" data-a="go">Go to</button><button type="button" data-a="reply">Reply</button>'+
      (open ? (k==="sug" ? '<button type="button" data-a="accepted">Accept</button><button type="button" data-a="rejected">Reject</button>' : '<button type="button" data-a="resolved">Resolve</button>') : '<button type="button" data-a="open">Reopen</button>')+
      (mine ? '<button type="button" data-a="edit">Edit</button><button type="button" data-a="del">Delete</button>' : "")+'</div>';
    if(replyOpen === n.id) h += '<div class="nt-replyform"><textarea rows="2" placeholder="Write a reply" aria-label="Reply"></textarea><div class="nt-row"><span class="nt-sp"></span><button type="button" class="nt-btn" data-a="replycancel">Cancel</button><button type="button" class="nt-btn primary" data-a="replysend">Send</button></div></div>';
    const it = mk("div", {class:"nt-item " + (mine ? "nt-"+(/^[ygpb]$/.test(n.col) ? n.col : "y") : "nt-other") + (k==="sug" ? " nt-issug" : "") + (open || pend ? "" : " nt-closed"), "data-thread":n.id}, h);
    it.style.setProperty("--ac", colorOf(a.id));
    const ta = it.querySelector(".nt-replyform textarea");
    if(ta){ ta.value = replyDraft; ta.addEventListener("input", ()=>{ replyDraft = ta.value; }); ta.addEventListener("blur", ()=>{ if(listStale) setTimeout(renderList, 0); });
      ta.addEventListener("keydown", e=>{ if(!e.isComposing && (e.ctrlKey || e.metaKey) && e.key === "Enter"){ e.preventDefault(); sendReply(n); } }); }
    it.addEventListener("click", e=>{
      const b = e.target.closest && e.target.closest("button[data-a]"); if(!b) return; const act = b.dataset.a;
      if(act==="go") goTo(n);
      else if(act==="edit") openEditor(n, false, b.getBoundingClientRect());
      else if(act==="reply"){ replyOpen = n.id; replyDraft = ""; listStale = false; renderListNow(); const t = $("ntList").querySelector(".nt-replyform textarea"); if(t) t.focus(); }
      else if(act==="replycancel"){ replyOpen = null; replyDraft = ""; renderListNow(); }
      else if(act==="replysend") sendReply(n);
      else if(act==="resolved" || act==="accepted" || act==="rejected" || act==="open") setStatus(n, act);
      else if(act==="del" || act==="delreply"){
        if(b.dataset.sure){ if(act==="del") removeItem(n.id); else removeItem(b.dataset.id); }
        else { b.dataset.sure = "1"; const was = b.textContent; b.textContent = "Confirm delete"; setTimeout(()=>{ if(b.isConnected){ delete b.dataset.sure; b.textContent = was; } }, 3500); }
      }
    });
    list.appendChild(it);
  });
  badges();
}
function renderListNow(){ if(document.activeElement && document.activeElement.blur && $("ntList").contains(document.activeElement)) document.activeElement.blur(); listStale = false; renderList(); }
function sendReply(n){ const text = replyDraft.trim(); replyOpen = null; replyDraft = ""; if(document.activeElement && document.activeElement.blur) document.activeElement.blur(); if(text) addReply(n, text); else renderList(); }
function goTo(n){
  const show = () => { const m = marksOf(n.id)[0], target = m || rootOf(n.sec); if(!target) return;
    target.scrollIntoView({block: m ? "center" : "start"}); if(m){ marksOf(n.id).forEach(x=>{ x.classList.add("nt-flash"); setTimeout(()=>x.classList.remove("nt-flash"), 1600); }); } };
  if(window.innerWidth < 900) drawer.hidden = true;
  const c = n.ctx;
  if(n.q && !marksOf(n.id).length && c && (c.p === "" || c.p === "o") && Number.isInteger(c.i)){
    const b = document.querySelectorAll("#"+c.p+"track .step")[c.i]; if(b){ b.click(); setTimeout(()=>{ applyAll(); show(); }, 60); return; }
  }
  show();
}
function openThread(id){
  const n = byId.get(id); if(!n) return;
  drawer.hidden = false; viewWho = "all"; if(!isActive(n)) viewShow = "all"; $("ntShow").value = viewShow; $("ntSearch").value = "";
  renderListNow();
  const card = Array.from($("ntList").children).find(c=>c.dataset && c.dataset.thread === id);
  if(card){ card.scrollIntoView({block:"center"}); card.classList.add("nt-flash"); setTimeout(()=>card.classList.remove("nt-flash"), 1600); }
}

/* ---------- shared folder: one file per person ---------- */
function checkShared(d){
  if(!d || typeof d.format !== "string" || d.format.indexOf("cpa-guide-notes/") !== 0 || !d.author || !Array.isArray(d.items)) return null;
  const id = slug(d.author.id || ""); if(!id) return null;
  return { author: {id, name: String(d.author.name || id).slice(0, 80)}, updated: Number(d.updated) || 0, items: d.items.filter(n=>n && typeof n.id === "string" && n.id.length < 80) };
}
function parseShared(text){ try{ return checkShared(JSON.parse(text)); }catch(e){ return null; } }
/* ---------- reading everyone's notes without connecting ---------- */
function loadScript(src, done){ const s = document.createElement("script"); s.src = src; s.onload = () => { s.remove(); done(true); }; s.onerror = () => { s.remove(); done(false); }; document.head.appendChild(s); }
window.__cpaGuidePeople = l => { pubPeople = Array.isArray(l) ? l : []; };
window.__cpaGuideNotes = d => { const data = checkShared(d); if(data) pubInbox.push(data); };
function loadPublic(){
  if(dir || share !== "off" || !notesBeside || pubBusy) return;
  pubBusy = true; pubPeople = null; pubInbox = []; const stamp = now();
  const finish = () => {
    pubBusy = false; if(dir || share !== "off") return;
    const seen = pubInbox.filter(d=>!(me && d.author.id === me.id));
    const sig = JSON.stringify(seen.map(d=>[d.author.id, d.updated]).sort());
    if(sig === pubSig) return; pubSig = sig;
    others.clear(); seen.forEach(d=>{ d.items.forEach(n=>owner.set(n, d.author)); others.set(d.author.id, {name:d.author.name, items:d.items}); });
    applyAll(); renderShare();
  };
  loadScript("notes/" + PEOPLE_FILE + "?t=" + stamp, ok=>{
    if(!ok || !pubPeople){ finish(); return; }
    const ids = Array.from(new Set(pubPeople.map(x=>slug((x && x.id) || "")).filter(Boolean))).slice(0, 200);
    let left = ids.length; if(!left){ finish(); return; }
    ids.forEach(id=>loadScript("notes/" + encodeURIComponent(id) + ".js?t=" + stamp, ()=>{ if(--left === 0) finish(); }));
  });
}
function setShare(state, msg){ share = state; shareMsg = msg || ""; renderShare(); badges(); }
function renderShare(){
  const box = $("ntShare"); if(!box) return; let h = "";
  const btn = (a, label, primary) => '<button type="button" class="nt-btn'+(primary ? " primary" : "")+'" data-s="'+a+'">'+label+'</button>';
  if(share === "on"){
    const people = others.size + 1;
    h = '<p><b>Shared notes are on.</b> '+people+(people===1 ? " person" : " people")+' in the folder “'+esc(dir.name)+'” · checked '+esc(fmtTime(lastSync))+(mineDirty ? " · saving…" : "")+'</p><p>You are <b>'+esc(me.name)+'</b>. Your notes are saved to <code>'+esc(me.id)+'.json</code>; nobody else writes that file.</p><div class="nt-row">'+btn("refresh","Refresh")+btn("stop","Stop sharing")+'</div>';
  } else if(share === "name"){
    if(claimAsk) h = '<p><b>“'+esc(claimAsk.name)+'” already has notes in this folder.</b> Is that you?</p><div class="nt-row">'+btn("claim","Yes, that’s me",true)+btn("rename","Use another name")+'</div>';
    else h = '<p><b>What should others see as your name?</b></p><div class="nt-row"><input type="text" id="ntName" maxlength="60" placeholder="Your name" aria-label="Your name" value="'+esc(me ? me.name : "")+'">'+btn("join","Join",true)+btn("stop","Cancel")+'</div>';
  } else if(share === "need"){
    h = '<p><b>Shared notes are paused.</b> The browser needs your permission again for the folder “'+esc(dir ? dir.name : "notes")+'”.</p><div class="nt-row">'+btn("reconnect","Reconnect",true)+btn("stop","Stop sharing")+'</div>';
  } else if(share === "error"){
    h = '<p><b>The shared folder cannot be reached right now.</b> Your notes are safe in this browser and will be written when it is back.</p><div class="nt-row">'+btn("refresh","Try again",true)+btn("stop","Stop sharing")+'</div>';
  } else if(share === "confirm"){
    h = '<p><b>“'+esc(pendingPick ? pendingPick.name : "")+'” does not hold this guide.</b> Create the notes folder there anyway? Other people must connect to the same place to see each other’s notes.</p><div class="nt-row">'+btn("force","Create it there",true)+btn("create","Pick again")+btn("stop","Cancel")+'</div>';
  } else if(window.showDirectoryPicker){
    if(notesBeside && others.size) h = '<p><b>You are seeing your team’s notes</b> ('+others.size+(others.size===1 ? " person" : " people")+'). Reading needs nothing from you.</p><p><b>To add notes, reply or accept changes so that others see them, connect once.</b> The browser asks you to choose the folder that holds this guide, then the guide asks for your name. After that it reconnects by itself or with one click.</p><div class="nt-row">'+btn("connect","Connect to add your own",true)+'</div>';
    else if(notesBeside) h = '<p><b>This guide is set up for team notes</b>, and nobody has added one yet.</p><p>To add notes that others can see, connect once: the browser asks you to choose the folder that holds this guide, then the guide asks for your name.</p><div class="nt-row">'+btn("connect","Connect to add notes",true)+'</div>';
    else h = '<p><b>Working alone.</b> '+(notesBeside === false ? 'There is no <code>notes</code> folder next to this guide yet.' : 'Looking for a <code>notes</code> folder next to this guide…')+' To share notes with other people, create one here or point to one kept elsewhere.</p><p>The browser will ask you to choose a folder. To create it here, pick the folder that holds this guide.</p><div class="nt-row">'+btn("create","Create notes folder here",true)+btn("any","Use a folder elsewhere")+'</div>';
  } else {
    h = '<p><b>Working alone.</b> Shared notes need Chrome or Edge on a computer. In this browser you can still read other people’s notes: choose <b>Import</b> and pick their files from the shared <code>notes</code> folder.</p>';
  }
  if(share === "off" && others.size && !notesBeside) h += '<p>Showing notes from '+others.size+(others.size===1 ? " other person" : " other people")+', read-only, from the files you opened.</p>';
  if(share === "off" && notesBeside && localOnly) h += '<p class="nt-warn">Your own notes and replies are saved on this computer only for now. Connect to share them with the team.</p>';
  if(shareMsg) h += '<p class="nt-warn">'+esc(shareMsg)+'</p>';
  box.innerHTML = h;
  $("ntSaveFile").hidden = share !== "off";
  renderHint();
}
/* A small prompt beside the Notes button, so nobody has to open the panel to learn that team notes exist. */
function renderHint(){
  let h = "";
  if(!hintOff && drawer.hidden && window.showDirectoryPicker){
    if(share === "need") h = 'Shared notes are paused. <button type="button" data-s="reconnect">Reconnect</button>';
    else if(share === "off" && notesBeside && localOnly) h = 'Your note is saved on this computer only. <button type="button" data-s="connect">Connect</button> to share it with the team.';
    else if(share === "off" && notesBeside && others.size) h = 'You are seeing your team’s notes. To add your own, <button type="button" data-s="connect">connect</button> once.';
    else if(share === "off" && notesBeside) h = 'This guide is set up for team notes. <button type="button" data-s="connect">Connect</button> to add the first.';
  }
  hintEl.hidden = !h; if(h) hintEl.innerHTML = '<span>'+h+'</span><button type="button" data-s="hide" class="nt-x" aria-label="Dismiss">×</button>';
}
/* The browser never lets a page open a folder by itself, so the first connection needs one pick by the user.
   mode "beside": a notes folder was detected next to the guide; expect the user to pick the guide's folder.
   mode "create": none was detected; create notes/ inside the picked folder (asking first if the guide is not there).
   mode "any":    use exactly the picked folder as the notes folder. */
async function connect(mode){
  try{
    const opts = {id:"cpaGuideNotes", mode:"readwrite"}; if(fileHandle) opts.startIn = fileHandle;
    await adopt(await window.showDirectoryPicker(opts), mode, false);
  }catch(e){ if(e && e.name === "AbortError") return; setShare("off", "That folder could not be opened. Pick the folder that holds this guide."); }
}
async function adopt(h, mode, force){
  let d = null; pendingPick = null;
  if(mode === "any" || h.name.toLowerCase() === "notes") d = h;
  else {
    d = await h.getDirectoryHandle("notes").catch(()=>null);
    if(!d){
      if(mode === "beside"){ setShare("off", "“" + h.name + "” has no notes folder inside it. Pick the folder that holds this guide."); return; }
      const holdsGuide = await h.getFileHandle(FILE_NAME).then(()=>true, ()=>false);
      if(!holdsGuide && !force){ pendingPick = h; setShare("confirm"); return; }
      d = await h.getDirectoryHandle("notes", {create:true});
    }
  }
  idb("readwrite", st=>st.put(d, DIR_KEY));
  await useDir(d);
}
async function ensureMarker(){
  if(markerOK || !dir) return; markerOK = true;
  try{ await dir.getFileHandle(MARKER_FILE); }
  catch(e){ try{ const fh = await dir.getFileHandle(MARKER_FILE, {create:true}), w = await fh.createWritable(); await w.write(MARKER); await w.close(); }catch(e2){} }
}
async function useDir(h){ dir = h; fileCache.clear(); mineDirty = true; markerOK = false; await sync(); }
async function reconnect(){ if(!dir) return; try{ const p = await dir.requestPermission({mode:"readwrite"}); if(p === "granted") await sync(); else setShare("need"); }catch(e){ setShare("need"); } }
function stopSharing(){ dir = null; pendingPick = null; fileCache.clear(); others.clear(); dirAuthors = new Map(); claimAsk = null; idb("readwrite", st=>st.delete(DIR_KEY)); pubSig = ""; setShare("off"); applyAll(); loadPublic(); }
function join(claimed){
  const el = $("ntName"), name = claimed && claimAsk ? claimAsk.name : ((el && el.value) || "").replace(/\s+/g, " ").trim(); if(!name) return;
  const id = slug(name) || ("p" + Math.random().toString(36).slice(2,8));
  if(!claimed && dirAuthors.has(id) && !(me && me.id === id)){ claimAsk = {id, name}; renderShare(); return; }
  me = {id, name}; writeMe(); claimAsk = null; mineDirty = true; sync();
}
async function writeMine(){
  if(!dir || !me) return;
  const data = {format:FORMAT, author:me, updated:now(), items:notes};
  const put = async (name, text) => { const fh = await dir.getFileHandle(name, {create:true}), w = await fh.createWritable(); await w.write(text); await w.close(); };
  await put(me.id + ".json", JSON.stringify(data, null, 1));
  await put(me.id + ".js", wrapNotes(data)).catch(()=>{});          // the copy that can be read without connecting
  mineDirty = false; localOnly = false;
}
/* people.js is the one file more than one person writes. It only lists names, every browser re-adds whoever is
   missing each time it syncs, so a lost update repairs itself. */
async function writePeople(found){
  if(!dir || !me) return;
  try{
    let cur = [];
    try{ const m = (await (await (await dir.getFileHandle(PEOPLE_FILE)).getFile()).text()).match(/__cpaGuidePeople\((\[[\s\S]*\])\);/); if(m) cur = JSON.parse(m[1]); }catch(e){}
    const map = new Map(); (Array.isArray(cur) ? cur : []).forEach(x=>{ const id = slug((x && x.id) || ""); if(id) map.set(id, String(x.name || id).slice(0, 80)); });
    found.forEach((o, id)=>map.set(id, o.name)); map.set(me.id, me.name);
    const list = Array.from(map, x=>({id:x[0], name:x[1]})).sort((a,b)=>a.id < b.id ? -1 : 1);
    if(JSON.stringify(list) !== JSON.stringify(cur)){ const fh = await dir.getFileHandle(PEOPLE_FILE, {create:true}), w = await fh.createWritable(); await w.write(wrapPeople(list)); await w.close(); }
  }catch(e){}
}
async function sync(){
  if(!dir || syncing) return; syncing = true;
  try{
    const found = new Map(), seenFiles = new Set(); let changed = false;
    for await (const entry of dir.entries()){
      const name = entry[0], h = entry[1]; if(h.kind !== "file") continue;
      if(!/\.json$/i.test(name)){ if(/\.js$/i.test(name)) seenFiles.add(name); continue; }
      seenFiles.add(name); let rec = fileCache.get(name);
      try{
        const f = await h.getFile(), sig = f.lastModified + ":" + f.size;
        if(!rec || rec.sig !== sig){ const data = parseShared(await f.text()); if(data){ rec = {sig, data}; fileCache.set(name, rec); changed = true; } }   // unreadable just now (half-synced): keep the last good copy
      }catch(e){}
      if(rec){ const a = rec.data.author; if(!found.has(a.id)) found.set(a.id, {name:a.name, at:-1, lists:[]}); const o = found.get(a.id); o.lists.push(rec.data.items); if(rec.data.updated > o.at){ o.at = rec.data.updated; o.name = a.name; } }
    }
    Array.from(fileCache.keys()).forEach(k=>{ if(!seenFiles.has(k)){ fileCache.delete(k); changed = true; } });
    pubSig = "";
    dirAuthors = found;
    if(!me){ syncing = false; setShare("name"); return; }
    const mineDisk = found.get(me.id), diskItems = mineDisk ? mineDisk.lists.reduce(merge, []) : [];
    const merged = merge(notes, diskItems);                       // my notes from another computer, or from a conflicted copy
    if(canon(merged) !== canon(notes)){ notes = merged; writeLocal(); changed = true; mineDirty = true; }
    const before = others.size; others.clear();
    found.forEach((o, id)=>{ if(id === me.id) return; const items = o.lists.reduce(merge, []); items.forEach(n=>owner.set(n, {id, name:o.name})); others.set(id, {name:o.name, items}); });
    if(others.size !== before) changed = true;
    if(mineDirty || !mineDisk) await writeMine();
    else if(!seenFiles.has(me.id + ".js")) await writeMine();          // a folder from before the readable copies existed
    await ensureMarker(); await writePeople(found);
    lastSync = now(); const first = share !== "on"; share = "on"; shareMsg = "";
    if(changed || first) applyAll();
    renderShare(); badges();
  }catch(e){ setShare(e && (e.name === "NotAllowedError" || e.name === "SecurityError") ? "need" : "error"); }
  finally{ syncing = false; }
}
$("ntShare").addEventListener("click", e=>{
  const b = e.target.closest && e.target.closest("button[data-s]"); if(!b) return; const a = b.dataset.s;
  if(a==="connect") connect("beside"); else if(a==="create") connect("create"); else if(a==="any") connect("any");
  else if(a==="force"){ if(pendingPick) adopt(pendingPick, "create", true).catch(()=>setShare("off", "The notes folder could not be created there.")); }
  else if(a==="reconnect") reconnect(); else if(a==="refresh") sync(); else if(a==="stop") stopSharing();
  else if(a==="join") join(false); else if(a==="claim") join(true); else if(a==="rename"){ claimAsk = null; renderShare(); const el = $("ntName"); if(el) el.focus(); }
});
$("ntShare").addEventListener("keydown", e=>{ if(e.key === "Enter" && e.target.id === "ntName" && !e.isComposing){ e.preventDefault(); join(false); } });
setInterval(()=>{ if(document.hidden) return; if(dir && (share === "on" || share === "error")) sync(); else if(!dir && share === "off") loadPublic(); }, POLL_MS);
document.addEventListener("visibilitychange", ()=>{ if(dir && !document.hidden && (share === "on" || share === "error")) sync(); });

/* ---------- events ---------- */
let selTimer = null;
document.addEventListener("selectionchange", ()=>{ clearTimeout(selTimer); selTimer = setTimeout(()=>{
  if(!pop.hidden) return;
  const info = selectionInfo(); pending = info;
  if(!info){ addBox.hidden = true; return; }
  addBox.hidden = false;
  const r = info.rect, w = addBox.offsetWidth;
  addBox.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width/2 - w/2)) + window.scrollX + "px";
  addBox.style.top = (r.bottom + window.scrollY + 8) + "px";
}, 140); });
addBox.addEventListener("mousedown", e=>e.preventDefault());
addBox.addEventListener("click", e=>{
  const b = e.target.closest && e.target.closest("button[data-k]"); if(!b) return;
  const info = pending || selectionInfo(); if(!info) return;
  const n = { id: uid(), sec: info.sec, q: info.q, pre: info.pre, suf: info.suf, ctx: info.ctx, c: "", t: now(), u: now() };
  if(b.dataset.k === "sug"){ n.k = "sug"; n.r = info.q.replace(/\s+/g, " ").trim(); } else n.col = lastColor;
  openEditor(n, true, info.rect);
});
function openFromMark(m){ const n = byId.get(m.dataset.note); if(!n) return false; if(isMine(n) && !repliesBy.has(n.id) && isOpen(n)) openEditor(n, false, m.getBoundingClientRect()); else openThread(n.id); return true; }
main.addEventListener("click", e=>{
  const m = e.target.closest && e.target.closest("mark.nt-hl, ins.nt-ins"); if(!m) return;
  if(e.target.closest("sup.cite")) return;
  if(window.getSelection && !window.getSelection().isCollapsed) return;
  if(openFromMark(m)){ e.preventDefault(); e.stopPropagation(); }
}, true);
main.addEventListener("keydown", e=>{ const m = e.target.closest && e.target.closest("mark.nt-hl, ins.nt-ins"); if(m && (e.key==="Enter" || e.key===" ")){ if(openFromMark(m)) e.preventDefault(); } });
$("ntColors").addEventListener("click", e=>{ const c = e.target.dataset && e.target.dataset.c; if(c) setColor(c); });
$("ntSave").addEventListener("click", saveEditor);
$("ntCancel").addEventListener("click", closeEditor);
$("ntDel").addEventListener("click", ()=>{ if(editing){ const id = editing.note.id; closeEditor(); removeItem(id); } });
pop.addEventListener("keydown", e=>{ if(e.isComposing) return; if((e.ctrlKey || e.metaKey) && e.key==="Enter"){ e.preventDefault(); saveEditor(); } });
document.addEventListener("keydown", e=>{ if(e.key==="Escape" && !e.isComposing){ if(!pop.hidden) closeEditor(); else if(!drawer.hidden) drawer.hidden = true; } });
fab.addEventListener("click", ()=>{ drawer.hidden = !drawer.hidden; if(!drawer.hidden){ renderShare(); renderList(); } else renderHint(); });
$("ntClose").addEventListener("click", ()=>{ drawer.hidden = true; renderHint(); });
hintEl.addEventListener("click", e=>{
  const b = e.target.closest && e.target.closest("button[data-s]"); if(!b) return; const a = b.dataset.s;
  if(a === "hide"){ hintOff = true; try{ sessionStorage.setItem("cpa-guide-hint-off", "1"); }catch(err){} renderHint(); return; }
  drawer.hidden = false; renderShare(); renderList();
  if(a === "connect") connect("beside"); else if(a === "reconnect") reconnect();
});
$("ntSearch").addEventListener("input", renderList);
$("ntWho").addEventListener("change", e=>{ viewWho = e.target.value; renderList(); });
$("ntShow").addEventListener("change", e=>{ viewShow = e.target.value; renderList(); });
$("ntAddSec").addEventListener("click", e=>{
  const on = document.querySelector(".side nav a.on, .topnav a.on"); const sec = on ? on.getAttribute("href").slice(1) : "top";
  openEditor({ id: uid(), sec: rootOf(sec) ? sec : "top", q: "", pre: "", suf: "", c: "", col: lastColor, t: now(), u: now() }, true, e.target.getBoundingClientRect());
});

/* ---------- export, import, save into the file ---------- */
function download(text, name, type){ const url = URL.createObjectURL(new Blob([text], {type})); const a = mk("a", {href:url, download:name}); document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url), 5000); }
const flat = s => String(s||"").replace(/\s+/g, " ").trim();
$("ntExportMd").addEventListener("click", ()=>{
  const order = roots().map(secOf); let md = "# Notes on the CPA program guide\n\nExported " + new Date().toLocaleString() + "\n"; let last = null;
  threads.slice().sort((a,b)=>(order.indexOf(a.sec)-order.indexOf(b.sec)) || ((a.t||0)-(b.t||0))).forEach(n=>{
    if(n.sec !== last){ last = n.sec; md += "\n## " + secTitle(n.sec) + "\n"; }
    const st = statusOf(n), stItem = statusBy.get(n.id);
    md += "\n" + (n.q ? "> " + flat(n.q) + "\n\n" : "") + (kind(n)==="sug" ? "**Suggested wording:** " + (n.r ? flat(n.r) : "(delete)") + "\n\n" : "") + (n.c ? n.c + "\n\n" : "");
    (repliesBy.get(n.id)||[]).forEach(r=>{ md += "- " + authorOf(r).name + ": " + flat(r.c) + " _(" + fmtDate(r.u||r.t) + ")_\n"; });
    md += "_" + authorOf(n).name + ", " + fmtDate(n.u||n.t) + (st !== "open" ? "; " + st + (stItem ? " by " + authorOf(stItem).name : "") : "") + "_\n";
  });
  download(md, "CPA-guide-notes.md", "text/markdown");
});
$("ntExportAcc").addEventListener("click", ()=>{
  const order = roots().map(secOf), acc = threads.filter(isPending).sort((a,b)=>(order.indexOf(a.sec)-order.indexOf(b.sec)) || ((a.t||0)-(b.t||0)));
  if(!acc.length){ $("ntStatus").textContent = "No accepted wording changes are waiting to go into the guide."; return; }
  let md = "# Accepted wording changes for the CPA program guide\n\nExported " + new Date().toLocaleString() + ". Apply these to the guide's sources, rebuild, and replace the shared file.\n";
  acc.forEach((n,i)=>{ const st = statusBy.get(n.id);
    md += "\n## " + (i+1) + ". " + secTitle(n.sec) + "\n\n- Original: \"" + flat(n.q) + "\"\n- Replace with: \"" + (n.r ? flat(n.r) : "") + "\"" + (n.r ? "" : " (delete the text)") + "\n- Found between: \"…" + flat(n.pre) + "\" and \"" + flat(n.suf) + "…\"\n- Suggested by " + authorOf(n).name + (st ? "; accepted by " + authorOf(st).name + " on " + fmtDate(st.u||st.t) : "") + "\n" + (n.c ? "- Reason: " + flat(n.c) + "\n" : "");
  });
  download(md, "CPA-guide-accepted-changes.md", "text/markdown");
});
$("ntExportJson").addEventListener("click", ()=>download(JSON.stringify(notes, null, 1), "CPA-guide-notes.json", "application/json"));
$("ntImport").addEventListener("click", ()=>$("ntFile").click());
$("ntFile").addEventListener("change", async e=>{
  const files = Array.from(e.target.files || []); let mineN = 0, people = 0, bad = 0;
  for(const f of files){
    try{
      const text = await f.text(), shared = parseShared(text);
      if(shared && !(me && shared.author.id === me.id)){ shared.items.forEach(n=>owner.set(n, shared.author)); others.set(shared.author.id, {name:shared.author.name, items:shared.items}); people++; }
      else { const v = shared ? shared.items : JSON.parse(text); if(Array.isArray(v)){ notes = merge(notes, v); mineN += v.filter(x=>x && !x.del).length; } else bad++; }
    }catch(err){ bad++; }
  }
  e.target.value = ""; if(mineN) commit(); applyAll(); renderShare();
  $("ntStatus").textContent = [mineN ? "Imported " + mineN + " of your own items." : "", people ? "Opened notes from " + people + (people===1 ? " person" : " people") + (dir ? "." : ", read-only.") : "", bad ? bad + (bad===1 ? " file was" : " files were") + " not notes files." : ""].filter(Boolean).join(" ");
});

function htmlWithNotes(){
  const base = window.__GUIDE_SOURCE; if(!base) return null;
  const json = JSON.stringify(notes).replace(/</g, "\\u003c");
  let hit = false;
  const out = base.replace(/(<script[^>]*id="guide-notes"[^>]*>)[\s\S]*?(<\/script>)/, (m, a, b) => { hit = true; return a + json + b; });
  return hit ? out : null;
}
function idb(mode, fn){ return new Promise(res=>{ try{ const rq = indexedDB.open("cpa-guide-notes", 1); rq.onupgradeneeded = () => rq.result.createObjectStore("kv"); rq.onerror = () => res(null); rq.onsuccess = () => { try{ const tx = rq.result.transaction("kv", mode), st = tx.objectStore("kv"), r = fn(st); tx.oncomplete = () => res(r && r.result); tx.onerror = () => res(null); }catch(e){ res(null); } }; }catch(e){ res(null); } }); }
async function saveToFile(silent){
  const html = htmlWithNotes(); const status = $("ntStatus");
  if(!html){ status.textContent = "Could not prepare the file. Use Backup .json instead."; return; }
  if(window.showSaveFilePicker){
    try{
      if(!fileHandle && !silent){ const h = await idb("readonly", st=>st.get("handle")); if(h && h.name === FILE_NAME) fileHandle = h; }
      if(fileHandle){ let p = await fileHandle.queryPermission({mode:"readwrite"}); if(p !== "granted" && !silent) p = await fileHandle.requestPermission({mode:"readwrite"}); if(p !== "granted"){ if(silent) return; fileHandle = null; } }
      if(!fileHandle){ if(silent) return; fileHandle = await window.showSaveFilePicker({ suggestedName: FILE_NAME, types: [{description:"HTML file", accept:{"text/html":[".html"]}}] }); idb("readwrite", st=>st.put(fileHandle, "handle")); }
      const w = await fileHandle.createWritable(); await w.write(html); await w.close();
      autoFile = true; fileDirty = false; badges(); return;
    }catch(err){ if(err && err.name === "AbortError") return; fileHandle = null; autoFile = false; if(silent){ badges(); return; } }
  }
  if(silent) return;
  download(html, FILE_NAME, "text/html"); fileDirty = false; badges();
  status.textContent = "Downloaded an updated copy with your notes inside. Replace the original file with it.";
}
$("ntSaveFile").addEventListener("click", ()=>saveToFile(false));

/* ---------- start ---------- */
const embedded = readEmbedded();
notes = merge(embedded, readLocal());
me = readMe();
fileDirty = canon(notes) !== canon(embedded);
writeLocal();
renderShare();
applyAll();
try{ hintOff = sessionStorage.getItem("cpa-guide-hint-off") === "1"; }catch(e){}
(function lookBeside(){                                            // a page may load a script from its own folder, even from a file
  const s = document.createElement("script"); s.src = "notes/" + MARKER_FILE;
  s.onload = () => { notesBeside = true; s.remove(); renderShare(); loadPublic(); };
  s.onerror = () => { notesBeside = false; s.remove(); renderShare(); };
  document.head.appendChild(s);
})();
if(window.showDirectoryPicker) idb("readonly", st=>st.get(DIR_KEY)).then(async h=>{
  if(!h || !h.queryPermission) return;
  dir = h;
  try{ if(await h.queryPermission({mode:"readwrite"}) === "granted"){ mineDirty = true; await sync(); } else setShare("need"); }catch(e){ setShare("need"); }
});
window.__guideNotes = { htmlWithNotes, all: () => notes, useDir, adopt, sync, loadPublic, state: () => ({share, me, people: Array.from(others.keys()), threads: threads.length, dir: dir && dir.name, notesBeside}) };
})();
