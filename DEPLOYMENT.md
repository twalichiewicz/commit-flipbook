# Deployment Guide

This guide explains how to deploy the Commit Flipbook web interface and backend.

## Architecture Overview

The system consists of:
1. **Frontend**: Static site hosted on GitHub Pages
2. **Backend API**: Serverless function that processes requests
3. **Processing**: Node.js script that generates GIFs

## Frontend Deployment (GitHub Pages)

1. Fork this repository
2. Go to Settings → Pages
3. Set source to "Deploy from a branch"
4. Select `/docs` folder from main branch
5. Your site will be available at `https://[username].github.io/commit-flipbook`

## Backend Deployment Options

### Option 1: Vercel (Recommended)

1. Install Vercel CLI: `npm i -g vercel`
2. Deploy the API:
```bash
cd api
vercel
```
3. Set the API endpoint in your frontend:
   - Edit `docs/script.js`
   - Update `API_ENDPOINT` to your Vercel URL

### Option 2: Netlify Functions

1. Create `netlify.toml`:
```toml
[build]
  functions = "api"

[functions]
  node_bundler = "esbuild"
```

2. Deploy to Netlify
3. Update `API_ENDPOINT` in frontend

### Option 3: GitHub Actions (Self-Hosted)

For a fully GitHub-hosted solution, create `.github/workflows/generate-flipbook.yml`:

```yaml
name: Generate Flipbook

on:
  workflow_dispatch:
    inputs:
      repo_url:
        description: 'Repository URL'
        required: true
      branch:
        description: 'Branch name'
        default: 'main'
      limit:
        description: 'Max commits'
        default: '20'

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Generate flipbook
        run: |
          node index.js "${{ github.event.inputs.repo_url }}" \
            -b "${{ github.event.inputs.branch }}" \
            -l "${{ github.event.inputs.limit }}" \
            -o flipbook.gif
      
      - name: Upload artifact
        uses: actions/upload-artifact@v3
        with:
          name: flipbook
          path: flipbook.gif
```

Then update the frontend to trigger workflows via GitHub API.

### Option 4: AWS Lambda

1. Install Serverless Framework:
```bash
npm install -g serverless
```

2. Create `serverless.yml`:
```yaml
service: commit-flipbook

provider:
  name: aws
  runtime: nodejs18.x
  region: us-east-1

functions:
  generate:
    handler: api/generate.handler
    events:
      - http:
          path: generate
          method: post
          cors: true
      - http:
          path: status/{id}
          method: get
          cors: true
```

3. Deploy: `serverless deploy`

## Environment Variables

Set these in your serverless platform:

- `GITHUB_TOKEN`: For private repos (optional)
- `STORAGE_BUCKET`: S3/Cloud Storage bucket name
- `MAX_CONCURRENT_JOBS`: Limit concurrent processing

## Storage Options

For storing generated GIFs:

1. **Cloudinary**: Free tier, easy CDN
2. **AWS S3**: Scalable, pay-per-use
3. **GitHub Releases**: Free but limited
4. **Imgur API**: Free with rate limits

## Security Considerations

1. **Rate Limiting**: Implement per-IP limits
2. **Repo Validation**: Only allow public repos or require auth
3. **Resource Limits**: Set max commits, timeout values
4. **CORS**: Configure allowed origins

## Monitoring

1. Add error tracking (Sentry)
2. Monitor API usage
3. Set up alerts for failures
4. Track generation times

## Local Development

1. Run frontend locally:
```bash
cd docs
python3 -m http.server 8000
```

2. Run API locally:
```bash
cd api
node -e "require('./generate').handler({httpMethod:'GET',path:'/'})"
```

## Cost Estimates

- **GitHub Pages**: Free
- **Vercel**: Free tier includes 100GB bandwidth
- **Netlify**: 125k function requests/month free
- **AWS Lambda**: 1M requests/month free tier

Choose based on your expected usage!