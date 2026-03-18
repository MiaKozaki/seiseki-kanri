# 添削工数管理システム

## プロジェクト概要
添削業務のリーダーが添削者への工数振り分けを管理するWebアプリ。

## 技術スタック
- React 18 + Vite + Tailwind CSS + Recharts
- データ保存: **localStorage**（バックエンドなし）
- パッケージマネージャー: npm

## 起動方法
```bash
cd /Users/mia/Desktop/seiseki-kanri
npm run dev  # → http://localhost:5173
```

## テストアカウント（パスワード共通: password）
| ロール | ログインID | メール | 担当科目 |
|--------|-----------|--------|----------|
| リーダー | L001 | leader@test.com | 算数, マクロ |
| リーダー | L002 | sato-leader@test.com | 国語, 社会 |
| リーダー | L003 | suzuki-leader@test.com | 理科 |
| 添削者 | T001 | yamada@test.com | 国語, 算数 |
| 添削者 | T002 | suzuki@test.com | 算数, 理科 |
| 添削者 | T003 | sato@test.com | 国語, 社会 |
| 添削者 | T004 | mtanaka@test.com | 理科, 社会, 国語 |

## ディレクトリ構成
```
src/
  App.jsx                  # ルーティング（ロール別ダッシュボード振り分け）
  contexts/
    AuthContext.jsx         # 認証（localStorage）
    DataContext.jsx         # 全データCRUD
    SheetsContext.jsx       # Google Sheets連携（オプション）
  pages/
    LoginPage.jsx           # ログイン画面
    LeaderDashboard.jsx     # リーダー用（7タブ）
    CorrectorDashboard.jsx  # 添削者用
  utils/
    storage.js              # localStorage操作 + 初期データ
    autoAssign.js           # 自動振り分けロジック
    excelExport.js          # Excel出力
    sheetsApi.js            # Google Sheets API
```

## リーダーダッシュボードのタブ
1. 概要 - KPIサマリー、円グラフ
2. 工数分析 - 棒グラフ、キャパシティ管理
3. 試験種管理 - タスク一覧・追加・削除
4. 振り分け - 自動/手動アサイン
5. 評価管理 - 添削者評価（スター）
6. 作業者管理 - ユーザー追加・削除
7. マスタ - 学校・試験種・評価基準管理

## データモデル（localStorage: seiseki_kanri_v1）
- `users` - ユーザー（role: leader | corrector）
- `schools` - 学校マスタ
- `examTypes` - 試験種（schoolId + subject）
- `capacities` - 工数登録（userId, startDate, endDate, hoursPerDay）
- `tasks` - 試験種タスク（status: pending | assigned | completed）
- `assignments` - 振り分け結果
- `examInputs` - 入力作業記録
- `evaluationCriteria` - 評価基準マスタ
- `evaluations` - 評価スコア
- `notifications` - 通知

## 注意事項
- データはブラウザのlocalStorageに保存。**ブラウザをまたいでデータは共有されない**
- デプロイ先: Netlify（`npm run build` → distフォルダをドラッグ&ドロップ）
- パスワードはbtoa()でエンコード（本番用途には不向き、デモ用）

## 次にやりたいこと（未実装・検討中）
- （ここに追記していく）
