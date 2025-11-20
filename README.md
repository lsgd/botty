# WhatsApp Bot with Voice Transcription & Birthday Wishes

A feature-rich WhatsApp bot that automatically transcribes voice messages using GPT-4o-transcribe and sends personalized AI-generated birthday wishes. Built with a plugin architecture and runs in Docker.

## Features

### 🎤 Voice Transcription
- **Automatic transcription** of received and sent voice messages
- **GPT-4o-transcribe** for high accuracy (better than Whisper)
- **Native OGG/Opus support** (no conversion needed)
- **Race condition handling** - multiple transcriptions processed correctly
- **Per-chat controls** - enable/disable globally or per chat
- **Manual transcription** with `!t` command

### 🎂 Birthday Wishes
- **AI-generated messages** using GPT-4o with high creativity (temperature 1.3)
- **Maximum variety** - every message is unique and creative
- **Age-aware** with correct ordinals (21st, 22nd, 31st, etc.)
- **Smart scheduling** - random delivery in a configurable 7-9 AM (timezone-aware) window with persistence across restarts
- **Smart skipping** - won't send if you already messaged
- **Formal/informal modes** - first name vs last name with titles
- **Multi-language** - English, German, and Italian support
- **CSV-based** - easy to manage birthdays
- **No signatures** - clean, natural messages
- See [BIRTHDAY_PLUGIN.md](BIRTHDAY_PLUGIN.md) for full documentation

### 🎬 Profile Cinema
- **Automatic profile picture rotation** driven by a movie file (MP4/MKV)
- **Key-frame aware** seeking so the bot always jumps to the next natural frame even when behind
- **Interval based**: advance one key frame every `PROFILE_MESSAGE_INTERVAL` received messages (see details below)
- **Optimized uploads**: downscales/compresses frames to stay below 100 KB before sending to WhatsApp
- **Progress tracking**: `!cinema-progress` (authorized users only) shows frame/index/timestamp without revealing the movie title
- **Persistent state**: remembers progress and movie fingerprint across restarts and when the source file changes

### 🔐 Security & Control
- **Authorization system** - only specified numbers can use commands
- **Friendly auto-reply** for unauthorized users
- **No public access** - completely private

### 🌍 Multi-Language
- Bot messages in **English, German, and Italian**
- Configurable via `BOT_LANGUAGE` environment variable
- Transcription auto-detects spoken language

### 🔌 Extensible
- **Plugin architecture** - easy to add new features
- Clean separation of concerns
- Well-documented code

### 🐳 DevOps Ready
- **Docker** - runs in container
- **Persistent storage** - WhatsApp session and config
- **QR code authentication** - easy setup
- **Auto-restart** on crashes

## Architecture Highlights

### Race Condition Solution
The bot handles the critical race condition where:
1. Long voice message starts transcribing
2. Short voice message arrives 20 seconds later
3. Short transcription finishes first

**Solution**: Each transcription replies to the original voice message (quoted), so even if transcriptions finish out of order, they're always correctly associated with their source message.

### Plugin System
- Easy to add new plugins
- Each plugin can handle messages and commands
- Plugins register their commands dynamically for !help

## Prerequisites

- Docker and Docker Compose
- OpenAI API key
- WhatsApp account

## Installation

1. **Clone and navigate to project**:
   ```bash
   cd /path/to/whatsapp-transcription-bot
   ```

