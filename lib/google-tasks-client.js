'use strict';

const Sentry = require('./sentry');

function buildDefaultTasksApi() {
  const { google } = require('googleapis');
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return google.tasks({ version: 'v1', auth: oauth2Client });
}

class Google_Tasks_Client {
  constructor(tasksApi = buildDefaultTasksApi()) {
    this.tasksApi = tasksApi;
  }

  async createTask(enrichedTask) {
    try {
      const {
        task_title,
        task_description,
        bullet_points,
        due_date,
        original_message_link,
        needs_clarification,
      } = enrichedTask;

      // Build title — prepend prefix if needs_clarification
      const title = needs_clarification === true
        ? `[Needs Clarification] ${task_title}`
        : task_title;

      // Build notes: description + bullet points + message link
      const bulletLines = bullet_points.map((bp) => `- ${bp}`).join('\n');
      const notes = `${task_description}\n\n${bulletLines}\n\n${original_message_link}`;

      // Build request body — only include due when non-null
      const requestBody = { title, notes };
      if (due_date !== null && due_date !== undefined) {
        requestBody.due = new Date(due_date).toISOString();
      }

      const response = await this.tasksApi.tasks.insert({
        tasklist: '@default',
        requestBody,
      });

      return response.data;
    } catch (err) {
      Sentry.captureException(err);
      throw err;
    }
  }
}

module.exports = Google_Tasks_Client;
