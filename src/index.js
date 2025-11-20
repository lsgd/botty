import { WhatsAppBot } from './bot.js';
import { config } from './config.js';

// Validate required environment variables
if (!config.openai.apiKey) {
  console.error('❌ ERROR: OPENAI_API_KEY environment variable is required');
  process.exit(1);
}

if (config.auth.authorizedNumbers.length === 0) {
  console.warn('⚠️  WARNING: No authorized numbers configured. Set AUTHORIZED_NUMBERS environment variable.');
  console.warn('⚠️  Example: AUTHORIZED_NUMBERS="+1234567890,+0987654321"');
}

// Create and initialize bot
const bot = new WhatsAppBot();

// Handle shutdown gracefully
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  await bot.destroy();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down...');
  await bot.destroy();
  process.exit(0);
});

// Start bot
bot.initialize().catch((error) => {
  console.error('❌ Failed to initialize bot:', error);
  process.exit(1);
});
