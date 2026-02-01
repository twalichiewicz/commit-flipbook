# Commit Flipbook (alpha)

Transform any GitHub repository into beautiful, deterministic generative art by visualizing its commit history.

🌐 **Try it online**: [commit-flipbook.github.io](https://twalichiewicz.github.io/commit-flipbook)

## What it does

Commit Flipbook creates unique visual fingerprints for GitHub repositories. Unlike random visualizers, this tool is **strictly data-driven**: every pixel's position, color, and movement is derived directly from the code history.

Input a repository URL, and the system maps:
- **Time** to horizontal position
- **Authors** to vertical bands and colors
- **Code Changes** to particle size and volatility
- **Commit Messages** to structural jitter

The result is that the Linux kernel will *always* look like the Linux kernel, and your personal project will have its own distinct visual signature.

## Visual Styles

The engine automatically selects one of four styles based on the repository's unique hash:

1.  **Constellation**: A network of glowing nodes where commits are connected by author identity and temporal proximity.
2.  **Flow Field**: Fluid particle streams that visualize the "velocity" of development.
3.  **Nebula**: Spiraling galactic structures representing the orbital mechanics of collaboration.
4.  **Matrix**: A data-rain aesthetic where commit hashes cascade like digital rainfall.

## Features

-   **Deterministic Generation**: The same repo always yields the exact same artwork.
-   **Zero Dependencies**: Pure Vanilla JavaScript and HTML5 Canvas. No WebGL, no frameworks.
-   **Real-time Animation**: Watch the repository history evolve.
-   **Client-Side Privacy**: All data is fetched directly from GitHub's API to your browser. No middleman servers.

## How to Use

### 🌐 Web Interface

1.  Visit the [web app](https://twalichiewicz.github.io/commit-flipbook).
2.  Enter a GitHub repository URL (e.g., `https://github.com/torvalds/linux`).
3.  Click **Generate**.
4.  **Download** a high-res screenshot or **Share** the link.

## The Data Mapping

To understand the art, you must understand the data:

*   **X-Axis (Horizontal)**: Represents the timeline. Oldest commits are on the left, newest on the right.
*   **Y-Axis (Vertical)**: Represents the "Author Space". Different contributors are hashed to specific vertical bands.
*   **Particle Size**: Logarithmic scale of the "Lines of Code" changed in that commit.
*   **Color (Hue)**: Unique identity hash of the commit author.
*   **Connections**: Drawn between commits that share an author or are temporally clustered.

## Development

### Local Setup

```bash
# Clone the repository
git clone https://github.com/twalichiewicz/commit-flipbook.git
cd commit-flipbook

# Open in browser (no build needed!)
open docs/index.html

# Or run a local server
python3 -m http.server 8000 -d docs
# Visit http://localhost:8000
```

### Project Structure

```
commit-flipbook/
├── docs/                 # GitHub Pages site
│   ├── index.html       # Main interface
│   ├── style.css        # Minimalist monochrome design
│   └── art-generator.js # Core visualization engine
└── README.md            # This file
```

## Contributing

Contributions are welcome! Feel free to:
-   Add new visualization styles (check `drawVisualization` in `art-generator.js`).
-   Improve the data mapping algorithms.
-   Enhance the UI/UX.

## License

MIT License - feel free to use this for your own projects!

---

*Each repository tells its own story through code. This tool helps you see that story as art.*
