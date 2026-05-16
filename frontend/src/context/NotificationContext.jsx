import React, { createContext, useState, useContext, useCallback } from 'react';

const NotificationContext = createContext();

/**
 * NotificationContext Provider
 * Manages notification state and provides methods for notification operations
 */
export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  /**
   * Add a new notification to the list
   */
  const addNotification = useCallback((notification) => {
    setNotifications((prev) => [notification, ...prev]);
    if (!notification.is_read) {
      setUnreadCount((prev) => prev + 1);
    }
  }, []);

  /**
   * Mark a notification as read
   */
  const markAsRead = useCallback((notificationId) => {
    setNotifications((prev) =>
      prev.map((notif) =>
        notif.id === notificationId ? { ...notif, is_read: true } : notif
      )
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  /**
   * Mark all notifications as read
   */
  const markAllAsRead = useCallback(() => {
    setNotifications((prev) =>
      prev.map((notif) => ({ ...notif, is_read: true }))
    );
    setUnreadCount(0);
  }, []);

  /**
   * Set notifications from API response
   */
  const setNotificationsFromApi = useCallback((notificationsList) => {
    setNotifications(notificationsList);
    const unread = notificationsList.filter((n) => !n.is_read).length;
    setUnreadCount(unread);
  }, []);

  /**
   * Clear all notifications
   */
  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  const value = {
    notifications,
    unreadCount,
    loading,
    setLoading,
    addNotification,
    markAsRead,
    markAllAsRead,
    setNotificationsFromApi,
    clearNotifications,
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
