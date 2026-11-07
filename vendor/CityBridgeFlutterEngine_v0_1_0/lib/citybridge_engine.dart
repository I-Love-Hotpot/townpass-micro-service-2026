library;

import 'dart:async';
import 'dart:convert';

typedef JsonMap = Map<String, dynamic>;
typedef JsonValidator = void Function(JsonMap value);

JsonMap cloneJson(JsonMap value) => jsonDecode(jsonEncode(value)) as JsonMap;

bool sameJson(dynamic a, dynamic b) {
  if (a is Map && b is Map) {
    return a.length == b.length && a.keys.every((k) => b.containsKey(k) && sameJson(a[k], b[k]));
  }
  if (a is List && b is List) {
    if (a.length != b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (!sameJson(a[i], b[i])) return false;
    }
    return true;
  }
  return a == b;
}

class CancellationToken {
  bool _cancelled = false;
  bool get isCancelled => _cancelled;
  void cancel() => _cancelled = true;
}

class EngineFailure implements Exception {
  EngineFailure(this.code);
  final String code;
}

/// In-process integration seam. Must NOT wrap a localhost/remote HTTP server.
abstract interface class DocumentPipeline {
  String get executionMode; // native or fixture_replay
  Future<void> initialize({required String modelPath, required String dataDirectory});
  Future<JsonMap> analyze(JsonMap input, String requestId, CancellationToken token);
  /// Native implementation must actually interrupt generation and acknowledge it.
  Future<void> cancel(String requestId);
  /// Must not free model memory while a native generation is still using it.
  Future<void> dispose();
}

/// Safe default: no fake success before the iOS pipeline has been ported.
class UnintegratedNativePipeline implements DocumentPipeline {
  @override String get executionMode => 'native';
  @override Future<void> initialize({required String modelPath, required String dataDirectory}) async {
    throw EngineFailure('NATIVE_NOT_INTEGRATED');
  }
  @override Future<JsonMap> analyze(JsonMap input, String requestId, CancellationToken token) async {
    throw EngineFailure('NATIVE_NOT_INTEGRATED');
  }
  @override Future<void> cancel(String requestId) async {}
  @override Future<void> dispose() async {}
}

class CityBridgeEngine {
  CityBridgeEngine({required this.pipeline, required this.validateInput, required this.validateResult});
  final DocumentPipeline pipeline;
  /// The app must supply FULL JSON Schema validators using schemas/input/result.
  final JsonValidator validateInput;
  final JsonValidator validateResult;
  bool _ready = false, _busy = false, _disposed = false;
  String? _requestId;
  CancellationToken? _token;

  Future<void> initialize({required String modelPath, required String dataDirectory}) async {
    if (_disposed || _busy) throw StateError('Engine is disposed or busy');
    if (_ready) return;
    if (modelPath.contains('://') || dataDirectory.contains('://')) {
      throw ArgumentError('Only local filesystem paths are supported');
    }
    _busy = true;
    try {
      await pipeline.initialize(modelPath: modelPath, dataDirectory: dataDirectory);
      _ready = true;
    } finally { _busy = false; }
  }

  JsonMap _response(String id, String status, {JsonMap? result, String? code}) => {
    'engine_version': 'citybridge_engine_v1', 'request_id': id,
    'execution_mode': pipeline.executionMode, 'status': status,
    'verification_status': 'candidate', 'requires_verification': true,
    'result': result,
    'error': code == null ? null : {
      'code': code, 'message': '本機引擎未完成可採用的結果，請核對或稍後重試。',
      'retryable': ['TIMEOUT', 'BUSY', 'MODEL_NOT_LOADED'].contains(code),
    },
  };

  Future<JsonMap> analyze(JsonMap input, {required String requestId,
      Duration timeout = const Duration(seconds: 90)}) async {
    if (_disposed) return _response(requestId, 'failed', code: 'MODEL_NOT_LOADED');
    if (!_ready) return _response(requestId, 'failed', code: 'MODEL_NOT_LOADED');
    if (_busy) return _response(requestId, 'busy', code: 'BUSY');
    if (timeout <= Duration.zero) return _response(requestId, 'failed', code: 'INVALID_INPUT');
    JsonMap payload;
    try {
      payload = cloneJson(input);
      validateInput(payload);
    } catch (_) { return _response(requestId, 'failed', code: 'INVALID_INPUT'); }
    _busy = true; _requestId = requestId; _token = CancellationToken();
    final token = _token!;
    try {
      final work = Future<JsonMap>.sync(() => pipeline.analyze(cloneJson(payload), requestId, token));
      // Keep busy AFTER timeout until the native operation really finishes.
      unawaited(work.then<void>((_) { _busy = false; }, onError: (Object _, StackTrace __) { _busy = false; }));
      final output = await work.timeout(timeout);
      if (token.isCancelled) return _response(requestId, 'cancelled', code: 'CANCELLED');
      try {
        validateResult(output);
        if (!sameJson(output['input'], payload) || output['verification_status'] != 'candidate' ||
            output['requires_verification'] != true || output['workflow'] != null ||
            output['run_info']?['backend'] != 'gemma' || output['run_info']?['embedding_calls'] != 0) {
          throw StateError('Result invariants failed');
        }
      } catch (_) { return _response(requestId, 'failed', code: 'INVALID_RESULT'); }
      return _response(requestId, 'completed', result: cloneJson(output));
    } on TimeoutException {
      token.cancel();
      unawaited(pipeline.cancel(requestId).catchError((Object _) {}));
      return _response(requestId, 'timeout', code: 'TIMEOUT');
    } on EngineFailure catch (e) {
      const accepted = ['NATIVE_NOT_INTEGRATED', 'MODEL_NOT_LOADED', 'MODEL_OUTPUT_INVALID',
        'INPUT_TOO_LONG', 'EVIDENCE_CHECK_FAILED', 'SOURCE_MISMATCH', 'CANCELLED'];
      return _response(requestId, e.code == 'CANCELLED' ? 'cancelled' : 'failed',
          code: accepted.contains(e.code) ? e.code : 'PIPELINE_FAILED');
    } catch (_) { return _response(requestId, 'failed', code: 'PIPELINE_FAILED'); }
    finally {
      // Do not clear busy here: an expired native call may still be running.
      if (!token.isCancelled) { _requestId = null; _token = null; }
    }
  }

  Future<void> cancel() async {
    final id = _requestId;
    _token?.cancel();
    if (id != null) await pipeline.cancel(id);
  }

  Future<void> dispose() async {
    _disposed = true; _ready = false;
    await cancel();
    await pipeline.dispose();
  }
}

/// UI/contract replay ONLY. No Gemma inference; never ship this as native output.
class FixtureReplayPipeline implements DocumentPipeline {
  FixtureReplayPipeline(this.expectedInput, this.recordedResult);
  final JsonMap expectedInput, recordedResult;
  @override String get executionMode => 'fixture_replay';
  @override Future<void> initialize({required String modelPath, required String dataDirectory}) async {}
  @override Future<JsonMap> analyze(JsonMap input, String requestId, CancellationToken token) async {
    if (!sameJson(input, expectedInput)) throw EngineFailure('INVALID_INPUT');
    return cloneJson(recordedResult);
  }
  @override Future<void> cancel(String requestId) async {}
  @override Future<void> dispose() async {}
}
