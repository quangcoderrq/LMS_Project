import { createContext } from 'react';
import type { User } from "../types/auth";

export interface SavedAccountSummary {
  userId: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  role?: string;
  lastUsed: number;
  hasPassword: boolean;
}

export interface SaveAccountPayload {
  userId: string;
  email: string;
  password?: string;
  displayName: string;
  avatarUrl?: string;
  role?: string;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  savedAccounts: SavedAccountSummary[];
  saveAccountForQuickSwitch: (payload: SaveAccountPayload) => void;
  switchToAccount: (accountId: string, passwordOverride?: string) => Promise<User | null>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
