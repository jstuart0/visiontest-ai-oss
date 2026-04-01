'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/lib/api';
import { auth } from '@/lib/auth';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  setUser: (user: User) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isLoading: true,
      isAuthenticated: false,

      setAuth: (user, token) => {
        auth.setToken(token);
        auth.setUser(user);
        set({ user, token, isAuthenticated: true, isLoading: false });
      },

      setUser: (user) => {
        auth.setUser(user);
        set({ user });
      },

      setLoading: (isLoading) => {
        set({ isLoading });
      },

      logout: () => {
        auth.clear();
        set({ user: null, token: null, isAuthenticated: false, isLoading: false });
      },

      hydrate: () => {
        const token = auth.getToken();
        const user = auth.getUser();
        if (token && user) {
          set({ user: user as User, token, isAuthenticated: true, isLoading: false });
        } else {
          // Explicitly clear auth state when token is missing
          auth.clear();
          set({ user: null, token: null, isAuthenticated: false, isLoading: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
