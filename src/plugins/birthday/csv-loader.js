import fs from 'fs-extra';
import { parse } from 'csv-parse/sync';
import { DateTime } from 'luxon';
import { config } from '../../config.js';

export class BirthdayCSVLoader {
  /**
   * Load and validate birthdays from CSV file
   * @param {string} filePath - Path to CSV file
   * @param {Object} client - WhatsApp client for validation
   * @returns {Array} Array of valid birthday entries
   */
  static async load(filePath, client = null) {
    console.log(`[BirthdayCSV] Loading birthdays from ${filePath}`);

    if (!fs.existsSync(filePath)) {
      console.warn(`[BirthdayCSV] File not found: ${filePath}`);
      return [];
    }

    try {
      // Read CSV file
      const fileContent = await fs.readFile(filePath, 'utf-8');

      // Parse CSV
      const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });

      console.log(`[BirthdayCSV] Loaded ${records.length} entries from CSV`);

      // Validate and filter entries
      const validBirthdays = [];
      const errors = [];

      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const lineNumber = i + 2; // +1 for 0-index, +1 for header row

        const validation = await this.validateRecord(record, lineNumber, client);

        if (validation.valid) {
          validBirthdays.push(validation.birthday);
        } else {
          errors.push({ line: lineNumber, errors: validation.errors, record });
        }
      }

      // Print errors
      if (errors.length > 0) {
        console.error(`\n[BirthdayCSV] ❌ Found ${errors.length} invalid entries:\n`);
        errors.forEach(({ line, errors: errs, record }) => {
          console.error(`  Line ${line} (${record.personName || 'unknown'}):`);
          errs.forEach(err => console.error(`    - ${err}`));
        });
        console.error('');
      }

      console.log(`[BirthdayCSV] ✅ Successfully loaded ${validBirthdays.length} valid birthdays`);

      return validBirthdays;
    } catch (error) {
      console.error(`[BirthdayCSV] Error loading CSV:`, error);
      return [];
    }
  }

  /**
   * Validate a single CSV record
   * @param {Object} record - CSV record
   * @param {number} lineNumber - Line number in file
   * @param {Object} client - WhatsApp client
   * @returns {Object} Validation result
   */
  static async validateRecord(record, lineNumber, client) {
    const errors = [];
    const birthday = {
      chatId: record.chatId?.trim(),
      firstName: record.firstName?.trim(),
      lastName: record.lastName?.trim(),
      sex: record.sex?.trim() || 'neutral',
      birthDate: record.birthDate?.trim(),
      language: record.language?.trim() || 'en',
      formality: record.formality?.trim() || 'informal',
      enabled: record.enabled?.trim()?.toLowerCase() !== 'false' // Default to true
    };

    // Skip if disabled
    if (!birthday.enabled) {
      return { valid: false, errors: ['Entry is disabled'] };
    }

    // Validate chatId
    if (!birthday.chatId) {
      errors.push('chatId is required');
    } else {
      // Validate format
      const isGroupChat = birthday.chatId.includes('@g.us');
      const isPrivateChat = birthday.chatId.startsWith('+') || birthday.chatId.includes('@c.us');

      if (!isGroupChat && !isPrivateChat) {
        errors.push(`Invalid chatId format: ${birthday.chatId}. Must be international phone (+491234567890) or group ID (xxx@g.us)`);
      }

      // Validate international format for phone numbers
      if (isPrivateChat && birthday.chatId.startsWith('+')) {
        const phoneRegex = /^\+\d{10,15}$/;
        const cleanNumber = birthday.chatId.replace('@c.us', '');
        if (!phoneRegex.test(cleanNumber)) {
          errors.push(`Invalid phone number format: ${birthday.chatId}. Must be international format like +491707352725`);
        }
      }

      // Optionally validate if chat exists (if client provided)
      if (client && client.info) {
        try {
          // We can't easily validate without making requests, so skip for now
          // In production, you might want to cache known chats
        } catch (e) {
          // Ignore validation errors
        }
      }
    }

    // Validate firstName and lastName
    if (!birthday.firstName) {
      errors.push('firstName is required');
    }
    if (!birthday.lastName) {
      errors.push('lastName is required');
    }

    // Validate sex
    if (!['male', 'female', 'neutral'].includes(birthday.sex)) {
      errors.push(`Invalid sex: ${birthday.sex}. Must be: male, female, or neutral`);
    }

    // Validate birthDate (YYYY-MM-DD format)
    if (!birthday.birthDate) {
      errors.push('birthDate is required');
    } else {
      const dateRegex = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;
      if (!dateRegex.test(birthday.birthDate)) {
        errors.push(`Invalid birthDate format: ${birthday.birthDate}. Must be YYYY-MM-DD (e.g., 1985-03-15)`);
      } else {
        // Validate actual date
        const [year, month, day] = birthday.birthDate.split('-').map(Number);
        const testDate = new Date(year, month - 1, day);
        if (testDate.getMonth() !== month - 1 || testDate.getDate() !== day || testDate.getFullYear() !== year) {
          errors.push(`Invalid date: ${birthday.birthDate} does not exist`);
        }

        // Validate reasonable year range
        const currentYear = new Date().getFullYear();
        if (year < 1900 || year > currentYear) {
          errors.push(`Invalid birth year: ${year}. Must be between 1900 and ${currentYear}`);
        }
      }
    }

    // Validate language
    if (!['en', 'de', 'it'].includes(birthday.language)) {
      errors.push(`Invalid language: ${birthday.language}. Must be: en, de, or it`);
    }

    // Validate formality
    if (!['formal', 'informal'].includes(birthday.formality)) {
      errors.push(`Invalid formality: ${birthday.formality}. Must be: formal or informal`);
    }

    return {
      valid: errors.length === 0,
      errors,
      birthday
    };
  }

  /**
   * Get birthdays for today
   * @param {Array} birthdays - All birthdays
   * @returns {Array} Today's birthdays with age calculated
   */
  static getTodaysBirthdays(birthdays) {
    const now = DateTime.now().setZone(config.scheduler.timezone);
    const todayMMDD = now.toFormat('MM-dd');

    return birthdays
      .filter(b => {
        if (!b.enabled) return false;
        // Extract MM-DD from YYYY-MM-DD
        const birthdayMMDD = b.birthDate.substring(5); // Gets "MM-DD" from "YYYY-MM-DD"
        return birthdayMMDD === todayMMDD;
      })
      .map(b => {
        // Calculate age
        const [birthYear] = b.birthDate.split('-').map(Number);
        const age = now.year - birthYear;
        return { ...b, age };
      });
  }

  /**
   * Calculate age from birthdate
   * @param {string} birthDate - Birth date in YYYY-MM-DD format
   * @returns {number} Age in years
   */
  static calculateAge(birthDate) {
    const [birthYear, birthMonth, birthDay] = birthDate.split('-').map(Number);
    const now = DateTime.now().setZone(config.scheduler.timezone);
    let age = now.year - birthYear;

    const birthdayThisYear = now.set({ month: birthMonth, day: birthDay, hour: 0, minute: 0, second: 0, millisecond: 0 });
    if (now < birthdayThisYear) {
      age -= 1;
    }

    return age;
  }
}
