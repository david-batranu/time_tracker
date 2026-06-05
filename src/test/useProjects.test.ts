import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useProjects } from '../hooks/useProjects';
import { resetMockStorage } from './setup';

describe('useProjects Hook', () => {
  beforeEach(() => {
    resetMockStorage();
  });

  it('should initialize with empty projects list', async () => {
    const { result } = renderHook(() => useProjects());
    
    await waitFor(() => {
      expect(result.current.projects).toEqual([]);
    });
  });

  it('should add projects and update project map', async () => {
    const { result } = renderHook(() => useProjects());

    await waitFor(() => {
      expect(result.current.projects).toEqual([]);
    });

    let newProj: any;
    act(() => {
      newProj = result.current.addProject('Test Project');
    });

    expect(result.current.projects.length).toBe(1);
    expect(result.current.projects[0]?.title).toBe('Test Project');
    expect(result.current.projectMap.get(newProj.id)).toEqual(newProj);
  });

  it('should update and delete projects', async () => {
    const { result } = renderHook(() => useProjects());

    await waitFor(() => {
      expect(result.current.projects).toEqual([]);
    });

    let newProj: any;
    act(() => {
      newProj = result.current.addProject('Original Title');
    });

    act(() => {
      result.current.updateProject({ ...newProj, title: 'Updated Title' });
    });

    expect(result.current.projects[0]?.title).toBe('Updated Title');
    expect(result.current.projectMap.get(newProj.id)?.title).toBe('Updated Title');

    act(() => {
      result.current.deleteProject(newProj.id);
    });

    expect(result.current.projects.length).toBe(0);
    expect(result.current.projectMap.has(newProj.id)).toBe(false);
  });
});
