// Generative Art from GitHub Commits
// Creates dynamic visualizations from repository evolution

import { RepoVisualizer } from './repo-visualizer.js';

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
        // Initialize Three.js visualizer (it will handle canvas sizing)
        this.visualizer = new RepoVisualizer(this.canvas);
        
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