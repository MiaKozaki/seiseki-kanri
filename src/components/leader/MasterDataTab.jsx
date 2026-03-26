/**
 * MasterDataTab - Master data management tab (マスタ)
 * Manages rejection categories/severities, verification items, fields, work types, and manuals.
 */
import React, { useState } from 'react';
import { useData } from '../../contexts/DataContext.jsx';
import { SUBJECTS_LIST } from '../../utils/storage.js';
import { toCSV, downloadCSV, importCSVFile, parseCSV, validateFieldMasterCSV, FIELD_MASTER_CSV_COLUMNS } from '../../utils/csvUtils';
import { saveAttachment, downloadAttachment } from '../../utils/fileStorage.js';

// ---- Master Data Tab ----
const MasterDataTab = ({ activeSubjects }) => {
  const { getRejectionCategories, addRejectionCategory, updateRejectionCategory, deleteRejectionCategory, getRejectionSeverities, addRejectionSeverity, updateRejectionSeverity, deleteRejectionSeverity, getVerificationItems, addVerificationItem, updateVerificationItem, deleteVerificationItem, getFields, addField, updateField, deleteField, getWorkTypes, addWorkType, deleteWorkType, getManuals, addManual, updateManual, deleteManual, getExternalWorkSettings, addExternalWorkSetting, removeExternalWorkSetting, getAiModels, addAiModel, updateAiModel, deleteAiModel, getAiUsageSettings, setAiUsageSetting } = useData();
  const workTypesList = getWorkTypes().map(wt => wt.name);
  const [catForm, setCatForm] = useState({ name: '', description: '', subject: null, workType: null });
  const [sevForm, setSevForm] = useState({ name: '', level: 1, description: '', color: '#f59e0b' });
  const [editCatId, setEditCatId] = useState(null);
  const [editSevId, setEditSevId] = useState(null);
  const [viForm, setViForm] = useState({ name: '', description: '', subject: null, sortOrder: 1, isRequired: false, purpose: 'verification', workType: null });
  const [editViId, setEditViId] = useState(null);
  const [fieldForm, setFieldForm] = useState({ name: '', subject: '小学理科', category: null, sortOrder: 1 });
  const [editFieldId, setEditFieldId] = useState(null);
  const [bulkFieldInput, setBulkFieldInput] = useState('');
  const [showBulkFieldForm, setShowBulkFieldForm] = useState(false);
  const [bulkFieldSubject, setBulkFieldSubject] = useState('小学理科');
  const [bulkFieldCategory, setBulkFieldCategory] = useState(null);
  const [bulkFieldResult, setBulkFieldResult] = useState(null);
  const [activeMasterSection, setActiveMasterSection] = useState(null);
  const [wtForm, setWtForm] = useState({ name: '', sortOrder: 1 });
  const [manualForm, setManualForm] = useState({ title: '', type: 'url', url: '', content: '', subject: null, workType: null, sortOrder: 1 });
  const [editManualId, setEditManualId] = useState(null);
  const [manualFile, setManualFile] = useState(null);

  // AI管理
  const [aiModelForm, setAiModelForm] = useState({ name: '' });
  const [aiVersionForm, setAiVersionForm] = useState('');
  const [editAiModelId, setEditAiModelId] = useState(null);
  const [addingVersionModelId, setAddingVersionModelId] = useState(null);

  // CSV一括登録（分野）
  const [showFieldCsvImport, setShowFieldCsvImport] = useState(false);
  const [fieldCsvText, setFieldCsvText] = useState('');
  const [fieldCsvParsed, setFieldCsvParsed] = useState(null);
  const [fieldCsvImportDone, setFieldCsvImportDone] = useState(null);

  const handleFieldCsvParse = (text) => {
    setFieldCsvText(text);
    setFieldCsvImportDone(null);
    if (!text.trim()) { setFieldCsvParsed(null); return; }
    let csvText = text;
    if (!text.includes(',') && text.includes('\t')) {
      csvText = text.split('\n').map(line => line.split('\t').map(cell => {
        const trimmed = cell.trim();
        if (trimmed.includes(',') || trimmed.includes('"') || trimmed.includes('\n')) return '"' + trimmed.replace(/"/g, '""') + '"';
        return trimmed;
      }).join(',')).join('\n');
    }
    const { rows } = parseCSV(csvText);
    if (rows.length === 0) { setFieldCsvParsed({ valid: [], errors: [{ line: 0, message: 'データ行がありません', row: {} }] }); return; }
    const result = validateFieldMasterCSV(rows, { subjects: ['小学理科', '小学算数'] });
    setFieldCsvParsed(result);
  };

  const handleFieldCsvFile = async () => {
    try {
      const { headers, rows } = await importCSVFile();
      const csvText = [headers.join(','), ...rows.map(r => headers.map(h => r[h] ?? '').join(','))].join('\n');
      setFieldCsvText(csvText);
      handleFieldCsvParse(csvText);
    } catch (err) {
      // user cancelled or error
    }
  };

  const handleFieldCsvImportConfirm = () => {
    if (!fieldCsvParsed || fieldCsvParsed.valid.length === 0) return;
    let count = 0;
    fieldCsvParsed.valid.forEach((row, idx) => {
      const existingFields = getFields(row.subject) || [];
      const maxOrder = existingFields.length > 0 ? Math.max(...existingFields.map(f => f.sortOrder || 0)) : 0;
      addField({ name: row.name, subject: row.subject, category: row.category, sortOrder: maxOrder + idx + 1 });
      count++;
    });
    setFieldCsvImportDone(`${count}件の分野を登録しました`);
    setFieldCsvParsed(null);
    setFieldCsvText('');
  };

  const handleDownloadFieldTemplate = () => {
    const templateData = [
      { name: '中和', subject: '小学理科', category: '化学' },
      { name: '割合の線分図', subject: '小学算数', category: '' },
    ];
    const csv = toCSV(templateData, FIELD_MASTER_CSV_COLUMNS);
    downloadCSV(csv, '分野一括登録テンプレート.csv');
  };

  const masterSections = [
    { key: 'rejection', icon: '\u{1F504}', title: '\u5DEE\u3057\u623B\u3057\u30AB\u30C6\u30B4\u30EA', desc: '\u5DEE\u3057\u623B\u3057\u9805\u76EE\u306E\u7BA1\u7406' },
    { key: 'severity', icon: '\u26A0\uFE0F', title: '\u5DEE\u3057\u623B\u3057\u91CD\u5927\u5EA6', desc: '\u91CD\u5927\u5EA6\u30EC\u30D9\u30EB\u306E\u7BA1\u7406' },
    { key: 'checklist', icon: '\u2705', title: '\u30C1\u30A7\u30C3\u30AF\u30EA\u30B9\u30C8', desc: '\u63D0\u51FA\u524D\u30FB\u691C\u8A3C\u30C1\u30A7\u30C3\u30AF\u9805\u76EE' },
    { key: 'field', icon: '\u{1F4DA}', title: '\u5206\u91CE\u30DE\u30B9\u30BF', desc: '\u7406\u79D1\u30FB\u7B97\u6570\u306E\u5206\u91CE\u7BA1\u7406' },
    { key: 'worktype', icon: '\u{1F527}', title: '\u4F5C\u696D\u7A2E\u30DE\u30B9\u30BF', desc: '\u4F5C\u696D\u7A2E\uFF08\u4F5C\u696D\u5185\u5BB9\uFF09\u306E\u7BA1\u7406' },
    { key: 'manual', icon: '\u{1F4D6}', title: '\u4F5C\u696D\u8005\u5411\u3051\u30DE\u30CB\u30E5\u30A2\u30EB', desc: 'URL\u30FB\u30D5\u30A1\u30A4\u30EB\u30FB\u30C6\u30AD\u30B9\u30C8\u306E\u30DE\u30CB\u30E5\u30A2\u30EB\u7BA1\u7406' },
    { key: 'externalwork', icon: '\u{1F4BB}', title: '\u5916\u90E8\u4F5C\u696D\u8A2D\u5B9A', desc: '\u624B\u52D5\u30BF\u30A4\u30DE\u30FC\u304C\u5FC5\u8981\u306A\u79D1\u76EE\u00D7\u4F5C\u696D\u7A2E\u306E\u8A2D\u5B9A' },
    { key: 'ai', icon: '\u{1F916}', title: 'AI\u7BA1\u7406', desc: 'AI\u30E2\u30C7\u30EB\u7BA1\u7406\u30FB\u79D1\u76EE\u00D7\u696D\u52D9\u5185\u5BB9\u3054\u3068\u306EAI\u8A18\u9332\u8A2D\u5B9A' },
  ];

  return (
    <div className="space-y-4">
      {/* Button menu */}
      {!activeMasterSection && (
        <div className="grid grid-cols-2 gap-3 p-4">
          {masterSections.map(s => (
            <button key={s.key} onClick={() => setActiveMasterSection(s.key)}
              className="p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition text-left">
              <span className="text-2xl">{s.icon}</span>
              <p className="font-medium text-gray-800 mt-1">{s.title}</p>
              <p className="text-xs text-gray-500">{s.desc}</p>
            </button>
          ))}
        </div>
      )}

      {activeMasterSection && (
        <div>
          <button onClick={() => setActiveMasterSection(null)} className="mb-3 text-sm text-gray-500 hover:text-gray-700">
            ← 戻る
          </button>

      {/* ===== Section: 差し戻しカテゴリ ===== */}
      {activeMasterSection === 'rejection' && (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">🔄 差し戻し項目の管理</h4>
        <p className="text-xs text-gray-500 mb-3">科目・作業内容ごとに差し戻し項目を設定できます。</p>
        <div className="flex flex-wrap gap-2 mb-3">
          <select value={catForm.subject || ''}
            onChange={e => setCatForm({ ...catForm, subject: e.target.value || null })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">全科目共通</option>
            {(activeSubjects || SUBJECTS_LIST).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select value={catForm.workType || ''}
            onChange={e => setCatForm({ ...catForm, workType: e.target.value || null })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">全作業種（共通）</option>
            {workTypesList.map(w => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
          <input type="text" placeholder="項目名" value={catForm.name}
            onChange={e => setCatForm({ ...catForm, name: e.target.value })}
            className="flex-1 min-w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <input type="text" placeholder="説明" value={catForm.description}
            onChange={e => setCatForm({ ...catForm, description: e.target.value })}
            className="flex-1 min-w-40 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <button onClick={() => {
            if (!catForm.name.trim()) return;
            if (editCatId) {
              updateRejectionCategory(editCatId, catForm);
              setEditCatId(null);
            } else {
              addRejectionCategory(catForm);
            }
            setCatForm({ name: '', description: '', subject: null, workType: null });
          }}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg transition">
            {editCatId ? '更新' : '追加'}
          </button>
          {editCatId && (
            <button onClick={() => { setEditCatId(null); setCatForm({ name: '', description: '', subject: null, workType: null }); }}
              className="text-sm text-gray-500 border border-gray-200 px-3 py-2 rounded-lg">キャンセル</button>
          )}
        </div>
        {/* グループ別表示: 科目 → 作業内容 */}
        {(() => {
          const allCats = getRejectionCategories() || [];
          if (allCats.length === 0) return <p className="text-xs text-gray-400">差し戻し項目が登録されていません</p>;

          const subjectGroups = {};
          allCats.forEach(cat => {
            const sKey = cat.subject || '全科目共通';
            if (!subjectGroups[sKey]) subjectGroups[sKey] = [];
            subjectGroups[sKey].push(cat);
          });
          const sortedSubjects = Object.keys(subjectGroups).sort((a, b) => {
            if (a === '全科目共通') return -1;
            if (b === '全科目共通') return 1;
            return a.localeCompare(b);
          });

          return sortedSubjects.map(subjectKey => {
            const cats = subjectGroups[subjectKey];
            const workTypeGroups = {};
            cats.forEach(cat => {
              const wKey = cat.workType || '全作業種';
              if (!workTypeGroups[wKey]) workTypeGroups[wKey] = [];
              workTypeGroups[wKey].push(cat);
            });
            const sortedWorkTypes = Object.keys(workTypeGroups).sort((a, b) => {
              if (a === '全作業種') return -1;
              if (b === '全作業種') return 1;
              return a.localeCompare(b);
            });

            return (
              <div key={subjectKey} className="mb-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${subjectKey === '全科目共通' ? 'bg-gray-100 text-gray-600' : 'bg-blue-50 text-blue-700'}`}>
                    {subjectKey}
                  </span>
                  <span className="text-xs text-gray-400">{cats.length}件</span>
                </div>
                {sortedWorkTypes.map(wtKey => (
                  <div key={wtKey} className="mb-1 ml-2">
                    {wtKey !== '全作業種' && (
                      <span className="text-[10px] text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded mb-0.5 inline-block">{wtKey}</span>
                    )}
                    <div className="space-y-1">
                      {workTypeGroups[wtKey].map(cat => (
                        <div key={cat.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-sm font-medium truncate">{cat.name}</span>
                            {cat.description && <span className="text-xs text-gray-400 truncate hidden sm:inline">{cat.description}</span>}
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <button onClick={() => { setEditCatId(cat.id); setCatForm({ name: cat.name, description: cat.description || '', subject: cat.subject, workType: cat.workType || null }); }}
                              className="text-xs text-blue-500 hover:bg-blue-50 px-2 py-1 rounded">編集</button>
                            <button onClick={() => deleteRejectionCategory(cat.id)}
                              className="text-xs text-red-400 hover:bg-red-50 px-2 py-1 rounded">削除</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          });
        })()}
      </div>
      )}

      {/* ===== Section: 差し戻し重大度 ===== */}
      {activeMasterSection === 'severity' && (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">⚠️ 差し戻し重大度の管理</h4>
        <div className="flex flex-wrap gap-2 mb-3">
          <input type="text" placeholder="レベル名" value={sevForm.name}
            onChange={e => setSevForm({ ...sevForm, name: e.target.value })}
            className="flex-1 min-w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <input type="number" placeholder="レベル値" value={sevForm.level} min="1" max="10"
            onChange={e => setSevForm({ ...sevForm, level: Number(e.target.value) })}
            className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <input type="text" placeholder="説明" value={sevForm.description}
            onChange={e => setSevForm({ ...sevForm, description: e.target.value })}
            className="flex-1 min-w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <input type="color" value={sevForm.color}
            onChange={e => setSevForm({ ...sevForm, color: e.target.value })}
            className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer" />
          <button onClick={() => {
            if (!sevForm.name.trim()) return;
            if (editSevId) {
              updateRejectionSeverity(editSevId, sevForm);
              setEditSevId(null);
            } else {
              addRejectionSeverity(sevForm);
            }
            setSevForm({ name: '', level: 1, description: '', color: '#f59e0b' });
          }}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg transition">
            {editSevId ? '更新' : '追加'}
          </button>
          {editSevId && (
            <button onClick={() => { setEditSevId(null); setSevForm({ name: '', level: 1, description: '', color: '#f59e0b' }); }}
              className="text-sm text-gray-500 border border-gray-200 px-3 py-2 rounded-lg">キャンセル</button>
          )}
        </div>
        <div className="space-y-1">
          {(getRejectionSeverities() || []).sort((a, b) => a.level - b.level).map(sev => (
            <div key={sev.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-2">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full inline-block" style={{ backgroundColor: sev.color }}></span>
                <span className="text-sm font-medium">{sev.name}</span>
                <span className="text-xs text-gray-500">レベル {sev.level}</span>
                <span className="text-xs text-gray-400">{sev.description}</span>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setEditSevId(sev.id); setSevForm({ name: sev.name, level: sev.level, description: sev.description, color: sev.color }); }}
                  className="text-xs text-blue-500 hover:bg-blue-50 px-2 py-1 rounded">編集</button>
                <button onClick={() => deleteRejectionSeverity(sev.id)}
                  className="text-xs text-red-400 hover:bg-red-50 px-2 py-1 rounded">削除</button>
              </div>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* ===== Section: 分野マスタ ===== */}
      {activeMasterSection === 'field' && (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">📚 分野マスタの管理</h4>
        <p className="text-xs text-gray-500 mb-3">理科・算数の分野を管理します。VIKINGタスクの分野制限に使用します。</p>
        <div className="flex flex-wrap gap-2 mb-3">
          <select value={fieldForm.subject}
            onChange={e => setFieldForm({ ...fieldForm, subject: e.target.value, category: e.target.value === '小学理科' ? fieldForm.category : null })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="小学理科">小学理科</option>
            <option value="小学算数">小学算数</option>
          </select>
          {fieldForm.subject === '小学理科' && (
            <select value={fieldForm.category || ''}
              onChange={e => setFieldForm({ ...fieldForm, category: e.target.value || null })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="">カテゴリを選択</option>
              <option value="化学">化学</option>
              <option value="物理">物理</option>
              <option value="生物">生物</option>
              <option value="地学">地学</option>
            </select>
          )}
          <input type="text" placeholder="分野名" value={fieldForm.name}
            onChange={e => setFieldForm({ ...fieldForm, name: e.target.value })}
            className="flex-1 min-w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <input type="number" placeholder="表示順" value={fieldForm.sortOrder} min="1" max="99"
            onChange={e => setFieldForm({ ...fieldForm, sortOrder: Number(e.target.value) })}
            className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm" title="表示順" />
          <button onClick={() => {
            if (!fieldForm.name.trim()) return;
            if (editFieldId) {
              updateField(editFieldId, fieldForm);
              setEditFieldId(null);
            } else {
              addField(fieldForm);
            }
            setFieldForm({ name: '', subject: fieldForm.subject, category: fieldForm.subject === '小学理科' ? fieldForm.category : null, sortOrder: 1 });
          }}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg transition">
            {editFieldId ? '更新' : '追加'}
          </button>
          {editFieldId && (
            <button onClick={() => { setEditFieldId(null); setFieldForm({ name: '', subject: '小学理科', category: null, sortOrder: 1 }); }}
              className="text-sm text-gray-500 border border-gray-200 px-3 py-2 rounded-lg">キャンセル</button>
          )}
          <button onClick={() => { setShowBulkFieldForm(!showBulkFieldForm); setBulkFieldResult(null); }}
            className={`text-sm px-3 py-2 rounded-lg transition border ${showBulkFieldForm ? 'bg-orange-50 text-orange-700 border-orange-200' : 'text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
            一括登録
          </button>
          <button onClick={() => { setShowFieldCsvImport(!showFieldCsvImport); setFieldCsvImportDone(null); }}
            className={`text-sm px-3 py-2 rounded-lg transition border ${showFieldCsvImport ? 'bg-green-600 text-white border-green-600' : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'}`}>
            {showFieldCsvImport ? '▲ CSV一括登録を閉じる' : 'CSV一括登録'}
          </button>
        </div>

        {showBulkFieldForm && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-3">
            <h5 className="text-sm font-semibold text-orange-700 mb-2">一括登録</h5>
            <div className="flex flex-wrap gap-2 mb-2">
              <select value={bulkFieldSubject}
                onChange={e => { setBulkFieldSubject(e.target.value); if (e.target.value !== '小学理科') setBulkFieldCategory(null); }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="小学理科">小学理科</option>
                <option value="小学算数">小学算数</option>
              </select>
              {bulkFieldSubject === '小学理科' && (
                <select value={bulkFieldCategory || ''}
                  onChange={e => setBulkFieldCategory(e.target.value || null)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="">カテゴリを選択</option>
                  <option value="化学">化学</option>
                  <option value="物理">物理</option>
                  <option value="生物">生物</option>
                  <option value="地学">地学</option>
                </select>
              )}
            </div>
            <textarea
              value={bulkFieldInput}
              onChange={e => setBulkFieldInput(e.target.value)}
              placeholder="分野名を1行に1つずつ入力してください&#10;例：&#10;力のつりあい&#10;電流と磁界&#10;化学変化"
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono mb-2 focus:ring-2 focus:ring-orange-400 outline-none"
            />
            <div className="flex items-center gap-3">
              <button onClick={() => {
                const lines = bulkFieldInput.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                if (lines.length === 0) return;
                const existingFields = getFields(bulkFieldSubject) || [];
                const maxOrder = existingFields.length > 0 ? Math.max(...existingFields.map(f => f.sortOrder || 0)) : 0;
                let count = 0;
                lines.forEach((name, idx) => {
                  addField({ name, subject: bulkFieldSubject, category: bulkFieldSubject === '小学理科' ? bulkFieldCategory : null, sortOrder: maxOrder + idx + 1 });
                  count++;
                });
                setBulkFieldResult(count);
                setBulkFieldInput('');
              }}
                className="bg-orange-600 hover:bg-orange-700 text-white text-sm px-4 py-2 rounded-lg transition">
                一括追加
              </button>
              {bulkFieldResult !== null && (
                <span className="text-sm text-green-600 font-medium">{bulkFieldResult}件 追加しました</span>
              )}
            </div>
          </div>
        )}

        {showFieldCsvImport && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-3">
            <h5 className="text-sm font-semibold text-green-700 mb-2">CSV一括登録</h5>
            <p className="text-xs text-gray-500 mb-2">
              CSV形式で分野を一括登録できます。ヘッダ行: 分野名,科目,カテゴリ
            </p>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={handleFieldCsvFile}
                className="text-sm px-3 py-1.5 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition font-medium"
              >
                CSVファイルを選択
              </button>
              <button
                type="button"
                onClick={handleDownloadFieldTemplate}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition font-medium"
              >
                テンプレートDL
              </button>
              <span className="text-xs text-gray-400 self-center">または下のテキストエリアに貼り付け</span>
            </div>
            <textarea
              value={fieldCsvText}
              onChange={e => handleFieldCsvParse(e.target.value)}
              rows={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-green-400 outline-none mb-2"
              placeholder={`分野名,科目,カテゴリ\n中和,理科,化学\n割合の線分図,算数,`}
            />

            {fieldCsvParsed && (
              <div className="space-y-2">
                <div className="flex gap-3 text-xs font-medium">
                  <span className="text-green-700">有効: {fieldCsvParsed.valid.length}件</span>
                  <span className="text-red-600">エラー: {fieldCsvParsed.errors.length}件</span>
                </div>

                {fieldCsvParsed.errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-32 overflow-y-auto">
                    {fieldCsvParsed.errors.map((err, i) => (
                      <p key={i} className="text-xs text-red-600">{err.line}行目: {err.message}</p>
                    ))}
                  </div>
                )}

                {fieldCsvParsed.valid.length > 0 && (
                  <div className="overflow-x-auto max-h-48 overflow-y-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="px-2 py-1 text-left border border-gray-200">行</th>
                          <th className="px-2 py-1 text-left border border-gray-200">分野名</th>
                          <th className="px-2 py-1 text-left border border-gray-200">科目</th>
                          <th className="px-2 py-1 text-left border border-gray-200">カテゴリ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fieldCsvParsed.valid.map((row, i) => (
                          <tr key={i} className="bg-green-50/50 hover:bg-green-100/50">
                            <td className="px-2 py-1 border border-gray-200 text-gray-400">{row._line}</td>
                            <td className="px-2 py-1 border border-gray-200">{row.name}</td>
                            <td className="px-2 py-1 border border-gray-200">{row.subject}</td>
                            <td className="px-2 py-1 border border-gray-200 text-gray-500">{row.category || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {fieldCsvParsed.valid.length > 0 && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleFieldCsvImportConfirm}
                      className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
                    >
                      一括登録（{fieldCsvParsed.valid.length}件）
                    </button>
                    <button
                      type="button"
                      onClick={() => { setFieldCsvParsed(null); setFieldCsvText(''); }}
                      className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 px-4 py-2 rounded-lg transition"
                    >
                      クリア
                    </button>
                  </div>
                )}
              </div>
            )}

            {fieldCsvImportDone && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm font-medium mt-2">
                {fieldCsvImportDone}
              </div>
            )}
          </div>
        )}

        {/* グループ別表示: 科目 → カテゴリ */}
        {(() => {
          const allFields = getFields() || [];

          if (allFields.length === 0) {
            return <p className="text-xs text-gray-400">分野が登録されていません</p>;
          }

          return ['小学理科', '小学算数'].map(subject => {
            const subjectFields = allFields.filter(f => f.subject === subject);
            if (subjectFields.length === 0) return null;

            return (
              <div key={subject} className="mb-4">
                <div className={`inline-block text-xs font-semibold px-3 py-1 rounded-full border mb-2 ${subject === '小学理科' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                  {subject}（{subjectFields.length}件）
                </div>
                {subject === '小学理科' ? (
                  (() => {
                    const categoryGroups = {};
                    subjectFields.forEach(item => {
                      const cKey = item.category || '未分類';
                      if (!categoryGroups[cKey]) categoryGroups[cKey] = [];
                      categoryGroups[cKey].push(item);
                    });
                    const categoryOrder = ['化学', '物理', '生物', '地学', '未分類'];
                    const sortedCategories = Object.keys(categoryGroups).sort((a, b) => {
                      const ai = categoryOrder.indexOf(a);
                      const bi = categoryOrder.indexOf(b);
                      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
                    });

                    return sortedCategories.map(catKey => (
                      <div key={catKey} className="mb-2 ml-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            {catKey}
                          </span>
                        </div>
                        <div className="space-y-1 ml-2">
                          {categoryGroups[catKey].sort((a, b) => a.sortOrder - b.sortOrder).map(item => (
                            <div key={item.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-2">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="text-sm flex-shrink-0 w-6 text-center text-gray-400">{item.sortOrder}</span>
                                <span className="text-sm font-medium truncate">{item.name}</span>
                                <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded-full flex-shrink-0">{item.category}</span>
                              </div>
                              <div className="flex gap-1 flex-shrink-0">
                                <button onClick={() => { setEditFieldId(item.id); setFieldForm({ name: item.name, subject: item.subject, category: item.category || null, sortOrder: item.sortOrder }); }}
                                  className="text-xs text-blue-500 hover:bg-blue-50 px-2 py-1 rounded">編集</button>
                                <button onClick={() => deleteField(item.id)}
                                  className="text-xs text-red-400 hover:bg-red-50 px-2 py-1 rounded">削除</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ));
                  })()
                ) : (
                  <div className="space-y-1 ml-2">
                    {subjectFields.sort((a, b) => a.sortOrder - b.sortOrder).map(item => (
                      <div key={item.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-sm flex-shrink-0 w-6 text-center text-gray-400">{item.sortOrder}</span>
                          <span className="text-sm font-medium truncate">{item.name}</span>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={() => { setEditFieldId(item.id); setFieldForm({ name: item.name, subject: item.subject, category: item.category || null, sortOrder: item.sortOrder }); }}
                            className="text-xs text-blue-500 hover:bg-blue-50 px-2 py-1 rounded">編集</button>
                          <button onClick={() => deleteField(item.id)}
                            className="text-xs text-red-400 hover:bg-red-50 px-2 py-1 rounded">削除</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          });
        })()}
      </div>
      )}

      {/* ===== Section: 作業種マスタ ===== */}
      {activeMasterSection === 'worktype' && (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">🔧 作業種マスタの管理</h4>
        <p className="text-xs text-gray-500 mb-3">タスクの作業種（作業内容）を管理します。差し戻し項目やチェックリストの絞り込みに使用します。</p>
        <div className="flex flex-wrap gap-2 mb-3">
          <input type="text" placeholder="作業種名" value={wtForm.name}
            onChange={e => setWtForm({ ...wtForm, name: e.target.value })}
            className="flex-1 min-w-40 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <input type="number" placeholder="表示順" value={wtForm.sortOrder} min="1" max="99"
            onChange={e => setWtForm({ ...wtForm, sortOrder: Number(e.target.value) })}
            className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm" title="表示順" />
          <button onClick={() => {
            if (!wtForm.name.trim()) return;
            addWorkType({ name: wtForm.name.trim(), sortOrder: wtForm.sortOrder });
            setWtForm({ name: '', sortOrder: (getWorkTypes().length || 0) + 1 });
          }}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg transition">
            追加
          </button>
        </div>
        <div className="space-y-1">
          {getWorkTypes().length === 0 ? (
            <p className="text-xs text-gray-400">作業種が登録されていません</p>
          ) : (
            getWorkTypes().map(wt => (
              <div key={wt.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-sm flex-shrink-0 w-6 text-center text-gray-400">{wt.sortOrder}</span>
                  <span className="text-sm font-medium truncate">{wt.name}</span>
                </div>
                <button onClick={() => deleteWorkType(wt.id)}
                  className="text-xs text-red-400 hover:bg-red-50 px-2 py-1 rounded">削除</button>
              </div>
            ))
          )}
        </div>
      </div>
      )}

      {/* ===== Section: マニュアル管理 ===== */}
      {activeMasterSection === 'manual' && (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">{'\u{1F4D6}'} 作業者向けマニュアルの管理</h4>
        <p className="text-xs text-gray-500 mb-3">URL・ファイル・テキスト形式のマニュアルを登録できます。科目・作業内容ごとに設定可能です。</p>
        <div className="flex flex-wrap gap-2 mb-3">
          <input type="text" placeholder="タイトル" value={manualForm.title}
            onChange={e => setManualForm({ ...manualForm, title: e.target.value })}
            className="flex-1 min-w-40 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <select value={manualForm.type}
            onChange={e => { setManualForm({ ...manualForm, type: e.target.value, url: '', content: '' }); setManualFile(null); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="url">URL</option>
            <option value="file">ファイル</option>
            <option value="text">テキスト</option>
          </select>
          <select value={manualForm.subject || ''}
            onChange={e => setManualForm({ ...manualForm, subject: e.target.value || null })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">全科目共通</option>
            {(activeSubjects || SUBJECTS_LIST).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select value={manualForm.workType || ''}
            onChange={e => setManualForm({ ...manualForm, workType: e.target.value || null })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">全作業種共通</option>
            {workTypesList.map(w => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
          <input type="number" placeholder="表示順" value={manualForm.sortOrder} min="1" max="99"
            onChange={e => setManualForm({ ...manualForm, sortOrder: Number(e.target.value) })}
            className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm" title="表示順" />
        </div>
        {/* 種類別入力 */}
        {manualForm.type === 'url' && (
          <div className="mb-3">
            <input type="url" placeholder="https://..." value={manualForm.url}
              onChange={e => setManualForm({ ...manualForm, url: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
        )}
        {manualForm.type === 'file' && (
          <div className="mb-3">
            <input type="file" accept=".pdf,.doc,.docx"
              onChange={e => setManualFile(e.target.files[0] || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            {manualFile && (
              <p className="text-xs text-gray-500 mt-1">{manualFile.name} ({(manualFile.size / 1024).toFixed(1)} KB)</p>
            )}
          </div>
        )}
        {manualForm.type === 'text' && (
          <div className="mb-3">
            <textarea placeholder="マニュアル内容を入力..." value={manualForm.content}
              onChange={e => setManualForm({ ...manualForm, content: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-y" />
          </div>
        )}
        <div className="flex gap-2 mb-4">
          <button onClick={async () => {
            if (!manualForm.title.trim()) return;
            if (manualForm.type === 'url' && !manualForm.url.trim()) return;
            if (manualForm.type === 'text' && !manualForm.content.trim()) return;
            if (manualForm.type === 'file' && !manualFile && !editManualId) return;

            let fileAttachmentId = null;
            let fileName = null;
            let fileSize = null;

            if (manualForm.type === 'file' && manualFile) {
              const meta = await saveAttachment({
                assignmentId: 'manual',
                fileName: manualFile.name,
                fileSize: manualFile.size,
                fileType: manualFile.type,
                blob: manualFile,
              });
              fileAttachmentId = meta.id;
              fileName = manualFile.name;
              fileSize = manualFile.size;
            }

            const manualData = {
              title: manualForm.title.trim(),
              type: manualForm.type,
              url: manualForm.type === 'url' ? manualForm.url.trim() : null,
              content: manualForm.type === 'text' ? manualForm.content.trim() : null,
              fileAttachmentId: manualForm.type === 'file' ? (fileAttachmentId || (editManualId ? undefined : null)) : null,
              fileName: manualForm.type === 'file' ? (fileName || (editManualId ? undefined : null)) : null,
              fileSize: manualForm.type === 'file' ? (fileSize || (editManualId ? undefined : null)) : null,
              subject: manualForm.subject,
              workType: manualForm.workType,
              sortOrder: manualForm.sortOrder,
            };

            // Remove undefined values (keep existing file data on edit without new file)
            Object.keys(manualData).forEach(k => manualData[k] === undefined && delete manualData[k]);

            if (editManualId) {
              updateManual(editManualId, manualData);
              setEditManualId(null);
            } else {
              addManual(manualData);
            }
            setManualForm({ title: '', type: 'url', url: '', content: '', subject: null, workType: null, sortOrder: 1 });
            setManualFile(null);
          }}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg transition">
            {editManualId ? '更新' : '追加'}
          </button>
          {editManualId && (
            <button onClick={() => { setEditManualId(null); setManualForm({ title: '', type: 'url', url: '', content: '', subject: null, workType: null, sortOrder: 1 }); setManualFile(null); }}
              className="text-sm text-gray-500 border border-gray-200 px-3 py-2 rounded-lg">キャンセル</button>
          )}
        </div>

        {/* グループ別表示: 科目 → 作業内容 */}
        {(() => {
          const allManuals = getManuals() || [];
          if (allManuals.length === 0) return <p className="text-xs text-gray-400">マニュアルが登録されていません</p>;

          const subjectGroups = {};
          allManuals.forEach(m => {
            const sKey = m.subject || '全科目共通';
            if (!subjectGroups[sKey]) subjectGroups[sKey] = [];
            subjectGroups[sKey].push(m);
          });
          const sortedSubjects = Object.keys(subjectGroups).sort((a, b) => {
            if (a === '全科目共通') return -1;
            if (b === '全科目共通') return 1;
            return a.localeCompare(b);
          });

          return sortedSubjects.map(subjectKey => {
            const manuals = subjectGroups[subjectKey];
            const workTypeGroups = {};
            manuals.forEach(m => {
              const wKey = m.workType || '全作業種';
              if (!workTypeGroups[wKey]) workTypeGroups[wKey] = [];
              workTypeGroups[wKey].push(m);
            });
            const sortedWorkTypes = Object.keys(workTypeGroups).sort((a, b) => {
              if (a === '全作業種') return -1;
              if (b === '全作業種') return 1;
              return a.localeCompare(b);
            });

            return (
              <div key={subjectKey} className="mb-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${subjectKey === '全科目共通' ? 'bg-gray-100 text-gray-600' : 'bg-blue-50 text-blue-700'}`}>
                    {subjectKey}
                  </span>
                  <span className="text-xs text-gray-400">{manuals.length}件</span>
                </div>
                {sortedWorkTypes.map(wtKey => (
                  <div key={wtKey} className="mb-1 ml-2">
                    {wtKey !== '全作業種' && (
                      <span className="text-[10px] text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded mb-0.5 inline-block">{wtKey}</span>
                    )}
                    <div className="space-y-1">
                      {workTypeGroups[wtKey].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).map(m => (
                        <div key={m.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-sm flex-shrink-0 w-6 text-center text-gray-400">{m.sortOrder}</span>
                            <span className="text-sm font-medium truncate">{m.title}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                              m.type === 'url' ? 'bg-blue-100 text-blue-600' :
                              m.type === 'file' ? 'bg-green-100 text-green-600' :
                              'bg-yellow-100 text-yellow-600'
                            }`}>
                              {m.type === 'url' ? 'URL' : m.type === 'file' ? 'ファイル' : 'テキスト'}
                            </span>
                            {m.type === 'url' && m.url && (
                              <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline truncate hidden sm:inline" onClick={e => e.stopPropagation()}>
                                {m.url}
                              </a>
                            )}
                            {m.type === 'file' && m.fileName && (
                              <span className="text-xs text-gray-400 truncate hidden sm:inline">{m.fileName} ({(m.fileSize / 1024).toFixed(1)} KB)</span>
                            )}
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <button onClick={() => {
                              setEditManualId(m.id);
                              setManualForm({
                                title: m.title,
                                type: m.type,
                                url: m.url || '',
                                content: m.content || '',
                                subject: m.subject,
                                workType: m.workType,
                                sortOrder: m.sortOrder || 1,
                              });
                              setManualFile(null);
                            }}
                              className="text-xs text-blue-500 hover:bg-blue-50 px-2 py-1 rounded">編集</button>
                            <button onClick={async () => {
                              if (m.fileAttachmentId) {
                                try { await deleteAttachment(m.fileAttachmentId); } catch (e) { /* ignore */ }
                              }
                              deleteManual(m.id);
                            }}
                              className="text-xs text-red-400 hover:bg-red-50 px-2 py-1 rounded">削除</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          });
        })()}
      </div>
      )}

      {/* ===== Section: チェックリスト ===== */}
      {activeMasterSection === 'checklist' && (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">✅ チェックリストの管理</h4>
        <p className="text-xs text-gray-500 mb-3">提出前チェック（作業者用）と検証チェック（リーダー用）の項目を管理します。科目・作業内容ごとに設定できます。</p>
        <div className="flex flex-wrap gap-2 mb-3">
          <select value={viForm.purpose}
            onChange={e => setViForm({ ...viForm, purpose: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="verification">検証チェック（リーダー用）</option>
            <option value="submission">提出前チェック（作業者用）</option>
          </select>
          <select value={viForm.subject || ''}
            onChange={e => setViForm({ ...viForm, subject: e.target.value || null })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">全科目共通</option>
            {(activeSubjects || SUBJECTS_LIST).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select value={viForm.workType || ''}
            onChange={e => setViForm({ ...viForm, workType: e.target.value || null })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">全作業種（共通）</option>
            {workTypesList.map(w => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
          <input type="text" placeholder="項目名" value={viForm.name}
            onChange={e => setViForm({ ...viForm, name: e.target.value })}
            className="flex-1 min-w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <input type="text" placeholder="説明" value={viForm.description}
            onChange={e => setViForm({ ...viForm, description: e.target.value })}
            className="flex-1 min-w-40 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <input type="number" placeholder="表示順" value={viForm.sortOrder} min="1" max="99"
            onChange={e => setViForm({ ...viForm, sortOrder: Number(e.target.value) })}
            className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm" title="表示順" />
          <label className="flex items-center gap-1 text-sm text-gray-600 cursor-pointer select-none">
            <input type="checkbox" checked={viForm.isRequired}
              onChange={e => setViForm({ ...viForm, isRequired: e.target.checked })}
              className="rounded border-gray-300" />
            必須
          </label>
          <button onClick={() => {
            if (!viForm.name.trim()) return;
            if (editViId) {
              updateVerificationItem(editViId, viForm);
              setEditViId(null);
            } else {
              addVerificationItem(viForm);
            }
            setViForm({ name: '', description: '', subject: null, sortOrder: 1, isRequired: false, purpose: 'verification', workType: null });
          }}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg transition">
            {editViId ? '更新' : '追加'}
          </button>
          {editViId && (
            <button onClick={() => { setEditViId(null); setViForm({ name: '', description: '', subject: null, sortOrder: 1, isRequired: false, purpose: 'verification', workType: null }); }}
              className="text-sm text-gray-500 border border-gray-200 px-3 py-2 rounded-lg">キャンセル</button>
          )}
        </div>

        {/* グループ別表示: 用途 → 科目 → 作業内容 */}
        {(() => {
          const allItems = getVerificationItems() || [];

          if (allItems.length === 0) {
            return <p className="text-xs text-gray-400">チェック項目が登録されていません</p>;
          }

          const purposeGroups = { verification: [], submission: [] };
          allItems.forEach(item => {
            const p = item.purpose || 'verification';
            if (!purposeGroups[p]) purposeGroups[p] = [];
            purposeGroups[p].push(item);
          });

          const purposeLabels = { verification: '検証チェック（リーダー用）', submission: '提出前チェック（作業者用）' };
          const purposeColors = { verification: 'bg-green-50 text-green-700 border-green-200', submission: 'bg-purple-50 text-purple-700 border-purple-200' };

          return ['submission', 'verification'].map(purpose => {
            const items = purposeGroups[purpose] || [];
            if (items.length === 0) return null;

            // 科目でグループ化
            const subjectGroups = {};
            items.forEach(item => {
              const sKey = item.subject || '全科目共通';
              if (!subjectGroups[sKey]) subjectGroups[sKey] = [];
              subjectGroups[sKey].push(item);
            });
            const sortedSubjects = Object.keys(subjectGroups).sort((a, b) => {
              if (a === '全科目共通') return -1;
              if (b === '全科目共通') return 1;
              return a.localeCompare(b);
            });

            return (
              <div key={purpose} className="mb-4">
                <div className={`inline-block text-xs font-semibold px-3 py-1 rounded-full border mb-2 ${purposeColors[purpose]}`}>
                  {purposeLabels[purpose]}（{items.length}件）
                </div>
                {sortedSubjects.map(subjectKey => {
                  const subjectItems = subjectGroups[subjectKey];
                  // さらに作業内容でグループ化
                  const workTypeGroups = {};
                  subjectItems.forEach(item => {
                    const wKey = item.workType || '全作業種';
                    if (!workTypeGroups[wKey]) workTypeGroups[wKey] = [];
                    workTypeGroups[wKey].push(item);
                  });
                  const sortedWorkTypes = Object.keys(workTypeGroups).sort((a, b) => {
                    if (a === '全作業種') return -1;
                    if (b === '全作業種') return 1;
                    return a.localeCompare(b);
                  });

                  return (
                    <div key={subjectKey} className="mb-2 ml-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${subjectKey === '全科目共通' ? 'bg-gray-100 text-gray-600' : 'bg-blue-50 text-blue-700'}`}>
                          {subjectKey}
                        </span>
                      </div>
                      {sortedWorkTypes.map(wtKey => (
                        <div key={wtKey} className="mb-1 ml-2">
                          {wtKey !== '全作業種' && (
                            <span className="text-[10px] text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded mb-0.5 inline-block">{wtKey}</span>
                          )}
                          <div className="space-y-1">
                            {workTypeGroups[wtKey].sort((a, b) => a.sortOrder - b.sortOrder).map(item => (
                              <div key={item.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-2">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <span className="text-sm flex-shrink-0 w-6 text-center text-gray-400">{item.sortOrder}</span>
                                  <span className="text-sm font-medium truncate">{item.name}</span>
                                  {item.isRequired && (
                                    <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full flex-shrink-0">必須</span>
                                  )}
                                  {item.workType && (
                                    <span className="text-[10px] bg-yellow-50 text-yellow-600 px-1.5 py-0.5 rounded-full flex-shrink-0 hidden sm:inline">{item.workType}</span>
                                  )}
                                  {item.description && (
                                    <span className="text-xs text-gray-400 truncate hidden sm:inline">{item.description}</span>
                                  )}
                                </div>
                                <div className="flex gap-1 flex-shrink-0">
                                  <button onClick={() => { setEditViId(item.id); setViForm({ name: item.name, description: item.description || '', subject: item.subject, sortOrder: item.sortOrder, isRequired: item.isRequired, purpose: item.purpose || 'verification', workType: item.workType || null }); }}
                                    className="text-xs text-blue-500 hover:bg-blue-50 px-2 py-1 rounded">編集</button>
                                  <button onClick={() => deleteVerificationItem(item.id)}
                                    className="text-xs text-red-400 hover:bg-red-50 px-2 py-1 rounded">削除</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          });
        })()}
      </div>
      )}

      {activeMasterSection === 'ai' && (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-6">
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">AIモデル管理</h4>
          <p className="text-xs text-gray-500 mb-3">AI使用記録で選択できるモデルとバージョンを管理します。</p>

          {/* Add AI Model */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={aiModelForm.name}
              onChange={e => setAiModelForm({ name: e.target.value })}
              placeholder="AIモデル名（例: ChatGPT）"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button
              onClick={() => {
                if (!aiModelForm.name.trim()) return;
                if (editAiModelId) {
                  updateAiModel(editAiModelId, { name: aiModelForm.name.trim() });
                  setEditAiModelId(null);
                } else {
                  addAiModel({ name: aiModelForm.name.trim(), versions: [] });
                }
                setAiModelForm({ name: '' });
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition"
            >
              {editAiModelId ? '更新' : '追加'}
            </button>
            {editAiModelId && (
              <button onClick={() => { setEditAiModelId(null); setAiModelForm({ name: '' }); }}
                className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg">キャンセル</button>
            )}
          </div>

          {/* AI Models list */}
          <div className="space-y-3">
            {getAiModels().map(model => (
              <div key={model.id} className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-800">{model.name}</span>
                  <div className="flex gap-1.5">
                    <button onClick={() => { setEditAiModelId(model.id); setAiModelForm({ name: model.name }); }}
                      className="text-xs text-blue-600 hover:text-blue-800">編集</button>
                    <button onClick={() => { if (window.confirm(`「${model.name}」を削除しますか？`)) deleteAiModel(model.id); }}
                      className="text-xs text-red-500 hover:text-red-700">削除</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {(model.versions || []).map((v, vi) => (
                    <span key={vi} className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
                      {v}
                      <button onClick={() => {
                        const newVersions = model.versions.filter((_, i) => i !== vi);
                        updateAiModel(model.id, { versions: newVersions });
                      }} className="text-blue-400 hover:text-red-500 ml-0.5">&times;</button>
                    </span>
                  ))}
                </div>
                {addingVersionModelId === model.id ? (
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={aiVersionForm}
                      onChange={e => setAiVersionForm(e.target.value)}
                      placeholder="バージョン名"
                      className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter' && aiVersionForm.trim()) {
                          updateAiModel(model.id, { versions: [...(model.versions || []), aiVersionForm.trim()] });
                          setAiVersionForm('');
                          setAddingVersionModelId(null);
                        }
                      }}
                    />
                    <button onClick={() => {
                      if (aiVersionForm.trim()) {
                        updateAiModel(model.id, { versions: [...(model.versions || []), aiVersionForm.trim()] });
                        setAiVersionForm('');
                      }
                      setAddingVersionModelId(null);
                    }} className="text-xs bg-blue-600 text-white px-2 py-1 rounded">追加</button>
                    <button onClick={() => { setAddingVersionModelId(null); setAiVersionForm(''); }}
                      className="text-xs text-gray-500 hover:text-gray-700">取消</button>
                  </div>
                ) : (
                  <button onClick={() => { setAddingVersionModelId(model.id); setAiVersionForm(''); }}
                    className="text-xs text-blue-600 hover:text-blue-800">+ バージョン追加</button>
                )}
              </div>
            ))}
            {getAiModels().length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">AIモデルが登録されていません</p>
            )}
          </div>
        </div>

        {/* AI記録設定 */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">AI記録設定</h4>
          <p className="text-xs text-gray-500 mb-4">
            チェックを入れた科目×業務内容の組み合わせでは、作業者がタスク提出時にAI使用記録を入力できるようになります。
          </p>
          {(() => {
            const aiSettings = getAiUsageSettings();
            const workTypeNames = getWorkTypes().map(wt => wt.name);
            return (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 border border-gray-200">科目 ＼ 業務内容</th>
                      {workTypeNames.map(wt => (
                        <th key={wt} className="text-center px-3 py-2 text-xs font-semibold text-gray-600 border border-gray-200 whitespace-nowrap">{wt}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {SUBJECTS_LIST.map(subject => (
                      <tr key={subject} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-xs font-medium text-gray-700 border border-gray-200 whitespace-nowrap">{subject}</td>
                        {workTypeNames.map(wt => {
                          const checked = aiSettings.some(s => s.subject === subject && s.workType === wt);
                          return (
                            <td key={wt} className="text-center px-3 py-2 border border-gray-200">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => setAiUsageSetting(subject, wt, !checked)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
          {getAiUsageSettings().length > 0 && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-xs font-semibold text-blue-700 mb-1">現在のAI記録設定:</p>
              <div className="flex flex-wrap gap-1.5">
                {getAiUsageSettings().map(s => (
                  <span key={s.id} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                    {s.subject} / {s.workType}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {activeMasterSection === 'externalwork' && (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">外部作業設定</h4>
        <p className="text-xs text-gray-500 mb-4">
          チェックを入れた科目×作業種の組み合わせは「外部作業」として扱われ、作業者側で手動タイマーが表示されます。
          Word編集など、アプリ外での作業が必要なタスクに使用してください。
        </p>
        {(() => {
          const ewSettings = getExternalWorkSettings();
          const workTypeNames = getWorkTypes().map(wt => wt.name);
          return (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 border border-gray-200">科目 ＼ 作業種</th>
                    {workTypeNames.map(wt => (
                      <th key={wt} className="text-center px-3 py-2 text-xs font-semibold text-gray-600 border border-gray-200 whitespace-nowrap">{wt}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SUBJECTS_LIST.map(subject => (
                    <tr key={subject} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-xs font-medium text-gray-700 border border-gray-200 whitespace-nowrap">{subject}</td>
                      {workTypeNames.map(wt => {
                        const checked = ewSettings.some(s => s.subject === subject && s.workType === wt);
                        return (
                          <td key={wt} className="text-center px-3 py-2 border border-gray-200">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                if (checked) {
                                  removeExternalWorkSetting(subject, wt);
                                } else {
                                  addExternalWorkSetting(subject, wt);
                                }
                              }}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}
        {getExternalWorkSettings().length > 0 && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-xs font-semibold text-blue-700 mb-1">現在の外部作業設定:</p>
            <div className="flex flex-wrap gap-1.5">
              {getExternalWorkSettings().map(s => (
                <span key={s.id} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                  {s.subject} / {s.workType}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      )}

        </div>
      )}
    </div>
  );
};

export default MasterDataTab;
