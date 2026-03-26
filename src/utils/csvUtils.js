import { SUBJECTS_LIST } from './storage.js';
// CSV Utility Functions — BOM付きUTF-8で日本語対応

/**
 * CSVフィールドをエスケープ
 */
const escapeCSV = (value) => {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
};

/**
 * CSV行をパース（引用符対応、RFC 4180準拠）
 */
const parseCSVLines = (text) => {
  const result = [];
  let current = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { current.push(field); field = ''; }
      else if (ch === '\n' || (ch === '\r' && text[i + 1] === '\n')) {
        current.push(field); field = '';
        result.push(current); current = [];
        if (ch === '\r') i++;
      } else if (ch === '\r') {
        current.push(field); field = '';
        result.push(current); current = [];
      } else {
        field += ch;
      }
    }
  }
  if (field || current.length > 0) { current.push(field); result.push(current); }
  return result;
};

/**
 * オブジェクト配列をCSV文字列に変換
 * @param {Array<Object>} data
 * @param {Array<{key: string, header: string}>} columns
 * @returns {string} BOM付きUTF-8 CSV文字列
 */
export const toCSV = (data, columns) => {
  const BOM = '\uFEFF';
  const header = columns.map(c => escapeCSV(c.header)).join(',');
  const rows = data.map(item =>
    columns.map(c => escapeCSV(item[c.key])).join(',')
  );
  return BOM + [header, ...rows].join('\r\n');
};

/**
 * CSV文字列をオブジェクト配列にパース
 * @param {string} csvText
 * @returns {{headers: string[], rows: Object[]}}
 */
export const parseCSV = (csvText) => {
  const text = csvText.replace(/^\uFEFF/, '');
  const lines = parseCSVLines(text);
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = lines[0];
  const rows = lines.slice(1)
    .filter(line => line.some(cell => cell.trim() !== ''))
    .map(line => {
      const obj = {};
      headers.forEach((h, i) => { obj[h.trim()] = (line[i] ?? '').trim(); });
      return obj;
    });

  return { headers: headers.map(h => h.trim()), rows };
};

/**
 * CSVファイルをダウンロード
 */
export const downloadCSV = (csvString, filename) => {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * ファイル選択ダイアログでCSVを読み込む
 * @returns {Promise<{headers: string[], rows: Object[]}>}
 */
export const importCSVFile = () => {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.txt';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) { reject(new Error('ファイルが選択されませんでした')); return; }
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          resolve(parseCSV(ev.target.result));
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'));
      reader.readAsText(file, 'UTF-8');
    };
    input.click();
  });
};

/**
 * ユーザーCSVのバリデーション
 * 必須: 氏名
 * オプション: ログインID, メールアドレス, ロール, 担当科目
 */
export const validateUserCSV = (rows) => {
  const valid = [];
  const errors = [];

  rows.forEach((row, i) => {
    const lineNum = i + 2;
    const name = (row['氏名'] || '').trim();
    if (!name) { errors.push(`${lineNum}行目: 氏名が空です`); return; }

    const role = (row['ロール'] || 'corrector').trim().toLowerCase();
    if (!['leader', 'corrector', 'リーダー', '添削者'].includes(role)) {
      errors.push(`${lineNum}行目: ロールは leader/corrector/リーダー/添削者 のいずれかにしてください`);
      return;
    }

    const normalizedRole = (role === 'リーダー' || role === 'leader') ? 'leader' : 'corrector';

    const subjectsRaw = row['担当科目'] || '';
    const subjects = subjectsRaw
      .split(/[;；、,・]/)
      .map(s => s.trim())
      .filter(Boolean);

    const employeeId = (row['管理ID'] || '').trim() || null;
    if (employeeId && !/^N\d{8}$/.test(employeeId)) {
      errors.push(`${lineNum}行目: 管理IDは N+8桁の数字 (例: N00000001) の形式にしてください`);
      return;
    }

    valid.push({
      name,
      employeeId,
      loginId: (row['ログインID'] || '').trim() || null,
      email: (row['メールアドレス'] || '').trim() || '',
      role: normalizedRole,
      subjects,
    });
  });

  return { valid, errors };
};

