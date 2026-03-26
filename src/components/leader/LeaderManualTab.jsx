/**
 * LeaderManualTab - Leader usage guide tab (使い方)
 * Provides collapsible sections explaining each tab's functionality.
 */
import React, { useState } from 'react';

const LeaderManualTab = () => {
  const [openSections, setOpenSections] = useState({});
  const toggle = (key) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  const sections = [
    { key: 'overview', icon: '📊', title: '概要', desc: 'KPIサマリー' },
    { key: 'tasks', icon: '📋', title: '試験種管理', desc: 'タスク追加・CSV一括登録・大問分割' },
    { key: 'assign', icon: '🔀', title: '振り分け', desc: '自動/手動振り分け・漏れチェック' },
    { key: 'users', icon: '👥', title: '作業者管理', desc: '添削者追加・CSV一括登録・分野研修' },
    { key: 'analysis', icon: '📈', title: '工数分析', desc: '棒グラフ・月間工数履歴' },
    { key: 'processing', icon: '✅', title: '進捗管理', desc: '検証・差し戻し・格納確認' },
    { key: 'recruit', icon: '📢', title: '業務募集', desc: 'VIKING形式タスク' },
    { key: 'eval', icon: '⭐', title: '作業者評価', desc: 'スター評価' },
    { key: 'merge', icon: '📁', title: 'ファイル統合', desc: 'Excel統合' },
    { key: 'master', icon: '⚙️', title: 'マスタ', desc: '差し戻し・分野・チェックリスト等の管理' },
  ];

  const sectionContent = {
    overview: (
      <div className="text-sm text-gray-600 space-y-2">
        <p>ダッシュボードのトップ画面です。</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>KPIサマリー</strong>：添削者数、タスク総数、未割当、遅延リスク、検証待ち、完了数、工数合計</li>
          <li><strong>タスクステータス分布</strong>：円グラフで割当状況を可視化</li>
          <li><strong>科目別 完了予測</strong>：残り工数、利用可能工数、完了見込み日</li>
          <li><strong>タスク進捗予測テーブル</strong>：担当者、残り工数、予測完了日、期限、状態の一覧</li>
        </ul>
      </div>
    ),
    tasks: (
      <div className="text-sm text-gray-600 space-y-2">
        <p>試験種（タスク）の登録・管理を行うタブです。</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>タスク追加</strong>：科目、作業内容、必要工数、期限を入力して作成</li>
          <li><strong>CSV一括登録</strong>：タスクCSV / 試験種タスクCSVで一括投入</li>
          <li><strong>大問情報一括登録</strong>：学校名・科目・年度・回数・大問名・分野・大問ID・takosリンクのCSVで各試験種の大問構成を登録</li>
          <li><strong>タスク一覧</strong>：名前検索・ステータスフィルター・ソート</li>
          <li><strong>割当済み</strong>：割当タスクの確認、大問別作業時間表示、解除</li>
          <li><strong>実績</strong>：完了タスクの計画vs実績レポート、CSV出力</li>
        </ul>
      </div>
    ),
    assign: (
      <div className="text-sm text-gray-600 space-y-2">
        <p>タスクの振り分けを行います。</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>自動振り分け</strong>：科目+作業内容フィルタで対象を絞り、プレビュー後に確定</li>
          <li><strong>手動振り分け</strong>：個別タスクを指定して添削者にアサイン</li>
          <li><strong>振り分け漏れチェック</strong>：未割当タスクの確認</li>
        </ul>
      </div>
    ),
    users: (
      <div className="text-sm text-gray-600 space-y-2">
        <p>添削者の追加・編集・削除を行います。</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>添削者追加</strong>：氏名、メール、管理ID（N+8桁）、担当科目を入力。パスワードは自動生成</li>
          <li><strong>CSV一括登録</strong>：管理ID、氏名、担当科目のCSVで一括投入。テンプレートCSVもダウンロード可能</li>
          <li><strong>分野研修クリア管理</strong>：添削者ごとの分野研修クリア状況を管理。CSV一括インポートにも対応</li>
          <li><strong>PWリセット</strong>：パスワードを再発行（初回ログイン時に変更必須）</li>
          <li><strong>担当科目編集</strong>：添削者の担当科目を変更</li>
        </ul>
      </div>
    ),
    analysis: (
      <div className="text-sm text-gray-600 space-y-2">
        <p>添削者ごとの工数状況を確認します。</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>棒グラフ</strong>：各添削者の登録工数 vs 割当工数</li>
          <li><strong>月間工数履歴</strong>：月ごとの工数推移をフィルタ付きで確認</li>
          <li><strong>キャパシティ管理</strong>：空き工数の把握</li>
        </ul>
      </div>
    ),
    processing: (
      <div className="text-sm text-gray-600 space-y-2">
        <p>添削者の提出物を検証・管理します。</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>検証チェックリスト</strong>：提出物のチェック項目を確認</li>
          <li><strong>ファイルプレビュー</strong>：添付ファイルの確認・ダウンロード</li>
          <li><strong>承認</strong>：内容に問題なければ承認 → タスク完了</li>
          <li><strong>差し戻し自動化</strong>：カテゴリ・重大度を選択して差し戻し → 添削者に自動通知</li>
          <li><strong>格納確認 → takos放出</strong>：格納確認後のフロー</li>
        </ul>
      </div>
    ),
    recruit: (
      <div className="text-sm text-gray-600 space-y-2">
        <p>VIKING形式のタスク募集を管理します。</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>募集作成</strong>：科目、タイトル、説明、必要工数、期限を入力して募集を開始</li>
          <li><strong>応募管理</strong>：添削者からの応募を確認し、承認または却下</li>
          <li>VIKINGタスクでは分野制限が適用されます</li>
        </ul>
      </div>
    ),
    eval: (
      <div className="text-sm text-gray-600 space-y-2">
        <p>添削者のスター評価と作業時間分析を行います。</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>評価基準</strong>：評価基準の管理。自動メトリクス（差し戻し率、重大度、作業時間等）も対応</li>
          <li><strong>添削者評価</strong>：スライダーで評価。科目フィルター・自動計算メトリクス付き</li>
          <li><strong>作業時間一覧</strong>：タイムログを一覧表示。作業者・科目・日付でフィルター</li>
          <li><strong>個人別時間</strong>：合計時間・タスク数・効率%を確認</li>
          <li><strong>科目・大問別</strong>：科目別合計時間の割合、大問別の時間内訳</li>
        </ul>
      </div>
    ),
    merge: (
      <div className="text-sm text-gray-600 space-y-2">
        <p>添削者が提出したExcelファイルを統合します。</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>複数の添付ファイルを1つのExcelにまとめてダウンロード</li>
        </ul>
      </div>
    ),
    master: (
      <div className="text-sm text-gray-600 space-y-2">
        <p>マスタデータ（基本設定）を管理します。</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>差し戻しカテゴリ</strong>：差し戻し理由のカテゴリ管理</li>
          <li><strong>重大度</strong>：差し戻しの重大度レベル管理</li>
          <li><strong>チェックリスト</strong>：検証・提出前チェック項目の管理</li>
          <li><strong>分野マスタ</strong>：科目別の分野登録・CSV一括登録</li>
          <li><strong>作業種マスタ</strong>：作業内容の種類を管理</li>
        </ul>
      </div>
    ),
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-1">📖 リーダー用マニュアル</h2>
        <p className="text-sm text-gray-500">四谷大塚制作アプリの使い方ガイドです。各項目をクリックして詳細を確認できます。</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sections.map(({ key, icon, title, desc }) => (
          <section
            key={key}
            className="bg-white rounded-xl border border-gray-200 cursor-pointer hover:border-purple-300 hover:shadow-sm transition-all"
            onClick={() => toggle(key)}
          >
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">{icon}</span>
                  <h3 className="text-sm font-bold text-gray-800">{title}</h3>
                </div>
                <span className="text-gray-400 text-xs ml-2 shrink-0">{openSections[key] ? '▼' : '▶'}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1 ml-7">{desc}</p>
            </div>
            <div
              className={`overflow-hidden transition-all duration-300 ease-in-out ${
                openSections[key] ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
              }`}
            >
              <div className="px-4 pb-4 pt-2 border-t border-gray-100">
                {sectionContent[key]}
              </div>
            </div>
          </section>
        ))}
      </div>

      {/* 基本的な運用フロー - full width */}
      <section className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-200 p-5">
        <h3 className="text-sm font-bold text-purple-800 mb-3">🔄 基本的な運用フロー</h3>
        <div className="text-sm text-gray-700 space-y-2">
          <div className="flex items-start gap-3">
            <span className="bg-purple-600 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">1</span>
            <p><strong>マスタ設定</strong>：差し戻し項目・分野・チェックリストを登録</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="bg-purple-600 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">2</span>
            <p><strong>作業者登録</strong>：添削者のアカウントを作成（管理ID・担当科目対応、CSV一括登録可）</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="bg-purple-600 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">3</span>
            <p><strong>タスク作成</strong>：試験種管理 → タスク追加 / CSV一括登録 / 大問情報一括登録</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="bg-purple-600 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">4</span>
            <p><strong>振り分け</strong>：自動振り分け（科目+作業内容フィルタ）/ 手動振り分け / 振り分け漏れチェック</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="bg-purple-600 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">5</span>
            <p><strong>進捗管理</strong>：概要タブで進捗を確認、完了予測をチェック</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="bg-purple-600 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">6</span>
            <p><strong>検証</strong>：進捗管理タブで検証チェックリスト確認 → 承認 or 差し戻し</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="bg-purple-600 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">7</span>
            <p><strong>評価・分析</strong>：作業者評価タブでスター評価 + 作業時間分析</p>
          </div>
        </div>
      </section>
    </div>
  );
};


export default LeaderManualTab;
