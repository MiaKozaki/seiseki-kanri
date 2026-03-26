/**
 * CorrectorEvaluationTab - Corrector performance evaluation tab (作業者評価)
 * Includes FB categories, evaluation scoring, time tracking analysis, and feedback management.
 */
import React, { useState, useMemo } from 'react';
import { useData, isFinished } from '../../contexts/DataContext.jsx';
import { SUBJECTS_LIST, WORK_TYPES_LIST } from '../../utils/storage.js';
import { toCSV, downloadCSV, EVALUATION_CSV_COLUMNS } from '../../utils/csvUtils';
import { calcAllMetrics, normalizeMetricToScore, formatDuration } from '../../utils/evaluationMetrics';
import { downloadAttachment } from '../../utils/fileStorage.js';

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
  if (!sec || sec <= 0) return '0分';
  // 秒を切り上げて分単位に変換
  const totalMin = Math.ceil(sec / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}時間${m}分`;
  return `${m}分`;
};

const _calcDuration = (log) =>
  log.endTime ? log.duration : Math.floor((Date.now() - new Date(log.startTime).getTime()) / 1000);

const CorrectorEvaluationTab = ({ activeSubjects }) => {
  const {
    getCorrectors, getEvaluations, setEvaluation,
    getEvaluationCriteria, addEvaluationCriteria, updateEvaluationCriteria, deleteEvaluationCriteria,
    getUsers, updateUser, getRejections, getRejectionCategories, getRejectionSeverities,
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
  const [worktimeTab, setWorktimeTab] = useState(0); // inner tabs for worktime section
  const [selectedUser, setSelectedUser] = useState(correctors[0]?.id ?? '');
  const [critForm, setCritForm] = useState({ name: '', description: '', maxScore: 5, basePoints: 1, subject: null, autoMetric: null });
  const [editCritId, setEditCritId] = useState(null);
  const [localScores, setLocalScores] = useState({});
  const [evalSubject, setEvalSubject] = useState(null);

  // --- Work time filters ---
  const [logFilterUser, setLogFilterUser] = useState('');
  const [logFilterSubject, setLogFilterSubject] = useState('');
  const [logFilterStart, setLogFilterStart] = useState('');
  const [logFilterEnd, setLogFilterEnd] = useState('');

  // --- Personal time state ---
  const [personalUser, setPersonalUser] = useState(correctors[0]?.id ?? '');

  // --- Subject/daimon state ---
  const [subjectDetailSubject, setSubjectDetailSubject] = useState('');
  const [daimonFilterUser, setDaimonFilterUser] = useState('');

  // --- Comparison panel state ---
  const [comparisonOpen, setComparisonOpen] = useState(false);

  // --- FB集約 state ---
  const [fbSectionOpen, setFbSectionOpen] = useState(false);
  const [fbView, setFbView] = useState('byUser'); // 'byUser' | 'byCategory'
  const [fbFilterUser, setFbFilterUser] = useState('');

  // --- Summary section state ---
  const [summarySubject, setSummarySubject] = useState('');
  const [summaryWorkType, setSummaryWorkType] = useState('');
  const [summarySortKey, setSummarySortKey] = useState('managementId');
  const [summarySortDir, setSummarySortDir] = useState('asc');

  // --- Classification constants ---
  const CLASSIFICATION_OPTIONS = ['通常作業者', '優良作業者', '要注意作業者', '新人'];

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
      updateEvaluationCriteria(editCritId, { ...critForm, maxScore: Number(critForm.maxScore), basePoints: Number(critForm.basePoints) || 1 });
      setEditCritId(null);
    } else {
      addEvaluationCriteria({ ...critForm, maxScore: Number(critForm.maxScore), basePoints: Number(critForm.basePoints) || 1 });
    }
    setCritForm({ name: '', description: '', maxScore: 5, basePoints: 1, subject: null, autoMetric: null });
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
        const bp = crit.basePoints || 1;
        const scoreVal = ev?.score ?? '';
        data.push({
          userName: c.name,
          userManagementId: c.managementId || '',
          criteriaName: crit.name,
          score: scoreVal,
          maxScore: crit.maxScore,
          basePoints: bp,
          level: bp > 1 && scoreVal !== '' ? Math.round(Number(scoreVal) / bp) : '',
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
    { key: 'criteria', icon: '\u{1F4CB}', title: '\u8A55\u4FA1\u57FA\u6E96', desc: '\u8A55\u4FA1\u57FA\u6E96\u306E\u7BA1\u7406' },
    { key: 'evaluation', icon: '\u2B50', title: '\u4F5C\u696D\u8005\u8A55\u4FA1', desc: '\u4F5C\u696D\u8005\u306E\u8A55\u4FA1\u5165\u529B' },
    { key: 'worktime', icon: '\u23F1\uFE0F', title: '\u4F5C\u696D\u6642\u9593', desc: '\u4F5C\u696D\u6642\u9593\u4E00\u89A7\u30FB\u500B\u4EBA\u5225\u30FB\u79D1\u76EE\u5225' },
    { key: 'classification', icon: '\u{1F3F7}\uFE0F', title: '\u4F5C\u696D\u8005\u5206\u985E', desc: '\u901A\u5E38/\u512A\u826F/\u8981\u6CE8\u610F\u306E\u5206\u985E' },
    { key: 'fb', icon: '\u{1F4CB}', title: 'FB\u96C6\u7D04\u30FB\u5206\u6790', desc: '\u30D5\u30A3\u30FC\u30C9\u30D0\u30C3\u30AF\u306E\u96C6\u7D04\u30FB\u30AB\u30C6\u30B4\u30EA\u5206\u6790' },
    { key: 'summary', icon: '\u{1F4CA}', title: '\u8A55\u4FA1\u307E\u3068\u3081', desc: '\u79D1\u76EE\u30FB\u696D\u52D9\u5185\u5BB9\u5225\u306E\u8A55\u4FA1\u30EC\u30DD\u30FC\u30C8' },
  ];

  // Classification badge helper
  const getClassificationBadge = (classification) => {
    const styles = {
      '\u512A\u826F\u4F5C\u696D\u8005': 'bg-green-100 text-green-700 border-green-200',
      '\u8981\u6CE8\u610F\u4F5C\u696D\u8005': 'bg-red-100 text-red-700 border-red-200',
      '\u65B0\u4EBA': 'bg-purple-100 text-purple-700 border-purple-200',
      '\u901A\u5E38\u4F5C\u696D\u8005': 'bg-gray-100 text-gray-600 border-gray-200',
    };
    if (!classification) return null;
    const cls = styles[classification] || 'bg-gray-100 text-gray-600 border-gray-200';
    return <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cls}`}>{classification}</span>;
  };

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

      {/* ===== Section: 評価基準 ===== */}
      {activeEvalSection === 'criteria' && (
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
              <span className="text-xs text-gray-500">素点</span>
              <input
                type="number" min="1" max="100" value={critForm.basePoints}
                onChange={e => setCritForm({ ...critForm, basePoints: e.target.value })}
                className="w-16 px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">最大</span>
              <input
                type="number" min="1" max="100" value={critForm.maxScore}
                onChange={e => setCritForm({ ...critForm, maxScore: e.target.value })}
                className="w-16 px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <span className="text-xs text-gray-500">点</span>
            </div>
            {critForm.basePoints > 1 && (
              <div className="flex items-center">
                <span className="text-xs text-gray-400">
                  ({Math.floor(Number(critForm.maxScore) / Number(critForm.basePoints))}段階: {Array.from({length: Math.floor(Number(critForm.maxScore) / Number(critForm.basePoints))}, (_, i) => (i + 1) * Number(critForm.basePoints)).join(', ')})
                </span>
              </div>
            )}
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
              <option value="deadline_compliance">期限遵守率</option>
            </select>
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg transition">
              {editCritId ? '更新' : '追加'}
            </button>
            {editCritId && (
              <button type="button" onClick={() => { setEditCritId(null); setCritForm({ name: '', description: '', maxScore: 5, basePoints: 1, subject: null, autoMetric: null }); }}
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
                {(c.basePoints || 1) > 1 && <span className="text-xs ml-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">素点{c.basePoints}</span>}
                {c.subject && <span className="text-xs ml-1 px-1.5 py-0.5 rounded bg-blue-100 text-blue-600">{c.subject}</span>}
                {c.autoMetric && <span className="text-xs ml-1 px-1.5 py-0.5 rounded bg-green-100 text-green-600">
                  {c.autoMetric === 'rejection_rate' ? '自動:差し戻し率' :
                   c.autoMetric === 'severity_score' ? '自動:重大度' :
                   c.autoMetric === 'work_time' ? '自動:作業時間' :
                   c.autoMetric === 'task_count' ? '自動:タスク数' :
                   c.autoMetric === 'deadline_compliance' ? '自動:期限遵守率' : ''}
                </span>}
                <button onClick={() => { setEditCritId(c.id); setCritForm({ name: c.name, description: c.description, maxScore: c.maxScore, basePoints: c.basePoints || 1, subject: c.subject || null, autoMetric: c.autoMetric || null }); }}
                  className="text-blue-500 hover:text-blue-700 text-xs">編集</button>
                <button onClick={() => { if (confirm(`「${c.name}」を削除しますか？`)) deleteEvaluationCriteria(c.id); }}
                  className="text-red-400 hover:text-red-600 text-xs">×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== Section: 作業者評価 ===== */}
      {activeEvalSection === 'evaluation' && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">作業者評価の入力</h3>
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
                className={`text-sm px-3 py-1.5 rounded-lg border transition flex items-center gap-1.5 ${selectedUser === c.id ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
              >
                {c.name}
                {selectedUser !== c.id && getClassificationBadge(c.classification)}
              </button>
            ))}
          </div>

          {/* Collapsible comparison panel */}
          {selectedUser && (
            <div className="mb-4">
              <button
                onClick={() => setComparisonOpen(!comparisonOpen)}
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-800 transition mb-2"
              >
                <span className={`transform transition-transform ${comparisonOpen ? 'rotate-90' : ''}`}>&#9654;</span>
                <span>{'\uD83D\uDCCA'} 全体比較</span>
              </button>
              {comparisonOpen && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-gray-500 border-b border-blue-200">
                        <th className="py-1.5 px-2">氏名</th>
                        <th className="py-1.5 px-2">分類</th>
                        <th className="py-1.5 px-2 text-right">評価平均</th>
                        <th className="py-1.5 px-2 text-right">差し戻し率</th>
                        <th className="py-1.5 px-2 text-right">差し戻し数</th>
                        <th className="py-1.5 px-2 text-right">重大度</th>
                        <th className="py-1.5 px-2 text-right">平均作業時間</th>
                        <th className="py-1.5 px-2 text-right">完了数</th>
                        <th className="py-1.5 px-2 text-right">期限遵守率</th>
                      </tr>
                    </thead>
                    <tbody>
                      {correctors.map(c => {
                        const cMetrics = calcAllMetrics(c.id, evalSubject, getAllData());
                        const cEvals = allEvals.filter(e => e.userId === c.id);
                        const avgScore = criteria.length > 0
                          ? criteria.reduce((sum, cr) => {
                              const ev = cEvals.find(e => e.criteriaId === cr.id);
                              return sum + ((ev?.score ?? 0) / cr.maxScore);
                            }, 0) / criteria.length * 100
                          : 0;
                        const isSelected = c.id === selectedUser;
                        const avgTime = cMetrics.averageWorkTime;
                        const avgTimeStr = avgTime > 0 ? (avgTime >= 3600 ? `${Math.floor(avgTime/3600)}h${Math.floor((avgTime%3600)/60)}m` : `${Math.floor(avgTime/60)}m`) : '-';
                        return (
                          <tr
                            key={c.id}
                            className={`border-b border-blue-100 cursor-pointer hover:bg-blue-100 transition ${isSelected ? 'bg-blue-100 font-semibold' : ''}`}
                            onClick={() => { setSelectedUser(c.id); setLocalScores({}); }}
                          >
                            <td className="py-1.5 px-2 text-gray-800 whitespace-nowrap">{c.name}{isSelected && <span className="ml-1 text-blue-600">&#9664;</span>}</td>
                            <td className="py-1.5 px-2">{getClassificationBadge(c.classification) || <span className="text-gray-400">-</span>}</td>
                            <td className="py-1.5 px-2 text-right text-gray-700">{avgScore.toFixed(1)}%</td>
                            <td className={`py-1.5 px-2 text-right ${cMetrics.rejectionRate > 30 ? 'text-red-600 font-medium' : 'text-gray-700'}`}>{cMetrics.rejectionRate.toFixed(1)}%</td>
                            <td className="py-1.5 px-2 text-right text-gray-700">{cMetrics.rejectionCount}</td>
                            <td className={`py-1.5 px-2 text-right ${cMetrics.severityScore > 5 ? 'text-red-600 font-medium' : 'text-gray-700'}`}>{cMetrics.severityScore.toFixed(1)}</td>
                            <td className="py-1.5 px-2 text-right text-gray-700">{avgTimeStr}</td>
                            <td className="py-1.5 px-2 text-right text-gray-700">{cMetrics.taskCount}</td>
                            <td className={`py-1.5 px-2 text-right ${cMetrics.deadlineComplianceRate < 70 ? 'text-red-600 font-medium' : 'text-green-700'}`}>{cMetrics.deadlineComplianceRate.toFixed(1)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {selectedUser && (
            <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <h5 className="text-xs font-semibold text-gray-600">自動計算メトリクス{evalSubject ? ` (${evalSubject})` : ' (全科目)'}</h5>
                {getClassificationBadge(correctors.find(c => c.id === selectedUser)?.classification)}
              </div>
              {(() => {
                const metrics = calcAllMetrics(selectedUser, evalSubject, getAllData());
                return (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-2">
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
                      <div className="bg-white rounded-lg p-2 text-center">
                        <p className="text-xs text-gray-500">期限遵守率</p>
                        <p className="text-lg font-bold text-gray-800">{metrics.deadlineComplianceRate.toFixed(1)}%</p>
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
                  const bp = c.basePoints || 1;
                  const levels = bp > 1 ? Math.floor(c.maxScore / bp) : c.maxScore;
                  const currentLevel = bp > 1 ? Math.round(score / bp) : score;
                  return (
                    <div key={c.id} className="flex items-center gap-3">
                      <div className="w-32 shrink-0">
                        <p className="text-sm font-medium text-gray-700">{c.name}</p>
                        <p className="text-xs text-gray-400">{c.description}</p>
                        {bp > 1 && <p className="text-xs text-amber-600">素点{bp} / {levels}段階</p>}
                      </div>
                      {bp > 1 ? (
                        <div className="flex-1 flex items-center gap-1">
                          {Array.from({length: levels + 1}, (_, i) => i).map(level => (
                            <button
                              key={level}
                              onClick={() => handleScoreChange(c.id, level * bp)}
                              className={`px-2 py-1 text-xs rounded-lg border transition ${currentLevel === level
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-600 border-gray-300 hover:bg-blue-50'}`}
                            >
                              {level === 0 ? '0' : level * bp}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <input
                          type="range" min="0" max={c.maxScore} step="1"
                          value={score}
                          onChange={e => handleScoreChange(c.id, e.target.value)}
                          className="flex-1 accent-blue-600"
                        />
                      )}
                      <span className="w-16 text-right text-sm font-semibold text-blue-600">
                        {score} / {c.maxScore}
                        {bp > 1 && <span className="block text-xs text-gray-400 font-normal">Lv.{currentLevel}</span>}
                      </span>
                      {c.autoMetric && (() => {
                        const metrics = calcAllMetrics(selectedUser, evalSubject, getAllData());
                        const allCorrectors = correctors;
                        const allVals = allCorrectors.map(cr => {
                          const m = calcAllMetrics(cr.id, evalSubject, getAllData());
                          return c.autoMetric === 'rejection_rate' ? m.rejectionRate :
                                 c.autoMetric === 'severity_score' ? m.severityScore :
                                 c.autoMetric === 'work_time' ? m.averageWorkTime :
                                 c.autoMetric === 'deadline_compliance' ? m.deadlineComplianceRate :
                                 m.taskCount;
                        });
                        const val = c.autoMetric === 'rejection_rate' ? metrics.rejectionRate :
                                    c.autoMetric === 'severity_score' ? metrics.severityScore :
                                    c.autoMetric === 'work_time' ? metrics.averageWorkTime :
                                    c.autoMetric === 'deadline_compliance' ? metrics.deadlineComplianceRate :
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

      {/* ===== Section: 作業時間 ===== */}
      {activeEvalSection === 'worktime' && (
        <div className="space-y-4">
      {/* Inner tab navigation */}
      <div className="flex gap-1 mb-4 flex-wrap">
        {['\u4F5C\u696D\u6642\u9593\u4E00\u89A7', '\u500B\u4EBA\u5225\u6642\u9593', '\u79D1\u76EE\u30FB\u5927\u554F\u5225'].map((label, i) => (
          <button key={i} onClick={() => setWorktimeTab(i)}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${worktimeTab === i ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ======== Inner tab 0: 作業時間一覧 ======== */}
      {worktimeTab === 0 && (
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

      {/* ======== Inner tab 1: 個人別時間 ======== */}
      {worktimeTab === 1 && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">個人別作業時間</h3>

          {/* Corrector selector */}
          <div className="flex gap-2 flex-wrap mb-4">
            {correctors.map(c => (
              <button
                key={c.id}
                onClick={() => setPersonalUser(c.id)}
                className={`text-sm px-3 py-1.5 rounded-lg border transition flex items-center gap-1.5 ${personalUser === c.id ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
              >
                {c.name}
                {personalUser !== c.id && getClassificationBadge(c.classification)}
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

      {/* ======== Inner tab 2: 科目・大問別 ======== */}
      {worktimeTab === 2 && (
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

      {/* ===== Section: 作業者分類 ===== */}
      {activeEvalSection === 'classification' && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">作業者分類</h3>
          <p className="text-xs text-gray-500 mb-4">各作業者を分類カテゴリに割り当てます。分類は作業者名の横にバッジとして表示されます。</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500">管理ID</th>
                  <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500">作業者名</th>
                  <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500">担当科目</th>
                  <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500">現在の分類</th>
                  <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500">分類変更</th>
                </tr>
              </thead>
              <tbody>
                {correctors.map(c => (
                  <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-2 text-gray-500 text-xs">{c.managementId || '-'}</td>
                    <td className="py-2 px-2 text-gray-700 font-medium">{c.name}</td>
                    <td className="py-2 px-2 text-gray-600 text-xs">
                      {(c.subjects || []).join(', ') || '-'}
                    </td>
                    <td className="py-2 px-2">
                      {getClassificationBadge(c.classification) || <span className="text-xs text-gray-400">未分類</span>}
                    </td>
                    <td className="py-2 px-2">
                      <select
                        value={c.classification || ''}
                        onChange={e => {
                          const val = e.target.value || null;
                          updateUser(c.id, { classification: val });
                        }}
                        className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="">未分類</option>
                        {CLASSIFICATION_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
                {correctors.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-8 text-gray-400">作業者が登録されていません</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Classification summary */}
          {correctors.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-3">
              {CLASSIFICATION_OPTIONS.map(opt => {
                const count = correctors.filter(c => c.classification === opt).length;
                return (
                  <div key={opt} className="flex items-center gap-1.5">
                    {getClassificationBadge(opt)}
                    <span className="text-xs text-gray-500">{count}名</span>
                  </div>
                );
              })}
              <div className="flex items-center gap-1.5">
                <span className="text-xs px-2 py-0.5 rounded-full border font-medium bg-gray-50 text-gray-400 border-gray-200">未分類</span>
                <span className="text-xs text-gray-500">{correctors.filter(c => !c.classification).length}名</span>
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

      {/* ===== Section: 評価まとめ ===== */}
      {activeEvalSection === 'summary' && (() => {
        const allFeedbacks = getFeedbacks();
        const allRejections = getRejections();

        // Build summary rows for each corrector
        const summaryRows = correctors.map(c => {
          // Filter tasks by subject/workType
          const userAssignments = assignments.filter(a => a.userId === c.id);
          const userTaskIds = userAssignments.map(a => a.taskId);
          let userTasks = tasks.filter(t => userTaskIds.includes(t.id));
          if (summarySubject) userTasks = userTasks.filter(t => t.subject === summarySubject);
          if (summaryWorkType) userTasks = userTasks.filter(t => t.workType === summaryWorkType);
          const filteredTaskIds = new Set(userTasks.map(t => t.id));

          // Evaluation score - average across criteria for selected subject
          const relevantCriteria = summarySubject
            ? criteria.filter(cr => !cr.subject || cr.subject === summarySubject)
            : criteria;
          const userEvalsAll = allEvals.filter(e => e.userId === c.id);
          const scores = relevantCriteria.map(cr => {
            const ev = userEvalsAll.find(e => e.criteriaId === cr.id);
            return ev ? ev.score : null;
          }).filter(s => s !== null);
          const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

          // Work time from timeLogs
          let userLogs = allTimeLogs.filter(l => l.userId === c.id);
          if (summarySubject || summaryWorkType) {
            userLogs = userLogs.filter(l => filteredTaskIds.has(l.taskId));
          }
          const totalWorkTime = userLogs.reduce((sum, l) => sum + _calcDuration(l), 0);

          // Completed tasks
          const completedCount = userTasks.filter(t => t.status === 'completed').length;

          // FB count
          let fbCount = allFeedbacks.filter(fb => fb.toUserId === c.id);
          if (summarySubject || summaryWorkType) {
            fbCount = fbCount.filter(fb => filteredTaskIds.has(fb.taskId));
          }

          // Rejection count
          let rejCount = allRejections.filter(r => r.userId === c.id);
          if (summarySubject || summaryWorkType) {
            rejCount = rejCount.filter(r => filteredTaskIds.has(r.taskId));
          }

          // Classification short label
          const classMap = { '通常作業者': '通常', '優良作業者': '優良', '要注意作業者': '要注意', '新人': '新人' };
          const classLabel = classMap[c.classification] || c.classification || '-';

          return {
            id: c.id,
            managementId: c.managementId || '-',
            name: c.name,
            classification: c.classification || '',
            classLabel,
            subjects: (c.subjects || []).join(', '),
            avgScore: Math.round(avgScore * 100) / 100,
            totalWorkTime,
            totalWorkTimeH: Math.round((totalWorkTime / 3600) * 100) / 100,
            completedCount,
            fbCount: fbCount.length,
            rejCount: rejCount.length,
            correctorNotes: c.correctorNotes || '',
          };
        });

        // Sort
        const sorted = [...summaryRows].sort((a, b) => {
          let va = a[summarySortKey];
          let vb = b[summarySortKey];
          if (typeof va === 'string') va = va.toLowerCase();
          if (typeof vb === 'string') vb = vb.toLowerCase();
          if (va < vb) return summarySortDir === 'asc' ? -1 : 1;
          if (va > vb) return summarySortDir === 'asc' ? 1 : -1;
          return 0;
        });

        const handleSummarySort = (key) => {
          if (summarySortKey === key) {
            setSummarySortDir(prev => prev === 'asc' ? 'desc' : 'asc');
          } else {
            setSummarySortKey(key);
            setSummarySortDir('asc');
          }
        };

        const sortIndicator = (key) => {
          if (summarySortKey !== key) return '';
          return summarySortDir === 'asc' ? ' ▲' : ' ▼';
        };

        const handleExportSummaryCSV = () => {
          const csvData = sorted.map(r => ({
            managementId: r.managementId,
            name: r.name,
            classification: r.classLabel,
            subjects: r.subjects,
            avgScore: r.avgScore,
            totalWorkTimeH: r.totalWorkTimeH,
            completedCount: r.completedCount,
            fbCount: r.fbCount,
            rejCount: r.rejCount,
            correctorNotes: r.correctorNotes,
          }));
          const columns = [
            { key: 'managementId', label: '管理ID' },
            { key: 'name', label: '氏名' },
            { key: 'classification', label: '分類' },
            { key: 'subjects', label: '担当科目' },
            { key: 'avgScore', label: '評価スコア' },
            { key: 'totalWorkTimeH', label: '作業時間(h)' },
            { key: 'completedCount', label: '完了タスク数' },
            { key: 'fbCount', label: 'FB件数' },
            { key: 'rejCount', label: '差し戻し件数' },
            { key: 'correctorNotes', label: '傾向メモ' },
          ];
          const csv = toCSV(csvData, columns);
          downloadCSV(csv, `評価まとめ_${new Date().toISOString().slice(0, 10)}.csv`);
        };

        return (
          <div className="border border-indigo-200 rounded-xl overflow-hidden">
            <div className="w-full flex items-center justify-between px-5 py-3 bg-indigo-50">
              <span className="text-sm font-semibold text-indigo-800">評価まとめ</span>
              <button
                onClick={handleExportSummaryCSV}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition"
              >
                CSVで出力
              </button>
            </div>

            <div className="p-5 bg-white space-y-4">
              {/* Filters */}
              <div className="flex items-center gap-3 flex-wrap">
                <select
                  value={summarySubject}
                  onChange={e => setSummarySubject(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="">全科目</option>
                  {SUBJECTS_LIST.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <select
                  value={summaryWorkType}
                  onChange={e => setSummaryWorkType(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="">全業務</option>
                  {WORK_TYPES_LIST.map(w => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
                <span className="text-xs text-gray-500">{sorted.length}名</span>
              </div>

              {/* Summary table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-indigo-200 bg-indigo-50/50">
                      {[
                        { key: 'managementId', label: '管理ID' },
                        { key: 'name', label: '氏名' },
                        { key: 'classLabel', label: '分類' },
                        { key: 'subjects', label: '担当科目' },
                        { key: 'avgScore', label: '評価スコア' },
                        { key: 'totalWorkTimeH', label: '作業時間合計' },
                        { key: 'completedCount', label: '完了タスク数' },
                        { key: 'fbCount', label: 'FB件数' },
                        { key: 'rejCount', label: '差し戻し件数' },
                        { key: 'correctorNotes', label: '傾向メモ' },
                      ].map(col => (
                        <th
                          key={col.key}
                          onClick={() => handleSummarySort(col.key)}
                          className="text-left py-2 px-2 text-xs font-semibold text-indigo-700 cursor-pointer hover:bg-indigo-100 transition select-none whitespace-nowrap"
                        >
                          {col.label}{sortIndicator(col.key)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.length > 0 ? sorted.map(row => (
                      <tr key={row.id} className="border-b border-gray-100 hover:bg-indigo-50/30 transition">
                        <td className="py-2 px-2 text-xs text-gray-600 font-mono">{row.managementId}</td>
                        <td className="py-2 px-2 text-xs font-medium text-gray-800">{row.name}</td>
                        <td className="py-2 px-2">{getClassificationBadge(row.classification)}</td>
                        <td className="py-2 px-2 text-xs text-gray-600">{row.subjects || '-'}</td>
                        <td className="py-2 px-2 text-xs text-right font-semibold">
                          <span className={row.avgScore >= 4 ? 'text-green-600' : row.avgScore >= 2.5 ? 'text-amber-600' : row.avgScore > 0 ? 'text-red-600' : 'text-gray-400'}>
                            {row.avgScore > 0 ? row.avgScore.toFixed(2) : '-'}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-xs text-right text-gray-700">{row.totalWorkTimeH > 0 ? `${row.totalWorkTimeH}h` : '-'}</td>
                        <td className="py-2 px-2 text-xs text-right text-gray-700">{row.completedCount}</td>
                        <td className="py-2 px-2 text-xs text-right">
                          {row.fbCount > 0 ? (
                            <span className="inline-block bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-semibold">{row.fbCount}</span>
                          ) : <span className="text-gray-400">0</span>}
                        </td>
                        <td className="py-2 px-2 text-xs text-right">
                          {row.rejCount > 0 ? (
                            <span className="inline-block bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">{row.rejCount}</span>
                          ) : <span className="text-gray-400">0</span>}
                        </td>
                        <td className="py-2 px-2 text-xs text-gray-500 max-w-[200px] truncate" title={row.correctorNotes}>
                          {row.correctorNotes || '-'}
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={10} className="text-center py-8 text-gray-400 text-sm">データがありません</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

        </div>
      )}
    </div>
  );
};

export default CorrectorEvaluationTab;
