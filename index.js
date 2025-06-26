#!/usr/bin/env node

const { Command } = require('commander');
const { Octokit } = require('@octokit/rest');
const { createCanvas } = require('canvas');
const GIFEncoder = require('gif-encoder-2');
const fs = require('fs-extra');
const path = require('path');
const simpleGit = require('simple-git');
const puppeteer = require('puppeteer');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
require('dotenv').config();

const execAsync = promisify(exec);
const program = new Command();

program
  .name('commit-flipbook')
  .description('Create a flipbook animation/GIF from actual code output changes over time')
  .version('1.0.0')
  .argument('<repo-url>', 'Repository URL (e.g., https://github.com/owner/repo)')
  .option('-o, --output <path>', 'Output GIF file path', 'commit-flipbook.gif')
  .option('-b, --branch <branch>', 'Branch name', 'main')
  .option('-l, --limit <number>', 'Maximum number of commits to include', '20')
  .option('-w, --width <number>', 'GIF width in pixels', '1200')
  .option('-h, --height <number>', 'GIF height in pixels', '800')
  .option('-d, --delay <number>', 'Delay between frames in milliseconds', '1000')
  .option('-t, --token <token>', 'GitHub token (overrides GITHUB_TOKEN env var)')
  .option('--type <type>', 'Project type (auto|web|console|canvas)', 'auto')
  .option('--entry <file>', 'Entry point file (e.g., index.html, main.py, app.js)')
  .option('--command <cmd>', 'Custom command to run the project')
  .option('--port <port>', 'Port for web projects', '3000')
  .parse();

const options = program.opts();
const repoUrl = program.args[0];

class ProjectExecutor {
  constructor(projectPath, options) {
    this.projectPath = projectPath;
    this.options = options;
    this.browser = null;
  }

  async detectProjectType() {
    if (this.options.type !== 'auto') return this.options.type;

    const files = await fs.readdir(this.projectPath);
    
    // Web projects
    if (files.includes('index.html') || files.includes('package.json')) {
      const packageJson = path.join(this.projectPath, 'package.json');
      if (await fs.pathExists(packageJson)) {
        const pkg = await fs.readJSON(packageJson);
        if (pkg.scripts && (pkg.scripts.start || pkg.scripts.dev)) {
          return 'web';
        }
      }
      if (files.includes('index.html')) return 'web';
    }

    // Canvas/Processing projects
    if (files.some(f => f.includes('sketch') || f.includes('canvas'))) {
      return 'canvas';
    }

    // Python projects
    if (files.some(f => f.endsWith('.py'))) {
      return 'console';
    }

    // Default to web for most projects
    return 'web';
  }

  async installDependencies() {
    const packageJson = path.join(this.projectPath, 'package.json');
    if (await fs.pathExists(packageJson)) {
      console.log('📦 Installing dependencies...');
      try {
        await execAsync('npm install', { cwd: this.projectPath, timeout: 60000 });
      } catch (error) {
        console.warn('⚠️  Failed to install dependencies:', error.message);
      }
    }
  }

  async startServer() {
    const packageJson = path.join(this.projectPath, 'package.json');
    
    if (await fs.pathExists(packageJson)) {
      const pkg = await fs.readJSON(packageJson);
      if (pkg.scripts) {
        const startCmd = pkg.scripts.start || pkg.scripts.dev || pkg.scripts.serve;
        if (startCmd) {
          console.log(`🚀 Starting server with: ${startCmd}`);
          const server = spawn('npm', ['run', startCmd.split(' ')[0]], {
            cwd: this.projectPath,
            stdio: 'pipe'
          });
          
          // Wait for server to start
          await new Promise(resolve => setTimeout(resolve, 3000));
          return server;
        }
      }
    }

    // Try simple HTTP server for static files
    try {
      const server = spawn('python3', ['-m', 'http.server', this.options.port], {
        cwd: this.projectPath,
        stdio: 'pipe'
      });
      await new Promise(resolve => setTimeout(resolve, 2000));
      return server;
    } catch {
      // Fallback to Node.js server
      const server = spawn('npx', ['http-server', '-p', this.options.port], {
        cwd: this.projectPath,
        stdio: 'pipe'
      });
      await new Promise(resolve => setTimeout(resolve, 2000));
      return server;
    }
  }

