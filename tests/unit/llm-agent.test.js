'use strict';

jest.mock('../../lib/sentry', () => ({
  captureException: jest.fn(),
  init: jest.fn(),
}));

const Sentry = require('../../lib/sentry');
const LLM_Agent = require('../../lib/llm-agent');

const makeValidResponse = (overrides = {}) => ({
  task_title: 'Test Task',
  task_description: 'A test task description',
  bullet_points: ['Step 1', 'Step 2'],
  due_date: '2024-12-31',
  original_message_link: 'https://slack.com/archives/C123/p456',
  needs_clarification: false,
  ...overrides,
});

const makeHttpClient = (responseData) => ({
  post: jest.fn().mockResolvedValue({
    data: {
      choices: [
        {
          message: {
            content: JSON.stringify(responseData),
          },
        },
      ],
    },
  }),
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('LLM_Agent', () => {
  describe('network/API error propagation (Req 2.5)', () => {
    it('propagates network errors thrown by httpClient', async () => {
      const networkError = new Error('Network Error');
      const mockHttpClient = {
        post: jest.fn().mockRejectedValue(networkError),
      };

      const agent = new LLM_Agent(mockHttpClient);
      await expect(agent.enrich('some message', 'https://slack.com/link')).rejects.toThrow(
        'Network Error'
      );
    });

    it('calls Sentry.captureException on network error', async () => {
      const networkError = new Error('Connection refused');
      const mockHttpClient = {
        post: jest.fn().mockRejectedValue(networkError),
      };

      const agent = new LLM_Agent(mockHttpClient);
      await expect(agent.enrich('msg', 'link')).rejects.toThrow();
      expect(Sentry.captureException).toHaveBeenCalledWith(networkError);
    });

    it('propagates API errors with status codes', async () => {
      const apiError = new Error('Request failed with status code 401');
      const mockHttpClient = {
        post: jest.fn().mockRejectedValue(apiError),
      };

      const agent = new LLM_Agent(mockHttpClient);
      await expect(agent.enrich('msg', 'link')).rejects.toThrow(
        'Request failed with status code 401'
      );
    });
  });

  describe('non-JSON response throws descriptive error (Req 2.4)', () => {
    it('throws descriptive error when LLM returns plain text', async () => {
      const mockHttpClient = {
        post: jest.fn().mockResolvedValue({
          data: {
            choices: [{ message: { content: 'Sorry, I cannot help with that.' } }],
          },
        }),
      };

      const agent = new LLM_Agent(mockHttpClient);
      await expect(agent.enrich('msg', 'link')).rejects.toThrow(
        'LLM response is not valid JSON: Sorry, I cannot help with that.'
      );
    });

    it('throws descriptive error when LLM returns malformed JSON', async () => {
      const malformed = '{ "task_title": "broken json"';
      const mockHttpClient = {
        post: jest.fn().mockResolvedValue({
          data: {
            choices: [{ message: { content: malformed } }],
          },
        }),
      };

      const agent = new LLM_Agent(mockHttpClient);
      await expect(agent.enrich('msg', 'link')).rejects.toThrow(
        `LLM response is not valid JSON: ${malformed}`
      );
    });

    it('calls Sentry.captureException on parse failure', async () => {
      const mockHttpClient = {
        post: jest.fn().mockResolvedValue({
          data: {
            choices: [{ message: { content: 'not json' } }],
          },
        }),
      };

      const agent = new LLM_Agent(mockHttpClient);
      await expect(agent.enrich('msg', 'link')).rejects.toThrow();
      expect(Sentry.captureException).toHaveBeenCalled();
    });
  });

  describe('needs_clarification: true is returned as-is (Req 2.7)', () => {
    it('returns the parsed object when needs_clarification is true', async () => {
      const clarificationResponse = makeValidResponse({ needs_clarification: true });
      const mockHttpClient = makeHttpClient(clarificationResponse);

      const agent = new LLM_Agent(mockHttpClient);
      const result = await agent.enrich('unclear message', 'https://slack.com/link');

      expect(result).toEqual(clarificationResponse);
      expect(result.needs_clarification).toBe(true);
    });

    it('returns the full object including all fields when needs_clarification is true', async () => {
      const clarificationResponse = makeValidResponse({
        needs_clarification: true,
        task_title: 'Unclear Task',
        task_description: 'This message is ambiguous',
      });
      const mockHttpClient = makeHttpClient(clarificationResponse);

      const agent = new LLM_Agent(mockHttpClient);
      const result = await agent.enrich('ambiguous message', 'https://slack.com/link');

      expect(result.task_title).toBe('Unclear Task');
      expect(result.needs_clarification).toBe(true);
    });
  });

  describe('successful enrichment', () => {
    it('returns parsed Enriched_Task on valid response', async () => {
      const validResponse = makeValidResponse();
      const mockHttpClient = makeHttpClient(validResponse);

      const agent = new LLM_Agent(mockHttpClient);
      const result = await agent.enrich('Fix the login bug by tomorrow', 'https://slack.com/link');

      expect(result).toEqual(validResponse);
    });

    it('strips markdown json code fences before parsing', async () => {
      const validResponse = makeValidResponse();
      const fencedContent = '```json\n' + JSON.stringify(validResponse) + '\n```';
      const mockHttpClient = {
        post: jest.fn().mockResolvedValue({
          data: {
            choices: [{ message: { content: fencedContent } }],
          },
        }),
      };

      const agent = new LLM_Agent(mockHttpClient);
      const result = await agent.enrich('msg', 'link');
      expect(result).toEqual(validResponse);
    });

    it('strips plain code fences before parsing', async () => {
      const validResponse = makeValidResponse();
      const fencedContent = '```\n' + JSON.stringify(validResponse) + '\n```';
      const mockHttpClient = {
        post: jest.fn().mockResolvedValue({
          data: {
            choices: [{ message: { content: fencedContent } }],
          },
        }),
      };

      const agent = new LLM_Agent(mockHttpClient);
      const result = await agent.enrich('msg', 'link');
      expect(result).toEqual(validResponse);
    });
  });

  describe('missing required fields validation (Req 2.3)', () => {
    it('throws when task_title is missing', async () => {
      const { task_title, ...withoutTitle } = makeValidResponse();
      const mockHttpClient = makeHttpClient(withoutTitle);

      const agent = new LLM_Agent(mockHttpClient);
      await expect(agent.enrich('msg', 'link')).rejects.toThrow(
        'LLM response missing required fields: task_title'
      );
    });

    it('throws listing all missing fields', async () => {
      const mockHttpClient = makeHttpClient({ task_title: 'Only title' });

      const agent = new LLM_Agent(mockHttpClient);
      await expect(agent.enrich('msg', 'link')).rejects.toThrow(
        'LLM response missing required fields:'
      );
    });
  });

  describe('constructor defaults', () => {
    it('uses axios as default httpClient when none provided', () => {
      const agent = new LLM_Agent();
      // axios is the default — just verify the agent was created without error
      expect(agent).toBeInstanceOf(LLM_Agent);
    });

    it('uses LLM_API_BASE_URL env var when set', () => {
      const original = process.env.LLM_API_BASE_URL;
      process.env.LLM_API_BASE_URL = 'https://custom.api.com/v1/chat';
      const agent = new LLM_Agent();
      expect(agent.apiBaseUrl).toBe('https://custom.api.com/v1/chat');
      process.env.LLM_API_BASE_URL = original;
    });

    it('defaults to ZhipuAI endpoint when LLM_API_BASE_URL not set', () => {
      const original = process.env.LLM_API_BASE_URL;
      delete process.env.LLM_API_BASE_URL;
      const agent = new LLM_Agent();
      expect(agent.apiBaseUrl).toBe(
        'https://open.bigmodel.cn/api/paas/v4/chat/completions'
      );
      process.env.LLM_API_BASE_URL = original;
    });

    it('defaults to glm-4 model when LLM_MODEL not set', () => {
      const original = process.env.LLM_MODEL;
      delete process.env.LLM_MODEL;
      const agent = new LLM_Agent();
      expect(agent.model).toBe('glm-4');
      process.env.LLM_MODEL = original;
    });
  });
});
