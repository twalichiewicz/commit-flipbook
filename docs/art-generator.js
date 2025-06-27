// Generative Art from GitHub Commits
// Creates dynamic visualizations from repository evolution

console.log('ArtGenerator script loaded');

class SimpleVisualizer {
    constructor(canvas) {
        console.log('SimpleVisualizer constructor called');
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.animationId = null;
        this.time = 0;
        
        // Set proper canvas size
        this.resize();
    }
    
    resize() {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        // Default to reasonable size if rect is empty
        const width = rect.width || 800;
        const height = rect.height || 400;
        
        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;
        
        this.ctx.scale(dpr, dpr);
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';
        
        console.log('Canvas resized to:', { width, height, rect });
    }
    
    async visualizeRepository(repoData) {
        const { info, commits, languages, contributors } = repoData;
        
        // Generate unique signature based on repo
        const signature = this.generateSignature(repoData);
        
        // Start animation
        this.animate(signature, repoData);
    }
    
    generateSignature(repoData) {
        const { info, languages, contributors, commits } = repoData;
        const repoName = info.full_name;
        
        // Create deterministic values based on repo name
        let hash = 0;
        for (let i = 0; i < repoName.length; i++) {
            hash = ((hash << 5) - hash + repoName.charCodeAt(i)) & 0xffffffff;
        }
        
        return {
            hash: Math.abs(hash),
            primaryHue: Math.abs(hash) % 360,
            secondaryHue: (Math.abs(hash) + 180) % 360,
            complexity: Math.min(Object.keys(languages || {}).length + (contributors || []).length / 10, 10),
            energy: Math.min((commits || []).length / 10, 100),
            style: ['spiral', 'burst', 'wave', 'grid'][Math.abs(hash) % 4]
        };
    }
    
    animate(signature, repoData) {
        const render = () => {
            this.time += 0.02;
            this.clear();
            this.drawVisualization(signature, repoData);
            this.animationId = requestAnimationFrame(render);
        };
        
        render();
    }
    
