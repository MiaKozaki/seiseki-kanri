/**
 * filePreview.js — ファイルプレビュー（Excel / Word）
 */

import * as XLSX from 'xlsx';

/**
 * Excel ファイルを HTML テーブルに変換
 */
export const previewExcel = async (blob) => {
  const arrayBuffer = await blob.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetNames = workbook.SheetNames;

  const sheets = sheetNames.map(name => {
    const sheet = workbook.Sheets[name];
    const html = XLSX.utils.sheet_to_html(sheet, { id: `sheet-${name}`, editable: false });
    return { name, html };
  });

  return { sheets, error: null };
};

/**
 * Word (.docx) ファイルを HTML に変換
 */
export const previewWord = async (blob) => {
  try {
    const mammoth = await import('mammoth');
    const arrayBuffer = await blob.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer });
    return { html: result.value, error: null };
  } catch (err) {
    return { html: null, error: `Word プレビューエラー: ${err.message}` };
  }
};

/**
 * ファイル名に応じてプレビューを生成
 */
export const getPreviewHtml = async (blob, fileName) => {
  const ext = fileName.split('.').pop().toLowerCase();

  if (['xlsx', 'xls'].includes(ext)) {
    try {
      const result = await previewExcel(blob);
      // 最初のシートの HTML を返す（複数シートは sheets で参照可能）
      return { html: result.sheets[0]?.html || '', sheets: result.sheets, error: null };
    } catch (err) {
      return { html: null, sheets: null, error: `Excel プレビューエラー: ${err.message}` };
    }
  }

  if (['docx', 'doc'].includes(ext)) {
    const result = await previewWord(blob);
    return { html: result.html, sheets: null, error: result.error };
  }

  return { html: null, sheets: null, error: `プレビュー非対応のファイル形式です: .${ext}` };
};
