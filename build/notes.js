/* ================= study notes: highlight any passage and attach a comment =================
   Notes live in three places: memory, this browser's localStorage (automatic), and a JSON block
   inside the HTML file itself (written by "Save notes into this file"). */
(function(){
"use strict";
const main = document.querySelector("main"); if(!main) return;
const LS_KEY = "cpa-guide-notes-v1";
const DEFAULT_NAME = "CPA-Professional-Program-Guide.html";
const FILE_NAME = (function(){ try{ const n = decodeURIComponent(location.pathname.split("/").pop()||""); return /\.html?$/i.test(n) ? n : DEFAULT_NAME; }catch(e){ return DEFAULT_NAME; } })();
const COLORS = [["y","Yellow"],["g","Green"],["p","Pink"],["b","Blue"]];
const SKIP = "script,style,svg,button,select,option,textarea,input,.nt-ui,.sr";
const mk = (tag, attrs, html) => { const e=document.createElement(tag); if(attrs) for(const k in attrs){ if(k==="class") e.className=attrs[k]; else e.setAttribute(k,attrs[k]); } if(html!=null) e.innerHTML=html; return e; };
const esc = s => String(s).replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const now = () => Date.now();
const fmtDate = t => { try{ return new Date(t).toLocaleString(undefined,{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}); }catch(e){ return ""; } };

let notes = [];              // live notes and tombstones ({id, del:1, u})
let fileHandle = null, autoFile = false, fileDirty = false, storageOK = true;
let lastColor = "y", pending = null, editing = null, saveTimer = null, applyTimer = null;

/* ---------- storage ---------- */
function readEmbedded(){ try{ const v = JSON.parse(document.getElementById("guide-notes").textContent || "[]"); return Array.isArray(v) ? v : []; }catch(e){ return []; } }
function readLocal(){ try{ const v = JSON.parse(localStorage.getItem(LS_KEY) || "[]"); return Array.isArray(v) ? v : []; }catch(e){ storageOK = false; return []; } }
function writeLocal(){ try{ localStorage.setItem(LS_KEY, JSON.stringify(notes)); storageOK = true; }catch(e){ storageOK = false; } }
function merge(a, b){ const m = new Map(); a.concat(b).forEach(n=>{ if(!n || !n.id) return; const o = m.get(n.id); if(!o || (n.u||0) > (o.u||0)) m.set(n.id, n); }); return Array.from(m.values()); }
const live = () => notes.filter(n=>!n.del);
const canon = list => JSON.stringify(list.slice().sort((x,y)=>x.id<y.id?-1:1));

/* ---------- sections ---------- */
const mast = () => document.querySelector("header.mast");
const roots = () => [mast()].concat(Array.from(main.querySelectorAll("section[id]"))).filter(Boolean);
const rootOf = sec => sec==="top" ? mast() : document.getElementById(sec);
const secOf = root => root.matches("header.mast") ? "top" : root.id;
function secTitle(sec){
  if(sec==="top") return "Introduction";
  const r = rootOf(sec), h2 = r && r.querySelector("h2"); if(!h2) return sec;
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
  let best = -1, bestScore = -1, idx = full.indexOf(note.q);
  while(idx >= 0){
    const score = csuf(full.slice(Math.max(0, idx-40), idx), note.pre||"") + cpre(full.slice(idx+note.q.length, idx+note.q.length+40), note.suf||"");
    if(score > bestScore){ bestScore = score; best = idx; }
    idx = full.indexOf(note.q, idx+1);
  }
  return best < 0 ? null : { nodes, starts, start: best, end: best + note.q.length };
}
function wrap(note, loc){
  const marks = [];
  for(let i=0; i<loc.nodes.length; i++){
    const n = loc.nodes[i], ns = loc.starts[i], ne = ns + n.data.length;
    if(ne <= loc.start || ns >= loc.end) continue;
    const s = Math.max(loc.start, ns) - ns, e = Math.min(loc.end, ne) - ns; if(e <= s) continue;
    let t = n; if(e < t.data.length) t.splitText(e); if(s > 0) t = t.splitText(s);
    if(!t.data.trim()) continue;
    const m = mk("mark", {class:"nt-hl nt-"+(note.col||"y"), "data-note":note.id, tabindex:"0", role:"button"});
    t.parentNode.insertBefore(m, t); m.appendChild(t); marks.push(m);
  }
  decorate(note, marks);
}
function decorate(note, marks){
  marks = marks || Array.from(document.querySelectorAll('mark[data-note="'+note.id+'"]'));
  marks.forEach((m,i)=>{ m.className = "nt-hl nt-"+(note.col||"y") + (note.c && i===marks.length-1 ? " nt-has" : ""); m.setAttribute("aria-label", "Your note: " + (note.c ? note.c.slice(0,120) : "highlight")); m.title = note.c ? note.c.slice(0,300) : "Highlight (select to add a comment)"; });
}
function unwrap(id){
  document.querySelectorAll('mark[data-note="'+id+'"]').forEach(m=>{ const p = m.parentNode; while(m.firstChild) p.insertBefore(m.firstChild, m); p.removeChild(m); p.normalize(); });
}
const obs = new MutationObserver(()=>{ clearTimeout(applyTimer); applyTimer = setTimeout(applyAll, 160); });
function applyAll(){
  obs.disconnect();
  live().forEach(n=>{ if(!n.q || document.querySelector('mark[data-note="'+n.id+'"]')) return; const loc = locate(n); if(loc) wrap(n, loc); });
  obs.observe(main, {childList:true, subtree:true});
  renderList();
}

/* ---------- UI ---------- */
const addBtn = mk("button", {class:"nt-ui nt-add", type:"button", hidden:""}, "✎ Add note");
const fab = mk("button", {class:"nt-ui nt-fab", type:"button", "aria-haspopup":"dialog"}, 'My notes <b id="ntBadge">0</b><i id="ntDot" hidden title="Not yet saved into the file"></i>');
const pop = mk("div", {class:"nt-ui nt-pop", hidden:"", role:"dialog", "aria-label":"Note"},
  '<div class="nt-q" id="ntQ"></div>'+
  '<textarea id="ntText" rows="4" placeholder="Write your comment (optional)"></textarea>'+
  '<div class="nt-row"><div class="nt-colors" id="ntColors" role="group" aria-label="Highlight colour">'+COLORS.map(c=>'<button type="button" data-c="'+c[0]+'" class="nt-sw nt-'+c[0]+'" aria-label="'+c[1]+'"></button>').join("")+'</div>'+
  '<span class="nt-sp"></span><button type="button" class="nt-btn danger" id="ntDel">Delete</button><button type="button" class="nt-btn" id="ntCancel">Cancel</button><button type="button" class="nt-btn primary" id="ntSave">Save</button></div>'+
  '<div class="nt-hint">Ctrl or ⌘ + Enter saves · Esc closes</div>');
const drawer = mk("aside", {class:"nt-ui nt-drawer", hidden:"", "aria-label":"My notes"},
  '<div class="nt-dh"><b>My notes</b><span id="ntCount"></span><button type="button" id="ntClose" class="nt-x" aria-label="Close notes">×</button></div>'+
  '<div class="nt-actions"><button type="button" class="nt-btn primary" id="ntSaveFile">Save notes into this file</button><button type="button" class="nt-btn" id="ntAddSec">+ Section note</button><button type="button" class="nt-btn" id="ntExportMd">Export .md</button><button type="button" class="nt-btn" id="ntExportJson">Backup .json</button><button type="button" class="nt-btn" id="ntImport">Import</button></div>'+
  '<p class="nt-status" id="ntStatus" aria-live="polite"></p>'+
  '<input type="search" id="ntSearch" placeholder="Search your notes" aria-label="Search your notes">'+
  '<div class="nt-list" id="ntList"></div>'+
  '<p class="nt-help">Select any text in the guide and choose <b>Add note</b>. Click a highlight to edit it. Notes are kept in this browser as you type; use <b>Save notes into this file</b> so they travel with the HTML.</p>'+
  '<input type="file" id="ntFile" accept=".json,application/json" hidden>');
[addBtn, fab, pop, drawer].forEach(e=>document.body.appendChild(e));
const $ = id => document.getElementById(id);

function place(el, rect){
  el.hidden = false;
  const w = el.offsetWidth, h = el.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
  let left = rect ? rect.left : (vw - w)/2, top = rect ? rect.bottom + 8 : (vh - h)/2;
  if(top + h > vh - 8) top = rect ? Math.max(8, rect.top - h - 8) : 8;
  el.style.left = Math.max(8, Math.min(vw - w - 8, left)) + "px";
  el.style.top = Math.max(8, top) + "px";
}
function openEditor(note, isNew, rect){
  editing = {note, isNew}; addBtn.hidden = true;
  $("ntQ").textContent = note.q ? (note.q.length > 260 ? note.q.slice(0,260) + "…" : note.q) : "Note on: " + secTitle(note.sec);
  $("ntText").value = note.c || "";
  $("ntDel").hidden = isNew;
  setColor(note.col || lastColor);
  place(pop, rect);
  setTimeout(()=>$("ntText").focus(), 0);
}
function setColor(c){ if(editing) editing.col = c; Array.from($("ntColors").children).forEach(b=>b.setAttribute("aria-pressed", String(b.dataset.c===c))); }
function closeEditor(){ pop.hidden = true; editing = null; }
function saveEditor(){
  if(!editing) return;
  const n = editing.note; n.c = $("ntText").value.trim(); n.col = editing.col || n.col || "y"; n.u = now(); lastColor = n.col;
  if(editing.isNew){ if(!n.q && !n.c){ closeEditor(); return; } notes.push(n); try{ window.getSelection().removeAllRanges(); }catch(e){} }
  closeEditor(); commit(); applyAll(); decorate(n);
}
function removeNote(id){
  const i = notes.findIndex(n=>n.id===id); if(i < 0) return;
  unwrap(id); notes[i] = {id, del:1, u:now()}; commit(); renderList();
}
function commit(){ writeLocal(); fileDirty = true; badges(); if(autoFile && fileHandle){ clearTimeout(saveTimer); saveTimer = setTimeout(()=>saveToFile(true), 1200); } }
function badges(){
  const n = live().length; $("ntBadge").textContent = n; $("ntDot").hidden = !(fileDirty && n >= 0 && (n > 0 || notes.length > 0));
  $("ntCount").textContent = n + (n===1 ? " note" : " notes");
  const fs = !!window.showSaveFilePicker, parts = [];
  parts.push(storageOK ? "Kept in this browser automatically." : "This browser is not keeping notes between visits, so save them into the file.");
  if(autoFile) parts.push(fileDirty ? "Writing to the file…" : "Saved into the file; further changes are written automatically.");
  else if(fileDirty && notes.length) parts.push(fs ? "Not yet saved into the file." : "Not yet in the file: your browser cannot overwrite it, so Save downloads an updated copy to put in place of the original.");
  else if(notes.length) parts.push("The file contains all your notes.");
  $("ntStatus").textContent = parts.join(" ");
}
function renderList(){
  const list = $("ntList"); if(!list) return; const term = ($("ntSearch").value||"").trim().toLowerCase();
  const order = roots().map(secOf);
  const items = live().filter(n=>!term || (n.q||"").toLowerCase().includes(term) || (n.c||"").toLowerCase().includes(term))
    .sort((a,b)=>(order.indexOf(a.sec)-order.indexOf(b.sec)) || ((a.t||0)-(b.t||0)));
  list.textContent = "";
  if(!items.length){ list.appendChild(mk("p", {class:"nt-empty"}, term ? "No notes match your search." : "No notes yet. Select a sentence in the guide to start.")); badges(); return; }
  let lastSec = null;
  items.forEach(n=>{
    if(n.sec !== lastSec){ lastSec = n.sec; list.appendChild(mk("h5", null, esc(secTitle(n.sec)))); }
    const shown = !n.q || !!document.querySelector('mark[data-note="'+n.id+'"]');
    const it = mk("div", {class:"nt-item nt-"+(n.col||"y")},
      (n.q ? '<blockquote>'+esc(n.q.length>220 ? n.q.slice(0,220)+"…" : n.q)+'</blockquote>' : '<blockquote class="sec">Section note</blockquote>')+
      (n.c ? '<p>'+esc(n.c)+'</p>' : "")+
      '<div class="nt-meta"><span>'+esc(fmtDate(n.u||n.t))+(shown ? "" : " · not in the current view")+'</span><span class="nt-sp"></span><button type="button" data-a="go">Go to</button><button type="button" data-a="edit">Edit</button><button type="button" data-a="del">Delete</button></div>');
    it.addEventListener("click", e=>{
      const a = e.target && e.target.dataset && e.target.dataset.a; if(!a) return;
      if(a==="go") goTo(n);
      if(a==="edit") openEditor(n, false, e.target.getBoundingClientRect());
      if(a==="del"){ if(e.target.dataset.sure){ removeNote(n.id); } else { e.target.dataset.sure = "1"; e.target.textContent = "Confirm delete"; setTimeout(()=>{ if(e.target.isConnected){ delete e.target.dataset.sure; e.target.textContent = "Delete"; } }, 3500); } }
    });
    list.appendChild(it);
  });
  badges();
}
function goTo(n){
  const show = () => { const m = document.querySelector('mark[data-note="'+n.id+'"]'), target = m || rootOf(n.sec); if(!target) return;
    target.scrollIntoView({block: m ? "center" : "start"}); if(m){ document.querySelectorAll('mark[data-note="'+n.id+'"]').forEach(x=>{ x.classList.add("nt-flash"); setTimeout(()=>x.classList.remove("nt-flash"), 1600); }); } };
  if(window.innerWidth < 900) drawer.hidden = true;
  if(n.q && !document.querySelector('mark[data-note="'+n.id+'"]') && n.ctx){
    const b = document.querySelectorAll("#"+n.ctx.p+"track .step")[n.ctx.i]; if(b){ b.click(); setTimeout(()=>{ applyAll(); show(); }, 60); return; }
  }
  show();
}

/* ---------- events ---------- */
let selTimer = null;
document.addEventListener("selectionchange", ()=>{ clearTimeout(selTimer); selTimer = setTimeout(()=>{
  if(!pop.hidden) return;
  const info = selectionInfo(); pending = info;
  if(!info){ addBtn.hidden = true; return; }
  addBtn.hidden = false;
  const r = info.rect, w = addBtn.offsetWidth;
  addBtn.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width/2 - w/2)) + window.scrollX + "px";
  addBtn.style.top = (r.bottom + window.scrollY + 8) + "px";
}, 140); });
addBtn.addEventListener("mousedown", e=>e.preventDefault());
addBtn.addEventListener("click", ()=>{
  const info = pending || selectionInfo(); if(!info) return;
  openEditor({ id: "n"+now().toString(36)+Math.random().toString(36).slice(2,6), sec: info.sec, q: info.q, pre: info.pre, suf: info.suf, ctx: info.ctx, c: "", col: lastColor, t: now(), u: now() }, true, info.rect);
});
main.addEventListener("click", e=>{
  const m = e.target.closest && e.target.closest("mark.nt-hl"); if(!m) return;
  if(window.getSelection && !window.getSelection().isCollapsed) return;
  const n = notes.find(x=>x.id===m.dataset.note); if(!n) return;
  e.preventDefault(); e.stopPropagation(); openEditor(n, false, m.getBoundingClientRect());
}, true);
main.addEventListener("keydown", e=>{ const m = e.target.closest && e.target.closest("mark.nt-hl"); if(m && (e.key==="Enter" || e.key===" ")){ e.preventDefault(); const n = notes.find(x=>x.id===m.dataset.note); if(n) openEditor(n, false, m.getBoundingClientRect()); } });
$("ntColors").addEventListener("click", e=>{ const c = e.target.dataset && e.target.dataset.c; if(c) setColor(c); });
$("ntSave").addEventListener("click", saveEditor);
$("ntCancel").addEventListener("click", closeEditor);
$("ntDel").addEventListener("click", ()=>{ if(editing){ const id = editing.note.id; closeEditor(); removeNote(id); } });
$("ntText").addEventListener("keydown", e=>{ if(e.isComposing) return; if((e.ctrlKey || e.metaKey) && e.key==="Enter"){ e.preventDefault(); saveEditor(); } });
document.addEventListener("keydown", e=>{ if(e.key==="Escape" && !e.isComposing){ if(!pop.hidden) closeEditor(); else if(!drawer.hidden) drawer.hidden = true; } });
fab.addEventListener("click", ()=>{ drawer.hidden = !drawer.hidden; if(!drawer.hidden) renderList(); });
$("ntClose").addEventListener("click", ()=>{ drawer.hidden = true; });
$("ntSearch").addEventListener("input", renderList);
$("ntAddSec").addEventListener("click", e=>{
  const on = document.querySelector(".side nav a.on, .topnav a.on"); const sec = on ? on.getAttribute("href").slice(1) : "top";
  openEditor({ id: "n"+now().toString(36)+Math.random().toString(36).slice(2,6), sec: rootOf(sec) ? sec : "top", q: "", pre: "", suf: "", c: "", col: lastColor, t: now(), u: now() }, true, e.target.getBoundingClientRect());
});

