# -*- coding: utf-8 -*-
"""抓取 MET 公版作品图，按流派归档。策略：按艺术家/文化精确检索 + 姓名校验，避免全文搜索错配。"""
import json, urllib.request, urllib.parse, time, os, sys

UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36'}
BASE = 'https://collectionapi.metmuseum.org/public/collection/v1'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'met-images.json')

def get(url, retries=3, pause=1.2):
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode())
        except Exception:
            if i == retries - 1:
                return None
            time.sleep(pause * (i + 1))
    return None

# 流派 -> 检索关键词列表（艺术家名或文化名）。key 与 data 中的 id 一致
QUERIES = {
    'ancient-egypt':      [('Egyptian', 'culture')],
    'ancient-greece':     [('Greek', 'culture')],
    'ancient-rome':       [('Roman', 'culture')],
    'byzantine':          [('Byzantine', 'culture')],
    'romanesque':         [('Romanesque', 'free')],
    'gothic':             [('Gothic', 'free'), ('Giotto', 'artist')],
    'renaissance-early':  [('Botticelli', 'artist'), ('Fra Angelico', 'artist'), ('Piero della Francesca', 'artist'), ('Ghirlandaio', 'artist')],
    'northern-renaissance':[('Bruegel', 'artist'), ('Van Eyck', 'artist'), ('Rogier van der Weyden', 'artist'), ('Dürer', 'artist'), ('Hans Memling', 'artist')],
    'renaissance-high':   [('Raphael', 'artist'), ('Michelangelo', 'artist'), ('Andrea del Sarto', 'artist')],
    'venetian':           [('Titian', 'artist'), ('Veronese', 'artist'), ('Tintoretto', 'artist'), ('Giovanni Bellini', 'artist')],
    'mannerism':          [('El Greco', 'artist'), ('Bronzino', 'artist'), ('Parmigianino', 'artist')],
    'baroque':            [('Caravaggio', 'artist'), ('Rubens', 'artist'), ('Velázquez', 'artist'), ('Poussin', 'artist'), ('Guido Reni', 'artist')],
    'dutch-golden-age':   [('Rembrandt', 'artist'), ('Vermeer', 'artist'), ('Frans Hals', 'artist'), ('Jacob van Ruisdael', 'artist'), ('Jan Steen', 'artist')],
    'rococo':             [('Fragonard', 'artist'), ('Boucher', 'artist'), ('Watteau', 'artist'), ('Chardin', 'artist'), ('Vigée Le Brun', 'artist')],
    'neoclassicism':      [('Jacques Louis David', 'artist'), ('Ingres', 'artist'), ('Canova', 'artist')],
    'classicism':         [('Poussin', 'artist'), ('Claude Lorrain', 'artist'), ('Annibale Carracci', 'artist'), ('Guido Reni', 'artist'), ('Philippe de Champaigne', 'artist')],
    'romanticism':        [('Delacroix', 'artist'), ('Goya', 'artist'), ('Turner', 'artist'), ('Géricault', 'artist'), ('Constable', 'artist')],
    'academic-art':       [('Sargent', 'artist'), ('Bouguereau', 'artist'), ('Gérôme', 'artist'), ('Whistler', 'artist')],
    'realism':            [('Courbet', 'artist'), ('Millet', 'artist'), ('Daumier', 'artist'), ('Rosa Bonheur', 'artist'), ('Corot', 'artist')],
    'pre-raphaelite':     [('Burne-Jones', 'artist'), ('Rossetti', 'artist'), ('Millais', 'artist')],
    'impressionism':      [('Monet', 'artist'), ('Renoir', 'artist'), ('Degas', 'artist'), ('Pissarro', 'artist'), ('Manet', 'artist'), ('Morisot', 'artist'), ('Cassatt', 'artist')],
    'neo-impressionism':  [('Seurat', 'artist'), ('Signac', 'artist'), ('Cross', 'artist')],
    'post-impressionism': [('Van Gogh', 'artist'), ('Cézanne', 'artist'), ('Gauguin', 'artist'), ('Toulouse-Lautrec', 'artist')],
    'symbolism':          [('Redon', 'artist'), ('Moreau', 'artist'), ('Puvis de Chavannes', 'artist')],
    'art-nouveau':        [('Mucha', 'artist'), ('Tiffany', 'artist'), ('Klimt', 'artist')],
    'fauvism':            [('Matisse', 'artist'), ('Derain', 'artist'), ('Vlaminck', 'artist')],
    'expressionism':      [('Kirchner', 'artist'), ('Nolde', 'artist'), ('Kollwitz', 'artist'), ('Schiele', 'artist')],
    'cubism':             [('Picasso', 'artist'), ('Braque', 'artist'), ('Juan Gris', 'artist'), ('Léger', 'artist')],
    'futurism':           [('Balla', 'artist'), ('Severini', 'artist'), ('Boccioni', 'artist')],
    'dada':               [('Duchamp', 'artist'), ('Picabia', 'artist'), ('Schwitters', 'artist')],
    'abstract-art':       [('Kandinsky', 'artist'), ('Mondrian', 'artist'), ('Klee', 'artist')],
    'surrealism':         [('Dalí', 'artist'), ('Magritte', 'artist'), ('Max Ernst', 'artist'), ('Miró', 'artist')],
    'abstract-expressionism':[('Pollock', 'artist'), ('Rothko', 'artist'), ('de Kooning', 'artist')],
    'pop-art':            [('Warhol', 'artist'), ('Lichtenstein', 'artist')],
    'minimalism':         [('Agnes Martin', 'artist'), ('Sol LeWitt', 'artist'), ('Frank Stella', 'artist')],
    'contemporary':       [('Kentridge', 'artist'), ('Richter', 'artist'), ('Cindy Sherman', 'artist')],
    'chinese-painting':   [('Chinese', 'culture')],
    'japanese-painting':  [('Japanese screen', 'free'), ('Kano', 'artist'), ('Sotatsu', 'artist')],
    'ukiyo-e':            [('Hokusai', 'artist'), ('Hiroshige', 'artist'), ('Utamaro', 'artist'), ('Harunobu', 'artist'), ('Kuniyoshi', 'artist')],
    'islamic-art':        [('Islamic', 'culture'), ('Iran', 'culture')],
    'african-art':        [('Benin', 'culture'), ('Yoruba', 'culture'), ('African', 'culture')],
    'pre-columbian':      [('Maya', 'culture'), ('Peru', 'culture'), ('Mexico', 'culture')],
}

