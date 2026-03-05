'use strict';

const axios = require('axios');
const Sentry = require('./sentry');

const PROMPT_TEMPLATE = `You convert Slack messages into structured tasks.

Your goal is to extract an actionable task from the Slack message.

Rules:
1. Create a clear task_title.
2. Write a short task_description expanding the message slightly for clarity.
3. If the message implies multiple steps, break them into bullet_points.
4. If ownership is unclear, add a bullet suggesting to assign an owner.
5. Extract due_date if time references exist (tomorrow, next week, Monday, EOD, in 2 days, etc.).
6. Convert relative time into an absolute date using the current date.
7. If no due date exists, return null.
8. Do not invent information that does not exist in the message.
9. Always include the original_message_link.
10. If the message is not actionable, set needs_clarification = true.

Current date: {{CURRENT_DATE}}
Slack message: {{MESSAGE_TEXT}}
Slack message link: {{MESSAGE_LINK}}

Return ONLY valid JSON (no markdown fences) in this format:
{
  "task_title": "",
  "task_description": "",
  "bullet_points": [],
  "due_date": "",
  "original_message_link": "",
  "needs_clarification": false
}`;

const REQUIRED_FIELDS = [
  'task_title',
  'task_description',
  'bullet_points',
  'due_date',
  'original_message_link',
  'needs_clarification',
];

class LLM_Agent {
  constructor(httpClient = axios) {
    this.httpClient = httpClient;
    this.apiBaseUrl =
      process.env.LLM_API_BASE_URL ||
      'https://api.z.ai/api/paas/v4/chat/completions';
    this.model = process.env.LLM_MODEL || 'glm-4.7';
    this.apiKey = process.env.LLM_API_KEY;
  }

  async enrich(messageText, messageLink) {
    try {
      const currentDate = new Date().toISOString().split('T')[0];
      const prompt = PROMPT_TEMPLATE
        .replace('{{CURRENT_DATE}}', currentDate)
        .replace('{{MESSAGE_TEXT}}', messageText)
        .replace('{{MESSAGE_LINK}}', messageLink);

      console.log(`[LLM_Agent] Calling ${this.apiBaseUrl} with model=${this.model}`);
      const response = await this.httpClient.post(
        this.apiBaseUrl,
        {
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const raw = response.data.choices[0].message.content;
      console.log('[LLM_Agent] Raw response:', raw.slice(0, 200));

      // Strip markdown code fences
      const cleaned = raw
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      let parsed;
      try {
        parsed = JSON.parse(cleaned);
      } catch (parseErr) {
        throw new Error(`LLM response is not valid JSON: ${raw}`);
      }

      // Validate required fields
      const missingFields = REQUIRED_FIELDS.filter(
        (field) => !(field in parsed)
      );
      if (missingFields.length > 0) {
        throw new Error(
          `LLM response missing required fields: ${missingFields.join(', ')}`
        );
      }

      // Return as-is if needs_clarification is true (Req 2.7)
      if (parsed.needs_clarification === true) {
        return parsed;
      }

      return parsed;
    } catch (err) {
      // Log API error response body if available
      if (err.response) {
        console.error('[LLM_Agent] API error:', err.response.status, JSON.stringify(err.response.data));
      }
      Sentry.captureException(err);
      throw err;
    }
  }
}

module.exports = LLM_Agent;
