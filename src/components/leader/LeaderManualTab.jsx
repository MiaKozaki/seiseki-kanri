/**
 * LeaderManualTab - Leader usage guide tab (使い方)
 * Comprehensive section-based navigation for first-time users.
 * Click a card to open detailed content; click "戻る" to return.
 */
import React, { useState } from 'react';

const sections = [
  { key: 'intro',     icon: '🏠', title: 'はじめに',     desc: 'アプリ概要・ログイン・画面構成' },
  { key: 'tasks',     icon: '📋', title: '試験種登録',   desc: '試験種追加・CSV一括・PDF・大問情報・分野' },
  { key: 'assign',    icon: '🔀', title: '振り分け',     desc: '自動/手動アサイン・振り分け解除' },
  { key: 'users',     icon: '👥', title: '作業者管理',   desc: '作業者追加・CSV一括・分野研修クリア' },
  { key: 'analysis',  icon: '📈', title: '工数分析',     desc: '日別工数グラフ・期間設定・CSV出力' },
  { key: 'progress',  icon: '📉', title: '進捗管理',     desc: 'ステータスフロー・検証・差し戻し・格納・マクロ' },
  { key: 'recruit',   icon: '📢', title: '業務募集',     desc: 'VIKING形式の募集作成・分野制限' },
  { key: 'eval',      icon: '⭐', title: '作業者評価',   desc: '素点システム・自動メトリクス・FB集約・CSV' },
  { key: 'master',    icon: '⚙️', title: 'マスタ設定',   desc: '差し戻し・チェックリスト・分野・外部作業・マニュアル' },
  { key: 'questions', icon: '❓', title: '質問管理',     desc: '質問受付設定・スレッド形式の回答' },
  { key: 'ai',        icon: '🤖', title: 'AI管理',       desc: 'AIモデル管理・使用記録・CSV出力' },
];

/* ---------- detail content per section ---------- */

const IntroContent = () => (
  <div className="space-y-4 text-sm text-gray-700">
    <div>
      <h4 className="font-bold text-gray-800 mb-2">アプリ概要</h4>
      <p>本アプリは、制作業務を一元管理するためのWebアプリです。リーダーは試験種の登録から作業者への振り分け、進捗管理、評価までを全てこのアプリ内で行えます。</p>
      <p className="mt-1">対応科目は <strong>小学国語・小学算数・小学理科・小学社会</strong> の4科目です。</p>
    </div>
    <div>
      <h4 className="font-bold text-gray-800 mb-2">ログイン方法</h4>
      <ol className="list-decimal pl-5 space-y-1">
        <li>ログイン画面で <strong>管理ID（6桁の数字）</strong> とパスワードを入力します。</li>
        <li>リーダーアカウントでログインすると、リーダーダッシュボードが表示されます。</li>
        <li>初回ログイン時はパスワードの変更を求められます。</li>
      </ol>
    </div>
    <div>
      <h4 className="font-bold text-gray-800 mb-2">画面構成（13タブ）</h4>
      <p>画面上部のタブで各機能にアクセスできます。</p>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {[
          '概要 - KPIサマリー・完了予測',
          '試験種登録 - タスク管理・CSV・PDF',
          '振り分け - 自動/手動アサイン',
          '作業者管理 - ユーザー・分野研修',
          '工数分析 - グラフ・CSV出力',
          '進捗管理 - 検証・差し戻し・格納',
          '業務募集 - VIKING形式タスク',
          '作業者評価 - 評価・FB・作業時間',
          'ファイル統合 - Excel結合',
          'マスタ - 各種マスタ設定',
          '質問管理 - 質問対応',
          'AI管理 - AI使用記録',
          '使い方 - このガイド',
        ].map((item, i) => (
          <div key={i} className="text-xs bg-gray-50 rounded px-2 py-1.5">
            <span className="font-medium text-purple-700">{i + 1}.</span> {item}
          </div>
        ))}
      </div>
    </div>
    <div className="p-3 bg-purple-50 rounded-lg text-xs text-purple-700">
      <strong>科目フィルター</strong>：画面上部の科目チェックボックスで、表示するデータを科目単位で絞り込めます。自分の担当科目のみ表示することも可能です。
    </div>
  </div>
);

