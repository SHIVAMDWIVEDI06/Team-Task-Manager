import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      // Decode or verify token logic here
      // For now, we'll just mock the user fetch if token exists
      // In real app: axios.get(`${API_BASE_URL}/auth/me`)
      try {
        const savedUser = JSON.parse(localStorage.getItem('user'));
        if (savedUser) setUser(savedUser);
      } catch (e) {
        console.error('Failed to parse user from localStorage', e);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const res = await axios.post(`${API_BASE_URL}/auth/login`, { email, password });
      const { token, user } = res.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setUser(user);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Login failed' };
    }
  };

  const signup = async (username, email, password, role) => {
    try {
      const res = await axios.post(`${API_BASE_URL}/auth/signup`, { username, email, password, role });
      const { token, user } = res.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setUser(user);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Signup failed' };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, signup, logout, loading, isAdmin: user?.role === 'Admin' }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
