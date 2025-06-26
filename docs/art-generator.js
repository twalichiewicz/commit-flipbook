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
        // Set canvas size
        this.canvas.width = 800;
        this.canvas.height = 800;
        
        // Initialize Three.js visualizer
        this.visualizer = new RepoVisualizer(this.canvas);
        
        // Event listeners
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        document.getElementById('download-btn').addEventListener('click', () => this.downloadScreenshot());
        document.getElementById('share-btn').addEventListener('click', () => this.share());
        
        // Handle window resize
        window.addEventListener('resize', () => {
            if (this.visualizer) {
                this.visualizer.resize(800, 800);
            }
        });
        
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