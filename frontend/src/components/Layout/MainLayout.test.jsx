import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import MainLayout from './MainLayout';
import { AuthProvider } from '../../context/AuthContext';
import { NotificationProvider } from '../../context/NotificationContext';
import { SearchProvider } from '../../context/SearchContext';
import { FilterProvider } from '../../context/FilterContext';

// Mock the child components
vi.mock('../Search', () => ({
  SearchInput: () => <div data-testid="search-input">Search</div>,
}));

vi.mock('../NotificationBell', () => ({
  default: () => <div data-testid="notification-bell">Notifications</div>,
}));

vi.mock('../PremiumIcon', () => ({
  default: ({ children }) => <div data-testid="premium-icon">{children}</div>,
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/' }),
    Outlet: () => <div data-testid="outlet">Content</div>,
  };
});

const mockUser = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  role: 'Admin',
  avatar: 'https://example.com/avatar.jpg',
};

const mockUserWithoutAvatar = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  role: 'Admin',
  avatar: '',
};

const mockLogout = vi.fn();

let mockAuthUser = mockUser;

vi.mock('../../context/AuthContext', async () => {
  const actual = await vi.importActual('../../context/AuthContext');
  return {
    ...actual,
    useAuth: () => ({
      user: mockAuthUser,
      logout: mockLogout,
      loading: false,
    }),
  };
});

const renderWithProviders = (component) => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <SearchProvider>
            <FilterProvider>
              {component}
            </FilterProvider>
          </SearchProvider>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('MainLayout - Task 8.4 Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('User Avatar Display', () => {
    it('should display user avatar from backend when available', () => {
      renderWithProviders(<MainLayout />);
      
      const avatar = screen.getByRole('img');
      expect(avatar).toHaveAttribute('src', mockUser.avatar);
    });
  });

  describe('User Dropdown Menu', () => {
    it('should open user dropdown when avatar is clicked', async () => {
      renderWithProviders(<MainLayout />);
      
      const avatar = screen.getByRole('img');
      fireEvent.click(avatar);

      await waitFor(() => {
        expect(screen.getByText('testuser')).toBeInTheDocument();
        expect(screen.getByText('Admin')).toBeInTheDocument();
      });
    });

    it('should display "My Profile" menu item in dropdown', async () => {
      renderWithProviders(<MainLayout />);
      
      const avatar = screen.getByRole('img');
      fireEvent.click(avatar);

      await waitFor(() => {
        expect(screen.getByText('My Profile')).toBeInTheDocument();
      });
    });

    it('should navigate to profile page when "My Profile" is clicked', async () => {
      renderWithProviders(<MainLayout />);
      
      const avatar = screen.getByRole('img');
      fireEvent.click(avatar);

      await waitFor(() => {
        const profileMenuItem = screen.getByText('My Profile');
        fireEvent.click(profileMenuItem);
      });

      expect(mockNavigate).toHaveBeenCalledWith('/profile');
    });

    it('should close dropdown after clicking "My Profile"', async () => {
      renderWithProviders(<MainLayout />);
      
      const avatar = screen.getByRole('img');
      fireEvent.click(avatar);

      await waitFor(() => {
        const profileMenuItem = screen.getByText('My Profile');
        fireEvent.click(profileMenuItem);
      });

      await waitFor(() => {
        expect(screen.queryByText('My Profile')).not.toBeInTheDocument();
      });
    });

    it('should display "Logout" menu item in dropdown', async () => {
      renderWithProviders(<MainLayout />);
      
      const avatar = screen.getByRole('img');
      fireEvent.click(avatar);

      await waitFor(() => {
        expect(screen.getByText('Logout')).toBeInTheDocument();
      });
    });

    it('should call logout and navigate when "Logout" is clicked', async () => {
      renderWithProviders(<MainLayout />);
      
      const avatar = screen.getByRole('img');
      fireEvent.click(avatar);

      await waitFor(() => {
        const logoutMenuItem = screen.getByText('Logout');
        fireEvent.click(logoutMenuItem);
      });

      expect(mockLogout).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  describe('Header Integration', () => {
    it('should display all header elements including avatar', () => {
      renderWithProviders(<MainLayout />);
      
      expect(screen.getByTestId('search-input')).toBeInTheDocument();
      expect(screen.getByTestId('notification-bell')).toBeInTheDocument();
      expect(screen.getByText('Log out')).toBeInTheDocument();
      expect(screen.getByRole('img')).toBeInTheDocument();
    });

    it('should display user info in dropdown header', async () => {
      renderWithProviders(<MainLayout />);
      
      const avatar = screen.getByRole('img');
      fireEvent.click(avatar);

      await waitFor(() => {
        expect(screen.getByText('testuser')).toBeInTheDocument();
        expect(screen.getByText('Admin')).toBeInTheDocument();
      });
    });
  });
});
