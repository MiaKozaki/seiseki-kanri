import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useData } from '../contexts/DataContext.jsx';
import { SUBJECTS_LIST } from '../utils/storage.js';

// Tab components
import OverviewTab from '../components/leader/OverviewTab.jsx';
import TaskAndAssignmentTab from '../components/leader/TaskAndAssignmentTab.jsx';
import AssignmentTab from '../components/leader/AssignmentTab.jsx';
import UserManagementTab from '../components/leader/UserManagementTab.jsx';
import CapacityAnalysisTab from '../components/leader/CapacityAnalysisTab.jsx';
import NewProgressTab from '../components/leader/ProgressTab.jsx';
import RecruitmentTab from '../components/leader/RecruitmentTab.jsx';
import CorrectorEvaluationTab from '../components/leader/CorrectorEvaluationTab.jsx';
import FileMergeTab from '../components/leader/FileMergeTab.jsx';
import MasterDataTab from '../components/leader/MasterDataTab.jsx';
import QuestionManagementTab from '../components/leader/QuestionManagementTab.jsx';
import AiManagementTab from '../components/leader/AiManagementTab.jsx';
import LeaderManualTab from '../components/leader/LeaderManualTab.jsx';

const TABS = [
  { label: '概要', icon: '📊' },
  { label: '試験種登録', icon: '📋' },
  { label: '振り分け', icon: '🔀' },
  { label: '作業者管理', icon: '👥' },
  { label: '工数分析', icon: '📈' },
  { label: '進捗管理', icon: '📉' },
  { label: '業務募集', icon: '📢' },
  { label: '作業者評価', icon: '⭐' },
  { label: 'ファイル統合', icon: '📎' },
  { label: 'マスタ', icon: '⚙️' },
  { label: '質問管理', icon: '❓' },
  { label: 'AI管理', icon: '🤖' },
  { label: '使い方', icon: '📖' },
];

// ---- Main Leader Dashboard ----
export default function LeaderDashboard() {
  const { user, logout, changePassword } = useAuth();
  const { getNotifications, getUsers, getFields } = useData();
  const [activeTab, setActiveTab] = useState(0);
  const [subjectFilter, setSubjectFilter] = useState(user.subjects?.length > 0 ? [...user.subjects] : [...SUBJECTS_LIST]);
  const [showAll, setShowAll] = useState(!(user.subjects?.length > 0));

  // パスワード変更モーダル
  const [showPwModal, setShowPwModal] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPw: '', newPw: '', confirmPw: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);

  const handlePwChange = (e) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess(false);
    const users = getUsers();
    const currentUser = users.find(u => u.id === user.id);
    if (!currentUser || currentUser.password !== btoa(pwForm.currentPw)) {
      setPwError('現在のパスワードが正しくありません');
      return;
    }
    if (pwForm.newPw.length < 6) { setPwError('新しいパスワードは6文字以上にしてください'); return; }
    if (pwForm.newPw !== pwForm.confirmPw) { setPwError('新しいパスワードが一致しません'); return; }
    const success = changePassword(user.id, pwForm.newPw);
    if (success) {
      setPwSuccess(true);
      setPwForm({ currentPw: '', newPw: '', confirmPw: '' });
      setTimeout(() => { setShowPwModal(false); setPwSuccess(false); }, 1500);
    } else {
      setPwError('パスワードの変更に失敗しました');
    }
  };

  const allNotifications = getNotifications();
  const unreadCount = allNotifications.filter(n => !n.read).length;

  const TAB_COMPONENTS = [
    OverviewTab,
    TaskAndAssignmentTab,
    AssignmentTab,
    UserManagementTab,
    CapacityAnalysisTab,
    NewProgressTab,
    RecruitmentTab,
    CorrectorEvaluationTab,
    FileMergeTab,
    MasterDataTab,
    QuestionManagementTab,
    AiManagementTab,
    LeaderManualTab,
  ];
  const ActiveComponent = TAB_COMPONENTS[activeTab];

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm shrink-0 z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-sm">
              L
            </div>
            <div>
              <p className="font-semibold text-gray-800 text-sm">{user.name}</p>
              <p className="text-xs text-gray-400">リーダー</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-medium">
                通知 {unreadCount}件
              </span>
            )}
            <button
              onClick={() => { setShowPwModal(true); setPwError(''); setPwSuccess(false); setPwForm({ currentPw: '', newPw: '', confirmPw: '' }); }}
              className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg transition"
            >
              PW変更
            </button>
            <button onClick={logout} className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg transition">
              ログアウト
            </button>
          </div>
        </div>
      </header>

      {/* パスワード変更モーダル */}
      {showPwModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-4">パスワード変更</h3>
            {pwSuccess ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm text-green-700 font-medium">パスワードを変更しました</p>
              </div>
            ) : (
              <form onSubmit={handlePwChange} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">現在のパスワード</label>
                  <input type="password" value={pwForm.currentPw} onChange={e => setPwForm({ ...pwForm, currentPw: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">新しいパスワード</label>
                  <input type="password" value={pwForm.newPw} onChange={e => setPwForm({ ...pwForm, newPw: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="6文字以上" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">新しいパスワード（確認）</label>
                  <input type="password" value={pwForm.confirmPw} onChange={e => setPwForm({ ...pwForm, confirmPw: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="もう一度入力" required />
                </div>
                {pwError && <p className="text-xs text-red-500">{pwError}</p>}
                <div className="flex gap-2 pt-2">
                  <button type="submit" className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium transition">
                    変更する
                  </button>
                  <button type="button" onClick={() => setShowPwModal(false)}
                    className="flex-1 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg font-medium hover:bg-gray-50 transition">
                    キャンセル
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-48 bg-white border-r border-gray-200 shrink-0 overflow-y-auto">
          <nav className="py-2">
            {TABS.map((tab, i) => (
              <button
                key={i}
                onClick={() => setActiveTab(i)}
                className={`w-full text-left px-4 py-2.5 text-sm font-medium transition flex items-center gap-2 ${
                  activeTab === i
                    ? 'bg-purple-50 text-purple-700 border-r-2 border-purple-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          {/* 科目フィルター */}
          <div className="px-6 py-2 bg-white border-b border-gray-100">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-500 font-medium">科目:</span>
              <button
                onClick={() => {
                  setShowAll(true);
                  setSubjectFilter([...SUBJECTS_LIST]);
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition ${showAll ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                全体
              </button>
              {SUBJECTS_LIST.map(s => {
                const isSingleSelected = !showAll && subjectFilter.length === 1 && subjectFilter[0] === s;
                const isMySubject = (user.subjects ?? []).includes(s);
                return (
                  <button
                    key={s}
                    onClick={() => {
                      setShowAll(false);
                      setSubjectFilter([s]);
                    }}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                      isSingleSelected
                        ? 'bg-blue-600 text-white'
                        : isMySubject
                          ? 'bg-blue-50 text-blue-600 hover:bg-blue-100 ring-1 ring-blue-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {s}{isMySubject ? ' ★' : ''}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-6">
            <ActiveComponent activeSubjects={subjectFilter} />
          </div>
        </main>
      </div>
    </div>
  );
}
