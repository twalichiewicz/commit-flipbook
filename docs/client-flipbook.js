// Client-side Commit Flipbook - uses GitHub API directly, no server needed

class CommitFlipbook {
    constructor() {
        this.form = document.getElementById('flipbook-form');
        this.repoUrlInput = document.getElementById('repo-url');
        this.filePathInput = document.getElementById('file-path');
        this.branchInput = document.getElementById('branch');
        this.limitInput = document.getElementById('limit');
        this.delayInput = document.getElementById('delay');
        this.generateBtn = document.getElementById('generate-btn');
        this.statusDiv = document.getElementById('status');
        this.resultDiv = document.getElementById('result');
        this.errorDiv = document.getElementById('error');
        this.canvas = document.getElementById('result-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.frames = [];
        this.currentFrame = 0;
        this.isPlaying = false;
        this.animationId = null;
        
        this.init();
    }
    
    init() {
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        document.getElementById('play-btn').addEventListener('click', () => this.togglePlayback());
        document.getElementById('download-btn').addEventListener('click', () => this.downloadGIF());
        document.getElementById('share-btn').addEventListener('click', () => this.share());
        
        // Set canvas size
        this.canvas.width = 800;
        this.canvas.height = 600;
    }
    
    async handleSubmit(e) {
        e.preventDefault();
        
        this.hideAll();
        this.setLoadingState(true);
        this.showStatus('Fetching repository information...');
        
        try {
            const { owner, repo } = this.parseGitHubUrl(this.repoUrlInput.value);
            const branch = this.branchInput.value || 'main';
            const limit = parseInt(this.limitInput.value) || 20;
            const filePath = this.filePathInput.value;
            
            if (!filePath) {
                throw new Error('Please specify a file path to track');
            }
            
            // Fetch commits
            this.showStatus('Fetching commit history...');
            const commits = await this.fetchCommits(owner, repo, branch, filePath, limit);
            
            if (commits.length === 0) {
                throw new Error('No commits found for this file');
            }
            
            // Process commits
            this.frames = [];
            for (let i = 0; i < commits.length; i++) {
                const commit = commits[i];
                this.showStatus(`Processing commit ${i + 1} of ${commits.length}...`);
                this.updateProgress((i + 1) / commits.length * 100);
                
                const frame = await this.createFrame(owner, repo, commit, filePath);
                this.frames.push(frame);
            }
            
            // Show result
            this.showResult();
            this.playAnimation();
            
        } catch (error) {
            this.showError(error.message);
        } finally {
            this.setLoadingState(false);
        }
    }
    
    parseGitHubUrl(url) {
        const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
        if (!match) throw new Error('Invalid GitHub URL');
        return { owner: match[1], repo: match[2] };
    }
    
    async fetchCommits(owner, repo, branch, path, limit) {
        const url = `https://api.github.com/repos/${owner}/${repo}/commits?sha=${branch}&path=${path}&per_page=${limit}`;
        
        const response = await fetch(url);
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('Repository, branch, or file not found');
            }
            throw new Error(`GitHub API error: ${response.status}`);
        }
        
