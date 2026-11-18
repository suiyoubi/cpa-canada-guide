import re, sys, pathlib
src = pathlib.Path(sys.argv[1]); out = pathlib.Path(sys.argv[2])
css = (src/'style.css').read_text(); body=(src/'body.html').read_text(); data=(src/'data.js').read_text(); app=(src/'app.js').read_text()
notes_js=(src/'notes.js').read_text()
# keep any notes the reader has already saved into the existing file
saved='[]'
if out.exists():
    m0=re.search(r'<script type="application/json" id="guide-notes"[^>]*>([\s\S]*?)</script>', out.read_text())
    if m0 and m0.group(1).strip(): saved=m0.group(1).strip()
print('notes carried over from existing file:', saved.count('"id"'))
ids = set(re.findall(r'^\s*([A-Z]+[0-9]+):\{g:', data, flags=re.M))
# source details and the evidence registry (where in each source a citation is supported)
import json, html as _html
from urllib.parse import quote as _quote
SRCD = {}
for _line in data[data.index('const SRC'):].split('\n};')[0].splitlines():
    _m = re.match(r'\s*([A-Z]+[0-9]+):\{(.*)\},?\s*$', _line)
    if _m:
        _g = lambda k, b=_m.group(2): (re.search(r'\b' + k + r':"((?:[^"\\]|\\.)*)"', b) or [None, ''])[1]
        SRCD[_m.group(1)] = {'u': _g('u'), 'org': _g('org'), 't': _g('t'), 'sec': 'sec:1' in _m.group(2)}
evjs = (src/'evidence.js').read_text() if (src/'evidence.js').exists() else 'const EVID = {};\n'
EVID = json.loads(re.search(r'const EVID = (\{.*\});', evjs, flags=re.S).group(1))
CITE = r'\[\[([A-Za-z0-9:, ]+)\]\]'
def _enc(x): return _quote(x, safe='').replace('-', '%2D')
def deep(sid, e):
    u = (e or {}).get('u') or SRCD[sid]['u']
    if not e: return u
    if e.get('p'): return u.split('#')[0] + '#page=%d' % e['p']
    if e.get('a'): return u + ('' if '#' in u else '#') + ':~:text=' + (_enc(e['pre']) + '-,' if e.get('pre') else '') + _enc(e['a'])
    return u
def where(e):
    if not e: return ''
    return ('page %d' % e['p'] + (', ' if e.get('a') else '') if e.get('p') else '') + ('“' + e['a'] + '”' if e.get('a') else '') + ((' (in the figure by this text)' if e.get('a') else 'figure on the page') if e.get('fig') else '')
no_evidence = []
def split_cite(text):
    out = []
    for p in text.split(','):
        sid, _, eid = p.strip().partition(':')
        out.append((sid, eid))
    return out
def rep(m):
    out = []
    for sid, eid in split_cite(m.group(1)):
        if sid not in ids: print('UNKNOWN CITE in body:', sid); continue
        e = EVID.get(eid); s = SRCD[sid]
        if not e: no_evidence.append(sid)
        title = ('Not a CPA body source. ' if s['sec'] else '') + s['org'] + ': ' + s['t'] + (' · ' + where(e) if e else '')
        out.append('<a href="%s" target="_blank" rel="noopener" data-src="%s"%s%s title="%s">%s</a>' % (_html.escape(deep(sid, e), quote=True), sid, ' data-e="%s"' % eid if e else '', ' class="sec"' if s['sec'] else '', _html.escape(title, quote=True), sid))
    return '<sup class="cite">' + ''.join(out) + '</sup>'
body = re.sub(CITE, rep, body)
# check cites in data
for m in re.finditer(CITE, data + app):
    for sid, eid in split_cite(m.group(1)):
        if sid == 'B2' or (sid == 'A1' and 'B2' in m.group(1)): continue      # the syntax example in a code comment
        if sid not in ids: print('UNKNOWN CITE in data:', sid)
        elif eid not in EVID: no_evidence.append(sid)
