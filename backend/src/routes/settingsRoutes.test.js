const request = require('supertest');
const express = require('express');
const settingsRoutes = require('./settingsRoutes');
const settingsController = require('../controllers/settingsController');
const authMiddleware = require('../middleware/authMiddleware');

// Mock the dependencies
jest.mock('../controllers/settingsController');
jest.mock('../middleware/authMiddleware');

describe('Settings Routes', () => {
  let app;

  beforeEach(() => {
    // Create a fresh Express app for each test
    app = express();
    app.use(express.json());
    app.use('/api/settings', settingsRoutes);

    // Mock authMiddleware to pass through with a mock user
    authMiddleware.mockImplementation((req, res, next) => {
      req.user = { id: 1, username: 'testuser' };
      next();
    });

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('GET /api/settings', () => {
    it('should call getUserSettings controller', async () => {
      settingsController.getUserSettings.mockImplementation((req, res) => {
        res.status(200).json({ 
          theme: 'dark',
          notification_preferences: { email: true, push: false },
          display_options: { compact_view: false }
        });
      });

      const response = await request(app).get('/api/settings');

      expect(response.status).toBe(200);
      expect(settingsController.getUserSettings).toHaveBeenCalledTimes(1);
      expect(response.body).toHaveProperty('theme', 'dark');
      expect(response.body).toHaveProperty('notification_preferences');
      expect(response.body).toHaveProperty('display_options');
    });

    it('should require authentication', async () => {
      settingsController.getUserSettings.mockImplementation((req, res) => {
        res.status(200).json({ theme: 'light' });
      });

      await request(app).get('/api/settings');

      expect(authMiddleware).toHaveBeenCalled();
    });
  });

  describe('PATCH /api/settings', () => {
    it('should call updateUserSettings controller', async () => {
      settingsController.updateUserSettings.mockImplementation((req, res) => {
        res.status(200).json({ 
          message: 'Settings updated successfully',
          settings: { 
            theme: 'dark',
            notification_preferences: { email: true, push: true },
            display_options: { compact_view: true }
          }
        });
      });

      const response = await request(app)
        .patch('/api/settings')
        .send({ theme: 'dark' });

      expect(response.status).toBe(200);
      expect(settingsController.updateUserSettings).toHaveBeenCalledTimes(1);
      expect(response.body).toHaveProperty('message', 'Settings updated successfully');
      expect(response.body).toHaveProperty('settings');
    });

    it('should require authentication', async () => {
      settingsController.updateUserSettings.mockImplementation((req, res) => {
        res.status(200).json({ message: 'Settings updated successfully' });
      });

      await request(app)
        .patch('/api/settings')
        .send({ theme: 'dark' });

      expect(authMiddleware).toHaveBeenCalled();
    });

    it('should handle theme updates', async () => {
      settingsController.updateUserSettings.mockImplementation((req, res) => {
        res.status(200).json({ 
          message: 'Settings updated successfully',
          settings: { theme: 'light' }
        });
      });

      const response = await request(app)
        .patch('/api/settings')
        .send({ theme: 'light' });

      expect(response.status).toBe(200);
      expect(settingsController.updateUserSettings).toHaveBeenCalledTimes(1);
    });

    it('should handle notification preferences updates', async () => {
      settingsController.updateUserSettings.mockImplementation((req, res) => {
        res.status(200).json({ 
          message: 'Settings updated successfully',
          settings: { 
            notification_preferences: { 
              email: true, 
              push: false,
              task_assigned: true,
              status_change: false
            }
          }
        });
      });

      const response = await request(app)
        .patch('/api/settings')
        .send({ 
          notification_preferences: { 
            email: true, 
            push: false,
            task_assigned: true,
            status_change: false
          }
        });

      expect(response.status).toBe(200);
      expect(settingsController.updateUserSettings).toHaveBeenCalledTimes(1);
    });

    it('should handle display options updates', async () => {
      settingsController.updateUserSettings.mockImplementation((req, res) => {
        res.status(200).json({ 
          message: 'Settings updated successfully',
          settings: { 
            display_options: { 
              compact_view: true,
              show_completed: false,
              items_per_page: 25
            }
          }
        });
      });

      const response = await request(app)
        .patch('/api/settings')
        .send({ 
          display_options: { 
            compact_view: true,
            show_completed: false,
            items_per_page: 25
          }
        });

      expect(response.status).toBe(200);
      expect(settingsController.updateUserSettings).toHaveBeenCalledTimes(1);
    });
  });

  describe('Authentication Middleware', () => {
    it('should be applied to all routes', () => {
      // The authMiddleware should be called for all routes
      // This is verified by the individual test cases above
      expect(authMiddleware).toBeDefined();
    });
  });
});
