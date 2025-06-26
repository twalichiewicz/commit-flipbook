// Generative Art from GitHub Commits
// Creates beautiful visualizations from repository commit history

class CommitArtGenerator {
    constructor() {
        this.form = document.getElementById('flipbook-form');
        this.repoUrlInput = document.getElementById('repo-url');
        this.generateBtn = document.getElementById('generate-btn');
        this.statusDiv = document.getElementById('status');
        this.resultDiv = document.getElementById('result');
        this.errorDiv = document.getElementById('error');
        this.canvas = document.getElementById('result-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.playBtn = document.getElementById('play-btn');
        this.speedSlider = document.getElementById('speed-slider');
        
        this.frames = [];
        this.currentFrame = 0;
        this.isPlaying = false;
        this.animationId = null;
        this.lastFrameTime = 0;
        
        this.init();
    }
    
    init() {
        // Set canvas size
        this.canvas.width = 800;
        this.canvas.height = 800;
        
        // Event listeners
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        this.playBtn.addEventListener('click', () => this.togglePlayback());
        this.speedSlider.addEventListener('input', () => this.updateSpeed());
        document.getElementById('download-btn').addEventListener('click', () => this.downloadGIF());
        document.getElementById('share-btn').addEventListener('click', () => this.share());
        
        // Gallery items
        document.querySelectorAll('.gallery-item').forEach(item => {
            item.addEventListener('click', () => {
                this.repoUrlInput.value = item.dataset.repo;
                this.form.dispatchEvent(new Event('submit'));
            });
        });
    }
    
    async handleSubmit(e) {
        e.preventDefault();
        
        this.hideAll();
        this.setLoadingState(true);
        this.showStatus('Analyzing repository...');
        
        try {
            const { owner, repo } = this.parseGitHubUrl(this.repoUrlInput.value);
            
            // Fetch repository info
            const repoInfo = await this.fetchRepoInfo(owner, repo);
            
            // Fetch commits
            this.showStatus('Loading commit history...');
            const commits = await this.fetchCommits(owner, repo, 50); // Get 50 commits for good animation
            
            if (commits.length === 0) {
                throw new Error('No commits found');
            }
            
            // Generate art frames
            this.frames = [];
            const totalCommits = commits.length;
            
            for (let i = 0; i < totalCommits; i++) {
                this.showStatus(`Creating art... ${i + 1}/${totalCommits}`);
                this.updateProgress((i + 1) / totalCommits * 100);
                
                const frame = this.createArtFrame(commits.slice(0, i + 1), repoInfo);
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
        return { owner: match[1], repo: match[2].replace('.git', '') };
    }
    
    async fetchRepoInfo(owner, repo) {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
        if (!response.ok) throw new Error('Repository not found');
        return await response.json();
    }
    
    async fetchCommits(owner, repo, limit = 50) {
        const response = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/commits?per_page=${limit}`
        );
        if (!response.ok) throw new Error('Failed to fetch commits');
        const commits = await response.json();
        return commits.reverse(); // Oldest first
    }
    
    createArtFrame(commits, repoInfo) {
        // Create offscreen canvas
        const frameCanvas = document.createElement('canvas');
        frameCanvas.width = this.canvas.width;
        frameCanvas.height = this.canvas.height;
        const ctx = frameCanvas.getContext('2d');
        
        // Background
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, frameCanvas.width, frameCanvas.height);
        
        // Create generative art based on commits
        const centerX = frameCanvas.width / 2;
        const centerY = frameCanvas.height / 2;
        
        // Draw organic growth pattern
        commits.forEach((commit, index) => {
            const progress = index / commits.length;
            const angle = index * 0.618033988749895 * Math.PI * 2; // Golden ratio
            const radius = Math.sqrt(index) * 15;
            
            // Position based on spiral
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            
            // Size based on commit impact
            const additions = commit.stats?.additions || 0;
            const deletions = commit.stats?.deletions || 0;
            const changes = additions + deletions;
            const size = Math.min(Math.sqrt(changes) * 2 + 3, 30);
            
            // Color based on author and time
            const authorHash = this.hashCode(commit.commit.author.email);
            const hue = (authorHash % 360);
            const saturation = 50 + (progress * 50);
            const lightness = 20 + (progress * 40);
            
            // Draw connection lines
            if (index > 0) {
                const prevCommit = commits[index - 1];
                const prevAngle = (index - 1) * 0.618033988749895 * Math.PI * 2;
                const prevRadius = Math.sqrt(index - 1) * 15;
                const prevX = centerX + Math.cos(prevAngle) * prevRadius;
                const prevY = centerY + Math.sin(prevAngle) * prevRadius;
                
                ctx.strokeStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, 0.2)`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(prevX, prevY);
                ctx.lineTo(x, y);
                ctx.stroke();
            }
            
            // Draw commit node
            ctx.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, 0.8)`;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
            
            // Add glow effect
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, size * 2);
            gradient.addColorStop(0, `hsla(${hue}, ${saturation}%, ${lightness}%, 0.3)`);
            gradient.addColorStop(1, 'transparent');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x, y, size * 2, 0, Math.PI * 2);
            ctx.fill();
        });
        
        // Add metadata
        ctx.fillStyle = '#fff';
        ctx.font = '14px Inter, sans-serif';
        ctx.fillText(repoInfo.full_name, 20, 30);
        ctx.fillStyle = '#666';
        ctx.font = '12px Inter, sans-serif';
        ctx.fillText(`${commits.length} commits`, 20, 50);
        
        // Add timestamp
        if (commits.length > 0) {
            const lastCommit = commits[commits.length - 1];
            const date = new Date(lastCommit.commit.author.date).toLocaleDateString();
            ctx.fillText(date, 20, frameCanvas.height - 20);
        }
        
        return frameCanvas;
    }
    
    hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }
    
    playAnimation() {
        if (this.frames.length === 0) return;
        
        const animate = (timestamp) => {
            if (!this.isPlaying) return;
            
            const delay = parseInt(this.speedSlider.value);
            
            if (timestamp - this.lastFrameTime > delay) {
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                this.ctx.drawImage(this.frames[this.currentFrame], 0, 0);
                
                this.currentFrame = (this.currentFrame + 1) % this.frames.length;
                this.lastFrameTime = timestamp;
            }
            
            this.animationId = requestAnimationFrame(animate);
        };
        
        this.isPlaying = true;
        this.updatePlayButton();
        this.animationId = requestAnimationFrame(animate);
    }
    
    togglePlayback() {
        if (this.isPlaying) {
            this.isPlaying = false;
            if (this.animationId) {
                cancelAnimationFrame(this.animationId);
            }
        } else {
            this.playAnimation();
        }
        this.updatePlayButton();
    }
    
    updatePlayButton() {
        const playIcon = this.playBtn.querySelector('.play-icon');
        const pauseIcon = this.playBtn.querySelector('.pause-icon');
        
        if (this.isPlaying) {
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'inline';
        } else {
            playIcon.style.display = 'inline';
            pauseIcon.style.display = 'none';
        }
    }
    
    updateSpeed() {
        // Speed updates automatically on next frame
    }
    
    async downloadGIF() {
        if (this.frames.length === 0) return;
        
        this.showStatus('Creating GIF...');
        
        // Create GIF using canvas frames
        const delay = parseInt(this.speedSlider.value);
        
        // For now, download current frame as PNG
        // In production, use gif.js or similar library
        this.canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'commit-flipbook.png';
            a.click();
            URL.revokeObjectURL(url);
            this.hideStatus();
        });
    }
    
    share() {
        const { owner, repo } = this.parseGitHubUrl(this.repoUrlInput.value);
        const text = `Check out this beautiful visualization of ${owner}/${repo}'s commit history!`;
        
        if (navigator.share) {
            navigator.share({
                title: 'Commit Flipbook',
                text: text,
                url: window.location.href
            }).catch(err => console.log('Share cancelled', err));
        } else {
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
    new CommitArtGenerator();
});