import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';
import Profile from './Profile';
import axios from 'axios';
import toast from 'react-hot-toast';

// Mock axios
vi.mock('axios');

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock AuthContext
const mockSetUser = vi.fn();
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, username: 'testuser', email: 'test@example.com', avatar: '' },
    setUser: mockSetUser,
  }),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString();
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Wrapper component with router
const AllTheProviders = ({ children }) => <BrowserRouter>{children}</BrowserRouter>;

describe('Profile Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    localStorageMock.setItem('token', 'test-token');
  });

  describe('Profile Display', () => {
    it('should display user profile information', async () => {
      const mockProfile = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        role: 'admin',
        avatar: '',
        created_at: '2024-01-01T00:00:00.000Z',
      };

      axios.get.mockResolvedValueOnce({ data: mockProfile });

      render(<Profile />, { wrapper: AllTheProviders });

      await waitFor(() => {
        expect(screen.getByDisplayValue('testuser')).toBeInTheDocument();
        expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument();
        expect(screen.getByText(/admin/i)).toBeInTheDocument();
      });
    });

    it('should display loading state initially', () => {
      axios.get.mockImplementation(() => new Promise(() => {}));

      render(<Profile />, { wrapper: AllTheProviders });

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should display error message when profile fetch fails', async () => {
      axios.get.mockRejectedValueOnce({
        response: { data: { error: 'Failed to load profile' } },
      });

      render(<Profile />, { wrapper: AllTheProviders });

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to load profile');
      });
    });
  });

  describe('Form Validation', () => {
    it('should show error for username less than 3 characters', async () => {
      const mockProfile = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        role: 'admin',
        avatar: '',
        created_at: '2024-01-01T00:00:00.000Z',
      };

      axios.get.mockResolvedValueOnce({ data: mockProfile });

      const user = userEvent.setup();
      render(<Profile />, { wrapper: AllTheProviders });

      await waitFor(() => {
        expect(screen.getByDisplayValue('testuser')).toBeInTheDocument();
      });

      const usernameInput = screen.getByPlaceholderText('Enter your username');
      await user.clear(usernameInput);
      await user.type(usernameInput, 'ab');

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Username must be at least 3 characters')).toBeInTheDocument();
      });
    });

    it('should show error for invalid email format', async () => {
      const mockProfile = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        role: 'admin',
        avatar: '',
        created_at: '2024-01-01T00:00:00.000Z',
      };

      axios.get.mockResolvedValueOnce({ data: mockProfile });

      const user = userEvent.setup();
      render(<Profile />, { wrapper: AllTheProviders });

      await waitFor(() => {
        expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument();
      });

      const emailInput = screen.getByPlaceholderText('Enter your email');
      await user.clear(emailInput);
      await user.type(emailInput, 'invalid-email');

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid email format')).toBeInTheDocument();
      });
    });

    it('should show error when passwords do not match', async () => {
      const mockProfile = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        role: 'admin',
        avatar: '',
        created_at: '2024-01-01T00:00:00.000Z',
      };

      axios.get.mockResolvedValueOnce({ data: mockProfile });

      const user = userEvent.setup();
      render(<Profile />, { wrapper: AllTheProviders });

      await waitFor(() => {
        expect(screen.getByDisplayValue('testuser')).toBeInTheDocument();
      });

      const currentPasswordInput = screen.getByPlaceholderText('Current password');
      const newPasswordInput = screen.getByPlaceholderText('New password (min. 6 characters)');
      const confirmPasswordInput = screen.getByPlaceholderText('Confirm new password');

      await user.type(currentPasswordInput, 'oldpassword');
      await user.type(newPasswordInput, 'newpassword123');
      await user.type(confirmPasswordInput, 'differentpassword');

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
      });
    });

    it('should clear field error when user starts typing', async () => {
      const mockProfile = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        role: 'admin',
        avatar: '',
        created_at: '2024-01-01T00:00:00.000Z',
      };

      axios.get.mockResolvedValueOnce({ data: mockProfile });

      const user = userEvent.setup();
      render(<Profile />, { wrapper: AllTheProviders });

      await waitFor(() => {
        expect(screen.getByDisplayValue('testuser')).toBeInTheDocument();
      });

      const usernameInput = screen.getByPlaceholderText('Enter your username');
      await user.clear(usernameInput);
      await user.type(usernameInput, 'ab');

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Username must be at least 3 characters')).toBeInTheDocument();
      });

      // Start typing again
      await user.type(usernameInput, 'c');

      await waitFor(() => {
        expect(screen.queryByText('Username must be at least 3 characters')).not.toBeInTheDocument();
      });
    });
  });

  describe('Profile Update', () => {
    it('should successfully update profile with username and email', async () => {
      const mockProfile = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        role: 'admin',
        avatar: '',
        created_at: '2024-01-01T00:00:00.000Z',
      };

      const updatedProfile = {
        ...mockProfile,
        username: 'newusername',
        email: 'newemail@example.com',
      };

      axios.get.mockResolvedValueOnce({ data: mockProfile });
      axios.patch.mockResolvedValueOnce({ data: { user: updatedProfile } });

      const user = userEvent.setup();
      render(<Profile />, { wrapper: AllTheProviders });

      await waitFor(() => {
        expect(screen.getByDisplayValue('testuser')).toBeInTheDocument();
      });

      const usernameInput = screen.getByPlaceholderText('Enter your username');
      const emailInput = screen.getByPlaceholderText('Enter your email');

      await user.clear(usernameInput);
      await user.type(usernameInput, 'newusername');
      await user.clear(emailInput);
      await user.type(emailInput, 'newemail@example.com');

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(axios.patch).toHaveBeenCalledWith(
          expect.stringContaining('/profile'),
          {
            username: 'newusername',
            email: 'newemail@example.com',
          },
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer test-token',
            }),
          })
        );
      });

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Profile updated successfully');
      });
    });

    it('should successfully update profile with password change', async () => {
      const mockProfile = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        role: 'admin',
        avatar: '',
        created_at: '2024-01-01T00:00:00.000Z',
      };

      axios.get.mockResolvedValueOnce({ data: mockProfile });
      axios.patch.mockResolvedValueOnce({ data: { user: mockProfile } });

      const user = userEvent.setup();
      render(<Profile />, { wrapper: AllTheProviders });

      await waitFor(() => {
        expect(screen.getByDisplayValue('testuser')).toBeInTheDocument();
      });

      const currentPasswordInput = screen.getByPlaceholderText('Current password');
      const newPasswordInput = screen.getByPlaceholderText('New password (min. 6 characters)');
      const confirmPasswordInput = screen.getByPlaceholderText('Confirm new password');

      await user.type(currentPasswordInput, 'oldpassword');
      await user.type(newPasswordInput, 'newpassword123');
      await user.type(confirmPasswordInput, 'newpassword123');

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(axios.patch).toHaveBeenCalledWith(
          expect.stringContaining('/profile'),
          {
            username: 'testuser',
            email: 'test@example.com',
            currentPassword: 'oldpassword',
            newPassword: 'newpassword123',
          },
          expect.any(Object)
        );
      });

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Profile updated successfully');
      });
    });

    it('should clear password fields after successful update', async () => {
      const mockProfile = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        role: 'admin',
        avatar: '',
        created_at: '2024-01-01T00:00:00.000Z',
      };

      axios.get.mockResolvedValueOnce({ data: mockProfile });
      axios.patch.mockResolvedValueOnce({ data: { user: mockProfile } });

      const user = userEvent.setup();
      render(<Profile />, { wrapper: AllTheProviders });

      await waitFor(() => {
        expect(screen.getByDisplayValue('testuser')).toBeInTheDocument();
      });

      const currentPasswordInput = screen.getByPlaceholderText('Current password');
      const newPasswordInput = screen.getByPlaceholderText('New password (min. 6 characters)');
      const confirmPasswordInput = screen.getByPlaceholderText('Confirm new password');

      await user.type(currentPasswordInput, 'oldpassword');
      await user.type(newPasswordInput, 'newpassword123');
      await user.type(confirmPasswordInput, 'newpassword123');

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Profile updated successfully');
      });

      // Check that password fields are cleared
      expect(currentPasswordInput.value).toBe('');
      expect(newPasswordInput.value).toBe('');
      expect(confirmPasswordInput.value).toBe('');
    });
  });

  describe('Avatar Upload', () => {
    it('should show error for invalid file type', async () => {
      const mockProfile = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        role: 'admin',
        avatar: '',
        created_at: '2024-01-01T00:00:00.000Z',
      };

      axios.get.mockResolvedValueOnce({ data: mockProfile });

      const user = userEvent.setup();
      render(<Profile />, { wrapper: AllTheProviders });

      await waitFor(() => {
        expect(screen.getByDisplayValue('testuser')).toBeInTheDocument();
      });

      // Create a mock file with invalid type
      const file = new File(['dummy content'], 'test.txt', { type: 'text/plain' });

      const fileInput = document.querySelector('input[type="file"]');

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Invalid file type. Please upload JPEG, PNG, GIF, or WebP');
      });
    });

    it('should show error for file size exceeding limit', async () => {
      const mockProfile = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        role: 'admin',
        avatar: '',
        created_at: '2024-01-01T00:00:00.000Z',
      };

      axios.get.mockResolvedValueOnce({ data: mockProfile });

      const user = userEvent.setup();
      render(<Profile />, { wrapper: AllTheProviders });

      await waitFor(() => {
        expect(screen.getByDisplayValue('testuser')).toBeInTheDocument();
      });

      // Create a mock file larger than 2MB
      const largeContent = new Array(3 * 1024 * 1024).fill('a').join('');
      const file = new File([largeContent], 'test.png', { type: 'image/png' });

      const fileInput = document.querySelector('input[type="file"]');

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('File size exceeds 2MB limit');
      });
    });
  });
});