/* ---------- export, import, save into the file ---------- */
function download(text, name, type){ const url = URL.createObjectURL(new Blob([text], {type})); const a = mk("a", {href:url, download:name}); document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url), 5000); }
$("ntExportMd").addEventListener("click", ()=>{
  const order = roots().map(secOf); let md = "# My notes on the CPA program guide\n\nExported " + new Date().toLocaleString() + "\n"; let last = null;
  live().slice().sort((a,b)=>(order.indexOf(a.sec)-order.indexOf(b.sec)) || ((a.t||0)-(b.t||0))).forEach(n=>{
    if(n.sec !== last){ last = n.sec; md += "\n## " + secTitle(n.sec) + "\n"; }
    md += "\n" + (n.q ? "> " + n.q.replace(/\s+/g," ") + "\n\n" : "") + (n.c ? n.c + "\n\n" : "") + "_" + fmtDate(n.u||n.t) + "_\n";
  });
  download(md, "CPA-guide-notes.md", "text/markdown");
});
$("ntExportJson").addEventListener("click", ()=>download(JSON.stringify(notes, null, 1), "CPA-guide-notes.json", "application/json"));
$("ntImport").addEventListener("click", ()=>$("ntFile").click());
$("ntFile").addEventListener("change", e=>{ const f = e.target.files && e.target.files[0]; if(!f) return; const r = new FileReader(); r.onload = () => { try{ const v = JSON.parse(String(r.result)); if(Array.isArray(v)){ notes = merge(notes, v); commit(); applyAll(); $("ntStatus").textContent = "Imported " + v.filter(x=>x && !x.del).length + " notes."; } }catch(err){ $("ntStatus").textContent = "That file is not a notes backup."; } e.target.value = ""; }; r.readAsText(f); });

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
fileDirty = canon(notes) !== canon(embedded);
writeLocal();
applyAll();
window.__guideNotes = { htmlWithNotes, all: () => notes };
})();
