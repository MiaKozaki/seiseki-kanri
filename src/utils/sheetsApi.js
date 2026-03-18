/**
 * Google Sheets API ユーティリティ（ブラウザ側 OAuth2 - バックエンド不要）
 *
 * 必要な設定:
 *   1. Google Cloud Console でプロジェクト作成
 *   2. Google Sheets API を有効化
 *   3. OAuth 2.0 クライアント ID（ウェブアプリ）を作成
 *      - 承認済みの JavaScript 生成元に http://localhost:5173 を追加
 *   4. クライアント ID をアプリ内の設定画面で入力
 */

const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const SHEET_NAME = 'seiseki_data';

let tokenClient = null;
let accessToken = null;
let tokenExpiresAt = 0;

/** Google Identity Services で OAuth クライアントを初期化 */
export const initGoogleAuth = (clientId, onSignIn) => {
  if (!window.google?.accounts?.oauth2) {
    throw new Error('Google Identity Services がまだ読み込まれていません');
  }
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: (resp) => {
      if (resp.error) {
        console.error('Google auth error:', resp);
        return;
      }
      accessToken = resp.access_token;
      tokenExpiresAt = Date.now() + resp.expires_in * 1000;
      onSignIn?.();
    },
  });
};

/** サインイン（ポップアップ表示） */
export const requestToken = () => {
  if (!tokenClient) throw new Error('Google Auth が初期化されていません');
  tokenClient.requestAccessToken({ prompt: 'consent' });
};

/** サインイン済みかどうか（トークン有効期限も確認） */
export const isSignedIn = () => !!accessToken && Date.now() < tokenExpiresAt;

/** サインアウト */
export const revokeToken = () => {
  if (accessToken) window.google?.accounts?.oauth2?.revoke(accessToken);
  accessToken = null;
  tokenExpiresAt = 0;
};

const authHeaders = () => ({
  Authorization: `Bearer ${accessToken}`,
  'Content-Type': 'application/json',
});

/** 指定した名前のシートがなければ作成（汎用版） */
const ensureNamedSheet = async (spreadsheetId, sheetName) => {
  const res = await fetch(
    `${SHEETS_API}/${spreadsheetId}?fields=sheets.properties.title`,
    { headers: authHeaders() }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message ?? `Sheets API エラー: ${res.status}`);
  }
  const meta = await res.json();
  const exists = meta.sheets?.some(s => s.properties.title === sheetName);
  if (!exists) {
    await fetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title: sheetName } } }],
      }),
    });
  }
};

/** スプレッドシートに "seiseki_data" シートがなければ作成 */
const ensureSheet = async (spreadsheetId) => {
  const res = await fetch(
    `${SHEETS_API}/${spreadsheetId}?fields=sheets.properties.title`,
    { headers: authHeaders() }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message ?? `Sheets API エラー: ${res.status}`);
  }
  const meta = await res.json();
  const exists = meta.sheets?.some(s => s.properties.title === SHEET_NAME);
  if (!exists) {
    await fetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title: SHEET_NAME } } }],
      }),
    });
  }
};

/**
 * スプレッドシートから全データを読み込む
 * シート構造: A列 = キー名, B列 = JSON文字列
 * @returns {Object} データオブジェクト
 */
export const readSheetData = async (spreadsheetId) => {
  await ensureSheet(spreadsheetId);
  const res = await fetch(
    `${SHEETS_API}/${spreadsheetId}/values/${SHEET_NAME}!A:B`,
    { headers: authHeaders() }
  );
  if (!res.ok) throw new Error(`読み込みエラー: ${res.status}`);
  const body = await res.json();
  const rows = body.values ?? [];
  const data = {};
  for (const [key, val] of rows) {
    if (key && val) {
      try { data[key] = JSON.parse(val); } catch { /* スキップ */ }
    }
  }
  return data;
};

/**
 * 試験種の構成・内容データを Google Sheets に書き込む
 * "構成" シートと "内容" シートを作成/上書きする
 * @param {string} spreadsheetId
 * @param {Object} examInput - examInput オブジェクト
 */
