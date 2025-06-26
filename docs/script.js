// Configuration
const API_ENDPOINT = window.API_ENDPOINT || 'https://api.commit-flipbook.com/generate';
const POLLING_INTERVAL = 2000; // 2 seconds

// DOM Elements
const form = document.getElementById('flipbook-form');
const repoUrlInput = document.getElementById('repo-url');
const generateBtn = document.getElementById('generate-btn');
const statusDiv = document.getElementById('status');
const resultDiv = document.getElementById('result');
const errorDiv = document.getElementById('error');
const statusMessage = document.querySelector('.status-message');
const progressFill = document.querySelector('.progress-bar');
const resultGif = document.getElementById('result-gif');
const downloadBtn = document.getElementById('download-btn');
const shareBtn = document.getElementById('share-btn');
const errorMessage = document.querySelector('.error-message');

// Example cards
const exampleCards = document.querySelectorAll('.example-card');

// State
let currentJobId = null;
let pollingInterval = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Handle form submission
    form.addEventListener('submit', handleSubmit);
    
    // Handle example clicks
    exampleCards.forEach(card => {
        card.addEventListener('click', () => {
            const repoUrl = card.dataset.repo;
            repoUrlInput.value = repoUrl;
            form.dispatchEvent(new Event('submit'));
        });
    });
    
    // Handle download button
    downloadBtn.addEventListener('click', handleDownload);
    
    // Handle share button
    shareBtn.addEventListener('click', handleShare);
});

async function handleSubmit(e) {
    e.preventDefault();
    
    // Reset UI
    hideAll();
    
    // Get form data
    const repoUrl = repoUrlInput.value.trim();
    const branch = document.getElementById('branch').value;
    const limit = document.getElementById('limit').value;
    const type = document.getElementById('type').value;
    const delay = document.getElementById('delay').value;
    
    // Validate URL
    if (!isValidGitHubUrl(repoUrl)) {
        showError('Please enter a valid GitHub repository URL');
        return;
    }
    
    // Show loading state
    setLoadingState(true);
    showStatus('Initializing flipbook generation...');
    
    try {
        // Submit job to API
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                repoUrl,
                options: {
                    branch,
                    limit: parseInt(limit),
                    type,
                    delay: parseInt(delay)
                }
            })
        });
        
        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }
        
        const data = await response.json();
        currentJobId = data.jobId;
        
        // Start polling for status
        startPolling();
        
    } catch (error) {
        showError(`Failed to start generation: ${error.message}`);
        setLoadingState(false);
    }
}

function startPolling() {
    pollingInterval = setInterval(async () => {
        try {
            const response = await fetch(`${API_ENDPOINT}/status/${currentJobId}`);
            
            if (!response.ok) {
                throw new Error(`Failed to get status: ${response.status}`);
            }
            
            const data = await response.json();
            updateStatus(data);
            
            if (data.status === 'completed' || data.status === 'failed') {
                stopPolling();
                setLoadingState(false);
                
                if (data.status === 'completed') {
                    showResult(data.result);
                } else {
                    showError(data.error || 'Generation failed');
                }
            }
            
        } catch (error) {
            stopPolling();
            showError(`Connection error: ${error.message}`);
            setLoadingState(false);
        }
    }, POLLING_INTERVAL);
}

function stopPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
}

function updateStatus(data) {
    const messages = {
        'queued': 'Waiting in queue...',
        'cloning': 'Cloning repository...',
        'processing': `Processing commit ${data.currentCommit || 1} of ${data.totalCommits || '?'}...`,
        'generating': 'Creating GIF animation...',
        'uploading': 'Finalizing your flipbook...'
    };
    
    const message = messages[data.step] || 'Processing...';
    statusMessage.textContent = message;
    
    // Update progress bar
    const progress = data.progress || 0;
    progressFill.style.width = `${progress}%`;
}

function showStatus(message) {
    hideAll();
    statusDiv.style.display = 'block';
    statusMessage.textContent = message;
    progressFill.style.width = '0%';
}

function showResult(result) {
    hideAll();
    resultDiv.style.display = 'block';
    resultGif.src = result.gifUrl;
    resultGif.dataset.downloadUrl = result.downloadUrl;
}

function showError(message) {
    hideAll();
    errorDiv.style.display = 'flex';
    errorMessage.textContent = message;
}

function hideAll() {
    statusDiv.style.display = 'none';
    resultDiv.style.display = 'none';
    errorDiv.style.display = 'none';
}

function setLoadingState(loading) {
    generateBtn.disabled = loading;
    document.querySelector('.button-text').style.display = loading ? 'none' : 'inline';
    document.querySelector('.button-loader').style.display = loading ? 'inline-flex' : 'none';
}

function isValidGitHubUrl(url) {
    const pattern = /^https:\/\/github\.com\/[^\/]+\/[^\/]+$/;
    return pattern.test(url);
}

async function handleDownload() {
    const downloadUrl = resultGif.dataset.downloadUrl;
    if (!downloadUrl) return;
    
    // Create a temporary link and click it
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = 'commit-flipbook.gif';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function handleShare() {
    const gifUrl = resultGif.src;
    
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'Check out my code evolution!',
                text: 'I created a flipbook animation of my GitHub commit history',
                url: window.location.href
            });
        } catch (err) {
            console.log('Share cancelled or failed', err);
        }
    } else {
        // Fallback: copy link to clipboard
        navigator.clipboard.writeText(gifUrl).then(() => {
            // Show temporary success message
            const originalText = shareBtn.textContent;
            shareBtn.textContent = 'Link Copied!';
            setTimeout(() => {
                shareBtn.textContent = 'Share';
            }, 2000);
        });
    }
}

// For demo purposes - simulate API responses
// Remove this in production
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // Override API endpoint for demo
    window.API_ENDPOINT = '#';
    
    // Mock implementation
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        hideAll();
        setLoadingState(true);
        showStatus('Initializing flipbook generation...');
        
        // Simulate processing steps
        const steps = [
            { message: 'Cloning repository...', progress: 20 },
            { message: 'Processing commit 1 of 5...', progress: 40 },
            { message: 'Processing commit 3 of 5...', progress: 60 },
            { message: 'Processing commit 5 of 5...', progress: 80 },
            { message: 'Creating GIF animation...', progress: 90 },
            { message: 'Finalizing your flipbook...', progress: 100 }
        ];
        
        for (const step of steps) {
            await new Promise(resolve => setTimeout(resolve, 1500));
            statusMessage.textContent = step.message;
            progressFill.style.width = `${step.progress}%`;
        }
        
        // Show demo result
        await new Promise(resolve => setTimeout(resolve, 1000));
        setLoadingState(false);
        showResult({
            gifUrl: 'https://media.giphy.com/media/xT9IgzoKnwFNmISR8I/giphy.gif',
            downloadUrl: '#'
        });
    });
}