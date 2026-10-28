import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('enerSightToken');
    if (!token) {
      setLoading(false);
      return;
    }

    api
      .get('/auth/me')
      .then((response) => {
        setUser(response.data.user);
      })
      .catch(() => {
        localStorage.removeItem('enerSightToken');
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (credentials) => {
    const response = await api.post('/auth/login', credentials);
    const { token, user: loggedInUser } = response.data;
    localStorage.setItem('enerSightToken', token);
    setUser(loggedInUser);
    return loggedInUser;
  };

  const register = async (userData) => {
    const response = await api.post('/auth/register', userData);
    const { token, user: newUser } = response.data;
    localStorage.setItem('enerSightToken', token);
    setUser(newUser);
    return newUser;
  };

  const logout = () => {
    localStorage.removeItem('enerSightToken');
    setUser(null);
  };

  const value = useMemo(() => ({ user, loading, login, register, logout }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
