# -*- coding: utf-8 -*-
"""修复亚洲部与伊斯兰部：改用全文检索 + departmentId + Paintings/Codices 分类过滤"""
import json, urllib.request, urllib.parse, time, os

UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36'}
BASE = 'https://collectionapi.metmuseum.org/public/collection/v1'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'met-images.json')

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

# 多组查询词扩大候选池；cls 用小写子串匹配 classification
TASKS = {
    'chinese-painting': {
        'queries': ['Chinese painting', 'hanging scroll China', 'handscroll Chinese',
                    'album leaf Chinese', 'Chinese ink landscape', 'bird flower painting China'],
        'dept': 6, 'cls': ('painting','calligraphy'), 'want': 10,
        'must_culture': ('china','chinese'),
    },
    'japanese-painting': {
        'queries': ['Japanese screen painting', 'Japanese hanging scroll', 'byobu screen',
                    'Japanese handscroll', 'Rimpa', 'Kano school'],
        'dept': 6, 'cls': ('painting','calligraphy'), 'want': 10,
        'must_culture': ('japan','japanese'),
    },
    'islamic-art': {
        'queries': ['folio from illustrated manuscript', 'Shahnama folio', 'Persian miniature painting',
                    'Mughal painting', 'Islamic calligraphy folio', 'Khamsa Nizami'],
        'dept': 14, 'cls': ('codices','painting','calligraphy','manuscript'), 'want': 10,
        'must_culture': None,
    },
}

def run(sid, cfg):
    bucket, seen = [], set()
    for q in cfg['queries']:
        if len(bucket) >= cfg['want']: break
        url = f"{BASE}/search?hasImages=true&isPublicDomain=true&departmentId={cfg['dept']}&q={urllib.parse.quote(q)}"
        d = get(url)
        ids = (d or {}).get('objectIDs') or []
        for oid in ids[:22]:
            if len(bucket) >= cfg['want']: break
            if oid in seen: continue
            o = get(f'{BASE}/objects/{oid}')
            time.sleep(0.2)
            if not o: continue
            img = o.get('primaryImageSmall') or o.get('primaryImage') or ''
            if not img: continue
            cls = (o.get('classification') or '').lower()
            if cfg['cls'] and not any(k in cls for k in cfg['cls']):
                continue
            if cfg['must_culture']:
                cu = ((o.get('culture') or '') + ' ' + (o.get('artistDisplayBio') or '')).lower()
                if not any(k in cu for k in cfg['must_culture']):
                    continue
            seen.add(oid)
            bucket.append({
                'objectID': oid, 'title': o.get('title') or '',
                'artist': o.get('artistDisplayName') or (o.get('culture') or ''),
                'date': o.get('objectDate') or '', 'medium': o.get('medium') or '',
                'dept': o.get('department') or '', 'img': img,
                'imgBig': o.get('primaryImage') or img, 'url': o.get('objectURL') or '',
                'tags': [t.get('term') for t in (o.get('tags') or [])][:6],
            })
        time.sleep(0.25)
    return bucket

data = json.load(open(OUT, encoding='utf-8'))
for sid, cfg in TASKS.items():
    b = run(sid, cfg)
    if b:
        data[sid] = b
        print(f'{sid:20s} {len(b):2d} 件')
        for w in b[:4]:
            print(f'     - {(w["artist"] or "?")[:24]:26s} {w["title"][:38]}')
    else:
        print(f'{sid:20s} 仍为空（保留原数据 {len(data.get(sid,[]))} 件）')

json.dump(data, open(OUT,'w',encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'\n总计 {sum(len(v) for v in data.values())} 件')