/**
 * 分野研修クリアCSVのバリデーション
 * CSVフォーマット: ヘッダ行の1列目が「ログインID」or「氏名」、残りの列が分野名
 * データ行: 1列目がユーザー識別子、残りの列に「○」「1」「✓」等があればクリア済み
 *
 * @param {Object[]} rows - parseCSVで得られたオブジェクト配列
 * @param {Object[]} fields - DataContextのgetFields()で取得した分野一覧
 * @param {Object[]} users - DataContextのgetUsers()で取得したユーザー一覧
 * @returns {{ valid: Object[], errors: string[], summary: { userCount: number, fieldCount: number } }}
 */
export const validateFieldClearanceCSV = (rows, fields, users) => {
  const valid = [];
  const errors = [];
  const matchedUserIds = new Set();
  const matchedFieldIds = new Set();

  // ヘッダから分野名カラムを特定（1列目はユーザー識別用なので除外）
  // rows はオブジェクト配列なので、キーから分野名を取得
  if (rows.length === 0) {
    errors.push('データ行がありません');
    return { valid, errors, summary: { userCount: 0, fieldCount: 0 } };
  }

  const allKeys = Object.keys(rows[0]);
  // 1列目のキーはユーザー識別子
  const userKey = allKeys[0];
  const fieldColumns = allKeys.slice(1);

  // 分野名→分野オブジェクトのマップ
  const fieldMap = new Map();
  fields.forEach(f => {
    fieldMap.set(f.name, f);
    // 念のためトリムしたものも
    fieldMap.set(f.name.trim(), f);
  });

  // ユーザー検索ヘルパー: loginId → name の順で照合
  const findUser = (identifier) => {
    if (!identifier) return null;
    const trimmed = identifier.trim();
    return users.find(u => u.loginId === trimmed) ||
           users.find(u => u.name === trimmed) ||
           null;
  };

  // 「クリア済み」と判定する値
  const isClearedValue = (val) => {
    const v = (val ?? '').trim();
    return v === '○' || v === '◯' || v === '1' || v === '✓' || v === '✔' || v === 'o' || v === 'O' || v === 'yes' || v === 'Yes' || v === 'YES' || v === 'true' || v === 'x' || v === 'X';
  };

  // 未解決の分野名を先にチェック
  const unknownFields = [];
  fieldColumns.forEach(col => {
    if (!fieldMap.has(col.trim())) {
      unknownFields.push(col.trim());
    }
  });
  if (unknownFields.length > 0) {
    errors.push(`不明な分野名: ${unknownFields.join('、')}`);
  }

  rows.forEach((row, i) => {
    const lineNum = i + 2;
    const identifier = (row[userKey] ?? '').trim();
    if (!identifier) {
      errors.push(`${lineNum}行目: ユーザー識別子が空です`);
      return;
    }

    const user = findUser(identifier);
    if (!user) {
      errors.push(`${lineNum}行目: ユーザー「${identifier}」が見つかりません`);
      return;
    }

    fieldColumns.forEach(col => {
      const field = fieldMap.get(col.trim());
      if (!field) return; // 既にエラー報告済み
      if (isClearedValue(row[col])) {
        valid.push({ userId: user.id, fieldId: field.id, userName: user.name, fieldName: field.name });
        matchedUserIds.add(user.id);
        matchedFieldIds.add(field.id);
      }
    });
  });

  return {
    valid,
    errors,
    summary: { userCount: matchedUserIds.size, fieldCount: matchedFieldIds.size },
  };
};

/**
 * タスク一括登録CSVのバリデーション
 * CSVフォーマット: タスク名,科目,作業内容,工数(h),期限,VIKING,分野名
 *
 * @param {Object[]} rows - parseCSVで得られたオブジェクト配列
 * @param {Object} context - { subjects: string[], workTypes: string[], fields: Function, getFields(subject) }
 * @returns {{ valid: Object[], errors: {line: number, message: string, row: Object}[] }}
 */
