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

const FB_CATEGORIES = [
  { id: 'fb1a', label: '1-a. 字数指定以外で、短答問題以外を対応している' },
  { id: 'fb1b', label: '1-b. A〜D列の記入にミスがある' },
  { id: 'fb1c', label: '1-c. E・J列か、「構成」シートに記入がされている' },
  { id: 'fb1d', label: '1-d. 中問分割試験種の作業をしている（作業対象外試験種の報告ができていない）' },
  { id: 'fb2a', label: '2-a. スプレッドシートの「内容」のシートのF列に完答・順不同を記載できていない' },
  { id: 'fb3a', label: '3-a. スプレッドシートの「内容」のシートのH列に別解が記載できていない' },
  { id: 'fb3b', label: '3-b. 解答がマニュアルに記載された6パターンの場合、別解を指定の通りに記載できていない' },
  { id: 'fb4a', label: '4-a. 解答がマニュアルに記載された6パターン以外の場合、別解を別解リストを参照しながら正しく記載できていない' },
  { id: 'fb5a', label: '5-a. 条件指定をスプレッドシートの「内容」のシートのG列に記載できていない' },
  { id: 'fb6a', label: '6-a. 不可解答がある場合、スプレッドシートの「内容」のシートのI列に記載できていない' },
  { id: 'fb7a', label: '7-a. 別解と条件指定両方が存在する場合、条件指定を優先できていない' },
  { id: 'fb8a', label: '8-a. 英数字に関して、1桁の場合は全角、2桁以上の場合や（1）（A）のように（）内に英数字を入れる場合は半角にできていない' },
  { id: 'fb8b', label: '8-b. かっこが全角にできていない' },
  { id: 'fb8c', label: '8-c. 読点や別解が複数ある場合、全角のカンマ（，）で区切ることができていない' },
];

// Helper to parse structured FB message into parts
const parseFbMessage = (message) => {
  if (!message) return null;
  const contentMatch = message.match(/【FB内容】\n([\s\S]*?)(?:\n\n【詳細】|$)/);
  const detailMatch = message.match(/【詳細】\n([\s\S]*)$/);
  if (!contentMatch) return null;
  const items = contentMatch[1].split('\n').filter(s => s.trim());
  const detail = detailMatch ? detailMatch[1].trim() : '';
  return { items, detail };
};

