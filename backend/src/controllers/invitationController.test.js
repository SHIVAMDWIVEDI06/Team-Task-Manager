const { sendInvitation, expireOldInvitations } = require('./invitationController');
const { pool } = require('../config/db');

// Mock the db pool
jest.mock('../config/db', () => ({
  pool: {
    query: jest.fn(),
  },
}));

describe('Invitation Controller', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    mockReq = {
      body: {},
      user: { id: 1 }, // Admin ID
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();
  });

  describe('sendInvitation', () => {
    it('should require a valid email', async () => {
      mockReq.body.email = 'invalid-email';
      await sendInvitation(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Valid email is required' });
    });

    it('should return error if user already exists', async () => {
      mockReq.body.email = 'existing@test.com';
      pool.query.mockResolvedValueOnce({ rows: [{ id: 2 }] }); // User exists

      await sendInvitation(mockReq, mockRes);
      
      expect(pool.query).toHaveBeenCalledWith('SELECT id FROM users WHERE email = $1', ['existing@test.com']);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'User with this email already exists' });
    });

    it('should create an invitation successfully', async () => {
      mockReq.body.email = 'new@test.com';
      pool.query
        .mockResolvedValueOnce({ rows: [] }) // User check passes
        .mockResolvedValueOnce({ rows: [] }) // Existing pending invitation check passes
        .mockResolvedValueOnce({ 
          rows: [{ id: 1, email: 'new@test.com', status: 'Pending' }] 
        }); // Insert

      await sendInvitation(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Invitation sent successfully',
        invitation: expect.any(Object),
      });
    });
  });

  describe('expireOldInvitations', () => {
    it('should expire old invitations successfully', async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 3 });

      await expireOldInvitations(mockReq, mockRes);

      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE invitations'));
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Expired 3 old invitations' });
    });
  });
});
