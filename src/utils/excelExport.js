/**
 * Excel (.xlsx) 書き出しユーティリティ
 * xlsx-js-style を使用（セルスタイル対応）
 */
import XLSX from 'xlsx-js-style';

// ===== 理科用テキスト変換ユーティリティ =====

const HALF_TO_FULL_DIGITS = { '0': '０', '1': '１', '2': '２', '3': '３', '4': '４', '5': '５', '6': '６', '7': '７', '8': '８', '9': '９' };

/** 半角数字→全角数字に変換 */
const toFullWidthDigits = (str) => String(str).replace(/[0-9]/g, c => HALF_TO_FULL_DIGITS[c]);

/** 全角数字→半角数字に変換 */
const toHalfWidthDigits = (str) => String(str).replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));

/** 半角かっこ→全角かっこに変換 */
const toFullWidthParens = (str) => String(str).replace(/\(/g, '（').replace(/\)/g, '）');

/** 全角かっこ→半角かっこに変換 */
const toHalfWidthParens = (str) => String(str).replace(/（/g, '(').replace(/）/g, ')');

/** 句読点を正規化: , → 、  . → 。（ただし小数点は除く） */
const normalizePunctuation = (str) => {
  let result = String(str);
  // カンマ+スペース → 読点
  result = result.replace(/,\s*/g, '、');
  // 文末や文字の後のピリオド → 句点（ただし数字.数字の小数点は除く）
  result = result.replace(/(?<![0-9])\.(?!\d)/g, '。');
  return result;
};

/** 日本語文字が含まれるか判定 */
const hasJapanese = (str) => /[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uFF00-\uFFEF]/.test(String(str));

/**
 * 理科用: セル値のテキスト変換
 * @param {string} value - セル値
 * @param {string} colName - カラム名
 * @returns {string} 変換後の値
 */
const applyRikaTextRules = (value, colName) => {
  if (value === '' || value == null) return '';
  let v = String(value);

  // 年度・回数・大問番号は全角数字
  if (['年度', '回数', '大問', '大問名', '大問ごとの満点'].includes(colName)) {
    if (['年度', '回数', '大問', '大問名'].includes(colName)) {
      v = toFullWidthDigits(v);
    }
  }

  // 設問名（小問名・枝問）のかっこは半角
  if (['小問名', '枝問'].includes(colName)) {
    v = toHalfWidthParens(v);
    // 設問名の数字は半角のまま
  } else {
    // それ以外のかっこは全角
    v = toFullWidthParens(v);
  }

  // 句読点の正規化
  v = normalizePunctuation(v);

  return v;
};

/**
 * 理科用: セルにフォントスタイルを適用
 * 日本語 → UD Digi Kyokasho N、それ以外 → Times New Roman
 */
const getRikaCellStyle = (value, isHeader = false) => {
  const v = String(value ?? '');
  const fontName = hasJapanese(v) ? 'UD デジタル 教科書体 N-R' : 'Times New Roman';
  const style = {
    font: {
      name: fontName,
      sz: isHeader ? 11 : 10,
      bold: isHeader,
    },
  };
  if (isHeader) {
    style.fill = { fgColor: { rgb: 'E8E8E8' } };
    style.alignment = { horizontal: 'center' };
  }
  return style;
};

/**
 * ワークシートに理科スタイルを適用
 */
const applyRikaStyles = (ws, headers) => {
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (!cell) continue;
      const isHeader = r === 0;
      const colName = headers[c] || '';

      // テキスト変換（ヘッダー以外）
      if (!isHeader && cell.v != null) {
        cell.v = applyRikaTextRules(cell.v, colName);
        if (cell.w) cell.w = cell.v;
      }

      // スタイル適用
      cell.s = getRikaCellStyle(cell.v, isHeader);
    }
  }
};

/**
 * examInput データから .xlsx ファイルを生成してダウンロード
 */
