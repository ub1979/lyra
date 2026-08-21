# Attribution — framework skills

Imported 2026-08-21 from **MiniMax-AI/skills** (commit `60aaae5`, 2026-04-18),
https://github.com/MiniMax-AI/skills — MIT License, © 2026 MiniMax.

Skills: `fullstack-dev`, `android-native-dev`, `ios-application-dev`,
`flutter-dev`, `react-native-dev`, `shader-dev`, `frontend-dev`.

Upstream credits carried forward (see the repo's CREDITS.md):

- `frontend-dev` derives from **taste-skill** by Leon Lin (Leonxlnx, MIT) and
  from Anthropic's **canvas-design** / **algorithmic-art** (Apache 2.0).
- `react-native-dev` derives from **expo/skills** by Expo / 650 Industries (MIT).
- `flutter-dev` derives from **flutter-expert** by Jeff Smolinski (MIT).

## Local modifications

`frontend-dev` was trimmed to run without a MiniMax account:

- removed `canvas-fonts/` (5.5 MB of font binaries);
- removed `scripts/minimax_*.py` and the MiniMax CLI / env / voice / TTS / music
  / video / image reference files;
- section 3.1 now routes asset generation through Lyra's own `image_generate`,
  `video_generate`, `text_to_speech` and `vision_analyze` tools.

Nothing else was edited. The remaining files are upstream text.