const TasksContent = () => (
  <div className="space-y-4 text-sm text-gray-700">
    <div>
      <h4 className="font-bold text-gray-800 mb-2">試験種（タスク）の追加方法</h4>
      <p>「試験種登録」タブでは、タスクの作成・管理を行います。3つのサブタブがあります。</p>
    </div>

    <div>
      <h5 className="font-semibold text-gray-800 mb-1">手入力での追加</h5>
      <ol className="list-decimal pl-5 space-y-1">
        <li>「タスク追加」ボタンをクリック</li>
        <li>科目・業務種別（新年度試験種/タグ付け/解答出し/部分点/tensakitインポート/takos作成/マクロ）を選択</li>
        <li>学校名（サジェスト機能あり）・年度・回数・必要工数・期限を入力</li>
        <li>「追加」ボタンで登録完了</li>
      </ol>
    </div>

    <div>
      <h5 className="font-semibold text-gray-800 mb-1">CSV一括登録</h5>
      <ol className="list-decimal pl-5 space-y-1">
        <li>「CSV一括登録」ボタンをクリック</li>
        <li>テンプレートCSVをダウンロードして記入</li>
        <li>CSVファイルをアップロードすると一括でタスクが登録されます</li>
      </ol>
      <p className="mt-1 text-xs text-gray-500">タスクCSVと試験種タスクCSVの2種類に対応しています。</p>
    </div>

    <div>
      <h5 className="font-semibold text-gray-800 mb-1">PDF一括アップロード</h5>
      <ol className="list-decimal pl-5 space-y-1">
        <li>PDFファイルを選択またはドラッグ＆ドロップ</li>
        <li>ファイル名から学校名・年度・回数・科目を自動認識</li>
        <li>認識結果を確認・修正して一括登録</li>
      </ol>
    </div>

    <div>
      <h5 className="font-semibold text-gray-800 mb-1">大問情報登録</h5>
      <ol className="list-decimal pl-5 space-y-1">
        <li>「大問情報一括登録」からCSVで登録可能</li>
        <li>CSVには学校名・科目・年度・回数・大問名・分野・大問ID・takosリンクを記載</li>
        <li>試験種に大問構成が自動で紐づきます</li>
      </ol>
    </div>

    <div>
      <h5 className="font-semibold text-gray-800 mb-1">分野情報追加</h5>
      <p>各タスクの大問に対して分野情報を追加できます。大問IDとtakosリンクも登録可能で、分野カテゴリの表示にも対応しています。</p>
    </div>

    <div>
      <h5 className="font-semibold text-gray-800 mb-1">タスク一覧</h5>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>検索</strong>：名前で絞り込み</li>
        <li><strong>フィルター</strong>：ステータス・科目・業務種別で絞り込み</li>
        <li><strong>ソート</strong>：名前・期限・工数・ステータスでソート</li>
        <li><strong>割当済みタブ</strong>：割当タスクの確認、大問別作業時間表示、割当解除</li>
        <li><strong>実績タブ</strong>：完了タスクの計画 vs 実績レポート、CSV出力</li>
      </ul>
    </div>

    <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
      <strong>学校名サジェスト</strong>：学校名の入力欄では、文字を入力すると候補が表示されます。登録済みの学校名から自動補完されます。
    </div>
  </div>
);

