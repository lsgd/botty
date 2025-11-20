export class PluginManager {
  constructor() {
    this.plugins = new Map();
  }

  register(plugin) {
    if (!plugin.name) {
      throw new Error('Plugin must have a name');
    }

    if (!plugin.description) {
      throw new Error('Plugin must have a description');
    }

    if (!plugin.commands || !Array.isArray(plugin.commands)) {
      throw new Error('Plugin must have a commands array');
    }

    console.log(`Registering plugin: ${plugin.name}`);
    this.plugins.set(plugin.name, plugin);
  }

  async handleMessage(message) {
    for (const plugin of this.plugins.values()) {
      try {
        if (plugin.shouldHandle && plugin.shouldHandle(message)) {
          await plugin.onMessage(message);
        }
      } catch (error) {
        console.error(`Error in plugin ${plugin.name}:`, error);
      }
    }
  }

  async handleCommand(command, args, message) {
    for (const plugin of this.plugins.values()) {
      const pluginCommand = plugin.commands.find(c => c.command === command);
      if (pluginCommand && plugin.onCommand) {
        try {
          await plugin.onCommand(command, args, message);
          return true;
        } catch (error) {
          console.error(`Error executing command ${command} in plugin ${plugin.name}:`, error);
          throw error;
        }
      }
    }
    return false;
  }

  getPlugins() {
    return Array.from(this.plugins.values());
  }

  getCommands() {
    const commands = [];
    for (const plugin of this.plugins.values()) {
      for (const cmd of plugin.commands) {
        commands.push({
          plugin: plugin.name,
          command: cmd.command,
          description: cmd.description
        });
      }
    }
    return commands;
  }
}

export const pluginManager = new PluginManager();
