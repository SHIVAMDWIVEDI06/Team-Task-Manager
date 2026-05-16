import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { SearchProvider, useSearch } from './SearchContext';

// Test consumer component to access context
const TestConsumer = () => {
  const {
    searchQuery,
    searchResults,
    suggestions,
    loading,
    suggestionsLoading,
    isSearchOpen,
    selectedIndex,
    error,
  } = useSearch();

  return (
    <div>
      <div data-testid="search-query">{searchQuery}</div>
      <div data-testid="loading">{loading.toString()}</div>
      <div data-testid="suggestions-loading">{suggestionsLoading.toString()}</div>
      <div data-testid="is-search-open">{isSearchOpen.toString()}</div>
      <div data-testid="selected-index">{selectedIndex.toString()}</div>
      <div data-testid="error">{error || 'no-error'}</div>
      <div data-testid="results-count">{(searchResults.projects?.length || 0) + (searchResults.tasks?.length || 0) + (searchResults.teamMembers?.length || 0)}</div>
      <div data-testid="suggestions-count">{suggestions.length}</div>
    </div>
  );
};

// Wrapper with Router
const TestWrapper = ({ children }) => (
  <BrowserRouter>
    <SearchProvider>{children}</SearchProvider>
  </BrowserRouter>
);

describe('SearchContext', () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Initial State', () => {
    it('should have empty search query initially', () => {
      render(
        <TestWrapper>
          <TestConsumer />
        </TestWrapper>
      );

      expect(screen.getByTestId('search-query').textContent).toBe('');
    });

    it('should have empty search results initially', () => {
      render(
        <TestWrapper>
          <TestConsumer />
        </TestWrapper>
      );

      expect(screen.getByTestId('results-count').textContent).toBe('0');
    });

    it('should have empty suggestions initially', () => {
      render(
        <TestWrapper>
          <TestConsumer />
        </TestWrapper>
      );

      expect(screen.getByTestId('suggestions-count').textContent).toBe('0');
    });

    it('should have loading set to false initially', () => {
      render(
        <TestWrapper>
          <TestConsumer />
        </TestWrapper>
      );

      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    it('should have isSearchOpen set to false initially', () => {
      render(
        <TestWrapper>
          <TestConsumer />
        </TestWrapper>
      );

      expect(screen.getByTestId('is-search-open').textContent).toBe('false');
    });

    it('should have selectedIndex set to -1 initially', () => {
      render(
        <TestWrapper>
          <TestConsumer />
        </TestWrapper>
      );

      expect(screen.getByTestId('selected-index').textContent).toBe('-1');
    });

    it('should have no error initially', () => {
      render(
        <TestWrapper>
          <TestConsumer />
        </TestWrapper>
      );

      expect(screen.getByTestId('error').textContent).toBe('no-error');
    });
  });

  describe('Context Value', () => {
    it('should provide all required context values', () => {
      let contextValue;

      const TestConsumer = () => {
        const context = useSearch();
        contextValue = context;
        return <div>Test</div>;
      };

      render(
        <TestWrapper>
          <TestConsumer />
        </TestWrapper>
      );

      expect(contextValue).toBeDefined();
      expect(contextValue).toHaveProperty('searchQuery');
      expect(contextValue).toHaveProperty('searchResults');
      expect(contextValue).toHaveProperty('suggestions');
      expect(contextValue).toHaveProperty('loading');
      expect(contextValue).toHaveProperty('suggestionsLoading');
      expect(contextValue).toHaveProperty('isSearchOpen');
      expect(contextValue).toHaveProperty('selectedIndex');
      expect(contextValue).toHaveProperty('error');
    });

    it('should provide all required context methods', () => {
      let contextValue;

      const TestConsumer = () => {
        const context = useSearch();
        contextValue = context;
        return <div>Test</div>;
      };

      render(
        <TestWrapper>
          <TestConsumer />
        </TestWrapper>
      );

      expect(typeof contextValue.updateSearchQuery).toBe('function');
      expect(typeof contextValue.updateSearchResults).toBe('function');
      expect(typeof contextValue.executeSearch).toBe('function');
      expect(typeof contextValue.clearSearch).toBe('function');
      expect(typeof contextValue.toggleSearch).toBe('function');
      expect(typeof contextValue.openSearch).toBe('function');
      expect(typeof contextValue.closeSearch).toBe('function');
      expect(typeof contextValue.navigateNext).toBe('function');
      expect(typeof contextValue.navigatePrev).toBe('function');
      expect(typeof contextValue.selectSuggestion).toBe('function');
      expect(typeof contextValue.performSearch).toBe('function');
      expect(typeof contextValue.fetchSuggestions).toBe('function');
    });

    it('should provide setLoading method', () => {
      let contextValue;

      const TestConsumer = () => {
        const context = useSearch();
        contextValue = context;
        return <div>Test</div>;
      };

      render(
        <TestWrapper>
          <TestConsumer />
        </TestWrapper>
      );

      expect(typeof contextValue.setLoading).toBe('function');
    });

    it('should provide setSelectedIndex method', () => {
      let contextValue;

      const TestConsumer = () => {
        const context = useSearch();
        contextValue = context;
        return <div>Test</div>;
      };

      render(
        <TestWrapper>
          <TestConsumer />
        </TestWrapper>
      );

      expect(typeof contextValue.setSelectedIndex).toBe('function');
    });
  });

  describe('Context Error Handling', () => {
    it('should throw error when useSearch is used outside provider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => {
        render(<TestConsumer />);
      }).toThrow('useSearch must be used within SearchProvider');
      
      consoleSpy.mockRestore();
    });
  });
});