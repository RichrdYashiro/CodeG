# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-05-09
### Added
- **Core Functionality**: AI Layout Assistant with DeepSeek (via OpenRouter) integration.
- **Streaming UI**: Real-time code generation and streaming updates.
- **Live Preview**: Integrated iframe for instant rendering of generated HTML/CSS.
- **BEM Standard**: Support for custom "Golden Standard" HTML/CSS patterns in settings.
- **Settings System**: API key and pattern management using `localStorage`.
- **Controls**: "Stop Generation" button and "Copy Result" functionality.
- **Design**: Premium dark-mode UI with professional status indicators and micro-animations.

### Technical Details
- Implemented `AbortController` for stream management.
- Custom stream parser for `###CSS###` and `###HTML###` markers.
- `config.js` environment setup with `unload` event suppression.
