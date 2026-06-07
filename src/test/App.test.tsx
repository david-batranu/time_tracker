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
      expect(screen.getByTitle('Settings')).toBeInTheDocument();
    });
  });

  it('should open and close the settings modal', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.queryByText('Loading Time Tracker...')).not.toBeInTheDocument();
    });

    // Settings Modal is not in the document initially
    expect(screen.queryByText('+ Add New Project')).not.toBeInTheDocument();

    // Click Settings button in the toolbar
    const settingsBtn = screen.getByTitle('Settings');
    fireEvent.click(settingsBtn);

    // Modal is now open
    expect(screen.getByText('+ Add New Project')).toBeInTheDocument();

    // Click Close (×) button
    const closeBtn = screen.getByText('×');
    fireEvent.click(closeBtn);

    // Modal is closed
    expect(screen.queryByText('+ Add New Project')).not.toBeInTheDocument();
  });
});
