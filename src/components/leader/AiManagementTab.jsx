/**
 * AiManagementTab - AI usage tracking and analytics tab (AI管理)
 * Shows AI usage summary, breakdown charts, filterable log table, and CSV export.
 */
import React, { useState, useMemo } from 'react';
import { useData } from '../../contexts/DataContext.jsx';
import { SUBJECTS_LIST } from '../../utils/storage.js';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#6366f1', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6'];

const AiManagementTab = ({ activeSubjects }) => {
  const { getAiUsageLogs, getAiModels, getUsers, getTasks, getAssignments, getWorkTypes } = useData();

  const [filterSubject, setFilterSubject] = useState('');
  const [filterAiModel, setFilterAiModel] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const aiModels = getAiModels();
  const users = getUsers();
  const tasks = getTasks();
  const assignments = getAssignments();
  const workTypes = getWorkTypes();
  const allLogs = getAiUsageLogs();

  // Filter logs by activeSubjects
  const subjectFilteredLogs = useMemo(() => {
    return allLogs.filter(l => !l.subject || (activeSubjects || SUBJECTS_LIST).includes(l.subject));
  }, [allLogs, activeSubjects]);

  // Apply additional filters
  const filteredLogs = useMemo(() => {
    let logs = subjectFilteredLogs;
    if (filterSubject) logs = logs.filter(l => l.subject === filterSubject);
    if (filterAiModel) logs = logs.filter(l => l.aiModelId === filterAiModel);
    if (filterDateFrom) logs = logs.filter(l => l.createdAt >= filterDateFrom);
    if (filterDateTo) logs = logs.filter(l => l.createdAt <= filterDateTo + 'T23:59:59.999Z');
    return logs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [subjectFilteredLogs, filterSubject, filterAiModel, filterDateFrom, filterDateTo]);

  // Summary data
  const totalCount = subjectFilteredLogs.length;

  // Breakdown by AI model (pie chart)
  const modelBreakdown = useMemo(() => {
    const counts = {};
    subjectFilteredLogs.forEach(l => {
      const model = aiModels.find(m => m.id === l.aiModelId);
      const name = model?.name || '不明';
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [subjectFilteredLogs, aiModels]);

  // Breakdown by subject (bar chart)
  const subjectBreakdown = useMemo(() => {
    const counts = {};
    subjectFilteredLogs.forEach(l => {
      const subject = l.subject || '不明';
      counts[subject] = (counts[subject] || 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [subjectFilteredLogs]);

  // Helpers
  const getUserName = (userId) => users.find(u => u.id === userId)?.name || '不明';
  const getTaskName = (taskId) => tasks.find(t => t.id === taskId)?.name || '不明';
  const getTaskSubject = (taskId) => tasks.find(t => t.id === taskId)?.subject || '';
  const getTaskWorkType = (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    return task?.workType || '';
  };
  const getModelName = (modelId) => aiModels.find(m => m.id === modelId)?.name || '不明';

  // CSV export
  const handleCsvExport = () => {
    const header = ['作業者名', 'タスク名', '科目', '業務内容', 'AI名', 'バージョン', 'メモ', '日時'];
    const rows = filteredLogs.map(l => [
      getUserName(l.userId),
      getTaskName(l.taskId),
      l.subject || getTaskSubject(l.taskId),
      l.workType || getTaskWorkType(l.taskId),
      getModelName(l.aiModelId),
      l.version || '',
      l.note || '',
      l.createdAt ? new Date(l.createdAt).toLocaleString('ja-JP') : '',
    ]);
    const csvContent = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AI使用記録_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs text-gray-500 mb-1">AI使用回数（合計）</p>
          <p className="text-3xl font-bold text-purple-700">{totalCount}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs text-gray-500 mb-1">使用AIモデル数</p>
          <p className="text-3xl font-bold text-blue-700">{modelBreakdown.length}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs text-gray-500 mb-1">使用科目数</p>
          <p className="text-3xl font-bold text-green-700">{subjectBreakdown.length}</p>
        </div>
      </div>

      {/* Charts */}
      {totalCount > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Pie chart: by AI model */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">AIモデル別使用回数</h4>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={modelBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                  {modelBreakdown.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Bar chart: by subject */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">科目別使用回数</h4>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={subjectBreakdown}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" name="回数" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Filters + Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-gray-700">AI使用記録一覧</h4>
          <button
            onClick={handleCsvExport}
            disabled={filteredLogs.length === 0}
            className="text-xs bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg transition"
          >
            CSV出力
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          <select
            value={filterSubject}
            onChange={e => setFilterSubject(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs"
          >
            <option value="">全科目</option>
            {SUBJECTS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={filterAiModel}
            onChange={e => setFilterAiModel(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs"
          >
            <option value="">全AIモデル</option>
            {aiModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <input
            type="date"
            value={filterDateFrom}
            onChange={e => setFilterDateFrom(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs"
            placeholder="開始日"
          />
          <input
            type="date"
            value={filterDateTo}
            onChange={e => setFilterDateTo(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs"
            placeholder="終了日"
          />
          {(filterSubject || filterAiModel || filterDateFrom || filterDateTo) && (
            <button
              onClick={() => { setFilterSubject(''); setFilterAiModel(''); setFilterDateFrom(''); setFilterDateTo(''); }}
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5 border border-gray-200 rounded-lg"
            >
              クリア
            </button>
          )}
        </div>

        {/* Table */}
        {filteredLogs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 border border-gray-200">作業者名</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 border border-gray-200">タスク名</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 border border-gray-200">科目</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 border border-gray-200">業務内容</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 border border-gray-200">AI名</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 border border-gray-200">バージョン</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 border border-gray-200">メモ</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 border border-gray-200">日時</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-xs text-gray-700 border border-gray-200 whitespace-nowrap">{getUserName(log.userId)}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 border border-gray-200 max-w-[200px] truncate">{getTaskName(log.taskId)}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 border border-gray-200 whitespace-nowrap">{log.subject || getTaskSubject(log.taskId)}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 border border-gray-200 whitespace-nowrap">{log.workType || getTaskWorkType(log.taskId)}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 border border-gray-200 whitespace-nowrap">{getModelName(log.aiModelId)}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 border border-gray-200 whitespace-nowrap">{log.version || '-'}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 border border-gray-200 max-w-[200px] truncate">{log.note || '-'}</td>
                    <td className="px-3 py-2 text-xs text-gray-500 border border-gray-200 whitespace-nowrap">
                      {log.createdAt ? new Date(log.createdAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-gray-400 text-center py-8">AI使用記録がありません</p>
        )}
        {filteredLogs.length > 0 && (
          <p className="text-xs text-gray-500 mt-2">{filteredLogs.length}件の記録</p>
        )}
      </div>
    </div>
  );
};

export default AiManagementTab;