export const validateTaskCSV = (rows, context) => {
  const { subjects, workTypes, getFieldsFn } = context;
  const valid = [];
  const errors = [];

  rows.forEach((row, i) => {
    const lineNum = i + 2;
    const rowErrors = [];

    const name = (row['タスク名'] || '').trim();
    if (!name) rowErrors.push('タスク名が空です');

    const subject = (row['科目'] || '').trim();
    if (!subject) {
      rowErrors.push('科目が空です');
    } else if (!subjects.includes(subject)) {
      rowErrors.push(`科目「${subject}」は無効です（${subjects.join('/')}）`);
    }

    const workType = (row['作業内容'] || '').trim();
    if (!workType) {
      rowErrors.push('作業内容が空です');
    } else if (!workTypes.includes(workType)) {
      rowErrors.push(`作業内容「${workType}」は無効です`);
    }

    const hoursStr = (row['工数(h)'] || row['工数'] || '').trim();
    const requiredHours = hoursStr ? parseFloat(hoursStr) : 0;
    if (hoursStr && (isNaN(requiredHours) || requiredHours < 0)) {
      rowErrors.push('工数は0以上の数値で入力してください');
    }

    const deadline = (row['期限'] || '').trim();
    if (!deadline) {
      rowErrors.push('期限が空です');
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
      rowErrors.push('期限はYYYY-MM-DD形式で入力してください');
    }

    const vikingRaw = (row['VIKING'] || '').trim().toUpperCase();
    const viking = vikingRaw === 'TRUE' || vikingRaw === '1' || vikingRaw === 'YES' || vikingRaw === '○';

    const sheetsUrl = (row['スプレッドシートURL'] || '').trim();

    // 分野名（オプション）
    const fieldName = (row['分野名'] || '').trim();
    let fieldId = null;
    if (fieldName && subject && getFieldsFn) {
      const fields = getFieldsFn(subject);
      const matched = fields.find(f => f.name === fieldName);
      if (matched) {
        fieldId = matched.id;
      } else {
        rowErrors.push(`分野「${fieldName}」が科目「${subject}」に見つかりません`);
      }
    }

    if (rowErrors.length > 0) {
      errors.push({ line: lineNum, message: rowErrors.join('；'), row });
    } else {
      valid.push({
        name,
        subject,
        workType,
        requiredHours,
        deadline,
        viking,
        sheetsUrl,
        fieldId,
        _line: lineNum,
      });
    }
  });

  return { valid, errors };
};

export const TASK_IMPORT_CSV_COLUMNS = [
  { key: 'name', header: 'タスク名' },
  { key: 'subject', header: '科目' },
  { key: 'workType', header: '作業内容' },
  { key: 'requiredHours', header: '工数(h)' },
  { key: 'deadline', header: '期限' },
  { key: 'viking', header: 'VIKING' },
  { key: 'sheetsUrl', header: 'スプレッドシートURL' },
  { key: 'fieldName', header: '分野名' },
];

// ---------- カラム定義 ----------

export const USER_CSV_COLUMNS = [
  { key: 'name', header: '氏名' },
  { key: 'employeeId', header: '管理ID' },
  { key: 'loginId', header: 'ログインID' },
  { key: 'email', header: 'メールアドレス' },
  { key: 'role', header: 'ロール' },
  { key: 'subjects', header: '担当科目' },
];

export const ASSIGNMENT_CSV_COLUMNS = [
  { key: 'taskName', header: 'タスク名' },
  { key: 'subject', header: '科目' },
  { key: 'workType', header: '業務種別' },
  { key: 'correctorName', header: '担当者' },
  { key: 'correctorLoginId', header: '担当者ID' },
  { key: 'assignedHours', header: '割当工数' },
  { key: 'actualHours', header: '実績工数' },
  { key: 'status', header: 'ステータス' },
  { key: 'assignedAt', header: '割当日' },
  { key: 'submittedAt', header: '提出日' },
];

export const CAPACITY_CSV_COLUMNS = [
  { key: 'userName', header: '作業者名' },
  { key: 'userLoginId', header: '作業者ID' },
  { key: 'startDate', header: '開始日' },
  { key: 'endDate', header: '終了日' },
  { key: 'hoursPerDay', header: '日あたり工数' },
  { key: 'totalHours', header: '合計工数' },
  { key: 'note', header: '備考' },
];

export const EVALUATION_CSV_COLUMNS = [
  { key: 'userName', header: '作業者名' },
  { key: 'userLoginId', header: '作業者ID' },
  { key: 'criteriaName', header: '評価基準' },
  { key: 'score', header: 'スコア' },
  { key: 'maxScore', header: '最大スコア' },
  { key: 'note', header: '備考' },
];

/**
 * 試験種タスクCSV（学校名ベース）のバリデーション
 * CSVフォーマット: 学校名,科目,作業内容,工数,期限
 *
 * @param {Object[]} rows - parseCSVで得られたオブジェクト配列
 * @param {Object} context - { schools, subjects, workTypes }
 * @returns {{ valid: Object[], errors: {line: number, message: string, row: Object}[] }}
 */
