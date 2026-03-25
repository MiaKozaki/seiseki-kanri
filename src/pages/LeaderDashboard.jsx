import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, ComposedChart, ReferenceLine,
} from 'recharts';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useData, isFinished } from '../contexts/DataContext.jsx';
import { autoAssign, manualAssign, previewAutoAssign, confirmAutoAssign } from '../utils/autoAssign.js';
import { toCSV, downloadCSV, importCSVFile, parseCSV, validateUserCSV, validateFieldClearanceCSV, validateTaskCSV, validateExamTaskCSV, validateFieldMasterCSV, validateDaimonTaskCSV, TASK_IMPORT_CSV_COLUMNS, EXAM_TASK_CSV_COLUMNS, FIELD_MASTER_CSV_COLUMNS, DAIMON_TASK_CSV_COLUMNS, USER_CSV_COLUMNS, ASSIGNMENT_CSV_COLUMNS, CAPACITY_CSV_COLUMNS, EVALUATION_CSV_COLUMNS } from '../utils/csvUtils';
import { SUBJECTS_LIST, WORK_TYPES_LIST, generateId } from '../utils/storage.js';
import { predictAllTasks, predictAllSubjects } from '../utils/prediction.js';
import { downloadAttachment, saveAttachment, deleteAttachment, saveTaskAttachment, getTaskAttachments, deleteTaskAttachments, validateTaskFile } from '../utils/fileStorage.js';
import { downloadHistoryExcel } from '../utils/excelExport.js';
import { parseAndGroupFiles, downloadMergedExcel } from '../utils/excelMerge.js';
import { calcAllMetrics, normalizeMetricToScore, formatDuration } from '../utils/evaluationMetrics';
import AssignmentTab from '../components/leader/AssignmentTab.jsx';
import NewProgressTab from '../components/leader/ProgressTab.jsx';

const TABS = [
  { label: '概要', icon: '📊' },
  { label: '試験種管理', icon: '📋' },
  { label: '振り分け', icon: '🔀' },
  { label: '作業者管理', icon: '👥' },
  { label: '工数分析', icon: '📈' },
  { label: '進捗管理', icon: '📉' },
  { label: '業務募集', icon: '📢' },
  { label: '作業者評価', icon: '⭐' },
  { label: 'ファイル統合', icon: '📎' },
  { label: 'マスタ', icon: '⚙️' },
  { label: '使い方', icon: '📖' },
];

const STATUS_COLORS = { pending: '#f59e0b', assigned: '#3b82f6', in_progress: '#0ea5e9', submitted: '#8b5cf6', completed: '#10b981' };
const BAR_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444'];

// ---- Helper ----
const useHelpers = () => {
  const { getExamTypes, getSchools } = useData();
  const examTypes = getExamTypes();
  const schools = getSchools();
  const examTypeName = (id) => {
    const et = examTypes.find(e => e.id === id);
    if (!et) return '不明';
    const s = schools.find(s => s.id === et.schoolId);
    return `${s?.name ?? '不明'} / ${et.subject}`;
  };
  return { examTypes, schools, examTypeName };
};

// ---- Overview Tab ----
const PREDICTION_BADGE = {
  on_track: { text: '順調', cls: 'bg-green-100 text-green-700' },
  at_risk: { text: '注意', cls: 'bg-amber-100 text-amber-700' },
  overdue: { text: '遅延リスク', cls: 'bg-red-100 text-red-700' },
  insufficient: { text: '工数不足', cls: 'bg-gray-100 text-gray-600' },
  submitted: { text: '検証待ち', cls: 'bg-purple-100 text-purple-700' },
  completed: { text: '完了', cls: 'bg-green-100 text-green-700' },
  unassigned: { text: '未割当', cls: 'bg-amber-100 text-amber-700' },
};

