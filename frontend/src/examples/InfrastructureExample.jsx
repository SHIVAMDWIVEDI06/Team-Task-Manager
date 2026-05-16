import React, { useState, useEffect } from 'react';
import { Box, Button, TextField, Typography, Paper } from '@mui/material';
import { Search, Filter, Bell } from 'lucide-react';

// Import custom hooks
import { useDebounce, useApi } from '../hooks';

// Import context hooks
import { useNotifications } from '../context/NotificationContext';
import { useSearch } from '../context/SearchContext';
import { useFilters } from '../context/FilterContext';

// Import toast utilities
import { showSuccess, showError, showInfo } from '../utils/toast';

// Import skeleton components
import { CardSkeleton, ListSkeleton } from '../components/Skeletons';

/**
 * Example component demonstrating the use of core infrastructure
 * This is for reference only and should not be used in production
 */
const InfrastructureExample = () => {
  const [inputValue, setInputValue] = useState('');
  const debouncedValue = useDebounce(inputValue, 500);
  
  // API hook example
  const { loading, error, get } = useApi();
  
  // Context hooks examples
  const { notifications, unreadCount, addNotification } = useNotifications();
  const { searchQuery, updateSearchQuery } = useSearch();
  const { filters, activeFilterCount, toggleFilterValue } = useFilters();

  // Effect to demonstrate debouncing
  useEffect(() => {
    if (debouncedValue) {
      console.log('Debounced value:', debouncedValue);
      showInfo(`Searching for: ${debouncedValue}`);
    }
  }, [debouncedValue]);

  // Example API call
  const handleApiCall = async () => {
    const result = await get('/api/projects');
    if (result.success) {
      showSuccess('Data fetched successfully!');
      console.log(result.data);
    } else {
      showError(result.error);
    }
  };

  // Example notification
  const handleAddNotification = () => {
    addNotification({
      id: Date.now(),
      type: 'info',
      message: 'This is a test notification',
      is_read: false,
      created_at: new Date().toISOString(),
    });
    showSuccess('Notification added!');
  };

  // Example filter toggle
  const handleToggleFilter = () => {
    toggleFilterValue('status', 'In Progress');
    showInfo('Filter toggled!');
  };

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        Infrastructure Examples
      </Typography>

      {/* Debounce Example */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          1. Debounce Hook
        </Typography>
        <TextField
          fullWidth
          label="Type to see debouncing in action"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          helperText={`Debounced value: ${debouncedValue}`}
        />
      </Paper>

      {/* API Hook Example */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          2. API Hook
        </Typography>
        <Button
          variant="contained"
          onClick={handleApiCall}
          disabled={loading}
          startIcon={<Search size={18} />}
        >
          {loading ? 'Loading...' : 'Fetch Data'}
        </Button>
        {error && (
          <Typography color="error" sx={{ mt: 1 }}>
            Error: {error}
          </Typography>
        )}
      </Paper>

      {/* Notification Context Example */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          3. Notification Context
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Button
            variant="contained"
            onClick={handleAddNotification}
            startIcon={<Bell size={18} />}
          >
            Add Notification
          </Button>
          <Typography>
            Unread Count: {unreadCount} | Total: {notifications.length}
          </Typography>
        </Box>
      </Paper>

      {/* Filter Context Example */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          4. Filter Context
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Button
            variant="contained"
            onClick={handleToggleFilter}
            startIcon={<Filter size={18} />}
          >
            Toggle "In Progress" Filter
          </Button>
          <Typography>Active Filters: {activeFilterCount}</Typography>
        </Box>
      </Paper>

      {/* Toast Examples */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          5. Toast Notifications
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Button variant="contained" color="success" onClick={() => showSuccess('Success!')}>
            Success Toast
          </Button>
          <Button variant="contained" color="error" onClick={() => showError('Error!')}>
            Error Toast
          </Button>
          <Button variant="contained" color="info" onClick={() => showInfo('Info!')}>
            Info Toast
          </Button>
        </Box>
      </Paper>

      {/* Skeleton Examples */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          6. Loading Skeletons
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexDirection: 'column' }}>
          <CardSkeleton height={150} />
          <ListSkeleton items={3} />
        </Box>
      </Paper>
    </Box>
  );
};

export default InfrastructureExample;