export const writeExamSheets = async (spreadsheetId, examInput) => {
  // 両シートを確保
  await ensureNamedSheet(spreadsheetId, '構成');
  await ensureNamedSheet(spreadsheetId, '内容');

  const { 年度, 学校名, 回数, 科目, 試験時間, 大問リスト = [] } = examInput;
  const isKokugo = 科目 === '国語';

  // ===== 構成シート =====
  const kosei_header = ['年度', '学校名', '回数', '科目', '大問', '大問ごとの満点', '試験時間', '文種', '出典', '著者'];
  const kosei_rows = 大問リスト.map(d => [
    年度 ?? '', 学校名 ?? '', 回数 ?? '', 科目 ?? '',
    d.大問番号 ?? '', d.満点 ?? '', 試験時間 ?? '',
    isKokugo ? (d.文種 ?? '') : '',
    isKokugo ? (d.出典 ?? '') : '',
    isKokugo ? (d.著者 ?? '') : '',
  ]);

  // クリアして書き込み
  await fetch(`${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent('構成')}!A:Z:clear`,
    { method: 'POST', headers: authHeaders() });
  if (kosei_rows.length > 0) {
    await fetch(
      `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent('構成')}!A1?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ values: [kosei_header, ...kosei_rows] }),
      }
    );
  }

  // ===== 内容シート（大問 → 問 → 枝問 の3段階フラット化）=====
  // 採点基準・付記の最大数を全枝問から算出
  let maxKijun = 0;
  let maxFuki = 0;
  for (const daimon of 大問リスト) {
    for (const mon of (daimon.問リスト ?? [])) {
      for (const eda of (mon.枝問リスト ?? [])) {
        const criteria = eda.採点基準 ?? [];
        if (criteria.length > maxKijun) maxKijun = criteria.length;
        for (const k of criteria) {
          if ((k.付記 ?? []).length > maxFuki) maxFuki = (k.付記 ?? []).length;
        }
      }
    }
  }

  // 動的ヘッダー生成
  const naiyou_fixed = ['大問', '問', '枝問', '模範解答', '配点', '完答', '順不同', '別解', '解説', '解説画像'];
  const kijun_headers = [];
  for (let ki = 1; ki <= maxKijun; ki++) {
    kijun_headers.push(`採点基準（項目${ki}）`);
    for (let fi = 1; fi <= maxFuki; fi++) {
      kijun_headers.push(`採点基準（付記${ki}-${fi}）`);
    }
  }
  const naiyou_header = [...naiyou_fixed, ...kijun_headers];

  // 3段階をフラットな行に展開
  const naiyou_rows = [];
  for (const daimon of 大問リスト) {
    for (const mon of (daimon.問リスト ?? [])) {
      for (const eda of (mon.枝問リスト ?? [])) {
        const row = [
          daimon.大問番号 ?? '',
          mon.小問名 ?? '',
          eda.枝問名 ?? '',
          eda.模範解答 ?? '',
          eda.配点 ?? '',
          eda.完答 ? '完答' : '',
          eda.順不同 ? '順不同' : '',
          eda.別解 ?? '',
          eda.解説 ?? '',
          eda.解説画像 ?? '',
        ];
        for (let ki = 0; ki < maxKijun; ki++) {
          const kijun = (eda.採点基準 ?? [])[ki];
          row.push(kijun ? (kijun.項目 ?? '') : '');
          for (let fi = 0; fi < maxFuki; fi++) {
            row.push(kijun ? ((kijun.付記 ?? [])[fi] ?? '') : '');
          }
        }
        naiyou_rows.push(row);
      }
    }
  }

  await fetch(`${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent('内容')}!A:ZZ:clear`,
    { method: 'POST', headers: authHeaders() });
  if (naiyou_rows.length > 0) {
    await fetch(
      `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent('内容')}!A1?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ values: [naiyou_header, ...naiyou_rows] }),
      }
    );
  }
};

/**
 * 全データをスプレッドシートに書き込む（上書き）
 * @param {string} spreadsheetId
 * @param {Object} data - getAll() の返り値
 */
export const writeSheetData = async (spreadsheetId, data) => {
  await ensureSheet(spreadsheetId);
  // まずクリア
  await fetch(
    `${SHEETS_API}/${spreadsheetId}/values/${SHEET_NAME}!A:B:clear`,
    { method: 'POST', headers: authHeaders() }
  );
  const values = Object.entries(data).map(([k, v]) => [k, JSON.stringify(v)]);
  if (values.length === 0) return;
  await fetch(
    `${SHEETS_API}/${spreadsheetId}/values/${SHEET_NAME}!A1?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ values }),
    }
  );
};
