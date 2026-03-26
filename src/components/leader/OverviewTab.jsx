/**
 * OverviewTab - KPI summary and business completion prediction overview
 * Displays key metrics (task counts, capacity hours) and per-subject completion forecasts.
 */
import React from 'react';
import { useData, isFinished } from '../../contexts/DataContext.jsx';
import { predictAllTasks, predictAllSubjects } from '../../utils/prediction.js';

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

export { PREDICTION_BADGE };
export default OverviewTab;
