/**
 * RecruitmentTab - Task recruitment tab (業務募集)
 * Allows leaders to create recruitment postings for tasks and manage applications from correctors.
 */
import React, { useState } from 'react';
import { useData } from '../../contexts/DataContext.jsx';
import { SUBJECTS_LIST } from '../../utils/storage.js';

// ---- Recruitment Tab (業務募集) ----
const RecruitmentTab = ({ activeSubjects }) => {
  const { getRecruitments, addRecruitment, closeRecruitment, getApplications, reviewApplication, getCorrectors, getTasks } = useData();
  const correctors = getCorrectors();
  const tasks = getTasks();
  const allRecruitments = getRecruitments().filter(r => activeSubjects.includes(r.subject));
  const openRecruitments = allRecruitments.filter(r => r.status === 'open');
  const closedRecruitments = allRecruitments.filter(r => r.status === 'closed');

  const [form, setForm] = useState({ title: '', description: '', subject: '', requiredHours: '', deadline: '', taskId: '' });
  const [expandedId, setExpandedId] = useState(null);
  const [rejectNote, setRejectNote] = useState({});
  const [rejectingAppId, setRejectingAppId] = useState(null);
  const [showClosed, setShowClosed] = useState(false);

  const pendingTasks = tasks.filter(t => t.status === 'pending');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title || !form.subject) return;
    addRecruitment({
      title: form.title,
      description: form.description,
      subject: form.subject,
      requiredHours: Number(form.requiredHours) || 0,
      deadline: form.deadline,
      taskId: form.taskId || null,
    });
    setForm({ title: '', description: '', subject: '', requiredHours: '', deadline: '', taskId: '' });
  };

  const appStatusConfig = {
    pending: { text: '審査中', cls: 'bg-amber-100 text-amber-700' },
    approved: { text: '承認', cls: 'bg-green-100 text-green-700' },
    rejected: { text: '見送り', cls: 'bg-red-100 text-red-700' },
  };

  return (
    <div className="space-y-4">
      {/* ===== 募集作成フォーム ===== */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">新しい業務募集を作成</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">タイトル <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 outline-none"
              placeholder="例：〇〇中学校 国語 添削業務"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">説明</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 outline-none"
              placeholder="業務内容の詳細..."
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">科目 <span className="text-red-400">*</span></label>
              <select
                value={form.subject}
                onChange={e => setForm({ ...form, subject: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 outline-none"
                required
              >
                <option value="">選択してください</option>
                {SUBJECTS_LIST.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">必要工数（時間）<span className="text-gray-400 font-normal ml-1">（任意）</span></label>
              <input
                type="number"
                value={form.requiredHours}
                onChange={e => setForm({ ...form, requiredHours: e.target.value })}
                min="0"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 outline-none"
                placeholder="未入力可"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">締切日</label>
              <input
                type="date"
                value={form.deadline}
                onChange={e => setForm({ ...form, deadline: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">紐付けタスク（任意）</label>
              <select
                value={form.taskId}
                onChange={e => setForm({ ...form, taskId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 outline-none"
              >
                <option value="">紐付けなし</option>
                {pendingTasks.map(t => (
                  <option key={t.id} value={t.id}>{t.name}（{t.subject} · {t.requiredHours}h）</option>
                ))}
              </select>
            </div>
          </div>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition text-sm font-medium">
            掲載する
          </button>
        </form>
      </div>

      {/* ===== 募集中の一覧 ===== */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">募集中（{openRecruitments.length}件）</h3>
        {openRecruitments.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-4">現在募集中の業務はありません</p>
        ) : (
          <div className="space-y-3">
            {openRecruitments.map(rec => {
              const apps = getApplications(rec.id);
              const isExpanded = expandedId === rec.id;
              return (
                <div key={rec.id} className="border border-gray-100 rounded-xl overflow-hidden">
                  <div className="p-4 bg-gray-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-800">{rec.title}</span>
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{rec.subject}</span>
                          {rec.requiredHours > 0 && (
                            <span className="text-xs text-gray-500">{rec.requiredHours}h</span>
                          )}
                          {rec.deadline && (
                            <span className="text-xs text-gray-400">締切: {rec.deadline}</span>
                          )}
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">応募 {apps.length}件</span>
                        </div>
                        {rec.description && (
                          <p className="text-xs text-gray-500 mt-1">{rec.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                          className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 transition font-medium"
                        >
                          {isExpanded ? '閉じる' : `応募一覧 (${apps.length})`}
                        </button>
                        <button
                          onClick={() => { if (confirm('この募集を終了しますか？未処理の応募は自動的に見送りになります。')) closeRecruitment(rec.id); }}
                          className="px-4 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition text-sm font-medium"
                        >
                          募集終了
                        </button>
                      </div>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="p-4 border-t border-gray-100">
                      {apps.length === 0 ? (
                        <p className="text-gray-400 text-sm text-center py-2">まだ応募がありません</p>
                      ) : (
                        <div className="space-y-2">
                          {apps.map(app => {
                            const applicant = correctors.find(c => c.id === app.userId);
                            const sc = appStatusConfig[app.status] ?? { text: app.status, cls: 'bg-gray-100 text-gray-600' };
                            const isRejecting = rejectingAppId === app.id;
                            return (
                              <div key={app.id} className="p-3 bg-white border border-gray-100 rounded-lg">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-sm font-medium text-gray-800">{applicant?.name ?? '不明'}</span>
                                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sc.cls}`}>{sc.text}</span>
                                    </div>
                                    {app.message && (
                                      <p className="text-xs text-gray-500 mt-0.5">{app.message}</p>
                                    )}
                                    <p className="text-xs text-gray-400 mt-0.5">
                                      応募日: {new Date(app.appliedAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                                    </p>
                                  </div>
                                  {app.status === 'pending' && (
                                    <div className="flex gap-2 shrink-0">
                                      <button
                                        onClick={() => reviewApplication(app.id, true)}
                                        className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition text-sm font-medium"
                                      >
                                        承認
                                      </button>
                                      <button
                                        onClick={() => setRejectingAppId(isRejecting ? null : app.id)}
                                        className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition text-sm font-medium"
                                      >
                                        見送り
                                      </button>
                                    </div>
                                  )}
                                </div>
                                {isRejecting && (
                                  <div className="mt-2 flex gap-2">
                                    <input
                                      type="text"
                                      value={rejectNote[app.id] ?? ''}
                                      onChange={e => setRejectNote(prev => ({ ...prev, [app.id]: e.target.value }))}
                                      placeholder="見送り理由（任意）"
                                      className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 outline-none"
                                    />
                                    <button
                                      onClick={() => {
                                        reviewApplication(app.id, false, rejectNote[app.id] ?? '');
                                        setRejectingAppId(null);
                                        setRejectNote(prev => { const n = { ...prev }; delete n[app.id]; return n; });
                                      }}
                                      className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition text-sm font-medium"
                                    >
                                      確定
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== 終了した募集 ===== */}
      {closedRecruitments.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <button
            onClick={() => setShowClosed(!showClosed)}
            className="flex items-center gap-2 text-sm font-semibold text-gray-700"
          >
            <span>{showClosed ? '▼' : '▶'}</span>
            終了した募集（{closedRecruitments.length}件）
          </button>
          {showClosed && (
            <div className="mt-3 space-y-2">
              {closedRecruitments.map(rec => {
                const apps = getApplications(rec.id);
                const approvedCount = apps.filter(a => a.status === 'approved').length;
                return (
                  <div key={rec.id} className="p-3 bg-gray-50 border border-gray-100 rounded-lg">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-600">{rec.title}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600">{rec.subject}</span>
                      <span className="text-xs text-gray-400">応募: {apps.length}件 / 承認: {approvedCount}件</span>
                      {rec.closedAt && (
                        <span className="text-xs text-gray-400">終了日: {new Date(rec.closedAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RecruitmentTab;
