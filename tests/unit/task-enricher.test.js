'use strict';

jest.mock('../../lib/sentry', () => ({
  captureException: jest.fn(),
  init: jest.fn(),
}));

jest.mock('../../lib/llm-agent');
jest.mock('../../lib/google-tasks-client');

const Sentry = require('../../lib/sentry');
const Task_Enricher = require('../../lib/task-enricher');

function makeStarEvent(channel = 'C123', ts = '1234567890.123456', text = 'Fix the bug') {
  return {
    type: 'star_added',
    item: { type: 'message', channel, message: { ts, text }, ts }
  };
}

describe('Task_Enricher', () => {
  let mockLlmAgent;
  let mockGoogleTasksClient;
  let enricher;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLlmAgent = { enrich: jest.fn() };
    mockGoogleTasksClient = { createTask: jest.fn() };
    enricher = new Task_Enricher(mockLlmAgent, mockGoogleTasksClient);
  });

  describe('messageLink construction', () => {
    it('constructs messageLink correctly from channel and ts', async () => {
      const enrichedTask = { task_title: 'Test' };
      mockLlmAgent.enrich.mockResolvedValue(enrichedTask);
      mockGoogleTasksClient.createTask.mockResolvedValue({ id: '1' });

      await enricher.enrich(makeStarEvent('C123', '1234567890.123456'));

      expect(mockLlmAgent.enrich).toHaveBeenCalledWith(
        'Fix the bug',
        'https://slack.com/archives/C123/p1234567890123456'
      );
    });

    it('removes the dot from ts when building messageLink', async () => {
      mockLlmAgent.enrich.mockResolvedValue({});
      mockGoogleTasksClient.createTask.mockResolvedValue({ id: '1' });

      await enricher.enrich(makeStarEvent('CABC', '9876543210.000100'));

      const [, link] = mockLlmAgent.enrich.mock.calls[0];
      expect(link).toBe('https://slack.com/archives/CABC/p9876543210000100');
    });
  });

  describe('llmAgent.enrich() call', () => {
    it('calls llmAgent.enrich with messageText and messageLink', async () => {
      const enrichedTask = { task_title: 'Do something' };
      mockLlmAgent.enrich.mockResolvedValue(enrichedTask);
      mockGoogleTasksClient.createTask.mockResolvedValue({ id: '1' });

      await enricher.enrich(makeStarEvent('C999', '1111111111.222222', 'Deploy the app'));

      expect(mockLlmAgent.enrich).toHaveBeenCalledWith(
        'Deploy the app',
        'https://slack.com/archives/C999/p1111111111222222'
      );
    });

    it('uses fallback text "Task from Slack" when message.text is absent', async () => {
      mockLlmAgent.enrich.mockResolvedValue({});
      mockGoogleTasksClient.createTask.mockResolvedValue({ id: '1' });

      const event = {
        type: 'star_added',
        item: { type: 'message', channel: 'C123', ts: '1234567890.000000' }
      };

      await enricher.enrich(event);

      expect(mockLlmAgent.enrich).toHaveBeenCalledWith(
        'Task from Slack',
        expect.any(String)
      );
    });
  });

  describe('googleTasksClient.createTask() call', () => {
    it('calls createTask with the result from llmAgent.enrich', async () => {
      const enrichedTask = { task_title: 'Fix bug', task_description: 'desc' };
      mockLlmAgent.enrich.mockResolvedValue(enrichedTask);
      mockGoogleTasksClient.createTask.mockResolvedValue({ id: 'task-1' });

      await enricher.enrich(makeStarEvent());

      expect(mockGoogleTasksClient.createTask).toHaveBeenCalledWith(enrichedTask);
    });

    it('returns the result from googleTasksClient.createTask', async () => {
      const createdTask = { id: 'task-42', title: 'Fix the bug' };
      mockLlmAgent.enrich.mockResolvedValue({});
      mockGoogleTasksClient.createTask.mockResolvedValue(createdTask);

      const result = await enricher.enrich(makeStarEvent());

      expect(result).toEqual(createdTask);
    });
  });

  describe('error propagation', () => {
    it('propagates error when llmAgent.enrich throws', async () => {
      const err = new Error('LLM failed');
      mockLlmAgent.enrich.mockRejectedValue(err);

      await expect(enricher.enrich(makeStarEvent())).rejects.toThrow('LLM failed');
    });

    it('calls Sentry.captureException when llmAgent.enrich throws', async () => {
      const err = new Error('LLM network error');
      mockLlmAgent.enrich.mockRejectedValue(err);

      await expect(enricher.enrich(makeStarEvent())).rejects.toThrow();

      expect(Sentry.captureException).toHaveBeenCalledWith(err);
    });

    it('calls Sentry.captureException when googleTasksClient.createTask throws', async () => {
      const err = new Error('Google Tasks API error');
      mockLlmAgent.enrich.mockResolvedValue({});
      mockGoogleTasksClient.createTask.mockRejectedValue(err);

      await expect(enricher.enrich(makeStarEvent())).rejects.toThrow();

      expect(Sentry.captureException).toHaveBeenCalledWith(err);
    });
  });
});
