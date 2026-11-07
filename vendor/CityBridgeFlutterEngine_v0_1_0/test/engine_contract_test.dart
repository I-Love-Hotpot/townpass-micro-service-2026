import 'dart:async';
import 'dart:convert';
import 'dart:io';
import '../lib/citybridge_engine.dart';

void check(bool value, String message) { if (!value) throw StateError(message); }
// Fixture validators only; production adapter must validate the complete Schemas.
void inputValidator(JsonMap x) { if (x['schemaVersion'] != 1 || x['sourceText'] is! String) throw FormatException('input'); }
void resultValidator(JsonMap x) { if (x['schema_version'] != 'citybridge_compact_result_v1') throw FormatException('result'); }

class DelayedPipeline implements DocumentPipeline {
  final completer = Completer<JsonMap>();
  bool cancelled = false;
  @override String get executionMode => 'native';
  @override Future<void> initialize({required String modelPath, required String dataDirectory}) async {}
  @override Future<JsonMap> analyze(JsonMap input, String id, CancellationToken token) => completer.future;
  @override Future<void> cancel(String id) async { cancelled = true; }
  @override Future<void> dispose() async {}
}

Future<void> main() async {
  final input = jsonDecode(File('fixtures/demo1/input.json').readAsStringSync()) as JsonMap;
  final result = jsonDecode(File('fixtures/demo1/recorded_result.json').readAsStringSync()) as JsonMap;
  final engine = CityBridgeEngine(pipeline: FixtureReplayPipeline(input, result), validateInput: inputValidator, validateResult: resultValidator);
  check((await engine.analyze(input, requestId: 'fixture-0'))['error']['code'] == 'MODEL_NOT_LOADED', 'not loaded');
  await engine.initialize(modelPath: 'fixture-no-model', dataDirectory: 'assets/data');
  final response = await engine.analyze(input, requestId: 'fixture-1');
  check(response['status'] == 'completed' && response['execution_mode'] == 'fixture_replay', 'replay explicitly labeled');
  check(sameJson(response['result']['input'], input), 'input retained');
  check((await engine.analyze({'schemaVersion': 99}, requestId: 'fixture-2'))['error']['code'] == 'INVALID_INPUT', 'invalid input');
  final bad = cloneJson(result); bad['workflow'] = {'action': 'unsafe'};
  final badEngine = CityBridgeEngine(pipeline: FixtureReplayPipeline(input, bad), validateInput: inputValidator, validateResult: resultValidator);
  await badEngine.initialize(modelPath: 'fixture', dataDirectory: 'assets/data');
  check((await badEngine.analyze(input, requestId: 'fixture-3'))['error']['code'] == 'INVALID_RESULT', 'actions fail closed');
  final delayed = DelayedPipeline();
  final slow = CityBridgeEngine(pipeline: delayed, validateInput: inputValidator, validateResult: resultValidator);
  await slow.initialize(modelPath: 'fixture', dataDirectory: 'assets/data');
  final timed = await slow.analyze(input, requestId: 'fixture-4', timeout: const Duration(milliseconds: 5));
  check(timed['status'] == 'timeout' && delayed.cancelled, 'timeout requests cancellation');
  check((await slow.analyze(input, requestId: 'fixture-5'))['status'] == 'busy', 'native still active remains busy');
  delayed.completer.complete(result); await Future<void>.delayed(Duration.zero);
  final missing = UnintegratedNativePipeline();
  try { await missing.initialize(modelPath: 'model.gguf', dataDirectory: 'assets/data'); throw StateError('missing native must fail'); }
  on EngineFailure catch (e) { check(e.code == 'NATIVE_NOT_INTEGRATED', 'explicit native gap'); }
  await engine.dispose(); await badEngine.dispose(); await slow.dispose();
  print('Engine contract checks passed: replay, input retention, not-loaded, invalid-input, guard, timeout, busy and missing-native. No model inference.');
}