const AssignContent = () => (
  <div className="space-y-4 text-sm text-gray-700">
    <div>
      <h4 className="font-bold text-gray-800 mb-2">自動振り分け</h4>
      <ol className="list-decimal pl-5 space-y-1">
        <li><strong>科目フィルタ</strong>と<strong>業務種別フィルタ</strong>で対象タスクを絞り込み</li>
        <li>「自動振り分けプレビュー」ボタンをクリック</li>
        <li>作業者の工数残り・担当科目・評価を考慮した振り分け案が表示されます</li>
        <li>内容を確認し「確定」ボタンで振り分けを実行</li>
      </ol>
      <div className="mt-2 p-3 bg-gray-50 rounded-lg text-xs">
        <strong>振り分けロジック</strong>：残り工数が多い作業者を優先し、担当科目が一致する作業者にアサインします。評価が高い作業者が優先される場合もあります。
      </div>
    </div>

    <div>
      <h4 className="font-bold text-gray-800 mb-2">手動アサイン</h4>
      <ol className="list-decimal pl-5 space-y-1">
        <li>タスクを選択し、作業者を指定</li>
        <li>割当工数を入力して「アサイン」をクリック</li>
      </ol>
    </div>

    <div>
      <h4 className="font-bold text-gray-800 mb-2">振り分け解除（剥がし）</h4>
      <ol className="list-decimal pl-5 space-y-1">
        <li>割当済みタスクの一覧から対象を選択</li>
        <li>「解除」ボタンで振り分けを取り消し</li>
        <li>タスクは未割当状態に戻ります</li>
      </ol>
    </div>

    <div>
      <h4 className="font-bold text-gray-800 mb-2">振り分け漏れチェック</h4>
      <p>未割当タスクの一覧を確認し、漏れがないかチェックできます。</p>
    </div>
  </div>
);

const UsersContent = () => (
  <div className="space-y-4 text-sm text-gray-700">
    <div>
      <h4 className="font-bold text-gray-800 mb-2">作業者追加</h4>
      <ol className="list-decimal pl-5 space-y-1">
        <li>「作業者追加」ボタンをクリック</li>
        <li>氏名・メールアドレス・管理ID（N+8桁）・担当科目を入力</li>
        <li>パスワードは自動生成されます（初回ログイン時に変更必須）</li>
        <li>「追加」ボタンで登録完了</li>
      </ol>
    </div>

    <div>
      <h4 className="font-bold text-gray-800 mb-2">CSV一括登録</h4>
      <ol className="list-decimal pl-5 space-y-1">
        <li>「CSV一括登録」ボタンをクリック</li>
        <li>テンプレートCSVをダウンロード</li>
        <li>管理ID・氏名・担当科目を記入してアップロード</li>
      </ol>
    </div>

    <div>
      <h4 className="font-bold text-gray-800 mb-2">分野研修クリア管理</h4>
      <p>作業者ごとに分野研修のクリア状況を管理できます。</p>
      <ul className="list-disc pl-5 space-y-1">
        <li>作業者詳細画面で分野ごとのクリア状況を確認・編集</li>
        <li>CSV一括インポートで複数作業者の分野クリア状況を一度に更新</li>
        <li>分野研修クリア状況は業務募集（VIKING）の分野制限に影響します</li>
      </ul>
    </div>

    <div>
      <h4 className="font-bold text-gray-800 mb-2">その他の操作</h4>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>PWリセット</strong>：パスワードを再発行（初回ログイン時に変更必須）</li>
        <li><strong>担当科目編集</strong>：作業者の担当科目を変更</li>
        <li><strong>削除</strong>：作業者アカウントを削除</li>
      </ul>
    </div>
  </div>
);

const AnalysisContent = () => (
  <div className="space-y-4 text-sm text-gray-700">
    <div>
      <h4 className="font-bold text-gray-800 mb-2">日別工数充足グラフ</h4>
      <p>作業者ごとの登録工数と割当工数を棒グラフで比較表示します。工数の過不足を一目で確認できます。</p>
    </div>

    <div>
      <h4 className="font-bold text-gray-800 mb-2">表示期間設定</h4>
      <p>表示する期間を開始日・終了日で指定できます。月間や週間など柔軟に切り替え可能です。</p>
    </div>

    <div>
      <h4 className="font-bold text-gray-800 mb-2">CSV出力（4種類）</h4>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>工数サマリーCSV</strong>：作業者ごとの登録工数・割当工数・空き工数</li>
        <li><strong>日別工数CSV</strong>：日別の工数詳細データ</li>
        <li><strong>月間工数履歴CSV</strong>：月ごとの工数推移</li>
        <li><strong>工数登録一覧CSV</strong>：全工数登録データの一覧</li>
      </ul>
    </div>

    <div>
      <h4 className="font-bold text-gray-800 mb-2">キャパシティ管理</h4>
      <p>各作業者の空き工数を把握し、振り分けの際の参考にできます。</p>
    </div>
  </div>
);

