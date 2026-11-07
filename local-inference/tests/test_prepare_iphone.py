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
