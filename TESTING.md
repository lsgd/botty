# Testing Documentation

This document describes the testing approach, test structure, and how to run tests for the WhatsApp Bot project.

## Overview

The project uses **Node.js built-in test runner** (available in Node 24+) for all testing. No external testing frameworks are required.

### Test Coverage

The test suite covers:
- ✅ **Utilities** - i18n translations, storage persistence
- ✅ **Middleware** - Authorization logic
- ✅ **Plugin System** - Plugin manager, command routing
- ✅ **Birthday Plugin** - CSV validation, message tracking, age calculations
- ✅ **Transcription Plugin** - Message tracking, race condition handling

## Running Tests

### All Tests
```bash
npm test
```

### Watch Mode (Auto-rerun on file changes)
```bash
npm run test:watch
```

### With Coverage (Experimental)
```bash
npm run test:coverage
```

### Individual Test File
```bash
node --test tests/utils/i18n.test.js
```

## Test Structure

```
tests/
├── fixtures/                         # Test data and mock files
│   └── test-birthdays.csv           # Sample CSV for birthday tests
├── utils/
│   ├── i18n.test.js                 # Translation system tests
│   └── storage.test.js              # Settings persistence tests
├── middleware/
│   └── auth.test.js                 # Authorization tests
├── commands/
│   └── command-handler.test.js      # Command routing tests (if created)
├── plugins/
│   ├── plugin-manager.test.js       # Plugin system tests
│   ├── birthday/
│   │   ├── csv-loader.test.js       # CSV validation and parsing
│   │   └── message-tracker.test.js  # Daily message tracking
│   └── transcription/
│       └── message-tracker.test.js  # Transcription race conditions
```

## Test Categories

### 1. Utility Tests

#### i18n.test.js
Tests the internationalization system:
- Language switching (EN/DE)
- Simple string translations
- Function-based translations with parameters
- Fallback to English for unsupported languages
- Plugin-specific translations

**Example:**
```javascript
import { i18n } from '../../src/utils/i18n.js';

i18n.setLanguage('de');
const message = i18n.t('botReady');
// Returns: "✅ WhatsApp Bot ist bereit!"
```

#### storage.test.js
Tests the settings persistence system:
- Global transcription settings
- Per-chat transcription settings
- Setting priority (chat-specific overrides global)
- Data persistence across save/load cycles

**Key Tests:**
- Verify chat-specific settings override global
- Ensure settings persist to JSON file
- Handle missing or corrupted config files

### 2. Middleware Tests

#### auth.test.js
Tests the authorization system:
- Authorized user validation
- Unauthorized user rejection
- Phone number normalization (with/without +, @c.us)
- Empty authorized list handling
- Friendly unauthorized messages

**Important Cases:**
- Numbers with dashes: `+49-170-735-2725`
- Numbers without country code prefix: `491707352725@c.us`
- Numbers with @c.us vs without

### 3. Plugin System Tests

#### plugin-manager.test.js
Tests the plugin registration and routing:
- Plugin registration validation
- Command registration from multiple plugins
- Message handling delegation
- Command execution routing
- Error isolation between plugins

**Key Behaviors:**
- Plugins must have: name, description, commands array
- Plugin errors don't crash other plugins
- First matching plugin handles command

### 4. Birthday Plugin Tests

#### csv-loader.test.js
**Comprehensive CSV validation tests:**

**Valid Record Tests:**
- Correct phone number format (`+1234567890`)
- Group chat IDs (`120363123456789@g.us`)
- Date format validation (`YYYY-MM-DD`)
- Required fields (firstName, lastName, sex, etc.)

**Invalid Record Tests:**
- Missing `+` in phone number
- Invalid date format (`DD-MM-YYYY`, `15-05`)
- Invalid dates (Feb 30, etc.)
- Invalid sex values (only male/female/neutral allowed)
- Unsupported languages (only en/de allowed)
- Missing required fields

**Birthday Matching:**
- `getTodaysBirthdays()` - Finds birthdays matching today's date
- Age calculation from birth year
- Disabled entry filtering

**Example:**
```javascript
const birthdays = [
  { birthDate: '1990-11-18', enabled: true }
];
const today = BirthdayCSVLoader.getTodaysBirthdays(birthdays);
// Returns array with age calculated
```

#### message-tracker.test.js (Birthday)
Tests daily message tracking:
- Recording messages from authorized users
- Filtering unauthorized users
- Per-chat message tracking
- Daily reset logic
- Cleanup of old messages (7-day retention)

**Purpose:**
Prevents birthday wishes from being sent if an authorized user already messaged in that chat today.

### 5. Transcription Plugin Tests

#### message-tracker.test.js (Transcription)
Tests race condition handling:
- Tracking pending transcriptions
- Marking completed transcriptions
- Preventing duplicate transcriptions
- Handling multiple simultaneous transcriptions

**Race Condition Example:**
1. Long voice message (2 min) starts transcribing
2. Short voice message (5 sec) arrives 20 seconds later
3. Short transcription finishes first
4. Both are correctly tracked and replied to their original messages

