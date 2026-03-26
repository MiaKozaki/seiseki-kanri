/**
 * TaskAndAssignmentTab - Task management tab (試験種管理)
 * Handles task CRUD, CSV bulk import, PDF upload, daimon registration, and assignment management.
 * Includes OverviewListSection sub-component.
 */
import React, { useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useData, isFinished } from '../../contexts/DataContext.jsx';
import { autoAssign, manualAssign, previewAutoAssign, confirmAutoAssign } from '../../utils/autoAssign.js';
import { toCSV, downloadCSV, importCSVFile, parseCSV, validateTaskCSV, validateExamTaskCSV, validateFieldMasterCSV, validateDaimonTaskCSV, validateNewYearTaskCSV, validateCsvImportTaskCSV, TASK_IMPORT_CSV_COLUMNS, EXAM_TASK_CSV_COLUMNS, FIELD_MASTER_CSV_COLUMNS, DAIMON_TASK_CSV_COLUMNS, NEW_YEAR_TASK_CSV_COLUMNS, CSV_IMPORT_TASK_COLUMNS, ASSIGNMENT_CSV_COLUMNS } from '../../utils/csvUtils';
import { SUBJECTS_LIST, WORK_TYPES_LIST, generateId } from '../../utils/storage.js';
import { SCHOOL_SUGGESTIONS } from '../../utils/schoolList.js';
import { downloadAttachment, saveAttachment, deleteAttachment, saveTaskAttachment, getTaskAttachments, deleteTaskAttachments, validateTaskFile } from '../../utils/fileStorage.js';

