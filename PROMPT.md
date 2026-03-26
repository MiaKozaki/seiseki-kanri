# 制作アプリ — ゼロから作成するプロンプト

以下の仕様に従って「制作アプリ」をゼロから作成してください。

---

## 技術スタック

- **React 18 + Vite 5 + Tailwind CSS 3**（SPA、ルーター不要）
- **Recharts**（グラフ描画）
- **lucide-react**（アイコン）
- **xlsx（SheetJS）**（Excel出力）
- **データ保存: localStorage のみ**（バックエンド不要）
- 日本語UIで統一

```bash
npm create vite@latest seiseki-kanri -- --template react
cd seiseki-kanri
npm install react react-dom recharts lucide-react xlsx
npm install -D tailwindcss postcss autoprefixer @vitejs/plugin-react
npx tailwindcss init -p
```

---

## ユーザーと認証

localStorageベースの簡易認証。パスワードはbtoa()エンコード。

### ロール
- **leader**（リーダー）: 全データの管理・分析・振り分け
- **corrector**（作業者）: 自分の工数登録・担当業務の確認・入力作業

### アカウント
- 初期データは空。管理画面からユーザーを登録して使用する。
- 管理ID（6桁数字）でログイン。

---

## データモデル（localStorageキー: `seiseki_kanri_v1`）

全データを1つのJSONオブジェクトとして保存。

```
{
  users: [{ id, name, email, password(btoa), role, subjects[], createdAt }],
  schools: [{ id, name }],
  examTypes: [{ id, schoolId, subject }],
  capacities: [{ id, userId, startDate, endDate, hoursPerDay, totalHours, note, createdAt }],
  tasks: [{ id, name, subject, requiredHours, deadline, status(pending|assigned|completed), sheetsUrl, createdAt }],
  assignments: [{ id, taskId, userId, assignedHours, status(assigned|in_progress|completed), assignedAt, note }],
  examInputs: [{ id, taskId, assignmentId, 年度, 学校名, 回数, 科目, 試験時間, 大問リスト[], status(draft|completed), createdAt, updatedAt }],
  evaluationCriteria: [{ id, name, description, maxScore }],
  evaluations: [{ id, userId, criteriaId, score, note, updatedAt }],
  notifications: [{ id, userId, message, type, relatedId, read, createdAt }]
}
```

### 初期データ
- 学校: 〇〇小学校, △△小学校, □□中学校
- 試験種: 各学校に国語・算数・理科・社会など
- 評価基準: リーダーが管理画面で設定（素点システム）
- 各作業者に評価スコアを事前登録
- タスク4件（未割当状態）
- 各作業者にキャパシティ（工数）を事前登録

### 定数
- 科目リスト: `['国語', '算数', '理科', '社会', 'マクロ']`
- 作業種別: `['新年度試験種', 'タグ付け', '解答出し', '部分点', 'tensakitインポート']`

---

## 画面構成

### ログイン画面
- メール + パスワードフォーム
- テスト用クイックログインボタン（クリックで即ログイン）
- 青グラデーション背景、白カード、角丸デザイン

### ルーティング（App.jsx）
- 未ログイン → LoginPage
- leader → LeaderDashboard
- corrector → CorrectorDashboard

---

## リーダーダッシュボード（7タブ）

上部にタブバー。各タブの内容:

### タブ1: 概要
- KPIカード6枚: 作業者数、タスク総数、未割当タスク、完了タスク、登録工数合計、割当工数合計
- タスクステータス円グラフ（Recharts PieChart）: 未割当(黄)/割当済(青)/完了(緑)

### タブ2: 工数分析
- **科目別サマリーテーブル**: 科目ごとの対応可能人数、総工数、割当済工数、空き工数、必要工数
- **科目別棒グラフ**（BarChart）: 総工数 vs 割当済 vs 空き
- **日別キャパシティ推移グラフ**（ComposedChart）: 利用可能工数(棒) vs 必要作業工数(線) vs ゼロライン(ReferenceLine)
  - 各日のツールチップに余剰/不足を表示
  - 不足日数のアラート表示
- **作業者別工数テーブル**: 各作業者の総工数、割当済、残り工数、利用率プログレスバー

### タブ3: 試験種管理
- タスク一覧テーブル（名前、科目、必要工数、期限、ステータスバッジ）
- 新規タスク追加フォーム（名前、科目セレクト、必要工数、期限）
- 各タスクに削除ボタン

### タブ4: 振り分け
- **自動振り分けボタン**: 未割当タスクを自動でベストな作業者に割り当て
- **手動振り分け**: タスク選択 → 作業者選択 → 割当
- **現在の割り当て一覧**: タスク名、担当者名、工数、ステータス、取り消しボタン

