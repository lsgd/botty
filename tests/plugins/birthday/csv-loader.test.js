import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { BirthdayCSVLoader } from '../../../src/plugins/birthday/csv-loader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const testFixturesPath = path.join(__dirname, '../../fixtures');
const testCSVPath = path.join(testFixturesPath, 'test-birthdays.csv');

describe('BirthdayCSVLoader', () => {
  before(async () => {
    await fs.ensureDir(testFixturesPath);
  });

  after(async () => {
    if (await fs.pathExists(testCSVPath)) {
      await fs.remove(testCSVPath);
    }
  });

  describe('load', () => {
    it('should load valid CSV file', async () => {
      const csvContent = `chatId,firstName,lastName,sex,birthDate,language,formality,fromPlural,fromName,enabled
+1234567890,John,Doe,male,1990-05-15,en,informal,false,TestBot,true
+0987654321,Jane,Smith,female,1985-12-25,de,formal,true,Team,true`;

      await fs.writeFile(testCSVPath, csvContent);

      const birthdays = await BirthdayCSVLoader.load(testCSVPath);

      assert.strictEqual(birthdays.length, 2);
      assert.strictEqual(birthdays[0].firstName, 'John');
      assert.strictEqual(birthdays[0].lastName, 'Doe');
      assert.strictEqual(birthdays[1].firstName, 'Jane');
    });

    it('should return empty array for non-existent file', async () => {
      const birthdays = await BirthdayCSVLoader.load('/non/existent/file.csv');
      assert.deepStrictEqual(birthdays, []);
    });

    it('should skip disabled entries', async () => {
      const csvContent = `chatId,firstName,lastName,sex,birthDate,language,formality,fromPlural,fromName,enabled
+1234567890,John,Doe,male,1990-05-15,en,informal,false,TestBot,true
+0987654321,Jane,Smith,female,1985-12-25,de,formal,true,Team,false`;

      await fs.writeFile(testCSVPath, csvContent);

      const birthdays = await BirthdayCSVLoader.load(testCSVPath);

      assert.strictEqual(birthdays.length, 1);
      assert.strictEqual(birthdays[0].firstName, 'John');
    });
  });

  describe('validateRecord', () => {
    it('should validate correct record', async () => {
      const record = {
        chatId: '+1234567890',
        firstName: 'John',
        lastName: 'Doe',
        sex: 'male',
        birthDate: '1990-05-15',
        language: 'en',
        formality: 'informal',
        fromPlural: 'false',
        fromName: 'TestBot',
        enabled: 'true'
      };

      const result = await BirthdayCSVLoader.validateRecord(record, 2, null);

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
      assert.strictEqual(result.birthday.firstName, 'John');
    });

    it('should reject invalid phone number format', async () => {
      const record = {
        chatId: '1234567890', // Missing +
        firstName: 'John',
        lastName: 'Doe',
        sex: 'male',
        birthDate: '1990-05-15',
        language: 'en',
        formality: 'informal',
        fromPlural: 'false',
        fromName: 'TestBot',
        enabled: 'true'
      };

      const result = await BirthdayCSVLoader.validateRecord(record, 2, null);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('Invalid chatId format')));
    });

    it('should validate group chat IDs', async () => {
      const record = {
        chatId: '120363123456789@g.us',
        firstName: 'John',
        lastName: 'Doe',
        sex: 'male',
        birthDate: '1990-05-15',
        language: 'en',
        formality: 'informal',
        fromPlural: 'false',
        fromName: 'TestBot',
        enabled: 'true'
      };

      const result = await BirthdayCSVLoader.validateRecord(record, 2, null);

      assert.strictEqual(result.valid, true);
    });

    it('should reject invalid birth date format', async () => {
      const record = {
        chatId: '+1234567890',
        firstName: 'John',
        lastName: 'Doe',
        sex: 'male',
        birthDate: '15-05-1990', // Wrong format
        language: 'en',
        formality: 'informal',
        fromPlural: 'false',
        fromName: 'TestBot',
        enabled: 'true'
      };

      const result = await BirthdayCSVLoader.validateRecord(record, 2, null);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('Invalid birthDate format')));
    });

    it('should reject invalid date (e.g., Feb 30)', async () => {
      const record = {
        chatId: '+1234567890',
        firstName: 'John',
        lastName: 'Doe',
        sex: 'male',
        birthDate: '1990-02-30', // Invalid date
        language: 'en',
        formality: 'informal',
        fromPlural: 'false',
        fromName: 'TestBot',
        enabled: 'true'
      };

      const result = await BirthdayCSVLoader.validateRecord(record, 2, null);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('does not exist')));
    });

    it('should reject invalid sex value', async () => {
      const record = {
        chatId: '+1234567890',
        firstName: 'John',
        lastName: 'Doe',
        sex: 'unknown', // Invalid
        birthDate: '1990-05-15',
        language: 'en',
        formality: 'informal',
        fromPlural: 'false',
        fromName: 'TestBot',
        enabled: 'true'
      };

      const result = await BirthdayCSVLoader.validateRecord(record, 2, null);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('Invalid sex')));
    });

    it('should reject invalid language', async () => {
      const record = {
        chatId: '+1234567890',
        firstName: 'John',
        lastName: 'Doe',
        sex: 'male',
        birthDate: '1990-05-15',
        language: 'fr', // Unsupported
        formality: 'informal',
        fromPlural: 'false',
        fromName: 'TestBot',
        enabled: 'true'
      };

      const result = await BirthdayCSVLoader.validateRecord(record, 2, null);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('Invalid language')));
    });

    it('should require firstName and lastName', async () => {
      const record = {
        chatId: '+1234567890',
        firstName: '',
        lastName: '',
        sex: 'male',
        birthDate: '1990-05-15',
        language: 'en',
        formality: 'informal',
        fromPlural: 'false',
        fromName: 'TestBot',
        enabled: 'true'
      };

      const result = await BirthdayCSVLoader.validateRecord(record, 2, null);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('firstName is required')));
      assert.ok(result.errors.some(e => e.includes('lastName is required')));
    });
  });

  describe('getTodaysBirthdays', () => {
    it('should find birthdays matching today', () => {
      const today = new Date();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');

      const birthdays = [
        {
          firstName: 'John',
          lastName: 'Doe',
          birthDate: `1990-${month}-${day}`,
          enabled: true
        },
        {
          firstName: 'Jane',
          lastName: 'Smith',
          birthDate: '1985-01-01',
          enabled: true
        }
      ];

      const todaysBirthdays = BirthdayCSVLoader.getTodaysBirthdays(birthdays);

      assert.strictEqual(todaysBirthdays.length, 1);
      assert.strictEqual(todaysBirthdays[0].firstName, 'John');
      assert.ok('age' in todaysBirthdays[0]);
    });

    it('should calculate age correctly', () => {
      const today = new Date();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const birthYear = today.getFullYear() - 30;

      const birthdays = [
        {
          firstName: 'John',
          lastName: 'Doe',
          birthDate: `${birthYear}-${month}-${day}`,
          enabled: true
        }
      ];

      const todaysBirthdays = BirthdayCSVLoader.getTodaysBirthdays(birthdays);

      assert.strictEqual(todaysBirthdays[0].age, 30);
    });

    it('should skip disabled birthdays', () => {
      const today = new Date();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');

      const birthdays = [
        {
          firstName: 'John',
          lastName: 'Doe',
          birthDate: `1990-${month}-${day}`,
          enabled: false
        }
      ];

      const todaysBirthdays = BirthdayCSVLoader.getTodaysBirthdays(birthdays);

      assert.strictEqual(todaysBirthdays.length, 0);
    });
  });

  describe('calculateAge', () => {
    it('should calculate age correctly for past birthday this year', () => {
      const today = new Date();
      const birthYear = today.getFullYear() - 25;
      const birthMonth = String(1).padStart(2, '0'); // January
      const birthDay = String(1).padStart(2, '0');
      const birthDate = `${birthYear}-${birthMonth}-${birthDay}`;

      const age = BirthdayCSVLoader.calculateAge(birthDate);

      assert.strictEqual(age, 25);
    });

    it('should calculate age correctly for future birthday this year', () => {
      const today = new Date();
      const birthYear = today.getFullYear() - 25;
      const birthMonth = String(12).padStart(2, '0'); // December
      const birthDay = String(31).padStart(2, '0');
      const birthDate = `${birthYear}-${birthMonth}-${birthDay}`;

      const age = BirthdayCSVLoader.calculateAge(birthDate);

      // Age should be 24 if birthday hasn't occurred yet this year
      if (today.getMonth() < 11) { // Before December
        assert.strictEqual(age, 24);
      } else {
        assert.ok(age === 24 || age === 25);
      }
    });
  });
});
