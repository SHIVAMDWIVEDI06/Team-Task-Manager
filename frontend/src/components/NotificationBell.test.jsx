import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';
import NotificationBell from './NotificationBell';
import { NotificationProvider } from '../context/NotificationContext';
import axios from 'axios';

// Mock axios
vi.mock('axios');

// Mock AuthContext
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, username: 'testuser' }
  })
}));

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString();
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Wrapper component with all necessary providers
const AllTheProviders = ({ children }) => (
  <BrowserRouter>
    <NotificationProvider>{children}</NotificationProvider>
  </BrowserRouter>
);

describe('NotificationBell Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    localStorageMock.setItem('token', 'test-token');
    mockNavigate.mockClear();
  });

  describe('Notification Display and Badge Count', () => {
    it('should display correct unread count badge', async () => {
      const mockNotifications = [
        {
          id: 1,
          message: 'Task assigned to you',
          is_read: false,
          type: 'task_assigned',
          created_at: new Date().toISOString()
        },
        {
          id: 2,
          message: 'Task status changed',
          is_read: false,
          type: 'task_status_changed',
          created_at: new Date().toISOString()
        },
        {
          id: 3,
          message: 'You were mentioned',
          is_read: true,
          type: 'mention',
          created_at: new Date().toISOString()
        }
      ];

      axios.get.mockResolvedValueOnce({
        data: {
          notifications: mockNotifications,
          unreadCount: 2
        }
      });

      render(<NotificationBell />, { wrapper: AllTheProviders });

      // Wait for notifications to load
      await waitFor(() => {
        const badge = screen.getByText('2');
        expect(badge).toBeInTheDocument();
      });
    });

    it('should display no badge when all notifications are read', async () => {
      const mockNotifications = [
        {
          id: 1,
          message: 'Task assigned to you',
          is_read: true,
          type: 'task_assigned',
          created_at: new Date().toISOString()
        }
      ];

      axios.get.mockResolvedValueOnce({
        data: {
          notifications: mockNotifications,
          unreadCount: 0
        }
      });

      render(<NotificationBell />, { wrapper: AllTheProviders });

      // Wait for notifications to load and verify badge is invisible (shows 0)
      await waitFor(() => {
        const badge = screen.getByText('0');
        expect(badge).toHaveClass('MuiBadge-invisible');
      });
    });

    it('should display notifications list when bell is clicked', async () => {
      const mockNotifications = [
        {
          id: 1,
          message: 'Task assigned to you',
          is_read: false,
          type: 'task_assigned',
          created_at: new Date().toISOString()
        },
        {
          id: 2,
          message: 'Task status changed to In Progress',
          is_read: false,
          type: 'task_status_changed',
          created_at: new Date().toISOString()
        }
      ];

      axios.get.mockResolvedValueOnce({
        data: {
          notifications: mockNotifications,
          unreadCount: 2
        }
      });

      const user = userEvent.setup();
      render(<NotificationBell />, { wrapper: AllTheProviders });

      // Wait for notifications to load
      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument();
      });

      // Click the bell icon
      const bellButton = screen.getByRole('button', { name: /unread notifications/i });
      await user.click(bellButton);

      // Check if notifications are displayed
      await waitFor(() => {
        expect(screen.getByText('Task assigned to you')).toBeInTheDocument();
        expect(screen.getByText('Task status changed to In Progress')).toBeInTheDocument();
      });
    });

    it('should display "No notifications yet" when there are no notifications', async () => {
      axios.get.mockResolvedValueOnce({
        data: {
          notifications: [],
          unreadCount: 0
        }
      });

      const user = userEvent.setup();
      render(<NotificationBell />, { wrapper: AllTheProviders });

      // Wait for notifications to load
      await waitFor(() => {
        const badge = screen.getByText('0');
        expect(badge).toHaveClass('MuiBadge-invisible');
      });

      // Click the bell icon
      const bellButton = screen.getByRole('button', { name: /unread notifications/i });
      await user.click(bellButton);

      // Check for empty state message
      await waitFor(() => {
        expect(screen.getByText('No notifications yet')).toBeInTheDocument();
        expect(screen.getByText("We'll notify you when something happens")).toBeInTheDocument();
      });
    });

    it('should display relative timestamps correctly', async () => {
      const now = new Date();
      const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);

      const mockNotifications = [
        {
          id: 1,
          message: 'Recent notification',
          is_read: false,
          type: 'task_assigned',
          created_at: twoMinutesAgo.toISOString()
        }
      ];

      axios.get.mockResolvedValueOnce({
        data: {
          notifications: mockNotifications,
          unreadCount: 1
        }
      });

      const user = userEvent.setup();
      render(<NotificationBell />, { wrapper: AllTheProviders });

      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });

      // Click the bell icon
      const bellButton = screen.getByRole('button', { name: /unread notifications/i });
      await user.click(bellButton);

      // Check for relative timestamp
      await waitFor(() => {
        expect(screen.getByText(/2 minutes ago/i)).toBeInTheDocument();
      });
    });
  });

  describe('Mark as Read Functionality', () => {
    it('should mark individual notification as read when check button is clicked', async () => {
      const mockNotifications = [
        {
          id: 1,
          message: 'Task assigned to you',
          is_read: false,
          type: 'task_assigned',
          created_at: new Date().toISOString()
        }
      ];

      axios.get.mockResolvedValueOnce({
        data: {
          notifications: mockNotifications,
          unreadCount: 1
        }
      });

      axios.patch.mockResolvedValueOnce({
        data: { message: 'Notification marked as read' }
      });

      const user = userEvent.setup();
      render(<NotificationBell />, { wrapper: AllTheProviders });

      // Wait for notifications to load
      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });

      // Click the bell icon
      const bellButton = screen.getByRole('button', { name: /unread notifications/i });
      await user.click(bellButton);

      // Wait for notification to appear
      await waitFor(() => {
        expect(screen.getByText('Task assigned to you')).toBeInTheDocument();
      });

      // Click the mark as read button
      const markAsReadButton = screen.getByRole('button', { name: /mark as read/i });
      await user.click(markAsReadButton);

      // Verify API was called
      await waitFor(() => {
        expect(axios.patch).toHaveBeenCalledWith(
          expect.stringContaining('/notifications/1/read'),
          {},
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer test-token'
            })
          })
        );
      });

      // Badge count should be updated to 0
      await waitFor(() => {
        expect(screen.queryByText('1')).not.toBeInTheDocument();
      });
    });

    it('should mark all notifications as read when "Mark all read" button is clicked', async () => {
      const mockNotifications = [
        {
          id: 1,
          message: 'Task assigned to you',
          is_read: false,
          type: 'task_assigned',
          created_at: new Date().toISOString()
        },
        {
          id: 2,
          message: 'Task status changed',
          is_read: false,
          type: 'task_status_changed',
          created_at: new Date().toISOString()
        }
      ];

      axios.get.mockResolvedValueOnce({
        data: {
          notifications: mockNotifications,
          unreadCount: 2
        }
      });

      axios.patch.mockResolvedValueOnce({
        data: { message: 'All notifications marked as read' }
      });

      const user = userEvent.setup();
      render(<NotificationBell />, { wrapper: AllTheProviders });

      // Wait for notifications to load
      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument();
      });

      // Click the bell icon
      const bellButton = screen.getByRole('button', { name: /unread notifications/i });
      await user.click(bellButton);

      // Wait for notifications to appear
      await waitFor(() => {
        expect(screen.getByText('Task assigned to you')).toBeInTheDocument();
      });

      // Click the "Mark all read" button
      const markAllReadButton = screen.getByRole('button', { name: /mark all read/i });
      await user.click(markAllReadButton);

      // Verify API was called
      await waitFor(() => {
        expect(axios.patch).toHaveBeenCalledWith(
          expect.stringContaining('/notifications/read-all'),
          {},
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer test-token'
            })
          })
        );
      });

      // Badge should disappear
      await waitFor(() => {
        expect(screen.queryByText('2')).not.toBeInTheDocument();
      });
    });

    it('should automatically mark notification as read when clicked', async () => {
      const mockNotifications = [
        {
          id: 1,
          message: 'Task assigned to you',
          is_read: false,
          type: 'task_assigned',
          related_id: 123,
          project_id: 456,
          created_at: new Date().toISOString()
        }
      ];

      axios.get.mockResolvedValueOnce({
        data: {
          notifications: mockNotifications,
          unreadCount: 1
        }
      });

      axios.patch.mockResolvedValueOnce({
        data: { message: 'Notification marked as read' }
      });

      const user = userEvent.setup();
      render(<NotificationBell />, { wrapper: AllTheProviders });

      // Wait for notifications to load
      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });

      // Click the bell icon
      const bellButton = screen.getByRole('button', { name: /unread notifications/i });
      await user.click(bellButton);

      // Wait for notification to appear
      await waitFor(() => {
        expect(screen.getByText('Task assigned to you')).toBeInTheDocument();
      });

      // Click the notification itself
      const notification = screen.getByText('Task assigned to you');
      await user.click(notification);

      // Verify mark as read API was called
      await waitFor(() => {
        expect(axios.patch).toHaveBeenCalledWith(
          expect.stringContaining('/notifications/1/read'),
          {},
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer test-token'
            })
          })
        );
      });
    });
  });

  describe('Navigation from Notifications', () => {
    it('should navigate to project page when task notification is clicked', async () => {
      const mockNotifications = [
        {
          id: 1,
          message: 'Task assigned to you',
          is_read: false,
          type: 'task_assigned',
          related_id: 123,
          project_id: 456,
          created_at: new Date().toISOString()
        }
      ];

      axios.get.mockResolvedValueOnce({
        data: {
          notifications: mockNotifications,
          unreadCount: 1
        }
      });

      axios.patch.mockResolvedValueOnce({
        data: { message: 'Notification marked as read' }
      });

      const user = userEvent.setup();
      render(<NotificationBell />, { wrapper: AllTheProviders });

      // Wait for notifications to load
      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });

      // Click the bell icon
      const bellButton = screen.getByRole('button', { name: /unread notifications/i });
      await user.click(bellButton);

      // Wait for notification to appear
      await waitFor(() => {
        expect(screen.getByText('Task assigned to you')).toBeInTheDocument();
      });

      // Click the notification
      const notification = screen.getByText('Task assigned to you');
      await user.click(notification);

      // Verify navigation was called
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/projects/456');
      });
    });

    it('should navigate to projects page when project invitation notification is clicked', async () => {
      const mockNotifications = [
        {
          id: 1,
          message: 'You were invited to a project',
          is_read: false,
          type: 'project_invitation',
          related_id: 789,
          created_at: new Date().toISOString()
        }
      ];

      axios.get.mockResolvedValueOnce({
        data: {
          notifications: mockNotifications,
          unreadCount: 1
        }
      });

      const user = userEvent.setup();
      render(<NotificationBell />, { wrapper: AllTheProviders });

      // Wait for notifications to load
      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });

      // Click the bell icon
      const bellButton = screen.getByRole('button', { name: /unread notifications/i });
      await user.click(bellButton);

      // Wait for notification to appear
      await waitFor(() => {
        expect(screen.getByText('You were invited to a project')).toBeInTheDocument();
      });

      // Click the notification
      const notification = screen.getByText('You were invited to a project');
      await user.click(notification);

      // Verify navigation was called
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/projects');
      });
    });

    it('should navigate to project page when task status changed notification is clicked', async () => {
      const mockNotifications = [
        {
          id: 1,
          message: 'Task status changed to In Progress',
          is_read: false,
          type: 'task_status_changed',
          related_id: 123,
          project_id: 456,
          created_at: new Date().toISOString()
        }
      ];

      axios.get.mockResolvedValueOnce({
        data: {
          notifications: mockNotifications,
          unreadCount: 1
        }
      });

      axios.patch.mockResolvedValueOnce({
        data: { message: 'Notification marked as read' }
      });

      const user = userEvent.setup();
      render(<NotificationBell />, { wrapper: AllTheProviders });

      // Wait for notifications to load
      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });

      // Click the bell icon
      const bellButton = screen.getByRole('button', { name: /unread notifications/i });
      await user.click(bellButton);

      // Wait for notification to appear
      await waitFor(() => {
        expect(screen.getByText('Task status changed to In Progress')).toBeInTheDocument();
      });

      // Click the notification
      const notification = screen.getByText('Task status changed to In Progress');
      await user.click(notification);

      // Verify navigation was called
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/projects/456');
      });
    });

    it('should navigate to project page when mention notification is clicked', async () => {
      const mockNotifications = [
        {
          id: 1,
          message: 'You were mentioned in a comment',
          is_read: false,
          type: 'mention',
          related_id: 123,
          project_id: 456,
          created_at: new Date().toISOString()
        }
      ];

      axios.get.mockResolvedValueOnce({
        data: {
          notifications: mockNotifications,
          unreadCount: 1
        }
      });

      axios.patch.mockResolvedValueOnce({
        data: { message: 'Notification marked as read' }
      });

      const user = userEvent.setup();
      render(<NotificationBell />, { wrapper: AllTheProviders });

      // Wait for notifications to load
      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });

      // Click the bell icon
      const bellButton = screen.getByRole('button', { name: /unread notifications/i });
      await user.click(bellButton);

      // Wait for notification to appear
      await waitFor(() => {
        expect(screen.getByText('You were mentioned in a comment')).toBeInTheDocument();
      });

      // Click the notification
      const notification = screen.getByText('You were mentioned in a comment');
      await user.click(notification);

      // Verify navigation was called
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/projects/456');
      });
    });

    it('should close menu after navigation', async () => {
      const mockNotifications = [
        {
          id: 1,
          message: 'Task assigned to you',
          is_read: false,
          type: 'task_assigned',
          related_id: 123,
          project_id: 456,
          created_at: new Date().toISOString()
        }
      ];

      axios.get.mockResolvedValueOnce({
        data: {
          notifications: mockNotifications,
          unreadCount: 1
        }
      });

      axios.patch.mockResolvedValueOnce({
        data: { message: 'Notification marked as read' }
      });

      const user = userEvent.setup();
      render(<NotificationBell />, { wrapper: AllTheProviders });

      // Wait for notifications to load
      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });

      // Click the bell icon
      const bellButton = screen.getByRole('button', { name: /unread notifications/i });
      await user.click(bellButton);

      // Wait for notification to appear
      await waitFor(() => {
        expect(screen.getByText('Task assigned to you')).toBeInTheDocument();
      });

      // Click the notification
      const notification = screen.getByText('Task assigned to you');
      await user.click(notification);

      // Verify menu is closed (notification text should not be visible)
      await waitFor(() => {
        expect(screen.queryByText('Task assigned to you')).not.toBeInTheDocument();
      });
    });
  });

  describe('Delete Notification Functionality', () => {
    it('should delete notification when delete button is clicked', async () => {
      const mockNotifications = [
        {
          id: 1,
          message: 'Task assigned to you',
          is_read: false,
          type: 'task_assigned',
          created_at: new Date().toISOString()
        },
        {
          id: 2,
          message: 'Another notification',
          is_read: true,
          type: 'task_status_changed',
          created_at: new Date().toISOString()
        }
      ];

      axios.get.mockResolvedValueOnce({
        data: {
          notifications: mockNotifications,
          unreadCount: 1
        }
      });

      axios.delete.mockResolvedValueOnce({
        data: { message: 'Notification deleted' }
      });

      const user = userEvent.setup();
      render(<NotificationBell />, { wrapper: AllTheProviders });

      // Wait for notifications to load
      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });

      // Click the bell icon
      const bellButton = screen.getByRole('button', { name: /unread notifications/i });
      await user.click(bellButton);

      // Wait for notifications to appear
      await waitFor(() => {
        expect(screen.getByText('Task assigned to you')).toBeInTheDocument();
        expect(screen.getByText('Another notification')).toBeInTheDocument();
      });

      // Click the delete button for the first notification
      const deleteButtons = screen.getAllByRole('button', { name: /delete notification/i });
      await user.click(deleteButtons[0]);

      // Verify API was called
      await waitFor(() => {
        expect(axios.delete).toHaveBeenCalledWith(
          expect.stringContaining('/notifications/1'),
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer test-token'
            })
          })
        );
      });

      // Verify notification was removed from the list
      await waitFor(() => {
        expect(screen.queryByText('Task assigned to you')).not.toBeInTheDocument();
        expect(screen.getByText('Another notification')).toBeInTheDocument();
      });
    });
  });
});