// PDF ファイル名 → タスクの柔軟マッチング
// 例: 開成_算数_2026_1.pdf → B96: 開成_小学算数_2026_1 にマッチ
const SUBJECT_ALIASES = { '算数': '小学算数', '国語': '小学国語', '理科': '小学理科', '社会': '小学社会', '小学算数': '小学算数', '小学国語': '小学国語', '小学理科': '小学理科', '小学社会': '小学社会' };
const matchPdfToTask = (fileName, tasks) => {
  const baseName = fileName.replace(/\.[^.]+$/, '');
  const parts = baseName.split('_');
  if (parts.length < 3) return null;
  const [fileSchool, fileSubject, fileYear, fileRound] = parts;
  const normalizedSubject = SUBJECT_ALIASES[fileSubject] || fileSubject;
  return tasks.find(t => {
    // 学校名: コード部分を除いて部分一致（"開成" → "B96: 開成" にマッチ）
    const taskSchool = (t.schoolName || t.name || '');
    const schoolMatch = taskSchool.includes(fileSchool) || fileSchool.includes(taskSchool);
    // 科目: エイリアス変換して一致
    const subjectMatch = t.subject === normalizedSubject;
    // 年度: 一致
    const yearMatch = t.year === fileYear;
    // 回数: あれば一致（なければ無視）
    const roundMatch = !fileRound || !t.round || t.round === fileRound;
    return schoolMatch && subjectMatch && yearMatch && roundMatch;
  }) || null;
};

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
  const [form, setForm] = useState({ name: '', schoolName: '', subject: '', year: String(new Date().getFullYear()), round: '1', workType: '', requiredHours: '', deadline: '', sheetsUrl: '', viking: false, splitByDaimon: false, daimons: [] });
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const [taskFiles, setTaskFiles] = useState([]);
  const [taskFileError, setTaskFileError] = useState('');
  const [schoolSuggestions, setSchoolSuggestions] = useState([]);
  const [showSchoolSuggestions, setShowSchoolSuggestions] = useState(false);

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

  // 新年度試験種 一括登録 state
  const [shinnendoCsvText, setShinnendoCsvText] = useState('');
  const [shinnendoParsed, setShinnendoParsed] = useState(null);
  const [shinnendoPdfFiles, setShinnendoPdfFiles] = useState([]);
  const [shinnendoMatches, setShinnendoMatches] = useState({});
  const [shinnendoRegistering, setShinnendoRegistering] = useState(false);
  const [shinnendoResult, setShinnendoResult] = useState(null);

  // CSV一括登録+PDF紐付け state
  const [csvImportText, setCsvImportText] = useState('');
  const [csvImportParsed, setCsvImportParsed] = useState(null);
  const [csvImportPdfFiles, setCsvImportPdfFiles] = useState([]);
  const [csvImportMatches, setCsvImportMatches] = useState({});
  const [csvImportRegistering, setCsvImportRegistering] = useState(false);
  const [csvImportResult, setCsvImportResult] = useState(null);

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
    if (form.schoolName && !SCHOOL_SUGGESTIONS.includes(form.schoolName)) { setError('学校名はリストから選択してください'); return; }
    if (!form.subject) { setError('科目を選択してください'); return; }
    if (!form.workType) { setError('作業内容を選択してください'); return; }

    // タスク名自動生成（学校名・科目・年度・回数が入力されている場合）
    const autoName = [form.schoolName, form.subject, form.year, form.round].filter(Boolean).join('_');
    const taskName = form.name || autoName || `${form.subject}_${form.workType}`;

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
      updateTask(editId, { ...form, name: taskName, requiredHours: Number(form.requiredHours) });
      if (taskFiles.length > 0) {
        const attachments = await saveFilesForTask(editId);
        const existing = getTasks().find(t => t.id === editId)?.taskAttachments || [];
        updateTask(editId, { taskAttachments: [...existing, ...attachments] });
      }
      setEditId(null);
    } else if (form.splitByDaimon && form.daimons.length > 0) {
      const parentTaskGroup = generateId();
      const createdIds = [];
      form.daimons.forEach(daimon => {
        const newTask = addTask({
          name: `${taskName} ${daimon.name}`,
          schoolName: form.schoolName,
          subject: form.subject,
          year: form.year,
          round: form.round,
          workType: form.workType,
          requiredHours: Number(daimon.requiredHours) || 0,
          deadline: form.deadline,
          viking: form.subject === '小学理科',
          fieldId: daimon.fieldId || null,
          parentTaskGroup,
        });
        if (newTask?.id) createdIds.push(newTask.id);
      });
      if (taskFiles.length > 0) {
        for (const taskId of createdIds) {
          const attachments = await saveFilesForTask(taskId);
          updateTask(taskId, { taskAttachments: attachments });
        }
      }
    } else {
      const newTask = addTask({ ...form, name: taskName, requiredHours: Number(form.requiredHours), viking: !!form.viking });
      if (taskFiles.length > 0 && newTask?.id) {
        const attachments = await saveFilesForTask(newTask.id);
        updateTask(newTask.id, { taskAttachments: attachments });
      }
    }
    setForm({ name: '', schoolName: '', subject: '', year: String(new Date().getFullYear()), round: '1', workType: '', requiredHours: '', deadline: '', sheetsUrl: '', viking: false, splitByDaimon: false, daimons: [] });
    setTaskFiles([]);
    setTaskFileError('');
  };

  const handleEdit = (task) => {
    setEditId(task.id);
    setForm({ name: task.name, schoolName: task.schoolName ?? '', subject: task.subject ?? '', year: task.year ?? '', round: task.round ?? '', workType: task.workType ?? '', requiredHours: task.requiredHours, deadline: task.deadline, sheetsUrl: task.sheetsUrl ?? '', viking: !!task.viking, splitByDaimon: false, daimons: [] });
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
      { schoolName: '開成中学', subject: '小学算数', year: '2026', round: '1', workType: '新年度試験種', requiredHours: 5, deadline: '2026-04-01' },
      { schoolName: '麻布中学', subject: '小学理科', year: '2026', round: '1', workType: 'タグ付け', requiredHours: 3, deadline: '2026-04-15' },
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
    // Group by school+subject+year+round
    const groupMap = {};
    daimonCsvParsed.valid.forEach(row => {
      const key = `${row.schoolName}__${row.subject}__${row.year}__${row.round}`;
      if (!groupMap[key]) groupMap[key] = { schoolName: row.schoolName, subject: row.subject, year: row.year, round: row.round, daimons: [] };
      groupMap[key].daimons.push({ name: row.daimonName, fieldId: row.fieldId || null, daimonId: row.daimonId || '', takosLink: row.takosLink || '' });
    });

    let taskCount = 0;
    const currentTasks = getTasks();
    const examTypes = getExamTypes();
    Object.values(groupMap).forEach(group => {
      // Look up or create school
      let school = schools.find(s => s.name === group.schoolName);
      if (!school) {
        school = addSchool(group.schoolName);
      }
      // Look up or create examType
      let et = examTypes.find(e => e.schoolId === school.id && e.subject === group.subject);
      if (!et) {
        et = addExamType(school.id, group.subject);
        examTypes.push(et);
      }

      // Find existing task matching school+subject+year+round
      const taskNamePattern = [group.schoolName, group.subject, group.year, group.round].filter(Boolean).join('_');
      let existingTask = currentTasks.find(t =>
        t.name === taskNamePattern ||
        (t.schoolName === group.schoolName && t.subject === group.subject && t.year === group.year && t.round === group.round)
      );

      if (existingTask) {
        // Update existing task with daimon info
        updateTask(existingTask.id, { daimons: group.daimons });
      } else {
        // Create new task with daimon info
        const newTask = addTask({
          name: taskNamePattern,
          schoolName: group.schoolName,
          subject: group.subject,
          year: group.year,
          round: group.round,
          workType: '新年度試験種',
          requiredHours: 0,
          deadline: '',
          sheetsUrl: '',
          viking: group.subject === '小学理科',
          daimons: group.daimons,
        });
        taskCount++;
      }
    });

    const groupCount = Object.keys(groupMap).length;
    const daimonCount = daimonCsvParsed.valid.length;
    const msg = taskCount > 0
      ? `${groupCount}件のタスクに${daimonCount}件の大問情報を登録しました（新規タスク: ${taskCount}件）`
      : `${groupCount}件のタスクに${daimonCount}件の大問情報を登録しました`;
    setDaimonCsvImportDone(msg);
    setDaimonCsvParsed(null);
    setDaimonCsvText('');
    setMessage(`大問情報一括登録: ${msg}`);
    setTimeout(() => setMessage(''), 5000);
  };

  const handleDownloadDaimonTemplate = () => {
    const templateData = [
      { schoolName: 'B96: 開成', subject: '小学理科', year: '2026', round: '1', daimonName: '大問1', fieldName: '中和', daimonId: 'Q001', takosLink: 'https://takos.example.com/q001' },
      { schoolName: 'B96: 開成', subject: '小学理科', year: '2026', round: '1', daimonName: '大問2', fieldName: 'てこ', daimonId: 'Q002', takosLink: 'https://takos.example.com/q002' },
      { schoolName: 'B96: 開成', subject: '小学算数', year: '2026', round: '1', daimonName: '大問1', fieldName: '旅人算', daimonId: 'Q003', takosLink: '' },
      { schoolName: 'B16: 麻布', subject: '小学国語', year: '2026', round: '1', daimonName: '大問1', fieldName: '', daimonId: '', takosLink: '' },
      { schoolName: 'B16: 麻布', subject: '小学国語', year: '2026', round: '1', daimonName: '大問2', fieldName: '', daimonId: '', takosLink: '' },
    ];
    const csv = toCSV(templateData, DAIMON_TASK_CSV_COLUMNS);
    downloadCSV(csv, '大問情報一括登録テンプレート.csv');
  };

  // --- 新年度試験種 一括登録 helpers ---
  const handleShinnendoCsvParse = (text) => {
    setShinnendoCsvText(text);
    setShinnendoResult(null);
    setShinnendoPdfFiles([]);
    setShinnendoMatches({});
    if (!text.trim()) { setShinnendoParsed(null); return; }
    let csvText = text;
    if (!text.includes(',') && text.includes('\t')) {
      csvText = text.split('\n').map(line => line.split('\t').map(cell => {
        const trimmed = cell.trim();
        if (trimmed.includes(',') || trimmed.includes('"') || trimmed.includes('\n')) return '"' + trimmed.replace(/"/g, '""') + '"';
        return trimmed;
      }).join(',')).join('\n');
    }
    const { rows } = parseCSV(csvText);
    const result = validateNewYearTaskCSV(rows);
    setShinnendoParsed(result);
  };

  const handleShinnendoCsvFile = async () => {
    try {
      const { headers, rows } = await importCSVFile();
      const csvText = [headers.join(','), ...rows.map(r => headers.map(h => r[h] ?? '').join(','))].join('\n');
      setShinnendoCsvText(csvText);
      handleShinnendoCsvParse(csvText);
    } catch (err) {
      // user cancelled
    }
  };

  const handleShinnendoPdfUpload = (e) => {
    const files = Array.from(e.target.files || []);
    setShinnendoPdfFiles(files);
    if (!shinnendoParsed || shinnendoParsed.valid.length === 0) return;

    // Auto-match: flexible filename pattern
    const matches = {};
    files.forEach((file, fileIdx) => {
      const baseName = file.name.replace(/\.[^.]+$/, '');
      const parts = baseName.split('_');
      if (parts.length >= 3) {
        const fileSchool = parts[0];
        const fileSubject = SUBJECT_ALIASES[parts[1]] || parts[1];
        const fileYear = parts[2];
        const rowIdx = shinnendoParsed.valid.findIndex(r => {
          const schoolMatch = (r.schoolName || '').includes(fileSchool) || fileSchool.includes(r.schoolName || '');
          const subjectMatch = r.subject === fileSubject;
          const yearMatch = r.year === fileYear;
          return schoolMatch && subjectMatch && yearMatch;
        });
        if (rowIdx >= 0) {
          matches[shinnendoParsed.valid[rowIdx].matchKey] = fileIdx;
        }
      }
    });
    setShinnendoMatches(matches);
  };

  const handleShinnendoRegister = async () => {
    if (!shinnendoParsed || shinnendoParsed.valid.length === 0) return;
    setShinnendoRegistering(true);
    let taskCount = 0;
    let fileCount = 0;

    try {
      for (const row of shinnendoParsed.valid) {
        const taskName = `${row.schoolName} ${row.subject} ${row.year} 新年度試験種`;
        const newTask = addTask({
          name: taskName,
          subject: row.subject,
          workType: '新年度試験種',
          requiredHours: row.requiredHours,
          deadline: row.deadline || '',
          viking: row.subject === '小学理科',
          sheetsUrl: '',
          fieldId: null,
          year: row.year,
          schoolName: row.schoolName,
        });
        taskCount++;

        // Attach matched PDF
        if (newTask?.id && shinnendoMatches[row.matchKey] !== undefined) {
          const file = shinnendoPdfFiles[shinnendoMatches[row.matchKey]];
          if (file) {
            try {
              const meta = await saveTaskAttachment({
                taskId: newTask.id,
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
                blob: file,
              });
              updateTask(newTask.id, { taskAttachments: [meta] });
              fileCount++;
            } catch (err) {
              console.error('Failed to save task attachment:', err);
            }
          }
        }
      }

      setShinnendoResult(`${taskCount}件登録完了、${fileCount}件ファイル紐付け`);
      setShinnendoParsed(null);
      setShinnendoCsvText('');
      setShinnendoPdfFiles([]);
      setShinnendoMatches({});
      setMessage(`新年度試験種 一括登録: ${taskCount}件追加、${fileCount}件PDF紐付け`);
      setTimeout(() => setMessage(''), 5000);
    } finally {
      setShinnendoRegistering(false);
    }
  };

  const handleDownloadShinnendoTemplate = () => {
    const templateData = [
      { schoolName: '開成中学', subject: '小学理科', year: '2026', round: '1', requiredHours: 3, deadline: '2026-04-01' },
      { schoolName: '開成中学', subject: '小学算数', year: '2026', round: '1', requiredHours: 2, deadline: '2026-04-01' },
    ];
    const csv = toCSV(templateData, NEW_YEAR_TASK_CSV_COLUMNS);
    downloadCSV(csv, '新年度試験種一括登録テンプレート.csv');
  };

  // --- CSV一括登録+PDF紐付け handlers ---
  const handleCsvImportParse = (text) => {
    setCsvImportText(text);
    setCsvImportResult(null);
    setCsvImportPdfFiles([]);
    setCsvImportMatches({});
    if (!text.trim()) { setCsvImportParsed(null); return; }
    let csvText = text;
    if (!text.includes(',') && text.includes('\t')) {
      csvText = text.split('\n').map(line => line.split('\t').map(cell => {
        const trimmed = cell.trim();
        if (trimmed.includes(',') || trimmed.includes('"') || trimmed.includes('\n')) return '"' + trimmed.replace(/"/g, '""') + '"';
        return trimmed;
      }).join(',')).join('\n');
    }
    const { rows } = parseCSV(csvText);
    const result = validateCsvImportTaskCSV(rows, {
      subjects: SUBJECTS_LIST,
      workTypes: workTypesList,
    });
    setCsvImportParsed(result);
  };

  const handleCsvImportFile = async () => {
    try {
      const { headers, rows } = await importCSVFile();
      const csvText = [headers.join(','), ...rows.map(r => headers.map(h => r[h] ?? '').join(','))].join('\n');
      setCsvImportText(csvText);
      handleCsvImportParse(csvText);
    } catch (err) {
      // user cancelled
    }
  };

  const handleCsvImportPdfUpload = (e) => {
    const files = Array.from(e.target.files || []);
    setCsvImportPdfFiles(files);
    if (!csvImportParsed || csvImportParsed.valid.length === 0) return;

    // Auto-match: flexible filename pattern
    const matches = {};
    files.forEach((file, fileIdx) => {
      const baseName = file.name.replace(/\.[^.]+$/, '');
      const parts = baseName.split('_');
      if (parts.length >= 3) {
        const fileSchool = parts[0];
        const fileSubject = SUBJECT_ALIASES[parts[1]] || parts[1];
        const fileYear = parts[2];
        const rowIdx = csvImportParsed.valid.findIndex(r => {
          const schoolMatch = (r.schoolName || '').includes(fileSchool) || fileSchool.includes(r.schoolName || '');
          const subjectMatch = r.subject === fileSubject;
          const yearMatch = r.year === fileYear;
          return schoolMatch && subjectMatch && yearMatch;
        });
        if (rowIdx >= 0) {
          matches[csvImportParsed.valid[rowIdx].matchKey] = fileIdx;
        }
      }
    });
    setCsvImportMatches(matches);
  };

  const handleCsvImportRegister = async () => {
    if (!csvImportParsed || csvImportParsed.valid.length === 0) return;
    setCsvImportRegistering(true);
    let taskCount = 0;
    let fileCount = 0;

    try {
      for (const row of csvImportParsed.valid) {
        const newTask = addTask({
          name: row.taskName,
          schoolName: row.schoolName,
          subject: row.subject,
          year: row.year,
          round: row.round,
          workType: row.workType,
          requiredHours: row.requiredHours,
          deadline: row.deadline,
          viking: row.viking,
          sheetsUrl: '',
          fieldId: null,
        });
        taskCount++;

        // Attach matched PDF
        if (newTask?.id && csvImportMatches[row.matchKey] !== undefined) {
          const file = csvImportPdfFiles[csvImportMatches[row.matchKey]];
          if (file) {
            try {
              const meta = await saveTaskAttachment({
                taskId: newTask.id,
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
                blob: file,
              });
              updateTask(newTask.id, { taskAttachments: [meta] });
              fileCount++;
            } catch (err) {
              console.error('Failed to save task attachment:', err);
            }
          }
        }
      }

      setCsvImportResult(`${taskCount}件登録完了、${fileCount}件ファイル紐付け`);
      setCsvImportParsed(null);
      setCsvImportText('');
      setCsvImportPdfFiles([]);
      setCsvImportMatches({});
      setMessage(`CSV一括登録: ${taskCount}件追加、${fileCount}件PDF紐付け`);
      setTimeout(() => setMessage(''), 5000);
    } finally {
      setCsvImportRegistering(false);
    }
  };

  const handleDownloadCsvImportTemplate = () => {
    const templateData = [
      { schoolName: schools[0]?.name || '開成中学', subject: '小学理科', year: '2026', round: '1', workType: workTypesList[0] || '新年度試験種', requiredHours: 3, deadline: '2026-04-01', viking: 'true' },
      { schoolName: schools[0]?.name || '開成中学', subject: '小学算数', year: '2026', round: '第2回', workType: workTypesList[0] || '新年度試験種', requiredHours: 2, deadline: '2026-04-01', viking: 'false' },
    ];
    const csv = toCSV(templateData, CSV_IMPORT_TASK_COLUMNS);
    downloadCSV(csv, 'CSV一括登録テンプレート.csv');
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
        correctorManagementId: u?.managementId || '',
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
    { key: 'csv-import', icon: '\u{1F4E5}', title: 'CSV一括登録', desc: 'CSVで試験種を一括登録' },
    { key: 'daimon', icon: '\u{1F4C4}', title: '大問情報一括登録', desc: '各試験種の大問構成を登録' },
    { key: 'pdf-upload', icon: '\u{1F4C4}', title: 'PDF一括アップロード', desc: 'ファイル名で登録済みタスクに自動紐付け' },
    { key: 'pdf-status', icon: '\u{1F4CA}', title: 'PDF登録ステータス', desc: '試験種ごとのPDF紐付け状況を確認' },
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
            {/* 学校名・科目・年度・回数・作業内容 */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="relative">
                <label className="block text-xs font-medium text-gray-600 mb-1">学校名</label>
                <input
                  type="text"
                  value={form.schoolName}
                  onChange={e => {
                    const val = e.target.value;
                    setForm({ ...form, schoolName: val });
                    if (val.length >= 1) {
                      const filtered = SCHOOL_SUGGESTIONS.filter(s => s.toLowerCase().includes(val.toLowerCase()));
                      setSchoolSuggestions(filtered.slice(0, 20));
                      setShowSchoolSuggestions(filtered.length > 0);
                    } else {
                      setSchoolSuggestions([]);
                      setShowSchoolSuggestions(false);
                    }
                  }}
                  onFocus={() => {
                    if (form.schoolName.length >= 1) {
                      const filtered = SCHOOL_SUGGESTIONS.filter(s => s.toLowerCase().includes(form.schoolName.toLowerCase()));
                      setSchoolSuggestions(filtered.slice(0, 20));
                      setShowSchoolSuggestions(filtered.length > 0);
                    }
                  }}
                  onBlur={() => {
                    setTimeout(() => {
                      setShowSchoolSuggestions(false);
                      if (form.schoolName && !SCHOOL_SUGGESTIONS.includes(form.schoolName)) {
                        setError('学校名はリストから選択してください');
                      } else {
                        setError('');
                      }
                    }, 200);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="学校名を入力..."
                  autoComplete="off"
                />
                {showSchoolSuggestions && schoolSuggestions.length > 0 && (
                  <ul className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {schoolSuggestions.map((s, i) => (
                      <li
                        key={i}
                        className="px-3 py-1.5 text-sm hover:bg-blue-50 cursor-pointer"
                        onMouseDown={() => {
                          setForm({ ...form, schoolName: s });
                          setShowSchoolSuggestions(false);
                          setError('');
                        }}
                      >
                        {s}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
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
                <label className="block text-xs font-medium text-gray-600 mb-1">年度</label>
                <select
                  value={form.year}
                  onChange={e => setForm({ ...form, year: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {[2025, 2026, 2027, 2028, 2029, 2030].map(y => (
                    <option key={y} value={String(y)}>{y}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">回数</label>
                <select
                  value={form.round}
                  onChange={e => setForm({ ...form, round: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {['1', '2'].map(r => (
                    <option key={r} value={r}>{r}</option>
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
            {/* 自動生成されるタスク名プレビュー */}
            {(form.schoolName || form.subject) && (
              <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                タスク名: <span className="font-medium text-gray-700">{[form.schoolName, form.subject, form.year, form.round].filter(Boolean).join('_') || '—'}</span>
              </div>
            )}
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
            {form.workType === '新年度試験種' && (
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
                    分野情報追加
                    <span className="ml-1 text-gray-400 font-normal">（大問ごとに分野・大問ID・takosリンクを登録）</span>
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
                        {getFields(form.subject).length > 0 && (
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
                        )}
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

      {/* ===== Section: 大問情報一括登録 ===== */}
      {activeSection === 'daimon' && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">大問情報一括登録</h3>
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
                  各学校・科目の大問情報を一括登録します。同じ学校名+科目+年度+回数の行は1つのタスクにまとめられます。
                  既存のタスクがあればそこに大問情報を追加し、なければ新規タスクを作成します。
                  分野は小学算数・小学理科では入力推奨、小学国語・小学社会では空欄可です。
                </p>
                <p className="text-xs text-gray-400">
                  ヘッダ行: 学校名,科目,年度,回数,大問名,分野,大問ID,takosリンク
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
                  placeholder={`学校名,科目,年度,回数,大問名,分野,大問ID,takosリンク\nB96: 開成,小学理科,2026,1,大問1,中和,Q001,https://takos.example.com/q001\nB96: 開成,小学理科,2026,1,大問2,てこ,Q002,https://takos.example.com/q002\nB16: 麻布,小学国語,2026,1,大問1,,,\nB16: 麻布,小学国語,2026,1,大問2,,,`}
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
                              <th className="px-2 py-1 text-left border border-gray-200">年度</th>
                              <th className="px-2 py-1 text-left border border-gray-200">回数</th>
                              <th className="px-2 py-1 text-left border border-gray-200">大問名</th>
                              <th className="px-2 py-1 text-left border border-gray-200">分野</th>
                              <th className="px-2 py-1 text-left border border-gray-200">大問ID</th>
                              <th className="px-2 py-1 text-left border border-gray-200">takosリンク</th>
                            </tr>
                          </thead>
                          <tbody>
                            {daimonCsvParsed.valid.map((row, i) => {
                              const prevRow = i > 0 ? daimonCsvParsed.valid[i - 1] : null;
                              const isNewGroup = !prevRow || prevRow.schoolName !== row.schoolName || prevRow.subject !== row.subject || prevRow.year !== row.year || prevRow.round !== row.round;
                              return (
                                <tr key={i} className={`hover:bg-green-100/50 ${isNewGroup ? 'border-t-2 border-t-purple-300 bg-green-50/80' : 'bg-green-50/30'}`}>
                                  <td className="px-2 py-1 border border-gray-200 text-gray-400">{row._line}</td>
                                  <td className="px-2 py-1 border border-gray-200">{row.schoolName}</td>
                                  <td className="px-2 py-1 border border-gray-200">{row.subject}</td>
                                  <td className="px-2 py-1 border border-gray-200">{row.year}</td>
                                  <td className="px-2 py-1 border border-gray-200">{row.round}</td>
                                  <td className="px-2 py-1 border border-gray-200">{row.daimonName}</td>
                                  <td className="px-2 py-1 border border-gray-200">{row.fieldName || <span className="text-gray-300">-</span>}</td>
                                  <td className="px-2 py-1 border border-gray-200">{row.daimonId || <span className="text-gray-300">-</span>}</td>
                                  <td className="px-2 py-1 border border-gray-200">{row.takosLink ? <a href={row.takosLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline truncate block max-w-[200px]">{row.takosLink}</a> : <span className="text-gray-300">-</span>}</td>
                                </tr>
                              );
                            })}
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
                          大問情報を登録（{daimonCsvParsed.valid.length}件）
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

      {/* ===== Section: 新年度試験種 一括登録 ===== */}
      {activeSection === 'shinnendo' && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">新年度試験種 一括登録</h3>
          <div className="flex items-center gap-2 mb-3">
            <button
              type="button"
              onClick={handleDownloadShinnendoTemplate}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition font-medium"
            >
              テンプレートCSVダウンロード
            </button>
          </div>

          <div className="space-y-4">
            {/* Step 1: CSV Import */}
            <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-4 space-y-3">
              <p className="text-xs font-semibold text-blue-700">Step 1: CSV読み込み</p>
              <p className="text-xs text-gray-500">
                ヘッダ行: 学校名,科目,年度,工数,期限 （工数・期限はオプション）
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleShinnendoCsvFile}
                  className="text-sm px-3 py-1.5 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition font-medium"
                >
                  CSVファイルを選択
                </button>
                <span className="text-xs text-gray-400 self-center">または下のテキストエリアに貼り付け</span>
              </div>
              <textarea
                value={shinnendoCsvText}
                onChange={e => handleShinnendoCsvParse(e.target.value)}
                rows={5}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder={`学校名,科目,年度,工数,期限\n開成中学,理科,2026,3,2026-04-01\n開成中学,算数,2026,2,2026-04-01`}
              />

              {shinnendoParsed && (
                <div className="space-y-2">
                  <div className="flex gap-3 text-xs font-medium">
                    <span className="text-green-700">有効: {shinnendoParsed.valid.length}件</span>
                    <span className="text-red-600">エラー: {shinnendoParsed.errors.length}件</span>
                  </div>

                  {shinnendoParsed.errors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-32 overflow-y-auto">
                      {shinnendoParsed.errors.map((err, i) => (
                        <p key={i} className="text-xs text-red-600">{err.line}行目: {err.message}</p>
                      ))}
                    </div>
                  )}

                  {shinnendoParsed.valid.length > 0 && (
                    <div className="overflow-x-auto max-h-60 overflow-y-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="px-2 py-1 text-left border border-gray-200">行</th>
                            <th className="px-2 py-1 text-left border border-gray-200">学校名</th>
                            <th className="px-2 py-1 text-left border border-gray-200">科目</th>
                            <th className="px-2 py-1 text-left border border-gray-200">年度</th>
                            <th className="px-2 py-1 text-right border border-gray-200">工数</th>
                            <th className="px-2 py-1 text-left border border-gray-200">期限</th>
                            <th className="px-2 py-1 text-left border border-gray-200">PDF</th>
                          </tr>
                        </thead>
                        <tbody>
                          {shinnendoParsed.valid.map((row, i) => (
                            <tr key={i} className="bg-green-50/50 hover:bg-green-100/50">
                              <td className="px-2 py-1 border border-gray-200 text-gray-400">{row._line}</td>
                              <td className="px-2 py-1 border border-gray-200">{row.schoolName}</td>
                              <td className="px-2 py-1 border border-gray-200">{row.subject}</td>
                              <td className="px-2 py-1 border border-gray-200">{row.year}</td>
                              <td className="px-2 py-1 border border-gray-200 text-right">{row.requiredHours}h</td>
                              <td className="px-2 py-1 border border-gray-200">{row.deadline || '-'}</td>
                              <td className="px-2 py-1 border border-gray-200 text-center">
                                {shinnendoMatches[row.matchKey] !== undefined
                                  ? <span className="text-green-600 font-medium">{shinnendoPdfFiles[shinnendoMatches[row.matchKey]]?.name}</span>
                                  : <span className="text-gray-400">-</span>
                                }
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step 2: PDF Upload (only shown after CSV loaded) */}
            {shinnendoParsed && shinnendoParsed.valid.length > 0 && (
              <div className="bg-green-50/50 border border-green-200 rounded-lg p-4 space-y-3">
                <p className="text-xs font-semibold text-green-700">Step 2: 問題PDF一括アップロード（オプション）</p>
                <p className="text-xs text-gray-500">
                  ファイル名パターン: <code className="bg-gray-100 px-1 rounded">学校名_科目_年度.pdf</code>（例: 開成中学_理科_2026.pdf）
                </p>
                <input
                  type="file"
                  accept=".pdf"
                  multiple
                  onChange={handleShinnendoPdfUpload}
                  className="block text-sm text-gray-600 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-gray-300 file:text-sm file:font-medium file:bg-white file:text-gray-700 hover:file:bg-gray-50"
                />
                {shinnendoPdfFiles.length > 0 && (
                  <div className="text-xs space-y-1">
                    <p className="font-medium text-gray-700">{shinnendoPdfFiles.length}件のPDFファイル選択済み</p>
                    <p className="text-green-600">マッチ: {Object.keys(shinnendoMatches).length}件</p>
                    {shinnendoPdfFiles.length - Object.keys(shinnendoMatches).length > 0 && (
                      <div className="text-amber-600">
                        <p>未マッチ: {shinnendoPdfFiles.length - Object.keys(shinnendoMatches).length}件</p>
                        <ul className="list-disc list-inside ml-2 text-gray-500">
                          {shinnendoPdfFiles
                            .filter((_, idx) => !Object.values(shinnendoMatches).includes(idx))
                            .map((f, i) => (
                              <li key={i}>{f.name}</li>
                            ))
                          }
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Register */}
            {shinnendoParsed && shinnendoParsed.valid.length > 0 && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleShinnendoRegister}
                  disabled={shinnendoRegistering}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
                >
                  {shinnendoRegistering ? '登録中...' : `一括登録（${shinnendoParsed.valid.length}件）`}
                </button>
                <button
                  type="button"
                  onClick={() => { setShinnendoParsed(null); setShinnendoCsvText(''); setShinnendoPdfFiles([]); setShinnendoMatches({}); setShinnendoResult(null); }}
                  className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 px-4 py-2 rounded-lg transition"
                >
                  クリア
                </button>
              </div>
            )}

            {shinnendoResult && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm font-medium">
                {shinnendoResult}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== Section: CSV+PDF一括登録 ===== */}
      {activeSection === 'csv-import' && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">CSV一括登録</h3>
          <div className="flex items-center gap-2 mb-3">
            <button
              type="button"
              onClick={handleDownloadCsvImportTemplate}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition font-medium"
            >
              テンプレートCSVダウンロード
            </button>
          </div>

          <div className="space-y-4">
            {/* Step 1: CSV Import */}
            <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-4 space-y-3">
              <p className="text-xs font-semibold text-blue-700">Step 1: CSV読み込み</p>
              <p className="text-xs text-gray-500">
                ヘッダ行: 学校名,科目,年度,回数,作業内容,工数,期限,VIKING
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCsvImportFile}
                  className="text-sm px-3 py-1.5 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition font-medium"
                >
                  CSVファイルを選択
                </button>
                <span className="text-xs text-gray-400 self-center">または下のテキストエリアに貼り付け</span>
              </div>
              <textarea
                value={csvImportText}
                onChange={e => handleCsvImportParse(e.target.value)}
                rows={5}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder={`学校名,科目,年度,回数,作業内容,工数,期限,VIKING\n開成中学,理科,2026,第1回,新年度試験種,3,2026-04-01,true`}
              />

              {csvImportParsed && (
                <div className="space-y-2">
                  <div className="flex gap-3 text-xs font-medium">
                    <span className="text-green-700">有効: {csvImportParsed.valid.length}件</span>
                    <span className="text-red-600">エラー: {csvImportParsed.errors.length}件</span>
                  </div>

                  {csvImportParsed.errors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-32 overflow-y-auto">
                      {csvImportParsed.errors.map((err, i) => (
                        <p key={i} className="text-xs text-red-600">{err.line}行目: {err.message}</p>
                      ))}
                    </div>
                  )}

                  {csvImportParsed.valid.length > 0 && (
                    <div className="overflow-x-auto max-h-60 overflow-y-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="px-2 py-1 text-left border border-gray-200">行</th>
                            <th className="px-2 py-1 text-left border border-gray-200">学校名</th>
                            <th className="px-2 py-1 text-left border border-gray-200">科目</th>
                            <th className="px-2 py-1 text-left border border-gray-200">年度</th>
                            <th className="px-2 py-1 text-left border border-gray-200">回数</th>
                            <th className="px-2 py-1 text-left border border-gray-200">作業内容</th>
                            <th className="px-2 py-1 text-right border border-gray-200">工数</th>
                            <th className="px-2 py-1 text-left border border-gray-200">期限</th>
                            <th className="px-2 py-1 text-center border border-gray-200">VIKING</th>
                            <th className="px-2 py-1 text-left border border-gray-200">タスク名</th>
                          </tr>
                        </thead>
                        <tbody>
                          {csvImportParsed.valid.map((row, i) => (
                            <tr key={i} className="bg-green-50/50 hover:bg-green-100/50">
                              <td className="px-2 py-1 border border-gray-200 text-gray-400">{row._line}</td>
                              <td className="px-2 py-1 border border-gray-200">{row.schoolName}</td>
                              <td className="px-2 py-1 border border-gray-200">{row.subject}</td>
                              <td className="px-2 py-1 border border-gray-200">{row.year}</td>
                              <td className="px-2 py-1 border border-gray-200">{row.round}</td>
                              <td className="px-2 py-1 border border-gray-200">{row.workType}</td>
                              <td className="px-2 py-1 border border-gray-200 text-right">{row.requiredHours}h</td>
                              <td className="px-2 py-1 border border-gray-200">{row.deadline}</td>
                              <td className="px-2 py-1 border border-gray-200 text-center">{row.viking ? '○' : ''}</td>
                              <td className="px-2 py-1 border border-gray-200 text-gray-500">{row.taskName}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 登録ボタン */}
            {csvImportParsed && csvImportParsed.valid.length > 0 && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCsvImportRegister}
                  disabled={csvImportRegistering}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
                >
                  {csvImportRegistering ? '登録中...' : `一括登録（${csvImportParsed.valid.length}件）`}
                </button>
                <button
                  type="button"
                  onClick={() => { setCsvImportParsed(null); setCsvImportText(''); setCsvImportPdfFiles([]); setCsvImportMatches({}); setCsvImportResult(null); }}
                  className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 px-4 py-2 rounded-lg transition"
                >
                  クリア
                </button>
              </div>
            )}

            {csvImportResult && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm font-medium">
                {csvImportResult}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== Section: PDF一括アップロード ===== */}
      {activeSection === 'pdf-upload' && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">PDF一括アップロード</h3>
          <p className="text-xs text-gray-500 mb-4">
            ファイル名の形式: <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">学校名_科目_年度_回数.pdf</code><br />
            例: <code className="bg-gray-100 px-1 rounded">開成_算数_2026_1.pdf</code> → 「B96: 開成_小学算数_2026_1」に自動マッチ<br />
            科目は「算数」「理科」等の短縮名でもOKです。
          </p>
          <input
            type="file"
            accept=".pdf"
            multiple
            onChange={async (e) => {
              const files = Array.from(e.target.files);
              if (files.length === 0) return;
              const allTasks = getTasks();
              let matched = 0;
              let unmatched = [];
              for (const file of files) {
                const task = matchPdfToTask(file.name, allTasks);
                if (task) {
                  try {
                    const meta = await saveTaskAttachment({ taskId: task.id, fileName: file.name, fileSize: file.size, fileType: file.type, blob: file });
                    const existing = task.taskAttachments || [];
                    updateTask(task.id, { taskAttachments: [...existing, meta] });
                    matched++;
                  } catch (err) { console.error(err); }
                } else {
                  unmatched.push(file.name);
                }
              }
              const msg = `${matched}件のPDFを紐付けました。` + (unmatched.length > 0 ? ` 未マッチ: ${unmatched.join(', ')}` : '');
              setMessage(msg);
              setTimeout(() => setMessage(''), 5000);
              e.target.value = '';
            }}
            className="block text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-gray-300 file:text-sm file:font-medium file:bg-white file:text-gray-700 hover:file:bg-gray-50 mb-4"
          />
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500">
            <p className="font-medium text-gray-700 mb-1">マッチング例:</p>
            <ul className="space-y-0.5">
              <li><code>開成中学_理科_2026.pdf</code> → タスク「開成中学_理科_2026_第1回」に紐付け</li>
              <li><code>麻布中学_算数_2026.pdf</code> → タスク「麻布中学_算数_2026_第1回」に紐付け</li>
            </ul>
          </div>
        </div>
      )}

      {/* ===== Section: PDF登録ステータス ===== */}
      {activeSection === 'pdf-status' && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">PDF登録ステータス</h3>
          {(() => {
            const allTasks = tasks.filter(t => t.workType === '新年度試験種');
            if (allTasks.length === 0) return <p className="text-xs text-gray-400 text-center py-4">新年度試験種のタスクがありません</p>;
            const withPdf = allTasks.filter(t => t.taskAttachments?.length > 0);
            const withoutPdf = allTasks.filter(t => !t.taskAttachments || t.taskAttachments.length === 0);
            return (
              <div className="space-y-4">
                <div className="flex gap-4 text-sm">
                  <span className="text-green-700 font-medium">PDF登録済み: {withPdf.length}件</span>
                  <span className="text-red-600 font-medium">未登録: {withoutPdf.length}件</span>
                  <span className="text-gray-500">合計: {allTasks.length}件</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div className="bg-green-500 h-3 rounded-full transition-all" style={{ width: `${allTasks.length > 0 ? (withPdf.length / allTasks.length * 100) : 0}%` }}></div>
                </div>
                {withoutPdf.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-red-600 mb-2">PDF未登録のタスク</p>
                    <div className="space-y-1 max-h-60 overflow-y-auto">
                      {withoutPdf.map(t => (
                        <div key={t.id} className="flex items-center gap-2 p-2 bg-red-50 rounded-lg text-xs">
                          <span className="text-red-400">●</span>
                          <span className="font-medium text-gray-700">{t.name}</span>
                          <span className="text-gray-400">{t.subject}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {withPdf.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-green-700 mb-2">PDF登録済みのタスク</p>
                    <div className="space-y-1 max-h-60 overflow-y-auto">
                      {withPdf.map(t => (
                        <div key={t.id} className="flex items-center gap-2 p-2 bg-green-50 rounded-lg text-xs">
                          <span className="text-green-500">●</span>
                          <span className="font-medium text-gray-700">{t.name}</span>
                          <span className="text-gray-400">{t.subject} · {t.taskAttachments.length}件</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
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


export default TaskAndAssignmentTab;
