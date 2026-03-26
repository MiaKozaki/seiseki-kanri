# 制作アプリ

## プロジェクト概要
制作業務を全てアプリ内に集約させるWebアプリ。リーダーが作業者への工数振り分け・進捗管理・評価を一元管理する。

## 技術スタック
- React 18 + Vite + Tailwind CSS + Recharts
- データ保存: **localStorage**（バックエンドなし）
- Excel出力: xlsx-js-style
- パッケージマネージャー: npm

## 起動方法
```bash
cd /Users/mia/Desktop/seiseki-kanri
npm run dev  # → http://localhost:5173
```

## テストアカウント
初期データは空。管理画面からユーザーを登録して使用する。

## ディレクトリ構成
```
src/
  App.jsx                        # ルーティング（ロール別ダッシュボード振り分け）
  contexts/
    AuthContext.jsx               # 認証（localStorage）
    DataContext.jsx               # 全データCRUD
  components/
    leader/
      OverviewTab.jsx             # 概要（KPIサマリー）
      TaskAndAssignmentTab.jsx    # 試験種管理（タスクCRUD、CSV/PDF一括登録）
      AssignmentTab.jsx           # 振り分け（自動/手動アサイン、剥がし）
      UserManagementTab.jsx       # 作業者管理（追加/削除、CSV、分野クリア）
      CapacityAnalysisTab.jsx     # 工数分析（グラフ、CSV出力）
      ProgressTab.jsx             # 進捗管理（検証、格納、マクロ放出）
      RecruitmentTab.jsx          # 業務募集
      CorrectorEvaluationTab.jsx  # 作業者評価（評価/FB/作業時間/分類）
      FileMergeTab.jsx            # ファイル統合
      MasterDataTab.jsx           # マスタ管理（差し戻し/チェックリスト/分野/外部作業/マニュアル）
      QuestionManagementTab.jsx   # 質問管理（スレッド形式）
      AiManagementTab.jsx         # AI管理（AIモデル/使用記録/CSV出力）
      LeaderManualTab.jsx         # 使い方ガイド
  pages/
    LoginPage.jsx                 # ログイン画面
    LeaderDashboard.jsx           # リーダー用（13タブ）
    CorrectorDashboard.jsx        # 作業者用（6タブ）
  utils/
    storage.js                    # localStorage操作 + 初期データ + マイグレーション
    autoAssign.js                 # 自動振り分けロジック
    excelExport.js                # Excel出力（科目別テンプレート対応）
    excelMerge.js                 # Excelファイル統合
    csvUtils.js                   # CSV入出力 + バリデーション
    evaluationMetrics.js          # 評価メトリクス自動計算
    prediction.js                 # タスク完了予測
    fileStorage.js                # ファイル添付（IndexedDB）
    filePreview.js                # ファイルプレビュー
    schoolList.js                 # 学校名サジェストリスト
```

## リーダーダッシュボードのタブ（13タブ）
1. 概要 - KPIサマリー、業務完了予測
2. 試験種管理 - タスク一覧・追加・削除・CSV一括登録・PDF一括アップロード
3. 振り分け - 自動/手動アサイン・振り分け解除（剥がし）
4. 作業者管理 - ユーザー追加・削除・CSV登録・分野研修クリア管理
5. 工数分析 - 日別チャート・月間工数履歴・CSV出力（4種類）
6. 進捗管理 - タスク進捗・検証・差し戻し・格納確認・マクロタスク自動生成
7. 業務募集 - 作業者向け業務公開・VIKING管理
8. 作業者評価 - 評価基準管理・スコア入力・作業時間分析・FB集約・素点（basePoints）システム・作業者分類・評価まとめ
9. ファイル統合 - Excel結合ツール
10. マスタ - 差し戻しカテゴリ・チェックリスト・分野・外部作業設定・業務種別・マニュアル管理
11. 質問管理 - 作業者からの質問対応（スレッド形式）
12. AI管理 - AI使用記録の集約・分析・CSV出力・AIモデル管理
13. 使い方 - ヘルプガイド

## 作業者ダッシュボードのタブ（6タブ）
1. 工数登録 - 工数入力
2. 担当業務 - 割当タスク・入力フォーム・大問タイマー・外部作業タイマー
3. 業務募集 - 募集中業務への応募
4. 通知 - リーダーからの通知
5. 質問 - リーダーへの質問送信
6. 使い方 - ヘルプガイド