2. **Create environment file**:
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env` and add your credentials**:
   ```env
   OPENAI_API_KEY=sk-your-actual-api-key
   AUTHORIZED_NUMBERS=+1234567890,+0987654321
   ```

4. **Build and start the bot**:
   ```bash
   docker-compose up --build
   ```

5. **Scan the QR code** displayed in the console with WhatsApp

6. **Done!** The bot is now running.

## Usage

### Commands

All commands start with `!` and are only available to authorized numbers.

#### General Commands
- `!help` - Show all available commands and plugins
- `!chatid` - Get the current chat ID

#### Transcription Commands
- `!t` - Manually transcribe a quoted voice message (reply to a voice message with !t)
- `!transcription` - Show current transcription settings
- `!transcription on` - Enable automatic transcription for this chat
- `!transcription off` - Disable automatic transcription for this chat
- `!transcription global on` - Enable transcription globally for all chats
- `!transcription global off` - Disable transcription globally for all chats

#### Birthday Wishes Commands
- `!birthdays` - Show numbered list of all birthdays
- `!birthdays-reload` - Reload the birthday CSV file
- `!birthdays-test <number>` - Generate and preview a test birthday message

#### Profile Cinema Commands
- `!cinema-progress` - Show the current frame/timestamp/percentage (authorized senders only)

**Profile Cinema Interval Basics:**
- Every inbound (non-bot) message increments an internal counter.
- When the counter reaches `PROFILE_MESSAGE_INTERVAL`, it resets and the bot jumps to the *next* key frame extracted via `ffprobe`.
- Only one key frame is advanced per interval; if the bot was offline, it still resumes from the next queued frame without skipping.
- Example: with `PROFILE_MESSAGE_INTERVAL=10`, the 10th, 20th, 30th… message will trigger a new frame.

**See [BIRTHDAY_PLUGIN.md](BIRTHDAY_PLUGIN.md) for complete birthday wishes documentation.**

### Automatic Transcription

When automatic transcription is enabled (globally or per-chat):
- ✅ Received voice messages are automatically transcribed
- ✅ Sent voice messages are automatically transcribed
- ✅ Transcription is posted as a reply to the original voice message
- ✅ Multiple transcriptions in parallel are handled correctly

### Authorization

Non-authorized users who send commands will receive a friendly message:
```
👋 Hello! Thanks for reaching out.

This is an automated bot that assists with various tasks.
However, access is currently restricted to authorized users only.

