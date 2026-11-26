import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  user_type: string;
  roles: string[];
  permissions: string[];
  student_id?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, userData: User) => void;
  logout: () => void;
  refreshToken: () => Promise<boolean>;
  isAuthenticated: boolean;
  hasRole: (roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));

  // Ensure student_id is populated for student & parent accounts if missing in cache
  useEffect(() => {
    if (token && user && (user.user_type === 'STUDENT' || user.user_type === 'PARENT') && !user.student_id) {
      api.get('/auth/me')
        .then((res) => {
          if (res.data?.student_id) {
            const updatedUser = { ...user, student_id: res.data.student_id };
            setUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));
          }
        })
        .catch((err) => console.warn('Could not sync student_id:', err));
    }
  }, [token, user]);

  const login = (newToken: string, userData: User) => {
    setToken(newToken);
    setUser(userData);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const refreshToken = async (): Promise<boolean> => {
    try {
      const res = await api.post('/auth/refresh');
      const { access_token, ...userData } = res.data;
      setToken(access_token);
      setUser(userData);
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(userData));
      return true;
    } catch (err) {
      console.warn('Silent token refresh failed:', err);
      return false;
    }
  };

  const hasRole = (allowedRoles: string[]) => {
    if (!user) return false;
    if (user.roles?.includes('SUPER_ADMIN') || user.user_type === 'SUPER_ADMIN') return true;
    return allowedRoles.some((r) => user.roles?.includes(r) || user.user_type === r);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        refreshToken,
        isAuthenticated: !!token,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
