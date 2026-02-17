import OpenAI from 'openai';
import { config } from '../../config.js';
import { logger } from '../../utils/logger.js';

const openai = new OpenAI({ apiKey: config.openai.apiKey });

export class BirthdayMessageGenerator {
  /**
   * Generate a personalized birthday message using GPT-4o
   * @param {Object} birthday - Birthday entry from CSV (with age calculated)
   * @returns {Promise<string>} Personalized birthday message
   */
  static async generate(birthday) {
    const {
      firstName,
      lastName,
      age,
      sex = 'neutral',
      language = 'en',
      formality = 'informal'
    } = birthday;

    try {
      // Build the prompt for GPT-4o
      const prompt = this.buildPrompt({
        firstName,
        lastName,
        age,
        sex,
        language,
        formality
      });

      logger.info('BirthdayMessage', 'Generating message', { firstName, lastName, age });

      // Call GPT-4o
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a creative assistant that generates unique, heartfelt birthday wishes. CRITICAL: Every message must be completely different and original. Vary your opening phrases, sentence structure, and expressions significantly. Keep messages 2-3 short sentences. Be genuine and warm, not overly cheesy or repetitive. IMPORTANT: Use the correct ordinal suffix for ages (1st, 2nd, 3rd, 21st, 22nd, 31st, etc.). Do not use any dashes (-, –, —) in the message. Do NOT add a signature or sign-off.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 1.3, // Maximum creativity for variety
        max_tokens: 150
      });

      const message = response.choices[0].message.content.trim();

      logger.debug('BirthdayMessage', 'Generated message', { firstName, lastName });

