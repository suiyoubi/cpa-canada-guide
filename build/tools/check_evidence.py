#!/usr/bin/env python3
"""Re-check every citation in the guide against the live sources.

For each evidence entry in build/evidence.js this downloads the source (a web page or a PDF), turns it into
text, and confirms that the entry's locating phrase is still there and, for PDFs, still on the cited page.
Nothing in the guide is changed; the result is a report.

    python3 build/tools/check_evidence.py                 # check everything (downloads about 160 documents)
    python3 build/tools/check_evidence.py ON14 W7         # only these sources
    python3 build/tools/check_evidence.py --cached        # reuse downloads already in the cache folder

Downloads go to .evidence-cache/ next to the guide (ignored by git). PDF text needs either `pdftotext`
(poppler) on the PATH or, on a Mac, the helper built with:  swiftc build/tools/pdf2txt.swift -o build/tools/pdf2txt
"""
import sys, re, json, html, time, pathlib, subprocess, shutil, hashlib, concurrent.futures as cf

HERE = pathlib.Path(__file__).resolve().parent; BUILD = HERE.parent; ROOT = BUILD.parent
CACHE = ROOT / '.evidence-cache'; CACHE.mkdir(exist_ok=True)
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
BLOCK = r'(?:p|div|li|ul|ol|tr|td|th|table|h[1-6]|br|section|article|header|footer|nav|main|aside|blockquote|dd|dt|dl|figure|figcaption|summary|details|option|button|label|form|hr)'

def norm(s):
    s = s.replace('\xa0', ' ').replace('’', "'").replace('‘', "'").replace('“', '"').replace('”', '"').replace('–', '-').replace('—', '-')
    return re.sub(r'[ \t]+', ' ', s)

def page_text(raw):
    t = re.sub(r'(?is)<!--.*?-->', ' ', raw)
    t = re.sub(r'(?is)<(script|style|noscript|svg|template|head)\b.*?</\1\s*>', ' ', t)
    t = re.sub(r'(?i)</?' + BLOCK + r'\b[^>]*>', '\n', t)
    t = re.sub(r'(?s)<[^>]+>', '', t)
    t = html.unescape(t).replace('\xa0', ' ')
    t = re.sub(r'[ \t\r\f\v]+', ' ', t)
    return re.sub(r' *\n[ \n]*', '\n', t).strip() + '\n'

def pdf_text(pdf):
    helper = HERE / 'pdf2txt'
    if helper.exists():
        out = pdf.with_suffix('.txt'); subprocess.run([str(helper), str(pdf), str(out)], capture_output=True)
        return out.read_text(errors='replace') if out.exists() else ''
    if shutil.which('pdftotext'):
        r = subprocess.run(['pdftotext', '-layout', str(pdf), '-'], capture_output=True, text=True)
        return ''.join(f'\n\n=== PAGE {i+1} ===\n{p}' for i, p in enumerate(r.stdout.split('\f')) if p.strip() or i == 0)
    return ''

def fetch(url, cached):
    key = hashlib.sha1(url.encode()).hexdigest()[:16]; txt = CACHE / (key + '.txt')
    if cached and txt.exists(): return txt.read_text(errors='replace'), 'cached'
    raw = CACHE / (key + '.bin')
    for attempt in (1, 2, 3):                                        # sites sometimes answer with a temporary error page
        r = subprocess.run(['curl', '-sS', '-L', '--compressed', '--max-time', '90', '-A', UA, '-H', 'Accept-Language: en-CA,en;q=0.9,fr;q=0.8',
                            '-o', str(raw), '-w', '%{http_code}', url], capture_output=True, text=True)
        if raw.exists() and r.stdout.strip().isdigit() and int(r.stdout) < 400: break
        time.sleep(4 * attempt)
    else:
        return '', 'the site answered with an error (http %s); try again later' % (r.stdout.strip() or '?')
    if raw.read_bytes()[:4] == b'%PDF':
        pdf = CACHE / (key + '.pdf'); raw.replace(pdf); t = pdf_text(pdf)
        if not t: return '', 'PDF downloaded, but no PDF-to-text tool is available (see the note at the top of this script)'
    else:
        t = page_text(raw.read_text(errors='replace'))
    txt.write_text(t); return t, 'http ' + r.stdout

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]; cached = '--cached' in sys.argv
    data = (BUILD / 'data.js').read_text()
    src = {}
    for line in data[data.index('const SRC'):].split('\n};')[0].splitlines():
        m = re.match(r'\s*([A-Z]+[0-9]+):\{(.*)\},?\s*$', line)
        if m:
            u = re.search(r'\bu:"((?:[^"\\]|\\.)*)"', m.group(2)); src[m.group(1)] = u.group(1) if u else ''
    evid = json.loads(re.search(r'const EVID = (\{.*\});', (BUILD / 'evidence.js').read_text(), flags=re.S).group(1))
    todo = {k: e for k, e in evid.items() if (not args or e['s'] in args)}
    urls = sorted({e.get('u') or src[e['s']] for e in todo.values()})
    print(f'{len(todo)} evidence entries, {len(urls)} documents to read')
    with cf.ThreadPoolExecutor(6) as ex: texts = dict(zip(urls, ex.map(lambda u: fetch(u, cached), urls)))
    bad = 0; unread = set()
    for k, e in sorted(todo.items(), key=lambda x: (x[1]['s'], int(x[0][1:]))):
        url = e.get('u') or src[e['s']]; text, how = texts[url]
        if not text:
            if url not in unread: print(f'  could not read {e["s"]}: {url} ({how})'); unread.add(url)
            bad += 1; continue
        if not e.get('a'): continue                                   # evidence is a figure: nothing to match
        lines = [norm(x) for x in text.split('\n')]; a = norm(e['a']).strip()
        hits = [i for i, x in enumerate(lines) if a in x]
        if not hits and e.get('fig') is None:
            print(f'  {k} {e["s"]}: phrase no longer found: “{e["a"]}”'); bad += 1; continue
        if not hits: print(f'  {k} {e["s"]}: phrase by the figure no longer found: “{e["a"]}”'); bad += 1; continue
        if e.get('p'):
            pg = None; pages = set()
            for i, x in enumerate(lines):
                m = re.match(r'=== PAGE (\d+) ===', x)
                if m: pg = int(m.group(1))
                if i in hits: pages.add(pg)
            if e['p'] not in pages: print(f'  {k} {e["s"]}: “{e["a"]}” is now on page {sorted(p for p in pages if p)} (cited: {e["p"]})'); bad += 1
    print(f'{len(todo) - bad} of {len(todo)} entries confirmed' + ('' if not bad else f'; {bad} need attention'))
    return 1 if bad else 0

if __name__ == '__main__':
    sys.exit(main())
