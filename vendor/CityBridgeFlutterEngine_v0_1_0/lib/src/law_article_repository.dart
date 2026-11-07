import 'dart:convert';

/// Bind to your SQLite library's parameterized query method.
/// This repository does not call Gemma, an embedding model, or a network API.
typedef SqlQuery = Future<List<Map<String, Object?>>> Function(
    String sql, List<Object?> arguments);

class LawArticleRepository {
  LawArticleRepository(this.query);
  final SqlQuery query;

  static String normalize(String value) {
    final ascii = String.fromCharCodes(value.runes.map((c) =>
        c >= 0xff01 && c <= 0xff5e ? c - 0xfee0 : (c == 0x3000 ? 32 : c)));
    return ascii.replaceAll(RegExp(r'[\s《》〈〉「」『』]'), '');
  }

  static String _chinese(int n) {
    const digits = '零一二三四五六七八九';
    var result = '';
    var zero = false;
    final bases = [1000, 100, 10, 1];
    final suffixes = ['千', '百', '十', ''];
    for (var i = 0; i < bases.length; i++) {
      final base = bases[i];
      final digit = n ~/ base % 10;
      if (digit == 0) {
        zero = result.isNotEmpty && n % base > 0;
      } else {
        if (zero) result += '零';
        result += (base == 10 && digit == 1 && result.isEmpty
                ? ''
                : digits[digit]) +
            suffixes[i];
        zero = false;
      }
    }
    return result;
  }

  static String number(String value) {
    final s = normalize(value).replaceAll('〇', '零');
    int n;
    if (RegExp(r'^[0-9]+$').hasMatch(s)) {
      n = int.parse(s);
    } else if (RegExp(r'^[零一二三四五六七八九十百千]+$').hasMatch(s)) {
      const digits = '零一二三四五六七八九';
      const units = {'十': 10, '百': 100, '千': 1000};
      var total = 0;
      var current = 0;
      for (var i = 0; i < s.length; i++) {
        if (units.containsKey(s[i])) {
          total += (current == 0 ? 1 : current) * units[s[i]]!;
          current = 0;
        } else {
          current = digits.indexOf(s[i]);
        }
      }
      n = total + current;
      final accepted = s.startsWith('一十') ? s.substring(1) : s;
      if (n < 1 || n > 9999 || accepted != _chinese(n)) {
        throw const FormatException('中文條號不完整或有歧義');
      }
    } else {
      throw const FormatException('無效條號');
    }
    if (n < 1 || n > 9999) throw const FormatException('條號超出範圍');
    return '$n';
  }

  static Map<String, Object?> parseLocator(String value) {
    final s = normalize(value);
    const num = r'[0-9零〇一二三四五六七八九十百千]+';
    var part = s;
    var rest = '';
    var kind = 'article';
    final marker = s.contains('條') ? '條' : (s.contains('點') ? '點' : '');
    if (marker.isNotEmpty) {
      kind = marker == '條' ? 'article' : 'point';
      final index = s.indexOf(marker);
      part = s.substring(0, index);
      rest = s.substring(index + 1);
      final extra = RegExp('^之($num)').firstMatch(rest);
      if (extra != null) {
        if (part.contains('之') || part.contains('-')) {
          throw const FormatException('重複的條之號');
        }
        part += '-${extra.group(1)}';
        rest = rest.substring(extra.end);
      }
    }
    if (part.startsWith('第')) part = part.substring(1);
    final parts = part.split(RegExp('[-之]'));
    if (parts.isEmpty || parts.length > 2) {
      throw const FormatException('45-1表示第45條之1；項款請明確標示');
    }
    final articleNo = parts.map(number).join('-');
    final selectors = RegExp(
            '^(?:第?($num)項)?(?:第?($num)款)?(?:第?($num)目)?\$')
        .firstMatch(rest);
    if (selectors == null) throw const FormatException('項款格式不正確');
    return {
      'article_no': articleNo,
      'unit_kind': kind,
      'paragraph': selectors.group(1) == null ? null : number(selectors.group(1)!),
      'subparagraph': selectors.group(2) == null ? null : number(selectors.group(2)!),
      'item': selectors.group(3) == null ? null : number(selectors.group(3)!),
    };
  }

  Future<List<Map<String, Object?>>> laws() => query(
      'SELECT DISTINCT law_id,law_title,law_name_key FROM article_lookup ORDER BY law_title',
      []);

