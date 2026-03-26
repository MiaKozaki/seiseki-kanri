import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { get, save, getAll, generateId, generateInitialPassword, generateManagementId } from '../utils/storage.js';
import { deleteAttachmentsByAssignment } from '../utils/fileStorage.js';

const DataContext = createContext(null);

const calcDays = (startDate, endDate) => {
  const s = new Date(startDate);
  const e = new Date(endDate);
  return Math.ceil(Math.abs(e - s) / 86400000) + 1;
};

/** 完了判定ヘルパー（後方互換: 旧 'completed' も含む） */
export const isFinished = (status) => status === 'completed' || status === 'approved';

// No-op: Firestore removed
const fsWrite = () => {};

export const DataProvider = ({ children }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const forceRefresh = useCallback(() => setTick(t => t + 1), []);
  const initialized = useRef(false);

  // 初期化: localStorage からデータロード
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    setData(getAll());
    setLoading(false);
  }, []);

  // --- ヘルパー: state + Firestore + localStorage に書き込み ---
  const updateCollection = useCallback((key, newValue) => {
    setData(prev => {
      const updated = { ...prev, [key]: newValue };
      save(key, newValue); // localStorage cache
      return updated;
    });
  }, []);

  const updateMultipleCollections = useCallback((updates) => {
    setData(prev => {
      const next = { ...prev };
      Object.entries(updates).forEach(([key, value]) => {
        next[key] = value;
        save(key, value);
      });
      return next;
    });
  }, []);

  // データ未ロード時の安全なget
  const d = (key) => (data ? data[key] : get(key)) || [];

  // ---- Users ----
  const getUsers = () => d('users');
  const getCorrectors = () => d('users').filter(u => u.role === 'corrector');

  const addUser = (userData) => {
    const users = d('users');
    const tempPassword = generateInitialPassword();
    const newUser = {
      ...userData,
      id: generateId(),
      managementId: userData.managementId || generateManagementId(userData.role || 'corrector'),
      password: btoa(tempPassword),
      mustChangePassword: true,
      createdAt: new Date().toISOString(),
    };
    delete newUser.passwordInput;
    updateCollection('users', [...users, newUser]);
    fsWrite(() => saveDocument('users', newUser));
    forceRefresh();
    return { ...newUser, _tempPassword: tempPassword };
  };

  const updateUser = (id, updates) => {
    updateCollection('users', d('users').map(u => u.id === id ? { ...u, ...updates } : u));
    const cu = localStorage.getItem('current_user');
    if (cu) {
      const parsed = JSON.parse(cu);
      if (parsed.id === id) localStorage.setItem('current_user', JSON.stringify({ ...parsed, ...updates }));
    }
    fsWrite(() => {
      const user = d('users').find(u => u.id === id);
      if (user) return saveDocument('users', { ...user, ...updates });
      return Promise.resolve();
    });
    forceRefresh();
  };

  const deleteUser = (id) => {
    const capsToDelete = d('capacities').filter(c => c.userId === id).map(c => c.id);
    const assignsToDelete = d('assignments').filter(a => a.userId === id).map(a => a.id);
    const evalsToDelete = d('evaluations').filter(e => e.userId === id).map(e => e.id);

    updateMultipleCollections({
      users: d('users').filter(u => u.id !== id),
      capacities: d('capacities').filter(c => c.userId !== id),
      assignments: d('assignments').filter(a => a.userId !== id),
      evaluations: d('evaluations').filter(e => e.userId !== id),
    });

    fsWrite(async () => {
      const ops = [{ type: 'delete', collection: 'users', id }];
      capsToDelete.forEach(cid => ops.push({ type: 'delete', collection: 'capacities', id: cid }));
      assignsToDelete.forEach(aid => ops.push({ type: 'delete', collection: 'assignments', id: aid }));
      evalsToDelete.forEach(eid => ops.push({ type: 'delete', collection: 'evaluations', id: eid }));
      if (ops.length > 0) await batchWrite(ops);
    });
    forceRefresh();
  };

  const resetUserPassword = (userId) => {
    const tempPassword = generateInitialPassword();
    const users = d('users');
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) return null;
    const updated = [...users];
    updated[userIndex] = { ...updated[userIndex], password: btoa(tempPassword), mustChangePassword: true };
    updateCollection('users', updated);
    fsWrite(() => saveDocument('users', updated[userIndex]));
    forceRefresh();
    return tempPassword;
  };

  // ---- Schools ----
  const getSchools = () => d('schools');

  const addSchool = (name) => {
    const newSchool = { id: generateId(), name };
    updateCollection('schools', [...d('schools'), newSchool]);
    fsWrite(() => saveDocument('schools', newSchool));
    forceRefresh();
    return newSchool;
  };

  const deleteSchool = (id) => {
    const etToDelete = d('examTypes').filter(et => et.schoolId === id).map(et => et.id);
    updateMultipleCollections({
      schools: d('schools').filter(s => s.id !== id),
      examTypes: d('examTypes').filter(et => et.schoolId !== id),
    });
    fsWrite(async () => {
      const ops = [{ type: 'delete', collection: 'schools', id }];
      etToDelete.forEach(eid => ops.push({ type: 'delete', collection: 'examTypes', id: eid }));
      await batchWrite(ops);
    });
    forceRefresh();
  };

  // ---- Exam Types ----
  const getExamTypes = () => d('examTypes');

  const addExamType = (schoolId, subject) => {
    const newET = { id: generateId(), schoolId, subject };
    updateCollection('examTypes', [...d('examTypes'), newET]);
    fsWrite(() => saveDocument('examTypes', newET));
    forceRefresh();
    return newET;
  };

  const deleteExamType = (id) => {
    updateCollection('examTypes', d('examTypes').filter(et => et.id !== id));
    fsWrite(() => deleteDocument('examTypes', id));
    forceRefresh();
  };

  // ---- Capacities ----
  const getCapacities = (userId = null) => {
    const caps = d('capacities');
    return userId ? caps.filter(c => c.userId === userId) : caps;
  };

  const addCapacity = (capData) => {
    const days = calcDays(capData.startDate, capData.endDate);
    const newCap = {
      ...capData,
      id: generateId(),
      totalHours: days * Number(capData.hoursPerDay),
      createdAt: new Date().toISOString(),
    };
    updateCollection('capacities', [...d('capacities'), newCap]);
    fsWrite(() => saveDocument('capacities', newCap));
    forceRefresh();
    return newCap;
  };

  const deleteCapacity = (id) => {
    updateCollection('capacities', d('capacities').filter(c => c.id !== id));
    fsWrite(() => deleteDocument('capacities', id));
    forceRefresh();
  };

  // ---- Tasks ----
  const getTasks = () => d('tasks');

  const addTask = (taskData) => {
    const newTask = { ...taskData, id: generateId(), status: 'pending', createdAt: new Date().toISOString() };
    updateCollection('tasks', [...d('tasks'), newTask]);
    fsWrite(() => saveDocument('tasks', newTask));
    forceRefresh();
    return newTask;
  };

  const updateTask = (id, updates) => {
    const updatedTasks = d('tasks').map(t => t.id === id ? { ...t, ...updates } : t);
    updateCollection('tasks', updatedTasks);
    fsWrite(() => {
      const task = updatedTasks.find(t => t.id === id);
      if (task) return saveDocument('tasks', task);
      return Promise.resolve();
    });
    forceRefresh();
  };

  const deleteTask = (id) => {
    const assignsToDelete = d('assignments').filter(a => a.taskId === id).map(a => a.id);
    updateMultipleCollections({
      tasks: d('tasks').filter(t => t.id !== id),
      assignments: d('assignments').filter(a => a.taskId !== id),
    });
    fsWrite(async () => {
      const ops = [{ type: 'delete', collection: 'tasks', id }];
      assignsToDelete.forEach(aid => ops.push({ type: 'delete', collection: 'assignments', id: aid }));
      await batchWrite(ops);
    });
    forceRefresh();
  };

  // ---- Assignments ----
  const getAssignments = (userId = null) => {
    const a = d('assignments');
    return userId ? a.filter(x => x.userId === userId) : a;
  };

  const updateAssignment = (id, updates) => {
    const updatedAssignments = d('assignments').map(a => a.id === id ? { ...a, ...updates } : a);
    const assignment = updatedAssignments.find(a => a.id === id);
    if (!assignment) {
      updateCollection('assignments', updatedAssignments);
      forceRefresh();
      return;
    }

    const batchOps = [];
    const collectionUpdates = { assignments: updatedAssignments };

    batchOps.push({ type: 'set', collection: 'assignments', id, data: (() => { const { id: _, ...rest } = { ...assignment, ...updates }; return rest; })() });

    // 作業者が作業停止 → task を assigned に戻す
    if (updates.status === 'assigned') {
      const updatedTasks = d('tasks').map(t => t.id === assignment.taskId ? { ...t, status: 'assigned' } : t);
      collectionUpdates.tasks = updatedTasks;
      const task = updatedTasks.find(t => t.id === assignment.taskId);
      batchOps.push({ type: 'set', collection: 'tasks', id: assignment.taskId, data: { ...task, id: undefined, status: 'assigned' } });
    }

    // 作業者が作業開始 → task を in_progress に
    if (updates.status === 'in_progress') {
      const updatedTasks = d('tasks').map(t => t.id === assignment.taskId ? { ...t, status: 'in_progress' } : t);
      collectionUpdates.tasks = updatedTasks;
      const task = updatedTasks.find(t => t.id === assignment.taskId);
      batchOps.push({ type: 'set', collection: 'tasks', id: assignment.taskId, data: { ...task, id: undefined, status: 'in_progress' } });
    }

    // 作業者が提出 → task を submitted に + リーダーに通知
    if (updates.status === 'submitted') {
      const updatedTasks = d('tasks').map(t => t.id === assignment.taskId ? { ...t, status: 'submitted' } : t);
      collectionUpdates.tasks = updatedTasks;

      const task = updatedTasks.find(t => t.id === assignment.taskId);
      batchOps.push({ type: 'set', collection: 'tasks', id: assignment.taskId, data: { ...task, id: undefined, status: 'submitted' } });

      const leaders = d('users').filter(u => u.role === 'leader');
      const corrector = d('users').find(u => u.id === assignment.userId);
      const newNotifs = leaders.map(l => ({
        id: generateId(), userId: l.id,
        message: `${corrector?.name ?? '不明'}が「${task?.name ?? '不明'}」を提出しました（検証をお願いします）`,
        type: 'submission', relatedId: id, read: false, createdAt: new Date().toISOString(),
      }));
      collectionUpdates.notifications = [...d('notifications'), ...newNotifs];
      newNotifs.forEach(n => batchOps.push({ type: 'set', collection: 'notifications', id: n.id, data: (() => { const { id: _, ...r } = n; return r; })() }));
    }

    // リーダーが承認
    if (updates.status === 'approved') {
      const task = d('tasks').find(t => t.id === assignment.taskId);

      // 新年度試験種の場合: 格納確認待ちにする（完了にしない）
      if (task?.workType === '新年度試験種') {
        const updatedTasks = d('tasks').map(t => t.id === assignment.taskId ? { ...t, status: 'approved' } : t);
        collectionUpdates.tasks = updatedTasks;
        batchOps.push({ type: 'set', collection: 'tasks', id: assignment.taskId, data: { ...updatedTasks.find(t => t.id === assignment.taskId), id: undefined, status: 'approved' } });

        // assignmentにstorageStatusを付与
        const idx = collectionUpdates.assignments.findIndex(a => a.id === id);
        if (idx !== -1) {
          collectionUpdates.assignments[idx] = { ...collectionUpdates.assignments[idx], storageStatus: 'pending_storage' };
          batchOps.push({ type: 'set', collection: 'assignments', id, data: (() => { const { id: _, ...rest } = collectionUpdates.assignments[idx]; return rest; })() });
        }
      } else {
        const updatedTasks = d('tasks').map(t => t.id === assignment.taskId ? { ...t, status: 'completed' } : t);
        collectionUpdates.tasks = updatedTasks;
        batchOps.push({ type: 'set', collection: 'tasks', id: assignment.taskId, data: { ...updatedTasks.find(t => t.id === assignment.taskId), id: undefined, status: 'completed' } });
      }

      const notif = {
        id: generateId(), userId: assignment.userId,
        message: `「${task?.name ?? '不明'}」が承認されました${task?.workType === '新年度試験種' ? '（格納確認待ち）' : ''}`,
        type: 'approved', relatedId: id, read: false, createdAt: new Date().toISOString(),
      };
      collectionUpdates.notifications = [...(collectionUpdates.notifications || d('notifications')), notif];
      batchOps.push({ type: 'set', collection: 'notifications', id: notif.id, data: (() => { const { id: _, ...r } = notif; return r; })() });
    }

    // リーダーが差し戻し
    if (updates.status === 'rejected') {
      const updatedTasks = d('tasks').map(t => t.id === assignment.taskId ? { ...t, status: 'assigned' } : t);
      collectionUpdates.tasks = updatedTasks;

      const task = updatedTasks.find(t => t.id === assignment.taskId);
      batchOps.push({ type: 'set', collection: 'tasks', id: assignment.taskId, data: { ...task, id: undefined, status: 'assigned' } });

      // 差し戻し詳細記録
      if (updates.rejectionDetails?.length > 0) {
        const newRejections = updates.rejectionDetails.map(detail => ({
          id: generateId(),
          assignmentId: id,
          taskId: assignment.taskId,
          userId: assignment.userId,
          categoryId: detail.categoryId,
          severityId: detail.severityId,
          note: detail.note || '',
          rejectedBy: detail.rejectedBy,
          createdAt: new Date().toISOString(),
        }));
        collectionUpdates.rejections = [...d('rejections'), ...newRejections];
        newRejections.forEach(r => batchOps.push({ type: 'set', collection: 'rejections', id: r.id, data: (() => { const { id: _, ...rest } = r; return rest; })() }));
      }

      // 通知
      const categories = d('rejectionCategories');
      const categoryNames = (updates.rejectionDetails || [])
        .map(dd => categories.find(c => c.id === dd.categoryId)?.name)
        .filter(Boolean)
        .join('、');

      const notif = {
        id: generateId(), userId: assignment.userId,
        message: `「${task?.name ?? '不明'}」が差し戻されました${categoryNames ? '（' + categoryNames + '）' : ''}${updates.reviewNote ? ': ' + updates.reviewNote : ''}`,
        type: 'rejected', relatedId: id, read: false, createdAt: new Date().toISOString(),
      };
      collectionUpdates.notifications = [...(collectionUpdates.notifications || d('notifications')), notif];
      batchOps.push({ type: 'set', collection: 'notifications', id: notif.id, data: (() => { const { id: _, ...r } = notif; return r; })() });
    }

    // 後方互換
    if (updates.status === 'completed') {
      const updatedTasks = d('tasks').map(t => t.id === assignment.taskId ? { ...t, status: 'completed' } : t);
      collectionUpdates.tasks = updatedTasks;
      batchOps.push({ type: 'set', collection: 'tasks', id: assignment.taskId, data: { ...updatedTasks.find(t => t.id === assignment.taskId), id: undefined, status: 'completed' } });
    }

    updateMultipleCollections(collectionUpdates);
    fsWrite(() => batchWrite(batchOps));
    forceRefresh();
  };

  const deleteAssignment = (id) => {
    const assignment = d('assignments').find(a => a.id === id);
    const updates = { assignments: d('assignments').filter(a => a.id !== id) };

    if (assignment) {
      updates.tasks = d('tasks').map(t => t.id === assignment.taskId ? { ...t, status: 'pending' } : t);
      if (assignment.attachments?.length > 0) {
        deleteAttachmentsByAssignment(id).catch(() => {});
      }
    }

    updateMultipleCollections(updates);
    fsWrite(async () => {
      const ops = [{ type: 'delete', collection: 'assignments', id }];
      if (assignment) {
        const task = d('tasks').find(t => t.id === assignment.taskId);
        if (task) ops.push({ type: 'set', collection: 'tasks', id: assignment.taskId, data: { ...task, id: undefined, status: 'pending' } });
      }
      await batchWrite(ops);
    });
    forceRefresh();
  };

  // ---- 格納確認（新年度試験種 → takos作成タスク自動生成） ----
  const confirmStorage = (assignmentId) => {
    const assignment = d('assignments').find(a => a.id === assignmentId);
    if (!assignment) return;
    const task = d('tasks').find(t => t.id === assignment.taskId);
    if (!task) return;

    const batchOps = [];
    const collectionUpdates = {};

    // 1. assignmentのstorageStatusを'stored'に更新、タスクを完了に
    const updatedAssignments = d('assignments').map(a =>
      a.id === assignmentId ? { ...a, storageStatus: 'stored', storedAt: new Date().toISOString() } : a
    );
    collectionUpdates.assignments = updatedAssignments;
    const updatedAssignment = updatedAssignments.find(a => a.id === assignmentId);
    batchOps.push({ type: 'set', collection: 'assignments', id: assignmentId, data: (() => { const { id: _, ...rest } = updatedAssignment; return rest; })() });

    const updatedTasks = d('tasks').map(t =>
      t.id === assignment.taskId ? { ...t, status: 'completed' } : t
    );

    // 2. takos作成タスクを自動生成
    const takosTaskId = generateId();
    const takosTask = {
      id: takosTaskId,
      name: `${task.name} takos作成`,
      subject: task.subject,
      workType: 'takos作成',
      viking: true,
      macroTask: true,
      requiredHours: 1,
      linkedTaskId: task.id,
      deadline: task.deadline || '',
      sheetsUrl: '',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    collectionUpdates.tasks = [...updatedTasks, takosTask];
    batchOps.push({ type: 'set', collection: 'tasks', id: assignment.taskId, data: { ...updatedTasks.find(t => t.id === assignment.taskId), id: undefined, status: 'completed' } });
    batchOps.push({ type: 'set', collection: 'tasks', id: takosTaskId, data: (() => { const { id: _, ...rest } = takosTask; return rest; })() });

    // 3. マクロ作業者に通知
    const macroWorkers = d('users').filter(u => u.role === 'corrector' && (u.subjects ?? []).includes('マクロ'));
    const newNotifs = macroWorkers.map(w => ({
      id: generateId(), userId: w.id,
      message: `新しいtakos作成タスク「${takosTask.name}」が利用可能です（VIKING）`,
      type: 'viking_task', relatedId: takosTaskId, read: false, createdAt: new Date().toISOString(),
    }));
    collectionUpdates.notifications = [...d('notifications'), ...newNotifs];
    newNotifs.forEach(n => batchOps.push({ type: 'set', collection: 'notifications', id: n.id, data: (() => { const { id: _, ...r } = n; return r; })() }));

    updateMultipleCollections(collectionUpdates);
    fsWrite(() => batchWrite(batchOps));
    forceRefresh();
  };

  // ---- Evaluation Criteria ----
  const getEvaluationCriteria = () => d('evaluationCriteria');

  const addEvaluationCriteria = (critData) => {
    const newCrit = { ...critData, id: generateId() };
    updateCollection('evaluationCriteria', [...d('evaluationCriteria'), newCrit]);
    fsWrite(() => saveDocument('evaluationCriteria', newCrit));
    forceRefresh();
    return newCrit;
  };

  const updateEvaluationCriteria = (id, updates) => {
    const updated = d('evaluationCriteria').map(c => c.id === id ? { ...c, ...updates } : c);
    updateCollection('evaluationCriteria', updated);
    fsWrite(() => {
      const crit = updated.find(c => c.id === id);
      if (crit) return saveDocument('evaluationCriteria', crit);
      return Promise.resolve();
    });
    forceRefresh();
  };

  const deleteEvaluationCriteria = (id) => {
    const evalsToDelete = d('evaluations').filter(e => e.criteriaId === id).map(e => e.id);
    updateMultipleCollections({
      evaluationCriteria: d('evaluationCriteria').filter(c => c.id !== id),
      evaluations: d('evaluations').filter(e => e.criteriaId !== id),
    });
    fsWrite(async () => {
      const ops = [{ type: 'delete', collection: 'evaluationCriteria', id }];
      evalsToDelete.forEach(eid => ops.push({ type: 'delete', collection: 'evaluations', id: eid }));
      await batchWrite(ops);
    });
    forceRefresh();
  };

  // ---- Evaluations ----
  const getEvaluations = (userId = null) => {
    const evals = d('evaluations');
    return userId ? evals.filter(e => e.userId === userId) : evals;
  };

  const setEvaluation = (userId, criteriaId, score, note = '') => {
    const evals = [...d('evaluations')];
    const idx = evals.findIndex(e => e.userId === userId && e.criteriaId === criteriaId);
    const obj = { id: idx >= 0 ? evals[idx].id : generateId(), userId, criteriaId, score: Number(score), note, updatedAt: new Date().toISOString() };
    if (idx >= 0) evals[idx] = obj;
    else evals.push(obj);
    updateCollection('evaluations', evals);
    fsWrite(() => saveDocument('evaluations', obj));
    forceRefresh();
  };

  // ---- Exam Inputs ----
  const getExamInputs = (taskId = null) => {
    const all = d('examInputs');
    return taskId ? all.filter(e => e.taskId === taskId) : all;
  };

  const saveExamInput = (inputData) => {
    const all = [...d('examInputs')];
    const idx = all.findIndex(e => e.id === inputData.id);
    const now = new Date().toISOString();
    const obj = { ...inputData, updatedAt: now };
    if (idx >= 0) {
      all[idx] = obj;
    } else {
      obj.createdAt = obj.createdAt ?? now;
      all.push(obj);
    }
    updateCollection('examInputs', all);
    fsWrite(() => saveDocument('examInputs', obj));
    forceRefresh();
    return obj;
  };

  const deleteExamInput = (id) => {
    updateCollection('examInputs', d('examInputs').filter(e => e.id !== id));
    fsWrite(() => deleteDocument('examInputs', id));
    forceRefresh();
  };

  // ---- Recruitments (業務募集) ----
  const getRecruitments = (status = null) => {
    const all = d('recruitments');
    return status ? all.filter(r => r.status === status) : all;
  };

  const addRecruitment = (recData) => {
    const newRec = { ...recData, id: generateId(), status: 'open', createdAt: new Date().toISOString(), closedAt: null };
    const correctors = d('users').filter(u => u.role === 'corrector' && (u.subjects ?? []).includes(recData.subject));
    const newNotifs = correctors.map(c => ({
      id: generateId(), userId: c.id,
      message: `新しい業務募集「${recData.title}」が掲載されました（${recData.subject} · ${recData.requiredHours}h）`,
      type: 'recruitment', relatedId: newRec.id, read: false, createdAt: new Date().toISOString(),
    }));
    updateMultipleCollections({
      recruitments: [...d('recruitments'), newRec],
      notifications: [...d('notifications'), ...newNotifs],
    });
    fsWrite(async () => {
      await saveDocument('recruitments', newRec);
      if (newNotifs.length > 0) await saveMultipleDocuments('notifications', newNotifs);
    });
    forceRefresh();
    return newRec;
  };

  const closeRecruitment = (id) => {
    const now = new Date().toISOString();
    updateMultipleCollections({
      recruitments: d('recruitments').map(r => r.id === id ? { ...r, status: 'closed', closedAt: now } : r),
      applications: d('applications').map(a =>
        a.recruitmentId === id && a.status === 'pending'
          ? { ...a, status: 'rejected', reviewedAt: now, reviewNote: '募集終了' }
          : a
      ),
    });
    fsWrite(async () => {
      const rec = d('recruitments').find(r => r.id === id);
      if (rec) await saveDocument('recruitments', { ...rec, status: 'closed', closedAt: now });
      const appsToReject = d('applications').filter(a => a.recruitmentId === id && a.status === 'pending');
      if (appsToReject.length > 0) {
        await saveMultipleDocuments('applications', appsToReject.map(a => ({ ...a, status: 'rejected', reviewedAt: now, reviewNote: '募集終了' })));
      }
    });
    forceRefresh();
  };

  // ---- Applications (応募) ----
  const getApplications = (recruitmentId = null) => {
    const all = d('applications');
    return recruitmentId ? all.filter(a => a.recruitmentId === recruitmentId) : all;
  };

  const addApplication = (appData) => {
    const newApp = { ...appData, id: generateId(), status: 'pending', appliedAt: new Date().toISOString(), reviewedAt: null, reviewNote: '' };
    const leaders = d('users').filter(u => u.role === 'leader');
    const applicant = d('users').find(u => u.id === appData.userId);
    const recruitment = d('recruitments').find(r => r.id === appData.recruitmentId);
    const newNotifs = leaders.map(l => ({
      id: generateId(), userId: l.id,
      message: `${applicant?.name ?? '不明'}が「${recruitment?.title ?? '不明'}」に応募しました`,
      type: 'application', relatedId: newApp.id, read: false, createdAt: new Date().toISOString(),
    }));
    updateMultipleCollections({
      applications: [...d('applications'), newApp],
      notifications: [...d('notifications'), ...newNotifs],
    });
    fsWrite(async () => {
      await saveDocument('applications', newApp);
      if (newNotifs.length > 0) await saveMultipleDocuments('notifications', newNotifs);
    });
    forceRefresh();
    return newApp;
  };

  const reviewApplication = (id, approved, reviewNote = '') => {
    const apps = d('applications');
    const app = apps.find(a => a.id === id);
    if (!app) return;

    const now = new Date().toISOString();
    const updatedApp = { ...app, status: approved ? 'approved' : 'rejected', reviewedAt: now, reviewNote };
    const recruitment = d('recruitments').find(r => r.id === app.recruitmentId);
    const message = approved
      ? `「${recruitment?.title ?? '不明'}」への応募が承認されました`
      : `「${recruitment?.title ?? '不明'}」への応募が見送りとなりました${reviewNote ? ': ' + reviewNote : ''}`;
    const notif = {
      id: generateId(), userId: app.userId, message,
      type: approved ? 'application_approved' : 'application_rejected',
      relatedId: id, read: false, createdAt: now,
    };

    const collectionUpdates = {
      applications: apps.map(a => a.id === id ? updatedApp : a),
      notifications: [...d('notifications'), notif],
    };

    const batchOps = [
      { type: 'set', collection: 'applications', id, data: (() => { const { id: _, ...r } = updatedApp; return r; })() },
      { type: 'set', collection: 'notifications', id: notif.id, data: (() => { const { id: _, ...r } = notif; return r; })() },
    ];

    // 承認 + taskId → 自動assignment作成
    if (approved && recruitment?.taskId) {
      const tasks = d('tasks');
      const task = tasks.find(t => t.id === recruitment.taskId);
      if (task && task.status === 'pending') {
        const newAssignment = {
          id: generateId(), taskId: recruitment.taskId, userId: app.userId,
          assignedHours: task.requiredHours, status: 'assigned',
          assignedAt: now, note: '業務募集から割り当て',
        };
        collectionUpdates.assignments = [...d('assignments'), newAssignment];
        collectionUpdates.tasks = tasks.map(t => t.id === recruitment.taskId ? { ...t, status: 'assigned' } : t);
        batchOps.push({ type: 'set', collection: 'assignments', id: newAssignment.id, data: (() => { const { id: _, ...r } = newAssignment; return r; })() });
        batchOps.push({ type: 'set', collection: 'tasks', id: recruitment.taskId, data: { ...task, id: undefined, status: 'assigned' } });
      }
    }

    updateMultipleCollections(collectionUpdates);
    fsWrite(() => batchWrite(batchOps));
    forceRefresh();
  };

  // ---- VIKING セルフアサイン ----
  const claimVikingTask = (taskId, userId) => {
    const tasks = d('tasks');
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.viking || task.status !== 'pending') return null;

    // 分野制限チェック
    if (task.fieldId) {
      const userFieldIds = (d('userFields') || []).filter(uf => uf.userId === userId).map(uf => uf.fieldId);
      if (!userFieldIds.includes(task.fieldId)) return null;
    }

    const now = new Date().toISOString();
    const newAssignment = {
      id: generateId(), taskId, userId,
      assignedHours: task.requiredHours, status: 'assigned',
      assignedAt: now, note: 'VIKING（セルフアサイン）',
    };

    const updatedTasks = tasks.map(t => t.id === taskId ? { ...t, status: 'assigned' } : t);
    const notif = {
      id: generateId(), userId,
      message: `VIKINGタスク「${task.name}」を取得しました`,
      type: 'assignment', relatedId: newAssignment.id, read: false, createdAt: now,
    };

    updateMultipleCollections({
      assignments: [...d('assignments'), newAssignment],
      tasks: updatedTasks,
      notifications: [...d('notifications'), notif],
    });
    fsWrite(async () => {
      await saveDocument('assignments', newAssignment);
      await saveDocument('tasks', { ...task, id: undefined, status: 'assigned' });
      await saveDocument('notifications', notif);
    });
    forceRefresh();
    return newAssignment;
  };

  // ---- Time Logs (タイマー) ----
  const startTimer = (assignmentId, taskId, userId, daimonId = null) => {
    const logs = [...d('timeLogs')];
    const active = logs.find(l => l.userId === userId && !l.endTime);
    const newLog = {
      id: generateId(), assignmentId, taskId, userId, daimonId,
      startTime: new Date().toISOString(), endTime: null, duration: 0,
    };

    let updatedLogs;
    if (active) {
      const dur = Math.floor((Date.now() - new Date(active.startTime).getTime()) / 1000);
      const stoppedActive = { ...active, endTime: new Date().toISOString(), duration: dur };
      updatedLogs = logs.map(l => l.id === active.id ? stoppedActive : l);
      updatedLogs.push(newLog);
      fsWrite(async () => {
        await saveDocument('timeLogs', stoppedActive);
        await saveDocument('timeLogs', newLog);
      });
    } else {
      updatedLogs = [...logs, newLog];
      fsWrite(() => saveDocument('timeLogs', newLog));
    }

    updateCollection('timeLogs', updatedLogs);
    forceRefresh();
  };

  const stopTimer = (logId) => {
    const logs = d('timeLogs');
    const log = logs.find(l => l.id === logId);
    if (!log || log.endTime) return;
    const dur = Math.floor((Date.now() - new Date(log.startTime).getTime()) / 1000);
    const updated = { ...log, endTime: new Date().toISOString(), duration: dur };
    updateCollection('timeLogs', logs.map(l => l.id === logId ? updated : l));
    fsWrite(() => saveDocument('timeLogs', updated));
    forceRefresh();
  };

  const stopActiveTimer = (userId) => {
    const logs = d('timeLogs');
    const active = logs.find(l => l.userId === userId && !l.endTime);
    if (active) stopTimer(active.id);
  };

  const getTimeLogs = (filters = {}) => {
    let logs = d('timeLogs');
    if (filters.assignmentId) logs = logs.filter(l => l.assignmentId === filters.assignmentId);
    if (filters.taskId) logs = logs.filter(l => l.taskId === filters.taskId);
    if (filters.userId) logs = logs.filter(l => l.userId === filters.userId);
    return logs;
  };

  const getActiveTimer = (userId) => {
    return d('timeLogs').find(l => l.userId === userId && !l.endTime) || null;
  };

  const getTaskTotalTime = (taskId) => {
    const logs = d('timeLogs').filter(l => l.taskId === taskId);
    let total = 0;
    for (const l of logs) {
      if (l.endTime) total += l.duration;
      else total += Math.floor((Date.now() - new Date(l.startTime).getTime()) / 1000);
    }
    return total;
  };

  const getDaimonTotalTime = (taskId, daimonId) => {
    const logs = d('timeLogs').filter(l => l.taskId === taskId && l.daimonId === daimonId);
    let total = 0;
    for (const l of logs) {
      if (l.endTime) total += l.duration;
      else total += Math.floor((Date.now() - new Date(l.startTime).getTime()) / 1000);
    }
    return total;
  };

  // ---- Rejection Categories ----
  const getRejectionCategories = (subject = null, workType = undefined) => {
    let items = d('rejectionCategories');
    if (subject !== null) {
      items = items.filter(c => c.subject === null || c.subject === subject);
    }
    if (workType !== undefined) {
      items = items.filter(c => c.workType === null || c.workType === undefined || c.workType === workType);
    }
    return items;
  };

  const addRejectionCategory = (catData) => {
    const cat = { ...catData, id: generateId(), createdAt: new Date().toISOString() };
    updateCollection('rejectionCategories', [...d('rejectionCategories'), cat]);
    fsWrite(() => saveDocument('rejectionCategories', cat));
    forceRefresh();
    return cat;
  };

  const updateRejectionCategory = (id, updates) => {
    const updated = d('rejectionCategories').map(c => c.id === id ? { ...c, ...updates } : c);
    updateCollection('rejectionCategories', updated);
    fsWrite(() => {
      const cat = updated.find(c => c.id === id);
      if (cat) return saveDocument('rejectionCategories', cat);
      return Promise.resolve();
    });
    forceRefresh();
  };

  const deleteRejectionCategory = (id) => {
    updateCollection('rejectionCategories', d('rejectionCategories').filter(c => c.id !== id));
    fsWrite(() => deleteDocument('rejectionCategories', id));
    forceRefresh();
  };

  // ---- Rejection Severities ----
  const getRejectionSeverities = () => d('rejectionSeverities');

  const addRejectionSeverity = (sevData) => {
    const sev = { ...sevData, id: generateId(), createdAt: new Date().toISOString() };
    updateCollection('rejectionSeverities', [...d('rejectionSeverities'), sev]);
    fsWrite(() => saveDocument('rejectionSeverities', sev));
    forceRefresh();
    return sev;
  };

  const updateRejectionSeverity = (id, updates) => {
    const updated = d('rejectionSeverities').map(s => s.id === id ? { ...s, ...updates } : s);
    updateCollection('rejectionSeverities', updated);
    fsWrite(() => {
      const sev = updated.find(s => s.id === id);
      if (sev) return saveDocument('rejectionSeverities', sev);
      return Promise.resolve();
    });
    forceRefresh();
  };

  const deleteRejectionSeverity = (id) => {
    updateCollection('rejectionSeverities', d('rejectionSeverities').filter(s => s.id !== id));
    fsWrite(() => deleteDocument('rejectionSeverities', id));
    forceRefresh();
  };

  // ---- Verification Items (検証項目マスタ) ----
  const getVerificationItems = (subject = null, purpose = null, workType = undefined) => {
    let items = d('verificationItems');
    if (subject !== null) {
      items = items.filter(vi => vi.subject === null || vi.subject === subject);
    }
    if (purpose !== null) {
      items = items.filter(vi => vi.purpose === purpose);
    }
    if (workType !== undefined) {
      items = items.filter(vi => vi.workType === null || vi.workType === workType);
    }
    return items;
  };

  const addVerificationItem = (itemData) => {
    const item = { ...itemData, id: generateId(), createdAt: new Date().toISOString() };
    updateCollection('verificationItems', [...d('verificationItems'), item]);
    fsWrite(() => saveDocument('verificationItems', item));
    forceRefresh();
    return item;
  };

  const updateVerificationItem = (id, updates) => {
    const updated = d('verificationItems').map(vi => vi.id === id ? { ...vi, ...updates } : vi);
    updateCollection('verificationItems', updated);
    fsWrite(() => {
      const item = updated.find(vi => vi.id === id);
      if (item) return saveDocument('verificationItems', item);
      return Promise.resolve();
    });
    forceRefresh();
  };

  const deleteVerificationItem = (id) => {
    const resultsToDelete = d('verificationResults').filter(vr => vr.verificationItemId === id).map(vr => vr.id);
    updateMultipleCollections({
      verificationItems: d('verificationItems').filter(vi => vi.id !== id),
      verificationResults: d('verificationResults').filter(vr => vr.verificationItemId !== id),
    });
    fsWrite(async () => {
      const ops = [{ type: 'delete', collection: 'verificationItems', id }];
      resultsToDelete.forEach(rid => ops.push({ type: 'delete', collection: 'verificationResults', id: rid }));
      await batchWrite(ops);
    });
    forceRefresh();
  };

  // ---- Verification Results (検証チェック結果) ----
  const getVerificationResults = (assignmentId = null) => {
    const all = d('verificationResults');
    return assignmentId ? all.filter(vr => vr.assignmentId === assignmentId) : all;
  };

  const initVerificationResults = (assignmentId, subject, checkedBy, workType = null) => {
    const items = d('verificationItems').filter(vi =>
      (vi.subject === null || vi.subject === subject) &&
      (vi.purpose === 'verification' || vi.purpose === undefined) &&
      (vi.workType === null || vi.workType === workType)
    );
    const existing = d('verificationResults').filter(vr => vr.assignmentId === assignmentId);
    if (existing.length > 0) return existing;

    const newResults = items.map(vi => ({
      id: generateId(),
      assignmentId,
      verificationItemId: vi.id,
      checked: false,
      note: '',
      checkedAt: null,
      checkedBy,
    }));
    updateCollection('verificationResults', [...d('verificationResults'), ...newResults]);
    fsWrite(() => saveMultipleDocuments('verificationResults', newResults));
    forceRefresh();
    return newResults;
  };

  const updateVerificationResult = (id, updates) => {
    const updated = d('verificationResults').map(vr => vr.id === id ? { ...vr, ...updates } : vr);
    updateCollection('verificationResults', updated);
    fsWrite(() => {
      const result = updated.find(vr => vr.id === id);
      if (result) return saveDocument('verificationResults', result);
      return Promise.resolve();
    });
    forceRefresh();
  };

  const toggleVerificationResult = (id) => {
    const current = d('verificationResults').find(vr => vr.id === id);
    if (!current) return;
    const updates = {
      checked: !current.checked,
      checkedAt: !current.checked ? new Date().toISOString() : null,
    };
    updateVerificationResult(id, updates);
  };

  // ---- Rejections (差し戻し記録) ----
  const getRejections = (filters = {}) => {
    let all = d('rejections');
    if (filters.userId) all = all.filter(r => r.userId === filters.userId);
    if (filters.assignmentId) all = all.filter(r => r.assignmentId === filters.assignmentId);
    if (filters.taskId) all = all.filter(r => r.taskId === filters.taskId);
    return all;
  };

  const addRejection = (rejData) => {
    const rej = { ...rejData, id: generateId(), createdAt: new Date().toISOString() };
    updateCollection('rejections', [...d('rejections'), rej]);
    fsWrite(() => saveDocument('rejections', rej));
    forceRefresh();
    return rej;
  };

  // ---- Workflow Statuses (カスタムワークフローステータス) ----
  const getWorkflowStatuses = (subject = null, workType = null) => {
    const all = d('workflowStatuses');
    // デフォルト（subject=null）は常に含む + 指定された科目×業務内容のカスタムを追加
    if (subject === null && workType === null) return all.sort((a, b) => a.sortOrder - b.sortOrder);
    return all.filter(s =>
      (s.subject === null && s.workType === null) ||
      (s.subject === subject && (s.workType === null || s.workType === workType))
    ).sort((a, b) => a.sortOrder - b.sortOrder);
  };

  const addWorkflowStatus = (data) => {
    const ws = { ...data, id: generateId(), isDefault: false, createdAt: new Date().toISOString() };
    updateCollection('workflowStatuses', [...d('workflowStatuses'), ws]);
    fsWrite(() => saveDocument('workflowStatuses', ws));
    forceRefresh();
    return ws;
  };

  const updateWorkflowStatus = (id, updates) => {
    const updated = d('workflowStatuses').map(s => s.id === id ? { ...s, ...updates } : s);
    updateCollection('workflowStatuses', updated);
    fsWrite(() => {
      const ws = updated.find(s => s.id === id);
      if (ws) return saveDocument('workflowStatuses', ws);
      return Promise.resolve();
    });
    forceRefresh();
  };

  const deleteWorkflowStatus = (id) => {
    const ws = d('workflowStatuses').find(s => s.id === id);
    if (!ws || ws.isDefault) return false;
    updateCollection('workflowStatuses', d('workflowStatuses').filter(s => s.id !== id));
    fsWrite(() => deleteDocument('workflowStatuses', id));
    forceRefresh();
    return true;
  };

  const resolveWorkflowStatus = (task, assignment) => {
    if (!task) return 'pending';
    if (!assignment) return 'pending';
    const s = assignment.status;
    const vs = assignment.verificationStatus;

    // マクロ（takos）ステータス: 格納済みタスクの場合
    if (assignment.storageStatus === 'stored') {
      // linkedTaskIdを持つtakosタスクが完了しているか確認
      const allTasks = d('tasks');
      const allAssignments = d('assignments');
      const takosTask = allTasks.find(t => t.linkedTaskId === task.id && t.macroTask);
      if (takosTask) {
        const takosAssignment = allAssignments.find(a => a.taskId === takosTask.id);
        if (takosTask.status === 'completed' || (takosAssignment && takosAssignment.status === 'approved')) {
          return 'macro_completed';
        }
      }
      return 'macro_pending';
    }

    // 格納待ち（承認済みだが未格納）
    if (assignment.storageStatus === 'pending_storage') return 'verification_completed';

    if (s === 'approved' || task.status === 'completed') return 'verification_completed';
    if (s === 'submitted' || task.status === 'submitted') {
      if (vs === 'reviewing') return 'verification_reviewing';
      if (vs === 'verified') return 'verification_completed';
      return 'verification_waiting';
    }
    if (s === 'in_progress') return 'in_progress';
    if (s === 'assigned' || s === 'rejected') return 'in_progress';
    return 'pending';
  };

  // ---- Notifications ----
  const getNotifications = (userId = null) => {
    const n = d('notifications');
    return userId ? n.filter(x => x.userId === userId) : n;
  };

  const markNotificationRead = (id) => {
    const updated = d('notifications').map(n => n.id === id ? { ...n, read: true } : n);
    updateCollection('notifications', updated);
    fsWrite(() => {
      const notif = updated.find(n => n.id === id);
      if (notif) return saveDocument('notifications', notif);
      return Promise.resolve();
    });
    forceRefresh();
  };

  const markAllNotificationsRead = (userId) => {
    const all = d('notifications');
    const updated = all.map(n => n.userId === userId ? { ...n, read: true } : n);
    updateCollection('notifications', updated);
    fsWrite(async () => {
      const toUpdate = updated.filter(n => n.userId === userId && !all.find(o => o.id === n.id && o.read));
      if (toUpdate.length > 0) await saveMultipleDocuments('notifications', toUpdate);
    });
    forceRefresh();
  };

  // ---- Feedbacks (フィードバック) ----
  const getFeedbacks = (filters = {}) => {
    let items = d('feedbacks') || [];
    if (filters.assignmentId) items = items.filter(f => f.assignmentId === filters.assignmentId);
    if (filters.toUserId) items = items.filter(f => f.toUserId === filters.toUserId);
    if (filters.subject) items = items.filter(f => f.subject === filters.subject);
    return items;
  };

  const addFeedback = (feedbackData) => {
    const fb = { ...feedbackData, id: generateId(), createdAt: new Date().toISOString() };
    updateCollection('feedbacks', [...(d('feedbacks') || []), fb]);
    fsWrite(() => saveDocument('feedbacks', fb));
    // 作業者への通知を自動生成（カテゴリ項目のみ、詳細は含めない）
    const fromUser = d('users').find(u => u.id === fb.fromUserId);
    const task = d('tasks').find(t => t.id === fb.taskId);
    // 通知メッセージにはFB内容（カテゴリ）のみ含め、【詳細】セクションは除外
    let notifDetail = '';
    if (fb.message) {
      const contentMatch = fb.message.match(/【FB内容】\n([\s\S]*?)(?:\n\n【詳細】|$)/);
      if (contentMatch) {
        notifDetail = '\n【FB内容】\n' + contentMatch[1];
      }
    }
    const notif = {
      id: generateId(),
      userId: fb.toUserId,
      message: `${fromUser?.name || 'リーダー'}から「${task?.name || ''}」にFBがあります${notifDetail}`,
      type: 'feedback',
      relatedId: fb.assignmentId,
      read: false,
      createdAt: new Date().toISOString(),
    };
    updateCollection('notifications', [...d('notifications'), notif]);
    fsWrite(() => saveDocument('notifications', notif));
    forceRefresh();
    return fb;
  };

  // ---- Fields (分野マスタ) ----
  const getFields = (subject = null) => {
    const all = d('fields') || [];
    return subject ? all.filter(f => f.subject === subject) : all;
  };
  const addField = (fieldData) => {
    const field = { ...fieldData, id: generateId(), createdAt: new Date().toISOString() };
    updateCollection('fields', [...(d('fields') || []), field]);
    fsWrite(() => saveDocument('fields', field));
    forceRefresh();
    return field;
  };
  const updateField = (id, updates) => {
    const updated = (d('fields') || []).map(f => f.id === id ? { ...f, ...updates } : f);
    updateCollection('fields', updated);
    fsWrite(() => { const item = updated.find(f => f.id === id); if (item) return saveDocument('fields', item); return Promise.resolve(); });
    forceRefresh();
  };
  const deleteField = (id) => {
    updateMultipleCollections({
      fields: (d('fields') || []).filter(f => f.id !== id),
      userFields: (d('userFields') || []).filter(uf => uf.fieldId !== id),
    });
    fsWrite(async () => { await deleteDocument('fields', id); });
    forceRefresh();
  };

  // ---- UserFields (分野研修クリア) ----
  const getUserFields = (userId = null) => {
    const all = d('userFields') || [];
    return userId ? all.filter(uf => uf.userId === userId) : all;
  };
  const addUserField = (userId, fieldId) => {
    const existing = (d('userFields') || []).find(uf => uf.userId === userId && uf.fieldId === fieldId);
    if (existing) return existing;
    const uf = { id: generateId(), userId, fieldId, clearedAt: new Date().toISOString() };
    updateCollection('userFields', [...(d('userFields') || []), uf]);
    fsWrite(() => saveDocument('userFields', uf));
    forceRefresh();
    return uf;
  };
  const removeUserField = (userId, fieldId) => {
    updateCollection('userFields', (d('userFields') || []).filter(uf => !(uf.userId === userId && uf.fieldId === fieldId)));
    forceRefresh();
  };
  const bulkSetUserFields = (userId, fieldIds) => {
    const others = (d('userFields') || []).filter(uf => uf.userId !== userId);
    const newEntries = fieldIds.map(fieldId => ({ id: generateId(), userId, fieldId, clearedAt: new Date().toISOString() }));
    updateCollection('userFields', [...others, ...newEntries]);
    forceRefresh();
  };
  const bulkImportUserFields = (entries) => {
    // entries = [{ userId, fieldId }]
    const existing = d('userFields') || [];
    const existingSet = new Set(existing.map(uf => `${uf.userId}_${uf.fieldId}`));
    const newEntries = entries
      .filter(e => !existingSet.has(`${e.userId}_${e.fieldId}`))
      .map(e => ({ id: generateId(), userId: e.userId, fieldId: e.fieldId, clearedAt: new Date().toISOString() }));
    if (newEntries.length > 0) {
      updateCollection('userFields', [...existing, ...newEntries]);
      forceRefresh();
    }
    return newEntries.length;
  };

  // ---- WorkTypes (作業種マスタ) ----
  const getWorkTypes = () => (d('workTypes') || []).sort((a, b) => a.sortOrder - b.sortOrder);
  const addWorkType = (wtData) => {
    const wt = { ...wtData, id: generateId(), createdAt: new Date().toISOString() };
    updateCollection('workTypes', [...(d('workTypes') || []), wt]);
    fsWrite(() => saveDocument('workTypes', wt));
    forceRefresh();
    return wt;
  };
  const deleteWorkType = (id) => {
    updateCollection('workTypes', (d('workTypes') || []).filter(wt => wt.id !== id));
    fsWrite(async () => { await deleteDocument('workTypes', id); });
    forceRefresh();
  };

  // ---- Manuals (マニュアル管理) ----
  const getManuals = (subject = null, workType = undefined) => {
    let items = d('manuals') || [];
    if (subject !== null) {
      items = items.filter(m => m.subject === null || m.subject === subject);
    }
    if (workType !== undefined) {
      items = items.filter(m => m.workType === null || m.workType === workType);
    }
    return items.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  };

  const addManual = (manualData) => {
    const manual = { ...manualData, id: generateId(), createdAt: new Date().toISOString() };
    updateCollection('manuals', [...(d('manuals') || []), manual]);
    forceRefresh();
    return manual;
  };

  const updateManual = (id, updates) => {
    const updated = (d('manuals') || []).map(m => m.id === id ? { ...m, ...updates } : m);
    updateCollection('manuals', updated);
    forceRefresh();
  };

  const deleteManual = (id) => {
    updateCollection('manuals', (d('manuals') || []).filter(m => m.id !== id));
    forceRefresh();
  };

  // ---- ReviewMemos ----
  const getReviewMemos = (filters = {}) => {
    let items = d('reviewMemos') || [];
    if (filters.assignmentId) items = items.filter(m => m.assignmentId === filters.assignmentId);
    if (filters.userId) items = items.filter(m => m.userId === filters.userId);
    if (filters.type) items = items.filter(m => m.type === filters.type);
    if (filters.shared !== undefined) items = items.filter(m => m.shared === filters.shared);
    return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  };
  const addReviewMemo = (memoData) => {
    const memo = { ...memoData, id: generateId(), createdAt: new Date().toISOString() };
    updateCollection('reviewMemos', [...(d('reviewMemos') || []), memo]);
    // If shared, create notification for the corrector
    if (memo.shared && memo.userId) {
      const author = d('users').find(u => u.id === memo.authorId);
      const task = d('tasks').find(t => t.id === memo.taskId);
      const notif = {
        id: generateId(),
        userId: memo.userId,
        message: `${author?.name || 'リーダー'}から「${task?.name || ''}」にメモが共有されました`,
        type: 'memo',
        relatedId: memo.assignmentId,
        read: false,
        createdAt: new Date().toISOString(),
      };
      updateCollection('notifications', [...d('notifications'), notif]);
    }
    forceRefresh();
    return memo;
  };
  const deleteReviewMemo = (id) => {
    updateCollection('reviewMemos', (d('reviewMemos') || []).filter(m => m.id !== id));
    forceRefresh();
  };

  // ---- Questions (質問機能) ----
  const getQuestions = (filters = {}) => {
    let items = d('questions') || [];
    if (filters.fromUserId) items = items.filter(q => q.fromUserId === filters.fromUserId);
    if (filters.subject) items = items.filter(q => q.subject === filters.subject);
    if (filters.workType) items = items.filter(q => q.workType === filters.workType);
    return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  };

  const addQuestion = (questionData) => {
    const question = {
      ...questionData,
      id: generateId(),
      answer: null,
      answeredBy: null,
      answeredAt: null,
      createdAt: new Date().toISOString(),
    };
    updateCollection('questions', [...(d('questions') || []), question]);
    // リーダーへの通知を作成
    const fromUser = d('users').find(u => u.id === question.fromUserId);
    const leaders = d('users').filter(u => u.role === 'leader');
    const newNotifications = leaders.map(leader => ({
      id: generateId(),
      userId: leader.id,
      message: `${fromUser?.name || '添削者'}から質問があります: [${question.subject}${question.workType ? ' · ' + question.workType : ''}] ${question.message.substring(0, 50)}${question.message.length > 50 ? '...' : ''}`,
      type: 'question',
      relatedId: question.id,
      read: false,
      createdAt: new Date().toISOString(),
    }));
    updateCollection('notifications', [...d('notifications'), ...newNotifications]);
    forceRefresh();
    return question;
  };

  const answerQuestion = (id, answer, answeredBy) => {
    const questions = d('questions') || [];
    const updated = questions.map(q => q.id === id ? {
      ...q,
      answer,
      answeredBy,
      answeredAt: new Date().toISOString(),
    } : q);
    updateCollection('questions', updated);
    // 質問者への通知を作成
    const question = updated.find(q => q.id === id);
    const answerer = d('users').find(u => u.id === answeredBy);
    if (question) {
      const notif = {
        id: generateId(),
        userId: question.fromUserId,
        message: `${answerer?.name || 'リーダー'}が質問に回答しました: [${question.subject}${question.workType ? ' · ' + question.workType : ''}]`,
        type: 'question_answer',
        relatedId: question.id,
        read: false,
        createdAt: new Date().toISOString(),
      };
      updateCollection('notifications', [...d('notifications'), notif]);
    }
    forceRefresh();
  };

  const getQuestionSettings = () => d('questionSettings') || [];

  const updateQuestionSetting = (subject, workType, enabled) => {
    const settings = d('questionSettings') || [];
    const existing = settings.find(s => s.subject === subject && s.workType === workType);
    if (existing) {
      const updated = settings.map(s => s.id === existing.id ? { ...s, enabled } : s);
      updateCollection('questionSettings', updated);
    } else {
      const newSetting = { id: generateId(), subject, workType, enabled };
      updateCollection('questionSettings', [...settings, newSetting]);
    }
    forceRefresh();
  };

  // ---- autoAssign用: 一括データ取得 + 結果反映 ----
  const getAllData = () => data || getAll();

  const applyAutoAssignResult = (result) => {
    updateMultipleCollections({
      assignments: result.assignments,
      tasks: result.tasks,
      notifications: result.notifications,
    });
    fsWrite(async () => {
      if (result.newAssignments?.length > 0) await saveMultipleDocuments('assignments', result.newAssignments);
      // tasks と notifications は個別更新が必要
      const changedTasks = result.tasks.filter(t => {
        const old = d('tasks').find(ot => ot.id === t.id);
        return old && old.status !== t.status;
      });
      if (changedTasks.length > 0) await saveMultipleDocuments('tasks', changedTasks);
    });
    forceRefresh();
  };

  return (
    <DataContext.Provider value={{
      tick, forceRefresh, loading, getAllData, applyAutoAssignResult,
      getUsers, getCorrectors, addUser, updateUser, deleteUser, resetUserPassword,
      getSchools, addSchool, deleteSchool,
      getExamTypes, addExamType, deleteExamType,
      getCapacities, addCapacity, deleteCapacity,
      getTasks, addTask, updateTask, deleteTask,
      getAssignments, updateAssignment, deleteAssignment, confirmStorage,
      getEvaluationCriteria, addEvaluationCriteria, updateEvaluationCriteria, deleteEvaluationCriteria,
      getEvaluations, setEvaluation,
      getExamInputs, saveExamInput, deleteExamInput,
      getRecruitments, addRecruitment, closeRecruitment,
      getApplications, addApplication, reviewApplication, claimVikingTask,
      getRejectionCategories, addRejectionCategory, updateRejectionCategory, deleteRejectionCategory,
      getRejectionSeverities, addRejectionSeverity, updateRejectionSeverity, deleteRejectionSeverity,
      getVerificationItems, addVerificationItem, updateVerificationItem, deleteVerificationItem,
      getVerificationResults, initVerificationResults, updateVerificationResult, toggleVerificationResult,
      getRejections, addRejection,
      getWorkflowStatuses, addWorkflowStatus, updateWorkflowStatus, deleteWorkflowStatus, resolveWorkflowStatus,
      getFields, addField, updateField, deleteField,
      getWorkTypes, addWorkType, deleteWorkType,
      getManuals, addManual, updateManual, deleteManual,
      getUserFields, addUserField, removeUserField, bulkSetUserFields, bulkImportUserFields,
      getFeedbacks, addFeedback,
      getReviewMemos, addReviewMemo, deleteReviewMemo,
      getNotifications, markNotificationRead, markAllNotificationsRead,
      getQuestions, addQuestion, answerQuestion, getQuestionSettings, updateQuestionSetting,
      startTimer, stopTimer, stopActiveTimer, getTimeLogs, getActiveTimer, getTaskTotalTime, getDaimonTotalTime,
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => useContext(DataContext);