  async captureWebOutput() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }

    const page = await this.browser.newPage();
    await page.setViewport({ 
      width: parseInt(this.options.width), 
      height: parseInt(this.options.height) 
    });

    try {
      const entryFile = this.options.entry || 'index.html';
      const url = `http://localhost:${this.options.port}/${entryFile}`;
      
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 10000 });
      
      // Wait a bit for any animations/loading
      await page.waitForTimeout(1000);
      
      const screenshot = await page.screenshot({
        type: 'png',
        clip: {
          x: 0,
          y: 0,
          width: parseInt(this.options.width),
          height: parseInt(this.options.height)
        }
      });

      await page.close();
      return screenshot;
    } catch (error) {
      console.warn('⚠️  Failed to capture web output:', error.message);
      await page.close();
      return this.createErrorFrame(`Web capture failed: ${error.message}`);
    }
  }

  async captureConsoleOutput() {
    try {
      let command = this.options.command;
      
      if (!command) {
        const files = await fs.readdir(this.projectPath);
        if (files.includes('main.py')) command = 'python3 main.py';
        else if (files.includes('app.py')) command = 'python3 app.py';
        else if (files.includes('index.js')) command = 'node index.js';
        else if (files.includes('main.js')) command = 'node main.js';
        else command = 'echo "No entry point found"';
      }

      const { stdout, stderr } = await execAsync(command, { 
        cwd: this.projectPath,
        timeout: 5000 
      });
      
      const output = stdout + (stderr ? `\nErrors:\n${stderr}` : '');
      return this.createTextFrame(output.slice(0, 2000)); // Limit output
    } catch (error) {
      return this.createErrorFrame(`Execution failed: ${error.message}`);
    }
  }

  createTextFrame(text) {
    const canvas = createCanvas(parseInt(this.options.width), parseInt(this.options.height));
    const ctx = canvas.getContext('2d');
    
    // Background
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Text
    ctx.fillStyle = '#00ff00';
    ctx.font = '14px monospace';
    
    const lines = text.split('\n');
    let y = 30;
    
    for (const line of lines.slice(0, 50)) { // Limit lines
      ctx.fillText(line.slice(0, 100), 20, y); // Limit line length
      y += 16;
      if (y > canvas.height - 20) break;
    }
    
    return canvas.toBuffer('image/png');
  }

  createErrorFrame(message) {
    const canvas = createCanvas(parseInt(this.options.width), parseInt(this.options.height));
    const ctx = canvas.getContext('2d');
    
    // Background
    ctx.fillStyle = '#2d1b1b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Error message
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Error', canvas.width / 2, canvas.height / 2 - 20);
    
    ctx.font = '14px monospace';
    ctx.fillStyle = '#ffaaaa';
    const lines = this.wrapText(ctx, message, canvas.width - 40);
    let y = canvas.height / 2 + 10;
    
    for (const line of lines.slice(0, 5)) {
      ctx.fillText(line, canvas.width / 2, y);
      y += 20;
    }
    
    return canvas.toBuffer('image/png');
  }

  wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    
    if (currentLine) lines.push(currentLine);
    return lines;
  }

  async captureOutput() {
    const projectType = await this.detectProjectType();
    console.log(`🎯 Detected project type: ${projectType}`);

    switch (projectType) {
      case 'web':
      case 'canvas':
        return await this.captureWebOutput();
      case 'console':
        return await this.captureConsoleOutput();
      default:
        return this.createErrorFrame(`Unsupported project type: ${projectType}`);
    }
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

async function cloneAndProcessRepo(repoUrl, options) {
  const tempDir = path.join(__dirname, 'temp-repo');
  const outputFrames = [];
  
  // Clean up any existing temp directory
  await fs.remove(tempDir);
  
  console.log(`📥 Cloning repository: ${repoUrl}`);
  const git = simpleGit();
  await git.clone(repoUrl, tempDir);
  
  const repoGit = simpleGit(tempDir);
  
  // Get commit history
  console.log(`📚 Fetching commit history (branch: ${options.branch})...`);
  const log = await repoGit.log({
    from: options.branch,
    maxCount: parseInt(options.limit)
  });
  
  const commits = log.all.reverse(); // Start from oldest
  console.log(`✅ Found ${commits.length} commits`);
  
  const executor = new ProjectExecutor(tempDir, options);
  let server = null;
  
  try {
    for (let i = 0; i < commits.length; i++) {
      const commit = commits[i];
      console.log(`\n🔄 Processing commit ${i + 1}/${commits.length}: ${commit.hash.substring(0, 7)}`);
      console.log(`   ${commit.message}`);
      
      // Checkout commit
      await repoGit.checkout(commit.hash);
      
      // Install dependencies for this commit
      await executor.installDependencies();
      
      // Start server if needed (only once, restart if needed)
      const projectType = await executor.detectProjectType();
      if ((projectType === 'web' || projectType === 'canvas') && !server) {
        server = await executor.startServer();
      }
      
      // Capture output
      console.log(`📸 Capturing output...`);
      const frameData = await executor.captureOutput();
      
      outputFrames.push({
        data: frameData,
        commit: commit,
        index: i
      });
      
      // Progress indicator
      const progress = Math.round(((i + 1) / commits.length) * 100);
      console.log(`   ✅ Frame ${i + 1} captured (${progress}%)`);
    }
  } finally {
    // Cleanup
    if (server) server.kill();
    await executor.cleanup();
    await fs.remove(tempDir);
  }
  
  return outputFrames;
}

async function createGIF(frames, outputPath, options) {
  const encoder = new GIFEncoder(parseInt(options.width), parseInt(options.height));
  const stream = encoder.createReadStream();
  
  stream.pipe(fs.createWriteStream(outputPath));
  
  encoder.start();
  encoder.setRepeat(0);
  encoder.setDelay(parseInt(options.delay));
  encoder.setQuality(10);
  
  console.log(`\n🎬 Creating GIF with ${frames.length} frames...`);
  
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    
    // Create canvas from captured data
    const canvas = createCanvas(parseInt(options.width), parseInt(options.height));
    const ctx = canvas.getContext('2d');
    
    if (Buffer.isBuffer(frame.data)) {
      // Load and draw the captured image
      const { loadImage } = require('canvas');
      const img = await loadImage(frame.data);
      ctx.drawImage(img, 0, 0);
    } else {
      // Draw text-based output
      ctx.putImageData(frame.data, 0, 0);
    }
    
    // Add commit info overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, 80);
    
    ctx.fillStyle = '#fff';
    ctx.font = '14px monospace';
    ctx.fillText(`Commit ${frame.index + 1}/${frames.length}: ${frame.commit.hash.substring(0, 7)}`, 10, 25);
    ctx.fillText(`${frame.commit.message.substring(0, 80)}`, 10, 45);
    ctx.fillText(`${new Date(frame.commit.date).toLocaleString()}`, 10, 65);
    
    encoder.addFrame(ctx);
    
    const progress = Math.round(((i + 1) / frames.length) * 100);
    process.stdout.write(`\rProgress: ${progress}%`);
  }
  
  encoder.finish();
  console.log('\n✅ GIF created successfully!');
}

async function main() {
  try {
    console.log('🎬 Commit Flipbook - Code Output Evolution');
    console.log('==========================================\n');
    
    const frames = await cloneAndProcessRepo(repoUrl, options);
    
    if (frames.length === 0) {
      console.error('❌ No frames captured');
      process.exit(1);
    }
    
    await createGIF(frames, options.output, options);
    console.log(`📁 GIF saved to: ${path.resolve(options.output)}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();