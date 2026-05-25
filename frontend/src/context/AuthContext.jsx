import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const ACCESS_TOKEN_KEY = 'blp_access_token';
const REFRESH_TOKEN_KEY = 'blp_refresh_token';
const USER_KEY = 'blp_user';

// Axios instance with auth header interceptor
export const apiClient = axios.create({ baseURL: API_BASE });

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
  });
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimerRef = useRef(null);

  const clearAuth = useCallback(() => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
  }, []);

  const scheduleRefresh = useCallback((accessToken) => {
    // Decode expiry from token without a library
    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      const expiresIn = payload.exp * 1000 - Date.now() - 60_000; // 1 min before expiry
      if (expiresIn <= 0) return;
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(async () => {
        try {
          const stored = localStorage.getItem(REFRESH_TOKEN_KEY);
          if (!stored) return clearAuth();
          const res = await axios.post(`${API_BASE}/refresh`, { refreshToken: stored });
          const { accessToken: newToken, user: refreshedUser } = res.data;
          localStorage.setItem(ACCESS_TOKEN_KEY, newToken);
          localStorage.setItem(USER_KEY, JSON.stringify(refreshedUser));
          setUser(refreshedUser);
          scheduleRefresh(newToken);
        } catch {
          clearAuth();
        }
      }, expiresIn);
    } catch { /* ignore malformed token */ }
  }, [clearAuth]);

  const login = useCallback(async (username, password) => {
    const res = await apiClient.post('/login', { username, password });
    const { accessToken, refreshToken, user: loggedInUser } = res.data;
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(loggedInUser));
    setUser(loggedInUser);
    scheduleRefresh(accessToken);
    return loggedInUser;
  }, [scheduleRefresh]);

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    try {
      await apiClient.post('/logout', { refreshToken });
    } catch { /* ignore */ }
    clearAuth();
  }, [clearAuth]);

  // On mount: validate existing stored token
  useEffect(() => {
    const bootstrap = async () => {
      const storedAccess = localStorage.getItem(ACCESS_TOKEN_KEY);
      const storedRefresh = localStorage.getItem(REFRESH_TOKEN_KEY);
      const storedUser = localStorage.getItem(USER_KEY);

      if (!storedRefresh) {
        clearAuth();
        setIsLoading(false);
        return;
      }

      // Check if access token is still valid
      if (storedAccess) {
        try {
          const payload = JSON.parse(atob(storedAccess.split('.')[1]));
          if (payload.exp * 1000 > Date.now()) {
            // Still valid
            setUser(JSON.parse(storedUser));
            scheduleRefresh(storedAccess);
            setIsLoading(false);
            return;
          }
        } catch { /* fall through to refresh */ }
      }

      // Access token expired — try refresh
      try {
        const res = await axios.post(`${API_BASE}/refresh`, { refreshToken: storedRefresh });
        const { accessToken: newToken, user: refreshedUser } = res.data;
        localStorage.setItem(ACCESS_TOKEN_KEY, newToken);
        localStorage.setItem(USER_KEY, JSON.stringify(refreshedUser));
        setUser(refreshedUser);
        scheduleRefresh(newToken);
      } catch {
        clearAuth();
      } finally {
        setIsLoading(false);
      }
    };

    bootstrap();
    return () => { if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current); };
  }, [clearAuth, scheduleRefresh]);

  // Attach access token to every request
  useEffect(() => {
    const interceptor = apiClient.interceptors.request.use((config) => {
      const token = localStorage.getItem(ACCESS_TOKEN_KEY);
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
    return () => apiClient.interceptors.request.eject(interceptor);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
