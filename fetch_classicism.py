# -*- coding: utf-8 -*-
"""为新增的 classicism 流派抓取 MET 公版作品图，增量写入 data/met-images.json。
沿用 fetch_met.py 的策略：按艺术家精确检索 + artistDisplayName 校验，每位画家限额轮询以保证多样性。"""
import json, urllib.request, urllib.parse, time, os

UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36'}
BASE = 'https://collectionapi.metmuseum.org/public/collection/v1'
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'data', 'met-images.json')

# (检索词, 用于校验 artistDisplayName 的关键词)
ARTISTS = [
    ('Poussin', 'poussin'),
    ('Claude Lorrain', 'claude'),
    ('Charles Le Brun', 'le brun'),
    ('Annibale Carracci', 'carracci'),
    ('Guido Reni', 'reni'),
    ('Philippe de Champaigne', 'champaigne'),
    ('Eustache Le Sueur', 'le sueur'),
    ('Sebastien Bourdon', 'bourdon'),
    ('Laurent de La Hyre', 'la hyre'),
]
PER_ARTIST = 3        # 每位画家最多取几件
TARGET = 12           # 该流派总目标件数
OK_CLASS = ('painting', 'drawing', 'print')


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


def fetch_artist(query, verify_kw, limit):
    """按艺术家检索，校验 artistDisplayName 真的匹配后返回作品。"""
    q = urllib.parse.quote(query)
    url = f'{BASE}/search?hasImages=true&isPublicDomain=true&artistOrCulture=true&q={q}'
    d = get(url)
    ids = (d or {}).get('objectIDs') or []
    if not ids:
        # 退回普通全文检索
        d = get(f'{BASE}/search?hasImages=true&isPublicDomain=true&q={q}')
        ids = (d or {}).get('objectIDs') or []
    out = []
    for oid in ids[:40]:
        if len(out) >= limit:
            break
        o = get(f'{BASE}/objects/{oid}')
        time.sleep(0.22)
        if not o:
            continue
        artist = (o.get('artistDisplayName') or '')
        if verify_kw not in artist.lower():
            continue
        cls = (o.get('classification') or '').lower()
        objn = (o.get('objectName') or '').lower()
        if not any(k in cls or k in objn for k in OK_CLASS):
            continue
        img = o.get('primaryImageSmall') or o.get('primaryImage')
        if not img or not img.startswith('https://'):
            continue
        out.append({
            'id': oid,
            'title': o.get('title') or '无题',
            'artist': artist,
            'date': o.get('objectDate') or '',
            'medium': (o.get('medium') or '')[:70],
            'img': img,
            'url': o.get('objectURL') or '',
        })
    return out


def main():
    with open(OUT, encoding='utf-8') as f:
        data = json.load(f)

    buckets = []
    for query, kw in ARTISTS:
        got = fetch_artist(query, kw, PER_ARTIST)
        print(f'  {query:24s} -> {len(got)} 件', flush=True)
        buckets.append(got)

    # 轮询取件，避免单一作者霸榜
    picked, seen, i = [], set(), 0
    while len(picked) < TARGET and any(len(b) > i for b in buckets):
        for b in buckets:
            if i < len(b) and len(picked) < TARGET:
                w = b[i]
                if w['id'] not in seen:
                    seen.add(w['id']); picked.append(w)
        i += 1

    data['classicism'] = picked
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)

    authors = sorted({w['artist'] for w in picked})
    print(f'\nclassicism: {len(picked)} 件 / {len(authors)} 位作者')
    for w in picked:
        print(f"   {w['artist'][:30]:32s} | {w['title'][:44]} | {w['date']}")
    print(f'\n已写入 {OUT}')


if __name__ == '__main__':
    main()
