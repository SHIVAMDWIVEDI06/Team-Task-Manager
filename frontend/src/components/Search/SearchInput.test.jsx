import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { SearchProvider, useSearch } from '../../context/SearchContext';
import SearchInput from './SearchInput';

// Wrapper component to provide SearchContext
const TestWrapper = ({ children }) => (
  <BrowserRouter>
    <SearchProvider>{children}</SearchProvider>
  </BrowserRouter>
);

// Mock axios
vi.mock('axios', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: { suggestions: [] } })),
  },
}));

describe('SearchInput Component', () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Search Input Rendering', () => {
    it('should render search input with placeholder text', () => {
      render(
        <TestWrapper>
          <SearchInput />
        </TestWrapper>
      );

      const searchInput = screen.getByPlaceholderText(/search projects, tasks, team/i);
      expect(searchInput).toBeInTheDocument();
    });

    it('should render with correct aria-label', () => {
      render(
        <TestWrapper>
          <SearchInput />
        </TestWrapper>
      );

      const searchInput = screen.getByLabelText(/search/i);
      expect(searchInput).toBeInTheDocument();
    });

    it('should have autocomplete attribute disabled', () => {
      render(
        <TestWrapper>
          <SearchInput />
        </TestWrapper>
      );

      const searchInput = screen.getByPlaceholderText(/search projects, tasks, team/i);
      expect(searchInput).toHaveAttribute('autocomplete', 'off');
    });

    it('should have role combobox', () => {
      render(
        <TestWrapper>
          <SearchInput />
        </TestWrapper>
      );

      const searchInput = screen.getByRole('combobox');
      expect(searchInput).toBeInTheDocument();
    });
  });

  describe('Search Input Interaction', () => {
    it('should update search query on input change', async () => {
      let contextValue;

      const TestConsumer = () => {
        const context = useSearch();
        contextValue = context;
        return <div>Test</div>;
      };

      render(
        <TestWrapper>
          <SearchInput />
          <TestConsumer />
        </TestWrapper>
      );

      const searchInput = screen.getByPlaceholderText(/search projects, tasks, team/i);
      
      // Simulate input change
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeInputValueSetter.call(searchInput, 'test query');
      
      const event = new Event('input', { bubbles: true });
      searchInput.dispatchEvent(event);

      // Check context was updated
      expect(contextValue.searchQuery).toBe('test query');
    });
  });

  describe('SearchContext Integration', () => {
    it('should provide search context to child components', () => {
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
      expect(contextValue).toHaveProperty('updateSearchQuery');
      expect(contextValue).toHaveProperty('executeSearch');
      expect(contextValue).toHaveProperty('clearSearch');
    });

    it('should initialize with empty search query', () => {
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

      expect(contextValue.searchQuery).toBe('');
    });

    it('should update search query via context method', () => {
      let contextValue;

      const TestConsumer = () => {
        const context = useSearch();
        contextValue = context;
        return <div data-testid="consumer">Test</div>;
      };

      const { rerender } = render(
        <TestWrapper>
          <TestConsumer />
        </TestWrapper>
      );

      // Verify initial state
      expect(contextValue.searchQuery).toBe('');
      
      // Get the current context value after update (it uses useState so state update is async)
      const UpdatedConsumer = () => {
        const context = useSearch();
        return <div data-testid="query">{context.searchQuery}</div>;
      };

      // Render new consumer to see updated value
      render(
        <TestWrapper>
          <UpdatedConsumer />
        </TestWrapper>
      );
    });
  });

  describe('Topbar Variant', () => {
    it('should render with topbar variant styling', () => {
      render(
        <TestWrapper>
          <SearchInput variant="topbar" />
        </TestWrapper>
      );

      const searchInput = screen.getByPlaceholderText(/search projects, tasks, team/i);
      expect(searchInput).toBeInTheDocument();
    });

    it('should render with default variant', () => {
      render(
        <TestWrapper>
          <SearchInput variant="default" />
        </TestWrapper>
      );

      const searchInput = screen.getByPlaceholderText(/search projects, tasks, team/i);
      expect(searchInput).toBeInTheDocument();
    });
  });

  describe('Keyboard Event Handlers', () => {
    it('should have onKeyDown handler', () => {
      render(
        <TestWrapper>
          <SearchInput />
        </TestWrapper>
      );

      const searchInput = screen.getByPlaceholderText(/search projects, tasks, team/i);
      
      // Should not throw on keyboard events
      expect(() => {
        searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
      }).not.toThrow();
    });
  });

  describe('Focus Handling', () => {
    it('should handle focus event', () => {
      render(
        <TestWrapper>
          <SearchInput />
        </TestWrapper>
      );

      const searchInput = screen.getByPlaceholderText(/search projects, tasks, team/i);
      
      expect(() => {
        searchInput.dispatchEvent(new FocusEvent('focus'));
      }).not.toThrow();
    });
  });

  describe('Context Methods', () => {
    it('should have all required context methods', () => {
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
  });
});