# WORKNOTE v13 Gemini連携設定

WORKNOTE本体はAPI未設定でも「端末内スマート管理」で動作します。Gemini連携を有効にすると、日報分析、MTG整理、スタッフ育成案、店長報告、週報、AIチャットをより文脈に沿って自動作成します。

## 1. Gemini APIキーを作成
Google AI StudioでGemini APIキーを作成します。

## 2. Cloudflare Workerを作成
Cloudflareの「Workers & Pages」から新しいWorkerを作り、`cloudflare-worker.js`の内容へ置き換えてデプロイします。

## 3. Variables and Secretsを設定
Workerの「Settings → Variables and Secrets」で以下を追加します。

### Secret
- 名前: `GEMINI_API_KEY`
- 値: Google AI Studioで作成したAPIキー

### 通常Variable（任意）
- 名前: `GEMINI_MODEL`
- 値: `gemini-3.5-flash-lite`

### 通常Variable（推奨）
- 名前: `ALLOWED_ORIGIN`
- 値: `https://haru604.github.io`

独自ドメインや別のGitHub Pages URLを使う場合は、そのオリジンに変更してください。末尾の `/worknote/` は不要です。

## 4. WORKNOTEへ接続
1. WORKNOTEを開く
2. 設定 → AI副店長補佐
3. 動作モードを「Gemini連携」へ変更
4. Worker URLを「安全なAPI中継URL」へ入力
5. 「接続だけテスト」を押す
6. 「接続済み」と表示されたら保存して分析

## 注意
- Gemini APIキーをWORKNOTE、GitHub、HTML、JavaScriptへ直接書かないでください。
- 顧客の氏名、電話番号、住所、契約番号などは記録しないでください。
- Gemini無料枠の上限や対象モデルはGoogle側で変更される場合があります。
