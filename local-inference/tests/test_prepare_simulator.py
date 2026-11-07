import tempfile
import unittest
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path
from unittest.mock import patch
import subprocess
import prepare_simulator as prepare

PNG = b'\x89PNG\r\n\x1a\nfixture'
JPEG = b'\xff\xd8\xfffixture'

class PhotoImportTests(unittest.TestCase):
    def test_arbitrary_names_unicode_and_uppercase_extensions(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            examples = root / 'examples'; examples.mkdir()
            runtime = root / 'runtime'
            names = ['Screenshot 2026-11-07 at 7.23.19\u202fPM.png', '自己的文件.JPG', '相片.jpeg']
            for name in names:
                (examples / name).write_bytes(PNG if name.endswith('.png') else JPEG)
            (examples / 'ignore.txt').write_text('not a photo')
            with patch.object(prepare.subprocess, 'run') as run, redirect_stdout(StringIO()):
                imported = prepare.sync_example_images('device', examples, runtime)
                self.assertCountEqual(imported, names)
                self.assertEqual(run.call_count, 3)
                commands = [call.args[0] for call in run.call_args_list]
                self.assertIn(['xcrun', 'simctl', 'addmedia', 'device', str(examples / names[0])], commands)
                self.assertEqual(prepare.sync_example_images('device', examples, runtime), [])
                self.assertEqual(run.call_count, 3)
                (examples / names[0]).write_bytes(PNG + b'changed')
                self.assertEqual(prepare.sync_example_images('device', examples, runtime), [names[0]])

    def test_bad_file_and_failed_import_do_not_block_other_images(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            examples = root / 'examples'; examples.mkdir()
            runtime = root / 'runtime'
            (examples / 'bad.png').write_bytes(b'%PDF')
            (examples / 'fail.png').write_bytes(PNG)
            (examples / 'good.png').write_bytes(PNG)
            (examples / 'link.png').symlink_to(examples / 'good.png')
            def run(command, **kwargs):
                if command[-1].endswith('fail.png'):
                    raise subprocess.CalledProcessError(1, command)
            with patch.object(prepare.subprocess, 'run', side_effect=run), redirect_stdout(StringIO()):
                self.assertEqual(prepare.sync_example_images('device', examples, runtime), ['good.png'])
                self.assertEqual(len(list(runtime.glob('*.sha256'))), 1)

if __name__ == '__main__':
    unittest.main()