const OverviewTab = ({ activeSubjects }) => {
  const { getTasks, getCorrectors, getAssignments, getCapacities, getUsers } = useData();
  const allTasks = getTasks();
  const tasks = allTasks.filter(t => activeSubjects.includes(t.subject));
  const correctors = getCorrectors();
  const assignments = getAssignments();
  const capacities = getCapacities();

  const totalCap = capacities.reduce((s, c) => s + c.totalHours, 0);
  const totalAssigned = assignments.filter(a => !isFinished(a.status)).reduce((s, a) => s + a.assignedHours, 0);
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const pendingTasks = tasks.filter(t => t.status === 'pending').length;
  const submittedTasks = tasks.filter(t => t.status === 'submitted').length;

  // 予測計算
  const predictions = predictAllTasks(assignments, capacities, tasks);
  const atRiskCount = predictions.filter(p => p.status === 'overdue' || p.status === 'at_risk' || p.status === 'insufficient').length;

  const stats = [
    { label: '添削者数', value: correctors.length, unit: '人', color: 'bg-purple-50 text-purple-700 border-purple-100' },
    { label: 'タスク総数', value: tasks.length, unit: '件', color: 'bg-blue-50 text-blue-700 border-blue-100' },
    { label: '未割当タスク', value: pendingTasks, unit: '件', color: 'bg-amber-50 text-amber-700 border-amber-100' },
    { label: '遅延リスク', value: atRiskCount, unit: '件', color: atRiskCount > 0 ? 'bg-red-50 text-red-700 border-red-100' : 'bg-green-50 text-green-700 border-green-100' },
    { label: '検証待ち', value: submittedTasks, unit: '件', color: 'bg-violet-50 text-violet-700 border-violet-100' },
    { label: '完了タスク', value: completedTasks, unit: '件', color: 'bg-green-50 text-green-700 border-green-100' },
    { label: '登録工数合計', value: totalCap, unit: 'h', color: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
    { label: '割当工数合計', value: totalAssigned, unit: 'h', color: 'bg-orange-50 text-orange-700 border-orange-100' },
  ];

  // 科目別予測データ（業務完了予測セクション用）
  const subjectPredictions = predictAllSubjects(assignments, capacities, allTasks, getUsers());
  const filteredSubjectPredictions = subjectPredictions.filter(p => activeSubjects.includes(p.subject));

  const SUBJ_STATUS = {
    on_track: { text: '順調', cls: 'bg-green-100 text-green-700', barColor: 'bg-green-500' },
    at_risk: { text: '注意', cls: 'bg-yellow-100 text-yellow-700', barColor: 'bg-yellow-500' },
    overdue: { text: '遅延', cls: 'bg-red-100 text-red-700', barColor: 'bg-red-500' },
    insufficient: { text: '工数不足', cls: 'bg-gray-100 text-gray-600', barColor: 'bg-gray-400' },
    completed: { text: '完了', cls: 'bg-green-100 text-green-700', barColor: 'bg-green-500' },
  };

  // 日付を「3月10日(火)」形式にフォーマット
  const formatJpDate = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr + 'T00:00:00');
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const dow = dayNames[d.getDay()];
    return `${month}月${day}日(${dow})`;
  };

  // 「あと X 日」を計算
  const daysUntil = (dateStr) => {
    if (!dateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr + 'T00:00:00');
    return Math.ceil((target - today) / 86400000);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(s => (
          <div key={s.label} className={`rounded-xl p-4 border ${s.color}`}>
            <p className="text-xs font-medium opacity-70">{s.label}</p>
            <p className="text-2xl font-bold mt-1">{s.value}<span className="text-base font-normal ml-1">{s.unit}</span></p>
          </div>
        ))}
      </div>

      {/* 業務完了予測（科目別）— HERO section */}
      {filteredSubjectPredictions.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-base font-bold text-gray-800 mb-5 flex items-center gap-2">
            <span>📅</span> 業務完了予測
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredSubjectPredictions.map(p => {
              const st = SUBJ_STATUS[p.status] || SUBJ_STATUS.insufficient;
              const jpDate = formatJpDate(p.predictedDate);
              const remaining = daysUntil(p.predictedDate);
              const capacityRatio = p.totalRemainingHours > 0 && p.totalAvailableHours > 0
                ? Math.round((p.totalAvailableHours / p.totalRemainingHours) * 100)
                : p.status === 'completed' ? 100 : 0;

              return (
                <div key={p.subject} className="p-5 border border-gray-200 rounded-xl hover:shadow-md transition-shadow">
                  {/* Header: subject name + status badge */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-base font-bold text-gray-800">{p.subject}</span>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${st.cls}`}>{st.text}</span>
                  </div>

                  {/* HERO: predicted completion date */}
                  {p.predictedDate && (
                    <div className="mb-3">
                      <p className="text-2xl font-bold text-blue-600 leading-tight">{jpDate}</p>
                      {remaining !== null && (
                        <p className="text-sm font-medium mt-1" style={{ color: remaining <= 0 ? '#10b981' : remaining <= 3 ? '#f59e0b' : '#6b7280' }}>
                          {remaining <= 0 ? '本日完了見込み' : `あと ${remaining} 日`}
                        </p>
                      )}
                      {p.latestDeadline && (
                        <p className="text-xs text-gray-400 mt-0.5">期限: {formatJpDate(p.latestDeadline)}</p>
                      )}
                    </div>
                  )}
                  {!p.predictedDate && p.status === 'completed' && (
                    <div className="mb-3">
                      <p className="text-2xl font-bold text-green-600">完了済み</p>
                    </div>
                  )}
                  {!p.predictedDate && p.status === 'insufficient' && (
                    <div className="mb-3">
                      <p className="text-lg font-bold text-red-500">完了見込みなし</p>
                      <p className="text-xs text-red-400 mt-0.5">利用可能な工数が不足しています</p>
                    </div>
                  )}

                  {/* Progress bar: available hours vs remaining hours */}
                  {p.status !== 'completed' && p.totalRemainingHours > 0 && (
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>工数充足率 {capacityRatio}%</span>
                        <span>{p.totalAvailableHours}h / {p.totalRemainingHours}h</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${st.barColor}`}
                          style={{ width: `${Math.min(100, capacityRatio)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Meta info */}
                  <div className="text-xs text-gray-500 pt-2 border-t border-gray-100">
                    <p>{p.totalSchools}校 · {p.totalTasks}タスク · 担当者{p.assignedCorrectors}人</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
};

// ---- 進捗管理タブ（新ProgressTabに移行済み・未使用） ----
const _OldProgressTab = ({ activeSubjects }) => {
  const { getTasks, getCorrectors, getAssignments, getCapacities } = useData();
  const tasks = getTasks().filter(t => activeSubjects.includes(t.subject));
  const correctors = getCorrectors();
  const assignments = getAssignments();
  const capacities = getCapacities();

  const [showTaskDetail, setShowTaskDetail] = useState(false);

  const pieData = [
    { name: '未割当', value: tasks.filter(t => t.status === 'pending').length, color: '#f59e0b' },
    { name: '割当済', value: tasks.filter(t => t.status === 'assigned').length, color: '#3b82f6' },
    { name: '作業中', value: tasks.filter(t => t.status === 'in_progress').length, color: '#0ea5e9' },
    { name: '提出済', value: tasks.filter(t => t.status === 'submitted').length, color: '#8b5cf6' },
    { name: '完了', value: tasks.filter(t => isFinished(t.status)).length, color: '#10b981' },
  ].filter(d => d.value > 0);

  const predictions = predictAllTasks(assignments, capacities, tasks);

  const subjectProgress = useMemo(() => {
    return SUBJECTS_LIST.filter(s => activeSubjects.includes(s)).map(subject => {
      const st = tasks.filter(t => t.subject === subject);
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
  }, [tasks, activeSubjects]);

  return (
    <div className="space-y-4">
      {/* 科目別 業務進捗 */}
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

      {/* タスクステータス分布 */}
      {tasks.length > 0 && (
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

      {/* タスク進捗予測テーブル（折りたたみ式） */}
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
    </div>
  );
};

// ---- daily capacity helpers ----
const buildDailyData = (capacities, tasks) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const capDates = capacities.flatMap(c => [
    new Date(c.startDate + 'T00:00:00'),
    new Date(c.endDate + 'T00:00:00'),
  ]);
  const taskDates = tasks
    .filter(t => !isFinished(t.status) && t.deadline)
    .map(t => new Date(t.deadline + 'T00:00:00'));

  const allDates = [...capDates, ...taskDates, today];
  if (allDates.length === 0) return [];

  const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));

  // Build day-by-day array
  const rows = [];
  const cur = new Date(minDate);
  while (cur <= maxDate) {
    const dateStr = cur.toISOString().split('T')[0];
    const mm = cur.getMonth() + 1;
    const dd = cur.getDate();
    const available = capacities
      .filter(c => c.startDate <= dateStr && c.endDate >= dateStr)
      .reduce((s, c) => s + c.hoursPerDay, 0);
    rows.push({ date: dateStr, label: `${mm}/${dd}`, available, workload: 0 });
    cur.setDate(cur.getDate() + 1);
  }

  // Distribute each task's workload evenly from today → deadline
  tasks.filter(t => !isFinished(t.status)).forEach(task => {
    const deadlineStr = task.deadline;
    const todayStr = today.toISOString().split('T')[0];
    const span = rows.filter(r => r.date >= todayStr && r.date <= deadlineStr);
    if (span.length === 0) {
      // Already past deadline – pile onto first row
      if (rows.length > 0) rows[0].workload += task.requiredHours;
    } else {
      const perDay = task.requiredHours / span.length;
      span.forEach(r => { r.workload += perDay; });
    }
  });

  return rows.map(r => ({
    label: r.label,
    date: r.date,
    利用可能工数: r.available,
    必要作業工数: Math.round(r.workload * 10) / 10,
    余剰: Math.round((r.available - r.workload) * 10) / 10,
    充足: r.available >= r.workload,
  }));
};

const CustomDailyTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const available = payload.find(p => p.dataKey === '利用可能工数')?.value ?? 0;
  const workload = payload.find(p => p.dataKey === '必要作業工数')?.value ?? 0;
  const balance = Math.round((available - workload) * 10) / 10;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      <p className="text-blue-600">利用可能工数: {available}h</p>
      <p className="text-orange-500">必要作業工数: {workload}h</p>
      <p className={`font-semibold mt-1 ${balance >= 0 ? 'text-green-600' : 'text-red-500'}`}>
        {balance >= 0 ? `余剰 +${balance}h` : `不足 ${balance}h`}
      </p>
    </div>
  );
};

// ---- Capacity Analysis Tab ----
const CapacityAnalysisTab = ({ activeSubjects }) => {
  const { getCorrectors, getCapacities, getAssignments, getTasks, getUsers } = useData();
  const allCorrectors = getCorrectors();
  const correctors = allCorrectors.filter(c => (c.subjects ?? []).some(s => activeSubjects.includes(s)));
  const capacities = getCapacities();
  const assignments = getAssignments();
  const allTasks = getTasks();
  const tasks = allTasks.filter(t => activeSubjects.includes(t.subject));

  // 科目別サマリーデータ
  const subjectSummary = SUBJECTS_LIST.filter(s => activeSubjects.includes(s)).map(subject => {
    const capable = correctors.filter(c => (c.subjects ?? []).includes(subject));
    const totalCap = capable.reduce((s, c) =>
      s + capacities.filter(cap => cap.userId === c.id).reduce((a, cap) => a + cap.totalHours, 0), 0);
    const assignedH = capable.reduce((s, c) =>
      s + assignments.filter(a => a.userId === c.id && !isFinished(a.status)).reduce((a, asn) => a + asn.assignedHours, 0), 0);
    const requiredH = tasks.filter(t => t.subject === subject && !isFinished(t.status)).reduce((s, t) => s + t.requiredHours, 0);
    return { subject, capable: capable.length, totalCap, assignedH, freeH: Math.max(0, totalCap - assignedH), requiredH };
  });

  const dailyData = buildDailyData(capacities, tasks);
  const insufficientDays = dailyData.filter(d => !d.充足 && d.必要作業工数 > 0).length;

  const correctorData = correctors.map(c => {
    const available = capacities.filter(cap => cap.userId === c.id).reduce((s, cap) => s + cap.totalHours, 0);
    const assigned = assignments.filter(a => a.userId === c.id && !isFinished(a.status)).reduce((s, a) => s + a.assignedHours, 0);
    return {
      name: c.name.replace(' ', '\n'),
      登録工数: available,
      割当工数: assigned,
      空き工数: Math.max(0, available - assigned),
    };
  });

  const [historyRange, setHistoryRange] = useState({ startDate: '', endDate: '' });
  const [showHistory, setShowHistory] = useState(false);

  const allCapacities = getCapacities();
  const allUsers = getUsers ? getUsers() : [];

  const filteredCapacities = allCapacities.filter(c => {
    if (historyRange.startDate && c.endDate < historyRange.startDate) return false;
    if (historyRange.endDate && c.startDate > historyRange.endDate) return false;
    return true;
  });

  const capacityHistoryData = filteredCapacities.map(c => {
    const user = allUsers.find(u => u.id === c.userId);
    return {
      userName: user?.name ?? '不明',
      userLoginId: user?.loginId ?? '',
      startDate: c.startDate,
      endDate: c.endDate,
      hoursPerDay: c.hoursPerDay,
      totalHours: c.totalHours,
      note: c.note ?? '',
    };
  });

  const allAssignments = getAssignments ? getAssignments() : [];
  const assignmentHistoryData = allAssignments.map(a => {
    const task = tasks.find(t => t.id === a.taskId);
    const user = allUsers.find(u => u.id === a.userId);
    return {
      taskName: task?.name || '',
      subject: task?.subject || '',
      workType: task?.workType || '',
      correctorName: user?.name || '',
      correctorLoginId: user?.loginId || '',
      assignedHours: a.assignedHours || '',
      actualHours: a.actualHours || '',
      status: a.status,
      assignedAt: a.assignedAt ? a.assignedAt.slice(0, 10) : '',
      submittedAt: a.submittedAt ? a.submittedAt.slice(0, 10) : '',
    };
  });

  const handleExportHistoryCSV = () => {
    const csv = toCSV(capacityHistoryData, CAPACITY_CSV_COLUMNS);
    const range = historyRange.startDate || historyRange.endDate
      ? `${historyRange.startDate || '開始'}〜${historyRange.endDate || '現在'}`
      : '全期間';
    downloadCSV(csv, `工数履歴_${range}.csv`);
  };

  const handleExportHistoryExcel = () => {
    const range = historyRange.startDate || historyRange.endDate
      ? `${historyRange.startDate || '開始'}〜${historyRange.endDate || '現在'}`
      : '全期間';
    downloadHistoryExcel(capacityHistoryData, assignmentHistoryData, range);
  };

  return (
    <div className="space-y-4">

      {/* ===== 日別工数充足グラフ ===== */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-start justify-between mb-1">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">日別 工数充足状況</h3>
            <p className="text-xs text-gray-400 mt-0.5">利用可能工数 vs 必要作業工数（タスクを期限まで均等配分）</p>
          </div>
          {insufficientDays > 0 && (
            <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-medium shrink-0">
              工数不足: {insufficientDays}日
            </span>
          )}
        </div>

        {dailyData.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">工数またはタスクデータがありません</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} unit="h" width={36} />
                <Tooltip content={<CustomDailyTooltip />} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine y={0} stroke="#e5e7eb" />
                <Bar
                  dataKey="利用可能工数"
                  fill="#93c5fd"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={28}
                >
                  {dailyData.map((entry, i) => (
                    <Cell key={i} fill={entry.充足 ? '#93c5fd' : '#fca5a5'} />
                  ))}
                </Bar>
                <Bar
                  dataKey="必要作業工数"
                  fill="#fb923c"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={28}
                  fillOpacity={0.85}
                />
                <Line
                  dataKey="余剰"
                  name="余剰/不足工数"
                  type="monotone"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="4 2"
                />
              </ComposedChart>
            </ResponsiveContainer>

            {/* 凡例補足 */}
            <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-blue-300 inline-block"></span>充足日（利用可能工数）
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-red-300 inline-block"></span>工数不足日
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-orange-400 inline-block"></span>必要作業工数
              </span>
              <span className="flex items-center gap-1">
                <span className="w-5 h-0.5 bg-indigo-500 inline-block" style={{borderTop:'2px dashed #6366f1'}}></span>余剰/不足ライン
              </span>
            </div>

            {/* 日別サマリーテーブル（工数不足日のみ） */}
            {insufficientDays > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium text-red-600 mb-1">⚠ 工数不足の日</p>
                <div className="flex flex-wrap gap-2">
                  {dailyData.filter(d => !d.充足 && d.必要作業工数 > 0).map(d => (
                    <div key={d.date} className="text-xs bg-red-50 border border-red-100 rounded-lg px-2 py-1">
                      <span className="font-medium text-red-700">{d.label}</span>
                      <span className="text-red-400 ml-1">
                        ({d.利用可能工数}h 可 / {d.必要作業工数}h 必要)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ===== 添削者別グラフ ===== */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">添削者別 工数状況</h3>
        <p className="text-xs text-gray-400 mb-4">登録工数・割当工数・空き工数の比較</p>
        {correctorData.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">データがありません</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={correctorData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="h" width={36} />
              <Tooltip formatter={(v) => `${v}時間`} />
              <Legend />
              <Bar dataKey="登録工数" fill="#93c5fd" radius={[4, 4, 0, 0]} />
              <Bar dataKey="割当工数" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="空き工数" fill="#bbf7d0" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ===== 添削者別詳細 ===== */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">添削者別 工数詳細</h3>
        <div className="space-y-3">
          {correctors.map(c => {
            const data = correctorData.find(d => d.name === c.name.replace(' ', '\n'));
            if (!data) return null;
            const pct = data.登録工数 > 0 ? Math.min(100, Math.round((data.割当工数 / data.登録工数) * 100)) : 0;
            return (
              <div key={c.id} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-1.5">
                  <div>
                    <span className="text-sm font-medium text-gray-800">{c.name}</span>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {(c.subjects ?? []).length === 0
                        ? <span className="text-xs text-gray-300">科目未設定</span>
                        : (c.subjects ?? []).map(s => (
                          <span key={s} className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">{s}</span>
                        ))}
                    </div>
                  </div>
                  <span className="text-xs text-gray-500">{data.割当工数}h / {data.登録工数}h</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-blue-500'}`}
                    style={{ width: `${pct}%` }}
                  ></div>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-gray-400">稼働率: {pct}%</span>
                  <span className="text-xs text-green-600 font-medium">空き: {data.空き工数}h</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== 科目別 工数サマリー ===== */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">科目別 工数サマリー</h3>
        <p className="text-xs text-gray-400 mb-4">担当可能な添削者の工数 vs 必要作業工数</p>
        <div className="space-y-3">
          {subjectSummary.map(row => {
            const pct = row.totalCap > 0 ? Math.min(100, Math.round((row.requiredH / row.totalCap) * 100)) : 0;
            const shortage = row.totalCap < row.requiredH;
            return (
              <div key={row.subject} className={`p-4 rounded-xl border ${shortage ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-gray-50'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800">{row.subject}</span>
                    <span className="text-xs text-gray-400">担当者: {row.capable}人</span>
                    {shortage && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">工数不足</span>}
                  </div>
                  <span className="text-xs text-gray-500">
                    必要 <strong className={shortage ? 'text-red-600' : 'text-gray-700'}>{row.requiredH}h</strong>
                    {' / '}空き <strong className="text-green-600">{row.freeH}h</strong>
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${shortage ? 'bg-red-400' : pct >= 70 ? 'bg-amber-400' : 'bg-green-400'}`}
                    style={{ width: `${pct}%` }}
                  ></div>
                </div>
                <div className="flex justify-between mt-1 text-xs text-gray-400">
                  <span>登録工数合計: {row.totalCap}h</span>
                  <span>割当済: {row.assignedH}h</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

        {/* 工数履歴セクション */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700">📅 工数履歴</h4>
            <button onClick={() => setShowHistory(!showHistory)}
              className="text-xs text-blue-500 hover:text-blue-700">
              {showHistory ? '▲ 閉じる' : '▼ 詳細を表示'}
            </button>
          </div>

          {showHistory && (
            <>
              <div className="flex flex-wrap items-end gap-3 mb-4">
                <div>
                  <label className="text-xs text-gray-500">開始日</label>
                  <input type="date" value={historyRange.startDate}
                    onChange={e => setHistoryRange(p => ({ ...p, startDate: e.target.value }))}
                    className="block mt-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">終了日</label>
                  <input type="date" value={historyRange.endDate}
                    onChange={e => setHistoryRange(p => ({ ...p, endDate: e.target.value }))}
                    className="block mt-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
                </div>
                <button onClick={() => setHistoryRange({ startDate: '', endDate: '' })}
                  className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg">
                  リセット
                </button>
                <div className="ml-auto flex gap-2">
                  <button onClick={handleExportHistoryCSV}
                    className="text-xs bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg transition">
                    📤 CSV出力
                  </button>
                  <button onClick={handleExportHistoryExcel}
                    className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg transition">
                    📤 Excel出力
                  </button>
                </div>
              </div>

              {/* 工数登録一覧 */}
              <h5 className="text-xs font-semibold text-gray-600 mb-2">工数登録一覧（{capacityHistoryData.length}件）</h5>
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-2 text-gray-500 font-medium">作業者</th>
                      <th className="text-left py-2 px-2 text-gray-500 font-medium">ID</th>
                      <th className="text-left py-2 px-2 text-gray-500 font-medium">期間</th>
                      <th className="text-right py-2 px-2 text-gray-500 font-medium">日/h</th>
                      <th className="text-right py-2 px-2 text-gray-500 font-medium">合計h</th>
                      <th className="text-left py-2 px-2 text-gray-500 font-medium">備考</th>
                    </tr>
                  </thead>
                  <tbody>
                    {capacityHistoryData.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-4 text-gray-400">データがありません</td></tr>
                    ) : capacityHistoryData.map((c, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 px-2">{c.userName}</td>
                        <td className="py-2 px-2 font-mono text-blue-600">{c.userLoginId}</td>
                        <td className="py-2 px-2">{c.startDate} 〜 {c.endDate}</td>
                        <td className="py-2 px-2 text-right">{c.hoursPerDay}</td>
                        <td className="py-2 px-2 text-right font-medium">{c.totalHours}</td>
                        <td className="py-2 px-2 text-gray-500">{c.note}</td>
                      </tr>
                    ))}
                  </tbody>
                  {capacityHistoryData.length > 0 && (
                    <tfoot>
                      <tr className="border-t border-gray-200 font-medium">
                        <td colSpan={4} className="py-2 px-2 text-right text-gray-600">合計:</td>
                        <td className="py-2 px-2 text-right text-blue-700">
                          {capacityHistoryData.reduce((s, c) => s + (Number(c.totalHours) || 0), 0)}h
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* 作業実績一覧 */}
              <h5 className="text-xs font-semibold text-gray-600 mb-2">作業実績一覧（{assignmentHistoryData.length}件）</h5>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-2 text-gray-500 font-medium">タスク</th>
                      <th className="text-left py-2 px-2 text-gray-500 font-medium">科目</th>
                      <th className="text-left py-2 px-2 text-gray-500 font-medium">担当者</th>
                      <th className="text-right py-2 px-2 text-gray-500 font-medium">予定h</th>
                      <th className="text-right py-2 px-2 text-gray-500 font-medium">実績h</th>
                      <th className="text-left py-2 px-2 text-gray-500 font-medium">ステータス</th>
                      <th className="text-left py-2 px-2 text-gray-500 font-medium">提出日</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignmentHistoryData.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-4 text-gray-400">データがありません</td></tr>
                    ) : assignmentHistoryData.map((a, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 px-2">{a.taskName}</td>
                        <td className="py-2 px-2">{a.subject}</td>
                        <td className="py-2 px-2">{a.correctorName}</td>
                        <td className="py-2 px-2 text-right">{a.assignedHours}</td>
                        <td className="py-2 px-2 text-right font-medium">{a.actualHours || '-'}</td>
                        <td className="py-2 px-2">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                            a.status === 'completed' || a.status === 'approved' ? 'bg-green-100 text-green-700' :
                            a.status === 'submitted' ? 'bg-blue-100 text-blue-700' :
                            a.status === 'in_progress' ? 'bg-sky-100 text-sky-700' :
                            a.status === 'rejected' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {a.status === 'assigned' ? '割当済' : a.status === 'in_progress' ? '作業中' :
                             a.status === 'submitted' ? '提出済' :
                             a.status === 'approved' || a.status === 'completed' ? '完了' :
                             a.status === 'rejected' ? '差し戻し' : a.status}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-gray-500">{a.submittedAt || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

      {/* ===== 月間工数履歴 ===== */}
      <MacroIncentiveSection tasks={allTasks} assignments={assignments} users={allUsers} />
    </div>
  );
};

// ---- 月間工数履歴セクション ----
const MacroIncentiveSection = ({ tasks, assignments, users }) => {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [filterSubject, setFilterSubject] = useState('');
  const [filterWorkType, setFilterWorkType] = useState('');
  const [filterUserId, setFilterUserId] = useState('');

  const correctors = useMemo(() => users.filter(u => u.role === 'corrector'), [users]);

  const monthOptions = useMemo(() => {
    const months = [];
    for (let i = -6; i <= 1; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return months;
  }, []);

  const incentiveData = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const startOfMonth = new Date(year, month - 1, 1).toISOString();
    const endOfMonth = new Date(year, month, 0, 23, 59, 59).toISOString();

    // Build a task lookup map with subject/workType filters applied
    const taskMap = {};
    tasks.forEach(t => {
      if (filterSubject && t.subject !== filterSubject) return;
      if (filterWorkType && t.workType !== filterWorkType) return;
      taskMap[t.id] = t;
    });

    // All completed assignments within the selected month matching task filters
    const completedAssignments = assignments.filter(a => {
      if (!taskMap[a.taskId]) return false;
      if (!isFinished(a.status)) return false;
      if (filterUserId && a.userId !== filterUserId) return false;
      const dateField = a.reviewedAt || a.submittedAt || a.storedAt;
      if (!dateField) return false;
      return dateField >= startOfMonth && dateField <= endOfMonth;
    });

    // Aggregate per user
    const userMap = {};
    completedAssignments.forEach(a => {
      if (!userMap[a.userId]) {
        const u = users.find(u => u.id === a.userId);
        userMap[a.userId] = { name: u?.name || '不明', loginId: u?.loginId || '', taskCount: 0, totalHours: 0 };
      }
      userMap[a.userId].taskCount += 1;
      userMap[a.userId].totalHours += (a.actualHours || a.assignedHours || 0);
    });

    return Object.values(userMap).sort((a, b) => b.totalHours - a.totalHours);
  }, [selectedMonth, tasks, assignments, users, filterSubject, filterWorkType, filterUserId]);

  const totalTasks = incentiveData.reduce((s, d) => s + d.taskCount, 0);
  const totalHours = incentiveData.reduce((s, d) => s + d.totalHours, 0);

  const selectClass = "text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none";

  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">月間工数履歴</h3>
          <p className="text-xs text-gray-400 mt-0.5">完了タスクの月別実績集計</p>
        </div>
        <select
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          className={selectClass}
        >
          {monthOptions.map(m => (
            <option key={m} value={m}>{m.replace('-', '年')}月</option>
          ))}
        </select>
      </div>

      {/* Filter dropdowns */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)} className={selectClass}>
          <option value="">全科目</option>
          {SUBJECTS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterWorkType} onChange={e => setFilterWorkType(e.target.value)} className={selectClass}>
          <option value="">全作業内容</option>
          {WORK_TYPES_LIST.map(w => <option key={w} value={w}>{w}</option>)}
        </select>
        <select value={filterUserId} onChange={e => setFilterUserId(e.target.value)} className={selectClass}>
          <option value="">全作業者</option>
          {correctors.map(c => <option key={c.id} value={c.id}>{c.name}（{c.loginId}）</option>)}
        </select>
      </div>

      {incentiveData.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-8">選択条件に一致する完了実績はありません</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-2 text-gray-500 font-medium">作業者名</th>
                <th className="text-left py-2 px-2 text-gray-500 font-medium">ログインID</th>
                <th className="text-right py-2 px-2 text-gray-500 font-medium">完了タスク数</th>
                <th className="text-right py-2 px-2 text-gray-500 font-medium">合計工数(h)</th>
              </tr>
            </thead>
            <tbody>
              {incentiveData.map((row, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 px-2 font-medium text-gray-800">{row.name}</td>
                  <td className="py-2 px-2 font-mono text-blue-600">{row.loginId}</td>
                  <td className="py-2 px-2 text-right">{row.taskCount}</td>
                  <td className="py-2 px-2 text-right font-medium">{row.totalHours}h</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 font-medium">
                <td colSpan={2} className="py-2 px-2 text-right text-gray-600">合計:</td>
                <td className="py-2 px-2 text-right text-indigo-700">{totalTasks}件</td>
                <td className="py-2 px-2 text-right text-indigo-700">{totalHours}h</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};

// ---- Task & Assignment Tab (試験種管理) ----
const TaskAndAssignmentTab = ({ activeSubjects }) => {
  const {
    getTasks, addTask, updateTask, deleteTask,
    getAssignments, deleteAssignment, updateAssignment,
    getCorrectors, getCapacities, forceRefresh,
    getExamInputs, getTimeLogs, getTaskTotalTime, getDaimonTotalTime, getUsers,
    getAllData, applyAutoAssignResult, getFields, getWorkTypes, getSchools,
    addSchool, getExamTypes, addExamType,
  } = useData();
  const { user } = useAuth();
  const workTypesList = getWorkTypes().map(wt => wt.name);

  const allTasks = getTasks();
  const tasks = allTasks.filter(t => activeSubjects.includes(t.subject));
  const assignments = getAssignments();
  const correctors = getCorrectors();
  const capacities = getCapacities();

  // Sub-tab navigation (null = menu, string = active section)
  const [activeSection, setActiveSection] = useState(null);

  // Task form state
  const [form, setForm] = useState({ name: '', subject: '', workType: '', requiredHours: '', deadline: '', sheetsUrl: '', viking: false, splitByDaimon: false, daimons: [] });
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const [taskFiles, setTaskFiles] = useState([]);
  const [taskFileError, setTaskFileError] = useState('');

  // Task list state
  const [sortKey, setSortKey] = useState('deadline');
  const [sortAsc, setSortAsc] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [workTypeFilter, setWorkTypeFilter] = useState('all');
  const [deadlineFrom, setDeadlineFrom] = useState('');
  const [deadlineTo, setDeadlineTo] = useState('');
  const [workerFilter, setWorkerFilter] = useState('all');
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);

  // Assignment filter state
  const [assignSubjectFilter, setAssignSubjectFilter] = useState('all');
  const [assignWorkTypeFilter, setAssignWorkTypeFilter] = useState('all');
  const [assignDeadlineFrom, setAssignDeadlineFrom] = useState('');
  const [assignDeadlineTo, setAssignDeadlineTo] = useState('');
  const [showAssignSearch, setShowAssignSearch] = useState(false);

  // Bulk CSV import state
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkCsvText, setBulkCsvText] = useState('');
  const [bulkParsed, setBulkParsed] = useState(null); // { valid: [], errors: [] }
  const [bulkImportDone, setBulkImportDone] = useState(null); // success count message

  // Daimon CSV import state
  const [showDaimonCsv, setShowDaimonCsv] = useState(false);
  const [daimonCsvText, setDaimonCsvText] = useState('');
  const [daimonCsvParsed, setDaimonCsvParsed] = useState(null);
  const [daimonCsvImportDone, setDaimonCsvImportDone] = useState(null);

  // Assignment state
  const [message, setMessage] = useState('');
  const [manualSelect, setManualSelect] = useState({});
  const [previewData, setPreviewData] = useState(null);
  const [editedProposals, setEditedProposals] = useState([]);

  // --- Task helpers ---
  const handleSort = (key) => {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(true); }
  };

  const filteredTasks = tasks.filter(t => {
    if (searchText && !t.name.toLowerCase().includes(searchText.toLowerCase())) return false;
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (subjectFilter !== 'all' && t.subject !== subjectFilter) return false;
    if (workTypeFilter !== 'all' && t.workType !== workTypeFilter) return false;
    if (deadlineFrom && t.deadline < deadlineFrom) return false;
    if (deadlineTo && t.deadline > deadlineTo) return false;
    if (workerFilter !== 'all') {
      const a = assignments.find(x => x.taskId === t.id);
      if (!a || a.userId !== workerFilter) return false;
    }
    return true;
  });

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    let va = a[sortKey] ?? '';
    let vb = b[sortKey] ?? '';
    if (sortKey === 'requiredHours') { va = Number(va); vb = Number(vb); }
    const cmp = va < vb ? -1 : va > vb ? 1 : 0;
    return sortAsc ? cmp : -cmp;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.subject) { setError('科目を選択してください'); return; }
    if (!form.workType) { setError('作業内容を選択してください'); return; }

    // Helper to save task files and return attachment metadata
    const saveFilesForTask = async (taskId) => {
      if (taskFiles.length === 0) return [];
      const saved = [];
      for (const file of taskFiles) {
        try {
          const meta = await saveTaskAttachment({
            taskId,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            blob: file,
          });
          saved.push(meta);
        } catch (err) {
          console.error('Failed to save task attachment:', err);
        }
      }
      return saved;
    };

    if (editId) {
      updateTask(editId, { ...form, requiredHours: Number(form.requiredHours) });
      if (taskFiles.length > 0) {
        const attachments = await saveFilesForTask(editId);
        // Merge with existing attachments
        const existing = getTasks().find(t => t.id === editId)?.taskAttachments || [];
        updateTask(editId, { taskAttachments: [...existing, ...attachments] });
      }
      setEditId(null);
    } else if (form.splitByDaimon && form.daimons.length > 0) {
      const parentTaskGroup = generateId();
      const createdIds = [];
      form.daimons.forEach(daimon => {
        const newTask = addTask({
          name: `${form.name} ${daimon.name}`,
          subject: form.subject,
          workType: form.workType,
          requiredHours: Number(daimon.requiredHours) || 0,
          deadline: form.deadline,
          sheetsUrl: form.sheetsUrl,
          viking: form.subject === '理科',
          fieldId: daimon.fieldId || null,
          parentTaskGroup,
        });
        if (newTask?.id) createdIds.push(newTask.id);
      });
      // Attach files to all split tasks
      if (taskFiles.length > 0) {
        for (const taskId of createdIds) {
          const attachments = await saveFilesForTask(taskId);
          updateTask(taskId, { taskAttachments: attachments });
        }
      }
    } else {
      const newTask = addTask({ ...form, requiredHours: Number(form.requiredHours), viking: !!form.viking });
      if (taskFiles.length > 0 && newTask?.id) {
        const attachments = await saveFilesForTask(newTask.id);
        updateTask(newTask.id, { taskAttachments: attachments });
      }
    }
    setForm({ name: '', subject: '', workType: '', requiredHours: '', deadline: '', sheetsUrl: '', viking: false, splitByDaimon: false, daimons: [] });
    setTaskFiles([]);
    setTaskFileError('');
  };

  const handleEdit = (task) => {
    setEditId(task.id);
    setForm({ name: task.name, subject: task.subject ?? '', workType: task.workType ?? '', requiredHours: task.requiredHours, deadline: task.deadline, sheetsUrl: task.sheetsUrl ?? '', viking: !!task.viking });
    setActiveSection('add');
  };

  const statusConfig = {
    pending: { text: '未割当', cls: 'bg-amber-100 text-amber-700' },
    assigned: { text: '割当済', cls: 'bg-blue-100 text-blue-700' },
    in_progress: { text: '作業中', cls: 'bg-sky-100 text-sky-700' },
    submitted: { text: '提出済', cls: 'bg-purple-100 text-purple-700' },
    completed: { text: '完了', cls: 'bg-green-100 text-green-700' },
  };

  // --- Assignment helpers ---
  const allPendingTasks = tasks.filter(t => t.status === 'pending' && !t.viking);
  const pendingTasks = allPendingTasks.filter(t => {
    if (assignSubjectFilter !== 'all' && t.subject !== assignSubjectFilter) return false;
    if (assignWorkTypeFilter !== 'all' && t.workType !== assignWorkTypeFilter) return false;
    if (assignDeadlineFrom && t.deadline < assignDeadlineFrom) return false;
    if (assignDeadlineTo && t.deadline > assignDeadlineTo) return false;
    return true;
  });
  const assignedTasks = tasks.filter(t => t.status === 'assigned' || t.status === 'in_progress');

  const handleAutoAssign = () => {
    const proposals = previewAutoAssign(getAllData());
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
    setManualSelect(prev => ({ ...prev, [taskId]: '' }));
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

  const TASK_CSV_COLUMNS = [
    { key: 'taskName', header: 'タスク名' },
    { key: 'subject', header: '科目' },
    { key: 'workType', header: '作業内容' },
    { key: 'requiredHours', header: '必要工数' },
    { key: 'deadline', header: '期限' },
    { key: 'status', header: 'ステータス' },
    { key: 'correctorName', header: '担当者' },
  ];

  const statusLabelMap = { pending: '未割当', assigned: '割当済', in_progress: '作業中', submitted: '提出済', completed: '完了' };

  const handleExportTasksCSV = () => {
    const users = getUsers();
    const data = sortedTasks.map(t => {
      const a = assignments.find(x => x.taskId === t.id);
      const u = a ? users.find(u => u.id === a.userId) : null;
      return {
        taskName: t.name,
        subject: t.subject || '',
        workType: t.workType || '',
        requiredHours: t.requiredHours,
        deadline: t.deadline || '',
        status: statusLabelMap[t.status] || t.status,
        correctorName: u?.name || '',
      };
    });
    const csv = toCSV(data, TASK_CSV_COLUMNS);
    downloadCSV(csv, `タスク一覧_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  // --- Bulk CSV import helpers ---
  const schools = getSchools();

  const handleBulkCsvParse = (text) => {
    setBulkCsvText(text);
    setBulkImportDone(null);
    if (!text.trim()) { setBulkParsed(null); return; }
    // Handle tab-separated by replacing tabs with commas (only if no commas present and tabs exist)
    let csvText = text;
    if (!text.includes(',') && text.includes('\t')) {
      csvText = text.split('\n').map(line => line.split('\t').map(cell => {
        const trimmed = cell.trim();
        if (trimmed.includes(',') || trimmed.includes('"') || trimmed.includes('\n')) return '"' + trimmed.replace(/"/g, '""') + '"';
        return trimmed;
      }).join(',')).join('\n');
    }
    const { headers, rows } = parseCSV(csvText);
    if (rows.length === 0) { setBulkParsed({ valid: [], errors: [{ line: 0, message: 'データ行がありません', row: {} }] }); return; }
    // Auto-detect format: if headers contain 学校名, use exam task format; otherwise use legacy task format
    if (headers.includes('学校名')) {
      const result = validateExamTaskCSV(rows, {
        schools,
        subjects: SUBJECTS_LIST,
        workTypes: workTypesList,
      });
      setBulkParsed({ ...result, format: 'exam' });
    } else {
      const result = validateTaskCSV(rows, {
        subjects: SUBJECTS_LIST,
        workTypes: workTypesList,
        getFieldsFn: getFields,
      });
      setBulkParsed({ ...result, format: 'task' });
    }
  };

  const handleBulkCsvFile = async () => {
    try {
      const { headers, rows } = await importCSVFile();
      // Re-construct CSV text from imported data for display
      const csvText = [headers.join(','), ...rows.map(r => headers.map(h => r[h] ?? '').join(','))].join('\n');
      setBulkCsvText(csvText);
      handleBulkCsvParse(csvText);
    } catch (err) {
      // user cancelled or error
    }
  };

  const handleBulkImportConfirm = () => {
    if (!bulkParsed || bulkParsed.valid.length === 0) return;
    let count = 0;
    bulkParsed.valid.forEach(row => {
      if (bulkParsed.format === 'exam') {
        addTask({
          name: row.taskName,
          subject: row.subject,
          workType: row.workType,
          requiredHours: row.requiredHours,
          deadline: row.deadline,
          viking: false,
          sheetsUrl: '',
          fieldId: null,
        });
      } else {
        addTask({
          name: row.name,
          subject: row.subject,
          workType: row.workType,
          requiredHours: row.requiredHours,
          deadline: row.deadline,
          viking: row.viking,
          sheetsUrl: row.sheetsUrl || '',
          fieldId: row.fieldId || null,
        });
      }
      count++;
    });
    setBulkImportDone(`${count}件のタスクを登録しました`);
    setBulkParsed(null);
    setBulkCsvText('');
    setMessage(`CSV一括登録: ${count}件のタスクを追加しました`);
    setTimeout(() => setMessage(''), 5000);
  };

  const handleDownloadTaskTemplate = () => {
    const templateData = [
      { schoolName: schools[0]?.name || '開成中学', subject: '算数', workType: workTypesList[0] || '新年度試験種', requiredHours: 5, deadline: '2026-04-01' },
      { schoolName: schools[1]?.name || '麻布中学', subject: '理科', workType: workTypesList[0] || 'タグ付け', requiredHours: 3, deadline: '2026-04-15' },
    ];
    const csv = toCSV(templateData, EXAM_TASK_CSV_COLUMNS);
    downloadCSV(csv, '試験種一括登録テンプレート.csv');
  };

  // --- Daimon CSV import helpers ---
  const handleDaimonCsvParse = (text) => {
    setDaimonCsvText(text);
    setDaimonCsvImportDone(null);
    if (!text.trim()) { setDaimonCsvParsed(null); return; }
    let csvText = text;
    if (!text.includes(',') && text.includes('\t')) {
      csvText = text.split('\n').map(line => line.split('\t').map(cell => {
        const trimmed = cell.trim();
        if (trimmed.includes(',') || trimmed.includes('"') || trimmed.includes('\n')) return '"' + trimmed.replace(/"/g, '""') + '"';
        return trimmed;
      }).join(',')).join('\n');
    }
    const { rows } = parseCSV(csvText);
    if (rows.length === 0) { setDaimonCsvParsed({ valid: [], errors: [{ line: 0, message: 'データ行がありません', row: {} }] }); return; }
    const result = validateDaimonTaskCSV(rows, schools, getFields);
    setDaimonCsvParsed(result);
  };

  const handleDaimonCsvFile = async () => {
    try {
      const { headers, rows } = await importCSVFile();
      const csvText = [headers.join(','), ...rows.map(r => headers.map(h => r[h] ?? '').join(','))].join('\n');
      setDaimonCsvText(csvText);
      handleDaimonCsvParse(csvText);
    } catch (err) {
      // user cancelled or error
    }
  };

  const handleDaimonCsvConfirm = () => {
    if (!daimonCsvParsed || daimonCsvParsed.valid.length === 0) return;
    // Group by school+subject+deadline
    const groupMap = {};
    daimonCsvParsed.valid.forEach(row => {
      const key = `${row.schoolName}__${row.subject}__${row.deadline}`;
      if (!groupMap[key]) groupMap[key] = { rows: [], parentTaskGroup: generateId() };
      groupMap[key].rows.push(row);
    });

    let count = 0;
    const examTypes = getExamTypes();
    Object.values(groupMap).forEach(group => {
      group.rows.forEach(row => {
        // Look up or create school
        let school = schools.find(s => s.name === row.schoolName);
        if (!school) {
          school = addSchool(row.schoolName);
        }
        // Look up or create examType
        let et = examTypes.find(e => e.schoolId === school.id && e.subject === row.subject);
        if (!et) {
          et = addExamType(school.id, row.subject);
          examTypes.push(et); // add to local list so subsequent rows can find it
        }

        addTask({
          name: row.taskName,
          subject: row.subject,
          workType: '新年度試験種',
          requiredHours: row.hours,
          deadline: row.deadline,
          sheetsUrl: '',
          viking: row.subject === '理科',
          fieldId: row.fieldId,
          parentTaskGroup: group.parentTaskGroup,
        });
        count++;
      });
    });

    setDaimonCsvImportDone(`${count}件の大問分割タスクを登録しました`);
    setDaimonCsvParsed(null);
    setDaimonCsvText('');
    setMessage(`大問分割CSV一括登録: ${count}件のタスクを追加しました`);
    setTimeout(() => setMessage(''), 5000);
  };

  const handleDownloadDaimonTemplate = () => {
    const templateData = [
      { schoolName: schools[0]?.name || '開成中学', subject: '算数', daimonName: '大問1', fieldName: '旅人算', hours: 2, deadline: '2026-04-01' },
      { schoolName: schools[0]?.name || '開成中学', subject: '算数', daimonName: '大問2', fieldName: '食塩水', hours: 1.5, deadline: '2026-04-01' },
      { schoolName: schools[1]?.name || '麻布中学', subject: '理科', daimonName: '大問1', fieldName: '中和', hours: 3, deadline: '2026-04-15' },
      { schoolName: schools[1]?.name || '麻布中学', subject: '理科', daimonName: '大問2', fieldName: 'てこ', hours: 2, deadline: '2026-04-15' },
    ];
    const csv = toCSV(templateData, DAIMON_TASK_CSV_COLUMNS);
    downloadCSV(csv, '大問分割タスク一括登録テンプレート.csv');
  };

  const clearTaskFilters = () => {
    setSearchText('');
    setStatusFilter('all');
    setSubjectFilter('all');
    setWorkTypeFilter('all');
    setDeadlineFrom('');
    setDeadlineTo('');
    setWorkerFilter('all');
  };

  const clearAssignFilters = () => {
    setAssignSubjectFilter('all');
    setAssignWorkTypeFilter('all');
    setAssignDeadlineFrom('');
    setAssignDeadlineTo('');
  };

  const handleExportAssignmentsCSV = () => {
    const allAssignments = getAssignments();
    const allTasksList = getTasks();
    const users = getUsers();
    const data = allAssignments.map(a => {
      const task = allTasksList.find(t => t.id === a.taskId);
      const u = users.find(u => u.id === a.userId);
      return {
        taskName: task?.name || '',
        subject: task?.subject || '',
        workType: task?.workType || '',
        correctorName: u?.name || '',
        correctorLoginId: u?.loginId || '',
        assignedHours: a.assignedHours || '',
        actualHours: a.actualHours || '',
        status: a.status,
        assignedAt: a.assignedAt ? a.assignedAt.slice(0, 10) : '',
        submittedAt: a.submittedAt ? a.submittedAt.slice(0, 10) : '',
      };
    });
    const csv = toCSV(data, ASSIGNMENT_CSV_COLUMNS);
    downloadCSV(csv, `振り分け結果_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const taskSections = [
    { key: 'list', icon: '\u{1F4CB}', title: '試験種一覧', desc: 'タスクの検索・フィルタ・管理' },
    { key: 'add', icon: '\u{2795}', title: '新規追加', desc: '試験種を個別に追加' },
    { key: 'csv', icon: '\u{1F4C4}', title: 'CSV一括登録', desc: 'CSVファイルで一括登録' },
    { key: 'daimon', icon: '\u{1F4C4}', title: '大問分割CSV登録', desc: '大問ごとに分割して登録' },
    { key: 'assigned', icon: '\u{1F4CC}', title: '割当済み', desc: '割当済みタスクの確認・解除' },
    { key: 'results', icon: '\u{1F4CA}', title: '実績', desc: '完了タスクの実績レポート' },
    { key: 'overview-list', icon: '\u{1F4CB}', title: '作成必要試験種一覧', desc: '科目・作業内容別の試験種一覧' },
  ];

  return (
    <div className="space-y-4">
      {message && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">
          {message}
        </div>
      )}

      {/* Button menu */}
      {!activeSection && (
        <div className="grid grid-cols-2 gap-3 p-4">
          {taskSections.map(s => (
            <button key={s.key} onClick={() => setActiveSection(s.key)}
              className="p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition text-left">
              <span className="text-2xl">{s.icon}</span>
              <p className="font-medium text-gray-800 mt-1">{s.title}</p>
              <p className="text-xs text-gray-500">{s.desc}</p>
            </button>
          ))}
        </div>
      )}

      {/* Back button + active section */}
      {activeSection && (
        <div>
          <button onClick={() => setActiveSection(null)} className="mb-3 text-sm text-gray-500 hover:text-gray-700">
            ← 戻る
          </button>

      {/* ===== Section: 新規追加 ===== */}
      {activeSection === 'add' && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">{editId ? '試験種を編集' : '新しい試験種を追加'}</h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">試験種名</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="例：〇〇中学校 国語 第2回"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">科目</label>
                <select
                  value={form.subject}
                  onChange={e => setForm({ ...form, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">選択してください</option>
                  {SUBJECTS_LIST.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">作業内容</label>
                <select
                  value={form.workType}
                  onChange={e => setForm({ ...form, workType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">選択してください</option>
                  {workTypesList.map(w => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
              </div>
            </div>
            {!form.splitByDaimon && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">必要工数（時間）<span className="text-gray-400 font-normal ml-1">（任意）</span></label>
              <input
                type="number"
                value={form.requiredHours}
                onChange={e => setForm({ ...form, requiredHours: e.target.value })}
                min="0" max="500"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="未入力可"
              />
            </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">期限</label>
              <input
                type="date"
                value={form.deadline}
                onChange={e => setForm({ ...form, deadline: e.target.value })}
                className="w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                作業スプレッドシート URL
                <span className="ml-1 text-gray-400 font-normal">（任意）作業者に共有するスプシのURL</span>
              </label>
              <input
                type="url"
                value={form.sheetsUrl}
                onChange={e => setForm({ ...form, sheetsUrl: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="https://docs.google.com/spreadsheets/d/..."
              />
            </div>
            {!form.splitByDaimon && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="viking-check"
                checked={form.viking}
                onChange={e => setForm({ ...form, viking: e.target.checked })}
                className="w-4 h-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
              />
              <label htmlFor="viking-check" className="text-sm font-medium text-gray-700">
                🛡 VIKINGタスク
                <span className="ml-1 text-gray-400 font-normal">（添削者が自分で取れるタスク）</span>
              </label>
            </div>
            )}
            {(form.subject === '理科' || form.subject === '算数') && form.workType === '新年度試験種' && (
              <div className="border border-indigo-200 rounded-lg p-3 bg-indigo-50/50 space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="split-daimon-check"
                    checked={form.splitByDaimon}
                    onChange={e => setForm({ ...form, splitByDaimon: e.target.checked, daimons: e.target.checked ? form.daimons : [] })}
                    className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                  />
                  <label htmlFor="split-daimon-check" className="text-sm font-medium text-gray-700">
                    大問分割モード
                    <span className="ml-1 text-gray-400 font-normal">（大問ごとにタスクを分割登録）</span>
                  </label>
                </div>
                {form.splitByDaimon && (
                  <div className="space-y-2">
                    {form.daimons.map((d, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <input
                          type="text"
                          placeholder="大問名 (例: 大問1)"
                          value={d.name}
                          onChange={e => {
                            const updated = [...form.daimons];
                            updated[i] = { ...updated[i], name: e.target.value };
                            setForm({ ...form, daimons: updated });
                          }}
                          className="flex-1 min-w-[100px] px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <select
                          value={d.fieldId}
                          onChange={e => {
                            const updated = [...form.daimons];
                            updated[i] = { ...updated[i], fieldId: e.target.value };
                            setForm({ ...form, daimons: updated });
                          }}
                          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                          <option value="">分野を選択</option>
                          {getFields(form.subject).map(f => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          placeholder="工数"
                          value={d.requiredHours}
                          onChange={e => {
                            const updated = [...form.daimons];
                            updated[i] = { ...updated[i], requiredHours: e.target.value };
                            setForm({ ...form, daimons: updated });
                          }}
                          min="0" max="500"
                          className="w-20 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const updated = form.daimons.filter((_, idx) => idx !== i);
                            setForm({ ...form, daimons: updated });
                          }}
                          className="text-red-400 hover:text-red-600 text-lg font-bold px-1"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, daimons: [...form.daimons, { name: '', fieldId: '', requiredHours: '' }] })}
                      className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      + 大問を追加
                    </button>
                  </div>
                )}
              </div>
            )}
            {/* 問題ファイル添付 */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                問題ファイル添付（PDF等）
                <span className="ml-1 text-gray-400 font-normal">（任意）添削者に共有するファイル</span>
              </label>
              <input
                type="file"
                accept=".pdf,.xlsx,.xls,.docx,.doc,.jpg,.jpeg,.png"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files);
                  if (files.length === 0) return;
                  const errors = [];
                  const validFiles = [];
                  files.forEach(f => {
                    const fileErrors = validateTaskFile(f);
                    if (fileErrors.length > 0) errors.push(...fileErrors);
                    else validFiles.push(f);
                  });
                  if (errors.length > 0) setTaskFileError(errors.join('\n'));
                  else setTaskFileError('');
                  setTaskFiles(prev => [...prev, ...validFiles]);
                  e.target.value = '';
                }}
                className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-gray-300 file:text-sm file:font-medium file:bg-white file:text-gray-700 hover:file:bg-gray-50 file:cursor-pointer file:transition"
              />
              {taskFileError && <p className="text-red-500 text-xs mt-1 whitespace-pre-line">{taskFileError}</p>}
              {taskFiles.length > 0 && (
                <div className="mt-2 space-y-1">
                  {taskFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs bg-gray-50 rounded-lg px-3 py-1.5">
                      <span className="text-gray-500">{f.name.endsWith('.pdf') ? '\uD83D\uDCC4' : '\uD83D\uDCCE'}</span>
                      <span className="text-gray-700 truncate flex-1">{f.name}</span>
                      <span className="text-gray-400">({(f.size / 1024).toFixed(0)}KB)</span>
                      <button
                        type="button"
                        onClick={() => setTaskFiles(prev => prev.filter((_, idx) => idx !== i))}
                        className="text-red-400 hover:text-red-600 font-medium"
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && <p className="text-red-500 text-xs">{error}</p>}
            <div className="flex gap-2">
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition">
                {editId ? '更新' : '追加'}
              </button>
              {editId && (
                <button type="button" onClick={() => { setEditId(null); setForm({ name: '', subject: '', workType: '', requiredHours: '', deadline: '', sheetsUrl: '', viking: false, splitByDaimon: false, daimons: [] }); setTaskFiles([]); setTaskFileError(''); }}
                  className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 px-4 py-2 rounded-lg transition">
                  キャンセル
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* ===== Section: CSV一括登録 ===== */}
      {activeSection === 'csv' && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">CSV一括登録</h3>
          <div className="flex items-center gap-2 mb-3">
            <button
              type="button"
              onClick={handleDownloadTaskTemplate}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition font-medium"
            >
              テンプレートDL
            </button>
          </div>
          {true && (
              <div className="space-y-3 bg-orange-50/50 border border-orange-200 rounded-lg p-4">
                <p className="text-xs text-gray-500">
                  CSVまたはTSV形式で試験種を一括登録できます。ヘッダ行: 学校名,科目,作業内容,工数,期限（従来形式のタスク名ヘッダにも対応）
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleBulkCsvFile}
                    className="text-sm px-3 py-1.5 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition font-medium"
                  >
                    CSVファイルを選択
                  </button>
                  <span className="text-xs text-gray-400 self-center">または下のテキストエリアに貼り付け</span>
                </div>
                <textarea
                  value={bulkCsvText}
                  onChange={e => handleBulkCsvParse(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-orange-500 outline-none"
                  placeholder={`学校名,科目,作業内容,工数,期限\n開成中学,算数,新年度試験種,5,2026-04-01\n麻布中学,理科,タグ付け,3,2026-04-15`}
                />

                {bulkParsed && (
                  <div className="space-y-2">
                    {/* Validation summary */}
                    <div className="flex gap-3 text-xs font-medium">
                      <span className="text-green-700">有効: {bulkParsed.valid.length}件</span>
                      <span className="text-red-600">エラー: {bulkParsed.errors.length}件</span>
                    </div>

                    {/* Error list */}
                    {bulkParsed.errors.length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-32 overflow-y-auto">
                        {bulkParsed.errors.map((err, i) => (
                          <p key={i} className="text-xs text-red-600">{err.line}行目: {err.message}</p>
                        ))}
                      </div>
                    )}

                    {/* Preview table */}
                    {bulkParsed.valid.length > 0 && (
                      <div className="overflow-x-auto max-h-60 overflow-y-auto">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="px-2 py-1 text-left border border-gray-200">行</th>
                              {bulkParsed.format === 'exam' ? (
                                <>
                                  <th className="px-2 py-1 text-left border border-gray-200">学校名</th>
                                  <th className="px-2 py-1 text-left border border-gray-200">科目</th>
                                  <th className="px-2 py-1 text-left border border-gray-200">作業内容</th>
                                  <th className="px-2 py-1 text-right border border-gray-200">工数</th>
                                  <th className="px-2 py-1 text-left border border-gray-200">期限</th>
                                  <th className="px-2 py-1 text-left border border-gray-200">タスク名（自動生成）</th>
                                </>
                              ) : (
                                <>
                                  <th className="px-2 py-1 text-left border border-gray-200">タスク名</th>
                                  <th className="px-2 py-1 text-left border border-gray-200">科目</th>
                                  <th className="px-2 py-1 text-left border border-gray-200">作業内容</th>
                                  <th className="px-2 py-1 text-right border border-gray-200">工数</th>
                                  <th className="px-2 py-1 text-left border border-gray-200">期限</th>
                                  <th className="px-2 py-1 text-center border border-gray-200">VIKING</th>
                                  <th className="px-2 py-1 text-left border border-gray-200">分野</th>
                                </>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {bulkParsed.valid.map((row, i) => (
                              <tr key={i} className="bg-green-50/50 hover:bg-green-100/50">
                                <td className="px-2 py-1 border border-gray-200 text-gray-400">{row._line}</td>
                                {bulkParsed.format === 'exam' ? (
                                  <>
                                    <td className="px-2 py-1 border border-gray-200">{row.schoolName}</td>
                                    <td className="px-2 py-1 border border-gray-200">{row.subject}</td>
                                    <td className="px-2 py-1 border border-gray-200">{row.workType}</td>
                                    <td className="px-2 py-1 border border-gray-200 text-right">{row.requiredHours}h</td>
                                    <td className="px-2 py-1 border border-gray-200">{row.deadline}</td>
                                    <td className="px-2 py-1 border border-gray-200 text-gray-500">{row.taskName}</td>
                                  </>
                                ) : (
                                  <>
                                    <td className="px-2 py-1 border border-gray-200">{row.name}</td>
                                    <td className="px-2 py-1 border border-gray-200">{row.subject}</td>
                                    <td className="px-2 py-1 border border-gray-200">{row.workType}</td>
                                    <td className="px-2 py-1 border border-gray-200 text-right">{row.requiredHours}h</td>
                                    <td className="px-2 py-1 border border-gray-200">{row.deadline}</td>
                                    <td className="px-2 py-1 border border-gray-200 text-center">{row.viking ? '○' : ''}</td>
                                    <td className="px-2 py-1 border border-gray-200 text-gray-500">{row.fieldId ? getFields(row.subject).find(f => f.id === row.fieldId)?.name || '' : ''}</td>
                                  </>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Confirm button */}
                    {bulkParsed.valid.length > 0 && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleBulkImportConfirm}
                          className="bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
                        >
                          一括登録（{bulkParsed.valid.length}件）
                        </button>
                        <button
                          type="button"
                          onClick={() => { setBulkParsed(null); setBulkCsvText(''); }}
                          className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 px-4 py-2 rounded-lg transition"
                        >
                          クリア
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {bulkImportDone && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm font-medium">
                    {bulkImportDone}
                  </div>
                )}
              </div>
            )}
        </div>
      )}

      {/* ===== Section: 大問分割CSV登録 ===== */}
      {activeSection === 'daimon' && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">大問分割CSV一括登録</h3>
          <div className="flex items-center gap-2 mb-3">
            <button
              type="button"
              onClick={handleDownloadDaimonTemplate}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition font-medium"
            >
              テンプレートDL
            </button>
          </div>
          {true && (
              <div className="space-y-3 bg-purple-50/50 border border-purple-200 rounded-lg p-4">
                <p className="text-xs text-gray-500">
                  大問ごとに分野付きタスクを一括登録します。同じ学校+科目+期限の行は1つのグループとして登録されます。
                  理科はVIKING（自己選択）、算数はリーダー割当になります。
                </p>
                <p className="text-xs text-gray-400">
                  ヘッダ行: 学校名,科目,大問名,分野,工数,期限
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleDaimonCsvFile}
                    className="text-sm px-3 py-1.5 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition font-medium"
                  >
                    CSVファイルを選択
                  </button>
                  <span className="text-xs text-gray-400 self-center">または下のテキストエリアに貼り付け</span>
                </div>
                <textarea
                  value={daimonCsvText}
                  onChange={e => handleDaimonCsvParse(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-purple-500 outline-none"
                  placeholder={`学校名,科目,大問名,分野,工数,期限\n開成中学,算数,大問1,旅人算,2,2026-04-01\n開成中学,算数,大問2,食塩水,1.5,2026-04-01\n麻布中学,理科,大問1,中和,3,2026-04-15`}
                />

                {daimonCsvParsed && (
                  <div className="space-y-2">
                    <div className="flex gap-3 text-xs font-medium">
                      <span className="text-green-700">有効: {daimonCsvParsed.valid.length}件</span>
                      <span className="text-red-600">エラー: {daimonCsvParsed.errors.length}件</span>
                    </div>

                    {daimonCsvParsed.errors.length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-32 overflow-y-auto">
                        {daimonCsvParsed.errors.map((err, i) => (
                          <p key={i} className="text-xs text-red-600">{err.line}行目: {err.message}</p>
                        ))}
                      </div>
                    )}

                    {daimonCsvParsed.valid.length > 0 && (
                      <div className="overflow-x-auto max-h-60 overflow-y-auto">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="px-2 py-1 text-left border border-gray-200">行</th>
                              <th className="px-2 py-1 text-left border border-gray-200">学校名</th>
                              <th className="px-2 py-1 text-left border border-gray-200">科目</th>
                              <th className="px-2 py-1 text-left border border-gray-200">大問名</th>
                              <th className="px-2 py-1 text-left border border-gray-200">分野</th>
                              <th className="px-2 py-1 text-right border border-gray-200">工数</th>
                              <th className="px-2 py-1 text-left border border-gray-200">期限</th>
                              <th className="px-2 py-1 text-center border border-gray-200">VIKING</th>
                            </tr>
                          </thead>
                          <tbody>
                            {daimonCsvParsed.valid.map((row, i) => (
                              <tr key={i} className="bg-green-50/50 hover:bg-green-100/50">
                                <td className="px-2 py-1 border border-gray-200 text-gray-400">{row._line}</td>
                                <td className="px-2 py-1 border border-gray-200">{row.schoolName}</td>
                                <td className="px-2 py-1 border border-gray-200">{row.subject}</td>
                                <td className="px-2 py-1 border border-gray-200">{row.daimonName}</td>
                                <td className="px-2 py-1 border border-gray-200">{row.fieldName}</td>
                                <td className="px-2 py-1 border border-gray-200 text-right">{row.hours}h</td>
                                <td className="px-2 py-1 border border-gray-200">{row.deadline}</td>
                                <td className="px-2 py-1 border border-gray-200 text-center">{row.subject === '理科' ? '✓' : '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {daimonCsvParsed.valid.length > 0 && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleDaimonCsvConfirm}
                          className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
                        >
                          一括登録（{daimonCsvParsed.valid.length}件）
                        </button>
                        <button
                          type="button"
                          onClick={() => { setDaimonCsvParsed(null); setDaimonCsvText(''); }}
                          className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 px-4 py-2 rounded-lg transition"
                        >
                          クリア
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {daimonCsvImportDone && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm font-medium">
                    {daimonCsvImportDone}
                  </div>
                )}
              </div>
            )}
        </div>
      )}

      {/* ===== Section: タスク一覧 ===== */}
      {activeSection === 'list' && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="text-sm font-semibold text-gray-700">試験種一覧（{filteredTasks.length}件）</h3>
            {tasks.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {[
                  { key: 'deadline', label: '期限' },
                  { key: 'subject', label: '科目' },
                  { key: 'workType', label: '作業内容' },
                  { key: 'status', label: 'ステータス' },
                  { key: 'requiredHours', label: '工数' },
                  { key: 'name', label: '名前' },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => handleSort(key)}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition font-medium ${sortKey === key ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                  >
                    {label}{sortKey === key ? (sortAsc ? ' ↑' : ' ↓') : ''}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Search & status filter */}
          <div className="flex gap-2 mb-2 flex-wrap">
            <input
              type="text"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder="タスク名で検索..."
              className="flex-1 min-w-[180px] px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">全て</option>
              <option value="pending">未割当</option>
              <option value="assigned">割当済</option>
              <option value="submitted">提出済</option>
              <option value="completed">完了</option>
            </select>
            <button
              onClick={() => setShowAdvancedSearch(v => !v)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition font-medium ${showAdvancedSearch ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
            >
              {showAdvancedSearch ? '▲ 詳細検索' : '▼ 詳細検索'}
            </button>
            <button
              onClick={handleExportTasksCSV}
              disabled={filteredTasks.length === 0}
              className="text-xs px-3 py-1.5 rounded-lg border border-green-300 text-green-700 hover:bg-green-50 disabled:opacity-40 transition font-medium"
            >
              CSV出力
            </button>
          </div>
          {showAdvancedSearch && (
            <div className="mb-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">科目</label>
                  <select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="all">すべて</option>
                    {SUBJECTS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">作業内容</label>
                  <select value={workTypeFilter} onChange={e => setWorkTypeFilter(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="all">すべて</option>
                    {workTypesList.map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">作業者</label>
                  <select value={workerFilter} onChange={e => setWorkerFilter(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="all">すべて</option>
                    {correctors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">期限（開始）</label>
                  <input type="date" value={deadlineFrom} onChange={e => setDeadlineFrom(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">期限（終了）</label>
                  <input type="date" value={deadlineTo} onChange={e => setDeadlineTo(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div className="flex items-end">
                  <button onClick={clearTaskFilters}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-100 transition">
                    条件クリア
                  </button>
                </div>
              </div>
            </div>
          )}

          {filteredTasks.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">試験種がありません</p>
          ) : (
            <div className="space-y-2">
              {sortedTasks.map(task => {
                const sc = statusConfig[task.status] ?? { text: task.status, cls: 'bg-gray-100 text-gray-600' };
                const assignment = assignments.find(a => a.taskId === task.id);
                return (
                  <div key={task.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sc.cls}`}>{sc.text}</span>
                        <span className="text-sm font-medium text-gray-800 truncate">{task.name}</span>
                        {task.viking && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-orange-100 text-orange-700">🛡 VIKING</span>
                        )}
                        {task.sheetsUrl && (
                          <a href={task.sheetsUrl} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-green-600 hover:text-green-800 bg-green-50 hover:bg-green-100 px-1.5 py-0.5 rounded transition"
                            title="作業スプレッドシートを開く">🔗 スプシ</a>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {task.subject}{task.workType ? ` · ${task.workType}` : ''} · {task.requiredHours}h · 期限: {task.deadline}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => handleEdit(task)} className="text-xs text-blue-500 hover:bg-blue-50 px-2 py-1 rounded transition">編集</button>
                      <button onClick={() => { if (confirm(`「${task.name}」を削除しますか？`)) deleteTask(task.id); }}
                        className="text-xs text-red-400 hover:bg-red-50 px-2 py-1 rounded transition">削除</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===== Section 2: 振り分け（AssignmentTabに移行済み） ===== */}
      {false && section === -1 && (
        <div className="space-y-4">
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
                🔀 自動振り分け実行
              </button>
            </div>
            {allPendingTasks.length === 0 ? (
              <p className="text-green-600 text-xs">未割当のタスクはありません</p>
            ) : (
              <p className="text-amber-600 text-xs">未割当タスク: {allPendingTasks.length}件</p>
            )}

            {previewData && (
              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
                <h4 className="text-sm font-bold text-blue-800 mb-3">📋 振り分けプレビュー（{editedProposals.length}件）</h4>
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
                          ✕ 除外
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
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== Section: 割当済み ===== */}
      {activeSection === 'assigned' && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">割当済みタスク（{assignedTasks.length}件）</h3>
          {assignedTasks.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">割当済みのタスクはありません</p>
          ) : (
            <div className="space-y-2">
              {assignedTasks.map(task => {
                const assignedUser = getAssignedUser(task.id);
                const assignment = assignments.find(a => a.taskId === task.id);
                const examInputs = getExamInputs(task.id);
                const inputStatus = examInputs[0]?.status;
                return (
                  <div key={task.id} className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-800">{task.name}</p>
                        {task.sheetsUrl && (
                          <a href={task.sheetsUrl} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-green-600 hover:text-green-800 bg-green-50 hover:bg-green-100 px-1.5 py-0.5 rounded transition">
                            🔗 スプシ
                          </a>
                        )}
                        {inputStatus === 'submitted' && (
                          <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">📊 スプシ提出済</span>
                        )}
                        {inputStatus === 'draft' && (
                          <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">📝 下書き</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {task.subject}{task.workType ? ` · ${task.workType}` : ''} · {task.requiredHours}h ·
                        担当: <strong>{assignedUser?.name ?? '不明'}</strong>
                        {(() => {
                          const totalSec = getTaskTotalTime(task.id);
                          if (!totalSec) return null;
                          const h = Math.floor(totalSec / 3600);
                          const m = Math.floor((totalSec % 3600) / 60);
                          const s = totalSec % 60;
                          const timeStr = h > 0 ? `${h}時間${m}分` : m > 0 ? `${m}分${s}秒` : `${s}秒`;
                          return <span className="text-xs text-gray-500 ml-2">⏱ {timeStr}</span>;
                        })()}
                        {assignment?.note && <span className="ml-1 text-gray-400">({assignment.note})</span>}
                      </p>
                      {inputStatus === 'submitted' && examInputs[0] && (
                        <p className="text-xs text-green-600 mt-0.5">
                          大問 {examInputs[0].大問リスト?.length ?? 0} /
                          問 {examInputs[0].大問リスト?.reduce((s, d) => s + (d.問リスト?.length ?? 0), 0) ?? 0} 入力済
                        </p>
                      )}
                      {/* 大問別作業時間 */}
                      {(() => {
                        const totalSec = getTaskTotalTime(task.id);
                        if (!totalSec || totalSec <= 0) return null;
                        const logs = getTimeLogs({ taskId: task.id });
                        const daimonIds = [...new Set(logs.map(l => l.daimonId))].filter(d => d != null).sort((a, b) => a - b);
                        if (daimonIds.length === 0) return null;
                        const fmtS = (s) => { const h = Math.floor(s/3600); const m = Math.floor((s%3600)/60); const sec = s%60; if (h>0) return `${h}h${m}m`; if (m>0) return `${m}m${sec}s`; return `${sec}s`; };
                        return (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {daimonIds.map(did => {
                              const dSec = getDaimonTotalTime(task.id, did);
                              return (
                                <span key={did} className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100">
                                  大問{did}: {fmtS(dSec)}
                                </span>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                    <button
                      onClick={() => { if (assignment && confirm('割り当てを解除しますか？')) deleteAssignment(assignment.id); }}
                      className="shrink-0 text-xs text-red-400 hover:bg-red-50 px-2 py-1 rounded transition"
                    >
                      解除
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===== Section: 実績 ===== */}
      {activeSection === 'results' && (() => {
        const completedAssignments = assignments.filter(a => a.status === 'completed');
        if (completedAssignments.length === 0) {
          return (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">実績レポート</h3>
              <p className="text-gray-400 text-sm text-center py-6">完了済みのタスクはありません</p>
            </div>
          );
        }
        const totalPlanned = completedAssignments.reduce((s, a) => {
          const t = tasks.find(t => t.id === a.taskId);
          return s + (t?.requiredHours ?? 0);
        }, 0);
        const totalActual = completedAssignments.reduce((s, a) => s + (a.actualHours ?? 0), 0);
        return (
          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-700">実績レポート</h3>
                <p className="text-xs text-gray-400 mt-0.5">提出済み業務の工数実績</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">合計実績</p>
                <p className="text-sm font-bold text-green-700">{totalActual}h <span className="text-gray-400 font-normal text-xs">/ 予定 {totalPlanned}h</span></p>
              </div>
              <button onClick={handleExportAssignmentsCSV}
                className="text-xs bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg transition ml-2">
                📤 CSV出力
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 pr-3 text-gray-500 font-medium">試験種名</th>
                    <th className="text-left py-2 pr-3 text-gray-500 font-medium">科目</th>
                    <th className="text-left py-2 pr-3 text-gray-500 font-medium">作業内容</th>
                    <th className="text-left py-2 pr-3 text-gray-500 font-medium">作業者</th>
                    <th className="text-right py-2 pr-3 text-gray-500 font-medium">予定工数</th>
                    <th className="text-right py-2 pr-3 text-gray-500 font-medium">実績工数</th>
                    <th className="text-right py-2 text-gray-500 font-medium">提出日</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[...completedAssignments]
                    .sort((a, b) => new Date(b.submittedAt ?? b.assignedAt) - new Date(a.submittedAt ?? a.assignedAt))
                    .map(assignment => {
                      const task = tasks.find(t => t.id === assignment.taskId);
                      const corrector = correctors.find(c => c.id === assignment.userId);
                      const diff = assignment.actualHours != null && task
                        ? assignment.actualHours - task.requiredHours : null;
                      return (
                        <tr key={assignment.id} className="hover:bg-gray-50 transition">
                          <td className="py-2 pr-3 text-gray-800 font-medium">
                            <div className="flex items-center gap-1">
                              {task?.name ?? '不明'}
                              {task?.sheetsUrl && (
                                <a href={task.sheetsUrl} target="_blank" rel="noopener noreferrer"
                                  className="text-green-500 hover:text-green-700">🔗</a>
                              )}
                            </div>
                          </td>
                          <td className="py-2 pr-3 text-gray-600">{task?.subject ?? '—'}</td>
                          <td className="py-2 pr-3 text-gray-600">{task?.workType ?? '—'}</td>
                          <td className="py-2 pr-3 text-gray-700 font-medium">{corrector?.name ?? '不明'}</td>
                          <td className="py-2 pr-3 text-right text-gray-600">{task?.requiredHours ?? '—'}h</td>
                          <td className="py-2 pr-3 text-right">
                            {assignment.actualHours != null ? (
                              <span className={`font-semibold ${diff != null && diff > 0 ? 'text-red-600' : diff != null && diff < 0 ? 'text-green-600' : 'text-gray-700'}`}>
                                {assignment.actualHours}h
                                {diff != null && diff !== 0 && (
                                  <span className="text-xs ml-1">({diff > 0 ? '+' : ''}{diff}h)</span>
                                )}
                              </span>
                            ) : <span className="text-gray-400">未入力</span>}
                          </td>
                          <td className="py-2 text-right text-gray-400">
                            {assignment.submittedAt
                              ? new Date(assignment.submittedAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
                              : '—'}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ===== Section: 作成必要試験種一覧 ===== */}
      {activeSection === 'overview-list' && (() => {
        const olSubjects = [...new Set(tasks.map(t => t.subject).filter(Boolean))].sort();
        const olWorkTypes = [...new Set(tasks.map(t => t.workType).filter(Boolean))].sort();

        // Use component-level state via a mini inner component to avoid hooks-in-callback issues
        return <OverviewListSection tasks={tasks} assignments={assignments} correctors={correctors} statusConfig={statusConfig} olSubjects={olSubjects} olWorkTypes={olWorkTypes} />;
      })()}

        </div>
      )}
    </div>
  );
};

// ---- Overview List Section (作成必要試験種一覧) ----
const OverviewListSection = ({ tasks, assignments, correctors, statusConfig, olSubjects, olWorkTypes }) => {
  const [olSubjectFilter, setOlSubjectFilter] = useState('all');
  const [olWorkTypeFilter, setOlWorkTypeFilter] = useState('all');
  const [collapsedGroups, setCollapsedGroups] = useState({});

  const filtered = tasks.filter(t => {
    if (olSubjectFilter !== 'all' && t.subject !== olSubjectFilter) return false;
    if (olWorkTypeFilter !== 'all' && t.workType !== olWorkTypeFilter) return false;
    return true;
  });

  // Group by subject -> workType
  const grouped = {};
  filtered.forEach(t => {
    const subj = t.subject || '未設定';
    const wt = t.workType || '未設定';
    if (!grouped[subj]) grouped[subj] = {};
    if (!grouped[subj][wt]) grouped[subj][wt] = [];
    grouped[subj][wt].push(t);
  });

  const toggleGroup = (key) => {
    setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getAssignedCorrectorName = (taskId) => {
    const a = assignments.find(x => x.taskId === taskId);
    if (!a) return null;
    const c = correctors.find(c => c.id === a.userId);
    return c?.name || '不明';
  };

  const sortedSubjects = Object.keys(grouped).sort();
  const totalCount = filtered.length;

  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">作成必要試験種一覧</h3>
          <p className="text-xs text-gray-400 mt-0.5">科目・作業内容別のタスク一覧（{totalCount}件）</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">科目</label>
          <select value={olSubjectFilter} onChange={e => setOlSubjectFilter(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="all">すべて</option>
            {olSubjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">作業内容</label>
          <select value={olWorkTypeFilter} onChange={e => setOlWorkTypeFilter(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="all">すべて</option>
            {olWorkTypes.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
        {(olSubjectFilter !== 'all' || olWorkTypeFilter !== 'all') && (
          <div className="flex items-end">
            <button onClick={() => { setOlSubjectFilter('all'); setOlWorkTypeFilter('all'); }}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition">
              フィルタ解除
            </button>
          </div>
        )}
      </div>

      {totalCount === 0 ? (
        <p className="text-gray-400 text-sm text-center py-6">該当する試験種はありません</p>
      ) : (
        <div className="space-y-4">
          {sortedSubjects.map(subj => {
            const workTypes = grouped[subj];
            const sortedWTs = Object.keys(workTypes).sort();
            const subjectCount = sortedWTs.reduce((s, wt) => s + workTypes[wt].length, 0);

            return (
              <div key={subj} className="border border-gray-200 rounded-xl overflow-hidden">
                {/* Subject header */}
                <button
                  onClick={() => toggleGroup(subj)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition text-left"
                >
                  <span className="text-sm font-semibold text-gray-800">{subj}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{subjectCount}件</span>
                    <span className="text-gray-400 text-xs">{collapsedGroups[subj] ? '▶' : '▼'}</span>
                  </span>
                </button>

                {!collapsedGroups[subj] && (
                  <div className="divide-y divide-gray-100">
                    {sortedWTs.map(wt => {
                      const wtTasks = workTypes[wt];
                      const groupKey = `${subj}__${wt}`;

                      return (
                        <div key={wt}>
                          {/* WorkType sub-header */}
                          <button
                            onClick={() => toggleGroup(groupKey)}
                            className="w-full flex items-center justify-between px-4 py-2 bg-white hover:bg-gray-50 transition text-left border-b border-gray-50"
                          >
                            <span className="text-xs font-medium text-gray-600 pl-2">{wt}</span>
                            <span className="flex items-center gap-2">
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{wtTasks.length}件</span>
                              <span className="text-gray-400 text-xs">{collapsedGroups[groupKey] ? '▶' : '▼'}</span>
                            </span>
                          </button>

                          {!collapsedGroups[groupKey] && (
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-gray-100 bg-gray-50/50">
                                    <th className="text-left py-2 px-4 text-gray-500 font-medium">試験種名</th>
                                    <th className="text-left py-2 px-3 text-gray-500 font-medium">ステータス</th>
                                    <th className="text-left py-2 px-3 text-gray-500 font-medium">期限</th>
                                    <th className="text-left py-2 px-3 text-gray-500 font-medium">担当者</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                  {[...wtTasks].sort((a, b) => (a.deadline || '').localeCompare(b.deadline || '')).map(task => {
                                    const st = statusConfig[task.status] || { text: task.status, cls: 'bg-gray-100 text-gray-600' };
                                    const correctorName = getAssignedCorrectorName(task.id);
                                    return (
                                      <tr key={task.id} className="hover:bg-gray-50 transition">
                                        <td className="py-2 px-4 text-gray-800 font-medium">
                                          <div className="flex items-center gap-1">
                                            {task.name}
                                            {task.sheetsUrl && (
                                              <a href={task.sheetsUrl} target="_blank" rel="noopener noreferrer"
                                                className="text-green-500 hover:text-green-700 shrink-0">🔗</a>
                                            )}
                                          </div>
                                        </td>
                                        <td className="py-2 px-3">
                                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>{st.text}</span>
                                        </td>
                                        <td className="py-2 px-3 text-gray-600">
                                          {task.deadline ? new Date(task.deadline).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }) : '—'}
                                        </td>
                                        <td className="py-2 px-3 text-gray-700">
                                          {correctorName || <span className="text-gray-300">未割当</span>}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ---- Exam Processing Tab (試験種処理) ----
const _fmtSec = (s) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}時間${m}分`;
  if (m > 0) return `${m}分${sec}秒`;
  return `${sec}秒`;
};

const ExamProcessingTab = ({ activeSubjects }) => {
  const {
    getTasks, getAssignments, updateAssignment, getCorrectors,
    getExamInputs, getTimeLogs, getTaskTotalTime, getDaimonTotalTime,
    getRejectionCategories, getRejectionSeverities, getRejections, addRejection,
    getVerificationItems, getVerificationResults, initVerificationResults, toggleVerificationResult,
    getWorkTypes,
  } = useData();
  const { user } = useAuth();
  const workTypesList = getWorkTypes().map(wt => wt.name);

  const allTasks = getTasks();
  const tasks = allTasks.filter(t => activeSubjects.includes(t.subject));
  const assignments = getAssignments();
  const correctors = getCorrectors();

  const [reviewingId, setReviewingId] = useState(null);
  const [reviewNote, setReviewNote] = useState('');
  const [rejectionItems, setRejectionItems] = useState([]);
  const [rejItemForm, setRejItemForm] = useState({ categoryId: '', severityId: '', note: '' });
  const [message, setMessage] = useState('');
  const [verifyFilter, setVerifyFilter] = useState('all');
  const [epSubjectFilter, setEpSubjectFilter] = useState('all');
  const [epWorkTypeFilter, setEpWorkTypeFilter] = useState('all');
  const [epDateFrom, setEpDateFrom] = useState('');
  const [epDateTo, setEpDateTo] = useState('');
  const [epWorkerFilter, setEpWorkerFilter] = useState('all');
  const [showEpSearch, setShowEpSearch] = useState(false);
  const [openChecklistId, setOpenChecklistId] = useState(null);

  // 検証対象: submitted(検証待ち/検証中) + approved(検証済み)
  const allVerifiable = assignments.filter(a =>
    (a.status === 'submitted' || a.status === 'approved') && tasks.some(t => t.id === a.taskId)
  );

  const getVerifyStatus = (a) => {
    if (a.status === 'approved') return 'verified';
    if (a.verificationStatus === 'reviewing') return 'reviewing';
    return 'waiting';
  };

  const VERIFY_LABELS = { all: 'すべて', waiting: '検証待ち', reviewing: '検証中', verified: '検証済み' };
  const VERIFY_COLORS = { waiting: 'bg-yellow-100 text-yellow-700', reviewing: 'bg-blue-100 text-blue-700', verified: 'bg-green-100 text-green-700' };
  const VERIFY_BADGES = { waiting: '検証待ち', reviewing: '検証中', verified: '検証済み' };

  const filteredAssignments = allVerifiable.filter(a => {
    if (verifyFilter !== 'all' && getVerifyStatus(a) !== verifyFilter) return false;
    const task = tasks.find(t => t.id === a.taskId);
    if (epSubjectFilter !== 'all' && task?.subject !== epSubjectFilter) return false;
    if (epWorkTypeFilter !== 'all' && task?.workType !== epWorkTypeFilter) return false;
    if (epWorkerFilter !== 'all' && a.userId !== epWorkerFilter) return false;
    if (epDateFrom && a.submittedAt && a.submittedAt.slice(0, 10) < epDateFrom) return false;
    if (epDateTo && a.submittedAt && a.submittedAt.slice(0, 10) > epDateTo) return false;
    return true;
  });

  const clearEpFilters = () => {
    setEpSubjectFilter('all');
    setEpWorkTypeFilter('all');
    setEpDateFrom('');
    setEpDateTo('');
    setEpWorkerFilter('all');
  };

  const EP_CSV_COLUMNS = [
    { key: 'taskName', header: 'タスク名' },
    { key: 'subject', header: '科目' },
    { key: 'workType', header: '作業内容' },
    { key: 'correctorName', header: '担当者' },
    { key: 'actualHours', header: '実績工数' },
    { key: 'submittedAt', header: '提出日' },
    { key: 'verifyStatus', header: '検証ステータス' },
  ];

  const VERIFY_STATUS_LABEL = { waiting: '検証待ち', reviewing: '検証中', verified: '検証済み' };

  const handleExportEpCSV = () => {
    const data = filteredAssignments.map(a => {
      const task = tasks.find(t => t.id === a.taskId);
      const corrector = correctors.find(c => c.id === a.userId);
      return {
        taskName: task?.name || '',
        subject: task?.subject || '',
        workType: task?.workType || '',
        correctorName: corrector?.name || '',
        actualHours: a.actualHours ?? '',
        submittedAt: a.submittedAt ? a.submittedAt.slice(0, 10) : '',
        verifyStatus: VERIFY_STATUS_LABEL[getVerifyStatus(a)] || '',
      };
    });
    const csv = toCSV(data, EP_CSV_COLUMNS);
    downloadCSV(csv, `試験種処理_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const countByStatus = { waiting: 0, reviewing: 0, verified: 0 };
  allVerifiable.forEach(a => { countByStatus[getVerifyStatus(a)]++; });

  return (
    <div className="space-y-4">
      {message && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">
          {message}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        {/* フィルターバー */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {['all', 'waiting', 'reviewing', 'verified'].map(key => (
            <button key={key} onClick={() => setVerifyFilter(key)}
              className={`text-xs px-3 py-1.5 rounded-full transition font-medium ${
                verifyFilter === key ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {VERIFY_LABELS[key]}
              {key !== 'all' && <span className="ml-1 opacity-70">({countByStatus[key]})</span>}
              {key === 'all' && <span className="ml-1 opacity-70">({allVerifiable.length})</span>}
            </button>
          ))}
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setShowEpSearch(v => !v)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition font-medium ${showEpSearch ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
            >
              {showEpSearch ? '▲ 詳細検索' : '▼ 詳細検索'}
            </button>
            <button
              onClick={handleExportEpCSV}
              disabled={filteredAssignments.length === 0}
              className="text-xs px-3 py-1.5 rounded-lg border border-green-300 text-green-700 hover:bg-green-50 disabled:opacity-40 transition font-medium"
            >
              CSV出力
            </button>
          </div>
        </div>
        {showEpSearch && (
          <div className="mb-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">科目</label>
                <select value={epSubjectFilter} onChange={e => setEpSubjectFilter(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="all">すべて</option>
                  {SUBJECTS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">作業内容</label>
                <select value={epWorkTypeFilter} onChange={e => setEpWorkTypeFilter(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="all">すべて</option>
                  {workTypesList.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">作業者</label>
                <select value={epWorkerFilter} onChange={e => setEpWorkerFilter(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="all">すべて</option>
                  {correctors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">提出日（開始）</label>
                <input type="date" value={epDateFrom} onChange={e => setEpDateFrom(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">提出日（終了）</label>
                <input type="date" value={epDateTo} onChange={e => setEpDateTo(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="flex items-end">
                <button onClick={clearEpFilters}
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-100 transition">
                  条件クリア
                </button>
              </div>
            </div>
          </div>
        )}

        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          {verifyFilter === 'all' ? '検証対象' : VERIFY_LABELS[verifyFilter]}（{filteredAssignments.length}件）
        </h3>

        {filteredAssignments.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-4">該当するタスクはありません</p>
        ) : (
        <div className="space-y-3">
          {filteredAssignments.map(a => {
            const task = tasks.find(t => t.id === a.taskId);
            const corrector = correctors.find(c => c.id === a.userId);
            const examInputs = getExamInputs(a.taskId);
            const isReviewing = reviewingId === a.id;
            const vStatus = getVerifyStatus(a);
            return (
              <div key={a.id} className={`p-4 border rounded-xl ${
                vStatus === 'verified' ? 'bg-green-50 border-green-100' :
                vStatus === 'reviewing' ? 'bg-blue-50 border-blue-100' :
                'bg-purple-50 border-purple-100'
              }`}>
                <div className="space-y-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-800">{task?.name ?? '不明'}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${VERIFY_COLORS[vStatus]}`}>{VERIFY_BADGES[vStatus]}</span>
                      {a.rejectionCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">差し戻し回数: {a.rejectionCount}回</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      担当: <strong>{corrector?.name ?? '不明'}</strong>
                      {task?.subject && ` · ${task.subject}`}
                      {a.actualHours != null && ` · 実績: ${a.actualHours}h`}
                      {a.submittedAt && ` · 提出日: ${new Date(a.submittedAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}`}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {task?.sheetsUrl && (
                        <a href={task.sheetsUrl} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-green-600 hover:text-green-800 bg-green-50 hover:bg-green-100 px-1.5 py-0.5 rounded transition">
                          🔗 スプシ
                        </a>
                      )}
                      {examInputs.length > 0 && (
                        <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">📊 入力データあり</span>
                      )}
                    </div>
                    {/* 添付ファイル表示 */}
                    {a.attachments && a.attachments.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-gray-600 mb-1">📎 添付ファイル（{a.attachments.length}件）</p>
                        <div className="flex flex-wrap gap-1">
                          {a.attachments.map(att => (
                            <button key={att.id}
                              onClick={() => downloadAttachment(att.id, att.fileName)}
                              className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-1 rounded-lg transition border border-blue-200">
                              📥 {att.fileName} ({(att.fileSize / 1024).toFixed(0)}KB)
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* 大問別作業時間 */}
                    {(() => {
                      const totalSec = getTaskTotalTime(task?.id);
                      if (!totalSec || totalSec <= 0) return null;
                      const logs = getTimeLogs({ taskId: task.id });
                      const daimonIds = [...new Set(logs.map(l => l.daimonId))].sort((a, b) => {
                        if (a === null) return 1; if (b === null) return -1; return a - b;
                      });
                      return (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-gray-600 mb-1">⏱ 大問別作業時間</p>
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
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {vStatus === 'waiting' && (
                      <button
                        onClick={() => {
                          updateAssignment(a.id, { verificationStatus: 'reviewing' });
                          initVerificationResults(a.id, task?.subject, user?.id);
                          setOpenChecklistId(a.id);
                          setMessage('検証を開始しました');
                          setTimeout(() => setMessage(''), 3000);
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition text-sm font-medium"
                      >
                        検証開始
                      </button>
                    )}
                    {vStatus === 'reviewing' && (
                      <button
                        onClick={() => setOpenChecklistId(openChecklistId === a.id ? null : a.id)}
                        className={`px-4 py-2 rounded-xl transition text-sm font-medium ${openChecklistId === a.id ? 'bg-blue-700 text-white' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
                      >
                        {openChecklistId === a.id ? 'チェックリストを閉じる' : '検証チェックリスト'}
                      </button>
                    )}
                    {vStatus !== 'verified' && (
                    <button
                      onClick={() => {
                        // 検証チェックリストの必須項目チェック
                        const results = getVerificationResults(a.id) || [];
                        const allItems = getVerificationItems(task?.subject) || [];
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
                        updateAssignment(a.id, { status: 'approved', verificationStatus: 'verified', reviewedAt: new Date().toISOString() });
                        setOpenChecklistId(null);
                        setMessage('検証済みにしました');
                        setTimeout(() => setMessage(''), 3000);
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition text-sm font-medium"
                    >
                      承認
                    </button>
                    )}
                    {vStatus !== 'verified' && (
                    <button
                      onClick={() => { setReviewingId(isReviewing ? null : a.id); setReviewNote(''); setRejectionItems([]); }}
                      className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition text-sm font-medium"
                    >
                      差し戻し
                    </button>
                    )}
                  </div>
                </div>

                {/* 検証チェックリストパネル */}
                {openChecklistId === a.id && vStatus === 'reviewing' && (() => {
                  const results = getVerificationResults(a.id) || [];
                  const allItems = getVerificationItems(task?.subject) || [];
                  const checkedCount = results.filter(r => r.checked).length;
                  const totalCount = results.length;
                  const progress = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;

                  // グループ分け: 全科目共通 vs 科目固有
                  const commonResults = results.filter(r => {
                    const item = allItems.find(vi => vi.id === r.verificationItemId);
                    return item && !item.subject;
                  });
                  const subjectResults = results.filter(r => {
                    const item = allItems.find(vi => vi.id === r.verificationItemId);
                    return item && item.subject;
                  });

                  return (
                    <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-blue-700">検証チェックリスト</p>
                        <span className="text-xs text-blue-600">{checkedCount} / {totalCount} 完了</span>
                      </div>

                      {/* プログレスバー */}
                      <div className="w-full bg-blue-100 rounded-full h-2">
                        <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                      </div>

                      {totalCount === 0 ? (
                        <p className="text-xs text-gray-500">検証項目が登録されていません。マスタタブで追加してください。</p>
                      ) : (
                        <>
                          {/* 全科目共通 */}
                          {commonResults.length > 0 && (
                            <div>
                              <p className="text-[11px] font-semibold text-gray-500 mb-1.5">📋 全科目共通</p>
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

                          {/* 科目固有 */}
                          {subjectResults.length > 0 && (
                            <div>
                              <p className="text-[11px] font-semibold text-gray-500 mb-1.5">📝 {task?.subject}固有</p>
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
                })()}

                {isReviewing && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl space-y-3">
                    <p className="text-xs font-semibold text-red-700">差し戻し詳細を入力してください</p>

                    {/* 差し戻し項目追加フォーム */}
                    <div className="flex flex-wrap gap-2 items-end">
                      <select value={rejItemForm.categoryId}
                        onChange={e => setRejItemForm(f => ({ ...f, categoryId: e.target.value }))}
                        className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 min-w-[120px]">
                        <option value="">カテゴリ選択</option>
                        {(() => {
                          const task = tasks.find(t => t.id === a.taskId);
                          return (getRejectionCategories(task?.subject) || []).map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}{cat.subject ? ` (${cat.subject})` : ''}</option>
                          ));
                        })()}
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

                    {/* 追加済みアイテム一覧 */}
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
                                className="ml-auto text-red-400 hover:text-red-600">✕</button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* 総合コメント */}
                    <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)}
                      placeholder="総合コメント（任意）" rows={2}
                      className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2" />

                    <div className="flex gap-2 justify-end">
                      <button onClick={() => { setReviewingId(null); setReviewNote(''); setRejectionItems([]); }}
                        className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg">キャンセル</button>
                      <button onClick={() => {
                        // 未チェックの検証項目IDを取得
                        const results = getVerificationResults(a.id) || [];
                        const failedVerificationItemIds = results
                          .filter(r => !r.checked)
                          .map(r => r.verificationItemId);
                        updateAssignment(a.id, {
                          status: 'rejected',
                          verificationStatus: null,
                          reviewNote: reviewNote,
                          reviewedAt: new Date().toISOString(),
                          rejectionCount: (a.rejectionCount || 0) + 1,
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
                      }}
                        className="text-xs bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-lg transition">
                        差し戻しを確定
                      </button>
                    </div>
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


// ---- FB Categories (shared with ProgressTab) ----
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

// Helper: parse FB message to extract categories and detail
const _parseFBMessage = (message) => {
  if (!message) return { categories: [], detail: '' };
  const categories = [];
  let detail = '';
  const lines = message.split('\n');
  let inFB = false;
  let inDetail = false;
  for (const line of lines) {
    if (line.includes('【FB内容】')) { inFB = true; inDetail = false; continue; }
    if (line.includes('【詳細】')) { inDetail = true; inFB = false; continue; }
    if (inFB && line.startsWith('・')) {
      categories.push(line.slice(1).trim());
    }
    if (inDetail) {
      detail += (detail ? '\n' : '') + line;
    }
  }
  return { categories, detail: detail.trim() };
};

// ---- Corrector Evaluation Tab (作業者評価) ----
const _fmtSecEval = (sec) => {
  if (!sec || sec <= 0) return '0秒';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}時間${m}分`;
  if (m > 0) return `${m}分${s}秒`;
  return `${s}秒`;
};

const _calcDuration = (log) =>
  log.endTime ? log.duration : Math.floor((Date.now() - new Date(log.startTime).getTime()) / 1000);

const CorrectorEvaluationTab = ({ activeSubjects }) => {
  const {
    getCorrectors, getEvaluations, setEvaluation,
    getEvaluationCriteria, addEvaluationCriteria, updateEvaluationCriteria, deleteEvaluationCriteria,
    getUsers, getRejections, getRejectionCategories, getRejectionSeverities,
    getTimeLogs, getTaskTotalTime, getDaimonTotalTime,
    getTasks, getAssignments, getAllData,
    getFeedbacks,
  } = useData();

  const correctors = getCorrectors();
  const criteria = getEvaluationCriteria();
  const allEvals = getEvaluations();
  const tasks = getTasks();
  const assignments = getAssignments();
  const allTimeLogs = getTimeLogs();

  // --- Shared state ---
  const [activeEvalSection, setActiveEvalSection] = useState(null);
  const [evalSection, setEvalSection] = useState(0);
  const [selectedUser, setSelectedUser] = useState(correctors[0]?.id ?? '');
  const [critForm, setCritForm] = useState({ name: '', description: '', maxScore: 5, subject: null, autoMetric: null });
  const [editCritId, setEditCritId] = useState(null);
  const [localScores, setLocalScores] = useState({});
  const [evalSubject, setEvalSubject] = useState(null);

  // --- Sub-tab 2 filters ---
  const [logFilterUser, setLogFilterUser] = useState('');
  const [logFilterSubject, setLogFilterSubject] = useState('');
  const [logFilterStart, setLogFilterStart] = useState('');
  const [logFilterEnd, setLogFilterEnd] = useState('');

  // --- Sub-tab 3 state ---
  const [personalUser, setPersonalUser] = useState(correctors[0]?.id ?? '');

  // --- Sub-tab 4 state ---
  const [subjectDetailSubject, setSubjectDetailSubject] = useState('');
  const [daimonFilterUser, setDaimonFilterUser] = useState('');

  // --- FB集約 state ---
  const [fbSectionOpen, setFbSectionOpen] = useState(false);
  const [fbView, setFbView] = useState('byUser'); // 'byUser' | 'byCategory'
  const [fbFilterUser, setFbFilterUser] = useState('');

  // ---- Evaluation helpers ----
  const userEvals = allEvals.filter(e => e.userId === selectedUser);

  const getEvalScore = (criteriaId) => {
    const local = localScores[`${selectedUser}_${criteriaId}`];
    if (local !== undefined) return local;
    return userEvals.find(e => e.criteriaId === criteriaId)?.score ?? 0;
  };

  const handleScoreChange = (criteriaId, score) => {
    setLocalScores(prev => ({ ...prev, [`${selectedUser}_${criteriaId}`]: Number(score) }));
  };

  const handleSaveEvals = () => {
    criteria.forEach(c => {
      const key = `${selectedUser}_${c.id}`;
      if (localScores[key] !== undefined) {
        const note = userEvals.find(e => e.criteriaId === c.id)?.note ?? '';
        setEvaluation(selectedUser, c.id, localScores[key], note);
      }
    });
    setLocalScores({});
  };

  const handleCritSubmit = (e) => {
    e.preventDefault();
    if (editCritId) {
      updateEvaluationCriteria(editCritId, { ...critForm, maxScore: Number(critForm.maxScore) });
      setEditCritId(null);
    } else {
      addEvaluationCriteria({ ...critForm, maxScore: Number(critForm.maxScore) });
    }
    setCritForm({ name: '', description: '', maxScore: 5, subject: null, autoMetric: null });
  };

  const evalChartData = criteria.map(c => ({
    name: c.name,
    スコア: getEvalScore(c.id),
    最大: c.maxScore,
  }));

  const handleExportEvaluationsCSV = () => {
    const users = getUsers ? getUsers() : [];
    const data = [];
    correctors.forEach(c => {
      const uEvals = allEvals.filter(e => e.userId === c.id);
      criteria.forEach(crit => {
        const ev = uEvals.find(e => e.criteriaId === crit.id);
        data.push({
          userName: c.name,
          userLoginId: c.loginId || '',
          criteriaName: crit.name,
          score: ev?.score ?? '',
          maxScore: crit.maxScore,
          note: ev?.note || '',
        });
      });
    });
    const csv = toCSV(data, EVALUATION_CSV_COLUMNS);
    downloadCSV(csv, `評価一覧_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  // ---- Sub-tab 2: 作業時間一覧 data ----
  const filteredTimeLogs = useMemo(() => {
    let logs = [...allTimeLogs];

    if (logFilterUser) {
      logs = logs.filter(l => l.userId === logFilterUser);
    }
    if (logFilterSubject) {
      logs = logs.filter(l => {
        const task = tasks.find(t => t.id === l.taskId);
        return task?.subject === logFilterSubject;
      });
    }
    if (logFilterStart) {
      const startMs = new Date(logFilterStart).getTime();
      logs = logs.filter(l => new Date(l.startTime).getTime() >= startMs);
    }
    if (logFilterEnd) {
      const endMs = new Date(logFilterEnd).getTime() + 86400000;
      logs = logs.filter(l => new Date(l.startTime).getTime() < endMs);
    }

    return logs.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
  }, [allTimeLogs, logFilterUser, logFilterSubject, logFilterStart, logFilterEnd, tasks]);

  const totalFilteredTime = useMemo(() =>
    filteredTimeLogs.reduce((sum, l) => sum + _calcDuration(l), 0),
    [filteredTimeLogs]
  );

  // ---- Sub-tab 3: 個人別時間 data ----
  const personalData = useMemo(() => {
    if (!personalUser) return { totalTime: 0, taskCount: 0, avgTime: 0, taskBreakdown: [] };

    const userLogs = allTimeLogs.filter(l => l.userId === personalUser);
    const totalTime = userLogs.reduce((sum, l) => sum + _calcDuration(l), 0);
    const taskIds = [...new Set(userLogs.map(l => l.taskId).filter(Boolean))];
    const userAssignments = assignments.filter(a => a.userId === personalUser);

    const taskBreakdown = taskIds.map(tid => {
      const task = tasks.find(t => t.id === tid);
      const taskLogs = userLogs.filter(l => l.taskId === tid);
      const taskTime = taskLogs.reduce((sum, l) => sum + _calcDuration(l), 0);
      const asgn = userAssignments.find(a => a.taskId === tid);
      const assignedHours = asgn?.assignedHours || 0;
      const assignedSec = assignedHours * 3600;
      const efficiency = assignedSec > 0 ? Math.round((taskTime / assignedSec) * 100) : 0;

      return {
        taskId: tid,
        taskName: task?.name || '不明',
        subject: task?.subject || '-',
        workTime: taskTime,
        assignedHours,
        efficiency,
      };
    });

    return {
      totalTime,
      taskCount: taskIds.length,
      avgTime: taskIds.length > 0 ? Math.round(totalTime / taskIds.length) : 0,
      taskBreakdown,
    };
  }, [personalUser, allTimeLogs, tasks, assignments]);

  // ---- Sub-tab 4: 科目・大問別 data ----
  const subjectSummary = useMemo(() => {
    const bySubject = {};
    const totalAll = allTimeLogs.reduce((sum, l) => sum + _calcDuration(l), 0);

    allTimeLogs.forEach(l => {
      const task = tasks.find(t => t.id === l.taskId);
      const subj = task?.subject || '不明';
      if (!bySubject[subj]) bySubject[subj] = { subject: subj, totalTime: 0, taskIds: new Set() };
      bySubject[subj].totalTime += _calcDuration(l);
      if (l.taskId) bySubject[subj].taskIds.add(l.taskId);
    });

    return Object.values(bySubject).map(s => ({
      subject: s.subject,
      totalTime: s.totalTime,
      taskCount: s.taskIds.size,
      avgTime: s.taskIds.size > 0 ? Math.round(s.totalTime / s.taskIds.size) : 0,
      ratio: totalAll > 0 ? (s.totalTime / totalAll) * 100 : 0,
    })).sort((a, b) => b.totalTime - a.totalTime);
  }, [allTimeLogs, tasks]);

  const taskDaimonBreakdown = useMemo(() => {
    // Group time logs by taskId + userId
    const byTaskUser = {};
    allTimeLogs.forEach(l => {
      const key = `${l.taskId}_${l.userId}`;
      if (!byTaskUser[key]) byTaskUser[key] = { taskId: l.taskId, userId: l.userId, logs: [] };
      byTaskUser[key].logs.push(l);
    });

    return Object.values(byTaskUser).map(group => {
      const task = tasks.find(t => t.id === group.taskId);
      const totalTime = group.logs.reduce((s, l) => s + _calcDuration(l), 0);
      const daimonMap = {};
      group.logs.forEach(l => {
        const did = l.daimonId ?? 'other';
        if (!daimonMap[did]) daimonMap[did] = { daimonId: did, totalTime: 0, count: 0 };
        daimonMap[did].totalTime += _calcDuration(l);
        daimonMap[did].count += 1;
      });
      const daimons = Object.values(daimonMap).sort((a, b) => {
        if (a.daimonId === 'other') return 1;
        if (b.daimonId === 'other') return -1;
        return a.daimonId - b.daimonId;
      });
      const maxDaimon = daimons.length > 0 ? Math.max(...daimons.map(d => d.totalTime)) : 1;
      return {
        taskId: group.taskId,
        taskName: task?.name || '不明',
        subject: task?.subject || '不明',
        userId: group.userId,
        totalTime,
        daimons: daimons.map(d => ({ ...d, maxTime: maxDaimon, ratio: totalTime > 0 ? (d.totalTime / totalTime) * 100 : 0 })),
      };
    }).filter(g => g.totalTime > 0).sort((a, b) => b.totalTime - a.totalTime);
  }, [allTimeLogs, tasks]);

  const filteredTaskDaimon = useMemo(() => {
    return taskDaimonBreakdown.filter(g => {
      if (subjectDetailSubject && g.subject !== subjectDetailSubject) return false;
      if (daimonFilterUser && g.userId !== daimonFilterUser) return false;
      return true;
    });
  }, [taskDaimonBreakdown, subjectDetailSubject, daimonFilterUser]);

  // ---- Helpers ----
  const getUserName = (userId) => {
    const users = getUsers ? getUsers() : [];
    return users.find(u => u.id === userId)?.name || '不明';
  };

  const getTaskName = (taskId) => {
    return tasks.find(t => t.id === taskId)?.name || '不明';
  };

  const getTaskSubject = (taskId) => {
    return tasks.find(t => t.id === taskId)?.subject || '-';
  };

  const evalSections = [
    { key: 'eval', icon: '\u2B50', title: '\u8A55\u4FA1\u7BA1\u7406', desc: '\u8A55\u4FA1\u57FA\u6E96\u30FB\u6DFB\u524A\u8005\u8A55\u4FA1\u30FB\u4F5C\u696D\u6642\u9593' },
    { key: 'fb', icon: '\u{1F4CB}', title: 'FB\u96C6\u7D04\u30FB\u5206\u6790', desc: '\u30D5\u30A3\u30FC\u30C9\u30D0\u30C3\u30AF\u306E\u96C6\u7D04\u30FB\u30AB\u30C6\u30B4\u30EA\u5206\u6790' },
  ];

  return (
    <div className="space-y-4">
      {/* Button menu */}
      {!activeEvalSection && (
        <div className="grid grid-cols-2 gap-3 p-4">
          {evalSections.map(s => (
            <button key={s.key} onClick={() => setActiveEvalSection(s.key)}
              className="p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition text-left">
              <span className="text-2xl">{s.icon}</span>
              <p className="font-medium text-gray-800 mt-1">{s.title}</p>
              <p className="text-xs text-gray-500">{s.desc}</p>
            </button>
          ))}
        </div>
      )}

      {activeEvalSection && (
        <div>
          <button onClick={() => setActiveEvalSection(null)} className="mb-3 text-sm text-gray-500 hover:text-gray-700">
            ← 戻る
          </button>

      {/* ===== Section: 評価管理 ===== */}
      {activeEvalSection === 'eval' && (
        <div className="space-y-4">
      {/* Sub-tab navigation */}
      <div className="flex gap-1 mb-4 flex-wrap">
        {['\u8A55\u4FA1\u57FA\u6E96', '\u6DFB\u524A\u8005\u8A55\u4FA1', '\u4F5C\u696D\u6642\u9593\u4E00\u89A7', '\u500B\u4EBA\u5225\u6642\u9593', '\u79D1\u76EE\u30FB\u5927\u554F\u5225'].map((label, i) => (
          <button key={i} onClick={() => setEvalSection(i)}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${evalSection === i ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ======== Sub-tab 0: 評価基準 ======== */}
      {evalSection === 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">評価基準の管理</h3>
            <button onClick={handleExportEvaluationsCSV} className="text-xs bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg transition">CSV出力</button>
          </div>
          <form onSubmit={handleCritSubmit} className="flex flex-wrap gap-2 mb-3">
            <input
              type="text" placeholder="基準名" value={critForm.name}
              onChange={e => setCritForm({ ...critForm, name: e.target.value })}
              className="flex-1 min-w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
            <input
              type="text" placeholder="説明" value={critForm.description}
              onChange={e => setCritForm({ ...critForm, description: e.target.value })}
              className="flex-1 min-w-40 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">最大</span>
              <input
                type="number" min="1" max="100" value={critForm.maxScore}
                onChange={e => setCritForm({ ...critForm, maxScore: e.target.value })}
                className="w-16 px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <span className="text-xs text-gray-500">点</span>
            </div>
            <select value={critForm.subject || ''} onChange={e => setCritForm({ ...critForm, subject: e.target.value || null })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="">全科目共通</option>
              {SUBJECTS_LIST.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select value={critForm.autoMetric || ''} onChange={e => setCritForm({ ...critForm, autoMetric: e.target.value || null })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="">手動評価</option>
              <option value="rejection_rate">差し戻し率</option>
              <option value="severity_score">重大度スコア</option>
              <option value="work_time">作業時間</option>
              <option value="task_count">タスク完了数</option>
            </select>
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg transition">
              {editCritId ? '更新' : '追加'}
            </button>
            {editCritId && (
              <button type="button" onClick={() => { setEditCritId(null); setCritForm({ name: '', description: '', maxScore: 5, subject: null, autoMetric: null }); }}
                className="text-sm text-gray-500 border border-gray-200 px-3 py-2 rounded-lg transition">
                キャンセル
              </button>
            )}
          </form>
          <div className="flex flex-wrap gap-2">
            {criteria.map(c => (
              <div key={c.id} className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg text-sm">
                <span className="font-medium text-gray-700">{c.name}</span>
                <span className="text-gray-400 text-xs">({c.description}) / {c.maxScore}点</span>
                {c.subject && <span className="text-xs ml-1 px-1.5 py-0.5 rounded bg-blue-100 text-blue-600">{c.subject}</span>}
                {c.autoMetric && <span className="text-xs ml-1 px-1.5 py-0.5 rounded bg-green-100 text-green-600">
                  {c.autoMetric === 'rejection_rate' ? '自動:差し戻し率' :
                   c.autoMetric === 'severity_score' ? '自動:重大度' :
                   c.autoMetric === 'work_time' ? '自動:作業時間' :
                   c.autoMetric === 'task_count' ? '自動:タスク数' : ''}
                </span>}
                <button onClick={() => { setEditCritId(c.id); setCritForm({ name: c.name, description: c.description, maxScore: c.maxScore, subject: c.subject || null, autoMetric: c.autoMetric || null }); }}
                  className="text-blue-500 hover:text-blue-700 text-xs">編集</button>
                <button onClick={() => { if (confirm(`「${c.name}」を削除しますか？`)) deleteEvaluationCriteria(c.id); }}
                  className="text-red-400 hover:text-red-600 text-xs">×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======== Sub-tab 1: 添削者評価 ======== */}
      {evalSection === 1 && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">添削者評価の入力</h3>
          {/* 科目フィルタ */}
          <div className="flex gap-1 mb-3 flex-wrap">
            <button onClick={() => setEvalSubject(null)}
              className={`text-xs px-3 py-1 rounded-full transition ${evalSubject === null ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              全科目
            </button>
            {SUBJECTS_LIST.map(s => (
              <button key={s} onClick={() => setEvalSubject(s)}
                className={`text-xs px-3 py-1 rounded-full transition ${evalSubject === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {s}
              </button>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap mb-4">
            {correctors.map(c => (
              <button
                key={c.id}
                onClick={() => { setSelectedUser(c.id); setLocalScores({}); }}
                className={`text-sm px-3 py-1.5 rounded-lg border transition ${selectedUser === c.id ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
              >
                {c.name}
              </button>
            ))}
          </div>

          {selectedUser && (
            <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-xl">
              <h5 className="text-xs font-semibold text-gray-600 mb-2">自動計算メトリクス{evalSubject ? ` (${evalSubject})` : ' (全科目)'}</h5>
              {(() => {
                const metrics = calcAllMetrics(selectedUser, evalSubject, getAllData());
                return (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                      <div className="bg-white rounded-lg p-2 text-center">
                        <p className="text-xs text-gray-500">差し戻し率</p>
                        <p className="text-lg font-bold text-gray-800">{(metrics.rejectionRate * 100).toFixed(1)}%</p>
                      </div>
                      <div className="bg-white rounded-lg p-2 text-center">
                        <p className="text-xs text-gray-500">差し戻し数</p>
                        <p className="text-lg font-bold text-gray-800">{metrics.rejectionCount}件</p>
                      </div>
                      <div className="bg-white rounded-lg p-2 text-center">
                        <p className="text-xs text-gray-500">重大度スコア</p>
                        <p className="text-lg font-bold text-gray-800">{metrics.severityScore.toFixed(2)}</p>
                      </div>
                      <div className="bg-white rounded-lg p-2 text-center">
                        <p className="text-xs text-gray-500">完了タスク</p>
                        <p className="text-lg font-bold text-gray-800">{metrics.taskCount}件</p>
                      </div>
                    </div>
                    {metrics.averageWorkTimeByWorkType.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-1">平均作業時間（業務種別）</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {metrics.averageWorkTimeByWorkType.map(wt => (
                            <div key={wt.workType} className="bg-white rounded-lg p-2 text-center">
                              <p className="text-xs text-gray-500">{wt.workType}</p>
                              <p className="text-base font-bold text-gray-800">{formatDuration(wt.avgTime)}</p>
                              <p className="text-[10px] text-gray-400">{wt.taskCount}タスク</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {selectedUser && criteria.length > 0 && (
            <>
              {evalChartData.length > 0 && (
                <div className="mb-4">
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={evalChartData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="スコア" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="最大" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="space-y-3">
                {criteria.map(c => {
                  const score = getEvalScore(c.id);
                  return (
                    <div key={c.id} className="flex items-center gap-3">
                      <div className="w-32 shrink-0">
                        <p className="text-sm font-medium text-gray-700">{c.name}</p>
                        <p className="text-xs text-gray-400">{c.description}</p>
                      </div>
                      <input
                        type="range" min="0" max={c.maxScore} step="1"
                        value={score}
                        onChange={e => handleScoreChange(c.id, e.target.value)}
                        className="flex-1 accent-blue-600"
                      />
                      <span className="w-12 text-right text-sm font-semibold text-blue-600">{score} / {c.maxScore}</span>
                      {c.autoMetric && (() => {
                        const metrics = calcAllMetrics(selectedUser, evalSubject, getAllData());
                        const allCorrectors = correctors;
                        const allVals = allCorrectors.map(cr => {
                          const m = calcAllMetrics(cr.id, evalSubject, getAllData());
                          return c.autoMetric === 'rejection_rate' ? m.rejectionRate :
                                 c.autoMetric === 'severity_score' ? m.severityScore :
                                 c.autoMetric === 'work_time' ? m.averageWorkTime :
                                 m.taskCount;
                        });
                        const val = c.autoMetric === 'rejection_rate' ? metrics.rejectionRate :
                                    c.autoMetric === 'severity_score' ? metrics.severityScore :
                                    c.autoMetric === 'work_time' ? metrics.averageWorkTime :
                                    metrics.taskCount;
                        const autoScore = normalizeMetricToScore(c.autoMetric, val, c.maxScore, allVals);
                        return (
                          <p className="text-xs text-green-600 mt-1">
                            自動算出: {autoScore} / {c.maxScore}
                          </p>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
              {Object.keys(localScores).some(k => k.startsWith(selectedUser)) && (
                <button onClick={handleSaveEvals} className="mt-4 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition">
                  保存する
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* ======== Sub-tab 2: 作業時間一覧 ======== */}
      {evalSection === 2 && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">作業時間一覧</h3>

          {/* Filter row */}
          <div className="flex flex-wrap gap-2 mb-4">
            <select
              value={logFilterUser}
              onChange={e => setLogFilterUser(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">全作業者</option>
              {correctors.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              value={logFilterSubject}
              onChange={e => setLogFilterSubject(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">全科目</option>
              {SUBJECTS_LIST.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">開始日</span>
              <input
                type="date" value={logFilterStart}
                onChange={e => setLogFilterStart(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">終了日</span>
              <input
                type="date" value={logFilterEnd}
                onChange={e => setLogFilterEnd(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500">作業者</th>
                  <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500">タスク名</th>
                  <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500">科目</th>
                  <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500">大問</th>
                  <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500">開始時刻</th>
                  <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500">終了時刻</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500">作業時間</th>
                </tr>
              </thead>
              <tbody>
                {filteredTimeLogs.map(log => (
                  <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-2 text-gray-700">{getUserName(log.userId)}</td>
                    <td className="py-2 px-2 text-gray-700">{getTaskName(log.taskId)}</td>
                    <td className="py-2 px-2 text-gray-600">{getTaskSubject(log.taskId)}</td>
                    <td className="py-2 px-2 text-gray-600">{log.daimonId || '-'}</td>
                    <td className="py-2 px-2 text-gray-500 text-xs">{log.startTime ? new Date(log.startTime).toLocaleString('ja-JP') : '-'}</td>
                    <td className="py-2 px-2 text-gray-500 text-xs">
                      {log.endTime ? new Date(log.endTime).toLocaleString('ja-JP') : (
                        <span className="text-green-600 font-medium">計測中</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-right font-medium text-gray-800">{_fmtSecEval(_calcDuration(log))}</td>
                  </tr>
                ))}
                {filteredTimeLogs.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-8 text-gray-400">データがありません</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Summary footer */}
          {filteredTimeLogs.length > 0 && (
            <div className="mt-3 flex gap-4 items-center text-sm">
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <span className="text-gray-600">合計作業時間: </span>
                <span className="font-bold text-blue-700">{_fmtSecEval(totalFilteredTime)}</span>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <span className="text-gray-600">件数: </span>
                <span className="font-bold text-gray-700">{filteredTimeLogs.length}件</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======== Sub-tab 3: 個人別時間 ======== */}
      {evalSection === 3 && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">個人別作業時間</h3>

          {/* Corrector selector */}
          <div className="flex gap-2 flex-wrap mb-4">
            {correctors.map(c => (
              <button
                key={c.id}
                onClick={() => setPersonalUser(c.id)}
                className={`text-sm px-3 py-1.5 rounded-lg border transition ${personalUser === c.id ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
              >
                {c.name}
              </button>
            ))}
          </div>

          {personalUser && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">合計作業時間</p>
                  <p className="text-xl font-bold text-blue-700">{_fmtSecEval(personalData.totalTime)}</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">タスク数</p>
                  <p className="text-xl font-bold text-green-700">{personalData.taskCount}件</p>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">平均時間/件</p>
                  <p className="text-xl font-bold text-purple-700">{_fmtSecEval(personalData.avgTime)}</p>
                </div>
              </div>

              {/* Per-task table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500">タスク名</th>
                      <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500">科目</th>
                      <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500">作業時間</th>
                      <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500">割当工数</th>
                      <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500">効率%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {personalData.taskBreakdown.map(row => (
                      <tr key={row.taskId} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-2 text-gray-700 font-medium">{row.taskName}</td>
                        <td className="py-2 px-2 text-gray-600">{row.subject}</td>
                        <td className="py-2 px-2 text-right text-gray-800">{_fmtSecEval(row.workTime)}</td>
                        <td className="py-2 px-2 text-right text-gray-600">{row.assignedHours > 0 ? `${row.assignedHours}h` : '-'}</td>
                        <td className="py-2 px-2 text-right">
                          {row.assignedHours > 0 ? (
                            <span className={`font-semibold ${row.efficiency <= 100 ? 'text-green-600' : 'text-orange-600'}`}>
                              {row.efficiency}%
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {personalData.taskBreakdown.length === 0 && (
                      <tr><td colSpan={5} className="text-center py-8 text-gray-400">データがありません</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ======== Sub-tab 4: 科目・大問別 ======== */}
      {evalSection === 4 && (
        <div className="space-y-4">
          {/* 科目別集計 */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">科目別集計</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500">科目</th>
                    <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500">合計時間</th>
                    <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500">タスク数</th>
                    <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500">平均時間/件</th>
                    <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500">割合</th>
                    <th className="py-2 px-2 text-xs font-semibold text-gray-500 w-40"></th>
                  </tr>
                </thead>
                <tbody>
                  {subjectSummary.map(row => (
                    <tr key={row.subject} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-2 font-medium text-gray-700">{row.subject}</td>
                      <td className="py-2 px-2 text-right text-gray-800">{_fmtSecEval(row.totalTime)}</td>
                      <td className="py-2 px-2 text-right text-gray-600">{row.taskCount}件</td>
                      <td className="py-2 px-2 text-right text-gray-600">{_fmtSecEval(row.avgTime)}</td>
                      <td className="py-2 px-2 text-right text-gray-600">{row.ratio.toFixed(1)}%</td>
                      <td className="py-2 px-2">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full transition-all"
                            style={{ width: `${Math.min(row.ratio, 100)}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {subjectSummary.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-8 text-gray-400">データがありません</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 試験種別・大問別内訳 */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">試験種別・大問別内訳</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              <select
                value={subjectDetailSubject}
                onChange={e => setSubjectDetailSubject(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">全科目</option>
                {SUBJECTS_LIST.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select
                value={daimonFilterUser}
                onChange={e => setDaimonFilterUser(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">全作業者</option>
                {correctors.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <span className="text-xs text-gray-400 self-center ml-1">{filteredTaskDaimon.length}件</span>
            </div>

            {filteredTaskDaimon.length > 0 ? (
              <div className="space-y-3">
                {filteredTaskDaimon.map(group => {
                  const COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#ef4444', '#10b981', '#ec4899', '#6366f1'];
                  return (
                    <div key={`${group.taskId}_${group.userId}`} className="p-4 border border-gray-200 rounded-xl bg-gray-50 hover:bg-gray-100 transition">
                      <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-800">{group.taskName}</span>
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{group.subject}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">担当: <strong>{getUserName(group.userId)}</strong></span>
                          <span className="text-xs font-semibold text-gray-700 bg-white px-2 py-0.5 rounded-lg border">合計 {_fmtSecEval(group.totalTime)}</span>
                        </div>
                      </div>
                      {/* 大問別バー */}
                      <div className="space-y-1.5">
                        {group.daimons.map((d, idx) => (
                          <div key={d.daimonId} className="flex items-center gap-2">
                            <span className="w-16 text-xs font-medium text-gray-600 shrink-0 text-right">
                              {d.daimonId === 'other' ? 'その他' : `大問${d.daimonId}`}
                            </span>
                            <div className="flex-1 bg-gray-200 rounded-full h-5 relative overflow-hidden">
                              <div
                                className="h-5 rounded-full transition-all flex items-center justify-end pr-2"
                                style={{
                                  width: `${Math.max((d.totalTime / d.maxTime) * 100, 8)}%`,
                                  backgroundColor: COLORS[idx % COLORS.length],
                                }}
                              >
                                <span className="text-xs text-white font-medium whitespace-nowrap">{_fmtSecEval(d.totalTime)}</span>
                              </div>
                            </div>
                            <span className="w-12 text-right text-xs text-gray-500 shrink-0">{d.ratio.toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center py-8 text-gray-400 text-sm">大問別のデータがありません</p>
            )}
          </div>
        </div>
      )}

        </div>
      )}

      {/* ===== Section: FB集約・分析 ===== */}
      {activeEvalSection === 'fb' && (
      <div className="border border-amber-200 rounded-xl overflow-hidden">
        <div className="w-full flex items-center justify-between px-5 py-3 bg-amber-50">
          <span className="text-sm font-semibold text-amber-800">FB集約・分析</span>
        </div>

        {(() => {
          const allFeedbacks = getFeedbacks();
          const getTaskName = (tid) => tasks.find(t => t.id === tid)?.name || '不明';

          // Parse all feedbacks
          const parsed = allFeedbacks.map(fb => ({
            ...fb,
            ..._parseFBMessage(fb.message),
            taskName: getTaskName(fb.taskId),
            toUserName: getUserName(fb.toUserId),
          })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

          // Category aggregation
          const categoryStats = {};
          FB_CATEGORIES.forEach(cat => {
            categoryStats[cat.label] = { label: cat.label, count: 0, users: new Set() };
          });
          parsed.forEach(fb => {
            fb.categories.forEach(catText => {
              const matched = FB_CATEGORIES.find(c => catText.includes(c.label.split('. ')[0]));
              const key = matched ? matched.label : catText;
              if (!categoryStats[key]) categoryStats[key] = { label: key, count: 0, users: new Set() };
              categoryStats[key].count++;
              categoryStats[key].users.add(fb.toUserName);
            });
          });
          const categorySorted = Object.values(categoryStats)
            .filter(c => c.count > 0)
            .sort((a, b) => b.count - a.count);

          // User-filtered feedbacks
          const userFeedbacks = fbFilterUser
            ? parsed.filter(fb => fb.toUserId === fbFilterUser)
            : parsed;

          // Most common category for selected user
          const userCatCount = {};
          userFeedbacks.forEach(fb => {
            fb.categories.forEach(cat => {
              userCatCount[cat] = (userCatCount[cat] || 0) + 1;
            });
          });
          const mostCommonCats = Object.entries(userCatCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);

          return (
            <div className="p-5 bg-white space-y-4">
              {/* View toggle */}
              <div className="flex gap-2">
                <button
                  onClick={() => setFbView('byUser')}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${fbView === 'byUser' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'}`}
                >
                  作業者別
                </button>
                <button
                  onClick={() => setFbView('byCategory')}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${fbView === 'byCategory' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'}`}
                >
                  カテゴリ別
                </button>
              </div>

              {/* View 1: 作業者別FB一覧 */}
              {fbView === 'byUser' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <select
                      value={fbFilterUser}
                      onChange={e => setFbFilterUser(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                    >
                      <option value="">全作業者</option>
                      {correctors.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <span className="text-xs text-gray-500">
                      {userFeedbacks.length}件のFB
                    </span>
                  </div>

                  {/* Summary */}
                  {fbFilterUser && mostCommonCats.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-amber-800 mb-1">よく指摘されるカテゴリ</p>
                      <ul className="text-xs text-amber-700 space-y-0.5">
                        {mostCommonCats.map(([cat, cnt]) => (
                          <li key={cat}>・{cat}（{cnt}件）</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* FB list */}
                  {userFeedbacks.length > 0 ? (
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {userFeedbacks.map(fb => (
                        <div key={fb.id} className="border border-amber-100 rounded-lg p-3 bg-amber-50/30 hover:bg-amber-50 transition">
                          <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-medium text-gray-500">
                                {fb.createdAt ? new Date(fb.createdAt).toLocaleDateString('ja-JP') : '-'}
                              </span>
                              <span className="text-xs font-semibold text-gray-700">{fb.taskName}</span>
                            </div>
                            <span className="text-xs text-amber-700 font-medium">{fb.toUserName}</span>
                          </div>
                          {fb.categories.length > 0 && (
                            <ul className="text-xs text-gray-600 mb-1 space-y-0.5 ml-2">
                              {fb.categories.map((cat, i) => (
                                <li key={i} className="flex items-start gap-1">
                                  <span className="text-amber-500 mt-0.5">●</span>
                                  <span>{cat}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                          {fb.detail && (
                            <p className="text-xs text-gray-500 mt-1 pl-2 border-l-2 border-amber-200">{fb.detail}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center py-8 text-gray-400 text-sm">FBデータがありません</p>
                  )}
                </div>
              )}

              {/* View 2: カテゴリ別集計 */}
              {fbView === 'byCategory' && (
                <div>
                  {categorySorted.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-amber-200">
                            <th className="text-left py-2 px-2 text-xs font-semibold text-amber-700">カテゴリ</th>
                            <th className="text-right py-2 px-2 text-xs font-semibold text-amber-700 w-20">件数</th>
                            <th className="text-left py-2 px-2 text-xs font-semibold text-amber-700">該当作業者</th>
                          </tr>
                        </thead>
                        <tbody>
                          {categorySorted.map(row => (
                            <tr key={row.label} className="border-b border-amber-50 hover:bg-amber-50 transition">
                              <td className="py-2 px-2 text-xs text-gray-700">{row.label}</td>
                              <td className="py-2 px-2 text-right">
                                <span className="inline-block bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-xs font-semibold">
                                  {row.count}
                                </span>
                              </td>
                              <td className="py-2 px-2 text-xs text-gray-600">
                                {[...row.users].join('、')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-center py-8 text-gray-400 text-sm">FBデータがありません</p>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </div>
      )}

        </div>
      )}
    </div>
  );
};


// ---- User Management Tab ----
const UserManagementTab = ({ activeSubjects }) => {
  const { getUsers, getCorrectors, addUser, updateUser, deleteUser, resetUserPassword, getFields, getUserFields, bulkImportUserFields, bulkSetUserFields, addUserField, removeUserField } = useData();
  const correctors = getCorrectors();

  const [activeUserSection, setActiveUserSection] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', loginId: '', employeeId: '', subjects: [] });
  const [editId, setEditId] = useState(null);
  const [editSubjectsId, setEditSubjectsId] = useState(null);
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [error, setError] = useState('');
  const [generatedPw, setGeneratedPw] = useState(null);
  const [generatedPwUser, setGeneratedPwUser] = useState('');
  const [generatedPwLoginId, setGeneratedPwLoginId] = useState('');
  const [fieldCsvPreview, setFieldCsvPreview] = useState(null);
  const [expandedFieldUserId, setExpandedFieldUserId] = useState(null);

  const handleExportCSV = () => {
    const data = correctors.map(c => ({
      name: c.name,
      employeeId: c.employeeId || '',
      loginId: c.loginId || '',
      email: c.email || '',
      role: c.role === 'leader' ? 'リーダー' : '添削者',
      subjects: (c.subjects || []).join('；'),
    }));
    const csv = toCSV(data, USER_CSV_COLUMNS);
    downloadCSV(csv, `作業者一覧_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  // CSV import
  const [csvPreview, setCsvPreview] = useState(null);
  const [csvErrors, setCsvErrors] = useState([]);

  const handleImportCSV = async () => {
    try {
      const { rows } = await importCSVFile();
      const { valid, errors } = validateUserCSV(rows);
      setCsvErrors(errors);
      setCsvPreview(valid);
    } catch (e) {
      setCsvErrors([e.message]);
    }
  };

  const handleConfirmImport = () => {
    let count = 0;
    const passwords = [];
    csvPreview.forEach(u => {
      const result = addUser({
        name: u.name,
        employeeId: u.employeeId || null,
        loginId: u.loginId || undefined,
        email: u.email,
        role: u.role,
        subjects: u.subjects,
      });
      if (result) {
        count++;
        passwords.push({ name: u.name, loginId: result.loginId, pw: result._tempPassword });
      }
    });
    setCsvPreview(null);
    setCsvErrors([]);
    if (count > 0) {
      setGeneratedPw(passwords.map(p => `${p.name}(${p.loginId}): ${p.pw}`).join('\n'));
      setGeneratedPwUser(`${count}名のインポート`);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (editId) {
      updateUser(editId, { name: form.name, email: form.email, employeeId: form.employeeId || null });
      setEditId(null);
    } else {
      const existing = getCorrectors().find(u => u.email === form.email);
      if (existing) { setError('このメールアドレスは既に使用されています'); return; }
      if (form.loginId) {
        const allUsers = getCorrectors().concat(getUsers().filter(u => u.role === 'leader'));
        const dupLoginId = allUsers.find(u => u.loginId === form.loginId);
        if (dupLoginId) { setError('このログインIDは既に使用されています'); return; }
      }
      if (form.employeeId && !/^N\d{8}$/.test(form.employeeId)) {
        setError('管理IDは N+8桁の数字 (例: N00000001) の形式にしてください'); return;
      }
      const result = addUser({ ...form, employeeId: form.employeeId || null, loginId: form.loginId || undefined, role: 'corrector', subjects: form.subjects || [] });
      setGeneratedPw(result._tempPassword);
      setGeneratedPwUser(form.name);
      setGeneratedPwLoginId(result.loginId);
    }
    setForm({ name: '', email: '', loginId: '', employeeId: '', subjects: [] });
  };

  const handleResetPassword = (userId, userName) => {
    if (!confirm(`「${userName}」のパスワードをリセットしますか?`)) return;
    const tempPw = resetUserPassword(userId);
    if (tempPw) {
      setGeneratedPw(tempPw);
      setGeneratedPwUser(userName);
    }
  };

  const handleSaveSubjects = (userId) => {
    updateUser(userId, { subjects: selectedSubjects });
    setEditSubjectsId(null);
  };

  const toggleSubject = (s) => {
    setSelectedSubjects(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  };

  // Subject badge colors
  const subjectColor = { '国語': 'bg-rose-50 text-rose-700', '算数': 'bg-blue-50 text-blue-700', '理科': 'bg-green-50 text-green-700', '社会': 'bg-amber-50 text-amber-700' };

  const userSections = [
    { key: 'list', icon: '\u{1F465}', title: '\u4F5C\u696D\u8005\u4E00\u89A7', desc: '\u767B\u9332\u6E08\u307F\u4F5C\u696D\u8005\u306E\u78BA\u8A8D\u30FB\u7DE8\u96C6' },
    { key: 'add', icon: '\u2795', title: '\u4F5C\u696D\u8005\u8FFD\u52A0', desc: '\u65B0\u3057\u3044\u4F5C\u696D\u8005\u3092\u500B\u5225\u306B\u8FFD\u52A0' },
    { key: 'csv', icon: '\u{1F4C4}', title: 'CSV\u4E00\u62EC\u767B\u9332', desc: 'CSV\u30D5\u30A1\u30A4\u30EB\u3067\u4E00\u62EC\u767B\u9332' },
    { key: 'field', icon: '\u{1F52C}', title: '\u5206\u91CE\u7814\u4FEE\u30AF\u30EA\u30A2\u7BA1\u7406', desc: '\u5206\u91CE\u7814\u4FEE\u30AF\u30EA\u30A2\u72B6\u6CC1\u306E\u7BA1\u7406' },
  ];

  return (
    <div className="space-y-4">
      {/* Button menu */}
      {!activeUserSection && (
        <div className="grid grid-cols-2 gap-3 p-4">
          {userSections.map(s => (
            <button key={s.key} onClick={() => setActiveUserSection(s.key)}
              className="p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition text-left">
              <span className="text-2xl">{s.icon}</span>
              <p className="font-medium text-gray-800 mt-1">{s.title}</p>
              <p className="text-xs text-gray-500">{s.desc}</p>
            </button>
          ))}
        </div>
      )}

      {activeUserSection && (
        <div>
          <button onClick={() => setActiveUserSection(null)} className="mb-3 text-sm text-gray-500 hover:text-gray-700">
            ← 戻る
          </button>

      {/* ===== Section: 作業者追加 ===== */}
      {activeUserSection === 'add' && (
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">{editId ? '\u6DFB\u524A\u8005\u3092\u7DE8\u96C6' : '\u6DFB\u524A\u8005\u3092\u8FFD\u52A0'}</h3>
        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <input
              type="text" placeholder="氏名" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="flex-1 min-w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
            <input
              type="email" placeholder="メールアドレス" value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              className="flex-1 min-w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
            <input
              type="text" placeholder="管理ID (N+8桁)" value={form.employeeId}
              onChange={e => setForm({ ...form, employeeId: e.target.value })}
              className="flex-1 min-w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono"
              maxLength={9}
            />
            <input
              type="text" placeholder="ログインID（空欄で自動生成）" value={form.loginId}
              onChange={e => setForm({ ...form, loginId: e.target.value })}
              className="flex-1 min-w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          {!editId && (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs text-gray-500">担当科目:</span>
              {SUBJECTS_LIST.filter(s => s !== 'マクロ').map(s => (
                <label key={s} className="flex items-center gap-1 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(form.subjects || []).includes(s)}
                    onChange={e => {
                      const subjects = form.subjects || [];
                      setForm({ ...form, subjects: e.target.checked ? [...subjects, s] : subjects.filter(x => x !== s) });
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className={`text-xs px-1.5 py-0.5 rounded ${subjectColor[s] || 'bg-gray-50 text-gray-700'}`}>{s}</span>
                </label>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg transition">
              {editId ? '更新' : '追加'}
            </button>
            {editId && (
              <button type="button" onClick={() => { setEditId(null); setForm({ name: '', email: '', loginId: '', employeeId: '', subjects: [] }); }}
                className="text-sm text-gray-500 border border-gray-200 px-3 py-2 rounded-lg transition">
                キャンセル
              </button>
            )}
          </div>
        </form>
        {!editId && <p className="text-xs text-gray-400 mt-2">* パスワードは自動生成されます。追加後に表示されるパスワードを作業者に共有してください。</p>}
        {error && <p className="text-red-500 text-xs mt-2">{error}</p>}

        {/* 生成されたパスワード表示 */}
        {generatedPw && (
          <div className="mt-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  {generatedPwUser}{generatedPwLoginId ? ` (${generatedPwLoginId})` : ''} の初期パスワード
                </p>
                <p className="text-lg font-mono font-bold text-amber-900 mt-1 select-all">{generatedPw}</p>
                <p className="text-xs text-amber-600 mt-1">
                  このパスワードを作業者に共有してください。初回ログイン時にパスワード変更が求められます。
                </p>
              </div>
              <button
                onClick={() => { navigator.clipboard?.writeText(generatedPw); }}
                className="text-xs bg-amber-200 hover:bg-amber-300 text-amber-800 px-3 py-1.5 rounded-lg transition shrink-0 ml-3"
              >
                コピー
              </button>
            </div>
            <button onClick={() => setGeneratedPw(null)} className="text-xs text-amber-500 hover:text-amber-700 mt-2">
              閉じる
            </button>
          </div>
        )}
      </div>
      )}

      {/* ===== Section: CSV一括登録 ===== */}
      {activeUserSection === 'csv' && (
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">CSV一括登録</h3>
        <div className="flex gap-2 mt-3">
          <button onClick={handleExportCSV}
            className="text-xs bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg transition">
            📤 CSV エクスポート
          </button>
          <button onClick={handleImportCSV}
            className="text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-3 py-1.5 rounded-lg transition">
            📥 CSV インポート
          </button>
          <button onClick={() => {
            const templateData = [
              { name: '\u5C71\u7530 \u592A\u90CE', employeeId: 'N00000001', loginId: 'T001', email: 'yamada@test.com', role: '\u6DFB\u524A\u8005', subjects: '\u56FD\u8A9E\uFF1B\u7B97\u6570' },
              { name: '\u9234\u6728 \u82B1\u5B50', employeeId: 'N00000002', loginId: '', email: 'suzuki@test.com', role: '\u6DFB\u524A\u8005', subjects: '\u7406\u79D1' },
            ];
            const csv = toCSV(templateData, USER_CSV_COLUMNS);
            downloadCSV(csv, '作業者一括登録テンプレート.csv');
          }}
            className="text-xs bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg transition">
            📄 テンプレートCSVダウンロード
          </button>
        </div>

        {/* 生成されたパスワード表示（CSV登録時） */}
        {generatedPw && (
          <div className="mt-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  {generatedPwUser}{generatedPwLoginId ? ` (${generatedPwLoginId})` : ''} の初期パスワード
                </p>
                <p className="text-lg font-mono font-bold text-amber-900 mt-1 select-all">{generatedPw}</p>
                <p className="text-xs text-amber-600 mt-1">
                  このパスワードを作業者に共有してください。初回ログイン時にパスワード変更が求められます。
                </p>
              </div>
              <button
                onClick={() => { navigator.clipboard?.writeText(generatedPw); }}
                className="text-xs bg-amber-200 hover:bg-amber-300 text-amber-800 px-3 py-1.5 rounded-lg transition shrink-0 ml-3"
              >
                コピー
              </button>
            </div>
            <button onClick={() => setGeneratedPw(null)} className="text-xs text-amber-500 hover:text-amber-700 mt-2">
              閉じる
            </button>
          </div>
        )}
        {csvPreview && (
          <div className="mt-3 p-4 bg-purple-50 border border-purple-200 rounded-xl">
            <h4 className="text-sm font-bold text-purple-800 mb-2">📥 CSVインポート プレビュー（{csvPreview.length}件）</h4>
            {csvErrors.length > 0 && (
              <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                {csvErrors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
              </div>
            )}
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {csvPreview.map((u, i) => (
                <div key={i} className="text-xs flex items-center gap-2 bg-white rounded p-2">
                  <span className="font-mono text-purple-600">{u.loginId || '自動'}</span>
                  {u.employeeId && <span className="font-mono text-green-600">{u.employeeId}</span>}
                  <span className="font-medium">{u.name}</span>
                  <span className="text-gray-400">{u.email}</span>
                  <span className="text-gray-400">{(u.subjects || []).join('・')}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-3 justify-end">
              <button onClick={() => { setCsvPreview(null); setCsvErrors([]); }}
                className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg">キャンセル</button>
              <button onClick={handleConfirmImport} disabled={csvPreview.length === 0}
                className="text-xs bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white px-3 py-1.5 rounded-lg transition">
                {csvPreview.length}名を登録する
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* ===== Section: 分野研修クリア管理 ===== */}
      {activeUserSection === 'field' && (
      <div className="bg-white rounded-xl shadow-sm border p-5">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">🔬 分野研修クリア管理</h4>
        <button
          onClick={async () => {
            try {
              const { rows } = await importCSVFile();
              const allFields = getFields();
              const allUsers = getUsers();
              const result = validateFieldClearanceCSV(rows, allFields, allUsers);
              setFieldCsvPreview(result);
            } catch (e) {
              setFieldCsvPreview({ valid: [], errors: [e.message], summary: { userCount: 0, fieldCount: 0 } });
            }
          }}
          className="text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-3 py-1.5 rounded-lg transition"
        >
          📥 分野クリアCSVインポート
        </button>
        <p className="text-xs text-gray-400 mt-2">CSVフォーマット: 1列目にログインIDまたは氏名、2列目以降に分野名をヘッダに記載し、クリア済みセルに「○」「1」等を入力</p>

        {fieldCsvPreview && (
          <div className="mt-3 p-4 bg-purple-50 border border-purple-200 rounded-xl">
            <h4 className="text-sm font-bold text-purple-800 mb-2">📥 分野クリアCSV プレビュー</h4>
            <p className="text-xs text-purple-700 mb-2">ユーザー{fieldCsvPreview.summary.userCount}名、分野{fieldCsvPreview.summary.fieldCount}件</p>
            {fieldCsvPreview.errors.length > 0 && (
              <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                {fieldCsvPreview.errors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
              </div>
            )}
            {fieldCsvPreview.valid.length > 0 && (
              <div className="space-y-1 max-h-40 overflow-y-auto mb-3">
                {fieldCsvPreview.valid.map((entry, i) => (
                  <div key={i} className="text-xs flex items-center gap-2 bg-white rounded p-2">
                    <span className="font-medium text-gray-700">{entry.userName}</span>
                    <span className="text-purple-600">{entry.fieldName}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setFieldCsvPreview(null)}
                className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg">キャンセル</button>
              <button
                onClick={() => {
                  bulkImportUserFields(fieldCsvPreview.valid.map(e => ({ userId: e.userId, fieldId: e.fieldId })));
                  setFieldCsvPreview(null);
                }}
                disabled={fieldCsvPreview.valid.length === 0}
                className="text-xs bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white px-3 py-1.5 rounded-lg transition"
              >
                {fieldCsvPreview.valid.length}件を登録する
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* ===== Section: 作業者一覧 ===== */}
      {activeUserSection === 'list' && (
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">添削者一覧（{correctors.length}人）</h3>
        {correctors.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-6">添削者がいません</p>
        ) : (
          <div className="space-y-3">
            {correctors.map(c => {
              const mySubjects = c.subjects ?? [];
              return (
                <div key={c.id} className="p-3 border border-gray-200 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{c.name} <span className="text-xs font-mono text-blue-500">{c.loginId}</span>{c.employeeId && <span className="text-xs font-mono text-green-600 ml-1">{c.employeeId}</span>}</p>
                      <p className="text-xs text-gray-400">{c.email}</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditId(c.id); setForm({ name: c.name, email: c.email, loginId: c.loginId || '', employeeId: c.employeeId || '' }); }}
                        className="text-xs text-blue-500 hover:bg-blue-50 px-2 py-1 rounded transition">編集</button>
                      <button onClick={() => handleResetPassword(c.id, c.name)}
                        className="text-xs text-amber-500 hover:bg-amber-50 px-2 py-1 rounded transition">PW リセット</button>
                      <button onClick={() => { if (confirm(`「${c.name}」を削除しますか？`)) deleteUser(c.id); }}
                        className="text-xs text-red-400 hover:bg-red-50 px-2 py-1 rounded transition">削除</button>
                      <button onClick={() => setExpandedFieldUserId(expandedFieldUserId === c.id ? null : c.id)}
                        className={`text-xs px-2 py-1 rounded transition ${expandedFieldUserId === c.id ? 'bg-purple-100 text-purple-700' : 'text-purple-500 hover:bg-purple-50'}`}>分野</button>
                    </div>
                  </div>

                  {/* 分野研修クリア管理（展開式） */}
                  {expandedFieldUserId === c.id && (() => {
                    const userFields = getUserFields(c.id);
                    const subjects = c.subjects ?? [];
                    const allFields = getFields();
                    const relevantSubjects = subjects.length > 0 ? subjects : SUBJECTS_LIST;
                    return (
                      <div className="mt-2 p-3 bg-purple-50 rounded-lg">
                        <p className="text-xs font-medium text-purple-700 mb-2">分野研修クリア状況</p>
                        {relevantSubjects.map(subj => {
                          const subjectFields = allFields.filter(f => f.subject === subj);
                          if (subjectFields.length === 0) return null;
                          return (
                            <div key={subj} className="mb-2">
                              <p className="text-xs font-semibold text-gray-600 mb-1">{subj}の分野</p>
                              <div className="flex flex-wrap gap-1">
                                {subjectFields.map(field => {
                                  const isCleared = userFields.some(uf => uf.fieldId === field.id);
                                  return (
                                    <button key={field.id}
                                      onClick={() => isCleared ? removeUserField(c.id, field.id) : addUserField(c.id, field.id)}
                                      className={`text-xs px-2 py-1 rounded-lg border transition ${isCleared ? 'bg-green-100 text-green-700 border-green-300' : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'}`}
                                    >
                                      {field.name} {isCleared ? '✓' : ''}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                        {allFields.length === 0 && (
                          <p className="text-xs text-gray-400">分野マスタが登録されていません。マスタタブから分野を追加してください。</p>
                        )}
                      </div>
                    );
                  })()}

                  {/* 担当科目表示 */}
                  <div>
                    <div className="flex flex-wrap gap-1 mb-1">
                      {mySubjects.length === 0
                        ? <span className="text-xs text-gray-400">担当科目未設定</span>
                        : mySubjects.map(s => (
                          <span key={s} className={`text-xs px-2 py-0.5 rounded-full font-medium ${subjectColor[s] ?? 'bg-gray-100 text-gray-600'}`}>{s}</span>
                        ))
                      }
                    </div>
                    {editSubjectsId === c.id ? (
                      <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs font-medium text-gray-600 mb-2">担当科目を選択</p>
                        <div className="flex flex-wrap gap-2">
                          {SUBJECTS_LIST.map(s => (
                            <button
                              key={s}
                              onClick={() => toggleSubject(s)}
                              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition ${selectedSubjects.includes(s) ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-100'}`}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => handleSaveSubjects(c.id)} className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg transition">保存</button>
                          <button onClick={() => setEditSubjectsId(null)} className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg transition">キャンセル</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditSubjectsId(c.id); setSelectedSubjects([...mySubjects]); }}
                        className="text-xs text-blue-500 hover:text-blue-700 mt-1"
                      >
                        担当科目を編集
                      </button>
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
      )}
    </div>
  );
};

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

// ---- Master Data Tab ----
const MasterDataTab = ({ activeSubjects }) => {
  const { getRejectionCategories, addRejectionCategory, updateRejectionCategory, deleteRejectionCategory, getRejectionSeverities, addRejectionSeverity, updateRejectionSeverity, deleteRejectionSeverity, getVerificationItems, addVerificationItem, updateVerificationItem, deleteVerificationItem, getFields, addField, updateField, deleteField, getWorkTypes, addWorkType, deleteWorkType, getManuals, addManual, updateManual, deleteManual } = useData();
  const workTypesList = getWorkTypes().map(wt => wt.name);
  const [catForm, setCatForm] = useState({ name: '', description: '', subject: null, workType: null });
  const [sevForm, setSevForm] = useState({ name: '', level: 1, description: '', color: '#f59e0b' });
  const [editCatId, setEditCatId] = useState(null);
  const [editSevId, setEditSevId] = useState(null);
  const [viForm, setViForm] = useState({ name: '', description: '', subject: null, sortOrder: 1, isRequired: false, purpose: 'verification', workType: null });
  const [editViId, setEditViId] = useState(null);
  const [fieldForm, setFieldForm] = useState({ name: '', subject: '理科', category: null, sortOrder: 1 });
  const [editFieldId, setEditFieldId] = useState(null);
  const [bulkFieldInput, setBulkFieldInput] = useState('');
  const [showBulkFieldForm, setShowBulkFieldForm] = useState(false);
  const [bulkFieldSubject, setBulkFieldSubject] = useState('理科');
  const [bulkFieldCategory, setBulkFieldCategory] = useState(null);
  const [bulkFieldResult, setBulkFieldResult] = useState(null);
  const [activeMasterSection, setActiveMasterSection] = useState(null);
  const [wtForm, setWtForm] = useState({ name: '', sortOrder: 1 });
  const [manualForm, setManualForm] = useState({ title: '', type: 'url', url: '', content: '', subject: null, workType: null, sortOrder: 1 });
  const [editManualId, setEditManualId] = useState(null);
  const [manualFile, setManualFile] = useState(null);

  // CSV一括登録（分野）
  const [showFieldCsvImport, setShowFieldCsvImport] = useState(false);
  const [fieldCsvText, setFieldCsvText] = useState('');
  const [fieldCsvParsed, setFieldCsvParsed] = useState(null);
  const [fieldCsvImportDone, setFieldCsvImportDone] = useState(null);

  const handleFieldCsvParse = (text) => {
    setFieldCsvText(text);
    setFieldCsvImportDone(null);
    if (!text.trim()) { setFieldCsvParsed(null); return; }
    let csvText = text;
    if (!text.includes(',') && text.includes('\t')) {
      csvText = text.split('\n').map(line => line.split('\t').map(cell => {
        const trimmed = cell.trim();
        if (trimmed.includes(',') || trimmed.includes('"') || trimmed.includes('\n')) return '"' + trimmed.replace(/"/g, '""') + '"';
        return trimmed;
      }).join(',')).join('\n');
    }
    const { rows } = parseCSV(csvText);
    if (rows.length === 0) { setFieldCsvParsed({ valid: [], errors: [{ line: 0, message: 'データ行がありません', row: {} }] }); return; }
    const result = validateFieldMasterCSV(rows, { subjects: ['理科', '算数'] });
    setFieldCsvParsed(result);
  };

  const handleFieldCsvFile = async () => {
    try {
      const { headers, rows } = await importCSVFile();
      const csvText = [headers.join(','), ...rows.map(r => headers.map(h => r[h] ?? '').join(','))].join('\n');
      setFieldCsvText(csvText);
      handleFieldCsvParse(csvText);
    } catch (err) {
      // user cancelled or error
    }
  };

  const handleFieldCsvImportConfirm = () => {
    if (!fieldCsvParsed || fieldCsvParsed.valid.length === 0) return;
    let count = 0;
    fieldCsvParsed.valid.forEach((row, idx) => {
      const existingFields = getFields(row.subject) || [];
      const maxOrder = existingFields.length > 0 ? Math.max(...existingFields.map(f => f.sortOrder || 0)) : 0;
      addField({ name: row.name, subject: row.subject, category: row.category, sortOrder: maxOrder + idx + 1 });
      count++;
    });
    setFieldCsvImportDone(`${count}件の分野を登録しました`);
    setFieldCsvParsed(null);
    setFieldCsvText('');
  };

  const handleDownloadFieldTemplate = () => {
    const templateData = [
      { name: '中和', subject: '理科', category: '化学' },
      { name: '割合の線分図', subject: '算数', category: '' },
    ];
    const csv = toCSV(templateData, FIELD_MASTER_CSV_COLUMNS);
    downloadCSV(csv, '分野一括登録テンプレート.csv');
  };

  const masterSections = [
    { key: 'rejection', icon: '\u{1F504}', title: '\u5DEE\u3057\u623B\u3057\u30AB\u30C6\u30B4\u30EA', desc: '\u5DEE\u3057\u623B\u3057\u9805\u76EE\u306E\u7BA1\u7406' },
    { key: 'severity', icon: '\u26A0\uFE0F', title: '\u5DEE\u3057\u623B\u3057\u91CD\u5927\u5EA6', desc: '\u91CD\u5927\u5EA6\u30EC\u30D9\u30EB\u306E\u7BA1\u7406' },
    { key: 'checklist', icon: '\u2705', title: '\u30C1\u30A7\u30C3\u30AF\u30EA\u30B9\u30C8', desc: '\u63D0\u51FA\u524D\u30FB\u691C\u8A3C\u30C1\u30A7\u30C3\u30AF\u9805\u76EE' },
    { key: 'field', icon: '\u{1F4DA}', title: '\u5206\u91CE\u30DE\u30B9\u30BF', desc: '\u7406\u79D1\u30FB\u7B97\u6570\u306E\u5206\u91CE\u7BA1\u7406' },
    { key: 'worktype', icon: '\u{1F527}', title: '\u4F5C\u696D\u7A2E\u30DE\u30B9\u30BF', desc: '\u4F5C\u696D\u7A2E\uFF08\u4F5C\u696D\u5185\u5BB9\uFF09\u306E\u7BA1\u7406' },
    { key: 'manual', icon: '\u{1F4D6}', title: '\u4F5C\u696D\u8005\u5411\u3051\u30DE\u30CB\u30E5\u30A2\u30EB', desc: 'URL\u30FB\u30D5\u30A1\u30A4\u30EB\u30FB\u30C6\u30AD\u30B9\u30C8\u306E\u30DE\u30CB\u30E5\u30A2\u30EB\u7BA1\u7406' },
  ];

  return (
    <div className="space-y-4">
      {/* Button menu */}
      {!activeMasterSection && (
        <div className="grid grid-cols-2 gap-3 p-4">
          {masterSections.map(s => (
            <button key={s.key} onClick={() => setActiveMasterSection(s.key)}
              className="p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition text-left">
              <span className="text-2xl">{s.icon}</span>
              <p className="font-medium text-gray-800 mt-1">{s.title}</p>
              <p className="text-xs text-gray-500">{s.desc}</p>
            </button>
          ))}
        </div>
      )}

      {activeMasterSection && (
        <div>
          <button onClick={() => setActiveMasterSection(null)} className="mb-3 text-sm text-gray-500 hover:text-gray-700">
            ← 戻る
          </button>

      {/* ===== Section: 差し戻しカテゴリ ===== */}
      {activeMasterSection === 'rejection' && (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">🔄 差し戻し項目の管理</h4>
        <p className="text-xs text-gray-500 mb-3">科目・作業内容ごとに差し戻し項目を設定できます。</p>
        <div className="flex flex-wrap gap-2 mb-3">
          <select value={catForm.subject || ''}
            onChange={e => setCatForm({ ...catForm, subject: e.target.value || null })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">全科目共通</option>
            {(activeSubjects || SUBJECTS_LIST).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select value={catForm.workType || ''}
            onChange={e => setCatForm({ ...catForm, workType: e.target.value || null })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">全作業種（共通）</option>
            {workTypesList.map(w => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
          <input type="text" placeholder="項目名" value={catForm.name}
            onChange={e => setCatForm({ ...catForm, name: e.target.value })}
            className="flex-1 min-w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <input type="text" placeholder="説明" value={catForm.description}
            onChange={e => setCatForm({ ...catForm, description: e.target.value })}
            className="flex-1 min-w-40 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <button onClick={() => {
            if (!catForm.name.trim()) return;
            if (editCatId) {
              updateRejectionCategory(editCatId, catForm);
              setEditCatId(null);
            } else {
              addRejectionCategory(catForm);
            }
            setCatForm({ name: '', description: '', subject: null, workType: null });
          }}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg transition">
            {editCatId ? '更新' : '追加'}
          </button>
          {editCatId && (
            <button onClick={() => { setEditCatId(null); setCatForm({ name: '', description: '', subject: null, workType: null }); }}
              className="text-sm text-gray-500 border border-gray-200 px-3 py-2 rounded-lg">キャンセル</button>
          )}
        </div>
        {/* グループ別表示: 科目 → 作業内容 */}
        {(() => {
          const allCats = getRejectionCategories() || [];
          if (allCats.length === 0) return <p className="text-xs text-gray-400">差し戻し項目が登録されていません</p>;

          const subjectGroups = {};
          allCats.forEach(cat => {
            const sKey = cat.subject || '全科目共通';
            if (!subjectGroups[sKey]) subjectGroups[sKey] = [];
            subjectGroups[sKey].push(cat);
          });
          const sortedSubjects = Object.keys(subjectGroups).sort((a, b) => {
            if (a === '全科目共通') return -1;
            if (b === '全科目共通') return 1;
            return a.localeCompare(b);
          });

          return sortedSubjects.map(subjectKey => {
            const cats = subjectGroups[subjectKey];
            const workTypeGroups = {};
            cats.forEach(cat => {
              const wKey = cat.workType || '全作業種';
              if (!workTypeGroups[wKey]) workTypeGroups[wKey] = [];
              workTypeGroups[wKey].push(cat);
            });
            const sortedWorkTypes = Object.keys(workTypeGroups).sort((a, b) => {
              if (a === '全作業種') return -1;
              if (b === '全作業種') return 1;
              return a.localeCompare(b);
            });

            return (
              <div key={subjectKey} className="mb-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${subjectKey === '全科目共通' ? 'bg-gray-100 text-gray-600' : 'bg-blue-50 text-blue-700'}`}>
                    {subjectKey}
                  </span>
                  <span className="text-xs text-gray-400">{cats.length}件</span>
                </div>
                {sortedWorkTypes.map(wtKey => (
                  <div key={wtKey} className="mb-1 ml-2">
                    {wtKey !== '全作業種' && (
                      <span className="text-[10px] text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded mb-0.5 inline-block">{wtKey}</span>
                    )}
                    <div className="space-y-1">
                      {workTypeGroups[wtKey].map(cat => (
                        <div key={cat.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-sm font-medium truncate">{cat.name}</span>
                            {cat.description && <span className="text-xs text-gray-400 truncate hidden sm:inline">{cat.description}</span>}
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <button onClick={() => { setEditCatId(cat.id); setCatForm({ name: cat.name, description: cat.description || '', subject: cat.subject, workType: cat.workType || null }); }}
                              className="text-xs text-blue-500 hover:bg-blue-50 px-2 py-1 rounded">編集</button>
                            <button onClick={() => deleteRejectionCategory(cat.id)}
                              className="text-xs text-red-400 hover:bg-red-50 px-2 py-1 rounded">削除</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          });
        })()}
      </div>
      )}

      {/* ===== Section: 差し戻し重大度 ===== */}
      {activeMasterSection === 'severity' && (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">⚠️ 差し戻し重大度の管理</h4>
        <div className="flex flex-wrap gap-2 mb-3">
          <input type="text" placeholder="レベル名" value={sevForm.name}
            onChange={e => setSevForm({ ...sevForm, name: e.target.value })}
            className="flex-1 min-w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <input type="number" placeholder="レベル値" value={sevForm.level} min="1" max="10"
            onChange={e => setSevForm({ ...sevForm, level: Number(e.target.value) })}
            className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <input type="text" placeholder="説明" value={sevForm.description}
            onChange={e => setSevForm({ ...sevForm, description: e.target.value })}
            className="flex-1 min-w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <input type="color" value={sevForm.color}
            onChange={e => setSevForm({ ...sevForm, color: e.target.value })}
            className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer" />
          <button onClick={() => {
            if (!sevForm.name.trim()) return;
            if (editSevId) {
              updateRejectionSeverity(editSevId, sevForm);
              setEditSevId(null);
            } else {
              addRejectionSeverity(sevForm);
            }
            setSevForm({ name: '', level: 1, description: '', color: '#f59e0b' });
          }}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg transition">
            {editSevId ? '更新' : '追加'}
          </button>
          {editSevId && (
            <button onClick={() => { setEditSevId(null); setSevForm({ name: '', level: 1, description: '', color: '#f59e0b' }); }}
              className="text-sm text-gray-500 border border-gray-200 px-3 py-2 rounded-lg">キャンセル</button>
          )}
        </div>
        <div className="space-y-1">
          {(getRejectionSeverities() || []).sort((a, b) => a.level - b.level).map(sev => (
            <div key={sev.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-2">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full inline-block" style={{ backgroundColor: sev.color }}></span>
                <span className="text-sm font-medium">{sev.name}</span>
                <span className="text-xs text-gray-500">レベル {sev.level}</span>
                <span className="text-xs text-gray-400">{sev.description}</span>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setEditSevId(sev.id); setSevForm({ name: sev.name, level: sev.level, description: sev.description, color: sev.color }); }}
                  className="text-xs text-blue-500 hover:bg-blue-50 px-2 py-1 rounded">編集</button>
                <button onClick={() => deleteRejectionSeverity(sev.id)}
                  className="text-xs text-red-400 hover:bg-red-50 px-2 py-1 rounded">削除</button>
              </div>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* ===== Section: 分野マスタ ===== */}
      {activeMasterSection === 'field' && (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">📚 分野マスタの管理</h4>
        <p className="text-xs text-gray-500 mb-3">理科・算数の分野を管理します。VIKINGタスクの分野制限に使用します。</p>
        <div className="flex flex-wrap gap-2 mb-3">
          <select value={fieldForm.subject}
            onChange={e => setFieldForm({ ...fieldForm, subject: e.target.value, category: e.target.value === '理科' ? fieldForm.category : null })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="理科">理科</option>
            <option value="算数">算数</option>
          </select>
          {fieldForm.subject === '理科' && (
            <select value={fieldForm.category || ''}
              onChange={e => setFieldForm({ ...fieldForm, category: e.target.value || null })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="">カテゴリを選択</option>
              <option value="化学">化学</option>
              <option value="物理">物理</option>
              <option value="生物">生物</option>
              <option value="地学">地学</option>
            </select>
          )}
          <input type="text" placeholder="分野名" value={fieldForm.name}
            onChange={e => setFieldForm({ ...fieldForm, name: e.target.value })}
            className="flex-1 min-w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <input type="number" placeholder="表示順" value={fieldForm.sortOrder} min="1" max="99"
            onChange={e => setFieldForm({ ...fieldForm, sortOrder: Number(e.target.value) })}
            className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm" title="表示順" />
          <button onClick={() => {
            if (!fieldForm.name.trim()) return;
            if (editFieldId) {
              updateField(editFieldId, fieldForm);
              setEditFieldId(null);
            } else {
              addField(fieldForm);
            }
            setFieldForm({ name: '', subject: fieldForm.subject, category: fieldForm.subject === '理科' ? fieldForm.category : null, sortOrder: 1 });
          }}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg transition">
            {editFieldId ? '更新' : '追加'}
          </button>
          {editFieldId && (
            <button onClick={() => { setEditFieldId(null); setFieldForm({ name: '', subject: '理科', category: null, sortOrder: 1 }); }}
              className="text-sm text-gray-500 border border-gray-200 px-3 py-2 rounded-lg">キャンセル</button>
          )}
          <button onClick={() => { setShowBulkFieldForm(!showBulkFieldForm); setBulkFieldResult(null); }}
            className={`text-sm px-3 py-2 rounded-lg transition border ${showBulkFieldForm ? 'bg-orange-50 text-orange-700 border-orange-200' : 'text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
            一括登録
          </button>
          <button onClick={() => { setShowFieldCsvImport(!showFieldCsvImport); setFieldCsvImportDone(null); }}
            className={`text-sm px-3 py-2 rounded-lg transition border ${showFieldCsvImport ? 'bg-green-600 text-white border-green-600' : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'}`}>
            {showFieldCsvImport ? '▲ CSV一括登録を閉じる' : 'CSV一括登録'}
          </button>
        </div>

        {showBulkFieldForm && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-3">
            <h5 className="text-sm font-semibold text-orange-700 mb-2">一括登録</h5>
            <div className="flex flex-wrap gap-2 mb-2">
              <select value={bulkFieldSubject}
                onChange={e => { setBulkFieldSubject(e.target.value); if (e.target.value !== '理科') setBulkFieldCategory(null); }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="理科">理科</option>
                <option value="算数">算数</option>
              </select>
              {bulkFieldSubject === '理科' && (
                <select value={bulkFieldCategory || ''}
                  onChange={e => setBulkFieldCategory(e.target.value || null)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="">カテゴリを選択</option>
                  <option value="化学">化学</option>
                  <option value="物理">物理</option>
                  <option value="生物">生物</option>
                  <option value="地学">地学</option>
                </select>
              )}
            </div>
            <textarea
              value={bulkFieldInput}
              onChange={e => setBulkFieldInput(e.target.value)}
              placeholder="分野名を1行に1つずつ入力してください&#10;例：&#10;力のつりあい&#10;電流と磁界&#10;化学変化"
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono mb-2 focus:ring-2 focus:ring-orange-400 outline-none"
            />
            <div className="flex items-center gap-3">
              <button onClick={() => {
                const lines = bulkFieldInput.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                if (lines.length === 0) return;
                const existingFields = getFields(bulkFieldSubject) || [];
                const maxOrder = existingFields.length > 0 ? Math.max(...existingFields.map(f => f.sortOrder || 0)) : 0;
                let count = 0;
                lines.forEach((name, idx) => {
                  addField({ name, subject: bulkFieldSubject, category: bulkFieldSubject === '理科' ? bulkFieldCategory : null, sortOrder: maxOrder + idx + 1 });
                  count++;
                });
                setBulkFieldResult(count);
                setBulkFieldInput('');
              }}
                className="bg-orange-600 hover:bg-orange-700 text-white text-sm px-4 py-2 rounded-lg transition">
                一括追加
              </button>
              {bulkFieldResult !== null && (
                <span className="text-sm text-green-600 font-medium">{bulkFieldResult}件 追加しました</span>
              )}
            </div>
          </div>
        )}

        {showFieldCsvImport && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-3">
            <h5 className="text-sm font-semibold text-green-700 mb-2">CSV一括登録</h5>
            <p className="text-xs text-gray-500 mb-2">
              CSV形式で分野を一括登録できます。ヘッダ行: 分野名,科目,カテゴリ
            </p>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={handleFieldCsvFile}
                className="text-sm px-3 py-1.5 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition font-medium"
              >
                CSVファイルを選択
              </button>
              <button
                type="button"
                onClick={handleDownloadFieldTemplate}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition font-medium"
              >
                テンプレートDL
              </button>
              <span className="text-xs text-gray-400 self-center">または下のテキストエリアに貼り付け</span>
            </div>
            <textarea
              value={fieldCsvText}
              onChange={e => handleFieldCsvParse(e.target.value)}
              rows={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-green-400 outline-none mb-2"
              placeholder={`分野名,科目,カテゴリ\n中和,理科,化学\n割合の線分図,算数,`}
            />

            {fieldCsvParsed && (
              <div className="space-y-2">
                <div className="flex gap-3 text-xs font-medium">
                  <span className="text-green-700">有効: {fieldCsvParsed.valid.length}件</span>
                  <span className="text-red-600">エラー: {fieldCsvParsed.errors.length}件</span>
                </div>

                {fieldCsvParsed.errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-32 overflow-y-auto">
                    {fieldCsvParsed.errors.map((err, i) => (
                      <p key={i} className="text-xs text-red-600">{err.line}行目: {err.message}</p>
                    ))}
                  </div>
                )}

                {fieldCsvParsed.valid.length > 0 && (
                  <div className="overflow-x-auto max-h-48 overflow-y-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="px-2 py-1 text-left border border-gray-200">行</th>
                          <th className="px-2 py-1 text-left border border-gray-200">分野名</th>
                          <th className="px-2 py-1 text-left border border-gray-200">科目</th>
                          <th className="px-2 py-1 text-left border border-gray-200">カテゴリ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fieldCsvParsed.valid.map((row, i) => (
                          <tr key={i} className="bg-green-50/50 hover:bg-green-100/50">
                            <td className="px-2 py-1 border border-gray-200 text-gray-400">{row._line}</td>
                            <td className="px-2 py-1 border border-gray-200">{row.name}</td>
                            <td className="px-2 py-1 border border-gray-200">{row.subject}</td>
                            <td className="px-2 py-1 border border-gray-200 text-gray-500">{row.category || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {fieldCsvParsed.valid.length > 0 && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleFieldCsvImportConfirm}
                      className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
                    >
                      一括登録（{fieldCsvParsed.valid.length}件）
                    </button>
                    <button
                      type="button"
                      onClick={() => { setFieldCsvParsed(null); setFieldCsvText(''); }}
                      className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 px-4 py-2 rounded-lg transition"
                    >
                      クリア
                    </button>
                  </div>
                )}
              </div>
            )}

            {fieldCsvImportDone && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm font-medium mt-2">
                {fieldCsvImportDone}
              </div>
            )}
          </div>
        )}

        {/* グループ別表示: 科目 → カテゴリ */}
        {(() => {
          const allFields = getFields() || [];

          if (allFields.length === 0) {
            return <p className="text-xs text-gray-400">分野が登録されていません</p>;
          }

          return ['理科', '算数'].map(subject => {
            const subjectFields = allFields.filter(f => f.subject === subject);
            if (subjectFields.length === 0) return null;

            return (
              <div key={subject} className="mb-4">
                <div className={`inline-block text-xs font-semibold px-3 py-1 rounded-full border mb-2 ${subject === '理科' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                  {subject}（{subjectFields.length}件）
                </div>
                {subject === '理科' ? (
                  (() => {
                    const categoryGroups = {};
                    subjectFields.forEach(item => {
                      const cKey = item.category || '未分類';
                      if (!categoryGroups[cKey]) categoryGroups[cKey] = [];
                      categoryGroups[cKey].push(item);
                    });
                    const categoryOrder = ['化学', '物理', '生物', '地学', '未分類'];
                    const sortedCategories = Object.keys(categoryGroups).sort((a, b) => {
                      const ai = categoryOrder.indexOf(a);
                      const bi = categoryOrder.indexOf(b);
                      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
                    });

                    return sortedCategories.map(catKey => (
                      <div key={catKey} className="mb-2 ml-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            {catKey}
                          </span>
                        </div>
                        <div className="space-y-1 ml-2">
                          {categoryGroups[catKey].sort((a, b) => a.sortOrder - b.sortOrder).map(item => (
                            <div key={item.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-2">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="text-sm flex-shrink-0 w-6 text-center text-gray-400">{item.sortOrder}</span>
                                <span className="text-sm font-medium truncate">{item.name}</span>
                                <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded-full flex-shrink-0">{item.category}</span>
                              </div>
                              <div className="flex gap-1 flex-shrink-0">
                                <button onClick={() => { setEditFieldId(item.id); setFieldForm({ name: item.name, subject: item.subject, category: item.category || null, sortOrder: item.sortOrder }); }}
                                  className="text-xs text-blue-500 hover:bg-blue-50 px-2 py-1 rounded">編集</button>
                                <button onClick={() => deleteField(item.id)}
                                  className="text-xs text-red-400 hover:bg-red-50 px-2 py-1 rounded">削除</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ));
                  })()
                ) : (
                  <div className="space-y-1 ml-2">
                    {subjectFields.sort((a, b) => a.sortOrder - b.sortOrder).map(item => (
                      <div key={item.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-sm flex-shrink-0 w-6 text-center text-gray-400">{item.sortOrder}</span>
                          <span className="text-sm font-medium truncate">{item.name}</span>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={() => { setEditFieldId(item.id); setFieldForm({ name: item.name, subject: item.subject, category: item.category || null, sortOrder: item.sortOrder }); }}
                            className="text-xs text-blue-500 hover:bg-blue-50 px-2 py-1 rounded">編集</button>
                          <button onClick={() => deleteField(item.id)}
                            className="text-xs text-red-400 hover:bg-red-50 px-2 py-1 rounded">削除</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          });
        })()}
      </div>
      )}

      {/* ===== Section: 作業種マスタ ===== */}
      {activeMasterSection === 'worktype' && (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">🔧 作業種マスタの管理</h4>
        <p className="text-xs text-gray-500 mb-3">タスクの作業種（作業内容）を管理します。差し戻し項目やチェックリストの絞り込みに使用します。</p>
        <div className="flex flex-wrap gap-2 mb-3">
          <input type="text" placeholder="作業種名" value={wtForm.name}
            onChange={e => setWtForm({ ...wtForm, name: e.target.value })}
            className="flex-1 min-w-40 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <input type="number" placeholder="表示順" value={wtForm.sortOrder} min="1" max="99"
            onChange={e => setWtForm({ ...wtForm, sortOrder: Number(e.target.value) })}
            className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm" title="表示順" />
          <button onClick={() => {
            if (!wtForm.name.trim()) return;
            addWorkType({ name: wtForm.name.trim(), sortOrder: wtForm.sortOrder });
            setWtForm({ name: '', sortOrder: (getWorkTypes().length || 0) + 1 });
          }}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg transition">
            追加
          </button>
        </div>
        <div className="space-y-1">
          {getWorkTypes().length === 0 ? (
            <p className="text-xs text-gray-400">作業種が登録されていません</p>
          ) : (
            getWorkTypes().map(wt => (
              <div key={wt.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-sm flex-shrink-0 w-6 text-center text-gray-400">{wt.sortOrder}</span>
                  <span className="text-sm font-medium truncate">{wt.name}</span>
                </div>
                <button onClick={() => deleteWorkType(wt.id)}
                  className="text-xs text-red-400 hover:bg-red-50 px-2 py-1 rounded">削除</button>
              </div>
            ))
          )}
        </div>
      </div>
      )}

      {/* ===== Section: マニュアル管理 ===== */}
      {activeMasterSection === 'manual' && (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">{'\u{1F4D6}'} 作業者向けマニュアルの管理</h4>
        <p className="text-xs text-gray-500 mb-3">URL・ファイル・テキスト形式のマニュアルを登録できます。科目・作業内容ごとに設定可能です。</p>
        <div className="flex flex-wrap gap-2 mb-3">
          <input type="text" placeholder="タイトル" value={manualForm.title}
            onChange={e => setManualForm({ ...manualForm, title: e.target.value })}
            className="flex-1 min-w-40 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <select value={manualForm.type}
            onChange={e => { setManualForm({ ...manualForm, type: e.target.value, url: '', content: '' }); setManualFile(null); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="url">URL</option>
            <option value="file">ファイル</option>
            <option value="text">テキスト</option>
          </select>
          <select value={manualForm.subject || ''}
            onChange={e => setManualForm({ ...manualForm, subject: e.target.value || null })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">全科目共通</option>
            {(activeSubjects || SUBJECTS_LIST).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select value={manualForm.workType || ''}
            onChange={e => setManualForm({ ...manualForm, workType: e.target.value || null })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">全作業種共通</option>
            {workTypesList.map(w => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
          <input type="number" placeholder="表示順" value={manualForm.sortOrder} min="1" max="99"
            onChange={e => setManualForm({ ...manualForm, sortOrder: Number(e.target.value) })}
            className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm" title="表示順" />
        </div>
        {/* 種類別入力 */}
        {manualForm.type === 'url' && (
          <div className="mb-3">
            <input type="url" placeholder="https://..." value={manualForm.url}
              onChange={e => setManualForm({ ...manualForm, url: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
        )}
        {manualForm.type === 'file' && (
          <div className="mb-3">
            <input type="file" accept=".pdf,.doc,.docx"
              onChange={e => setManualFile(e.target.files[0] || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            {manualFile && (
              <p className="text-xs text-gray-500 mt-1">{manualFile.name} ({(manualFile.size / 1024).toFixed(1)} KB)</p>
            )}
          </div>
        )}
        {manualForm.type === 'text' && (
          <div className="mb-3">
            <textarea placeholder="マニュアル内容を入力..." value={manualForm.content}
              onChange={e => setManualForm({ ...manualForm, content: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-y" />
          </div>
        )}
        <div className="flex gap-2 mb-4">
          <button onClick={async () => {
            if (!manualForm.title.trim()) return;
            if (manualForm.type === 'url' && !manualForm.url.trim()) return;
            if (manualForm.type === 'text' && !manualForm.content.trim()) return;
            if (manualForm.type === 'file' && !manualFile && !editManualId) return;

            let fileAttachmentId = null;
            let fileName = null;
            let fileSize = null;

            if (manualForm.type === 'file' && manualFile) {
              const meta = await saveAttachment({
                assignmentId: 'manual',
                fileName: manualFile.name,
                fileSize: manualFile.size,
                fileType: manualFile.type,
                blob: manualFile,
              });
              fileAttachmentId = meta.id;
              fileName = manualFile.name;
              fileSize = manualFile.size;
            }

            const manualData = {
              title: manualForm.title.trim(),
              type: manualForm.type,
              url: manualForm.type === 'url' ? manualForm.url.trim() : null,
              content: manualForm.type === 'text' ? manualForm.content.trim() : null,
              fileAttachmentId: manualForm.type === 'file' ? (fileAttachmentId || (editManualId ? undefined : null)) : null,
              fileName: manualForm.type === 'file' ? (fileName || (editManualId ? undefined : null)) : null,
              fileSize: manualForm.type === 'file' ? (fileSize || (editManualId ? undefined : null)) : null,
              subject: manualForm.subject,
              workType: manualForm.workType,
              sortOrder: manualForm.sortOrder,
            };

            // Remove undefined values (keep existing file data on edit without new file)
            Object.keys(manualData).forEach(k => manualData[k] === undefined && delete manualData[k]);

            if (editManualId) {
              updateManual(editManualId, manualData);
              setEditManualId(null);
            } else {
              addManual(manualData);
            }
            setManualForm({ title: '', type: 'url', url: '', content: '', subject: null, workType: null, sortOrder: 1 });
            setManualFile(null);
          }}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg transition">
            {editManualId ? '更新' : '追加'}
          </button>
          {editManualId && (
            <button onClick={() => { setEditManualId(null); setManualForm({ title: '', type: 'url', url: '', content: '', subject: null, workType: null, sortOrder: 1 }); setManualFile(null); }}
              className="text-sm text-gray-500 border border-gray-200 px-3 py-2 rounded-lg">キャンセル</button>
          )}
        </div>

        {/* グループ別表示: 科目 → 作業内容 */}
        {(() => {
          const allManuals = getManuals() || [];
          if (allManuals.length === 0) return <p className="text-xs text-gray-400">マニュアルが登録されていません</p>;

          const subjectGroups = {};
          allManuals.forEach(m => {
            const sKey = m.subject || '全科目共通';
            if (!subjectGroups[sKey]) subjectGroups[sKey] = [];
            subjectGroups[sKey].push(m);
          });
          const sortedSubjects = Object.keys(subjectGroups).sort((a, b) => {
            if (a === '全科目共通') return -1;
            if (b === '全科目共通') return 1;
            return a.localeCompare(b);
          });

          return sortedSubjects.map(subjectKey => {
            const manuals = subjectGroups[subjectKey];
            const workTypeGroups = {};
            manuals.forEach(m => {
              const wKey = m.workType || '全作業種';
              if (!workTypeGroups[wKey]) workTypeGroups[wKey] = [];
              workTypeGroups[wKey].push(m);
            });
            const sortedWorkTypes = Object.keys(workTypeGroups).sort((a, b) => {
              if (a === '全作業種') return -1;
              if (b === '全作業種') return 1;
              return a.localeCompare(b);
            });

            return (
              <div key={subjectKey} className="mb-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${subjectKey === '全科目共通' ? 'bg-gray-100 text-gray-600' : 'bg-blue-50 text-blue-700'}`}>
                    {subjectKey}
                  </span>
                  <span className="text-xs text-gray-400">{manuals.length}件</span>
                </div>
                {sortedWorkTypes.map(wtKey => (
                  <div key={wtKey} className="mb-1 ml-2">
                    {wtKey !== '全作業種' && (
                      <span className="text-[10px] text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded mb-0.5 inline-block">{wtKey}</span>
                    )}
                    <div className="space-y-1">
                      {workTypeGroups[wtKey].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).map(m => (
                        <div key={m.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-sm flex-shrink-0 w-6 text-center text-gray-400">{m.sortOrder}</span>
                            <span className="text-sm font-medium truncate">{m.title}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                              m.type === 'url' ? 'bg-blue-100 text-blue-600' :
                              m.type === 'file' ? 'bg-green-100 text-green-600' :
                              'bg-yellow-100 text-yellow-600'
                            }`}>
                              {m.type === 'url' ? 'URL' : m.type === 'file' ? 'ファイル' : 'テキスト'}
                            </span>
                            {m.type === 'url' && m.url && (
                              <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline truncate hidden sm:inline" onClick={e => e.stopPropagation()}>
                                {m.url}
                              </a>
                            )}
                            {m.type === 'file' && m.fileName && (
                              <span className="text-xs text-gray-400 truncate hidden sm:inline">{m.fileName} ({(m.fileSize / 1024).toFixed(1)} KB)</span>
                            )}
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <button onClick={() => {
                              setEditManualId(m.id);
                              setManualForm({
                                title: m.title,
                                type: m.type,
                                url: m.url || '',
                                content: m.content || '',
                                subject: m.subject,
                                workType: m.workType,
                                sortOrder: m.sortOrder || 1,
                              });
                              setManualFile(null);
                            }}
                              className="text-xs text-blue-500 hover:bg-blue-50 px-2 py-1 rounded">編集</button>
                            <button onClick={async () => {
                              if (m.fileAttachmentId) {
                                try { await deleteAttachment(m.fileAttachmentId); } catch (e) { /* ignore */ }
                              }
                              deleteManual(m.id);
                            }}
                              className="text-xs text-red-400 hover:bg-red-50 px-2 py-1 rounded">削除</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          });
        })()}
      </div>
      )}

      {/* ===== Section: チェックリスト ===== */}
      {activeMasterSection === 'checklist' && (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">✅ チェックリストの管理</h4>
        <p className="text-xs text-gray-500 mb-3">提出前チェック（作業者用）と検証チェック（リーダー用）の項目を管理します。科目・作業内容ごとに設定できます。</p>
        <div className="flex flex-wrap gap-2 mb-3">
          <select value={viForm.purpose}
            onChange={e => setViForm({ ...viForm, purpose: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="verification">検証チェック（リーダー用）</option>
            <option value="submission">提出前チェック（作業者用）</option>
          </select>
          <select value={viForm.subject || ''}
            onChange={e => setViForm({ ...viForm, subject: e.target.value || null })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">全科目共通</option>
            {(activeSubjects || SUBJECTS_LIST).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select value={viForm.workType || ''}
            onChange={e => setViForm({ ...viForm, workType: e.target.value || null })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">全作業種（共通）</option>
            {workTypesList.map(w => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
          <input type="text" placeholder="項目名" value={viForm.name}
            onChange={e => setViForm({ ...viForm, name: e.target.value })}
            className="flex-1 min-w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <input type="text" placeholder="説明" value={viForm.description}
            onChange={e => setViForm({ ...viForm, description: e.target.value })}
            className="flex-1 min-w-40 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <input type="number" placeholder="表示順" value={viForm.sortOrder} min="1" max="99"
            onChange={e => setViForm({ ...viForm, sortOrder: Number(e.target.value) })}
            className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm" title="表示順" />
          <label className="flex items-center gap-1 text-sm text-gray-600 cursor-pointer select-none">
            <input type="checkbox" checked={viForm.isRequired}
              onChange={e => setViForm({ ...viForm, isRequired: e.target.checked })}
              className="rounded border-gray-300" />
            必須
          </label>
          <button onClick={() => {
            if (!viForm.name.trim()) return;
            if (editViId) {
              updateVerificationItem(editViId, viForm);
              setEditViId(null);
            } else {
              addVerificationItem(viForm);
            }
            setViForm({ name: '', description: '', subject: null, sortOrder: 1, isRequired: false, purpose: 'verification', workType: null });
          }}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg transition">
            {editViId ? '更新' : '追加'}
          </button>
          {editViId && (
            <button onClick={() => { setEditViId(null); setViForm({ name: '', description: '', subject: null, sortOrder: 1, isRequired: false, purpose: 'verification', workType: null }); }}
              className="text-sm text-gray-500 border border-gray-200 px-3 py-2 rounded-lg">キャンセル</button>
          )}
        </div>

        {/* グループ別表示: 用途 → 科目 → 作業内容 */}
        {(() => {
          const allItems = getVerificationItems() || [];

          if (allItems.length === 0) {
            return <p className="text-xs text-gray-400">チェック項目が登録されていません</p>;
          }

          const purposeGroups = { verification: [], submission: [] };
          allItems.forEach(item => {
            const p = item.purpose || 'verification';
            if (!purposeGroups[p]) purposeGroups[p] = [];
            purposeGroups[p].push(item);
          });

          const purposeLabels = { verification: '検証チェック（リーダー用）', submission: '提出前チェック（作業者用）' };
          const purposeColors = { verification: 'bg-green-50 text-green-700 border-green-200', submission: 'bg-purple-50 text-purple-700 border-purple-200' };

          return ['submission', 'verification'].map(purpose => {
            const items = purposeGroups[purpose] || [];
            if (items.length === 0) return null;

            // 科目でグループ化
            const subjectGroups = {};
            items.forEach(item => {
              const sKey = item.subject || '全科目共通';
              if (!subjectGroups[sKey]) subjectGroups[sKey] = [];
              subjectGroups[sKey].push(item);
            });
            const sortedSubjects = Object.keys(subjectGroups).sort((a, b) => {
              if (a === '全科目共通') return -1;
              if (b === '全科目共通') return 1;
              return a.localeCompare(b);
            });

            return (
              <div key={purpose} className="mb-4">
                <div className={`inline-block text-xs font-semibold px-3 py-1 rounded-full border mb-2 ${purposeColors[purpose]}`}>
                  {purposeLabels[purpose]}（{items.length}件）
                </div>
                {sortedSubjects.map(subjectKey => {
                  const subjectItems = subjectGroups[subjectKey];
                  // さらに作業内容でグループ化
                  const workTypeGroups = {};
                  subjectItems.forEach(item => {
                    const wKey = item.workType || '全作業種';
                    if (!workTypeGroups[wKey]) workTypeGroups[wKey] = [];
                    workTypeGroups[wKey].push(item);
                  });
                  const sortedWorkTypes = Object.keys(workTypeGroups).sort((a, b) => {
                    if (a === '全作業種') return -1;
                    if (b === '全作業種') return 1;
                    return a.localeCompare(b);
                  });

                  return (
                    <div key={subjectKey} className="mb-2 ml-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${subjectKey === '全科目共通' ? 'bg-gray-100 text-gray-600' : 'bg-blue-50 text-blue-700'}`}>
                          {subjectKey}
                        </span>
                      </div>
                      {sortedWorkTypes.map(wtKey => (
                        <div key={wtKey} className="mb-1 ml-2">
                          {wtKey !== '全作業種' && (
                            <span className="text-[10px] text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded mb-0.5 inline-block">{wtKey}</span>
                          )}
                          <div className="space-y-1">
                            {workTypeGroups[wtKey].sort((a, b) => a.sortOrder - b.sortOrder).map(item => (
                              <div key={item.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-2">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <span className="text-sm flex-shrink-0 w-6 text-center text-gray-400">{item.sortOrder}</span>
                                  <span className="text-sm font-medium truncate">{item.name}</span>
                                  {item.isRequired && (
                                    <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full flex-shrink-0">必須</span>
                                  )}
                                  {item.workType && (
                                    <span className="text-[10px] bg-yellow-50 text-yellow-600 px-1.5 py-0.5 rounded-full flex-shrink-0 hidden sm:inline">{item.workType}</span>
                                  )}
                                  {item.description && (
                                    <span className="text-xs text-gray-400 truncate hidden sm:inline">{item.description}</span>
                                  )}
                                </div>
                                <div className="flex gap-1 flex-shrink-0">
                                  <button onClick={() => { setEditViId(item.id); setViForm({ name: item.name, description: item.description || '', subject: item.subject, sortOrder: item.sortOrder, isRequired: item.isRequired, purpose: item.purpose || 'verification', workType: item.workType || null }); }}
                                    className="text-xs text-blue-500 hover:bg-blue-50 px-2 py-1 rounded">編集</button>
                                  <button onClick={() => deleteVerificationItem(item.id)}
                                    className="text-xs text-red-400 hover:bg-red-50 px-2 py-1 rounded">削除</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          });
        })()}
      </div>
      )}

        </div>
      )}
    </div>
  );
};

// ===== ファイル統合タブ =====
const FileMergeTab = () => {
  const [files, setFiles] = useState([]);
  const [groups, setGroups] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');

  const handleFiles = async (newFiles) => {
    const xlsxFiles = Array.from(newFiles).filter(f =>
      f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
    );
    if (xlsxFiles.length === 0) {
      setError('Excelファイル（.xlsx）を選択してください');
      return;
    }
    setError('');
    const allFiles = [...files, ...xlsxFiles];
    setFiles(allFiles);
    setProcessing(true);
    try {
      const result = await parseAndGroupFiles(allFiles);
      setGroups(result);
    } catch (e) {
      setError(`ファイルの解析に失敗しました: ${e.message}`);
    }
    setProcessing(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);

  const removeFile = (fileName) => {
    const updated = files.filter(f => f.name !== fileName);
    setFiles(updated);
    if (updated.length === 0) {
      setGroups([]);
    } else {
      parseAndGroupFiles(updated).then(setGroups);
    }
  };

  const clearAll = () => {
    setFiles([]);
    setGroups([]);
    setError('');
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-gray-800">📎 ファイル統合</h2>
      <p className="text-sm text-gray-500">
        大問ごとに出力されたExcelファイルをアップロードすると、試験種ごとに自動分類し、大問番号順に結合して1つのファイルとしてダウンロードできます。
      </p>

      {/* ドラッグ&ドロップエリア */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
          dragOver ? 'border-purple-500 bg-purple-50' : 'border-gray-300 bg-white hover:border-purple-400 hover:bg-purple-50/30'
        }`}
        onClick={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.multiple = true;
          input.accept = '.xlsx,.xls';
          input.onchange = (e) => handleFiles(e.target.files);
          input.click();
        }}
      >
        <div className="text-4xl mb-3">📁</div>
        <p className="text-gray-600 font-medium">ここにファイルをドラッグ&ドロップ</p>
        <p className="text-gray-400 text-sm mt-1">またはクリックしてファイルを選択</p>
        <p className="text-gray-300 text-xs mt-2">.xlsx形式のファイルのみ対応</p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>
      )}

      {/* アップロード済みファイル一覧 */}
      {files.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-700">アップロード済みファイル（{files.length}件）</h3>
            <button onClick={clearAll} className="text-xs text-red-500 hover:text-red-700">すべてクリア</button>
          </div>
          <div className="space-y-1.5">
            {files.map((f, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700 truncate">📄 {f.name}</span>
                <button onClick={() => removeFile(f.name)} className="text-gray-400 hover:text-red-500 text-xs ml-2">✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {processing && (
        <div className="text-center py-4 text-purple-600 animate-pulse">解析中...</div>
      )}

      {/* グループ別表示 */}
      {groups.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-700">試験種ごとの分類結果</h3>
          {groups.map((g) => (
            <div key={g.key} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-bold text-gray-800">{g.label}</h4>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {g.files.length}ファイル → 構成{g.koseiRows.length}行・内容{g.naiyouRows.length}行
                  </p>
                </div>
                <button
                  onClick={() => downloadMergedExcel(g)}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
                >
                  📥 統合してダウンロード
                </button>
              </div>
              <div className="text-xs text-gray-500 space-y-0.5">
                {g.files.map((fname, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="text-purple-400">•</span>
                    <span>{fname}</span>
                    <span className="text-gray-300 ml-1">
                      (大問 {g.koseiRows.filter(r => g.files.indexOf(fname) === i).length > 0 ? '含む' : ''})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

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
          <li><strong>大問分割CSV登録</strong>：学校名・科目・大問名・分野・工数・期限のCSVで大問単位に分割登録</li>
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
          <li><strong>CSV一括登録</strong>：氏名、管理ID、ログインID、メール、ロール、担当科目のCSVで一括投入。テンプレートCSVもダウンロード可能</li>
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
            <p><strong>タスク作成</strong>：試験種管理 → タスク追加 / CSV一括登録 / 大問分割CSV登録</p>
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
                  if (showAll) {
                    setShowAll(false);
                    setSubjectFilter(user.subjects?.length > 0 ? [...user.subjects] : [...SUBJECTS_LIST]);
                  } else {
                    setShowAll(true);
                    setSubjectFilter([...SUBJECTS_LIST]);
                  }
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition ${showAll ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                全体
              </button>
              {SUBJECTS_LIST.map(s => {
                const isActive = subjectFilter.includes(s);
                const isMySubject = (user.subjects ?? []).includes(s);
                return (
                  <button
                    key={s}
                    onClick={() => {
                      setShowAll(false);
                      setSubjectFilter(prev =>
                        prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
                      );
                    }}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                      isActive
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
