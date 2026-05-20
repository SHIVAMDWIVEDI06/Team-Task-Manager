const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const profileRoutes = require('./profileRoutes');

// Create a test Express app
const app = express();
app.use(express.json());
app.use('/api/profile', profileRoutes);

describe('Profile Routes Integration Tests', () => {
  let testUserId;
  let authToken;

  beforeAll(async () => {
    // Create a test user
    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('testpassword', salt);

    const result = await pool.query(
      `INSERT INTO users (username, email, password, role) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ['testprofileuser', 'testprofile@example.com', hashedPassword, 'Member']
    );

    testUserId = result.rows[0].id;

    // Generate auth token
    authToken = jwt.sign(
      { id: testUserId, username: 'testprofileuser' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    // Clean up test user
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    await pool.end();
  });

  describe('GET /api/profile', () => {
    it('should return user profile when authenticated', async () => {
      const response = await request(app)
        .get('/api/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', testUserId);
      expect(response.body).toHaveProperty('username', 'testprofileuser');
      expect(response.body).toHaveProperty('email', 'testprofile@example.com');
      expect(response.body).not.toHaveProperty('password');
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app).get('/api/profile');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PATCH /api/profile', () => {
    it('should update username successfully', async () => {
      const response = await request(app)
        .patch('/api/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ username: 'updatedprofileuser' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Profile updated successfully');
      expect(response.body.user).toHaveProperty('username', 'updatedprofileuser');
    });

    it('should update email successfully', async () => {
      const response = await request(app)
        .patch('/api/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email: 'newemail@example.com' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Profile updated successfully');
      expect(response.body.user).toHaveProperty('email', 'newemail@example.com');
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .patch('/api/profile')
        .send({ username: 'newusername' });

      expect(response.status).toBe(401);
    });

    it('should return 400 when no fields provided', async () => {
      const response = await request(app)
        .patch('/api/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/profile/avatar', () => {
    it('should upload avatar successfully with base64 data', async () => {
      const avatarData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      
      const response = await request(app)
        .post('/api/profile/avatar')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ avatar: avatarData });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Avatar uploaded successfully');
      expect(response.body.user).toHaveProperty('avatar', avatarData);
    });

    it('should upload avatar successfully with URL', async () => {
      const avatarUrl = 'https://example.com/avatar.png';
      
      const response = await request(app)
        .post('/api/profile/avatar')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ avatar: avatarUrl });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Avatar uploaded successfully');
      expect(response.body.user).toHaveProperty('avatar', avatarUrl);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .post('/api/profile/avatar')
        .send({ avatar: 'data:image/png;base64,abc123' });

      expect(response.status).toBe(401);
    });

    it('should return 400 when avatar data is missing', async () => {
      const response = await request(app)
        .post('/api/profile/avatar')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for invalid avatar format', async () => {
      const response = await request(app)
        .post('/api/profile/avatar')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ avatar: 'invalid-format' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });
});
