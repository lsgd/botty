import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { PluginManager } from '../../src/plugins/plugin-manager.js';

describe('PluginManager', () => {
  let pluginManager;

  beforeEach(() => {
    pluginManager = new PluginManager();
  });

  describe('register', () => {
    it('should register a valid plugin', () => {
      const mockPlugin = {
        name: 'Test Plugin',
        description: 'A test plugin',
        commands: [
          { command: 'test', description: 'Test command' }
        ]
      };

      pluginManager.register(mockPlugin);
      const plugins = pluginManager.getPlugins();

      assert.strictEqual(plugins.length, 1);
      assert.strictEqual(plugins[0].name, 'Test Plugin');
    });

    it('should throw error if plugin has no name', () => {
      const mockPlugin = {
        description: 'A test plugin',
        commands: []
      };

      assert.throws(() => {
        pluginManager.register(mockPlugin);
      }, /Plugin must have a name/);
    });

    it('should throw error if plugin has no description', () => {
      const mockPlugin = {
        name: 'Test Plugin',
        commands: []
      };

      assert.throws(() => {
        pluginManager.register(mockPlugin);
      }, /Plugin must have a description/);
    });

    it('should throw error if plugin has no commands array', () => {
      const mockPlugin = {
        name: 'Test Plugin',
        description: 'A test plugin'
      };

      assert.throws(() => {
        pluginManager.register(mockPlugin);
      }, /Plugin must have a commands array/);
    });

    it('should allow multiple plugins to be registered', () => {
      const plugin1 = {
        name: 'Plugin 1',
        description: 'First plugin',
        commands: [{ command: 'cmd1', description: 'Command 1' }]
      };

      const plugin2 = {
        name: 'Plugin 2',
        description: 'Second plugin',
        commands: [{ command: 'cmd2', description: 'Command 2' }]
      };

      pluginManager.register(plugin1);
      pluginManager.register(plugin2);

      const plugins = pluginManager.getPlugins();
      assert.strictEqual(plugins.length, 2);
    });
  });

  describe('getCommands', () => {
    it('should return all commands from all plugins', () => {
      const plugin1 = {
        name: 'Plugin 1',
        description: 'First plugin',
        commands: [
          { command: 'cmd1', description: 'Command 1' },
          { command: 'cmd2', description: 'Command 2' }
        ]
      };

      const plugin2 = {
        name: 'Plugin 2',
        description: 'Second plugin',
        commands: [
          { command: 'cmd3', description: 'Command 3' }
        ]
      };

      pluginManager.register(plugin1);
      pluginManager.register(plugin2);

      const commands = pluginManager.getCommands();

      assert.strictEqual(commands.length, 3);
      assert.ok(commands.some(c => c.command === 'cmd1' && c.plugin === 'Plugin 1'));
      assert.ok(commands.some(c => c.command === 'cmd2' && c.plugin === 'Plugin 1'));
      assert.ok(commands.some(c => c.command === 'cmd3' && c.plugin === 'Plugin 2'));
    });

    it('should return empty array when no plugins registered', () => {
      const commands = pluginManager.getCommands();
      assert.deepStrictEqual(commands, []);
    });
  });

  describe('handleMessage', () => {
    it('should call plugin onMessage if shouldHandle returns true', async () => {
      let onMessageCalled = false;

      const mockPlugin = {
        name: 'Test Plugin',
        description: 'A test plugin',
        commands: [],
        shouldHandle: (message) => message.type === 'test',
        onMessage: async (message) => {
          onMessageCalled = true;
        }
      };

      pluginManager.register(mockPlugin);

      const mockMessage = { type: 'test' };
      await pluginManager.handleMessage(mockMessage);

      assert.strictEqual(onMessageCalled, true);
    });

    it('should not call plugin onMessage if shouldHandle returns false', async () => {
      let onMessageCalled = false;

      const mockPlugin = {
        name: 'Test Plugin',
        description: 'A test plugin',
        commands: [],
        shouldHandle: (message) => message.type === 'specific-type',
        onMessage: async (message) => {
          onMessageCalled = true;
        }
      };

      pluginManager.register(mockPlugin);

      const mockMessage = { type: 'other-type' };
      await pluginManager.handleMessage(mockMessage);

      assert.strictEqual(onMessageCalled, false);
    });

    it('should handle multiple plugins', async () => {
      let plugin1Called = false;
      let plugin2Called = false;

      const plugin1 = {
        name: 'Plugin 1',
        description: 'First plugin',
        commands: [],
        shouldHandle: () => true,
        onMessage: async () => { plugin1Called = true; }
      };

      const plugin2 = {
        name: 'Plugin 2',
        description: 'Second plugin',
        commands: [],
        shouldHandle: () => true,
        onMessage: async () => { plugin2Called = true; }
      };

      pluginManager.register(plugin1);
      pluginManager.register(plugin2);

      await pluginManager.handleMessage({});

      assert.strictEqual(plugin1Called, true);
      assert.strictEqual(plugin2Called, true);
    });

    it('should continue processing other plugins if one throws an error', async () => {
      let plugin2Called = false;

      const plugin1 = {
        name: 'Plugin 1',
        description: 'First plugin',
        commands: [],
        shouldHandle: () => true,
        onMessage: async () => { throw new Error('Plugin 1 error'); }
      };

      const plugin2 = {
        name: 'Plugin 2',
        description: 'Second plugin',
        commands: [],
        shouldHandle: () => true,
        onMessage: async () => { plugin2Called = true; }
      };

      pluginManager.register(plugin1);
      pluginManager.register(plugin2);

      await pluginManager.handleMessage({});

      assert.strictEqual(plugin2Called, true);
    });
  });

  describe('handleCommand', () => {
    it('should execute command in matching plugin', async () => {
      let commandExecuted = false;
      const commandArgs = [];

      const mockPlugin = {
        name: 'Test Plugin',
        description: 'A test plugin',
        commands: [{ command: 'test', description: 'Test command' }],
        onCommand: async (command, args, message) => {
          commandExecuted = true;
          commandArgs.push(...args);
        }
      };

      pluginManager.register(mockPlugin);

      const result = await pluginManager.handleCommand('test', ['arg1', 'arg2'], {});

      assert.strictEqual(result, true);
      assert.strictEqual(commandExecuted, true);
      assert.deepStrictEqual(commandArgs, ['arg1', 'arg2']);
    });

    it('should return false if no plugin handles command', async () => {
      const mockPlugin = {
        name: 'Test Plugin',
        description: 'A test plugin',
        commands: [{ command: 'test', description: 'Test command' }],
        onCommand: async () => {}
      };

      pluginManager.register(mockPlugin);

      const result = await pluginManager.handleCommand('unknown', [], {});

      assert.strictEqual(result, false);
    });

    it('should handle command from first matching plugin only', async () => {
      let plugin1Executed = false;
      let plugin2Executed = false;

      const plugin1 = {
        name: 'Plugin 1',
        description: 'First plugin',
        commands: [{ command: 'test', description: 'Test command' }],
        onCommand: async () => { plugin1Executed = true; }
      };

      const plugin2 = {
        name: 'Plugin 2',
        description: 'Second plugin',
        commands: [{ command: 'test', description: 'Test command' }],
        onCommand: async () => { plugin2Executed = true; }
      };

      pluginManager.register(plugin1);
      pluginManager.register(plugin2);

      await pluginManager.handleCommand('test', [], {});

      assert.strictEqual(plugin1Executed, true);
      assert.strictEqual(plugin2Executed, false);
    });
  });
});
