"""Render publication data and package the static website (standard library only)."""
from pathlib import Path
from html import escape
import json
import re
import shutil

root = Path(__file__).resolve().parents[1]
publications = json.loads((root / 'data/publications.json').read_text())
def external(url, label, cls=''):
    return f'<a class="{cls}" href="{escape(url, quote=True)}" target="_blank" rel="noopener noreferrer">{label} <span aria-hidden="true">↗</span></a>'
def publication(p, i):
    authors = escape(p['authors']).replace('Satyapriya Krishna', '<strong>Satyapriya Krishna</strong>')
    links = external(p['url'], 'Paper', 'paper-link')
    if p.get('resource'):
        links += external(p['resource']['url'], escape(p['resource']['label']), 'paper-link')
    short = f'<span class="paper-short">{escape(p["short"])}</span>' if p.get('short') else ''
    return f'''<article class="publication">
      <div class="publication-side"><span class="paper-number">{i:02d}</span>{short}<span class="paper-topic">{escape(p['topic'])}</span></div>
      <div class="publication-body"><p class="paper-venue">{escape(p['venue'])}</p><h3>{external(p['url'], escape(p['title']))}</h3><p class="paper-authors">{authors}</p><p class="paper-summary">{escape(p['summary'])}</p><div class="paper-links">{links}</div></div>
    </article>'''
featured = [p for p in publications if p.get('featured')]
further = [p for p in publications if not p.get('featured')]
rendered = '<div class="publication-list">' + ''.join(publication(p,i+1) for i,p in enumerate(featured)) + '</div>'
rendered += f'<details class="publication-details"><summary><span>More selected publications <span class="count">{len(further):02d}</span></span><span class="disclosure-symbol" aria-hidden="true">+</span></summary><div class="publication-list">'
rendered += ''.join(publication(p,i+len(featured)+1) for i,p in enumerate(further)) + '</div></details>'
index = root / 'index.html'
html = index.read_text()
start, end = '<!-- PUBLICATIONS START -->', '<!-- PUBLICATIONS END -->'
if '<!-- PUBLICATIONS -->' in html:
    html = html.replace('<!-- PUBLICATIONS -->', start + end)
assert html.count(start) == 1 and html.count(end) == 1, 'Publication markers must occur once'
html = re.sub(re.escape(start) + r'.*?' + re.escape(end), lambda _: start + '\n' + rendered + '\n' + end, html, flags=re.S)
index.write_text(html)

out = root / 'dist'
if out.exists():
    shutil.rmtree(out)
out.mkdir()
for name in ('index.html', 'resource.html', 'Satya_CV.pdf', 'CNAME', 'css', 'js', 'images', 'r.js'):
    source = root / name
    if source.is_dir():
        shutil.copytree(source, out / name)
    elif source.exists():
        shutil.copy2(source, out / name)
(out / '.nojekyll').touch()
print(f'Static site built successfully with {len(publications)} publications: dist/index.html')
