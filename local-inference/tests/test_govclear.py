import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock
import govclear as g

class Tests(unittest.TestCase):
    def test_text_pipeline(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'a.txt'
            path.write_text('期限115年11月30日；65歲免收費', encoding='utf-8')
            with patch.object(g, 'chat', return_value='摘要') as chat:
                result = g.analyze('text', path)
            self.assertEqual(chat.call_count, 1)
            self.assertIn(result['source_text'], chat.call_args.args[0])
            self.assertTrue(result['review_required'])

    def test_image_pipeline(self):
        with patch.object(g, 'read_image', return_value='encoded'), patch.object(
            g, 'chat', side_effect=['期限 [無法辨識]', '待確認期限']
        ) as chat:
            result = g.analyze('image', Path('a.png'))
        self.assertEqual(chat.call_count, 2)
        self.assertEqual(chat.call_args_list[0].args[1], ['encoded'])
        self.assertIn('期限 [無法辨識]', chat.call_args_list[1].args[0])
        self.assertEqual(result['source_text'], '期限 [無法辨識]')

    def test_unreadable_stops_summary(self):
        with patch.object(g, 'read_image', return_value='encoded'), patch.object(
            g, 'chat', return_value='[無法辨識]'
        ) as chat:
            with self.assertRaises(g.LocalError):
                g.analyze('image', Path('a.png'))
            self.assertEqual(chat.call_count, 1)

    def test_long_summary_review_checks_original_and_draft(self):
        source = '合成背景。' * 70 + '郵寄以實際收到時間為準。'
        with patch.object(g, 'chat', side_effect=['短摘要', '已核對摘要']) as chat:
            self.assertEqual(g.summarize_text(source), '已核對摘要')
            self.assertEqual(chat.call_count, 2)
            self.assertIn(source, chat.call_args_list[1].args[0])
            self.assertIn('短摘要', chat.call_args_list[1].args[0])

    def test_fast_request_keeps_model_warm(self):
        response = MagicMock()
        response.read.return_value = json.dumps({
            'done': True, 'done_reason': 'stop', 'message': {'content': '摘要'}
        }).encode()
        response.__enter__.return_value = response
        with patch.object(g, 'build_opener') as opener:
            opener.return_value.open.return_value = response
            self.assertEqual(g.chat('test'), '摘要')
            request = opener.return_value.open.call_args.args[0]
            payload = json.loads(request.data)
            self.assertIs(payload['think'], False)
            self.assertEqual(payload['keep_alive'], '30m')

    def test_invalid_text(self):
        for text in ['', ' ', '字' * 6001]:
            with self.assertRaises(g.LocalError):
                g.validate_text(text)

    def test_invalid_image(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'a.png'
            path.write_bytes(b'%PDF invalid')
            with self.assertRaises(g.LocalError):
                g.read_image(path)

    def test_redirect(self):
        with self.assertRaises(g.LocalError):
            g.NoRedirect().redirect_request(None, None, 302, '', {}, 'https://example.com')

    def test_incomplete_or_empty_response(self):
        for result in [dict(done=False), dict(done=True, done_reason='length'),
                       dict(done=True, message={'content': ''})]:
            response = MagicMock()
            response.read.return_value = json.dumps(result).encode()
            response.__enter__.return_value = response
            with patch.object(g, 'build_opener') as opener:
                opener.return_value.open.return_value = response
                with self.assertRaises(g.LocalError):
                    g.chat('test')

if __name__ == '__main__':
    unittest.main()
