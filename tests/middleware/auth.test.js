import { describe, it, mock } from 'node:test';
import assert from 'node:assert';

describe('AuthMiddleware', () => {
  describe('isAuthorized', () => {
    it('should authorize users in the authorized numbers list', async () => {
      // Mock config with test authorized numbers
      const mockConfig = {
        auth: {
          authorizedNumbers: ['+1234567890', '+0987654321']
        }
      };

      // Create a mock AuthMiddleware with the test config
      const { AuthMiddleware } = await import('../../src/middleware/auth.js');

      // Mock message from authorized number
      const mockMessage = {
        from: '+1234567890@c.us'
      };

      // Temporarily override config
      const originalConfig = (await import('../../src/config.js')).config;
      Object.assign(originalConfig.auth, mockConfig.auth);

      const isAuthorized = AuthMiddleware.isAuthorized(mockMessage);
      assert.strictEqual(isAuthorized, true);
    });

    it('should reject users not in the authorized numbers list', async () => {
      const mockConfig = {
        auth: {
          authorizedNumbers: ['+1234567890']
        }
      };

      const { AuthMiddleware } = await import('../../src/middleware/auth.js');

      const mockMessage = {
        from: '+9999999999@c.us'
      };

      const originalConfig = (await import('../../src/config.js')).config;
      Object.assign(originalConfig.auth, mockConfig.auth);

      const isAuthorized = AuthMiddleware.isAuthorized(mockMessage);
      assert.strictEqual(isAuthorized, false);
    });

    it('should handle numbers with and without @c.us suffix', async () => {
      const mockConfig = {
        auth: {
          authorizedNumbers: ['+1234567890'] // Without @c.us
        }
      };

      const { AuthMiddleware } = await import('../../src/middleware/auth.js');

      const mockMessage = {
        from: '+1234567890@c.us' // With @c.us
      };

      const originalConfig = (await import('../../src/config.js')).config;
      Object.assign(originalConfig.auth, mockConfig.auth);

      const isAuthorized = AuthMiddleware.isAuthorized(mockMessage);
      assert.strictEqual(isAuthorized, true);
    });

    it('should return false when no authorized numbers configured', async () => {
      const mockConfig = {
        auth: {
          authorizedNumbers: []
        }
      };

      const { AuthMiddleware } = await import('../../src/middleware/auth.js');

      const mockMessage = {
        from: '+1234567890@c.us'
      };

      const originalConfig = (await import('../../src/config.js')).config;
      Object.assign(originalConfig.auth, mockConfig.auth);

      const isAuthorized = AuthMiddleware.isAuthorized(mockMessage);
      assert.strictEqual(isAuthorized, false);
    });

    it('should normalize phone numbers correctly', async () => {
      const mockConfig = {
        auth: {
          authorizedNumbers: ['+49-170-735-2725'] // With dashes
        }
      };

      const { AuthMiddleware } = await import('../../src/middleware/auth.js');

      const mockMessage = {
        from: '491707352725@c.us' // Without + and dashes
      };

      const originalConfig = (await import('../../src/config.js')).config;
      Object.assign(originalConfig.auth, mockConfig.auth);

      const isAuthorized = AuthMiddleware.isAuthorized(mockMessage);
      assert.strictEqual(isAuthorized, true);
    });
  });

  describe('sendUnauthorizedMessage', () => {
    it('should send friendly unauthorized message', async () => {
      const { AuthMiddleware } = await import('../../src/middleware/auth.js');
      const { i18n } = await import('../../src/utils/i18n.js');

      let sentMessage = null;
      const mockMessage = {
        reply: mock.fn((msg) => {
          sentMessage = msg;
          return Promise.resolve();
        })
      };

      await AuthMiddleware.sendUnauthorizedMessage(mockMessage);

      assert.ok(mockMessage.reply.mock.calls.length > 0);
      assert.ok(sentMessage.includes('automated bot') || sentMessage.includes('automatisierter Bot'));
    });
  });
});
