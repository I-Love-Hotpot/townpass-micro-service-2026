import 'dart:convert';
import 'dart:io';
import '../lib/citybridge_engine.dart';

Future<void> main() async {
  final input = jsonDecode(File('fixtures/demo1/input.json').readAsStringSync()) as JsonMap;
  final recorded = jsonDecode(File('fixtures/demo1/recorded_result.json').readAsStringSync()) as JsonMap;
  final engine = CityBridgeEngine(
    pipeline: FixtureReplayPipeline(input, recorded),
    // Exact fixture checks only. Native use requires full JSON Schema validators.
    validateInput: (x) { if (!sameJson(x, input)) throw FormatException('Fixture input mismatch'); },
    validateResult: (x) { if (!sameJson(x, recorded)) throw FormatException('Fixture result mismatch'); },
  );
  await engine.initialize(modelPath: 'fixture-no-model-loaded', dataDirectory: 'assets/data');
  final result = await engine.analyze(input, requestId: 'offline-fixture-example');
  stdout.writeln(const JsonEncoder.withIndent('  ').convert(result));
  await engine.dispose();
}
