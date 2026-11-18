(function(){
"use strict";
const $ = (s,r=document)=>r.querySelector(s), $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
const el = (tag, attrs={}, html) => { const e=document.createElement(tag); for(const k in attrs){ if(k==="class") e.className=attrs[k]; else e.setAttribute(k,attrs[k]); } if(html!=null) e.innerHTML=html; return e; };
const RK = ["on","qc","we","at"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/* citations: a token names the source and, after a colon, the evidence entry that says where in the source
   the statement is supported. Each chip links straight to that place: a web page opens at the passage
   (text fragment), a PDF at the page. */
const EV = typeof EVID === "undefined" ? {} : EVID;
const attr = x => String(x).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const encT = x => encodeURIComponent(x).replace(/-/g,"%2D");
function deepLink(i, e){
  const u = (e && e.u) || SRC[i].u; if(!e) return u;
  if(e.p) return u.split("#")[0] + "#page=" + e.p;
  if(e.a) return u + (u.indexOf("#") < 0 ? "#" : "") + ":~:text=" + (e.pre ? encT(e.pre) + "-," : "") + encT(e.a);
  return u;
}
function where(e){ return !e ? "" : (e.p ? "page " + e.p + (e.a ? ", " : "") : "") + (e.a ? "“" + e.a + "”" : "") + (e.fig ? (e.a ? " (in the figure by this text)" : "figure on the page") : ""); }
function cite(s){
  return String(s).replace(/\[\[([A-Za-z0-9:, ]+)\]\]/g,(m,ids)=>'<sup class="cite">'+ids.split(",").map(x=>x.trim().split(":")).filter(x=>SRC[x[0]]).map(x=>{
    const i = x[0], e = EV[x[1]], s = SRC[i];
    return `<a href="${attr(deepLink(i,e))}" target="_blank" rel="noopener" data-src="${i}"${e?` data-e="${x[1]}"`:""}${s.sec?' class="sec"':""} title="${attr((s.sec?"Not a CPA body source. ":"")+s.org+": "+s.t+(e?" · "+where(e):""))}">${i}</a>`;
  }).join("")+"</sup>");
}
$$("[data-cite]").forEach(n=>{ n.innerHTML = cite(n.innerHTML); });
/* clicking a chip shows what is cited and where, with a link that opens the source at that place */
const cpop = el("div",{class:"citepop",hidden:"",role:"dialog","aria-label":"Source"}); document.body.appendChild(cpop);
document.addEventListener("click", e=>{
  const a = e.target.closest && e.target.closest("sup.cite a[data-src]");
  if(!a){ if(!cpop.hidden && !cpop.contains(e.target)) cpop.hidden = true; return; }
  if(e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
  e.preventDefault(); e.stopPropagation();
  const i = a.dataset.src, s = SRC[i], ev = EV[a.dataset.e];
  cpop.innerHTML = `<div class="cp-h"><span class="id">${i}</span><span>${attr(s.org)}</span><button type="button" class="cp-x" aria-label="Close">×</button></div><div class="cp-t">${attr(s.t)}</div>`+
    (ev ? `<div class="cp-q">${ev.p?`<b>Page ${ev.p}</b>`:""}${ev.a?`<q>${attr(ev.a)}</q>`:""}${ev.fig?`<i>${ev.a?"The detail is in the figure by this text.":"The detail is in a figure on the page."}</i>`:""}</div>` : `<div class="cp-q"><i>No passage recorded for this citation.</i></div>`)+
    (s.sec ? `<div class="cp-n">Not a CPA body source.</div>` : "")+
    `<div class="cp-a"><a class="btn primary" href="${attr(a.getAttribute("href"))}" target="_blank" rel="noopener">${ev&&ev.p?"Open the PDF at this page":ev&&ev.a?"Open the source at this passage":"Open the source"} ↗</a><a class="btn" href="#src-${i}">In the source list</a></div>`;
  cpop.hidden = false;
  const r = a.getBoundingClientRect(), w = cpop.offsetWidth, h = cpop.offsetHeight;
  cpop.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left)) + "px";
  cpop.style.top = (r.bottom + h + 12 > window.innerHeight ? Math.max(8, r.top - h - 8) : r.bottom + 8) + "px";
}, true);
cpop.addEventListener("click", e=>{ if(e.target.closest(".cp-x, .cp-a a")) cpop.hidden = true; });
document.addEventListener("keydown", e=>{ if(e.key === "Escape") cpop.hidden = true; });
window.addEventListener("scroll", ()=>{ cpop.hidden = true; }, {passive:true});

/* tooltip */
const tip = el("div",{class:"tip",hidden:""}); document.body.appendChild(tip);
function showTip(e, title, body){
  tip.textContent=""; const b=document.createElement("b"); b.textContent=title; tip.appendChild(b);
  if(body){ const s=document.createElement("span"); s.textContent=body; tip.appendChild(s); }
  tip.hidden=false;
  const r = e.target.getBoundingClientRect ? e.target.getBoundingClientRect() : {left:e.clientX,right:e.clientX,top:e.clientY,bottom:e.clientY};
  const x = (e.clientX!=null && e.clientX>0) ? e.clientX : (r.left+r.right)/2, y = (e.clientY!=null && e.clientY>0) ? e.clientY : r.top;
  const w = tip.offsetWidth, h = tip.offsetHeight;
  tip.style.left = Math.max(8, Math.min(window.innerWidth-w-8, x+12))+"px";
  tip.style.top = Math.max(8, (y-h-12 < 8 ? y+16 : y-h-12))+"px";
}
function hideTip(){ tip.hidden=true; }
function bindTip(node, title, body){
  node.addEventListener("pointermove",e=>showTip(e,title,body));
  node.addEventListener("pointerleave",hideTip);
  node.addEventListener("focus",e=>showTip(e,title,body));
  node.addEventListener("blur",hideTip);
}
window.addEventListener("scroll",hideTip,{passive:true});

/* ---------- nav highlight ---------- */
(function(){
  const links = $$("nav a[href^='#'], .topnav a[href^='#']");
  const map = {}; links.forEach(a=>{ (map[a.getAttribute("href").slice(1)] = map[a.getAttribute("href").slice(1)]||[]).push(a); });
  if(!("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver(es=>{
    es.forEach(en=>{ if(en.isIntersecting){ links.forEach(a=>a.classList.remove("on")); (map[en.target.id]||[]).forEach(a=>{ a.classList.add("on"); if(a.closest(".topnav")) a.scrollIntoView({block:"nearest",inline:"center"}); }); } });
  },{rootMargin:"-20% 0px -70% 0px"});
  $$("main section[id]").forEach(s=>io.observe(s));
})();

/* ---------- pathway (used for both programs) ---------- */
function mountPath(P, STEPS, startAt){
  const track = $("#"+P+"track"), detail = $("#"+P+"stepDetail"), prog = $("#"+P+"pathProg"), playBtn = $("#"+P+"pathPlay"), label=$("#"+P+"pathLabel");
  if(!track) return;
  let cur = startAt, timer = null;
  $$(".track,.exp-row", track.parentNode).forEach(n=>n.style.setProperty("--cols", STEPS.length));
  STEPS.forEach((s,i)=>{
    const b = el("button",{class:"step "+({gate:"gate",end:"end",cfe:"cfe"}[s.kind]||""), type:"button", "data-i":i, "aria-controls":P+"stepDetail"},
      `<span class="k">${s.k}</span><span class="t">${s.t}</span><span class="d">${s.d}</span>`+(s.ex?`<span class="ex${s.exSoft?" soft":""}">${s.ex}${s.exh?`<span>${s.exh}</span>`:""}</span>`:""));
    b.addEventListener("click",()=>{ stop(); select(i,true); });
    track.appendChild(b);
  });
  function select(i, user){
    cur = i;
    $$(".step",track).forEach((b,j)=>{ b.setAttribute("aria-current", j===i ? "true":"false"); b.classList.toggle("done", !!timer && j<i); });
    const s = STEPS[i];
    detail.innerHTML = `<div><span class="eyebrow">${s.k}</span><h4>${s.title}</h4><ul class="facts">${s.facts.map(f=>`<li>${cite(f)}</li>`).join("")}</ul></div>
      <div class="reg" aria-label="Regional notes">${RK.map(r=>`<div><span class="rg ${r}">${REG[r].name}</span>${cite(s.reg[r])}</div>`).join("")}</div>`;
    prog.style.width = ((i)/(STEPS.length-1)*100)+"%";
    label.textContent = `Step ${i+1} of ${STEPS.length}`;
  }
  function stop(){ if(timer){ clearInterval(timer); timer=null; playBtn.textContent="▶ Play walkthrough"; playBtn.setAttribute("aria-pressed","false"); $$(".step",track).forEach(b=>b.classList.remove("done")); } }
  function play(){
    if(timer){ stop(); return; }
    playBtn.textContent="❚❚ Pause"; playBtn.setAttribute("aria-pressed","true");
    select(0); timer = setInterval(()=>{ if(cur>=STEPS.length-1){ stop(); return; } select(cur+1); const b=$$(".step",track)[cur]; b.scrollIntoView({behavior:"smooth",block:"nearest",inline:"center"}); }, 4200);
    select(0);
  }
  playBtn.addEventListener("click",play);
  $("#"+P+"pathPrev").addEventListener("click",()=>{ stop(); select(Math.max(0,cur-1)); });
  $("#"+P+"pathNext").addEventListener("click",()=>{ stop(); select(Math.min(STEPS.length-1,cur+1)); });
  select(startAt);
  /* reading view (no scripts): every step written out, since the buttons above cannot be tapped */
  const all = $("#"+P+"stepAll");
  if(all) all.innerHTML = `<p class="static-h">All ${STEPS.length} steps</p>` + STEPS.map((s,i)=>`<div class="detail"><div><span class="eyebrow">Step ${i+1} · ${s.k}</span><h4>${s.title}</h4><ul class="facts">${s.facts.map(f=>`<li>${cite(f)}</li>`).join("")}</ul></div>
      <div class="reg" aria-label="Regional notes">${RK.map(r=>`<div><span class="rg ${r}">${REG[r].name}</span>${cite(s.reg[r])}</div>`).join("")}</div></div>`).join("");
}
mountPath("o", OLD_STEPS, 1);
mountPath("", STEPS, 1);

/* ---------- exam hours ---------- */
function mountHours(id, LIST){
  const box = $(id); if(!box) return;
  LIST.forEach(x=>{
    const total = x.h.reduce((a,b)=>a+b,0);
    box.appendChild(el("div",{class:"lb"},`<b>${x.n}</b><br><span style="color:var(--muted);font-size:12.5px">${x.fmt}</span>`));
    const bar = el("div",{class:"bar",role:"img","aria-label":`${x.n}: ${total} hours`});
    x.h.forEach((h,i)=>{ const seg = el("i",{class:i?"b":"",tabindex:"0",style:`width:${h/5*100}%`}); bindTip(seg, `${x.n}`, `${x.parts[i]}: ${h} hour${h>1?"s":""}`); bar.appendChild(seg); });
    box.appendChild(bar);
    box.appendChild(el("div",{class:"v"},total+" h"));
  });
}
mountHours("#oexamHours", OLD_EXAMS);
mountHours("#examHours", EXAMS);

/* ---------- allocation matrix ---------- */
(function(){
  const g = $("#alloc"); if(!g) return;
  g.appendChild(el("div",{class:"h"},"Topic area"));
  ALLOC_COLS.forEach(c=>g.appendChild(el("div",{class:"h"},`${c.n}<small>${c.s}</small>`)));
  AREAS.forEach((a,i)=>{
    g.appendChild(el("div",{class:"a"},a));
    ALLOC_COLS.forEach(c=>{
      const v = ALLOC[c.id][i];
      if(!v){ g.appendChild(el("div",{class:"c nil"},'<span>not listed</span>')); return; }
      const cell = el("div",{class:"c",tabindex:"0"},`<div class="rng"><i style="left:${Math.min(v[0]*2,97)}%;width:${Math.max((v[1]-v[0])*2,3)}%"></i></div><span>${v[0]===v[1]?v[0]+"%":v[0]+"–"+v[1]+"%"}</span>`);
      bindTip(cell, a, `${c.n}: ${v[0]===v[1]?v[0]+"%":v[0]+"% to "+v[1]+"%"} of the exam`);
      g.appendChild(cell);
    });
  });
})();

/* ---------- map + cards ---------- */
(function(){
  const map = $("#map"), cards = $("#cards"); if(!map) return;
  const T = [ ["YT","we","Yukon"],["NT","we","Northwest Territories"],["NU","we","Nunavut"],null,null,null,null,null,
              ["BC","we","British Columbia"],["AB","we","Alberta"],["SK","we","Saskatchewan"],["MB","we","Manitoba"],["ON","on","Ontario"],["QC","qc","Quebec"],null,["NL","at","Newfoundland and Labrador"],
              null,null,null,null,null,["NB","at","New Brunswick"],["PE","at","Prince Edward Island"],["NS","at","Nova Scotia"],
              null,null,null,null,null,null,null,["BM","at","Bermuda"] ];
  T.forEach(t=>{
    if(!t){ map.appendChild(el("span",{class:"sp"})); return; }
    const b = el("button",{type:"button",class:t[1],style:`--c:var(--${t[1]})`,"aria-label":`${t[2]}: ${REG[t[1]].body}`},t[0]);
    bindTip(b, t[2], REG[t[1]].body);
    b.addEventListener("click",()=>{ $$(".rcard",cards).forEach(c=>c.style.outline=""); const c=$("#card-"+t[1]); c.style.outline="2.5px solid var(--ink)"; c.scrollIntoView({behavior:"smooth",block:"nearest"}); $$("button",map).forEach(x=>x.classList.toggle("sel", x.classList.contains(t[1]))); });
    map.appendChild(b);
  });
  RK.forEach(r=>{ const c=CARDS[r]; cards.appendChild(el("article",{class:"rcard",id:"card-"+r,style:`--c:var(--${r})`},`<div><h4>${c.h}</h4><div class="who">${c.who}</div></div><ul>${c.li.map(x=>`<li>${cite(x)}</li>`).join("")}</ul>`)); });
})();

/* ---------- comparison matrix ---------- */
function mountMatrix(tId, diffId, regsId, MATRIX){
  const t = $(tId); if(!t) return;
  let onlyDiff = false; const vis = {on:true,qc:true,we:true,at:true};
  function render(){
    const cols = RK.filter(r=>vis[r]);
    let h = `<thead><tr><th scope="col">Topic</th>${cols.map(r=>`<th scope="col"><span class="rg ${r}">${REG[r].name}</span><small>${REG[r].body.split(" + ")[0]}</small></th>`).join("")}</tr></thead><tbody>`;
    let pending = null, any=false;
    MATRIX.forEach(row=>{
      if(row.g){ pending = `<tr class="grp"><th colspan="${cols.length+1}" scope="colgroup">${row.g}</th></tr>`; return; }
      if(onlyDiff && !row.d) return;
      if(pending){ h+=pending; pending=null; }
      any=true;
      h += `<tr class="${row.d?"diff":"same"}"><th scope="row"><span>${row.r}</span></th>${cols.map(r=>{ const v=row[r]; return (v&&v.tbd)?`<td class="tbd">${cite(v.t)}</td>`:`<td>${cite(v)}</td>`; }).join("")}</tr>`;
    });
    t.innerHTML = h+"</tbody>";
    t.style.minWidth = (220 + cols.length*200)+"px";
  }
  $(diffId).addEventListener("change",e=>{ onlyDiff=e.target.checked; render(); });
  $$(regsId+" button").forEach(b=>b.addEventListener("click",()=>{ const r=b.dataset.r; const on = b.getAttribute("aria-pressed")==="true"; if(on && RK.filter(k=>vis[k]).length===1) return; vis[r]=!on; b.setAttribute("aria-pressed", String(!on)); render(); }));
  render();
}
mountMatrix("#ocmp","#ocmpDiff","#ocmpRegs",OLD_MATRIX);
mountMatrix("#cmp","#cmpDiff","#cmpRegs",MATRIX);

/* ---------- timeline ---------- */
function mountTimeline(cfg){
  const host = $(cfg.host); if(!host) return; const OLD = cfg.mode==="old";
  const NS="http://www.w3.org/2000/svg";
  const S = (tag, a={}, txt)=>{ const e=document.createElementNS(NS,tag); for(const k in a) e.setAttribute(k,a[k]); if(txt!=null) e.textContent=txt; return e; };
  const D = s=>{ const p=s.split("-").map(Number); return Date.UTC(p[0],p[1]-1,p[2]); };
  const t0 = Date.UTC(2026,9,1), t1 = Date.UTC(2029,3,1), W=1120, L=214, R=10;
  const x = t => L + (t-t0)/(t1-t0)*(W-L-R);
  const fmt = s=>{ const p=s.split("-").map(Number); return `${MONTHS[p[1]-1]} ${p[2]}, ${p[0]}`; };
  const fmtS = s=>{ const p=s.split("-").map(Number); return `${MONTHS[p[1]-1]} ${p[2]}`; };
  let region = "we";
  function draw(){
    host.textContent="";
    const m = MODS[region];
    const rows = [];
    if(!OLD){
      rows.push({g:"New program · exam sittings (all regions)"});
      rows.push({n:"Exam sittings", exams:true});
      rows.push({g:`New program · modules (${REG[region].name})`});
      m.lanes.forEach(l=>rows.push({n:l.n, bars:l.b, soft:l.soft, sess:l.sess, kind:"new"}));
    }
    rows.push({g:OLD?`Current program · final offerings (${REG[region].name})`:"Current program · final offerings"});
    (LEGACY_PREP[region]&&OLD?[LEGACY_PREP[region]]:[]).concat(LEGACY_BASE).concat(LEGACY_PREP[region]&&!OLD?[LEGACY_PREP[region]]:[]).forEach(l=>rows.push({n:l.n, bars:l.b?[l.b]:[], marks:l.x, marklabels:l.xl, tip:l.tip, kind:"old"}));
    if(OLD && region==="on"){
      rows.push({g:"Ontario · dates on which CPA Ontario moves students to the new program"});
      rows.push({n:"Automatic transition", marks:ON_CUT.map(c=>c[0]), marklabels:ON_CUT.map(c=>c[1]), cut:true, tip:"Students who have not passed the named component by this date are transitioned by CPA Ontario (Regulation 9-4).", kind:"old"});
    }
    rows.push({g:OLD?"End of the program":"Transition"});
    rows.push({n:"Transition window", bars:[["2027-01-01","2028-12-31"]], kind:"win", tip:"Eligible candidates may move to the new program from Jan 1, 2027 to Dec 31, 2028. CPA PEP ends on Dec 31, 2028."});
    const top=46, rh=26, gh=24; let y=top; rows.forEach(r=>{ r.y=y; y += r.g?gh:rh; });
    const H = y+10;
    const svg = S("svg",{viewBox:`0 0 ${W} ${H}`, role:"img", "aria-label":`Timeline from October 2026 to March 2029 for ${REG[region].name}. The same dates are listed in the table below.`});
    // month grid
    for(let yy=2026, mm=9; !(yy===2029 && mm===3); ){
      const t = Date.UTC(yy,mm,1), xx = x(t), isJan = mm===0;
      svg.appendChild(S("line",{x1:xx,x2:xx,y1:top-8,y2:H-6,class:isJan?"gridy":"grid"}));
      const next = Date.UTC(mm===11?yy+1:yy,(mm+1)%12,1);
      svg.appendChild(S("text",{x:(xx+x(next))/2,y:top-12,"text-anchor":"middle",class:"mo"},MONTHS[mm][0]));
      if(isJan || (yy===2026&&mm===9)) svg.appendChild(S("text",{x:xx+4,y:14,class:"yr"},String(yy)));
      mm++; if(mm===12){ mm=0; yy++; }
    }
    const color = `var(--${region})`;
    rows.forEach(r=>{
      if(r.g){ svg.appendChild(S("text",{x:0,y:r.y+16,class:"grp"},r.g.toUpperCase())); svg.appendChild(S("line",{x1:0,x2:W,y1:r.y+gh-2,y2:r.y+gh-2,class:"grid"})); return; }
      const cy = r.y+rh/2;
      svg.appendChild(S("text",{x:8,y:cy+4,class:"lane"},r.n));
      if(r.exams){
        EXAM_DATES.forEach(e=>{
          const xx=x(D(e.d));
          const hit=S("rect",{x:xx-12,y:r.y,width:24,height:rh,class:"hit",tabindex:"0"}); bindTip(hit, e.ka?"Knowledge Assessment":"Exam sitting", e.n);
          svg.appendChild(hit);
          svg.appendChild(S("rect",{x:xx-5,y:cy-5,width:10,height:10,transform:`rotate(45 ${xx} ${cy})`,fill:e.ka?"var(--surface)":"var(--ink)",stroke:"var(--ink)","stroke-width":e.ka?1.5:0,class:"o"}));
          svg.appendChild(S("text",{x:xx+9,y:cy+4,class:"lbl"},fmtS(e.d)+(e.ka?" (KA)":"")));
        });
        return;
      }
      (r.bars||[]).forEach((b,i)=>{
        const xa=x(D(b[0])), xb=x(D(b[1])), w=Math.max(4,xb-xa-(r.sess?2:0));
        const fill = r.kind==="new"?color : r.kind==="win"?"var(--hl)" : "var(--legacy)";
        const hit=S("rect",{x:xa-2,y:r.y,width:w+4,height:rh,class:"hit",tabindex:"0"});
        const ttl = r.kind==="new" ? `${r.n}` : r.n;
        const body = r.tip ? r.tip : (r.sess ? `Session ${MONTHS[+b[0].slice(5,7)-1]} ${b[0].slice(0,4)} to ${MONTHS[+b[1].slice(5,7)-1]} ${b[1].slice(0,4)}` : `Starts ${fmt(b[0])} · ${region==="on"?"runs to about":"exam"} ${fmt(b[1])}`);
        bindTip(hit, ttl, body); svg.appendChild(hit);
        svg.appendChild(S("rect",{x:xa,y:cy-7,width:w,height:14,rx:4,fill:fill,stroke:r.kind==="win"?"var(--hl-ink)":"var(--surface)","stroke-width":r.kind==="win"?0.75:2,class:"o"}));
        if(((r.kind==="new" && !r.sess) || (OLD && r.kind==="old")) && i===0 && xa-L>44) svg.appendChild(S("text",{x:xa-5,y:cy+4,"text-anchor":"end",class:"lbl"},fmtS(b[0])));
        if(r.kind==="win") svg.appendChild(S("text",{x:(xa+xa+w)/2,y:cy+4,"text-anchor":"middle",class:"lbl",style:"fill:var(--hl-ink);font-weight:600"},"Jan 1, 2027 to Dec 31, 2028"));
      });
      (r.soft||[]).forEach(b=>{
        const xa=x(D(b[0])), xb=x(D(b[1]));
        const hit=S("rect",{x:xa,y:r.y,width:xb-xa,height:rh,class:"hit",tabindex:"0"}); bindTip(hit,r.n,b[2]); svg.appendChild(hit);
        svg.appendChild(S("rect",{x:xa,y:cy-6,width:xb-xa,height:12,rx:3,fill:"none",stroke:color,"stroke-width":1.5,"stroke-dasharray":"4 3",class:"o"}));
        svg.appendChild(S("text",{x:xb+6,y:cy+4,class:"lbl"},"winter 2028, date not published"));
      });
      (r.marks||[]).forEach((d,i)=>{
        const xx=x(D(d));
        const hit=S("rect",{x:xx-10,y:r.y,width:20,height:rh,class:"hit",tabindex:"0"}); bindTip(hit, r.cut ? `${fmt(d)}: ${r.marklabels[i]}` : r.n, r.cut ? (r.marklabels[i]==="All others" ? "Everyone still in the current program is transitioned by CPA Ontario on this date." : `Students who have not passed ${r.marklabels[i]} by this date are transitioned by CPA Ontario.`) : (r.tip||"")); svg.appendChild(hit);
        if(r.cut){ svg.appendChild(S("rect",{x:xx-1.5,y:cy-8,width:3,height:16,fill:"var(--pencil)",class:"o"})); svg.appendChild(S("text",{x:xx-6,y:cy+4,"text-anchor":"end",class:"lbl"},fmtS(d))); return; }
        svg.appendChild(S("circle",{cx:xx,cy:cy,r:5,fill:"var(--legacy)",stroke:"var(--surface)","stroke-width":2,class:"o"}));
        if(r.marklabels) svg.appendChild(S("text",{x:xx+9,y:cy+4,class:"lbl"},r.marklabels[i]));
      });
    });
    const tx = x(Date.UTC(2026,10,17));
    svg.appendChild(S("line",{x1:tx,x2:tx,y1:top-8,y2:H-6,class:"today"}));
    svg.appendChild(S("text",{x:tx+4,y:H-8,class:"todayt"},"Nov 17, 2026"));
    host.appendChild(svg);
    if(OLD){
      $(cfg.note).innerHTML = cite(LEGACY_NOTE[region]+" Hover or focus a bar for its dates.");
      $(cfg.legend).innerHTML = `<span><i style="--c:var(--legacy)"></i>Final offering of a module</span><span><i style="--c:var(--legacy);border-radius:50%"></i>Exam or CFE sitting</span>${region==="on"?'<span><i style="--c:var(--pencil);width:3px;border-radius:0"></i>Ontario automatic transition date</span>':""}<span><i style="--c:var(--hl)"></i>Transition window</span><span><i class="ln"></i>Date this guide was compiled</span>`;
    } else {
      $(cfg.note).innerHTML = cite(`${m.note} [[${m.src}]]`);
      $(cfg.note2).innerHTML = cite(LEGACY_NOTE[region]+" Hover or focus a bar for its dates.");
      $(cfg.legend).innerHTML = `<span><i style="--c:var(--${region})"></i>${REG[region].name}: new-program module offering</span><span><i class="dm" style="--c:var(--ink)"></i>Exam sitting</span><span><i style="--c:var(--legacy)"></i>Current program, final offering</span><span><i style="--c:var(--hl)"></i>Transition window</span><span><i class="ln"></i>Date this guide was compiled</span>`;
    }
  }
  $$(cfg.regs+" button").forEach(b=>b.addEventListener("click",()=>{ region=b.dataset.r; $$(cfg.regs+" button").forEach(o=>o.setAttribute("aria-pressed", String(o===b))); draw(); }));
  draw();
}
mountTimeline({host:"#otl", regs:"#otlRegs", note:"#otlNote", legend:"#otlLegend", mode:"old"});
mountTimeline({host:"#tl", regs:"#tlRegs", note:"#tlNote", note2:"#tlNote2", legend:"#tlLegend", mode:"new"});

/* ---------- dates table ---------- */
(function(){
  const tb = $("#datesBody"); if(!tb) return;
  let reg = "all", kind="all";
  const KN = {new:"New program", exam:"Exam", last:"Current program", win:"Transition"};
  function render(){
    tb.textContent="";
    DATES.slice().sort((a,b)=>a.d<b.d?-1:a.d>b.d?1:0).filter(d=>(reg==="all"||d.r.includes(reg))&&(kind==="all"||d.k===kind)).forEach(d=>{
      const tr = el("tr",{},`<td class="num mono" style="white-space:nowrap">${d.s}</td><td><span class="pill ${d.k==="new"?"new":d.k==="last"?"last":d.k==="win"?"win":""}">${KN[d.k]}</span></td><td>${d.r.length===4?'<span style="color:var(--muted)">All regions</span>':d.r.map(r=>`<span class="rg ${r}" style="font-weight:500;margin-right:8px">${REG[r].short}</span>`).join("")}</td><td>${cite(d.t)}</td>`);
      tb.appendChild(tr);
    });
    if(!tb.children.length) tb.appendChild(el("tr",{},`<td colspan="4" style="color:var(--muted)">No dated items for this combination.</td>`));
  }
  $("#dReg").addEventListener("change",e=>{ reg=e.target.value; render(); });
  $("#dKind").addEventListener("change",e=>{ kind=e.target.value; render(); });
  render();
})();

/* ---------- fees ---------- */
(function(){
  const box = $("#feeChart"); if(!box) return;
  const max = 3500;
  FEES.forEach(f=>{
    box.appendChild(el("div",{class:"lb"},f.n));
    const bar = el("div",{class:"bar",role:"img","aria-label":`${f.n}: module $${f.m.toLocaleString()}, exam $${f.e.toLocaleString()}`});
    const a = el("i",{tabindex:"0",style:`width:${f.m/max*100}%`}); bindTip(a,f.n,`Module fee: $${f.m.toLocaleString()}`);
    const b = el("i",{class:"b",tabindex:"0",style:`width:${f.e/max*100}%`}); bindTip(b,f.n,`Exam fee: $${f.e.toLocaleString()}`);
    bar.appendChild(a); bar.appendChild(b); box.appendChild(bar);
    box.appendChild(el("div",{class:"v mono",style:"text-align:right;font-weight:600"},"$"+(f.m+f.e).toLocaleString()));
  });
})();

/* ---------- current-program fees by stage ---------- */
(function(){
  const box = $("#ofeeChart"); if(!box) return;
  let region="we";
  function draw(){
    box.textContent=""; const F=OLD_FEES[region], max=2400; let total=0;
    F.s.forEach(([n,v])=>{ total+=v;
      box.appendChild(el("div",{class:"lb"},n));
      const bar = el("div",{class:"bar",role:"img","aria-label":`${n}: $${v.toLocaleString()}`});
      const a = el("i",{tabindex:"0",class:n.indexOf("CFE")===0?"b":"",style:`width:${v/max*100}%;border-radius:0 4px 4px 0`}); bindTip(a,n,`$${v.toLocaleString(undefined,{minimumFractionDigits:v%1?2:0})} (${F.tax})`);
      bar.appendChild(a); box.appendChild(bar);
      box.appendChild(el("div",{class:"v mono",style:"text-align:right;font-weight:600"},"$"+v.toLocaleString(undefined,{minimumFractionDigits:v%1?2:0})));
    });
    $("#ofeeNote").innerHTML = cite(`<b>${REG[region].name}:</b> six modules and the CFE come to <b>$${total.toLocaleString(undefined,{minimumFractionDigits:total%1?2:0,maximumFractionDigits:2})}</b> (${F.tax}; our sum of the published fees), before registration fees and annual dues. [[${F.src}]]`);
  }
  const feeAll = $("#ofeeAll");
  if(feeAll) feeAll.innerHTML = `<p class="static-h">All four regions</p>` + RK.filter(r=>OLD_FEES[r]).map(r=>{ const F=OLD_FEES[r]; const fmt=v=>"$"+v.toLocaleString("en-CA",{minimumFractionDigits:v%1?2:0,maximumFractionDigits:2});
    return `<p class="foot" style="margin-top:8px"><span class="rg ${r}">${REG[r].name}</span> ${F.s.map(([n,v])=>`${n} ${fmt(v)}`).join("; ")}. Total <b>${fmt(F.s.reduce((a,x)=>a+x[1],0))}</b> (${F.tax}; our sum).${cite(" [["+F.src+"]]")}</p>`; }).join("");
  $$("#ofeeRegs button").forEach(b=>b.addEventListener("click",()=>{ region=b.dataset.r; $$("#ofeeRegs button").forEach(o=>o.setAttribute("aria-pressed", String(o===b))); draw(); }));
  draw();
})();

/* ---------- transition matrix ---------- */
(function(){
  const t = $("#tx"); if(!t) return;
  let h = `<thead><tr><th scope="col" style="text-align:left;padding-left:12px">Already passed in the current program</th>${TX_COLS.map(c=>`<th scope="col" class="${c[2]}">${c[1]}</th>`).join("")}</tr></thead><tbody>`;
  TX_ROWS.forEach(r=>{
    h += `<tr><th scope="row">${r.n}</th>${TX_COLS.map(c=>{ const ex=r.x.includes(c[0]), cond=(r.c||[]).includes(c[0]); return `<td>${cond?'<b class="mk c" title="Exempt unless pursuing public accounting"></b><span class="sr"> exempt unless pursuing public accounting</span>':ex?'<b class="mk x" title="Exempt"></b><span class="sr"> exempt</span>':'<b class="mk r" title="Required"></b><span class="sr"> required</span>'}</td>`; }).join("")}</tr>`;
  });
  t.innerHTML = h+"</tbody>";
})();

/* ---------- finder ---------- */
(function(){
  const out = $("#fOut"); if(!out) return;
  const sReg=$("#fReg"), sSit=$("#fSit"), sLic=$("#fLic");
  SITS.forEach(s=>sSit.appendChild(el("option",{value:s.id},s.n)));
  function render(){
    const r=sReg.value, s=SITS.find(x=>x.id===sSit.value), lic=sLic.value==="y";
    let ex = s.x.slice(); const notes=[];
    if(lic){
      if(s.new) notes.push("For a public accounting licence choose <b>CPA Core – Licensure</b> and write the Licensure version of Final Exam 1; the 24 months of experience must be in a firm approved for it. [[N2:e124,W11:e258,ON5:e869]]");
      if(s.lic==="core"){ if(!(r==="qc" && s.id==="e2o")) ex = ex.filter(c=>c!=="CORE");   /* Quebec, two electives passed: the Order exempts the Core module itself */ notes.push(r==="qc" ? "Because you are aiming for the CPA auditor designation: with one elective passed, you must start at the Core module in the <b>Common + Public accountancy</b> path. With two electives passed, the Order’s transition page says you do not take the Core module but must still pass its exam. In both cases it asks you to confirm your transition plan with the Order. [[QC7:e870]]" : "Because you want a public accounting licence, the exemption does not cover <b>CPA Core – Licensure</b>: you must complete that module and write the Licensure version of Final Exam 1. [[W12:e871,W15:e806,A1:e872,ON14:e873]]"); }
      if(s.lic==="maybe") notes.push("Whether you are exempt from the Common or the Licensure version of CPA Core depends on the electives you completed (Tax and Assurance for Licensure). [[W12:e874]]");
      if(s.id==="d23"){ notes.push("The exemption from CPA Core – Licensure and Final Exam 1 applies if the CFE was passed in the Assurance role with depth in Financial Reporting and the Tax and Assurance electives are complete; otherwise the Licensure module and exam are still needed for a licence. [[W12:e875]]"); }
      if(s.id==="e2ta") notes.push("Write the <b>Licensure</b> version of Final Exam 1. [[W12:e876]]");
    }
    if(r==="qc" && s.new) notes.push("Quebec: entry is through a bachelor’s degree recognized by the Order or its equivalence process; as of Nov 18, 2026 the Order’s pages cited here did not describe a Knowledge Assessment route. Choose between the Order’s program and a university graduate program. [[QC1:e627,QC2:e602,QC5:e603]]");
    if(r==="on" && s.new) notes.push("Ontario: choose an online partner university (Rotman, Waterloo, Ivey) or an in-person accredited program; you stay with one provider for the education modules. [[ON2:e877]]");
    const req = ORDER.filter(c=>!ex.includes(c));
    const start = req[0];
    const title = !req.length ? "Education and exams complete" : `Start at: ${NAMES[start]}`;
    const dates = req.slice(0,4).map(c=>`<li><b>${NAMES[c]}</b>: ${FIRST[r][c]}</li>`).join("");
    out.innerHTML = `<div><span class="eyebrow"><span class="rg ${r}">${REG[r].name}</span></span><h4 style="margin-top:6px">${title}</h4></div>
      <div class="chain" aria-label="Program components">${ORDER.map(c=>`<span class="${["KA","FDE","P1","P2","P3"].includes(c)?"e":""} ${ex.includes(c)?"x":""}">${NAMES[c]}${ex.includes(c)?' <span class="sr">(exempt)</span>':""}</span>`).join("")}</div>
      <p data-c>${cite(lic && s.sayLic ? s.sayLic : s.say)}</p>
      ${notes.length?`<ul>${notes.map(n=>`<li>${cite(n)}</li>`).join("")}</ul>`:""}
      ${req.length?`<div><h4 style="font-size:14px;margin-bottom:6px">Earliest published dates for what remains</h4><ul>${dates}</ul><p class="foot">${cite(`First offerings as published. [[${FIRST[r].src}]]`)} All experience must be complete before Professional Readiness.</p></div>`:""}
      ${s.new?"":`<div class="note soft">${cite(REG_TX[r])}</div>`}
      <p class="foot">${cite(`This tool restates the published placement tables. In the West, candidates receive confirmation of their placement during the Transition Application; in Atlantic, a transition is not confirmed until the provincial body approves it; in Quebec, candidates must confirm their transition plan with the Order; in Ontario, CPA Ontario transitions students itself. [[W12:e936,A4:e729,QC7:e727,ON14:e884]]`)}</p>`;
  }
  [sReg,sSit,sLic].forEach(s=>s.addEventListener("change",render));
  render();
})();

/* ---------- old vs new, open items ---------- */
(function(){
  const b = $("#oldnewBody"); if(b) OLDNEW.forEach(r=>b.appendChild(el("tr",{},`<th scope="row" style="font-weight:600">${r[0]}</th><td>${cite(r[1])}</td><td>${cite(r[2])}</td>`)));
  const o = $("#openList"); if(o) OPEN.forEach(r=>o.appendChild(el("div",{class:"note soft"+(r[2]?" sec2":""),style:"max-width:none"},`<b>${r[0]}.</b> ${cite(r[1])}${r[2]?' <span class="pill last">includes a non-CPA source</span>':""}`)));
})();

/* ---------- universities: who can deliver what ---------- */
function mountCover(id, COLS, ROWS){
  const host = $(id); if(!host) return;
  const KEY = {u:["University","cv-u"], b:["CPA body","cv-b"], e:["Either","cv-e"], x:["To come","cv-x"]};
  let h = `<table class="cover"><thead><tr><th scope="col">Region</th>${COLS.map(c=>`<th scope="col" class="${c[1]==="e"?"ex":""}">${c[0]}</th>`).join("")}</tr></thead><tbody>`;
  ROWS.forEach(r=>{ h += `<tr><th scope="row"><span class="rg ${r.r}">${REG[r.r].name}</span>${r.sub?`<small>${r.sub}</small>`:""}</th>${r.c.map(v=>{ const k = KEY[v[0]]; return `<td class="${k[1]}" tabindex="0" data-t="${(v[1]||"").replace(/"/g,"&quot;")}"><b>${k[0]}</b>${v[2]?`<small>${v[2]}</small>`:""}</td>`; }).join("")}</tr>`; });
  host.innerHTML = h + "</tbody></table>";
  $$("td[data-t]", host).forEach(td=>{ if(td.dataset.t) bindTip(td, td.querySelector("b").textContent, td.dataset.t); });
}
mountCover("#ocover", OLD_COVER_COLS, OLD_COVER);
mountCover("#cover", NEW_COVER_COLS, NEW_COVER);

/* ---------- universities: program list ---------- */
function mountUni(tbodyId, regsId, field){
  const tb = $(tbodyId); if(!tb) return; let region = "all";
  function draw(){
    tb.textContent = "";
    UNIS.filter(u=>u[field] && (region==="all" || u.r===region)).forEach(u=>{
      tb.appendChild(el("tr", {}, `<td><span class="rg ${u.r}" style="font-weight:500">${REG[u.r].short}</span></td><th scope="row" style="font-weight:600">${u.n}</th><td>${u.url?`<a href="${u.url}" target="_blank" rel="noopener">${u.p}</a>`:u.p}</td><td>${cite(u[field])}</td>`));
    });
    if(!tb.children.length) tb.appendChild(el("tr", {}, `<td colspan="4" style="color:var(--muted)">No accredited graduate program is listed for this region.</td>`));
  }
  $$(regsId+" button").forEach(b=>b.addEventListener("click",()=>{ region=b.dataset.r; $$(regsId+" button").forEach(o=>o.setAttribute("aria-pressed", String(o===b))); draw(); }));
  draw();
}
mountUni("#ouniBody", "#ouniRegs", "cur");
mountUni("#uniBody", "#uniRegs", "nw");

/* ---------- example pathways (illustrative month-by-month lanes) ---------- */
function mountPaths(id, LIST){
  const host = $(id); if(!host) return;
  const NS="http://www.w3.org/2000/svg", S=(t,a,txt)=>{ const e=document.createElementNS(NS,t); for(const k in a) e.setAttribute(k,a[k]); if(txt!=null) e.textContent=txt; return e; };
  const W=1120, L=150, R=12, N=48, mw=(W-L-R)/N, x=m=>L+m*mw, FILL={uni:"var(--v1)", cpa:"var(--legacy)", work:"var(--exp)"};
  LIST.forEach(P=>{
    const box = el("div", {class:"pathx"}, `<div class="pathx-h"><h4>${P.t}</h4><p>${cite(P.d)}</p></div>`);
    const lanes = P.lanes, top=34, rh=30, H=top+lanes.length*rh+8;
    const svg = S("svg", {viewBox:`0 0 ${W} ${H}`, role:"img", "aria-label":P.t+": illustrative timeline over four years. "+(P.alt||"")});
    for(let m=0;m<=N;m++){ const yr=m%12===0; svg.appendChild(S("line",{x1:x(m),x2:x(m),y1:top-6,y2:H-4,class:yr?"gridy":"grid"})); if(m<N){ svg.appendChild(S("text",{x:x(m)+mw/2,y:top-10,"text-anchor":"middle",class:"mo"},"JFMAMJJASOND"[m%12])); if(yr) svg.appendChild(S("text",{x:x(m)+4,y:12,class:"yr"},"Year "+(m/12+1))); } }
    lanes.forEach((ln,i)=>{
      const cy = top+i*rh+rh/2; svg.appendChild(S("text",{x:6,y:cy+4,class:"lane"},ln.n));
      (ln.b||[]).forEach(b=>{
        const xa=x(b[0]), w=Math.max(6,x(b[1])-xa-2);
        const hit=S("rect",{x:xa,y:cy-rh/2,width:w,height:rh,class:"hit",tabindex:"0"}); bindTip(hit, b[3], b[4]||""); svg.appendChild(hit);
        svg.appendChild(S("rect",{x:xa,y:cy-9,width:w,height:18,rx:4,fill:FILL[b[2]],stroke:b[2]==="work"?"var(--exp-line)":"var(--surface)","stroke-width":b[2]==="work"?1:2,class:"o"}));
        const lab = w>b[3].length*6.3+10 ? b[3] : (b[5]||"");
        if(lab) svg.appendChild(S("text",{x:xa+6,y:cy+4,class:"pl "+(b[2]==="work"?"dk":"lt")}, lab));
      });
      (ln.x||[]).forEach(e=>{
        const xx=x(e[0])+mw/2; const hit=S("rect",{x:xx-11,y:cy-rh/2,width:22,height:rh,class:"hit",tabindex:"0"}); bindTip(hit, e[1], e[2]||""); svg.appendChild(hit);
        svg.appendChild(S("rect",{x:xx-5.5,y:cy-5.5,width:11,height:11,transform:`rotate(45 ${xx} ${cy})`,fill:"var(--ink)",stroke:"var(--surface)","stroke-width":2,class:"o"}));
        svg.appendChild(S("text",{x:xx+10,y:cy+4,class:"lbl"},e[1]));
      });
    });
    const sc = el("div", {class:"scroll tl"}); sc.appendChild(svg); box.appendChild(sc);
    if(P.f) box.appendChild(el("p", {class:"foot", style:"padding:0 16px 12px;margin:0"}, cite(P.f)));
    host.appendChild(box);
  });
}
mountPaths("#opaths", OLD_PATHS);
mountPaths("#paths", NEW_PATHS);
[["#ocoverNote","Module coverage for Ontario, the West and Atlantic follows CPA Canada’s national list of accredited programs (a 2023 snapshot); Quebec follows the Order. Outside Quebec, the graduate diploma rows on that list cover Core 1, Core 2 and two electives, and only master’s rows add Capstone 1 or both Capstones (our reading of the list). Hover or focus a cell for detail. [[N4:e878,ON24:e879,QC18:e880]] Prerequisite routes are from each body’s own pages: a recognized institution or the body’s preparatory courses in Ontario, the West and Atlantic, and the recognized bachelor’s degree in Quebec. [[ON19:e178,W27:e275,A11:e365,A14:e186,QC23:e898]] Lakehead and York say on their own pages that their diplomas cover all four electives. [[U31:e443,U16:e419]] For the West and Atlantic, the Capstone 2 and CFE cells also follow CPAWSB’s CFE page and CPA Atlantic’s CPA PEP page. [[W21:e376,A10:e910]]"],
 ["#coverNote","Ontario from Regulation 9-3 and CPA Ontario’s entry requirements. [[ON13:e881,ON9:e795]] Quebec from the Order. [[QC1:e175,QC3:e510,QC2:e602,QC5:e603]] West: CPAWSB says accredited programs “deliver part of the CPA Professional Program” and that their students “will receive advanced placement”, and its draft policies define an accredited program as excluding the Professional Final Exams. [[W20:e944,W18:e613,W11:e177]] Cells marked “To come” quote the draft policies’ section on advanced placement for accredited learners, which reads “To come”. [[W11:e614]] West qualifying courses and the Professional Readiness workshop are from CPAWSB’s pages. [[W18:e945,W19:e734,W5:e579]] Atlantic from CPA Atlantic’s program pages. [[A2:e504]] Hover or focus a cell for detail."],
 ["#ouniNote","Where a university’s current pages no longer describe the old program, coverage comes from CPA Canada’s 2023 list. Check with the university before relying on a row. [[N4:e882]]"],
 ["#uniNote","In Ontario, in-person graduates are exempt through the Foundational Development exam and enter at Exam 1, while online students still write CPA Ontario’s module exam. In Ontario and Quebec, every graduate still takes Professional Readiness and Exam 3 with the CPA body. [[ON13:e611,ON2:e601,QC3:e510,QC1:e175]]"],
 ["#opathsNote","Illustrations only. Module coverage and program lengths are from the cited sources. The CFE is a three-day examination, and the work bars run for the required practical experience: 30 months, or 24 in Quebec. [[W21:e29,W24:e9,QC9:e10]] The month-by-month layout and the experience end dates are our arithmetic."],
 ["#pathsNote","Illustrations only. Exam sittings follow the published September, January and May pattern. The end of each work bar, and the placing of Professional Readiness at the first offering after the 24 months are complete, are our arithmetic. [[W7:e251,ON4:e113,A3:e112,W18:e949]]"]
].forEach(function(r){ var n = $(r[0]); if(n) n.innerHTML = cite(r[1]); });

/* ---------- references ---------- */
(function(){
  const host = $("#refs"); if(!host) return;
  const groups = {}, passages = {};
  Object.keys(SRC).forEach(id=>{ const s=SRC[id]; (groups[s.g]=groups[s.g]||[]).push([id,s]); });
  Object.keys(EV).forEach(k=>{ const e = EV[k]; (passages[e.s] = passages[e.s] || []).push(e); });
  ["National program documents","Ontario","Quebec","West","Atlantic","University pages","Secondary sources"].forEach(g=>{
    if(!groups[g]) return;
    host.appendChild(el("h3",{},g+(g==="Secondary sources"||g==="University pages"?" (not official CPA documentation)":"")));
    groups[g].forEach(([id,s])=>{
      const list = (passages[id]||[]).slice().sort((a,b)=>(a.p||0)-(b.p||0));
      host.appendChild(el("div",{class:"ref"+(s.sec?" secondary":""),id:"src-"+id},`<span class="id">${id}</span><span class="ti">${s.org}. <a href="${s.u}" target="_blank" rel="noopener">${s.t}</a></span><span class="mt">${s.sec?(s.g==="University pages"?"UNIVERSITY PAGE, NOT A CPA SOURCE · ":"SECONDARY SOURCE · "):"Official · "}${s.up?s.up+" · ":""}accessed ${ACCESSED}${s.f?` · <a href="${s.f}">local copy</a>`:""}<br>${s.u}</span>`+
        (list.length ? `<details class="psg"><summary>${list.length} cited passage${list.length>1?"s":""}</summary><ul>${list.map(e=>`<li><a href="${attr(deepLink(id,e))}" target="_blank" rel="noopener">${e.p?"p. "+e.p:(e.fig&&!e.a?"figure":"open")}</a>${e.a?" “"+attr(e.a)+"”":""}${e.fig?" (figure)":""}</li>`).join("")}</ul></details>` : "")));
    });
  });
})();
})();
