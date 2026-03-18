import { isFinished } from '../contexts/DataContext.jsx';

/**
 * 日付文字列を "YYYY-MM-DD" 形式にフォーマットする
 * @param {Date} date
 * @returns {string}
 */
const formatDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * 日付文字列から Date オブジェクトを生成（時刻部分をリセット）
 * @param {string} dateStr - "YYYY-MM-DD" 形式
 * @returns {Date}
 */
const parseDate = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/**
 * 2つの日付間の日数差を計算する（today → target）
 * @param {Date} from
 * @param {Date} to
 * @returns {number}
 */
const daysBetween = (from, to) => {
  const msPerDay = 86400000;
  return Math.ceil((to - from) / msPerDay);
};

/**
 * タスクの予測完了日を計算する
 *
 * アルゴリズム概要:
 * 1. 対象タスクのアクティブなアサインメントを検索
 * 2. 担当者のキャパシティ（稼働可能時間）を取得
 * 3. 担当者の他のアクティブタスクの工数を考慮
 * 4. 日別シミュレーションで完了予測日を算出
 * 5. 締切との比較でステータスを判定
 *
 * @param {string} taskId - タスクID
 * @param {Array} allAssignments - 全アサインメント
 * @param {Array} allCapacities - 全キャパシティ
 * @param {Array} allTasks - 全タスク
 * @returns {Object} { predictedDate, status, daysRemaining, deadline, remainingHours }
 */
export const predictCompletionDate = (taskId, allAssignments, allCapacities, allTasks) => {
  // --- ステップ1: 対象タスクのアサインメントを検索 ---
  const taskAssignments = allAssignments.filter((a) => a.taskId === taskId);

  // アクティブなアサインメント（完了・提出済み以外）を探す
  const activeAssignment = taskAssignments.find(
    (a) => !isFinished(a.status) && a.status !== 'submitted'
  );

  // --- ステップ2: アクティブなアサインメントがない場合の処理 ---
  if (!activeAssignment) {
    // 提出済み（レビュー待ち）のアサインメントがあるか
    const submittedAssignment = taskAssignments.find((a) => a.status === 'submitted');
    if (submittedAssignment) {
      return { status: 'submitted' };
    }

    // 完了済みのアサインメントがあるか
    const finishedAssignment = taskAssignments.find((a) => isFinished(a.status));
    if (finishedAssignment) {
      return { status: 'completed' };
    }

    // アサインメント自体が存在しない
    return { status: 'unassigned' };
  }

  // --- ステップ3: タスク情報を取得 ---
  const task = allTasks.find((t) => t.id === taskId);
  if (!task) {
    return { status: 'unassigned' };
  }

  const deadline = task.deadline || null;

  // --- ステップ4: 残り工数を算出 ---
  // actualHours は提出時にのみ設定されるため、assignedHours を残り工数とする
  const remainingHours = Number(activeAssignment.assignedHours) || 0;

  if (remainingHours <= 0) {
    return {
      predictedDate: formatDate(new Date()),
      status: 'on_track',
      daysRemaining: 0,
      deadline,
      remainingHours: 0,
    };
  }

  // --- ステップ5: 担当者のキャパシティを取得 ---
  const today = new Date();
  const todayStr = formatDate(today);

  // 今日以降に有効なキャパシティエントリのみ取得
  const correctorCapacities = allCapacities.filter(
    (c) => c.userId === activeAssignment.userId && c.endDate >= todayStr
  );

  // --- ステップ6: 担当者の他のアクティブタスクを取得 ---
  const otherActiveAssignments = allAssignments.filter(
    (a) =>
      a.userId === activeAssignment.userId &&
      a.taskId !== taskId &&
      !isFinished(a.status) &&
      a.status !== 'submitted'
  );

  // 他のアクティブタスクの合計工数
  const otherActiveHours = otherActiveAssignments.reduce(
    (sum, a) => sum + (Number(a.assignedHours) || 0),
    0
  );

  // --- ステップ7: 将来のキャパシティがある日数を事前計算 ---
  // まず180日分のキャパシティマップを作成
  const MAX_DAYS = 180;
  const dailyCapacities = [];

  for (let i = 0; i < MAX_DAYS; i++) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + i);
    const targetStr = formatDate(targetDate);

    // この日にカバーするキャパシティエントリの hoursPerDay を合算
    let dailyHours = 0;
    for (const cap of correctorCapacities) {
      if (cap.startDate <= targetStr && targetStr <= cap.endDate) {
        dailyHours += Number(cap.hoursPerDay) || 0;
      }
    }

    dailyCapacities.push({
      date: targetDate,
      dateStr: targetStr,
      capacity: dailyHours,
    });
  }

  // キャパシティがある日の総数を算出（他タスク按分用）
  const totalCapacityDays = dailyCapacities.filter((d) => d.capacity > 0).length;

  // 他タスクの工数を、キャパシティがある日に按分配分
  // 各日に均等に割り当てる
  const dailyOtherShare =
    totalCapacityDays > 0 ? otherActiveHours / totalCapacityDays : 0;

  // --- ステップ8: 日別シミュレーション ---
  let hoursLeft = remainingHours;
  let predictedDate = null;

  for (let i = 0; i < MAX_DAYS; i++) {
    const day = dailyCapacities[i];

    if (day.capacity <= 0) {
      // キャパシティがない日はスキップ
      continue;
    }

    // このタスクに使える時間 = 日のキャパシティ - 他タスクの按分
    const availableForTask = Math.max(0, day.capacity - dailyOtherShare);

    if (availableForTask > 0) {
      hoursLeft -= availableForTask;
    }

    // 残り工数がゼロ以下になったら完了予測日が確定
    if (hoursLeft <= 0) {
      predictedDate = formatDate(day.date);
      break;
    }
  }

  // --- ステップ9: 180日以内に完了しない場合 ---
  if (predictedDate === null) {
    return {
      predictedDate: null,
      status: 'insufficient',
      daysRemaining: null,
      deadline,
      remainingHours,
    };
  }

  // --- ステップ10: 締切との比較でステータスを判定 ---
  const predictedDateObj = parseDate(predictedDate);
  const daysRemaining = daysBetween(today, predictedDateObj);

  let status;
  if (!deadline) {
    // 締切が設定されていない場合は on_track とする
    status = 'on_track';
  } else {
    const deadlineDate = parseDate(deadline);
    const daysOverDeadline = daysBetween(deadlineDate, predictedDateObj);

    if (daysOverDeadline <= 0) {
      // 予測完了日が締切以前 → 順調
      status = 'on_track';
    } else if (daysOverDeadline <= 2) {
      // 締切を2日以内に超過 → 注意
      status = 'at_risk';
    } else {
      // 締切を2日以上超過 → 遅延
      status = 'overdue';
    }
  }

  // --- ステップ11: 結果を返却 ---
  return {
    predictedDate,
    status,
    daysRemaining,
    deadline,
    remainingHours,
  };
};

