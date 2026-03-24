import React, { useState, useMemo } from 'react';
import { useData, isFinished } from '../../contexts/DataContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { SUBJECTS_LIST } from '../../utils/storage.js';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { predictAllTasks } from '../../utils/prediction.js';
import { downloadAttachment, getAttachment } from '../../utils/fileStorage.js';
import { getPreviewHtml } from '../../utils/filePreview.js';
import { toCSV, downloadCSV } from '../../utils/csvUtils';

// ---- Helpers ----
const _fmtSec = (s) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}時間${m}分`;
  if (m > 0) return `${m}分${sec}秒`;
  return `${sec}秒`;
};

const PREDICTION_BADGE = {
  on_track: { text: '順調', cls: 'bg-green-100 text-green-700' },
  at_risk: { text: '注意', cls: 'bg-amber-100 text-amber-700' },
  overdue: { text: '遅延リスク', cls: 'bg-red-100 text-red-700' },
  insufficient: { text: '工数不足', cls: 'bg-gray-100 text-gray-600' },
  submitted: { text: '検証待ち', cls: 'bg-purple-100 text-purple-700' },
  completed: { text: '完了', cls: 'bg-green-100 text-green-700' },
  unassigned: { text: '未割当', cls: 'bg-amber-100 text-amber-700' },
};

const STATUS_COLOR_PRESETS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#78716c', '#64748b', '#334155',
];

// ---- ファイルプレビューパネル ----
const FilePreviewPanel = ({ attachments }) => {
  const [activeFileIdx, setActiveFileIdx] = React.useState(0);
  const [previewData, setPreviewData] = React.useState(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [activeSheetIdx, setActiveSheetIdx] = React.useState(0);

  React.useEffect(() => {
    if (!attachments || attachments.length === 0) return;
    const att = attachments[activeFileIdx];
    if (!att) return;
    setPreviewLoading(true);
    setPreviewData(null);
    setActiveSheetIdx(0);
    getAttachment(att.id).then(record => {
      if (record?.blob) {
        return getPreviewHtml(record.blob, record.fileName);
      }
      return { html: null, sheets: null, error: 'ファイルが見つかりません' };
    }).then(result => {
      setPreviewData(result);
    }).catch(err => {
      setPreviewData({ html: null, sheets: null, error: err.message });
    }).finally(() => {
      setPreviewLoading(false);
    });
  }, [attachments, activeFileIdx]);

  if (!attachments || attachments.length === 0) return null;

  return (
    <div>
      <p className="text-xs font-semibold text-blue-700 mb-2">ファイルプレビュー</p>
      {/* ファイルタブ */}
      {attachments.length > 1 && (
        <div className="flex gap-1 mb-2 flex-wrap">
          {attachments.map((att, idx) => (
            <button key={att.id}
              onClick={() => setActiveFileIdx(idx)}
              className={`text-[11px] px-2 py-1 rounded-lg transition ${idx === activeFileIdx ? 'bg-blue-600 text-white' : 'bg-white text-blue-700 border border-blue-200 hover:bg-blue-50'}`}>
              {att.fileName}
            </button>
          ))}
        </div>
      )}
      {attachments.length === 1 && (
        <p className="text-[11px] text-gray-500 mb-1">{attachments[0].fileName}</p>
      )}
      {/* シートタブ（Excel複数シート） */}
      {previewData?.sheets?.length > 1 && (
        <div className="flex gap-1 mb-2 flex-wrap">
          {previewData.sheets.map((s, idx) => (
            <button key={idx}
              onClick={() => setActiveSheetIdx(idx)}
              className={`text-[10px] px-2 py-0.5 rounded transition ${idx === activeSheetIdx ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {s.name}
            </button>
          ))}
        </div>
      )}
      {/* プレビュー本体 */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-auto max-h-[60vh]">
        {previewLoading && (
          <div className="p-8 text-center text-gray-400 text-sm">読み込み中...</div>
        )}
        {previewData?.error && (
          <div className="p-4 text-center text-red-500 text-xs">{previewData.error}</div>
        )}
        {!previewLoading && previewData?.sheets && (
          <div className="p-2 text-xs [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-gray-200 [&_td]:px-1.5 [&_td]:py-1 [&_th]:border [&_th]:border-gray-200 [&_th]:px-1.5 [&_th]:py-1 [&_th]:bg-gray-50 [&_th]:font-medium"
            dangerouslySetInnerHTML={{ __html: previewData.sheets[activeSheetIdx]?.html || '' }} />
        )}
        {!previewLoading && previewData?.html && !previewData?.sheets && (
          <div className="p-3 text-sm prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: previewData.html }} />
        )}
      </div>
    </div>
  );
};