if no_evidence: print('CITATIONS WITHOUT A LOCATED PASSAGE:', len(no_evidence), sorted(set(no_evidence))[:40])
bad_e = [k for k, e in EVID.items() if e.get('s') not in ids]
if bad_e: print('evidence entries pointing at unknown sources:', bad_e[:10])
used = set(sid for m in re.finditer(CITE, data+(src/'body.html').read_text()) for sid, _ in split_cite(m.group(1)))
unused = sorted(ids-used)
if unused: print('sources never cited:', unused)
body = body.replace('<b id="srcCount">50</b>', f'<b id="srcCount">{len(ids)}</b>')
# number sections in order of appearance and mirror the numbers in the side nav
order = re.findall(r'<section id="([^"]+)">', body)
num = {sid: f'{i+1:02d}' for i, sid in enumerate(order)}
def _h2(m): return f'<section id="{m.group(1)}">{m.group(2)}<h2><span class="n">{num[m.group(1)]}</span>'
body = re.sub(r'<section id="([^"]+)">(\s*)<h2><span class="n">\d+</span>', _h2, body)
def _nav(m): return f'<a href="#{m.group(1)}"><span class="n">{num.get(m.group(1), "00")}</span>'
body = re.sub(r'<a href="#([^"]+)"><span class="n">\d+</span>', _nav, body)
# Static copy of every block the script fills in, so the content is readable where scripts do not run
# (phone file previewers, mail attachments). prerender.json is captured from a browser: see tools/capture.js.
import hashlib
sig = hashlib.sha1((data+app+evjs+(src/'body.html').read_text()).encode()).hexdigest()
pre_file = src/'prerender.json'; baked = 0; body_static = body
if pre_file.exists():
    pre = json.loads(pre_file.read_text())
    if pre.get('sig') != sig:
        print('prerender.json is STALE (sources changed since capture): PHONE COPY NOT WRITTEN; capture again and rebuild')
    else:
        for cid, inner in pre['blocks'].items():
            pat = re.compile(r'<(\w+)([^>]*\bid="' + re.escape(cid) + r'"[^>]*)>\s*</\1>')
            m = pat.search(body_static)
            if not m: print('prerender: no empty container for', cid); continue
            body_static = body_static[:m.start()] + f'<{m.group(1)}{m.group(2)} data-pre>' + inner + f'</{m.group(1)}>' + body_static[m.end():]
            baked += 1
print('static blocks baked:', baked, '| signature', sig)
prelude = r"""/* Blocks marked data-pre hold a static copy of what the script draws. Empty them, draw the live version,
   and put the static copy back in any block the script did not fill (for example after an error). */
var __PRE = Array.prototype.slice.call(document.querySelectorAll("[data-pre]")).map(function(e){ var h = e.innerHTML; e.innerHTML = ""; return [e, h]; });
document.documentElement.className += " js";
window.__GUIDE_SIG = "%s";
try{
""" % sig
postlude = r"""
}catch(e){ if(window.console) console.error(e); }
finally{ __PRE.forEach(function(p){ if(!p[0].firstChild) p[0].innerHTML = p[1]; }); }
"""
capture = r"""window.__GUIDE_SOURCE = (function(){ try{ var own = function(e){ return e.hasAttribute && e.hasAttribute("data-own"); }; var pick = function(p){ return Array.prototype.filter.call(p.children, own).map(function(e){ return e.outerHTML; }).join("\n"); }; return "<!doctype html>\n<html lang=\"en\">\n<head>\n" + pick(document.head) + "\n</head>\n<body>\n" + pick(document.body) + "\n</body>\n</html>\n"; }catch(e){ return null; } })();"""
html = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" data-own>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" data-own>
<title data-own>CPA Professional Program Guide</title>
<meta name="description" data-own content="Guide to Canada's CPA certification programs: the current program (CPA PEP and the CFE) and the new CPA Professional Program from 2027, compared across Ontario, Quebec, the West and Atlantic Canada. Compiled Nov 17, 2026 from official CPA body sources.">
<link rel="preconnect" href="https://fonts.googleapis.com" data-own><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin data-own>
<link rel="stylesheet" data-own href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap">
<style data-own>
{css}
</style>
</head>
<body>
{body}
<script type="application/json" id="guide-notes" data-own>{saved}</script>
<script data-own>
/* Snapshot of this file's own markup, taken before anything renders, so notes can be written back into it. */
{capture}
{data}
{evjs}
{prelude}
{app}
{postlude}
{notes_js}
</script>
</body>
</html>
'''
out.write_text(html)
print('built', out, len(html), 'bytes;', len(ids), 'sources')

# ---- second file: the reading copy for phones. No scripts at all; everything is in the markup. ----
phone = out.with_name(out.stem + '-Phone.html')
if baked:
    bs = body_static
    a, b = bs.index('<noscript>'), bs.index('</noscript>') + len('</noscript>')
    bs = bs[:a] + '<p class="nojs"><b>Reading copy for phones.</b> Everything in the guide is on this page and needs no scripts. Region filters, the pathway finder and note-taking are only in the main file, <b>' + out.name + '</b>, opened in a browser on a computer.</p>' + bs[b:]
    tag = '<span class="tag">✎ Select any text to <b>add your own note</b></span>'
    assert tag in bs; bs = bs.replace(tag, '<span class="tag">Reading copy</span>')
    bs = bs.replace('aria-current="true"', 'aria-current="false"')
    head = html[:html.index('<body>')].replace('<html lang="en">', '<html lang="en" class="static">').replace('<title data-own>CPA Professional Program Guide</title>', '<title>CPA Program Guide, reading copy</title>')
    assert 'class="static"' in head and 'reading copy' in head
    phone_html = head + '<body>\n' + bs + '\n</body>\n</html>\n'
    assert '<script' not in phone_html
    phone.write_text(phone_html)
    print('built', phone, len(phone_html), 'bytes; static blocks', baked)
else:
    print('phone copy NOT rebuilt' + (' (existing one is now out of date)' if phone.exists() else ''))
