'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useProjectStore } from '@/stores/project.store';
import { projectsApi, type Project } from '@/lib/api';
import { toast } from 'sonner';

export function useProject() {
  const queryClient = useQueryClient();
  const {
    currentProject,
    projects,
    isLoading,
    setCurrentProject,
    setProjects,
    addProject,
    updateProject,
    removeProject,
  } = useProjectStore();

  // Fetch projects
  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  });

  // Sync query data with store
  useEffect(() => {
    if (projectsQuery.data) {
      setProjects(projectsQuery.data);
    }
  }, [projectsQuery.data, setProjects]);

  // Create project mutation
  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      projectsApi.create(data),
    onSuccess: (project) => {
      addProject(project);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project created successfully');
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || 'Failed to create project');
    },
  });

  // Update project mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Project> }) =>
      projectsApi.update(id, data),
    onSuccess: (project) => {
      updateProject(project.id, project);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project updated successfully');
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || 'Failed to update project');
    },
  });

  // Delete project mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: (_, id) => {
      removeProject(id);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project deleted successfully');
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || 'Failed to delete project');
    },
  });

  return {
    currentProject,
    projects,
    isLoading: isLoading || projectsQuery.isLoading,
    setCurrentProject,
    createProject: createMutation.mutate,
    isCreating: createMutation.isPending,
    updateProject: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
    deleteProject: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
    refetch: projectsQuery.refetch,
  };
}

export function useCurrentProject() {
  const { currentProject, isLoading } = useProjectStore();
  return { project: currentProject, isLoading };
}
