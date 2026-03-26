const STORAGE_KEY = 'seiseki_kanri_v1';

export const INITIAL_DATA = {
  users: [],
  schools: [],
  examTypes: [],
  capacities: [],
  tasks: [],
  assignments: [],
  examInputs: [],
  evaluationCriteria: [],
  evaluations: [],
  notifications: [],
  reviewMemos: [],
  recruitments: [],
  applications: [],
  timeLogs: [],
  rejectionCategories: [],
  rejectionSeverities: [],
  rejections: [],
  verificationItems: [],
  feedbacks: [],
  fields: [
    // 理科 - 化学
    { id: 'fld_r1', name: '中和', subject: '小学理科', category: '化学', sortOrder: 1, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_r2', name: '燃焼', subject: '小学理科', category: '化学', sortOrder: 2, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_r3', name: '熱', subject: '小学理科', category: '化学', sortOrder: 3, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_r4', name: '溶解度', subject: '小学理科', category: '化学', sortOrder: 4, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_r5', name: '状態', subject: '小学理科', category: '化学', sortOrder: 5, createdAt: '2026-01-01T00:00:00.000Z' },
    // 理科 - 物理
    { id: 'fld_r6', name: 'てこ', subject: '小学理科', category: '物理', sortOrder: 6, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_r7', name: '滑車', subject: '小学理科', category: '物理', sortOrder: 7, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_r8', name: '電気', subject: '小学理科', category: '物理', sortOrder: 8, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_r9', name: 'ばね', subject: '小学理科', category: '物理', sortOrder: 9, createdAt: '2026-01-01T00:00:00.000Z' },
    // 理科 - 生物
    { id: 'fld_r10', name: '光合成', subject: '小学理科', category: '生物', sortOrder: 10, createdAt: '2026-01-01T00:00:00.000Z' },
    // 理科 - 地学
    { id: 'fld_r11', name: '星座', subject: '小学理科', category: '地学', sortOrder: 11, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_r12', name: '月', subject: '小学理科', category: '地学', sortOrder: 12, createdAt: '2026-01-01T00:00:00.000Z' },
    // 算数
    { id: 'fld_m1', name: '割合の線分図', subject: '小学算数', category: null, sortOrder: 1, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m2', name: '仕事算＋ニュートン算', subject: '小学算数', category: null, sortOrder: 2, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m3', name: '食塩水', subject: '小学算数', category: null, sortOrder: 3, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m4', name: 'つるかめ算', subject: '小学算数', category: null, sortOrder: 4, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m5', name: '旅人算', subject: '小学算数', category: null, sortOrder: 5, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m6', name: '約数・倍数', subject: '小学算数', category: null, sortOrder: 6, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m7', name: '角度や面積', subject: '小学算数', category: null, sortOrder: 7, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m8', name: '移動範囲', subject: '小学算数', category: null, sortOrder: 8, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m9', name: '回転・転がり移動', subject: '小学算数', category: null, sortOrder: 9, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m10', name: '図形の移動', subject: '小学算数', category: null, sortOrder: 10, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m11', name: '植木算', subject: '小学算数', category: null, sortOrder: 11, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m12', name: '数列・数表', subject: '小学算数', category: null, sortOrder: 12, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m13', name: '消去算', subject: '小学算数', category: null, sortOrder: 13, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m14', name: '差集め算', subject: '小学算数', category: null, sortOrder: 14, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m15', name: '比体積・表面積', subject: '小学算数', category: null, sortOrder: 15, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m16', name: '投影図・回転体と比', subject: '小学算数', category: null, sortOrder: 16, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m17', name: '水量グラフ', subject: '小学算数', category: null, sortOrder: 17, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m18', name: '周期', subject: '小学算数', category: null, sortOrder: 18, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m19', name: 'N進法', subject: '小学算数', category: null, sortOrder: 19, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m20', name: '速さの特殊算', subject: '小学算数', category: null, sortOrder: 20, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m21', name: '法陣算', subject: '小学算数', category: null, sortOrder: 21, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m22', name: '立体の切断', subject: '小学算数', category: null, sortOrder: 22, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m23', name: '点の移動', subject: '小学算数', category: null, sortOrder: 23, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m24', name: '和差(消去算以外)', subject: '小学算数', category: null, sortOrder: 24, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m25', name: '売買損益', subject: '小学算数', category: null, sortOrder: 25, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m26', name: '速さと比', subject: '小学算数', category: null, sortOrder: 26, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m27', name: '数に関する問題', subject: '小学算数', category: null, sortOrder: 27, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m28', name: '条件整理', subject: '小学算数', category: null, sortOrder: 28, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m29', name: '場合の数', subject: '小学算数', category: null, sortOrder: 29, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m30', name: '操作', subject: '小学算数', category: null, sortOrder: 30, createdAt: '2026-01-01T00:00:00.000Z' },
  ],
  userFields: [],
  verificationResults: [],
  workflowStatuses: [
    { id: 'ws1', subject: null, workType: null, name: 'pending', label: '未振り分け', color: '#f59e0b', sortOrder: 0, isDefault: true, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'ws3', subject: null, workType: null, name: 'in_progress', label: '作業中', color: '#0ea5e9', sortOrder: 1, isDefault: true, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'ws5', subject: null, workType: null, name: 'verification_waiting', label: '検証待ち', color: '#f97316', sortOrder: 2, isDefault: true, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'ws6', subject: null, workType: null, name: 'verification_reviewing', label: '検証中', color: '#eab308', sortOrder: 3, isDefault: true, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'ws7', subject: null, workType: null, name: 'verification_completed', label: '検証完了', color: '#10b981', sortOrder: 4, isDefault: true, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'ws8', subject: null, workType: null, name: 'macro_pending', label: 'マクロ未作成', color: '#ef4444', sortOrder: 5, isDefault: true, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'ws9', subject: null, workType: null, name: 'macro_completed', label: '作成完了', color: '#22c55e', sortOrder: 6, isDefault: true, createdAt: '2026-01-01T00:00:00.000Z' },
  ],
  workTypes: [
    { id: 'wt1', name: '新年度試験種', sortOrder: 1, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'wt2', name: 'タグ付け', sortOrder: 2, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'wt3', name: '解答出し', sortOrder: 3, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'wt4', name: '部分点', sortOrder: 4, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'wt5', name: 'tensakitインポート', sortOrder: 5, createdAt: '2026-01-01T00:00:00.000Z' },
  ],
  manuals: [],
  questions: [],
  questionSettings: [],
  externalWorkSettings: [
    { id: 'ew1', subject: '小学国語', workType: '新年度試験種', createdAt: '2026-01-01T00:00:00.000Z' },
  ],
};

export const SUBJECTS_LIST = ['小学国語', '小学算数', '小学理科', '小学社会'];

export const WORK_TYPES_LIST = ['新年度試験種', 'タグ付け', '解答出し', '部分点', 'tensakitインポート', 'takos作成', 'マクロ'];

export const generateId = () =>
  Math.random().toString(36).substr(2, 9) + Date.now().toString(36);

export const generateInitialPassword = () => {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let pw = '';
  for (let i = 0; i < 8; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
};

export const generateManagementId = (role) => {
  const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  const users = data.users || [];
  const base = role === 'leader' ? 100000 : 200000;
  const existing = users
    .filter(u => u.managementId && parseInt(u.managementId, 10) >= base && parseInt(u.managementId, 10) < base + 100000)
    .map(u => parseInt(u.managementId, 10))
    .filter(n => !isNaN(n));
  const next = existing.length > 0 ? Math.max(...existing) + 1 : base + 1;
  return String(next);
};

export const initStorage = () => {
  if (!localStorage.getItem(STORAGE_KEY)) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_DATA));
  } else {
    // マイグレーション: 新しいキーがなければ追加
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    let updated = false;
    if (!data.timeLogs) { data.timeLogs = []; updated = true; }
    if (!data.recruitments) { data.recruitments = []; updated = true; }
    if (!data.applications) { data.applications = []; updated = true; }
    // managementId migration (from loginId or missing)
    if (data.users && data.users.some(u => !u.managementId)) {
      let leaderIdx = 100001, correctorIdx = 200001;
      data.users = data.users.map(u => {
        if (u.managementId) return u;
        const id = u.role === 'leader' ? String(leaderIdx++) : String(correctorIdx++);
        const { loginId, ...rest } = u;
        return { ...rest, managementId: id };
      });
      updated = true;
    }
    if (!data.rejectionCategories) { data.rejectionCategories = []; updated = true; }
    // rejectionCategories workType マイグレーション
    if (data.rejectionCategories && data.rejectionCategories.some(c => c.workType === undefined)) {
      data.rejectionCategories = data.rejectionCategories.map(c => ({ ...c, workType: c.workType ?? null }));
      updated = true;
    }
    if (!data.rejectionSeverities) { data.rejectionSeverities = []; updated = true; }
    if (!data.rejections) { data.rejections = []; updated = true; }
    // fields/userFields マイグレーション
    if (!data.fields) { data.fields = INITIAL_DATA.fields || []; updated = true; }
    if (!data.userFields) { data.userFields = []; updated = true; }
    // fields 初期データ追記マイグレーション
    if (!data._fieldsInitV1) {
      const refFields = INITIAL_DATA.fields || [];
      const existingIds = new Set((data.fields || []).map(f => f.id));
      for (const f of refFields) {
        if (!existingIds.has(f.id)) data.fields.push(f);
      }
      data._fieldsInitV1 = true;
      updated = true;
    }
    // evaluationCriteria migration
    if (data.evaluationCriteria && data.evaluationCriteria.length > 0 && data.evaluationCriteria[0].subject === undefined) {
      data.evaluationCriteria = data.evaluationCriteria.map(c => ({
        ...c, subject: c.subject ?? null, autoMetric: c.autoMetric ?? null,
      }));
      updated = true;
    }
    // evaluationCriteria basePoints migration
    if (data.evaluationCriteria && data.evaluationCriteria.length > 0 && data.evaluationCriteria[0].basePoints === undefined) {
      data.evaluationCriteria = data.evaluationCriteria.map(c => ({
        ...c, basePoints: c.basePoints ?? 1,
      }));
      updated = true;
    }
    // evaluations migration
    if (data.evaluations && data.evaluations.length > 0 && data.evaluations[0].subject === undefined) {
      data.evaluations = data.evaluations.map(e => ({
        ...e, subject: e.subject ?? null, autoScore: e.autoScore ?? null, isOverridden: e.isOverridden ?? false,
      }));
      updated = true;
    }
    // feedbacks マイグレーション
    if (!data.feedbacks) { data.feedbacks = []; updated = true; }
    // 検証項目マイグレーション
    if (!data.verificationItems) { data.verificationItems = []; updated = true; }
    if (!data.verificationResults) { data.verificationResults = []; updated = true; }
    // purpose/workType マイグレーション
    if (data.verificationItems && data.verificationItems.some(vi => vi.purpose === undefined)) {
      data.verificationItems = data.verificationItems.map(vi => ({
        ...vi,
        purpose: vi.purpose ?? 'verification',
        workType: vi.workType ?? null,
      }));
      updated = true;
    }
    if (!data.workflowStatuses) { data.workflowStatuses = INITIAL_DATA.workflowStatuses || []; updated = true; }
    // マクロステータス追加マイグレーション
    if (data.workflowStatuses && !data.workflowStatuses.find(ws => ws.name === 'macro_pending')) {
      // 不要なステータスを削除（assigned, submitted）
      data.workflowStatuses = data.workflowStatuses.filter(ws => !['assigned', 'submitted'].includes(ws.name));
      // マクロステータスを追加
      data.workflowStatuses.push(
        { id: 'ws8', subject: null, workType: null, name: 'macro_pending', label: 'マクロ未作成', color: '#ef4444', sortOrder: 5, isDefault: true, createdAt: '2026-01-01T00:00:00.000Z' },
        { id: 'ws9', subject: null, workType: null, name: 'macro_completed', label: '作成完了', color: '#22c55e', sortOrder: 6, isDefault: true, createdAt: '2026-01-01T00:00:00.000Z' }
      );
      // sortOrderを再調整
      const desiredOrder = ['pending', 'in_progress', 'verification_waiting', 'verification_reviewing', 'verification_completed', 'macro_pending', 'macro_completed'];
      data.workflowStatuses.forEach(ws => {
        const idx = desiredOrder.indexOf(ws.name);
        if (idx >= 0) ws.sortOrder = idx;
      });
      updated = true;
    }
    if (!data.workTypes) { data.workTypes = INITIAL_DATA.workTypes || []; updated = true; }
    if (!data.manuals) { data.manuals = []; updated = true; }
    if (!data.reviewMemos) { data.reviewMemos = []; updated = true; }
    if (!data.questions) { data.questions = []; updated = true; }
    if (!data.questionSettings) { data.questionSettings = []; updated = true; }
    if (!data.externalWorkSettings) { data.externalWorkSettings = INITIAL_DATA.externalWorkSettings || []; updated = true; }
    if (updated) localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
};

export const getAll = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : INITIAL_DATA;
};

export const saveAll = (data) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const get = (key) => {
  const data = getAll();
  return data[key] ?? [];
};

export const save = (key, value) => {
  const data = getAll();
  data[key] = value;
  saveAll(data);
};
