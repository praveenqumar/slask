'use strict';

const Sentry = require('./sentry');
const LLM_Agent = require('./llm-agent');
const Google_Tasks_Client = require('./google-tasks-client');

class Task_Enricher {
  constructor(llmAgent = new LLM_Agent(), googleTasksClient = new Google_Tasks_Client()) {
    this.llmAgent = llmAgent;
    this.googleTasksClient = googleTasksClient;
  }

  async enrich(event) {
    try {
      const channel = event.item.channel;
      const ts = event.item.message?.ts || event.item.ts;
      const messageText = event.item.message?.text || 'Task from Slack';
      const messageLink = `https://slack.com/archives/${channel}/p${ts.replace('.', '')}`;

      console.log(`[Task_Enricher] Enriching: channel=${channel}, ts=${ts}`);
      console.log(`[Task_Enricher] messageText="${messageText}"`);
      console.log(`[Task_Enricher] messageLink=${messageLink}`);

      const enrichedTask = await this.llmAgent.enrich(messageText, messageLink);
      console.log('[Task_Enricher] LLM enrichment done:', JSON.stringify(enrichedTask, null, 2));

      const result = await this.googleTasksClient.createTask(enrichedTask);
      console.log('[Task_Enricher] Google Task created:', result?.id);
      return result;
    } catch (err) {
      Sentry.captureException(err);
      throw err;
    }
  }
}

module.exports = Task_Enricher;
