import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import Settings from './Settings';
import toast from 'react-hot-toast';

// Mock dependencies
vi.mock('axios');
vi.mock('react-hot-toast');

describe('Settings Component', () => {
  const mockSettings = {
    theme: 'light',
    notification_preferences: {
      email: true,
      push: true,
      task_assigned: true,
      status_change: true,
      mentions: true,
    },
    display_options: {
      compact_view: false,
      show_completed: true,
      items_per_page: 20,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('token', 'test-token');
    
    // Mock successful GET request
    axios.get.mockResolvedValue({
      data: mockSettings,
    });
  });

  it('should render settings page with all sections', async () => {
    render(<Settings />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    // Check for main sections
    expect(screen.getByText('Theme')).toBeInTheDocument();
    expect(screen.getByText('Notification Preferences')).toBeInTheDocument();
    expect(screen.getByText('Display Options')).toBeInTheDocument();
  });

  it('should load user settings on mount', async () => {
    render(<Settings />);

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/settings'),
        expect.objectContaining({
          headers: { Authorization: 'Bearer test-token' },
        })
      );
    });
  });

  it('should display error toast when settings fail to load', async () => {
    axios.get.mockRejectedValue({
      response: { data: { error: 'Failed to load settings' } },
    });

    render(<Settings />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to load settings');
    });
  });

  it('should update theme when theme toggle is clicked', async () => {
    axios.patch.mockResolvedValue({
      data: {
        message: 'Settings updated successfully',
        settings: { ...mockSettings, theme: 'dark' },
      },
    });

    render(<Settings />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Theme')).toBeInTheDocument();
    });

    // Click dark theme button
    const darkButton = screen.getByRole('button', { name: /dark theme/i });
    fireEvent.click(darkButton);

    await waitFor(() => {
      expect(axios.patch).toHaveBeenCalledWith(
        expect.stringContaining('/settings'),
        { theme: 'dark' },
        expect.objectContaining({
          headers: { Authorization: 'Bearer test-token' },
        })
      );
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Settings saved successfully');
    });
  });

  it('should update notification preferences when checkbox is toggled', async () => {
    axios.patch.mockResolvedValue({
      data: {
        message: 'Settings updated successfully',
        settings: {
          ...mockSettings,
          notification_preferences: {
            ...mockSettings.notification_preferences,
            email: false,
          },
        },
      },
    });

    render(<Settings />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Email Notifications')).toBeInTheDocument();
    });

    // Find and click email notifications checkbox
    const emailCheckbox = screen.getByRole('checkbox', { name: /email notifications/i });
    fireEvent.click(emailCheckbox);

    await waitFor(() => {
      expect(axios.patch).toHaveBeenCalledWith(
        expect.stringContaining('/settings'),
        {
          notification_preferences: {
            ...mockSettings.notification_preferences,
            email: false,
          },
        },
        expect.objectContaining({
          headers: { Authorization: 'Bearer test-token' },
        })
      );
    });
  });

  it('should update display options when switch is toggled', async () => {
    axios.patch.mockResolvedValue({
      data: {
        message: 'Settings updated successfully',
        settings: {
          ...mockSettings,
          display_options: {
            ...mockSettings.display_options,
            compact_view: true,
          },
        },
      },
    });

    render(<Settings />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Compact View')).toBeInTheDocument();
    });

    // Find and click compact view switch
    const compactViewSwitch = screen.getByRole('checkbox', { name: /compact view/i });
    fireEvent.click(compactViewSwitch);

    await waitFor(() => {
      expect(axios.patch).toHaveBeenCalledWith(
        expect.stringContaining('/settings'),
        {
          display_options: {
            ...mockSettings.display_options,
            compact_view: true,
          },
        },
        expect.objectContaining({
          headers: { Authorization: 'Bearer test-token' },
        })
      );
    });
  });

  it('should display error toast when settings update fails', async () => {
    axios.patch.mockRejectedValue({
      response: { data: { error: 'Failed to save settings' } },
    });

    render(<Settings />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Theme')).toBeInTheDocument();
    });

    // Click dark theme button
    const darkButton = screen.getByRole('button', { name: /dark theme/i });
    fireEvent.click(darkButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to save settings');
    });
  });

  it('should show saving indicator when updating settings', async () => {
    // Mock a delayed response
    axios.patch.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                data: {
                  message: 'Settings updated successfully',
                  settings: mockSettings,
                },
              }),
            100
          )
        )
    );

    render(<Settings />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Theme')).toBeInTheDocument();
    });

    // Click dark theme button
    const darkButton = screen.getByRole('button', { name: /dark theme/i });
    fireEvent.click(darkButton);

    // Check for saving indicator
    await waitFor(() => {
      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });

    // Wait for save to complete
    await waitFor(() => {
      expect(screen.queryByText('Saving...')).not.toBeInTheDocument();
    });
  });

  it('should handle null settings from backend gracefully', async () => {
    axios.get.mockResolvedValue({
      data: {
        theme: null,
        notification_preferences: null,
        display_options: null,
      },
    });

    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    // Should use default values
    expect(screen.getByRole('button', { name: /light theme/i })).toHaveClass('Mui-selected');
  });

  it('should display auto theme info message when auto is selected', async () => {
    axios.patch.mockResolvedValue({
      data: {
        message: 'Settings updated successfully',
        settings: { ...mockSettings, theme: 'auto' },
      },
    });

    render(<Settings />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Theme')).toBeInTheDocument();
    });

    // Click auto theme button
    const autoButton = screen.getByRole('button', { name: /auto theme/i });
    fireEvent.click(autoButton);

    await waitFor(() => {
      expect(screen.getByText("Auto mode will match your system's theme preference")).toBeInTheDocument();
    });
  });
});
