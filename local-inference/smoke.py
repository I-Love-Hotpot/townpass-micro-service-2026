"""Run the same synthetic notice through both local inference paths."""
import json
from pathlib import Path
import govclear

root = Path(__file__).resolve().parent
output = root / 'results'
output.mkdir(exist_ok=True)
report = {}
# Presence checks are a smoke signal, not proof that conditions are understood.
expected = ['115年11月30日', '115年12月6日', '200', '65', '每戶', '額滿']
for mode, name in [('text', 'notice.txt'), ('image', 'notice.png')]:
    print('Running ' + mode, flush=True)
    try:
        result = govclear.analyze(mode, root / 'examples' / name)
        (output / (mode + '.json')).write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
        report[mode] = {'status': 'completed', 'timing_seconds': result['timing_seconds'],
                        'source_missing_terms': [s for s in expected if s not in result['source_text']],
                        'summary_missing_terms': [s for s in expected if s not in result['summary']]}
    except Exception as exc:
        report[mode] = {'status': 'failed', 'error_type': type(exc).__name__}
    print(json.dumps(report[mode], ensure_ascii=False), flush=True)
(output / 'smoke-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
if any(r['status'] != 'completed' for r in report.values()):
    raise SystemExit(1)
