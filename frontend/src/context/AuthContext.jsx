import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('synexxus_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // Try to restore user info from localStorage
      try {
        const saved = localStorage.getItem('synexxus_user');
        if (saved) setUser(JSON.parse(saved));
        else setUser({ email: 'User' });
      } catch {
        setUser({ email: 'User' });
      }
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
    setLoading(false);
  }, [token]);

  // Intercept 401 errors globally to auto-logout expired/invalid token sessions
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 401) {
          logout();
        }
        return Promise.reject(error);
      }
    );
    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  const login = async (email, password) => {
    // Backend returns: { user: { token, user: { id, email, full_name, ... } } }
    const res = await axios.post('/api/auth/login', { email, password });
    const payload = res.data.user;
    const jwt = payload.token;
    const userInfo = payload.user || { email };
    localStorage.setItem('synexxus_token', jwt);
    localStorage.setItem('synexxus_user', JSON.stringify(userInfo));
    axios.defaults.headers.common['Authorization'] = `Bearer ${jwt}`;
    setToken(jwt);
    setUser(userInfo);
    return payload;
  };

  const signup = async (email, password, fullName) => {
    // Backend requires: { full_name, email, password }
    const res = await axios.post('/api/auth/signup', {
      full_name: fullName || email.split('@')[0],
      email,
      password,
    });
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('synexxus_token');
    localStorage.removeItem('synexxus_user');
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
