import { storage } from './storage.js';

/**
 * Response helper for redirecting bot responses to admin chat when configured.
 * Transcription responses bypass this redirection and reply directly.
 */
class ResponseHelper {
    constructor() {
        this.client = null;
    }

    /**
     * Set the WhatsApp client instance
     * @param {Object} client - WhatsApp client
     */
    setClient(client) {
        this.client = client;
    }

    /**
     * Send a response, optionally redirecting to admin chat.
     * 
     * @param {Object} message - The original message being responded to
     * @param {string} text - The response text
     * @param {Object} options - Options
     * @param {boolean} options.isTranscription - If true, bypasses admin chat redirection
     * @returns {Promise<Object>} The sent message
     */
    async reply(message, text, options = {}) {
        const { isTranscription = false } = options;
        const adminChatId = storage.getAdminChatId();

        // If no admin chat configured, or this is a transcription response, reply directly
        if (!adminChatId || isTranscription) {
            return await message.reply(text);
        }

        // Redirect response to admin chat
        if (!this.client) {
            console.warn('[ResponseHelper] Client not set, falling back to direct reply');
            return await message.reply(text);
        }

        try {
            // Get context about the original message for the admin chat
            const chat = await message.getChat();
            const chatName = chat.name || chat.id._serialized;
            const isGroup = chat.isGroup;

            // Build context prefix
            let contextPrefix = '';
            if (isGroup) {
                // Use message.author directly to avoid getContact() compatibility issues
                const senderName = message._data?.notifyName || message.author || 'Unknown';
                contextPrefix = `📍 *From:* ${chatName} (${senderName})\n\n`;
            } else {
                contextPrefix = `📍 *From:* ${chatName}\n\n`;
            }

            // Send to admin chat with context
            const adminChat = await this.client.getChatById(adminChatId);
            return await adminChat.sendMessage(contextPrefix + text);
        } catch (error) {
            console.error('[ResponseHelper] Error sending to admin chat:', error);
            // Fallback to direct reply if admin chat fails
            return await message.reply(text);
        }
    }

    /**
     * Send a message directly to a chat (used for notifications)
     * Respects admin chat redirection.
     * 
     * @param {string} chatId - The target chat ID
     * @param {string} text - The message text
     * @param {Object} options - Options
     * @param {boolean} options.bypassRedirect - If true, sends directly to the specified chat
     * @returns {Promise<Object>} The sent message
     */
    async sendToChat(chatId, text, options = {}) {
        const { bypassRedirect = false } = options;
        const adminChatId = storage.getAdminChatId();

        if (!this.client) {
            throw new Error('[ResponseHelper] Client not set');
        }

        // Determine target chat
        const targetChatId = (!bypassRedirect && adminChatId) ? adminChatId : chatId;

        try {
            const chat = await this.client.getChatById(targetChatId);

            // If redirecting, add context about original target
            if (!bypassRedirect && adminChatId && targetChatId !== chatId) {
                const originalChat = await this.client.getChatById(chatId);
                const chatName = originalChat.name || chatId;
                const contextPrefix = `📍 *Intended for:* ${chatName}\n\n`;
                return await chat.sendMessage(contextPrefix + text);
            }

            return await chat.sendMessage(text);
        } catch (error) {
            console.error('[ResponseHelper] Error sending message:', error);
            throw error;
        }
    }
}

export const responseHelper = new ResponseHelper();