const ProgressContent = () => (
  <div className="space-y-4 text-sm text-gray-700">
    <div>
      <h4 className="font-bold text-gray-800 mb-2">ステータスフロー</h4>
      <div className="p-3 bg-gray-50 rounded-lg">
        <div className="flex flex-wrap items-center gap-1 text-xs">
          {[
            { label: '未振り分け', color: 'bg-gray-200 text-gray-700' },
            { label: '→' },
            { label: '作業中', color: 'bg-yellow-100 text-yellow-700' },
            { label: '→' },
            { label: '検証待ち', color: 'bg-purple-100 text-purple-700' },
            { label: '→' },
            { label: '検証中', color: 'bg-blue-100 text-blue-700' },
            { label: '→' },
            { label: '検証完了', color: 'bg-green-100 text-green-700' },
            { label: '→' },
            { label: 'PJ格納待ち', color: 'bg-teal-100 text-teal-700' },
            { label: '→' },
            { label: 'マクロ未作成', color: 'bg-orange-100 text-orange-700' },
            { label: '→' },
            { label: '作成完了', color: 'bg-emerald-100 text-emerald-700' },
          ].map((item, i) => (
            item.color ? (
              <span key={i} className={`px-2 py-0.5 rounded-full font-medium ${item.color}`}>{item.label}</span>
            ) : (
              <span key={i} className="text-gray-400">{item.label}</span>
            )
          ))}
        </div>
      </div>
    </div>

    <div>
      <h4 className="font-bold text-gray-800 mb-2">検証方法</h4>
      <ol className="list-decimal pl-5 space-y-1">
        <li>「検証待ち」のタスクを選択</li>
        <li>検証チェックリスト（マスタで設定した項目）を確認</li>
        <li>添付ファイルをプレビュー・ダウンロードして内容を確認</li>
        <li>問題なければ「承認」、修正が必要なら「差し戻し」</li>
      </ol>
    </div>

    <div>
      <h4 className="font-bold text-gray-800 mb-2">差し戻し</h4>
      <ol className="list-decimal pl-5 space-y-1">
        <li>差し戻しカテゴリ（マスタで設定）を選択</li>
        <li>重大度（マスタで設定）を選択</li>
        <li>コメントを入力して差し戻し</li>
        <li>作業者に自動で差し戻し通知が送信されます</li>
      </ol>
    </div>

    <div>
      <h4 className="font-bold text-gray-800 mb-2">格納確認とマクロタスク自動生成</h4>
      <ol className="list-decimal pl-5 space-y-1">
        <li>承認済みの新年度試験種タスクに「格納済みにする」ボタンが表示されます</li>
        <li>格納時にバリデーション：大問情報（daimons）と各大問のtakosLinkが必須</li>
        <li>格納が完了すると、VIKING用マクロタスクが大問ごとに自動生成されます</li>
      </ol>
      <div className="mt-2 p-3 bg-amber-50 rounded-lg text-xs text-amber-700">
        <strong>注意</strong>：格納は新年度試験種タスクのみが対象です。大問情報とtakosLinkが全て登録されていないと格納できません。
      </div>
    </div>
  </div>
);

