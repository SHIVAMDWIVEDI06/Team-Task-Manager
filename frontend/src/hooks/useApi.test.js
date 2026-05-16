import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import axios from 'axios';
import { useApi } from './useApi';
import { API_BASE_URL } from '../config';

// Mock axios
vi.mock('axios');

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('useApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useApi());

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(null);
    expect(typeof result.current.get).toBe('function');
    expect(typeof result.current.post).toBe('function');
    expect(typeof result.current.put).toBe('function');
    expect(typeof result.current.patch).toBe('function');
    expect(typeof result.current.delete).toBe('function');
  });

  describe('GET requests', () => {
    it('should make a successful GET request', async () => {
      const mockData = { id: 1, name: 'Test' };
      axios.mockResolvedValueOnce({ data: mockData });

      const { result } = renderHook(() => useApi());

      let response;
      await waitFor(async () => {
        response = await result.current.get('/test');
      });

      expect(response.success).toBe(true);
      expect(response.data).toEqual(mockData);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
      expect(axios).toHaveBeenCalledWith({
        method: 'GET',
        url: `${API_BASE_URL}/test`,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    it('should include auth token in GET request headers', async () => {
      const mockToken = 'test-token-123';
      localStorageMock.getItem.mockReturnValueOnce(mockToken);
      axios.mockResolvedValueOnce({ data: {} });

      const { result } = renderHook(() => useApi());

      await waitFor(async () => {
        await result.current.get('/protected');
      });

      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockToken}`,
          }),
        })
      );
    });

    it('should pass query parameters in GET request', async () => {
      axios.mockResolvedValueOnce({ data: [] });

      const { result } = renderHook(() => useApi());
      const params = { page: 1, limit: 10 };

      await waitFor(async () => {
        await result.current.get('/items', params);
      });

      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({
          params,
        })
      );
    });

    it('should handle GET request errors', async () => {
      const errorMessage = 'Network error';
      axios.mockRejectedValueOnce({
        response: { data: { error: errorMessage } },
      });

      const { result } = renderHook(() => useApi());

      let response;
      await waitFor(async () => {
        response = await result.current.get('/error');
      });

      expect(response.success).toBe(false);
      expect(response.error).toBe(errorMessage);
      expect(result.current.loading).toBe(false);
      
      // Wait for the error state to be updated
      await waitFor(() => {
        expect(result.current.error).toBe(errorMessage);
      });
    });
  });

  describe('POST requests', () => {
    it('should make a successful POST request', async () => {
      const mockData = { id: 1, name: 'Created' };
      const postData = { name: 'New Item' };
      axios.mockResolvedValueOnce({ data: mockData });

      const { result } = renderHook(() => useApi());

      let response;
      await waitFor(async () => {
        response = await result.current.post('/items', postData);
      });

      expect(response.success).toBe(true);
      expect(response.data).toEqual(mockData);
      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: `${API_BASE_URL}/items`,
          data: postData,
        })
      );
    });

    it('should handle POST request errors', async () => {
      const errorMessage = 'Validation failed';
      axios.mockRejectedValueOnce({
        response: { data: { error: errorMessage } },
      });

      const { result } = renderHook(() => useApi());

      let response;
      await waitFor(async () => {
        response = await result.current.post('/items', {});
      });

      expect(response.success).toBe(false);
      expect(response.error).toBe(errorMessage);
    });
  });

  describe('PUT requests', () => {
    it('should make a successful PUT request', async () => {
      const mockData = { id: 1, name: 'Updated' };
      const putData = { name: 'Updated Item' };
      axios.mockResolvedValueOnce({ data: mockData });

      const { result } = renderHook(() => useApi());

      let response;
      await waitFor(async () => {
        response = await result.current.put('/items/1', putData);
      });

      expect(response.success).toBe(true);
      expect(response.data).toEqual(mockData);
      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'PUT',
          url: `${API_BASE_URL}/items/1`,
          data: putData,
        })
      );
    });
  });

  describe('PATCH requests', () => {
    it('should make a successful PATCH request', async () => {
      const mockData = { id: 1, status: 'active' };
      const patchData = { status: 'active' };
      axios.mockResolvedValueOnce({ data: mockData });

      const { result } = renderHook(() => useApi());

      let response;
      await waitFor(async () => {
        response = await result.current.patch('/items/1', patchData);
      });

      expect(response.success).toBe(true);
      expect(response.data).toEqual(mockData);
      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'PATCH',
          url: `${API_BASE_URL}/items/1`,
          data: patchData,
        })
      );
    });
  });

  describe('DELETE requests', () => {
    it('should make a successful DELETE request', async () => {
      const mockData = { message: 'Deleted successfully' };
      axios.mockResolvedValueOnce({ data: mockData });

      const { result } = renderHook(() => useApi());

      let response;
      await waitFor(async () => {
        response = await result.current.delete('/items/1');
      });

      expect(response.success).toBe(true);
      expect(response.data).toEqual(mockData);
      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'DELETE',
          url: `${API_BASE_URL}/items/1`,
        })
      );
    });
  });

  describe('Loading state', () => {
    it('should set loading to true during request', async () => {
      let resolveRequest;
      axios.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveRequest = () => resolve({ data: {} });
          })
      );

      const { result } = renderHook(() => useApi());

      const promise = result.current.get('/test');
      
      // Check loading state immediately after request
      await waitFor(() => {
        expect(result.current.loading).toBe(true);
      });

      // Resolve the request
      resolveRequest();
      await promise;

      // Check loading state after request completes
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe('Error handling', () => {
    it('should handle errors without response data', async () => {
      const errorMessage = 'Network Error';
      axios.mockRejectedValueOnce(new Error(errorMessage));

      const { result } = renderHook(() => useApi());

      let response;
      await waitFor(async () => {
        response = await result.current.get('/test');
      });

      expect(response.success).toBe(false);
      expect(response.error).toBe(errorMessage);
      expect(result.current.error).toBe(errorMessage);
    });

    it('should handle errors without error message', async () => {
      axios.mockRejectedValueOnce({});

      const { result } = renderHook(() => useApi());

      let response;
      await waitFor(async () => {
        response = await result.current.get('/test');
      });

      expect(response.success).toBe(false);
      expect(response.error).toBe('An error occurred');
    });

    it('should clear previous errors on new request', async () => {
      // First request fails
      axios.mockRejectedValueOnce({
        response: { data: { error: 'First error' } },
      });

      const { result } = renderHook(() => useApi());

      await waitFor(async () => {
        await result.current.get('/error');
      });

      // Wait for error state to be set
      await waitFor(() => {
        expect(result.current.error).toBe('First error');
      });

      // Second request succeeds
      axios.mockResolvedValueOnce({ data: {} });

      await waitFor(async () => {
        await result.current.get('/success');
      });

      // Wait for error state to be cleared
      await waitFor(() => {
        expect(result.current.error).toBe(null);
      });
    });
  });

  describe('Custom config', () => {
    it('should merge custom headers with default headers', async () => {
      axios.mockResolvedValueOnce({ data: {} });

      const { result } = renderHook(() => useApi());
      const customConfig = {
        headers: {
          'X-Custom-Header': 'custom-value',
        },
      };

      await waitFor(async () => {
        await result.current.get('/test', null, customConfig);
      });

      // The hook merges headers in the order: default Content-Type, token (if exists), then custom headers
      // So custom headers should be present along with Content-Type
      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: `${API_BASE_URL}/test`,
          headers: expect.objectContaining({
            'X-Custom-Header': 'custom-value',
          }),
        })
      );
    });

    it('should allow custom config options', async () => {
      axios.mockResolvedValueOnce({ data: {} });

      const { result } = renderHook(() => useApi());
      const customConfig = {
        timeout: 5000,
        responseType: 'blob',
      };

      await waitFor(async () => {
        await result.current.get('/test', null, customConfig);
      });

      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 5000,
          responseType: 'blob',
        })
      );
    });
  });

  describe('Request method', () => {
    it('should make requests using the generic request method', async () => {
      const mockData = { result: 'success' };
      axios.mockResolvedValueOnce({ data: mockData });

      const { result } = renderHook(() => useApi());

      let response;
      await waitFor(async () => {
        response = await result.current.request('GET', '/custom');
      });

      expect(response.success).toBe(true);
      expect(response.data).toEqual(mockData);
    });
  });
});
