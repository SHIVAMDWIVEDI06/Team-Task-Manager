import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const SearchContext = createContext();

/**
 * SearchContext Provider
 * Manages search state and provides methods for search operations
 */
export const SearchProvider = ({ children }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ projects: [], tasks: [], teamMembers: [] });
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [error, setError] = useState(null);

  // Debounce timer ref
  const debounceTimerRef = React.useRef(null);

  // Get auth token
  const getToken = useCallback(() => localStorage.getItem('token'), []);

  /**
   * Perform search API call
   */
  const performSearch = useCallback(async (query) => {
    if (!query || query.trim() === '') {
      setSearchResults({ projects: [], tasks: [], teamMembers: [] });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = getToken();
      const response = await axios.get(`${API_BASE_URL}/api/search`, {
        params: { q: query, limit: 10, page: 1 },
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (response.data && response.data.results) {
        setSearchResults(response.data.results);
      }
    } catch (err) {
      console.error('Search error:', err);
      setError(err.response?.data?.error || 'Search failed');
      setSearchResults({ projects: [], tasks: [], teamMembers: [] });
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  /**
   * Fetch suggestions for autocomplete
   */
  const fetchSuggestions = useCallback(async (query) => {
    if (!query || query.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    setSuggestionsLoading(true);

    try {
      const token = getToken();
      const response = await axios.get(`${API_BASE_URL}/api/search/suggestions`, {
        params: { q: query, limit: 5 },
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (response.data && response.data.suggestions) {
        setSuggestions(response.data.suggestions);
      }
    } catch (err) {
      console.error('Suggestions error:', err);
      setSuggestions([]);
    } finally {
      setSuggestionsLoading(false);
    }
  }, [getToken]);

  /**
   * Update search query with debouncing
   */
  const updateSearchQuery = useCallback((query) => {
    setSearchQuery(query);
    setSelectedIndex(-1);

    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce suggestions fetch (faster for autocomplete)
    if (query && query.trim().length >= 2) {
      debounceTimerRef.current = setTimeout(() => {
        fetchSuggestions(query);
      }, 150);
    } else {
      setSuggestions([]);
    }
  }, [fetchSuggestions]);

  /**
   * Perform full search (called when user submits or selects from suggestions)
   */
  const executeSearch = useCallback(async () => {
    await performSearch(searchQuery);
  }, [performSearch, searchQuery]);

  /**
   * Update search results
   */
  const updateSearchResults = useCallback((results) => {
    setSearchResults(results);
  }, []);

  /**
   * Clear search
   */
  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults({ projects: [], tasks: [], teamMembers: [] });
    setSuggestions([]);
    setIsSearchOpen(false);
    setSelectedIndex(-1);
    setError(null);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  }, []);

  /**
   * Toggle search panel
   */
  const toggleSearch = useCallback(() => {
    setIsSearchOpen((prev) => !prev);
    if (!isSearchOpen) {
      setSelectedIndex(-1);
    }
  }, [isSearchOpen]);

  /**
   * Open search panel
   */
  const openSearch = useCallback(() => {
    setIsSearchOpen(true);
    setSelectedIndex(-1);
  }, []);

  /**
   * Close search panel
   */
  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
    setSuggestions([]);
    setSelectedIndex(-1);
  }, []);

  /**
   * Navigate to next suggestion
   */
  const navigateNext = useCallback(() => {
    setSelectedIndex((prev) => {
      const maxIndex = suggestions.length - 1;
      return prev < maxIndex ? prev + 1 : 0;
    });
  }, [suggestions]);

  /**
   * Navigate to previous suggestion
   */
  const navigatePrev = useCallback(() => {
    setSelectedIndex((prev) => {
      const maxIndex = suggestions.length - 1;
      return prev > 0 ? prev - 1 : maxIndex;
    });
  }, [suggestions]);

  /**
   * Select suggestion by index
   */
  const selectSuggestion = useCallback((index) => {
    if (index >= 0 && index < suggestions.length) {
      const suggestion = suggestions[index];
      // Navigate to the item based on type
      return suggestion;
    }
    return null;
  }, [suggestions]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const value = {
    searchQuery,
    searchResults,
    suggestions,
    loading,
    suggestionsLoading,
    isSearchOpen,
    selectedIndex,
    error,
    setLoading,
    setSelectedIndex,
    updateSearchQuery,
    updateSearchResults,
    executeSearch,
    clearSearch,
    toggleSearch,
    openSearch,
    closeSearch,
    navigateNext,
    navigatePrev,
    selectSuggestion,
    performSearch,
    fetchSuggestions,
  };

  return (
    <SearchContext.Provider value={value}>
      {children}
    </SearchContext.Provider>
  );
};

/**
 * Hook to use search context
 */
export const useSearch = () => {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within SearchProvider');
  }
  return context;
};
