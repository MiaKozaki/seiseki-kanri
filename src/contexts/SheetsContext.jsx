import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  initGoogleAuth, requestToken, isSignedIn, revokeToken,
  readSheetData, writeSheetData,
} from '../utils/sheetsApi.js';
import { getAll, saveAll } from '../utils/storage.js';

const SheetsContext = createContext(null);
export const useSheetsSync = () => useContext(SheetsContext);

const SETTINGS_KEY = 'sheets_settings';
const AUTO_SYNC_INTERVAL = 60_000; // 60秒

const loadSettings = () => {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null') ?? { clientId: '', spreadsheetId: '' }; }
  catch { return { clientId: '', spreadsheetId: '' }; }
};

export function SheetsProvider({ children }) {
  const [settings, setSettings] = useState(loadSettings);
  const [gisReady, setGisReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | syncing | success | error
  const [lastSync, setLastSync] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const syncTimer = useRef(null);
  const authInitialized = useRef(false);

  // GIS ライブラリの読み込みを待つ
  useEffect(() => {
    const check = () => {
      if (window.google?.accounts?.oauth2) setGisReady(true);
      else setTimeout(check, 300);
    };
    check();
  }, []);

  // clientId が設定されたら Auth を初期化（1回だけ）
  useEffect(() => {
    if (!gisReady || !settings.clientId || authInitialized.current) return;
    try {
      initGoogleAuth(settings.clientId, () => {
        setSignedIn(true);
        setErrorMsg('');
      });
      authInitialized.current = true;
    } catch (e) {
      setErrorMsg(e.message);
    }
  }, [gisReady, settings.clientId]);

  const saveSettings = useCallback((next) => {
    setSettings(next);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    // clientId が変わったら再初期化を許可
    if (next.clientId !== settings.clientId) authInitialized.current = false;
  }, [settings.clientId]);

  const handleSignIn = () => {
    if (!settings.clientId) { setErrorMsg('Client ID を入力してください'); return; }
    if (!gisReady) { setErrorMsg('Google ライブラリ読み込み中です。少し待って再試行してください'); return; }
    setErrorMsg('');
    // clientId が未初期化の場合は今初期化する
    if (!authInitialized.current) {
      try {
        initGoogleAuth(settings.clientId, () => { setSignedIn(true); setErrorMsg(''); });
        authInitialized.current = true;
      } catch (e) { setErrorMsg(e.message); return; }
    }
    try { requestToken(); } catch (e) { setErrorMsg(e.message); }
  };

  const handleSignOut = () => {
    revokeToken();
    setSignedIn(false);
    setStatus('idle');
    clearAutoSync();
  };

  /** ローカルデータ → Sheets にアップロード */
  const upload = useCallback(async () => {
    if (!isSignedIn() || !settings.spreadsheetId) return;
    setStatus('syncing');
    setErrorMsg('');
    try {
      await writeSheetData(settings.spreadsheetId, getAll());
      setLastSync(new Date());
      setStatus('success');
    } catch (e) {
      setStatus('error');
      setErrorMsg(e.message);
    }
  }, [settings.spreadsheetId]);

  /** Sheets → ローカルデータをダウンロードして反映（ページリロードで確実に反映） */
  const download = useCallback(async () => {
    if (!isSignedIn() || !settings.spreadsheetId) return;
    setStatus('syncing');
    setErrorMsg('');
    try {
      const data = await readSheetData(settings.spreadsheetId);
      if (Object.keys(data).length > 0) {
        saveAll(data);
        setLastSync(new Date());
        setStatus('success');
        // DataContext をリセットするためリロード
        setTimeout(() => window.location.reload(), 600);
      } else {
        setStatus('idle');
        setErrorMsg('スプレッドシートにデータがまだありません');
      }
    } catch (e) {
      setStatus('error');
      setErrorMsg(e.message);
    }
  }, [settings.spreadsheetId]);

  // 自動同期（アップロードのみ）
  const clearAutoSync = () => {
    if (syncTimer.current) { clearInterval(syncTimer.current); syncTimer.current = null; }
  };

  useEffect(() => {
    clearAutoSync();
    if (signedIn && settings.spreadsheetId) {
      syncTimer.current = setInterval(upload, AUTO_SYNC_INTERVAL);
    }
    return clearAutoSync;
  }, [signedIn, settings.spreadsheetId, upload]);

  const fmtTime = (d) => d ? d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : null;

  return (
    <SheetsContext.Provider value={{
      settings, saveSettings,
      gisReady, signedIn,
      status, lastSync: fmtTime(lastSync), errorMsg,
      handleSignIn, handleSignOut,
      upload, download,
    }}>
      {children}
    </SheetsContext.Provider>
  );
}
