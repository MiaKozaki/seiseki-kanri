import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useData, isFinished } from '../contexts/DataContext.jsx';
import { downloadExamExcel } from '../utils/excelExport.js';
import { generateId, SUBJECTS_LIST } from '../utils/storage.js';
import { saveAttachment, deleteAttachmentsByAssignment, validateFile, MAX_FILES_PER_SUBMISSION, downloadAttachment, getTaskAttachments } from '../utils/fileStorage.js';

// Helper to parse structured FB message into parts
const parseFbMessage = (message) => {
  if (!message) return null;
  const contentMatch = message.match(/【FB内容】\n([\s\S]*?)(?:\n\n【詳細】|$)/);
  const detailMatch = message.match(/【詳細】\n([\s\S]*)$/);
  if (!contentMatch) return null;
  const items = contentMatch[1].split('\n').filter(s => s.trim());
  const detail = detailMatch ? detailMatch[1].trim() : '';
  return { items, detail };
};

// Component to render structured FB message
// hideDetail: 添削者向け表示ではカテゴリ項目のみ表示し、詳細は非公開
const StructuredFbDisplay = ({ message, hideDetail = true }) => {
  const parsed = parseFbMessage(message);
  if (!parsed) {
    return <p className="text-gray-700">{message}</p>;
  }
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold text-amber-700">FB内容：</p>
      <ul className="list-disc list-inside space-y-0.5">
        {parsed.items.map((item, i) => (
          <li key={i} className="text-gray-700 text-xs leading-relaxed">{item.replace(/^・/, '')}</li>
        ))}
      </ul>
      {!hideDetail && parsed.detail && (
        <>
          <p className="text-[10px] font-semibold text-amber-700 mt-1.5">詳細：</p>
          <p className="text-gray-700 whitespace-pre-wrap">{parsed.detail}</p>
        </>
      )}
    </div>
  );
};

