import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CustomToolbar } from '../components/CustomToolbar';
import { Views } from 'react-big-calendar';

describe('CustomToolbar Component', () => {
  const defaultProps = {
    onNavigate: vi.fn(),
    onView: vi.fn(),
    view: Views.WEEK,
    date: new Date('2026-06-05T12:00:00Z'),
    label: 'June 2026',
    localizer: {} as any,
    showWeekends: true,
    setShowWeekends: vi.fn(),
    onManageProjects: vi.fn(),
    views: [Views.MONTH, Views.WEEK, Views.DAY] as any,
  };

  it('should render correct date label and view buttons', () => {
    render(<CustomToolbar {...defaultProps} />);

    expect(screen.getByText('June 2026')).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByText('Month')).toBeInTheDocument();
    expect(screen.getByText('Week')).toBeInTheDocument();
    expect(screen.getByText('Day')).toBeInTheDocument();
  });

  it('should trigger navigation callbacks', () => {
    const onNavigateSpy = vi.fn();
    render(<CustomToolbar {...defaultProps} onNavigate={onNavigateSpy} />);

    // Buttons order in DOM: [prev_btn, today_btn, next_btn, projects_btn, view_month_btn, view_week_btn, view_day_btn]
    const buttons = screen.getAllByRole('button');
    
    // prev_btn
    fireEvent.click(buttons[0]!);
    expect(onNavigateSpy).toHaveBeenLastCalledWith('PREV');

    // today_btn ("Today")
    fireEvent.click(screen.getByText('Today'));
    expect(onNavigateSpy).toHaveBeenLastCalledWith('TODAY');

    // next_btn
    fireEvent.click(buttons[2]!);
    expect(onNavigateSpy).toHaveBeenLastCalledWith('NEXT');
  });

  it('should trigger projects modal toggle', () => {
    const onManageProjectsSpy = vi.fn();
    render(<CustomToolbar {...defaultProps} onManageProjects={onManageProjectsSpy} />);

    fireEvent.click(screen.getByText('Projects'));
    expect(onManageProjectsSpy).toHaveBeenCalled();
  });

  it('should trigger showWeekends toggle checkbox', () => {
    const setShowWeekendsSpy = vi.fn();
    render(<CustomToolbar {...defaultProps} showWeekends={true} setShowWeekends={setShowWeekendsSpy} />);

    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);

    fireEvent.click(checkbox);
    expect(setShowWeekendsSpy).toHaveBeenCalledWith(false);
  });

  it('should trigger view change callbacks', () => {
    const onViewSpy = vi.fn();
    render(<CustomToolbar {...defaultProps} onView={onViewSpy} />);

    fireEvent.click(screen.getByText('Month'));
    expect(onViewSpy).toHaveBeenCalledWith(Views.MONTH);

    fireEvent.click(screen.getByText('Day'));
    expect(onViewSpy).toHaveBeenCalledWith(Views.DAY);
  });

  it('should request Views.WEEK or Views.WORK_WEEK depending on showWeekends', () => {
    const onViewSpy = vi.fn();
    
    // With showWeekends true
    const { rerender } = render(<CustomToolbar {...defaultProps} showWeekends={true} onView={onViewSpy} />);
    fireEvent.click(screen.getByText('Week'));
    expect(onViewSpy).toHaveBeenLastCalledWith(Views.WEEK);

    // With showWeekends false
    rerender(<CustomToolbar {...defaultProps} showWeekends={false} onView={onViewSpy} />);
    fireEvent.click(screen.getByText('Week'));
    expect(onViewSpy).toHaveBeenLastCalledWith(Views.WORK_WEEK);
  });
});
