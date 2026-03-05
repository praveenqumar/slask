'use strict';

jest.mock('../../lib/sentry', () => ({
  captureException: jest.fn(),
  init: jest.fn(),
}));

jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        setCredentials: jest.fn(),
      })),
    },
    tasks: jest.fn(),
  },
}));

const Sentry = require('../../lib/sentry');
const Google_Tasks_Client = require('../../lib/google-tasks-client');

function makeTasksApi(insertFn) {
  return {
    tasks: {
      insert: insertFn,
    },
  };
}

const baseTask = {
  task_title: 'Fix the bug',
  task_description: 'There is a critical bug in production.',
  bullet_points: ['Reproduce the issue', 'Write a fix', 'Deploy'],
  due_date: null,
  original_message_link: 'https://slack.com/archives/C123/p1234567890',
  needs_clarification: false,
};

describe('Google_Tasks_Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('title construction', () => {
    it('sets title to task_title when needs_clarification is false', async () => {
      let capturedBody;
      const mockInsert = jest.fn().mockImplementation(({ requestBody }) => {
        capturedBody = requestBody;
        return Promise.resolve({ data: { id: '1' } });
      });
      const client = new Google_Tasks_Client(makeTasksApi(mockInsert));

      await client.createTask({ ...baseTask, needs_clarification: false });

      expect(capturedBody.title).toBe('Fix the bug');
    });

    it('prepends "[Needs Clarification] " when needs_clarification is true', async () => {
      let capturedBody;
      const mockInsert = jest.fn().mockImplementation(({ requestBody }) => {
        capturedBody = requestBody;
        return Promise.resolve({ data: { id: '1' } });
      });
      const client = new Google_Tasks_Client(makeTasksApi(mockInsert));

      await client.createTask({ ...baseTask, needs_clarification: true });

      expect(capturedBody.title).toBe('[Needs Clarification] Fix the bug');
    });
  });

  describe('notes construction', () => {
    it('includes task_description in notes', async () => {
      let capturedBody;
      const mockInsert = jest.fn().mockImplementation(({ requestBody }) => {
        capturedBody = requestBody;
        return Promise.resolve({ data: { id: '1' } });
      });
      const client = new Google_Tasks_Client(makeTasksApi(mockInsert));

      await client.createTask(baseTask);

      expect(capturedBody.notes).toContain('There is a critical bug in production.');
    });

    it('includes each bullet point prefixed with "- "', async () => {
      let capturedBody;
      const mockInsert = jest.fn().mockImplementation(({ requestBody }) => {
        capturedBody = requestBody;
        return Promise.resolve({ data: { id: '1' } });
      });
      const client = new Google_Tasks_Client(makeTasksApi(mockInsert));

      await client.createTask(baseTask);

      expect(capturedBody.notes).toContain('- Reproduce the issue');
      expect(capturedBody.notes).toContain('- Write a fix');
      expect(capturedBody.notes).toContain('- Deploy');
    });

    it('includes original_message_link in notes', async () => {
      let capturedBody;
      const mockInsert = jest.fn().mockImplementation(({ requestBody }) => {
        capturedBody = requestBody;
        return Promise.resolve({ data: { id: '1' } });
      });
      const client = new Google_Tasks_Client(makeTasksApi(mockInsert));

      await client.createTask(baseTask);

      expect(capturedBody.notes).toContain('https://slack.com/archives/C123/p1234567890');
    });
  });

  describe('due date handling', () => {
    it('sets due field when due_date is non-null', async () => {
      let capturedBody;
      const mockInsert = jest.fn().mockImplementation(({ requestBody }) => {
        capturedBody = requestBody;
        return Promise.resolve({ data: { id: '1' } });
      });
      const client = new Google_Tasks_Client(makeTasksApi(mockInsert));

      await client.createTask({ ...baseTask, due_date: '2025-12-31' });

      expect(capturedBody.due).toBeDefined();
      expect(capturedBody.due).toBe(new Date('2025-12-31').toISOString());
    });

    it('omits due field when due_date is null', async () => {
      let capturedBody;
      const mockInsert = jest.fn().mockImplementation(({ requestBody }) => {
        capturedBody = requestBody;
        return Promise.resolve({ data: { id: '1' } });
      });
      const client = new Google_Tasks_Client(makeTasksApi(mockInsert));

      await client.createTask({ ...baseTask, due_date: null });

      expect(capturedBody.due).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('throws when Google Tasks API call fails (Req 3.7)', async () => {
      const apiError = new Error('Google Tasks API error: quota exceeded');
      const mockInsert = jest.fn().mockRejectedValue(apiError);
      const client = new Google_Tasks_Client(makeTasksApi(mockInsert));

      await expect(client.createTask(baseTask)).rejects.toThrow(
        'Google Tasks API error: quota exceeded'
      );
    });

    it('calls Sentry.captureException on API failure', async () => {
      const apiError = new Error('Network failure');
      const mockInsert = jest.fn().mockRejectedValue(apiError);
      const client = new Google_Tasks_Client(makeTasksApi(mockInsert));

      await expect(client.createTask(baseTask)).rejects.toThrow();

      expect(Sentry.captureException).toHaveBeenCalledWith(apiError);
    });
  });

  describe('return value', () => {
    it('returns response.data from the API call', async () => {
      const createdTask = { id: 'task-123', title: 'Fix the bug', status: 'needsAction' };
      const mockInsert = jest.fn().mockResolvedValue({ data: createdTask });
      const client = new Google_Tasks_Client(makeTasksApi(mockInsert));

      const result = await client.createTask(baseTask);

      expect(result).toEqual(createdTask);
    });
  });
});
