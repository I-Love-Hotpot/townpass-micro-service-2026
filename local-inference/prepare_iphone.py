"""Build and install an offline GovClear app and pinned E4B weights via USB."""
import argparse
import hashlib
import json
import plistlib
import shutil
import subprocess
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
APP = ROOT.parent / 'TownPass'
REVISION = '71064b01bd5e2bfd9a5f9dd52df86ae4800138c1'
MODEL = 'gemma-4-E4B-it.litertlm'
SHA256 = '0b2a8980ce155fd97673d8e820b4d29d9c7d99b8fa6806f425d969b145bd52e0'
SIZE = 3659530240
RUNTIME = HERE / '.runtime' / 'iphone'


def run(args, cwd=ROOT):
    subprocess.run([str(x) for x in args], cwd=cwd, check=True)


def digest(path):
    with path.open('rb') as file:
        return hashlib.file_digest(file, 'sha256').hexdigest() if hasattr(hashlib, 'file_digest') else _digest(file)


def _digest(file):
    value = hashlib.sha256()
    for chunk in iter(lambda: file.read(8 * 1024 * 1024), b''):
        value.update(chunk)
    return value.hexdigest()


def prepare():
    RUNTIME.mkdir(parents=True, exist_ok=True)
    target = RUNTIME / MODEL
    if not target.exists():
        partial = target.with_suffix('.litertlm.part')
        if not partial.exists() or partial.stat().st_size != SIZE:
            run(['curl', '-L', '--fail', '--retry', '3', '-C', '-', '-o', partial,
                 f'https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/{REVISION}/{MODEL}'])
        if partial.stat().st_size != SIZE or digest(partial) != SHA256:
            raise RuntimeError('模型下載不完整或雜湊不符，請移除 .part 後重試。')
        partial.rename(target)
    elif target.stat().st_size != SIZE or digest(target) != SHA256:
        raise RuntimeError('本機模型驗證失敗，請重新下載。')
    print('✓ 手機版 E4B 模型 SHA-256 已驗證', flush=True)
    run(['pnpm', 'build'], ROOT / 'frontend')
    assets = APP / 'assets/govclear'
    if assets.exists():
        shutil.rmtree(assets)
    shutil.copytree(ROOT / 'frontend/dist', assets)
    (assets / '.gitkeep').touch()
    (assets / 'assets/.gitkeep').touch()
    run(['flutter', 'pub', 'get'], APP)
    return target


def ensure_device_model(device, bundle_id, target, force=False):
    """Reuse a verified model; legacy installations are read back once for hashing."""
    base = ['xcrun', 'devicectl', 'device']
    domain = ['--device', device, '--domain-type', 'appDataContainer',
              '--domain-identifier', bundle_id]
    marker_name = MODEL + '.verified.json'
    with tempfile.TemporaryDirectory(prefix='govclear-model-') as temp:
        temp = Path(temp)
        listing = temp / 'files.json'
        run(base + ['info', 'files'] + domain + ['--subdirectory', 'Documents',
            '--no-recurse', '--json-output', listing])
        files = json.loads(listing.read_text())['result']['files']
        entries = {entry['name']: entry for entry in files}
        entry = entries.get(MODEL, {})
        metadata = entry.get('metadata', {})
        same_size = metadata.get('size') == SIZE
        stamp = metadata.get('lastModDate')
        marker = temp / marker_name
        verified = False
        if not force and same_size:
            if marker_name in entries:
                run(base + ['copy', 'from'] + domain + ['--source', 'Documents/' + marker_name,
                    '--destination', marker])
                try:
                    saved = json.loads(marker.read_text())
                    verified = saved == dict(sha256=SHA256, size=SIZE, revision=REVISION, modified=stamp) and stamp is not None
                except (ValueError, OSError):
                    pass
            if not verified:
                print('驗證手機既有模型（僅首次或模型異動時讀回檢查）…', flush=True)
                existing = temp / MODEL
                run(base + ['copy', 'from'] + domain + ['--source', 'Documents/' + MODEL,
                    '--destination', existing])
                verified = existing.stat().st_size == SIZE and digest(existing) == SHA256
        if not verified:
            run(base + ['copy', 'to'] + domain + ['--source', target,
                '--destination', 'Documents/' + MODEL])
            run(base + ['info', 'files'] + domain + ['--subdirectory', 'Documents',
                '--no-recurse', '--json-output', listing])
            entries = {entry['name']: entry for entry in json.loads(listing.read_text())['result']['files']}
            metadata = entries.get(MODEL, {}).get('metadata', {})
            if metadata.get('size') != SIZE:
                raise RuntimeError('手機模型檔案大小不符，請重新安裝模型。')
            stamp = metadata.get('lastModDate')
        marker.write_text(json.dumps(dict(sha256=SHA256, size=SIZE, revision=REVISION, modified=stamp)))
        run(base + ['copy', 'to'] + domain + ['--source', marker,
            '--destination', 'Documents/' + marker_name])
        print('✓ 模型未變更，跳過複製。' if verified else '✓ 手機模型已更新。', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--device', help='實體 iPhone UDID；僅一支已連接時自動選取')
    parser.add_argument('--prepare-only', action='store_true', help='下載模型及打包介面，不安裝')
    parser.add_argument('--force-model-copy', action='store_true', help='強制重新複製模型到手機')
    args = parser.parse_args()
    target = prepare()
    if args.prepare_only:
        return
    device = args.device
    if not device:
        devices = json.loads(subprocess.check_output(['flutter', 'devices', '--machine'], cwd=APP))
        phones = [x for x in devices if x.get('targetPlatform') == 'ios' and not x.get('emulator')]
        if len(phones) != 1:
            raise RuntimeError('請連接並解鎖一支 iPhone，或用 --device 指定。')
        device = phones[0]['id']
    run(['flutter', 'build', 'ios', '--profile', '--dart-define=GOVCLEAR_ON_DEVICE=true'], APP)
    bundle = APP / 'build/ios/iphoneos/Runner.app'
    with (bundle / 'Info.plist').open('rb') as file:
        bundle_id = plistlib.load(file)['CFBundleIdentifier']
    run(['xcrun', 'devicectl', 'device', 'install', 'app', '--device', device, bundle])
    ensure_device_model(device, bundle_id, target, force=args.force_model_copy)
    run(['xcrun', 'devicectl', 'device', 'process', 'launch', '--device', device, bundle_id])
    print('✓ iPhone 已安裝離線版。進入服務 → GovClear 看懂文件；不需啟動 Mac 模型。')


if __name__ == '__main__':
    main()
