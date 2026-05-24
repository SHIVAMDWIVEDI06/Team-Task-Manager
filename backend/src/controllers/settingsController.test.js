const { getUserSettings, updateUserSettings } = require('./settingsController');
const { pool } = require('../config/db');

// Mock the database pool
jest.mock('../config/db', () => ({
  pool: {
    query: jest.fn()
  }
}));

describe('Settings Controller', () => {
  let req, res;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Mock request and response objects
    req = {
      user: { id: 1 },
      body: {}
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  describe('getUserSettings', () => {
    it('should return user settings successfully', async () => {
      const mockSettings = {
        theme: 'dark',
        notification_preferences: {
          email: true,
          push: false,
          task_assigned: true,
          status_change: true,
          mentions: true
        },
        display_options: {
          compact_view: true,
          show_completed: false,
          items_per_page: 50
        }
      };

      pool.query.mockResolvedValue({ rows: [mockSettings] });

      await getUserSettings(req, res);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT theme, notification_preferences, display_options'),
        [1]
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockSettings);
    });

    it('should return 404 if user not found', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      await getUserSettings(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
    });

    it('should handle database errors', async () => {
      pool.query.mockRejectedValue(new Error('Database error'));

      await getUserSettings(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });

  describe('updateUserSettings', () => {
    it('should update theme successfully', async () => {
      req.body = { theme: 'dark' };

      const mockUpdatedSettings = {
        theme: 'dark',
        notification_preferences: { email: true, push: true },
        display_options: { compact_view: false }
      };

      pool.query.mockResolvedValue({ rows: [mockUpdatedSettings] });

      await updateUserSettings(req, res);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        expect.arrayContaining(['dark', 1])
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Settings updated successfully',
        settings: mockUpdatedSettings
      });
    });

    it('should update notification preferences successfully', async () => {
      req.body = {
        notification_preferences: {
          email: false,
          push: true,
          task_assigned: false,
          status_change: true,
          mentions: false
        }
      };

      const mockUpdatedSettings = {
        theme: 'light',
        notification_preferences: req.body.notification_preferences,
        display_options: { compact_view: false }
      };

      pool.query.mockResolvedValue({ rows: [mockUpdatedSettings] });

      await updateUserSettings(req, res);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        expect.arrayContaining([JSON.stringify(req.body.notification_preferences), 1])
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Settings updated successfully',
        settings: mockUpdatedSettings
      });
    });

    it('should update display options successfully', async () => {
      req.body = {
        display_options: {
          compact_view: true,
          show_completed: false,
          items_per_page: 30
        }
      };

      const mockUpdatedSettings = {
        theme: 'light',
        notification_preferences: { email: true },
        display_options: req.body.display_options
      };

      pool.query.mockResolvedValue({ rows: [mockUpdatedSettings] });

      await updateUserSettings(req, res);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        expect.arrayContaining([JSON.stringify(req.body.display_options), 1])
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should update multiple settings at once', async () => {
      req.body = {
        theme: 'dark',
        notification_preferences: { email: false, push: true },
        display_options: { compact_view: true, items_per_page: 25 }
      };

      const mockUpdatedSettings = {
        theme: 'dark',
        notification_preferences: req.body.notification_preferences,
        display_options: req.body.display_options
      };

      pool.query.mockResolvedValue({ rows: [mockUpdatedSettings] });

      await updateUserSettings(req, res);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        expect.arrayContaining([
          'dark',
          JSON.stringify(req.body.notification_preferences),
          JSON.stringify(req.body.display_options),
          1
        ])
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 400 if no fields provided', async () => {
      req.body = {};

      await updateUserSettings(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'At least one setting field must be provided for update'
      });
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid theme value', async () => {
      req.body = { theme: 'invalid-theme' };

      await updateUserSettings(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid theme value. Must be one of: light, dark, auto'
      });
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('should accept valid theme values', async () => {
      const validThemes = ['light', 'dark', 'auto'];

      for (const theme of validThemes) {
        jest.clearAllMocks();
        req.body = { theme };

        pool.query.mockResolvedValue({
          rows: [{ theme, notification_preferences: {}, display_options: {} }]
        });

        await updateUserSettings(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
      }
    });

    it('should return 400 if notification_preferences is not an object', async () => {
      req.body = { notification_preferences: 'not-an-object' };

      await updateUserSettings(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'notification_preferences must be an object'
      });
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('should return 400 if notification_preferences is an array', async () => {
      req.body = { notification_preferences: [] };

      await updateUserSettings(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'notification_preferences must be an object'
      });
    });

    it('should return 400 if notification_preferences contains non-boolean values', async () => {
      req.body = {
        notification_preferences: {
          email: 'true', // string instead of boolean
          push: true
        }
      };

      await updateUserSettings(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'notification_preferences.email must be a boolean'
      });
    });

    it('should return 400 if display_options is not an object', async () => {
      req.body = { display_options: 'not-an-object' };

      await updateUserSettings(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'display_options must be an object'
      });
    });

    it('should return 400 if compact_view is not a boolean', async () => {
      req.body = {
        display_options: {
          compact_view: 'true' // string instead of boolean
        }
      };

      await updateUserSettings(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'display_options.compact_view must be a boolean'
      });
    });

    it('should return 400 if show_completed is not a boolean', async () => {
      req.body = {
        display_options: {
          show_completed: 1 // number instead of boolean
        }
      };

      await updateUserSettings(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'display_options.show_completed must be a boolean'
      });
    });

    it('should return 400 if items_per_page is not an integer', async () => {
      req.body = {
        display_options: {
          items_per_page: 25.5 // float instead of integer
        }
      };

      await updateUserSettings(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'display_options.items_per_page must be an integer between 10 and 100'
      });
    });

    it('should return 400 if items_per_page is below minimum', async () => {
      req.body = {
        display_options: {
          items_per_page: 5 // below minimum of 10
        }
      };

      await updateUserSettings(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'display_options.items_per_page must be an integer between 10 and 100'
      });
    });

    it('should return 400 if items_per_page is above maximum', async () => {
      req.body = {
        display_options: {
          items_per_page: 150 // above maximum of 100
        }
      };

      await updateUserSettings(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'display_options.items_per_page must be an integer between 10 and 100'
      });
    });

    it('should accept valid items_per_page values', async () => {
      const validValues = [10, 20, 50, 100];

      for (const items_per_page of validValues) {
        jest.clearAllMocks();
        req.body = { display_options: { items_per_page } };

        pool.query.mockResolvedValue({
          rows: [{ theme: 'light', notification_preferences: {}, display_options: { items_per_page } }]
        });

        await updateUserSettings(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
      }
    });

    it('should handle database errors', async () => {
      req.body = { theme: 'dark' };
      pool.query.mockRejectedValue(new Error('Database error'));

      await updateUserSettings(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });

    it('should allow partial notification_preferences updates', async () => {
      req.body = {
        notification_preferences: {
          email: false
          // Other fields not specified - should be allowed
        }
      };

      pool.query.mockResolvedValue({
        rows: [{
          theme: 'light',
          notification_preferences: { email: false },
          display_options: {}
        }]
      });

      await updateUserSettings(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should allow partial display_options updates', async () => {
      req.body = {
        display_options: {
          compact_view: true
          // Other fields not specified - should be allowed
        }
      };

      pool.query.mockResolvedValue({
        rows: [{
          theme: 'light',
          notification_preferences: {},
          display_options: { compact_view: true }
        }]
      });

      await updateUserSettings(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