const RecruitContent = () => (
  <div className="space-y-4 text-sm text-gray-700">
    <div>
      <h4 className="font-bold text-gray-800 mb-2">VIKING形式の募集作成</h4>
      <ol className="list-decimal pl-5 space-y-1">
        <li>「募集作成」ボタンをクリック</li>
        <li>科目・タイトル・説明・必要工数・期限を入力</li>
        <li>「募集開始」で作業者に公開されます</li>
      </ol>
    </div>

    <div>
      <h4 className="font-bold text-gray-800 mb-2">分野制限</h4>
      <p>VIKINGタスクでは分野制限が適用されます。作業者は自分がクリアした分野のタスクのみ取得できます。</p>
      <ul className="list-disc pl-5 space-y-1">
        <li>理科：12分野（化学/物理/生物/地学など）</li>
        <li>算数：30分野</li>
        <li>作業者管理タブで分野研修クリア状況を管理してください</li>
      </ul>
    </div>

    <div>
      <h4 className="font-bold text-gray-800 mb-2">応募管理</h4>
      <ul className="list-disc pl-5 space-y-1">
        <li>作業者からの応募を一覧で確認</li>
        <li>応募を承認または却下</li>
        <li>募集を締め切って取得を終了</li>
      </ul>
    </div>
  </div>
);

const EvalContent = () => (
  <div className="space-y-4 text-sm text-gray-700">
    <div>
      <h4 className="font-bold text-gray-800 mb-2">評価基準設定（素点システム）</h4>
      <p>「評価基準」サブタブで評価の基準を設定します。</p>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>素点（basePoints）</strong>：各評価基準に素点を設定し、段階評価を定義</li>
        <li><strong>科目別設定</strong>：科目ごとに異なる評価基準を設定可能</li>
        <li><strong>自動メトリクス</strong>：差し戻し率・重大度・作業時間・期限遵守率などを自動計算する基準も設定可能</li>
      </ul>
    </div>

    <div>
      <h4 className="font-bold text-gray-800 mb-2">評価入力</h4>
      <p>「作業者評価」サブタブでスライダーを使って評価を入力します。</p>
      <ul className="list-disc pl-5 space-y-1">
        <li>科目フィルターで対象作業者を絞り込み</li>
        <li>自動計算メトリクスは自動入力済み（手動で上書き可能）</li>
      </ul>
    </div>

    <div>
      <h4 className="font-bold text-gray-800 mb-2">自動メトリクス</h4>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>差し戻し率</strong>：提出に対する差し戻し比率</li>
        <li><strong>重大度スコア</strong>：差し戻しの重大度に基づくスコア</li>
        <li><strong>作業時間効率</strong>：予定工数に対する実績時間の比率</li>
        <li><strong>期限遵守率</strong>：期限内提出の割合</li>
      </ul>
    </div>

    <div>
      <h4 className="font-bold text-gray-800 mb-2">作業者分類</h4>
      <p>評価結果に基づき作業者を自動分類します：通常 / 優良 / 要注意 / 新人</p>
    </div>

    <div>
      <h4 className="font-bold text-gray-800 mb-2">評価まとめ・CSV出力</h4>
      <ul className="list-disc pl-5 space-y-1">
        <li>「評価まとめ」サブタブで全作業者の評価一覧を確認</li>
        <li>CSV出力で評価データをエクスポート</li>
      </ul>
    </div>

    <div>
      <h4 className="font-bold text-gray-800 mb-2">FB（フィードバック）集約</h4>
      <p>「FB集約」サブタブで作業者ごとのフィードバック履歴を確認できます。差し戻し時のコメントやカテゴリ・重大度も集約されています。</p>
    </div>

    <div>
      <h4 className="font-bold text-gray-800 mb-2">作業時間分析</h4>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>作業時間一覧</strong>：タイムログを作業者・科目・日付でフィルター表示</li>
        <li><strong>個人別時間</strong>：合計時間・タスク数・効率%を確認</li>
        <li><strong>科目・大問別</strong>：科目別合計時間の割合、大問別の時間内訳</li>
      </ul>
    </div>
  </div>
);

