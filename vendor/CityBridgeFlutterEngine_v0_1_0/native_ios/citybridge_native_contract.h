#pragma once
#ifdef __cplusplus
extern "C" {
#endif
/* ABI DESIGN ONLY: no implementation or compiled iOS library is included.
 * All model/data paths are local files. Implement on a background native queue.
 * No HTTP server, network inference, BGE or embedding model is allowed.
 * Return UTF-8 engine response JSON; free with cb_free_result, never Dart free.
 * Tokenize/check total context before generation. Enforce guards before result.
 * Cancellation must be acknowledged before releasing a live model context.
 */
typedef void* cb_engine;
typedef void (*cb_completion)(const char* response_json_utf8, void* user_data);
cb_engine cb_initialize(const char* model_path, const char* data_directory);
void cb_analyze(cb_engine engine, const char* input_json_utf8,
                const char* request_id, cb_completion completion, void* user_data);
void cb_cancel(cb_engine engine, const char* request_id);
void cb_free_result(const char* response_json_utf8);
void cb_dispose(cb_engine engine);
#ifdef __cplusplus
}
#endif