export const downloadExamExcel = (examInput) => {
  const { 年度, 学校名, 回数, 科目, 試験時間, 大問リスト = [] } = examInput;
  const isRika = 科目 === '理科';

  // ===== 科目別の構成シートヘッダー・行データ =====
  let koseiHeader, koseiRowFn;

  if (科目 === '算数') {
    koseiHeader = ['年度', '学校名', '回数', '科目', '大問', '大問ごとの満点', '試験時間'];
    koseiRowFn = (d) => [年度 ?? '', 学校名 ?? '', 回数 ?? '', 科目, d.大問番号 ?? '', d.満点 ?? '', 試験時間 ?? ''];
  } else if (科目 === '国語') {
    koseiHeader = ['年度', '学校名', '回数', '科目', '大問', '大問ごとの満点', '文種', '出典', '著者'];
    koseiRowFn = (d) => [年度 ?? '', 学校名 ?? '', 回数 ?? '', 科目, d.大問番号 ?? '', d.満点 ?? '', d.文種 ?? '', d.出典 ?? '', d.著者 ?? ''];
  } else if (科目 === '社会') {
    koseiHeader = ['年度', '学校名', '回数', '科目', '大問', '大問ごとの満点'];
    koseiRowFn = (d) => [年度 ?? '', 学校名 ?? '', 回数 ?? '', 科目, d.大問番号 ?? '', d.満点 ?? ''];
  } else if (科目 === '理科') {
    koseiHeader = ['年度', '学校名', '回数', '科目', '大問', '大問ごとの満点', 'テーマ', '試験時間'];
    koseiRowFn = (d) => [年度 ?? '', 学校名 ?? '', 回数 ?? '', 科目, d.大問番号 ?? '', d.満点 ?? '', d.テーマ ?? '', 試験時間 ?? ''];
  } else {
    koseiHeader = ['年度', '学校名', '回数', '科目', '大問', '大問ごとの満点'];
    koseiRowFn = (d) => [年度 ?? '', 学校名 ?? '', 回数 ?? '', 科目 ?? '', d.大問番号 ?? '', d.満点 ?? ''];
  }
  const koseiRows = 大問リスト.map(koseiRowFn);

  // ===== 科目別の内容シート =====
  let naiyouHeader, naiyouRowFn;

  if (科目 === '算数') {
    naiyouHeader = ['大問名', '小問名', '枝問', '模範解答', '配点', '解答_画像', '解説', '解説_画像', '完答・順不同・別解'];
    naiyouRowFn = (daimon, mon, eda) => {
      const flags = [eda.完答 && '完答', eda.順不同 && '順不同', eda.別解].filter(Boolean).join('・');
      return [daimon.大問番号 ?? '', mon.小問名 ?? '', eda.枝問名 ?? '', eda.模範解答 ?? '', eda.配点 ?? '',
        eda.解答画像 ?? '', eda.解説 ?? '', eda.解説画像 ?? '', flags];
    };
  } else if (科目 === '国語') {
    let maxKijun = 0, maxFuki = 0;
    for (const d of 大問リスト) {
      for (const m of (d.問リスト ?? [])) {
        for (const e of (m.枝問リスト ?? [])) {
          const c = e.採点基準 ?? [];
          if (c.length > maxKijun) maxKijun = c.length;
          for (const k of c) { if ((k.付記 ?? []).length > maxFuki) maxFuki = (k.付記 ?? []).length; }
        }
      }
    }
    const kijunHeaders = [];
    for (let ki = 1; ki <= maxKijun; ki++) {
      kijunHeaders.push(`採点基準（項目${ki}）`);
      for (let fi = 1; fi <= maxFuki; fi++) kijunHeaders.push(`採点基準（付記${ki}-${fi}）`);
    }
    naiyouHeader = ['大問名', '小問名', '枝問', '模範解答', '配点', '完答', '解説', ...kijunHeaders];
    naiyouRowFn = (daimon, mon, eda) => {
      const row = [daimon.大問番号 ?? '', mon.小問名 ?? '', eda.枝問名 ?? '', eda.模範解答 ?? '', eda.配点 ?? '',
        eda.完答 ? '完答' : '', eda.解説 ?? ''];
      for (let ki = 0; ki < maxKijun; ki++) {
        const kijun = (eda.採点基準 ?? [])[ki];
        row.push(kijun ? (kijun.項目 ?? '') : '');
        for (let fi = 0; fi < maxFuki; fi++) row.push(kijun ? ((kijun.付記 ?? [])[fi] ?? '') : '');
      }
      return row;
    };
  } else if (科目 === '社会') {
    naiyouHeader = ['大問名', '小問名', '枝問', '模範解答', '配点', '完答・順不同', '条件指定', '別解', '不可解答', '解説'];
    naiyouRowFn = (daimon, mon, eda) => {
      const flags = [eda.完答 && '完答', eda.順不同 && '順不同'].filter(Boolean).join('・');
      return [daimon.大問番号 ?? '', mon.小問名 ?? '', eda.枝問名 ?? '', eda.模範解答 ?? '', eda.配点 ?? '',
        flags, eda.条件指定 ?? '', eda.別解 ?? '', eda.不可解答 ?? '', eda.解説 ?? ''];
    };
  } else if (科目 === '理科') {
    naiyouHeader = ['大問名', '小問名', '枝問', '模範解答', '配点', '完答・順不同', '条件指定・要素', '採点基準', '解説'];
    naiyouRowFn = (daimon, mon, eda) => {
      const flags = [eda.完答 && '完答', eda.順不同 && '順不同'].filter(Boolean).join('・');
      return [daimon.大問番号 ?? '', mon.小問名 ?? '', eda.枝問名 ?? '', eda.模範解答 ?? '', eda.配点 ?? '',
        flags, eda.条件指定要素 ?? '', eda.採点基準テキスト ?? '', eda.解説 ?? ''];
    };
  } else {
    naiyouHeader = ['大問名', '小問名', '枝問', '模範解答', '配点', '解説'];
    naiyouRowFn = (daimon, mon, eda) => [daimon.大問番号 ?? '', mon.小問名 ?? '', eda.枝問名 ?? '', eda.模範解答 ?? '', eda.配点 ?? '', eda.解説 ?? ''];
  }

  // 3段階をフラット展開
  const naiyouRows = [];
  for (const daimon of 大問リスト) {
    for (const mon of (daimon.問リスト ?? [])) {
      for (const eda of (mon.枝問リスト ?? [])) {
        naiyouRows.push(naiyouRowFn(daimon, mon, eda));
      }
    }
  }

  // ワークブック作成
  const wb = XLSX.utils.book_new();

  const koseiWs = XLSX.utils.aoa_to_sheet([koseiHeader, ...koseiRows]);
  koseiWs['!cols'] = koseiHeader.map(() => ({ wch: 16 }));
  if (isRika) applyRikaStyles(koseiWs, koseiHeader);
  XLSX.utils.book_append_sheet(wb, koseiWs, '構成');

  const naiyouWs = XLSX.utils.aoa_to_sheet([naiyouHeader, ...naiyouRows]);
  naiyouWs['!cols'] = naiyouHeader.map((h, i) => ({
    wch: i < 3 ? 8 : i === 3 ? 30 : h.includes('解説') ? 40 : 16,
  }));
  if (isRika) applyRikaStyles(naiyouWs, naiyouHeader);
  XLSX.utils.book_append_sheet(wb, naiyouWs, '内容');

  // ファイル名生成
  const label = [学校名, 科目, 回数 ? `第${回数}回` : ''].filter(Boolean).join('_');
  const filename = `${年度 ?? ''}${label ? `_${label}` : ''}_input.xlsx`;

  // ダウンロード
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

/**
 * 工数履歴を Excel (.xlsx) ファイルとしてダウンロード
 */
export const downloadHistoryExcel = (capacityData, assignmentData, dateRange) => {
  const wb = XLSX.utils.book_new();

  const capHeaders = ['作業者名', '作業者ID', '開始日', '終了日', '日あたり工数', '合計工数', '備考'];
  const capRows = capacityData.map(c => [
    c.userName, c.userLoginId, c.startDate, c.endDate, c.hoursPerDay, c.totalHours, c.note || ''
  ]);
  const capWs = XLSX.utils.aoa_to_sheet([capHeaders, ...capRows]);
  capWs['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, capWs, '工数登録');

  const asnHeaders = ['タスク名', '科目', '業務種別', '担当者', '担当者ID', '割当工数', '実績工数', 'ステータス', '割当日', '提出日'];
  const asnRows = assignmentData.map(a => [
    a.taskName, a.subject, a.workType || '', a.correctorName, a.correctorLoginId,
    a.assignedHours, a.actualHours || '', a.status, a.assignedAt || '', a.submittedAt || ''
  ]);
  const asnWs = XLSX.utils.aoa_to_sheet([asnHeaders, ...asnRows]);
  asnWs['!cols'] = asnHeaders.map(() => ({ wch: 14 }));
  XLSX.utils.book_append_sheet(wb, asnWs, '作業実績');

  const filename = `工数履歴_${dateRange || '全期間'}.xlsx`;
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
