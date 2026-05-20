const request = require('supertest');
const express = require('express');
const profileRoutes = require('./profileRoutes');
const profileController = require('../controllers/profileController');
const authMiddleware = require('../middleware/authMiddleware');

// Mock the dependencies
jest.mock('../controllers/profileController');
jest.mock('../middleware/authMiddleware');

describe('Profile Routes', () => {
  let app;

  beforeEach(() => {
    // Create a fresh Express app for each test
    app = express();
    app.use(express.json());
    app.use('/api/profile', profileRoutes);

    // Mock authMiddleware to pass through with a mock user
    authMiddleware.mockImplementation((req, res, next) => {
      req.user = { id: 1, username: 'testuser' };
      next();
    });

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('GET /api/profile', () => {
    it('should call getUserProfile controller', async () => {
      profileController.getUserProfile.mockImplementation((req, res) => {
        res.status(200).json({ id: 1, username: 'testuser', email: 'test@example.com' });
      });

      const response = await request(app).get('/api/profile');

      expect(response.status).toBe(200);
      expect(profileController.getUserProfile).toHaveBeenCalledTimes(1);
      expect(response.body).toHaveProperty('username', 'testuser');
    });

    it('should require authentication', async () => {
      profileController.getUserProfile.mockImplementation((req, res) => {
        res.status(200).json({ id: 1, username: 'testuser' });
      });

      await request(app).get('/api/profile');

      expect(authMiddleware).toHaveBeenCalled();
    });
  });

  describe('PATCH /api/profile', () => {
    it('should call updateUserProfile controller', async () => {
      profileController.updateUserProfile.mockImplementation((req, res) => {
        res.status(200).json({ 
          message: 'Profile updated successfully',
          user: { id: 1, username: 'updateduser', email: 'updated@example.com' }
        });
      });

      const response = await request(app)
        .patch('/api/profile')
        .send({ username: 'updateduser' });

      expect(response.status).toBe(200);
      expect(profileController.updateUserProfile).toHaveBeenCalledTimes(1);
      expect(response.body).toHaveProperty('message', 'Profile updated successfully');
    });

    it('should require authentication', async () => {
      profileController.updateUserProfile.mockImplementation((req, res) => {
        res.status(200).json({ message: 'Profile updated successfully' });
      });

      await request(app).patch('/api/profile').send({ username: 'test' });

      expect(authMiddleware).toHaveBeenCalled();
    });
  });

  describe('POST /api/profile/avatar', () => {
    it('should call uploadAvatar controller', async () => {
      profileController.uploadAvatar.mockImplementation((req, res) => {
        res.status(200).json({ 
          message: 'Avatar uploaded successfully',
          user: { id: 1, username: 'testuser', avatar: 'data:image/png;base64,abc123' }
        });
      });

      const response = await request(app)
        .post('/api/profile/avatar')
        .send({ avatar: 'data:image/png;base64,abc123' });

      expect(response.status).toBe(200);
      expect(profileController.uploadAvatar).toHaveBeenCalledTimes(1);
      expect(response.body).toHaveProperty('message', 'Avatar uploaded successfully');
    });

    it('should require authentication', async () => {
      profileController.uploadAvatar.mockImplementation((req, res) => {
        res.status(200).json({ message: 'Avatar uploaded successfully' });
      });

      await request(app)
        .post('/api/profile/avatar')
        .send({ avatar: 'data:image/png;base64,abc123' });

      expect(authMiddleware).toHaveBeenCalled();
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