## 科目一覧・業務種別
- 科目: 小学国語, 小学算数, 小学理科, 小学社会
- 業務種別: 新年度試験種, タグ付け, 解答出し, 部分点, tensakitインポート, takos作成, マクロ

## 完全ワークフロー
```
試験種登録 → 振り分け → 作業者が作成 → 提出 → リーダー検証 → 承認
→ PJ格納確認 → 格納済み → マクロVIKINGタスク自動生成（大問単位）
```

## 入力フォーム表示条件
- 入力フォーム（大問・満点等の入力UI）は **新年度試験種 かつ 小学算数/小学理科/小学社会** のみ
- マクロタスクおよびその他の組み合わせは外部作業タイマー（手動タイマー）フローを使用

## 科目別入力フォームテンプレート
- **算数**: 年度, 学校名, 回数, 科目, 大問, 大問ごとの満点, 試験時間
- **理科**: 年度, 学校名, 回数, 科目, 大問, 大問ごとの満点, テーマ, 試験時間
- **社会**: 年度, 学校名, 回数, 科目, 大問, 大問ごとの満点（試験時間なし）
- **国語**: 年度, 学校名, 回数, 科目, 大問, 大問ごとの満点, 文種, 出典, 著者

## 大問管理（3段階構造）
- **大問** → 問（小問）→ 枝問（最下層・回答データ）
- 科目固有フィールド:
  - 国語: 文種・出典・著者、採点基準（項目+付記の多段構造）
  - 算数: 解答画像・解説画像、完答・順不同・別解
  - 理科: テーマ、条件指定要素、採点基準テキスト
  - 社会: 条件指定、不可解答

## 格納フロー（markAsStored）
- 新年度試験種のタスクが承認（approved）後、「格納済みにする」ボタンで格納確認
- 格納時にバリデーション: 大問情報（daimons）が必須、各大問にtakosLinkが必須
- 格納するとVIKING用マクロタスクが大問ごとに自動生成される

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
- `workflowStatuses` - ワークフローステータス定義（システム設定）
- `workTypes` - 業務種別マスタ
- `manuals` - マニュアル
- `questions` - 質問
- `questionSettings` - 質問設定
- `externalWorkSettings` - 外部作業設定（科目×業務種別で外部作業フラグ管理）
- `reviewMemos` - レビューメモ
- `aiModels` - AIモデルマスタ（モデル名、バージョン情報）
- `aiUsageLogs` - AI使用記録（userId, modelId, taskId, purpose, timestamp）
- `aiUsageSettings` - AI使用記録設定

## 主な機能
- **自動振り分け**: 工数・科目・評価に基づく自動アサイン
- **完了予測**: タスク完了予測（順調/注意/遅延リスク/工数不足）
- **検証フロー**: 提出 → 検証 → 承認/差し戻し
- **差し戻し管理**: カテゴリ・重大度付き差し戻し
- **作業時間管理**: 大問別タイマー、外部作業タイマー
- **分野システム**: 作業者の得意分野管理（理科12分野、算数30分野）
- **マクロフロー**: 業務種別「マクロ」のワークフロー
- **外部作業タイマー**: 外部ツールでの作業時間追跡
- **評価システム**: 手動評価 + 自動メトリクス（差し戻し率・重大度・作業時間等）、素点（basePoints）による段階評価
- **Excel出力**: 科目別テンプレートでの構成・内容シート出力（理科用フォント・テキスト変換対応）
- **CSV入出力**: タスク・ユーザー・工数・評価の一括CSV登録・出力
- **ファイル統合**: 複数Excelファイルの結合
- **業務募集**: リーダーが業務を公開、作業者が応募（VIKING形式）
- **質問管理**: 作業者↔リーダー間の質問・回答（スレッド形式）
- **AI使用記録**: 作業者が使用したAI（ChatGPT/Gemini/Claude等）とバージョンの記録・集約・CSV出力

## 注意事項
- データはブラウザのlocalStorageに保存。**ブラウザをまたいでデータは共有されない**
- ファイル添付はIndexedDBに保存
- デプロイ先: GitHub Pages（`npm run build` → `npx gh-pages -d dist`）
- パスワードはbtoa()でエンコード（本番用途には不向き、デモ用）
- 初期データは空（デモデータなし）。ユーザー・学校・タスク等は管理画面から登録

## 次にやりたいこと（未実装・検討中）
- （ここに追記していく）
