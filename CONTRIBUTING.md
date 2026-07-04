# Contributing to GitHub Copilot Browser

Thank you for your interest in contributing! This document outlines the process for contributing.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/<username>/github-copilot-browser.git`
3. Install dependencies: `npm install`
4. Create a branch: `git checkout -b feature/your-feature`

## Development Workflow

1. Make your changes
2. Build: `npm run build`
3. Load the `dist/` directory in Chrome/Edge as an unpacked extension
4. Test thoroughly

## Code Style

- TypeScript strict mode enabled
- ES Modules throughout
- Consistent naming: kebab-case for files, camelCase for variables
- Error handling: always catch and surface meaningful errors

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add hover_element tool
fix: handle undefined content script response
docs: update README with settings instructions
chore: bump version to 0.2.0
```

## Pull Requests

1. Update the README if you change functionality
2. Update version in manifest.json and package.json
3. Include a clear description of changes
4. Reference any related issues

## Reporting Issues

- Use the GitHub issue tracker
- Include: steps to reproduce, expected behavior, actual behavior
- Mention: browser, version, OS, extension version

## Security

If you find a security vulnerability, please report it privately to svg153@gmail.com. Do not open a public issue.
