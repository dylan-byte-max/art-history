# -*- coding: utf-8 -*-
"""修复版：1) 绘画类流派限定 classification 为画作类 2) 画家轮询取件保证多样性"""
import json, urllib.request, urllib.parse, time, os

UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36'}
BASE = 'https://collectionapi.metmuseum.org/public/collection/v1'
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'data', 'met-images.json')

def get(url, retries=3):
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode())
        except Exception:
            if i == retries - 1: return None
            time.sleep(1.2 * (i + 1))
    return None

# 只重抓有问题的流派
# mode: artist=按艺术家; culture=按文化; additional filter by classification keywords
PAINTING_CLS = ('painting', 'print', 'drawing', 'scroll', 'screen', 'fresco', 'watercolor', 'album')

TASKS = {
    # 中国绘画：必须限定为绘画/卷轴，排除瓷器织物
    'chinese-painting': {
        'terms': [('Chinese', 'culture')],
        'cls': ('painting', 'scroll', 'album', 'hanging scroll', 'handscroll', 'ink'),
        'extra': '&departmentId=6',
    },
    # 日本绘画：限定屏风/挂轴
    'japanese-painting': {
        'terms': [('Japanese', 'culture')],
        'cls': ('screen', 'painting', 'scroll', 'hanging scroll', 'album'),
        'extra': '&departmentId=6',
    },
    # 伊斯兰：限定手抄本/细密画
    'islamic-art': {
        'terms': [('Islamic', 'culture'), ('Iran', 'culture')],
        'cls': ('folio', 'painting', 'manuscript', 'calligraphy', 'illustrated', 'page', 'tile'),
        'extra': '&departmentId=14',
    },
    # 印象派：画家轮询
    'impressionism': {
        'terms': [('Monet','artist'),('Degas','artist'),('Renoir','artist'),('Pissarro','artist'),
                  ('Manet','artist'),('Morisot','artist'),('Cassatt','artist'),('Sisley','artist')],
        'cls': PAINTING_CLS, 'per': 2, 'extra': '',
    },
    'post-impressionism': {
        'terms': [('Van Gogh','artist'),('Cézanne','artist'),('Gauguin','artist'),
                  ('Toulouse-Lautrec','artist'),('Seurat','artist')],
        'cls': PAINTING_CLS, 'per': 2, 'extra': '',
    },
    'baroque': {
        'terms': [('Caravaggio','artist'),('Rubens','artist'),('Velázquez','artist'),
                  ('Poussin','artist'),('Georges de La Tour','artist'),('Guido Reni','artist')],
        'cls': PAINTING_CLS, 'per': 2, 'extra': '',
    },
    'dutch-golden-age': {
        'terms': [('Rembrandt','artist'),('Vermeer','artist'),('Frans Hals','artist'),
                  ('Jacob van Ruisdael','artist'),('Jan Steen','artist'),('Gerard ter Borch','artist')],
        'cls': PAINTING_CLS, 'per': 2, 'extra': '',
    },
    'romanticism': {
        'terms': [('Delacroix','artist'),('Goya','artist'),('Turner','artist'),
                  ('Géricault','artist'),('Constable','artist'),('Friedrich','artist')],
        'cls': PAINTING_CLS, 'per': 2, 'extra': '',
    },
    'ukiyo-e': {
        'terms': [('Hokusai','artist'),('Hiroshige','artist'),('Utamaro','artist'),
                  ('Harunobu','artist'),('Kuniyoshi','artist'),('Sharaku','artist')],
        'cls': ('print','woodblock'), 'per': 2, 'extra': '',
    },
    'renaissance-early': {
        'terms': [('Botticelli','artist'),('Fra Angelico','artist'),('Piero della Francesca','artist'),
                  ('Ghirlandaio','artist'),('Mantegna','artist'),('Filippo Lippi','artist')],
        'cls': PAINTING_CLS, 'per': 2, 'extra': '',
    },
    'northern-renaissance': {
        'terms': [('Bruegel','artist'),('Van Eyck','artist'),('Rogier van der Weyden','artist'),
                  ('Dürer','artist'),('Memling','artist'),('Lucas Cranach','artist')],
        'cls': PAINTING_CLS, 'per': 2, 'extra': '',
    },
    'realism': {
        'terms': [('Courbet','artist'),('Millet','artist'),('Daumier','artist'),
                  ('Corot','artist'),('Rosa Bonheur','artist')],
        'cls': PAINTING_CLS, 'per': 2, 'extra': '',
    },
    'rococo': {
        'terms': [('Fragonard','artist'),('Boucher','artist'),('Watteau','artist'),
                  ('Chardin','artist'),('Vigée Le Brun','artist'),('Tiepolo','artist')],
        'cls': PAINTING_CLS, 'per': 2, 'extra': '',
    },
}

def verify_words(term):
    parts = [p for p in term.replace('-', ' ').split() if len(p) > 3]
    return [p.lower() for p in parts] or [term.lower()]

def search_ids(term, mode, extra=''):
    q = urllib.parse.quote(term)
    base = f'{BASE}/search?hasImages=true&isPublicDomain=true&q={q}{extra}'
    if mode in ('artist', 'culture'):
        base = f'{BASE}/search?artistOrCulture=true&hasImages=true&isPublicDomain=true&q={q}{extra}'
    d = get(base)
    return (d or {}).get('objectIDs') or []

def fetch(term, mode, cls_kw, per, extra):
    out, vw = [], verify_words(term)
    for oid in search_ids(term, mode, extra)[:26]:
        if len(out) >= per: break
        o = get(f'{BASE}/objects/{oid}')
        time.sleep(0.2)
        if not o: continue
        img = o.get('primaryImageSmall') or o.get('primaryImage') or ''
        if not img: continue
        cls = ((o.get('classification') or '') + ' ' + (o.get('objectName') or '')).lower()
        if cls_kw and not any(k in cls for k in cls_kw):
            continue
        hay = ((o.get('artistDisplayName') or '') + ' ' + (o.get('culture') or '')).lower()
        if mode in ('artist','culture') and not any(w in hay for w in vw):
            continue
        out.append({
            'objectID': o.get('objectID'), 'title': o.get('title') or '',
            'artist': o.get('artistDisplayName') or (o.get('culture') or ''),
            'date': o.get('objectDate') or '', 'medium': o.get('medium') or '',
            'dept': o.get('department') or '', 'img': img,
            'imgBig': o.get('primaryImage') or img, 'url': o.get('objectURL') or '',
            'tags': [t.get('term') for t in (o.get('tags') or [])][:6],
        })
    return out

data = json.load(open(OUT, encoding='utf-8')) if os.path.exists(OUT) else {}

for i,(sid, cfg) in enumerate(TASKS.items(), 1):
    per = cfg.get('per', 3)
    bucket, seen = [], set()
    for term, mode in cfg['terms']:
        for w in fetch(term, mode, cfg.get('cls'), per, cfg.get('extra','')):
            if w['objectID'] in seen: continue
            seen.add(w['objectID']); bucket.append(w)
        if len(bucket) >= 12: break
        time.sleep(0.2)
    if bucket:
        data[sid] = bucket
        artists = len(set(w['artist'] for w in bucket))
        print(f'[{i:2d}/{len(TASKS)}] {sid:22s} {len(bucket):2d} 件 / {artists} 位作者', flush=True)
    else:
        print(f'[{i:2d}/{len(TASKS)}] {sid:22s} 未获取，保留原数据', flush=True)

json.dump(data, open(OUT,'w',encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'\n完成，总计 {sum(len(v) for v in data.values())} 件')
