// 評価メトリクス自動計算ユーティリティ
// dataパラメータ経由でデータ取得（Firestore/localStorage両対応）

import { getAll } from './storage.js';

const isFinished = (status) => status === 'completed' || status === 'approved';

// dataが渡されなければlocalStorageフォールバック
const resolveData = (data) => {
  if (data) return data;
  return getAll();
};

/**
 * ユーザーの差し戻し率を計算
 * @param {string} userId
 * @param {string|null} subject
 * @param {Object|null} data - { assignments, tasks, rejections, ... }
 * @returns {number} 0〜1
 */
export const calcRejectionRate = (userId, subject = null, data = null) => {
  const d = resolveData(data);
  const assignments = (d.assignments || []).filter(a => a.userId === userId);
  const tasks = d.tasks || [];

  let relevant = assignments;
  if (subject) {
    relevant = assignments.filter(a => {
      const task = tasks.find(t => t.id === a.taskId);
      return task?.subject === subject;
    });
  }

  const completed = relevant.filter(a => isFinished(a.status) || a.status === 'submitted');
  if (completed.length === 0) return 0;

  const rejections = (d.rejections || []).filter(r => r.userId === userId);
  let relevantRej = rejections;
  if (subject) {
    relevantRej = rejections.filter(r => {
      const task = tasks.find(t => t.id === r.taskId);
      return task?.subject === subject;
    });
  }

  return relevantRej.length / completed.length;
};

/**
 * 重大度加重スコア（低いほど良い）
 */
export const calcSeverityWeightedScore = (userId, subject = null, data = null) => {
  const d = resolveData(data);
  const assignments = (d.assignments || []).filter(a => a.userId === userId);
  const tasks = d.tasks || [];

  let relevant = assignments;
  if (subject) {
    relevant = assignments.filter(a => {
      const task = tasks.find(t => t.id === a.taskId);
      return task?.subject === subject;
    });
  }

  const completed = relevant.filter(a => isFinished(a.status) || a.status === 'submitted');
  if (completed.length === 0) return 0;

  const rejections = (d.rejections || []).filter(r => r.userId === userId);
  const severities = d.rejectionSeverities || [];

  let relevantRej = rejections;
  if (subject) {
    relevantRej = rejections.filter(r => {
      const task = tasks.find(t => t.id === r.taskId);
      return task?.subject === subject;
    });
  }

  const weightedSum = relevantRej.reduce((sum, r) => {
    const sev = severities.find(s => s.id === r.severityId);
    return sum + (sev?.level ?? 1);
  }, 0);

  return weightedSum / completed.length;
};

/**
 * 平均作業時間（タイマーベース、秒/タスク）
 */
export const calcAverageWorkTime = (userId, subject = null, data = null) => {
  const d = resolveData(data);
  const timeLogs = (d.timeLogs || []).filter(l => l.userId === userId && l.endTime);
  const tasks = d.tasks || [];

  let relevant = timeLogs;
  if (subject) {
    relevant = timeLogs.filter(l => {
      const task = tasks.find(t => t.id === l.taskId);
      return task?.subject === subject;
    });
  }

  if (relevant.length === 0) return 0;

  const totalDuration = relevant.reduce((sum, l) => sum + (l.duration || 0), 0);
  const uniqueTasks = new Set(relevant.map(l => l.taskId));

  return uniqueTasks.size > 0 ? totalDuration / uniqueTasks.size : 0;
};

/**
 * 完了タスク数
 */
export const calcCompletedTaskCount = (userId, subject = null, data = null) => {
  const d = resolveData(data);
  const assignments = (d.assignments || []).filter(a => a.userId === userId && isFinished(a.status));

  if (!subject) return assignments.length;

  const tasks = d.tasks || [];
  return assignments.filter(a => {
    const task = tasks.find(t => t.id === a.taskId);
    return task?.subject === subject;
  }).length;
};

/**
 * ユーザーの差し戻し数を計算
 */
