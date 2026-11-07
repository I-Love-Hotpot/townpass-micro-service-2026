import 'dart:convert';
import '../lib/src/law_article_repository.dart';

void check(bool value, String message) {
  if (!value) throw StateError(message);
}

Future<void> main() async {
  for (final text in ['第45條', '第四十五條', '第４５條', '第45條1項06款']) {
    check(LawArticleRepository.parseLocator(text)['article_no'] == '45', text);
  }
  for (final text in ['45-1', '第45條之1', '第45之1條', '第四十五條之一']) {
    check(LawArticleRepository.parseLocator(text)['article_no'] == '45-1', text);
  }
  for (final text in ['45-1-6', '第十十條', '第0條']) {
    var failed = false;
    try {
      LawArticleRepository.parseLocator(text);
    } on FormatException {
      failed = true;
    }
    check(failed, 'Invalid locator must not be guessed: $text');
  }
  final calls = <List<Object?>>[];
  final repo = LawArticleRepository((sql, args) async {
    calls.add(args);
    if (sql.startsWith('SELECT DISTINCT')) {
      return [
        {'law_id': 'k0040012', 'law_title': '道路交通管理處罰條例', 'law_name_key': '道路交通管理處罰條例'}
      ];
    }
    if (args.contains('46')) return [];
    return [
      {'metadata': jsonEncode({'unit_id': 'sample', 'text': '原始條文，非模型生成。'}), 'keyword_score': -1.0}
    ];
  });
  final result = await repo.lookup(citation: '《道路交通管理處罰條例》第45條第1項第06款');
  check(result['status'] == 'found', 'Full citation');
  check((result['requested_locator'] as Map)['subparagraph'] == '6', 'Clause');
  check((await repo.lookup(citation: '第45條'))['status'] == 'needs_law', 'No guessing law');
  check((await repo.lookup(lawId: 'k0040012', citation: '第46條'))['status'] == 'not_found', 'No nearest article');
  await repo.keywords(['人行道'], lawId: 'k0040012');
  check(calls.last.first == '"人行 行道"', 'Chinese bigram index recipe');
  print('Dart locator/repository contract tests passed (SQLite callback fixture).');
}
