# Changelog

All notable changes to this project will be documented in this file.

## [0.4.0] - 2026-05-10
### Added
- **MySQL Integration**: Complete migration of history from localStorage to a server-side MySQL database.
- **PHP Backend API**: Implemented `api.php` to handle data synchronization, security, and version control.
- **Authentication System**: Full-featured user registration and login system using PHP sessions and secure password hashing.
- **Dedicated History Modal**: Replaced the bottom history bar with a professional full-screen modal featuring cards and code previews.
- **Vibrant SaaS UI**: Complete visual redesign with a light Indigo/White theme, soft shadows, and improved spacing.
- **Section Constructor (Stack)**: New "Add to Stack" feature allowing users to combine multiple generated blocks into one project.
- **Smart Table Rules**: Enhanced system prompts to ensure semantic and responsive HTML table generation.
- **Database Dump**: Included `database.sql` for quick environment setup.

### Changed
- **Unified Model Routing**: Transitioned to `openrouter/free` for all modes to ensure maximum stability and availability.
- **Input Experience**: Simplified the left panel, removing tabs in favor of a clean, focused text and file upload area.

### Fixed
- **History Sync**: Resolved issues with history persistence across different devices/browsers via centralized storage.
- **Navigation**: Improved modal transitions and state management during Auth flows.


## [0.3.0] - 2026-05-10
### Added
- **AI Reference Parsing**: Automatic splitting of uploaded reference files into HTML and CSS using AI.
- **Generation Timer**: Real-time generation stopwatch displayed in the status bar.
- **Granular Status Tracking**: Detailed phase-by-phase status updates (Connecting, Creating, Updating).
- **Manual Config Update**: New "Apply Settings" button to manually update current layout without full re-generation.
- **Modal Loading Overlay**: Full-screen loading indicator and interaction lock during reference file processing.
- **Resizable Panels**: Interactive divider between the input panel and preview to customize workspace width.
- **Heading Controls**: Checkboxes (H1-H5) to strictly limit allowed heading tags.
- **Structural Settings**: Toggles for managing `<section>` wrappers and centering containers.

### Changed
- **AI Prompt Strengthening**: Stricter instructions to preserve 100% of user text (no summarization or truncation).
- **UI UX Improvements**: Enhanced feedback panel with a larger input field and premium button styling.
- **Auto-Regen Logic**: Transitioned from automatic re-generation to intentional manual updates via button.

### Fixed
- **AI "Laziness"**: Resolved issues where the AI would skip text fragments from large Word files.
- **Error Handling**: Added AI response validation for mandatory markers and empty content.
- **Scoping Issues**: Fixed `ReferenceError: applyConfigBtn is not defined`.
- **UI Flickering**: Optimized panel resizer using `requestAnimationFrame` and `pointer-events` management.

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