// Component to render structured FB message
const StructuredFbDisplay = ({ message }) => {
  const parsed = parseFbMessage(message);
  if (!parsed) {
    return <p className="text-gray-700">{message}</p>;
  }
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold text-amber-700">FB内容：</p>
      <ul className="list-disc list-inside space-y-0.5">
        {parsed.items.map((item, i) => (
          <li key={i} className="text-gray-700 text-xs leading-relaxed">{item.replace(/^・/, '')}</li>
        ))}
      </ul>
      {parsed.detail && (
        <>
          <p className="text-[10px] font-semibold text-amber-700 mt-1.5">詳細：</p>
          <p className="text-gray-700 whitespace-pre-wrap">{parsed.detail}</p>
        </>
      )}
    </div>
  );
};

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
    updateAssignment, confirmStorage, markAsStored,
    getWorkflowStatuses, resolveWorkflowStatus,
    getFeedbacks, addFeedback,
    getWorkTypes,
    getReviewMemos, addReviewMemo,
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
  const [feedbackChecks, setFeedbackChecks] = useState({});
  const [feedbackDetail, setFeedbackDetail] = useState('');
  const [showTaskDetail, setShowTaskDetail] = useState(false);
  // ---- Memo state ----
  const [memoText, setMemoText] = useState('');
  const [memoShared, setMemoShared] = useState(false);
  const [memoType, setMemoType] = useState('review');


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
      // Always keep the task visible if its checklist is currently open (actively reviewing)
      if (openChecklistId && assignment && assignment.id === openChecklistId) return true;
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
  }, [taskAssignmentPairs, subjectFilter, workTypeFilter, deadlineFrom, deadlineTo, assignedFrom, assignedTo, statusFilter, workerFilter, searchText, correctors, openChecklistId]);

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

  // ---- Subject progress (responds to filters, uses workflow statuses) ----
  const subjectProgress = useMemo(() => {
    return SUBJECTS_LIST.filter(s => activeSubjects.includes(s)).map(subject => {
      const pairs = filteredPairs.filter(({ task }) => task.subject === subject);
      const total = pairs.length;
      if (total === 0) return null;
      const pending = pairs.filter(({ wfStatus }) => wfStatus === 'pending').length;
      const inProgress = pairs.filter(({ wfStatus }) => wfStatus === 'in_progress').length;
      const verificationWaiting = pairs.filter(({ wfStatus }) => wfStatus === 'verification_waiting').length;
      const verificationReviewing = pairs.filter(({ wfStatus }) => wfStatus === 'verification_reviewing').length;
      const verificationCompleted = pairs.filter(({ wfStatus }) => wfStatus === 'verification_completed').length;
      const pendingStorage = pairs.filter(({ wfStatus }) => wfStatus === 'pending_storage').length;
      const macroPending = pairs.filter(({ wfStatus }) => wfStatus === 'macro_pending').length;
      const macroCompleted = pairs.filter(({ wfStatus }) => wfStatus === 'macro_completed').length;
      const completedCount = verificationCompleted + macroCompleted;
      const completionRate = Math.round((completedCount / total) * 100);
      const totalHours = pairs.reduce((s, { task }) => s + (task.requiredHours || 0), 0);
      const completedHours = pairs.filter(({ wfStatus }) => wfStatus === 'verification_completed' || wfStatus === 'macro_completed' || wfStatus === 'pending_storage').reduce((s, { task }) => s + (task.requiredHours || 0), 0);
      const hoursRate = totalHours > 0 ? Math.round((completedHours / totalHours) * 100) : 0;
      return { subject, total, pending, inProgress, verificationWaiting, verificationReviewing, verificationCompleted, pendingStorage, macroPending, macroCompleted, completedCount, completionRate, totalHours, completedHours, hoursRate };
    }).filter(Boolean);
  }, [filteredPairs, activeSubjects]);

  // ---- Pie chart data (workflow statuses) ----
  const pieData = useMemo(() => {
    return [
      // フロー順（時計回り）: 未振り分け→作業中→検証待ち→検証中→検証完了→PJ格納待ち→マクロ未作成→作成完了
      { name: '未振り分け', value: filteredPairs.filter(({ wfStatus }) => wfStatus === 'pending').length, color: '#f59e0b' },
      { name: '作業中', value: filteredPairs.filter(({ wfStatus }) => wfStatus === 'in_progress').length, color: '#0ea5e9' },
      { name: '検証待ち', value: filteredPairs.filter(({ wfStatus }) => wfStatus === 'verification_waiting').length, color: '#f97316' },
      { name: '検証中', value: filteredPairs.filter(({ wfStatus }) => wfStatus === 'verification_reviewing').length, color: '#eab308' },
      { name: '検証完了', value: filteredPairs.filter(({ wfStatus }) => wfStatus === 'verification_completed').length, color: '#10b981' },
      { name: 'PJ格納待ち', value: filteredPairs.filter(({ wfStatus }) => wfStatus === 'pending_storage').length, color: '#8b5cf6' },
      { name: 'マクロ未作成', value: filteredPairs.filter(({ wfStatus }) => wfStatus === 'macro_pending').length, color: '#ef4444' },
      { name: '作成完了', value: filteredPairs.filter(({ wfStatus }) => wfStatus === 'macro_completed').length, color: '#22c55e' },
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
                    {sp.completedCount}/{sp.total}件 完了
                    <span className="ml-2 font-medium text-gray-700">({sp.completionRate}%)</span>
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4 flex overflow-hidden">
                  {sp.macroCompleted > 0 && (
                    <div className="h-full transition-all" style={{ width: `${(sp.macroCompleted / sp.total) * 100}%`, backgroundColor: '#22c55e' }} />
                  )}
                  {sp.macroPending > 0 && (
                    <div className="h-full transition-all" style={{ width: `${(sp.macroPending / sp.total) * 100}%`, backgroundColor: '#ef4444' }} />
                  )}
                  {sp.pendingStorage > 0 && (
                    <div className="h-full transition-all" style={{ width: `${(sp.pendingStorage / sp.total) * 100}%`, backgroundColor: '#8b5cf6' }} />
                  )}
                  {sp.verificationCompleted > 0 && (
                    <div className="h-full transition-all" style={{ width: `${(sp.verificationCompleted / sp.total) * 100}%`, backgroundColor: '#10b981' }} />
                  )}
                  {sp.verificationReviewing > 0 && (
                    <div className="h-full transition-all" style={{ width: `${(sp.verificationReviewing / sp.total) * 100}%`, backgroundColor: '#eab308' }} />
                  )}
                  {sp.verificationWaiting > 0 && (
                    <div className="h-full transition-all" style={{ width: `${(sp.verificationWaiting / sp.total) * 100}%`, backgroundColor: '#f97316' }} />
                  )}
                  {sp.inProgress > 0 && (
                    <div className="h-full transition-all" style={{ width: `${(sp.inProgress / sp.total) * 100}%`, backgroundColor: '#0ea5e9' }} />
                  )}
                  {sp.pending > 0 && (
                    <div className="h-full transition-all" style={{ width: `${(sp.pending / sp.total) * 100}%`, backgroundColor: '#f59e0b' }} />
                  )}
                </div>
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                  {sp.macroCompleted > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#22c55e' }}></span>作成完了 {sp.macroCompleted}
                    </span>
                  )}
                  {sp.macroPending > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#ef4444' }}></span>マクロ未作成 {sp.macroPending}
                    </span>
                  )}
                  {sp.pendingStorage > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#8b5cf6' }}></span>PJ格納待ち {sp.pendingStorage}
                    </span>
                  )}
                  {sp.verificationCompleted > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#10b981' }}></span>検証完了 {sp.verificationCompleted}
                    </span>
                  )}
                  {sp.verificationReviewing > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#eab308' }}></span>検証中 {sp.verificationReviewing}
                    </span>
                  )}
                  {sp.verificationWaiting > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#f97316' }}></span>検証待ち {sp.verificationWaiting}
                    </span>
                  )}
                  {sp.inProgress > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#0ea5e9' }}></span>作業中 {sp.inProgress}
                    </span>
                  )}
                  {sp.pending > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#f59e0b' }}></span>未振り分け {sp.pending}
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

                    {/* Storage status badge */}
                    {assignment?.storageStatus === 'pending_storage' && (
                      <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">
                        格納待ち
                      </span>
                    )}
                    {assignment?.storageStatus === 'stored' && (
                      <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-indigo-100 text-indigo-700">
                        格納済み → マクロタスク放出済み
                      </span>
                    )}

                    {/* Rejection count */}
                    {assignment?.rejectionCount > 0 && (
                      <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700">
                        差戻{assignment.rejectionCount}
                      </span>
                    )}

                    {/* Storage action button (inline, no need to expand) */}
                    {assignment?.status === 'approved' && task.workType === '新年度試験種' && assignment?.storageStatus !== 'stored' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm('過去問PJへの格納を確認します。格納済みにするとVIKING用のマクロタスクが大問ごとに自動生成されます。よろしいですか？')) {
                            const result = markAsStored(assignment.id);
                            if (result?.error) {
                              alert(result.error);
                              return;
                            }
                            setMessage('格納確認完了 → マクロタスク（大問別）を自動放出しました');
                            setTimeout(() => setMessage(''), 4000);
                          }
                        }}
                        className="shrink-0 px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-xs font-medium"
                      >
                        格納済みにする
                      </button>
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
                        {assignment?.storageStatus && (
                          <span>格納状態: <strong className={assignment.storageStatus === 'stored' ? 'text-indigo-700' : 'text-amber-600'}>
                            {assignment.storageStatus === 'pending_storage' ? '格納待ち' : '格納済み'}
                          </strong></span>
                        )}
                        {task.macroTask && <span className="text-indigo-600 font-medium">マクロタスク</span>}
                        {task.linkedTaskId && <span>元タスク: <strong>{allTasks.find(t => t.id === task.linkedTaskId)?.name || task.linkedTaskId}</strong></span>}
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

                            {/* 過去問PJへの格納確認 (検証完了後) */}
                            {assignment.status === 'approved' && task.workType === '新年度試験種' && assignment.storageStatus !== 'stored' && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-amber-600 font-medium">過去問PJへの格納確認：</span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">格納待ち</span>
                                <button
                                  onClick={() => {
                                    if (window.confirm('過去問PJへの格納を確認します。格納済みにするとVIKING用のマクロタスクが大問ごとに自動生成されます。よろしいですか？')) {
                                      const result = markAsStored(assignment.id);
                                      if (result?.error) {
                                        alert(result.error);
                                        return;
                                      }
                                      setMessage('格納確認完了 → マクロタスク（大問別）を自動放出しました');
                                      setTimeout(() => setMessage(''), 4000);
                                    }
                                  }}
                                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition text-sm font-medium"
                                >
                                  格納済み
                                </button>
                              </div>
                            )}

                            {/* 格納済み → マクロタスク放出済みバッジ */}
                            {assignment.storageStatus === 'stored' && (
                              <div className="flex flex-col gap-1">
                                <span className="px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-xl text-sm font-medium">
                                  格納済み ✅ {assignment.storedAt && <span className="text-xs text-indigo-500 ml-1">({new Date(assignment.storedAt).toLocaleDateString('ja-JP')})</span>}
                                </span>
                                <span className="text-xs text-indigo-500 ml-1">マクロタスク生成済み</span>
                              </div>
                            )}

                            {/* Reject - 社会・国語は差し戻しの代わりにFBを使うため非表示 */}
                            {task.subject !== '小学社会' && task.subject !== '小学国語' && assignment.status !== 'approved' && (assignment.status === 'submitted' || assignment.verificationStatus === 'reviewing') && (
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

                            {/* 社会・国語用: FB送信ボタン（差し戻しの代わり） */}
                            {(task.subject === '小学社会' || task.subject === '小学国語') && assignment.status !== 'approved' && (assignment.status === 'submitted' || assignment.verificationStatus === 'reviewing') && (
                              <button
                                onClick={() => setFeedbackAssignmentId(feedbackAssignmentId === assignment.id ? null : assignment.id)}
                                className="px-4 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition text-sm font-medium"
                              >
                                💬 FB送信
                              </button>
                            )}
                          </div>

                          {/* Verification checklist panel + file preview */}
                          {openChecklistId === assignment.id && (() => {
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

                          {/* 作業者傾向メモ */}
                          {(() => {
                            const tendencyMemos = getReviewMemos({ userId: assignment.userId, type: 'tendency' });
                            if (tendencyMemos.length === 0) return null;
                            return (
                              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl mb-2">
                                <p className="text-xs font-semibold text-yellow-700 mb-1">📝 この作業者の傾向メモ（{tendencyMemos.length}件）</p>
                                <div className="space-y-1 max-h-32 overflow-y-auto">
                                  {tendencyMemos.map(m => (
                                    <div key={m.id} className="text-xs text-gray-700 bg-white rounded p-1.5">
                                      {m.content}
                                      <span className="text-[10px] text-gray-400 ml-1">{new Date(m.createdAt).toLocaleDateString('ja-JP')}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}

                          {/* メモを追加 */}
                          <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                            <p className="text-xs font-semibold text-gray-600 mb-2">📝 メモを追加</p>
                            <textarea value={memoText} onChange={e => setMemoText(e.target.value)}
                              placeholder="検証メモ、作業者への伝達事項、傾向メモなど..."
                              rows={2} className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 mb-2" />
                            <div className="flex items-center gap-3 mb-2">
                              <select value={memoType} onChange={e => setMemoType(e.target.value)}
                                className="text-xs border border-gray-300 rounded-lg px-2 py-1">
                                <option value="review">検証メモ</option>
                                <option value="tendency">作業者傾向メモ</option>
                              </select>
                              <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                                <input type="checkbox" checked={memoShared} onChange={e => setMemoShared(e.target.checked)}
                                  className="rounded border-gray-300" />
                                作業者に共有する
                              </label>
                            </div>
                            <button onClick={() => {
                              if (!memoText.trim()) return;
                              addReviewMemo({
                                assignmentId: assignment.id,
                                taskId: task.id,
                                userId: assignment.userId,
                                authorId: user?.id,
                                content: memoText.trim(),
                                shared: memoShared,
                                type: memoType,
                              });
                              setMemoText(''); setMemoShared(false); setMemoType('review');
                            }}
                              disabled={!memoText.trim()}
                              className="text-xs bg-gray-600 hover:bg-gray-700 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg transition">
                              メモを保存
                            </button>
                            {/* Show existing memos for this assignment */}
                            {(() => {
                              const memos = getReviewMemos({ assignmentId: assignment.id });
                              if (memos.length === 0) return null;
                              return (
                                <div className="mt-2 space-y-1">
                                  <p className="text-[10px] text-gray-500">この検証のメモ（{memos.length}件）</p>
                                  {memos.map(m => (
                                    <div key={m.id} className={`text-xs p-1.5 rounded ${m.type === 'tendency' ? 'bg-yellow-50' : 'bg-white'} border border-gray-100`}>
                                      <span className="font-medium">{m.content}</span>
                                      {m.shared && <span className="text-[10px] bg-blue-100 text-blue-600 px-1 py-0.5 rounded-full ml-1">共有</span>}
                                      <span className="text-[10px] text-gray-400 ml-1">{new Date(m.createdAt).toLocaleDateString('ja-JP')}</span>
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>

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
                                  const allItems = getVerificationItems(task.subject, 'verification', task.workType) || [];
                                  const failedVerificationItemIds = results
                                    .filter(r => !r.checked)
                                    .map(r => r.verificationItemId);
                                  // Auto-append unchecked item names to reviewNote
                                  const uncheckedNames = failedVerificationItemIds.map(id => {
                                    const item = allItems.find(vi => vi.id === id);
                                    return item?.name || null;
                                  }).filter(Boolean);
                                  let finalNote = reviewNote;
                                  if (uncheckedNames.length > 0) {
                                    const uncheckedText = '未通過項目: ' + uncheckedNames.join(', ');
                                    finalNote = finalNote.trim()
                                      ? finalNote.trim() + '\n' + uncheckedText
                                      : uncheckedText;
                                  }
                                  updateAssignment(assignment.id, {
                                    status: 'rejected',
                                    verificationStatus: null,
                                    reviewNote: finalNote,
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

                          {/* FB（フィードバック）パネル - 社会・国語（submitted, reviewing, approved 全ステータスで表示） */}
                          {(task.subject === '小学社会' || task.subject === '小学国語') && (assignment.status === 'submitted' || assignment.status === 'approved' || assignment.verificationStatus === 'reviewing') && (
                            <div className="mt-2">
                              {feedbackAssignmentId === assignment.id ? (
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                                  <p className="text-xs font-semibold text-amber-700">フィードバックを送信</p>

                                  {/* FB対象作業者 */}
                                  <div>
                                    <p className="text-[10px] text-gray-500 mb-0.5">FB対象作業者</p>
                                    <p className="text-xs font-medium text-gray-800 bg-white border border-gray-200 rounded-lg px-3 py-1.5">{corrector?.name || '不明'}</p>
                                  </div>

                                  {/* 試験種名 */}
                                  <div>
                                    <p className="text-[10px] text-gray-500 mb-0.5">試験種名</p>
                                    <p className="text-xs font-medium text-gray-800 bg-white border border-gray-200 rounded-lg px-3 py-1.5">{task.name || '不明'}</p>
                                  </div>

                                  {/* FB内容チェックリスト（社会のみ） */}
                                  {task.subject === '小学社会' && (
                                  <div>
                                    <p className="text-[10px] text-gray-500 mb-1">FB内容チェックリスト（複数選択可）</p>
                                    <div className="space-y-1 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-lg p-2">
                                      {FB_CATEGORIES.map(cat => (
                                        <label key={cat.id} className="flex items-start gap-2 cursor-pointer hover:bg-gray-50 rounded p-1">
                                          <input
                                            type="checkbox"
                                            checked={!!feedbackChecks[cat.id]}
                                            onChange={e => setFeedbackChecks(prev => ({ ...prev, [cat.id]: e.target.checked }))}
                                            className="mt-0.5 shrink-0 accent-amber-600"
                                          />
                                          <span className="text-xs text-gray-700 leading-relaxed">{cat.label}</span>
                                        </label>
                                      ))}
                                    </div>
                                  </div>
                                  )}

                                  {/* 具体的な内容・指摘箇所 */}
                                  <div>
                                    <p className="text-[10px] text-gray-500 mb-0.5">{task.subject === '小学国語' ? 'FB内容（自由記述）' : '具体的な内容・指摘箇所（自由記述）'}</p>
                                    <textarea
                                      value={feedbackDetail}
                                      onChange={e => setFeedbackDetail(e.target.value)}
                                      placeholder="FBの具体的な内容、指摘箇所などを記載してください。1つの項目に複数該当箇所がある場合などは、特に具体的に記載してください。"
                                      rows={3}
                                      className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2"
                                    />
                                  </div>

                                  <div className="flex gap-2 justify-end">
                                    <button onClick={() => { setFeedbackAssignmentId(null); setFeedbackChecks({}); setFeedbackDetail(''); }}
                                      className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg">キャンセル</button>
                                    <button onClick={() => {
                                      const checkedItems = FB_CATEGORIES.filter(cat => feedbackChecks[cat.id]);
                                      let messageParts = [];
                                      if (task.subject === '小学社会') {
                                        if (checkedItems.length === 0) return;
                                        messageParts.push('【FB内容】');
                                        checkedItems.forEach(cat => messageParts.push('・' + cat.label));
                                        if (feedbackDetail.trim()) {
                                          messageParts.push('');
                                          messageParts.push('【詳細】');
                                          messageParts.push(feedbackDetail.trim());
                                        }
                                      } else {
                                        // 国語: 自由記述のみ
                                        if (!feedbackDetail.trim()) return;
                                        messageParts.push(feedbackDetail.trim());
                                      }
                                      addFeedback({
                                        assignmentId: assignment.id,
                                        taskId: task.id,
                                        fromUserId: user?.id,
                                        toUserId: assignment.userId,
                                        subject: task.subject,
                                        message: messageParts.join('\n'),
                                      });
                                      setFeedbackAssignmentId(null);
                                      setFeedbackChecks({});
                                      setFeedbackDetail('');
                                      setMessage('FBを送信しました');
                                      setTimeout(() => setMessage(''), 3000);
                                    }}
                                      disabled={task.subject === '小学社会' ? FB_CATEGORIES.filter(cat => feedbackChecks[cat.id]).length === 0 : !feedbackDetail.trim()}
                                      className="text-xs bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white px-4 py-1.5 rounded-lg transition">
                                      送信
                                    </button>
                                  </div>
                                </div>
                              ) : null}
                              {/* 送信済みFB一覧 */}
                              {(() => {
                                const fbs = (getFeedbacks({ assignmentId: assignment.id }) || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                                if (fbs.length === 0) return null;
                                return (
                                  <div className="mt-2 space-y-1">
                                    <p className="text-[10px] text-gray-500">送信済みFB（{fbs.length}件）</p>
                                    {fbs.map(fb => (
                                      <div key={fb.id} className="p-2 bg-amber-50 border border-amber-100 rounded-lg text-xs">
                                        <StructuredFbDisplay message={fb.message} />
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

    </div>
  );
};

export default ProgressTab;
