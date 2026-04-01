'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Project } from '@/lib/api';

interface ProjectState {
  currentProject: Project | null;
  projects: Project[];
  isLoading: boolean;
  setCurrentProject: (project: Project | null) => void;
  setProjects: (projects: Project[]) => void;
  setLoading: (loading: boolean) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, data: Partial<Project>) => void;
  removeProject: (id: string) => void;
  clear: () => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      currentProject: null,
      projects: [],
      isLoading: true,

      setCurrentProject: (project) => {
        set({ currentProject: project });
      },

      setProjects: (projects) => {
        set({ projects, isLoading: false });
        // Auto-select first project if none selected
        const current = get().currentProject;
        if (!current && projects.length > 0) {
          set({ currentProject: projects[0] });
        }
      },

      setLoading: (isLoading) => {
        set({ isLoading });
      },

      addProject: (project) => {
        set((state) => ({
          projects: [...state.projects, project],
          currentProject: state.currentProject || project,
        }));
      },

      updateProject: (id, data) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, ...data } : p
          ),
          currentProject:
            state.currentProject?.id === id
              ? { ...state.currentProject, ...data }
              : state.currentProject,
        }));
      },

      removeProject: (id) => {
        set((state) => {
          const newProjects = state.projects.filter((p) => p.id !== id);
          return {
            projects: newProjects,
            currentProject:
              state.currentProject?.id === id
                ? newProjects[0] || null
                : state.currentProject,
          };
        });
      },

      clear: () => {
        set({ currentProject: null, projects: [], isLoading: false });
      },
    }),
    {
      name: 'project-storage',
      partialize: (state) => ({
        currentProject: state.currentProject,
      }),
    }
  )
);
