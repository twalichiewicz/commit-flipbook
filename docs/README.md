# Commit Flipbook Web Interface

This directory contains the static website for Commit Flipbook, hosted on GitHub Pages.

## Live Site

Visit: [https://twalichiewicz.github.io/commit-flipbook](https://twalichiewicz.github.io/commit-flipbook)

## Files

- `index.html` - Main page with input form and canvas
- `style.css` - Minimalist monochrome design inspired by shadcn/ui
- `art-generator.js` - Core visualization engine

## Local Development

To run locally:

```bash
# From the repository root
python3 -m http.server 8000 -d docs
# Visit http://localhost:8000
```

Or simply open `index.html` in your browser.

## How It Works

1. User enters a GitHub repository URL
2. JavaScript fetches commit history via GitHub API
3. Analyzes commit patterns and author contributions
4. Generates animated frames showing repository evolution
5. Renders multiple visual layers on HTML5 canvas
6. Plays animation with adjustable speed control

## Visualization Layers

- **Background** - Radial gradient for depth
- **Flow Fields** - Dynamic patterns based on commit density
- **Constellation** - Commits as glowing nodes with connections
- **Activity Waves** - Shows development intensity over time
- **Metadata** - Repository name and commit count

No server needed - everything runs in the browser!