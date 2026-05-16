// Use environment variable for API URL, fallback to production or local
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
  (import.meta.env.MODE === 'production' ? '/api' : 'http://127.0.0.1:5000/api');
