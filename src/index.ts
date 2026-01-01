import { TelegramHandler } from './handlers/telegram.handler';

async function main() {
  console.log('Starting Telegram bot...');
  const bot = new TelegramHandler();

  console.log('Telegram bot created successfully.');
  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));

  await bot.launch();

  console.log('Telegram bot is running.');
}

main().catch((error) => {
  console.error('Failed to start bot:', error);
  process.exit(1);
});
