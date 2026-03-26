import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function LoginPage() {
  const [managementId, setManagementId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      login(managementId, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (e, pwd) => {
    e.preventDefault();
    setManagementId(e.target.dataset.managementid);
    setPassword(pwd);
    try {
      login(e.target.dataset.managementid, pwd);
    } catch {}
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">📝</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-800">四谷大塚制作アプリ</h1>
            <p className="text-gray-500 text-sm mt-1">アカウントにログインしてください</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                管理ID
              </label>
              <input
                type="text"
                value={managementId}
                onChange={e => setManagementId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-sm"
                placeholder="例: 100001, 200001"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                パスワード
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-sm"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50 text-sm"
            >
              {loading ? 'ログイン中...' : 'ログイン'}
            </button>
          </form>

          <div className="mt-6 p-4 bg-gray-50 rounded-xl">
            <p className="text-xs font-semibold text-gray-500 mb-2">テスト用アカウント（クリックでログイン）</p>
            <div className="space-y-1">
              {[
                { label: 'リーダー田中 (100001)', managementId: '100001', role: 'leader' },
                { label: '山田太郎 (200001)', managementId: '200001', role: 'corrector' },
                { label: '鈴木花子 (200002)', managementId: '200002', role: 'corrector' },
              ].map(acc => (
                <button
                  key={acc.managementId}
                  data-managementid={acc.managementId}
                  onClick={e => quickLogin(e, 'password')}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 transition text-xs text-gray-600 flex items-center gap-2"
                >
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${acc.role === 'leader' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                    {acc.role === 'leader' ? 'リーダー' : '作業者'}
                  </span>
                  {acc.label}
                </button>
              ))}
              <p className="text-xs text-gray-400 mt-1 px-1">共通パスワード: password</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