/**
 * 全アクティブタスクの予測を一括計算する
 *
 * アクティブなステータス（assigned, in_progress, rejected, submitted）を持つ
 * アサインメントが存在するタスクを対象に予測を実行し、
 * 予測完了日の昇順でソートして返す。
 *
 * @param {Array} allAssignments - 全アサインメント
 * @param {Array} allCapacities - 全キャパシティ
 * @param {Array} allTasks - 全タスク
 * @returns {Array} 予測結果の配列（taskId, taskName を含む）
 */
export const predictAllTasks = (allAssignments, allCapacities, allTasks) => {
  // アクティブなアサインメントが存在するステータス
  const activeStatuses = ['assigned', 'in_progress', 'rejected', 'submitted'];

  // アクティブなアサインメントを持つタスクIDを抽出（重複排除）
  const activeTaskIds = [
    ...new Set(
      allAssignments
        .filter((a) => activeStatuses.includes(a.status))
        .map((a) => a.taskId)
    ),
  ];

  // 各タスクの予測を実行
  const predictions = activeTaskIds.map((taskId) => {
    const task = allTasks.find((t) => t.id === taskId);
    const prediction = predictCompletionDate(
      taskId,
      allAssignments,
      allCapacities,
      allTasks
    );

    return {
      taskId,
      taskName: task?.name || '不明',
      ...prediction,
    };
  });

  // 予測完了日の昇順でソート
  // predictedDate が null のもの（insufficient, submitted 等）は末尾に配置
  return predictions.sort((a, b) => {
    if (!a.predictedDate && !b.predictedDate) return 0;
    if (!a.predictedDate) return 1;
    if (!b.predictedDate) return -1;
    return a.predictedDate.localeCompare(b.predictedDate);
  });
};

