import React, { createContext, useState, useContext, useCallback, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useAuth } from './AuthContext';

const NotificationContext = createContext();

// Polling interval in milliseconds (30 seconds)
const POLLING_INTERVAL = 30000;

/**
 * NotificationContext Provider
 * Manages notification state and provides methods for notification operations
 * Implements polling for real-time updates
 */
export const NotificationProvider = ({ children, disablePolling = false }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const pollingIntervalRef = useRef(null);
  const { user } = useAuth();

  /**
   * Fetch notifications from API
   */
  const fetchNotifications = useCallback(async (showLoading = true) => {
    if (!user) return;

    if (showLoading) setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/notifications`, {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params: {
          page: 1,
          limit: 50
        }
      });

      const { notifications: notificationsList, unreadCount: unread } = response.data;
      setNotifications(notificationsList);
      setUnreadCount(unread);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError(err.response?.data?.error || 'Failed to fetch notifications');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [user]);

  /**
   * Mark a notification as read (API call)
   */
  const markAsRead = useCallback(async (notificationId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch(
        `${API_BASE_URL}/notifications/${notificationId}/read`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      // Update local state
      setNotifications((prev) =>
        prev.map((notif) =>
          notif.id === notificationId ? { ...notif, is_read: true } : notif
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking notification as read:', err);
      throw err;
    }
  }, []);

  /**
   * Mark all notifications as read (API call)
   */
  const markAllAsRead = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch(
        `${API_BASE_URL}/notifications/read-all`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      // Update local state
      setNotifications((prev) =>
        prev.map((notif) => ({ ...notif, is_read: true }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
      throw err;
    }
  }, []);

  /**
   * Delete a notification (API call)
   */
  const deleteNotification = useCallback(async (notificationId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE_URL}/notifications/${notificationId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      // Update local state
      setNotifications((prev) => {
        const notification = prev.find((n) => n.id === notificationId);
        if (notification && !notification.is_read) {
          setUnreadCount((count) => Math.max(0, count - 1));
        }
        return prev.filter((notif) => notif.id !== notificationId);
      });
    } catch (err) {
      console.error('Error deleting notification:', err);
      throw err;
    }
  }, []);

  /**
   * Add a new notification to the list (for real-time updates)
   */
  const addNotification = useCallback((notification) => {
    setNotifications((prev) => [notification, ...prev]);
    if (!notification.is_read) {
      setUnreadCount((prev) => prev + 1);
    }
  }, []);

  /**
   * Clear all notifications (local state only)
   */
  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  /**
   * Start polling for notifications
   */
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) return;

    pollingIntervalRef.current = setInterval(() => {
      fetchNotifications(false); // Don't show loading spinner for background polls
    }, POLLING_INTERVAL);
  }, [fetchNotifications]);

  /**
   * Stop polling for notifications
   */
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  /**
   * Initialize notifications and start polling when user logs in
   */
  useEffect(() => {
    if (user) {
      fetchNotifications();
      if (!disablePolling) {
        startPolling();
      }
    } else {
      clearNotifications();
      stopPolling();
    }

    // Cleanup on unmount
    return () => {
      stopPolling();
    };
  }, [user, fetchNotifications, startPolling, stopPolling, clearNotifications, disablePolling]);

  const value = {
    notifications,
    unreadCount,
    loading,
    error,
    fetchNotifications,
    addNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearNotifications,
    startPolling,
    stopPolling,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

/**
 * Hook to use notification context
 */
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};
