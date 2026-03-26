/**
 * CapacityAnalysisTab - Capacity analysis with daily/corrector/subject charts and history export
 * Includes buildDailyData helper, CustomDailyTooltip, and MacroIncentiveSection sub-component.
 */
import React, { useState, useMemo } from 'react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, Line, ReferenceLine, Cell, Bar,
} from 'recharts';
import { useData, isFinished } from '../../contexts/DataContext.jsx';
import { SUBJECTS_LIST, WORK_TYPES_LIST } from '../../utils/storage.js';
import { toCSV, downloadCSV, CAPACITY_CSV_COLUMNS } from '../../utils/csvUtils';
import { downloadHistoryExcel } from '../../utils/excelExport.js';

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
      userManagementId: user?.managementId ?? '',
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
      correctorManagementId: user?.managementId || '',
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

  // ---- CSV export helpers ----
  const todayStr = new Date().toISOString().split('T')[0];

  const correctorData = correctors.map(c => {
    const totalCap = capacities.filter(cap => cap.userId === c.id).reduce((s, cap) => s + cap.totalHours, 0);
    const assignedH = assignments.filter(a => a.userId === c.id && !isFinished(a.status)).reduce((s, a) => s + a.assignedHours, 0);
    return { name: c.name, totalCap, assignedH, freeH: Math.round((totalCap - assignedH) * 10) / 10 };
  });

  const handleExportDailyCSV = () => {
    const rows = dailyData.map(d => ({
      date: d.date,
      available: d['利用可能工数'],
      required: d['必要作業工数'],
      balance: d['余剰'],
      rate: d['利用可能工数'] > 0 ? Math.round((d['利用可能工数'] / (d['必要作業工数'] || 1)) * 100) : 0,
    }));
    const columns = [
      { header: '日付', key: 'date' },
      { header: '登録工数(h)', key: 'available' },
      { header: '必要工数(h)', key: 'required' },
      { header: '余剰/不足(h)', key: 'balance' },
      { header: '充足率(%)', key: 'rate' },
    ];
    downloadCSV(toCSV(rows, columns), `日別工数データ_${todayStr}.csv`);
  };

  const handleExportCorrectorCSV = () => {
    const columns = [
      { header: '作業者名', key: 'name' },
      { header: '登録工数(h)', key: 'totalCap' },
      { header: '割当工数(h)', key: 'assignedH' },
      { header: '残工数(h)', key: 'freeH' },
    ];
    downloadCSV(toCSV(correctorData, columns), `作業者別工数データ_${todayStr}.csv`);
  };

  const handleExportCapacityHistoryCSV = () => {
    const rows = allCapacities.map(c => {
      const user = allUsers.find(u => u.id === c.userId);
      return {
        userName: user?.name ?? '不明',
        startDate: c.startDate,
        endDate: c.endDate,
        hoursPerDay: c.hoursPerDay,
        totalHours: c.totalHours,
        note: c.note ?? '',
      };
    });
    const columns = [
      { header: '作業者名', key: 'userName' },
      { header: '開始日', key: 'startDate' },
      { header: '終了日', key: 'endDate' },
      { header: '日あたり工数(h)', key: 'hoursPerDay' },
      { header: '合計工数(h)', key: 'totalHours' },
      { header: 'メモ', key: 'note' },
    ];
    downloadCSV(toCSV(rows, columns), `月間工数履歴_${todayStr}.csv`);
  };

  const handleExportAllCSV = () => {
    handleExportDailyCSV();
    handleExportCorrectorCSV();
    handleExportCapacityHistoryCSV();
  };

  return (
    <div className="space-y-4">

      {/* ===== CSV一括出力ボタン ===== */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">CSV出力</h3>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleExportDailyCSV}
            className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-lg transition font-medium">
            日別工数データ
          </button>
          <button onClick={handleExportCorrectorCSV}
            className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-lg transition font-medium">
            作業者別工数データ
          </button>
          <button onClick={handleExportCapacityHistoryCSV}
            className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-lg transition font-medium">
            月間工数履歴
          </button>
          <button onClick={handleExportAllCSV}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg transition font-medium">
            全データ一括出力
          </button>
        </div>
      </div>

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

      {/* ===== 科目別 工数サマリー ===== */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">科目別 工数サマリー</h3>
        <p className="text-xs text-gray-400 mb-4">担当可能な作業者の工数 vs 必要作業工数</p>
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
                        <td className="py-2 px-2 font-mono text-blue-600">{c.userManagementId}</td>
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
  // Default date range: current month
  const defaultStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const defaultEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const [dateFrom, setDateFrom] = useState(defaultStart);
  const [dateTo, setDateTo] = useState(defaultEnd);
  const [filterSubject, setFilterSubject] = useState('');
  const [filterWorkType, setFilterWorkType] = useState('');
  const [filterUserId, setFilterUserId] = useState('');

  const correctors = useMemo(() => users.filter(u => u.role === 'corrector'), [users]);

  const subjectFilterOptions = useMemo(() => [...SUBJECTS_LIST, 'マクロ'], []);

  const incentiveData = useMemo(() => {
    const startISO = dateFrom ? new Date(dateFrom + 'T00:00:00').toISOString() : '';
    const endISO = dateTo ? new Date(dateTo + 'T23:59:59').toISOString() : '';

    // Build a task lookup map with subject/workType filters applied
    const taskMap = {};
    tasks.forEach(t => {
      if (filterSubject === 'マクロ') {
        // マクロ filter: match tasks where workType is マクロ
        if (t.workType !== 'マクロ') return;
      } else if (filterSubject) {
        if (t.subject !== filterSubject) return;
      }
      if (filterWorkType && t.workType !== filterWorkType) return;
      taskMap[t.id] = t;
    });

    // All completed assignments within the date range matching task filters
    const completedAssignments = assignments.filter(a => {
      if (!taskMap[a.taskId]) return false;
      if (!isFinished(a.status)) return false;
      if (filterUserId && a.userId !== filterUserId) return false;
      const dateField = a.reviewedAt || a.submittedAt || a.storedAt;
      if (!dateField) return false;
      if (startISO && dateField < startISO) return false;
      if (endISO && dateField > endISO) return false;
      return true;
    });

    // Aggregate per user
    const userMap = {};
    completedAssignments.forEach(a => {
      if (!userMap[a.userId]) {
        const u = users.find(u => u.id === a.userId);
        userMap[a.userId] = { name: u?.name || '不明', managementId: u?.managementId || '', taskCount: 0, totalHours: 0 };
      }
      userMap[a.userId].taskCount += 1;
      userMap[a.userId].totalHours += (a.actualHours || a.assignedHours || 0);
    });

    return Object.values(userMap).sort((a, b) => b.totalHours - a.totalHours);
  }, [dateFrom, dateTo, tasks, assignments, users, filterSubject, filterWorkType, filterUserId]);

  const totalTasks = incentiveData.reduce((s, d) => s + d.taskCount, 0);
  const totalHours = incentiveData.reduce((s, d) => s + d.totalHours, 0);

  const selectClass = "text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none";

  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">月間工数履歴</h3>
          <p className="text-xs text-gray-400 mt-0.5">完了タスクの期間別実績集計</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className={selectClass} />
          <span className="text-xs text-gray-400">〜</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className={selectClass} />
        </div>
      </div>

      {/* Filter dropdowns */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)} className={selectClass}>
          <option value="">全科目</option>
          {subjectFilterOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterWorkType} onChange={e => setFilterWorkType(e.target.value)} className={selectClass}>
          <option value="">全作業内容</option>
          {WORK_TYPES_LIST.map(w => <option key={w} value={w}>{w}</option>)}
        </select>
        <select value={filterUserId} onChange={e => setFilterUserId(e.target.value)} className={selectClass}>
          <option value="">全作業者</option>
          {correctors.map(c => <option key={c.id} value={c.id}>{c.name}（{c.managementId}）</option>)}
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
                <th className="text-left py-2 px-2 text-gray-500 font-medium">管理ID</th>
                <th className="text-right py-2 px-2 text-gray-500 font-medium">完了タスク数</th>
                <th className="text-right py-2 px-2 text-gray-500 font-medium">合計工数(h)</th>
              </tr>
            </thead>
            <tbody>
              {incentiveData.map((row, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 px-2 font-medium text-gray-800">{row.name}</td>
                  <td className="py-2 px-2 font-mono text-blue-600">{row.managementId}</td>
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

export default CapacityAnalysisTab;