export const validateExamTaskCSV = (rows, context) => {
  const { schools, subjects, workTypes } = context;
  const valid = [];
  const errors = [];

  rows.forEach((row, i) => {
    const lineNum = i + 2;
    const rowErrors = [];

    const schoolName = (row['学校名'] || '').trim();
    if (!schoolName) {
      rowErrors.push('学校名が空です');
    }
    const school = schools.find(s => s.name === schoolName);
    if (schoolName && !school) {
      rowErrors.push(`学校「${schoolName}」が見つかりません`);
    }

    const subject = (row['科目'] || '').trim();
    if (!subject) {
      rowErrors.push('科目が空です');
    } else if (!subjects.includes(subject)) {
      rowErrors.push(`科目「${subject}」は無効です（${subjects.join('/')}）`);
    }

    const workType = (row['作業内容'] || '').trim();
    if (!workType) {
      rowErrors.push('作業内容が空です');
    } else if (!workTypes.includes(workType)) {
      rowErrors.push(`作業内容「${workType}」は無効です（${workTypes.join('/')}）`);
    }

    const hoursStr = (row['工数'] || row['工数(h)'] || '').trim();
    const requiredHours = hoursStr ? parseFloat(hoursStr) : 0;
    if (hoursStr && (isNaN(requiredHours) || requiredHours < 0)) {
      rowErrors.push('工数は0以上の数値で入力してください');
    }

    const deadline = (row['期限'] || '').trim();
    if (!deadline) {
      rowErrors.push('期限が空です');
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
      rowErrors.push('期限はYYYY-MM-DD形式で入力してください');
    }

    const year = (row['年度'] || '').trim();
    const round = (row['回数'] || '').trim();

    if (rowErrors.length > 0) {
      errors.push({ line: lineNum, message: rowErrors.join('；'), row });
    } else {
      valid.push({
        schoolName,
        subject,
        year,
        round,
        workType,
        requiredHours,
        deadline,
        taskName: [schoolName, subject, year, round].filter(Boolean).join('_'),
        _line: lineNum,
      });
    }
  });

  return { valid, errors };
};

export const EXAM_TASK_CSV_COLUMNS = [
  { key: 'schoolName', header: '学校名' },
  { key: 'subject', header: '科目' },
  { key: 'year', header: '年度' },
  { key: 'round', header: '回数' },
  { key: 'workType', header: '作業内容' },
  { key: 'requiredHours', header: '工数' },
  { key: 'deadline', header: '期限' },
];

/**
 * 分野マスタCSVのバリデーション
 * CSVフォーマット: 分野名,科目,カテゴリ
 *
 * @param {Object[]} rows - parseCSVで得られたオブジェクト配列
 * @param {Object} context - { subjects: string[] } (理科・算数のみ)
 * @returns {{ valid: Object[], errors: {line: number, message: string, row: Object}[] }}
 */
export const validateFieldMasterCSV = (rows, context) => {
  const { subjects } = context;
  const validSubjects = subjects || ['小学理科', '小学算数'];
  const validCategories = ['化学', '物理', '生物', '地学'];
  const valid = [];
  const errors = [];

  rows.forEach((row, i) => {
    const lineNum = i + 2;
    const rowErrors = [];

    const name = (row['分野名'] || '').trim();
    if (!name) {
      rowErrors.push('分野名が空です');
    }

    const subject = (row['科目'] || '').trim();
    if (!subject) {
      rowErrors.push('科目が空です');
    } else if (!validSubjects.includes(subject)) {
      rowErrors.push(`科目「${subject}」は無効です（${validSubjects.join('/')}）`);
    }

    const category = (row['カテゴリ'] || '').trim() || null;
    if (category && subject === '小学理科' && !validCategories.includes(category)) {
      rowErrors.push(`カテゴリ「${category}」は無効です（${validCategories.join('/')}）`);
    }

    if (rowErrors.length > 0) {
      errors.push({ line: lineNum, message: rowErrors.join('；'), row });
    } else {
      valid.push({
        name,
        subject,
        category: subject === '小学理科' ? category : null,
        _line: lineNum,
      });
    }
  });

  return { valid, errors };
};

export const FIELD_MASTER_CSV_COLUMNS = [
  { key: 'name', header: '分野名' },
  { key: 'subject', header: '科目' },
  { key: 'category', header: 'カテゴリ' },
];

