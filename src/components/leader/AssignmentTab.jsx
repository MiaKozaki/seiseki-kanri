import React, { useState, useMemo } from 'react';
import { useData, isFinished } from '../../contexts/DataContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { previewAutoAssign, confirmAutoAssign, manualAssign } from '../../utils/autoAssign.js';
import { SUBJECTS_LIST } from '../../utils/storage.js';

const AssignmentTab = ({ activeSubjects }) => {
  const {
    getTasks, getAssignments, getCorrectors, getCapacities,
    getAllData, applyAutoAssignResult, getWorkTypes,
    addReviewMemo, deleteAssignment, updateTask,
  } = useData();
  const workTypesList = getWorkTypes().map(wt => wt.name);
  const { user } = useAuth();

  const allTasks = getTasks();
  const tasks = allTasks.filter(t => activeSubjects.includes(t.subject));
  const assignments = getAssignments();
  const correctors = getCorrectors();
  const capacities = getCapacities();

  // Assignment filter state
  const [assignSubjectFilter, setAssignSubjectFilter] = useState('all');
  const [assignWorkTypeFilter, setAssignWorkTypeFilter] = useState('all');
  const [assignDeadlineFrom, setAssignDeadlineFrom] = useState('');
  const [assignDeadlineTo, setAssignDeadlineTo] = useState('');
  const [showAssignSearch, setShowAssignSearch] = useState(false);

  // Assignment state
  const [message, setMessage] = useState('');
  const [manualSelect, setManualSelect] = useState({});
  const [previewData, setPreviewData] = useState(null);
  const [editedProposals, setEditedProposals] = useState([]);

  // Memo state for assignment
  const [assignMemo, setAssignMemo] = useState({});

  // VIKING state
  const [showClaimedViking, setShowClaimedViking] = useState(false);

  // --- Assignment helpers ---
  const allPendingTasks = tasks.filter(t => t.status === 'pending' && !t.viking);
  const pendingTasks = allPendingTasks.filter(t => {
    if (assignSubjectFilter !== 'all' && t.subject !== assignSubjectFilter) return false;
    if (assignWorkTypeFilter !== 'all' && t.workType !== assignWorkTypeFilter) return false;
    if (assignDeadlineFrom && t.deadline < assignDeadlineFrom) return false;
    if (assignDeadlineTo && t.deadline > assignDeadlineTo) return false;
    return true;
  });

  const handleAutoAssign = () => {
    const allData = getAllData();
    // Filter tasks by subject and workType if filters are set
    const filteredData = {
      ...allData,
      tasks: allData.tasks.filter(t => {
        if (!activeSubjects.includes(t.subject)) return false;
        if (autoSubjectFilter !== 'all' && t.subject !== autoSubjectFilter) return false;
        if (autoWorkTypeFilter !== 'all' && t.workType !== autoWorkTypeFilter) return false;
        return true;
      }),
    };
    const proposals = previewAutoAssign(filteredData);
    if (proposals.length === 0) {
      setMessage('振り分けできるタスクがありませんでした');
      setTimeout(() => setMessage(''), 4000);
      return;
    }
    setPreviewData(proposals);
    setEditedProposals(proposals.map(p => ({ taskId: p.taskId, userId: p.userId, assignedHours: p.assignedHours })));
  };

  const handleManualAssign = (taskId) => {
    const userId = manualSelect[taskId];
    if (!userId) return;
    const result = manualAssign(taskId, userId, getAllData());
    applyAutoAssignResult(result);
    // Save assignment memo if provided
    const memoContent = (assignMemo[taskId] || '').trim();
    if (memoContent && addReviewMemo) {
      const newAssignment = result.assignments.find(a => a.taskId === taskId && a.userId === userId);
      addReviewMemo({
        assignmentId: newAssignment?.id || '',
        taskId,
        userId,
        authorId: user?.id,
        content: memoContent,
        shared: false,
        type: 'assignment',
      });
    }
    setManualSelect(prev => ({ ...prev, [taskId]: '' }));
    setAssignMemo(prev => ({ ...prev, [taskId]: '' }));
    setMessage('手動振り分けしました');
    setTimeout(() => setMessage(''), 3000);
  };

  const getAssignedUser = (taskId) => {
    const a = assignments.find(x => x.taskId === taskId);
    if (!a) return null;
    return correctors.find(c => c.id === a.userId);
  };

  const getEligibleCorrectors = (subject) => {
    return correctors.filter(c => (c.subjects ?? []).includes(subject));
  };

  const clearAssignFilters = () => {
    setAssignSubjectFilter('all');
    setAssignWorkTypeFilter('all');
    setAssignDeadlineFrom('');
    setAssignDeadlineTo('');
  };

  // --- Unassign (剥がし) handler ---
  const handleUnassign = (assignmentId, taskId) => {
    if (!window.confirm('この振り分けを解除しますか？タスクは未振り分けに戻ります。')) return;
    deleteAssignment(assignmentId);
    updateTask(taskId, { status: 'pending' });
    setMessage('振り分けを解除しました');
    setTimeout(() => setMessage(''), 3000);
  };

  // Assigned tasks for the unassign section
  const assignedTasks = tasks.filter(t => t.status === 'assigned' || t.status === 'in_progress');

  // VIKING helpers
  const pendingVikingTasks = tasks.filter(t => t.viking && t.status === 'pending');
  const claimedVikingTasks = tasks.filter(t => t.viking && t.status !== 'pending');

  // 振り分け漏れチェック
  const [showGapCheck, setShowGapCheck] = useState(false);
  const gapChecks = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const issues = [];

    // 1. 未割当 + 期限迫り
    tasks.filter(t => t.status === 'pending' && t.deadline).forEach(t => {
      const daysLeft = Math.ceil((new Date(t.deadline) - new Date()) / 86400000);
      if (daysLeft <= 7) {
        issues.push({
          severity: daysLeft <= 3 ? 'critical' : 'warning',
          icon: '\u{1F6A8}',
          message: `「${t.name}」が未割当（期限${daysLeft <= 0 ? '超過' : `まであと${daysLeft}日`}）`,
        });
      }
    });

    // 2. 期限超過（進行中タスク）
    tasks.filter(t => !isFinished(t.status) && t.status !== 'pending' && t.deadline && t.deadline < today).forEach(t => {
      issues.push({
        severity: 'critical',
        icon: '\u23F0',
        message: `「${t.name}」の期限が超過（期限: ${t.deadline}）`,
      });
    });

    // 3. 工数不足割当
    tasks.filter(t => t.status === 'assigned').forEach(t => {
      const activeAssign = assignments.find(a => a.taskId === t.id && !isFinished(a.status) && a.status !== 'submitted');
      if (activeAssign && t.requiredHours && activeAssign.assignedHours < t.requiredHours) {
        const deficit = t.requiredHours - activeAssign.assignedHours;
        issues.push({
          severity: 'warning',
          icon: '\u26A0\uFE0F',
          message: `「${t.name}」の割当工数が不足（${activeAssign.assignedHours}h / 必要${t.requiredHours}h、不足${deficit}h）`,
        });
      }
    });

    // 4. 工数登録あり・割当なし
    correctors.forEach(c => {
      const hasActiveCap = capacities.some(cap => cap.userId === c.id && cap.endDate >= today);
      const hasActiveAssign = assignments.some(a => a.userId === c.id && !isFinished(a.status));
      if (hasActiveCap && !hasActiveAssign) {
        issues.push({ severity: 'info', icon: '\u{1F4A4}', message: `${c.name} は工数登録あり・割当なし` });
      }
    });

    // 5. 工数未登録の添削者
    correctors.forEach(c => {
      const hasFutureCap = capacities.some(cap => cap.userId === c.id && cap.endDate >= today);
      if (!hasFutureCap) {
        issues.push({ severity: 'info', icon: '\u{1F4CB}', message: `${c.name} の工数が未登録です` });
      }
    });

    const order = { critical: 0, warning: 1, info: 2 };
    return issues.sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3));
  }, [tasks, assignments, capacities, correctors]);

  // 自動振り分けフィルタ
  const [autoSubjectFilter, setAutoSubjectFilter] = useState('all');
  const [autoWorkTypeFilter, setAutoWorkTypeFilter] = useState('all');

  return (
    <div className="space-y-4">
      {message && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-2 rounded-lg">
          {message}
        </div>
      )}

      {/* ===== 振り分け漏れチェック ===== */}
      {gapChecks.length > 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-amber-400">
          <button
            onClick={() => setShowGapCheck(!showGapCheck)}
            className="w-full flex items-center justify-between"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <span>{'\u{1F50D}'}</span> 振り分け漏れチェック
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                {gapChecks.length}件
              </span>
              {gapChecks.some(g => g.severity === 'critical') && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                  要対応 {gapChecks.filter(g => g.severity === 'critical').length}件
                </span>
              )}
            </span>
            <span className="text-gray-400 text-xs">{showGapCheck ? '\u25B2 閉じる' : '\u25BC 詳細を表示'}</span>
          </button>
          {showGapCheck && (
            <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
              {gapChecks.map((issue, i) => (
                <div key={i} className={`flex items-start gap-2 p-2.5 rounded-lg text-sm ${
                  issue.severity === 'critical' ? 'bg-red-50 text-red-800' :
                  issue.severity === 'warning' ? 'bg-amber-50 text-amber-800' :
                  'bg-blue-50 text-blue-800'
                }`}>
                  <span className="shrink-0 mt-0.5">{issue.icon}</span>
                  <span>{issue.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : tasks.length > 0 ? (
        <div className="bg-green-50 rounded-xl p-4 border border-green-100 flex items-center gap-2">
          <span>{'\u2705'}</span>
          <span className="text-sm text-green-700 font-medium">振り分け漏れはありません</span>
        </div>
      ) : null}

      {/* ===== 自動振り分け ===== */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">自動振り分け</h3>
            <p className="text-xs text-gray-400 mt-0.5">未割当の全タスクを評価・工数をもとに自動で振り分けます</p>
          </div>
          <button
            onClick={handleAutoAssign}
            disabled={allPendingTasks.length === 0}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
          >
            自動振り分け実行
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mb-2">
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">科目</label>
            <select value={autoSubjectFilter} onChange={e => setAutoSubjectFilter(e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="all">すべて</option>
              {SUBJECTS_LIST.filter(s => activeSubjects.includes(s)).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">作業内容</label>
            <select value={autoWorkTypeFilter} onChange={e => setAutoWorkTypeFilter(e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="all">すべて</option>
              {workTypesList.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
          {(autoSubjectFilter !== 'all' || autoWorkTypeFilter !== 'all') && (
            <div className="flex items-end">
              <button onClick={() => { setAutoSubjectFilter('all'); setAutoWorkTypeFilter('all'); }}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-100 transition">
                条件クリア
              </button>
            </div>
          )}
        </div>
        {allPendingTasks.length === 0 ? (
          <p className="text-green-600 text-xs">未割当のタスクはありません</p>
        ) : (
          <p className="text-amber-600 text-xs">未割当タスク: {allPendingTasks.length}件
            {(autoSubjectFilter !== 'all' || autoWorkTypeFilter !== 'all') && (
              <span className="ml-1">（フィルタ適用中）</span>
            )}
          </p>
        )}

        {previewData && (
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h4 className="text-sm font-bold text-blue-800 mb-3">振り分けプレビュー（{editedProposals.length}件）</h4>
            <p className="text-xs text-blue-600 mb-3">担当者の変更や個別除外が可能です。確認後「確定する」を押してください。</p>
            <div className="space-y-2">
              {previewData.map((p, idx) => {
                const edited = editedProposals.find(e => e.taskId === p.taskId);
                if (!edited) return null;
                return (
                  <div key={p.taskId} className="flex items-center gap-2 bg-white rounded-lg p-3 border border-blue-100">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{p.taskName}</p>
                      <p className="text-xs text-gray-500">{p.subject} {p.workType && `· ${p.workType}`}</p>
                    </div>
                    <select
                      value={edited.userId}
                      onChange={e => setEditedProposals(prev => prev.map(ep =>
                        ep.taskId === p.taskId ? { ...ep, userId: e.target.value } : ep
                      ))}
                      className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white min-w-[140px]"
                    >
                      {p.eligibleCorrectors.map(c => (
                        <option key={c.id} value={c.id}>{c.name} (スコア: {c.score})</option>
                      ))}
                    </select>
                    <span className="text-sm text-gray-600 whitespace-nowrap">{p.assignedHours}h</span>
                    <button
                      onClick={() => setEditedProposals(prev => prev.filter(ep => ep.taskId !== p.taskId))}
                      className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded transition whitespace-nowrap"
                    >
                      除外
                    </button>
                  </div>
                );
              })}
            </div>
            {editedProposals.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-3">全てのタスクが除外されました</p>
            )}
            <div className="flex gap-2 mt-4 justify-end">
              <button
                onClick={() => { setPreviewData(null); setEditedProposals([]); }}
                className="text-sm text-gray-600 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition"
              >
                キャンセル
              </button>
              <button
                disabled={editedProposals.length === 0}
                onClick={() => {
                  const result = confirmAutoAssign(editedProposals, getAllData());
                  applyAutoAssignResult(result);
                  setMessage(`${result.newAssignments.length}件のタスクを振り分けました`);
                  setPreviewData(null);
                  setEditedProposals([]);
                  setTimeout(() => setMessage(''), 4000);
                }}
                className="text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg transition"
              >
                確定する（{editedProposals.length}件）
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ===== 手動振り分け ===== */}
      {allPendingTasks.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="text-sm font-semibold text-gray-700">手動振り分け（未割当タスク {pendingTasks.length}/{allPendingTasks.length}件）</h3>
            <button
              onClick={() => setShowAssignSearch(v => !v)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition font-medium ${showAssignSearch ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
            >
              {showAssignSearch ? '▲ 絞り込み' : '▼ 絞り込み'}
            </button>
          </div>
          {showAssignSearch && (
            <div className="mb-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">科目</label>
                  <select value={assignSubjectFilter} onChange={e => setAssignSubjectFilter(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="all">すべて</option>
                    {SUBJECTS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">作業内容</label>
                  <select value={assignWorkTypeFilter} onChange={e => setAssignWorkTypeFilter(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="all">すべて</option>
                    {workTypesList.map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">期限（開始）</label>
                  <input type="date" value={assignDeadlineFrom} onChange={e => setAssignDeadlineFrom(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">期限（終了）</label>
                  <input type="date" value={assignDeadlineTo} onChange={e => setAssignDeadlineTo(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div className="flex items-end">
                  <button onClick={clearAssignFilters}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-100 transition">
                    条件クリア
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="space-y-3">
            {pendingTasks.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">条件に一致するタスクがありません</p>
            ) : pendingTasks.map(task => {
              const eligible = getEligibleCorrectors(task.subject);
              return (
                <div key={task.id} className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
                  <p className="text-sm font-medium text-gray-800 mb-1">{task.name}</p>
                  <p className="text-xs text-gray-500 mb-2">{task.subject}{task.workType ? ` · ${task.workType}` : ''} · {task.requiredHours}h · 期限: {task.deadline}</p>
                  {eligible.length === 0 ? (
                    <p className="text-xs text-red-500">担当可能な添削者がいません</p>
                  ) : (
                    <div className="flex gap-2">
                      <select
                        value={manualSelect[task.id] ?? ''}
                        onChange={e => setManualSelect(prev => ({ ...prev, [task.id]: e.target.value }))}
                        className="flex-1 text-sm px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="">添削者を選択...</option>
                        {eligible.map(c => {
                          const totalCap = capacities.filter(cap => cap.userId === c.id).reduce((s, cap) => s + cap.totalHours, 0);
                          const usedHours = assignments.filter(a => a.userId === c.id && !isFinished(a.status)).reduce((s, a) => s + a.assignedHours, 0);
                          const free = Math.max(0, totalCap - usedHours);
                          return (
                            <option key={c.id} value={c.id}>
                              {c.name}（空き工数: {free}h）
                            </option>
                          );
                        })}
                      </select>
                      <button
                        onClick={() => handleManualAssign(task.id)}
                        disabled={!manualSelect[task.id]}
                        className="text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg transition"
                      >
                        割り当て
                      </button>
                    </div>
                  )}
                  {eligible.length > 0 && (
                    <textarea
                      value={assignMemo[task.id] || ''}
                      onChange={e => setAssignMemo(prev => ({ ...prev, [task.id]: e.target.value }))}
                      placeholder="振り分けメモ（任意）"
                      rows={1}
                      className="w-full text-xs border border-gray-200 rounded-lg px-3 py-1.5 mt-1.5 placeholder-gray-400"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== 振り分け済みタスク（剥がし） ===== */}
      {assignedTasks.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">振り分け済みタスク（{assignedTasks.length}件）</h3>
          <p className="text-xs text-gray-400 mb-3">振り分けを解除（剥がし）すると、タスクは未割当に戻ります。</p>
          <div className="space-y-2">
            {assignedTasks.map(task => {
              const assignment = assignments.find(a => a.taskId === task.id && !isFinished(a.status));
              const assignedUser = assignment ? correctors.find(c => c.id === assignment.userId) : null;
              if (!assignment) return null;
              return (
                <div key={task.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{task.name}</p>
                    <p className="text-xs text-gray-500">
                      {task.subject}{task.workType ? ` · ${task.workType}` : ''} · {task.requiredHours}h · 期限: {task.deadline}
                    </p>
                    {assignedUser && (
                      <p className="text-xs text-blue-600 mt-0.5">担当: {assignedUser.name}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleUnassign(assignment.id, task.id)}
                    className="shrink-0 text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg transition font-medium"
                  >
                    剥がす
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== VIKINGタスク管理 ===== */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">VIKINGタスク管理</h3>

        {/* 未取得VIKINGタスク */}
        <div className="mb-4">
          <h4 className="text-xs font-medium text-gray-500 mb-2">未取得VIKINGタスク（{pendingVikingTasks.length}件）</h4>
          {pendingVikingTasks.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-3">未取得のVIKINGタスクはありません</p>
          ) : (
            <div className="space-y-2">
              {pendingVikingTasks.map(task => (
                <div key={task.id} className="p-3 bg-purple-50 border border-purple-100 rounded-lg">
                  <p className="text-sm font-medium text-gray-800 mb-1">{task.name}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                    <span>{task.subject}</span>
                    {task.workType && <span>· {task.workType}</span>}
                    <span>· {task.requiredHours}h</span>
                    {task.deadline && <span>· 期限: {task.deadline}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 取得済みVIKINGタスク */}
        <div>
          <button
            onClick={() => setShowClaimedViking(v => !v)}
            className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 transition mb-2"
          >
            <span>{showClaimedViking ? '▼' : '▶'}</span>
            <span>取得済みVIKINGタスク（{claimedVikingTasks.length}件）</span>
          </button>
          {showClaimedViking && (
            <div className="space-y-2">
              {claimedVikingTasks.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-3">取得済みのVIKINGタスクはありません</p>
              ) : (
                claimedVikingTasks.map(task => {
                  const assignedUser = getAssignedUser(task.id);
                  return (
                    <div key={task.id} className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-800 truncate">{task.name}</p>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                            <span>{task.subject}</span>
                            {task.workType && <span>· {task.workType}</span>}
                            <span>· {task.requiredHours}h</span>
                            {task.deadline && <span>· 期限: {task.deadline}</span>}
                          </div>
                        </div>
                        {assignedUser && (
                          <span className="text-xs text-blue-600 font-medium ml-2 whitespace-nowrap">
                            {assignedUser.name}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssignmentTab;
