# NPM Warnings

## Status: Partially resolved

The npm warnings are caused by **transitive dependencies of whatsapp-web.js**:

| Warning | Source | Status |
|---------|--------|--------|
| `puppeteer@18.2.1` deprecated | whatsapp-web.js | Cannot fix |
| `fluent-ffmpeg@2.1.3` deprecated | whatsapp-web.js | Cannot fix |
| `inflight`, `rimraf`, `glob`, `fstream` | puppeteer → whatsapp-web.js | Cannot fix |
| `node-domexception` | puppeteer → whatsapp-web.js | Cannot fix |

### What we've done:
- [x] Updated whatsapp-web.js to latest stable (1.34.2)
- [x] Updated openai to v6 (uses native fetch, removed 31 packages)
- [x] Verified these are transitive dependencies, not direct ones

### Monitoring:
- Watch for whatsapp-web.js updates that address these warnings
- Check: https://github.com/pedroslopez/whatsapp-web.js/releases

---

# Punycode Deprecation

## Status: Partially resolved

The `punycode` module warning comes from `whatwg-url` package used by whatsapp-web.js.

### What we've done:
- [x] Updated openai to v6 (removed one source of punycode warning)
- [ ] Remaining warning from whatsapp-web.js → node-fetch → whatwg-url (cannot fix)

The remaining warning will disappear when whatsapp-web.js updates its dependencies.