# -*- coding: utf-8 -*-
"""为新增的 12 个流派抓取 MET 公版作品图，增量写入 data/met-images.json。

策略沿用已验证的做法：
  - 画家类流派：按艺术家精确检索 + 校验 artistDisplayName 真的匹配
  - 地域/文化类流派：全文检索 + departmentId 限定 + classification 白名单
  - 每位画家/每个检索词限额，轮询取件以保证作者多样性
"""
import json, urllib.request, urllib.parse, time, os

UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36'}
BASE = 'https://collectionapi.metmuseum.org/public/collection/v1'
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'data', 'met-images.json')

# MET 部门 id：6=亚洲, 14=伊斯兰, 5=大洋洲与非洲美洲(Michael C. Rockefeller Wing),
# 11=欧洲绘画, 21=现当代, 9=素描与版画
ART_OK = ('painting', 'drawing', 'print', 'watercolor')

# 流派 -> 检索配置
# mode='artist'：(检索词, 用于校验 artistDisplayName 的关键词)
# mode='dept'  ：(检索词, departmentId)
PLAN = {
    # ---- A 类：地域 ----
    'indian-painting':   ('dept', [('Mughal painting', 6), ('Rajput painting', 6),
                                   ('Pahari', 6), ('Deccan painting', 6)]),
    'korean-painting':   ('dept', [('Korea painting', 6), ('Korean', 6)]),
    'buddhist-art-asia': ('dept', [('Gandhara Buddha', 6), ('Buddha Nepal', 6),
                                   ('Thailand Buddha', 6), ('Cambodia', 6), ('Java', 6)]),
    'oceanic-art':       ('dept', [('New Guinea', 5), ('Oceania', 5),
                                   ('Polynesia', 5), ('New Ireland', 5)]),
    'aboriginal-art':    ('dept', [('Australia Aboriginal', 5), ('Arnhem Land', 5)]),

    # ---- B 类：画家型流派 ----
    'spanish-golden-age': ('artist', [('Velázquez', 'vel'), ('Zurbarán', 'zurbar'),
                                      ('Ribera', 'ribera'), ('Murillo', 'murillo'),
                                      ('El Greco', 'greco'), ('Alonso Cano', 'cano')]),
    'flemish-baroque':    ('artist', [('Rubens', 'rubens'), ('Anthony van Dyck', 'dyck'),
                                      ('Jacob Jordaens', 'jordaens'), ('Frans Snyders', 'snyders'),
                                      ('Jan Brueghel', 'brueghel'), ('Adriaen Brouwer', 'brouwer')]),
    'hudson-river-school':('artist', [('Thomas Cole', 'cole'), ('Asher Brown Durand', 'durand'),
                                      ('Frederic Edwin Church', 'church'), ('Albert Bierstadt', 'bierstadt'),
                                      ('Thomas Moran', 'moran'), ('Fitz Henry Lane', 'lane'),
                                      ('Martin Johnson Heade', 'heade')]),
    'neue-sachlichkeit':  ('artist', [('Otto Dix', 'dix'), ('George Grosz', 'grosz'),
                                      ('Max Beckmann', 'beckmann'), ('Rudolf Schlichter', 'schlichter')]),
    'conceptual-art':     ('artist', [('Sol LeWitt', 'lewitt'), ('On Kawara', 'kawara'),
                                      ('Joseph Kosuth', 'kosuth'), ('Lawrence Weiner', 'weiner')]),
    'fluxus':             ('artist', [('George Maciunas', 'maciunas'), ('Nam June Paik', 'paik'),
                                      ('Yoko Ono', 'ono'), ('George Brecht', 'brecht')]),
    'neo-expressionism':  ('artist', [('Anselm Kiefer', 'kiefer'), ('Georg Baselitz', 'baselitz'),
                                      ('Jean-Michel Basquiat', 'basquiat'),
                                      ('Francesco Clemente', 'clemente'), ('Elizabeth Murray', 'murray')]),
}
PER_KEY = 3     # 每个检索词最多取几件
TARGET = 12     # 每个流派目标件数


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


def pack(o):
    img = o.get('primaryImageSmall') or o.get('primaryImage')
    if not img or not img.startswith('https://'):
        return None
    return {
        'id': o.get('objectID'),
        'title': o.get('title') or '无题',
        'artist': o.get('artistDisplayName') or (o.get('culture') or '佚名'),
        'date': o.get('objectDate') or '',
        'medium': (o.get('medium') or '')[:70],
        'img': img,
        'url': o.get('objectURL') or '',
    }


def by_artist(query, kw, limit):
    q = urllib.parse.quote(query)
    d = get(f'{BASE}/search?hasImages=true&isPublicDomain=true&artistOrCulture=true&q={q}')
    ids = (d or {}).get('objectIDs') or []
    if not ids:
        d = get(f'{BASE}/search?hasImages=true&isPublicDomain=true&q={q}')
        ids = (d or {}).get('objectIDs') or []
    out = []
    for oid in ids[:45]:
        if len(out) >= limit:
            break
        o = get(f'{BASE}/objects/{oid}')
        time.sleep(0.2)
        if not o:
            continue
        if kw not in (o.get('artistDisplayName') or '').lower():
            continue
        cls = (o.get('classification') or '').lower()
        objn = (o.get('objectName') or '').lower()
        if not any(k in cls or k in objn for k in ART_OK):
            continue
        w = pack(o)
        if w:
            out.append(w)
    return out


def by_dept(query, dept, limit):
    q = urllib.parse.quote(query)
    d = get(f'{BASE}/search?hasImages=true&isPublicDomain=true&departmentId={dept}&q={q}')
    ids = (d or {}).get('objectIDs') or []
    out = []
    for oid in ids[:45]:
        if len(out) >= limit:
            break
        o = get(f'{BASE}/objects/{oid}')
        time.sleep(0.2)
        if not o:
            continue
        w = pack(o)
        if w:
            out.append(w)
    return out


def main():
    with open(OUT, encoding='utf-8') as f:
        data = json.load(f)

    for sid, (mode, keys) in PLAN.items():
        print(f'\n[{sid}] mode={mode}', flush=True)
        buckets = []
        for key in keys:
            if mode == 'artist':
                got = by_artist(key[0], key[1], PER_KEY)
            else:
                got = by_dept(key[0], key[1], PER_KEY)
            print(f'   {str(key[0])[:28]:30s} -> {len(got)}', flush=True)
            buckets.append(got)

        picked, seen, i = [], set(), 0
        while len(picked) < TARGET and any(len(b) > i for b in buckets):
            for b in buckets:
                if i < len(b) and len(picked) < TARGET:
                    w = b[i]
                    if w['id'] not in seen:
                        seen.add(w['id']); picked.append(w)
            i += 1

        data[sid] = picked
        authors = len({w['artist'] for w in picked})
        print(f'   => {len(picked)} 件 / {authors} 位作者', flush=True)

    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)

    print('\n=== 汇总 ===')
    total = sum(len(v) for v in data.values())
    print(f'met-images.json 现有 {len(data)} 个流派 / {total} 张图')
    empty = [k for k, v in data.items() if not v]
    print('无图流派:', ', '.join(empty) if empty else '无')


if __name__ == '__main__':
    main()
