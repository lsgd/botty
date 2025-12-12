import { pluginManager } from '../plugins/plugin-manager.js';
import { config } from '../config.js';
import { storage } from '../utils/storage.js';
import { AuthMiddleware } from '../middleware/auth.js';
import { i18n } from '../utils/i18n.js';
import { responseHelper } from '../utils/response-helper.js';

export class CommandHandler {
  static async handle(message) {
    const body = message.body.trim();

    // Check if it's a command (starts with !)
    if (!body.startsWith('!') && !body.startsWith('! ')) {
      return false;
    }

    // Parse command and arguments
    const parts = body.slice(1).split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    // Check authorization for all commands
    if (!AuthMiddleware.isAuthorized(message)) {
      if (!config.auth.silenceUnauthorized) {
        await AuthMiddleware.sendUnauthorizedMessage(message);
      }
      return true;
    }

    // Handle built-in commands
    if (command === 'help') {
      await this.handleHelp(message);
      return true;
    }

    if (command === 'plugins') {
      await this.handlePlugins(message, args);
      return true;
    }

    if (command === 'chatid' || command === 'getid') {
      await this.handleChatId(message);
      return true;
    }

    if (command === 'admin') {
      await this.handleAdmin(message, args);
      return true;
    }

    // Delegate to plugins
    const handled = await pluginManager.handleCommand(command, args, message);

    if (!handled) {
      await responseHelper.reply(message, i18n.t('unknownCommand', command));
    }

    return true;
  }

  static async handleHelp(message) {
    const plugins = pluginManager.getEnabledPlugins();
    const commands = pluginManager.getCommands();

    let helpText = i18n.t('helpTitle');
    helpText += i18n.t('helpCommands');
    helpText += i18n.t('helpCommandHelp');
    helpText += i18n.t('helpChatId');
    helpText += i18n.t('helpPlugins');
    helpText += i18n.t('helpAdmin');

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

    await responseHelper.reply(message, helpText);
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

    await responseHelper.reply(message, responseText);
  }

  static async handleAdmin(message, args) {
    const chat = await message.getChat();
    const chatId = chat.id._serialized;

    if (args.length === 0) {
      // Show current admin chat status
      const adminChatId = storage.getAdminChatId();
      await responseHelper.reply(message, i18n.t('adminChatStatus', adminChatId));
      return;
    }

    const subCommand = args[0].toLowerCase();

    if (subCommand === 'set') {
      storage.setAdminChatId(chatId);
      // Reply directly (not through helper) since this sets up the admin chat
      await message.reply(i18n.t('adminChatSet'));
      return;
    }

    if (subCommand === 'clear') {
      storage.clearAdminChatId();
      // Reply directly since admin chat is being removed
      await message.reply(i18n.t('adminChatCleared'));
      return;
    }

    await responseHelper.reply(message, i18n.t('adminChatUsage'));
  }

  static async handlePlugins(message, args) {
    const plugins = pluginManager.getPlugins();

    // sorting plugins alphabetically for consistent numbering
    plugins.sort((a, b) => a.name.localeCompare(b.name));

    if (args.length === 0) {
      let menu = '🧩 *Plugin Manager*\n\n';

      plugins.forEach((plugin, index) => {
        const isEnabled = plugin.isEnabled;
        menu += `${index + 1}. ${plugin.name}: ${isEnabled ? '✅ ON' : '❌ OFF'}\n`;
      });

      menu += '\nTo toggle, use: `!plugins <numbers>`\n';
      menu += 'Examples: `!plugins 1`, `!plugins 1,3`, `!plugins all off`';

      await responseHelper.reply(message, menu);
      return;
    }

    const command = args.join(' ').toLowerCase();

    // Handle "all on" / "on"
    if (command === 'on' || command === 'all on') {
      let count = 0;
      for (const plugin of plugins) {
        if (!storage.isPluginEnabled(plugin.name)) {
          storage.setPluginEnabled(plugin.name, true);
          count++;
        }
      }
      await responseHelper.reply(message, `✅ Enabled all ${count} disabled plugins.`);
      return;
    }

    // Handle "all off" / "off"
    if (command === 'off' || command === 'all off') {
      let count = 0;
      for (const plugin of plugins) {
        if (storage.isPluginEnabled(plugin.name)) {
          storage.setPluginEnabled(plugin.name, false);
          count++;
        }
      }
      await responseHelper.reply(message, `❌ Disabled all ${count} active plugins.`);
      return;
    }

    // Handle numbers
    const indices = command.split(/[\s,]+/).map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));

    if (indices.length === 0) {
      await responseHelper.reply(message, '❌ Invalid format. Use numbers to toggle plugins (e.g., `!plugins 1 3`).');
      return;
    }

    const updates = [];
    for (const index of indices) {
      if (index < 1 || index > plugins.length) {
        continue;
      }
      const plugin = plugins[index - 1];
      const newState = !storage.isPluginEnabled(plugin.name);
      storage.setPluginEnabled(plugin.name, newState);
      updates.push(`${plugin.name}: ${newState ? 'ON' : 'OFF'}`);
    }

    if (updates.length > 0) {
      await responseHelper.reply(message, `Updated:\n${updates.join('\n')}`);
    } else {
      await responseHelper.reply(message, '❌ No valid plugin numbers found.');
    }
  }
}
