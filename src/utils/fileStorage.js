/**
 * fileStorage.js — IndexedDBを使ったファイル添付ストレージ
 *
 * localStorageの容量制限を回避するため、ファイルBlobはIndexedDBに保存し、
 * メタデータのみassignmentオブジェクトに持たせる。
 */

import { generateId } from './storage.js';

// ---- 定数 ----
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_FILES_PER_SUBMISSION = 10;
export const ALLOWED_EXTENSIONS = ['.xlsx', '.xls'];

const DB_NAME = 'seiseki_kanri_files';
const DB_VERSION = 1;
const STORE_NAME = 'attachments';

// ---- DB接続 ----
let dbInstance = null;

const openDB = () => {
  if (dbInstance) return Promise.resolve(dbInstance);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('assignmentId', 'assignmentId', { unique: false });
      }
    };
    request.onsuccess = (e) => {
      dbInstance = e.target.result;
      // DB接続が切れたらリセット
      dbInstance.onclose = () => { dbInstance = null; };
      resolve(dbInstance);
    };
    request.onerror = (e) => {
      console.error('IndexedDB open error:', e.target.error);
      reject(e.target.error);
    };
  });
};

// ---- バリデーション ----
export const validateFile = (file) => {
  const errors = [];
  if (file.size > MAX_FILE_SIZE) {
    errors.push(`${file.name}: ファイルサイズが5MBを超えています（${(file.size / 1024 / 1024).toFixed(1)}MB）`);
  }
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    errors.push(`${file.name}: Excelファイル（.xlsx, .xls）のみ添付可能です`);
  }
  return errors;
};

// ---- CRUD ----

/** ファイルをIndexedDBに保存し、メタデータを返す */
export const saveAttachment = async ({ assignmentId, fileName, fileSize, fileType, blob }) => {
  const db = await openDB();
  const id = generateId();
  const record = {
    id,
    assignmentId,
    fileName,
    fileSize,
    fileType,
    blob,
    createdAt: new Date().toISOString(),
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve({
      id,
      fileName,
      fileSize,
      fileType,
      createdAt: record.createdAt,
    });
    tx.onerror = (e) => reject(e.target.error);
  });
};

/** IDでファイルを1件取得（blob含む） */
export const getAttachment = async (id) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = (e) => reject(e.target.error);
  });
};

/** assignmentIdでファイル全件取得 */
export const getAttachmentsByAssignment = async (assignmentId) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const index = tx.objectStore(STORE_NAME).index('assignmentId');
    const req = index.getAll(assignmentId);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = (e) => reject(e.target.error);
  });
};

/** 1件削除 */
export const deleteAttachment = async (id) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
};

/** assignment配下の全添付ファイルを削除 */
export const deleteAttachmentsByAssignment = async (assignmentId) => {
  const records = await getAttachmentsByAssignment(assignmentId);
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const rec of records) {
      store.delete(rec.id);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
};

/** ファイルをダウンロード */
export const downloadAttachment = async (attachmentId, fallbackFileName) => {
  try {
    const record = await getAttachment(attachmentId);
    if (!record || !record.blob) {
      alert('ファイルが見つかりません。ブラウザのデータが削除された可能性があります。');
      return false;
    }
    const url = URL.createObjectURL(record.blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = record.fileName || fallbackFileName || 'download.xlsx';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    console.error('Download error:', err);
    alert('ファイルのダウンロードに失敗しました。');
    return false;
  }
};
