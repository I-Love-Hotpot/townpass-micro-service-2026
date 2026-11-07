import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('prepare_iphone', Path(__file__).parents[1] / 'prepare_iphone.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class ModelReuseTest(unittest.TestCase):
    def exercise(self, exists=True, marker=True, valid=True, force=False):
        calls = []
        saved = dict(sha256=module.SHA256, size=4, revision=module.REVISION, modified='stamp')
        def run(args):
            nonlocal exists
            calls.append(args)
            if 'info' in args:
                files = []
                if exists:
                    files.append(dict(name=module.MODEL, metadata=dict(size=4, lastModDate='stamp')))
                if marker:
                    files.append(dict(name=module.MODEL+'.verified.json'))
                Path(args[args.index('--json-output')+1]).write_text(json.dumps(dict(result=dict(files=files))))
            elif 'from' in args:
                dest = Path(args[args.index('--destination')+1])
                if dest.name.endswith('.json'):
                    dest.write_text(json.dumps(saved))
                else:
                    dest.write_bytes(b'test')
            elif args[-1] == 'Documents/'+module.MODEL:
                exists = True
        with patch.object(module, 'run', side_effect=run), patch.object(module, 'SIZE', 4), patch.object(module, 'digest', return_value=module.SHA256 if valid else 'bad'):
            module.ensure_device_model('device', 'bundle', Path('/model'), force=force)
        uploads = [x for x in calls if 'to' in x and x[-1] == 'Documents/'+module.MODEL]
        reads = [x for x in calls if 'from' in x and x[x.index('--source')+1] == 'Documents/'+module.MODEL]
        return len(uploads), len(reads)

    def test_unchanged_model_skips_large_transfer(self):
        self.assertEqual(self.exercise(), (0, 0))

    def test_legacy_model_verified_without_reupload(self):
        self.assertEqual(self.exercise(marker=False), (0, 1))

    def test_wrong_legacy_model_replaced(self):
        self.assertEqual(self.exercise(marker=False, valid=False), (1, 1))

    def test_missing_model_installed(self):
        self.assertEqual(self.exercise(exists=False, marker=False), (1, 0))

    def test_force_replaces_model(self):
        self.assertEqual(self.exercise(force=True), (1, 0))

if __name__ == '__main__':
    unittest.main()
