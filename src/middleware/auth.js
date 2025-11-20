import { config } from '../config.js';
import { i18n } from '../utils/i18n.js';

export class AuthMiddleware {
  static isAuthorized(message) {
    const authorizedNumbers = config.auth.authorizedNumbers;

    if (authorizedNumbers.length === 0) {
      console.warn('WARNING: No authorized numbers configured. All users will be denied.');
      return false;
    }

    // If the message is from "me" (the bot owner), authorize immediately
    // The bot is logged into one WhatsApp account, so fromMe=true means it's the bot owner
    if (message.id?.fromMe) {
      return true;
    }

    // For messages not from "me", identify the sender
    // In group chats, message.author is the sender's ID
    // In private chats, message.from is the sender's ID
    let senderId = message.author || message.from;

    // Strip device/session ID (everything after colon) from sender ID
    // Example: 491707352725:58@c.us → 491707352725@c.us
    senderId = senderId.replace(/:\d+@/, '@');

    // Check if sender is in authorized list
    // Support both formats: +1234567890 and +1234567890@c.us
    return authorizedNumbers.some(authNumber => {
      const cleanAuth = authNumber.replace('@c.us', '').replace(/\D/g, '');
      const cleanSender = senderId.replace('@c.us', '').replace(/\D/g, '');
      return cleanAuth === cleanSender;
    });
  }

  static async sendUnauthorizedMessage(message) {
    await message.reply(i18n.t('unauthorized'));
  }
}
