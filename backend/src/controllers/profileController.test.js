const { pool } = require('../config/db');
const bcrypt = require('bcryptjs');
const {
  getUserProfile,
  updateUserProfile,
  uploadAvatar
} = require('./profileController');

// Mock the database pool
jest.mock('../config/db', () => ({
  pool: {
    query: jest.fn()
  }
}));

// Mock bcrypt
jest.mock('bcryptjs');

describe('Profile Controller', () => {
  let req, res;

  beforeEach(() => {
    req = {
      user: { id: 1 },
      body: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    jest.clearAllMocks();
  });

  describe('getUserProfile', () => {
    it('should return user profile successfully', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        role: 'Member',
        avatar: null,
        created_at: new Date()
      };

      pool.query.mockResolvedValue({ rows: [mockUser] });

      await getUserProfile(req, res);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, username, email, role, avatar, created_at'),
        [1]
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockUser);
    });

    it('should return 404 if user not found', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      await getUserProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
    });

    it('should handle database errors', async () => {
      pool.query.mockRejectedValue(new Error('Database error'));

      await getUserProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });

  describe('updateUserProfile', () => {
    it('should update username successfully', async () => {
      req.body = { username: 'newusername' };
      const mockUpdatedUser = {
        id: 1,
        username: 'newusername',
        email: 'test@example.com',
        role: 'Member',
        avatar: null,
        created_at: new Date()
      };

      pool.query
        .mockResolvedValueOnce({ rows: [] }) // Check existing user
        .mockResolvedValueOnce({ rows: [mockUpdatedUser] }); // Update query

      await updateUserProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Profile updated successfully',
        user: mockUpdatedUser
      });
    });

    it('should update email successfully', async () => {
      req.body = { email: 'newemail@example.com' };
      const mockUpdatedUser = {
        id: 1,
        username: 'testuser',
        email: 'newemail@example.com',
        role: 'Member',
        avatar: null,
        created_at: new Date()
      };

      pool.query
        .mockResolvedValueOnce({ rows: [] }) // Check existing user
        .mockResolvedValueOnce({ rows: [mockUpdatedUser] }); // Update query

      await updateUserProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Profile updated successfully',
        user: mockUpdatedUser
      });
    });

    it('should validate email format', async () => {
      req.body = { email: 'invalid-email' };

      await updateUserProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid email format' });
    });

    it('should validate username length', async () => {
      req.body = { username: 'ab' }; // Too short

      await updateUserProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Username must be between 3 and 50 characters' });
    });

    it('should return error if username already exists', async () => {
      req.body = { username: 'existinguser' };
      pool.query.mockResolvedValueOnce({ rows: [{ id: 2 }] }); // User exists

      await updateUserProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({ error: 'Username or email already exists' });
    });

    it('should return error if email already exists', async () => {
      req.body = { email: 'existing@example.com' };
      pool.query.mockResolvedValueOnce({ rows: [{ id: 2 }] }); // User exists

      await updateUserProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({ error: 'Username or email already exists' });
    });

    it('should update password with valid current password', async () => {
      req.body = {
        currentPassword: 'oldpassword',
        newPassword: 'newpassword123'
      };

      const mockUser = { password: 'hashedoldpassword' };
      bcrypt.compare.mockResolvedValue(true);
      bcrypt.genSalt.mockResolvedValue('salt');
      bcrypt.hash.mockResolvedValue('hashednewpassword');

      pool.query
        .mockResolvedValueOnce({ rows: [mockUser] }) // Get current password
        .mockResolvedValueOnce({ rows: [{ id: 1, username: 'testuser' }] }); // Update query

      await updateUserProfile(req, res);

      expect(bcrypt.compare).toHaveBeenCalledWith('oldpassword', 'hashedoldpassword');
      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword123', 'salt');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return error if current password is incorrect', async () => {
      req.body = {
        currentPassword: 'wrongpassword',
        newPassword: 'newpassword123'
      };

      const mockUser = { password: 'hashedoldpassword' };
      bcrypt.compare.mockResolvedValue(false);

      pool.query.mockResolvedValueOnce({ rows: [mockUser] });

      await updateUserProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Current password is incorrect' });
    });

    it('should return error if new password is too short', async () => {
      req.body = {
        currentPassword: 'oldpassword',
        newPassword: '12345' // Too short
      };

      await updateUserProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'New password must be at least 6 characters long' });
    });

    it('should return error if current password not provided with new password', async () => {
      req.body = {
        newPassword: 'newpassword123'
      };

      await updateUserProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Current password is required to set a new password' });
    });

    it('should return error if no fields provided', async () => {
      req.body = {};

      await updateUserProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'At least one field must be provided for update' });
    });

    it('should handle database errors', async () => {
      req.body = { username: 'newusername' };
      pool.query.mockRejectedValue(new Error('Database error'));

      await updateUserProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });

  describe('uploadAvatar', () => {
    it('should upload base64 avatar successfully', async () => {
      const base64Avatar = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      req.body = { avatar: base64Avatar };

      const mockUpdatedUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        role: 'Member',
        avatar: base64Avatar,
        created_at: new Date()
      };

      pool.query.mockResolvedValue({ rows: [mockUpdatedUser] });

      await uploadAvatar(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Avatar uploaded successfully',
        user: mockUpdatedUser
      });
    });

    it('should upload URL avatar successfully', async () => {
      const avatarUrl = 'https://example.com/avatar.jpg';
      req.body = { avatar: avatarUrl };

      const mockUpdatedUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        role: 'Member',
        avatar: avatarUrl,
        created_at: new Date()
      };

      pool.query.mockResolvedValue({ rows: [mockUpdatedUser] });

      await uploadAvatar(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Avatar uploaded successfully',
        user: mockUpdatedUser
      });
    });

    it('should return error if avatar data not provided', async () => {
      req.body = {};

      await uploadAvatar(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Avatar data is required' });
    });

    it('should return error for invalid avatar format', async () => {
      req.body = { avatar: 'invalid-format' };

      await uploadAvatar(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid avatar format. Must be base64 data or URL' });
    });

    it('should return error for invalid image type', async () => {
      req.body = { avatar: 'data:image/svg+xml;base64,abc123' }; // SVG is not in the allowed list

      await uploadAvatar(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid image type. Allowed types: JPEG, PNG, GIF, WebP' });
    });

    it('should accept valid JPEG image type', async () => {
      const jpegAvatar = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=';
      req.body = { avatar: jpegAvatar };

      const mockUpdatedUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        role: 'Member',
        avatar: jpegAvatar,
        created_at: new Date()
      };

      pool.query.mockResolvedValue({ rows: [mockUpdatedUser] });

      await uploadAvatar(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return error if avatar size exceeds limit', async () => {
      // Create a large base64 string (> 2MB)
      const largeBase64 = 'data:image/png;base64,' + 'A'.repeat(3 * 1024 * 1024);
      req.body = { avatar: largeBase64 };

      await uploadAvatar(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Avatar size exceeds 2MB limit' });
    });

    it('should handle database errors', async () => {
      const base64Avatar = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      req.body = { avatar: base64Avatar };

      pool.query.mockRejectedValue(new Error('Database error'));

      await uploadAvatar(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });
});
