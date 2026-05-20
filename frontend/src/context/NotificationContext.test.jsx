import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import React from 'react';
import { NotificationProvider, useNotifications } from './NotificationContext';

// Mock axios
vi.mock('axios');

// Mock config
vi.mock('../config', () => ({
  API_BASE_URL: 'http://localhost:5000/api'
}));

// Mock AuthContext
vi.mock('./AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, username: 'testuser' }
  })
}));

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

// Wrapper component with Notification provider (with polling disabled for tests)
const wrapper = ({ children }) => (
  <NotificationProvider disablePolling={true}>{children}</NotificationProvider>
);

describe('NotificationContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    localStorageMock.setItem('token', 'test-token');
  });

  it('should initialize with empty notifications', async () => {
    axios.get.mockResolvedValue({
      data: {
        notifications: [],
        unreadCount: 0
      }
    });

    const { result, unmount } = renderHook(() => useNotifications(), { wrapper });

    // Wait for the automatic fetch on mount to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
    
    unmount();
  });

  it('should fetch notifications when user is logged in', async () => {
    const mockNotifications = [
      { id: 1, message: 'Test notification 1', is_read: false, created_at: new Date().toISOString() },
      { id: 2, message: 'Test notification 2', is_read: true, created_at: new Date().toISOString() }
    ];

    axios.get.mockResolvedValue({
      data: {
        notifications: mockNotifications,
        unreadCount: 1,
        total: 2,
        page: 1,
        totalPages: 1
      }
    });

    const { result, unmount } = renderHook(() => useNotifications(), { wrapper });

    // Wait for the automatic fetch on mount to complete
    await waitFor(() => {
      expect(result.current.notifications).toHaveLength(2);
    });

    expect(result.current.unreadCount).toBe(1);
    
    unmount();
  });

  it('should mark a notification as read', async () => {
    axios.get.mockResolvedValue({
      data: {
        notifications: [
          { id: 1, message: 'Test notification', is_read: false, created_at: new Date().toISOString() }
        ],
        unreadCount: 1
      }
    });

    axios.patch.mockResolvedValue({
      data: { message: 'Notification marked as read' }
    });

    const { result } = renderHook(() => useNotifications(), { wrapper });

    // Wait for initial fetch
    await waitFor(() => result.current.notifications.length > 0, { timeout: 2000 });

    // Mark as read
    await act(async () => {
      await result.current.markAsRead(1);
    });

    // State should be updated immediately (optimistic update)
    expect(result.current.notifications[0].is_read).toBe(true);
    expect(result.current.unreadCount).toBe(0);
  }, 10000);

  it('should mark all notifications as read', async () => {
    axios.get.mockResolvedValue({
      data: {
        notifications: [
          { id: 1, message: 'Test notification 1', is_read: false, created_at: new Date().toISOString() },
          { id: 2, message: 'Test notification 2', is_read: false, created_at: new Date().toISOString() }
        ],
        unreadCount: 2
      }
    });

    axios.patch.mockResolvedValue({
      data: { message: 'All notifications marked as read' }
    });

    const { result } = renderHook(() => useNotifications(), { wrapper });

    // Wait for initial fetch
    await waitFor(() => result.current.notifications.length > 0, { timeout: 2000 });

    // Mark all as read
    await act(async () => {
      await result.current.markAllAsRead();
    });

    // State should be updated immediately (optimistic update)
    expect(result.current.notifications.every(n => n.is_read)).toBe(true);
    expect(result.current.unreadCount).toBe(0);
  }, 10000);

  it('should delete a notification', async () => {
    axios.get.mockResolvedValue({
      data: {
        notifications: [
          { id: 1, message: 'Test notification 1', is_read: false, created_at: new Date().toISOString() },
          { id: 2, message: 'Test notification 2', is_read: true, created_at: new Date().toISOString() }
        ],
        unreadCount: 1
      }
    });

    axios.delete.mockResolvedValue({
      data: { message: 'Notification deleted' }
    });

    const { result } = renderHook(() => useNotifications(), { wrapper });

    // Wait for initial fetch
    await waitFor(() => result.current.notifications.length > 0, { timeout: 2000 });

    // Delete notification
    await act(async () => {
      await result.current.deleteNotification(1);
    });

    // State should be updated immediately (optimistic update)
    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0].id).toBe(2);
    expect(result.current.unreadCount).toBe(0);
  }, 10000);

  it('should add a notification locally', async () => {
    axios.get.mockResolvedValue({
      data: {
        notifications: [],
        unreadCount: 0
      }
    });

    const { result, unmount } = renderHook(() => useNotifications(), { wrapper });

    // Wait for the automatic fetch on mount to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const newNotification = {
      id: 1,
      message: 'New notification',
      is_read: false,
      created_at: new Date().toISOString()
    };

    act(() => {
      result.current.addNotification(newNotification);
    });

    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.unreadCount).toBe(1);
    
    unmount();
  });

  it('should handle API errors gracefully', async () => {
    axios.get.mockRejectedValue({
      response: {
        data: {
          error: 'Failed to fetch notifications'
        }
      }
    });

    const { result, unmount } = renderHook(() => useNotifications(), { wrapper });

    // Wait for the automatic fetch on mount to complete
    await waitFor(() => {
      expect(result.current.error).toBe('Failed to fetch notifications');
    });
    
    unmount();
  });
});
