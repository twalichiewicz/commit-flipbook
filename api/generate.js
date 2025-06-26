// Serverless function for generating commit flipbooks
// Can be deployed to Vercel, Netlify Functions, AWS Lambda, etc.

const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

const execAsync = promisify(exec);

// In-memory job storage (use Redis/DynamoDB in production)
const jobs = new Map();

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
};

// Main handler
exports.handler = async (event, context) => {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: ''
        };
    }

    const path = event.path || event.rawPath || '';
    
    // Route requests
    if (path.includes('/status/')) {
        return handleStatus(event);
    } else if (event.httpMethod === 'POST') {
        return handleGenerate(event);
    }
    
    return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Not found' })
    };
};

// Handle generation request
async function handleGenerate(event) {
    try {
        const body = JSON.parse(event.body);
        const { repoUrl, options = {} } = body;
        
        if (!repoUrl || !isValidGitHubUrl(repoUrl)) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Invalid repository URL' })
            };
        }
        
        // Create job
        const jobId = crypto.randomBytes(16).toString('hex');
        const job = {
            id: jobId,
            repoUrl,
            options,
            status: 'queued',
            createdAt: Date.now(),
            progress: 0
        };
        
        jobs.set(jobId, job);
        
        // Start processing asynchronously
        processJob(jobId).catch(err => {
            console.error('Job processing error:', err);
            job.status = 'failed';
            job.error = err.message;
        });
        
        return {
            statusCode: 202,
            headers: corsHeaders,
            body: JSON.stringify({ jobId })
        };
        
    } catch (error) {
        return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Invalid request' })
        };
    }
}

// Handle status check
async function handleStatus(event) {
    const jobId = event.path.split('/').pop();
    const job = jobs.get(jobId);
    
    if (!job) {
        return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Job not found' })
        };
    }
    
    return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
            status: job.status,
            progress: job.progress,
            step: job.step,
            currentCommit: job.currentCommit,
            totalCommits: job.totalCommits,
            result: job.result,
            error: job.error
        })
    };
}

// Process job
async function processJob(jobId) {
    const job = jobs.get(jobId);
    
    try {
        // Update status
        job.status = 'processing';
        job.step = 'cloning';
        job.progress = 10;
        
        // Create temp directory
        const tempDir = path.join('/tmp', `flipbook-${jobId}`);
        await fs.mkdir(tempDir, { recursive: true });
        
        // Build command
        const scriptPath = path.join(__dirname, '..', 'index.js');
        const outputPath = path.join(tempDir, 'output.gif');
        
        const command = [
            'node',
            scriptPath,
            job.repoUrl,
            '-o', outputPath,
            '-b', job.options.branch || 'main',
            '-l', job.options.limit || 20,
            '--type', job.options.type || 'auto',
            '-d', job.options.delay || 1000
        ].join(' ');
        
        // Execute with progress tracking
        const childProcess = exec(command, {
            cwd: tempDir,
            maxBuffer: 1024 * 1024 * 50 // 50MB
        });
        
        // Parse output for progress
        childProcess.stdout.on('data', (data) => {
            const output = data.toString();
            
            // Parse progress from output
            if (output.includes('Processing commit')) {
                const match = output.match(/Processing commit (\d+)\/(\d+)/);
                if (match) {
                    job.currentCommit = parseInt(match[1]);
                    job.totalCommits = parseInt(match[2]);
                    job.progress = 20 + (60 * job.currentCommit / job.totalCommits);
                    job.step = 'processing';
                }
            } else if (output.includes('Creating GIF')) {
                job.step = 'generating';
                job.progress = 85;
            }
        });
        
        // Wait for completion
        await new Promise((resolve, reject) => {
            childProcess.on('exit', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`Process exited with code ${code}`));
            });
            childProcess.on('error', reject);
        });
        
        // Upload to storage (implement based on your platform)
        job.step = 'uploading';
        job.progress = 95;
        
        const gifUrl = await uploadToStorage(outputPath, `${jobId}.gif`);
        
        // Update job
        job.status = 'completed';
        job.progress = 100;
        job.result = {
            gifUrl,
            downloadUrl: gifUrl
        };
        
        // Cleanup
        await fs.rm(tempDir, { recursive: true, force: true });
        
    } catch (error) {
        job.status = 'failed';
        job.error = error.message;
        throw error;
    }
}

// Upload to storage (implement based on your platform)
async function uploadToStorage(filePath, filename) {
    // For demo, return a placeholder URL
    // In production, upload to S3, Cloudinary, etc.
    return `https://storage.commit-flipbook.com/${filename}`;
}

// Validate GitHub URL
function isValidGitHubUrl(url) {
    const pattern = /^https:\/\/github\.com\/[^\/]+\/[^\/]+$/;
    return pattern.test(url);
}

// Export for different platforms
module.exports = { handler };
module.exports.default = handler; // Vercel
exports.handler = handler; // Netlify/AWS