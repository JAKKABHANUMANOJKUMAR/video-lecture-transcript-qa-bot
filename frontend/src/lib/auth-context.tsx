import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, ApiError, tokenStore, type ApiUser } from './api';

interface User {
  id: string;
  email: string;
  fullName?: string;
}

interface Profile {
  id: string;
  role: 'admin' | 'user';
  status: string;
  fullName?: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (fullName: string, email: string, password: string, provider?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function applyApiUser(
  apiUser: ApiUser,
  setUser: (u: User) => void,
  setProfile: (p: Profile) => void,
) {
  setUser({ id: apiUser.id, email: apiUser.email, fullName: apiUser.full_name });
  setProfile({
    id: apiUser.id,
    role: apiUser.role,
    status: apiUser.status,
    fullName: apiUser.full_name,
  });
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore a session from a stored token on first load
  useEffect(() => {
    const token = tokenStore.get();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then((apiUser) => applyApiUser(apiUser, setUser, setProfile))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await api.login(email, password);
      tokenStore.set(res.access_token);
      applyApiUser(res.user, setUser, setProfile);
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) {
        throw new Error('Cannot reach the server. Please start the backend (port 8000).');
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (
    fullName: string,
    email: string,
    password: string,
    provider = 'local',
  ) => {
    setLoading(true);
    try {
      const res = await api.signup(fullName, email, password, provider);
      tokenStore.set(res.access_token);
      applyApiUser(res.user, setUser, setProfile);
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) {
        throw new Error('Cannot reach the server. Please start the backend (port 8000).');
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    tokenStore.clear();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