# 需要出现在 artistDisplayName/culture 中的校验词（小写）
def verify_words(term):
    parts = [p for p in term.replace('-', ' ').split() if len(p) > 3]
    return [p.lower() for p in parts] or [term.lower()]

def search(term, mode, limit_ids=14):
    q = urllib.parse.quote(term)
    if mode == 'artist':
        url = f'{BASE}/search?artistOrCulture=true&hasImages=true&isPublicDomain=true&q={q}'
    elif mode == 'culture':
        url = f'{BASE}/search?artistOrCulture=true&hasImages=true&isPublicDomain=true&q={q}'
    else:
        url = f'{BASE}/search?hasImages=true&isPublicDomain=true&q={q}'
    d = get(url)
    if not d or not d.get('objectIDs'):
        return []
    return d['objectIDs'][:limit_ids]

def pick(term, mode, want=3):
    """返回校验通过、带图的作品列表"""
    out = []
    vw = verify_words(term)
    for oid in search(term, mode):
        if len(out) >= want:
            break
        o = get(f'{BASE}/objects/{oid}')
        time.sleep(0.22)
        if not o:
            continue
        img = o.get('primaryImageSmall') or o.get('primaryImage') or ''
        if not img:
            continue
        hay = ((o.get('artistDisplayName') or '') + ' ' + (o.get('culture') or '') + ' ' +
               (o.get('objectName') or '') + ' ' + (o.get('title') or '') + ' ' +
               (o.get('department') or '') + ' ' + (o.get('period') or '')).lower()
        if mode in ('artist', 'culture') and not any(w in hay for w in vw):
            continue
        out.append({
            'objectID': o.get('objectID'),
            'title': o.get('title') or '',
            'artist': o.get('artistDisplayName') or (o.get('culture') or ''),
            'date': o.get('objectDate') or '',
            'medium': o.get('medium') or '',
            'dept': o.get('department') or '',
            'img': img,
            'imgBig': o.get('primaryImage') or img,
            'url': o.get('objectURL') or '',
            'tags': [t.get('term') for t in (o.get('tags') or [])][:6],
        })
    return out

result = {}
keys = list(QUERIES.keys())
for i, sid in enumerate(keys, 1):
    bucket = []
    seen = set()
    for term, mode in QUERIES[sid]:
        for w in pick(term, mode, want=3):
            if w['objectID'] in seen:
                continue
            seen.add(w['objectID'])
            bucket.append(w)
        if len(bucket) >= 9:
            break
        time.sleep(0.25)
    result[sid] = bucket
    print(f'[{i:2d}/{len(keys)}] {sid:24s} {len(bucket)} 件', flush=True)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=1)

total = sum(len(v) for v in result.values())
empty = [k for k, v in result.items() if not v]
print(f'\n总计 {total} 件，写入 {OUT}')
print(f'无图流派 ({len(empty)}): {empty}')
