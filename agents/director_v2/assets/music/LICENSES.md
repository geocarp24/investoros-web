# Director v2 — Music Track Licenses

The 5 `.mp3` files in this directory are real royalty-free instrumental tracks
sourced and uploaded by Jorge (Pinnacle owner) on 2026-05-02.

| Filename         | Mood       | Duration | Bitrate  | Source           |
|------------------|------------|----------|----------|------------------|
| chill_1.mp3      | chill      | 94.0s    | 255kbps  | Jorge personal   |
| cinematic_1.mp3  | cinematic  | 130.4s   | 256kbps  | Jorge personal   |
| tension_1.mp3    | tension    | 127.3s   | 255kbps  | Jorge personal   |
| upbeat_1.mp3     | upbeat     | 122.0s   | 255kbps  | Jorge personal   |
| upbeat_2.mp3     | upbeat     | 69.3s    | 255kbps  | Jorge personal   |

The Director v2 pipeline (`src/audio.mjs`) selects by mood prefix and concatenates
with the rendered scenes via ffmpeg's `amix` filter, looping/trimming as needed
to match the video duration.

If you replace any track:
1. Keep the exact filename (the audio selector matches by basename).
2. Confirm royalty-free / CC0 / Pixabay-content-license / personal-licensed for commercial use.
3. Re-export at 128-256kbps stereo MP3 for consistency.
