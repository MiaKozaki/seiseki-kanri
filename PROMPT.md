# 制作工数管理システム — アプリ概要・仕様書

他チームがデプロイ・運用可否を判断するためのドキュメントです。

---

## アプリ概要

添削業務を一元管理するWebアプリ。添削業務のリーダーが添削者への工数振り分け・進捗管理・評価を管理し、添削者は自分の担当業務・工数登録・入力作業を行う。

**バックエンドなし・サーバーサイド処理なし。データはすべてブラウザの `localStorage` / `IndexedDB` に保存。**

---

## 技術スタック

- **React 18 + Vite 5 + Tailwind CSS 3**（SPA、ルーター不要）
- **Recharts**（グラフ描画）
- **lucide-react**（アイコン）
- **xlsx-js-style**（Excel出力・スタイリング）
- **xlsx**（Excelプレビュー）
- **mammoth**（Wordファイルプレビュー）
- **データ保存: localStorage + IndexedDB**（バックエンド不要）
- 日本語UIで統一

```bash
npm create vite@latest seiseki-kanri -- --template react
cd seiseki-kanri
npm install react react-dom recharts lucide-react xlsx xlsx-js-style mammoth
npm install -D tailwindcss postcss autoprefixer @vitejs/plugin-react
npx tailwindcss init -p
npm run dev  # → http://localhost:5173
```

デプロイ: `npm run build` → `dist/` フォルダを Netlify などにドラッグ&ドロップ

---

## ユーザーと認証

localStorageベースの簡易認証。パスワードはbtoa()エンコード（デモ用途）。

### ロール
- **leader**（リーダー）: 全データの管理・分析・振り分け・評価
- **corrector**（添削者）: 自分の工数登録・担当業務の確認・入力作業・質問

### 初期テストアカウント（パスワード共通: `password`）

| 管理ID | メール | ロール | 担当科目 |
|--------|--------|--------|----------|
| 100001 | leader@test.com | leader | 全科目 |
| 100002 | sato-leader@test.com | leader | 小学国語, 小学社会 |
| 100003 | suzuki-leader@test.com | leader | 小学理科 |
| 200001 | yamada@test.com | corrector | 小学国語, 小学算数 |
| 200002 | suzuki@test.com | corrector | 小学算数, 小学理科, 小学国語, 小学社会 |
| 200003 | sato@test.com | corrector | 小学国語, 小学社会 |
| 200004 | mtanaka@test.com | corrector | 小学理科, 小学社会, 小学国語 |
| 200005〜200044 | （デモ用40名） | corrector | 各種科目 |

---

## データモデル（localStorageキー: `seiseki_kanri_v1`）

全データを1つのJSONオブジェクトとして保存。

```
{
  users:                ユーザー（role: leader | corrector, managementId, subjects[], employeeId）
  schools:              学校マスタ
  examTypes:            試験種（schoolId + subject）
  capacities:           工数登録（userId, startDate, endDate, hoursPerDay, totalHours）
  tasks:                タスク（status: pending | assigned | in_progress | submitted | completed | approved）
  assignments:          振り分け結果（userId, taskId, assignedHours, status, verificationStatus）
  examInputs:           入力作業記録（科目別テンプレート、大問リスト内に問リスト埋め込み）
  evaluationCriteria:   評価基準マスタ（maxScore, basePoints, subject, autoMetric）
  evaluations:          評価スコア（userId, criteriaId, score, autoScore, isOverridden）
  notifications:        通知
  recruitments:         業務募集
  applications:         応募
  timeLogs:             作業時間ログ（assignmentId, taskId, userId, daimonId, startTime, endTime, duration）
  rejectionCategories:  差し戻しカテゴリ
  rejectionSeverities:  差し戻し重大度
  rejections:           差し戻し記録
  verificationItems:    検証項目
  verificationResults:  検証結果
  feedbacks:            FB（フィードバック）
  fields:               分野マスタ
  userFields:           ユーザー×分野対応
  workflowStatuses:     ワークフローステータス定義
  workTypes:            業務種別マスタ
  manuals:              マニュアル
  questions:            質問
  questionSettings:     質問設定
  externalWorkSettings: 外部作業設定
  reviewMemos:          レビューメモ
}
```

ファイル添付は **IndexedDB** に保存（localStorageとは別）。

### 定数
- 科目リスト: `['小学国語', '小学算数', '小学理科', '小学社会', 'マクロ']`
- 業務種別: `['新年度試験種', 'タグ付け', '解答出し', '部分点', 'tensakitインポート', 'takos作成', 'マクロ']`

---

## 画面構成

### ログイン画面
- メール + パスワードフォーム
- テスト用クイックログインボタン（クリックで即ログイン）
- 青グラデーション背景、白カード

### ルーティング（App.jsx）
- 未ログイン → LoginPage
- leader → LeaderDashboard
- corrector → CorrectorDashboard

---

## リーダーダッシュボード（12タブ）

### タブ1: 概要
- KPIカード: 添削者数・タスク総数・未割当・遅延リスク・検証待ち・完了・登録工数・割当工数
- タスクステータス円グラフ（Recharts PieChart）
- 科目別業務完了予測（順調/注意/遅延/工数不足）

### タブ2: 試験種管理
- タスク一覧テーブル（フィルタ・ソート対応）
- 新規タスク追加フォーム（名前、科目、業務種別、必要工数、期限、GoogleスプレッドシートURL、バイキング方式、大問分割）
- CSV一括登録（複数フォーマット対応）
- ファイル添付（PDF・Excel・Word、IndexedDB保存）
- タスク削除・編集

