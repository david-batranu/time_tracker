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
    onManageSettings: vi.fn(),
    quotaUsage: { percentage: 50 },
    views: [Views.MONTH, Views.WEEK, Views.DAY] as any,
  };

  it('should render correct date label and view buttons', () => {
    render(<CustomToolbar {...defaultProps} />);

    expect(screen.getByText('June 2026')).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Month')).toBeInTheDocument();
    expect(screen.getByText('Week')).toBeInTheDocument();
    expect(screen.getByText('Day')).toBeInTheDocument();
  });

  it('should trigger navigation callbacks', () => {
    const onNavigateSpy = vi.fn();
    render(<CustomToolbar {...defaultProps} onNavigate={onNavigateSpy} />);

    // Buttons order in DOM: [prev_btn, today_btn, next_btn, view_month_btn, view_week_btn, view_day_btn, settings_btn]
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

  it('should trigger settings toggle', () => {
    const onManageSettingsSpy = vi.fn();
    render(<CustomToolbar {...defaultProps} onManageSettings={onManageSettingsSpy} />);

    // The settings button is the last button
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[buttons.length - 1]!);
    expect(onManageSettingsSpy).toHaveBeenCalled();
  });

  it('should trigger view change callbacks', () => {
    const onViewSpy = vi.fn();
    render(<CustomToolbar {...defaultProps} onView={onViewSpy} />);

    fireEvent.click(screen.getByText('Month'));
    expect(onViewSpy).toHaveBeenCalledWith(Views.MONTH);

    fireEvent.click(screen.getByText('Day'));
    expect(onViewSpy).toHaveBeenCalledWith(Views.DAY);
  });
});