#### 自動振り分けアルゴリズム
1. 各未割当タスクに対して、担当科目が一致する作業者を抽出
2. 各作業者のスコアを計算: `評価スコア正規化 × 0.7 + 工数マッチスコア × 0.3`
   - 空き工数がタスク必要工数未満 → スキップ（score = -1）
   - 評価スコア正規化 = 全基準の(score/maxScore)の平均
   - 工数マッチ = min(空き工数 / (必要工数×2), 1)
3. スコア最高の作業者に割当
4. 割当時に通知を自動生成

### タブ5: 評価管理
- 作業者ごとに各評価基準のスコアをスター（1〜max）で入力
- メモ欄付き
- リアルタイム保存

### タブ6: 作業者管理
- 作業者一覧（名前、メール、担当科目、工数サマリー）
- 新規作業者追加フォーム（名前、メール、パスワード、担当科目マルチ選択）
- 削除ボタン（関連データも連鎖削除）

### タブ7: マスタ
- **学校マスタ**: 追加・削除
- **試験種マスタ**: 学校選択 → 科目追加・削除
- **評価基準マスタ**: 基準名、説明、最大スコア → 追加・編集・削除
- **Google Sheets連携設定**:
  - Client ID入力欄
  - Spreadsheet ID入力欄
  - サインイン/サインアウトボタン
  - アップロード(ローカル→Sheets)/ダウンロード(Sheets→ローカル)ボタン
  - 自動同期（60秒間隔でアップロード）
  - 同期ステータス表示

---

## 作業者ダッシュボード（3タブ）

### タブ1: 工数登録
- 自分のキャパシティ一覧（期間、時間/日、合計時間、メモ）
- 新規登録フォーム（開始日、終了日、1日の作業時間、メモ）
- 削除ボタン

### タブ2: 担当業務
- 割り当てられたタスク一覧（タスク名、工数、ステータスバッジ）
- ステータス変更（割当済 → 作業中 → 完了）
- **入力フォームを開く**ボタン → 試験入力フォーム画面

#### 試験入力フォーム（重要な機能）

3階層の入力構造:

**大問レベル:**
- 大問番号（自動採番）
- 満点
- 文種、出典、著者（科目が「国語」の場合のみ表示）

**問レベル（大問の中）:**
- 小問名

**枝問レベル（問の中）:**
- 枝問名
- 模範解答
- 配点
- 完答（チェックボックス）
- 順不同（チェックボックス）
- 別解
- 解説
- 解説画像（URL）
- 採点基準（動的リスト）
  - 項目（テキスト）
  - 付記（動的リスト）

フォームには「構成」タブと「内容」タブを切り替え。
- 構成タブ: 基本情報(年度・学校名・回数・科目・試験時間) + 大問の追加・削除
- 内容タブ: 大問→問→枝問の詳細入力。アコーディオン形式で展開。

保存、Excel出力、Google Sheets出力ボタン。

### タブ3: 通知
- 自分宛ての通知一覧
- 既読/未読管理
- 全既読ボタン
- 未読バッジ（タブに件数表示）

---

## Excel出力仕様

xlsxライブラリでワークブックを生成しダウンロード。

**構成シート:**
| 年度 | 学校名 | 回数 | 科目 | 大問 | 大問ごとの満点 | 試験時間 | 文種 | 出典 | 著者 |

**内容シート:**
| 大問 | 問 | 枝問 | 模範解答 | 配点 | 完答 | 順不同 | 別解 | 解説 | 解説画像 | 採点基準（項目1）| 採点基準（付記1-1）| ... |

採点基準・付記の列数は動的（最大数に合わせて生成）。

ファイル名: `{年度}_{学校名}_{科目}_第{回数}回_input.xlsx`

---

## Google Sheets連携仕様（オプション機能）

バックエンド不要。ブラウザ側OAuth2（Google Identity Services）を使用。

- index.htmlに `<script src="https://accounts.google.com/gsi/client" async defer>` を追加
- OAuth Client IDとSpreadsheet IDをマスタ設定画面で入力
- サインイン → アクセストークン取得 → Sheets API直接呼び出し
- アップロード: localStorageの全データ → スプレッドシートの`seiseki_data`シートにキー:JSON形式で書き込み
- ダウンロード: スプレッドシートからデータ読み込み → localStorageに反映 → リロード
- 試験入力データ → スプレッドシートに「構成」「内容」シートとして書き出し
- 自動同期: サインイン中は60秒ごとにアップロード

---

## UIデザイン方針

- Tailwind CSSで統一。カスタムCSSは最小限
- 配色: 青をメインカラー。ステータスは黄(pending)/青(assigned)/緑(completed)
- 角丸(rounded-xl, rounded-2xl)を多用
- レスポンシブ対応（sm:, md:でグリッド調整）
- ログイン画面: 青グラデーション背景に白カード
- ダッシュボード: 白背景にカード型レイアウト
- タブバーはアイコン+テキスト、アクティブタブは青ハイライト
