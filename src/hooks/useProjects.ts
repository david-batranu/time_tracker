import { useState, useEffect, useCallback, useMemo } from 'react';
import { Project, COLORS } from '../types';
import { storage } from '../storage';

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    storage.getProjects()
      .then(setProjects)
      .catch((err) => console.error('Failed to load projects:', err));
  }, []);

  const addProject = useCallback((title: string): Project => {
    const nextId = (projects.reduce((max, p) => Math.max(max, parseInt(p.id) || 0), 0) + 1).toString();
    const newColor = COLORS[projects.length % COLORS.length] || '#e0e7ff';
    const newProj: Project = {
      id: nextId,
      title,
      color: newColor
    };
    const next = [...projects, newProj];
    setProjects(next);
    storage.setProjects(next).catch((err) => console.error('Failed to save project:', err));
    return newProj;
  }, [projects]);

  const updateProject = useCallback((updatedProj: Project) => {
    const next = projects.map(p => p.id === updatedProj.id ? updatedProj : p);
    setProjects(next);
    storage.setProjects(next).catch((err) => console.error('Failed to update project:', err));
  }, [projects]);

  const deleteProject = useCallback((projectId: string) => {
    const next = projects.filter(p => p.id !== projectId);
    setProjects(next);
    storage.setProjects(next).catch((err) => console.error('Failed to delete project:', err));
  }, [projects]);

  const projectMap = useMemo(() => {
    return new Map(projects.map(p => [p.id, p]));
  }, [projects]);

  return {
    projects,
    addProject,
    updateProject,
    deleteProject,
    projectMap,
  };
}
