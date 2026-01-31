# Commit Flipbook Web Interface

This directory contains the static website for Commit Flipbook, hosted on GitHub Pages.

## Live Site

Visit: [https://twalichiewicz.github.io/commit-flipbook](https://twalichiewicz.github.io/commit-flipbook)

## Files

- `index.html` - Main page with input form and canvas
- `style.css` - Minimalist monochrome design inspired by shadcn/ui
- `art-generator.js` - Core visualization engine (Vanilla JS + HTML5 Canvas)

## Local Development

To run locally:

```bash
# From the repository root
python3 -m http.server 8000 -d docs
# Visit http://localhost:8000
```

Or simply open `index.html` in your browser.

## Architecture

The application is a pure client-side Single Page Application (SPA).

1.  **Input**: User enters a GitHub URL.
2.  **Fetch**: Application queries the GitHub REST API for repo details, languages, contributors, and commit history.
3.  **Hash**: The repo name is hashed to select one of 4 visual styles (Constellation, Flow, Nebula, Matrix).
4.  **Map**: Commit data is mapped to 2D coordinates:
    *   Time → X-Axis
    *   Author Identity → Y-Axis & Color
    *   Code Volume → Particle Size
5.  **Render**: The `SimpleVisualizer` class draws the scene to an HTML5 Canvas using an optimized animation loop.

No build step is required. It is standard ES6 JavaScript.
