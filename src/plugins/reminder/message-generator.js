import OpenAI from 'openai';
import { config } from '../../config.js';
import { i18n } from '../../utils/i18n.js';

const openai = new OpenAI({
  apiKey: config.openai.apiKey
});

export class ReminderMessageGenerator {
  static async generate(reminderText, language = 'en') {
    try {
      const systemPrompt = language === 'de'
        ? 'Du bist ein freundlicher Assistent, der Erinnerungen formuliert. Erstelle eine kurze, freundliche Erinnerungsnachricht (1-2 Sätze). Sei natürlich und hilfsbereit.'
        : 'You are a friendly assistant that formats reminders. Create a short, friendly reminder message (1-2 sentences). Be natural and helpful.';

      const userPrompt = language === 'de'
        ? `Formuliere eine freundliche Erinnerung für: "${reminderText}"`
        : `Format a friendly reminder for: "${reminderText}"`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 100
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('[ReminderMessageGenerator] Error generating message:', error.message);
      // Fallback
      return language === 'de'
        ? `🔔 Erinnerung: ${reminderText}`
        : `🔔 Reminder: ${reminderText}`;
    }
  }
}
