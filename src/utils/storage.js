const STORAGE_KEY = 'seiseki_kanri_v1';

// btoa('password') = 'cGFzc3dvcmQ='
export const INITIAL_DATA = {
  users: [
    {
      id: 'u1', name: 'リーダー田中', email: 'leader@test.com', loginId: 'L001',
      password: 'cGFzc3dvcmQ=', role: 'leader', subjects: [],
      createdAt: '2025-01-01T00:00:00.000Z'
    },
    {
      id: 'u6', name: '佐藤リーダー', email: 'sato-leader@test.com', loginId: 'L002',
      password: 'cGFzc3dvcmQ=', role: 'leader', subjects: ['国語', '社会'],
      createdAt: '2025-01-01T00:00:00.000Z'
    },
    {
      id: 'u7', name: '鈴木リーダー', email: 'suzuki-leader@test.com', loginId: 'L003',
      password: 'cGFzc3dvcmQ=', role: 'leader', subjects: ['理科'],
      createdAt: '2025-01-01T00:00:00.000Z'
    },
    {
      id: 'u2', name: '山田 太郎', email: 'yamada@test.com', loginId: 'T001',
      password: 'cGFzc3dvcmQ=', role: 'corrector', subjects: ['国語', '算数'],
      employeeId: 'N00000001', createdAt: '2025-01-01T00:00:00.000Z'
    },
    {
      id: 'u3', name: '鈴木 花子', email: 'suzuki@test.com', loginId: 'T002',
      password: 'cGFzc3dvcmQ=', role: 'corrector', subjects: ['算数', '理科', '国語', '社会'],
      employeeId: 'N00000002', createdAt: '2025-01-01T00:00:00.000Z'
    },
    {
      id: 'u4', name: '佐藤 一郎', email: 'sato@test.com', loginId: 'T003',
      password: 'cGFzc3dvcmQ=', role: 'corrector', subjects: ['国語', '社会'],
      employeeId: 'N00000003', createdAt: '2025-01-01T00:00:00.000Z'
    },
    {
      id: 'u5', name: '田中 美咲', email: 'mtanaka@test.com', loginId: 'T004',
      password: 'cGFzc3dvcmQ=', role: 'corrector', subjects: ['理科', '社会', '国語'],
      employeeId: 'N00000004', createdAt: '2025-01-01T00:00:00.000Z'
    },
    // === デモ用追加添削者 (40名: u8-u47, T005-T044) ===
    { id: 'u8', name: '高橋 翔太', email: 'takahashi@test.com', loginId: 'T005', password: 'cGFzc3dvcmQ=', role: 'corrector', subjects: ['国語'], createdAt: '2025-01-01T00:00:00.000Z' },
    { id: 'u9', name: '伊藤 健一', email: 'ito@test.com', loginId: 'T006', password: 'cGFzc3dvcmQ=', role: 'corrector', subjects: ['算数', '理科'], createdAt: '2025-01-01T00:00:00.000Z' },
    { id: 'u10', name: '渡辺 大輔', email: 'watanabe@test.com', loginId: 'T007', password: 'cGFzc3dvcmQ=', role: 'corrector', subjects: ['理科', '社会', 'マクロ'], createdAt: '2025-01-01T00:00:00.000Z' },
    { id: 'u11', name: '中村 直美', email: 'nakamura@test.com', loginId: 'T008', password: 'cGFzc3dvcmQ=', role: 'corrector', subjects: ['社会'], createdAt: '2025-01-01T00:00:00.000Z' },
    { id: 'u12', name: '小林 恵子', email: 'kobayashi@test.com', loginId: 'T009', password: 'cGFzc3dvcmQ=', role: 'corrector', subjects: ['マクロ', '国語'], createdAt: '2025-01-01T00:00:00.000Z' },
    { id: 'u13', name: '加藤 裕子', email: 'kato@test.com', loginId: 'T010', password: 'cGFzc3dvcmQ=', role: 'corrector', subjects: ['国語', '算数', '理科'], createdAt: '2025-01-01T00:00:00.000Z' },
    { id: 'u14', name: '吉田 陽子', email: 'yoshida@test.com', loginId: 'T011', password: 'cGFzc3dvcmQ=', role: 'corrector', subjects: ['算数'], createdAt: '2025-01-01T00:00:00.000Z' },
    { id: 'u15', name: '松本 美紀', email: 'matsumoto@test.com', loginId: 'T012', password: 'cGFzc3dvcmQ=', role: 'corrector', subjects: ['理科', '社会'], createdAt: '2025-01-01T00:00:00.000Z' },
    { id: 'u16', name: '井上 拓也', email: 'inoue@test.com', loginId: 'T013', password: 'cGFzc3dvcmQ=', role: 'corrector', subjects: ['社会', 'マクロ', '国語'], createdAt: '2025-01-01T00:00:00.000Z' },
    { id: 'u17', name: '木村 和也', email: 'kimura@test.com', loginId: 'T014', password: 'cGFzc3dvcmQ=', role: 'corrector', subjects: ['マクロ'], createdAt: '2025-01-01T00:00:00.000Z' },
    { id: 'u18', name: '林 真一', email: 'hayashi@test.com', loginId: 'T015', password: 'cGFzc3dvcmQ=', role: 'corrector', subjects: ['国語', '算数'], createdAt: '2025-01-01T00:00:00.000Z' },
    { id: 'u19', name: '清水 智子', email: 'shimizu@test.com', loginId: 'T016', password: 'cGFzc3dvcmQ=', role: 'corrector', subjects: ['算数', '理科', '社会'], createdAt: '2025-01-01T00:00:00.000Z' },
    { id: 'u20', name: '山口 由美', email: 'yamaguchi@test.com', loginId: 'T017', password: 'cGFzc3dvcmQ=', role: 'corrector', subjects: ['理科'], createdAt: '2025-01-01T00:00:00.000Z' },
    { id: 'u21', name: '阿部 幸子', email: 'abe@test.com', loginId: 'T018', password: 'cGFzc3dvcmQ=', role: 'corrector', subjects: ['社会', 'マクロ'], createdAt: '2025-01-01T00:00:00.000Z' },
    { id: 'u22', name: '森 明美', email: 'mori@test.com', loginId: 'T019', password: 'cGFzc3dvcmQ=', role: 'corrector', subjects: ['マクロ', '国語', '算数'], createdAt: '2025-01-01T00:00:00.000Z' },
    { id: 'u23', name: '池田 洋子', email: 'ikeda@test.com', loginId: 'T020', password: 'cGFzc3dvcmQ=', role: 'corrector', subjects: ['国語'], createdAt: '2025-01-01T00:00:00.000Z' },
    { id: 'u24', name: '橋本 雄太', email: 'hashimoto@test.com', loginId: 'T021', password: 'cGFzc3dvcmQ=', role: 'corrector', subjects: ['算数', '理科'], createdAt: '2025-01-01T00:00:00.000Z' },
    { id: 'u25', name: '石川 誠', email: 'ishikawa@test.com', loginId: 'T022', password: 'cGFzc3dvcmQ=', role: 'corrector', subjects: ['理科', '社会', 'マクロ'], createdAt: '2025-01-01T00:00:00.000Z' },
    { id: 'u26', name: '前田 浩二', email: 'maeda@test.com', loginId: 'T023', password: 'cGFzc3dvcmQ=', role: 'corrector', subjects: ['社会'], createdAt: '2025-01-01T00:00:00.000Z' },
    { id: 'u27', name: '藤田 愛', email: 'fujita@test.com', loginId: 'T024', password: 'cGFzc3dvcmQ=', role: 'corrector', subjects: ['マクロ', '国語'], createdAt: '2025-01-01T00:00:00.000Z' },
    { id: 'u28', name: '小川 彩', email: 'ogawa@test.com', loginId: 'T025', password: 'cGFzc3dvcmQ=', role: 'corrector', subjects: ['国語', '算数', '理科'], createdAt: '2025-01-01T00:00:00.000Z' },
    { id: 'u29', name: '岡田 舞', email: 'okada@test.com', loginId: 'T026', password: 'cGFzc3dvcmQ=', role: 'corrector', subjects: ['算数'], createdAt: '2025-01-01T00:00:00.000Z' },
    { id: 'u30', name: '後藤 遥', email: 'goto@test.com', loginId: 'T027', password: 'cGFzc3dvcmQ=', role: 'corrector', subjects: ['理科', '社会'], createdAt: '2025-01-01T00:00:00.000Z' },
    { id: 'u31', name: '長谷川 萌', email: 'hasegawa@test.com', loginId: 'T028', password: 'cGFzc3dvcmQ=', role: 'corrector', subjects: ['社会', 'マクロ', '国語'], createdAt: '2025-01-01T00:00:00.000Z' },
    { id: 'u32', name: '村上 亮', email: 'murakami@test.com', loginId: 'T029', password: 'cGFzc3dvcmQ=', role: 'corrector', subjects: ['マクロ'], createdAt: '2025-01-01T00:00:00.000Z' },
    { id: 'u33', name: '近藤 駿', email: 'kondo@test.com', loginId: 'T030', password: 'cGFzc3dvcmQ=', role: 'corrector', subjects: ['国語', '算数'], createdAt: '2025-01-01T00:00:00.000Z' },
    { id: 'u34', name: '石井 蓮', email: 'ishii@test.com', loginId: 'T031', password: 'cGFzc3dvcmQ=', role: 'corrector', subjects: ['算数', '理科', '社会'], createdAt: '2025-01-01T00:00:00.000Z' },
    { id: 'u35', name: '斉藤 結衣', email: 'saito2@test.com', loginId: 'T032', password: 'cGFzc3dvcmQ=', role: 'corrector', subjects: ['理科'], createdAt: '2025-01-01T00:00:00.000Z' },
    { id: 'u36', name: '坂本 咲良', email: 'sakamoto@test.com', loginId: 'T033', password: 'cGFzc3dvcmQ=', role: 'corrector', subjects: ['社会', 'マクロ'], createdAt: '2025-01-01T00:00:00.000Z' },
    { id: 'u37', name: '遠藤 凛', email: 'endo@test.com', loginId: 'T034', password: 'cGFzc3dvcmQ=', role: 'corrector', subjects: ['マクロ', '国語', '算数'], createdAt: '2025-01-01T00:00:00.000Z' },
    { id: 'u38', name: '青木 悠真', email: 'aoki@test.com', loginId: 'T035', password: 'cGFzc3dvcmQ=', role: 'corrector', subjects: ['国語'], createdAt: '2025-01-01T00:00:00.000Z' },
    { id: 'u39', name: '藤井 颯太', email: 'fujii@test.com', loginId: 'T036', password: 'cGFzc3dvcmQ=', role: 'corrector', subjects: ['算数', '理科'], createdAt: '2025-01-01T00:00:00.000Z' },
    { id: 'u40', name: '西村 大翔', email: 'nishimura@test.com', loginId: 'T037', password: 'cGFzc3dvcmQ=', role: 'corrector', subjects: ['理科', '社会', 'マクロ'], createdAt: '2025-01-01T00:00:00.000Z' },
    { id: 'u41', name: '福田 陽菜', email: 'fukuda@test.com', loginId: 'T038', password: 'cGFzc3dvcmQ=', role: 'corrector', subjects: ['社会'], createdAt: '2025-01-01T00:00:00.000Z' },
    { id: 'u42', name: '太田 美月', email: 'ota@test.com', loginId: 'T039', password: 'cGFzc3dvcmQ=', role: 'corrector', subjects: ['マクロ', '国語'], createdAt: '2025-01-01T00:00:00.000Z' },
    { id: 'u43', name: '三浦 花音', email: 'miura@test.com', loginId: 'T040', password: 'cGFzc3dvcmQ=', role: 'corrector', subjects: ['国語', '算数', '理科'], createdAt: '2025-01-01T00:00:00.000Z' },
    { id: 'u44', name: '岡本 優花', email: 'okamoto@test.com', loginId: 'T041', password: 'cGFzc3dvcmQ=', role: 'corrector', subjects: ['算数'], createdAt: '2025-01-01T00:00:00.000Z' },
    { id: 'u45', name: '松田 涼太', email: 'matsuda@test.com', loginId: 'T042', password: 'cGFzc3dvcmQ=', role: 'corrector', subjects: ['理科', '社会'], createdAt: '2025-01-01T00:00:00.000Z' },
    { id: 'u46', name: '中川 蒼', email: 'nakagawa@test.com', loginId: 'T043', password: 'cGFzc3dvcmQ=', role: 'corrector', subjects: ['社会', 'マクロ', '国語'], createdAt: '2025-01-01T00:00:00.000Z' },
    { id: 'u47', name: '原田 楓', email: 'harada@test.com', loginId: 'T044', password: 'cGFzc3dvcmQ=', role: 'corrector', subjects: ['マクロ'], createdAt: '2025-01-01T00:00:00.000Z' },
  ],
  schools: [
    { id: 's1', name: '〇〇中学校' },
    { id: 's2', name: '△△中学校' },
    { id: 's3', name: '□□中学校' },
    // === デモ用追加学校 (12校: s4-s15) ===
    { id: 's4', name: '桜が丘中学校' },
    { id: 's5', name: '青山中学校' },
    { id: 's6', name: '城北中学校' },
    { id: 's7', name: '西園中学校' },
    { id: 's8', name: '東京学園' },
    { id: 's9', name: '大阪附属中' },
    { id: 's10', name: '名古屋中学校' },
    { id: 's11', name: '横浜中学校' },
    { id: 's12', name: '神戸中学校' },
    { id: 's13', name: '千葉中学校' },
    { id: 's14', name: '埼玉中学校' },
    { id: 's15', name: '広島中学校' },
  ],
  examTypes: [
    { id: 'et1', schoolId: 's1', subject: '国語' },
    { id: 'et2', schoolId: 's1', subject: '算数' },
    { id: 'et3', schoolId: 's2', subject: '理科' },
    { id: 'et4', schoolId: 's2', subject: '社会' },
    { id: 'et5', schoolId: 's3', subject: '国語' },
    { id: 'et6', schoolId: 's3', subject: '数学' },
  ],
  capacities: [
    { id: 'cap1', userId: 'u2', startDate: '2026-02-20', endDate: '2026-02-26', hoursPerDay: 6, totalHours: 42, note: '', createdAt: '2026-02-18T00:00:00.000Z' },
    { id: 'cap2', userId: 'u3', startDate: '2026-02-20', endDate: '2026-02-25', hoursPerDay: 4, totalHours: 24, note: '午後のみ', createdAt: '2026-02-18T00:00:00.000Z' },
    { id: 'cap3', userId: 'u4', startDate: '2026-02-21', endDate: '2026-02-27', hoursPerDay: 8, totalHours: 56, note: '', createdAt: '2026-02-18T00:00:00.000Z' },
    { id: 'cap4', userId: 'u5', startDate: '2026-02-22', endDate: '2026-02-28', hoursPerDay: 5, totalHours: 35, note: '', createdAt: '2026-02-18T00:00:00.000Z' },
    // === デモ用追加キャパシティ (20件: cap5-cap24) ===
    { id: 'cap5', userId: 'u8', startDate: '2026-03-10', endDate: '2026-03-15', hoursPerDay: 4, totalHours: 24, note: '午前のみ', createdAt: '2026-03-07T00:00:00.000Z' },
    { id: 'cap6', userId: 'u9', startDate: '2026-03-13', endDate: '2026-03-19', hoursPerDay: 5, totalHours: 35, note: '', createdAt: '2026-03-10T00:00:00.000Z' },
    { id: 'cap7', userId: 'u10', startDate: '2026-03-16', endDate: '2026-03-23', hoursPerDay: 6, totalHours: 48, note: '', createdAt: '2026-03-13T00:00:00.000Z' },
    { id: 'cap8', userId: 'u11', startDate: '2026-03-19', endDate: '2026-03-27', hoursPerDay: 7, totalHours: 63, note: '', createdAt: '2026-03-16T00:00:00.000Z' },
    { id: 'cap9', userId: 'u12', startDate: '2026-03-22', endDate: '2026-03-27', hoursPerDay: 8, totalHours: 48, note: '午前のみ', createdAt: '2026-03-19T00:00:00.000Z' },
    { id: 'cap10', userId: 'u13', startDate: '2026-03-25', endDate: '2026-03-31', hoursPerDay: 4, totalHours: 28, note: '', createdAt: '2026-03-22T00:00:00.000Z' },
    { id: 'cap11', userId: 'u14', startDate: '2026-03-28', endDate: '2026-04-04', hoursPerDay: 5, totalHours: 40, note: '', createdAt: '2026-03-25T00:00:00.000Z' },
    { id: 'cap12', userId: 'u15', startDate: '2026-03-31', endDate: '2026-04-08', hoursPerDay: 6, totalHours: 54, note: '', createdAt: '2026-03-28T00:00:00.000Z' },
    { id: 'cap13', userId: 'u16', startDate: '2026-04-03', endDate: '2026-04-08', hoursPerDay: 7, totalHours: 42, note: '午前のみ', createdAt: '2026-03-31T00:00:00.000Z' },
    { id: 'cap14', userId: 'u17', startDate: '2026-03-12', endDate: '2026-03-18', hoursPerDay: 8, totalHours: 56, note: '', createdAt: '2026-03-09T00:00:00.000Z' },
    { id: 'cap15', userId: 'u18', startDate: '2026-03-15', endDate: '2026-03-22', hoursPerDay: 4, totalHours: 32, note: '', createdAt: '2026-03-12T00:00:00.000Z' },
    { id: 'cap16', userId: 'u19', startDate: '2026-03-18', endDate: '2026-03-26', hoursPerDay: 5, totalHours: 45, note: '', createdAt: '2026-03-15T00:00:00.000Z' },
    { id: 'cap17', userId: 'u20', startDate: '2026-03-21', endDate: '2026-03-26', hoursPerDay: 6, totalHours: 36, note: '午前のみ', createdAt: '2026-03-18T00:00:00.000Z' },
    { id: 'cap18', userId: 'u21', startDate: '2026-03-24', endDate: '2026-03-30', hoursPerDay: 7, totalHours: 49, note: '', createdAt: '2026-03-21T00:00:00.000Z' },
    { id: 'cap19', userId: 'u22', startDate: '2026-03-27', endDate: '2026-04-03', hoursPerDay: 8, totalHours: 64, note: '', createdAt: '2026-03-24T00:00:00.000Z' },
    { id: 'cap20', userId: 'u23', startDate: '2026-03-30', endDate: '2026-04-07', hoursPerDay: 4, totalHours: 36, note: '', createdAt: '2026-03-27T00:00:00.000Z' },
    { id: 'cap21', userId: 'u24', startDate: '2026-04-02', endDate: '2026-04-07', hoursPerDay: 5, totalHours: 30, note: '午前のみ', createdAt: '2026-03-30T00:00:00.000Z' },
    { id: 'cap22', userId: 'u25', startDate: '2026-03-11', endDate: '2026-03-17', hoursPerDay: 6, totalHours: 42, note: '', createdAt: '2026-03-08T00:00:00.000Z' },
    { id: 'cap23', userId: 'u26', startDate: '2026-03-14', endDate: '2026-03-21', hoursPerDay: 7, totalHours: 56, note: '', createdAt: '2026-03-11T00:00:00.000Z' },
    { id: 'cap24', userId: 'u27', startDate: '2026-03-17', endDate: '2026-03-25', hoursPerDay: 8, totalHours: 72, note: '', createdAt: '2026-03-14T00:00:00.000Z' },
  ],
  tasks: [
    { id: 't1', name: '〇〇中学校 国語 第1回', subject: '国語', requiredHours: 12, deadline: '2026-03-05', status: 'pending', sheetsUrl: '', workType: '新年度試験種', createdAt: '2026-02-18T00:00:00.000Z' },
    { id: 't2', name: '〇〇中学校 算数 第1回', subject: '算数', requiredHours: 8, deadline: '2026-03-05', status: 'pending', sheetsUrl: '', workType: '新年度試験種', createdAt: '2026-02-18T00:00:00.000Z' },
    { id: 't3', name: '△△中学校 理科 第1回', subject: '理科', requiredHours: 10, deadline: '2026-03-07', status: 'pending', sheetsUrl: '', workType: 'タグ付け', createdAt: '2026-02-18T00:00:00.000Z' },
    { id: 't4', name: '△△中学校 社会 第1回', subject: '社会', requiredHours: 6, deadline: '2026-03-07', status: 'pending', sheetsUrl: '', workType: '解答出し', createdAt: '2026-02-18T00:00:00.000Z' },
    // 試験種処理デモ用 — submitted（検証待ち/検証中）
    { id: 't5', name: '〇〇中学校 国語 第2回', subject: '国語', requiredHours: 10, deadline: '2026-03-10', status: 'submitted', sheetsUrl: '', workType: '新年度試験種', createdAt: '2026-02-20T00:00:00.000Z' },
    { id: 't6', name: '△△中学校 算数 第2回', subject: '算数', requiredHours: 8, deadline: '2026-03-08', status: 'submitted', sheetsUrl: '', workType: 'タグ付け', createdAt: '2026-02-20T00:00:00.000Z' },
    { id: 't7', name: '□□中学校 理科 第2回', subject: '理科', requiredHours: 12, deadline: '2026-03-12', status: 'submitted', sheetsUrl: '', workType: '部分点', createdAt: '2026-02-22T00:00:00.000Z' },
    { id: 't8', name: '〇〇中学校 社会 第2回', subject: '社会', requiredHours: 6, deadline: '2026-03-09', status: 'submitted', sheetsUrl: '', workType: '解答出し', createdAt: '2026-02-21T00:00:00.000Z' },
    { id: 't9', name: '□□中学校 国語 第3回', subject: '国語', requiredHours: 14, deadline: '2026-03-14', status: 'submitted', sheetsUrl: '', workType: 'tensakitインポート', createdAt: '2026-02-23T00:00:00.000Z' },
    // 試験種処理デモ用 — approved（検証済み）
    { id: 't10', name: '△△中学校 算数 第1回', subject: '算数', requiredHours: 8, deadline: '2026-02-28', status: 'approved', sheetsUrl: '', workType: '新年度試験種', createdAt: '2026-02-15T00:00:00.000Z' },
    { id: 't11', name: '〇〇中学校 理科 第1回', subject: '理科', requiredHours: 10, deadline: '2026-03-01', status: 'approved', sheetsUrl: '', workType: 'タグ付け', createdAt: '2026-02-16T00:00:00.000Z' },
    { id: 't12', name: '□□中学校 社会 第1回', subject: '社会', requiredHours: 7, deadline: '2026-03-03', status: 'approved', sheetsUrl: '', workType: '部分点', createdAt: '2026-02-17T00:00:00.000Z' },
    // === デモ用追加タスク (100件: t13-t112) ===
    { id: 't13', name: '桜が丘中学校 国語 第1回', subject: '国語', requiredHours: 4, deadline: '2026-03-10', status: 'assigned', sheetsUrl: '', workType: '新年度試験種', createdAt: '2026-03-01T00:00:00.000Z' },
    { id: 't14', name: '青山中学校 算数 第1回', subject: '算数', requiredHours: 5, deadline: '2026-03-11', status: 'assigned', sheetsUrl: '', workType: 'タグ付け', createdAt: '2026-03-01T00:00:00.000Z' },
    { id: 't15', name: '城北中学校 理科 第1回', subject: '理科', requiredHours: 6, deadline: '2026-03-12', status: 'approved', sheetsUrl: '', workType: '解答出し', createdAt: '2026-03-02T00:00:00.000Z' },
    { id: 't16', name: '西園中学校 社会 第1回', subject: '社会', requiredHours: 7, deadline: '2026-03-13', status: 'pending', sheetsUrl: '', workType: '部分点', createdAt: '2026-03-03T00:00:00.000Z', viking: true },
    { id: 't17', name: '東京学園 マクロ 第1回', subject: 'マクロ', requiredHours: 8, deadline: '2026-03-14', status: 'submitted', sheetsUrl: '', workType: 'tensakitインポート', createdAt: '2026-03-04T00:00:00.000Z' },
    { id: 't18', name: '大阪附属中 国語 第1回', subject: '国語', requiredHours: 9, deadline: '2026-03-15', status: 'in_progress', sheetsUrl: '', workType: '新年度試験種', createdAt: '2026-03-05T00:00:00.000Z' },
    { id: 't19', name: '名古屋中学校 算数 第1回', subject: '算数', requiredHours: 10, deadline: '2026-03-16', status: 'pending', sheetsUrl: '', workType: 'タグ付け', createdAt: '2026-03-06T00:00:00.000Z' },
    { id: 't20', name: '横浜中学校 理科 第1回', subject: '理科', requiredHours: 11, deadline: '2026-03-17', status: 'submitted', sheetsUrl: '', workType: '解答出し', createdAt: '2026-03-07T00:00:00.000Z' },
    { id: 't21', name: '神戸中学校 社会 第1回', subject: '社会', requiredHours: 12, deadline: '2026-03-18', status: 'pending', sheetsUrl: '', workType: '部分点', createdAt: '2026-03-08T00:00:00.000Z' },
    { id: 't22', name: '千葉中学校 マクロ 第1回', subject: 'マクロ', requiredHours: 13, deadline: '2026-03-19', status: 'submitted', sheetsUrl: '', workType: 'tensakitインポート', createdAt: '2026-03-09T00:00:00.000Z' },
    { id: 't23', name: '埼玉中学校 国語 第1回', subject: '国語', requiredHours: 14, deadline: '2026-03-20', status: 'submitted', sheetsUrl: '', workType: '新年度試験種', createdAt: '2026-03-10T00:00:00.000Z' },
    { id: 't24', name: '広島中学校 算数 第1回', subject: '算数', requiredHours: 15, deadline: '2026-03-21', status: 'pending', sheetsUrl: '', workType: 'タグ付け', createdAt: '2026-03-11T00:00:00.000Z' },
    { id: 't25', name: '桜が丘中学校 理科 第2回', subject: '理科', requiredHours: 16, deadline: '2026-03-22', status: 'in_progress', sheetsUrl: '', workType: '解答出し', createdAt: '2026-03-12T00:00:00.000Z' },
    { id: 't26', name: '青山中学校 社会 第2回', subject: '社会', requiredHours: 17, deadline: '2026-03-23', status: 'in_progress', sheetsUrl: '', workType: '部分点', createdAt: '2026-03-13T00:00:00.000Z' },
    { id: 't27', name: '城北中学校 マクロ 第2回', subject: 'マクロ', requiredHours: 18, deadline: '2026-03-24', status: 'submitted', sheetsUrl: '', workType: 'tensakitインポート', createdAt: '2026-03-14T00:00:00.000Z' },
    { id: 't28', name: '西園中学校 国語 第2回', subject: '国語', requiredHours: 19, deadline: '2026-03-25', status: 'in_progress', sheetsUrl: '', workType: '新年度試験種', createdAt: '2026-03-15T00:00:00.000Z', viking: true },
    { id: 't29', name: '東京学園 算数 第2回', subject: '算数', requiredHours: 20, deadline: '2026-03-26', status: 'in_progress', sheetsUrl: '', workType: 'タグ付け', createdAt: '2026-03-16T00:00:00.000Z' },
    { id: 't30', name: '大阪附属中 理科 第2回', subject: '理科', requiredHours: 4, deadline: '2026-03-27', status: 'approved', sheetsUrl: '', workType: '解答出し', createdAt: '2026-03-17T00:00:00.000Z' },
    { id: 't31', name: '名古屋中学校 社会 第2回', subject: '社会', requiredHours: 5, deadline: '2026-03-28', status: 'submitted', sheetsUrl: '', workType: '部分点', createdAt: '2026-03-18T00:00:00.000Z' },
    { id: 't32', name: '横浜中学校 マクロ 第2回', subject: 'マクロ', requiredHours: 6, deadline: '2026-03-29', status: 'assigned', sheetsUrl: '', workType: 'tensakitインポート', createdAt: '2026-03-19T00:00:00.000Z' },
    { id: 't33', name: '神戸中学校 国語 第2回', subject: '国語', requiredHours: 7, deadline: '2026-03-30', status: 'assigned', sheetsUrl: '', workType: '新年度試験種', createdAt: '2026-03-20T00:00:00.000Z' },
    { id: 't34', name: '千葉中学校 算数 第2回', subject: '算数', requiredHours: 8, deadline: '2026-03-31', status: 'pending', sheetsUrl: '', workType: 'タグ付け', createdAt: '2026-03-21T00:00:00.000Z' },
    { id: 't35', name: '埼玉中学校 理科 第2回', subject: '理科', requiredHours: 9, deadline: '2026-04-01', status: 'assigned', sheetsUrl: '', workType: '解答出し', createdAt: '2026-03-22T00:00:00.000Z' },
    { id: 't36', name: '広島中学校 社会 第2回', subject: '社会', requiredHours: 10, deadline: '2026-04-02', status: 'approved', sheetsUrl: '', workType: '部分点', createdAt: '2026-03-23T00:00:00.000Z' },
    { id: 't37', name: '桜が丘中学校 マクロ 第3回', subject: 'マクロ', requiredHours: 11, deadline: '2026-04-03', status: 'submitted', sheetsUrl: '', workType: 'tensakitインポート', createdAt: '2026-03-24T00:00:00.000Z' },
    { id: 't38', name: '青山中学校 国語 第3回', subject: '国語', requiredHours: 12, deadline: '2026-04-04', status: 'in_progress', sheetsUrl: '', workType: '新年度試験種', createdAt: '2026-03-25T00:00:00.000Z' },
    { id: 't39', name: '城北中学校 算数 第3回', subject: '算数', requiredHours: 13, deadline: '2026-04-05', status: 'submitted', sheetsUrl: '', workType: 'タグ付け', createdAt: '2026-03-26T00:00:00.000Z' },
    { id: 't40', name: '西園中学校 理科 第3回', subject: '理科', requiredHours: 14, deadline: '2026-04-06', status: 'assigned', sheetsUrl: '', workType: '解答出し', createdAt: '2026-03-27T00:00:00.000Z', viking: true },
    { id: 't41', name: '東京学園 社会 第3回', subject: '社会', requiredHours: 15, deadline: '2026-04-07', status: 'approved', sheetsUrl: '', workType: '部分点', createdAt: '2026-03-28T00:00:00.000Z' },
    { id: 't42', name: '大阪附属中 マクロ 第3回', subject: 'マクロ', requiredHours: 16, deadline: '2026-04-08', status: 'assigned', sheetsUrl: '', workType: 'tensakitインポート', createdAt: '2026-03-29T00:00:00.000Z' },
    { id: 't43', name: '名古屋中学校 国語 第3回', subject: '国語', requiredHours: 17, deadline: '2026-04-09', status: 'pending', sheetsUrl: '', workType: '新年度試験種', createdAt: '2026-03-30T00:00:00.000Z' },
    { id: 't44', name: '横浜中学校 算数 第3回', subject: '算数', requiredHours: 18, deadline: '2026-04-10', status: 'in_progress', sheetsUrl: '', workType: 'タグ付け', createdAt: '2026-03-31T00:00:00.000Z' },
    { id: 't45', name: '神戸中学校 理科 第3回', subject: '理科', requiredHours: 19, deadline: '2026-04-11', status: 'in_progress', sheetsUrl: '', workType: '解答出し', createdAt: '2026-04-01T00:00:00.000Z' },
    { id: 't46', name: '千葉中学校 社会 第3回', subject: '社会', requiredHours: 20, deadline: '2026-04-12', status: 'submitted', sheetsUrl: '', workType: '部分点', createdAt: '2026-04-02T00:00:00.000Z' },
    { id: 't47', name: '埼玉中学校 マクロ 第3回', subject: 'マクロ', requiredHours: 4, deadline: '2026-04-13', status: 'submitted', sheetsUrl: '', workType: 'tensakitインポート', createdAt: '2026-04-03T00:00:00.000Z' },
    { id: 't48', name: '広島中学校 国語 第3回', subject: '国語', requiredHours: 5, deadline: '2026-04-14', status: 'assigned', sheetsUrl: '', workType: '新年度試験種', createdAt: '2026-04-04T00:00:00.000Z' },
    { id: 't49', name: '桜が丘中学校 算数 第4回', subject: '算数', requiredHours: 6, deadline: '2026-04-15', status: 'approved', sheetsUrl: '', workType: 'タグ付け', createdAt: '2026-04-05T00:00:00.000Z' },
    { id: 't50', name: '青山中学校 理科 第4回', subject: '理科', requiredHours: 7, deadline: '2026-04-16', status: 'in_progress', sheetsUrl: '', workType: '解答出し', createdAt: '2026-04-06T00:00:00.000Z' },
    { id: 't51', name: '城北中学校 社会 第4回', subject: '社会', requiredHours: 8, deadline: '2026-04-17', status: 'approved', sheetsUrl: '', workType: '部分点', createdAt: '2026-04-07T00:00:00.000Z' },
    { id: 't52', name: '西園中学校 マクロ 第4回', subject: 'マクロ', requiredHours: 9, deadline: '2026-04-18', status: 'pending', sheetsUrl: '', workType: 'tensakitインポート', createdAt: '2026-04-08T00:00:00.000Z' },
    { id: 't53', name: '東京学園 国語 第4回', subject: '国語', requiredHours: 10, deadline: '2026-04-19', status: 'assigned', sheetsUrl: '', workType: '新年度試験種', createdAt: '2026-04-09T00:00:00.000Z' },
    { id: 't54', name: '大阪附属中 算数 第4回', subject: '算数', requiredHours: 11, deadline: '2026-04-20', status: 'pending', sheetsUrl: '', workType: 'タグ付け', createdAt: '2026-04-10T00:00:00.000Z' },
    { id: 't55', name: '名古屋中学校 理科 第4回', subject: '理科', requiredHours: 12, deadline: '2026-04-21', status: 'assigned', sheetsUrl: '', workType: '解答出し', createdAt: '2026-04-11T00:00:00.000Z', viking: true },
    { id: 't56', name: '横浜中学校 社会 第4回', subject: '社会', requiredHours: 13, deadline: '2026-04-22', status: 'assigned', sheetsUrl: '', workType: '部分点', createdAt: '2026-04-12T00:00:00.000Z' },
    { id: 't57', name: '神戸中学校 マクロ 第4回', subject: 'マクロ', requiredHours: 14, deadline: '2026-04-23', status: 'pending', sheetsUrl: '', workType: 'tensakitインポート', createdAt: '2026-04-13T00:00:00.000Z' },
    { id: 't58', name: '千葉中学校 国語 第4回', subject: '国語', requiredHours: 15, deadline: '2026-04-24', status: 'submitted', sheetsUrl: '', workType: '新年度試験種', createdAt: '2026-04-14T00:00:00.000Z' },
    { id: 't59', name: '埼玉中学校 算数 第4回', subject: '算数', requiredHours: 16, deadline: '2026-04-25', status: 'submitted', sheetsUrl: '', workType: 'タグ付け', createdAt: '2026-04-15T00:00:00.000Z' },
    { id: 't60', name: '広島中学校 理科 第4回', subject: '理科', requiredHours: 17, deadline: '2026-04-26', status: 'submitted', sheetsUrl: '', workType: '解答出し', createdAt: '2026-04-16T00:00:00.000Z' },
    { id: 't61', name: '桜が丘中学校 社会 第5回', subject: '社会', requiredHours: 18, deadline: '2026-04-27', status: 'pending', sheetsUrl: '', workType: '部分点', createdAt: '2026-04-17T00:00:00.000Z' },
    { id: 't62', name: '青山中学校 マクロ 第5回', subject: 'マクロ', requiredHours: 19, deadline: '2026-04-28', status: 'assigned', sheetsUrl: '', workType: 'tensakitインポート', createdAt: '2026-04-18T00:00:00.000Z' },
    { id: 't63', name: '城北中学校 国語 第5回', subject: '国語', requiredHours: 20, deadline: '2026-04-29', status: 'approved', sheetsUrl: '', workType: '新年度試験種', createdAt: '2026-04-19T00:00:00.000Z' },
    { id: 't64', name: '西園中学校 算数 第5回', subject: '算数', requiredHours: 4, deadline: '2026-04-30', status: 'in_progress', sheetsUrl: '', workType: 'タグ付け', createdAt: '2026-04-20T00:00:00.000Z' },
    { id: 't65', name: '東京学園 理科 第5回', subject: '理科', requiredHours: 5, deadline: '2026-03-10', status: 'pending', sheetsUrl: '', workType: '解答出し', createdAt: '2026-03-01T00:00:00.000Z' },
    { id: 't66', name: '大阪附属中 社会 第5回', subject: '社会', requiredHours: 6, deadline: '2026-03-11', status: 'in_progress', sheetsUrl: '', workType: '部分点', createdAt: '2026-03-01T00:00:00.000Z' },
    { id: 't67', name: '名古屋中学校 マクロ 第5回', subject: 'マクロ', requiredHours: 7, deadline: '2026-03-12', status: 'pending', sheetsUrl: '', workType: 'tensakitインポート', createdAt: '2026-03-02T00:00:00.000Z' },
    { id: 't68', name: '横浜中学校 国語 第5回', subject: '国語', requiredHours: 8, deadline: '2026-03-13', status: 'assigned', sheetsUrl: '', workType: '新年度試験種', createdAt: '2026-03-03T00:00:00.000Z' },
    { id: 't69', name: '神戸中学校 算数 第5回', subject: '算数', requiredHours: 9, deadline: '2026-03-14', status: 'in_progress', sheetsUrl: '', workType: 'タグ付け', createdAt: '2026-03-04T00:00:00.000Z' },
    { id: 't70', name: '千葉中学校 理科 第5回', subject: '理科', requiredHours: 10, deadline: '2026-03-15', status: 'submitted', sheetsUrl: '', workType: '解答出し', createdAt: '2026-03-05T00:00:00.000Z' },
    { id: 't71', name: '埼玉中学校 社会 第5回', subject: '社会', requiredHours: 11, deadline: '2026-03-16', status: 'pending', sheetsUrl: '', workType: '部分点', createdAt: '2026-03-06T00:00:00.000Z', viking: true },
    { id: 't72', name: '広島中学校 マクロ 第5回', subject: 'マクロ', requiredHours: 12, deadline: '2026-03-17', status: 'submitted', sheetsUrl: '', workType: 'tensakitインポート', createdAt: '2026-03-07T00:00:00.000Z' },
    { id: 't73', name: '桜が丘中学校 国語 第6回', subject: '国語', requiredHours: 13, deadline: '2026-03-18', status: 'pending', sheetsUrl: '', workType: '新年度試験種', createdAt: '2026-03-08T00:00:00.000Z' },
    { id: 't74', name: '青山中学校 算数 第6回', subject: '算数', requiredHours: 14, deadline: '2026-03-19', status: 'pending', sheetsUrl: '', workType: 'タグ付け', createdAt: '2026-03-09T00:00:00.000Z' },
    { id: 't75', name: '城北中学校 理科 第6回', subject: '理科', requiredHours: 15, deadline: '2026-03-20', status: 'pending', sheetsUrl: '', workType: '解答出し', createdAt: '2026-03-10T00:00:00.000Z' },
    { id: 't76', name: '西園中学校 社会 第6回', subject: '社会', requiredHours: 16, deadline: '2026-03-21', status: 'submitted', sheetsUrl: '', workType: '部分点', createdAt: '2026-03-11T00:00:00.000Z' },
    { id: 't77', name: '東京学園 マクロ 第6回', subject: 'マクロ', requiredHours: 17, deadline: '2026-03-22', status: 'submitted', sheetsUrl: '', workType: 'tensakitインポート', createdAt: '2026-03-12T00:00:00.000Z' },
    { id: 't78', name: '大阪附属中 国語 第6回', subject: '国語', requiredHours: 18, deadline: '2026-03-23', status: 'pending', sheetsUrl: '', workType: '新年度試験種', createdAt: '2026-03-13T00:00:00.000Z' },
    { id: 't79', name: '名古屋中学校 算数 第6回', subject: '算数', requiredHours: 19, deadline: '2026-03-24', status: 'submitted', sheetsUrl: '', workType: 'タグ付け', createdAt: '2026-03-14T00:00:00.000Z' },
    { id: 't80', name: '横浜中学校 理科 第6回', subject: '理科', requiredHours: 20, deadline: '2026-03-25', status: 'assigned', sheetsUrl: '', workType: '解答出し', createdAt: '2026-03-15T00:00:00.000Z' },
    { id: 't81', name: '神戸中学校 社会 第6回', subject: '社会', requiredHours: 4, deadline: '2026-03-26', status: 'approved', sheetsUrl: '', workType: '部分点', createdAt: '2026-03-16T00:00:00.000Z' },
    { id: 't82', name: '千葉中学校 マクロ 第6回', subject: 'マクロ', requiredHours: 5, deadline: '2026-03-27', status: 'pending', sheetsUrl: '', workType: 'tensakitインポート', createdAt: '2026-03-17T00:00:00.000Z' },
    { id: 't83', name: '埼玉中学校 国語 第6回', subject: '国語', requiredHours: 6, deadline: '2026-03-28', status: 'pending', sheetsUrl: '', workType: '新年度試験種', createdAt: '2026-03-18T00:00:00.000Z' },
    { id: 't84', name: '広島中学校 算数 第6回', subject: '算数', requiredHours: 7, deadline: '2026-03-29', status: 'approved', sheetsUrl: '', workType: 'タグ付け', createdAt: '2026-03-19T00:00:00.000Z' },
    { id: 't85', name: '桜が丘中学校 理科 第7回', subject: '理科', requiredHours: 8, deadline: '2026-03-30', status: 'in_progress', sheetsUrl: '', workType: '解答出し', createdAt: '2026-03-20T00:00:00.000Z' },
    { id: 't86', name: '青山中学校 社会 第7回', subject: '社会', requiredHours: 9, deadline: '2026-03-31', status: 'approved', sheetsUrl: '', workType: '部分点', createdAt: '2026-03-21T00:00:00.000Z', viking: true },
    { id: 't87', name: '城北中学校 マクロ 第7回', subject: 'マクロ', requiredHours: 10, deadline: '2026-04-01', status: 'in_progress', sheetsUrl: '', workType: 'tensakitインポート', createdAt: '2026-03-22T00:00:00.000Z' },
    { id: 't88', name: '西園中学校 国語 第7回', subject: '国語', requiredHours: 11, deadline: '2026-04-02', status: 'approved', sheetsUrl: '', workType: '新年度試験種', createdAt: '2026-03-23T00:00:00.000Z' },
    { id: 't89', name: '東京学園 算数 第7回', subject: '算数', requiredHours: 12, deadline: '2026-04-03', status: 'assigned', sheetsUrl: '', workType: 'タグ付け', createdAt: '2026-03-24T00:00:00.000Z' },
    { id: 't90', name: '大阪附属中 理科 第7回', subject: '理科', requiredHours: 13, deadline: '2026-04-04', status: 'submitted', sheetsUrl: '', workType: '解答出し', createdAt: '2026-03-25T00:00:00.000Z' },
    { id: 't91', name: '名古屋中学校 社会 第7回', subject: '社会', requiredHours: 14, deadline: '2026-04-05', status: 'submitted', sheetsUrl: '', workType: '部分点', createdAt: '2026-03-26T00:00:00.000Z' },
    { id: 't92', name: '横浜中学校 マクロ 第7回', subject: 'マクロ', requiredHours: 15, deadline: '2026-04-06', status: 'submitted', sheetsUrl: '', workType: 'tensakitインポート', createdAt: '2026-03-27T00:00:00.000Z' },
    { id: 't93', name: '神戸中学校 国語 第7回', subject: '国語', requiredHours: 16, deadline: '2026-04-07', status: 'submitted', sheetsUrl: '', workType: '新年度試験種', createdAt: '2026-03-28T00:00:00.000Z' },
    { id: 't94', name: '千葉中学校 算数 第7回', subject: '算数', requiredHours: 17, deadline: '2026-04-08', status: 'assigned', sheetsUrl: '', workType: 'タグ付け', createdAt: '2026-03-29T00:00:00.000Z' },
    { id: 't95', name: '埼玉中学校 理科 第7回', subject: '理科', requiredHours: 18, deadline: '2026-04-09', status: 'assigned', sheetsUrl: '', workType: '解答出し', createdAt: '2026-03-30T00:00:00.000Z' },
    { id: 't96', name: '広島中学校 社会 第7回', subject: '社会', requiredHours: 19, deadline: '2026-04-10', status: 'approved', sheetsUrl: '', workType: '部分点', createdAt: '2026-03-31T00:00:00.000Z' },
    { id: 't97', name: '桜が丘中学校 マクロ 第8回', subject: 'マクロ', requiredHours: 20, deadline: '2026-04-11', status: 'approved', sheetsUrl: '', workType: 'tensakitインポート', createdAt: '2026-04-01T00:00:00.000Z' },
    { id: 't98', name: '青山中学校 国語 第8回', subject: '国語', requiredHours: 4, deadline: '2026-04-12', status: 'pending', sheetsUrl: '', workType: '新年度試験種', createdAt: '2026-04-02T00:00:00.000Z' },
    { id: 't99', name: '城北中学校 算数 第8回', subject: '算数', requiredHours: 5, deadline: '2026-04-13', status: 'in_progress', sheetsUrl: '', workType: 'タグ付け', createdAt: '2026-04-03T00:00:00.000Z' },
    { id: 't100', name: '西園中学校 理科 第8回', subject: '理科', requiredHours: 6, deadline: '2026-04-14', status: 'submitted', sheetsUrl: '', workType: '解答出し', createdAt: '2026-04-04T00:00:00.000Z' },
    { id: 't101', name: '東京学園 社会 第8回', subject: '社会', requiredHours: 7, deadline: '2026-04-15', status: 'pending', sheetsUrl: '', workType: '部分点', createdAt: '2026-04-05T00:00:00.000Z' },
    { id: 't102', name: '大阪附属中 マクロ 第8回', subject: 'マクロ', requiredHours: 8, deadline: '2026-04-16', status: 'submitted', sheetsUrl: '', workType: 'tensakitインポート', createdAt: '2026-04-06T00:00:00.000Z' },
    { id: 't103', name: '名古屋中学校 国語 第8回', subject: '国語', requiredHours: 9, deadline: '2026-04-17', status: 'approved', sheetsUrl: '', workType: '新年度試験種', createdAt: '2026-04-07T00:00:00.000Z' },
    { id: 't104', name: '横浜中学校 算数 第8回', subject: '算数', requiredHours: 10, deadline: '2026-04-18', status: 'pending', sheetsUrl: '', workType: 'タグ付け', createdAt: '2026-04-08T00:00:00.000Z', viking: true },
    { id: 't105', name: '神戸中学校 理科 第8回', subject: '理科', requiredHours: 11, deadline: '2026-04-19', status: 'pending', sheetsUrl: '', workType: '解答出し', createdAt: '2026-04-09T00:00:00.000Z' },
    { id: 't106', name: '千葉中学校 社会 第8回', subject: '社会', requiredHours: 12, deadline: '2026-04-20', status: 'assigned', sheetsUrl: '', workType: '部分点', createdAt: '2026-04-10T00:00:00.000Z' },
    { id: 't107', name: '埼玉中学校 マクロ 第8回', subject: 'マクロ', requiredHours: 13, deadline: '2026-04-21', status: 'assigned', sheetsUrl: '', workType: 'tensakitインポート', createdAt: '2026-04-11T00:00:00.000Z' },
    { id: 't108', name: '広島中学校 国語 第8回', subject: '国語', requiredHours: 14, deadline: '2026-04-22', status: 'assigned', sheetsUrl: '', workType: '新年度試験種', createdAt: '2026-04-12T00:00:00.000Z' },
    { id: 't109', name: '桜が丘中学校 算数 第9回', subject: '算数', requiredHours: 15, deadline: '2026-04-23', status: 'approved', sheetsUrl: '', workType: 'タグ付け', createdAt: '2026-04-13T00:00:00.000Z' },
    { id: 't110', name: '青山中学校 理科 第9回', subject: '理科', requiredHours: 16, deadline: '2026-04-24', status: 'pending', sheetsUrl: '', workType: '解答出し', createdAt: '2026-04-14T00:00:00.000Z' },
    { id: 't111', name: '城北中学校 社会 第9回', subject: '社会', requiredHours: 17, deadline: '2026-04-25', status: 'pending', sheetsUrl: '', workType: '部分点', createdAt: '2026-04-15T00:00:00.000Z' },
    { id: 't112', name: '西園中学校 マクロ 第9回', subject: 'マクロ', requiredHours: 18, deadline: '2026-04-26', status: 'submitted', sheetsUrl: '', workType: 'tensakitインポート', createdAt: '2026-04-16T00:00:00.000Z' },
  ],
  assignments: [
    // submitted — 検証待ち
    { id: 'a1', taskId: 't5', userId: 'u2', assignedHours: 10, actualHours: 9, status: 'submitted', assignedAt: '2026-02-21T00:00:00.000Z', submittedAt: '2026-03-01T10:00:00.000Z', note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a2', taskId: 't6', userId: 'u3', assignedHours: 8, actualHours: 7, status: 'submitted', assignedAt: '2026-02-21T00:00:00.000Z', submittedAt: '2026-02-28T14:00:00.000Z', note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    // submitted — 検証中
    { id: 'a3', taskId: 't7', userId: 'u5', assignedHours: 12, actualHours: 11, status: 'submitted', assignedAt: '2026-02-23T00:00:00.000Z', submittedAt: '2026-03-02T09:00:00.000Z', note: '', verificationStatus: 'reviewing', attachments: [], rejectionCount: 0 },
    { id: 'a4', taskId: 't8', userId: 'u4', assignedHours: 6, actualHours: 5, status: 'submitted', assignedAt: '2026-02-22T00:00:00.000Z', submittedAt: '2026-03-01T16:00:00.000Z', note: '', verificationStatus: 'reviewing', attachments: [], rejectionCount: 1 },
    { id: 'a5', taskId: 't9', userId: 'u2', assignedHours: 14, actualHours: 13, status: 'submitted', assignedAt: '2026-02-24T00:00:00.000Z', submittedAt: '2026-03-02T11:00:00.000Z', note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    // approved — 検証済み
    { id: 'a6', taskId: 't10', userId: 'u3', assignedHours: 8, actualHours: 7, status: 'approved', assignedAt: '2026-02-16T00:00:00.000Z', submittedAt: '2026-02-26T15:00:00.000Z', note: '', verificationStatus: 'verified', attachments: [], rejectionCount: 0 },
    { id: 'a7', taskId: 't11', userId: 'u5', assignedHours: 10, actualHours: 10, status: 'approved', assignedAt: '2026-02-17T00:00:00.000Z', submittedAt: '2026-02-27T12:00:00.000Z', note: '', verificationStatus: 'verified', attachments: [], rejectionCount: 0 },
    { id: 'a8', taskId: 't12', userId: 'u4', assignedHours: 7, actualHours: 6, status: 'approved', assignedAt: '2026-02-18T00:00:00.000Z', submittedAt: '2026-02-28T10:00:00.000Z', note: '', verificationStatus: 'verified', attachments: [], rejectionCount: 0 },
    // === デモ用追加振り分け (75件: a9-a83) ===
    { id: 'a9', taskId: 't13', userId: 'u2', assignedHours: 4, actualHours: null, status: 'assigned', assignedAt: '2026-03-01T00:00:00.000Z', submittedAt: null, note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a10', taskId: 't14', userId: 'u3', assignedHours: 5, actualHours: null, status: 'assigned', assignedAt: '2026-03-01T00:00:00.000Z', submittedAt: null, note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a11', taskId: 't15', userId: 'u9', assignedHours: 6, actualHours: 5, status: 'approved', assignedAt: '2026-03-02T00:00:00.000Z', submittedAt: '2026-03-10T10:00:00.000Z', note: '', verificationStatus: 'verified', attachments: [], rejectionCount: 0 },
    { id: 'a12', taskId: 't17', userId: 'u17', assignedHours: 8, actualHours: 6, status: 'submitted', assignedAt: '2026-03-04T00:00:00.000Z', submittedAt: '2026-03-12T10:00:00.000Z', note: '', verificationStatus: 'reviewing', attachments: [], rejectionCount: 0 },
    { id: 'a13', taskId: 't18', userId: 'u12', assignedHours: 9, actualHours: 3, status: 'in_progress', assignedAt: '2026-03-05T00:00:00.000Z', submittedAt: null, note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a14', taskId: 't20', userId: 'u15', assignedHours: 11, actualHours: 9, status: 'submitted', assignedAt: '2026-03-07T00:00:00.000Z', submittedAt: '2026-03-15T10:00:00.000Z', note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a15', taskId: 't22', userId: 'u25', assignedHours: 13, actualHours: 11, status: 'submitted', assignedAt: '2026-03-09T00:00:00.000Z', submittedAt: '2026-03-17T10:00:00.000Z', note: '', verificationStatus: 'reviewing', attachments: [], rejectionCount: 0 },
    { id: 'a16', taskId: 't23', userId: 'u18', assignedHours: 14, actualHours: 12, status: 'submitted', assignedAt: '2026-03-10T00:00:00.000Z', submittedAt: '2026-03-18T10:00:00.000Z', note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a17', taskId: 't25', userId: 'u24', assignedHours: 16, actualHours: 6, status: 'in_progress', assignedAt: '2026-03-12T00:00:00.000Z', submittedAt: null, note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a18', taskId: 't26', userId: 'u26', assignedHours: 17, actualHours: 6, status: 'in_progress', assignedAt: '2026-03-13T00:00:00.000Z', submittedAt: null, note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a19', taskId: 't27', userId: 'u36', assignedHours: 18, actualHours: 16, status: 'submitted', assignedAt: '2026-03-14T00:00:00.000Z', submittedAt: '2026-03-22T10:00:00.000Z', note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a20', taskId: 't28', userId: 'u28', assignedHours: 19, actualHours: 7, status: 'in_progress', assignedAt: '2026-03-15T00:00:00.000Z', submittedAt: null, note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a21', taskId: 't29', userId: 'u34', assignedHours: 20, actualHours: 8, status: 'in_progress', assignedAt: '2026-03-16T00:00:00.000Z', submittedAt: null, note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a22', taskId: 't30', userId: 'u35', assignedHours: 4, actualHours: 3, status: 'approved', assignedAt: '2026-03-17T00:00:00.000Z', submittedAt: '2026-03-25T10:00:00.000Z', note: '', verificationStatus: 'verified', attachments: [], rejectionCount: 0 },
    { id: 'a23', taskId: 't31', userId: 'u40', assignedHours: 5, actualHours: 4, status: 'submitted', assignedAt: '2026-03-18T00:00:00.000Z', submittedAt: '2026-03-26T10:00:00.000Z', note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a24', taskId: 't32', userId: 'u47', assignedHours: 6, actualHours: null, status: 'assigned', assignedAt: '2026-03-19T00:00:00.000Z', submittedAt: null, note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a25', taskId: 't33', userId: 'u42', assignedHours: 7, actualHours: null, status: 'assigned', assignedAt: '2026-03-20T00:00:00.000Z', submittedAt: null, note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a26', taskId: 't35', userId: 'u45', assignedHours: 9, actualHours: null, status: 'assigned', assignedAt: '2026-03-22T00:00:00.000Z', submittedAt: null, note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a27', taskId: 't36', userId: 'u4', assignedHours: 10, actualHours: 8, status: 'approved', assignedAt: '2026-03-23T00:00:00.000Z', submittedAt: '2026-04-01T10:00:00.000Z', note: '', verificationStatus: 'verified', attachments: [], rejectionCount: 0 },
    { id: 'a28', taskId: 't37', userId: 'u17', assignedHours: 11, actualHours: 9, status: 'submitted', assignedAt: '2026-03-24T00:00:00.000Z', submittedAt: '2026-04-01T10:00:00.000Z', note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a29', taskId: 't38', userId: 'u4', assignedHours: 12, actualHours: 4, status: 'in_progress', assignedAt: '2026-03-25T00:00:00.000Z', submittedAt: null, note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a30', taskId: 't39', userId: 'u14', assignedHours: 13, actualHours: 11, status: 'submitted', assignedAt: '2026-03-26T00:00:00.000Z', submittedAt: '2026-04-03T10:00:00.000Z', note: '', verificationStatus: 'reviewing', attachments: [], rejectionCount: 0 },
    { id: 'a31', taskId: 't40', userId: 'u13', assignedHours: 14, actualHours: null, status: 'assigned', assignedAt: '2026-03-27T00:00:00.000Z', submittedAt: null, note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a32', taskId: 't41', userId: 'u16', assignedHours: 15, actualHours: 13, status: 'approved', assignedAt: '2026-03-28T00:00:00.000Z', submittedAt: '2026-04-05T10:00:00.000Z', note: '', verificationStatus: 'verified', attachments: [], rejectionCount: 0 },
    { id: 'a33', taskId: 't42', userId: 'u31', assignedHours: 16, actualHours: null, status: 'assigned', assignedAt: '2026-03-29T00:00:00.000Z', submittedAt: null, note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a34', taskId: 't44', userId: 'u24', assignedHours: 18, actualHours: 7, status: 'in_progress', assignedAt: '2026-03-31T00:00:00.000Z', submittedAt: null, note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a35', taskId: 't45', userId: 'u24', assignedHours: 19, actualHours: 7, status: 'in_progress', assignedAt: '2026-04-01T00:00:00.000Z', submittedAt: null, note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a36', taskId: 't46', userId: 'u26', assignedHours: 20, actualHours: 18, status: 'submitted', assignedAt: '2026-04-02T00:00:00.000Z', submittedAt: '2026-04-10T10:00:00.000Z', note: '', verificationStatus: 'reviewing', attachments: [], rejectionCount: 0 },
    { id: 'a37', taskId: 't47', userId: 'u40', assignedHours: 4, actualHours: 3, status: 'submitted', assignedAt: '2026-04-03T00:00:00.000Z', submittedAt: '2026-04-11T10:00:00.000Z', note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a38', taskId: 't48', userId: 'u27', assignedHours: 5, actualHours: null, status: 'assigned', assignedAt: '2026-04-04T00:00:00.000Z', submittedAt: null, note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a39', taskId: 't49', userId: 'u37', assignedHours: 6, actualHours: 5, status: 'approved', assignedAt: '2026-04-05T00:00:00.000Z', submittedAt: '2026-04-13T10:00:00.000Z', note: '', verificationStatus: 'verified', attachments: [], rejectionCount: 0 },
    { id: 'a40', taskId: 't50', userId: 'u35', assignedHours: 7, actualHours: 2, status: 'in_progress', assignedAt: '2026-04-06T00:00:00.000Z', submittedAt: null, note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a41', taskId: 't51', userId: 'u40', assignedHours: 8, actualHours: 6, status: 'approved', assignedAt: '2026-04-07T00:00:00.000Z', submittedAt: '2026-04-15T10:00:00.000Z', note: '', verificationStatus: 'verified', attachments: [], rejectionCount: 0 },
    { id: 'a42', taskId: 't53', userId: 'u37', assignedHours: 10, actualHours: null, status: 'assigned', assignedAt: '2026-04-09T00:00:00.000Z', submittedAt: null, note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a43', taskId: 't55', userId: 'u43', assignedHours: 12, actualHours: null, status: 'assigned', assignedAt: '2026-04-11T00:00:00.000Z', submittedAt: null, note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a44', taskId: 't56', userId: 'u46', assignedHours: 13, actualHours: null, status: 'assigned', assignedAt: '2026-04-12T00:00:00.000Z', submittedAt: null, note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a45', taskId: 't58', userId: 'u43', assignedHours: 15, actualHours: 13, status: 'submitted', assignedAt: '2026-04-14T00:00:00.000Z', submittedAt: '2026-04-22T10:00:00.000Z', note: '', verificationStatus: 'reviewing', attachments: [], rejectionCount: 0 },
    { id: 'a46', taskId: 't59', userId: 'u13', assignedHours: 16, actualHours: 14, status: 'submitted', assignedAt: '2026-04-15T00:00:00.000Z', submittedAt: '2026-04-23T10:00:00.000Z', note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a47', taskId: 't60', userId: 'u9', assignedHours: 17, actualHours: 15, status: 'submitted', assignedAt: '2026-04-16T00:00:00.000Z', submittedAt: '2026-04-24T10:00:00.000Z', note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a48', taskId: 't62', userId: 'u27', assignedHours: 19, actualHours: null, status: 'assigned', assignedAt: '2026-04-18T00:00:00.000Z', submittedAt: null, note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a49', taskId: 't63', userId: 'u5', assignedHours: 20, actualHours: 18, status: 'approved', assignedAt: '2026-04-19T00:00:00.000Z', submittedAt: '2026-04-27T10:00:00.000Z', note: '', verificationStatus: 'verified', attachments: [], rejectionCount: 0 },
    { id: 'a50', taskId: 't64', userId: 'u22', assignedHours: 4, actualHours: 1, status: 'in_progress', assignedAt: '2026-04-20T00:00:00.000Z', submittedAt: null, note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a51', taskId: 't66', userId: 'u19', assignedHours: 6, actualHours: 2, status: 'in_progress', assignedAt: '2026-03-01T00:00:00.000Z', submittedAt: null, note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a52', taskId: 't68', userId: 'u13', assignedHours: 8, actualHours: null, status: 'assigned', assignedAt: '2026-03-03T00:00:00.000Z', submittedAt: null, note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a53', taskId: 't69', userId: 'u29', assignedHours: 9, actualHours: 3, status: 'in_progress', assignedAt: '2026-03-04T00:00:00.000Z', submittedAt: null, note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a54', taskId: 't70', userId: 'u25', assignedHours: 10, actualHours: 8, status: 'submitted', assignedAt: '2026-03-05T00:00:00.000Z', submittedAt: '2026-03-13T10:00:00.000Z', note: '', verificationStatus: 'reviewing', attachments: [], rejectionCount: 0 },
    { id: 'a55', taskId: 't72', userId: 'u46', assignedHours: 12, actualHours: 10, status: 'submitted', assignedAt: '2026-03-07T00:00:00.000Z', submittedAt: '2026-03-15T10:00:00.000Z', note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a56', taskId: 't76', userId: 'u31', assignedHours: 16, actualHours: 14, status: 'submitted', assignedAt: '2026-03-11T00:00:00.000Z', submittedAt: '2026-03-19T10:00:00.000Z', note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a57', taskId: 't77', userId: 'u10', assignedHours: 17, actualHours: 15, status: 'submitted', assignedAt: '2026-03-12T00:00:00.000Z', submittedAt: '2026-03-20T10:00:00.000Z', note: '', verificationStatus: 'reviewing', attachments: [], rejectionCount: 0 },
    { id: 'a58', taskId: 't79', userId: 'u43', assignedHours: 19, actualHours: 17, status: 'submitted', assignedAt: '2026-03-14T00:00:00.000Z', submittedAt: '2026-03-22T10:00:00.000Z', note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a59', taskId: 't80', userId: 'u39', assignedHours: 20, actualHours: null, status: 'assigned', assignedAt: '2026-03-15T00:00:00.000Z', submittedAt: null, note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a60', taskId: 't81', userId: 'u41', assignedHours: 4, actualHours: 3, status: 'approved', assignedAt: '2026-03-16T00:00:00.000Z', submittedAt: '2026-03-24T10:00:00.000Z', note: '', verificationStatus: 'verified', attachments: [], rejectionCount: 0 },
    { id: 'a61', taskId: 't84', userId: 'u3', assignedHours: 7, actualHours: 5, status: 'approved', assignedAt: '2026-03-19T00:00:00.000Z', submittedAt: '2026-03-27T10:00:00.000Z', note: '', verificationStatus: 'verified', attachments: [], rejectionCount: 0 },
    { id: 'a62', taskId: 't85', userId: 'u45', assignedHours: 8, actualHours: 3, status: 'in_progress', assignedAt: '2026-03-20T00:00:00.000Z', submittedAt: null, note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a63', taskId: 't86', userId: 'u4', assignedHours: 9, actualHours: 7, status: 'approved', assignedAt: '2026-03-21T00:00:00.000Z', submittedAt: '2026-03-29T10:00:00.000Z', note: '', verificationStatus: 'verified', attachments: [], rejectionCount: 0 },
    { id: 'a64', taskId: 't87', userId: 'u27', assignedHours: 10, actualHours: 4, status: 'in_progress', assignedAt: '2026-03-22T00:00:00.000Z', submittedAt: null, note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a65', taskId: 't88', userId: 'u46', assignedHours: 11, actualHours: 9, status: 'approved', assignedAt: '2026-03-23T00:00:00.000Z', submittedAt: '2026-04-01T10:00:00.000Z', note: '', verificationStatus: 'verified', attachments: [], rejectionCount: 0 },
    { id: 'a66', taskId: 't89', userId: 'u19', assignedHours: 12, actualHours: null, status: 'assigned', assignedAt: '2026-03-24T00:00:00.000Z', submittedAt: null, note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a67', taskId: 't90', userId: 'u13', assignedHours: 13, actualHours: 11, status: 'submitted', assignedAt: '2026-03-25T00:00:00.000Z', submittedAt: '2026-04-02T10:00:00.000Z', note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a68', taskId: 't91', userId: 'u16', assignedHours: 14, actualHours: 12, status: 'submitted', assignedAt: '2026-03-26T00:00:00.000Z', submittedAt: '2026-04-03T10:00:00.000Z', note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a69', taskId: 't92', userId: 'u40', assignedHours: 15, actualHours: 13, status: 'submitted', assignedAt: '2026-03-27T00:00:00.000Z', submittedAt: '2026-04-04T10:00:00.000Z', note: '', verificationStatus: 'reviewing', attachments: [], rejectionCount: 0 },
    { id: 'a70', taskId: 't93', userId: 'u12', assignedHours: 16, actualHours: 14, status: 'submitted', assignedAt: '2026-03-28T00:00:00.000Z', submittedAt: '2026-04-05T10:00:00.000Z', note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a71', taskId: 't94', userId: 'u33', assignedHours: 17, actualHours: null, status: 'assigned', assignedAt: '2026-03-29T00:00:00.000Z', submittedAt: null, note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a72', taskId: 't95', userId: 'u25', assignedHours: 18, actualHours: null, status: 'assigned', assignedAt: '2026-03-30T00:00:00.000Z', submittedAt: null, note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a73', taskId: 't96', userId: 'u30', assignedHours: 19, actualHours: 17, status: 'approved', assignedAt: '2026-03-31T00:00:00.000Z', submittedAt: '2026-04-08T10:00:00.000Z', note: '', verificationStatus: 'verified', attachments: [], rejectionCount: 0 },
    { id: 'a74', taskId: 't97', userId: 'u12', assignedHours: 20, actualHours: 18, status: 'approved', assignedAt: '2026-04-01T00:00:00.000Z', submittedAt: '2026-04-09T10:00:00.000Z', note: '', verificationStatus: 'verified', attachments: [], rejectionCount: 0 },
    { id: 'a75', taskId: 't99', userId: 'u43', assignedHours: 5, actualHours: 2, status: 'in_progress', assignedAt: '2026-04-03T00:00:00.000Z', submittedAt: null, note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a76', taskId: 't100', userId: 'u35', assignedHours: 6, actualHours: 5, status: 'submitted', assignedAt: '2026-04-04T00:00:00.000Z', submittedAt: '2026-04-12T10:00:00.000Z', note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a77', taskId: 't102', userId: 'u21', assignedHours: 8, actualHours: 6, status: 'submitted', assignedAt: '2026-04-06T00:00:00.000Z', submittedAt: '2026-04-14T10:00:00.000Z', note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a78', taskId: 't103', userId: 'u31', assignedHours: 9, actualHours: 7, status: 'approved', assignedAt: '2026-04-07T00:00:00.000Z', submittedAt: '2026-04-15T10:00:00.000Z', note: '', verificationStatus: 'verified', attachments: [], rejectionCount: 0 },
    { id: 'a79', taskId: 't106', userId: 'u45', assignedHours: 12, actualHours: null, status: 'assigned', assignedAt: '2026-04-10T00:00:00.000Z', submittedAt: null, note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a80', taskId: 't107', userId: 'u27', assignedHours: 13, actualHours: null, status: 'assigned', assignedAt: '2026-04-11T00:00:00.000Z', submittedAt: null, note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a81', taskId: 't108', userId: 'u38', assignedHours: 14, actualHours: null, status: 'assigned', assignedAt: '2026-04-12T00:00:00.000Z', submittedAt: null, note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
    { id: 'a82', taskId: 't109', userId: 'u18', assignedHours: 15, actualHours: 13, status: 'approved', assignedAt: '2026-04-13T00:00:00.000Z', submittedAt: '2026-04-21T10:00:00.000Z', note: '', verificationStatus: 'verified', attachments: [], rejectionCount: 0 },
    { id: 'a83', taskId: 't112', userId: 'u36', assignedHours: 18, actualHours: 16, status: 'submitted', assignedAt: '2026-04-16T00:00:00.000Z', submittedAt: '2026-04-24T10:00:00.000Z', note: '', verificationStatus: null, attachments: [], rejectionCount: 0 },
  ],
  examInputs: [],
  evaluationCriteria: [
    { id: 'ec1', name: '添削精度', description: '採点・添削の正確さ', maxScore: 5, subject: null, autoMetric: null },
    { id: 'ec2', name: '処理速度', description: '単位時間あたりの処理件数', maxScore: 5, subject: null, autoMetric: null },
    { id: 'ec3', name: '経験年数', description: '添削業務の経験年数', maxScore: 5, subject: null, autoMetric: null },
  ],
  evaluations: [
    { id: 'ev1', userId: 'u2', criteriaId: 'ec1', score: 4, note: '精度高い', updatedAt: '2026-01-15T00:00:00.000Z', subject: null, autoScore: null, isOverridden: false },
    { id: 'ev2', userId: 'u2', criteriaId: 'ec2', score: 3, note: '', updatedAt: '2026-01-15T00:00:00.000Z', subject: null, autoScore: null, isOverridden: false },
    { id: 'ev3', userId: 'u2', criteriaId: 'ec3', score: 4, note: '4年目', updatedAt: '2026-01-15T00:00:00.000Z', subject: null, autoScore: null, isOverridden: false },
    { id: 'ev4', userId: 'u3', criteriaId: 'ec1', score: 5, note: 'とても正確', updatedAt: '2026-01-15T00:00:00.000Z', subject: null, autoScore: null, isOverridden: false },
    { id: 'ev5', userId: 'u3', criteriaId: 'ec2', score: 4, note: '', updatedAt: '2026-01-15T00:00:00.000Z', subject: null, autoScore: null, isOverridden: false },
    { id: 'ev6', userId: 'u3', criteriaId: 'ec3', score: 3, note: '3年目', updatedAt: '2026-01-15T00:00:00.000Z', subject: null, autoScore: null, isOverridden: false },
    { id: 'ev7', userId: 'u4', criteriaId: 'ec1', score: 3, note: '', updatedAt: '2026-01-15T00:00:00.000Z', subject: null, autoScore: null, isOverridden: false },
    { id: 'ev8', userId: 'u4', criteriaId: 'ec2', score: 5, note: '処理が速い', updatedAt: '2026-01-15T00:00:00.000Z', subject: null, autoScore: null, isOverridden: false },
    { id: 'ev9', userId: 'u4', criteriaId: 'ec3', score: 5, note: '5年目', updatedAt: '2026-01-15T00:00:00.000Z', subject: null, autoScore: null, isOverridden: false },
    { id: 'ev10', userId: 'u5', criteriaId: 'ec1', score: 4, note: '', updatedAt: '2026-01-15T00:00:00.000Z', subject: null, autoScore: null, isOverridden: false },
    { id: 'ev11', userId: 'u5', criteriaId: 'ec2', score: 4, note: '', updatedAt: '2026-01-15T00:00:00.000Z', subject: null, autoScore: null, isOverridden: false },
    { id: 'ev12', userId: 'u5', criteriaId: 'ec3', score: 2, note: '2年目', updatedAt: '2026-01-15T00:00:00.000Z', subject: null, autoScore: null, isOverridden: false },
  ],
  notifications: [],
  reviewMemos: [],
  recruitments: [],
  applications: [],
  timeLogs: [
    // 山田太郎 (u2) — t5: 国語, t9: 国語
    { id: 'tl1', assignmentId: 'a1', taskId: 't5', userId: 'u2', daimonId: 1, startTime: '2026-02-25T09:00:00.000Z', endTime: '2026-02-25T11:30:00.000Z', duration: 9000 },
    { id: 'tl2', assignmentId: 'a1', taskId: 't5', userId: 'u2', daimonId: 2, startTime: '2026-02-25T13:00:00.000Z', endTime: '2026-02-25T15:45:00.000Z', duration: 9900 },
    { id: 'tl3', assignmentId: 'a1', taskId: 't5', userId: 'u2', daimonId: 3, startTime: '2026-02-26T09:00:00.000Z', endTime: '2026-02-26T12:20:00.000Z', duration: 12000 },
    { id: 'tl4', assignmentId: 'a5', taskId: 't9', userId: 'u2', daimonId: 1, startTime: '2026-02-27T09:00:00.000Z', endTime: '2026-02-27T13:00:00.000Z', duration: 14400 },
    { id: 'tl5', assignmentId: 'a5', taskId: 't9', userId: 'u2', daimonId: 2, startTime: '2026-02-28T09:00:00.000Z', endTime: '2026-02-28T14:30:00.000Z', duration: 19800 },
    { id: 'tl6', assignmentId: 'a5', taskId: 't9', userId: 'u2', daimonId: 3, startTime: '2026-03-01T09:00:00.000Z', endTime: '2026-03-01T12:00:00.000Z', duration: 10800 },
    // 鈴木花子 (u3) — t6: 算数, t10: 算数
    { id: 'tl7', assignmentId: 'a2', taskId: 't6', userId: 'u3', daimonId: 1, startTime: '2026-02-24T09:00:00.000Z', endTime: '2026-02-24T12:00:00.000Z', duration: 10800 },
    { id: 'tl8', assignmentId: 'a2', taskId: 't6', userId: 'u3', daimonId: 2, startTime: '2026-02-24T13:00:00.000Z', endTime: '2026-02-24T15:00:00.000Z', duration: 7200 },
    { id: 'tl9', assignmentId: 'a2', taskId: 't6', userId: 'u3', daimonId: 3, startTime: '2026-02-25T09:00:00.000Z', endTime: '2026-02-25T11:30:00.000Z', duration: 9000 },
    { id: 'tl10', assignmentId: 'a6', taskId: 't10', userId: 'u3', daimonId: 1, startTime: '2026-02-20T09:00:00.000Z', endTime: '2026-02-20T12:30:00.000Z', duration: 12600 },
    { id: 'tl11', assignmentId: 'a6', taskId: 't10', userId: 'u3', daimonId: 2, startTime: '2026-02-21T09:00:00.000Z', endTime: '2026-02-21T11:00:00.000Z', duration: 7200 },
    // 佐藤一郎 (u4) — t8: 社会, t12: 社会
    { id: 'tl12', assignmentId: 'a4', taskId: 't8', userId: 'u4', daimonId: 1, startTime: '2026-02-24T09:00:00.000Z', endTime: '2026-02-24T11:00:00.000Z', duration: 7200 },
    { id: 'tl13', assignmentId: 'a4', taskId: 't8', userId: 'u4', daimonId: 2, startTime: '2026-02-24T13:00:00.000Z', endTime: '2026-02-24T16:00:00.000Z', duration: 10800 },
    { id: 'tl14', assignmentId: 'a8', taskId: 't12', userId: 'u4', daimonId: 1, startTime: '2026-02-22T09:00:00.000Z', endTime: '2026-02-22T13:00:00.000Z', duration: 14400 },
    { id: 'tl15', assignmentId: 'a8', taskId: 't12', userId: 'u4', daimonId: 2, startTime: '2026-02-23T09:00:00.000Z', endTime: '2026-02-23T11:30:00.000Z', duration: 9000 },
    // 田中美咲 (u5) — t7: 理科, t11: 理科
    { id: 'tl16', assignmentId: 'a3', taskId: 't7', userId: 'u5', daimonId: 1, startTime: '2026-02-26T09:00:00.000Z', endTime: '2026-02-26T12:00:00.000Z', duration: 10800 },
    { id: 'tl17', assignmentId: 'a3', taskId: 't7', userId: 'u5', daimonId: 2, startTime: '2026-02-26T13:00:00.000Z', endTime: '2026-02-26T17:00:00.000Z', duration: 14400 },
    { id: 'tl18', assignmentId: 'a3', taskId: 't7', userId: 'u5', daimonId: 3, startTime: '2026-02-27T09:00:00.000Z', endTime: '2026-02-27T12:30:00.000Z', duration: 12600 },
    { id: 'tl19', assignmentId: 'a7', taskId: 't11', userId: 'u5', daimonId: 1, startTime: '2026-02-22T09:00:00.000Z', endTime: '2026-02-22T14:00:00.000Z', duration: 18000 },
    { id: 'tl20', assignmentId: 'a7', taskId: 't11', userId: 'u5', daimonId: 2, startTime: '2026-02-23T09:00:00.000Z', endTime: '2026-02-23T13:00:00.000Z', duration: 14400 },
  ],
  rejectionCategories: [
    { id: 'rc1', name: '誤採点', description: '配点の計算ミスや採点基準の誤適用', subject: null, workType: null, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'rc2', name: '添削漏れ', description: '採点すべき箇所の見落とし', subject: null, workType: null, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'rc3', name: 'コメント不備', description: '添削コメントの誤りや不足', subject: null, workType: null, createdAt: '2026-01-01T00:00:00.000Z' },
  ],
  rejectionSeverities: [
    { id: 'rs1', name: '軽微', level: 1, description: '軽微な修正で済むミス', color: '#f59e0b', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'rs2', name: '中程度', level: 3, description: '一定の修正が必要なミス', color: '#f97316', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'rs3', name: '重大', level: 5, description: '重大な影響があるミス', color: '#ef4444', createdAt: '2026-01-01T00:00:00.000Z' },
  ],
  rejections: [
    // 山田太郎 (u2) — 差し戻し1回（軽微）
    { id: 'rej1', userId: 'u2', taskId: 't5', assignmentId: 'a1', categoryId: 'rc3', severityId: 'rs1', note: 'コメントに一部誤字あり', rejectedBy: 'u1', createdAt: '2026-03-01T12:00:00.000Z' },
    // 鈴木花子 (u3) — 差し戻しなし（優秀）
    // 佐藤一郎 (u4) — 差し戻し3回（多め）
    { id: 'rej2', userId: 'u4', taskId: 't8', assignmentId: 'a4', categoryId: 'rc1', severityId: 'rs2', note: '大問2の配点ミス', rejectedBy: 'u1', createdAt: '2026-03-01T17:00:00.000Z' },
    { id: 'rej3', userId: 'u4', taskId: 't12', assignmentId: 'a8', categoryId: 'rc2', severityId: 'rs1', note: '小問3の採点漏れ', rejectedBy: 'u1', createdAt: '2026-02-28T11:00:00.000Z' },
    { id: 'rej4', userId: 'u4', taskId: 't12', assignmentId: 'a8', categoryId: 'rc1', severityId: 'rs3', note: '合計点の計算間違い', rejectedBy: 'u1', createdAt: '2026-02-27T14:00:00.000Z' },
    // 田中美咲 (u5) — 差し戻し2回（中程度）
    { id: 'rej5', userId: 'u5', taskId: 't7', assignmentId: 'a3', categoryId: 'rc2', severityId: 'rs2', note: '大問3の一部未採点', rejectedBy: 'u1', createdAt: '2026-03-02T10:00:00.000Z' },
    { id: 'rej6', userId: 'u5', taskId: 't11', assignmentId: 'a7', categoryId: 'rc3', severityId: 'rs1', note: 'フィードバックコメントが不十分', rejectedBy: 'u1', createdAt: '2026-02-27T13:00:00.000Z' },
  ],
  verificationItems: [
    { id: 'vi1', name: '配点の正確性', description: '各問の配点が採点基準と一致しているか', subject: null, sortOrder: 1, isRequired: true, purpose: 'verification', workType: null, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'vi2', name: '合計点の計算', description: '合計点が各問の配点の合算と一致しているか', subject: null, sortOrder: 2, isRequired: true, purpose: 'verification', workType: null, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'vi3', name: '添削コメントの確認', description: '添削コメントが適切かつ十分か', subject: null, sortOrder: 3, isRequired: false, purpose: 'verification', workType: null, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'vi4', name: '漢字の正誤確認', description: '漢字の正誤判定が正しいか', subject: '国語', sortOrder: 1, isRequired: true, purpose: 'verification', workType: null, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'vi5', name: '計算過程の確認', description: '途中式の採点が正しいか', subject: '算数', sortOrder: 1, isRequired: true, purpose: 'verification', workType: null, createdAt: '2026-01-01T00:00:00.000Z' },
  ],
  feedbacks: [],
  fields: [
    // 理科 - 化学
    { id: 'fld_r1', name: '中和', subject: '理科', category: '化学', sortOrder: 1, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_r2', name: '燃焼', subject: '理科', category: '化学', sortOrder: 2, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_r3', name: '熱', subject: '理科', category: '化学', sortOrder: 3, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_r4', name: '溶解度', subject: '理科', category: '化学', sortOrder: 4, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_r5', name: '状態', subject: '理科', category: '化学', sortOrder: 5, createdAt: '2026-01-01T00:00:00.000Z' },
    // 理科 - 物理
    { id: 'fld_r6', name: 'てこ', subject: '理科', category: '物理', sortOrder: 6, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_r7', name: '滑車', subject: '理科', category: '物理', sortOrder: 7, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_r8', name: '電気', subject: '理科', category: '物理', sortOrder: 8, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_r9', name: 'ばね', subject: '理科', category: '物理', sortOrder: 9, createdAt: '2026-01-01T00:00:00.000Z' },
    // 理科 - 生物
    { id: 'fld_r10', name: '光合成', subject: '理科', category: '生物', sortOrder: 10, createdAt: '2026-01-01T00:00:00.000Z' },
    // 理科 - 地学
    { id: 'fld_r11', name: '星座', subject: '理科', category: '地学', sortOrder: 11, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_r12', name: '月', subject: '理科', category: '地学', sortOrder: 12, createdAt: '2026-01-01T00:00:00.000Z' },
    // 算数
    { id: 'fld_m1', name: '割合の線分図', subject: '算数', category: null, sortOrder: 1, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m2', name: '仕事算＋ニュートン算', subject: '算数', category: null, sortOrder: 2, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m3', name: '食塩水', subject: '算数', category: null, sortOrder: 3, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m4', name: 'つるかめ算', subject: '算数', category: null, sortOrder: 4, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m5', name: '旅人算', subject: '算数', category: null, sortOrder: 5, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m6', name: '約数・倍数', subject: '算数', category: null, sortOrder: 6, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m7', name: '角度や面積', subject: '算数', category: null, sortOrder: 7, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m8', name: '移動範囲', subject: '算数', category: null, sortOrder: 8, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m9', name: '回転・転がり移動', subject: '算数', category: null, sortOrder: 9, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m10', name: '図形の移動', subject: '算数', category: null, sortOrder: 10, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m11', name: '植木算', subject: '算数', category: null, sortOrder: 11, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m12', name: '数列・数表', subject: '算数', category: null, sortOrder: 12, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m13', name: '消去算', subject: '算数', category: null, sortOrder: 13, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m14', name: '差集め算', subject: '算数', category: null, sortOrder: 14, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m15', name: '比体積・表面積', subject: '算数', category: null, sortOrder: 15, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m16', name: '投影図・回転体と比', subject: '算数', category: null, sortOrder: 16, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m17', name: '水量グラフ', subject: '算数', category: null, sortOrder: 17, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m18', name: '周期', subject: '算数', category: null, sortOrder: 18, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m19', name: 'N進法', subject: '算数', category: null, sortOrder: 19, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m20', name: '速さの特殊算', subject: '算数', category: null, sortOrder: 20, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m21', name: '法陣算', subject: '算数', category: null, sortOrder: 21, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m22', name: '立体の切断', subject: '算数', category: null, sortOrder: 22, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m23', name: '点の移動', subject: '算数', category: null, sortOrder: 23, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m24', name: '和差(消去算以外)', subject: '算数', category: null, sortOrder: 24, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m25', name: '売買損益', subject: '算数', category: null, sortOrder: 25, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m26', name: '速さと比', subject: '算数', category: null, sortOrder: 26, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m27', name: '数に関する問題', subject: '算数', category: null, sortOrder: 27, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m28', name: '条件整理', subject: '算数', category: null, sortOrder: 28, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m29', name: '場合の数', subject: '算数', category: null, sortOrder: 29, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'fld_m30', name: '操作', subject: '算数', category: null, sortOrder: 30, createdAt: '2026-01-01T00:00:00.000Z' },
  ],
  userFields: [],
  verificationResults: [],
  workflowStatuses: [
    { id: 'ws1', subject: null, workType: null, name: 'pending', label: '未振り分け', color: '#f59e0b', sortOrder: 0, isDefault: true, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'ws3', subject: null, workType: null, name: 'in_progress', label: '作業中', color: '#0ea5e9', sortOrder: 1, isDefault: true, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'ws5', subject: null, workType: null, name: 'verification_waiting', label: '検証待ち', color: '#f97316', sortOrder: 2, isDefault: true, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'ws6', subject: null, workType: null, name: 'verification_reviewing', label: '検証中', color: '#eab308', sortOrder: 3, isDefault: true, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'ws7', subject: null, workType: null, name: 'verification_completed', label: '検証完了', color: '#10b981', sortOrder: 4, isDefault: true, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'ws8', subject: null, workType: null, name: 'macro_pending', label: 'マクロ未作成', color: '#ef4444', sortOrder: 5, isDefault: true, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'ws9', subject: null, workType: null, name: 'macro_completed', label: '作成完了', color: '#22c55e', sortOrder: 6, isDefault: true, createdAt: '2026-01-01T00:00:00.000Z' },
  ],
  workTypes: [
    { id: 'wt1', name: '新年度試験種', sortOrder: 1, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'wt2', name: 'タグ付け', sortOrder: 2, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'wt3', name: '解答出し', sortOrder: 3, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'wt4', name: '部分点', sortOrder: 4, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'wt5', name: 'tensakitインポート', sortOrder: 5, createdAt: '2026-01-01T00:00:00.000Z' },
  ],
  manuals: [],
};

export const SUBJECTS_LIST = ['国語', '算数', '理科', '社会'];

export const WORK_TYPES_LIST = ['新年度試験種', 'タグ付け', '解答出し', '部分点', 'tensakitインポート', 'takos作成'];

export const generateId = () =>
  Math.random().toString(36).substr(2, 9) + Date.now().toString(36);

export const generateInitialPassword = () => {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let pw = '';
  for (let i = 0; i < 8; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
};

export const generateLoginId = (role) => {
  const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  const users = data.users || [];
  const prefix = role === 'leader' ? 'L' : 'T';
  const existing = users
    .filter(u => u.loginId && u.loginId.startsWith(prefix))
    .map(u => parseInt(u.loginId.slice(1), 10))
    .filter(n => !isNaN(n));
  const next = existing.length > 0 ? Math.max(...existing) + 1 : 1;
  return `${prefix}${String(next).padStart(3, '0')}`;
};

export const initStorage = () => {
  if (!localStorage.getItem(STORAGE_KEY)) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_DATA));
  } else {
    // マイグレーション: 新しいキーがなければ追加
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    let updated = false;
    if (!data.timeLogs) { data.timeLogs = []; updated = true; }
    if (!data.recruitments) { data.recruitments = []; updated = true; }
    if (!data.applications) { data.applications = []; updated = true; }
    // loginId migration
    if (data.users && data.users.some(u => !u.loginId)) {
      let leaderIdx = 1, correctorIdx = 1;
      data.users = data.users.map(u => {
        if (u.loginId) return u;
        const prefix = u.role === 'leader' ? 'L' : 'T';
        const idx = u.role === 'leader' ? leaderIdx++ : correctorIdx++;
        return { ...u, loginId: `${prefix}${String(idx).padStart(3, '0')}` };
      });
      updated = true;
    }
    if (!data.rejectionCategories) { data.rejectionCategories = []; updated = true; }
    // rejectionCategories workType マイグレーション
    if (data.rejectionCategories && data.rejectionCategories.some(c => c.workType === undefined)) {
      data.rejectionCategories = data.rejectionCategories.map(c => ({ ...c, workType: c.workType ?? null }));
      updated = true;
    }
    if (!data.rejectionSeverities) { data.rejectionSeverities = []; updated = true; }
    if (!data.rejections) { data.rejections = []; updated = true; }
    // fields/userFields マイグレーション
    if (!data.fields) { data.fields = INITIAL_DATA.fields || []; updated = true; }
    if (!data.userFields) { data.userFields = []; updated = true; }
    // fields 初期データ追記マイグレーション
    if (!data._demoFieldsV1) {
      const demoFields = INITIAL_DATA.fields || [];
      const existingIds = new Set((data.fields || []).map(f => f.id));
      for (const f of demoFields) {
        if (!existingIds.has(f.id)) data.fields.push(f);
      }
      data._demoFieldsV1 = true;
      updated = true;
    }
    // evaluationCriteria migration
    if (data.evaluationCriteria && data.evaluationCriteria.length > 0 && data.evaluationCriteria[0].subject === undefined) {
      data.evaluationCriteria = data.evaluationCriteria.map(c => ({
        ...c, subject: c.subject ?? null, autoMetric: c.autoMetric ?? null,
      }));
      updated = true;
    }
    // evaluations migration
    if (data.evaluations && data.evaluations.length > 0 && data.evaluations[0].subject === undefined) {
      data.evaluations = data.evaluations.map(e => ({
        ...e, subject: e.subject ?? null, autoScore: e.autoScore ?? null, isOverridden: e.isOverridden ?? false,
      }));
      updated = true;
    }
    // 試験種処理デモデータ追記マイグレーション
    if (!data._demoExamProcessingV1) {
      const demoTasks = INITIAL_DATA.tasks.filter(t => ['t5','t6','t7','t8','t9','t10','t11','t12'].includes(t.id));
      const demoAssignments = INITIAL_DATA.assignments.filter(a => ['a1','a2','a3','a4','a5','a6','a7','a8'].includes(a.id));
      const existingTaskIds = new Set((data.tasks || []).map(t => t.id));
      const existingAssignmentIds = new Set((data.assignments || []).map(a => a.id));
      for (const t of demoTasks) {
        if (!existingTaskIds.has(t.id)) {
          data.tasks = data.tasks || [];
          data.tasks.push(t);
        }
      }
      for (const a of demoAssignments) {
        if (!existingAssignmentIds.has(a.id)) {
          data.assignments = data.assignments || [];
          data.assignments.push(a);
        }
      }
      data._demoExamProcessingV1 = true;
      updated = true;
    }
    // 差し戻し・作業時間デモデータ追記マイグレーション
    if (!data._demoEvalDataV1) {
      const demoTimeLogs = INITIAL_DATA.timeLogs || [];
      const demoRejections = INITIAL_DATA.rejections || [];
      const existingTlIds = new Set((data.timeLogs || []).map(t => t.id));
      const existingRejIds = new Set((data.rejections || []).map(r => r.id));
      data.timeLogs = data.timeLogs || [];
      data.rejections = data.rejections || [];
      for (const tl of demoTimeLogs) {
        if (!existingTlIds.has(tl.id)) data.timeLogs.push(tl);
      }
      for (const r of demoRejections) {
        if (!existingRejIds.has(r.id)) data.rejections.push(r);
      }
      data._demoEvalDataV1 = true;
      updated = true;
    }
    // feedbacks マイグレーション
    if (!data.feedbacks) { data.feedbacks = []; updated = true; }
    // 検証項目マイグレーション
    if (!data.verificationItems) { data.verificationItems = []; updated = true; }
    if (!data.verificationResults) { data.verificationResults = []; updated = true; }
    // purpose/workType マイグレーション
    if (data.verificationItems && data.verificationItems.some(vi => vi.purpose === undefined)) {
      data.verificationItems = data.verificationItems.map(vi => ({
        ...vi,
        purpose: vi.purpose ?? 'verification',
        workType: vi.workType ?? null,
      }));
      updated = true;
    }
    if (!data.workflowStatuses) { data.workflowStatuses = INITIAL_DATA.workflowStatuses || []; updated = true; }
    // マクロステータス追加マイグレーション
    if (data.workflowStatuses && !data.workflowStatuses.find(ws => ws.name === 'macro_pending')) {
      // 不要なステータスを削除（assigned, submitted）
      data.workflowStatuses = data.workflowStatuses.filter(ws => !['assigned', 'submitted'].includes(ws.name));
      // マクロステータスを追加
      data.workflowStatuses.push(
        { id: 'ws8', subject: null, workType: null, name: 'macro_pending', label: 'マクロ未作成', color: '#ef4444', sortOrder: 5, isDefault: true, createdAt: '2026-01-01T00:00:00.000Z' },
        { id: 'ws9', subject: null, workType: null, name: 'macro_completed', label: '作成完了', color: '#22c55e', sortOrder: 6, isDefault: true, createdAt: '2026-01-01T00:00:00.000Z' }
      );
      // sortOrderを再調整
      const desiredOrder = ['pending', 'in_progress', 'verification_waiting', 'verification_reviewing', 'verification_completed', 'macro_pending', 'macro_completed'];
      data.workflowStatuses.forEach(ws => {
        const idx = desiredOrder.indexOf(ws.name);
        if (idx >= 0) ws.sortOrder = idx;
      });
      updated = true;
    }
    if (!data.workTypes) { data.workTypes = INITIAL_DATA.workTypes || []; updated = true; }
    if (!data._demoVerificationV1) {
      const demoItems = INITIAL_DATA.verificationItems || [];
      const existingViIds = new Set(data.verificationItems.map(vi => vi.id));
      for (const vi of demoItems) {
        if (!existingViIds.has(vi.id)) data.verificationItems.push(vi);
      }
      data._demoVerificationV1 = true;
      updated = true;
    }
    // === 大量デモデータ追記マイグレーション ===
    if (!data._demoBulkDataV1) {
      // 新規ユーザー追加
      const existingUserIds = new Set((data.users || []).map(u => u.id));
      for (const u of INITIAL_DATA.users) {
        if (!existingUserIds.has(u.id)) {
          data.users = data.users || [];
          data.users.push(u);
        }
      }
      // 新規学校追加
      const existingSchoolIds = new Set((data.schools || []).map(s => s.id));
      for (const s of INITIAL_DATA.schools) {
        if (!existingSchoolIds.has(s.id)) {
          data.schools = data.schools || [];
          data.schools.push(s);
        }
      }
      // 新規タスク追加
      const existingTaskIds2 = new Set((data.tasks || []).map(t => t.id));
      for (const t of INITIAL_DATA.tasks) {
        if (!existingTaskIds2.has(t.id)) {
          data.tasks = data.tasks || [];
          data.tasks.push(t);
        }
      }
      // 新規振り分け追加
      const existingAssignIds2 = new Set((data.assignments || []).map(a => a.id));
      for (const a of INITIAL_DATA.assignments) {
        if (!existingAssignIds2.has(a.id)) {
          data.assignments = data.assignments || [];
          data.assignments.push(a);
        }
      }
      // 新規キャパシティ追加
      const existingCapIds = new Set((data.capacities || []).map(c => c.id));
      for (const c of INITIAL_DATA.capacities) {
        if (!existingCapIds.has(c.id)) {
          data.capacities = data.capacities || [];
          data.capacities.push(c);
        }
      }
      data._demoBulkDataV1 = true;
      updated = true;
    }
    // === 新年度試験種デモデータ（4科目） ===
    if (!data._demoExamInputV1) {
      // 鈴木花子の科目を全科目に更新
      const suzuki = (data.users || []).find(u => u.id === 'u3');
      if (suzuki) suzuki.subjects = ['算数', '理科', '国語', '社会'];

      // デモタスク4件
      const demoTasks = [
        { id: 'td_sansu', name: '成城学園 算数 第1回', schoolId: 's1', subject: '算数', workType: '新年度試験種', status: 'assigned', assignedHours: 12, deadline: '2026-04-10', createdAt: '2026-03-12T00:00:00.000Z', note: '新年度試験種デモ' },
        { id: 'td_kokugo', name: '浅野 国語 第1回', schoolId: 's2', subject: '国語', workType: '新年度試験種', status: 'assigned', assignedHours: 15, deadline: '2026-04-12', createdAt: '2026-03-12T00:00:00.000Z', note: '新年度試験種デモ' },
        { id: 'td_shakai', name: '渋谷教育学園幕張 社会 第1回', schoolId: 's3', subject: '社会', workType: '新年度試験種', status: 'assigned', assignedHours: 10, deadline: '2026-04-08', createdAt: '2026-03-12T00:00:00.000Z', note: '新年度試験種デモ' },
        { id: 'td_rika', name: 'サレジオ学院 理科 第1回', schoolId: 's4', subject: '理科', workType: '新年度試験種', status: 'assigned', assignedHours: 14, deadline: '2026-04-15', createdAt: '2026-03-12T00:00:00.000Z', note: '新年度試験種デモ' },
      ];
      const existingTaskIds = new Set((data.tasks || []).map(t => t.id));
      for (const t of demoTasks) { if (!existingTaskIds.has(t.id)) { data.tasks = data.tasks || []; data.tasks.push(t); } }

      // デモ割り当て4件（全部鈴木花子 u3）
      const demoAssignments = [
        { id: 'ad_sansu', taskId: 'td_sansu', userId: 'u3', correctorId: 'u3', correctorName: '鈴木花子', correctorLoginId: 'T002', assignedHours: 12, status: 'assigned', assignedAt: '2026-03-12T00:00:00.000Z', note: '新年度試験種デモ' },
        { id: 'ad_kokugo', taskId: 'td_kokugo', userId: 'u3', correctorId: 'u3', correctorName: '鈴木花子', correctorLoginId: 'T002', assignedHours: 15, status: 'assigned', assignedAt: '2026-03-12T00:00:00.000Z', note: '新年度試験種デモ' },
        { id: 'ad_shakai', taskId: 'td_shakai', userId: 'u3', correctorId: 'u3', correctorName: '鈴木花子', correctorLoginId: 'T002', assignedHours: 10, status: 'assigned', assignedAt: '2026-03-12T00:00:00.000Z', note: '新年度試験種デモ' },
        { id: 'ad_rika', taskId: 'td_rika', userId: 'u3', correctorId: 'u3', correctorName: '鈴木花子', correctorLoginId: 'T002', assignedHours: 14, status: 'assigned', assignedAt: '2026-03-12T00:00:00.000Z', note: '新年度試験種デモ' },
      ];
      const existingAsnIds = new Set((data.assignments || []).map(a => a.id));
      for (const a of demoAssignments) { if (!existingAsnIds.has(a.id)) { data.assignments = data.assignments || []; data.assignments.push(a); } }

      // デモexamInput4件
      const demoExamInputs = [
        // 算数 - 成城学園
        { id: 'ei_sansu', taskId: 'td_sansu', userId: 'u3', status: 'draft', 年度: '2017', 学校名: '成城学園', 回数: '1', 科目: '算数', 試験時間: '50分',
          大問リスト: [
            { 大問番号: '1', 満点: '20', 文種: '', 出典: '', 著者: '', テーマ: '', 問リスト: [
              { 小問名: '(1)', 枝問リスト: [{ edaId: 'e1', 枝問名: '', 模範解答: '35', 配点: '4', 完答: false, 順不同: false, 別解: '', 解説: '7×5=35', 解説画像: '', 解答画像: '', 条件指定: '', 条件指定要素: '', 不可解答: '', 採点基準: [], 採点基準テキスト: '' }] },
              { 小問名: '(2)', 枝問リスト: [{ edaId: 'e2', 枝問名: '', 模範解答: '128', 配点: '4', 完答: false, 順不同: false, 別解: '', 解説: '2^7=128', 解説画像: '', 解答画像: '', 条件指定: '', 条件指定要素: '', 不可解答: '', 採点基準: [], 採点基準テキスト: '' }] },
              { 小問名: '(3)', 枝問リスト: [{ edaId: 'e3', 枝問名: '', 模範解答: '3/4', 配点: '4', 完答: false, 順不同: false, 別解: '', 解説: '分数の計算', 解説画像: '', 解答画像: '', 条件指定: '', 条件指定要素: '', 不可解答: '', 採点基準: [], 採点基準テキスト: '' }] },
              { 小問名: '(4)', 枝問リスト: [{ edaId: 'e4', 枝問名: '', 模範解答: '15cm²', 配点: '4', 完答: false, 順不同: false, 別解: '', 解説: '底辺×高さ÷2', 解説画像: '', 解答画像: '', 条件指定: '', 条件指定要素: '', 不可解答: '', 採点基準: [], 採点基準テキスト: '' }] },
              { 小問名: '(5)', 枝問リスト: [{ edaId: 'e5', 枝問名: '', 模範解答: '72°', 配点: '4', 完答: false, 順不同: false, 別解: '', 解説: '360÷5=72', 解説画像: '', 解答画像: '', 条件指定: '', 条件指定要素: '', 不可解答: '', 採点基準: [], 採点基準テキスト: '' }] },
            ] },
            { 大問番号: '2', 満点: '40', 文種: '', 出典: '', 著者: '', テーマ: '', 問リスト: [
              { 小問名: '(1)', 枝問リスト: [{ edaId: 'e6', 枝問名: '', 模範解答: '時速48km', 配点: '8', 完答: false, 順不同: false, 別解: '', 解説: '距離÷時間', 解説画像: '', 解答画像: '', 条件指定: '', 条件指定要素: '', 不可解答: '', 採点基準: [], 採点基準テキスト: '' }] },
              { 小問名: '(2)', 枝問リスト: [{ edaId: 'e7', 枝問名: '', 模範解答: '2時間30分', 配点: '8', 完答: false, 順不同: false, 別解: '', 解説: '旅人算', 解説画像: '', 解答画像: '', 条件指定: '', 条件指定要素: '', 不可解答: '', 採点基準: [], 採点基準テキスト: '' }] },
              { 小問名: '(3)', 枝問リスト: [
                { edaId: 'e8', 枝問名: 'ア', 模範解答: '120km', 配点: '8', 完答: false, 順不同: false, 別解: '', 解説: 'A地点からの距離', 解説画像: '', 解答画像: '', 条件指定: '', 条件指定要素: '', 不可解答: '', 採点基準: [], 採点基準テキスト: '' },
                { edaId: 'e9', 枝問名: 'イ', 模範解答: '80km', 配点: '8', 完答: false, 順不同: false, 別解: '', 解説: 'B地点からの距離', 解説画像: '', 解答画像: '', 条件指定: '', 条件指定要素: '', 不可解答: '', 採点基準: [], 採点基準テキスト: '' },
              ] },
              { 小問名: '(4)', 枝問リスト: [{ edaId: 'e10', 枝問名: '', 模範解答: '午前10時15分', 配点: '8', 完答: false, 順不同: false, 別解: '', 解説: 'ダイヤグラムから読み取り', 解説画像: '', 解答画像: '', 条件指定: '', 条件指定要素: '', 不可解答: '', 採点基準: [], 採点基準テキスト: '' }] },
            ] },
            { 大問番号: '3', 満点: '12', 文種: '', 出典: '', 著者: '', テーマ: '', 問リスト: [
              { 小問名: '(1)', 枝問リスト: [{ edaId: 'e11', 枝問名: '', 模範解答: '56cm²', 配点: '6', 完答: false, 順不同: false, 別解: '', 解説: '長方形の面積', 解説画像: '', 解答画像: '', 条件指定: '', 条件指定要素: '', 不可解答: '', 採点基準: [], 採点基準テキスト: '' }] },
              { 小問名: '(2)', 枝問リスト: [{ edaId: 'e12', 枝問名: '', 模範解答: '188.4cm²', 配点: '6', 完答: false, 順不同: false, 別解: '', 解説: '円の面積を含む複合図形', 解説画像: '', 解答画像: '', 条件指定: '', 条件指定要素: '', 不可解答: '', 採点基準: [], 採点基準テキスト: '' }] },
            ] },
            { 大問番号: '4', 満点: '12', 文種: '', 出典: '', 著者: '', テーマ: '', 問リスト: [
              { 小問名: '(1)', 枝問リスト: [{ edaId: 'e13', 枝問名: '', 模範解答: '6通り', 配点: '4', 完答: false, 順不同: false, 別解: '', 解説: '場合の数', 解説画像: '', 解答画像: '', 条件指定: '', 条件指定要素: '', 不可解答: '', 採点基準: [], 採点基準テキスト: '' }] },
              { 小問名: '(2)', 枝問リスト: [{ edaId: 'e14', 枝問名: '', 模範解答: '24通り', 配点: '4', 完答: false, 順不同: false, 別解: '', 解説: '順列4P4=24', 解説画像: '', 解答画像: '', 条件指定: '', 条件指定要素: '', 不可解答: '', 採点基準: [], 採点基準テキスト: '' }] },
              { 小問名: '(3)', 枝問リスト: [{ edaId: 'e15', 枝問名: '', 模範解答: '10通り', 配点: '4', 完答: true, 順不同: true, 別解: '', 解説: '組み合わせ5C2=10', 解説画像: '', 解答画像: '', 条件指定: '', 条件指定要素: '', 不可解答: '', 採点基準: [], 採点基準テキスト: '' }] },
            ] },
            { 大問番号: '5', 満点: '16', 文種: '', 出典: '', 著者: '', テーマ: '', 問リスト: [
              { 小問名: '(1)', 枝問リスト: [{ edaId: 'e16', 枝問名: '', 模範解答: '300cm³', 配点: '8', 完答: false, 順不同: false, 別解: '', 解説: '直方体の体積', 解説画像: '', 解答画像: '', 条件指定: '', 条件指定要素: '', 不可解答: '', 採点基準: [], 採点基準テキスト: '' }] },
              { 小問名: '(2)', 枝問リスト: [{ edaId: 'e17', 枝問名: '', 模範解答: '942cm³', 配点: '8', 完答: false, 順不同: false, 別解: '', 解説: '円柱の体積', 解説画像: '', 解答画像: '', 条件指定: '', 条件指定要素: '', 不可解答: '', 採点基準: [], 採点基準テキスト: '' }] },
            ] },
          ],
          createdAt: '2026-03-12T00:00:00.000Z', updatedAt: '2026-03-12T00:00:00.000Z' },

        // 国語 - 浅野
        { id: 'ei_kokugo', taskId: 'td_kokugo', userId: 'u3', status: 'draft', 年度: '2024', 学校名: '浅野', 回数: '1', 科目: '国語', 試験時間: '',
          大問リスト: [
            { 大問番号: '1', 満点: '30', 文種: '', 出典: '', 著者: '', テーマ: '', 問リスト: [
              { 小問名: '問一', 枝問リスト: [
                { edaId: 'ek1', 枝問名: 'a', 模範解答: '慣用', 配点: '2', 完答: false, 順不同: false, 別解: '', 解説: '', 解説画像: '', 解答画像: '', 条件指定: '', 条件指定要素: '', 不可解答: '', 採点基準: [], 採点基準テキスト: '' },
                { edaId: 'ek2', 枝問名: 'b', 模範解答: '象徴', 配点: '2', 完答: false, 順不同: false, 別解: '', 解説: '', 解説画像: '', 解答画像: '', 条件指定: '', 条件指定要素: '', 不可解答: '', 採点基準: [], 採点基準テキスト: '' },
                { edaId: 'ek3', 枝問名: 'c', 模範解答: '穏健', 配点: '2', 完答: false, 順不同: false, 別解: '', 解説: '', 解説画像: '', 解答画像: '', 条件指定: '', 条件指定要素: '', 不可解答: '', 採点基準: [], 採点基準テキスト: '' },
              ] },
              { 小問名: '問二', 枝問リスト: [{ edaId: 'ek4', 枝問名: '', 模範解答: 'ウ', 配点: '4', 完答: false, 順不同: false, 別解: '', 解説: '接続語の選択', 解説画像: '', 解答画像: '', 条件指定: '', 条件指定要素: '', 不可解答: '', 採点基準: [], 採点基準テキスト: '' }] },
              { 小問名: '問三', 枝問リスト: [{ edaId: 'ek5', 枝問名: '', 模範解答: 'イ', 配点: '4', 完答: false, 順不同: false, 別解: '', 解説: '心情の読み取り', 解説画像: '', 解答画像: '', 条件指定: '', 条件指定要素: '', 不可解答: '', 採点基準: [], 採点基準テキスト: '' }] },
            ] },
            { 大問番号: '2', 満点: '70', 文種: '物語文', 出典: '夏の庭', 著者: '湯本香樹実', テーマ: '', 問リスト: [
              { 小問名: '問一', 枝問リスト: [{ edaId: 'ek6', 枝問名: '', 模範解答: 'エ', 配点: '5', 完答: false, 順不同: false, 別解: '', 解説: '登場人物の心情', 解説画像: '', 解答画像: '', 条件指定: '', 条件指定要素: '', 不可解答: '', 採点基準: [], 採点基準テキスト: '' }] },
              { 小問名: '問二', 枝問リスト: [{ edaId: 'ek7', 枝問名: '', 模範解答: '老人との交流を通じて、死を恐れていた少年たちが生きることの意味を見出していく変化。', 配点: '10', 完答: false, 順不同: false, 別解: '', 解説: '記述問題',
                解説画像: '', 解答画像: '', 条件指定: '', 条件指定要素: '', 不可解答: '',
                採点基準: [{ 項目: '老人との交流に言及', 付記: ['具体的なエピソードがあればなお良い'] }, { 項目: '死への恐れから生の意味への変化', 付記: ['心情の変化が明確'] }], 採点基準テキスト: '' }] },
              { 小問名: '問三', 枝問リスト: [{ edaId: 'ek8', 枝問名: '', 模範解答: '少年たちが老人の死を受け入れ、前を向いて歩き出す決意を表している。', 配点: '10', 完答: false, 順不同: false, 別解: '', 解説: '比喩表現の解釈',
                解説画像: '', 解答画像: '', 条件指定: '', 条件指定要素: '', 不可解答: '',
                採点基準: [{ 項目: '死の受容に言及', 付記: [] }, { 項目: '前向きな決意の読み取り', 付記: ['比喩との関連があれば加点'] }], 採点基準テキスト: '' }] },
            ] },
          ],
          createdAt: '2026-03-12T00:00:00.000Z', updatedAt: '2026-03-12T00:00:00.000Z' },

        // 社会 - 渋谷教育学園幕張
        { id: 'ei_shakai', taskId: 'td_shakai', userId: 'u3', status: 'draft', 年度: '2023', 学校名: '渋谷教育学園幕張', 回数: '1', 科目: '社会', 試験時間: '',
          大問リスト: [
            { 大問番号: '1', 満点: '50', 文種: '', 出典: '', 著者: '', テーマ: '', 問リスト: [
              { 小問名: '問1', 枝問リスト: [{ edaId: 'es1', 枝問名: '', 模範解答: '太平洋ベルト', 配点: '3', 完答: false, 順不同: false, 別解: '', 解説: '日本の工業地帯', 解説画像: '', 解答画像: '', 条件指定: '', 条件指定要素: '', 不可解答: '', 採点基準: [], 採点基準テキスト: '' }] },
              { 小問名: '問2', 枝問リスト: [{ edaId: 'es2', 枝問名: '', 模範解答: '促成栽培', 配点: '3', 完答: false, 順不同: false, 別解: '', 解説: '温暖な気候を利用', 解説画像: '', 解答画像: '', 条件指定: '', 条件指定要素: '', 不可解答: '速成栽培', 採点基準: [], 採点基準テキスト: '' }] },
              { 小問名: '問3', 枝問リスト: [{ edaId: 'es3', 枝問名: '', 模範解答: '関税自主権の回復と領事裁判権の撤廃', 配点: '6', 完答: true, 順不同: true, 別解: '', 解説: '不平等条約の改正', 解説画像: '', 解答画像: '', 条件指定: '2つとも書くこと', 条件指定要素: '', 不可解答: '', 採点基準: [], 採点基準テキスト: '' }] },
              { 小問名: '問4', 枝問リスト: [{ edaId: 'es4', 枝問名: '', 模範解答: 'ウ', 配点: '3', 完答: false, 順不同: false, 別解: '', 解説: '地図記号の読み取り', 解説画像: '', 解答画像: '', 条件指定: '', 条件指定要素: '', 不可解答: '', 採点基準: [], 採点基準テキスト: '' }] },
            ] },
            { 大問番号: '2', 満点: '50', 文種: '', 出典: '', 著者: '', テーマ: '', 問リスト: [
              { 小問名: '問1', 枝問リスト: [{ edaId: 'es5', 枝問名: '', 模範解答: '三権分立', 配点: '3', 完答: false, 順不同: false, 別解: '', 解説: 'モンテスキューの思想', 解説画像: '', 解答画像: '', 条件指定: '', 条件指定要素: '', 不可解答: '', 採点基準: [], 採点基準テキスト: '' }] },
              { 小問名: '問2', 枝問リスト: [{ edaId: 'es6', 枝問名: '', 模範解答: '国民が選んだ代表者が国会で法律を制定し、内閣がそれを執行する仕組み。', 配点: '8', 完答: false, 順不同: false, 別解: '間接民主制の説明も可', 解説: '記述問題', 解説画像: '', 解答画像: '', 条件指定: '30字以上50字以内', 条件指定要素: '', 不可解答: '', 採点基準: [], 採点基準テキスト: '' }] },
            ] },
          ],
          createdAt: '2026-03-12T00:00:00.000Z', updatedAt: '2026-03-12T00:00:00.000Z' },

        // 理科 - サレジオ学院
        { id: 'ei_rika', taskId: 'td_rika', userId: 'u3', status: 'draft', 年度: '2024', 学校名: 'サレジオ学院', 回数: '1', 科目: '理科', 試験時間: '40分',
          大問リスト: [
            { 大問番号: '1', 満点: '25', 文種: '', 出典: '', 著者: '', テーマ: '天体（月の満ち欠け）', 問リスト: [
              { 小問名: '(1)', 枝問リスト: [{ edaId: 'er1', 枝問名: '', 模範解答: '上弦の月', 配点: '3', 完答: false, 順不同: false, 別解: '', 解説: '月の形と名称', 解説画像: '', 解答画像: '', 条件指定: '', 条件指定要素: '', 不可解答: '', 採点基準: [], 採点基準テキスト: '' }] },
              { 小問名: '(2)', 枝問リスト: [{ edaId: 'er2', 枝問名: '', 模範解答: '約29.5日', 配点: '3', 完答: false, 順不同: false, 別解: '', 解説: '朔望月の周期', 解説画像: '', 解答画像: '', 条件指定: '', 条件指定要素: '', 不可解答: '', 採点基準: [], 採点基準テキスト: '' }] },
              { 小問名: '(3)', 枝問リスト: [{ edaId: 'er3', 枝問名: '', 模範解答: '地球から見て月と太陽が90度の角度にあるため、月の右半分だけが太陽光を反射して見える。', 配点: '6', 完答: false, 順不同: false, 別解: '', 解説: '記述問題', 解説画像: '', 解答画像: '', 条件指定: '', 条件指定要素: '太陽光の反射、角度', 採点基準: [], 採点基準テキスト: '太陽光の反射に言及していること。地球・月・太陽の位置関係が正しいこと。' }] },
            ] },
            { 大問番号: '2', 満点: '25', 文種: '', 出典: '', 著者: '', テーマ: '水溶液の性質', 問リスト: [
              { 小問名: '(1)', 枝問リスト: [{ edaId: 'er4', 枝問名: '', 模範解答: '酸性', 配点: '3', 完答: false, 順不同: false, 別解: '', 解説: 'リトマス紙の変化', 解説画像: '', 解答画像: '', 条件指定: '', 条件指定要素: '', 不可解答: '', 採点基準: [], 採点基準テキスト: '' }] },
              { 小問名: '(2)', 枝問リスト: [{ edaId: 'er5', 枝問名: '', 模範解答: '塩化ナトリウムと水', 配点: '4', 完答: true, 順不同: true, 別解: '', 解説: '中和反応の生成物', 解説画像: '', 解答画像: '', 条件指定: '', 条件指定要素: '生成物を2つとも答える', 不可解答: '', 採点基準: [], 採点基準テキスト: '' }] },
            ] },
            { 大問番号: '3', 満点: '25', 文種: '', 出典: '', 著者: '', テーマ: '電気回路', 問リスト: [
              { 小問名: '(1)', 枝問リスト: [{ edaId: 'er6', 枝問名: '', 模範解答: '0.5A', 配点: '3', 完答: false, 順不同: false, 別解: '', 解説: 'オームの法則 V=IR', 解説画像: '', 解答画像: '', 条件指定: '', 条件指定要素: '', 不可解答: '', 採点基準: [], 採点基準テキスト: '' }] },
              { 小問名: '(2)', 枝問リスト: [{ edaId: 'er7', 枝問名: '', 模範解答: '並列回路', 配点: '3', 完答: false, 順不同: false, 別解: '', 解説: '回路の種類', 解説画像: '', 解答画像: '', 条件指定: '', 条件指定要素: '', 不可解答: '', 採点基準: [], 採点基準テキスト: '' }] },
            ] },
            { 大問番号: '4', 満点: '25', 文種: '', 出典: '', 著者: '', テーマ: '植物のつくり', 問リスト: [
              { 小問名: '(1)', 枝問リスト: [{ edaId: 'er8', 枝問名: '', 模範解答: '光合成', 配点: '3', 完答: false, 順不同: false, 別解: '', 解説: '葉緑体での反応', 解説画像: '', 解答画像: '', 条件指定: '', 条件指定要素: '', 不可解答: '', 採点基準: [], 採点基準テキスト: '' }] },
              { 小問名: '(2)', 枝問リスト: [{ edaId: 'er9', 枝問名: '', 模範解答: '蒸散', 配点: '3', 完答: false, 順不同: false, 別解: '', 解説: '気孔からの水蒸気放出', 解説画像: '', 解答画像: '', 条件指定: '', 条件指定要素: '', 不可解答: '', 採点基準: [], 採点基準テキスト: '' }] },
            ] },
          ],
          createdAt: '2026-03-12T00:00:00.000Z', updatedAt: '2026-03-12T00:00:00.000Z' },
      ];
      const existingEiIds = new Set((data.examInputs || []).map(e => e.id));
      for (const ei of demoExamInputs) { if (!existingEiIds.has(ei.id)) { data.examInputs = data.examInputs || []; data.examInputs.push(ei); } }

      data._demoExamInputV1 = true;
      updated = true;
    }
    if (!data.manuals) { data.manuals = []; updated = true; }
    if (!data.reviewMemos) { data.reviewMemos = []; updated = true; }
    if (updated) localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
};

export const getAll = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : INITIAL_DATA;
};

export const saveAll = (data) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const get = (key) => {
  const data = getAll();
  return data[key] ?? [];
};

export const save = (key, value) => {
  const data = getAll();
  data[key] = value;
  saveAll(data);
};
