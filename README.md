# 制作アプリ

制作関連の業務を集約させたWebアプリ。

## セットアップ

```bash
# リポジトリをクローン
git clone https://github.com/MiaKozaki/seiseki-kanri.git
cd seiseki-kanri

# 依存パッケージをインストール
npm install

# 開発サーバー起動
npm run dev
# → http://localhost:5173/seiseki-kanri/

# 本番ビルド
npm run build
# → dist/ フォルダに出力
```

## 技術スタック

| 技術 | 用途 |
|------|------|
| React 18 | UI |
| Vite 5 | ビルドツール |
| Tailwind CSS 3 | スタイリング |
| Recharts | グラフ |
| SheetJS (xlsx) | Excel入出力 |
| mammoth | Word (.docx) プレビュー |
| localStorage | データ永続化 |
| IndexedDB | ファイル添付保存 |

## ディレクトリ構成

```
src/
  App.jsx                          # ルーティング（ロール別ダッシュボード振り分け）
  contexts/
    AuthContext.jsx                 # 認証（localStorage、管理IDでログイン）
    DataContext.jsx                 # 全データCRUD（localStorage）
  pages/
    LoginPage.jsx                  # ログイン画面
    LeaderDashboard.jsx            # リーダー用メインレイアウト
    CorrectorDashboard.jsx         # 作業者用ダッシュボード
  components/
    leader/
      OverviewTab.jsx              # 概要（KPIサマリー）
      TaskAndAssignmentTab.jsx     # 試験種管理（タスクCRUD、CSV/PDF一括登録）
      AssignmentTab.jsx            # 振り分け（自動/手動アサイン、剥がし）
      UserManagementTab.jsx        # 作業者管理（追加/削除、CSV、分野クリア）
      CapacityAnalysisTab.jsx      # 工数分析（グラフ、CSV出力）
      ProgressTab.jsx              # 進捗管理（検証、格納、マクロ放出）
      RecruitmentTab.jsx           # 業務募集
      CorrectorEvaluationTab.jsx   # 作業者評価（評価/FB/作業時間/分類）
      FileMergeTab.jsx             # ファイル統合
      MasterDataTab.jsx            # マスタ管理（差し戻し/チェックリスト/分野/外部作業/マニュアル）
      QuestionManagementTab.jsx    # 質問管理（スレッド形式）
      AiManagementTab.jsx          # AI管理（AIモデル/使用記録/CSV出力）
      LeaderManualTab.jsx          # 使い方ガイド
  utils/
    storage.js                     # localStorage操作、定数定義、初期データ
    autoAssign.js                  # 自動振り分けロジック
    excelExport.js                 # Excel出力（科目別テンプレート対応）
    excelMerge.js                  # Excelファイル統合
    fileStorage.js                 # IndexedDB ファイル保存
    filePreview.js                 # ファイルプレビュー（Excel/Word）
    csvUtils.js                    # CSV入出力ユーティリティ
    evaluationMetrics.js           # 評価メトリクス自動計算
    prediction.js                  # 業務完了予測
    schoolList.js                  # 学校名サジェストリスト
```

## リーダーダッシュボードのタブ（13タブ）

| # | タブ | 内容 |
|---|------|------|
| 1 | 概要 | KPIサマリー、業務完了予測 |
| 2 | 試験種管理 | タスク追加、CSV一括登録、大問情報登録、PDF一括アップロード |
| 3 | 振り分け | 自動/手動アサイン、振り分け解除（剥がし） |
| 4 | 作業者管理 | ユーザーCRUD、CSV一括登録、分野研修クリア管理 |
| 5 | 工数分析 | 日別工数グラフ、期間設定、CSV出力（4種類） |
| 6 | 進捗管理 | 検証フロー、格納確認、マクロタスク自動生成 |
| 7 | 業務募集 | VIKING形式の募集作成・管理 |
| 8 | 作業者評価 | 評価基準/作業者評価/作業時間/分類/FB集約/評価まとめ |
| 9 | ファイル統合 | Excel結合 |
| 10 | マスタ | 差し戻しカテゴリ、チェックリスト、分野、外部作業設定、業務種別、マニュアル |
| 11 | 質問管理 | 作業者からの質問対応（スレッド形式） |
| 12 | AI管理 | AIモデル管理、AI使用記録の集約・分析・CSV出力 |
| 13 | 使い方 | 包括的なヘルプガイド |

