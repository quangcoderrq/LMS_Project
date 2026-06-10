import React, { useState, useEffect, type ReactNode } from 'react';
import { authService, saveCurrentUserFromApi } from "../services";
import type { User } from "../types/auth";
import {
  AuthContext,
  type AuthContextType,
  type SaveAccountPayload,
  type SavedAccountSummary,
} from "./AuthContextTypes";

const SAVED_ACCOUNTS_KEY = 'lms:savedAccounts';
const MAX_SAVED_ACCOUNTS = 5;

type SavedAccountRecord = SavedAccountSummary & {
  encodedPassword?: string;
};

const readSavedAccounts = (): SavedAccountRecord[] => {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const stored = window.localStorage.getItem(SAVED_ACCOUNTS_KEY);
    if (!stored) {
      return [];
    }
    const parsed = JSON.parse(stored) as SavedAccountRecord[];
    return Array.isArray(parsed)
      ? parsed.map((record) => ({
          ...record,
          hasPassword: Boolean(record.hasPassword ?? record.encodedPassword),
        }))
      : [];
  } catch (error) {
    console.warn('[auth] Failed to parse saved accounts', error);
    return [];
  }
};

const persistAccounts = (records: SavedAccountRecord[]) => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(records));
  } catch (error) {
    console.warn('[auth] Failed to persist saved accounts', error);
  }
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [savedAccountRecords, setSavedAccountRecords] = useState<SavedAccountRecord[]>(() =>
    readSavedAccounts(),
  );

  // Check if user is authenticated on app load
  useEffect(() => {
    const checkAuth = async () => {
      // Avoid unnecessary call on public routes; rely on localStorage fallback
      const publicPaths = [
        '/',
        '/login',
        '/register',
        '/verify',
        '/verify-email',
        '/forgot-password',
        '/reset-password',
        '/landing',
      ];
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
      const isPublic = publicPaths.some((p) => currentPath === p || currentPath.startsWith(p + '/'));
      if (isPublic) {
        const userData = localStorage.getItem('userData');
        if (userData) {
          try {
            const parsedUser = JSON.parse(userData);
            setUser(parsedUser);
          } catch {
            setUser(null);
          }
        }
        setLoading(false);
        return;
      }
      try {
        const response = await authService.getCurrentUser();
        setUser(response);
      } catch {
        // Fallback to localStorage if API fails
        const userData = localStorage.getItem('userData');
        if (userData) {
          try {
            const parsedUser = JSON.parse(userData);
            setUser(parsedUser);
          } catch {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  useEffect(() => {
    const handleStorageSync = (event: StorageEvent) => {
      if (event.key === SAVED_ACCOUNTS_KEY) {
        setSavedAccountRecords(readSavedAccounts());
      }
    };

    window.addEventListener('storage', handleStorageSync);
    return () => {
      window.removeEventListener('storage', handleStorageSync);
    };
  }, []);

  const updateSavedAccounts = (updater: (prev: SavedAccountRecord[]) => SavedAccountRecord[]) => {
    setSavedAccountRecords((prev) => {
      const next = updater(prev);
      persistAccounts(next);
      return next;
    });
  };

  const saveAccountForQuickSwitch = (payload: SaveAccountPayload) => {
    if (typeof window === 'undefined') {
      return;
    }
    const encodedPassword = payload.password ? window.btoa(payload.password) : undefined;
    const newRecord: SavedAccountRecord = {
      userId: payload.userId,
      email: payload.email,
      displayName: payload.displayName,
      avatarUrl: payload.avatarUrl,
      role: payload.role,
      lastUsed: Date.now(),
      encodedPassword,
      hasPassword: Boolean(encodedPassword),
    };

    updateSavedAccounts((prev) => {
      const filtered = prev.filter(
        (account) => account.userId !== payload.userId && account.email !== payload.email,
      );
      return [newRecord, ...filtered].slice(0, MAX_SAVED_ACCOUNTS);
    });
  };

  const switchToAccount = async (
    accountId: string,
    passwordOverride?: string,
  ): Promise<User | null> => {
    const targetAccount = savedAccountRecords.find((record) => record.userId === accountId);
    if (!targetAccount) {
      return null;
    }
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      const resolvedPassword =
        (targetAccount.hasPassword && targetAccount.encodedPassword
          ? window.atob(targetAccount.encodedPassword)
          : undefined) ?? passwordOverride;

      if (!resolvedPassword) {
        throw new Error('Password required for this account');
      }

      const response = await authService.login({
        email: targetAccount.email,
        password: resolvedPassword,
      });
      const resolvedUser = ((response as { data?: User }).data ?? response) as User;
      setUser(resolvedUser);
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('userData', JSON.stringify(resolvedUser));
      try {
        await saveCurrentUserFromApi();
      } catch {
        // ignore profile refresh errors
      }
      updateSavedAccounts((prev) =>
        prev.map((record) =>
          record.userId === accountId ? { ...record, lastUsed: Date.now() } : record,
        ),
      );
      return resolvedUser;
    } catch (error) {
      console.error('[auth] Failed to switch account', error);
      return null;
    }
  };

  const login = async (email: string, password: string) => {
    const response = await authService.login({ email, password });
    setUser(response);
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      window.location.href = '/login';
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
    savedAccounts: savedAccountRecords.map(({ encodedPassword, ...rest }) => rest),
    saveAccountForQuickSwitch,
    switchToAccount,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
