import { generateId } from './storage.js';
import { isFinished } from '../contexts/DataContext.jsx';

/**
 * 作業者のタスクに対するスコアを計算する
 * 評価スコア × 0.7 + 空き工数マッチ × 0.3
 */
const calcScore = (corrector, task, evaluations, criteria, allAssignments, capacities) => {
  const totalAvailable = capacities
    .filter(c => c.userId === corrector.id)
    .reduce((sum, c) => sum + c.totalHours, 0);

  const assignedHours = allAssignments
    .filter(a => a.userId === corrector.id && !isFinished(a.status))
    .reduce((sum, a) => sum + a.assignedHours, 0);

  const freeHours = totalAvailable - assignedHours;
  if (freeHours < task.requiredHours) return -1;

  const userEvals = evaluations.filter(e =>
    e.userId === corrector.id && (e.subject === null || e.subject === undefined || e.subject === task.subject)
  );

  let evalSum = 0;
  let evalCount = 0;
  criteria.forEach(crit => {
    const subjectEval = userEvals.find(e => e.criteriaId === crit.id && e.subject === task.subject);
    const generalEval = userEvals.find(e => e.criteriaId === crit.id && (e.subject === null || e.subject === undefined));
    const ev = subjectEval || generalEval;
    if (ev && crit.maxScore > 0) {
      const score = ev.isOverridden ? ev.score : (ev.autoScore ?? ev.score);
      evalSum += score / crit.maxScore;
      evalCount++;
    }
  });
  const normalizedEval = evalCount > 0 ? evalSum / evalCount : 0.5;

  const capacityScore = Math.min(freeHours / (task.requiredHours * 2), 1);

  return normalizedEval * 0.7 + capacityScore * 0.3;
};


/**
 * 振り分けプレビューを生成（保存しない）
 * @param {Object} data - { tasks, users, capacities, evaluations, evaluationCriteria, assignments }
 * @returns {Array} 振り分け案の配列
 */
export const previewAutoAssign = (data) => {
  const tasks = data.tasks || [];
  const pendingTasks = tasks.filter(t => t.status === 'pending' && !t.viking);
  const correctors = (data.users || []).filter(u => u.role === 'corrector');
  const capacities = data.capacities || [];
  const evaluations = data.evaluations || [];
  const criteria = data.evaluationCriteria || [];
  const existingAssignments = data.assignments || [];

  const proposals = [];
  const virtualAssignments = [...existingAssignments];

  pendingTasks.forEach(task => {
    const eligible = correctors.filter(u =>
      (u.subjects ?? []).includes(task.subject)
    );
    if (eligible.length === 0) return;

    const scored = eligible
      .map(u => ({
        user: u,
        score: calcScore(u, task, evaluations, criteria, virtualAssignments, capacities),
      }))
      .filter(({ score }) => score >= 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) return;

    const best = scored[0];
    proposals.push({
      taskId: task.id,
      taskName: task.name,
      subject: task.subject,
      workType: task.workType || '',
      requiredHours: task.requiredHours,
      userId: best.user.id,
      userName: best.user.name,
      assignedHours: task.requiredHours,
      score: best.score,
      eligibleCorrectors: scored.map(s => ({
        id: s.user.id,
        name: s.user.name,
        score: Math.round(s.score * 100) / 100,
      })),
    });

    virtualAssignments.push({
      id: 'preview_' + task.id,
      taskId: task.id,
      userId: best.user.id,
      assignedHours: task.requiredHours,
      status: 'assigned',
    });
  });

  return proposals;
};

/**
 * 確定された振り分けのデータを生成（保存はDataContextが行う）
 * @param {Array<{taskId, userId, assignedHours}>} confirmedAssignments
 * @param {Object} data - { assignments, notifications, tasks, users }
 * @returns {Object} { assignments, tasks, notifications, newAssignments }
 */
