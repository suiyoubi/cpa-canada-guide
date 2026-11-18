import sys, re, html
from html.parser import HTMLParser
class P(HTMLParser):
    def __init__(s):
        super().__init__(); s.out=[]; s.skip=0
    def handle_starttag(s,t,a):
        if t in('script','style','noscript','svg','nav','header','footer'): s.skip+=1
        if t in('p','br','div','li','tr','h1','h2','h3','h4','h5','td','th','section'): s.out.append('\n')
        if t in('h1','h2','h3','h4'): s.out.append('#'*int(t[1])+' ')
        if t=='li': s.out.append('- ')
        if t in('td','th'): s.out.append(' | ')
    def handle_endtag(s,t):
        if t in('script','style','noscript','svg','nav','header','footer'): s.skip=max(0,s.skip-1)
    def handle_data(s,d):
        if not s.skip: s.out.append(d)
p=P(); p.feed(open(sys.argv[1],encoding='utf-8',errors='replace').read())
t=''.join(p.out); t=html.unescape(t)
t=re.sub(r'[ \t\r\xa0]+',' ',t); t=re.sub(r'\n\s*\n+','\n',t)
print(t.strip())