### タブ3: 振り分け
- **自動振り分けプレビュー**: 提案を確認してから確定
- **手動振り分け**: タスク・添削者を選択して割当
- **現在の割り当て一覧**: 取り消し・ステータス確認
- 科目・業務種別・期限フィルタ

#### 自動振り分けアルゴリズム
1. 担当科目が一致する添削者を抽出
2. スコア計算: `評価スコア正規化 × 0.7 + 工数マッチスコア × 0.3`
3. スコア最高の添削者に割当、同時に通知を自動生成

### タブ4: 作業者管理
- 添削者一覧（名前・メール・担当科目・工数サマリー・分野）
- 新規添削者追加フォーム
- CSV一括登録
- 削除（関連データも連鎖削除）
- 分野クリアランス管理

### タブ5: 工数分析
- 科目別サマリーテーブル
- 科目別棒グラフ（総工数 vs 割当済 vs 空き）
- 日別キャパシティ推移グラフ（不足日数アラート）
- 添削者別工数テーブル（利用率プログレスバー）
- 月別工数実績集計・Excel出力

### タブ6: 進捗管理
- タスク進捗一覧（フィルタ・ソート対応）
- 検証フロー: 提出 → 検証項目チェック → 承認/差し戻し
- 差し戻し記録（カテゴリ・重大度付き）
- FB（フィードバック）登録・管理
- ファイルプレビュー（Excel・Word）
- レビューメモ

### タブ7: 業務募集
- 募集業務の公開設定
- 応募一覧・承認/却下
- 添削者への通知連携

### タブ8: 作業者評価
- 評価基準管理（maxScore・basePoints・autoMetric設定）
- 手動スコア入力 + 自動メトリクス（差し戻し率・重大度・作業時間等）
- basePoints（素点）システムによる段階評価
- 作業時間分析
- FB集約表示
- CSV出力

### タブ9: ファイル統合
- 複数ExcelファイルをアップロードしてシートをマージしてDL
- 科目・構成/内容シートの自動グルーピング

### タブ10: マスタ
- 学校マスタ（追加・削除）
- 試験種マスタ（学校×科目）
- 評価基準マスタ
- 分野マスタ
- 業務種別マスタ
- ワークフローステータス定義
- マニュアル管理
- 質問設定
- 外部作業設定

### タブ11: 質問管理
- 添削者からの質問一覧
- 回答入力・既読管理
- 未回答件数バッジ

### タブ12: 使い方
- ヘルプガイド（アコーディオン形式）

---

## 添削者ダッシュボード（6タブ）

### タブ1: 工数登録
- 自分のキャパシティ一覧（期間・時間/日・合計時間・メモ）
- 新規登録フォーム（開始日・終了日・1日の作業時間）
- 削除ボタン

### タブ2: 担当業務
- 割り当てられたタスク一覧（ステータスバッジ）
- ステータス変更（割当済 → 作業中 → 提出）
- **試験入力フォーム**（「入力フォームを開く」ボタン）
- **大問タイマー**（大問単位で作業時間を自動計測）
- **外部作業タイマー**（外部ツールでの作業時間追跡）
- ファイル添付・ダウンロード
- FB表示

#### 試験入力フォーム（3階層構造）

**大問レベル:**
- 大問番号（自動採番）、満点
- 科目固有フィールド:
  - 国語: 文種・出典・著者
  - 理科: テーマ
  - 算数/理科: 解答画像・解説画像URL

**問レベル:**
- 小問名

**枝問レベル:**
- 枝問名・模範解答・配点
- 完答・順不同・別解チェックボックス（算数）
- 採点基準（項目 + 付記の多段構造）（国語・理科）
- 条件指定・不可解答（社会）

フォームは「構成」タブと「内容」タブで切り替え。
**Excel出力**ボタンで科目別テンプレートのxlsxをダウンロード。

### タブ3: 業務募集
- 募集中業務への応募・取り消し
- 応募ステータス確認

### タブ4: 通知
- リーダーからの通知一覧
- 既読/未読管理・全既読ボタン
- 未読バッジ

### タブ5: 質問
- リーダーへの質問送信
- 回答確認

### タブ6: 使い方
- ヘルプガイド

---

## Excel出力仕様

`xlsx-js-style` でワークブックを生成しダウンロード。

**構成シート:**
| 年度 | 学校名 | 回数 | 科目 | 大問 | 大問ごとの満点 | 試験時間 | 文種 | 出典 | 著者 |

**内容シート:**
| 大問 | 問 | 枝問 | 模範解答 | 配点 | 完答 | 順不同 | 別解 | 採点基準（項目1）| 採点基準（付記1-1）| … |

採点基準・付記の列数は動的生成。理科用フォント・テキスト変換対応。

ファイル名: `{年度}_{学校名}_{科目}_第{回数}回_input.xlsx`

---

## UIデザイン方針

- Tailwind CSSで統一、カスタムCSSは最小限
- 配色: 青をメインカラー。ステータスは黄(pending)/青(assigned)/水色(in_progress)/紫(submitted)/緑(completed)
- 角丸（rounded-xl, rounded-2xl）を多用
- レスポンシブ対応（sm:, md: でグリッド調整）
- ログイン画面: 青グラデーション背景に白カード
- ダッシュボード: 白背景にカード型レイアウト
- タブバーはアイコン+テキスト、アクティブタブは青ハイライト

---

## 注意事項・制限

- データはブラウザの **localStorage** に保存。**ブラウザをまたいでデータは共有されない**
- ファイル添付は **IndexedDB** に保存。別タブ・別ブラウザでは見えない
- パスワードは `btoa()` エンコード（本番用途には不向き、デモ用）
- 複数ユーザーの同時利用・リアルタイム同期は**不可**（バックエンドなしのため）
- デプロイ先: Netlify / GitHub Pages など静的ホスティング
