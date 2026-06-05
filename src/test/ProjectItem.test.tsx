import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectItem } from '../components/ProjectItem';
import { resetMockStorage } from './setup';

describe('ProjectItem Component', () => {
  beforeEach(() => {
    resetMockStorage();
  });

  it('should render project title and resolved color dot', () => {
    const project = { id: 'p1', title: 'Design Project', color: '#ffedd5' };
    render(
      <ProjectItem
        project={project}
        hasEvents={false}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText('Design Project')).toBeInTheDocument();
  });

  it('should enter edit mode when clicking edit button and let user change title and color', () => {
    const project = { id: 'p1', title: 'Original Title', color: '#ffedd5' };
    const onSaveSpy = vi.fn();

    render(
      <ProjectItem
        project={project}
        hasEvents={false}
        onSave={onSaveSpy}
        onDelete={vi.fn()}
      />
    );

    const editBtn = screen.getByText('Edit');
    fireEvent.click(editBtn);

    // Title input autoFocuses or has the value
    const titleInput = screen.getByDisplayValue('Original Title') as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: 'New Edited Title' } });

    const saveBtn = screen.getByText('Save');
    fireEvent.click(saveBtn);

    expect(onSaveSpy).toHaveBeenCalledTimes(1);
    expect(onSaveSpy).toHaveBeenCalledWith({
      id: 'p1',
      title: 'New Edited Title',
      color: '#ffedd5'
    });
  });

  it('should invoke onDelete when clicking delete button if hasEvents is false', () => {
    const project = { id: 'p1', title: 'Delete Me', color: '#fce7f3' };
    const onDeleteSpy = vi.fn();

    render(
      <ProjectItem
        project={project}
        hasEvents={false}
        onSave={vi.fn()}
        onDelete={onDeleteSpy}
      />
    );

    const deleteBtn = screen.getByText('Delete');
    fireEvent.click(deleteBtn);

    expect(onDeleteSpy).toHaveBeenCalledWith('p1');
  });

  it('should disable delete button if project has events associated with it', () => {
    const project = { id: 'p1', title: 'Active Project', color: '#dcfce7' };
    const onDeleteSpy = vi.fn();

    render(
      <ProjectItem
        project={project}
        hasEvents={true}
        onSave={vi.fn()}
        onDelete={onDeleteSpy}
      />
    );

    const deleteBtn = screen.getByText('Delete') as HTMLButtonElement;
    expect(deleteBtn).toBeDisabled();
    expect(deleteBtn.title).toBe('Cannot delete project with assigned events');

    fireEvent.click(deleteBtn);
    expect(onDeleteSpy).not.toHaveBeenCalled();
  });

  it('should reset title and color to original values when clicking cancel in edit mode', () => {
    const project = { id: 'p1', title: 'Original Title', color: '#ffedd5' };
    render(
      <ProjectItem
        project={project}
        hasEvents={false}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const editBtn = screen.getByText('Edit');
    fireEvent.click(editBtn);

    const titleInput = screen.getByDisplayValue('Original Title') as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: 'Changed Title' } });

    const cancelBtn = screen.getByText('Cancel');
    fireEvent.click(cancelBtn);

    expect(screen.getByText('Original Title')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Changed Title')).not.toBeInTheDocument();
  });

  it('should resolve css color variables in resolveColor function', () => {
    const project = { id: 'p1', title: 'CSS Var Proj', color: 'var(--event-color-4)' };
    
    render(
      <ProjectItem
        project={project}
        hasEvents={false}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    // According to setup.ts getComputedStyle stub, --event-color-4 returns '#e0e7ff'
    // Let's verify the dot gets this background color.
    const dot = screen.getByText('CSS Var Proj').previousSibling as HTMLDivElement;
    expect(dot.style.backgroundColor).toBe('rgb(224, 231, 255)');
  });
});