const MasterContent = () => (
  <div className="space-y-4 text-sm text-gray-700">
    <p>「マスタ」タブでは各種マスタデータ（基本設定）を管理します。セクションをクリックして設定画面に入ります。</p>

    <div>
      <h4 className="font-bold text-gray-800 mb-2">差し戻しカテゴリ</h4>
      <p>差し戻し時に選択するカテゴリ（理由分類）を管理します。カテゴリ名と説明を登録します。</p>
    </div>

    <div>
      <h4 className="font-bold text-gray-800 mb-2">差し戻し重大度</h4>
      <p>差し戻しの重大度レベル（軽微/中程度/重大など）を管理します。評価の自動メトリクスに使用されます。</p>
    </div>

    <div>
      <h4 className="font-bold text-gray-800 mb-2">チェックリスト（提出前/検証用）</h4>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>提出前チェックリスト</strong>：作業者が提出時に確認する項目</li>
        <li><strong>検証用チェックリスト</strong>：リーダーが検証時に確認する項目</li>
        <li>必須/任意の設定が可能</li>
      </ul>
    </div>

    <div>
      <h4 className="font-bold text-gray-800 mb-2">分野マスタ</h4>
      <ul className="list-disc pl-5 space-y-1">
        <li>理科・算数の分野を登録・管理</li>
        <li>リファレンスデータの設定</li>
        <li>CSV一括登録にも対応</li>
      </ul>
    </div>

    <div>
      <h4 className="font-bold text-gray-800 mb-2">外部作業設定</h4>
      <p>科目×業務種別の組み合わせごとに、外部作業フラグを設定します。外部作業に設定されたタスクは外部作業タイマー（手動タイマー）フローで作業します。</p>
    </div>

    <div>
      <h4 className="font-bold text-gray-800 mb-2">業務種別マスタ</h4>
      <p>業務種別（新年度試験種/タグ付け/解答出し/部分点/tensakitインポート/takos作成/マクロ）を管理します。</p>
    </div>

    <div>
      <h4 className="font-bold text-gray-800 mb-2">マニュアル管理</h4>
      <p>作業者向けのマニュアルを科目別に登録できます。作業者ダッシュボードの担当業務タブで表示されます。</p>
    </div>
  </div>
);

const QuestionsContent = () => (
  <div className="space-y-4 text-sm text-gray-700">
    <div>
      <h4 className="font-bold text-gray-800 mb-2">質問受付設定</h4>
      <p>質問の受付可否や受付条件を設定できます。</p>
    </div>

    <div>
      <h4 className="font-bold text-gray-800 mb-2">スレッド形式の回答</h4>
      <ol className="list-decimal pl-5 space-y-1">
        <li>作業者からの質問が一覧表示されます</li>
        <li>質問をクリックしてスレッドを開きます</li>
        <li>回答を入力して送信</li>
        <li>作業者側にもスレッド形式でやりとりが表示されます</li>
      </ol>
    </div>

    <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
      <strong>ヒント</strong>：質問に対する回答は通知として作業者に送信されます。作業者は通知タブまたは質問タブから確認できます。
    </div>
  </div>
);

const AiContent = () => (
  <div className="space-y-4 text-sm text-gray-700">
    <div>
      <h4 className="font-bold text-gray-800 mb-2">AIモデル管理</h4>
      <p>作業者が使用するAIモデル（ChatGPT/Gemini/Claude等）とそのバージョンを管理します。</p>
      <ul className="list-disc pl-5 space-y-1">
        <li>AIモデルの追加・編集・削除</li>
        <li>バージョン情報の管理</li>
      </ul>
    </div>

    <div>
      <h4 className="font-bold text-gray-800 mb-2">AI記録設定</h4>
      <p>作業者がAI使用記録を入力する際の設定を管理します。</p>
    </div>

    <div>
      <h4 className="font-bold text-gray-800 mb-2">使用記録確認・CSV出力</h4>
      <ul className="list-disc pl-5 space-y-1">
        <li>作業者ごとのAI使用記録を一覧確認</li>
        <li>使用したAIモデル・バージョン・用途の詳細</li>
        <li>CSV出力で使用記録データをエクスポート</li>
      </ul>
    </div>
  </div>
);

const sectionComponents = {
  intro: IntroContent,
  tasks: TasksContent,
  assign: AssignContent,
  users: UsersContent,
  analysis: AnalysisContent,
  progress: ProgressContent,
  recruit: RecruitContent,
  eval: EvalContent,
  master: MasterContent,
  questions: QuestionsContent,
  ai: AiContent,
};