/**
 * 大問分割タスクCSVのバリデーション
 * CSVフォーマット: 学校名,科目,大問名,分野,工数,期限
 *
 * @param {Object[]} rows - parseCSVで得られたオブジェクト配列
 * @param {Object[]} schools - 学校マスタ一覧
 * @param {Function} getFieldsFn - getFields(subject) で分野一覧を返す関数
 * @returns {{ valid: Object[], errors: {line: number, message: string, row: Object}[] }}
 */
export const validateDaimonTaskCSV = (rows, schools, getFieldsFn) => {
  const valid = [];
  const errors = [];

  rows.forEach((row, i) => {
    const lineNum = i + 2;
    const rowErrors = [];

    const schoolName = (row['学校名'] || '').trim();
    if (!schoolName) {
      rowErrors.push('学校名が空です');
    }

    const subject = (row['科目'] || '').trim();
    if (!subject) {
      rowErrors.push('科目が空です');
    } else if (!SUBJECTS_LIST.includes(subject)) {
      rowErrors.push(`科目「${subject}」は無効です（${SUBJECTS_LIST.join('/')}）`);
    }

    const year = (row['年度'] || '').trim();
    if (!year) {
      rowErrors.push('年度が空です');
    }

    const round = (row['回数'] || '').trim();
    if (!round) {
      rowErrors.push('回数が空です');
    }

    const daimonName = (row['大問名'] || '').trim();
    if (!daimonName) {
      rowErrors.push('大問名が空です');
    }

    const fieldName = (row['分野'] || '').trim();
    let fieldId = null;
    if (fieldName && subject && getFieldsFn) {
      const fields = getFieldsFn(subject);
      const matched = fields.find(f => f.name === fieldName);
      if (matched) {
        fieldId = matched.id;
      } else {
        rowErrors.push(`分野「${fieldName}」が科目「${subject}」に見つかりません`);
      }
    }

    const daimonId = (row['大問ID'] || '').trim();
    const takosLink = (row['takosリンク'] || '').trim();
    if (!daimonId) rowErrors.push('大問IDは必須です');
    if (!takosLink) rowErrors.push('takosリンクは必須です');

    if (rowErrors.length > 0) {
      errors.push({ line: lineNum, message: rowErrors.join('；'), row });
    } else {
      valid.push({
        schoolName,
        subject,
        year,
        round,
        daimonName,
        fieldName,
        fieldId,
        daimonId,
        takosLink,
        _line: lineNum,
      });
    }
  });

  return { valid, errors };
};

export const DAIMON_TASK_CSV_COLUMNS = [
  { key: 'schoolName', header: '学校名' },
  { key: 'subject', header: '科目' },
  { key: 'year', header: '年度' },
  { key: 'round', header: '回数' },
  { key: 'daimonName', header: '大問名' },
  { key: 'fieldName', header: '分野' },
  { key: 'daimonId', header: '大問ID' },
  { key: 'takosLink', header: 'takosリンク' },
];

/**
 * 新年度試験種 一括登録CSVのバリデーション
 * CSVフォーマット: 学校名,科目,年度,工数,期限
 *
 * @param {Object[]} rows - parseCSVで得られたオブジェクト配列
 * @returns {{ valid: Object[], errors: {line: number, message: string, row: Object}[] }}
 */
export const validateNewYearTaskCSV = (rows) => {
  const REQUIRED_HEADERS = ['学校名', '科目', '年度'];
  const valid = [];
  const errors = [];

  if (rows.length === 0) {
    errors.push({ line: 0, message: 'データがありません', row: {} });
    return { valid, errors };
  }

  const headers = Object.keys(rows[0]);
  for (const h of REQUIRED_HEADERS) {
    if (!headers.includes(h)) {
      errors.push({ line: 1, message: `必須列「${h}」がありません`, row: {} });
    }
  }
  if (errors.length > 0) return { valid, errors };

  rows.forEach((row, i) => {
    const lineNum = i + 2;
    const rowErrors = [];

    const schoolName = (row['学校名'] || '').trim();
    if (!schoolName) rowErrors.push('学校名が空です');

    const subject = (row['科目'] || '').trim();
    if (!subject) rowErrors.push('科目が空です');

    const year = (row['年度'] || '').trim();
    if (!year) rowErrors.push('年度が空です');

    const hoursStr = (row['工数'] || row['工数(h)'] || '').trim();
    const requiredHours = hoursStr ? parseFloat(hoursStr) : 0;
    if (hoursStr && (isNaN(requiredHours) || requiredHours < 0)) {
      rowErrors.push('工数は0以上の数値で入力してください');
    }

    const deadline = (row['期限'] || '').trim() || null;
    if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
      rowErrors.push('期限はYYYY-MM-DD形式で入力してください');
    }

    const round = (row['回数'] || '').trim();

    if (rowErrors.length > 0) {
      errors.push({ line: lineNum, message: rowErrors.join('；'), row });
    } else {
      valid.push({
        schoolName,
        subject,
        year,
        round,
        requiredHours,
        deadline,
        matchKey: `${schoolName}_${subject}_${year}`,
        _line: lineNum,
      });
    }
  });

  return { valid, errors };
};

