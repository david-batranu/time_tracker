import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';
import { resetMockStorage } from './setup';

describe('App Component Integration', () => {
  beforeEach(() => {
    resetMockStorage();
    vi.stubGlobal('getComputedStyle', () => ({
      getPropertyValue: (prop: string) => {
        if (prop === '--event-color-4') return '#e0e7ff';
        return '';
      }
    }));
  });

  it('should render loading spinner initially, then load main calendar app', async () => {
    render(<App />);
    
    // Shows loading state initially
    expect(screen.getByText('Loading Time Tracker...')).toBeInTheDocument();

    // After storage get resolves, shows main calendar toolbar
    await waitFor(() => {
      expect(screen.queryByText('Loading Time Tracker...')).not.toBeInTheDocument();
      expect(screen.getByText('Projects')).toBeInTheDocument();
    });
  });

  it('should open and close the projects modal', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.queryByText('Loading Time Tracker...')).not.toBeInTheDocument();
    });

    // Projects Modal is not in the document initially
    expect(screen.queryByText('Manage Projects')).not.toBeInTheDocument();

    // Click "Projects" button in the toolbar
    const projectsBtn = screen.getByText('Projects');
    fireEvent.click(projectsBtn);

    // Modal is now open
    expect(screen.getByText('Manage Projects')).toBeInTheDocument();

    // Click Close (×) button
    const closeBtn = screen.getByText('×');
    fireEvent.click(closeBtn);

    // Modal is closed
    expect(screen.queryByText('Manage Projects')).not.toBeInTheDocument();
  });
});
