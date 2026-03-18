/**
 * Excel統合ユーティリティ
 * 複数のExcelファイル（大問別提出）を試験種ごとにグルーピングし、
 * 構成・内容シートを大問番号順にマージして1つのファイルとして出力する
 */
import XLSX from 'xlsx-js-style';

/**
 * 複数のExcelファイルを解析し、試験種ごとにグルーピングする
 * @param {File[]} files
 * @returns {Promise<Object[]>} グループ配列
 */
export const parseAndGroupFiles = async (files) => {
  const groups = {};

  for (const file of files) {
    const data = await readFileAsArrayBuffer(file);
    const wb = XLSX.read(data, { type: 'array' });

    // 構成シートからメタ情報を取得
    const koseiSheet = wb.Sheets['構成'];
    const naiyouSheet = wb.Sheets['内容'];
    if (!koseiSheet) continue;

    const koseiData = XLSX.utils.sheet_to_json(koseiSheet, { header: 1 });
    const koseiHeader = koseiData[0] || [];
    const koseiRows = koseiData.slice(1).filter(r => r.length > 0);

    const naiyouData = naiyouSheet ? XLSX.utils.sheet_to_json(naiyouSheet, { header: 1 }) : [];
    const naiyouHeader = naiyouData[0] || [];
    const naiyouRows = naiyouData.slice(1).filter(r => r.length > 0);

    // メタ情報を1行目のデータから取得
    const firstRow = koseiRows[0] || [];
    const colIdx = (name) => koseiHeader.indexOf(name);
    const 年度 = String(firstRow[colIdx('年度')] ?? '').trim();
    const 学校名 = String(firstRow[colIdx('学校名')] ?? '').trim();
    const 回数 = String(firstRow[colIdx('回数')] ?? '').trim();
    const 科目 = String(firstRow[colIdx('科目')] ?? '').trim();

    const key = `${年度}_${学校名}_${回数}_${科目}`;

    if (!groups[key]) {
      groups[key] = {
        key,
        年度, 学校名, 回数, 科目,
        label: `${学校名} ${科目} 第${回数}回 (${年度})`,
        files: [],
        koseiHeader,
        naiyouHeader,
        koseiRows: [],
        naiyouRows: [],
      };
    }

    groups[key].files.push(file.name);
    groups[key].koseiRows.push(...koseiRows);
    groups[key].naiyouRows.push(...naiyouRows);

    // ヘッダーを最も長いものに更新（内容シートの動的カラム対応）
    if (naiyouHeader.length > groups[key].naiyouHeader.length) {
      groups[key].naiyouHeader = naiyouHeader;
    }
    if (koseiHeader.length > groups[key].koseiHeader.length) {
      groups[key].koseiHeader = koseiHeader;
    }
  }

  // 各グループ内で大問番号順にソート
  for (const g of Object.values(groups)) {
    const daimonColKosei = g.koseiHeader.indexOf('大問');
    const daimonColNaiyou = g.naiyouHeader.indexOf('大問名');

    if (daimonColKosei >= 0) {
      g.koseiRows.sort((a, b) => parseDaimonNum(a[daimonColKosei]) - parseDaimonNum(b[daimonColKosei]));
    }
    if (daimonColNaiyou >= 0) {
      g.naiyouRows.sort((a, b) => parseDaimonNum(a[daimonColNaiyou]) - parseDaimonNum(b[daimonColNaiyou]));
    }
  }

  return Object.values(groups);
};

/** 大問番号を数値に変換（全角/半角対応） */
const parseDaimonNum = (v) => {
  if (v == null) return 999;
  const s = String(v).replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  const n = parseInt(s, 10);
  return isNaN(n) ? 999 : n;
};

/** FileをArrayBufferとして読み込む */
const readFileAsArrayBuffer = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

/**
 * グループの統合Excelをダウンロード
 * @param {Object} group - parseAndGroupFilesの返すグループオブジェクト
 */
export const downloadMergedExcel = (group) => {
  const wb = XLSX.utils.book_new();

  // 構成シート
  const koseiWs = XLSX.utils.aoa_to_sheet([group.koseiHeader, ...group.koseiRows]);
  koseiWs['!cols'] = group.koseiHeader.map(() => ({ wch: 16 }));
  XLSX.utils.book_append_sheet(wb, koseiWs, '構成');

  // 内容シート
  const naiyouWs = XLSX.utils.aoa_to_sheet([group.naiyouHeader, ...group.naiyouRows]);
  naiyouWs['!cols'] = group.naiyouHeader.map((h, i) => ({
    wch: i < 3 ? 8 : i === 3 ? 30 : (h || '').includes('解説') ? 40 : 16,
  }));
  XLSX.utils.book_append_sheet(wb, naiyouWs, '内容');

  // ファイル名
  const filename = `${group.年度}_${group.学校名}_${group.科目}_第${group.回数}回_統合.xlsx`;

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