    clear() {
        this.ctx.fillStyle = `hsl(${this.signature?.primaryHue || 220}, 20%, 5%)`;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    drawVisualization(signature, repoData) {
        this.signature = signature;
        const { commits, languages, contributors } = repoData;
        
        const centerX = (this.canvas.clientWidth || this.canvas.width) / 2;
        const centerY = (this.canvas.clientHeight || this.canvas.height) / 2;
        
        // Draw background particles
        this.drawBackgroundParticles(centerX, centerY, signature);
        
        // Draw main visualization based on style
        switch (signature.style) {
            case 'spiral':
                this.drawSpiral(centerX, centerY, signature, commits);
                break;
            case 'burst':
                this.drawBurst(centerX, centerY, signature, commits);
                break;
            case 'wave':
                this.drawWave(centerX, centerY, signature, commits);
                break;
            case 'grid':
                this.drawGrid(centerX, centerY, signature, commits);
                break;
        }
        
        // Draw language rings
        this.drawLanguageRings(centerX, centerY, signature, languages);
        
        // Draw repo name
        this.drawRepoName(signature, repoData.info);
    }
    
    drawBackgroundParticles(centerX, centerY, signature) {
        const particleCount = signature.complexity * 10 + 20;
        
        for (let i = 0; i < particleCount; i++) {
            const angle = (i / particleCount) * Math.PI * 2 + this.time * 0.1;
            const radius = 50 + Math.sin(this.time + i * 0.1) * 20;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            
            this.ctx.fillStyle = `hsla(${signature.primaryHue}, 60%, 70%, 0.3)`;
            this.ctx.beginPath();
            this.ctx.arc(x, y, 1 + Math.sin(this.time + i) * 0.5, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }
    
    drawSpiral(centerX, centerY, signature, commits) {
        const commitCount = Math.min((commits || []).length, 50);
        
        for (let i = 0; i < commitCount; i++) {
            const angle = i * 0.3 + this.time;
            const radius = i * 3 + Math.sin(this.time + i * 0.1) * 10;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            
            const hue = (signature.primaryHue + i * 5) % 360;
            const size = 2 + Math.sin(this.time + i * 0.2) * 1;
            
            this.ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
            this.ctx.beginPath();
            this.ctx.arc(x, y, size, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }
    
    drawBurst(centerX, centerY, signature, commits) {
        const rays = signature.complexity * 2 + 8;
        
        for (let i = 0; i < rays; i++) {
            const angle = (i / rays) * Math.PI * 2 + this.time * 0.5;
            const length = 80 + Math.sin(this.time + i) * 30;
            
            this.ctx.strokeStyle = `hsla(${signature.secondaryHue}, 80%, 60%, 0.7)`;
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(centerX, centerY);
            this.ctx.lineTo(
                centerX + Math.cos(angle) * length,
                centerY + Math.sin(angle) * length
            );
            this.ctx.stroke();
        }
    }
    
    drawWave(centerX, centerY, signature, commits) {
        this.ctx.strokeStyle = `hsl(${signature.primaryHue}, 70%, 60%)`;
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        
        for (let x = 0; x < (this.canvas.clientWidth || this.canvas.width); x += 5) {
            const y = centerY + Math.sin(x * 0.02 + this.time) * 50 * (signature.energy / 100);
            if (x === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }
        this.ctx.stroke();
    }
    
    drawGrid(centerX, centerY, signature, commits) {
        const gridSize = 20;
        const cols = Math.floor((this.canvas.clientWidth || this.canvas.width) / gridSize);
        const rows = Math.floor((this.canvas.clientHeight || this.canvas.height) / gridSize);
        
        for (let i = 0; i < cols; i++) {
            for (let j = 0; j < rows; j++) {
                if ((i + j + Math.floor(this.time * 2)) % 4 === 0) {
                    const x = i * gridSize;
                    const y = j * gridSize;
                    const alpha = 0.3 + Math.sin(this.time + i + j) * 0.2;
                    
                    this.ctx.fillStyle = `hsla(${signature.primaryHue}, 60%, 50%, ${alpha})`;
                    this.ctx.fillRect(x, y, gridSize - 2, gridSize - 2);
                }
            }
        }
    }
    
    drawLanguageRings(centerX, centerY, signature, languages) {
        if (!languages) return;
        
        const entries = Object.entries(languages);
        const total = Object.values(languages).reduce((sum, val) => sum + val, 0);
        
        entries.forEach(([language, bytes], index) => {
            const percentage = bytes / total;
            const radius = 100 + index * 15;
            const thickness = percentage * 20 + 2;
            
            this.ctx.strokeStyle = `hsla(${(signature.secondaryHue + index * 30) % 360}, 70%, 60%, 0.6)`;
            this.ctx.lineWidth = thickness;
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            this.ctx.stroke();
        });
    }
    
    drawRepoName(signature, info) {
        this.ctx.fillStyle = `hsla(${signature.primaryHue}, 80%, 70%, 0.8)`;
        this.ctx.font = '16px Inter, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(info.full_name, (this.canvas.clientWidth || this.canvas.width) / 2, 30);
    }
    
    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }
}

class CommitArtGenerator {
    constructor() {
        this.form = document.getElementById('flipbook-form');
        this.repoUrlInput = document.getElementById('repo-url');
        this.generateBtn = document.getElementById('generate-btn');
        this.statusDiv = document.getElementById('status');
        this.resultDiv = document.getElementById('result');
        this.errorDiv = document.getElementById('error');
        this.canvas = document.getElementById('result-canvas');
        this.playBtn = document.getElementById('play-btn');
        this.speedSlider = document.getElementById('speed-slider');
        
        // Three.js visualizer
        this.visualizer = null;
        
        // Repository data
        this.repoData = null;
        
        this.init();
    }
    
    init() {
        // Initialize simple visualizer
        this.visualizer = new SimpleVisualizer(this.canvas);
        
        // Event listeners
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        document.getElementById('download-btn').addEventListener('click', () => this.downloadScreenshot());
        document.getElementById('share-btn').addEventListener('click', () => this.share());
        
        // Handle window resize
        window.addEventListener('resize', () => {
            if (this.visualizer) {
                this.visualizer.resize();
            }
        });
        
        // Set random placeholder library
        this.setRandomPlaceholderLibrary();
    }
    
    setRandomPlaceholderLibrary() {
        const repositories = [
            'https://github.com/facebook/react',
            'https://github.com/vuejs/vue',
            'https://github.com/tensorflow/tensorflow',
            'https://github.com/bitcoin/bitcoin',
            'https://github.com/microsoft/vscode',
            'https://github.com/torvalds/linux'
        ];
        
        let currentIndex = 0;
        let isTyping = false;
        let currentFullUrl = repositories[0]; // Track the full URL
        
        const typeText = async (text) => {
            if (isTyping) return;
            isTyping = true;
            currentFullUrl = text; // Set the full URL immediately
            
            // Clear current placeholder
            for (let i = this.repoUrlInput.placeholder.length; i >= 0; i--) {
                this.repoUrlInput.placeholder = this.repoUrlInput.placeholder.substring(0, i);
                await new Promise(resolve => setTimeout(resolve, 30));
            }
            
            // Wait a bit
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Type new text
            for (let i = 0; i <= text.length; i++) {
                this.repoUrlInput.placeholder = text.substring(0, i);
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            
            isTyping = false;
        };
        
        const cycleRepositories = async () => {
            await typeText(repositories[currentIndex]);
            currentIndex = (currentIndex + 1) % repositories.length;
            
            // Wait before cycling to next
            setTimeout(cycleRepositories, 3000);
        };
        
        // Expose the current full URL for form submission
        this.getCurrentPlaceholderUrl = () => currentFullUrl;
        
        // Start the animation
        cycleRepositories();
    }
    
    async handleSubmit(e) {
        e.preventDefault();
        
        this.hideAll();
        this.setLoadingState(true);
        this.showStatus('Analyzing repository...');
        
        try {
            // Use full placeholder URL if input is empty, even during animation
            const repoUrl = this.repoUrlInput.value.trim() || this.getCurrentPlaceholderUrl();
            const { owner, repo } = this.parseGitHubUrl(repoUrl);
            
            // Fetch repository info
            const repoInfo = await this.fetchRepoInfo(owner, repo);
            
            // Fetch multiple types of data
            this.showStatus('Loading repository data...');
            
            // Get commits
            const commits = await this.fetchCommitsWithStats(owner, repo, 100);
            
            // Get languages
            const languages = await this.fetchLanguages(owner, repo);
            
            // Get contributors
            const contributors = await this.fetchContributors(owner, repo);
            
            // Compile repository data
            this.repoData = {
                info: repoInfo,
                commits: commits,
                languages: languages,
                contributors: contributors,
                stats: {
                    stars: repoInfo.stargazers_count,
                    forks: repoInfo.forks_count,
                    issues: repoInfo.open_issues_count
                }
            };
            
            // Create 3D visualization
            this.showStatus('Creating 3D visualization...');
            await this.visualizer.visualizeRepository(this.repoData);
            
            // Show result
            this.showResult();
            
        } catch (error) {
            // For debugging, let's create a simple test visualization
            console.error('Error fetching repo data:', error);
            this.showStatus('Creating test visualization...');
            
            // Create dummy data for testing
            const testData = {
                info: { full_name: 'test/repo', created_at: '2020-01-01' },
                commits: [
                    { commit: { author: { email: 'test@test.com' } }, stats: { total: 10 } },
                    { commit: { author: { email: 'test2@test.com' } }, stats: { total: 20 } }
                ],
                languages: { JavaScript: 1000, Python: 500 },
                contributors: [{ contributions: 10 }, { contributions: 5 }],
                stats: { stars: 100, forks: 50, issues: 10 }
            };
            
            await this.visualizer.visualizeRepository(testData);
            this.showResult();
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
    
    async fetchLanguages(owner, repo) {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/languages`);
        if (!response.ok) return {};
        return await response.json();
    }
    
    async fetchContributors(owner, repo) {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contributors?per_page=30`);
        if (!response.ok) return [];
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
        for (let i = detailedCommits.length; i < commits.length; i++) {
            detailedCommits.push(commits[i]);
        }
        
        return detailedCommits.reverse(); // Oldest first
    }
    
    async downloadScreenshot() {
        this.showStatus('Creating screenshot...');
        
        // Convert Three.js canvas to blob
        this.canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${this.repoUrlInput.value.split('/').pop()}-visualization.png`;
            a.click();
            URL.revokeObjectURL(url);
            this.hideStatus();
        });
    }
    
    share() {
        const { owner, repo } = this.parseGitHubUrl(this.repoUrlInput.value);
        const text = `Check out this 3D visualization of ${owner}/${repo}'s repository!`;
        
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
    
    // UI Helper Methods
    showStatus(message) {
        this.statusDiv.style.display = 'block';
        this.statusDiv.querySelector('.status-message').textContent = message;
    }
    
    updateProgress(percentage) {
        const progressBar = this.statusDiv.querySelector('.progress-bar');
        progressBar.style.width = `${percentage}%`;
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