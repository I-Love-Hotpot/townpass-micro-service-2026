"""Build and install an offline GovClear app and pinned E4B weights via USB."""
import argparse
import hashlib
import json
import plistlib
import subprocess
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


def prepare(app=APP):
    if not (app / 'lib/page/govclear/govclear_webview.dart').is_file():
        raise RuntimeError('請用 --app 指定 TownPass release/govclear-iphone-offline checkout；不覆寫其他版本的資源。')
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
    run(['flutter', 'pub', 'get'], app)
    return target


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--app', type=Path, default=APP, help='TownPass release/govclear-iphone-offline checkout')
    parser.add_argument('--device', help='實體 iPhone UDID；僅一支已連接時自動選取')
    parser.add_argument('--prepare-only', action='store_true', help='下載模型，不安裝')
    args = parser.parse_args()
    app = args.app.resolve()
    target = prepare(app)
    if args.prepare_only:
        return
    device = args.device
    if not device:
        devices = json.loads(subprocess.check_output(['flutter', 'devices', '--machine'], cwd=app))
        phones = [x for x in devices if x.get('targetPlatform') == 'ios' and not x.get('emulator')]
        if len(phones) != 1:
            raise RuntimeError('請連接並解鎖一支 iPhone，或用 --device 指定。')
        device = phones[0]['id']
    run(['flutter', 'build', 'ios', '--profile', '--dart-define=GOVCLEAR_ON_DEVICE=true'], app)
    bundle = app / 'build/ios/iphoneos/Runner.app'
    with (bundle / 'Info.plist').open('rb') as file:
        bundle_id = plistlib.load(file)['CFBundleIdentifier']
    run(['xcrun', 'devicectl', 'device', 'install', 'app', '--device', device, bundle])
    run(['xcrun', 'devicectl', 'device', 'copy', 'to', '--device', device,
         '--domain-type', 'appDataContainer', '--domain-identifier', bundle_id,
         '--source', target, '--destination', 'Documents/' + MODEL])
    run(['xcrun', 'devicectl', 'device', 'process', 'launch', '--device', device, bundle_id])
    print('✓ iPhone 已安裝。首次開啟請連網下載完整離線介面。進入服務 → GovClear 看懂文件；不需啟動 Mac 模型。')


if __name__ == '__main__':
    main()