## 作業者ダッシュボードのタブ（6タブ）

| # | タブ | 内容 |
|---|------|------|
| 1 | 工数登録 | カレンダー形式で日別工数入力 |
| 2 | 担当業務 | 割当タスク一覧、入力フォーム、大問タイマー、外部作業タイマー、ファイル提出 |
| 3 | 業務募集 | VIKINGタスク取得、募集応募 |
| 4 | 通知 | 承認/差し戻し/FB通知 |
| 5 | 質問 | リーダーへの質問（スレッド形式） |
| 6 | 使い方 | 包括的なヘルプガイド |

## 主要機能

### 科目管理
- 小学国語、小学算数、小学理科、小学社会の4科目
- 科目ごとにフィルタ表示

### 完全ワークフロー（新年度試験種）
```
試験種登録 → 振り分け → 作業者が作成 → 提出 → リーダー検証 → 承認
→ PJ格納確認 → 格納済み → マクロVIKINGタスク自動生成（大問単位）
```

### 分野システム（算数/理科）
- 理科12分野（化学/物理/生物/地学など）、算数30分野
- 分野研修クリア管理（CSV一括登録対応）
- VIKINGタスクの分野制限

### 評価システム
- 素点(basePoints)×段階で自動スコア計算
- 自動計算メトリクス: 差し戻し率、期限遵守率等
- 作業者分類: 通常/優良/要注意/新人

### 外部作業タイマー
- アプリ外で作業するタスク用の手動タイマー
- 開始→一時停止→再開→完了→提出

### AI使用記録
- 作業者が使用したAI（ChatGPT/Gemini/Claude等）の記録
- AIモデル・バージョン管理
- 使用記録の集約・CSV出力

## データモデル（localStorage: seiseki_kanri_v1）

- `users` - ユーザー（role: leader | corrector, managementId, subjects[], employeeId）
- `schools` - 学校マスタ
- `examTypes` - 試験種（schoolId + subject）
- `capacities` - 工数登録（userId, startDate, endDate, hoursPerDay, totalHours）
- `tasks` - タスク（status: pending | assigned | in_progress | submitted | completed, subject, workType, daimonList）
- `assignments` - 振り分け結果（userId, taskId, assignedHours, status, verificationStatus）
- `examInputs` - 入力作業記録（科目別テンプレート、大問リスト内に問リスト埋め込み）
- `evaluationCriteria` - 評価基準マスタ（maxScore, basePoints, subject, autoMetric）
- `evaluations` - 評価スコア（userId, criteriaId, score, autoScore, isOverridden）
- `notifications` - 通知
- `recruitments` - 業務募集
- `applications` - 応募
- `timeLogs` - 作業時間ログ（assignmentId, taskId, userId, daimonId, startTime, endTime, duration）
- `rejectionCategories` - 差し戻しカテゴリ
- `rejectionSeverities` - 差し戻し重大度
- `rejections` - 差し戻し記録
- `verificationItems` - 検証項目
- `verificationResults` - 検証結果
- `feedbacks` - FB（フィードバック）
- `fields` - 分野マスタ（理科・算数の分野定義、リファレンスデータ）
- `userFields` - ユーザー×分野対応
- `workflowStatuses` - ワークフローステータス定義
- `workTypes` - 業務種別マスタ
- `manuals` - マニュアル
- `questions` - 質問
- `questionSettings` - 質問設定
- `externalWorkSettings` - 外部作業設定（科目×業務種別で外部作業フラグ管理）
- `reviewMemos` - レビューメモ
- `aiModels` - AIモデルマスタ（モデル名、バージョン情報）
- `aiUsageLogs` - AI使用記録（userId, modelId, taskId, purpose, timestamp）
- `aiUsageSettings` - AI使用記録設定

## データ保存

- **localStorage** (`seiseki_kanri_v1`) にJSON形式で保存
- **IndexedDB** (`seiseki_kanri_files`) に添付ファイルを保存
- ブラウザをまたいでデータは共有されない（サーバー未使用）
- データリセット: ブラウザのコンソールで `localStorage.removeItem('seiseki_kanri_v1'); location.reload();`

## デプロイ

### GitHub Pages
```bash
npm run build
npx gh-pages -d dist
```

### Netlify
`npm run build` → `dist/` フォルダをドラッグ&ドロップ
