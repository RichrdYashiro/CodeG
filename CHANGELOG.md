# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2026-05-09
### Added
- **Word (.docx) Support**: Ability to upload and parse Word documents via `mammoth.js`.
- **Drag & Drop**: New interactive drop zone for easy file uploading.
- **Smart Text Normalization**: Automated removal of excessive whitespace and empty lines from input.
- **SEO Schema Tab**: Generation and display of JSON-LD micromarkup (Schema.org).
- **Stability Fixes**: Switched to `openrouter/free` universal router to prevent 404/provider errors.

### Changed
- **Performance**: Throttled iframe updates (150ms) to eliminate screen flickering during streaming.
- **AI Logic**: Improved system prompt to prioritize existing CSS classes and enforce cleaner HTML structure (preventing redundant sections).
- **UI Refresh**: Smoother, more neutral "breathing" thinking animation for better focus.
- **Improved Parsing**: Enhanced stream parser to handle multiple markers (HTML, CSS, Schema) and filter out `<think>` blocks from R1 models.

### Fixed
- **Input Issues**: Added trimming for API keys and input text to prevent authentication errors.
- **Error Handling**: Detailed error logging for OpenRouter response failures.


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
