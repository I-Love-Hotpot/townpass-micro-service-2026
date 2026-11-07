"""Prepare the complete local TownPass + GovClear simulator stack (stdlib only)."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, ProxyHandler, HTTPRedirectHandler, build_opener

HERE = Path(__file__).resolve().parent
MICROSERVICE = HERE.parent
FRONTEND = MICROSERVICE / 'frontend'
TOWNPASS = MICROSERVICE.parent / 'TownPass'
RUNTIME = HERE / '.runtime'
MODEL = 'gemma4:e4b-it-q4_K_M'

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args):
        raise RuntimeError('拒絕本機服務重新導向。')

OPENER = build_opener(ProxyHandler({}), NoRedirect())

def executable(name):
    candidates = [shutil.which(name), '/opt/homebrew/bin/' + name,
                  '/usr/local/bin/' + name, str(Path.home() / 'flutter/bin' / name)]
    for value in candidates:
        if value and Path(value).is_file():
            return value
    raise RuntimeError('找不到 ' + name + '，請先安裝並加入 PATH。')

def read(url, payload=None, timeout=4):
    data = None if payload is None else json.dumps(payload).encode()
    request = Request(url, data=data, headers={'Content-Type': 'application/json'})
    with OPENER.open(request, timeout=timeout) as response:
        return response.read().decode('utf-8')

def available(url):
    try:
        read(url)
        return True
    except (OSError, URLError):
        return False

def start(name, command, cwd, env=None):
    logs = RUNTIME / 'logs'
    logs.mkdir(parents=True, exist_ok=True)
    log = logs / (name + '.log')
    with log.open('ab') as output:
        process = subprocess.Popen(command, cwd=str(cwd), env=env,
                                   stdin=subprocess.DEVNULL, stdout=output,
                                   stderr=subprocess.STDOUT, start_new_session=True)
    (RUNTIME / (name + '.pid')).write_text(str(process.pid))
    return process, log

def wait_ready(process, log, check, label):
    for _ in range(60):
        if check():
            return
        if process.poll() is not None:
            raise RuntimeError(label + ' 啟動失敗；請查看 ' + str(log))
        time.sleep(0.5)
    raise RuntimeError(label + ' 尚未就緒；請查看 ' + str(log))

def prepare_services():
    ollama = executable('ollama')
    if not available('http://127.0.0.1:11434/api/version'):
        print('啟動本機 Ollama…', flush=True)
        env = dict(os.environ, OLLAMA_HOST='127.0.0.1:11434', OLLAMA_NO_CLOUD='1',
                   OLLAMA_MODELS=str(RUNTIME / 'models'), OLLAMA_CONTEXT_LENGTH='16384')
        process, log = start('ollama', [ollama, 'serve'], HERE, env)
        wait_ready(process, log, lambda: available('http://127.0.0.1:11434/api/version'), 'Ollama')
    try:
        model = json.loads(read('http://127.0.0.1:11434/api/show', {'model': MODEL}))
    except HTTPError as error:
        if error.code != 404:
            raise
        print('首次準備：下載 E4B Q4_K_M 權重，約 6.6 GB…', flush=True)
        subprocess.run([ollama, 'pull', MODEL], check=True)
        model = json.loads(read('http://127.0.0.1:11434/api/show', {'model': MODEL}))
    if model.get('remote_host') or model.get('remote_model') or 'vision' not in model.get('capabilities', []):
        raise RuntimeError('需要具圖片能力的 E4B 本機權重，不能使用雲端模型。')
    print('✓ 本機 Gemma 4 E4B 文字／圖片權重已就緒', flush=True)

    if not (FRONTEND / 'node_modules/.bin/vite').exists():
        print('安裝微服務前端依賴…', flush=True)
        subprocess.run([executable('pnpm'), 'install', '--frozen-lockfile'], cwd=str(FRONTEND), check=True)
    endpoint = 'http://127.0.0.1:5173/govclear'
    if not available(endpoint):
        print('啟動 Vue 微服務…', flush=True)
        process, log = start('frontend', [executable('pnpm'), 'dev:govclear'], FRONTEND)
        wait_ready(process, log, lambda: available(endpoint), '微服務前端')
    if 'GovClearBridge' not in read('http://127.0.0.1:5173/src/services/govclearBridge.ts'):
        raise RuntimeError('5173 被其他服務占用，請先關閉該服務後重試。')
    read('http://127.0.0.1:5173/src/css/index.css')
    print('✓ Vue 微服務已就緒：' + endpoint, flush=True)

def prepare_flutter():
    flutter = executable('flutter')
    if not (TOWNPASS / '.dart_tool/package_config.json').exists():
        subprocess.run([flutter, 'pub', 'get'], cwd=str(TOWNPASS), check=True)
    if not (TOWNPASS / 'lib/gen/assets.gen.dart').exists():
        subprocess.run([flutter, 'pub', 'run', 'build_runner', 'build'], cwd=str(TOWNPASS), check=True)
    return flutter

def sync_example_images(device_id, directory=None, runtime=None):
    directory = Path(directory) if directory is not None else HERE / 'examples'
    runtime = Path(runtime) if runtime is not None else RUNTIME
    runtime.mkdir(parents=True, exist_ok=True)
    imported = []
    for fixture in sorted(directory.iterdir(), key=lambda item: item.name.casefold()):
        if fixture.is_symlink() or not fixture.is_file() or fixture.suffix.lower() not in {'.png', '.jpg', '.jpeg'}:
            continue
        if not 0 < fixture.stat().st_size <= 20 * 1024 * 1024:
            print('略過（空檔或超過 20 MB）：' + fixture.name, flush=True)
            continue
        data = fixture.read_bytes()
        if not (data.startswith(b'\x89PNG\r\n\x1a\n') or data.startswith(b'\xff\xd8\xff')):
            print('略過（不是 PNG / JPEG 內容）：' + fixture.name, flush=True)
            continue
        # Keep previous built-in markers; hash custom names to support long,
        # non-ASCII filenames without exceeding filesystem name limits.
        if fixture.name == 'notice.png':
            suffix = ''
        elif fixture.name == 'notice-page2.png':
            suffix = '-notice-page2'
        else:
            suffix = '-file-' + hashlib.sha256(fixture.name.encode('utf-8')).hexdigest()[:24]
        seed = runtime / ('photo-' + device_id + suffix + '.sha256')
        digest = hashlib.sha256(data).hexdigest()
        if seed.exists() and seed.read_text() == digest:
            continue
        try:
            subprocess.run(['xcrun', 'simctl', 'addmedia', device_id, str(fixture)], check=True,
                           stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        except subprocess.CalledProcessError:
            print('無法匯入相簿（請確認圖片可正常開啟）：' + fixture.name, flush=True)
            continue
        seed.write_text(digest)
        imported.append(fixture.name)
        print('✓ 已加入模擬器相簿：' + fixture.name, flush=True)
    print('✓ 測試圖片同步完成，本次新增 ' + str(len(imported)) + ' 張', flush=True)
    return imported


def prepare_device():
    raw = subprocess.check_output(['xcrun', 'simctl', 'list', 'devices', 'available', '--json'], text=True)
    groups = json.loads(raw)['devices'].values()
    phones = [device for group in groups for device in group if 'iPhone' in device['name'] and device.get('isAvailable')]
    if not phones:
        raise RuntimeError('沒有可用的 iPhone 模擬器，請先在 Xcode 安裝 iOS runtime。')
    device = next((d for d in phones if d['state'] == 'Booted'), phones[0])
    if device['state'] != 'Booted':
        print('開啟 ' + device['name'] + '…', flush=True)
        subprocess.run(['xcrun', 'simctl', 'boot', device['udid']], check=True)
        subprocess.run(['xcrun', 'simctl', 'bootstatus', device['udid'], '-b'], check=True)
    developer = Path(subprocess.check_output(['xcode-select', '-p'], text=True).strip())
    for app in [developer.parent / 'Applications/DeviceHub.app', developer / 'Applications/Simulator.app']:
        if app.exists():
            subprocess.run(['open', str(app)], check=True)
            break
    sync_example_images(device['udid'])
    (RUNTIME / 'simulator.json').write_text(json.dumps({'id': device['udid'], 'name': device['name']}))
    print('✓ iPhone 模擬器：' + device['name'], flush=True)
    return device['udid']

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run', action='store_true', help='準備完成後直接執行完整 TownPass')
    parser.add_argument('--sync-examples', action='store_true', help='只將 examples 內的 PNG / JPEG 同步到模擬器相簿')
    parser.add_argument('--test', action='store_true', help='準備完成後跑完整 TownPass 入口整合測試')
    args = parser.parse_args()
    try:
        if args.sync_examples:
            prepare_device()
            return 0
        prepare_services()
        flutter = prepare_flutter()
        device = prepare_device()
        print('GovClear 測試環境已備妥。從 TownPass「服務 → GovClear 看懂文件」開始。', flush=True)
        flags = ['-d', device, '--dart-define=GOVCLEAR_SIMULATOR=true', '--dart-define=GOVCLEAR_TEST_MODE=true']
        if args.test:
            return subprocess.call([flutter, 'test', 'integration_test/govclear_test.dart'] + flags, cwd=str(TOWNPASS))
        if args.run:
            return subprocess.call([flutter, 'run', '--debug', '-t', 'lib/main.dart'] + flags, cwd=str(TOWNPASS))
        return 0
    except (OSError, ValueError, RuntimeError, subprocess.CalledProcessError) as error:
        print('測試環境準備失敗：' + str(error), file=sys.stderr)
        return 1

if __name__ == '__main__':
    sys.exit(main())
