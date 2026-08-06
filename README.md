# WORKNOTE v13

## 主な機能
- v12のMTG、日報、通知、メモ、タスク、カレンダー機能を維持
- AI副店長補佐をGemini API中継方式へ変更
- Cloudflare Worker経由でGemini APIキーを安全に管理
- Gemini接続テストと接続状態表示
- Gemini通信失敗時も端末内スマート管理を継続
- 日報・MTG・メモ保存時の自動分析
- AIチャットによる認識修正と運用ルール記憶
- Worker側でメールアドレス・電話番号・長い識別番号を簡易マスキング

## 重要
Gemini APIキーをWORKNOTEやGitHubへ直接入れないでください。`server/SETUP.md`に従ってCloudflare WorkerのSecretへ保存してください。
