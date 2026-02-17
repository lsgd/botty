import { logger } from './logger.js';

const translations = {
  en: {
    // Bot info
    botReady: '✅ WhatsApp Bot is ready!',
    authenticated: '✅ Authenticated successfully!',
    disconnected: '❌ WhatsApp Bot disconnected',
    authFailure: '❌ Authentication failed',

    // Authorization
    unauthorized: '👋 Hello! Thanks for reaching out.\n\n' +
      'This is an automated bot that assists with various tasks. ' +
      'However, access is currently restricted to authorized users only.\n\n' +
      'Have a great day!',

    // Commands
    unknownCommand: (cmd) => `❌ Unknown command: !${cmd}\n\nType !help to see available commands.`,

    // Help command
    helpTitle: '🤖 *Bot Help*\n\n',
    helpCommands: '*Available Commands:*\n',
    helpCommandHelp: '!help - Show this help message\n',
    helpChatId: '!chatid - Get the current chat ID\n',
    helpPlugins: '!plugins - Manage plugins (On/Off)\n',
    helpAdmin: '!admin - Admin chat settings\n\n',

    // Transcription plugin
    transcriptionPluginName: 'Voice Transcription',
    transcriptionPluginDesc: 'Automatically transcribe voice messages using GPT-4o',

    // Transcription commands
    cmdTranscribe: 't',
    cmdTranscribeDesc: 'Manually transcribe a quoted voice message',
    cmdTranscription: 'transcription',
    cmdTranscriptionDesc: 'Control automatic transcription (on/off/global on/global off)',

    // Transcription messages
    transcriptionResult: (text) => `🎤 *Transcription:*\n\n${text}`,
    transcriptionFailed: '❌ *Transcription failed*\n\n' +
      'Sorry, I couldn\'t transcribe this voice message. ',
    transcriptionTimeout: 'The message was too long to process.',
    transcriptionRetry: 'Please try again later.',

    // Manual transcription
    quoteVoiceMessage: '❌ Please quote a voice message to transcribe it.\n\nUsage: Reply to a voice message with !t',
    notVoiceMessage: '❌ The quoted message is not a voice message.',
    downloadFailed: '❌ Failed to download voice message.',
    transcribeFailed: '❌ Failed to transcribe voice message. Please try again.',

    // Settings
    settingsTitle: '⚙️ *Transcription Settings*\n\n',
    settingsGlobal: (enabled) => `Global: ${enabled ? '✅ Enabled' : '❌ Disabled'}\n`,
    settingsChat: (specific) => `This chat: ${specific === undefined ? '(using global)' : (specific ? '✅ Enabled' : '❌ Disabled')}\n`,
    settingsCurrent: (enabled) => `\nCurrent status: ${enabled ? '✅ Active' : '❌ Inactive'}\n\n`,
    settingsUsage: '*Usage:*\n' +
      '!transcription on - Enable for this chat\n' +
      '!transcription off - Disable for this chat\n' +
      '!transcription global on - Enable globally\n' +
      '!transcription global off - Disable globally',
    settingsUsageError: '❌ Usage: !transcription global <on|off>',
    settingsInvalidOption: '❌ Usage: !transcription <on|off|global on|global off>',

    // Settings confirmations
    globalEnabled: '✅ Global automatic transcription enabled for all chats.',
    globalDisabled: '❌ Global automatic transcription disabled for all chats.',
    chatEnabled: '✅ Automatic transcription enabled for this chat.',
    chatDisabled: '❌ Automatic transcription disabled for this chat.',

    // Admin chat
    adminChatStatus: (chatId) => chatId
      ? `🔧 *Admin Chat*\n\nCurrent admin chat: ${chatId}\n\nAll bot responses (except transcriptions) are redirected here.`
      : '🔧 *Admin Chat*\n\nNo admin chat configured.\nBot responses appear in the same chat as commands.',
    adminChatSet: '✅ This chat is now the admin chat.\n\nAll bot responses (except transcriptions) will be sent here.',
    adminChatCleared: '✅ Admin chat cleared.\n\nBot responses will now appear in the same chat as commands.',
    adminChatUsage: '❌ Usage:\n!admin - Show current admin chat\n!admin set - Set this chat as admin chat\n!admin clear - Remove admin chat restriction',
  },

  de: {
    // Bot info
    botReady: '✅ WhatsApp Bot ist bereit!',
    authenticated: '✅ Erfolgreich authentifiziert!',
    disconnected: '❌ WhatsApp Bot getrennt',
    authFailure: '❌ Authentifizierung fehlgeschlagen',

    // Authorization
    unauthorized: '👋 Hallo! Danke für deine Nachricht.\n\n' +
      'Dies ist ein automatisierter Bot, der bei verschiedenen Aufgaben hilft. ' +
      'Der Zugriff ist jedoch derzeit nur für autorisierte Benutzer möglich.\n\n' +
      'Einen schönen Tag noch!',

    // Commands
    unknownCommand: (cmd) => `❌ Unbekannter Befehl: !${cmd}\n\nGib !help ein, um verfügbare Befehle zu sehen.`,

    // Help command
    helpTitle: '🤖 *Bot Hilfe*\n\n',
    helpCommands: '*Verfügbare Befehle:*\n',
    helpCommandHelp: '!help - Diese Hilfenachricht anzeigen\n',
    helpChatId: '!chatid - Zeige die aktuelle Chat-ID\n',
    helpPlugins: '!plugins - Verwalte Plugins (An/Aus)\n',
    helpAdmin: '!admin - Admin-Chat Einstellungen\n\n',

    // Transcription plugin
    transcriptionPluginName: 'Sprachnachrichten-Transkription',
    transcriptionPluginDesc: 'Automatische Transkription von Sprachnachrichten mit GPT-4o',

    // Transcription commands
    cmdTranscribe: 't',
    cmdTranscribeDesc: 'Eine zitierte Sprachnachricht manuell transkribieren',
    cmdTranscription: 'transcription',
    cmdTranscriptionDesc: 'Automatische Transkription steuern (on/off/global on/global off)',

    // Transcription messages
    transcriptionResult: (text) => `🎤 *Transkription:*\n\n${text}`,
    transcriptionFailed: '❌ *Transkription fehlgeschlagen*\n\n' +
      'Entschuldigung, diese Sprachnachricht konnte nicht transkribiert werden. ',
    transcriptionTimeout: 'Die Nachricht ist zu lang zum Verarbeiten.',
    transcriptionRetry: 'Bitte versuche es später erneut.',

    // Manual transcription
    quoteVoiceMessage: '❌ Bitte zitiere eine Sprachnachricht, um sie zu transkribieren.\n\nVerwendung: Antworte auf eine Sprachnachricht mit !t',
    notVoiceMessage: '❌ Die zitierte Nachricht ist keine Sprachnachricht.',
    downloadFailed: '❌ Sprachnachricht konnte nicht heruntergeladen werden.',
    transcribeFailed: '❌ Sprachnachricht konnte nicht transkribiert werden. Bitte versuche es erneut.',

    // Settings
    settingsTitle: '⚙️ *Transkriptions-Einstellungen*\n\n',
    settingsGlobal: (enabled) => `Global: ${enabled ? '✅ Aktiviert' : '❌ Deaktiviert'}\n`,
    settingsChat: (specific) => `Dieser Chat: ${specific === undefined ? '(nutzt globale Einstellung)' : (specific ? '✅ Aktiviert' : '❌ Deaktiviert')}\n`,
    settingsCurrent: (enabled) => `\nAktueller Status: ${enabled ? '✅ Aktiv' : '❌ Inaktiv'}\n\n`,
    settingsUsage: '*Verwendung:*\n' +
      '!transcription on - Für diesen Chat aktivieren\n' +
      '!transcription off - Für diesen Chat deaktivieren\n' +
      '!transcription global on - Global aktivieren\n' +
      '!transcription global off - Global deaktivieren',
    settingsUsageError: '❌ Verwendung: !transcription global <on|off>',
    settingsInvalidOption: '❌ Verwendung: !transcription <on|off|global on|global off>',

    // Settings confirmations
    globalEnabled: '✅ Globale automatische Transkription für alle Chats aktiviert.',
    globalDisabled: '❌ Globale automatische Transkription für alle Chats deaktiviert.',
    chatEnabled: '✅ Automatische Transkription für diesen Chat aktiviert.',
    chatDisabled: '❌ Automatische Transkription für diesen Chat deaktiviert.',

    // Admin chat
    adminChatStatus: (chatId) => chatId
      ? `🔧 *Admin-Chat*\n\nAktueller Admin-Chat: ${chatId}\n\nAlle Bot-Antworten (außer Transkriptionen) werden hierher umgeleitet.`
      : '🔧 *Admin-Chat*\n\nKein Admin-Chat konfiguriert.\nBot-Antworten erscheinen im selben Chat wie die Befehle.',
    adminChatSet: '✅ Dieser Chat ist jetzt der Admin-Chat.\n\nAlle Bot-Antworten (außer Transkriptionen) werden hierher gesendet.',
    adminChatCleared: '✅ Admin-Chat entfernt.\n\nBot-Antworten erscheinen jetzt im selben Chat wie die Befehle.',
    adminChatUsage: '❌ Verwendung:\n!admin - Zeige aktuellen Admin-Chat\n!admin set - Diesen Chat als Admin-Chat setzen\n!admin clear - Admin-Chat-Einschränkung entfernen',
  },

  it: {
    // Bot info
    botReady: '✅ Il bot WhatsApp è pronto!',
    authenticated: '✅ Autenticazione riuscita!',
    disconnected: '❌ Il bot WhatsApp si è disconnesso',
    authFailure: '❌ Autenticazione non riuscita',

    // Authorization
    unauthorized: '👋 Ciao! Grazie per il tuo messaggio.\n\n' +
      'Questo è un bot automatico che aiuta con varie attività, ' +
      'ma l\'accesso è riservato agli utenti autorizzati.\n\n' +
      'Buona giornata!',

    // Commands
    unknownCommand: (cmd) => `❌ Comando sconosciuto: !${cmd}\n\nScrivi !help per vedere tutti i comandi disponibili.`,

    // Help command
    helpTitle: '🤖 *Guida del Bot*\n\n',
    helpCommands: '*Comandi disponibili:*\n',
    helpCommandHelp: '!help - Mostra questo messaggio di aiuto\n',
    helpChatId: '!chatid - Mostra l\'ID della chat\n',
    helpPlugins: '!plugins - Gestisci i plugin (On/Off)\n',
    helpAdmin: '!admin - Impostazioni chat admin\n\n',

    // Transcription plugin
    transcriptionPluginName: 'Trascrizione vocale',
    transcriptionPluginDesc: 'Trascrive automaticamente i messaggi vocali con GPT-4o',

    // Transcription commands
    cmdTranscribe: 't',
    cmdTranscribeDesc: 'Trascrivi manualmente un vocale citato',
    cmdTranscription: 'transcription',
    cmdTranscriptionDesc: 'Gestisci la trascrizione automatica (on/off/global on/global off)',

    // Transcription messages
    transcriptionResult: (text) => `🎤 *Trascrizione:*\n\n${text}`,
    transcriptionFailed: '❌ *Trascrizione non riuscita*\n\nMi dispiace, non sono riuscito a trascrivere questo vocale. ',
    transcriptionTimeout: 'Il messaggio è troppo lungo da elaborare.',
    transcriptionRetry: 'Riprova più tardi.',

    // Manual transcription
    quoteVoiceMessage: '❌ Cita un messaggio vocale per trascriverlo.\n\nUso: rispondi a un vocale con !t',
    notVoiceMessage: '❌ Il messaggio citato non è un vocale.',
    downloadFailed: '❌ Impossibile scaricare il messaggio vocale.',
    transcribeFailed: '❌ Impossibile trascrivere il messaggio vocale. Riprova.',

    // Settings
    settingsTitle: '⚙️ *Impostazioni trascrizione*\n\n',
    settingsGlobal: (enabled) => `Globale: ${enabled ? '✅ Attiva' : '❌ Disattiva'}\n`,
    settingsChat: (specific) => `Questa chat: ${specific === undefined ? '(usa l\'impostazione globale)' : (specific ? '✅ Attiva' : '❌ Disattiva')}\n`,
    settingsCurrent: (enabled) => `\nStato attuale: ${enabled ? '✅ Attivo' : '❌ Inattivo'}\n\n`,
    settingsUsage: '*Uso:*\n' +
      '!transcription on - Attiva per questa chat\n' +
      '!transcription off - Disattiva per questa chat\n' +
      '!transcription global on - Attiva globalmente\n' +
      '!transcription global off - Disattiva globalmente',
    settingsUsageError: '❌ Uso corretto: !transcription global <on|off>',
    settingsInvalidOption: '❌ Uso corretto: !transcription <on|off|global on|global off>',

    // Settings confirmations
    globalEnabled: '✅ Trascrizione automatica globale attivata per tutte le chat.',
    globalDisabled: '❌ Trascrizione automatica globale disattivata per tutte le chat.',
    chatEnabled: '✅ Trascrizione automatica attivata per questa chat.',
    chatDisabled: '❌ Trascrizione automatica disattivata per questa chat.',

    // Admin chat
    adminChatStatus: (chatId) => chatId
      ? `🔧 *Chat Admin*\n\nChat admin attuale: ${chatId}\n\nTutte le risposte del bot (tranne le trascrizioni) vengono reindirizzate qui.`
      : '🔧 *Chat Admin*\n\nNessuna chat admin configurata.\nLe risposte del bot appaiono nella stessa chat dei comandi.',
    adminChatSet: '✅ Questa chat è ora la chat admin.\n\nTutte le risposte del bot (tranne le trascrizioni) verranno inviate qui.',
    adminChatCleared: '✅ Chat admin rimossa.\n\nLe risposte del bot appariranno ora nella stessa chat dei comandi.',
    adminChatUsage: '❌ Uso:\n!admin - Mostra la chat admin attuale\n!admin set - Imposta questa chat come chat admin\n!admin clear - Rimuovi la restrizione della chat admin',
  }
};

class I18n {
  constructor() {
    this.currentLanguage = 'en';
  }

  setLanguage(lang) {
    if (translations[lang]) {
      this.currentLanguage = lang;
    } else {
      logger.warn('i18n', 'Unsupported language, falling back to English', { lang });
      this.currentLanguage = 'en';
    }
  }

  t(key, ...args) {
    const translation = translations[this.currentLanguage][key];

    if (!translation) {
      logger.warn('i18n', 'Translation key not found', { key, language: this.currentLanguage });
      return key;
    }

    // If it's a function, call it with arguments
    if (typeof translation === 'function') {
      return translation(...args);
    }

    return translation;
  }
}

export const i18n = new I18n();
