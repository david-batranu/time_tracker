import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EventModal } from '../components/EventModal';
import { resetMockStorage } from './setup';

describe('EventModal Component', () => {
  beforeEach(() => {
    resetMockStorage();
  });

  it('should not render when isOpen is false', () => {
    const { container } = render(
      <EventModal
        isOpen={false}
        mode="create"
        projects={[]}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onAddProject={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render form fields when open in create mode', () => {
    render(
      <EventModal
        isOpen={true}
        mode="create"
        projects={[]}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onAddProject={vi.fn()}
      />
    );

    expect(screen.getByText('New Event')).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
    expect(screen.getByLabelText('Start Date & Time')).toBeInTheDocument();
    expect(screen.getByLabelText('End Date & Time')).toBeInTheDocument();
  });

  it('should display inline validation error if end time is before start time', () => {
    const onSaveSpy = vi.fn();
    render(
      <EventModal
        isOpen={true}
        mode="create"
        projects={[]}
        onClose={vi.fn()}
        onSave={onSaveSpy}
        onDelete={vi.fn()}
        onAddProject={vi.fn()}
      />
    );

    // Enter start date and end date
    const startDateInput = screen.getByLabelText('Start Date & Time') as HTMLInputElement;
    const endDateInput = screen.getByLabelText('End Date & Time') as HTMLInputElement;
    const startTimeInput = screen.getByLabelText('Start Time') as HTMLInputElement;
    const endTimeInput = screen.getByLabelText('End Time') as HTMLInputElement;

    fireEvent.change(startDateInput, { target: { value: '2026-06-05' } });
    fireEvent.change(startTimeInput, { target: { value: '12:00' } });
    
    // End date is before start date
    fireEvent.change(endDateInput, { target: { value: '2026-06-05' } });
    fireEvent.change(endTimeInput, { target: { value: '11:00' } });

    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    expect(screen.getByText('End time must be after start time.')).toBeInTheDocument();
    expect(onSaveSpy).not.toHaveBeenCalled();
  });

  it('should call onSave with correct local-parsed Date objects when inputs are valid', () => {
    const onSaveSpy = vi.fn();
    render(
      <EventModal
        isOpen={true}
        mode="create"
        projects={[]}
        onClose={vi.fn()}
        onSave={onSaveSpy}
        onDelete={vi.fn()}
        onAddProject={vi.fn()}
      />
    );

    const titleInput = screen.getByLabelText('Title');
    const startDateInput = screen.getByLabelText('Start Date & Time');
    const startTimeInput = screen.getByLabelText('Start Time');
    const endDateInput = screen.getByLabelText('End Date & Time');
    const endTimeInput = screen.getByLabelText('End Time');

    fireEvent.change(titleInput, { target: { value: 'Local Time Task' } });
    fireEvent.change(startDateInput, { target: { value: '2026-06-05' } });
    fireEvent.change(startTimeInput, { target: { value: '09:00' } });
    fireEvent.change(endDateInput, { target: { value: '2026-06-05' } });
    fireEvent.change(endTimeInput, { target: { value: '10:30' } });

    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    expect(onSaveSpy).toHaveBeenCalledTimes(1);
    
    const firstCall = onSaveSpy.mock.calls[0];
    if (!firstCall) throw new Error('onSave was not called');
    const savedData = firstCall[0];
    if (!savedData) throw new Error('onSave was called with no data');
    
    expect(savedData.title).toBe('Local Time Task');
    
    // Check local parsing
    const expectedStart = new Date(2026, 5, 5, 9, 0); // month is 0-indexed: 5 is June
    const expectedEnd = new Date(2026, 5, 5, 10, 30);
    
    expect(savedData.start.getTime()).toBe(expectedStart.getTime());
    expect(savedData.end.getTime()).toBe(expectedEnd.getTime());
  });

  it('should display error if start or end date is missing', () => {
    render(
      <EventModal
        isOpen={true}
        mode="create"
        projects={[]}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onAddProject={vi.fn()}
      />
    );

    // Clear date inputs
    const startDateInput = screen.getByLabelText('Start Date & Time') as HTMLInputElement;
    fireEvent.change(startDateInput, { target: { value: '' } });

    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    expect(screen.getByText('Please fill in start and end dates.')).toBeInTheDocument();
  });

  it('should display error for invalid date/time values', () => {
    const originalDate = globalThis.Date;
    
    // Create a mock Date constructor that returns an invalid date when instantiated with arguments
    const MockDate = function(...args: any[]) {
      if (args.length > 0) {
        return new originalDate(NaN);
      }
      return new originalDate();
    } as any;
    MockDate.prototype = originalDate.prototype;
    MockDate.now = originalDate.now;
    MockDate.UTC = originalDate.UTC;
    MockDate.parse = originalDate.parse;
    
    globalThis.Date = MockDate;

    try {
      render(
        <EventModal
          isOpen={true}
          mode="create"
          projects={[]}
          onClose={vi.fn()}
          onSave={vi.fn()}
          onDelete={vi.fn()}
          onAddProject={vi.fn()}
        />
      );

      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      expect(screen.getByText('Invalid date/time format.')).toBeInTheDocument();
    } finally {
      globalThis.Date = originalDate;
    }
  });

  it('should prepopulate fields and show delete button in edit mode', () => {
    const mockEvent = {
      id: 'e-123',
      title: 'Editing Task',
      start: new Date(2026, 5, 5, 14, 0),
      end: new Date(2026, 5, 5, 15, 30),
      projectId: 'p-1',
      description: 'Test description detail',
      color: '#fff'
    };

    const onDeleteSpy = vi.fn();
    const onCloseSpy = vi.fn();

    render(
      <EventModal
        isOpen={true}
        mode="edit"
        initialData={mockEvent}
        projects={[{ id: 'p-1', title: 'Test Proj', color: '#fff' }]}
        onClose={onCloseSpy}
        onSave={vi.fn()}
        onDelete={onDeleteSpy}
        onAddProject={vi.fn()}
      />
    );

    expect(screen.getByText('Edit Event')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Editing Task')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test description detail')).toBeInTheDocument();
    expect((screen.getByLabelText('Project') as HTMLSelectElement).value).toBe('p-1');

    const deleteBtn = screen.getByText('Delete');
    fireEvent.click(deleteBtn);
    expect(onDeleteSpy).toHaveBeenCalled();

    const cancelBtn = screen.getByText('Cancel');
    fireEvent.click(cancelBtn);
    expect(onCloseSpy).toHaveBeenCalled();
  });

  it('should support dynamic project creation on the fly', () => {
    const onAddProjectSpy = vi.fn(() => ({ id: 'new-p-99', title: 'Dynamic Proj', color: '#000' }));
    const onSaveSpy = vi.fn();

    render(
      <EventModal
        isOpen={true}
        mode="create"
        projects={[]}
        onClose={vi.fn()}
        onSave={onSaveSpy}
        onDelete={vi.fn()}
        onAddProject={onAddProjectSpy}
      />
    );

    const titleInput = screen.getByLabelText('Title');
    fireEvent.change(titleInput, { target: { value: 'Dynamic Task' } });

    // Switch to new project mode
    const newProjBtn = screen.getByText('New');
    fireEvent.click(newProjBtn);

    const newProjInput = screen.getByPlaceholderText('New project title');
    fireEvent.change(newProjInput, { target: { value: 'Dynamic Proj' } });

    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    expect(onAddProjectSpy).toHaveBeenCalledWith('Dynamic Proj');
    expect(onSaveSpy).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Dynamic Task',
      projectId: 'new-p-99'
    }));
  });
});