/* ---------- main component ---------- */

const LeaderManualTab = () => {
  const [activeSection, setActiveSection] = useState(null);

  if (activeSection) {
    const ContentComponent = sectionComponents[activeSection];
    const sectionInfo = sections.find(s => s.key === activeSection);
    return (
      <div className="space-y-4 max-w-4xl">
        <button
          onClick={() => setActiveSection(null)}
          className="flex items-center gap-1.5 text-sm text-purple-600 hover:text-purple-800 font-medium transition"
        >
          <span>←</span> マニュアルトップに戻る
        </button>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">{sectionInfo.icon}</span>
            <h2 className="text-lg font-bold text-gray-800">{sectionInfo.title}</h2>
          </div>
          <ContentComponent />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-1">リーダー用マニュアル</h2>
        <p className="text-sm text-gray-500">制作アプリの使い方ガイドです。各項目をクリックして詳細を確認できます。</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {sections.map(({ key, icon, title, desc }) => (
          <button
            key={key}
            onClick={() => setActiveSection(key)}
            className="text-left bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:border-purple-300 hover:shadow-sm transition-all group"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">{icon}</span>
              <h3 className="text-sm font-bold text-gray-800 group-hover:text-purple-700 transition">{title}</h3>
            </div>
            <p className="text-xs text-gray-500 ml-7">{desc}</p>
          </button>
        ))}
      </div>

      {/* 運用フロー */}
      <section className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-200 p-5">
        <h3 className="text-sm font-bold text-purple-800 mb-3">基本的な運用フロー</h3>
        <div className="text-sm text-gray-700 space-y-2">
          {[
            { step: 1, title: 'マスタ設定', desc: '差し戻し項目・分野・チェックリストを登録' },
            { step: 2, title: '作業者登録', desc: 'アカウントを作成（管理ID・担当科目、CSV一括登録可）' },
            { step: 3, title: '試験種登録', desc: 'タスク追加 / CSV一括登録 / PDF一括アップロード / 大問情報登録' },
            { step: 4, title: '振り分け', desc: '自動振り分け（科目+業務種別フィルタ）/ 手動振り分け' },
            { step: 5, title: '作業者が作成', desc: '入力フォーム（算数/理科/社会）/ 外部作業タイマー' },
            { step: 6, title: '提出・検証', desc: '提出前チェック → 提出 → リーダー検証 → 承認 or 差し戻し' },
            { step: 7, title: 'PJ格納', desc: '承認済みタスクを格納 → マクロVIKINGタスク自動生成' },
            { step: 8, title: '評価・分析', desc: '作業者評価（素点+自動メトリクス）/ 工数分析 / FB集約' },
          ].map(({ step, title, desc }) => (
            <div key={step} className="flex items-start gap-3">
              <span className="bg-purple-600 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">{step}</span>
              <p><strong>{title}</strong>：{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 科目別入力フォーム */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-bold text-gray-800 mb-3">科目別入力フォームテンプレート</h3>
        <div className="text-xs text-gray-600 space-y-2">
          <p className="text-gray-500 mb-2">入力フォームは「新年度試験種 かつ 小学算数/小学理科/小学社会」のタスクのみに表示されます。</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {[
              { subject: '算数', fields: '年度, 学校名, 回数, 科目, 大問, 満点, 試験時間' },
              { subject: '理科', fields: '年度, 学校名, 回数, 科目, 大問, 満点, テーマ, 試験時間' },
              { subject: '社会', fields: '年度, 学校名, 回数, 科目, 大問, 満点（試験時間なし）' },
              { subject: '国語', fields: '年度, 学校名, 回数, 科目, 大問, 満点, 文種, 出典, 著者' },
            ].map(({ subject, fields }) => (
              <div key={subject} className="bg-gray-50 rounded-lg p-3">
                <span className="font-semibold text-purple-700">{subject}</span>
                <p className="mt-1 text-gray-500">{fields}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default LeaderManualTab;