const ProgressTab = ({ activeSubjects }) => {
  const {
    getTasks, getCorrectors, getAssignments, getCapacities,
    getExamInputs, getTimeLogs, getTaskTotalTime, getDaimonTotalTime,
    getRejectionCategories, getRejectionSeverities, getRejections, addRejection,
    getVerificationItems, getVerificationResults, initVerificationResults, toggleVerificationResult,
    updateAssignment,
    getWorkflowStatuses, addWorkflowStatus, updateWorkflowStatus, deleteWorkflowStatus, resolveWorkflowStatus,
    getFeedbacks, addFeedback,
    getWorkTypes,
  } = useData();
  const { user } = useAuth();
  const workTypesList = getWorkTypes().map(wt => wt.name);

  // ---- Raw data ----
  const allTasks = getTasks();
  const tasks = allTasks.filter(t => activeSubjects.includes(t.subject));
  const assignments = getAssignments();
  const correctors = getCorrectors();
  const capacities = getCapacities();

  // ---- Filter state ----
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [workTypeFilter, setWorkTypeFilter] = useState('all');
  const [deadlineFrom, setDeadlineFrom] = useState('');
  const [deadlineTo, setDeadlineTo] = useState('');
  const [assignedFrom, setAssignedFrom] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [statusFilter, setStatusFilter] = useState(null); // workflow status name or null = all
  const [searchText, setSearchText] = useState('');
  const [workerFilter, setWorkerFilter] = useState('all');

  // ---- UI state ----
  const [expandedTaskId, setExpandedTaskId] = useState(null);
  const [reviewingId, setReviewingId] = useState(null);
  const [reviewNote, setReviewNote] = useState('');
  const [rejectionItems, setRejectionItems] = useState([]);
  const [rejItemForm, setRejItemForm] = useState({ categoryId: '', severityId: '', note: '' });
  const [message, setMessage] = useState('');
  const [openChecklistId, setOpenChecklistId] = useState(null);
  const [feedbackAssignmentId, setFeedbackAssignmentId] = useState(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [showTaskDetail, setShowTaskDetail] = useState(false);
  const [showStatusConfig, setShowStatusConfig] = useState(false);

  // Status config panel state
  const [cfgSubject, setCfgSubject] = useState(null);
  const [cfgWorkType, setCfgWorkType] = useState(null);
  const [newStatusLabel, setNewStatusLabel] = useState('');
  const [newStatusColor, setNewStatusColor] = useState('#3b82f6');
  const [editingStatusId, setEditingStatusId] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [editColor, setEditColor] = useState('');

  // ---- Workflow statuses ----
  const workflowStatuses = getWorkflowStatuses();

  // Build task-assignment pairs with resolved status
  const taskAssignmentPairs = useMemo(() => {
    return tasks.map(task => {
      // Find the latest relevant assignment for this task
      const taskAssignments = assignments.filter(a => a.taskId === task.id);
      const activeAssignment = taskAssignments.find(a => !isFinished(a.status) && a.status !== 'rejected')
        || taskAssignments.find(a => isFinished(a.status))
        || taskAssignments[taskAssignments.length - 1]
        || null;
      const wfStatus = resolveWorkflowStatus(task, activeAssignment);
      return { task, assignment: activeAssignment, wfStatus };
    });
  }, [tasks, assignments]);

  // ---- Filtering ----
  const filteredPairs = useMemo(() => {
    return taskAssignmentPairs.filter(({ task, assignment, wfStatus }) => {
      if (subjectFilter !== 'all' && task.subject !== subjectFilter) return false;
      if (workTypeFilter !== 'all' && task.workType !== workTypeFilter) return false;
      if (deadlineFrom && task.deadline && task.deadline < deadlineFrom) return false;
      if (deadlineTo && task.deadline && task.deadline > deadlineTo) return false;
      if (assignedFrom && assignment?.assignedAt && assignment.assignedAt.slice(0, 10) < assignedFrom) return false;
      if (assignedTo && assignment?.assignedAt && assignment.assignedAt.slice(0, 10) > assignedTo) return false;
      if (statusFilter && wfStatus !== statusFilter) return false;
      if (workerFilter !== 'all') {
        if (!assignment || assignment.userId !== workerFilter) return false;
      }
      if (searchText.trim()) {
        const q = searchText.trim().toLowerCase();
        const corrector = assignment ? correctors.find(c => c.id === assignment.userId) : null;
        const haystack = [task.name, task.subject, task.workType, corrector?.name].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [taskAssignmentPairs, subjectFilter, workTypeFilter, deadlineFrom, deadlineTo, assignedFrom, assignedTo, statusFilter, workerFilter, searchText, correctors]);

  // ---- Status counts (respond to all filters EXCEPT statusFilter) ----
  const statusCounts = useMemo(() => {
    const counts = {};
    taskAssignmentPairs.forEach(({ task, assignment, wfStatus }) => {
      // apply all filters except status
      if (subjectFilter !== 'all' && task.subject !== subjectFilter) return;
      if (workTypeFilter !== 'all' && task.workType !== workTypeFilter) return;
      if (deadlineFrom && task.deadline && task.deadline < deadlineFrom) return;
      if (deadlineTo && task.deadline && task.deadline > deadlineTo) return;
      if (assignedFrom && assignment?.assignedAt && assignment.assignedAt.slice(0, 10) < assignedFrom) return;
      if (assignedTo && assignment?.assignedAt && assignment.assignedAt.slice(0, 10) > assignedTo) return;
      if (workerFilter !== 'all' && (!assignment || assignment.userId !== workerFilter)) return;
      if (searchText.trim()) {
        const q = searchText.trim().toLowerCase();
        const corrector = assignment ? correctors.find(c => c.id === assignment.userId) : null;
        const haystack = [task.name, task.subject, task.workType, corrector?.name].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return;
      }
      counts[wfStatus] = (counts[wfStatus] || 0) + 1;
    });
    return counts;
  }, [taskAssignmentPairs, subjectFilter, workTypeFilter, deadlineFrom, deadlineTo, assignedFrom, assignedTo, workerFilter, searchText, correctors]);

  const totalFiltered = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  // ---- Subject progress (responds to filters) ----
  const subjectProgress = useMemo(() => {
    return SUBJECTS_LIST.filter(s => activeSubjects.includes(s)).map(subject => {
      const st = filteredPairs.filter(({ task }) => task.subject === subject).map(p => p.task);
      const total = st.length;
      if (total === 0) return null;
      const pending = st.filter(t => t.status === 'pending').length;
      const assigned = st.filter(t => t.status === 'assigned').length;
      const inProgress = st.filter(t => t.status === 'in_progress').length;
      const submitted = st.filter(t => t.status === 'submitted').length;
      const completed = st.filter(t => isFinished(t.status)).length;
      const completionRate = Math.round((completed / total) * 100);
      const totalHours = st.reduce((s, t) => s + (t.requiredHours || 0), 0);
      const completedHours = st.filter(t => isFinished(t.status)).reduce((s, t) => s + (t.requiredHours || 0), 0);
      const hoursRate = totalHours > 0 ? Math.round((completedHours / totalHours) * 100) : 0;
      return { subject, total, pending, assigned, inProgress, submitted, completed, completionRate, totalHours, completedHours, hoursRate };
    }).filter(Boolean);
  }, [filteredPairs, activeSubjects]);

  // ---- Pie chart data ----
  const pieData = useMemo(() => {
    return [
      { name: '未割当', value: filteredPairs.filter(({ task }) => task.status === 'pending').length, color: '#f59e0b' },
      { name: '割当済', value: filteredPairs.filter(({ task }) => task.status === 'assigned').length, color: '#3b82f6' },
      { name: '作業中', value: filteredPairs.filter(({ task }) => task.status === 'in_progress').length, color: '#0ea5e9' },
      { name: '提出済', value: filteredPairs.filter(({ task }) => task.status === 'submitted').length, color: '#8b5cf6' },
      { name: '完了', value: filteredPairs.filter(({ task }) => isFinished(task.status)).length, color: '#10b981' },
    ].filter(d => d.value > 0);
  }, [filteredPairs]);

  // ---- Predictions ----
  const predictions = predictAllTasks(assignments, capacities, tasks);

  // ---- Clear filters ----
  const clearFilters = () => {
    setSubjectFilter('all');
    setWorkTypeFilter('all');
    setDeadlineFrom('');
    setDeadlineTo('');
    setAssignedFrom('');
    setAssignedTo('');
    setStatusFilter(null);
    setSearchText('');
    setWorkerFilter('all');
  };

  const hasActiveFilters = subjectFilter !== 'all' || workTypeFilter !== 'all' || deadlineFrom || deadlineTo || assignedFrom || assignedTo || statusFilter || searchText.trim() || workerFilter !== 'all';

  // ---- CSV export ----
  const EP_CSV_COLUMNS = [
    { key: 'taskName', header: 'タスク名' },
    { key: 'subject', header: '科目' },
    { key: 'workType', header: '作業内容' },
    { key: 'correctorName', header: '担当者' },
    { key: 'requiredHours', header: '予定工数' },
    { key: 'actualHours', header: '実績工数' },
    { key: 'deadline', header: '締め切り日' },
    { key: 'status', header: 'ステータス' },
  ];

  const handleExportCSV = () => {
    const data = filteredPairs.map(({ task, assignment, wfStatus }) => {
      const corrector = assignment ? correctors.find(c => c.id === assignment.userId) : null;
      const wsObj = workflowStatuses.find(ws => ws.name === wfStatus);
      return {
        taskName: task.name || '',
        subject: task.subject || '',
        workType: task.workType || '',
        correctorName: corrector?.name || '',
        requiredHours: task.requiredHours ?? '',
        actualHours: assignment?.actualHours ?? '',
        deadline: task.deadline || '',
        status: wsObj?.label || wfStatus,
      };
    });
    const csv = toCSV(data, EP_CSV_COLUMNS);
    downloadCSV(csv, `進捗管理_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  // ---- Status config helpers ----
  const cfgStatuses = getWorkflowStatuses(cfgSubject, cfgWorkType);

  const handleAddStatus = () => {
    if (!newStatusLabel.trim()) return;
    const maxSort = cfgStatuses.reduce((m, s) => Math.max(m, s.sortOrder), 0);
    addWorkflowStatus({
      subject: cfgSubject,
      workType: cfgWorkType,
      name: newStatusLabel.trim().toLowerCase().replace(/\s+/g, '_'),
      label: newStatusLabel.trim(),
      color: newStatusColor,
      sortOrder: maxSort + 1,
    });
    setNewStatusLabel('');
    setNewStatusColor('#3b82f6');
  };

  const handleReorder = (id, direction) => {
    const sorted = [...cfgStatuses].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex(s => s.id === id);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const orderA = sorted[idx].sortOrder;
    const orderB = sorted[swapIdx].sortOrder;
    updateWorkflowStatus(sorted[idx].id, { sortOrder: orderB });
    updateWorkflowStatus(sorted[swapIdx].id, { sortOrder: orderA });
  };

  return (
    <div className="space-y-4">
      {message && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">
          {message}
        </div>
      )}

      {/* ===== 1. Filter Bar ===== */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-3">
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">科目</label>
            <select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="all">全て</option>
              {SUBJECTS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">業務内容</label>
            <select value={workTypeFilter} onChange={e => setWorkTypeFilter(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="all">全て</option>
              {workTypesList.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">締め切り日（開始）</label>
            <input type="date" value={deadlineFrom} onChange={e => setDeadlineFrom(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">締め切り日（終了）</label>
            <input type="date" value={deadlineTo} onChange={e => setDeadlineTo(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">振り分け日（開始）</label>
            <input type="date" value={assignedFrom} onChange={e => setAssignedFrom(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">振り分け日（終了）</label>
            <input type="date" value={assignedTo} onChange={e => setAssignedTo(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">作業者</label>
            <select value={workerFilter} onChange={e => setWorkerFilter(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="all">全て</option>
              {correctors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">テキスト検索</label>
            <input type="text" value={searchText} onChange={e => setSearchText(e.target.value)}
              placeholder="タスク名・科目・担当者..."
              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
        </div>

        {/* Workflow status pills */}
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="text-xs text-gray-500 shrink-0">ステータス:</span>
          <button
            onClick={() => setStatusFilter(null)}
            className={`text-xs px-3 py-1 rounded-full transition font-medium ${
              !statusFilter ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            全て ({totalFiltered})
          </button>
          {workflowStatuses.map(ws => {
            const count = statusCounts[ws.name] || 0;
            return (
              <button key={ws.id}
                onClick={() => setStatusFilter(statusFilter === ws.name ? null : ws.name)}
                className={`text-xs px-3 py-1 rounded-full transition font-medium border ${
                  statusFilter === ws.name
                    ? 'text-white border-transparent'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
                style={statusFilter === ws.name ? { backgroundColor: ws.color, borderColor: ws.color } : {}}
              >
                {ws.label} ({count})
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button onClick={clearFilters}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-100 transition">
              条件クリア
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button onClick={handleExportCSV} disabled={filteredPairs.length === 0}
              className="text-xs px-3 py-1.5 rounded-lg border border-green-300 text-green-700 hover:bg-green-50 disabled:opacity-40 transition font-medium">
              CSV出力
            </button>
          </div>
        </div>
      </div>

      {/* ===== 2. Status Summary Cards ===== */}
      <div className="overflow-x-auto">
        <div className="flex gap-2 min-w-0 pb-1">
          {workflowStatuses.map(ws => {
            const count = statusCounts[ws.name] || 0;
            return (
              <button key={ws.id}
                onClick={() => setStatusFilter(statusFilter === ws.name ? null : ws.name)}
                className={`shrink-0 px-4 py-3 rounded-xl border transition cursor-pointer ${
                  statusFilter === ws.name ? 'ring-2 ring-offset-1' : ''
                }`}
                style={{
                  borderColor: ws.color + '40',
                  backgroundColor: ws.color + '10',
                  ...(statusFilter === ws.name ? { ringColor: ws.color } : {}),
                }}
              >
                <div className="text-2xl font-bold" style={{ color: ws.color }}>{count}</div>
                <div className="text-xs text-gray-600 whitespace-nowrap">{ws.label}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ===== 3. Subject Progress Bars ===== */}
      {subjectProgress.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">科目別 業務進捗</h3>
          <div className="space-y-4">
            {subjectProgress.map(sp => (
              <div key={sp.subject} className="p-4 rounded-xl border border-gray-100 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-800">{sp.subject}</span>
                  <span className="text-xs text-gray-500">
                    {sp.completed}/{sp.total}件 完了
                    <span className="ml-2 font-medium text-gray-700">({sp.completionRate}%)</span>
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4 flex overflow-hidden">
                  {sp.completed > 0 && (
                    <div className="bg-green-500 h-full transition-all" style={{ width: `${(sp.completed / sp.total) * 100}%` }} />
                  )}
                  {sp.submitted > 0 && (
                    <div className="bg-purple-500 h-full transition-all" style={{ width: `${(sp.submitted / sp.total) * 100}%` }} />
                  )}
                  {sp.inProgress > 0 && (
                    <div className="bg-sky-500 h-full transition-all" style={{ width: `${(sp.inProgress / sp.total) * 100}%` }} />
                  )}
                  {sp.assigned > 0 && (
                    <div className="bg-blue-500 h-full transition-all" style={{ width: `${(sp.assigned / sp.total) * 100}%` }} />
                  )}
                  {sp.pending > 0 && (
                    <div className="bg-amber-400 h-full transition-all" style={{ width: `${(sp.pending / sp.total) * 100}%` }} />
                  )}
                </div>
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                  {sp.completed > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>完了 {sp.completed}
                    </span>
                  )}
                  {sp.submitted > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>提出済 {sp.submitted}
                    </span>
                  )}
                  {sp.inProgress > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span>作業中 {sp.inProgress}
                    </span>
                  )}
                  {sp.assigned > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>割当済 {sp.assigned}
                    </span>
                  )}
                  {sp.pending > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>未割当 {sp.pending}
                    </span>
                  )}
                  <span className="ml-auto text-gray-400">
                    工数: {sp.completedHours}h / {sp.totalHours}h ({sp.hoursRate}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== Pie Chart + Predictions (collapsible) ===== */}
      {filteredPairs.length > 0 && pieData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">タスクステータス分布</h3>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 shrink-0">
              {pieData.map(d => (
                <div key={d.name} className="flex items-center gap-2 text-sm">
                  <span className="w-3 h-3 rounded-full" style={{ background: d.color }}></span>
                  <span className="text-gray-600">{d.name}: <strong>{d.value}件</strong></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Prediction table (collapsible) */}
      {predictions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <button
            onClick={() => setShowTaskDetail(!showTaskDetail)}
            className="w-full flex items-center justify-between text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors"
          >
            <span>試験種別の詳細予測</span>
            <span className="text-gray-400 text-xs ml-2">{showTaskDetail ? '▲ 閉じる' : '▼ 詳細を表示'}</span>
          </button>
          {showTaskDetail && (
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-2 text-gray-500 font-medium">タスク名</th>
                    <th className="text-left py-2 px-2 text-gray-500 font-medium">担当者</th>
                    <th className="text-right py-2 px-2 text-gray-500 font-medium">残り工数</th>
                    <th className="text-right py-2 px-2 text-gray-500 font-medium">予測完了日</th>
                    <th className="text-right py-2 px-2 text-gray-500 font-medium">期限</th>
                    <th className="text-center py-2 px-2 text-gray-500 font-medium">状態</th>
                  </tr>
                </thead>
                <tbody>
                  {predictions.map(p => {
                    const task = tasks.find(t => t.id === p.taskId);
                    const assignment = assignments.find(a => a.taskId === p.taskId && !isFinished(a.status));
                    const corrector = assignment ? correctors.find(c => c.id === assignment.userId) : null;
                    const badge = PREDICTION_BADGE[p.status] || PREDICTION_BADGE.unassigned;
                    return (
                      <tr key={p.taskId} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 px-2 font-medium text-gray-800">{task?.name ?? '不明'}</td>
                        <td className="py-2 px-2 text-gray-600">{corrector?.name ?? '—'}</td>
                        <td className="py-2 px-2 text-right text-gray-600">{p.remainingHours != null ? `${p.remainingHours}h` : '—'}</td>
                        <td className="py-2 px-2 text-right text-gray-600">{p.predictedDate ?? '—'}</td>
                        <td className="py-2 px-2 text-right text-gray-600">{p.deadline ?? '—'}</td>
                        <td className="py-2 px-2 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>{badge.text}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===== 4. Task List ===== */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">
            タスク一覧（{filteredPairs.length}件）
          </h3>
        </div>

        {filteredPairs.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">該当するタスクはありません</p>
        ) : (
          <div className="space-y-2">
            {filteredPairs.map(({ task, assignment, wfStatus }) => {
              const corrector = assignment ? correctors.find(c => c.id === assignment.userId) : null;
              const wsObj = workflowStatuses.find(ws => ws.name === wfStatus);
              const isExpanded = expandedTaskId === task.id;
              const isOverdue = task.deadline && task.deadline < new Date().toISOString().slice(0, 10) && !isFinished(task.status);

              return (
                <div key={task.id} className="border border-gray-100 rounded-xl overflow-hidden">
                  {/* Row header */}
                  <button
                    onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition text-left"
                  >
                    {/* Status badge */}
                    <span
                      className="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                      style={{ backgroundColor: wsObj?.color || '#94a3b8' }}
                    >
                      {wsObj?.label || wfStatus}
                    </span>

                    {/* Task name */}
                    <span className="text-sm font-medium text-gray-800 truncate flex-1 min-w-0">{task.name}</span>

                    {/* Assigned user */}
                    <span className="text-xs text-gray-500 shrink-0">{corrector?.name || '—'}</span>

                    {/* Hours */}
                    <span className="text-xs text-gray-400 shrink-0 hidden sm:inline">
                      {task.requiredHours || 0}h{assignment?.actualHours != null ? ` / ${assignment.actualHours}h` : ''}
                    </span>

                    {/* Deadline */}
                    <span className={`text-xs shrink-0 ${isOverdue ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                      {task.deadline || '—'}
                      {isOverdue && ' (期限超過)'}
                    </span>

                    {/* Rejection count */}
                    {assignment?.rejectionCount > 0 && (
                      <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700">
                        差戻{assignment.rejectionCount}
                      </span>
                    )}

                    {/* Expand icon */}
                    <span className="text-gray-400 text-xs shrink-0">{isExpanded ? '▲' : '▼'}</span>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-3">
                      {/* Assignment details */}
                      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-600">
                        <span>科目: <strong>{task.subject}</strong></span>
                        {task.workType && <span>業務内容: <strong>{task.workType}</strong></span>}
                        {corrector && <span>担当: <strong>{corrector.name}</strong></span>}
                        {assignment?.actualHours != null && <span>実績: <strong>{assignment.actualHours}h</strong></span>}
                        {assignment?.submittedAt && (
                          <span>提出日: <strong>{new Date(assignment.submittedAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}</strong></span>
                        )}
                        {assignment?.assignedAt && (
                          <span>振り分け日: <strong>{new Date(assignment.assignedAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}</strong></span>
                        )}
                      </div>

                      {/* Spreadsheet link */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {task.sheetsUrl && (
                          <a href={task.sheetsUrl} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-green-600 hover:text-green-800 bg-green-50 hover:bg-green-100 px-1.5 py-0.5 rounded transition">
                            スプシを開く
                          </a>
                        )}
                        {(() => {
                          const examInputs = getExamInputs(task.id);
                          return examInputs.length > 0 ? (
                            <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">入力データあり</span>
                          ) : null;
                        })()}
                      </div>

                      {/* Attachments */}
                      {assignment?.attachments && assignment.attachments.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-gray-600 mb-1">添付ファイル（{assignment.attachments.length}件）</p>
                          <div className="flex flex-wrap gap-1">
                            {assignment.attachments.map(att => (
                              <button key={att.id}
                                onClick={() => downloadAttachment(att.id, att.fileName)}
                                className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-1 rounded-lg transition border border-blue-200">
                                {att.fileName} ({(att.fileSize / 1024).toFixed(0)}KB)
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Daimon work time */}
                      {(() => {
                        const totalSec = getTaskTotalTime(task.id);
                        if (!totalSec || totalSec <= 0) return null;
                        const logs = getTimeLogs({ taskId: task.id });
                        const daimonIds = [...new Set(logs.map(l => l.daimonId))].sort((a, b) => {
                          if (a === null) return 1; if (b === null) return -1; return a - b;
                        });
                        return (
                          <div>
                            <p className="text-xs font-medium text-gray-600 mb-1">大問別作業時間</p>
                            <div className="flex flex-wrap gap-1">
                              {daimonIds.map(did => {
                                const dSec = getDaimonTotalTime(task.id, did);
                                const pct = Math.round((dSec / totalSec) * 100);
                                return (
                                  <span key={did ?? 'null'} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-lg border border-gray-200">
                                    {did != null ? `大問${did}` : 'その他'}: {_fmtSec(dSec)} ({pct}%)
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}

                      {/* ---- Verification workflow (from ExamProcessingTab) ---- */}
                      {assignment && (
                        <div className="space-y-2 pt-2 border-t border-gray-200">
                          {/* Action buttons */}
                          <div className="flex gap-2 flex-wrap">
                            {/* Start verification */}
                            {(assignment.status === 'submitted' && assignment.verificationStatus !== 'reviewing' && assignment.status !== 'approved') && (
                              <button
                                onClick={() => {
                                  updateAssignment(assignment.id, { verificationStatus: 'reviewing' });
                                  initVerificationResults(assignment.id, task.subject, user?.id, task.workType);
                                  setOpenChecklistId(assignment.id);
                                  setMessage('検証を開始しました');
                                  setTimeout(() => setMessage(''), 3000);
                                }}
                                className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition text-sm font-medium"
                              >
                                検証開始
                              </button>
                            )}

                            {/* Checklist toggle */}
                            {assignment.verificationStatus === 'reviewing' && assignment.status !== 'approved' && (
                              <button
                                onClick={() => setOpenChecklistId(openChecklistId === assignment.id ? null : assignment.id)}
                                className={`px-4 py-2 rounded-xl transition text-sm font-medium ${openChecklistId === assignment.id ? 'bg-blue-700 text-white' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
                              >
                                {openChecklistId === assignment.id ? 'チェックリストを閉じる' : '検証チェックリスト'}
                              </button>
                            )}

                            {/* Approve */}
                            {assignment.status !== 'approved' && (assignment.status === 'submitted' || assignment.verificationStatus === 'reviewing') && (
                              <button
                                onClick={() => {
                                  const results = getVerificationResults(assignment.id) || [];
                                  const allItems = getVerificationItems(task.subject) || [];
                                  const uncheckedRequired = results.filter(r => {
                                    const item = allItems.find(vi => vi.id === r.verificationItemId);
                                    return item?.isRequired && !r.checked;
                                  });
                                  if (uncheckedRequired.length > 0) {
                                    const itemNames = uncheckedRequired.map(r => {
                                      const item = allItems.find(vi => vi.id === r.verificationItemId);
                                      return item?.name || '不明';
                                    }).join('、');
                                    if (!window.confirm(`以下の必須検証項目が未チェックです。承認しますか？\n\n${itemNames}`)) return;
                                  }
                                  updateAssignment(assignment.id, { status: 'approved', verificationStatus: 'verified', reviewedAt: new Date().toISOString() });
                                  setOpenChecklistId(null);
                                  setMessage('検証済みにしました');
                                  setTimeout(() => setMessage(''), 3000);
                                }}
                                className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition text-sm font-medium"
                              >
                                承認
                              </button>
                            )}

                            {/* Reject */}
                            {assignment.status !== 'approved' && (assignment.status === 'submitted' || assignment.verificationStatus === 'reviewing') && (
                              <button
                                onClick={() => {
                                  setReviewingId(reviewingId === assignment.id ? null : assignment.id);
                                  setReviewNote('');
                                  setRejectionItems([]);
                                }}
                                className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition text-sm font-medium"
                              >
                                差し戻し
                              </button>
                            )}
                          </div>

                          {/* Verification checklist panel + file preview */}
                          {openChecklistId === assignment.id && (assignment.verificationStatus === 'reviewing' || assignment.verificationStatus === undefined) && (() => {
                            const results = getVerificationResults(assignment.id) || [];
                            const allItems = getVerificationItems(task.subject, 'verification', task.workType) || [];
                            const checkedCount = results.filter(r => r.checked).length;
                            const totalCount = results.length;
                            const progress = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;

                            const commonResults = results.filter(r => {
                              const item = allItems.find(vi => vi.id === r.verificationItemId);
                              return item && !item.subject;
                            });
                            const subjectResults = results.filter(r => {
                              const item = allItems.find(vi => vi.id === r.verificationItemId);
                              return item && item.subject;
                            });

                            const hasAttachments = assignment?.attachments?.length > 0;

                            const ChecklistContent = () => (
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <p className="text-xs font-semibold text-blue-700">検証チェックリスト</p>
                                  <span className="text-xs text-blue-600">{checkedCount} / {totalCount} 完了</span>
                                </div>

                                <div className="w-full bg-blue-100 rounded-full h-2">
                                  <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                                </div>

                                {/* 提出前チェック結果（読み取り専用） */}
                                {assignment.submissionChecklistResults?.length > 0 && (
                                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-2">
                                    <p className="text-[10px] font-semibold text-purple-600 mb-1">提出前チェック結果</p>
                                    {assignment.submissionChecklistResults.map((cr, i) => {
                                      const vi = (getVerificationItems() || []).find(v => v.id === cr.itemId);
                                      return (
                                        <div key={i} className="flex items-center gap-1.5 text-xs text-purple-700">
                                          <span>{cr.checked ? '✅' : '⬜'}</span>
                                          <span>{vi?.name || cr.itemId}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}

                                {totalCount === 0 ? (
                                  <p className="text-xs text-gray-500">検証項目が登録されていません。マスタタブで追加してください。</p>
                                ) : (
                                  <>
                                    {commonResults.length > 0 && (
                                      <div>
                                        <p className="text-[11px] font-semibold text-gray-500 mb-1.5">全科目共通</p>
                                        <div className="space-y-1">
                                          {commonResults.sort((a, b) => {
                                            const ia = allItems.find(vi => vi.id === a.verificationItemId);
                                            const ib = allItems.find(vi => vi.id === b.verificationItemId);
                                            return (ia?.sortOrder || 0) - (ib?.sortOrder || 0);
                                          }).map(r => {
                                            const item = allItems.find(vi => vi.id === r.verificationItemId);
                                            if (!item) return null;
                                            return (
                                              <label key={r.id} className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer transition ${r.checked ? 'bg-green-50 border border-green-200' : 'bg-white border border-gray-200 hover:border-blue-300'}`}>
                                                <input type="checkbox" checked={r.checked}
                                                  onChange={() => toggleVerificationResult(r.id)}
                                                  className="mt-0.5 rounded border-gray-300" />
                                                <div className="flex-1 min-w-0">
                                                  <div className="flex items-center gap-1.5">
                                                    <span className={`text-sm ${r.checked ? 'text-green-700 line-through' : 'text-gray-800'}`}>{item.name}</span>
                                                    {item.isRequired && <span className="text-[10px] bg-red-100 text-red-600 px-1 py-0.5 rounded-full">必須</span>}
                                                    {r.checked
                                                      ? <span className="text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full">OK</span>
                                                      : <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">未確認</span>
                                                    }
                                                  </div>
                                                  {item.description && <p className="text-[11px] text-gray-400 mt-0.5">{item.description}</p>}
                                                </div>
                                              </label>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}

                                    {subjectResults.length > 0 && (
                                      <div>
                                        <p className="text-[11px] font-semibold text-gray-500 mb-1.5">{task.subject}固有</p>
                                        <div className="space-y-1">
                                          {subjectResults.sort((a, b) => {
                                            const ia = allItems.find(vi => vi.id === a.verificationItemId);
                                            const ib = allItems.find(vi => vi.id === b.verificationItemId);
                                            return (ia?.sortOrder || 0) - (ib?.sortOrder || 0);
                                          }).map(r => {
                                            const item = allItems.find(vi => vi.id === r.verificationItemId);
                                            if (!item) return null;
                                            return (
                                              <label key={r.id} className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer transition ${r.checked ? 'bg-green-50 border border-green-200' : 'bg-white border border-gray-200 hover:border-blue-300'}`}>
                                                <input type="checkbox" checked={r.checked}
                                                  onChange={() => toggleVerificationResult(r.id)}
                                                  className="mt-0.5 rounded border-gray-300" />
                                                <div className="flex-1 min-w-0">
                                                  <div className="flex items-center gap-1.5">
                                                    <span className={`text-sm ${r.checked ? 'text-green-700 line-through' : 'text-gray-800'}`}>{item.name}</span>
                                                    {item.isRequired && <span className="text-[10px] bg-red-100 text-red-600 px-1 py-0.5 rounded-full">必須</span>}
                                                    {r.checked
                                                      ? <span className="text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full">OK</span>
                                                      : <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">未確認</span>
                                                    }
                                                  </div>
                                                  {item.description && <p className="text-[11px] text-gray-400 mt-0.5">{item.description}</p>}
                                                </div>
                                              </label>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            );

                            return hasAttachments ? (
                              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                                <div className="flex flex-col lg:flex-row gap-4">
                                  {/* 左: ファイルプレビュー */}
                                  <div className="lg:w-3/5 w-full">
                                    <FilePreviewPanel attachments={assignment.attachments} />
                                  </div>
                                  {/* 右: チェックリスト */}
                                  <div className="lg:w-2/5 w-full">
                                    <ChecklistContent />
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                                <ChecklistContent />
                              </div>
                            );
                          })()}

                          {/* Rejection panel */}
                          {reviewingId === assignment.id && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-3">
                              <p className="text-xs font-semibold text-red-700">差し戻し詳細を入力してください</p>

                              {/* Rejection item form */}
                              <div className="flex flex-wrap gap-2 items-end">
                                <select value={rejItemForm.categoryId}
                                  onChange={e => setRejItemForm(f => ({ ...f, categoryId: e.target.value }))}
                                  className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 min-w-[120px]">
                                  <option value="">カテゴリ選択</option>
                                  {(getRejectionCategories(task.subject, task.workType) || []).map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name}{cat.subject ? ` (${cat.subject})` : ''}{cat.workType ? ` [${cat.workType}]` : ''}</option>
                                  ))}
                                </select>
                                <select value={rejItemForm.severityId}
                                  onChange={e => setRejItemForm(f => ({ ...f, severityId: e.target.value }))}
                                  className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 min-w-[100px]">
                                  <option value="">重大度</option>
                                  {(getRejectionSeverities() || []).sort((a, b) => a.level - b.level).map(sev => (
                                    <option key={sev.id} value={sev.id}>{sev.name} (Lv.{sev.level})</option>
                                  ))}
                                </select>
                                <input type="text" placeholder="詳細メモ" value={rejItemForm.note}
                                  onChange={e => setRejItemForm(f => ({ ...f, note: e.target.value }))}
                                  className="flex-1 min-w-[120px] text-xs border border-gray-300 rounded-lg px-2 py-1.5" />
                                <button onClick={() => {
                                  if (!rejItemForm.categoryId || !rejItemForm.severityId) return;
                                  setRejectionItems(prev => [...prev, { ...rejItemForm }]);
                                  setRejItemForm({ categoryId: '', severityId: '', note: '' });
                                }}
                                  className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg transition">
                                  + 追加
                                </button>
                              </div>

                              {/* Added rejection items */}
                              {rejectionItems.length > 0 && (
                                <div className="space-y-1">
                                  {rejectionItems.map((item, idx) => {
                                    const cat = (getRejectionCategories() || []).find(c => c.id === item.categoryId);
                                    const sev = (getRejectionSeverities() || []).find(s => s.id === item.severityId);
                                    return (
                                      <div key={idx} className="flex items-center gap-2 bg-white rounded-lg p-2 text-xs">
                                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: sev?.color || '#999' }}></span>
                                        <span className="font-medium">{cat?.name || '不明'}</span>
                                        <span className="text-gray-500">（{sev?.name || '不明'}）</span>
                                        {item.note && <span className="text-gray-600 truncate">{item.note}</span>}
                                        <button onClick={() => setRejectionItems(prev => prev.filter((_, i) => i !== idx))}
                                          className="ml-auto text-red-400 hover:text-red-600">×</button>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Comment */}
                              <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)}
                                placeholder="総合コメント（任意）" rows={2}
                                className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2" />

                              <div className="flex gap-2 justify-end">
                                <button onClick={() => { setReviewingId(null); setReviewNote(''); setRejectionItems([]); }}
                                  className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg">キャンセル</button>
                                <button onClick={() => {
                                  const results = getVerificationResults(assignment.id) || [];
                                  const failedVerificationItemIds = results
                                    .filter(r => !r.checked)
                                    .map(r => r.verificationItemId);
                                  updateAssignment(assignment.id, {
                                    status: 'rejected',
                                    verificationStatus: null,
                                    reviewNote: reviewNote,
                                    reviewedAt: new Date().toISOString(),
                                    rejectionCount: (assignment.rejectionCount || 0) + 1,
                                    rejectionDetails: rejectionItems.map(item => ({
                                      ...item,
                                      rejectedBy: user?.id,
                                    })),
                                    failedVerificationItemIds,
                                  });
                                  setReviewingId(null);
                                  setOpenChecklistId(null);
                                  setReviewNote('');
                                  setRejectionItems([]);
                                  setMessage('差し戻しました');
                                  setTimeout(() => setMessage(''), 3000);
                                }}
                                  className="text-xs bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-lg transition">
                                  差し戻しを確定
                                </button>
                              </div>
                            </div>
                          )}

                          {/* FB（フィードバック）パネル - 社会のみ */}
                          {task.subject === '社会' && (assignment.status === 'submitted' || assignment.status === 'approved') && (
                            <div className="mt-2">
                              {feedbackAssignmentId === assignment.id ? (
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                                  <p className="text-xs font-semibold text-amber-700">フィードバックを送信</p>
                                  <textarea
                                    value={feedbackText}
                                    onChange={e => setFeedbackText(e.target.value)}
                                    placeholder="フィードバック内容を入力..."
                                    rows={3}
                                    className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2"
                                  />
                                  <div className="flex gap-2 justify-end">
                                    <button onClick={() => { setFeedbackAssignmentId(null); setFeedbackText(''); }}
                                      className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg">キャンセル</button>
                                    <button onClick={() => {
                                      if (!feedbackText.trim()) return;
                                      addFeedback({
                                        assignmentId: assignment.id,
                                        taskId: task.id,
                                        fromUserId: user?.id,
                                        toUserId: assignment.userId,
                                        subject: task.subject,
                                        message: feedbackText.trim(),
                                      });
                                      setFeedbackAssignmentId(null);
                                      setFeedbackText('');
                                      setMessage('FBを送信しました');
                                      setTimeout(() => setMessage(''), 3000);
                                    }}
                                      disabled={!feedbackText.trim()}
                                      className="text-xs bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white px-4 py-1.5 rounded-lg transition">
                                      送信
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button onClick={() => setFeedbackAssignmentId(assignment.id)}
                                  className="text-xs text-amber-600 hover:text-amber-800 border border-amber-200 px-3 py-1.5 rounded-lg transition">
                                  💬 FB送信
                                </button>
                              )}
                              {/* 送信済みFB一覧 */}
                              {(() => {
                                const fbs = (getFeedbacks({ assignmentId: assignment.id }) || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                                if (fbs.length === 0) return null;
                                return (
                                  <div className="mt-2 space-y-1">
                                    <p className="text-[10px] text-gray-500">送信済みFB（{fbs.length}件）</p>
                                    {fbs.map(fb => (
                                      <div key={fb.id} className="p-2 bg-amber-50 border border-amber-100 rounded-lg text-xs">
                                        <p className="text-gray-700">{fb.message}</p>
                                        <p className="text-[10px] text-gray-400 mt-0.5">{new Date(fb.createdAt).toLocaleString('ja-JP')}</p>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()}
                            </div>
                          )}
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

      {/* ===== 5. Status Config Panel ===== */}
      <div className="bg-white rounded-xl shadow-sm">
        <button
          onClick={() => setShowStatusConfig(!showStatusConfig)}
          className="w-full flex items-center justify-between p-4 text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors"
        >
          <span>ワークフローステータス設定</span>
          <span className="text-gray-400 text-xs">{showStatusConfig ? '▲ 閉じる' : '▼ 設定を開く'}</span>
        </button>

        {showStatusConfig && (
          <div className="px-5 pb-5 space-y-4">
            {/* Subject x WorkType selector */}
            <div className="flex gap-3 flex-wrap">
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">科目</label>
                <select value={cfgSubject ?? ''} onChange={e => setCfgSubject(e.target.value || null)}
                  className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="">デフォルト（全科目共通）</option>
                  {SUBJECTS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">業務内容</label>
                <select value={cfgWorkType ?? ''} onChange={e => setCfgWorkType(e.target.value || null)}
                  className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="">全て</option>
                  {workTypesList.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>
            </div>

            {/* Current statuses list */}
            <div className="space-y-1">
              {cfgStatuses.map((ws, idx) => (
                <div key={ws.id} className="flex items-center gap-2 p-2 rounded-lg border border-gray-100 bg-gray-50">
                  <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: ws.color }}></span>

                  {editingStatusId === ws.id ? (
                    <>
                      <input type="text" value={editLabel} onChange={e => setEditLabel(e.target.value)}
                        className="text-xs border border-gray-300 rounded px-1.5 py-1 flex-1" />
                      <div className="flex gap-1 shrink-0">
                        {STATUS_COLOR_PRESETS.slice(0, 10).map(c => (
                          <button key={c} onClick={() => setEditColor(c)}
                            className={`w-4 h-4 rounded-full border-2 ${editColor === c ? 'border-gray-800' : 'border-transparent'}`}
                            style={{ backgroundColor: c }} />
                        ))}
                      </div>
                      <button onClick={() => {
                        updateWorkflowStatus(ws.id, { label: editLabel, color: editColor });
                        setEditingStatusId(null);
                      }}
                        className="text-xs text-blue-600 hover:text-blue-800">保存</button>
                      <button onClick={() => setEditingStatusId(null)}
                        className="text-xs text-gray-400 hover:text-gray-600">取消</button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm text-gray-800 flex-1">{ws.label}</span>
                      {ws.isDefault && <span className="text-[10px] text-gray-400">デフォルト</span>}
                      <button onClick={() => handleReorder(ws.id, 'up')} disabled={idx === 0}
                        className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-30">↑</button>
                      <button onClick={() => handleReorder(ws.id, 'down')} disabled={idx === cfgStatuses.length - 1}
                        className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-30">↓</button>
                      {!ws.isDefault && (
                        <>
                          <button onClick={() => { setEditingStatusId(ws.id); setEditLabel(ws.label); setEditColor(ws.color); }}
                            className="text-xs text-blue-500 hover:text-blue-700">編集</button>
                          <button onClick={() => { if (window.confirm(`「${ws.label}」を削除しますか？`)) deleteWorkflowStatus(ws.id); }}
                            className="text-xs text-red-400 hover:text-red-600">削除</button>
                        </>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Add new status */}
            <div className="flex items-end gap-2 flex-wrap p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">新しいステータス</label>
                <input type="text" value={newStatusLabel} onChange={e => setNewStatusLabel(e.target.value)}
                  placeholder="ステータス名"
                  className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">色</label>
                <div className="flex gap-1">
                  {STATUS_COLOR_PRESETS.map(c => (
                    <button key={c} onClick={() => setNewStatusColor(c)}
                      className={`w-5 h-5 rounded-full border-2 transition ${newStatusColor === c ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <button onClick={handleAddStatus} disabled={!newStatusLabel.trim()}
                className="text-xs px-4 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition font-medium">
                追加
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProgressTab;
