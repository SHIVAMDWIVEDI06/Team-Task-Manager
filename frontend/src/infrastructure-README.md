# Core Infrastructure and Shared Utilities

This document describes the core infrastructure components created for the Team Task Manager application.

## Overview

The infrastructure provides:
- **Context Providers** for global state management
- **Custom Hooks** for common operations
- **Toast Notification System** for user feedback
- **Loading Skeletons** for consistent loading states
- **Error Boundaries** for graceful error handling

## Context Providers

### 1. NotificationContext (`src/context/NotificationContext.jsx`)

Manages notification state across the application.

**Usage:**
```jsx
import { useNotifications } from '../context/NotificationContext';

function MyComponent() {
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead 
  } = useNotifications();
  
  // Use notification methods
}
```

**Available Methods:**
- `addNotification(notification)` - Add a new notification
- `markAsRead(notificationId)` - Mark a notification as read
- `markAllAsRead()` - Mark all notifications as read
- `setNotificationsFromApi(notificationsList)` - Set notifications from API
- `clearNotifications()` - Clear all notifications

### 2. SearchContext (`src/context/SearchContext.jsx`)

Manages search state and results.

**Usage:**
```jsx
import { useSearch } from '../context/SearchContext';

function SearchComponent() {
  const { 
    searchQuery, 
    searchResults, 
    updateSearchQuery, 
    clearSearch 
  } = useSearch();
  
  // Use search methods
}
```

**Available Methods:**
- `updateSearchQuery(query)` - Update search query
- `updateSearchResults(results)` - Update search results
- `clearSearch()` - Clear search state
- `toggleSearch()` - Toggle search panel
- `openSearch()` - Open search panel
- `closeSearch()` - Close search panel

### 3. FilterContext (`src/context/FilterContext.jsx`)

Manages filter state for tasks and projects.

**Usage:**
```jsx
import { useFilters } from '../context/FilterContext';

function FilterComponent() {
  const { 
    filters, 
    updateFilter, 
    toggleFilterValue, 
    clearFilters,
    activeFilterCount,
    applyFilters 
  } = useFilters();
  
  // Use filter methods
}
```

**Available Methods:**
- `updateFilter(filterType, value)` - Update a specific filter
- `toggleFilterValue(filterType, value)` - Toggle a filter value
- `clearFilters()` - Clear all filters
- `clearFilter(filterType)` - Clear a specific filter
- `applyFilters(tasks)` - Apply filters to a task list

## Custom Hooks

### 1. useDebounce (`src/hooks/useDebounce.js`)

Debounces a value to limit the rate of updates.

**Usage:**
```jsx
import { useDebounce } from '../hooks';

function SearchInput() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  
  useEffect(() => {
    // API call with debounced value
    if (debouncedSearchTerm) {
      searchAPI(debouncedSearchTerm);
    }
  }, [debouncedSearchTerm]);
}
```

### 2. useApi (`src/hooks/useApi.js`)

Provides methods for making API calls with loading and error states.

**Usage:**
```jsx
import { useApi } from '../hooks';

function MyComponent() {
  const { loading, error, get, post, put, patch, delete: del } = useApi();
  
  const fetchData = async () => {
    const result = await get('/api/projects');
    if (result.success) {
      console.log(result.data);
    } else {
      console.error(result.error);
    }
  };
}
```

**Available Methods:**
- `get(endpoint, params, config)` - GET request
- `post(endpoint, data, config)` - POST request
- `put(endpoint, data, config)` - PUT request
- `patch(endpoint, data, config)` - PATCH request
- `delete(endpoint, config)` - DELETE request

### 3. useLocalStorage (`src/hooks/useLocalStorage.js`)

Manages state synchronized with localStorage.

**Usage:**
```jsx
import { useLocalStorage } from '../hooks';

function MyComponent() {
  const [theme, setTheme] = useLocalStorage('theme', 'light');
  
  // theme is automatically saved to localStorage
  setTheme('dark');
}
```

## Toast Notification System

Provides consistent toast notifications across the application.

**Usage:**
```jsx
import { showSuccess, showError, showInfo, showWarning } from '../utils/toast';

// Success toast
showSuccess('Project created successfully!');

// Error toast
showError('Failed to save changes');

// Info toast
showInfo('New update available');

// Warning toast
showWarning('This action cannot be undone');

// Loading toast
const toastId = showLoading('Saving...');
// Later dismiss it
dismissToast(toastId);

// Promise toast (for async operations)
showPromise(
  apiCall(),
  {
    loading: 'Saving...',
    success: 'Saved successfully!',
    error: 'Failed to save',
  }
);
```

## Loading Skeletons

Consistent loading states for different UI components.

### Available Skeletons:

1. **CardSkeleton** - For card components
```jsx
import { CardSkeleton, CardSkeletonGroup } from '../components/Skeletons';

<CardSkeleton height={200} />
<CardSkeletonGroup count={3} height={200} />
```

2. **TableSkeleton** - For table components
```jsx
import { TableSkeleton } from '../components/Skeletons';

<TableSkeleton rows={5} columns={4} />
```

3. **ListSkeleton** - For list components
```jsx
import { ListSkeleton } from '../components/Skeletons';

<ListSkeleton items={5} showAvatar={true} />
```

4. **DashboardSkeleton** - For dashboard components
```jsx
import { DashboardSkeleton, StatCardSkeleton, ChartSkeleton } from '../components/Skeletons';

<DashboardSkeleton />
<StatCardSkeleton />
<ChartSkeleton height={300} />
```

## Error Boundaries

Graceful error handling for React components.

### ErrorBoundary

Wraps components to catch and handle errors.

**Usage:**
```jsx
import { ErrorBoundary } from '../components/ErrorBoundary';

<ErrorBoundary>
  <MyComponent />
</ErrorBoundary>

// With custom fallback
<ErrorBoundary fallback={<CustomErrorUI />}>
  <MyComponent />
</ErrorBoundary>

// Show error details (development only)
<ErrorBoundary showDetails={true}>
  <MyComponent />
</ErrorBoundary>
```

### ErrorFallback

Reusable error fallback component.

**Usage:**
```jsx
import { ErrorFallback } from '../components/ErrorBoundary';

<ErrorFallback 
  error={error}
  resetError={resetFunction}
  title="Custom error title"
  message="Custom error message"
  showHomeButton={true}
/>
```

## Integration

All providers are integrated in `App.jsx`:

```jsx
<ErrorBoundary>
  <ThemeProvider theme={theme}>
    <AuthProvider>
      <NotificationProvider>
        <SearchProvider>
          <FilterProvider>
            <Toaster />
            <Router>
              {/* Routes */}
            </Router>
          </FilterProvider>
        </SearchProvider>
      </NotificationProvider>
    </AuthProvider>
  </ThemeProvider>
</ErrorBoundary>
```

## Requirements Satisfied

This infrastructure satisfies the following requirements:

- **Requirement 9.1**: Toast notification system with consistent styling
- **Requirement 9.4**: Loading skeleton components for consistent loading states
- **Requirement 15.1**: Error boundary components for graceful error handling
- **Requirement 15.5**: Enhanced error handling with user-friendly messages

## Next Steps

This infrastructure is now ready to be used by:
- Search functionality (Task 3)
- Notification system (Task 6)
- Task filtering (Task 12)
- All other features requiring state management, API calls, and user feedback
