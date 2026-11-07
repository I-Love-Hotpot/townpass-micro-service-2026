# Gemma 4 E4B 地端摘要

電腦端 Python 3.9+ CLI 原型，使用標準函式庫，兩條路徑共用 `gemma4:e4b-it-q4_K_M`。

- `text`：文字 → 摘要。
- `image`：圖片 → 逐字轉錄 → 依轉錄文字摘要，JSON 保留原文與各階段耗時。
- `ocr`：只轉錄圖片，供人工修正後再跑 `text`。

## 啟動

安裝最新版 [Ollama](https://ollama.com/download)，在 `local-inference` 目錄執行 `sh serve.sh`（若已有其他 Ollama 服務，請先關閉以避免連錯模型目錄），另開終端：

```sh
ollama pull gemma4:e4b-it-q4_K_M
cd local-inference
python3 govclear.py text examples/notice.txt
python3 govclear.py image /absolute/path/notice.jpg
```

先核對辨識文字再摘要：

```sh
python3 govclear.py ocr /absolute/path/notice.jpg > corrected.txt
# 使用編輯器核對並修改 corrected.txt
python3 govclear.py text corrected.txt
```

輸出包含私人原文，請勿提交 Git。程式預設只輸出至終端，不主動保存內容。下載權重需網路；推論固定呼叫 `127.0.0.1:11434`、停用 HTTP proxy、拒絕 HTTP 重新導向，沒有雲端備援。Ollama 應使用本機模型、僅綁定 loopback。下載完成後可斷網驗收。

## 限制

每次一張 PNG / JPEG（20 MB 內），文字最多 6000 字元；PDF / HEIC 需先在本機轉換。字元上限是保守限制，非精確 tokenizer 預算。圖片辨識可能誤讀日期、表格、小字與印章；請核對 `source_text`。摘要保留原文日期、金額與條件，缺漏標示待確認，但提示詞不能保證無幻覺。

這是電腦地端 PoC，尚未整合 Vue、Flutter 或 iPhone。不應放在共用後端提供私人文件推論。iOS 仍需驗證相容的模型 runtime、視覺編碼器、量化、記憶體與效能；E4B 不代表完整權重只有 4B 參數。此版不提供證據座標、可信度分數或個人資格判定。

## 測試

```sh
python3 -m unittest discover -s tests -v
```

測試替身只驗證資料流與錯誤處理，不代表真實模型準確率。實機應用同一份合成通知的文字、清晰圖片、模糊圖片，逐一核對期限、金額、條件與例外。

參考：[模型](https://ollama.com/library/gemma4:e4b-it-q4_K_M)、[Chat API](https://docs.ollama.com/api/chat)。

本 PoC 固定使用 E4B 的 Q4_K_M 量化版本（約 6.6 GB，含視覺相關檔案），避免預設標籤在不同平台選到不同格式。

## 同機實測

本次模型儲存在 `.runtime/models`，由 `serve.sh` 啟動的本機服務載入。執行 `python3 smoke.py` 會比較同一份合成通知的文字與圖片，輸出至 Git 已忽略的 `results/`。詞彙存在檢查只是初步訊號，仍需人工核對摘要是否正確表達條件。

## 完整 TownPass 一鍵測試

從微服務根目錄執行 `python3 local-inference/prepare_simulator.py --run`，或在根工作區 VS Code 選「TownPass + GovClear 微服務（一鍵測試）」按 F5。會自動準備本機模型、Vue、模擬器與相簿樣本。完整入口測試使用 `--test`。詳見 [微服務與容器說明](../docs/govclear-webview.md)。

摘要已更新為精簡白話版，與微服務共用 `frontend/src/assets/govclear/summary-policy.txt` 與 `summary-review-policy.txt`。超過 300 字會增加一次原文核對推論；參見 [規則與實測](../docs/govclear-summary.md)。
