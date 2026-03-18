import {
  collection, doc, getDocs, setDoc, deleteDoc, writeBatch,
} from 'firebase/firestore';
import { db } from './config';

// Firestoreで管理するコレクション一覧
const COLLECTIONS = [
  'users', 'schools', 'examTypes', 'capacities',
  'tasks', 'assignments', 'evaluationCriteria', 'evaluations',
  'examInputs', 'notifications', 'timeLogs', 'recruitments',
  'applications', 'rejectionCategories', 'rejectionSeverities', 'rejections',
  'verificationItems', 'verificationResults',
];

/**
 * 全コレクションを並列読み込み
 * @returns {Promise<Object>} { users: [...], tasks: [...], ... }
 */
export const fetchAllData = async () => {
  const results = await Promise.all(
    COLLECTIONS.map(async (name) => {
      const snap = await getDocs(collection(db, name));
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return [name, docs];
    })
  );
  return Object.fromEntries(results);
};

/**
 * ドキュメントを保存（upsert）
 */
export const saveDocument = async (collectionName, document) => {
  const { id, ...data } = document;
  await setDoc(doc(db, collectionName, id), data);
};

/**
 * ドキュメントを削除
 */
export const deleteDocument = async (collectionName, docId) => {
  await deleteDoc(doc(db, collectionName, docId));
};

/**
 * 複数ドキュメントを一括保存（batch write）
 */
export const saveMultipleDocuments = async (collectionName, documents) => {
  const batch = writeBatch(db);
  documents.forEach(document => {
    const { id, ...data } = document;
    batch.set(doc(db, collectionName, id), data);
  });
  await batch.commit();
};

/**
 * 複数ドキュメントを一括削除
 */
export const deleteMultipleDocuments = async (collectionName, docIds) => {
  const batch = writeBatch(db);
  docIds.forEach(id => {
    batch.delete(doc(db, collectionName, id));
  });
  await batch.commit();
};

/**
 * 複数コレクションにまたがるバッチ書き込み
 * @param {Array<{type: 'set'|'update'|'delete', collection: string, id: string, data?: Object}>} operations
 */
export const batchWrite = async (operations) => {
  const batch = writeBatch(db);
  operations.forEach(op => {
    const ref = doc(db, op.collection, op.id);
    if (op.type === 'set') {
      batch.set(ref, op.data || {});
    } else if (op.type === 'update') {
      batch.set(ref, op.data || {}, { merge: true });
    } else if (op.type === 'delete') {
      batch.delete(ref);
    }
  });
  await batch.commit();
};

/**
 * _meta/config ドキュメント取得
 */
export const getMetaConfig = async () => {
  const snap = await getDocs(collection(db, '_meta'));
  const configDoc = snap.docs.find(d => d.id === 'config');
  return configDoc ? configDoc.data() : null;
};

/**
 * _meta/config ドキュメント更新
 */
export const setMetaConfig = async (data) => {
  await setDoc(doc(db, '_meta', 'config'), data, { merge: true });
};

export { COLLECTIONS };
