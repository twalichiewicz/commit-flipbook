# Commit Flipbook

Transform any GitHub repository into beautiful generative art by visualizing its commit history.

🌐 **Try it online**: [commit-flipbook.github.io](https://twalichiewicz.github.io/commit-flipbook)

## What it does

Commit Flipbook creates unique, animated visualizations from GitHub repositories. Just enter a repo URL and watch as the commit history transforms into organic, flowing art.

### Features

- **Automatic Art Generation** - No configuration needed, just paste a GitHub URL
- **Dynamic Visualizations** - Each repository creates its own unique patterns
- **Real-time Animation** - Watch commits flow and evolve
- **Pure Client-Side** - Everything runs in your browser, no server needed
- **Instant Results** - Uses GitHub API for fast visualization

## How to Use

### 🌐 Web Interface (Easiest)

1. Visit the [web app](https://twalichiewicz.github.io/commit-flipbook)
2. Enter any GitHub repository URL (e.g., `https://github.com/torvalds/linux`)
3. Click "Generate" and watch the art unfold
4. Adjust animation speed with the slider
5. Download or share your creation

### 🎨 The Visualization

Each repository generates unique art based on:

- **Glowing Nodes** - Each commit is a point of light
- **Size** - Reflects the amount of code changed
- **Color** - Unique hue for each contributor
- **Connections** - Curved lines show commit relationships
- **Flow Fields** - Organic patterns respond to commit density
- **Activity Waves** - Visualize coding intensity over time
- **Organic Movement** - Natural wave patterns create flowing motion

### Examples

Try these repositories for stunning visualizations:
- `https://github.com/facebook/react` - See React's evolution
- `https://github.com/tensorflow/tensorflow` - Machine learning history
- `https://github.com/bitcoin/bitcoin` - Cryptocurrency development
- `https://github.com/torvalds/linux` - The Linux kernel's journey

## Technical Details

### Architecture

- **Frontend Only** - Static site hosted on GitHub Pages
- **GitHub API** - Fetches commit data directly
- **Canvas Rendering** - Hardware-accelerated graphics
- **No Dependencies** - Pure JavaScript, no framework needed

### How It Works

1. **Fetch Commits** - Uses GitHub API to get repository history
2. **Analyze Patterns** - Extracts author data and change statistics
3. **Generate Frames** - Creates animated sequence showing evolution
4. **Render Art** - Multiple visual layers create depth and movement
5. **Animate** - Smooth playback with adjustable speed

### Visual Elements

- **Constellation Pattern** - Commits form an interconnected network
- **Flow Fields** - Background patterns respond to commit activity
- **Activity Waves** - Bottom waves show development intensity
- **Glow Effects** - Recent commits pulse with energy
- **Curved Connections** - Organic lines between related commits

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
├── docs/                    # GitHub Pages site
│   ├── index.html          # Main interface
│   ├── style.css           # Minimalist design
│   └── art-generator.js    # Visualization engine
├── examples/               # Example repositories
└── README.md              # This file
```

### Contributing

Contributions are welcome! Feel free to:
- Add new visualization styles
- Improve performance
- Enhance the UI
- Fix bugs
- Add features

## Privacy & Security

- **Client-Side Only** - Your data never leaves your browser
- **Public Repos Only** - Uses GitHub's public API
- **No Storage** - Nothing is saved or tracked
- **Open Source** - Inspect the code yourself

## Credits

Inspired by the beauty of collaborative development and the patterns that emerge from thousands of commits working together to build something amazing.

## License

MIT License - feel free to use this for your own projects!

---

*Each repository tells its own story through code. This tool helps you see that story as art.*