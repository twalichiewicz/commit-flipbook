// Generative Art from GitHub Commits
// Creates dynamic visualizations from repository evolution

// --- Core Utilities ---

class SeededPerlinNoise {
    constructor(seed) {
        this.p = new Uint8Array(512);
        this.permutation = new Uint8Array(256);
        
        // Initialize permutation table
        for (let i = 0; i < 256; i++) {
            this.permutation[i] = i;
        }

        // Shuffle based on seed (Linear Congruential Generator)
        let m = 0x80000000;
        let a = 1103515245;
        let c = 12345;
        let state = seed;
        
        const rng = () => {
            state = (a * state + c) % m;
            return state / (m - 1);
        };

        for (let i = 255; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [this.permutation[i], this.permutation[j]] = [this.permutation[j], this.permutation[i]];
        }

        // Duplicate for overflow
        for (let i = 0; i < 512; i++) {
            this.p[i] = this.permutation[i % 256];
        }
    }

    noise(x, y) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;

        x -= Math.floor(x);
        y -= Math.floor(y);

        const u = this.fade(x);
        const v = this.fade(y);

        const A = this.p[X] + Y;
        const B = this.p[X + 1] + Y;

        return this.lerp(v, 
            this.lerp(u, this.grad(this.p[A], x, y), this.grad(this.p[B], x - 1, y)),
            this.lerp(u, this.grad(this.p[A + 1], x, y - 1), this.grad(this.p[B + 1], x - 1, y - 1))
        );
    }

    fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    lerp(t, a, b) { return a + t * (b - a); }
    grad(hash, x, y) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }
}

class GeometricHelper {
    static getDistance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    static getNearestNeighbor(point, neighbors) {
        let minDist = Infinity;
        let nearestIndex = -1;

        for (let i = 0; i < neighbors.length; i++) {
            const dist = this.getDistance(point, neighbors[i]);
            if (dist < minDist) {
                minDist = dist;
                nearestIndex = i;
            }
        }
        return nearestIndex;
    }
}

// --- Visualizer ---