export const confirmAutoAssign = (confirmedAssignments, data) => {
  const existingAssignments = data.assignments || [];
  const notifications = data.notifications || [];
  const tasks = data.tasks || [];
  const users = data.users || [];
  const newAssignments = [];
  const newNotifications = [];
  let updatedTasks = [...tasks];

  confirmedAssignments.forEach(({ taskId, userId, assignedHours }) => {
    const task = updatedTasks.find(t => t.id === taskId);
    if (!task || task.status !== 'pending') return;

    const assignment = {
      id: generateId(),
      taskId,
      userId,
      assignedHours: assignedHours || task.requiredHours,
      status: 'assigned',
      assignedAt: new Date().toISOString(),
      note: '自動振り分け',
    };

    newAssignments.push(assignment);
    updatedTasks = updatedTasks.map(t =>
      t.id === taskId ? { ...t, status: 'assigned' } : t
    );

    newNotifications.push({
      id: generateId(),
      userId,
      message: `新しい業務「${task.name}」が割り当てられました（必要工数: ${task.requiredHours}時間、期限: ${task.deadline}）`,
      type: 'assignment',
      relatedId: assignment.id,
      read: false,
      createdAt: new Date().toISOString(),
    });
  });

  return {
    assignments: [...existingAssignments, ...newAssignments],
    tasks: updatedTasks,
    notifications: [...notifications, ...newNotifications],
    newAssignments,
  };
};

/**
 * 未割り当てタスクを自動で振り分ける
 * @param {Object} data - 全データ
 * @returns {Object} { assignments, tasks, notifications, newAssignments }
 */
export const autoAssign = (data) => {
  const tasks = data.tasks || [];
  const pendingTasks = tasks.filter(t => t.status === 'pending' && !t.viking);
  const correctors = (data.users || []).filter(u => u.role === 'corrector');
  const capacities = data.capacities || [];
  const evaluations = data.evaluations || [];
  const criteria = data.evaluationCriteria || [];
  const existingAssignments = data.assignments || [];
  const notifications = data.notifications || [];

  const newAssignments = [];
  const newNotifications = [];
  const allAssignments = [...existingAssignments];
  let updatedTasks = [...tasks];

  pendingTasks.forEach(task => {
    const eligible = correctors.filter(u => (u.subjects ?? []).includes(task.subject));
    if (eligible.length === 0) return;

    const scored = eligible
      .map(u => ({
        user: u,
        score: calcScore(u, task, evaluations, criteria, allAssignments, capacities),
      }))
      .filter(({ score }) => score >= 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) return;

    const best = scored[0].user;
    const assignment = {
      id: generateId(),
      taskId: task.id,
      userId: best.id,
      assignedHours: task.requiredHours,
      status: 'assigned',
      assignedAt: new Date().toISOString(),
      note: '自動振り分け',
    };

    newAssignments.push(assignment);
    allAssignments.push(assignment);

    updatedTasks = updatedTasks.map(t =>
      t.id === task.id ? { ...t, status: 'assigned' } : t
    );

    newNotifications.push({
      id: generateId(),
      userId: best.id,
      message: `新しい業務「${task.name}」が割り当てられました（必要工数: ${task.requiredHours}時間、期限: ${task.deadline}）`,
      type: 'assignment',
      relatedId: assignment.id,
      read: false,
      createdAt: new Date().toISOString(),
    });
  });

  return {
    assignments: [...existingAssignments, ...newAssignments],
    tasks: updatedTasks,
    notifications: [...notifications, ...newNotifications],
    newAssignments,
  };
};

/**
 * 手動振り分け
 * @param {string} taskId
 * @param {string} userId
 * @param {Object} data - { tasks, assignments, notifications }
 * @returns {Object} { assignments, tasks, notifications, newAssignment }
 */
export const manualAssign = (taskId, userId, data) => {
  const tasks = data.tasks || [];
  const task = tasks.find(t => t.id === taskId);
  if (!task) throw new Error('タスクが見つかりません');

  const assignments = (data.assignments || []).filter(a => a.taskId !== taskId);
  const notifications = data.notifications || [];

  const newAssignment = {
    id: generateId(),
    taskId,
    userId,
    assignedHours: task.requiredHours,
    status: 'assigned',
    assignedAt: new Date().toISOString(),
    note: '手動振り分け',
  };

  const newNotification = {
    id: generateId(),
    userId,
    message: `新しい業務「${task.name}」が割り当てられました（必要工数: ${task.requiredHours}時間、期限: ${task.deadline}）`,
    type: 'assignment',
    relatedId: newAssignment.id,
    read: false,
    createdAt: new Date().toISOString(),
  };

  return {
    assignments: [...assignments, newAssignment],
    tasks: tasks.map(t => t.id === taskId ? { ...t, status: 'assigned' } : t),
    notifications: [...notifications, newNotification],
    newAssignment,
  };
};
