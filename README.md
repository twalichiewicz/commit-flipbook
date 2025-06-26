# Commit Flipbook

A tool that creates a flipbook animation/GIF showing how your actual code output evolves over time through your commit history.

🌐 **Try it online**: [commit-flipbook.github.io](https://commit-flipbook.github.io) (coming soon)

## What it does

Instead of just showing commit messages, this tool:
1. **Clones your repository**
2. **Checks out each commit** in chronological order
3. **Executes your code** at each commit
4. **Captures the actual output** (web pages, console output, etc.)
5. **Creates an animated GIF** showing how your code's behavior changes over time

Perfect for visualizing the evolution of:
- Web applications and their UI changes
- Data visualizations and charts
- Game development progress
- Algorithm outputs
- Art and creative coding projects

## Quick Start

### 🌐 Web Interface (Easiest)

Visit the web app and enter your GitHub repository URL:
- Simple: Just paste your repo URL
- No installation required
- Results in minutes

### 💻 CLI Tool

For local use or automation:

```bash
npm install
```

## CLI Usage

```bash
node index.js <repo-url> [options]
```

### Arguments

- `repo-url` - Full repository URL (e.g., `https://github.com/username/repo`)

### Options

- `-o, --output <path>` - Output GIF file path (default: "commit-flipbook.gif")
- `-b, --branch <branch>` - Branch name (default: "main")
- `-l, --limit <number>` - Maximum number of commits to include (default: 20)
- `-w, --width <number>` - GIF width in pixels (default: 1200)
- `-h, --height <number>` - GIF height in pixels (default: 800)
- `-d, --delay <number>` - Delay between frames in milliseconds (default: 1000)
- `--type <type>` - Project type: `auto|web|console|canvas` (default: auto)
- `--entry <file>` - Entry point file (e.g., index.html, main.py, app.js)
- `--command <cmd>` - Custom command to run your project
- `--port <port>` - Port for web projects (default: 3000)

### Examples

Basic usage with a web project:
```bash
node index.js https://github.com/username/my-webapp
```

Console application with custom command:
```bash
node index.js https://github.com/username/python-script --type console --command "python3 main.py"
```

Canvas/art project with custom settings:
```bash
node index.js https://github.com/username/p5js-sketch --limit 10 --delay 2000
```

Specific entry point:
```bash
node index.js https://github.com/username/react-app --entry "public/index.html"
```

## Supported Project Types

### 🌐 Web Projects
- Static HTML/CSS/JS websites
- React, Vue, Angular applications
- Node.js web servers
- Any project with `npm start` or similar scripts

**How it works:** Starts a local server, opens the page in a headless browser, captures screenshots

### 💻 Console Projects  
- Python scripts
- Node.js CLI tools
- Any executable that produces text output

**How it works:** Executes the main script, captures stdout/stderr output as text frames

### 🎨 Canvas/Creative Projects
- p5.js sketches
- HTML5 Canvas applications
- Creative coding projects

**How it works:** Similar to web projects but optimized for visual output

### 🔧 Auto-Detection
The tool automatically detects project type by examining:
- `package.json` scripts
- Presence of `index.html`
- File extensions (`.py`, `.js`, etc.)
- Common file patterns

## Output

The generated GIF shows:
- **Actual visual output** from your code at each commit
- **Commit information overlay** (hash, message, date)
- **Progress indicator** showing position in history
- **Smooth transitions** between different versions

## Requirements

- Node.js 14+
- Git installed and accessible
- Dependencies for your target projects (Python, npm, etc.)
- Chrome/Chromium for web project screenshots

## How It Works

1. **Clone & History**: Clones the repository and gets commit history
2. **Time Travel**: Checks out each commit in chronological order  
3. **Build**: Installs dependencies for each commit (if needed)
4. **Execute**: Runs the project using detected or specified commands
5. **Capture**: Takes screenshots (web) or captures text output (console)
6. **Animate**: Combines all frames into a smooth GIF animation

## Tips

- Use `--limit` to control processing time (fewer commits = faster)
- For long-running projects, use `--command` to specify quick demo commands
- Web projects work best when they have predictable startup times
- Consider using `--delay` to control animation speed

## Examples

Check out the `examples/` directory for ready-to-run demonstrations:
- **Countdown Timer**: Web animation showing a countdown with effects
- **Progress Bar**: Console application with ASCII progress visualization  
- **Spiral Art**: Canvas-based generative art evolution

See [examples/README.md](examples/README.md) for detailed instructions.

## Examples of Great Use Cases

- **Portfolio pieces**: Show your project's evolution
- **Tutorial content**: Visualize step-by-step development
- **Code reviews**: See actual output changes, not just code diffs
- **Art projects**: Perfect for generative art and creative coding
- **Data science**: Show how visualizations evolve with new data/algorithms

Turn your commit history into a compelling visual story! 🎬