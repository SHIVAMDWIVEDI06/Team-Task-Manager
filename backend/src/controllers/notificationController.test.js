// Mock the database pool BEFORE requiring anything
jest.mock('../config/db', () => ({
  pool: {
    query: jest.fn()
  }
}));

const { pool } = require('../config/db');
const controller = require('./notificationController');

describe('Notification Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });



  describe('createNotification', () => {
    /** Validates: Requirements 2.1 */
    it('should create a notification with all required parameters', async () => {
      const mockNotification = {
        id: 1,
        user_id: 1,
        type: 'task_assigned',
        message: 'You have been assigned a new task',
        related_id: 5,
        is_read: false,
        created_at: new Date()
      };

      pool.query.mockResolvedValueOnce({ rows: [mockNotification] });

      const result = await controller.createNotification(
        1,
        'task_assigned',
        'You have been assigned a new task',
        5
      );

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO notifications'),
        [1, 'task_assigned', 'You have been assigned a new task', 5]
      );
      expect(result).toEqual(mockNotification);
    });

    it('should create notification with null related_id', async () => {
      const mockNotification = {
        id: 2,
        user_id: 1,
        type: 'status_change',
        message: 'Task status has changed',
        related_id: null,
        is_read: false,
        created_at: new Date()
      };

      pool.query.mockResolvedValueOnce({ rows: [mockNotification] });

      const result = await controller.createNotification(
        1,
        'status_change',
        'Task status has changed',
        null
      );

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO notifications'),
        [1, 'status_change', 'Task status has changed', null]
      );
      expect(result).toEqual(mockNotification);
    });

    it('should create notification with mention type', async () => {
      const mockNotification = {
        id: 3,
        user_id: 2,
        type: 'mention',
        message: 'John mentioned you in a comment',
        related_id: 10,
        is_read: false,
        created_at: new Date()
      };

      pool.query.mockResolvedValueOnce({ rows: [mockNotification] });

      const result = await controller.createNotification(2, 'mention', 'John mentioned you in a comment', 10);

      expect(result.type).toBe('mention');
      expect(result.user_id).toBe(2);
    });

    it('should throw error on database failure', async () => {
      pool.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(
        controller.createNotification(1, 'task_assigned', 'Test message', 1)
      ).rejects.toThrow('Database error');
    });
  });

  describe('getNotifications', () => {
    /** Validates: Requirements 2.5 */
    it('should return notifications with pagination metadata and project_id for task-related notifications', async () => {
      const mockNotifications = [
        { id: 1, message: 'Notification 1', is_read: false, created_at: new Date(), project_id: 10 },
        { id: 2, message: 'Notification 2', is_read: true, created_at: new Date(), project_id: null }
      ];

      // Mock queries: count, data, unread count
      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({ rows: mockNotifications })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });

      // Create mock request and response
      const req = {
        user: { id: 1 },
        query: { page: 1, limit: 20, unread_only: 'false' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await controller.getNotifications(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          notifications: mockNotifications,
          total: 2,
          unreadCount: 1,
          page: 1,
          totalPages: 1
        })
      );
    });

    it('should filter by unread_only when specified', async () => {
      const unreadNotifications = [
        { id: 1, message: 'Unread notification', is_read: false, created_at: new Date(), project_id: 5 }
      ];

      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: unreadNotifications })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });

      const req = {
        user: { id: 1 },
        query: { page: 1, limit: 20, unread_only: 'true' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await controller.getNotifications(req, res);

      // Verify the query includes is_read filter
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('is_read = false'),
        expect.any(Array)
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          notifications: unreadNotifications,
          total: 1
        })
      );
    });

    it('should handle custom pagination parameters', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '50' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const req = {
        user: { id: 1 },
        query: { page: 2, limit: 10, unread_only: 'false' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await controller.getNotifications(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
          totalPages: 5
        })
      );
    });

    it('should return 500 on database error', async () => {
      pool.query.mockRejectedValueOnce(new Error('Database connection failed'));

      const req = {
        user: { id: 1 },
        query: {}
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await controller.getNotifications(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });

  describe('markAsRead', () => {
    /** Validates: Requirements 2.5 */
    it('should mark a notification as read successfully', async () => {
      const mockNotification = {
        id: 1,
        user_id: 1,
        type: 'task_assigned',
        message: 'Test message',
        is_read: false
      };

      pool.query
        .mockResolvedValueOnce({ rows: [mockNotification] })
        .mockResolvedValueOnce({ rows: [] });

      const req = {
        user: { id: 1 },
        params: { id: 1 }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await controller.markAsRead(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Notification marked as read' });
    });

    it('should return 404 when notification not found', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const req = {
        user: { id: 1 },
        params: { id: 999 }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await controller.markAsRead(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Notification not found' });
    });

    it('should return 500 on database error', async () => {
      pool.query.mockRejectedValueOnce(new Error('Database error'));

      const req = {
        user: { id: 1 },
        params: { id: 1 }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await controller.markAsRead(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 5 });

      const req = { user: { id: 1 } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await controller.markAllAsRead(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'All notifications marked as read' });
    });

    it('should return 500 on database error', async () => {
      pool.query.mockRejectedValueOnce(new Error('Database error'));

      const req = { user: { id: 1 } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await controller.markAllAsRead(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('deleteNotification', () => {
    it('should delete a notification successfully', async () => {
      const mockNotification = { id: 1, message: 'To be deleted' };
      pool.query.mockResolvedValueOnce({ rows: [mockNotification] });

      const req = {
        user: { id: 1 },
        params: { id: 1 }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await controller.deleteNotification(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 when deleting non-existent notification', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const req = {
        user: { id: 1 },
        params: { id: 999 }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await controller.deleteNotification(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('archiveOldNotifications', () => {
    it('should archive notifications older than 30 days', async () => {
      const archivedNotifications = [
        { id: 1, message: 'Old notification 1' },
        { id: 2, message: 'Old notification 2' }
      ];
      pool.query.mockResolvedValueOnce({ rowCount: 2, rows: archivedNotifications });

      const req = { user: { id: 1 } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await controller.archiveOldNotifications(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Old notifications archived',
          archivedCount: 2
        })
      );
    });
  });
});