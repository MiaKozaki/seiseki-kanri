/**
 * QuestionManagementTab - Question management tab for leaders (質問管理)
 * Manages corrector questions, replies, and resolution with filtering by subject/status.
 */
import React, { useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useData } from '../../contexts/DataContext.jsx';
import { SUBJECTS_LIST, WORK_TYPES_LIST } from '../../utils/storage.js';

// ---- Question Management Tab ----
const QuestionManagementTab = ({ activeSubjects }) => {
  const { getQuestions, addQuestionReply, resolveQuestion, answerQuestion, getQuestionSettings, updateQuestionSetting, getUsers, getCorrectors } = useData();
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState(null);
  const [filterSubject, setFilterSubject] = useState('');
  const [filterWorkType, setFilterWorkType] = useState('');
  const [filterStatus, setFilterStatus] = useState('open');
  const [replyTexts, setReplyTexts] = useState({});
  const [expandedQuestions, setExpandedQuestions] = useState({});

  const allUsers = getUsers();
  const userNameMap = useMemo(() => {
    const map = {};
    allUsers.forEach(u => { map[u.id] = u.name; });
    return map;
  }, [allUsers]);

  const allQuestions = useMemo(() => {
    let items = getQuestions();
    items = items.filter(q => activeSubjects.includes(q.subject));
    if (filterSubject) items = items.filter(q => q.subject === filterSubject);
    if (filterWorkType) items = items.filter(q => q.workType === filterWorkType);
    return items;
  }, [getQuestions, activeSubjects, filterSubject, filterWorkType]);

  const questions = useMemo(() => {
    let items = allQuestions;
    if (filterStatus === 'open') items = items.filter(q => (q.status || (q.answer ? 'resolved' : 'open')) === 'open');
    if (filterStatus === 'resolved') items = items.filter(q => (q.status || (q.answer ? 'resolved' : 'open')) === 'resolved');
    return items;
  }, [allQuestions, filterStatus]);

  const unresolvedCount = useMemo(() => {
    let items = getQuestions();
    items = items.filter(q => activeSubjects.includes(q.subject));
    return items.filter(q => (q.status || (q.answer ? 'resolved' : 'open')) === 'open').length;
  }, [getQuestions, activeSubjects]);

  const questionSettings = getQuestionSettings();

  const isSettingEnabled = (subject, workType) => {
    const setting = questionSettings.find(s => s.subject === subject && s.workType === workType);
    return setting ? setting.enabled : true;
  };

  const handleReply = (questionId) => {
    const text = replyTexts[questionId];
    if (!text?.trim()) return;
    addQuestionReply(questionId, {
      userId: user.id,
      userRole: 'leader',
      userName: user.name,
      message: text.trim(),
    });
    setReplyTexts(prev => ({ ...prev, [questionId]: '' }));
  };

  const handleResolve = (questionId) => {
    resolveQuestion(questionId);
  };

  const toggleExpand = (qId) => {
    setExpandedQuestions(prev => ({ ...prev, [qId]: !prev[qId] }));
  };

  const sections = [
    { key: 'list', icon: '💬', title: '質問一覧', desc: '作業者からの質問を確認・回答', badge: unresolvedCount },
    { key: 'settings', icon: '⚙️', title: '受付設定', desc: '科目×作業内容ごとの質問受付ON/OFF' },
  ];

  return (
    <div className="space-y-4">
      {/* Section selector */}
      {!activeSection && (
        <div className="grid grid-cols-2 gap-3 p-4">
          {sections.map(s => (
            <button key={s.key} onClick={() => setActiveSection(s.key)}
              className="p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition text-left relative">
              <span className="text-2xl">{s.icon}</span>
              <p className="font-medium text-gray-800 mt-1">{s.title}</p>
              <p className="text-xs text-gray-500">{s.desc}</p>
              {s.badge > 0 && (
                <span className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">{s.badge}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {activeSection && (
        <div>
          <button onClick={() => setActiveSection(null)} className="mb-3 text-sm text-gray-500 hover:text-gray-700">
            ← 戻る
          </button>

          {/* ===== Section: 質問一覧 ===== */}
          {activeSection === 'list' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <div className="flex flex-wrap gap-3 items-end">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">科目</label>
                    <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 outline-none">
                      <option value="">すべて</option>
                      {SUBJECTS_LIST.filter(s => activeSubjects.includes(s)).map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">作業内容</label>
                    <select value={filterWorkType} onChange={e => setFilterWorkType(e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 outline-none">
                      <option value="">すべて</option>
                      {WORK_TYPES_LIST.map(w => (
                        <option key={w} value={w}>{w}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Status filter tabs */}
              <div className="flex gap-1 border-b border-gray-200">
                {[
                  { key: 'open', label: '未解決', count: allQuestions.filter(q => (q.status || (q.answer ? 'resolved' : 'open')) === 'open').length },
                  { key: 'resolved', label: '解決済み', count: allQuestions.filter(q => (q.status || (q.answer ? 'resolved' : 'open')) === 'resolved').length },
                  { key: 'all', label: 'すべて', count: allQuestions.length },
                ].map(f => (
                  <button
                    key={f.key}
                    onClick={() => setFilterStatus(f.key)}
                    className={`px-3 py-2 text-sm font-medium border-b-2 transition ${
                      filterStatus === f.key
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {f.label}
                    {f.count > 0 && (
                      <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                        filterStatus === f.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                      }`}>{f.count}</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Question count */}
              <p className="text-xs text-gray-500 px-1">{questions.length}件の質問</p>

              {/* Question cards as expandable threads */}
              {questions.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center text-gray-400 text-sm">
                  質問はありません
                </div>
              ) : (
                questions.map(q => {
                  const qStatus = q.status || (q.answer ? 'resolved' : 'open');
                  const isOpen = qStatus === 'open';
                  const isExpanded = expandedQuestions[q.id];
                  const replies = q.replies || [];
                  // Include legacy answer as a reply if present
                  const allReplies = q.answer && replies.length === 0
                    ? [{ id: 'legacy', userId: q.answeredBy, userRole: 'leader', userName: userNameMap[q.answeredBy] || 'リーダー', message: q.answer, createdAt: q.answeredAt }]
                    : replies;

                  return (
                    <div key={q.id} className={`rounded-2xl shadow-sm border ${isOpen ? 'border-yellow-200' : 'border-green-200'}`}>
                      {/* Header - clickable */}
                      <button
                        onClick={() => toggleExpand(q.id)}
                        className={`w-full p-5 text-left ${isOpen ? 'bg-yellow-50' : 'bg-green-50'} rounded-t-2xl ${isExpanded ? '' : 'rounded-b-2xl'}`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <span className="font-medium text-gray-800 text-sm">{userNameMap[q.fromUserId] || '不明'}</span>
                            <div className="flex gap-1 mt-1">
                              <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">{q.subject}</span>
                              {q.workType && (
                                <span className="inline-block px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs">{q.workType}</span>
                              )}
                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${isOpen ? 'bg-yellow-200 text-yellow-800' : 'bg-green-200 text-green-800'}`}>
                                {isOpen ? '未解決' : '解決済み'}
                              </span>
                              {allReplies.length > 0 && (
                                <span className="text-xs text-gray-400 ml-1 self-center">返信 {allReplies.length}件</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">{new Date(q.createdAt).toLocaleString('ja-JP')}</span>
                            <span className="text-gray-400 text-xs">{isExpanded ? '▲' : '▼'}</span>
                          </div>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-2">{q.message}</p>
                      </button>

                      {/* Expanded thread */}
                      {isExpanded && (
                        <div className="border-t border-gray-200 p-5 bg-white rounded-b-2xl space-y-3">
                          {/* Original message */}
                          <div className="p-3 bg-gray-50 rounded-xl">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">作業者</span>
                              <span className="text-xs text-gray-600">{userNameMap[q.fromUserId] || '不明'}</span>
                              <span className="text-xs text-gray-400">{new Date(q.createdAt).toLocaleString('ja-JP')}</span>
                            </div>
                            <p className="text-sm text-gray-800 whitespace-pre-wrap">{q.message}</p>
                          </div>

                          {/* Replies */}
                          {allReplies.map(r => (
                            <div key={r.id} className={`p-3 rounded-xl ${r.userRole === 'leader' ? 'bg-blue-50 ml-4' : 'bg-gray-50'}`}>
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                                  r.userRole === 'leader' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {r.userRole === 'leader' ? 'リーダー' : '作業者'}
                                </span>
                                <span className="text-xs text-gray-600">{r.userName || userNameMap[r.userId] || '不明'}</span>
                                <span className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleString('ja-JP')}</span>
                              </div>
                              <p className="text-sm text-gray-800 whitespace-pre-wrap">{r.message}</p>
                            </div>
                          ))}

                          {/* Reply input (only for open questions) */}
                          {isOpen && (
                            <div className="pt-2 border-t border-gray-100 space-y-2">
                              <div className="flex gap-2">
                                <textarea
                                  value={replyTexts[q.id] || ''}
                                  onChange={e => setReplyTexts(prev => ({ ...prev, [q.id]: e.target.value }))}
                                  placeholder="返信を入力..."
                                  className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 outline-none resize-none"
                                  rows={2}
                                />
                                <button
                                  onClick={() => handleReply(q.id)}
                                  disabled={!replyTexts[q.id]?.trim()}
                                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed self-end"
                                >
                                  送信
                                </button>
                              </div>
                              <button
                                onClick={() => handleResolve(q.id)}
                                className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition"
                              >
                                解決済みにする
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ===== Section: 受付設定 ===== */}
          {activeSection === 'settings' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">質問受付設定（科目 × 作業内容）</h3>
              <p className="text-xs text-gray-500 mb-4">チェックを外すと、その組み合わせでの質問送信が無効になります。</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">科目 ＼ 作業内容</th>
                      {WORK_TYPES_LIST.map(w => (
                        <th key={w} className="text-center py-2 px-2 text-xs font-medium text-gray-500">{w}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {SUBJECTS_LIST.filter(s => activeSubjects.includes(s)).map(subject => (
                      <tr key={subject} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-3 font-medium text-gray-700">{subject}</td>
                        {WORK_TYPES_LIST.map(workType => (
                          <td key={workType} className="text-center py-2 px-2">
                            <input
                              type="checkbox"
                              checked={isSettingEnabled(subject, workType)}
                              onChange={e => updateQuestionSetting(subject, workType, e.target.checked)}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default QuestionManagementTab;