## Writing New Tests

### Test File Template

```javascript
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';

describe('MyComponent', () => {
  let component;

  before(() => {
    // Setup before all tests
  });

  after(() => {
    // Cleanup after all tests
  });

  describe('myMethod', () => {
    it('should do something expected', () => {
      const result = component.myMethod();
      assert.strictEqual(result, expectedValue);
    });

    it('should handle edge case', () => {
      const result = component.myMethod(edgeCase);
      assert.ok(result);
    });
  });
});
```

### Assertion Methods

Common assertions from Node's `assert` module:

```javascript
assert.strictEqual(actual, expected);        // Strict equality (===)
assert.deepStrictEqual(obj1, obj2);         // Deep object comparison
assert.ok(value);                           // Truthy check
assert.throws(() => fn(), /error message/); // Function throws error
assert.rejects(promise, /error/);           // Promise rejects
```

### Mocking

For mocking (when needed):

```javascript
import { mock } from 'node:test';

const mockFn = mock.fn(() => 'mocked result');
mockFn('arg1', 'arg2');

console.log(mockFn.mock.calls.length);      // 1
console.log(mockFn.mock.calls[0].arguments); // ['arg1', 'arg2']
```

## Test Best Practices

### 1. Test Isolation
- Each test should be independent
- Use `beforeEach` to reset state
- Don't rely on test execution order

### 2. Descriptive Names
```javascript
// Good
it('should reject invalid phone number format', () => {});

// Bad
it('test1', () => {});
```

### 3. AAA Pattern
- **Arrange**: Set up test data
- **Act**: Execute the function being tested
- **Assert**: Verify the result

```javascript
it('should calculate age correctly', () => {
  // Arrange
  const birthDate = '1990-05-15';

  // Act
  const age = calculateAge(birthDate);

  // Assert
  assert.strictEqual(age, 35); // Assuming current year is 2025
});
```

### 4. Test Edge Cases
- Null/undefined inputs
- Empty arrays/strings
- Boundary values
- Error conditions

### 5. Don't Test Implementation Details
Test behavior, not internal implementation:

```javascript
// Good - tests behavior
it('should find today\'s birthdays', () => {
  const result = getTodaysBirthdays(birthdays);
  assert.strictEqual(result.length, 2);
});

// Bad - tests implementation
it('should loop through array and compare dates', () => {
  // Don't test how it works internally
});
```

## Continuous Integration

### GitHub Actions (Example)

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '24'
      - run: npm install
      - run: npm test
```

## Test Data Management

### Fixtures
Test data files are stored in `tests/fixtures/`:
- `test-birthdays.csv` - Sample birthday CSV for testing
- `test-config.json` - Test configuration file

### Cleanup
Always clean up test data in `after()` or `afterEach()`:

```javascript
import fs from 'fs-extra';

after(async () => {
  if (await fs.pathExists(testFilePath)) {
    await fs.remove(testFilePath);
  }
});
```

## Debugging Tests

### Run Specific Test
```bash
node --test tests/plugins/birthday/csv-loader.test.js
```

### Add Debug Output
```javascript
it('should validate record', () => {
  const result = validateRecord(record);
  console.log('Validation result:', result); // Debug output
  assert.strictEqual(result.valid, true);
});
```

### Use Node Inspector
```bash
node --inspect --test tests/utils/i18n.test.js
```

Then open `chrome://inspect` in Chrome.

## Coverage Goals

Target coverage levels:
- **Utilities**: 90%+
- **Middleware**: 85%+
- **Core Logic**: 85%+
- **Plugins**: 80%+

*Note: Coverage reporting is experimental in Node.js test runner*

## Common Issues

### 1. Module Import Errors
**Problem**: `Cannot find module`
**Solution**: Ensure relative paths are correct and use `.js` extension

### 2. Async Test Timeouts
**Problem**: Test hangs indefinitely
**Solution**: Always return/await promises in async tests

### 3. Test Pollution
**Problem**: Tests pass individually but fail together
**Solution**: Ensure proper cleanup in `after()` hooks

### 4. Config Mocking
**Problem**: Tests affect global config
**Solution**: Save/restore config in `before()`/`after()`

```javascript
let originalConfig;

before(() => {
  originalConfig = { ...config };
});

after(() => {
  Object.assign(config, originalConfig);
});
```

## Future Improvements

- [ ] Add integration tests with WhatsApp Web client mocks
- [ ] Add end-to-end tests for complete workflows
- [ ] Increase coverage to 90%+
- [ ] Add performance benchmarks
- [ ] Add visual regression tests (if UI is added)
- [ ] Implement mutation testing

## Resources

- [Node.js Test Runner Docs](https://nodejs.org/api/test.html)
- [Node.js Assert Module](https://nodejs.org/api/assert.html)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

## Questions?

If you have questions about testing or need help writing tests:
1. Check this documentation
2. Look at existing test files for examples
3. Review the test runner documentation
4. Ask in project discussions
