"""Render publication data and package the static website (standard library only)."""
from pathlib import Path
from html import escape
import json
import hashlib
import re
import shutil

root = Path(__file__).resolve().parents[1]
publications = json.loads((root / 'data/publications.json').read_text())
quotes = json.loads((root / 'data/quotes.json').read_text())
tones = ('blue', 'green', 'ochre', 'plum', 'rust')
author_tones = {author: tones[i % len(tones)] for i, author in enumerate(dict.fromkeys(q['author'] for q in quotes))}

def quotation(q, i):
    text = q['text'].strip()
    phrase = q.get('highlight', '')
    assert phrase and text.count(phrase) == 1, 'Each quote needs one exact phrase for emphasis'
    before, after = text.split(phrase, 1)
    line = escape(before) + '<em>' + escape(phrase) + '</em>' + escape(after)
    hidden = ' hidden inert' if i else ''
    author = f'<a class="quote-author" href="{escape(q["source"], quote=True)}" target="_blank" rel="noopener noreferrer">— {escape(q["author"])}</a>'
    return f'<span class="opening-quote" data-tone="{author_tones[q["author"]]}"{hidden}>“{line}”{author}</span>'

def external(url, label, cls=''):
    return f'<a class="{cls}" href="{escape(url, quote=True)}" target="_blank" rel="noopener noreferrer">{label}</a>'
def publication(p, i):
    authors = escape(p['authors']).replace('Satyapriya Krishna', '<strong>Satyapriya Krishna</strong>')
    resource = external(p['resource']['url'], escape(p['resource']['label']), 'paper-resource') if p.get('resource') else ''
    return f'''<article class="publication">
      <h3>{external(p['url'], escape(p['title']))}</h3>
      <div class="paper-meta"><span>{escape(p['venue'])}</span>{resource}</div>
      <details class="paper-details"><summary>Details</summary><p class="paper-authors">{authors}</p><p class="paper-summary">{escape(p['summary'])}</p></details>
    </article>'''
featured = [p for p in publications if p.get('featured')]
further = [p for p in publications if not p.get('featured')]
ordered = featured + further
groups = [[ordered[(start + offset) % len(ordered)] for offset in range(4)]
          for start in range(0, len(ordered), 4)]
rendered = '<div class="paper-rotation" id="paper-rotation" aria-live="off">'
for i, group in enumerate(groups):
    hidden = ' hidden inert' if i else ''
    rendered += f'<div class="publication-list paper-set"{hidden}>'
    rendered += ''.join(publication(p,j+1) for j,p in enumerate(group)) + '</div>'
rendered += '</div>'
rendered += f'<details class="publication-details"><summary><span>All papers <span class="count">{len(ordered):02d}</span></span><span class="disclosure-symbol" aria-hidden="true">+</span></summary><div class="publication-list">'
rendered += ''.join(publication(p,i+1) for i,p in enumerate(ordered)) + '</div></details>'
index = root / 'index.html'
html = index.read_text()
start, end = '<!-- PUBLICATIONS START -->', '<!-- PUBLICATIONS END -->'
if '<!-- PUBLICATIONS -->' in html:
    html = html.replace('<!-- PUBLICATIONS -->', start + end)
assert html.count(start) == 1 and html.count(end) == 1, 'Publication markers must occur once'
html = re.sub(re.escape(start) + r'.*?' + re.escape(end), lambda _: start + '\n' + rendered + '\n' + end, html, flags=re.S)
start, end = '<!-- QUOTES START -->', '<!-- QUOTES END -->'
assert html.count(start) == 1 and html.count(end) == 1, 'Quote markers must occur once'
assert len({q['text'].casefold() for q in quotes}) == len(quotes), 'Quotes must be distinct'
assert all(q.get('author') and q.get('source', '').startswith('https://') for q in quotes), 'Every quote needs a named source'
rendered_quotes = '\n        '.join(quotation(q, i) for i,q in enumerate(quotes))
html = re.sub(re.escape(start) + r'.*?' + re.escape(end), lambda _: start + '\n        ' + rendered_quotes + '\n        ' + end, html, flags=re.S)
# Refresh edited local assets even when a previous preview is cached.
for asset in ('css/portfolio.css', 'js/explorer-world.js', 'js/opening-quotes.js', 'js/paper-rotation.js'):
    version = hashlib.sha256((root / asset).read_bytes()).hexdigest()[:10]
    html = re.sub(r'(["\'])' + re.escape(asset) + r'(?:\?v=[^"\']*)?(["\'])',
                  lambda m: m[1] + asset + '?v=' + version + m[2], html)
index.write_text(html)

out = root / 'dist'
if out.exists():
    shutil.rmtree(out)
out.mkdir()
for name in ('index.html', 'resource.html', 'Satya_CV.pdf', 'CNAME', 'css', 'js', 'images', 'data', 'r.js'):
    source = root / name
    if source.is_dir():
        shutil.copytree(source, out / name)
    elif source.exists():
        shutil.copy2(source, out / name)
(out / '.nojekyll').touch()
print(f'Static site built successfully with {len(publications)} publications and {len(quotes)} quotes: dist/index.html')
