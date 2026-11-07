# 測試資料怎麼進入介面

此資料夾是本機測試資料來源。新增 PNG / JPG / JPEG 後，按 F5 的一鍵測試設定會將圖片同步到 iPhone 模擬器相簿，不限制檔名前綴，支援中文、空格與大小寫副檔名。單張上限 20 MB。

App 已在運行時，可以在微服務根目錄執行：

```sh
python3 local-inference/prepare_simulator.py --sync-examples
```

或在 VS Code「執行工作」選「GovClear: 匯入自訂測試圖片」。不需要重新建置 Flutter。若相簿選擇器已開啟，關閉後重新開啟以更新清單。

匯入後到「圖片摘要 → 從相簿選擇（可多選）」選擇自訂圖片。未變更的圖片不會重複匯入；圖片內容變更後再同步會加入新版，舊照片不會自動刪除。

介面上的「載入範例」只會加入前端內建的 notice.png 與 notice-page2.png，並不掃描本資料夾；新增圖片也不會自動加入前端發布資產。

UTF-8 文字檔可用文字摘要 CLI 測試（在 local-inference 目錄執行），或複製貼到 App 的文字摘要欄位：

```sh
python3 govclear.py text examples/notice.txt
```

本版相簿同步只處理 PNG / JPEG；PDF、HEIC、非圖片及空檔不會作為圖片匯入。
