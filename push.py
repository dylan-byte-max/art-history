import base64, io, json, subprocess, sys, os

REPO = 'dylan-byte-max/art-history'
FILES = [
    'data/part1-ancient-renaissance.js',
    'push.py',
]
MSG = '补推影响链修正与批量推送脚本'

def sh(args, stdin_data=None):
    r = subprocess.run(args, capture_output=True, text=True,
                       encoding='utf-8', errors='replace', input=stdin_data)
    return r.returncode, (r.stdout or '').strip(), (r.stderr or '').strip()

def remote_sha(path):
    code, out, _ = sh(['gh','api',f'repos/{REPO}/contents/{path}','--jq','.sha'])
    return out if code == 0 and out else None

fails = []
for path in FILES:
    if not os.path.exists(path):
        print(f'SKIP  {path}')
        continue
    b64 = base64.b64encode(io.open(path,'rb').read()).decode()
    sha = remote_sha(path)
    payload = {'message': MSG, 'content': b64, 'branch': 'main'}
    if sha:
        payload['sha'] = sha
    # 通过 stdin 传 JSON，避开 Windows 命令行长度限制
    code, out, err = sh(
        ['gh','api','-X','PUT',f'repos/{REPO}/contents/{path}',
         '--input','-','--jq','.commit.sha[0:7]'],
        stdin_data=json.dumps(payload)
    )
    tag = 'UPDATE' if sha else 'CREATE'
    if code == 0:
        print(f'OK    {tag:6s} {path:30s} -> {out}')
    else:
        print(f'FAIL  {tag:6s} {path:30s} {err[:150]}')
        fails.append(path)

print('\n失败: ' + (', '.join(fails) if fails else '无'))
sys.exit(1 if fails else 0)
