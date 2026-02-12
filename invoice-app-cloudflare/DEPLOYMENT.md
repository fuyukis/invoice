# 請求書アプリ - Cloudflare Pages デプロイガイド

## 📋 概要
このアプリをCloudflare Pagesにデプロイして、サーバーレスで動作する請求書管理システムを構築します。

**特徴:**
- ✅ 無料で始められる（月10万リクエストまで無料）
- ✅ グローバルCDN - 世界中どこでも高速
- ✅ 自動スケーリング
- ✅ データベース付き（Cloudflare D1）

---

## 🚀 デプロイ手順

### ステップ1: Cloudflareアカウント作成
1. https://dash.cloudflare.com/sign-up にアクセス
2. メールアドレスで無料アカウント作成
3. メール認証を完了

### ステップ2: GitHubにコードをアップロード
```bash
# 1. GitHubでリポジトリを作成
#    https://github.com/new

# 2. ローカルでGit初期化
cd invoice-app-cloudflare
git init
git add .
git commit -m "Initial commit"

# 3. GitHubにプッシュ
git remote add origin https://github.com/YOUR_USERNAME/invoice-app.git
git branch -M main
git push -u origin main
```

### ステップ3: Cloudflare Pagesでデプロイ
1. Cloudflareダッシュボードにログイン
2. 左メニューから「Workers & Pages」を選択
3. 「Create application」→「Pages」→「Connect to Git」
4. GitHubを接続
5. リポジトリを選択
6. ビルド設定:
   - **Framework preset:** None
   - **Build command:** (空欄)
   - **Build output directory:** /
7. 「Save and Deploy」をクリック

### ステップ4: D1データベースの作成
```bash
# Wrangler CLI をインストール
npm install -g wrangler

# Cloudflareにログイン
wrangler login

# D1データベースを作成
wrangler d1 create invoice-db

# 出力されたdatabase_idをコピー
# 例: database_id = "xxxx-xxxx-xxxx-xxxx"
```

### ステップ5: データベースIDを設定
1. `wrangler.toml` ファイルを開く
2. `database_id = "YOUR_DATABASE_ID_HERE"` を実際のIDに置き換え
3. GitHubにプッシュ
```bash
git add wrangler.toml
git commit -m "Add database ID"
git push
```

### ステップ6: データベーススキーマを適用
```bash
# ローカルからスキーマを適用
wrangler d1 execute invoice-db --file=./schema.sql --remote
```

### ステップ7: Pagesとデータベースを接続
1. Cloudflareダッシュボード → Pages → あなたのプロジェクト
2. 「Settings」→「Functions」
3. 「D1 database bindings」セクション
4. 「Add binding」をクリック:
   - Variable name: `DB`
   - D1 database: `invoice-db` を選択
5. 「Save」

### ステップ8: 再デプロイ
1. GitHubで何か小さな変更をしてプッシュ
2. 自動的に再デプロイされます

---

## 🎉 完成！

デプロイが完了すると、以下のようなURLでアクセスできます:
```
https://invoice-app-xxx.pages.dev
```

### デモアカウントでログイン
- Email: `demo@example.com`
- Password: `demo123`

---

## 📊 料金について

### Cloudflare Pages（無料枠）
- ✅ 月500回のビルド
- ✅ 無制限の帯域幅
- ✅ 無制限のリクエスト

### Cloudflare D1（無料枠）
- ✅ 5GBのストレージ
- ✅ 1日500万回の読み取り
- ✅ 1日10万回の書き込み

**実用的な目安:**
- 小規模ビジネス（月100件の請求書）→ 完全無料
- 中規模ビジネス（月1000件）→ 無料または月$5程度

---

## 🔧 カスタマイズ

### 会社情報の変更
`index.html` の以下の部分を編集:
```javascript
const COMPANY_INFO = {
  ja: {
    name: '合同会社Snowisland9',  // ← ここを変更
    address: '...',
    // ...
  }
}
```

### 機能追加
- PDF自動生成
- メール送信
- 請求書テンプレート
などは、別途実装可能です。

---

## 🐛 トラブルシューティング

### デプロイが失敗する
→ `wrangler.toml` のdatabase_idが正しいか確認

### ログインできない
→ データベースのスキーマが適用されているか確認
```bash
wrangler d1 execute invoice-db --command="SELECT * FROM users" --remote
```

### データが保存されない
→ Pages設定でD1バインディングが設定されているか確認

---

## 📚 次のステップ

1. **独自ドメインを設定**
   - Pages設定 → Custom domains

2. **本番用パスワードハッシュの実装**
   - bcryptなどの適切なライブラリを使用

3. **メール送信機能の追加**
   - Cloudflare Email Workers使用

4. **PDF生成機能**
   - Puppeteer Cloudflare Workers版を使用

---

## 💡 サポート

質問があれば、このチャットで聞いてください！
Cloudflareの公式ドキュメント: https://developers.cloudflare.com/pages/
