
# [ ] Warnings in npm install 

npm install shows these warnings:
```
npm warn deprecated inflight@1.0.6: This module is not supported, and leaks memory. Do not use it. Check out lru-cache if you want a good and tested way to coalesce async requests by a key value, which is much more comprehensive and powerful.
npm warn deprecated rimraf@2.7.1: Rimraf versions prior to v4 are no longer supported
npm warn deprecated rimraf@3.0.2: Rimraf versions prior to v4 are no longer supported
npm warn deprecated glob@7.2.3: Glob versions prior to v9 are no longer supported
npm warn deprecated fstream@1.0.12: This package is no longer supported.
npm warn deprecated node-domexception@1.0.0: Use your platform's native DOMException instead
npm warn deprecated puppeteer@18.2.1: < 24.15.0 is no longer supported
npm warn deprecated fluent-ffmpeg@2.1.3: Package no longer supported. Contact Support at https://www.npmjs.com/support for more info.

added 163 packages, and audited 164 packages in 15s

14 packages are looking for funding
  run `npm fund` for details

5 high severity vulnerabilities

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details.
```

# [ ] punycode is deprecated

At startup, the following warning is shown:
```
(node:31021) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)

```