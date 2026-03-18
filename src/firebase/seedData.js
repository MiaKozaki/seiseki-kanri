import { INITIAL_DATA } from '../utils/storage';
import {
  saveMultipleDocuments, getMetaConfig, setMetaConfig, COLLECTIONS,
} from './firestoreService';

const SEED_VERSION = 'v1';

/**
 * Firestoreが空なら初期データを投入
 */
export const checkAndSeed = async (firestoreData) => {
  const meta = await getMetaConfig();
  if (meta?.seedVersion) return false; // シード済み

  const hasData = Object.values(firestoreData).some(arr => arr.length > 0);
  if (hasData) {
    await setMetaConfig({ seedVersion: SEED_VERSION, seededAt: new Date().toISOString() });
    return false;
  }

  // INITIAL_DATAをFirestoreに投入
  for (const key of COLLECTIONS) {
    const items = INITIAL_DATA[key];
    if (items && items.length > 0) {
      await saveMultipleDocuments(key, items);
    }
  }

  await setMetaConfig({ seedVersion: SEED_VERSION, seededAt: new Date().toISOString() });
  return true;
};

/**
 * localStorageの既存データをFirestoreに移行
 */
export const migrateFromLocalStorage = async (localData) => {
  for (const key of COLLECTIONS) {
    const items = localData[key];
    if (items && items.length > 0) {
      await saveMultipleDocuments(key, items);
    }
  }

  await setMetaConfig({
    seedVersion: SEED_VERSION,
    migratedAt: new Date().toISOString(),
    migratedFrom: 'localStorage',
  });
};
