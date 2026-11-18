import re, sys, pathlib
# usage: kw.py <regex> <max hits> <path or glob> ...
rx = re.compile(sys.argv[1], re.I)
mx = int(sys.argv[2])
files = []
for a in sys.argv[3:]:
    p = pathlib.Path(a)
    if p.is_dir(): files += sorted(p.rglob('*.txt'))
    elif p.exists(): files.append(p)
    else: files += sorted(pathlib.Path('.').glob(a))
n = 0
for f in files:
    try: t = re.sub(r'\s+', ' ', f.read_text(errors='replace'))
    except Exception: continue
    for m in rx.finditer(t):
        print(f'[{f.name}] …{t[max(0,m.start()-130):m.end()+170]}…')
        n += 1
        if n >= mx: sys.exit()
if not n: print('NO HIT')
