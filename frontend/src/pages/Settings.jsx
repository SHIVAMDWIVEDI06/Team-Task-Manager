import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Divider,
  FormControlLabel,
  FormGroup,
  Paper,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { Moon, Sun, Monitor, Bell, Eye, Save } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import toast from 'react-hot-toast';

// Styles managed by theme

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
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
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      // Merge fetched settings with defaults to handle null values
      setSettings({
        theme: res.data.theme || 'light',
        notification_preferences: res.data.notification_preferences || {
          email: true,
          push: true,
          task_assigned: true,
          status_change: true,
          mentions: true,
        },
        display_options: res.data.display_options || {
          compact_view: false,
          show_completed: true,
          items_per_page: 20,
        },
      });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (updatedSettings) => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.patch(
        `${API_BASE_URL}/settings`,
        updatedSettings,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      
      // Update local state with response
      setSettings({
        theme: res.data.settings.theme || settings.theme,
        notification_preferences: res.data.settings.notification_preferences || settings.notification_preferences,
        display_options: res.data.settings.display_options || settings.display_options,
      });
      
      toast.success('Settings saved successfully');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleThemeChange = (event, newTheme) => {
    if (newTheme === null) return; // Prevent deselecting all options
    
    const updatedSettings = { ...settings, theme: newTheme };
    setSettings(updatedSettings);
    
    // Apply theme immediately
    applyTheme(newTheme);
    
    // Save to backend
    updateSettings({ theme: newTheme });
  };

  const applyTheme = (theme) => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else if (theme === 'light') {
      root.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    } else {
      // Auto mode - detect system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.setAttribute('data-theme', 'dark');
      } else {
        root.removeAttribute('data-theme');
      }
      localStorage.setItem('theme', 'auto');
    }
  };

  const handleNotificationChange = (key) => (event) => {
    const updatedPreferences = {
      ...settings.notification_preferences,
      [key]: event.target.checked,
    };
    
    const updatedSettings = {
      ...settings,
      notification_preferences: updatedPreferences,
    };
    
    setSettings(updatedSettings);
    
    // Save to backend immediately
    updateSettings({ notification_preferences: updatedPreferences });
  };

  const handleDisplayOptionChange = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    
    const updatedDisplayOptions = {
      ...settings.display_options,
      [key]: value,
    };
    
    const updatedSettings = {
      ...settings,
      display_options: updatedDisplayOptions,
    };
    
    setSettings(updatedSettings);
    
    // Save to backend immediately
    updateSettings({ display_options: updatedDisplayOptions });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 4, maxWidth: 900, mx: 'auto' }}>
      <Box sx={{ mb: 3.5 }}>
        <Typography variant="h4" sx={{ color: 'var(--text-primary)', fontWeight: 900, mb: 1 }}>
          Settings
        </Typography>
        <Typography sx={{ color: 'var(--text-secondary)', fontWeight: 700 }}>
          Customize your application preferences
        </Typography>
      </Box>

      {/* Theme Settings */}
      <Paper className="glass-panel premium-shadow" sx={{ p: 4, mb: 3, borderRadius: '16px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <Sun size={20} color="#fb5b3f" />
          <Typography variant="h6" sx={{ color: 'var(--text-primary)', fontWeight: 900 }}>
            Theme
          </Typography>
        </Box>
        
        <Typography sx={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem', mb: 3 }}>
          Choose your preferred color theme for the application
        </Typography>

        <ToggleButtonGroup
          value={settings.theme}
          exclusive
          onChange={handleThemeChange}
          aria-label="theme selection"
          sx={{
            display: 'flex',
            gap: 1.5,
            flexWrap: 'wrap',
            '& .MuiToggleButton-root': {
              flex: '1 1 150px',
              minWidth: '150px',
              border: '2px solid #e8edf5',
              borderRadius: '8px',
              padding: '12px 20px',
              textTransform: 'none',
              fontWeight: 700,
              color: '#70809d',
              '&.Mui-selected': {
                bgcolor: '#fb5b3f',
                color: '#fff',
                borderColor: '#fb5b3f',
                '&:hover': {
                  bgcolor: '#e54a30',
                },
              },
              '&:hover': {
                bgcolor: '#f8fafc',
              },
            },
          }}
        >
          <ToggleButton value="light" aria-label="light theme">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Sun size={18} />
              <span>Light</span>
            </Box>
          </ToggleButton>
          <ToggleButton value="dark" aria-label="dark theme">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Moon size={18} />
              <span>Dark</span>
            </Box>
          </ToggleButton>
          <ToggleButton value="auto" aria-label="auto theme">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Monitor size={18} />
              <span>Auto</span>
            </Box>
          </ToggleButton>
        </ToggleButtonGroup>

        {settings.theme === 'auto' && (
          <Typography
            sx={{
              mt: 2,
              p: 2,
              bgcolor: '#f8fafc',
              borderRadius: '8px',
              color: '#70809d',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            Auto mode will match your system's theme preference
          </Typography>
        )}
      </Paper>

      {/* Notification Preferences */}
      <Paper className="glass-panel premium-shadow" sx={{ p: 4, mb: 3, borderRadius: '16px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <Bell size={20} color="#fb5b3f" />
          <Typography variant="h6" sx={{ color: 'var(--text-primary)', fontWeight: 900 }}>
            Notification Preferences
          </Typography>
        </Box>

        <Typography sx={{ color: '#70809d', fontWeight: 600, fontSize: '0.9rem', mb: 3 }}>
          Choose how you want to receive notifications
        </Typography>

        <FormGroup>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Notification Channels */}
            <Box>
              <Typography sx={{ color: '#2f4367', fontWeight: 800, fontSize: '0.95rem', mb: 1.5 }}>
                Notification Channels
              </Typography>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={settings.notification_preferences.email}
                    onChange={handleNotificationChange('email')}
                    sx={{
                      color: '#e8edf5',
                      '&.Mui-checked': { color: '#fb5b3f' },
                    }}
                  />
                }
                label={
                  <Box>
                    <Typography sx={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.9rem' }}>
                      Email Notifications
                    </Typography>
                    <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>
                      Receive notifications via email
                    </Typography>
                  </Box>
                }
                sx={{ mb: 1 }}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={settings.notification_preferences.push}
                    onChange={handleNotificationChange('push')}
                    sx={{
                      color: '#e8edf5',
                      '&.Mui-checked': { color: '#fb5b3f' },
                    }}
                  />
                }
                label={
                  <Box>
                    <Typography sx={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.9rem' }}>
                      Push Notifications
                    </Typography>
                    <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>
                      Receive browser push notifications
                    </Typography>
                  </Box>
                }
              />
            </Box>

            <Divider sx={{ my: 1 }} />

            {/* Notification Types */}
            <Box>
              <Typography sx={{ color: '#2f4367', fontWeight: 800, fontSize: '0.95rem', mb: 1.5 }}>
                Notification Types
              </Typography>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={settings.notification_preferences.task_assigned}
                    onChange={handleNotificationChange('task_assigned')}
                    sx={{
                      color: '#e8edf5',
                      '&.Mui-checked': { color: '#fb5b3f' },
                    }}
                  />
                }
                label={
                  <Box>
                    <Typography sx={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.9rem' }}>
                      Task Assignments
                    </Typography>
                    <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>
                      When a task is assigned to you
                    </Typography>
                  </Box>
                }
                sx={{ mb: 1 }}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={settings.notification_preferences.status_change}
                    onChange={handleNotificationChange('status_change')}
                    sx={{
                      color: '#e8edf5',
                      '&.Mui-checked': { color: '#fb5b3f' },
                    }}
                  />
                }
                label={
                  <Box>
                    <Typography sx={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.9rem' }}>
                      Status Changes
                    </Typography>
                    <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>
                      When task status is updated
                    </Typography>
                  </Box>
                }
                sx={{ mb: 1 }}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={settings.notification_preferences.mentions}
                    onChange={handleNotificationChange('mentions')}
                    sx={{
                      color: '#e8edf5',
                      '&.Mui-checked': { color: '#fb5b3f' },
                    }}
                  />
                }
                label={
                  <Box>
                    <Typography sx={{ color: '#2f4367', fontWeight: 700, fontSize: '0.9rem' }}>
                      Mentions
                    </Typography>
                    <Typography sx={{ color: '#70809d', fontSize: '0.8rem', fontWeight: 600 }}>
                      When you are mentioned in comments
                    </Typography>
                  </Box>
                }
              />
            </Box>
          </Box>
        </FormGroup>
      </Paper>

      {/* Display Options */}
      <Paper className="glass-panel premium-shadow" sx={{ p: 4, borderRadius: '16px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <Eye size={20} color="#fb5b3f" />
          <Typography variant="h6" sx={{ color: 'var(--text-primary)', fontWeight: 900 }}>
            Display Options
          </Typography>
        </Box>

        <Typography sx={{ color: '#70809d', fontWeight: 600, fontSize: '0.9rem', mb: 3 }}>
          Customize how content is displayed
        </Typography>

        <FormGroup>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.display_options.compact_view}
                  onChange={handleDisplayOptionChange('compact_view')}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                      color: '#fb5b3f',
                    },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: '#fb5b3f',
                    },
                  }}
                />
              }
              label={
                <Box>
                  <Typography sx={{ color: '#2f4367', fontWeight: 700, fontSize: '0.9rem' }}>
                    Compact View
                  </Typography>
                  <Typography sx={{ color: '#70809d', fontSize: '0.8rem', fontWeight: 600 }}>
                    Display content in a more condensed format
                  </Typography>
                </Box>
              }
            />

            <FormControlLabel
              control={
                <Switch
                  checked={settings.display_options.show_completed}
                  onChange={handleDisplayOptionChange('show_completed')}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                      color: '#fb5b3f',
                    },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: '#fb5b3f',
                    },
                  }}
                />
              }
              label={
                <Box>
                  <Typography sx={{ color: '#2f4367', fontWeight: 700, fontSize: '0.9rem' }}>
                    Show Completed Tasks
                  </Typography>
                  <Typography sx={{ color: '#70809d', fontSize: '0.8rem', fontWeight: 600 }}>
                    Display completed tasks in task lists
                  </Typography>
                </Box>
              }
            />
          </Box>
        </FormGroup>
      </Paper>

      {/* Save Indicator */}
      {saving && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            bgcolor: '#2f4367',
            color: '#fff',
            px: 3,
            py: 1.5,
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(47, 67, 103, 0.3)',
          }}
        >
          <CircularProgress size={20} sx={{ color: '#fff' }} />
          <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
            Saving...
          </Typography>
        </Box>
      )}
    </Box>
  );
}