      return message;
    } catch (error) {
      logger.errorWithStack('BirthdayMessage', 'Error generating message', error, { firstName, lastName });

      // Fallback: Try again with simpler prompt, or give up
      return this.generateFallbackMessage(birthday);
    }
  }

  /**
   * Build the prompt for GPT-4o
   * @param {Object} params - Message parameters
   * @returns {string} Prompt for GPT
   */
  static buildPrompt({ firstName, lastName, age, sex, language, formality }) {
    let prompt = '';

    // Language instruction
    if (language === 'de') {
      prompt += 'Schreibe eine Geburtstagsnachricht auf Deutsch. ';
    } else if (language === 'it') {
      prompt += 'Scrivi un messaggio di compleanno in italiano. ';
    } else {
      prompt += 'Write a birthday message in English. ';
    }

    // Formality instruction
    if (formality === 'formal') {
      if (language === 'de') {
        prompt += 'Verwende die formelle "Sie"-Form. ';
        if (sex === 'male') {
          prompt += `Sprich die Person als "Herr ${lastName}" an (nur Nachname). `;
        } else if (sex === 'female') {
          prompt += `Sprich die Person als "Frau ${lastName}" an (nur Nachname). `;
        } else {
          prompt += `Verwende nur den Nachnamen: ${lastName}. `;
        }
      } else if (language === 'it') {
        prompt += 'Usa un tono formale con "Lei". ';
        if (sex === 'male') {
          prompt += `Rivolgiti alla persona come "Signor ${lastName}" (solo cognome). `;
        } else if (sex === 'female') {
          prompt += `Rivolgiti alla persona come "Signora ${lastName}" (solo cognome). `;
        } else {
          prompt += `Usa soltanto il cognome: ${lastName}. `;
        }
      } else {
        prompt += 'Use formal language. ';
        if (sex === 'male') {
          prompt += `Address the person as "Mr. ${lastName}" (last name only). `;
        } else if (sex === 'female') {
          prompt += `Address the person as "Ms. ${lastName}" (last name only). `;
        } else {
          prompt += `Use the last name only: ${lastName}. `;
        }
      }
    } else {
      // Informal - use first name only
      if (language === 'de') {
        prompt += 'Verwende die informelle "du"-Form. ';
        prompt += `Verwende nur den Vornamen: ${firstName}. `;
      } else if (language === 'it') {
        prompt += 'Usa un tono informale e amichevole con "tu". ';
        prompt += `Usa solo il nome: ${firstName}. `;
      } else {
        prompt += 'Use informal, friendly language. ';
        prompt += `Use the first name only: ${firstName}. `;
      }
    }

    // Age milestone - let GPT handle ordinals completely
    if (age) {
      const isMilestone = age % 10 === 0 || [18, 21, 25, 30, 40, 50, 60, 70, 80, 90].includes(age);
      if (isMilestone) {
        if (language === 'de') {
          prompt += `Die Person wird ${age} Jahre alt. Dies ist ein besonderer Geburtstag! Erwähne das Alter mit der richtigen Ordnungszahl (z.B. "21." für einundzwanzig). `;
        } else if (language === 'it') {
          prompt += `Compie ${age} anni. È un compleanno speciale! Cita l'età usando l'ordinale corretto (es. "21º"). `;
        } else {
          prompt += `They're turning ${age}. This is a special birthday! Mention the age with the correct ordinal suffix (e.g., "21st" for twenty-one). `;
        }
      } else {
        if (language === 'de') {
          prompt += `Die Person wird ${age} Jahre alt. Verwende die richtige Ordnungszahl (z.B. "21." für einundzwanzig). `;
        } else if (language === 'it') {
          prompt += `Compie ${age} anni. Usa l'ordinale corretto (es. "21º", "22º"). `;
        } else {
          prompt += `They're turning ${age}. Use the correct ordinal suffix (e.g., "21st" for twenty-one, "22nd" for twenty-two, "23rd" for twenty-three). `;
        }
      }
    }

    // Variety instructions
    if (language === 'de') {
      prompt += 'WICHTIG: Sei kreativ und abwechslungsreich! Vermeide typische Formulierungen wie "Alles Gute zu deinem" oder "Ich wünsche dir". Beginne den Satz auf unterschiedliche Weise. ';
    } else if (language === 'it') {
      prompt += 'IMPORTANTE: Sii creativo e varia le frasi! Evita formule standard come "Tanti auguri" o "Ti auguro". Inizia le frasi in modi diversi. ';
    } else {
      prompt += 'IMPORTANT: Be creative and vary your phrasing! Avoid typical phrases like "Happy birthday" or "Wishing you". Start sentences in different ways. ';
    }

    // Final instructions
    if (language === 'de') {
      prompt += 'Halte die Nachricht kurz (2-3 Sätze), herzlich und persönlich. Verwende 1-2 passende Emojis (🎂🎉🎈🎁). WICHTIG: Verwende keine Gedankenstriche oder Bindestriche (–, —, -) in der Nachricht. Füge KEINE Grußformel oder Unterschrift hinzu.';
    } else if (language === 'it') {
      prompt += 'Mantieni il messaggio breve (2-3 frasi), caloroso e personale. Usa 1-2 emoji adatte (🎂🎉🎈🎁). IMPORTANTE: non usare trattini (-, –, —) nel testo. Non aggiungere firme o saluti finali.';
    } else {
      prompt += 'Keep it short (2-3 sentences), warm, and personal. Use 1-2 appropriate emojis (🎂🎉🎈🎁). IMPORTANT: Do not use any dashes (-, –, —) in the message. Do NOT add any signature or sign-off.';
    }

    return prompt;
  }

  /**
   * Generate a simple fallback message if GPT fails
   * Uses GPT with a simpler prompt as fallback, or minimal template if that fails too
   * @param {Object} birthday - Birthday entry
   * @returns {Promise<string>} Fallback message
   */
  static async generateFallbackMessage(birthday) {
    const { firstName, lastName, language, formality } = birthday;

    const name = formality === 'formal' ? lastName : firstName;

    // Try GPT one more time with minimal prompt
    try {
      logger.info('BirthdayMessage', 'Attempting fallback generation', { firstName, lastName });

      let simplePrompt;
      if (language === 'de') {
        simplePrompt = `Schreibe eine kurze Geburtstagsnachricht für ${name} auf Deutsch. Nur 1-2 Sätze. Verwende ein Emoji. Keine Unterschrift.`;
      } else if (language === 'it') {
        simplePrompt = `Scrivi un breve messaggio di compleanno per ${name} in italiano. Solo 1-2 frasi. Usa un emoji. Nessuna firma.`;
      } else {
        simplePrompt = `Write a short birthday message for ${name} in English. Just 1-2 sentences. Use one emoji. No signature.`;
      }

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'user', content: simplePrompt }
        ],
        temperature: 0.7,
        max_tokens: 100
      });

      const message = response.choices[0].message.content.trim();

      return message;
    } catch (fallbackError) {
      // Last resort: return a very simple message without hardcoded age
      logger.errorWithStack('BirthdayMessage', 'Fallback also failed', fallbackError);

      let message;
      if (language === 'de') {
        message = `Alles Gute zum Geburtstag, ${name}! 🎂`;
      } else if (language === 'it') {
        message = `Buon compleanno, ${name}! 🎂`;
      } else {
        message = `Happy Birthday, ${name}! 🎂`;
      }

      return message;
    }
  }
}