/**
 * 科目単位の完了予測
 * subject のアクティブタスクを全て集計し、該当科目スキルを持つ作業者のキャパシティで
 * いつ全タスクが終わるかシミュレーションする
 */
export function predictSubjectCompletion(subject, allAssignments, allCapacities, allTasks, allUsers) {
  const _isFinished = (s) => s === 'completed' || s === 'approved';

  // 1. Find active tasks for this subject
  const activeTasks = allTasks.filter(t => t.subject === subject && !_isFinished(t.status));
  if (activeTasks.length === 0) {
    return { subject, totalTasks: 0, totalSchools: 0, totalRemainingHours: 0, totalAvailableHours: 0, predictedDate: null, status: 'completed', assignedCorrectors: 0 };
  }

  // 2. Calculate remaining hours
  let totalRemainingHours = 0;
  for (const task of activeTasks) {
    const assignment = allAssignments.find(a => a.taskId === task.id && !_isFinished(a.status));
    if (assignment && (assignment.status === 'submitted')) continue; // submitted tasks excluded from remaining
    totalRemainingHours += Number(task.requiredHours) || 0;
  }

  // 3. Count unique schools from task names
  const schoolNames = new Set(activeTasks.map(t => t.name.split(' ')[0]));
  const totalSchools = schoolNames.size;

  // 4. Find correctors with this subject skill
  const correctors = allUsers.filter(u => u.role === 'corrector' && (u.subjects ?? []).includes(subject));
  const assignedCorrectors = correctors.length;

  // 5. Latest deadline
  const deadlines = activeTasks.filter(t => t.deadline).map(t => t.deadline).sort();
  const latestDeadline = deadlines.length > 0 ? deadlines[deadlines.length - 1] : null;

  // 6. Day-by-day simulation (180 days max)
  const today = new Date();
  today.setHours(0,0,0,0);
  const MAX_DAYS = 180;
  let hoursLeft = totalRemainingHours;
  let predictedDate = null;
  let totalAvailableHours = 0;

  for (let i = 0; i < MAX_DAYS; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dStr = d.toISOString().slice(0, 10);

    // Sum capacity from all correctors for this day
    let dailyCapacity = 0;
    for (const corr of correctors) {
      const userCaps = allCapacities.filter(c => c.userId === corr.id);
      for (const cap of userCaps) {
        if (dStr >= cap.startDate && dStr <= cap.endDate) {
          // Divide capacity by number of subjects this corrector handles
          const subjectCount = (corr.subjects ?? []).length || 1;
          dailyCapacity += (Number(cap.hoursPerDay) || 0) / subjectCount;
        }
      }
    }

    totalAvailableHours += dailyCapacity;

    if (dailyCapacity > 0 && hoursLeft > 0) {
      hoursLeft -= dailyCapacity;
      if (hoursLeft <= 0) {
        predictedDate = dStr;
        break;
      }
    }
  }

  // 7. Determine status
  let status = 'insufficient';
  if (predictedDate) {
    if (!latestDeadline) {
      status = 'on_track';
    } else if (predictedDate <= latestDeadline) {
      status = 'on_track';
    } else {
      const diff = Math.ceil((new Date(predictedDate) - new Date(latestDeadline)) / 86400000);
      status = diff <= 2 ? 'at_risk' : 'overdue';
    }
  }

  return {
    subject,
    totalTasks: activeTasks.length,
    totalSchools,
    totalRemainingHours: Math.round(totalRemainingHours * 10) / 10,
    totalAvailableHours: Math.round(totalAvailableHours * 10) / 10,
    predictedDate,
    latestDeadline,
    status,
    assignedCorrectors,
  };
}

/**
 * 全科目の完了予測を一括計算
 */
export function predictAllSubjects(allAssignments, allCapacities, allTasks, allUsers) {
  const subjects = [...new Set(allTasks.map(t => t.subject).filter(Boolean))];
  return subjects
    .map(s => predictSubjectCompletion(s, allAssignments, allCapacities, allTasks, allUsers))
    .filter(p => p.totalTasks > 0)
    .sort((a, b) => {
      const order = { overdue: 0, at_risk: 1, insufficient: 2, on_track: 3, completed: 4 };
      return (order[a.status] ?? 5) - (order[b.status] ?? 5);
    });
}