// Component to show task attachment download buttons
const TaskAttachmentDownloads = ({ attachments }) => {
  const [loading, setLoading] = useState(null);
  const handleDownload = async (att) => {
    setLoading(att.id);
    try {
      await downloadAttachment(att.id, att.fileName);
    } catch (err) {
      console.error('Download error:', err);
    }
    setLoading(null);
  };
  return (
    <div className="mt-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
      <p className="text-[10px] text-blue-600 font-semibold mb-1.5">{'\uD83D\uDCC4'} 問題ファイル</p>
      <div className="space-y-1">
        {attachments.map(att => (
          <button
            key={att.id}
            onClick={() => handleDownload(att)}
            disabled={loading === att.id}
            className="flex items-center gap-2 text-xs w-full text-left px-2 py-1.5 bg-white border border-blue-100 rounded-lg hover:bg-blue-50 transition disabled:opacity-50"
          >
            <span className="text-blue-500">{att.fileName?.endsWith('.pdf') ? '\uD83D\uDCC4' : '\uD83D\uDCCE'}</span>
            <span className="text-blue-700 truncate flex-1">{att.fileName}</span>
            <span className="text-blue-400 text-[10px] shrink-0">
              {loading === att.id ? '...' : `${(att.fileSize / 1024).toFixed(0)}KB`}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

const TABS = [
  { label: '工数登録', icon: '⏱️' },
  { label: '担当業務', icon: '📋' },
  { label: '業務募集', icon: '📢' },
  { label: '通知', icon: '🔔' },
  { label: '使い方', icon: '📖' },
];

const statusConfig = {
  assigned: { text: '割当済', cls: 'bg-blue-100 text-blue-700' },
  in_progress: { text: '作業中', cls: 'bg-yellow-100 text-yellow-700' },
  submitted: { text: '提出済・検証待ち', cls: 'bg-purple-100 text-purple-700' },
  approved: { text: '承認済', cls: 'bg-green-100 text-green-700' },
  rejected: { text: '差し戻し', cls: 'bg-red-100 text-red-700' },
  completed: { text: '完了', cls: 'bg-green-100 text-green-700' },
};

// ===============================================
// 入力フォームビュー（構成・内容）
// ===============================================
// 枝問（最下層・回答データを持つ）
const newEdamon = () => ({
  edaId: generateId(),
  枝問名: '',
  模範解答: '',
  配点: '',
  完答: false,
  順不同: false,
  別解: '',
  解説: '',
  解説画像: '',
  解答画像: '',       // 算数用
  条件指定: '',       // 社会用
  条件指定要素: '',   // 理科用
  不可解答: '',       // 社会用
  採点基準: [],       // 国語用（項目+付記の多段構造）
  採点基準テキスト: '', // 理科用（単一テキスト）
});

const newKijun = () => ({ kijunId: generateId(), 項目: '', 付記: [] });

// 問（枝問を持つ中間層）
const newMon = (idx = 1) => ({
  monId: generateId(),
  小問名: String(idx),
  枝問リスト: [newEdamon()],
});

// 大問（問を持つ上位層）
const newDaimon = (番号) => ({
  大問番号: 番号,
  満点: '',
  文種: '',   // 国語用
  出典: '',   // 国語用
  著者: '',   // 国語用
  テーマ: '', // 理科用
  問リスト: [],
});

const ExamInputForm = ({ task, assignment, existingInput, onSave, onBack, sheetsSignedIn, sheets, onDaimonFocus }) => {
  const { user } = useAuth();
  const [section, setSection] = useState('structure'); // 'structure' | 'content'
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState('');
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  // フォーム状態（旧形式からの自動移行付き）
  const [form, setForm] = useState(() => {
    if (existingInput) {
      // 新形式（問リスト埋め込み）かチェック
      if (existingInput.大問リスト?.[0]?.問リスト !== undefined) return existingInput;
      // 旧形式（問題リスト分離型）→ 新形式に移行
      const oldList = existingInput.問題リスト ?? [];
      const migratedDaimonList = (existingInput.大問リスト ?? []).map(d => ({
        ...d,
        問リスト: oldList
          .filter(m => m.大問名 === String(d.大問番号))
          .map(m => ({
            monId: generateId(),
            小問名: m.小問名 ?? '',
            枝問リスト: [{
              edaId: generateId(),
              枝問名: m.枝問 ?? '',
              模範解答: m.模範解答 ?? '',
              配点: m.配点 ?? '',
              完答: m.完答 ?? false,
              順不同: m.順不同 ?? false,
              別解: m.別解 ?? '',
              解説: m.解説 ?? '',
              解説画像: m.解説画像 ?? '',
              採点基準: m.採点基準 ?? [],
            }],
          })),
      }));
      return { ...existingInput, 大問リスト: migratedDaimonList };
    }
    return {
      id: generateId(),
      taskId: task.id,
      assignmentId: assignment?.id ?? '',
      年度: new Date().getFullYear(),
      学校名: '',
      回数: 1,
      科目: task.subject ?? '',
      試験時間: 50,
      大問リスト: [{
        大問番号: 1, 満点: '', 文種: '', 出典: '', 著者: '', テーマ: '',
        問リスト: [newMon(1)],
      }],
      status: 'draft',
      createdAt: new Date().toISOString(),
    };
  });

  const isKokugo = form.科目 === '国語';
  const isSansu = form.科目 === '算数';
  const isRika = form.科目 === '理科';
  const isShakai = form.科目 === '社会';

  // ---- 構成ヘルパー ----
  const setBase = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const updateDaimon = (idx, field, value) =>
    setForm(f => ({
      ...f,
      大問リスト: f.大問リスト.map((d, i) => i === idx ? { ...d, [field]: value } : d),
    }));

  const addDaimon = () =>
    setForm(f => ({
      ...f,
      大問リスト: [...f.大問リスト, newDaimon(f.大問リスト.length + 1)],
    }));

  const removeDaimon = (idx) =>
    setForm(f => ({
      ...f,
      大問リスト: f.大問リスト
        .filter((_, i) => i !== idx)
        .map((d, i) => ({ ...d, 大問番号: i + 1 })),
    }));

  // ---- 内容ヘルパー（3段階）----
  const updateInDaimon = (daimonNum, updater) =>
    setForm(f => ({
      ...f,
      大問リスト: f.大問リスト.map(d => d.大問番号 === daimonNum ? updater(d) : d),
    }));

  const updateInMon = (daimonNum, monId, updater) =>
    updateInDaimon(daimonNum, d => ({
      ...d,
      問リスト: d.問リスト.map(m => m.monId === monId ? updater(m) : m),
    }));

  const updateInEda = (daimonNum, monId, edaId, updater) =>
    updateInMon(daimonNum, monId, m => ({
      ...m,
      枝問リスト: m.枝問リスト.map(e => e.edaId === edaId ? updater(e) : e),
    }));

  // 問レベル
  const addMon = (daimonNum) =>
    updateInDaimon(daimonNum, d => ({
      ...d,
      問リスト: [...d.問リスト, newMon(d.問リスト.length + 1)],
    }));

  const removeMon = (daimonNum, monId) =>
    updateInDaimon(daimonNum, d => ({
      ...d,
      問リスト: d.問リスト.filter(m => m.monId !== monId),
    }));

  const updateMon = (daimonNum, monId, field, value) =>
    updateInMon(daimonNum, monId, m => ({ ...m, [field]: value }));

  // 枝問レベル
  const addEda = (daimonNum, monId) =>
    updateInMon(daimonNum, monId, m => ({
      ...m,
      枝問リスト: [...m.枝問リスト, newEdamon()],
    }));

  const removeEda = (daimonNum, monId, edaId) =>
    updateInMon(daimonNum, monId, m => ({
      ...m,
      枝問リスト: m.枝問リスト.filter(e => e.edaId !== edaId),
    }));

  const updateEda = (daimonNum, monId, edaId, field, value) =>
    updateInEda(daimonNum, monId, edaId, e => ({ ...e, [field]: value }));

  // 採点基準（枝問レベル）
  const addKijun = (daimonNum, monId, edaId) =>
    updateInEda(daimonNum, monId, edaId, e => ({
      ...e,
      採点基準: [...(e.採点基準 ?? []), newKijun()],
    }));

  const updateKijun = (daimonNum, monId, edaId, kijunId, field, value) =>
    updateInEda(daimonNum, monId, edaId, e => ({
      ...e,
      採点基準: e.採点基準.map(k => k.kijunId === kijunId ? { ...k, [field]: value } : k),
    }));

  const removeKijun = (daimonNum, monId, edaId, kijunId) =>
    updateInEda(daimonNum, monId, edaId, e => ({
      ...e,
      採点基準: e.採点基準.filter(k => k.kijunId !== kijunId),
    }));

  const addFuki = (daimonNum, monId, edaId, kijunId) =>
    updateInEda(daimonNum, monId, edaId, e => ({
      ...e,
      採点基準: e.採点基準.map(k =>
        k.kijunId === kijunId ? { ...k, 付記: [...(k.付記 ?? []), ''] } : k
      ),
    }));

  const updateFuki = (daimonNum, monId, edaId, kijunId, fIndex, value) =>
    updateInEda(daimonNum, monId, edaId, e => ({
      ...e,
      採点基準: e.採点基準.map(k =>
        k.kijunId === kijunId
          ? { ...k, 付記: k.付記.map((v, i) => i === fIndex ? value : v) }
          : k
      ),
    }));

  const removeFuki = (daimonNum, monId, edaId, kijunId, fIndex) =>
    updateInEda(daimonNum, monId, edaId, e => ({
      ...e,
      採点基準: e.採点基準.map(k =>
        k.kijunId === kijunId
          ? { ...k, 付記: k.付記.filter((_, i) => i !== fIndex) }
          : k
      ),
    }));

  // ---- バリデーション ----
  const validateBeforeSubmit = () => {
    const errors = [];

    // ===== 全科目共通: 大問の満点と配点合計の一致チェック =====
    form.大問リスト.forEach(daimon => {
      const mantenVal = Number(daimon.満点);
      if (!mantenVal && mantenVal !== 0) return; // 満点未設定はスキップ
      const totalHaiten = daimon.問リスト.reduce((sum, mon) =>
        sum + mon.枝問リスト.reduce((s, eda) => s + (Number(eda.配点) || 0), 0), 0);
      if (totalHaiten !== mantenVal) {
        errors.push({
          type: 'haiten',
          msg: `大問${daimon.大問番号}: 満点（${mantenVal}点）と配点合計（${totalHaiten}点）が一致しません`,
        });
      }
    });

    // ===== 算数: 1桁全角 / 2桁以上半角チェック =====
    if (task.subject === '算数') {
      const toFull = (s) => s.replace(/[0-9]/g, c => String.fromCharCode(c.charCodeAt(0) + 0xFEE0));
      const toHalf = (s) => s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));

      const checkText = (text, location) => {
        if (!text || typeof text !== 'string') return;
        // 半角1桁（前後に半角数字がない孤立した半角数字）
        const halfSingle = text.match(/(?<![0-9０-９])[0-9](?![0-9０-９])/g);
        if (halfSingle) {
          errors.push({
            type: 'digit',
            msg: `${location}: 1桁の数字「${halfSingle.join(', ')}」→ 全角「${halfSingle.map(toFull).join(', ')}」に修正してください`,
          });
        }
        // 全角2桁以上の連続
        const fullMulti = text.match(/[０-９]{2,}/g);
        if (fullMulti) {
          errors.push({
            type: 'digit',
            msg: `${location}: 2桁以上の数字「${fullMulti.join(', ')}」→ 半角「${fullMulti.map(toHalf).join(', ')}」に修正してください`,
          });
        }
      };

      form.大問リスト.forEach(daimon => {
        daimon.問リスト.forEach((mon, mIdx) => {
          mon.枝問リスト.forEach((eda, eIdx) => {
            const loc = `大問${daimon.大問番号} 問${mIdx + 1}${mon.枝問リスト.length > 1 ? ` 枝${eIdx + 1}` : ''}`;
            checkText(eda.模範解答, `${loc} 模範解答`);
            checkText(eda.解説, `${loc} 解説`);
            checkText(eda.別解, `${loc} 別解`);
            checkText(eda.枝問名, `${loc} 枝問名`);
            (eda.採点基準 ?? []).forEach((kijun, ki) => {
              checkText(kijun.項目, `${loc} 採点基準${ki + 1}`);
              (kijun.付記 ?? []).forEach((fuki, fi) => {
                checkText(fuki, `${loc} 採点基準${ki + 1} 付記${fi + 1}`);
              });
            });
          });
        });
      });
    }

    return errors;
  };

  // リアルタイムバリデーション（フォーム変更のたびに自動再計算）
  const liveErrors = useMemo(() => validateBeforeSubmit(), [form]);

  // ---- 保存・書き出し ----
  const handleSave = async () => {
    setSaving(true);
    onSave({ ...form, status: 'draft' });
    showToast('💾 下書きを保存しました');
    setSaving(false);
  };

  const handleDownloadExcel = () => {
    if (liveErrors.length > 0) {
      showToast('⚠️ エラーを修正してから提出してください');
      return;
    }
    try {
      downloadExamExcel(form);
      onSave({ ...form, status: 'submitted' });
      showToast('✅ Excelをダウンロードしました！');
    } catch (e) {
      showToast(`❌ ダウンロードエラー: ${e.message}`);
    }
  };

  // handleWriteSheets removed (Google Sheets連携削除)

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg transition flex items-center gap-1"
          >
            ← 戻る
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800 truncate">{task.name}</p>
            <p className="text-xs text-gray-400">{task.subject}{task.workType ? ` · ${task.workType}` : ''}</p>
          </div>
          {form.status === 'submitted' && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">📥 提出済</span>
          )}
          {form.status === 'draft' && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">下書き</span>
          )}
        </div>
      </div>

      {/* セクションタブ */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="flex border-b border-gray-200">
          {[
            { key: 'structure', label: '📐 構成', desc: '試験概要・大問' },
            { key: 'content', label: '📝 内容', desc: `大問${form.大問リスト.length} / 問${form.大問リスト.reduce((s,d)=>s+(d.問リスト?.length??0),0)}` },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setSection(tab.key)}
              className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition ${
                section === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              <span className="ml-1.5 text-xs text-gray-400">{tab.desc}</span>
            </button>
          ))}
        </div>

        {/* ===== 構成セクション ===== */}
        {section === 'structure' && (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">年度</label>
                <input type="number" value={form.年度}
                  onChange={e => setBase('年度', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">学校名</label>
                <input type="text" value={form.学校名}
                  onChange={e => setBase('学校名', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="例：〇〇中学校"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">回数</label>
                <input type="number" value={form.回数} min="1"
                  onChange={e => setBase('回数', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">科目</label>
                <select value={form.科目}
                  onChange={e => setBase('科目', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">選択</option>
                  {SUBJECTS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {(isSansu || isRika) && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">試験時間（分）</label>
                  <input type="number" value={form.試験時間} min="1"
                    onChange={e => setBase('試験時間', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              )}
            </div>

            {/* 大問リスト */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-gray-700">大問リスト（{form.大問リスト.length}問）</h4>
                <button onClick={addDaimon}
                  className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 hover:bg-blue-50 px-2.5 py-1 rounded-lg transition">
                  + 大問を追加
                </button>
              </div>
              <div className="space-y-2">
                {form.大問リスト.map((d, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-gray-600 w-8">大問{d.大問番号}</span>
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-500 mb-0.5">大問ごとの満点</label>
                          <input type="number" value={d.満点} min="0"
                            onChange={e => updateDaimon(idx, '満点', Number(e.target.value))}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="例：20"
                          />
                          {(() => {
                            const totalHaiten = (d.問リスト || []).reduce((sum, mon) =>
                              sum + (mon.枝問リスト || []).reduce((s, eda) => s + (Number(eda.配点) || 0), 0), 0);
                            const manten = Number(d.満点);
                            if (manten && totalHaiten !== manten) {
                              return <p className="text-xs text-red-500 mt-1">⚠ 配点合計 {totalHaiten}点 ≠ 満点 {manten}点</p>;
                            }
                            return null;
                          })()}
                        </div>
                        {isKokugo && (
                          <>
                            <div>
                              <label className="block text-xs text-gray-500 mb-0.5">文種</label>
                              <input type="text" value={d.文種}
                                onChange={e => updateDaimon(idx, '文種', e.target.value)}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="例：物語文"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-0.5">出典</label>
                              <input type="text" value={d.出典}
                                onChange={e => updateDaimon(idx, '出典', e.target.value)}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="例：百年の子"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-0.5">著者</label>
                              <input type="text" value={d.著者}
                                onChange={e => updateDaimon(idx, '著者', e.target.value)}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="例：古内一絵"
                              />
                            </div>
                          </>
                        )}
                        {isRika && (
                          <div>
                            <label className="block text-xs text-gray-500 mb-0.5">テーマ</label>
                            <input type="text" value={d.テーマ ?? ''}
                              onChange={e => updateDaimon(idx, 'テーマ', e.target.value)}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              placeholder="例：連結した箱に水を入れるてこ"
                            />
                          </div>
                        )}
                      </div>
                      {form.大問リスト.length > 1 && (
                        <button onClick={() => removeDaimon(idx)}
                          className="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded transition shrink-0">×</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===== 内容セクション ===== */}
        {section === 'content' && (
          <div className="p-4 space-y-4">
            {form.大問リスト.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">先に「構成」タブで大問を追加してください</p>
            ) : (
              form.大問リスト.map((daimon, dIdx) => (
                <div key={daimon.大問番号} className="border border-blue-200 rounded-xl overflow-hidden">
                  {/* ── 大問ヘッダー ── */}
                  <div
                    className="bg-blue-50 px-4 py-2.5 flex items-center gap-2 flex-wrap border-b border-blue-100"
                    onClick={() => onDaimonFocus && onDaimonFocus(daimon.大問番号)}
                  >
                    <span className="text-sm font-bold text-blue-700">大問 {daimon.大問番号}</span>
                    {daimon.満点 !== '' && daimon.満点 !== undefined && (
                      <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">満点 {daimon.満点}点</span>
                    )}
                    {isKokugo && daimon.文種 && (
                      <span className="text-xs text-blue-500">{daimon.文種}{daimon.出典 ? `『${daimon.出典}』` : ''}</span>
                    )}
                    <div className="flex items-center gap-2 ml-auto">
                      <span className="text-xs text-gray-400">{daimon.問リスト.length}問</span>
                    </div>
                  </div>

                  {/* ── 問リスト ── */}
                  <div className="p-3 space-y-3 bg-white"
                    onFocus={() => onDaimonFocus && onDaimonFocus(daimon.大問番号)}
                  >
                    {daimon.問リスト.length === 0 && (
                      <p className="text-xs text-gray-300 italic py-2 px-1">問がまだありません</p>
                    )}
                    {daimon.問リスト.map((mon, mIdx) => (
                      <div key={mon.monId} className="border border-gray-200 rounded-lg overflow-hidden">
                        {/* 問ヘッダー */}
                        <div className="bg-gray-50 px-3 py-2 flex items-center gap-2 border-b border-gray-100">
                          <span className="text-xs font-bold text-gray-500 shrink-0">問 {mIdx + 1}</span>
                          <input
                            type="text" value={mon.小問名}
                            onChange={e => updateMon(daimon.大問番号, mon.monId, '小問名', e.target.value)}
                            placeholder="小問番号 (例: 1, (1))"
                            className="flex-1 text-xs border border-gray-200 rounded-md px-2 py-1 focus:ring-1 focus:ring-blue-400 outline-none min-w-0"
                          />
                          <span className="text-xs text-gray-400 shrink-0">{mon.枝問リスト.length}枝問</span>
                          <button onClick={() => removeMon(daimon.大問番号, mon.monId)}
                            className="text-xs text-red-400 hover:text-red-600 px-1.5 shrink-0">削除</button>
                        </div>

                        {/* ── 枝問リスト ── */}
                        <div className="divide-y divide-gray-100">
                          {mon.枝問リスト.map((eda, eIdx) => (
                            <div key={eda.edaId} className="p-3 space-y-3">
                              {/* 枝問ラベル行 */}
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-indigo-500 shrink-0 w-10">
                                  {mon.枝問リスト.length > 1 ? `枝 ${eIdx + 1}` : '枝問'}
                                </span>
                                <input
                                  type="text" value={eda.枝問名}
                                  onChange={e => updateEda(daimon.大問番号, mon.monId, eda.edaId, '枝問名', e.target.value)}
                                  placeholder="枝問記号（任意 例: ア, (1)）"
                                  className="text-xs border border-gray-200 rounded-md px-2 py-1 w-36 focus:ring-1 focus:ring-indigo-400 outline-none"
                                />
                                {mon.枝問リスト.length > 1 && (
                                  <button onClick={() => removeEda(daimon.大問番号, mon.monId, eda.edaId)}
                                    className="text-xs text-red-300 hover:text-red-500 ml-auto px-1.5">削除</button>
                                )}
                              </div>

                              {/* 模範解答・配点 */}
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                <div className="sm:col-span-2">
                                  <label className="block text-xs text-gray-500 mb-0.5">模範解答</label>
                                  <input type="text" value={eda.模範解答}
                                    onChange={e => updateEda(daimon.大問番号, mon.monId, eda.edaId, '模範解答', e.target.value)}
                                    placeholder="解答を入力"
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-500 mb-0.5">配点</label>
                                  <input type="number" value={eda.配点} min="0"
                                    onChange={e => updateEda(daimon.大問番号, mon.monId, eda.edaId, '配点', Number(e.target.value))}
                                    placeholder="2"
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                  />
                                </div>
                              </div>

                              {/* ===== 科目別フィールド ===== */}

                              {/* 算数: 解答_画像, 完答+順不同+別解, 解説, 解説_画像 */}
                              {isSansu && (
                                <>
                                  <div>
                                    <label className="block text-xs text-gray-500 mb-0.5">解答_画像 URL（任意）</label>
                                    <input type="url" value={eda.解答画像 ?? ''}
                                      onChange={e => updateEda(daimon.大問番号, mon.monId, eda.edaId, '解答画像', e.target.value)}
                                      placeholder="https://..."
                                      className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-gray-500 mb-0.5">解説</label>
                                    <textarea value={eda.解説}
                                      onChange={e => updateEda(daimon.大問番号, mon.monId, eda.edaId, '解説', e.target.value)}
                                      rows={2}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                      placeholder="解説文を入力"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-gray-500 mb-0.5">解説_画像 URL（任意）</label>
                                    <input type="url" value={eda.解説画像 ?? ''}
                                      onChange={e => updateEda(daimon.大問番号, mon.monId, eda.edaId, '解説画像', e.target.value)}
                                      placeholder="https://..."
                                      className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                  </div>
                                  <div className="flex flex-wrap items-center gap-3">
                                    <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                                      <input type="checkbox" checked={eda.完答}
                                        onChange={e => updateEda(daimon.大問番号, mon.monId, eda.edaId, '完答', e.target.checked)}
                                        className="accent-blue-600" /> 完答
                                    </label>
                                    <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                                      <input type="checkbox" checked={eda.順不同}
                                        onChange={e => updateEda(daimon.大問番号, mon.monId, eda.edaId, '順不同', e.target.checked)}
                                        className="accent-blue-600" /> 順不同
                                    </label>
                                    <div className="flex items-center gap-1.5">
                                      <label className="text-xs text-gray-500">別解:</label>
                                      <input type="text" value={eda.別解}
                                        onChange={e => updateEda(daimon.大問番号, mon.monId, eda.edaId, '別解', e.target.value)}
                                        placeholder="任意"
                                        className="w-32 px-2 py-1 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                                      />
                                    </div>
                                  </div>
                                </>
                              )}

                              {/* 国語: 完答, 解説, 採点基準（項目+付記の多段構造） */}
                              {isKokugo && (
                                <>
                                  <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                                    <input type="checkbox" checked={eda.完答}
                                      onChange={e => updateEda(daimon.大問番号, mon.monId, eda.edaId, '完答', e.target.checked)}
                                      className="accent-blue-600" /> 完答
                                  </label>
                                  <div>
                                    <label className="block text-xs text-gray-500 mb-0.5">解説</label>
                                    <textarea value={eda.解説}
                                      onChange={e => updateEda(daimon.大問番号, mon.monId, eda.edaId, '解説', e.target.value)}
                                      rows={2}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                      placeholder="解説文を入力"
                                    />
                                  </div>
                                  <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                      <label className="text-xs font-semibold text-gray-600">採点基準</label>
                                      <button onClick={() => addKijun(daimon.大問番号, mon.monId, eda.edaId)}
                                        className="text-xs text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:bg-indigo-50 px-2 py-0.5 rounded transition">
                                        + 採点基準を追加
                                      </button>
                                    </div>
                                    {(eda.採点基準 ?? []).length === 0 && (
                                      <p className="text-xs text-gray-300 italic">採点基準なし</p>
                                    )}
                                    <div className="space-y-2">
                                      {(eda.採点基準 ?? []).map((kijun, ki) => (
                                        <div key={kijun.kijunId} className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
                                          <div className="flex items-start gap-2">
                                            <span className="text-xs font-medium text-indigo-600 shrink-0 mt-1.5">基準{ki + 1}</span>
                                            <div className="flex-1 space-y-2">
                                              <div className="flex items-center gap-2">
                                                <input type="text" value={kijun.項目}
                                                  onChange={e => updateKijun(daimon.大問番号, mon.monId, eda.edaId, kijun.kijunId, '項目', e.target.value)}
                                                  placeholder="採点基準の項目"
                                                  className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                                                />
                                                <button onClick={() => removeKijun(daimon.大問番号, mon.monId, eda.edaId, kijun.kijunId)}
                                                  className="text-red-400 hover:text-red-600 text-xs px-1.5">×</button>
                                              </div>
                                              <div className="space-y-1">
                                                {(kijun.付記 ?? []).map((fuki, fi) => (
                                                  <div key={fi} className="flex items-center gap-2 ml-2">
                                                    <span className="text-xs text-indigo-400 shrink-0">付記{fi + 1}</span>
                                                    <input type="text" value={fuki}
                                                      onChange={e => updateFuki(daimon.大問番号, mon.monId, eda.edaId, kijun.kijunId, fi, e.target.value)}
                                                      placeholder={`付記 ${fi + 1}`}
                                                      className="flex-1 px-2 py-1 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-400 outline-none bg-white"
                                                    />
                                                    <button onClick={() => removeFuki(daimon.大問番号, mon.monId, eda.edaId, kijun.kijunId, fi)}
                                                      className="text-red-300 hover:text-red-500 text-xs">×</button>
                                                  </div>
                                                ))}
                                                <button onClick={() => addFuki(daimon.大問番号, mon.monId, eda.edaId, kijun.kijunId)}
                                                  className="text-xs text-gray-400 hover:text-gray-600 ml-2 transition">
                                                  + 付記を追加
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </>
                              )}

                              {/* 社会: 完答+順不同, 条件指定, 別解, 不可解答, 解説 */}
                              {isShakai && (
                                <>
                                  <div className="flex flex-wrap items-center gap-3">
                                    <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                                      <input type="checkbox" checked={eda.完答}
                                        onChange={e => updateEda(daimon.大問番号, mon.monId, eda.edaId, '完答', e.target.checked)}
                                        className="accent-blue-600" /> 完答
                                    </label>
                                    <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                                      <input type="checkbox" checked={eda.順不同}
                                        onChange={e => updateEda(daimon.大問番号, mon.monId, eda.edaId, '順不同', e.target.checked)}
                                        className="accent-blue-600" /> 順不同
                                    </label>
                                  </div>
                                  <div>
                                    <label className="block text-xs text-gray-500 mb-0.5">条件指定</label>
                                    <input type="text" value={eda.条件指定 ?? ''}
                                      onChange={e => updateEda(daimon.大問番号, mon.monId, eda.edaId, '条件指定', e.target.value)}
                                      placeholder="条件指定があれば入力"
                                      className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-gray-500 mb-0.5">別解</label>
                                    <input type="text" value={eda.別解}
                                      onChange={e => updateEda(daimon.大問番号, mon.monId, eda.edaId, '別解', e.target.value)}
                                      placeholder="別解があれば入力"
                                      className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-gray-500 mb-0.5">不可解答</label>
                                    <input type="text" value={eda.不可解答 ?? ''}
                                      onChange={e => updateEda(daimon.大問番号, mon.monId, eda.edaId, '不可解答', e.target.value)}
                                      placeholder="不可解答があれば入力"
                                      className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-gray-500 mb-0.5">解説</label>
                                    <textarea value={eda.解説}
                                      onChange={e => updateEda(daimon.大問番号, mon.monId, eda.edaId, '解説', e.target.value)}
                                      rows={2}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                      placeholder="解説文を入力"
                                    />
                                  </div>
                                </>
                              )}

                              {/* 理科: 完答+順不同, 条件指定・要素, 採点基準テキスト, 解説 */}
                              {isRika && (
                                <>
                                  <div className="flex flex-wrap items-center gap-3">
                                    <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                                      <input type="checkbox" checked={eda.完答}
                                        onChange={e => updateEda(daimon.大問番号, mon.monId, eda.edaId, '完答', e.target.checked)}
                                        className="accent-blue-600" /> 完答
                                    </label>
                                    <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                                      <input type="checkbox" checked={eda.順不同}
                                        onChange={e => updateEda(daimon.大問番号, mon.monId, eda.edaId, '順不同', e.target.checked)}
                                        className="accent-blue-600" /> 順不同
                                    </label>
                                  </div>
                                  <div>
                                    <label className="block text-xs text-gray-500 mb-0.5">条件指定・要素</label>
                                    <input type="text" value={eda.条件指定要素 ?? ''}
                                      onChange={e => updateEda(daimon.大問番号, mon.monId, eda.edaId, '条件指定要素', e.target.value)}
                                      placeholder="条件指定・要素があれば入力"
                                      className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-gray-500 mb-0.5">採点基準</label>
                                    <textarea value={eda.採点基準テキスト ?? ''}
                                      onChange={e => updateEda(daimon.大問番号, mon.monId, eda.edaId, '採点基準テキスト', e.target.value)}
                                      rows={2}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                      placeholder="採点基準を入力"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-gray-500 mb-0.5">解説</label>
                                    <textarea value={eda.解説}
                                      onChange={e => updateEda(daimon.大問番号, mon.monId, eda.edaId, '解説', e.target.value)}
                                      rows={2}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                      placeholder="解説文を入力"
                                    />
                                  </div>
                                </>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* 枝問追加ボタン */}
                        <div className="px-3 py-2 bg-gray-50 border-t border-gray-100">
                          <button onClick={() => addEda(daimon.大問番号, mon.monId)}
                            className="w-full text-xs text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:bg-indigo-50 px-2 py-1.5 rounded-lg transition text-center">
                            ＋ 枝問を追加
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* 問追加ボタン */}
                    <button onClick={() => addMon(daimon.大問番号)}
                      className="w-full text-xs text-blue-600 hover:text-blue-800 border border-blue-200 hover:bg-blue-50 px-2.5 py-2 rounded-lg transition text-center">
                      ＋ 大問{daimon.大問番号}に問を追加
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* バリデーションエラー表示（リアルタイム） */}
      {liveErrors.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
          <h4 className="text-sm font-bold text-amber-700 flex items-center gap-1.5">
            ⚠️ 修正が必要な箇所があります
          </h4>
          <ul className="space-y-1">
            {liveErrors.map((err, i) => (
              <li key={i} className="text-xs text-amber-700 flex items-start gap-2">
                <span className="shrink-0 mt-0.5">{err.type === 'haiten' ? '📊' : '🔢'}</span>
                <span>{err.msg}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* アクションボタン */}
      <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
        {/* ボタン群 */}
        <div className="flex flex-wrap gap-2 items-center">
          <button onClick={handleSave} disabled={saving}
            className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition font-medium">
            💾 下書き保存
          </button>
          <button onClick={handleDownloadExcel}
            className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition font-medium">
            📥 Excelダウンロード
          </button>
          <button onClick={onBack}
            className="text-sm text-gray-400 hover:text-gray-600 border border-gray-200 px-3 py-2 rounded-lg transition">
            ← 戻る
          </button>
        </div>
      </div>

      {/* トースト通知 */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-sm px-5 py-3 rounded-xl shadow-lg z-50 transition">
          {toast}
        </div>
      )}
    </div>
  );
};

// ===============================================
// メインダッシュボード
// ===============================================
export default function CorrectorDashboard() {
  const { user, logout, changePassword } = useAuth();
  const {
    getUsers, getCapacities, addCapacity, deleteCapacity,
    getAssignments, updateAssignment,
    getNotifications, markNotificationRead, markAllNotificationsRead,
    getTasks,
    getExamInputs, saveExamInput,
    getRecruitments, getApplications, addApplication, claimVikingTask,
    getUserFields, getFields,
    startTimer, stopTimer, stopActiveTimer, getTimeLogs, getActiveTimer, getTaskTotalTime, getDaimonTotalTime,
    getRejections, getRejectionCategories, getRejectionSeverities,
    getVerificationItems,
    getFeedbacks,
    getManuals,
    getReviewMemos,
  } = useData();
  const [activeTab, setActiveTab] = useState(0);
  const [capForm, setCapForm] = useState({ startDate: '', endDate: '', hoursPerDay: 8, note: '' });
  const [capError, setCapError] = useState('');
  const [calendarMonth, setCalendarMonth] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() });
  const [openManualSections, setOpenManualSections] = useState({});

  // パスワード変更モーダル
  const [showPwModal, setShowPwModal] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPw: '', newPw: '', confirmPw: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);

  const handlePwChange = (e) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess(false);
    // 現在のパスワードを検証
    const users = getUsers();
    const currentUser = users.find(u => u.id === user.id);
    if (!currentUser || currentUser.password !== btoa(pwForm.currentPw)) {
      setPwError('現在のパスワードが正しくありません');
      return;
    }
    if (pwForm.newPw.length < 6) { setPwError('新しいパスワードは6文字以上にしてください'); return; }
    if (pwForm.newPw !== pwForm.confirmPw) { setPwError('新しいパスワードが一致しません'); return; }
    const success = changePassword(user.id, pwForm.newPw);
    if (success) {
      setPwSuccess(true);
      setPwForm({ currentPw: '', newPw: '', confirmPw: '' });
      setTimeout(() => { setShowPwModal(false); setPwSuccess(false); }, 1500);
    } else {
      setPwError('パスワードの変更に失敗しました');
    }
  };
  const toggleManualSection = (key) => setOpenManualSections(prev => ({ ...prev, [key]: !prev[key] }));

  // 実績工数提出フォーム管理
  const [submittingId, setSubmittingId] = useState(null);
  const [submitForm, setSubmitForm] = useState({ actualHours: '', note: '', files: [] });
  const [isSubmitBusy, setIsSubmitBusy] = useState(false);

  // 提出前チェックリストモーダル
  const [checklistModalData, setChecklistModalData] = useState(null); // { assignmentId, defaultHours, items }
  const [checklistResults, setChecklistResults] = useState({}); // { itemId: boolean }

  // タスク展開管理（インライン提出用）
  const [expandedTaskId, setExpandedTaskId] = useState(null);
  const [inlineChecklistResults, setInlineChecklistResults] = useState({});

  // 入力フォームビュー
  const [inputViewTaskId, setInputViewTaskId] = useState(null);
  const openInputView = (taskId) => setInputViewTaskId(taskId);

  // 業務募集タブ
  const [applyingId, setApplyingId] = useState(null);
  const [applyMessage, setApplyMessage] = useState('');

  const handleStartSubmit = (assignmentId, defaultHours) => {
    // 提出前チェックリストがあるか確認
    const assignment = getAssignments().find(a => a.id === assignmentId);
    const task = assignment ? getTasks().find(t => t.id === assignment.taskId) : null;
    if (task) {
      const checkItems = getVerificationItems(task.subject, 'submission', task.workType);
      if (checkItems.length > 0) {
        setChecklistModalData({ assignmentId, defaultHours, items: checkItems });
        setChecklistResults({});
        return;
      }
    }
    setSubmittingId(assignmentId);
    setSubmitForm({ actualHours: String(defaultHours), note: '', files: [] });
  };
  const handleChecklistComplete = () => {
    if (!checklistModalData) return;
    const aid = checklistModalData.assignmentId;
    setSubmittingId(aid);
    setChecklistModalData(null);
    handleConfirmSubmit(aid);
  };
  const handleCancelSubmit = () => {
    setSubmittingId(null);
    setSubmitForm({ actualHours: '', note: '', files: [] });
  };

  // ファイル添付ハンドラ
  const handleFileAdd = (e) => {
    const newFiles = Array.from(e.target.files);
    const errors = [];
    const validFiles = [];
    for (const file of newFiles) {
      const fileErrors = validateFile(file);
      if (fileErrors.length > 0) {
        errors.push(...fileErrors);
      } else {
        validFiles.push(file);
      }
    }
    const totalFiles = submitForm.files.length + validFiles.length;
    if (totalFiles > MAX_FILES_PER_SUBMISSION) {
      errors.push(`添付ファイルは最大${MAX_FILES_PER_SUBMISSION}件までです`);
      validFiles.splice(MAX_FILES_PER_SUBMISSION - submitForm.files.length);
    }
    if (errors.length > 0) alert('添付エラー:\n' + errors.join('\n'));
    if (validFiles.length > 0) {
      setSubmitForm(prev => ({ ...prev, files: [...prev.files, ...validFiles] }));
    }
    e.target.value = '';
  };
  const handleFileRemove = (index) => {
    setSubmitForm(prev => ({ ...prev, files: prev.files.filter((_, i) => i !== index) }));
  };
  const handleConfirmSubmit = async (assignmentId) => {
    if (isSubmitBusy) return;
    setIsSubmitBusy(true);

    try {
      // Find exam input for this task
      const allAssignments = getAssignments(user.id);
      const assignment = allAssignments.find(a => a.id === assignmentId);
      const taskId = assignment?.taskId;
      const allTasks = getTasks();
      const task = taskId ? allTasks.find(t => t.id === taskId) : null;
      const existingInput = taskId ? getExamInputs().find(ei => ei.taskId === taskId) : null;

      // Run validation if exam input exists
      if (existingInput && task) {
        const errors = [];

        // 配点チェック（全科目共通）
        (existingInput.大問リスト || []).forEach(daimon => {
          const mantenVal = Number(daimon.満点);
          if (!mantenVal && mantenVal !== 0) return;
          const totalHaiten = (daimon.問リスト || []).reduce((sum, mon) =>
            sum + (mon.枝問リスト || []).reduce((s, eda) => s + (Number(eda.配点) || 0), 0), 0);
          if (totalHaiten !== mantenVal) {
            errors.push(`大問${daimon.大問番号}: 満点(${mantenVal}点)と配点合計(${totalHaiten}点)が不一致`);
          }
        });

        // 算数の全角/半角チェック
        if (task.subject === '算数') {
          const checkText = (text, location) => {
            if (!text || typeof text !== 'string') return;
            if (text.match(/(?<![0-9０-９])[0-9](?![0-9０-９])/)) {
              errors.push(`${location}: 半角1桁の数字があります（全角にしてください）`);
            }
            if (text.match(/[０-９]{2,}/)) {
              errors.push(`${location}: 全角2桁以上の数字があります（半角にしてください）`);
            }
          };
          (existingInput.大問リスト || []).forEach(daimon => {
            (daimon.問リスト || []).forEach((mon, mIdx) => {
              (mon.枝問リスト || []).forEach((eda) => {
                const loc = `大問${daimon.大問番号}`;
                checkText(eda.模範解答, `${loc} 模範解答`);
                checkText(eda.解説, `${loc} 解説`);
                checkText(eda.別解, `${loc} 別解`);
              });
            });
          });
        }

        if (errors.length > 0) {
          alert('⚠️ 入力内容にエラーがあります。\n\n' + errors.join('\n'));
          setIsSubmitBusy(false);
          return;
        }

        // Auto-generate Excel and mark exam input as submitted
        try {
          downloadExamExcel(existingInput);
          saveExamInput({ ...existingInput, status: 'submitted' });
        } catch (e) {
          saveExamInput({ ...existingInput, status: 'submitted' });
        }
      }

      // 再提出時: 既存添付ファイルを削除
      if (assignment?.attachments?.length > 0) {
        try { await deleteAttachmentsByAssignment(assignmentId); } catch (e) { /* ignore */ }
      }

      // 添付ファイルをIndexedDBに保存
      const attachmentMeta = [];
      for (const file of submitForm.files) {
        try {
          const meta = await saveAttachment({
            assignmentId,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            blob: file,
          });
          attachmentMeta.push(meta);
        } catch (e) {
          console.error('File save error:', e);
        }
      }

      // Update assignment
      stopActiveTimer(user.id);
      // タイマーから実績工数を自動計算（0.5時間単位、最低0.5時間）
      const totalSeconds = getTaskTotalTime(taskId) || 0;
      const autoHours = Math.max(0.5, Math.round((totalSeconds / 3600) * 2) / 2);
      // チェックリスト結果を含める
      const clResults = Object.keys(checklistResults).length > 0
        ? Object.entries(checklistResults).map(([itemId, checked]) => ({ itemId, checked, checkedAt: new Date().toISOString() }))
        : undefined;
      updateAssignment(assignmentId, {
        status: 'submitted',
        actualHours: autoHours,
        submittedAt: new Date().toISOString(),
        ...(submitForm.note ? { note: submitForm.note } : {}),
        ...(attachmentMeta.length > 0 ? { attachments: attachmentMeta } : {}),
        ...(clResults ? { submissionChecklistResults: clResults } : {}),
      });
      setSubmittingId(null);
      setSubmitForm({ actualHours: '', note: '', files: [] });
      setExpandedTaskId(null);
      setInlineChecklistResults({});
    } finally {
      setIsSubmitBusy(false);
    }
  };

  const myCapacities = getCapacities(user.id);
  const myAssignments = getAssignments(user.id);
  const myNotifications = getNotifications(user.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const tasks = getTasks();
  const unreadCount = myNotifications.filter(n => !n.read).length;

  const handleCapSubmit = (e) => {
    e.preventDefault();
    setCapError('');
    if (new Date(capForm.endDate) < new Date(capForm.startDate)) {
      setCapError('終了日は開始日以降にしてください');
      return;
    }
    addCapacity({ ...capForm, userId: user.id, hoursPerDay: Number(capForm.hoursPerDay) });
    setCapForm({ startDate: '', endDate: '', hoursPerDay: 8, note: '' });
  };

  // Calculate totals
  const totalAvailable = myCapacities.reduce((s, c) => s + c.totalHours, 0);
  const totalAssigned = myAssignments
    .filter(a => !isFinished(a.status))
    .reduce((s, a) => s + a.assignedHours, 0);

  // タスクカードを展開/閉じる（自動タイマー開始/停止）
  const toggleTaskExpand = (taskId) => {
    if (expandedTaskId === taskId) {
      // 閉じる: タイマー停止
      stopActiveTimer(user.id);
      setExpandedTaskId(null);
      setInlineChecklistResults({});
      setSubmitForm({ actualHours: '', note: '', files: [] });
      return;
    }
    // 別タスクが開いていたら先にそっちのタイマーを止める
    if (expandedTaskId) {
      stopActiveTimer(user.id);
    }
    setExpandedTaskId(taskId);
    setInlineChecklistResults({});
    setSubmitForm({ actualHours: '', note: '', files: [] });
    // 自動的にタイマーを開始し、ステータスをin_progressに変更
    const assignment = myAssignments.find(a => a.taskId === taskId);
    if (assignment && (assignment.status === 'assigned' || assignment.status === 'rejected')) {
      updateAssignment(assignment.id, { status: 'in_progress' });
      startTimer(assignment.id, taskId, user.id);
    } else if (assignment && assignment.status === 'in_progress') {
      const active = getActiveTimer(user.id);
      if (!active || active.taskId !== taskId) {
        startTimer(assignment.id, taskId, user.id);
      }
    }
  };

  // 入力フォームビューが開いている場合は専用ビューを表示
  if (inputViewTaskId) {
    const task = tasks.find(t => t.id === inputViewTaskId);
    const assignment = myAssignments.find(a => a.taskId === inputViewTaskId);
    const existingInput = task ? getExamInputs().find(ei => ei.taskId === inputViewTaskId) : null;
    if (task) {
      return (
        <div className="min-h-screen bg-gray-50">
          <div className="max-w-3xl mx-auto px-4 py-6">
            <ExamInputForm
              task={task}
              assignment={assignment}
              existingInput={existingInput}
              onSave={(data) => { saveExamInput(data); }}
              onBack={() => setInputViewTaskId(null)}
            />
          </div>
        </div>
      );
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-sm">
              {user.name.charAt(0)}
            </div>
            <div>
              <p className="font-semibold text-gray-800 text-sm">{user.name}</p>
              <p className="text-xs text-gray-400">添削者</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-gray-500">空き工数</p>
              <p className="text-sm font-bold text-blue-600">{Math.max(0, totalAvailable - totalAssigned)}h</p>
            </div>
            <button
              onClick={() => { setShowPwModal(true); setPwError(''); setPwSuccess(false); setPwForm({ currentPw: '', newPw: '', confirmPw: '' }); }}
              className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg transition"
            >
              PW変更
            </button>
            <button
              onClick={logout}
              className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg transition"
            >
              ログアウト
            </button>
          </div>
        </div>
      </header>

      {/* パスワード変更モーダル */}
      {showPwModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-4">パスワード変更</h3>
            {pwSuccess ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm text-green-700 font-medium">パスワードを変更しました</p>
              </div>
            ) : (
              <form onSubmit={handlePwChange} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">現在のパスワード</label>
                  <input type="password" value={pwForm.currentPw} onChange={e => setPwForm({ ...pwForm, currentPw: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">新しいパスワード</label>
                  <input type="password" value={pwForm.newPw} onChange={e => setPwForm({ ...pwForm, newPw: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="6文字以上" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">新しいパスワード（確認）</label>
                  <input type="password" value={pwForm.confirmPw} onChange={e => setPwForm({ ...pwForm, confirmPw: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="もう一度入力" required />
                </div>
                {pwError && <p className="text-xs text-red-500">{pwError}</p>}
                <div className="flex gap-2 pt-2">
                  <button type="submit" className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium transition">
                    変更する
                  </button>
                  <button type="button" onClick={() => setShowPwModal(false)}
                    className="flex-1 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg font-medium hover:bg-gray-50 transition">
                    キャンセル
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 flex">
          {TABS.map((tab, i) => (
            <button
              key={i}
              onClick={() => { setActiveTab(i); if (expandedTaskId) { stopActiveTimer(user.id); setExpandedTaskId(null); setInlineChecklistResults({}); } }}
              className={`relative px-5 py-3.5 text-sm font-medium border-b-2 transition ${
                activeTab === i
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="mr-1.5">{tab.icon}</span>
              {tab.label}
              {i === 3 && unreadCount > 0 && (
                <span className="absolute top-2 right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center leading-none">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* ===== TAB: 工数登録（カレンダー形式） ===== */}
        {activeTab === 0 && (() => {
          const today = new Date();
          const calYear = calendarMonth.year;
          const calMonth = calendarMonth.month;

          const firstDay = new Date(calYear, calMonth, 1);
          const lastDay = new Date(calYear, calMonth + 1, 0);
          const startDow = firstDay.getDay();
          const daysInMonth = lastDay.getDate();

          // 日ごとの工数マップを構築
          const dayHoursMap = {};
          myCapacities.forEach(cap => {
            const s = new Date(cap.startDate);
            const e = new Date(cap.endDate);
            for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
              const key = d.toISOString().slice(0, 10);
              dayHoursMap[key] = (dayHoursMap[key] || 0) + (cap.hoursPerDay || 0);
            }
          });

          const monthTotal = Array.from({ length: daysInMonth }, (_, i) => {
            const key = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
            return dayHoursMap[key] || 0;
          }).reduce((a, b) => a + b, 0);

          const prevMonth = () => {
            if (calMonth === 0) setCalendarMonth({ year: calYear - 1, month: 11 });
            else setCalendarMonth({ year: calYear, month: calMonth - 1 });
          };
          const nextMonth = () => {
            if (calMonth === 11) setCalendarMonth({ year: calYear + 1, month: 0 });
            else setCalendarMonth({ year: calYear, month: calMonth + 1 });
          };

          const cells = [];
          for (let i = 0; i < startDow; i++) cells.push(null);
          for (let d = 1; d <= daysInMonth; d++) cells.push(d);

          const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

          return (
            <>
              {/* サマリーカード */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: '登録済み工数', value: `${totalAvailable}h`, color: 'bg-blue-50 text-blue-700' },
                  { label: '割当工数', value: `${totalAssigned}h`, color: 'bg-orange-50 text-orange-700' },
                  { label: '空き工数', value: `${Math.max(0, totalAvailable - totalAssigned)}h`, color: 'bg-green-50 text-green-700' },
                ].map(card => (
                  <div key={card.label} className={`rounded-xl p-3 ${card.color}`}>
                    <p className="text-xs font-medium opacity-70">{card.label}</p>
                    <p className="text-xl font-bold mt-0.5">{card.value}</p>
                  </div>
                ))}
              </div>

              {/* カレンダー */}
              <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <button onClick={prevMonth} className="text-gray-500 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100 transition">◀</button>
                  <div className="text-center">
                    <h2 className="text-base font-bold text-gray-800">{calYear}年 {calMonth + 1}月</h2>
                    <p className="text-xs text-gray-500">月間合計: <span className="font-semibold text-blue-600">{monthTotal}h</span></p>
                  </div>
                  <button onClick={nextMonth} className="text-gray-500 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100 transition">▶</button>
                </div>

                {/* 曜日ヘッダ */}
                <div className="grid grid-cols-7 gap-px mb-1">
                  {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
                    <div key={d} className={`text-center text-xs font-semibold py-1 ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'}`}>{d}</div>
                  ))}
                </div>

                {/* 日セル */}
                <div className="grid grid-cols-7 gap-px">
                  {cells.map((day, idx) => {
                    if (day === null) return <div key={`empty-${idx}`} className="h-16" />;
                    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const hours = dayHoursMap[dateStr] || 0;
                    const isToday = dateStr === todayStr;
                    const dow = idx % 7;
                    const isPast = dateStr < todayStr;

                    const saveHours = (newVal) => {
                      const h = Number(newVal);
                      if (isNaN(h)) return;
                      const capsToDelete = myCapacities.filter(cap => dateStr >= cap.startDate && dateStr <= cap.endDate);
                      capsToDelete.forEach(cap => {
                        deleteCapacity(cap.id);
                        if (cap.startDate < dateStr) {
                          const prevDay = new Date(new Date(dateStr).getTime() - 86400000).toISOString().slice(0, 10);
                          addCapacity({ userId: user.id, startDate: cap.startDate, endDate: prevDay, hoursPerDay: cap.hoursPerDay, note: cap.note });
                        }
                        if (cap.endDate > dateStr) {
                          const nextDay = new Date(new Date(dateStr).getTime() + 86400000).toISOString().slice(0, 10);
                          addCapacity({ userId: user.id, startDate: nextDay, endDate: cap.endDate, hoursPerDay: cap.hoursPerDay, note: cap.note });
                        }
                      });
                      if (h > 0) addCapacity({ userId: user.id, startDate: dateStr, endDate: dateStr, hoursPerDay: h });
                    };

                    return (
                      <div
                        key={day}
                        className={`h-16 border rounded-lg p-1 flex flex-col items-center transition
                          ${isToday ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}
                          ${hours > 0 && !isPast ? 'bg-green-50' : ''}
                          ${isPast ? 'opacity-60' : ''}`}
                      >
                        <span className={`text-[10px] leading-none ${dow === 0 ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-gray-500'}`}>{calMonth + 1}/{day}</span>
                        {isPast ? (
                          <span className="text-sm font-bold text-gray-400 mt-1">{hours > 0 ? hours : '-'}</span>
                        ) : (
                          <input
                            type="number"
                            min="0" max="24" step="0.5"
                            defaultValue={hours || ''}
                            placeholder="-"
                            onBlur={e => {
                              const val = e.target.value;
                              if (val === '' && hours === 0) return;
                              if (val === '' || val === '0') { if (hours > 0) saveHours(0); return; }
                              if (Number(val) !== hours) saveHours(val);
                            }}
                            onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
                            className="w-full text-center text-sm font-bold text-green-700 bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 outline-none mt-1 py-0.5"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 一括入力 */}
              <div className="bg-white rounded-xl shadow-sm p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">一括入力</h3>
                <form onSubmit={handleCapSubmit} className="flex flex-wrap items-end gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">開始日</label>
                    <input type="date" value={capForm.startDate} onChange={e => setCapForm({ ...capForm, startDate: e.target.value })}
                      className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm" required />
                  </div>
                  <span className="text-gray-400 pb-1.5">〜</span>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">終了日</label>
                    <input type="date" value={capForm.endDate} onChange={e => setCapForm({ ...capForm, endDate: e.target.value })}
                      className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm" required />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">時間/日</label>
                    <input type="number" value={capForm.hoursPerDay} onChange={e => setCapForm({ ...capForm, hoursPerDay: e.target.value })}
                      min="0.5" max="24" step="0.5" className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-1.5 rounded-lg transition">一括入力</button>
                </form>
                {capError && <p className="text-red-500 text-xs mt-1">{capError}</p>}
              </div>
            </>
          );
        })()}

        {/* ===== TAB: 担当業務 ===== */}
        {activeTab === 1 && (
          <>
              {/* VIKINGタスク一覧 */}
              {(() => {
                const myUserFields = getUserFields ? getUserFields(user.id) : [];
                const myFieldIds = myUserFields.map(uf => uf.fieldId);
                const vikingTasks = tasks.filter(t => t.viking && t.status === 'pending' && (
                  user.subjects?.includes(t.subject) || (t.macroTask && user.subjects?.includes('マクロ'))
                ) && (!t.fieldId || myFieldIds.includes(t.fieldId)));
                if (vikingTasks.length === 0) return null;
                return (
                  <div className="bg-white rounded-xl shadow-sm p-6 mb-4 border-2 border-orange-200">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-base font-semibold text-orange-700">🛡 VIKINGタスク</h2>
                      <span className="text-xs text-orange-500">{vikingTasks.length}件取得可能</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">自分で取って作業できるタスクです。クリックすると自動的に割り当てられます。</p>
                    <div className="space-y-2">
                      {vikingTasks.map(task => (
                        <div key={task.id} className="flex items-center gap-3 p-3 border border-orange-100 rounded-lg hover:bg-orange-50 transition">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-orange-100 text-orange-700">VIKING</span>
                              {task.macroTask && <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-100 text-indigo-700">takos</span>}
                              <span className="text-sm font-medium text-gray-800">{task.name}</span>
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {task.subject}{task.workType ? ` · ${task.workType}` : ''}{task.fieldId && getFields ? (() => { const f = getFields().find(f => f.id === task.fieldId); return f ? ` · ${f.name}` : ''; })() : ''} · {task.requiredHours}h · 期限: {task.deadline}
                            </p>
                          </div>
                          <button
                            onClick={() => { if (confirm(`「${task.name}」を取得しますか？`)) claimVikingTask(task.id, user.id); }}
                            className="shrink-0 text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg transition font-medium"
                          >
                            🛡 作業を取る
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
              {/* タスク一覧 */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-gray-800">担当業務</h2>
                  <span className="text-xs text-gray-400">{myAssignments.length}件</span>
                </div>
                {myAssignments.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-8">割り当てられた業務はありません</p>
                ) : (
                  <div className="space-y-3">
                    {[...myAssignments].sort((a, b) => new Date(b.assignedAt) - new Date(a.assignedAt)).map(assignment => {
                      const task = tasks.find(t => t.id === assignment.taskId);
                      if (!task) return null;
                      const sc = statusConfig[assignment.status] ?? { text: assignment.status, cls: 'bg-gray-100 text-gray-600' };
                      const isDone = isFinished(assignment.status);
                      const isOverdue = new Date(task.deadline) < new Date() && !isDone;
                      const isSubmitting = submittingId === assignment.id;
                      const isSubmitted = assignment.status === 'submitted';
                      const isRejected = assignment.status === 'rejected';
                      return (
                        <div key={assignment.id} className={`p-4 border rounded-xl ${isOverdue ? 'border-red-200 bg-red-50' : isDone ? 'border-green-200 bg-green-50' : isRejected ? 'border-red-200 bg-red-50' : isSubmitted ? 'border-purple-200 bg-purple-50' : expandedTaskId === task.id ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200'}`}>
                          {/* ヘッダー行 */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sc.cls}`}>{sc.text}</span>
                                {isOverdue && <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-600">期限超過</span>}
                                <span className="text-sm font-semibold text-gray-800">{task.name}</span>
                              </div>
                              <p className="text-xs text-gray-500">
                                {task.subject ?? '不明'}
                                {task.workType && <><span className="mx-1">·</span><span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded">{task.workType}</span></>}
                                <span className="mx-1">·</span>
                                予定工数: <strong>{task.requiredHours}h</strong>
                                <span className="mx-1">·</span>
                                期限: <span className={isOverdue ? 'text-red-500 font-medium' : ''}>{task.deadline}</span>
                              </p>
                              <p className="text-xs text-gray-400 mt-1">
                                振り分け: {new Date(assignment.assignedAt).toLocaleDateString('ja-JP')}
                                {!isSubmitting && assignment.note && ` (${assignment.note})`}
                              </p>
                              {/* 問題ファイル */}
                              {task.taskAttachments && task.taskAttachments.length > 0 && (
                                <TaskAttachmentDownloads attachments={task.taskAttachments} />
                              )}
                              {/* 完了/承認済み: 実績表示 */}
                              {isDone && assignment.actualHours != null && (
                                <p className="text-xs text-green-700 mt-1 font-medium">
                                  ✅ 実績工数: {assignment.actualHours}h
                                  {assignment.submittedAt && ` · 提出: ${new Date(assignment.submittedAt).toLocaleDateString('ja-JP')}`}
                                </p>
                              )}
                              {/* 提出済み: 検証待ちメッセージ */}
                              {isSubmitted && (
                                <div>
                                  <p className="text-xs text-purple-600 mt-1 font-medium">
                                    ⏳ リーダーの検証を待っています...
                                  </p>
                                  {assignment.attachments?.length > 0 && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      📎 添付: {assignment.attachments.map(a => a.fileName).join(', ')}
                                    </p>
                                  )}
                                </div>
                              )}
                              {/* 差し戻し: 理由表示 */}
                              {isRejected && assignment.reviewNote && (
                                <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                                  <span className="font-medium">差し戻し理由: </span>{assignment.reviewNote}
                                </div>
                              )}
                              {isRejected && assignment.rejectionCount > 0 && (
                                <p className="text-xs text-red-500 mt-1">差し戻し回数: {assignment.rejectionCount}回</p>
                              )}
                              {isRejected && (() => {
                                const rejDetails = getRejections ? getRejections({ assignmentId: assignment.id }) : [];
                                const categories = getRejectionCategories ? getRejectionCategories() : [];
                                const severities = getRejectionSeverities ? getRejectionSeverities() : [];
                                if (rejDetails.length === 0) return null;
                                return (
                                  <div className="mt-2 space-y-1">
                                    {rejDetails.slice(-5).map((r, i) => {
                                      const cat = categories.find(c => c.id === r.categoryId);
                                      const sev = severities.find(s => s.id === r.severityId);
                                      return (
                                        <div key={i} className="flex items-center gap-2 text-xs bg-white rounded p-1.5">
                                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: sev?.color || '#999' }}></span>
                                          <span className="font-medium text-gray-700">{cat?.name || '不明'}</span>
                                          <span className="text-gray-500">（{sev?.name || '不明'}）</span>
                                          {r.note && <span className="text-gray-500 truncate">{r.note}</span>}
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })()}

                              {/* 未通過の検証項目 */}
                              {isRejected && assignment.failedVerificationItemIds && assignment.failedVerificationItemIds.length > 0 && (() => {
                                const allItems = getVerificationItems ? getVerificationItems() : [];
                                const failedItems = assignment.failedVerificationItemIds
                                  .map(id => allItems.find(vi => vi.id === id))
                                  .filter(Boolean);
                                if (failedItems.length === 0) return null;
                                return (
                                  <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                                    <p className="text-xs font-semibold text-amber-700 mb-1.5">⚠️ 未通過の検証項目</p>
                                    <div className="space-y-1">
                                      {failedItems.map(item => (
                                        <div key={item.id} className="flex items-start gap-2 text-xs">
                                          <span className="text-amber-500 mt-0.5">•</span>
                                          <div>
                                            <span className="font-medium text-amber-800">{item.name}</span>
                                            {item.isRequired && <span className="ml-1 text-[10px] bg-red-100 text-red-600 px-1 py-0.5 rounded-full">必須</span>}
                                            {item.description && <p className="text-amber-600 mt-0.5">{item.description}</p>}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}

                              {/* フィードバック表示 */}
                              {(() => {
                                const fbs = getFeedbacks ? (getFeedbacks({ assignmentId: assignment.id }) || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) : [];
                                if (fbs.length === 0) return null;
                                return (
                                  <div className="mt-2">
                                    <p className="text-[10px] text-amber-600 font-semibold mb-1">💬 リーダーからのFB（{fbs.length}件）</p>
                                    <div className="space-y-1">
                                      {fbs.map(fb => (
                                        <div key={fb.id} className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs">
                                          <StructuredFbDisplay message={fb.message} />
                                          <p className="text-[10px] text-gray-400 mt-0.5">{new Date(fb.createdAt).toLocaleString('ja-JP')}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}

                              {/* 共有メモ表示 */}
                              {(() => {
                                const sharedMemos = getReviewMemos ? (getReviewMemos({ assignmentId: assignment.id, shared: true }) || []) : [];
                                if (sharedMemos.length === 0) return null;
                                return (
                                  <div className="mt-2">
                                    <p className="text-[10px] text-blue-600 font-semibold mb-1">📝 リーダーからのメモ（{sharedMemos.length}件）</p>
                                    <div className="space-y-1">
                                      {sharedMemos.map(m => (
                                        <div key={m.id} className="p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs">
                                          <p className="text-gray-700">{m.content}</p>
                                          <p className="text-[10px] text-gray-400 mt-0.5">{new Date(m.createdAt).toLocaleString('ja-JP')}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>

                            {/* アクションボタン（右側） */}
                            {!isDone && !isSubmitted && (
                              <div className="flex flex-col gap-1.5 shrink-0">
                                {task.sheetsUrl && (
                                  <a
                                    href={task.sheetsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1.5 rounded-lg transition font-medium text-center"
                                  >
                                    📊 スプシで開く
                                  </a>
                                )}
                                <button
                                  onClick={() => openInputView(task.id)}
                                  className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1.5 rounded-lg transition font-medium"
                                >
                                  📝 作業開始
                                </button>
                                <button
                                  onClick={() => toggleTaskExpand(task.id)}
                                  className={`text-xs px-3 py-1.5 rounded-lg transition font-medium ${
                                    expandedTaskId === task.id
                                      ? 'bg-gray-200 text-gray-700'
                                      : 'bg-green-600 hover:bg-green-700 text-white'
                                  }`}
                                >
                                  {expandedTaskId === task.id ? '閉じる' : '提出する'}
                                </button>
                              </div>
                            )}
                            {/* 完了/承認済みのスプシリンク */}
                            {isDone && task.sheetsUrl && (
                              <div className="flex flex-col gap-1.5 shrink-0">
                                <a
                                  href={task.sheetsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="shrink-0 text-xs text-green-600 hover:text-green-800 border border-green-200 px-2 py-1 rounded transition text-center"
                                >
                                  📊 スプシ
                                </a>
                              </div>
                            )}
                          </div>

                          {/* インライン提出セクション */}
                          {expandedTaskId === task.id && !isDone && !isSubmitted && (() => {
                            const timerTotalSec = getTaskTotalTime(task.id) || 0;
                            const timerMin = Math.floor(timerTotalSec / 60);
                            const timerHours = Math.max(0.5, Math.round((timerTotalSec / 3600) * 2) / 2);
                            const checkItems = getVerificationItems(task.subject, 'submission', task.workType);
                            const hasCheckItems = checkItems.length > 0;
                            const requiredItems = checkItems.filter(i => i.isRequired);
                            const allRequiredChecked = requiredItems.length === 0 || requiredItems.every(i => inlineChecklistResults[i.id]);
                            return (
                              <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
                                {/* 作業時間表示 */}
                                <div className="flex items-center gap-3">
                                  <span className="text-xs text-gray-500">作業時間:</span>
                                  <span className="text-sm font-medium text-blue-700">{timerMin}分（{timerHours}時間として計上）</span>
                                </div>

                                {/* チェックリスト（該当する場合） */}
                                {hasCheckItems && (
                                  <div>
                                    <p className="text-xs font-semibold text-gray-700 mb-2">提出前チェックリスト</p>
                                    <div className="space-y-1.5">
                                      {checkItems.sort((a, b) => a.sortOrder - b.sortOrder).map(item => (
                                        <label key={item.id} className="flex items-start gap-2.5 p-2.5 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition">
                                          <input
                                            type="checkbox"
                                            checked={!!inlineChecklistResults[item.id]}
                                            onChange={e => setInlineChecklistResults(prev => ({ ...prev, [item.id]: e.target.checked }))}
                                            className="mt-0.5 rounded border-gray-300"
                                          />
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                              <span className="text-xs font-medium text-gray-800">{item.name}</span>
                                              {item.isRequired && (
                                                <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">必須</span>
                                              )}
                                            </div>
                                            {item.description && (
                                              <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                                            )}
                                          </div>
                                        </label>
                                      ))}
                                    </div>
                                    {requiredItems.length > 0 && (
                                      <p className="text-xs text-gray-500 mt-1.5">
                                        必須項目: {requiredItems.filter(i => inlineChecklistResults[i.id]).length} / {requiredItems.length} 完了
                                        {!allRequiredChecked && <span className="text-red-500 ml-2">※ 全ての必須項目にチェックしてください</span>}
                                      </p>
                                    )}
                                  </div>
                                )}

                                {/* ファイル添付 */}
                                <div>
                                  <label className="block text-xs text-gray-500 mb-1">ファイル添付（任意・Excel/Word・最大5MB/件）</label>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <label className="cursor-pointer text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition border border-gray-300">
                                      ファイルを選択
                                      <input type="file" accept=".xlsx,.xls,.docx,.doc" multiple onChange={handleFileAdd} className="hidden" />
                                    </label>
                                    {submitForm.files.length > 0 && (
                                      <span className="text-xs text-gray-500">{submitForm.files.length}件選択中</span>
                                    )}
                                  </div>
                                  {submitForm.files.length > 0 && (
                                    <div className="mt-1.5 space-y-1">
                                      {submitForm.files.map((file, i) => (
                                        <div key={i} className="flex items-center gap-2 text-xs bg-gray-50 rounded-lg px-2 py-1.5">
                                          <span className="text-gray-600 truncate flex-1">
                                            {file.name}
                                            <span className="text-gray-400 ml-1">({(file.size / 1024).toFixed(0)}KB)</span>
                                          </span>
                                          <button onClick={() => handleFileRemove(i)} className="text-red-400 hover:text-red-600 shrink-0">✕</button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* メモ */}
                                <div>
                                  <label className="block text-xs text-gray-500 mb-1">メモ（任意）</label>
                                  <input
                                    type="text"
                                    value={submitForm.note}
                                    onChange={e => setSubmitForm(prev => ({ ...prev, note: e.target.value }))}
                                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="例：修正点あり"
                                  />
                                </div>

                                {/* 提出ボタン */}
                                <button
                                  onClick={() => {
                                    // チェックリスト結果をchecklistResultsにコピーしてから提出
                                    if (hasCheckItems) {
                                      setChecklistResults(inlineChecklistResults);
                                    }
                                    setSubmittingId(assignment.id);
                                    handleConfirmSubmit(assignment.id);
                                  }}
                                  disabled={isSubmitBusy || (hasCheckItems && !allRequiredChecked)}
                                  className="w-full text-sm bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-lg transition font-medium"
                                >
                                  {isSubmitBusy ? '送信中...' : '提出する'}
                                </button>
                              </div>
                            );
                          })()}

                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* マニュアルセクション */}
              {(() => {
                const userSubjects = user.subjects || [];
                const relevantManuals = (getManuals() || []).filter(m =>
                  m.subject === null || userSubjects.includes(m.subject)
                );
                if (relevantManuals.length === 0) return null;

                const subjectGroups = {};
                relevantManuals.forEach(m => {
                  const sKey = m.subject || '全科目共通';
                  if (!subjectGroups[sKey]) subjectGroups[sKey] = [];
                  subjectGroups[sKey].push(m);
                });
                const sortedSubjects = Object.keys(subjectGroups).sort((a, b) => {
                  if (a === '全科目共通') return -1;
                  if (b === '全科目共通') return 1;
                  return a.localeCompare(b);
                });

                return (
                  <div className="bg-white rounded-xl shadow-sm p-6 mt-4">
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => setOpenManualSections(prev => ({ ...prev, _manualMain: !prev._manualMain }))}
                    >
                      <h2 className="text-base font-semibold text-gray-800">{'\u{1F4D6}'} マニュアル</h2>
                      <span className="text-gray-400 text-xs">{openManualSections._manualMain ? '▼' : '▶'} {relevantManuals.length}件</span>
                    </div>
                    <div className={`overflow-hidden transition-all duration-300 ease-in-out ${openManualSections._manualMain ? 'max-h-[2000px] opacity-100 mt-4' : 'max-h-0 opacity-0'}`}>
                      {sortedSubjects.map(subjectKey => {
                        const manuals = subjectGroups[subjectKey];
                        return (
                          <div key={subjectKey} className="mb-3">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${subjectKey === '全科目共通' ? 'bg-gray-100 text-gray-600' : 'bg-blue-50 text-blue-700'}`}>
                                {subjectKey}
                              </span>
                            </div>
                            <div className="space-y-2 ml-2">
                              {manuals.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).map(m => (
                                <div key={m.id} className="bg-gray-50 rounded-lg p-3">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                      m.type === 'url' ? 'bg-blue-100 text-blue-600' :
                                      m.type === 'file' ? 'bg-green-100 text-green-600' :
                                      'bg-yellow-100 text-yellow-600'
                                    }`}>
                                      {m.type === 'url' ? 'URL' : m.type === 'file' ? 'ファイル' : 'テキスト'}
                                    </span>
                                    {m.workType && (
                                      <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">{m.workType}</span>
                                    )}
                                    <span className="text-sm font-medium text-gray-800">{m.title}</span>
                                  </div>
                                  {m.type === 'url' && m.url && (
                                    <a href={m.url} target="_blank" rel="noopener noreferrer"
                                      className="text-xs text-blue-500 hover:underline inline-flex items-center gap-1">
                                      {'\u{1F517}'} リンクを開く
                                    </a>
                                  )}
                                  {m.type === 'text' && m.content && (
                                    <div>
                                      <button
                                        onClick={() => setOpenManualSections(prev => ({ ...prev, [`manual_${m.id}`]: !prev[`manual_${m.id}`] }))}
                                        className="text-xs text-blue-500 hover:underline"
                                      >
                                        {openManualSections[`manual_${m.id}`] ? '内容を閉じる' : '内容を表示'}
                                      </button>
                                      {openManualSections[`manual_${m.id}`] && (
                                        <div className="mt-2 p-2 bg-white rounded border border-gray-200 text-xs text-gray-700 whitespace-pre-wrap">
                                          {m.content}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  {m.type === 'file' && m.fileAttachmentId && (
                                    <button
                                      onClick={() => downloadAttachment(m.fileAttachmentId, m.fileName)}
                                      className="text-xs text-green-600 hover:underline inline-flex items-center gap-1"
                                    >
                                      {'\u{1F4E5}'} {m.fileName || 'ダウンロード'} {m.fileSize ? `(${(m.fileSize / 1024).toFixed(1)} KB)` : ''}
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
          </>
        )}

        {/* ===== TAB: 業務募集 ===== */}
        {activeTab === 2 && (() => {
          const openRecruitments = getRecruitments('open');
          const userApplications = getApplications().filter(a => a.userId === user.id);
          const allRecruitments = getRecruitments();
          const userSubjects = user.subjects ?? [];

          return (
            <>
              {/* 募集中の業務 */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-base font-semibold text-gray-800 mb-4">募集中の業務</h2>
                {openRecruitments.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-8">現在募集中の業務はありません</p>
                ) : (
                  <div className="space-y-3">
                    {openRecruitments.map(rec => {
                      const myApp = userApplications.find(a => a.recruitmentId === rec.id);
                      const subjectMatch = userSubjects.includes(rec.subject);
                      const isApplying = applyingId === rec.id;

                      return (
                        <div key={rec.id} className="p-4 border border-gray-200 rounded-xl">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-gray-800 mb-1">{rec.title}</p>
                              {rec.description && <p className="text-xs text-gray-500 mb-2">{rec.description}</p>}
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${subjectMatch ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                                  {rec.subject}
                                </span>
                                <span className="text-xs text-gray-500">{rec.requiredHours}h</span>
                                {rec.deadline && (
                                  <span className="text-xs text-gray-500">期限: {rec.deadline}</span>
                                )}
                              </div>
                            </div>
                            <div className="shrink-0">
                              {myApp ? (
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  myApp.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                  myApp.status === 'approved' ? 'bg-green-100 text-green-700' :
                                  'bg-gray-100 text-gray-600'
                                }`}>
                                  {myApp.status === 'pending' ? '審査中' : myApp.status === 'approved' ? '承認' : '見送り'}
                                </span>
                              ) : subjectMatch && !isApplying ? (
                                <button
                                  onClick={() => { setApplyingId(rec.id); setApplyMessage(''); }}
                                  className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition text-sm font-medium"
                                >
                                  応募する
                                </button>
                              ) : null}
                            </div>
                          </div>
                          {/* 応募フォーム */}
                          {isApplying && (
                            <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                              <textarea
                                value={applyMessage}
                                onChange={e => setApplyMessage(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 outline-none"
                                rows={3}
                                placeholder="応募メッセージ（任意）"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    addApplication({ recruitmentId: rec.id, userId: user.id, message: applyMessage });
                                    setApplyingId(null);
                                    setApplyMessage('');
                                  }}
                                  className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition text-sm font-medium"
                                >
                                  応募を送信
                                </button>
                                <button
                                  onClick={() => { setApplyingId(null); setApplyMessage(''); }}
                                  className="px-4 py-2 text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl transition text-sm"
                                >
                                  キャンセル
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 自分の応募履歴 */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-base font-semibold text-gray-800 mb-4">応募履歴</h2>
                {userApplications.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-8">まだ応募はありません</p>
                ) : (
                  <div className="space-y-2">
                    {[...userApplications].sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt)).map(app => {
                      const rec = allRecruitments.find(r => r.id === app.recruitmentId);
                      return (
                        <div key={app.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-gray-800">{rec?.title ?? '不明な募集'}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              応募日: {new Date(app.appliedAt).toLocaleDateString('ja-JP')}
                              {app.message && ` · ${app.message}`}
                            </p>
                            {app.reviewNote && (
                              <p className="text-xs text-gray-500 mt-0.5">レビュー: {app.reviewNote}</p>
                            )}
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            app.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            app.status === 'approved' ? 'bg-green-100 text-green-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {app.status === 'pending' ? '審査中' : app.status === 'approved' ? '承認' : '見送り'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          );
        })()}

        {/* ===== TAB: 通知 ===== */}
        {activeTab === 3 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-800">通知</h2>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllNotificationsRead(user.id)}
                  className="text-xs text-blue-600 hover:text-blue-800 transition"
                >
                  すべて既読にする
                </button>
              )}
            </div>
            {myNotifications.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">通知はありません</p>
            ) : (
              <div className="space-y-2">
                {myNotifications.map(notif => (
                  <div
                    key={notif.id}
                    className={`p-4 rounded-xl border transition ${
                      notif.read ? 'bg-gray-50 border-gray-100' : 'bg-blue-50 border-blue-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        {!notif.read && (
                          <span className="mt-1.5 w-2 h-2 bg-blue-500 rounded-full shrink-0"></span>
                        )}
                        <div>
                          <p className="text-sm text-gray-800">{notif.message}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(notif.createdAt).toLocaleString('ja-JP')}
                          </p>
                        </div>
                      </div>
                      {!notif.read && (
                        <button
                          onClick={() => markNotificationRead(notif.id)}
                          className="shrink-0 text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded transition"
                        >
                          既読
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 4 && (() => {
          const correctorSections = [
            { key: 'capacity', icon: '⏱️', title: '工数登録', desc: '作業可能な期間と時間の登録' },
            { key: 'tasks', icon: '📋', title: '担当業務', desc: 'タスク一覧・提出・ファイル添付' },
            { key: 'recruit', icon: '📢', title: '業務募集', desc: 'VIKINGタスクの取得' },
            { key: 'notify', icon: '🔔', title: '通知', desc: '承認・差し戻し・FB通知' },
            { key: 'feedback', icon: '💬', title: 'フィードバック', desc: 'リーダーからのFB表示' },
          ];

          const correctorContent = {
            capacity: (
              <div className="text-sm text-gray-600 space-y-2">
                <p>自分が作業可能な期間と時間を登録します。</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>開始日・終了日</strong>：作業できる期間を指定</li>
                  <li><strong>1日あたりの作業可能時間</strong>：1日に何時間作業できるかを入力</li>
                  <li><strong>メモ</strong>：「午後のみ対応可能」などの補足情報（任意）</li>
                </ul>
                <p className="mt-2">登録すると画面上部に「登録済み工数」「割当工数」「空き工数」が表示されます。</p>
                <div className="mt-3 p-3 bg-amber-50 rounded-lg text-xs text-amber-700">
                  <strong>⚠️ 注意</strong>：工数を登録しないと、リーダーからタスクを割り当ててもらえません。必ず作業可能な期間を登録しましょう。
                </div>
              </div>
            ),
            tasks: (
              <div className="text-sm text-gray-600 space-y-2">
                <p>リーダーから割り当てられたタスクの一覧と、作業の流れを確認できます。</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>タスク一覧</strong>：割当済み・作業中・提出済み・差し戻し・完了のステータスで管理</li>
                  <li><strong>提出</strong>：提出前チェックリストを確認してから提出。ファイル添付にも対応</li>
                  <li><strong>ファイル添付</strong>：Excelファイル等を添付して提出可能</li>
                  <li><strong>差し戻し対応</strong>：差し戻し理由を確認し、修正して再提出</li>
                </ul>
                <div className="mt-3 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
                  <strong>💡 作業フロー</strong>：「提出する」をクリック → チェックリスト確認 → ファイル添付 → 提出 → リーダー検証 → 承認 or 差し戻し
                </div>
              </div>
            ),
            recruit: (
              <div className="text-sm text-gray-600 space-y-2">
                <p>VIKING形式の業務募集タスクを取得できます。</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>自分の担当科目・クリア済み分野に合った募集のみ表示されます（分野制限あり）</li>
                  <li>「取得する」ボタンでタスクを自分にアサイン</li>
                  <li>リーダーが募集を締め切ると取得できなくなります</li>
                </ul>
              </div>
            ),
            notify: (
              <div className="text-sm text-gray-600 space-y-2">
                <p>リーダーからの通知を確認できます。</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>承認通知</strong>：タスクが承認された時</li>
                  <li><strong>差し戻し通知</strong>：差し戻し理由も表示されます</li>
                  <li><strong>FB通知</strong>：リーダーからのフィードバック</li>
                  <li><strong>割当通知</strong>：新しいタスクが割り当てられた時</li>
                </ul>
                <p>「既読」ボタンで個別に、「すべて既読」で一括で既読にできます。</p>
              </div>
            ),
            feedback: (
              <div className="text-sm text-gray-600 space-y-2">
                <p>リーダーからのフィードバックを確認できます。</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>差し戻し時のコメントやカテゴリ・重大度</li>
                  <li>過去のフィードバック履歴の参照</li>
                </ul>
              </div>
            ),
          };

          return (
            <div className="space-y-4 max-w-4xl mx-auto">
              <div>
                <h2 className="text-lg font-bold text-gray-800 mb-1">📖 添削者用マニュアル</h2>
                <p className="text-sm text-gray-500">四谷大塚制作アプリの使い方ガイドです。各項目をクリックして詳細を確認できます。</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {correctorSections.map(({ key, icon, title, desc }) => (
                  <section
                    key={key}
                    className="bg-white rounded-xl border border-gray-200 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all"
                    onClick={() => toggleManualSection(key)}
                  >
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{icon}</span>
                          <h3 className="text-sm font-bold text-gray-800">{title}</h3>
                        </div>
                        <span className="text-gray-400 text-xs ml-2 shrink-0">{openManualSections[key] ? '▼' : '▶'}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 ml-7">{desc}</p>
                    </div>
                    <div
                      className={`overflow-hidden transition-all duration-300 ease-in-out ${
                        openManualSections[key] ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
                      }`}
                    >
                      <div className="px-4 pb-4 pt-2 border-t border-gray-100">
                        {correctorContent[key]}
                      </div>
                    </div>
                  </section>
                ))}
              </div>

              {/* 基本的な作業フロー - full width */}
              <section className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-200 p-5">
                <h3 className="text-sm font-bold text-blue-800 mb-3">🔄 基本的な作業フロー</h3>
                <div className="text-sm text-gray-700 space-y-2">
                  <div className="flex items-start gap-3">
                    <span className="bg-blue-600 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">1</span>
                    <p><strong>工数登録</strong>：作業可能な期間と時間を登録する</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="bg-blue-600 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">2</span>
                    <p><strong>タスク確認</strong>：担当業務タブでアサインされたタスクを確認 / 業務募集からVIKINGタスクを取得</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="bg-blue-600 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">3</span>
                    <p><strong>作業・提出</strong>：「提出する」をクリックしてタスクを展開（タイマー自動開始）</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="bg-blue-600 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">4</span>
                    <p><strong>提出</strong>：提出前チェックリストを確認 → ファイル添付 → 提出</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="bg-blue-600 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">5</span>
                    <p><strong>確認</strong>：通知タブで承認/差し戻し/FBの結果を確認</p>
                  </div>
                </div>
              </section>
            </div>
          );
        })()}
      </div>

      {/* 提出前チェックリストモーダル */}
      {checklistModalData && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-1">提出前チェックリスト</h3>
            <p className="text-xs text-gray-500 mb-4">以下の項目を確認してからご提出ください。</p>
            <div className="space-y-2 mb-4">
              {checklistModalData.items.sort((a, b) => a.sortOrder - b.sortOrder).map(item => (
                <label key={item.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition">
                  <input
                    type="checkbox"
                    checked={!!checklistResults[item.id]}
                    onChange={e => setChecklistResults(prev => ({ ...prev, [item.id]: e.target.checked }))}
                    className="mt-0.5 rounded border-gray-300"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800">{item.name}</span>
                      {item.isRequired && (
                        <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">必須</span>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
            {(() => {
              const requiredItems = checklistModalData.items.filter(i => i.isRequired);
              const checkedRequired = requiredItems.filter(i => checklistResults[i.id]);
              const allChecked = requiredItems.length === checkedRequired.length;
              return (
                <>
                  <div className="text-xs text-gray-500 mb-3">
                    必須項目: {checkedRequired.length} / {requiredItems.length} 完了
                    {!allChecked && <span className="text-red-500 ml-2">※ 全ての必須項目にチェックしてください</span>}
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => { setChecklistModalData(null); setChecklistResults({}); }}
                      className="text-sm text-gray-500 border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 transition"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={handleChecklistComplete}
                      disabled={!allChecked}
                      className="text-sm bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition font-medium"
                    >
                      確認完了 → 提出へ
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
