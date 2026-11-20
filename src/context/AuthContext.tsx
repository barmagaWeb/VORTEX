import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '../types';
import { authService, userService, isSupabaseConfigured, supabase } from '../services';

const PENDING_EMAIL_KEY = 'vortex_pending_verification_email';

interface AuthContextType {
  user: User | null;
  pendingEmail: string;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<User>;
  register: (email: string, password: string, name: string, username: string) => Promise<User>;
  logout: () => Promise<void>;
  switchRole: (role: 'user' | 'admin') => Promise<User>;
  updateUser: (data: Partial<User>) => Promise<User>;
  setPendingVerificationEmail: (email: string) => void;
  resendVerificationEmail: (email?: string) => Promise<boolean>;
  refreshCurrentUser: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const readPendingEmail = (): string => {
  if (typeof window === 'undefined') return '';
  try {
    return window.sessionStorage.getItem(PENDING_EMAIL_KEY) || '';
  } catch {
    return '';
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string>(readPendingEmail);
  // This flag represents initial session restoration only. Form submissions use
  // their own local loading state so GuestRoute does not unmount the form.
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const setPendingVerificationEmail = (email: string) => {
    const normalizedEmail = email.trim();
    setPendingEmail(normalizedEmail);
    if (typeof window !== 'undefined') {
      try {
        if (normalizedEmail) {
          window.sessionStorage.setItem(PENDING_EMAIL_KEY, normalizedEmail);
        } else {
          window.sessionStorage.removeItem(PENDING_EMAIL_KEY);
        }
      } catch {
        // Verification can still proceed when browser storage is unavailable.
      }
    }
  };

  const applyCurrentUser = (current: User | null) => {
    setUser(current);
    if (current && current.emailVerified !== false) {
      setPendingVerificationEmail('');
    } else if (current?.emailVerified === false && current.email) {
      setPendingVerificationEmail(current.email);
    }
  };

  const refreshCurrentUser = async (): Promise<User | null> => {
    const current = await authService.getCurrentUser();
    applyCurrentUser(current);
    return current;
  };

  useEffect(() => {
    let active = true;
    let authEventVersion = 0;
    let subscription: { unsubscribe: () => void } | null = null;

    const syncFromAuthEvent = async (version: number) => {
      try {
        const current = await authService.getCurrentUser();
        if (active && version === authEventVersion) applyCurrentUser(current);
      } catch {
        if (active && version === authEventVersion) setUser(null);
      } finally {
        if (active && version === authEventVersion) setIsLoading(false);
      }
    };

    if (isSupabaseConfigured()) {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        const version = ++authEventVersion;
        if (!session) {
          setUser(null);
          setPendingVerificationEmail('');
          setIsLoading(false);
          return;
        }

        // Supabase warns against awaiting another Supabase call inside this
        // callback; defer profile hydration until the auth callback has ended.
        window.setTimeout(() => {
          void syncFromAuthEvent(version);
        }, 0);
      });
      subscription = data.subscription;
    }

    const initialVersion = authEventVersion;
    const initAuth = async () => {
      try {
        const current = await authService.getCurrentUser();
        if (active && authEventVersion === initialVersion) applyCurrentUser(current);
      } catch {
        if (active && authEventVersion === initialVersion) setUser(null);
      } finally {
        if (active && authEventVersion === initialVersion) setIsLoading(false);
      }
    };

    void initAuth();
    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, []);

  const login = async (email: string, password?: string): Promise<User> => {
    const loggedUser = await authService.signIn(email, password);
    applyCurrentUser(loggedUser);
    return loggedUser;
  };

  const register = async (email: string, password: string, name: string, username: string): Promise<User> => {
    const newUser = await authService.signUp(email, password, name, username);
    applyCurrentUser(newUser);
    return newUser;
  };

  const logout = async () => {
    await authService.signOut();
    applyCurrentUser(null);
  };

  const switchRole = async (role: 'user' | 'admin'): Promise<User> => {
    const switched = await authService.switchDemoRole(role);
    applyCurrentUser(switched);
    return switched;
  };

  const updateUser = async (data: Partial<User>): Promise<User> => {
    if (!user) throw new Error('Not authenticated');
    const updated = await userService.updateProfile(user.id, data);
    setUser(updated);
    return updated;
  };

  const resendVerificationEmail = async (email?: string): Promise<boolean> => {
    const targetEmail = (email || pendingEmail || user?.email || '').trim();
    if (!targetEmail) throw new Error('Enter your email address first.');
    return authService.resendConfirmationEmail(targetEmail);
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'moderator';
  const isAuthenticated = !!user && user.emailVerified !== false;

  return (
    <AuthContext.Provider
      value={{
        user,
        pendingEmail,
        isAuthenticated,
        isAdmin,
        isLoading,
        login,
        register,
        logout,
        switchRole,
        updateUser,
        setPendingVerificationEmail,
        resendVerificationEmail,
        refreshCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