        const commits = await response.json();
        return commits.reverse(); // Oldest first
    }
    
    async fetchFileContent(owner, repo, path, sha) {
        const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${sha}`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                if (response.status === 404) {
                    return null; // File doesn't exist in this commit
                }
                throw new Error(`Failed to fetch file: ${response.status}`);
            }
            
            const data = await response.json();
            if (data.content) {
                return atob(data.content); // Decode base64
            }
            return null;
        } catch (error) {
            console.error('Error fetching file:', error);
            return null;
        }
    }
    
    async createFrame(owner, repo, commit, filePath) {
        const content = await this.fetchFileContent(owner, repo, filePath, commit.sha);
        
        // Create offscreen canvas for this frame
        const frameCanvas = document.createElement('canvas');
        frameCanvas.width = this.canvas.width;
        frameCanvas.height = this.canvas.height;
        const ctx = frameCanvas.getContext('2d');
        
        // Background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, frameCanvas.width, frameCanvas.height);
        
        // Header
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(0, 0, frameCanvas.width, 60);
        
        // Title
        ctx.fillStyle = '#000';
        ctx.font = '16px Inter, monospace';
        ctx.fillText(`${filePath}`, 20, 25);
        
        // Commit info
        ctx.font = '12px Inter, monospace';
        ctx.fillStyle = '#666';
        ctx.fillText(`${commit.sha.substring(0, 7)} • ${new Date(commit.commit.author.date).toLocaleDateString()}`, 20, 45);
        ctx.fillText(`${commit.commit.message.split('\n')[0].substring(0, 50)}...`, 300, 45);
        
        // Code content
        if (content) {
            this.renderCode(ctx, content, filePath);
        } else {
            ctx.fillStyle = '#999';
            ctx.font = '14px Inter, monospace';
            ctx.fillText('File not found in this commit', 20, 100);
        }
        
        return frameCanvas;
    }
    
    renderCode(ctx, content, filePath) {
        // Simple code rendering - in production, use syntax highlighting
        const lines = content.split('\n').slice(0, 30); // Show first 30 lines
        const lineHeight = 18;
        const startY = 80;
        const lineNumberWidth = 50;
        
        ctx.font = '13px "Fira Code", monospace';
        
        lines.forEach((line, index) => {
            const y = startY + (index * lineHeight);
            
            // Line number
            ctx.fillStyle = '#999';
            ctx.textAlign = 'right';
            ctx.fillText(index + 1, lineNumberWidth - 10, y);
            
            // Code line
            ctx.fillStyle = '#000';
            ctx.textAlign = 'left';
            ctx.fillText(line.substring(0, 100), lineNumberWidth + 10, y);
        });
        
        if (content.split('\n').length > 30) {
            ctx.fillStyle = '#999';
            ctx.fillText('...', lineNumberWidth + 10, startY + (30 * lineHeight));
        }
    }
    
    playAnimation() {
        if (this.frames.length === 0) return;
        
        const delay = parseInt(this.delayInput.value) || 500;
        let lastTime = 0;
        
        const animate = (timestamp) => {
            if (!this.isPlaying) return;
            
            if (timestamp - lastTime > delay) {
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                this.ctx.drawImage(this.frames[this.currentFrame], 0, 0);
                
                this.currentFrame = (this.currentFrame + 1) % this.frames.length;
                lastTime = timestamp;
            }
            
            this.animationId = requestAnimationFrame(animate);
        };
        
        this.isPlaying = true;
        this.animationId = requestAnimationFrame(animate);
        document.getElementById('play-btn').textContent = 'Pause';
    }
    
    togglePlayback() {
        if (this.isPlaying) {
            this.isPlaying = false;
            if (this.animationId) {
                cancelAnimationFrame(this.animationId);
            }
            document.getElementById('play-btn').textContent = 'Play';
        } else {
            this.playAnimation();
        }
    }
    
    async downloadGIF() {
        if (this.frames.length === 0) return;
        
        this.showStatus('Creating GIF...');
        
        // Use gif.js to create animated GIF
        const gif = new GIF({
            workers: 2,
            quality: 10,
            width: this.canvas.width,
            height: this.canvas.height,
            workerScript: 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js'
        });
        
        const delay = parseInt(this.delayInput.value) || 500;
        
        this.frames.forEach(frame => {
            gif.addFrame(frame, { delay });
        });
        
        gif.on('finished', (blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'commit-flipbook.gif';
            a.click();
            URL.revokeObjectURL(url);
            this.hideStatus();
        });
        
        gif.render();
    }
    
    share() {
        const { owner, repo } = this.parseGitHubUrl(this.repoUrlInput.value);
        const filePath = this.filePathInput.value;
        const text = `Check out how ${filePath} evolved in ${owner}/${repo}!`;
        
        if (navigator.share) {
            navigator.share({
                title: 'Commit Flipbook',
                text: text,
                url: window.location.href
            }).catch(err => console.log('Share cancelled', err));
        } else {
            // Copy link to clipboard
            navigator.clipboard.writeText(window.location.href).then(() => {
                const btn = document.getElementById('share-btn');
                const originalText = btn.textContent;
                btn.textContent = 'Link Copied!';
                setTimeout(() => {
                    btn.textContent = originalText;
                }, 2000);
            });
        }
    }
    
    showStatus(message) {
        this.hideAll();
        this.statusDiv.style.display = 'block';
        this.statusDiv.querySelector('.status-message').textContent = message;
    }
    
    updateProgress(percent) {
        this.statusDiv.querySelector('.progress-bar').style.width = `${percent}%`;
    }
    
    hideStatus() {
        this.statusDiv.style.display = 'none';
    }
    
    showResult() {
        this.hideAll();
        this.resultDiv.style.display = 'block';
    }
    
    showError(message) {
        this.hideAll();
        this.errorDiv.style.display = 'block';
        this.errorDiv.querySelector('.error-message').textContent = message;
    }
    
    hideAll() {
        this.statusDiv.style.display = 'none';
        this.resultDiv.style.display = 'none';
        this.errorDiv.style.display = 'none';
    }
    
    setLoadingState(loading) {
        this.generateBtn.disabled = loading;
        this.generateBtn.querySelector('.button-text').style.display = loading ? 'none' : 'inline';
        this.generateBtn.querySelector('.button-loader').style.display = loading ? 'inline' : 'none';
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new CommitFlipbook();
});