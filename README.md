# WORKNOTE v14

## 更新内容
- Gemini APIをCloudflare Workerなしでアプリから直接利用可能
- 設定画面でGemini APIキーを入力・端末内に保存
- 推奨モデルを `gemini-3.1-flash-lite` に更新
- 接続テスト、日報・MTG・メモ分析、AIチャットを直接接続へ変更
- APIキーはバックアップJSONに含めず、GitHubへ保存しない設計
- Gemini未設定・通信失敗時も端末内スマート管理を継続

## 注意
直接接続ではAPIキーが利用端末のブラウザ内に保存されます。共有端末では使用しないでください。
