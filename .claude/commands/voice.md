---
description: Manage ElevenLabs voice settings stored in brand.json.
argument-hint: [list|test|update]
---

# /voice

Manage the voice configuration for this workspace.

Steps you take based on the argument:

**No arg or `list`**: list available ElevenLabs voices on the account and highlight which one is currently stored in `brand.json`. Use:
```bash
curl -sS -H "xi-api-key: $ELEVENLABS_API_KEY" "https://api.elevenlabs.io/v2/voices?page_size=100"
```
Then format the JSON: category, name, voice_id, short description. Mark the configured voice with a (current) tag.

**`test`**: generate a short test phrase with the currently configured voice and play it. Use:
```bash
curl -sS -X POST \
  -H "xi-api-key: $ELEVENLABS_API_KEY" \
  -H "content-type: application/json" \
  -d '{"text":"This is a voice test of the Video Studio configuration.","model_id":"eleven_multilingual_v2","voice_settings":{"stability":0.5,"similarity_boost":0.78,"style":0}}' \
  "https://api.elevenlabs.io/v1/text-to-speech/<voice_id>?output_format=mp3_44100_128" \
  > /tmp/voice-test.mp3
afplay /tmp/voice-test.mp3
```
Replace `<voice_id>` with the value from brand.json.

**`update`**: walk the user through changing voice settings (`stability`, `similarity_boost`, `style`) or swapping the voice id. Show the current values from `brand.json`, ask what they want to change, write the update, then run a `test` so they hear the new setting before locking it in. The voice id stays workspace-global; brand-specific overrides for settings can be put in `assets-library/brand/<brand-name>/brand.json` if a particular project needs a different vibe.

Reminders:
- Stability above 0.7 makes the voice steadier but less expressive. Below 0.3 it gets too variable for production voiceover.
- Similarity_boost around 0.75-0.85 is the sweet spot for cloned voices. Lower than 0.5 starts drifting from the source.
- Style adds emphasis but eats prosody. Default 0 unless the scene calls for theatricality.
- Always preserve the user's voice id by default. Don't overwrite without explicit go-ahead.
