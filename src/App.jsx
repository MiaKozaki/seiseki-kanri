import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import { DataProvider, useData } from './contexts/DataContext.jsx';
import { SheetsProvider } from './contexts/SheetsContext.jsx';
import LoginPage from './pages/LoginPage.jsx';
import CorrectorDashboard from './pages/CorrectorDashboard.jsx';
import LeaderDashboard from './pages/LeaderDashboard.jsx';

const PasswordChangeScreen = () => {
  const { user, changePassword, logout } = useAuth();
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (newPw.length < 6) { setError('パスワードは6文字以上にしてください'); return; }
    if (newPw !== confirmPw) { setError('パスワードが一致しません'); return; }
    const success = changePassword(user.id, newPw);
    if (!success) {
      setError('パスワードの変更に失敗しました');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-800">パスワードを変更してください</h2>
          <p className="text-sm text-gray-500 mt-1">初回ログインのため、新しいパスワードを設定してください</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">新しいパスワード</label>
            <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="6文字以上" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">パスワード確認</label>
            <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="もう一度入力" />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button type="submit"
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition">
            パスワードを変更する
          </button>
        </form>
        <button onClick={logout} className="w-full mt-3 text-sm text-gray-400 hover:text-gray-600">
          ログアウト
        </button>
      </div>
    </div>
  );
};

const AppContent = () => {
  const { user, loading } = useAuth();
  const { loading: dataLoading } = useData() ?? {};

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-lg">読み込み中...</div>
      </div>
    );
  }

  if (!user) return <LoginPage />;
  if (user.mustChangePassword) return <PasswordChangeScreen />;
  if (user.role === 'leader') return <LeaderDashboard />;
  return <CorrectorDashboard />;
};

export default function App() {
  return (
    <SheetsProvider>
      <AuthProvider>
        <DataProvider>
          <AppContent />
        </DataProvider>
      </AuthProvider>
    </SheetsProvider>
  );
}
