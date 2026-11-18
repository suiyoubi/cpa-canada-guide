import sys,re,html
from html.parser import HTMLParser
class T(HTMLParser):
    def __init__(s): super().__init__(); s.rows=[]; s.row=None; s.cell=None; s.tables=[]
    def handle_starttag(s,t,a):
        if t=='table': s.rows=[]
        if t=='tr': s.row=[]
        if t in('td','th'):
            s.cell=[]; s.span=dict(a).get('colspan')
    def handle_endtag(s,t):
        if t in('td','th') and s.cell is not None and s.row is not None:
            txt=re.sub(r'\s+',' ',html.unescape(''.join(s.cell))).strip()
            s.row.append(txt+(f' [colspan={s.span}]' if s.span else '')); s.cell=None
        if t=='tr' and s.row is not None: s.rows.append(s.row); s.row=None
        if t=='table': s.tables.append(s.rows); s.rows=[]
    def handle_data(s,d):
        if s.cell is not None: s.cell.append(d)
p=T(); p.feed(open(sys.argv[1],encoding='utf-8',errors='replace').read())
for i,t in enumerate(p.tables):
    print(f'--- table {i}')
    for r in t: print(' | '.join(c if c else '·' for c in r))
