# Commit Flipbook Examples

These examples demonstrate how the commit flipbook tool visualizes code evolution across different project types.

## 🎯 Example 1: Countdown Timer (Web)

A simple web page showing a countdown from 10 to 1 with progressive visual effects.

**Evolution:**
- Starts as a simple "10" on screen
- Font size increases with each number
- Colors change from gray → red → intense red
- Animations added: hover → pulse → flash
- Background transitions from light to dark
- Final frame shows dramatic flashing at "1"

**Run it:**
```bash
cd ..
node index.js examples/countdown-timer --type web --limit 10 -o countdown.gif
```

## 📊 Example 2: Progress Bar (Console)

A Python script simulating a file download with ASCII progress bar.

**Evolution:**
- Starts with empty progress bar at 0%
- Fills progressively: `[██████    ] 60%`
- Shows download statistics (speed, time remaining)
- Ends with ASCII art celebration and completion stats

**Run it:**
```bash
cd ..
node index.js examples/progress-bar --type console --command "python3 progress.py" --limit 6 -o progress.gif
```

## 🎨 Example 3: Spiral Art (Canvas)

An HTML5 canvas animation evolving from a circle to complex generative art.

**Evolution:**
- Begins with a simple white circle
- Transforms into multiple circles in pattern
- Morphs into mathematical spiral
- Adds rainbow colors and gradients
- Final version has multiple rotating layers with stars

**Run it:**
```bash
cd ..
node index.js examples/spiral-art --type web --limit 6 -o spiral.gif --delay 1500
```

## 🎬 Example Commands

### Quick test (fewer commits, faster):
```bash
node index.js examples/countdown-timer --limit 5 -o quick-countdown.gif
```

### High quality (all commits, slower):
```bash
node index.js examples/spiral-art --width 1600 --height 1200 --delay 2000 -o hq-spiral.gif
```

### Custom timing:
```bash
node index.js examples/progress-bar --delay 500 --limit 6 -o fast-progress.gif
```

## 💡 Tips for Your Own Projects

1. **Commit Frequently**: More commits = smoother animation
2. **Visual Changes**: Make each commit visually distinct
3. **Clear Messages**: Use descriptive commit messages
4. **Test First**: Run your code at each commit to ensure it works
5. **Keep It Simple**: Start basic and build complexity

## 🚀 Creating Your Own Examples

1. Create a new directory
2. Initialize git: `git init`
3. Make your first version (keep it simple!)
4. Commit: `git add . && git commit -m "Initial version"`
5. Make incremental changes
6. Commit each change
7. Run the flipbook tool on your repo

The key is making each commit represent a visible change in the output!