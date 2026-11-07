# 資料清單與來源狀態

本包的SQLite是從原v2資料另外匯出的新檔，不覆蓋原檔。units內原始metadata／text逐筆相同；只保留法條索引與FTS，不帶任何向量或切片資料表。

| 資料 | 筆數 | 用途／限制 |
|---|---:|---|
| 中央法規原文單位 | 1,075 | 10部法規；含刪除佔位，須依標記處理 |
| article_lookup／articles_fts | 各1,075 | 精確條號及中文字面搜尋，不是Embedding |
| 租金補貼FAQ | 60 | 只有租補，沒有交通FAQ |
| 臺北候選服務／SOP | 各2 | reference_only，不作交通導引 |
| 交通條例candidate JSON | 134 | 精確版本及白話稿綁定參考 |
| 第45條candidate白話稿 | 1套 | 完整原文與共同前提；不是verified |

來源與日期、機關、source_url、raw_hash、version_id保留於SQLite metadata；sources.json及data_manifest.json另保留資料集與權利狀態。法律來源為法務部中文法規資料集18289／18290，原metadata標示OGDL-Taiwan-1.0。租補FAQ為官方網站資訊，原資料的Open Data授權尚未確認，該狀態原樣保留，不冒稱已核可授權。

來源包內既有source-level verified_units或verification說明不會升格為逐筆適用性核可。所有引擎輸出與資料manifest仍採candidate。原始全國法規ZIP及全部來源附件不附包，保留來源網址與雜湊供追溯。

data/reference_only中兩套臺北SOP維持原candidate狀態，沒有重新核對官方版本，也沒有將內部辦理步驟轉成民眾行動。現行result仍必須government_services=not_matched、workflow=null。

fixtures中的姓名、住址、車牌、通知識別碼與原OCR網址已替換；這些是去識別化衍生副本，不修改原demo.json／demo2.json。錄製輸出只保留作畫面／契約案例，不能當去識別輸入的重新推論結果。

models/model_manifest.json只記錄指定Gemma檔案及來源，不含權重。接收方另交付／安裝權重時，應連同原模型條款與通知，不能將政府資料的授權套用到模型權重或第三方native runtime。
