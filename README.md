# 制作工数管理システム

添削業務の工数振り分け・進捗管理・評価を一元管理するWebアプリ。

**デモ: https://miakozaki.github.io/seiseki-kanri/**

---

## ⚠️ デプロイ前に必ず確認してください

| 制約 | 内容 |
|------|------|
| **データ共有不可** | データはブラウザの localStorage / IndexedDB に保存。**別のブラウザ・別のPCからは見えない** |
| **同時利用不可** | 複数ユーザーがリアルタイムに同じデータを操作する機能はない（バックエンドなし） |
| **パスワード管理** | パスワードは `btoa()` エンコードのみ（暗号化なし）。本番利用には不向き |
| **データ永続化** | ブラウザのデータ削除・キャッシュクリアでデータが消える |

**→ 1台のPCで1人のリーダーが管理する用途、またはデモ・検証用途に適しています。**

---

## このアプリでできること

### リーダー（管理者）
- 試験種（タスク）の登録・管理
- 添削者への工数振り分け（自動 / 手動）
- 進捗管理・検証・差し戻し・フィードバック
- 工数分析・業務完了予測
- 添削者の評価（手動スコア + 自動メトリクス）
- 業務募集・応募管理
- 複数 Excel ファイルの結合・ダウンロード
- 質問対応
- マスタ管理（学校・評価基準・分野・業務種別など）

### 添削者
- 工数（稼働時間）の登録
- 担当タスクの確認・ステータス更新
- 試験入力フォームへの入力（大問 → 問 → 枝問 の3階層）
- 大問タイマー・外部作業タイマーによる作業時間の自動計測
- Excel出力（科目別テンプレート）
- ファイル添付・ダウンロード
- 業務募集への応募
- リーダーへの質問送信・回答確認

---

## 対象科目・業務種別

カスタマイズ可能です（後述）。初期値は以下のとおり：

- **科目**: 小学国語 / 小学算数 / 小学理科 / 小学社会
- **業務種別**: 新年度試験種 / タグ付け / 解答出し / 部分点 / tensakitインポート / takos作成 / マクロ

---

## セットアップ

```bash
git clone https://github.com/MiaKozaki/seiseki-kanri.git
cd seiseki-kanri
npm install
npm run dev  # → http://localhost:5173/seiseki-kanri/
```

### テストアカウント（パスワード共通: `password`）

| 管理ID | メール | ロール |
|--------|--------|--------|
| 100001 | leader@test.com | リーダー（全科目） |
| 100002 | sato-leader@test.com | リーダー（国語・社会） |
| 200001 | yamada@test.com | 添削者 |
| 200002 | suzuki@test.com | 添削者 |
| 200003 | sato@test.com | 添削者 |
| 200004 | mtanaka@test.com | 添削者 |

---

## デプロイ

```bash
npm run build
# dist/ フォルダを Netlify / GitHub Pages などの静的ホスティングにアップロード
```

> **GitHub Pages にデプロイする場合**: `vite.config.js` の `base` をリポジトリ名に合わせてください。
> ```js
> base: '/your-repo-name/',
> ```

---

## カスタマイズ方法

### アプリ名を変える

以下のファイルの「制作アプリ」を置き換えてください：

| ファイル | 箇所 |
|----------|------|
| `index.html` | `<title>` タグ |
| `src/pages/LoginPage.jsx` | ログイン画面のタイトル |
| `src/pages/LeaderDashboard.jsx` | 使い方タブの説明文 |
| `src/pages/CorrectorDashboard.jsx` | 使い方タブの説明文 |

### 科目・業務種別を変える

`src/utils/storage.js` の定数を編集してください：

```js
export const SUBJECTS_LIST = ['小学国語', '小学算数', '小学理科', '小学社会'];
export const WORK_TYPES_LIST = ['新年度試験種', 'タグ付け', '解答出し', '部分点', ...];
```

> ⚠️ 科目ごとに入力フォームの項目が変わる（国語は文種・出典・著者、理科はテーマなど）。
> 科目名を変えるだけなら問題ないが、科目を追加して専用フォームを作る場合は
> `CorrectorDashboard.jsx` の入力フォーム部分も修正が必要。

### 初期データを変える

`src/utils/storage.js` の `getInitialData()` 関数内に学校・タスク・ユーザー等の初期データがあります。
**初回起動時のみ** localStorage に書き込まれます。データを変えたい場合はブラウザの localStorage をクリアしてから再起動してください。

---

## 技術スタック

| ライブラリ | 用途 |
|-----------|------|
| React 18 + Vite 5 | SPAフレームワーク |
| Tailwind CSS 3 | スタイリング |
| Recharts | グラフ描画 |
| lucide-react | アイコン |
| xlsx-js-style | Excel出力（スタイル付き） |
| xlsx | Excel プレビュー |
| mammoth | Word ファイルプレビュー |

**バックエンドなし。データ保存は localStorage + IndexedDB のみ。**

---

## ディレクトリ構成

```
src/
  App.jsx                          # ルーティング（ロール別ダッシュボード振り分け）
  contexts/
    AuthContext.jsx                 # 認証（localStorage）
    DataContext.jsx                 # 全データ CRUD
  components/
    leader/
      AssignmentTab.jsx             # 振り分けタブ
      ProgressTab.jsx               # 進捗管理タブ
  pages/
    LoginPage.jsx                   # ログイン画面
    LeaderDashboard.jsx             # リーダー用（12タブ）
    CorrectorDashboard.jsx          # 添削者用（6タブ）
  utils/
    storage.js                      # localStorage 操作・初期データ・定数
    autoAssign.js                   # 自動振り分けロジック
    excelExport.js                  # Excel 出力
    excelMerge.js                   # Excel ファイル統合
    csvUtils.js                     # CSV 入出力・バリデーション
    evaluationMetrics.js            # 評価メトリクス自動計算
    prediction.js                   # タスク完了予測
    fileStorage.js                  # ファイル添付（IndexedDB）
    filePreview.js                  # ファイルプレビュー（Excel・Word）
    schoolList.js                   # 学校名サジェストリスト
```
