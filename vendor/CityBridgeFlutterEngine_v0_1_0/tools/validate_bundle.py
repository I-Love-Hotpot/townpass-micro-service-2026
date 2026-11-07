"""Offline data/fixture integrity checks; never loads a model or uses a network."""
import hashlib
import json
from pathlib import Path
import sqlite3
from jsonschema import Draft202012Validator,FormatChecker

ROOT=Path(__file__).resolve().parents[1]


def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    counts={}
    for pack,expected in [('opendata',1075),('housing',60)]:
        path=ROOT/'assets/data'/pack/'knowledge.sqlite'
        db=sqlite3.connect(path.as_uri()+'?mode=ro&immutable=1',uri=True)
        assert db.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
        assert db.execute('SELECT count(*) FROM units').fetchone()[0]==expected
        tables={row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        assert 'chunks' not in tables and 'chunks_fts' not in tables
        if pack=='opendata':
            assert db.execute('SELECT count(*) FROM article_lookup').fetchone()[0]==1075
            assert db.execute('SELECT count(*) FROM articles_fts').fetchone()[0]==1075
            rows=db.execute('SELECT u.metadata FROM article_lookup a JOIN units u ON u.unit_id=a.unit_id WHERE a.law_id=? AND a.article_no=?',('k0040012','45')).fetchall()
            assert len(rows)==1
            assert '六、駕車行駛人行道。' in json.loads(rows[0][0])['text']
        db.close();counts[pack]=expected
    for name in ['input','result','engine_response','ocr_extraction','query_plan','reranking']:
        value=json.loads((ROOT/'schemas'/(name+'.schema.json')).read_text(encoding='utf-8'))
        Draft202012Validator.check_schema(value)
    redacted_signatures=[(3, '881735269761b51c016cdcbc648f7db51da8042a4bec2484695066fc4ea05105'), (3, '1f0cb5088fcdbc8cc4c577078e5464327984406c136b749c526292850a7cef56'), (3, '33ca219aabb68a342412540e8c3d362f3417b88c7c1e8d9c630de398eff81b53'), (3, 'b7b2e15fc9520effdd4a7e0dffe99211738411ea58294de3638a9f3c9d14a0e7'), (3, 'a571724099c3c945313cdd083231b9517517aa6b500018992ce019090ee0b2bf'), (8, '98ec38c52b5ee0b78111cfab7bc128be775400f15082b63a0e50dcdc005b655c'), (7, '9d1b793aee98c631a4151d233363e1a184f8f2b5ac7ee349d9d3ac3223aefd4a'), (6, '1356e79a0ea4750a0dc573d3c7877d218dce221f9ba57ade29626b3b43b24ff0'), (8, 'c7bbe798c3585d8d404c0bfe2f31c06392d078fb8680f3fa624f135eae42d319'), (9, '082b20efa8f952f2c7d87a06c60c9508df21922259f84cfa372b73b9b67ac6af'), (9, '0beb7db542f460c400ee5ec830e482992334505ecc476b4e09105b018f7ed2ef')]
    for case in ['demo1','demo2']:
        source=json.loads((ROOT/'fixtures'/case/'input.json').read_text(encoding='utf-8'))
        result=json.loads((ROOT/'fixtures'/case/'recorded_result.json').read_text(encoding='utf-8'))
        for name,value in [('input',source),('result',result)]:
            schema=json.loads((ROOT/'schemas'/(name+'.schema.json')).read_text(encoding='utf-8'))
            Draft202012Validator(schema,format_checker=FormatChecker()).validate(value)
            raw=json.dumps(value,ensure_ascii=False)
            assert all(all(hashlib.sha256(raw[i:i+length].encode('utf-8')).hexdigest()!=signature
                           for i in range(len(raw)-length+1)) for length,signature in redacted_signatures)
        assert result['input']==source and result['verification_status']=='candidate' and result['workflow'] is None
        assert result['run_info']['embedding_calls']==0
        response=json.loads((ROOT/'fixtures'/case/'fixture_response.json').read_text(encoding='utf-8'))
        response_schema=json.loads((ROOT/'schemas/engine_response.schema.json').read_text(encoding='utf-8'))
        Draft202012Validator(response_schema,format_checker=FormatChecker()).validate(response)
        assert response['execution_mode']=='fixture_replay' and response['result']==result
    assert not list(ROOT.rglob('*.f32')) and not list(ROOT.rglob('*.onnx')) and not list(ROOT.rglob('*.gguf'))
    assert not list(ROOT.rglob('*.exe'))
    for path in (ROOT/'lib').rglob('*.dart'):
        text=path.read_text(encoding='utf-8')
        assert "import 'dart:io'" not in text and 'package:http/' not in text
    manifest=ROOT/'MANIFEST.json'
    if manifest.exists():
        value=json.loads(manifest.read_text(encoding='utf-8'))
        actual={p.relative_to(ROOT).as_posix() for p in ROOT.rglob('*') if p.is_file() and p!=manifest}
        assert actual==set(value['files'])
        for name,expected in value['files'].items():assert digest(ROOT/name)==expected
    print(json.dumps(dict(sqlite_units=counts,fixtures_valid=2,pii_token_checks_passed=True,
                          schemas_valid=6,forbidden_model_and_vector_files_absent=True,
                          manifest_verified=manifest.exists(),ios_inference_tested=False),ensure_ascii=False,indent=2))


if __name__=='__main__':main()
