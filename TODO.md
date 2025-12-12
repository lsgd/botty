# NPM Warnings

## Status: Cannot be fully resolved

The npm warnings are caused by **transitive dependencies of whatsapp-web.js**:

| Warning | Source |
|---------|--------|
| `puppeteer@18.2.1` deprecated | whatsapp-web.js |
| `fluent-ffmpeg@2.1.3` deprecated | whatsapp-web.js |
| `inflight`, `rimraf`, `glob`, `fstream` | puppeteer → whatsapp-web.js |
| `node-domexception` | puppeteer → whatsapp-web.js |

### Why we can't fix these:
- whatsapp-web.js pins specific versions of puppeteer for WhatsApp Web compatibility
- Updating puppeteer often breaks whatsapp-web.js functionality
- These are internal dependencies we don't control

### What we've done:
- [x] Updated whatsapp-web.js to latest stable (1.34.2)
- [x] Verified these are transitive dependencies, not direct ones

### Monitoring:
- Watch for whatsapp-web.js updates that address these warnings
- Check: https://github.com/pedroslopez/whatsapp-web.js/releases

---

# Punycode Deprecation

## Status: Cannot be resolved

The `punycode` module warning comes from Node.js internals and third-party packages.

```
(node:31021) [DEP0040] DeprecationWarning: The `punycode` module is deprecated.
```

This is typically triggered by packages that use older URL parsing methods. Since it's a warning (not an error), it doesn't affect functionality.

### Workaround:
To suppress this warning during startup, you can use:
```bash
NODE_OPTIONS='--no-deprecation' npm start
```

But this is **not recommended** as it hides all deprecation warnings.