export const NEW_YEAR_TASK_CSV_COLUMNS = [
  { key: 'schoolName', header: '学校名' },
  { key: 'subject', header: '科目' },
  { key: 'year', header: '年度' },
  { key: 'round', header: '回数' },
  { key: 'requiredHours', header: '工数' },
  { key: 'deadline', header: '期限' },
];

/**
 * CSV一括登録（試験種+PDF紐付け用）バリデーション
 * CSVフォーマット: 学校名,科目,年度,回数,作業内容,工数,期限,VIKING
 *
 * @param {Object[]} rows - parseCSVで得られたオブジェクト配列
 * @param {Object} context - { subjects: string[], workTypes: string[] }
 * @returns {{ valid: Object[], errors: {line: number, message: string, row: Object}[] }}
 */
export const validateCsvImportTaskCSV = (rows, context) => {
  const { subjects, workTypes } = context;
  const valid = [];
  const errors = [];

  if (rows.length === 0) {
    errors.push({ line: 0, message: 'データがありません', row: {} });
    return { valid, errors };
  }

  rows.forEach((row, i) => {
    const lineNum = i + 2;
    const rowErrors = [];

    const schoolName = (row['学校名'] || '').trim();
    if (!schoolName) rowErrors.push('学校名が空です');

    const subject = (row['科目'] || '').trim();
    if (!subject) {
      rowErrors.push('科目が空です');
    } else if (subjects && !subjects.includes(subject)) {
      rowErrors.push(`科目「${subject}」は無効です（${subjects.join('/')}）`);
    }

    const year = (row['年度'] || '').trim();
    if (!year) rowErrors.push('年度が空です');

    const round = (row['回数'] || '').trim();

    const workType = (row['作業内容'] || '').trim();
    if (!workType) {
      rowErrors.push('作業内容が空です');
    } else if (workTypes && !workTypes.includes(workType)) {
      rowErrors.push(`作業内容「${workType}」は無効です（${workTypes.join('/')}）`);
    }

    const hoursStr = (row['工数'] || row['工数(h)'] || '').trim();
    const requiredHours = hoursStr ? parseFloat(hoursStr) : 0;
    if (hoursStr && (isNaN(requiredHours) || requiredHours < 0)) {
      rowErrors.push('工数は0以上の数値で入力してください');
    }

    const deadline = (row['期限'] || '').trim();
    if (!deadline) {
      rowErrors.push('期限が空です');
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
      rowErrors.push('期限はYYYY-MM-DD形式で入力してください');
    }

    const vikingRaw = (row['VIKING'] || row['viking'] || '').trim().toLowerCase();
    const viking = vikingRaw === 'true' || vikingRaw === '1' || vikingRaw === 'yes' || vikingRaw === '○';

    if (rowErrors.length > 0) {
      errors.push({ line: lineNum, message: rowErrors.join('；'), row });
    } else {
      const taskName = [schoolName, subject, year, round].filter(Boolean).join('_');
      valid.push({
        schoolName,
        subject,
        year,
        round,
        workType,
        requiredHours,
        deadline,
        viking,
        taskName,
        matchKey: [schoolName, subject, year].filter(Boolean).join('_'),
        _line: lineNum,
      });
    }
  });

  return { valid, errors };
};

export const CSV_IMPORT_TASK_COLUMNS = [
  { key: 'schoolName', header: '学校名' },
  { key: 'subject', header: '科目' },
  { key: 'year', header: '年度' },
  { key: 'round', header: '回数' },
  { key: 'workType', header: '作業内容' },
  { key: 'requiredHours', header: '工数' },
  { key: 'deadline', header: '期限' },
  { key: 'viking', header: 'VIKING' },
];
