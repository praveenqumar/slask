'use strict';

require('dotenv').config();
const LLM_Agent = require('../lib/llm-agent');

async function main() {
  console.log('[test-llm] LLM_API_BASE_URL:', process.env.LLM_API_BASE_URL);
  console.log('[test-llm] LLM_MODEL:', process.env.LLM_MODEL);
  console.log('[test-llm] LLM_API_KEY set:', !!process.env.LLM_API_KEY);

  const agent = new LLM_Agent();
  try {
    const result = await agent.enrich(
      'Fix the login bug by tomorrow EOD',
      'https://slack.com/archives/C12345/p1234567890123456'
    );
    console.log('\n[test-llm] SUCCESS — Enriched task:');
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('\n[test-llm] FAILED:', err.message);
    process.exit(1);
  }
}

main();
