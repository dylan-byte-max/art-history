# -*- coding: utf-8 -*-
"""修正两处抓图归类问题 + 为无公版图的 4 个现当代流派做好降级标记。

问题1 朝鲜半岛绘画：混进了 3 世纪鸟形陶器等非绘画器物 -> 加 classification 白名单
问题2 澳洲原住民艺术：抓到的是托雷斯海峡面具（大洋洲文化圈），不属澳洲大陆原住民绘画
      -> MET 几乎没有澳洲原住民「绘画」公版藏品，改为只保留确属澳洲的器物并明确标注，
         数量不足则留空由 SVG 示意图接管
"""
import json, urllib.request, urllib.parse, time, os

UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36'}
BASE = 'https://collectionapi.metmuseum.org/public/collection/v1'
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'data', 'met-images.json')

PAINT_OK = ('painting', 'hanging scroll', 'screen', 'album', 'handscroll',
            'drawing', 'print', 'folio', 'calligraphy')


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


def search_paintings(query, dept, limit, need_kw=None):
    """检索并只保留绘画类；need_kw 用于额外校验 culture/地理字段。"""
    q = urllib.parse.quote(query)
    d = get(f'{BASE}/search?hasImages=true&isPublicDomain=true&departmentId={dept}&q={q}')
    ids = (d or {}).get('objectIDs') or []
    out = []
    for oid in ids[:60]:
        if len(out) >= limit:
            break
        o = get(f'{BASE}/objects/{oid}')
        time.sleep(0.2)
        if not o:
            continue
        cls = (o.get('classification') or '').lower()
        objn = (o.get('objectName') or '').lower()
        med = (o.get('medium') or '').lower()
        if not any(k in cls or k in objn for k in PAINT_OK):
            continue
        # 排除明显的器物
        if any(bad in objn for bad in ('vessel', 'jar', 'bowl', 'bottle', 'cup', 'dish')):
            continue
        if need_kw:
            blob = ' '.join([str(o.get('culture') or ''), str(o.get('country') or ''),
                             str(o.get('region') or ''), str(o.get('geographyType') or '')]).lower()
            if need_kw not in blob:
                continue
        w = pack(o)
        if w:
            out.append(w)
    return out


def main():
    with open(OUT, encoding='utf-8') as f:
        data = json.load(f)

    # ---- 修正 1：朝鲜半岛绘画，只要绘画类 ----
    print('[korean-painting] 重抓，限定绘画类', flush=True)
    buckets = []
    for q in ['Korea painting', 'Korea hanging scroll', 'Korea album', 'Korea screen']:
        got = search_paintings(q, 6, 4, need_kw='korea')
        print(f'   {q:26s} -> {len(got)}', flush=True)
        buckets.append(got)
    picked, seen, i = [], set(), 0
    while len(picked) < 12 and any(len(b) > i for b in buckets):
        for b in buckets:
            if i < len(b) and len(picked) < 12:
                w = b[i]
                if w['id'] not in seen:
                    seen.add(w['id']); picked.append(w)
        i += 1
    if picked:
        data['korean-painting'] = picked
        print(f'   => {len(picked)} 件 / {len({w["artist"] for w in picked})} 位作者', flush=True)
        for w in picked:
            print(f'      {w["artist"][:26]:28s} | {w["title"][:40]} | {w["date"]}')

    # ---- 修正 2：澳洲原住民，须确属澳洲大陆 ----
    print('\n[aboriginal-art] 重抓，校验须确属 Australia', flush=True)
    got = []
    for q in ['Australia Aboriginal bark', 'Australia Arnhem', 'Australia painting']:
        d = get(f'{BASE}/search?hasImages=true&isPublicDomain=true&departmentId=5&q=' +
                urllib.parse.quote(q))
        ids = (d or {}).get('objectIDs') or []
        for oid in ids[:40]:
            if len(got) >= 10:
                break
            o = get(f'{BASE}/objects/{oid}')
            time.sleep(0.2)
            if not o:
                continue
            blob = ' '.join([str(o.get('culture') or ''), str(o.get('country') or ''),
                             str(o.get('region') or '')]).lower()
            # 必须确属澳洲，且排除托雷斯海峡（属大洋洲文化圈）
            if 'australia' not in blob:
                continue
            if 'torres' in blob or 'mabuiag' in blob:
                continue
            w = pack(o)
            if w and w['id'] not in {x['id'] for x in got}:
                got.append(w)
        print(f'   {q:30s} 累计 -> {len(got)}', flush=True)
    data['aboriginal-art'] = got
    print(f'   => {len(got)} 件', flush=True)
    for w in got:
        print(f'      {w["artist"][:26]:28s} | {w["title"][:40]}')
    if len(got) < 3:
        print('   注意：MET 缺澳洲原住民公版绘画藏品，将由 SVG 风格示意图承担视觉呈现')

    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)

    total = sum(len(v) for v in data.values())
    empty = [k for k, v in data.items() if not v]
    print(f'\n写入完成：{len(data)} 个流派 / {total} 张图')
    print('无图流派（需示意图）:', ', '.join(empty) if empty else '无')


if __name__ == '__main__':
    main()
