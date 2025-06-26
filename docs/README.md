# Commit Flipbook Web Interface

This is the web interface for Commit Flipbook. To use it:

1. Visit the [live site](https://twalichiewicz.github.io/commit-flipbook)
2. Enter a GitHub repository URL
3. Click "Generate Flipbook"
4. Wait for your animated GIF to be created

## Local Development

To run the web interface locally:

```bash
cd docs
python3 -m http.server 8000
# or
npx http-server
```

Then visit http://localhost:8000

## Deployment

See [DEPLOYMENT.md](../DEPLOYMENT.md) for backend setup instructions.