Have a great day!
```

## Project Structure

```
whatsapp-bot/
├── src/
│   ├── index.js                           # Entry point
│   ├── bot.js                             # Bot initialization
│   ├── config.js                          # Configuration
│   ├── middleware/
│   │   └── auth.js                        # Authorization
│   ├── commands/
│   │   └── command-handler.js             # Command routing & !help & !chatid
│   ├── plugins/
│   │   ├── plugin-manager.js              # Plugin system
│   │   ├── transcription/
│   │   │   ├── index.js                   # Transcription plugin
│   │   │   ├── transcription-service.js   # GPT-4o integration
│   │   │   └── message-tracker.js         # Race condition handler
│   │   └── birthday/
│   │       ├── index.js                   # Birthday plugin
│   │       ├── birthday-scheduler.js      # Scheduling & sending
│   │       ├── message-generator.js       # GPT-4o message generation
│   │       ├── message-tracker.js         # Daily message tracking
│   │       └── csv-loader.js              # CSV validation & loading
│   └── utils/
│       ├── storage.js                     # Settings persistence
│       └── i18n.js                        # Internationalization (EN/DE)
├── tests/                                 # Test suite
│   ├── utils/                             # Utility tests
│   ├── middleware/                        # Middleware tests
│   ├── commands/                          # Command tests
│   ├── plugins/                           # Plugin tests
│   │   ├── birthday/                      # Birthday plugin tests
│   │   └── transcription/                 # Transcription plugin tests
│   └── fixtures/                          # Test data
├── data/                                  # Persisted data (auto-created)
│   ├── .wwebjs_auth/                     # WhatsApp session
│   ├── .wwebjs_cache/                    # WhatsApp cache
│   ├── config.json                       # Bot settings
│   ├── birthdays.csv                     # Birthday data (create from example)
│   ├── birthdays.csv.example             # Example birthday CSV
│   ├── birthday-message-tracker.json     # Tracks chats already messaged today
│   ├── profile-movie-progress.json       # State for Profile Cinema plugin
│   ├── reminders.json                    # Persisted reminder list + schedule metadata
│   └── temp/                             # Temporary audio files
├── Dockerfile
├── docker-compose.yml
├── package.json
├── .env.example                          # Environment variables template
├── .gitignore
├── .dockerignore
├── LICENSE                               # MIT License
├── README.md                             # Main documentation
├── BIRTHDAY_PLUGIN.md                    # Birthday plugin documentation
└── TESTING.md                            # Testing documentation
```

## Configuration

### Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `OPENAI_API_KEY` | Yes | OpenAI API key | `sk-proj-...` |
| `AUTHORIZED_NUMBERS` | Yes | Comma-separated phone numbers with country code | `+1234567890,+0987654321` |
| `BOT_LANGUAGE` | No | Bot message language (`en` or `de`) | `en` (default) |
| `BOT_TIMEZONE` | No | IANA timezone used for all schedulers | `Europe/Berlin` |
| `BIRTHDAY_CHECK_HOUR` | No | Hour (0-23) when the birthday CSV reload + scheduling runs | `6` |
| `BIRTHDAY_WINDOW_START` | No | Start hour for the birthday send window | `7` |
| `BIRTHDAY_WINDOW_END` | No | End hour for the birthday send window | `9` |
| `REMINDER_CHECK_HOUR` | No | Hour (0-23) when reminders are reloaded/scheduled | `6` |
| `REMINDER_SEND_HOUR` | No | Hour reminders fire (timezone-aware) | `7` |
| `REMINDER_SEND_MINUTE` | No | Minute reminders fire | `7` |
| `PROFILE_MOVIE_PATH` | No | Absolute/relative path to the MP4/MKV file used for Profile Cinema | `./data/profile.mp4` |
| `PROFILE_MESSAGE_INTERVAL` | No | Advance one key frame after this many received messages | `25` |
| `PROFILE_FRAME_MAX_KB` | No | Maximum allowed size for the generated JPEG (defaults to 100 KB) | `90` |

Both schedulers run with `node-cron` in the configured timezone, persist their queue state to `data/`, and reschedule anything missed during restarts so reminders and birthday wishes still go out even if the container was offline earlier.

### Phone Number Format

Phone numbers must include the country code with a `+` prefix:
- ✅ Correct: `+1234567890`
- ❌ Wrong: `1234567890` or `+1-234-567-890`

### Language Configuration

The bot supports multiple languages for its messages and responses. Set the `BOT_LANGUAGE` environment variable:
- `en` - English (default)
- `de` - German (Deutsch)
- `it` - Italian (Italiano)

All bot messages, error messages, help text, and command responses will be in the selected language. The transcription itself will auto-detect the spoken language in the audio.

**Example:**
```env
BOT_LANGUAGE=de
```

### Persistent Storage

The `./data` directory is mounted as a volume and contains:
- WhatsApp authentication session (so you don't need to scan QR every time)
- Bot configuration and settings
- Temporary audio files during processing

## Maintenance

### Automated Docker Publishing
The repository ships with `.github/workflows/docker-publish.yml`, which builds, tests, and pushes the container to Docker Hub whenever `main` changes or when triggered manually. To enable it:
1. Create repository secrets `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` (a Docker access token).
2. Optionally adjust the workflow triggers or image name (`${{ secrets.DOCKERHUB_USERNAME }}/whatsapp-transcription-bot`).
3. Pushing to `main` (or running the workflow manually) will run `npm test`, build the image with Buildx, and publish both `latest` and `sha` tags.

### View Logs
```bash
docker-compose logs -f
```

### Restart Bot
```bash
docker-compose restart
```

### Stop Bot
```bash
docker-compose down
```

### Reset WhatsApp Session
If you need to re-authenticate:
```bash
rm -rf data/.wwebjs_auth data/.wwebjs_cache
docker-compose restart
```

## Development

### Running Without Docker
```bash
npm install
export OPENAI_API_KEY="sk-your-key"
export AUTHORIZED_NUMBERS="+1234567890"
npm start
```

### Running Tests

The project includes comprehensive tests using Node.js built-in test runner.

**Run all tests:**
```bash
npm test
```

**Run tests in watch mode:**
```bash
npm run test:watch
```

**Run tests with coverage:**
```bash
npm run test:coverage
```

**See [TESTING.md](TESTING.md) for complete testing documentation.**

### Adding New Plugins

1. Create a new plugin file in `src/plugins/your-plugin/index.js`
2. Implement the plugin interface:
   ```javascript
   export class YourPlugin {
     constructor() {
       this.name = 'Your Plugin Name';
       this.description = 'Plugin description';
       this.commands = [
         { command: 'yourcommand', description: 'Command description' }
       ];
     }

     shouldHandle(message) {
       // Return true if this plugin should handle the message
       return false;
     }

     async onMessage(message) {
       // Handle automatic message processing
     }

     async onCommand(command, args, message) {
       // Handle command execution
     }
   }
   ```
3. Register in `src/bot.js`:
   ```javascript
   import { YourPlugin } from './plugins/your-plugin/index.js';
   const yourPlugin = new YourPlugin();
   pluginManager.register(yourPlugin);
   ```

## Technical Details

### GPT-4o-transcribe
- Model: `gpt-4o-transcribe` (latest, best accuracy)
- Native support for OGG/Opus format (WhatsApp's audio format)
- No audio conversion needed
- 25MB file size limit
- 5-minute timeout per transcription

### Race Condition Handling
The `MessageTracker` class ensures:
- Each transcription is tracked with a unique message ID
- Duplicate transcriptions are prevented
- Transcriptions are processed in parallel (no blocking)
- Each result is replied to its original message (quoted)
- Failed transcriptions are cleaned up properly

### Security
- Authorization middleware checks every command
- Non-privileged operations (transcription) work for authorized users only
- Docker runs as non-root user
- No secrets in logs

## Troubleshooting

### QR Code Not Showing
- Ensure `stdin_open: true` and `tty: true` are set in docker-compose.yml
- Check logs: `docker-compose logs -f`

### Transcription Fails
- Verify `OPENAI_API_KEY` is valid
- Check API quota/billing
- View detailed logs for error messages

### No Authorization
- Ensure `AUTHORIZED_NUMBERS` is set correctly with country code
- Format: `+1234567890` (no spaces, dashes, or parentheses)

### Bot Not Responding
- Check if bot is authenticated (look for "✅ WhatsApp Bot is ready!")
- Verify authorized number format
- Check command syntax (must start with `!`)

## Cost Estimation

GPT-4o-transcribe pricing: **$0.006 per minute** of audio

Examples:
- 1 minute voice message: $0.006
- 10 minutes/day = ~$1.80/month
- 100 voice messages/day (avg 30 sec each) = ~$3/month

Very affordable for personal/small team use!

## Recent Updates

### Version 1.0.0

**Features:**
- ✅ Voice message transcription with GPT-4o-transcribe
- ✅ AI-generated birthday wishes with GPT-4o
- ✅ Birthday message testing with `!birthdays-test`
- ✅ Multi-language support (EN/DE)
- ✅ Comprehensive test suite
- ✅ Docker deployment

**Improvements:**
- Fixed `!chatid` command to return correct chat ID (not sender ID)
- Added numbered birthday list for easy testing
- Birthday wishes now use GPT-4o for unique, personalized messages
- Proper ordinal number handling (21st, 22nd, 31st, etc.)
- No dashes in generated birthday messages
- First/last name split for proper formal addressing

**Testing:**
- 50+ unit tests covering core functionality
- CSV validation tests
- Race condition handling tests
- Authorization tests
- Multi-language tests

## License

MIT
