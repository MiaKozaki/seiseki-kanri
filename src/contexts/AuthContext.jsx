import React, { createContext, useContext, useState, useEffect } from 'react';
import { get, getAll, saveAll, initStorage } from '../utils/storage.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initStorage();
    const saved = localStorage.getItem('current_user');
    if (saved) {
      try { setUser(JSON.parse(saved)); } catch {}
    }
    setLoading(false);
  }, []);

  const login = (loginId, password) => {
    const users = get('users');
    const found = users.find(
      u => u.loginId === loginId && u.password === btoa(password)
    );
    if (!found) throw new Error('IDまたはパスワードが正しくありません');
    const userObj = { ...found };
    setUser(userObj);
    localStorage.setItem('current_user', JSON.stringify(userObj));
    return userObj;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('current_user');
  };

  const changePassword = (userId, newPassword) => {
    const data = getAll();
    const users = data.users || [];
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) return false;
    users[userIndex].password = btoa(newPassword);
    users[userIndex].mustChangePassword = false;
    data.users = users;
    saveAll(data);
    const updatedUser = { ...users[userIndex] };
    delete updatedUser.password;
    setUser(updatedUser);
    localStorage.setItem('current_user', JSON.stringify(updatedUser));
    return true;
  };

  const refreshUser = () => {
    if (!user) return;
    const users = get('users');
    const updated = users.find(u => u.id === user.id);
    if (updated) {
      setUser(updated);
      localStorage.setItem('current_user', JSON.stringify(updated));
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, refreshUser, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
