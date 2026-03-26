/**
 * FileMergeTab - Excel file merge tab (ファイル統合)
 * Allows drag-and-drop upload of Excel files, groups them, and merges into a single downloadable file.
 */
import React, { useState } from 'react';
import { parseAndGroupFiles, downloadMergedExcel } from '../../utils/excelMerge.js';

// ===== ファイル統合タブ =====
const FileMergeTab = () => {
  const [files, setFiles] = useState([]);
  const [groups, setGroups] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');

  const handleFiles = async (newFiles) => {
    const xlsxFiles = Array.from(newFiles).filter(f =>
      f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
    );
    if (xlsxFiles.length === 0) {
      setError('Excelファイル（.xlsx）を選択してください');
      return;
    }
    setError('');
    const allFiles = [...files, ...xlsxFiles];
    setFiles(allFiles);
    setProcessing(true);
    try {
      const result = await parseAndGroupFiles(allFiles);
      setGroups(result);
    } catch (e) {
      setError(`ファイルの解析に失敗しました: ${e.message}`);
    }
    setProcessing(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);

  const removeFile = (fileName) => {
    const updated = files.filter(f => f.name !== fileName);
    setFiles(updated);
    if (updated.length === 0) {
      setGroups([]);
    } else {
      parseAndGroupFiles(updated).then(setGroups);
    }
  };

  const clearAll = () => {
    setFiles([]);
    setGroups([]);
    setError('');
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-gray-800">📎 ファイル統合</h2>
      <p className="text-sm text-gray-500">
        大問ごとに出力されたExcelファイルをアップロードすると、試験種ごとに自動分類し、大問番号順に結合して1つのファイルとしてダウンロードできます。
      </p>

      {/* ドラッグ&ドロップエリア */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
          dragOver ? 'border-purple-500 bg-purple-50' : 'border-gray-300 bg-white hover:border-purple-400 hover:bg-purple-50/30'
        }`}
        onClick={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.multiple = true;
          input.accept = '.xlsx,.xls';
          input.onchange = (e) => handleFiles(e.target.files);
          input.click();
        }}
      >
        <div className="text-4xl mb-3">📁</div>
        <p className="text-gray-600 font-medium">ここにファイルをドラッグ&ドロップ</p>
        <p className="text-gray-400 text-sm mt-1">またはクリックしてファイルを選択</p>
        <p className="text-gray-300 text-xs mt-2">.xlsx形式のファイルのみ対応</p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>
      )}

      {/* アップロード済みファイル一覧 */}
      {files.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-700">アップロード済みファイル（{files.length}件）</h3>
            <button onClick={clearAll} className="text-xs text-red-500 hover:text-red-700">すべてクリア</button>
          </div>
          <div className="space-y-1.5">
            {files.map((f, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700 truncate">📄 {f.name}</span>
                <button onClick={() => removeFile(f.name)} className="text-gray-400 hover:text-red-500 text-xs ml-2">✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {processing && (
        <div className="text-center py-4 text-purple-600 animate-pulse">解析中...</div>
      )}

      {/* グループ別表示 */}
      {groups.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-700">試験種ごとの分類結果</h3>
          {groups.map((g) => (
            <div key={g.key} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-bold text-gray-800">{g.label}</h4>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {g.files.length}ファイル → 構成{g.koseiRows.length}行・内容{g.naiyouRows.length}行
                  </p>
                </div>
                <button
                  onClick={() => downloadMergedExcel(g)}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
                >
                  📥 統合してダウンロード
                </button>
              </div>
              <div className="text-xs text-gray-500 space-y-0.5">
                {g.files.map((fname, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="text-purple-400">•</span>
                    <span>{fname}</span>
                    <span className="text-gray-300 ml-1">
                      (大問 {g.koseiRows.filter(r => g.files.indexOf(fname) === i).length > 0 ? '含む' : ''})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileMergeTab;
