import React, { useState } from 'react';
import {
  Badge,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Typography,
  Divider,
  Button,
  CircularProgress,
} from '@mui/material';
import { Bell, Check, CheckCheck, X } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { useNavigate } from 'react-router-dom';

/**
 * Format timestamp to relative time (e.g., "2 minutes ago")
 */
const formatRelativeTime = (timestamp) => {
  const now = new Date();
  const date = new Date(timestamp);
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) {
    return 'just now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks} week${diffInWeeks > 1 ? 's' : ''} ago`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  return `${diffInMonths} month${diffInMonths > 1 ? 's' : ''} ago`;
};

/**
 * NotificationBell Component
 * Displays notification bell icon with unread count badge
 * Shows dropdown menu with notifications list
 */
export default function NotificationBell() {
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationClick = async (notification) => {
    // Mark as read if unread
    if (!notification.is_read) {
      try {
        await markAsRead(notification.id);
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    }

    // Navigate to related item based on notification type
    if (notification.related_id) {
      switch (notification.type) {
        case 'task_assigned':
        case 'task_status_changed':
        case 'task_comment':
        case 'mention':
          // Navigate to project detail page where the task is located
          if (notification.project_id) {
            navigate(`/projects/${notification.project_id}`);
            handleClose();
          } else {
            // Fallback: close the menu if project_id is not available
            handleClose();
          }
          break;
        case 'project_invitation':
        case 'member_added':
          // Navigate to projects page
          navigate('/projects');
          handleClose();
          break;
        default:
          handleClose();
      }
    } else {
      handleClose();
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleDeleteNotification = async (notificationId, event) => {
    event.stopPropagation();
    try {
      await deleteNotification(notificationId);
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  return (
    <>
      <IconButton
        onClick={handleClick}
        sx={{
          color: '#fff',
          bgcolor: 'rgba(255,255,255,0.15)',
          '&:hover': {
            bgcolor: 'rgba(255,255,255,0.25)',
          },
        }}
        aria-label={`${unreadCount} unread notifications`}
      >
        <Badge
          badgeContent={unreadCount}
          color="error"
          max={99}
          sx={{
            '& .MuiBadge-badge': {
              fontSize: '0.7rem',
              fontWeight: 800,
              minWidth: '18px',
              height: '18px',
            },
          }}
        >
          <Bell size={20} />
        </Badge>
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: {
            width: 380,
            maxWidth: '90vw',
            maxHeight: 500,
            borderRadius: '12px',
            boxShadow: '0 16px 34px rgba(47, 67, 103, 0.16)',
            mt: 1,
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {/* Header */}
        <Box
          sx={{
            px: 2.5,
            py: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #eef2f7',
          }}
        >
          <Box>
            <Typography sx={{ fontWeight: 800, color: '#2f4367', fontSize: '1rem' }}>
              Notifications
            </Typography>
            {unreadCount > 0 && (
              <Typography sx={{ fontSize: '0.75rem', color: '#70809d', mt: 0.3 }}>
                {unreadCount} unread
              </Typography>
            )}
          </Box>
          {unreadCount > 0 && (
            <Button
              size="small"
              startIcon={<CheckCheck size={14} />}
              onClick={handleMarkAllAsRead}
              sx={{
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'none',
                color: '#fb5b3f',
                '&:hover': {
                  bgcolor: 'rgba(251, 91, 63, 0.08)',
                },
              }}
            >
              Mark all read
            </Button>
          )}
        </Box>

        {/* Notifications List */}
        <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
          {loading && notifications.length === 0 ? (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                py: 4,
              }}
            >
              <CircularProgress size={32} />
            </Box>
          ) : notifications.length === 0 ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                py: 5,
                px: 3,
              }}
            >
              <Bell size={48} style={{ color: '#cbd5e1', marginBottom: 16 }} />
              <Typography
                sx={{
                  fontWeight: 700,
                  color: '#70809d',
                  fontSize: '0.9rem',
                  textAlign: 'center',
                }}
              >
                No notifications yet
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.8rem',
                  color: '#8795ad',
                  textAlign: 'center',
                  mt: 0.5,
                }}
              >
                We'll notify you when something happens
              </Typography>
            </Box>
          ) : (
            notifications.map((notification, index) => (
              <React.Fragment key={notification.id}>
                {index > 0 && <Divider />}
                <MenuItem
                  onClick={() => handleNotificationClick(notification)}
                  sx={{
                    px: 2.5,
                    py: 2,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1.5,
                    bgcolor: notification.is_read ? 'transparent' : 'rgba(251, 91, 63, 0.04)',
                    '&:hover': {
                      bgcolor: notification.is_read
                        ? 'rgba(0, 0, 0, 0.04)'
                        : 'rgba(251, 91, 63, 0.08)',
                    },
                    minHeight: 'auto',
                    whiteSpace: 'normal',
                  }}
                >
                  {/* Unread indicator */}
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: notification.is_read ? 'transparent' : '#fb5b3f',
                      flexShrink: 0,
                      mt: 0.8,
                    }}
                  />

                  {/* Notification content */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      sx={{
                        fontSize: '0.875rem',
                        color: '#2f4367',
                        fontWeight: notification.is_read ? 600 : 700,
                        mb: 0.5,
                        lineHeight: 1.4,
                      }}
                    >
                      {notification.message}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: '0.75rem',
                        color: '#8795ad',
                        fontWeight: 600,
                      }}
                    >
                      {formatRelativeTime(notification.created_at)}
                    </Typography>
                  </Box>

                  {/* Action buttons */}
                  <Box
                    sx={{
                      display: 'flex',
                      gap: 0.5,
                      flexShrink: 0,
                    }}
                  >
                    {!notification.is_read && (
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(notification.id);
                        }}
                        sx={{
                          width: 28,
                          height: 28,
                          color: '#70809d',
                          '&:hover': {
                            bgcolor: 'rgba(0, 0, 0, 0.08)',
                            color: '#fb5b3f',
                          },
                        }}
                        aria-label="Mark as read"
                      >
                        <Check size={16} />
                      </IconButton>
                    )}
                    <IconButton
                      size="small"
                      onClick={(e) => handleDeleteNotification(notification.id, e)}
                      sx={{
                        width: 28,
                        height: 28,
                        color: '#70809d',
                        '&:hover': {
                          bgcolor: 'rgba(239, 68, 68, 0.1)',
                          color: '#ef4444',
                        },
                      }}
                      aria-label="Delete notification"
                    >
                      <X size={16} />
                    </IconButton>
                  </Box>
                </MenuItem>
              </React.Fragment>
            ))
          )}
        </Box>
      </Menu>
    </>
  );
}