export const calcRejectionCount = (userId, subject = null, data = null) => {
  const d = resolveData(data);
  const rejections = (d.rejections || []).filter(r => r.userId === userId);
  if (!subject) return rejections.length;

  const tasks = d.tasks || [];
  return rejections.filter(r => {
    const task = tasks.find(t => t.id === r.taskId);
    return task?.subject === subject;
  }).length;
};

/**
 * 業務種別ごとの平均作業時間（秒/タスク）
 */
export const calcAverageWorkTimeByWorkType = (userId, subject = null, data = null) => {
  const d = resolveData(data);
  const timeLogs = (d.timeLogs || []).filter(l => l.userId === userId && l.endTime);
  const tasks = d.tasks || [];

  let relevant = timeLogs;
  if (subject) {
    relevant = timeLogs.filter(l => {
      const task = tasks.find(t => t.id === l.taskId);
      return task?.subject === subject;
    });
  }

  const taskMap = {};
  relevant.forEach(l => {
    const task = tasks.find(t => t.id === l.taskId);
    const wt = task?.workType || '未設定';
    if (!taskMap[l.taskId]) {
      taskMap[l.taskId] = { workType: wt, duration: 0 };
    }
    taskMap[l.taskId].duration += (l.duration || 0);
  });

  const wtMap = {};
  Object.values(taskMap).forEach(({ workType, duration }) => {
    if (!wtMap[workType]) {
      wtMap[workType] = { totalDuration: 0, taskCount: 0 };
    }
    wtMap[workType].totalDuration += duration;
    wtMap[workType].taskCount += 1;
  });

  return Object.entries(wtMap).map(([workType, v]) => ({
    workType,
    avgTime: v.taskCount > 0 ? v.totalDuration / v.taskCount : 0,
    taskCount: v.taskCount,
  }));
};

/**
 * 全メトリクスを一括計算
 * @param {string} userId
 * @param {string|null} subject
 * @param {Object|null} data - 全データオブジェクト（省略時はlocalStorageフォールバック）
 */
export const calcAllMetrics = (userId, subject = null, data = null) => {
  return {
    rejectionRate: calcRejectionRate(userId, subject, data),
    rejectionCount: calcRejectionCount(userId, subject, data),
    severityScore: calcSeverityWeightedScore(userId, subject, data),
    averageWorkTime: calcAverageWorkTime(userId, subject, data),
    averageWorkTimeByWorkType: calcAverageWorkTimeByWorkType(userId, subject, data),
    taskCount: calcCompletedTaskCount(userId, subject, data),
  };
};

/**
 * メトリクス値を 0〜maxScore のスコアに正規化
 */
export const normalizeMetricToScore = (metricType, value, maxScore, allValues = []) => {
  switch (metricType) {
    case 'rejection_rate': {
      return Math.round(Math.max(0, maxScore * (1 - value)) * 10) / 10;
    }
    case 'severity_score': {
      const maxVal = Math.max(...allValues, 1);
      return Math.round(Math.max(0, maxScore * (1 - value / (maxVal * 2))) * 10) / 10;
    }
    case 'work_time': {
      if (allValues.length === 0 || value === 0) return Math.round(maxScore / 2 * 10) / 10;
      const sorted = [...allValues].filter(v => v > 0).sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)] || value;
      if (median === 0) return Math.round(maxScore / 2 * 10) / 10;
      const deviation = Math.abs(value - median) / median;
      return Math.round(Math.max(0, maxScore * (1 - Math.min(deviation, 1))) * 10) / 10;
    }
    case 'task_count': {
      const maxCount = Math.max(...allValues, 1);
      return Math.round((value / maxCount) * maxScore * 10) / 10;
    }
    default:
      return 0;
  }
};

/**
 * 秒を「X時間Y分」形式に変換
 */
export const formatDuration = (seconds) => {
  if (!seconds || seconds === 0) return '-';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}時間${m}分`;
  if (h > 0) return `${h}時間`;
  return `${m}分`;
};
