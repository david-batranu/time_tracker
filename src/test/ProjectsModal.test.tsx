import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectsModal } from '../components/ProjectsModal';

describe('ProjectsModal Component', () => {
  beforeEach(() => {
    vi.stubGlobal('getComputedStyle', () => ({
      getPropertyValue: () => ''
    }));
  });

  it('should not render when isOpen is false', () => {
    const { container } = render(
      <ProjectsModal
        isOpen={false}
        projects={[]}
        events={[]}
        onClose={vi.fn()}
        onSaveProject={vi.fn()}
        onDeleteProject={vi.fn()}
        onAddProject={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render project list and close button', () => {
    const projects = [
      { id: '1', title: 'Project One', color: '#ff0000' },
      { id: '2', title: 'Project Two', color: '#00ff00' }
    ];
    const onCloseSpy = vi.fn();

    render(
      <ProjectsModal
        isOpen={true}
        projects={projects}
        events={[]}
        onClose={onCloseSpy}
        onSaveProject={vi.fn()}
        onDeleteProject={vi.fn()}
        onAddProject={vi.fn()}
      />
    );

    expect(screen.getByText('Manage Projects')).toBeInTheDocument();
    expect(screen.getByText('Project One')).toBeInTheDocument();
    expect(screen.getByText('Project Two')).toBeInTheDocument();

    const closeBtn = screen.getByText('×');
    fireEvent.click(closeBtn);
    expect(onCloseSpy).toHaveBeenCalled();
  });

  it('should display "No projects found" when projects list is empty', () => {
    render(
      <ProjectsModal
        isOpen={true}
        projects={[]}
        events={[]}
        onClose={vi.fn()}
        onSaveProject={vi.fn()}
        onDeleteProject={vi.fn()}
        onAddProject={vi.fn()}
      />
    );

    expect(screen.getByText('No projects found.')).toBeInTheDocument();
  });

  it('should toggle adding project form and call onAddProject', () => {
    const onAddSpy = vi.fn();
    render(
      <ProjectsModal
        isOpen={true}
        projects={[]}
        events={[]}
        onClose={vi.fn()}
        onSaveProject={vi.fn()}
        onDeleteProject={vi.fn()}
        onAddProject={onAddSpy}
      />
    );

    const addNewBtn = screen.getByText('+ Add New Project');
    fireEvent.click(addNewBtn);

    const input = screen.getByPlaceholderText('Project title...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'New Test Project' } });

    const addBtn = screen.getByText('Add');
    fireEvent.click(addBtn);

    expect(onAddSpy).toHaveBeenCalledWith('New Test Project');
  });

  it('should cancel adding project and reset input', () => {
    render(
      <ProjectsModal
        isOpen={true}
        projects={[]}
        events={[]}
        onClose={vi.fn()}
        onSaveProject={vi.fn()}
        onDeleteProject={vi.fn()}
        onAddProject={vi.fn()}
      />
    );

    const addNewBtn = screen.getByText('+ Add New Project');
    fireEvent.click(addNewBtn);

    const input = screen.getByPlaceholderText('Project title...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'New Cancelled Project' } });

    const cancelBtn = screen.getByText('Cancel');
    fireEvent.click(cancelBtn);

    expect(screen.queryByPlaceholderText('Project title...')).not.toBeInTheDocument();
    expect(screen.getByText('+ Add New Project')).toBeInTheDocument();
  });
});
