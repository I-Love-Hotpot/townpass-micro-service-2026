import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import prepare_iphone


class PreparationTests(unittest.TestCase):
    def test_rejects_incompatible_checkout_before_download_or_asset_removal(self):
        with tempfile.TemporaryDirectory() as directory:
            app = Path(directory)
            assets = app / 'assets/govclear'
            assets.mkdir(parents=True)
            original = assets / 'index.html'
            original.write_text('existing UI')
            with patch.object(prepare_iphone, 'run') as run:
                with self.assertRaisesRegex(RuntimeError, 'release/govclear-iphone-offline'):
                    prepare_iphone.prepare(app)
                run.assert_not_called()
            self.assertEqual(original.read_text(), 'existing UI')

    def test_model_preparation_no_longer_copies_or_builds_web_assets(self):
        with tempfile.TemporaryDirectory() as directory:
            app = Path(directory) / 'app'
            host = app / 'lib/page/govclear/govclear_webview.dart'
            host.parent.mkdir(parents=True)
            host.touch()
            assets = app / 'assets/govclear'
            assets.mkdir(parents=True)
            (assets / 'index.html').write_text('old assets left untouched')
            runtime = Path(directory) / 'runtime'
            runtime.mkdir()
            (runtime / prepare_iphone.MODEL).write_bytes(b'x')
            with patch.object(prepare_iphone, 'RUNTIME', runtime), \
                    patch.object(prepare_iphone, 'SIZE', 1), \
                    patch.object(prepare_iphone, 'digest', return_value=prepare_iphone.SHA256), \
                    patch.object(prepare_iphone, 'run') as run:
                prepare_iphone.prepare(app)
                run.assert_called_once_with(['flutter', 'pub', 'get'], app)
            self.assertEqual((assets / 'index.html').read_text(), 'old assets left untouched')
