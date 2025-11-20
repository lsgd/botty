import { pluginManager } from '../plugins/plugin-manager.js';
import { AuthMiddleware } from '../middleware/auth.js';
import { i18n } from '../utils/i18n.js';

export class CommandHandler {
  static async handle(message) {
    const body = message.body.trim();

    // Check if it's a command (starts with !)
    if (!body.startsWith('!')) {
      return false;
    }

    // Parse command and arguments
    const parts = body.slice(1).split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    // Check authorization for all commands
    if (!(await AuthMiddleware.isAuthorized(message))) {
      await AuthMiddleware.sendUnauthorizedMessage(message);
      return true;
    }

    // Handle built-in commands
    if (command === 'help') {
      await this.handleHelp(message);
      return true;
    }

    if (command === 'chatid' || command === 'getid') {
      await this.handleChatId(message);
      return true;
    }

    // Delegate to plugins
    const handled = await pluginManager.handleCommand(command, args, message);

    if (!handled) {
      await message.reply(i18n.t('unknownCommand', command));
    }

    return true;
  }

  static async handleHelp(message) {
    const plugins = pluginManager.getPlugins();
    const commands = pluginManager.getCommands();

    let helpText = i18n.t('helpTitle');
    helpText += i18n.t('helpCommands');
    helpText += i18n.t('helpCommandHelp');
    helpText += i18n.currentLanguage === 'de'
      ? '!chatid - Zeige die aktuelle Chat-ID\n\n'
      : '!chatid - Get the current chat ID\n\n';

    // Group commands by plugin
    const pluginCommands = {};
    for (const cmd of commands) {
      if (!pluginCommands[cmd.plugin]) {
        pluginCommands[cmd.plugin] = [];
      }
      pluginCommands[cmd.plugin].push(cmd);
    }

    // Display each plugin and its commands
    for (const plugin of plugins) {
      helpText += `*${plugin.name}*\n`;
      helpText += `${plugin.description}\n\n`;

      const cmds = pluginCommands[plugin.name] || [];
      for (const cmd of cmds) {
        helpText += `!${cmd.command} - ${cmd.description}\n`;
      }
      helpText += '\n';
    }

    await message.reply(helpText);
  }

  static async handleChatId(message) {
    const chat = await message.getChat();
    const chatId = chat.id._serialized;

    let responseText = i18n.currentLanguage === 'de'
      ? '📋 *Chat ID*\n\n'
      : '📋 *Chat ID*\n\n';

    responseText += `${chatId}`;

    if (chat.isGroup) {
      responseText += `\n\nName: ${chat.name}`;
    }

    await message.reply(responseText);
  }
}
