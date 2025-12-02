This is a nodejs agent that connects to whatsapp and and performs some functions:
* Transcribe the audio messages with openai
* Keep track fo birthdays
* Set and notify reminders
* Change the profile picture with an image taken from a movie

The functions are performed by different plugins.

The interface with whatsapp uses whatsappweb.js:
* Guides: https://wwebjs.dev/guide/
* Reference docs: https://docs.wwebjs.dev/

IMPORTANT: You're operating in an environment that does not have access to all the tools. If a tool for testing or compiling is missing, just print the instructions to execute it and ask the user to run and confirm the results.

A full description of this project is in README.md
The testing approach is described in TESTING.md
