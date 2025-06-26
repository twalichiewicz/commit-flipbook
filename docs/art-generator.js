// Generative Art from GitHub Commits
// Creates dynamic visualizations from repository evolution

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
        
        // Particle system for dynamic effects
        this.particles = [];
        this.flowField = [];
        
        this.init();
    }
    
    init() {
        // Set canvas size
        this.canvas.width = 800;
        this.canvas.height = 800;
        
        // Event listeners
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        this.playBtn.addEventListener('click', () => this.togglePlayback());
        this.speedSlider.addEventListener('input', () => this.updateSpeedDisplay());
        document.getElementById('download-btn').addEventListener('click', () => this.downloadGIF());
        document.getElementById('share-btn').addEventListener('click', () => this.share());
        
        // Gallery items
        document.querySelectorAll('.gallery-item').forEach(item => {
            item.addEventListener('click', () => {
                this.repoUrlInput.value = item.dataset.repo;
                this.form.dispatchEvent(new Event('submit'));
            });
        });
        
        // Initialize speed display
        this.updateSpeedDisplay();
        
        // Set random placeholder library
        this.setRandomPlaceholderLibrary();
    }
    
    setRandomPlaceholderLibrary() {
        const libraries = ['React', 'Vue', 'TensorFlow', 'Bitcoin'];
        const randomLibrary = libraries[Math.floor(Math.random() * libraries.length)];
        const placeholderElement = document.getElementById('placeholder-library');
        if (placeholderElement) {
            placeholderElement.textContent = randomLibrary;
        }
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
            
            // Fetch commits with more detail
            this.showStatus('Loading commit history...');
            const commits = await this.fetchCommitsWithStats(owner, repo, 30);
            
            if (commits.length === 0) {
                throw new Error('No commits found');
            }
            
            // Analyze repository patterns
            const analysis = this.analyzeRepository(commits);
            
            // Generate art frames
            this.frames = [];
            
            // Create frames showing evolution
            for (let i = 0; i < commits.length; i++) {
                this.showStatus(`Creating visualization... ${i + 1}/${commits.length}`);
                this.updateProgress((i + 1) / commits.length * 100);
                
                const frame = await this.createArtFrame(
                    commits.slice(0, i + 1), 
                    repoInfo,
                    analysis,
                    i / commits.length
                );
                this.frames.push(frame);
            }
            
            // Add some extra frames for smooth loop
            for (let i = 0; i < 5; i++) {
                const frame = await this.createArtFrame(
                    commits, 
                    repoInfo,
                    analysis,
                    1 + (i * 0.1)
                );
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
    
    async fetchCommitsWithStats(owner, repo, limit = 30) {
        // First get commits
        const commitsResponse = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/commits?per_page=${limit}`
        );
        if (!commitsResponse.ok) throw new Error('Failed to fetch commits');
        const commits = await commitsResponse.json();
        
        // Get additional stats for visualization
        const detailedCommits = [];
        for (let i = 0; i < Math.min(commits.length, 10); i++) {
            try {
                const statsResponse = await fetch(
                    `https://api.github.com/repos/${owner}/${repo}/commits/${commits[i].sha}`
                );
                if (statsResponse.ok) {
                    const detailed = await statsResponse.json();
                    detailedCommits.push({
                        ...commits[i],
                        stats: detailed.stats,
                        files: detailed.files?.length || 0
                    });
                } else {
                    detailedCommits.push(commits[i]);
                }
            } catch {
                detailedCommits.push(commits[i]);
            }
        }
        
        // Add remaining commits without detailed stats
        for (let i = 10; i < commits.length; i++) {
            detailedCommits.push(commits[i]);
        }
        
        return detailedCommits.reverse(); // Oldest first
    }
    
    analyzeRepository(commits) {
        // Analyze patterns in the repository
        const authors = new Map();
        let maxChanges = 0;
        let totalChanges = 0;
        
        commits.forEach(commit => {
            const author = commit.commit.author.email;
            authors.set(author, (authors.get(author) || 0) + 1);
            
            const changes = (commit.stats?.additions || 0) + (commit.stats?.deletions || 0);
            maxChanges = Math.max(maxChanges, changes);
            totalChanges += changes;
        });
        
        return {
            authors: Array.from(authors.keys()),
            authorColors: this.generateAuthorColors(authors),
            maxChanges,
            avgChanges: totalChanges / commits.length,
            totalCommits: commits.length
        };
    }
    
    generateAuthorColors(authors) {
        const colors = new Map();
        const authorList = Array.from(authors.keys());
        
        authorList.forEach((author, index) => {
            const hue = (index * 360 / authorList.length) % 360;
            colors.set(author, hue);
        });
        
        return colors;
    }
    
    async createArtFrame(commits, repoInfo, analysis, progress) {
        // Create offscreen canvas
        const frameCanvas = document.createElement('canvas');
        frameCanvas.width = this.canvas.width;
        frameCanvas.height = this.canvas.height;
        const ctx = frameCanvas.getContext('2d');
        
        // Dark background with subtle gradient
        const bgGradient = ctx.createRadialGradient(
            frameCanvas.width / 2, frameCanvas.height / 2, 0,
            frameCanvas.width / 2, frameCanvas.height / 2, frameCanvas.width / 2
        );
        bgGradient.addColorStop(0, '#0a0a0a');
        bgGradient.addColorStop(1, '#000000');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, frameCanvas.width, frameCanvas.height);
        
        // Create flow field visualization
        this.renderFlowField(ctx, commits, analysis, progress);
        
        // Create commit constellation
        this.renderCommitConstellation(ctx, commits, analysis, progress);
        
        // Add activity waves
        this.renderActivityWaves(ctx, commits, analysis, progress);
        
        // Add metadata overlay
        this.renderMetadata(ctx, repoInfo, commits, progress);
        
        return frameCanvas;
    }
    
    renderFlowField(ctx, commits, analysis, progress) {
        // Create a dynamic flow field based on commit activity
        const gridSize = 40;
        const cols = Math.ceil(ctx.canvas.width / gridSize);
        const rows = Math.ceil(ctx.canvas.height / gridSize);
        
        // Generate flow field based on commit density
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const px = x * gridSize + gridSize / 2;
                const py = y * gridSize + gridSize / 2;
                
                // Calculate field strength based on nearby commits
                let fieldStrength = 0;
                let fieldAngle = 0;
                
                commits.forEach((commit, index) => {
                    if (index / commits.length > progress) return;
                    
                    const commitX = (index / commits.length) * ctx.canvas.width;
                    const commitY = ctx.canvas.height / 2 + Math.sin(index * 0.5) * 100;
                    
                    const dx = commitX - px;
                    const dy = commitY - py;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < 200) {
                        const influence = 1 - (distance / 200);
                        fieldStrength += influence;
                        fieldAngle += Math.atan2(dy, dx) * influence;
                    }
                });
                
                // Draw flow lines
                if (fieldStrength > 0.1) {
                    ctx.save();
                    ctx.translate(px, py);
                    ctx.rotate(fieldAngle);
                    
                    const alpha = Math.min(fieldStrength * 0.3, 0.5);
                    ctx.strokeStyle = `rgba(100, 200, 255, ${alpha})`;
                    ctx.lineWidth = 1;
                    
                    ctx.beginPath();
                    ctx.moveTo(-gridSize * 0.3, 0);
                    ctx.lineTo(gridSize * 0.3, 0);
                    ctx.stroke();
                    
                    ctx.restore();
                }
            }
        }
    }
    
    renderCommitConstellation(ctx, commits, analysis, progress) {
        // Draw commits as interconnected constellation
        const processedCommits = commits.filter((_, index) => index / commits.length <= progress);
        
        // Draw connections first
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        
        processedCommits.forEach((commit, index) => {
            if (index === 0) return;
            
            const prevIndex = index - 1;
            const x1 = (prevIndex / commits.length) * ctx.canvas.width * 0.8 + ctx.canvas.width * 0.1;
            const y1 = this.getCommitY(prevIndex, commits.length);
            const x2 = (index / commits.length) * ctx.canvas.width * 0.8 + ctx.canvas.width * 0.1;
            const y2 = this.getCommitY(index, commits.length);
            
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            
            // Curved connection
            const cx = (x1 + x2) / 2;
            const cy = (y1 + y2) / 2 - Math.abs(x2 - x1) * 0.2;
            ctx.quadraticCurveTo(cx, cy, x2, y2);
            ctx.stroke();
        });
        
        // Draw commit nodes
        processedCommits.forEach((commit, index) => {
            const x = (index / commits.length) * ctx.canvas.width * 0.8 + ctx.canvas.width * 0.1;
            const y = this.getCommitY(index, commits.length);
            
            // Get commit stats
            const additions = commit.stats?.additions || Math.random() * 100;
            const deletions = commit.stats?.deletions || Math.random() * 50;
            const changes = additions + deletions;
            
            // Node size based on changes
            const baseSize = 4;
            const size = baseSize + Math.sqrt(changes) * 0.5;
            
            // Color based on author
            const authorHue = analysis.authorColors.get(commit.commit.author.email) || 0;
            const saturation = 60 + (additions / (changes || 1)) * 40;
            
            // Glow effect
            const glowGradient = ctx.createRadialGradient(x, y, 0, x, y, size * 4);
            glowGradient.addColorStop(0, `hsla(${authorHue}, ${saturation}%, 70%, 0.8)`);
            glowGradient.addColorStop(0.5, `hsla(${authorHue}, ${saturation}%, 60%, 0.3)`);
            glowGradient.addColorStop(1, 'transparent');
            
            ctx.fillStyle = glowGradient;
            ctx.beginPath();
            ctx.arc(x, y, size * 4, 0, Math.PI * 2);
            ctx.fill();
            
            // Core node
            ctx.fillStyle = `hsl(${authorHue}, ${saturation}%, 80%)`;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
            
            // Pulse effect for recent commits
            const recency = index / commits.length;
            if (recency > progress - 0.1) {
                const pulseSize = size * (1 + (1 - (recency - (progress - 0.1)) / 0.1) * 0.5);
                ctx.strokeStyle = `hsla(${authorHue}, ${saturation}%, 90%, ${1 - (recency - (progress - 0.1)) / 0.1})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(x, y, pulseSize, 0, Math.PI * 2);
                ctx.stroke();
            }
        });
    }
    
    getCommitY(index, total) {
        // Create interesting vertical distribution
        const centerY = this.canvas.height / 2;
        const amplitude = this.canvas.height * 0.3;
        
        // Multiple wave functions for organic feel
        const wave1 = Math.sin(index * 0.3) * amplitude * 0.5;
        const wave2 = Math.sin(index * 0.7 + 1) * amplitude * 0.3;
        const wave3 = Math.cos(index * 0.1) * amplitude * 0.2;
        
        return centerY + wave1 + wave2 + wave3;
    }
    
    renderActivityWaves(ctx, commits, analysis, progress) {
        // Create waves representing activity intensity
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        
        // Group commits by time periods
        const periods = 10;
        const commitsPerPeriod = Math.ceil(commits.length / periods);
        
        for (let p = 0; p < periods; p++) {
            const startIdx = p * commitsPerPeriod;
            const endIdx = Math.min((p + 1) * commitsPerPeriod, commits.length);
            const periodCommits = commits.slice(startIdx, endIdx);
            
            if (endIdx / commits.length > progress) continue;
            
            // Calculate activity for this period
            let activity = 0;
            periodCommits.forEach(commit => {
                const changes = (commit.stats?.additions || 10) + (commit.stats?.deletions || 5);
                activity += changes;
            });
            
            // Normalize activity
            activity = Math.min(activity / 1000, 1);
            
            // Draw wave
            const x = (p / periods) * ctx.canvas.width;
            const waveHeight = activity * 100;
            const waveWidth = ctx.canvas.width / periods;
            
            const gradient = ctx.createLinearGradient(x, ctx.canvas.height, x, ctx.canvas.height - waveHeight);
            gradient.addColorStop(0, 'rgba(100, 200, 255, 0)');
            gradient.addColorStop(1, `rgba(100, 200, 255, ${activity * 0.3})`);
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.moveTo(x, ctx.canvas.height);
            
            for (let i = 0; i <= 20; i++) {
                const wx = x + (i / 20) * waveWidth;
                const wy = ctx.canvas.height - waveHeight * (0.5 + Math.sin(i * 0.5 + p) * 0.5);
                ctx.lineTo(wx, wy);
            }
            
            ctx.lineTo(x + waveWidth, ctx.canvas.height);
            ctx.closePath();
            ctx.fill();
        }
        
        ctx.restore();
    }
    
    renderMetadata(ctx, repoInfo, commits, progress) {
        // Add subtle metadata
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = '16px Inter, sans-serif';
        ctx.fillText(repoInfo.full_name, 20, 30);
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '12px Inter, sans-serif';
        
        const currentCommits = Math.floor(commits.length * progress);
        ctx.fillText(`${currentCommits} commits`, 20, 50);
        
        if (commits[currentCommits - 1]) {
            const lastCommit = commits[currentCommits - 1];
            const date = new Date(lastCommit.commit.author.date).toLocaleDateString();
            ctx.fillText(date, 20, ctx.canvas.height - 20);
        }
    }
    
    playAnimation() {
        if (this.frames.length === 0) return;
        
        const animate = (timestamp) => {
            if (!this.isPlaying) return;
            
            // Exponential speed mapping - slider 0-100, where 100 is fastest
            const sliderValue = parseInt(this.speedSlider.value);
            const normalizedValue = sliderValue / 100; // 0 to 1
            
            // Use exponential curve: slow start, fast end
            // Map to delay: 2000ms (slow) to 50ms (very fast)
            const minDelay = 50;
            const maxDelay = 2000;
            const delay = maxDelay * Math.pow(minDelay / maxDelay, normalizedValue);
            
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
    
    updateSpeedDisplay() {
        // Update visual feedback for speed with graded steps
        const sliderValue = parseInt(this.speedSlider.value);
        const speedLabel = document.querySelector('.speed-label');
        
        // Define speed ranges with exponential feel
        if (sliderValue < 15) {
            speedLabel.textContent = 'Slow';
        } else if (sliderValue < 40) {
            speedLabel.textContent = 'Normal';
        } else if (sliderValue < 70) {
            speedLabel.textContent = 'Fast';
        } else {
            speedLabel.textContent = 'Very Fast';
        }
    }
    
    async downloadGIF() {
        if (this.frames.length === 0) return;
        
        this.showStatus('Creating image...');
        
        // For now, download current frame as PNG
        // In production, use gif.js or similar library
        this.canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${this.repoUrlInput.value.split('/').pop()}-commits.png`;
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