class SimpleVisualizer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false }); // Optimize for no transparency on base
        this.animationId = null;
        this.time = 0;
        this.particles = [];
        this.connections = [];
        this.rng = Math.random; // Default to random
        this.noise = null;
        this.lifeGrid = [];
        
        // Set proper canvas size
        this.resize();
    }
    
    resize() {
        if (!this.canvas.parentElement) return;

        // Get the actual container dimensions
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const width = rect.width || 800;
        const height = 400; // Keep fixed height
        const dpr = window.devicePixelRatio || 1;
        
        // Set canvas internal dimensions (for drawing)
        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;
        
        // Set canvas display dimensions (CSS)
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';
        
        // Scale context for retina displays
        this.ctx.scale(dpr, dpr);
        
        // Reset particles on resize
        this.particles = [];
    }

    // Helper: Simple string hash
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash + str.charCodeAt(i)) & 0xffffffff;
        }
        return Math.abs(hash);
    }

    // Helper: Map value ranges
    mapValue(value, inMin, inMax, outMin, outMax) {
        return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
    }
    
        async visualizeRepository(repoData) {
            // Generate unique signature based on repo
            const signature = this.generateSignature(repoData);
            console.log('Visualizing:', signature, repoData.commits.length);
    
            // Initialize seeded RNG
            this.rng = this.createSeededRNG(signature.hash);
            this.noise = new SeededPerlinNoise(signature.hash);
            
            // Initialize particles/state based on style
            this.initializeState(signature, repoData);
            
            // Start animation
            this.animate(signature, repoData);
        }
        
        generateSignature(repoData) {        const { info, languages, contributors, commits } = repoData;
        const repoName = info.full_name;
        const hash = this.hashString(repoName);

        // Determine palette based on dominant language
        const dominantLang = Object.keys(languages)[0] || 'JavaScript';
        const langHash = this.hashString(dominantLang);
        const hue = langHash % 360;
        
        return {
            hash: hash,
            primaryHue: hue,
            secondaryHue: (hue + 180) % 360,
            tertiaryHue: (hue + 90) % 360,
            complexity: Math.min(Object.keys(languages || {}).length + (contributors || []).length / 5, 20),
            energy: Math.min((commits || []).length / 20, 100),
            style: ['constellation', 'flow', 'nebula', 'matrix', 'mosaic', 'tree', 'life'][hash % 7],
            speed: 0.01 + ((hash % 10) / 1000)
        };
    }

    mapCommitToParticle(commit, index, total, width, height, timeRange) {
        const { minTime, maxTime } = timeRange;
        const commitDate = new Date(commit.commit.author.date).getTime();
        const authorName = commit.commit.author.name || 'Unknown';
        const msgLength = commit.commit.message.length;
        const stats = commit.stats || { total: 10 };
        const authorHash = this.hashString(authorName);
        const commitHash = this.hashString(commit.sha || commit.commit.message); // Fallback for mock data

        // 1. Position X: Time-based (Oldest -> Newest)
        // Add some jitter based on message length so they aren't perfectly linear
        const timeNorm = this.mapValue(commitDate, minTime, maxTime, 0.1, 0.9);
        const xJitter = (msgLength % 20 - 10) * 2; 
        const x = (timeNorm * width) + xJitter;

        // 2. Position Y: Author & Content based
        // Different authors occupy different "bands" of Y, plus jitter from commit hash
        const authorBand = (authorHash % 5) + 1; // 1-5 bands
        const bandHeight = height / 6;
        const yBase = authorBand * bandHeight;
        const yJitter = (commitHash % 100 - 50);
        const y = yBase + yJitter;

        // 3. Size: Based on code changes (Logarithmic scale)
        const size = Math.max(2, Math.min(Math.log(stats.total + 1) * 3, 15));

        // 4. Color: Unique per author
        const hue = authorHash % 360;

        // 5. Velocity: Volatility (larger changes = faster/more erratic)
        const volatility = Math.min(stats.total / 100, 5);
        const vx = ((commitHash % 100) / 100 - 0.5) * volatility * 0.2; // Reduced drift
        const vy = ((authorHash % 100) / 100 - 0.5) * volatility * 0.2;

        return {
            x, y,
            vx, vy,
            size,
            hue,
            alpha: 0.5 + ((commitHash % 50) / 100), // 0.5 - 1.0
            phase: (commitDate % 1000) / 1000 * Math.PI * 2,
            commit
        };
    }

    initializeState(signature, repoData) {
        this.particles = [];
        const { commits } = repoData;
        const dpr = window.devicePixelRatio || 1;
        const width = this.canvas.width / dpr;
        const height = this.canvas.height / dpr;
        
        const activeCommits = (commits || []).slice(0, 150);
        if (activeCommits.length === 0) return;

        // Calculate Time Range
        const times = activeCommits.map(c => new Date(c.commit.author.date).getTime());
        let minTime = Math.min(...times);
        let maxTime = Math.max(...times);
        
        console.log('Active commits:', activeCommits.length, 'Time range:', minTime, maxTime);

        if (minTime === maxTime) {
            minTime -= 86400000; // -1 day
            maxTime += 86400000; // +1 day
        }
        
        const timeRange = { minTime, maxTime };

        // Generate Particles from Commits
        activeCommits.forEach((commit, i) => {
            const p = this.mapCommitToParticle(commit, i, activeCommits.length, width, height, timeRange);
            if (i === 0) console.log('First particle:', p);
            
            if (isNaN(p.x) || isNaN(p.y)) {
                console.error('Invalid particle:', p);
                return;
            }
            this.particles.push(p);
        });

        // Add "Ghost" particles for structure (e.g. background flow)
        // These are seeded by Repo Name to remain deterministic
        if (signature.style === 'flow' || signature.style === 'nebula') {
             const bgCount = 50;
             for(let i=0; i<bgCount; i++) {
                 // Seed pseudorandomness with index + repo hash
                 const seed = signature.hash + i;
                 const px = (seed % 1000) / 1000 * width;
                 const py = ((seed * 2) % 1000) / 1000 * height;
                 
                 this.particles.push({
                     x: px, y: py,
                     vx: 0, vy: 0,
                     size: 1 + (seed % 3),
                     hue: signature.secondaryHue,
                     alpha: 0.2,
                     isBackground: true,
                     phase: 0
                 });
             }
        }

        // For 'life' style (Cellular Automata)
        if (signature.style === 'life') {
            const cols = 50;
            const rows = 50;
            this.lifeGrid = new Array(cols).fill(0).map(() => new Array(rows).fill(0));
            
            for (let i = 0; i < cols; i++) {
                for (let j = 0; j < rows; j++) {
                    this.lifeGrid[i][j] = this.rng() > 0.8 ? 1 : 0; 
                }
            }
        }
    }
    
    animate(signature, repoData) {
        // Stop any previous animation
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }

        const render = () => {
            this.time += signature.speed;
            this.clear(signature);
            this.drawVisualization(signature, repoData);
            this.animationId = requestAnimationFrame(render);
        };
        
        render();
    }
    
    clear(signature) {
        const dpr = window.devicePixelRatio || 1;
        const width = this.canvas.width / dpr;
        const height = this.canvas.height / dpr;
        
        // Use a very dark background with slight tint
        this.ctx.fillStyle = `hsla(${signature.primaryHue}, 30%, 5%, 0.2)`; // Trail effect
        if (signature.style === 'matrix') {
             this.ctx.fillStyle = `hsla(0, 0%, 0%, 0.1)`; // Stronger trails for matrix
        }
        this.ctx.fillRect(0, 0, width, height);
    }
    
    drawVisualization(signature, repoData) {
        if (Math.random() < 0.01) console.log('Drawing particles:', this.particles.length);
        const dpr = window.devicePixelRatio || 1;
        const width = this.canvas.width / dpr;
        const height = this.canvas.height / dpr;
        
        this.ctx.globalCompositeOperation = 'screen'; // Make things glowy and additive
        
        switch (signature.style) {
            case 'constellation':
                this.drawConstellation(width, height, signature);
                break;
            case 'flow':
                this.drawFlowField(width, height, signature);
                break;
            case 'nebula':
                this.drawNebula(width, height, signature);
                break;
            case 'matrix':
                this.drawMatrix(width, height, signature);
                break;
            case 'mosaic':
                this.drawMosaic(width, height, signature);
                break;
            case 'tree':
                this.drawTree(width, height, signature);
                break;
            case 'life':
                this.drawLife(width, height, signature);
                break;
            default:
                this.drawConstellation(width, height, signature);
        }

        this.ctx.globalCompositeOperation = 'source-over';
        this.drawOverlay(width, height, signature, repoData);
    }

    drawTree(width, height, signature) {
        const startX = width / 2;
        const startY = height;
        const branchLen = height / 4;
        const angle = -Math.PI / 2; 
        
        this.ctx.lineWidth = 2;
        this.recursiveBranch(startX, startY, branchLen, angle, 0, signature);
    }

    recursiveBranch(x, y, len, angle, depth, signature) {
        if (depth > 10) return;

        const wind = this.noise.noise(depth * 0.1, this.time * 0.2) * 0.5 - 0.25;
        const finalAngle = angle + wind;

        const endX = x + Math.cos(finalAngle) * len;
        const endY = y + Math.sin(finalAngle) * len;

        this.ctx.strokeStyle = `hsla(${signature.primaryHue + depth * 10}, 70%, ${70 - depth * 5}%, 0.8)`;
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(endX, endY);
        this.ctx.stroke();

        const branchCount = 2 + (signature.hash % 2); 
        const spread = 0.5 + (signature.hash % 10) / 20;

        for (let i = 0; i < branchCount; i++) {
            const newLen = len * 0.7;
            const newAngle = finalAngle + spread * (i - (branchCount - 1) / 2);
            this.recursiveBranch(endX, endY, newLen, newAngle, depth + 1, signature);
        }
    }

    drawLife(width, height, signature) {
        const cols = 50;
        const rows = 50;
        const cellW = width / cols;
        const cellH = height / rows;
        
        for (let i = 0; i < cols; i++) {
            for (let j = 0; j < rows; j++) {
                if (this.lifeGrid[i][j] === 1) {
                    this.ctx.fillStyle = `hsla(${signature.secondaryHue}, 70%, 60%, 0.8)`;
                    this.ctx.fillRect(i * cellW, j * cellH, cellW - 1, cellH - 1);
                }
            }
        }

        if (Math.floor(this.time * 100) % 5 === 0) {
            const next = this.lifeGrid.map(arr => [...arr]);
            for (let i = 0; i < cols; i++) {
                for (let j = 0; j < rows; j++) {
                    let neighbors = 0;
                    for (let x = -1; x <= 1; x++) {
                        for (let y = -1; y <= 1; y++) {
                            if (x === 0 && y === 0) continue;
                            const ni = (i + x + cols) % cols;
                            const nj = (j + y + rows) % rows;
                            neighbors += this.lifeGrid[ni][nj];
                        }
                    }
                    if (this.lifeGrid[i][j] === 1 && (neighbors < 2 || neighbors > 3)) next[i][j] = 0;
                    else if (this.lifeGrid[i][j] === 0 && neighbors === 3) next[i][j] = 1;
                }
            }
            this.lifeGrid = next;
        }
    }

    drawConstellation(width, height, signature) {
        // Update particles
        this.particles.forEach(p => {
            // Subtle orbital movement based on phase
            if (!p.isBackground) {
                p.x += Math.cos(this.time + p.phase) * 0.3;
                p.y += Math.sin(this.time + p.phase) * 0.3;
            }
        });

        // Draw Connections
        this.ctx.lineWidth = 1;
        for (let i = 0; i < this.particles.length; i++) {
            const p1 = this.particles[i];
            if (p1.isBackground) continue;

            // Only connect if hue is similar (Same Author/Team)
            // OR if spatially close
            for (let j = i + 1; j < this.particles.length; j++) {
                const p2 = this.particles[j];
                if (p2.isBackground) continue;

                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                // Connect if close
                if (dist < 80) {
                    const opacity = (1 - dist / 80) * 0.4;
                    this.ctx.strokeStyle = `hsla(${p1.hue}, 70%, 70%, ${opacity})`;
                    this.ctx.beginPath();
                    this.ctx.moveTo(p1.x, p1.y);
                    this.ctx.lineTo(p2.x, p2.y);
                    this.ctx.stroke();
                }
            }
        }

        // Draw Particles (Nodes)
        this.particles.forEach(p => {
            const pulse = Math.sin(this.time * 2 + p.phase) * 0.5 + 1; // 0.5 to 1.5
            
            this.ctx.shadowBlur = p.size * 2;
            this.ctx.shadowColor = `hsl(${p.hue}, 80%, 60%)`;
            this.ctx.fillStyle = `hsl(${p.hue}, 80%, 70%)`;
            
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, (p.size / 2) * pulse, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Reset shadow for performance
            this.ctx.shadowBlur = 0;
        });
    }

    drawFlowField(width, height, signature) {
        const scale = 0.002;
        
        this.particles.forEach(p => {
            // Calculate flow vector based on Perlin noise
            const noiseVal = this.noise.noise(p.x * scale, p.y * scale + this.time * 0.1);
            const angle = noiseVal * Math.PI * 4;
            
            p.x += Math.cos(angle) * 1;
            p.y += Math.sin(angle) * 1;
            
            // Wrap around deterministically
            if (p.x < 0) p.x += width;
            if (p.x > width) p.x -= width;
            if (p.y < 0) p.y += height;
            if (p.y > height) p.y -= height;
            
            const alpha = p.isBackground ? 0.2 : 0.8;
            const size = p.isBackground ? p.size : p.size * (Math.sin(this.time + p.phase) * 0.2 + 1);
            
            this.ctx.fillStyle = `hsla(${p.hue}, 70%, 60%, ${alpha})`;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }

    drawNebula(width, height, signature) {
        const centerX = width / 2;
        const centerY = height / 2;

        this.particles.forEach((p, i) => {
            // Spiral motion based on original mapped position
            // We interpret p.x as 'angle' and p.y as 'radius' offsets for nebula
            const angleOffset = (p.x / width) * Math.PI * 2;
            const radiusBase = (p.y / height) * 150;
            
            const angle = this.time * 0.2 + angleOffset;
            const radius = radiusBase + Math.sin(this.time * 2 + i) * 10;
            
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;

            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = `hsla(${p.hue}, 80%, 50%, 0.5)`;
            this.ctx.fillStyle = `hsla(${p.hue}, 80%, 70%, 0.8)`;
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
        });
    }

    drawMosaic(width, height, signature) {
        const gridSize = 15;
        
        // Update particle positions first
        this.particles.forEach(p => {
             p.x += Math.cos(this.time + p.phase) * 0.5;
             p.y += Math.sin(this.time + p.phase) * 0.5;
        });

        // Draw pixelated Voronoi
        for (let x = 0; x < width; x += gridSize) {
            for (let y = 0; y < height; y += gridSize) {
                const cx = x + gridSize / 2;
                const cy = y + gridSize / 2;
                
                let minDist = Infinity;
                let nearestP = null;
                
                for(let i=0; i<this.particles.length; i++) {
                    const p = this.particles[i];
                    if(p.isBackground) continue;
                    
                    const dx = cx - p.x;
                    const dy = cy - p.y;
                    const dist = dx*dx + dy*dy;
                    
                    if(dist < minDist) {
                        minDist = dist;
                        nearestP = p;
                    }
                }
                
                if (nearestP) {
                    this.ctx.fillStyle = `hsla(${nearestP.hue}, 60%, 50%, 0.8)`;
                    this.ctx.fillRect(x, y, gridSize, gridSize);
                }
            }
        }
    }

    drawMatrix(width, height, signature) {
         this.particles.forEach(p => {
            p.y += p.size * 0.5; // Rain down
            if (p.y > height) {
                p.y = 0;
                // No random reset! Reset to original X to keep structure
                // p.x is already set deterministically in mapCommitToParticle
            }

            this.ctx.font = `${p.size * 2}px monospace`;
            this.ctx.fillStyle = `hsla(${signature.secondaryHue}, 100%, 70%, ${p.alpha})`;
            // Draw char based on commit hash
            const charCode = 0x30A0 + (this.hashString(p.commit?.sha || 'x') % 96);
            const char = String.fromCharCode(charCode);
            this.ctx.fillText(char, p.x, p.y);
        });
    }
    
    drawOverlay(width, height, signature, repoData) {
        // Repo Name
        this.ctx.font = 'bold 24px Inter, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = `rgba(255, 255, 255, 0.9)`;
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = 'black';
        this.ctx.fillText(repoData.info.full_name, width / 2, 40);
        this.ctx.shadowBlur = 0;

        // Stats
        this.ctx.font = '12px Inter, sans-serif';
        this.ctx.fillStyle = `rgba(255, 255, 255, 0.6)`;
        this.ctx.fillText(`${repoData.commits.length} commits • ${Object.keys(repoData.languages || {}).length} languages`, width / 2, 65);

        // Timeline Legend
        const margin = 50;
        const lineY = height - 30;
        
        this.ctx.beginPath();
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.moveTo(margin, lineY);
        this.ctx.lineTo(width - margin, lineY);
        this.ctx.stroke();

        this.ctx.font = '10px Inter, sans-serif';
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('Oldest', margin, lineY + 15);
        this.ctx.textAlign = 'right';
        this.ctx.fillText('Newest', width - margin, lineY + 15);
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
        
        this.visualizer = null;
        this.repoData = null;
        
        this.init();
    }
    
    init() {
        // Initialize visualizer
        this.visualizer = new SimpleVisualizer(this.canvas);
        
        // Event listeners
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        document.getElementById('download-btn')?.addEventListener('click', () => this.downloadScreenshot());
        document.getElementById('share-btn')?.addEventListener('click', () => this.share());
        
        // Example cards
        document.querySelectorAll('.example-card').forEach(card => {
            card.addEventListener('click', () => {
                this.repoUrlInput.value = card.dataset.repo;
                // Trigger submit
                this.form.dispatchEvent(new Event('submit'));
                
                // Scroll to result on mobile/small screens
                setTimeout(() => {
                   this.statusDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 100);
            });
        });

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
            'https://github.com/rust-lang/rust',
            'https://github.com/torvalds/linux'
        ];
        
        let currentIndex = 0;
        let isTyping = false;
        let currentFullUrl = repositories[0]; 
        
        const typeText = async (text) => {
            if (isTyping) return;
            isTyping = true;
            currentFullUrl = text;
            
            // Simple typing effect simulation
            this.repoUrlInput.setAttribute('placeholder', text);
            
            isTyping = false;
        };
        
        const cycleRepositories = async () => {
            await typeText(repositories[currentIndex]);
            currentIndex = (currentIndex + 1) % repositories.length;
            setTimeout(cycleRepositories, 4000);
        };
        
        // Expose the current full URL for form submission
        this.getCurrentPlaceholderUrl = () => currentFullUrl;
        
        cycleRepositories();
    }
    
    async handleSubmit(e) {
        e.preventDefault();
        
        this.hideAll();
        this.setLoadingState(true);
        this.showStatus('Connecting to GitHub...');
        
        const repoUrl = this.repoUrlInput.value.trim() || this.getCurrentPlaceholderUrl();
        
        try {
            const { owner, repo } = this.parseGitHubUrl(repoUrl);
            
            // Fetch repository info
            this.showStatus(`Fetching data for ${owner}/${repo}...`);
            const repoInfo = await this.fetchRepoInfo(owner, repo);
            
            // Fetch details in parallel
            this.showStatus('Analyzing patterns...');
            const [commits, languages, contributors] = await Promise.all([
                this.fetchCommitsWithStats(owner, repo, 150),
                this.fetchLanguages(owner, repo),
                this.fetchContributors(owner, repo)
            ]);
            
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
            
            this.showResult();
            document.querySelector('.result-hint').textContent = repoInfo.full_name;
            
            // Delay slightly to ensure canvas is ready
            setTimeout(() => {
                this.hideStatus();
                this.visualizer.resize();
                this.visualizer.visualizeRepository(this.repoData);
            }, 50);
            
        } catch (error) {
            console.error('Visualization error:', error);
            
            if (error.message.includes('rate limit') || error.message.includes('API error')) {
                this.showStatus('Rate limit hit. Generating simulation...');
                const { owner, repo } = this.parseGitHubUrl(repoUrl);
                const fallbackData = this.createFallbackData(owner, repo);
                
                this.showResult();
                document.querySelector('.result-hint').textContent = fallbackData.info.full_name;
                setTimeout(() => {
                    this.hideStatus();
                    this.visualizer.resize();
                    this.visualizer.visualizeRepository(fallbackData);
                }, 100);
            } else {
                this.showError(`Could not visualize: ${error.message}`);
            }
        } finally {
            this.setLoadingState(false);
        }
    }
    
    parseGitHubUrl(url) {
        // Handle common formats:
        // https://github.com/owner/repo
        // github.com/owner/repo
        // owner/repo
        let cleanUrl = url.replace('https://', '').replace('http://', '').replace('github.com/', '');
        const parts = cleanUrl.split('/').filter(p => p);
        
        if (parts.length < 2) throw new Error('Invalid Repository URL');
        
        return { owner: parts[0], repo: parts[1].replace('.git', '') };
    }
    
    // ... (Keep existing fallback data generation)
    createFallbackData(owner, repo) {
        // Create deterministic data based on repository name
        const repoName = `${owner}/${repo}`;
        let hash = 0;
        for (let i = 0; i < repoName.length; i++) {
            hash = ((hash << 5) - hash + repoName.charCodeAt(i)) & 0xffffffff;
        }
        
        const rng = (seed) => {
            let m = 0x80000000;
            let a = 1103515245;
            let c = 12345;
            let state = seed;
            return function() {
                state = (a * state + c) % m;
                return state / (m - 1);
            };
        };

        const random = rng(Math.abs(hash));
        
        // Mock commits
        const commitCount = 50 + Math.floor(random() * 100);
        const commits = [];
                for (let i = 0; i < commitCount; i++) {
                    commits.push({
                        commit: { 
                            author: { 
                                email: `dev${Math.floor(random() * 5)}@test.com`,
                                date: new Date(Date.now() - Math.floor(random() * 31536000000)).toISOString()
                            } 
                        },
                        stats: { 
                            total: Math.floor(random() * 100) + 10,
                            additions: Math.floor(random() * 60),
                            deletions: Math.floor(random() * 40)
                        }
                    });
                }
        
        return {
            info: { 
                full_name: repoName, 
                created_at: new Date().toISOString(),
                stargazers_count: Math.floor(random() * 10000),
                forks_count: Math.floor(random() * 1000)
            },
            commits: commits,
            languages: { 'JavaScript': 10000, 'CSS': 5000 },
            contributors: new Array(5).fill({}),
            stats: { stars: 0, forks: 0 }
        };
    }
    
    async fetchRepoInfo(owner, repo) {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
        if (!response.ok) {
            if (response.status === 404) throw new Error('Repository not found');
            throw new Error(`GitHub API Error: ${response.status}`);
        }
        return await response.json();
    }
    
    async fetchLanguages(owner, repo) {
        try {
            const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/languages`);
            return response.ok ? await response.json() : {};
        } catch { return {}; }
    }
    
    async fetchContributors(owner, repo) {
        try {
            const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contributors?per_page=10`);
            return response.ok ? await response.json() : [];
        } catch { return []; }
    }
    
    async fetchCommitsWithStats(owner, repo, limit = 100) {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=${limit}`);
        if (!response.ok) throw new Error('Failed to load commits');
        const commits = await response.json();
        
        // In a real app we might fetch individual commit stats, 
        // but to avoid rate limits we'll just return the commits.
        // The visualizer handles missing 'stats' gracefully.
        return commits.reverse();
    }
    
    async downloadScreenshot() {
        this.canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'repo-art.png';
            a.click();
            URL.revokeObjectURL(url);
        });
    }
    
    share() {
         // Simple clipboard copy
         navigator.clipboard.writeText(window.location.href)
            .then(() => alert('Link copied to clipboard!'))
            .catch(() => {});
    }
    
    // UI Helpers
    showStatus(msg) {
        this.statusDiv.style.display = 'block';
        this.statusDiv.querySelector('.status-message').textContent = msg;
        this.statusDiv.querySelector('.progress-bar').style.width = '50%'; // Fake progress
    }
    
    hideStatus() { this.statusDiv.style.display = 'none'; }
    
    showResult() {
        this.hideAll();
        this.resultDiv.style.display = 'block';
    }
    
    showError(msg) {
        this.hideAll();
        this.errorDiv.style.display = 'block';
        this.errorDiv.querySelector('.error-message').textContent = msg;
    }
    
    hideAll() {
        this.statusDiv.style.display = 'none';
        this.resultDiv.style.display = 'none';
        this.errorDiv.style.display = 'none';
    }
    
    setLoadingState(loading) {
        this.generateBtn.disabled = loading;
        const loader = this.generateBtn.querySelector('.button-loader');
        const text = this.generateBtn.querySelector('.button-text');
        if (loader) loader.style.display = loading ? 'inline-block' : 'none';
        if (text) text.style.display = loading ? 'none' : 'inline';
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new CommitArtGenerator();
});