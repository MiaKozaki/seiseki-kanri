/**
 * UserManagementTab - User (corrector) management tab (作業者管理)
 * Handles adding/editing/deleting correctors, CSV import/export, subject assignment, and field training management.
 */
import React, { useState } from 'react';
import { useData } from '../../contexts/DataContext.jsx';
import { SUBJECTS_LIST } from '../../utils/storage.js';
import { toCSV, downloadCSV, importCSVFile, parseCSV, validateUserCSV, validateFieldClearanceCSV, USER_CSV_COLUMNS } from '../../utils/csvUtils';

// ---- User Management Tab ----
const UserManagementTab = ({ activeSubjects }) => {
  const { getUsers, getCorrectors, addUser, updateUser, deleteUser, resetUserPassword, getFields, getUserFields, bulkImportUserFields, bulkSetUserFields, addUserField, removeUserField } = useData();
  const correctors = getCorrectors();

  const [activeUserSection, setActiveUserSection] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', managementId: '', employeeId: '', subjects: [] });
  const [editId, setEditId] = useState(null);
  const [editSubjectsId, setEditSubjectsId] = useState(null);
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [error, setError] = useState('');
  const [generatedPw, setGeneratedPw] = useState(null);
  const [generatedPwUser, setGeneratedPwUser] = useState('');
  const [generatedPwManagementId, setGeneratedPwLoginId] = useState('');
  const [fieldCsvPreview, setFieldCsvPreview] = useState(null);
  const [expandedFieldUserId, setExpandedFieldUserId] = useState(null);

  const handleExportCSV = () => {
    const data = correctors.map(c => {
      const row = {
        managementId: c.managementId || '',
        name: c.name,
      };
      (SUBJECTS_LIST || []).forEach(s => {
        row[`subject_${s}`] = (c.subjects || []).includes(s) ? '可' : '';
      });
      return row;
    });
    const csv = toCSV(data, USER_CSV_COLUMNS);
    downloadCSV(csv, `作業者一覧_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  // CSV import
  const [csvPreview, setCsvPreview] = useState(null);
  const [csvErrors, setCsvErrors] = useState([]);

  const handleImportCSV = async () => {
    try {
      const { rows } = await importCSVFile();
      const { valid, errors } = validateUserCSV(rows);
      setCsvErrors(errors);
      setCsvPreview(valid);
    } catch (e) {
      setCsvErrors([e.message]);
    }
  };

  const handleConfirmImport = () => {
    let count = 0;
    const passwords = [];
    csvPreview.forEach(u => {
      const result = addUser({
        name: u.name,
        employeeId: u.employeeId || null,
        managementId: u.managementId || undefined,
        email: u.email,
        role: u.role,
        subjects: u.subjects,
      });
      if (result) {
        count++;
        passwords.push({ name: u.name, managementId: result.managementId, pw: result._tempPassword });
      }
    });
    setCsvPreview(null);
    setCsvErrors([]);
    if (count > 0) {
      setGeneratedPw(passwords.map(p => `${p.name}(${p.managementId}): ${p.pw}`).join('\n'));
      setGeneratedPwUser(`${count}名のインポート`);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (editId) {
      updateUser(editId, { name: form.name, email: form.email, employeeId: form.employeeId || null });
      setEditId(null);
    } else {
      const existing = getCorrectors().find(u => u.email === form.email);
      if (existing) { setError('このメールアドレスは既に使用されています'); return; }
      if (form.managementId) {
        const allUsers = getCorrectors().concat(getUsers().filter(u => u.role === 'leader'));
        const dupManagementId = allUsers.find(u => u.managementId === form.managementId);
        if (dupManagementId) { setError('この管理IDは既に使用されています'); return; }
      }
      if (form.employeeId && !/^N\d{8}$/.test(form.employeeId)) {
        setError('管理IDは N+8桁の数字 (例: N00000001) の形式にしてください'); return;
      }
      const result = addUser({ ...form, employeeId: form.employeeId || null, managementId: form.managementId || undefined, role: 'corrector', subjects: form.subjects || [] });
      setGeneratedPw(result._tempPassword);
      setGeneratedPwUser(form.name);
      setGeneratedPwLoginId(result.managementId);
    }
    setForm({ name: '', email: '', managementId: '', employeeId: '', subjects: [] });
  };

  const handleResetPassword = (userId, userName) => {
    if (!confirm(`「${userName}」のパスワードをリセットしますか?`)) return;
    const tempPw = resetUserPassword(userId);
    if (tempPw) {
      setGeneratedPw(tempPw);
      setGeneratedPwUser(userName);
    }
  };

  const handleSaveSubjects = (userId) => {
    updateUser(userId, { subjects: selectedSubjects });
    setEditSubjectsId(null);
  };

  const toggleSubject = (s) => {
    setSelectedSubjects(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  };

  // Subject badge colors
  const subjectColor = { '小学国語': 'bg-rose-50 text-rose-700', '小学算数': 'bg-blue-50 text-blue-700', '小学理科': 'bg-green-50 text-green-700', '小学社会': 'bg-amber-50 text-amber-700' };

  const userSections = [
    { key: 'list', icon: '\u{1F465}', title: '\u4F5C\u696D\u8005\u4E00\u89A7', desc: '\u767B\u9332\u6E08\u307F\u4F5C\u696D\u8005\u306E\u78BA\u8A8D\u30FB\u7DE8\u96C6' },
    { key: 'add', icon: '\u2795', title: '\u4F5C\u696D\u8005\u8FFD\u52A0', desc: '\u65B0\u3057\u3044\u4F5C\u696D\u8005\u3092\u500B\u5225\u306B\u8FFD\u52A0' },
    { key: 'csv', icon: '\u{1F4C4}', title: 'CSV\u4E00\u62EC\u767B\u9332', desc: 'CSV\u30D5\u30A1\u30A4\u30EB\u3067\u4E00\u62EC\u767B\u9332' },
    { key: 'field', icon: '\u{1F52C}', title: '\u5206\u91CE\u7814\u4FEE\u30AF\u30EA\u30A2\u7BA1\u7406', desc: '\u5206\u91CE\u7814\u4FEE\u30AF\u30EA\u30A2\u72B6\u6CC1\u306E\u7BA1\u7406' },
  ];

  return (
    <div className="space-y-4">
      {/* Button menu */}
      {!activeUserSection && (
        <div className="grid grid-cols-2 gap-3 p-4">
          {userSections.map(s => (
            <button key={s.key} onClick={() => setActiveUserSection(s.key)}
              className="p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition text-left">
              <span className="text-2xl">{s.icon}</span>
              <p className="font-medium text-gray-800 mt-1">{s.title}</p>
              <p className="text-xs text-gray-500">{s.desc}</p>
            </button>
          ))}
        </div>
      )}

      {activeUserSection && (
        <div>
          <button onClick={() => setActiveUserSection(null)} className="mb-3 text-sm text-gray-500 hover:text-gray-700">
            ← 戻る
          </button>

      {/* ===== Section: 作業者追加 ===== */}
      {activeUserSection === 'add' && (
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">{editId ? '\u6DFB\u524A\u8005\u3092\u7DE8\u96C6' : '\u6DFB\u524A\u8005\u3092\u8FFD\u52A0'}</h3>
        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <input
              type="text" placeholder="氏名" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="flex-1 min-w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
            <input
              type="email" placeholder="メールアドレス" value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              className="flex-1 min-w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
            <input
              type="text" placeholder="管理ID (N+8桁)" value={form.employeeId}
              onChange={e => setForm({ ...form, employeeId: e.target.value })}
              className="flex-1 min-w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono"
              maxLength={9}
            />
            <input
              type="text" placeholder="管理ID（空欄で自動生成）" value={form.managementId}
              onChange={e => setForm({ ...form, managementId: e.target.value })}
              className="flex-1 min-w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          {!editId && (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs text-gray-500">担当科目:</span>
              {SUBJECTS_LIST.map(s => (
                <label key={s} className="flex items-center gap-1 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(form.subjects || []).includes(s)}
                    onChange={e => {
                      const subjects = form.subjects || [];
                      setForm({ ...form, subjects: e.target.checked ? [...subjects, s] : subjects.filter(x => x !== s) });
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className={`text-xs px-1.5 py-0.5 rounded ${subjectColor[s] || 'bg-gray-50 text-gray-700'}`}>{s}</span>
                </label>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg transition">
              {editId ? '更新' : '追加'}
            </button>
            {editId && (
              <button type="button" onClick={() => { setEditId(null); setForm({ name: '', email: '', managementId: '', employeeId: '', subjects: [] }); }}
                className="text-sm text-gray-500 border border-gray-200 px-3 py-2 rounded-lg transition">
                キャンセル
              </button>
            )}
          </div>
        </form>
        {!editId && <p className="text-xs text-gray-400 mt-2">* パスワードは自動生成されます。追加後に表示されるパスワードを作業者に共有してください。</p>}
        {error && <p className="text-red-500 text-xs mt-2">{error}</p>}

        {/* 生成されたパスワード表示 */}
        {generatedPw && (
          <div className="mt-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  {generatedPwUser}{generatedPwManagementId ? ` (${generatedPwManagementId})` : ''} の初期パスワード
                </p>
                <p className="text-lg font-mono font-bold text-amber-900 mt-1 select-all">{generatedPw}</p>
                <p className="text-xs text-amber-600 mt-1">
                  このパスワードを作業者に共有してください。初回ログイン時にパスワード変更が求められます。
                </p>
              </div>
              <button
                onClick={() => { navigator.clipboard?.writeText(generatedPw); }}
                className="text-xs bg-amber-200 hover:bg-amber-300 text-amber-800 px-3 py-1.5 rounded-lg transition shrink-0 ml-3"
              >
                コピー
              </button>
            </div>
            <button onClick={() => setGeneratedPw(null)} className="text-xs text-amber-500 hover:text-amber-700 mt-2">
              閉じる
            </button>
          </div>
        )}
      </div>
      )}

      {/* ===== Section: CSV一括登録 ===== */}
      {activeUserSection === 'csv' && (
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">CSV一括登録</h3>
        <div className="flex gap-2 mt-3">
          <button onClick={handleExportCSV}
            className="text-xs bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg transition">
            📤 CSV エクスポート
          </button>
          <button onClick={handleImportCSV}
            className="text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-3 py-1.5 rounded-lg transition">
            📥 CSV インポート
          </button>
          <button onClick={() => {
            const row1 = { managementId: '200001', name: '山田 太郎' };
            const row2 = { managementId: '200002', name: '鈴木 花子' };
            SUBJECTS_LIST.forEach(s => { row1[`subject_${s}`] = s === '小学国語' || s === '小学算数' ? '可' : ''; row2[`subject_${s}`] = s === '小学理科' ? '可' : ''; });
            const csv = toCSV([row1, row2], USER_CSV_COLUMNS);
            downloadCSV(csv, '作業者一括登録テンプレート.csv');
          }}
            className="text-xs bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg transition">
            📄 テンプレートCSVダウンロード
          </button>
        </div>

        {/* 生成されたパスワード表示（CSV登録時） */}
        {generatedPw && (
          <div className="mt-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  {generatedPwUser}{generatedPwManagementId ? ` (${generatedPwManagementId})` : ''} の初期パスワード
                </p>
                <p className="text-lg font-mono font-bold text-amber-900 mt-1 select-all">{generatedPw}</p>
                <p className="text-xs text-amber-600 mt-1">
                  このパスワードを作業者に共有してください。初回ログイン時にパスワード変更が求められます。
                </p>
              </div>
              <button
                onClick={() => { navigator.clipboard?.writeText(generatedPw); }}
                className="text-xs bg-amber-200 hover:bg-amber-300 text-amber-800 px-3 py-1.5 rounded-lg transition shrink-0 ml-3"
              >
                コピー
              </button>
            </div>
            <button onClick={() => setGeneratedPw(null)} className="text-xs text-amber-500 hover:text-amber-700 mt-2">
              閉じる
            </button>
          </div>
        )}
        {csvPreview && (
          <div className="mt-3 p-4 bg-purple-50 border border-purple-200 rounded-xl">
            <h4 className="text-sm font-bold text-purple-800 mb-2">📥 CSVインポート プレビュー（{csvPreview.length}件）</h4>
            {csvErrors.length > 0 && (
              <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                {csvErrors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
              </div>
            )}
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {csvPreview.map((u, i) => (
                <div key={i} className="text-xs flex items-center gap-2 bg-white rounded p-2">
                  <span className="font-mono text-purple-600">{u.managementId || '自動'}</span>
                  {u.employeeId && <span className="font-mono text-green-600">{u.employeeId}</span>}
                  <span className="font-medium">{u.name}</span>
                  <span className="text-gray-400">{u.email}</span>
                  <span className="text-gray-400">{(u.subjects || []).join('・')}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-3 justify-end">
              <button onClick={() => { setCsvPreview(null); setCsvErrors([]); }}
                className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg">キャンセル</button>
              <button onClick={handleConfirmImport} disabled={csvPreview.length === 0}
                className="text-xs bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white px-3 py-1.5 rounded-lg transition">
                {csvPreview.length}名を登録する
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* ===== Section: 分野研修クリア管理 ===== */}
      {activeUserSection === 'field' && (
      <div className="bg-white rounded-xl shadow-sm border p-5">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">🔬 分野研修クリア管理</h4>
        <button
          onClick={async () => {
            try {
              const { rows } = await importCSVFile();
              const allFields = getFields();
              const allUsers = getUsers();
              const result = validateFieldClearanceCSV(rows, allFields, allUsers);
              setFieldCsvPreview(result);
            } catch (e) {
              setFieldCsvPreview({ valid: [], errors: [e.message], summary: { userCount: 0, fieldCount: 0 } });
            }
          }}
          className="text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-3 py-1.5 rounded-lg transition"
        >
          📥 分野クリアCSVインポート
        </button>
        <p className="text-xs text-gray-400 mt-2">CSVフォーマット: 1列目に管理IDまたは氏名、2列目以降に分野名をヘッダに記載し、クリア済みセルに「○」「1」等を入力</p>

        {fieldCsvPreview && (
          <div className="mt-3 p-4 bg-purple-50 border border-purple-200 rounded-xl">
            <h4 className="text-sm font-bold text-purple-800 mb-2">📥 分野クリアCSV プレビュー</h4>
            <p className="text-xs text-purple-700 mb-2">ユーザー{fieldCsvPreview.summary.userCount}名、分野{fieldCsvPreview.summary.fieldCount}件</p>
            {fieldCsvPreview.errors.length > 0 && (
              <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                {fieldCsvPreview.errors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
              </div>
            )}
            {fieldCsvPreview.valid.length > 0 && (
              <div className="space-y-1 max-h-40 overflow-y-auto mb-3">
                {fieldCsvPreview.valid.map((entry, i) => (
                  <div key={i} className="text-xs flex items-center gap-2 bg-white rounded p-2">
                    <span className="font-medium text-gray-700">{entry.userName}</span>
                    <span className="text-purple-600">{entry.fieldName}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setFieldCsvPreview(null)}
                className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg">キャンセル</button>
              <button
                onClick={() => {
                  bulkImportUserFields(fieldCsvPreview.valid.map(e => ({ userId: e.userId, fieldId: e.fieldId })));
                  setFieldCsvPreview(null);
                }}
                disabled={fieldCsvPreview.valid.length === 0}
                className="text-xs bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white px-3 py-1.5 rounded-lg transition"
              >
                {fieldCsvPreview.valid.length}件を登録する
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* ===== Section: 作業者一覧 ===== */}
      {activeUserSection === 'list' && (
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">添削者一覧（{correctors.length}人）</h3>
        {correctors.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-6">添削者がいません</p>
        ) : (
          <div className="space-y-3">
            {correctors.map(c => {
              const mySubjects = c.subjects ?? [];
              return (
                <div key={c.id} className="p-3 border border-gray-200 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{c.name} <span className="text-xs font-mono text-blue-500">{c.managementId}</span>{c.employeeId && <span className="text-xs font-mono text-green-600 ml-1">{c.employeeId}</span>}</p>
                      <p className="text-xs text-gray-400">{c.email}</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditId(c.id); setForm({ name: c.name, email: c.email, managementId: c.managementId || '', employeeId: c.employeeId || '' }); }}
                        className="text-xs text-blue-500 hover:bg-blue-50 px-2 py-1 rounded transition">編集</button>
                      <button onClick={() => handleResetPassword(c.id, c.name)}
                        className="text-xs text-amber-500 hover:bg-amber-50 px-2 py-1 rounded transition">PW リセット</button>
                      <button onClick={() => { if (confirm(`「${c.name}」を削除しますか？`)) deleteUser(c.id); }}
                        className="text-xs text-red-400 hover:bg-red-50 px-2 py-1 rounded transition">削除</button>
                      <button onClick={() => setExpandedFieldUserId(expandedFieldUserId === c.id ? null : c.id)}
                        className={`text-xs px-2 py-1 rounded transition ${expandedFieldUserId === c.id ? 'bg-purple-100 text-purple-700' : 'text-purple-500 hover:bg-purple-50'}`}>分野</button>
                    </div>
                  </div>

                  {/* 分野研修クリア管理（展開式） */}
                  {expandedFieldUserId === c.id && (() => {
                    const userFields = getUserFields(c.id);
                    const subjects = c.subjects ?? [];
                    const allFields = getFields();
                    const relevantSubjects = subjects.length > 0 ? subjects : SUBJECTS_LIST;
                    return (
                      <div className="mt-2 p-3 bg-purple-50 rounded-lg">
                        <p className="text-xs font-medium text-purple-700 mb-2">分野研修クリア状況</p>
                        {relevantSubjects.map(subj => {
                          const subjectFields = allFields.filter(f => f.subject === subj);
                          if (subjectFields.length === 0) return null;
                          return (
                            <div key={subj} className="mb-2">
                              <p className="text-xs font-semibold text-gray-600 mb-1">{subj}の分野</p>
                              <div className="flex flex-wrap gap-1">
                                {subjectFields.map(field => {
                                  const isCleared = userFields.some(uf => uf.fieldId === field.id);
                                  return (
                                    <button key={field.id}
                                      onClick={() => isCleared ? removeUserField(c.id, field.id) : addUserField(c.id, field.id)}
                                      className={`text-xs px-2 py-1 rounded-lg border transition ${isCleared ? 'bg-green-100 text-green-700 border-green-300' : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'}`}
                                    >
                                      {field.name} {isCleared ? '✓' : ''}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                        {allFields.length === 0 && (
                          <p className="text-xs text-gray-400">分野マスタが登録されていません。マスタタブから分野を追加してください。</p>
                        )}
                      </div>
                    );
                  })()}

                  {/* 担当科目表示 */}
                  <div>
                    <div className="flex flex-wrap gap-1 mb-1">
                      {mySubjects.length === 0
                        ? <span className="text-xs text-gray-400">担当科目未設定</span>
                        : mySubjects.map(s => (
                          <span key={s} className={`text-xs px-2 py-0.5 rounded-full font-medium ${subjectColor[s] ?? 'bg-gray-100 text-gray-600'}`}>{s}</span>
                        ))
                      }
                    </div>
                    {editSubjectsId === c.id ? (
                      <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs font-medium text-gray-600 mb-2">担当科目を選択</p>
                        <div className="flex flex-wrap gap-2">
                          {SUBJECTS_LIST.map(s => (
                            <button
                              key={s}
                              onClick={() => toggleSubject(s)}
                              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition ${selectedSubjects.includes(s) ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-100'}`}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => handleSaveSubjects(c.id)} className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg transition">保存</button>
                          <button onClick={() => setEditSubjectsId(null)} className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg transition">キャンセル</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditSubjectsId(c.id); setSelectedSubjects([...mySubjects]); }}
                        className="text-xs text-blue-500 hover:text-blue-700 mt-1"
                      >
                        担当科目を編集
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}

        </div>
      )}
    </div>
  );
};

export default UserManagementTab;
