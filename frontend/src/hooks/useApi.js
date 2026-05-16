import { useState, useCallback } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';

/**
 * Custom hook for making API calls with loading and error states
 * @returns {Object} - API call utilities
 */
export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Make an API request
   * @param {string} method - HTTP method (GET, POST, PUT, DELETE, PATCH)
   * @param {string} endpoint - API endpoint path
   * @param {Object} data - Request body data (optional)
   * @param {Object} config - Additional axios config (optional)
   * @returns {Promise<Object>} - Response data or error
   */
  const request = useCallback(async (method, endpoint, data = null, config = {}) => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...config.headers,
      };

      const axiosConfig = {
        method,
        url: `${API_BASE_URL}${endpoint}`,
        headers,
        ...config,
      };

      if (data && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
        axiosConfig.data = data;
      }

      if (data && method.toUpperCase() === 'GET') {
        axiosConfig.params = data;
      }

      const response = await axios(axiosConfig);
      setLoading(false);
      return { success: true, data: response.data };
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'An error occurred';
      setError(errorMessage);
      setLoading(false);
      return { success: false, error: errorMessage };
    }
  }, []);

  const get = useCallback((endpoint, params, config) => 
    request('GET', endpoint, params, config), [request]);

  const post = useCallback((endpoint, data, config) => 
    request('POST', endpoint, data, config), [request]);

  const put = useCallback((endpoint, data, config) => 
    request('PUT', endpoint, data, config), [request]);

  const patch = useCallback((endpoint, data, config) => 
    request('PATCH', endpoint, data, config), [request]);

  const del = useCallback((endpoint, config) => 
    request('DELETE', endpoint, null, config), [request]);

  return {
    loading,
    error,
    request,
    get,
    post,
    put,
    patch,
    delete: del,
  };
};
