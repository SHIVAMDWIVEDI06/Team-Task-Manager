import React, { createContext, useState, useContext, useCallback, useMemo } from 'react';

const FilterContext = createContext();

/**
 * FilterContext Provider
 * Manages filter state for tasks and projects
 */
export const FilterProvider = ({ children }) => {
  const [filters, setFilters] = useState({
    status: [],
    priority: [],
    assignee: [],
    dueDate: { start: null, end: null },
  });

  /**
   * Update a specific filter
   */
  const updateFilter = useCallback((filterType, value) => {
    setFilters((prev) => ({
      ...prev,
      [filterType]: value,
    }));
  }, []);

  /**
   * Toggle a filter value (for checkboxes)
   */
  const toggleFilterValue = useCallback((filterType, value) => {
    setFilters((prev) => {
      const currentValues = prev[filterType] || [];
      const newValues = currentValues.includes(value)
        ? currentValues.filter((v) => v !== value)
        : [...currentValues, value];
      
      return {
        ...prev,
        [filterType]: newValues,
      };
    });
  }, []);

  /**
   * Clear all filters
   */
  const clearFilters = useCallback(() => {
    setFilters({
      status: [],
      priority: [],
      assignee: [],
      dueDate: { start: null, end: null },
    });
  }, []);

  /**
   * Clear a specific filter
   */
  const clearFilter = useCallback((filterType) => {
    setFilters((prev) => ({
      ...prev,
      [filterType]: Array.isArray(prev[filterType]) ? [] : { start: null, end: null },
    }));
  }, []);

  /**
   * Get active filter count
   */
  const activeFilterCount = useMemo(() => {
    let count = 0;
    count += filters.status.length;
    count += filters.priority.length;
    count += filters.assignee.length;
    if (filters.dueDate.start || filters.dueDate.end) count += 1;
    return count;
  }, [filters]);

  /**
   * Check if any filters are active
   */
  const hasActiveFilters = useMemo(() => {
    return activeFilterCount > 0;
  }, [activeFilterCount]);

  /**
   * Apply filters to a list of tasks
   */
  const applyFilters = useCallback((tasks) => {
    return tasks.filter((task) => {
      // Status filter
      if (filters.status.length > 0 && !filters.status.includes(task.status)) {
        return false;
      }

      // Priority filter
      if (filters.priority.length > 0 && !filters.priority.includes(task.priority)) {
        return false;
      }

      // Assignee filter
      if (filters.assignee.length > 0 && !filters.assignee.includes(task.assigned_to)) {
        return false;
      }

      // Due date filter
      if (filters.dueDate.start || filters.dueDate.end) {
        const taskDueDate = new Date(task.due_date);
        if (filters.dueDate.start && taskDueDate < new Date(filters.dueDate.start)) {
          return false;
        }
        if (filters.dueDate.end && taskDueDate > new Date(filters.dueDate.end)) {
          return false;
        }
      }

      return true;
    });
  }, [filters]);

  const value = {
    filters,
    updateFilter,
    toggleFilterValue,
    clearFilters,
    clearFilter,
    activeFilterCount,
    hasActiveFilters,
    applyFilters,
  };

  return (
    <FilterContext.Provider value={value}>
      {children}
    </FilterContext.Provider>
  );
};

/**
 * Hook to use filter context
 */
export const useFilters = () => {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilters must be used within FilterProvider');
  }
  return context;
};
