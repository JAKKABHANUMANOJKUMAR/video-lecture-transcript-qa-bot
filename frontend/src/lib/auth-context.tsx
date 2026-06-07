import React, { createContext, useContext, useState } from 'react';

interface User {
  id: string;
  email: string;
}

interface Profile {
  id: string;
  role: 'admin' | 'user';
  status: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_USERS = {
  'admin@example.com': { password: 'password', role: 'admin' as const, id: 'admin-1' },
  'user@example.com': { password: 'password', role: 'user' as const, id: 'user-1' },
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const demoUser = DEMO_USERS[email as keyof typeof DEMO_USERS];
      if (!demoUser || demoUser.password !== password) {
        throw new Error('Invalid email or password');
      }

      setUser({ id: demoUser.id, email });
      setProfile({ id: demoUser.id, role: demoUser.role, status: 'active' });
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
