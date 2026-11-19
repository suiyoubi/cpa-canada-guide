/* Run in the browser on the freshly loaded guide (no interaction first). Collects the rendered content of
   every block that is empty in the file's own markup and posts it to the local test server as prerender.json. */
(async () => {
  const src = await (await fetch(location.pathname, { cache: "no-store" })).text();
  const doc = new DOMParser().parseFromString(src, "text/html");
  const blocks = {}, changed = [];
  doc.querySelectorAll("body [id]").forEach(s => {
    if (s.closest("script,noscript")) return;
    const live = document.getElementById(s.id); if (!live) return;
    const emptyInSource = s.hasAttribute("data-pre") || s.innerHTML.trim() === "";
    if (emptyInSource && live.innerHTML.trim() !== "") {
      const c = live.cloneNode(true);
      c.querySelectorAll("mark.nt-hl").forEach(m => m.replaceWith(...m.childNodes));   // drop note highlights
      c.querySelectorAll(".nt-ui, ins.nt-ins").forEach(n => n.remove());
      c.querySelectorAll("span.nt-keep").forEach(m => m.replaceWith(...m.childNodes));
      c.normalize();
      blocks[s.id] = c.innerHTML;
    } else if (!emptyInSource && s.innerHTML !== live.innerHTML) changed.push(s.id);
  });
  for (const id of Object.keys(blocks)) {                      // keep only the outermost captured block
    let p = document.getElementById(id).parentElement;
    while (p) { if (p.id && blocks[p.id] !== undefined) { delete blocks[id]; break; } p = p.parentElement; }
  }
  const leafChanged = changed.filter(id => {                   // differences not explained by a captured block
    const e = document.getElementById(id);
    if (Object.keys(blocks).some(b => e.contains(document.getElementById(b)) || document.getElementById(b).contains(e))) return false;
    return !changed.some(o => o !== id && e.contains(document.getElementById(o)));
  });
  const body = JSON.stringify({ sig: window.__GUIDE_SIG || "", blocks });
  const r = await fetch("/__save", { method: "POST", body });
  return { saved: await r.text(), n: Object.keys(blocks).length, bytes: body.length, sig: window.__GUIDE_SIG, leafChanged };
})()
