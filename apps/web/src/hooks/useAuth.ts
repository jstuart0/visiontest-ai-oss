'use client';

import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import { useProjectStore } from '@/stores/project.store';
import { authApi, projectsApi } from '@/lib/api';
import { toast } from 'sonner';

export function useAuth() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    user,
    isAuthenticated,
    isLoading,
    setAuth,
    setLoading,
    logout: clearAuth,
    hydrate,
  } = useAuthStore();
  const { setProjects, clear: clearProjects } = useProjectStore();

  // Hydrate auth state on mount
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Fetch current user on hydration if authenticated
  const { refetch: refetchUser } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authApi.me,
    enabled: false,
  });

  // Fetch projects when authenticated
  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
    enabled: isAuthenticated && !isLoading,
  });

  // Update projects store when data changes
  useEffect(() => {
    if (projectsData) {
      setProjects(projectsData);
    }
  }, [projectsData, setProjects]);

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authApi.login(email, password),
    onSuccess: (data) => {
      setAuth(data.user, data.accessToken);
      toast.success('Welcome back!');
      router.push('/dashboard');
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || 'Login failed');
    },
  });

  const registerMutation = useMutation({
    mutationFn: ({
      name,
      email,
      password,
    }: {
      name: string;
      email: string;
      password: string;
    }) => authApi.register(name, email, password),
    onSuccess: (data) => {
      setAuth(data.user, data.accessToken);
      toast.success('Account created successfully!');
      router.push('/dashboard');
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || 'Registration failed');
    },
  });

  const logout = useCallback(() => {
    authApi.logout().catch(() => {
      // Ignore logout errors
    });
    clearAuth();
    clearProjects();
    queryClient.clear();
    router.push('/login');
    toast.success('Logged out successfully');
  }, [clearAuth, clearProjects, queryClient, router]);

  return {
    user,
    isAuthenticated,
    isLoading,
    login: loginMutation.mutate,
    loginAsync: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    register: registerMutation.mutate,
    registerAsync: registerMutation.mutateAsync,
    isRegistering: registerMutation.isPending,
    logout,
    refetchUser,
  };
}

export function useRequireAuth() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  return { isAuthenticated, isLoading };
}