  Future<Map<String, dynamic>> lookup({
    String? lawId,
    String? lawName,
    required String citation,
    String? versionId,
  }) async {
    final available = await laws();
    final text = normalize(citation);
    var locatorText = text;
    final matches = available
        .where((l) => text.startsWith(l['law_name_key'] as String))
        .toList()
      ..sort((a, b) => (b['law_name_key'] as String)
          .length
          .compareTo((a['law_name_key'] as String).length));
    if (matches.isNotEmpty) {
      final matched = matches.first;
      if (lawName != null && normalize(lawName) != matched['law_name_key']) {
        return {'status': 'identifier_conflict'};
      }
      lawName = matched['law_title'] as String;
      locatorText = text.substring((matched['law_name_key'] as String).length);
    }
    final locator = parseLocator(locatorText);
    if (lawId == null && lawName == null) {
      return {'status': 'needs_law', 'laws': available, 'requested_locator': locator};
    }
    if (lawId != null && lawName != null) {
      if (!available.any((l) =>
          l['law_id'] == lawId.toLowerCase() &&
          l['law_name_key'] == normalize(lawName!))) {
        return {'status': 'identifier_conflict'};
      }
    }
    final conditions = ['a.article_no=?', 'a.unit_kind=?'];
    final args = <Object?>[locator['article_no'], locator['unit_kind']];
    if (lawId != null) {
      conditions.add('a.law_id=?');
      args.add(lawId.toLowerCase());
    }
    if (lawName != null) {
      conditions.add('a.law_name_key=?');
      args.add(normalize(lawName));
    }
    if (versionId != null) {
      conditions.add('a.version_id=?');
      args.add(versionId);
    }
    final rows = await query(
        'SELECT u.metadata FROM article_lookup a JOIN units u ON u.unit_id=a.unit_id '
        'WHERE ${conditions.join(' AND ')} ORDER BY a.version_id', args);
    final units = rows
        .map((r) => jsonDecode(r['metadata'] as String) as Map<String, dynamic>)
        .toList();
    if (units.isEmpty) return {'status': 'not_found'};
    if (units.length != 1) {
      return {'status': 'ambiguous_version', 'candidates': units};
    }
    return {
      'status': 'found',
      'article': units.single,
      'requested_locator': locator,
      'text_scope': 'complete_original_article',
      'selector_status': 'whole_article_returned_not_independent_clause_extraction',
      'historical_applicability': 'unverified',
      'generative_calls': 0,
    };
  }

  static List<String> _tokens(String text) {
    var s = text.replaceAllMapped(
        RegExp(r'([\u3400-\u9fff])\s+(?=[\u3400-\u9fff])'), (m) => m[1]!);
    // Full-width ASCII normalization, without removing meaningful punctuation.
    s = String.fromCharCodes(s.runes.map((c) =>
        c >= 0xff01 && c <= 0xff5e ? c - 0xfee0 : (c == 0x3000 ? 32 : c)));
    final result = RegExp(r'[a-zA-Z0-9_]+')
        .allMatches(s.toLowerCase())
        .map((m) => m[0]!)
        .toList();
    for (final match in RegExp(r'[\u3400-\u9fff]+').allMatches(s)) {
      final run = match[0]!;
      if (run.length == 1) result.add(run);
      for (var i = 0; i < run.length - 1; i++) {
        result.add(run.substring(i, i + 2));
      }
    }
    return result;
  }

  Future<List<Map<String, dynamic>>> keywords(List<String> words,
      {String? lawId, int limit = 20, bool matchAll = true}) async {
    if (words.isEmpty || words.length > 12 || limit < 1 || limit > 100) {
      throw const FormatException('關鍵字數量或筆數超出範圍');
    }
    final groups = <String>[];
    for (final word in words) {
      if (word.trim().isEmpty || word.length > 100) {
        throw const FormatException('無效關鍵字');
      }
      final tokens = _tokens(word);
      if (tokens.isEmpty) throw const FormatException('無可搜尋字元');
      groups.add('"${tokens.join(' ').replaceAll('"', '""')}"');
    }
    var sql = 'SELECT u.metadata,bm25(articles_fts) AS keyword_score '
        'FROM articles_fts JOIN article_lookup a ON a.unit_id=articles_fts.unit_id '
        'JOIN units u ON u.unit_id=a.unit_id WHERE articles_fts MATCH ?';
    final args = <Object?>[groups.join(matchAll ? ' AND ' : ' OR ')];
    if (lawId != null) {
      sql += ' AND a.law_id=?';
      args.add(lawId.toLowerCase());
    }
    sql += ' ORDER BY bm25(articles_fts) LIMIT ?';
    args.add(limit);
    final rows = await query(sql, args);
    return rows
        .map((r) => {
              'article': jsonDecode(r['metadata'] as String),
              'keyword_score': r['keyword_score'],
            })
        .toList();
  }
}
