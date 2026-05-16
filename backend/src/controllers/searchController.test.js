const { searchAll } = require('./searchController');
const { pool } = require('../config/db');

// Mock the database pool
jest.mock('../config/db', () => ({
  pool: {
    connect: jest.fn(),
    query: jest.fn()
  }
}));

describe('Search Controller', () => {
  let mockClient;
  let mockRelease;

  beforeEach(() => {
    mockRelease = jest.fn();
    mockClient = {
      query: jest.fn(),
      release: mockRelease
    };
    pool.connect.mockResolvedValue(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('searchAll function', () => {
    it('should return empty results for empty query', async () => {
      const result = await searchAll('', 1);
      
      expect(result).toEqual({
        projects: [],
        tasks: [],
        teamMembers: [],
        total: 0
      });
      expect(pool.connect).not.toHaveBeenCalled();
    });

    it('should return empty results for whitespace-only query', async () => {
      const result = await searchAll('   ', 1);
      
      expect(result).toEqual({
        projects: [],
        tasks: [],
        teamMembers: [],
        total: 0
      });
      expect(pool.connect).not.toHaveBeenCalled();
    });

    it('should execute search queries for valid query', async () => {
      // Mock query results
      const mockProjects = [
        { id: 1, name: 'Test Project', description: 'A test project', matched_field: 'name' }
      ];
      const mockTasks = [
        { id: 1, title: 'Test Task', description: 'A test task', matched_field: 'title' }
      ];
      const mockTeamMembers = [
        { id: 1, username: 'testuser', email: 'test@example.com', matched_field: 'username' }
      ];
      const mockCounts = {
        rows: [{ projects_count: '1', tasks_count: '1', team_members_count: '1' }]
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: mockProjects }) // projects query
        .mockResolvedValueOnce({ rows: mockTasks }) // tasks query
        .mockResolvedValueOnce({ rows: mockTeamMembers }) // team members query
        .mockResolvedValueOnce(mockCounts); // counts query

      const result = await searchAll('test', 1, 10, 0);

      expect(pool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledTimes(4);
      expect(mockRelease).toHaveBeenCalled();

      // Check that results have highlighting added
      expect(result.projects[0]).toMatchObject({
        ...mockProjects[0],
        highlighted_name: expect.stringContaining('<mark>'),
        highlighted_description: expect.stringContaining('<mark>')
      });
      expect(result.tasks[0]).toMatchObject({
        ...mockTasks[0],
        highlighted_title: expect.stringContaining('<mark>'),
        highlighted_description: expect.stringContaining('<mark>')
      });
      expect(result.teamMembers[0]).toMatchObject({
        ...mockTeamMembers[0],
        highlighted_username: expect.stringContaining('<mark>'),
        highlighted_email: expect.stringContaining('<mark>')
      });
      expect(result.total).toBe(3);
      expect(result.counts).toEqual({
        projects: 1,
        tasks: 1,
        teamMembers: 1
      });
    });

    it('should handle special characters in search query', async () => {
      const specialQuery = 'test@example.com & special-chars';
      
      mockClient.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ 
          rows: [{ projects_count: '0', tasks_count: '0', team_members_count: '0' }] 
        });

      await searchAll(specialQuery, 1, 10, 0);

      // Check that the query was called with the search term containing special characters
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([`%${specialQuery}%`, specialQuery])
      );
    });

    it('should handle database errors gracefully', async () => {
      mockClient.query.mockRejectedValue(new Error('Database error'));

      await expect(searchAll('test', 1, 10, 0)).rejects.toThrow('Database error');
      expect(mockRelease).toHaveBeenCalled();
    });

    it('should apply pagination correctly', async () => {
      const limit = 5;
      const offset = 10;
      
      mockClient.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ 
          rows: [{ projects_count: '0', tasks_count: '0', team_members_count: '0' }] 
        });

      await searchAll('test', 1, limit, offset);

      // Check that limit and offset are passed correctly
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([expect.any(String), expect.any(String), 1, limit, offset])
      );
    });

    it('should highlight matching text in results', async () => {
      const mockProjects = [{
        id: 1,
        name: 'Test Project',
        description: 'This is a test project',
        matched_field: 'name'
      }];

      mockClient.query
        .mockResolvedValueOnce({ rows: mockProjects })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ 
          rows: [{ projects_count: '1', tasks_count: '0', team_members_count: '0' }] 
        });

      const result = await searchAll('Test', 1);

      expect(result.projects[0].highlighted_name).toBe('<mark>Test</mark> Project');
      expect(result.projects[0].highlighted_description).toBe('This is a <mark>test</mark> project');
      expect(result.projects[0].matched_field).toBe('name');
    });

    it('should search across multiple entity types', async () => {
      const mockProjects = [{ id: 1, name: 'Project Test', matched_field: 'name' }];
      const mockTasks = [{ id: 1, title: 'Task Test', matched_field: 'title' }];
      const mockTeamMembers = [{ id: 1, username: 'User Test', matched_field: 'username' }];

      mockClient.query
        .mockResolvedValueOnce({ rows: mockProjects })
        .mockResolvedValueOnce({ rows: mockTasks })
        .mockResolvedValueOnce({ rows: mockTeamMembers })
        .mockResolvedValueOnce({ 
          rows: [{ projects_count: '1', tasks_count: '1', team_members_count: '1' }] 
        });

      const result = await searchAll('Test', 1);

      expect(result.projects).toHaveLength(1);
      expect(result.tasks).toHaveLength(1);
      expect(result.teamMembers).toHaveLength(1);
      expect(result.total).toBe(3);
    });

    it('should handle empty search results', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ 
          rows: [{ projects_count: '0', tasks_count: '0', team_members_count: '0' }] 
        });

      const result = await searchAll('nonexistent', 1);

      expect(result.projects).toHaveLength(0);
      expect(result.tasks).toHaveLength(0);
      expect(result.teamMembers).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });
});