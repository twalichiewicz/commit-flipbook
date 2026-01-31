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
        this.ctx = canvas.getContext('2d');
        this.animationId = null;
        this.time = 0;
        this.particles = [];
        this.connections = [];
        this.rng = Math.random; // Default to random
        this.noise = null;
        this.lifeGrid = [];
        this.styleState = {};
        
        // Set proper canvas size
        this.resize();
    }
    
    resize() {
        if (!this.canvas.parentElement) return;

        // Get the actual container dimensions
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const width = rect.width || 800;
        const height = rect.height || 600;
        const dpr = window.devicePixelRatio || 1;
        
        // Set canvas internal dimensions (for drawing)
        this.canvas.width = Math.max(1, Math.floor(width * dpr));
        this.canvas.height = Math.max(1, Math.floor(height * dpr));
        
        // Set canvas display dimensions (CSS)
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';
        
        // Scale context for retina displays
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        
        // Resize Three.js if active
        if (this.threeRenderer && this.threeCamera) {
            this.threeRenderer.setSize(width, height);
            this.threeCamera.aspect = width / height;
            this.threeCamera.updateProjectionMatrix();
        }
        
        // Reset particles on resize (only for 2D)
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

    // Helper: Deterministic RNG for reproducible visuals
    createSeededRNG(seed) {
        let m = 0x80000000;
        let a = 1103515245;
        let c = 12345;
        let state = Math.abs(seed) || 1;
        return () => {
            state = (a * state + c) % m;
            return state / (m - 1);
        };
    }

    calculateGiniCoefficient(commits) {
        if (!commits || commits.length === 0) return 0;
        
        const counts = {};
        commits.forEach(c => {
            const author = c.commit?.author?.name || 'unknown';
            counts[author] = (counts[author] || 0) + 1;
        });
        
        const values = Object.values(counts).sort((a, b) => a - b);
        const n = values.length;
        if (n === 0) return 0;
        
        let numerator = 0;
        for (let i = 0; i < n; i++) {
            numerator += (i + 1) * values[i];
        }
        
        const denominator = n * values.reduce((a, b) => a + b, 0);
        return (2 * numerator) / denominator - (n + 1) / n;
    }

    analyzeRepoTraits(repoData) {
        const { commits, info, languages, contributors } = repoData;
        
        // 1. Social Structure (Gini)
        const gini = this.calculateGiniCoefficient(commits);
        
        // 2. Team Size
        const teamSize = (contributors || []).length || 1;
        
        // 3. Project Age (Days)
        const created = new Date(info.created_at).getTime();
        const lastPush = new Date(info.pushed_at).getTime();
        const ageDays = (lastPush - created) / (1000 * 60 * 60 * 24);
        
        // 4. Language Diversity (entropy)
        const langs = Object.values(languages || {});
        const totalBytes = langs.reduce((a, b) => a + b, 0);
        let diversity = 0;
        if (totalBytes > 0) {
            // Shannon entropy normalized
            diversity = -langs.reduce((acc, val) => {
                const p = val / totalBytes;
                return acc + p * Math.log(p);
            }, 0);
        }
        
        return {
            gini,
            teamSize,
            ageDays,
            diversity
        };
    }

    getStyleFadeAlpha(signature) {
        const profileAlpha = signature?.styleProfile?.fadeAlpha;
        if (typeof profileAlpha === 'number') {
            return Math.min(0.6, Math.max(0.04, profileAlpha));
        }
        switch (signature.style) {
            case 'mosaic':
                return 0.4;
            case 'matrix':
                return 0.12;
            case 'nebula':
                return 0.12;
            case 'flow':
                return 0.14;
            case 'tree':
                return 0.22;
            case 'life':
                return 0.25;
            default:
                return 0.18;
        }
    }

    getStyleProfiles() {
        return [
            { key: 'matrix-spectral', base: 'matrix', backdrop: 'cobalt', paletteShift: 0, glyphMode: 'katakana', columnDensity: 1.2, beamAlpha: 0.2, fadeAlpha: 0.1 },
            { key: 'matrix-lattice', base: 'matrix', backdrop: 'ink', paletteShift: -20, glyphMode: 'hex', columnDensity: 1.5, columnWidth: 30, fadeAlpha: 0.12 },
            { key: 'matrix-zen', base: 'matrix', backdrop: 'verdant', paletteShift: 40, glyphMode: 'binary', columnDensity: 0.8, glyphScale: 1.35, fadeAlpha: 0.18 },
            { key: 'mosaic-stained', base: 'mosaic', backdrop: 'ember', paletteShift: 20, mosaicStyle: 'stained', mosaicGridMin: 10, mosaicGridMax: 20, fadeAlpha: 0.35, grain: true, frame: true },
            { key: 'mosaic-shards', base: 'mosaic', backdrop: 'cobalt', paletteShift: -10, mosaicStyle: 'shards', mosaicGridMin: 12, mosaicGridMax: 22, fadeAlpha: 0.28, grain: true, frame: true },
            { key: 'mosaic-circuit', base: 'mosaic', backdrop: 'aurora', paletteShift: 35, mosaicStyle: 'circuit', mosaicGridMin: 14, mosaicGridMax: 24, fadeAlpha: 0.3, grain: true },
            { key: 'tree-bonsai', base: 'tree', backdrop: 'verdant', paletteShift: 10, treeDepth: 8, leafMode: 'petal', fadeAlpha: 0.24 },
            { key: 'tree-coral', base: 'tree', backdrop: 'iris', paletteShift: 55, treeDepth: 11, leafMode: 'coral', fadeAlpha: 0.2 },
            { key: 'tree-ember', base: 'tree', backdrop: 'ember', paletteShift: 30, treeDepth: 10, leafMode: 'glow', fadeAlpha: 0.2 },
            { key: 'life-quilt', base: 'life', backdrop: 'aurora', paletteShift: 10, lifeCellStyle: 'diamond', lifeMaxAge: 24, fadeAlpha: 0.28 },
            { key: 'life-bioreactor', base: 'life', backdrop: 'noir', paletteShift: -15, lifeCellStyle: 'circle', lifeMaxAge: 14, fadeAlpha: 0.22 },
            { key: 'life-neon', base: 'life', backdrop: 'cobalt', paletteShift: 35, lifeCellStyle: 'square', lifeMaxAge: 20, fadeAlpha: 0.18 },
            { key: 'strata-oxide', base: 'strata', backdrop: 'ember', paletteShift: 20, strataLayers: 9, strataAmplitude: 70, strataScale: 0.0045, fadeAlpha: 0.2, grain: true, frame: true },
            { key: 'strata-ghost', base: 'strata', backdrop: 'noir', paletteShift: -30, strataLayers: 11, strataAmplitude: 45, strataScale: 0.006, fadeAlpha: 0.22, grain: true },
            { key: 'strata-spectra', base: 'strata', backdrop: 'aurora', paletteShift: 45, strataLayers: 12, strataAmplitude: 80, strataScale: 0.0035, fadeAlpha: 0.16, grain: true },
            { key: 'runes-ink', base: 'runes', backdrop: 'ink', paletteShift: -10, runeDensity: 1, runeScale: 1, fadeAlpha: 0.2, grain: true },
            { key: 'runes-neon', base: 'runes', backdrop: 'cobalt', paletteShift: 50, runeDensity: 1.3, runeScale: 1.1, fadeAlpha: 0.14 },
            { key: 'runes-ritual', base: 'runes', backdrop: 'noir', paletteShift: 15, runeDensity: 0.9, runeScale: 1.2, fadeAlpha: 0.18, grain: true, frame: true },
            { key: 'weave-tartan', base: 'weave', backdrop: 'verdant', paletteShift: 20, weaveCols: 10, weaveRows: 8, weaveAmplitude: 40, fadeAlpha: 0.2, grain: true, frame: true },
            { key: 'weave-satin', base: 'weave', backdrop: 'iris', paletteShift: -15, weaveCols: 14, weaveRows: 10, weaveAmplitude: 30, fadeAlpha: 0.18, grain: true },
            { key: 'rift-glitch', base: 'rift', backdrop: 'noir', paletteShift: 25, riftSlices: 14, riftJitter: 30, fadeAlpha: 0.16, grain: true },
            { key: 'rift-paper', base: 'rift', backdrop: 'ember', paletteShift: -20, riftSlices: 18, riftJitter: 18, fadeAlpha: 0.2, grain: true, frame: true },
            { key: 'barcode-oxide', base: 'barcode', backdrop: 'ember', paletteShift: 10, barCount: 70, fadeAlpha: 0.18, grain: true, frame: true },
            { key: 'barcode-mono', base: 'barcode', backdrop: 'noir', paletteShift: -25, barCount: 60, fadeAlpha: 0.22, grain: true },
            { key: 'barcode-neon', base: 'barcode', backdrop: 'cobalt', paletteShift: 45, barCount: 75, fadeAlpha: 0.14, grain: true },
            { key: 'collage-paper', base: 'collage', backdrop: 'iris', paletteShift: -5, collageCount: 26, fadeAlpha: 0.2, grain: true, frame: true },
            { key: 'collage-kraft', base: 'collage', backdrop: 'ember', paletteShift: 18, collageCount: 30, fadeAlpha: 0.18, grain: true },
            { key: 'collage-noir', base: 'collage', backdrop: 'noir', paletteShift: -30, collageCount: 22, fadeAlpha: 0.22, grain: true, frame: true },
            { key: 'city-blueprint', base: 'city', backdrop: 'cobalt', paletteShift: 0, fadeAlpha: 1, cityTheme: 'blueprint' },
            { key: 'city-neon', base: 'city', backdrop: 'noir', paletteShift: 40, fadeAlpha: 1, cityTheme: 'neon' },
            { key: 'city-sunset', base: 'city', backdrop: 'ember', paletteShift: 20, fadeAlpha: 1, cityTheme: 'sunset' },
            { key: 'paint-oil', base: 'paint', backdrop: 'canvas', paletteShift: 10, fadeAlpha: 0.02, paintStyle: 'oil' },
            { key: 'paint-watercolor', base: 'paint', backdrop: 'paper', paletteShift: -10, fadeAlpha: 0.05, paintStyle: 'watercolor' },
            { key: 'attractor-clifford', base: 'attractor', backdrop: 'noir', paletteShift: 0, fadeAlpha: 0.1, attractorType: 'clifford' },
            { key: 'attractor-lorenz', base: 'attractor', backdrop: 'noir', paletteShift: 20, fadeAlpha: 0.05, attractorType: 'lorenz' },
            { key: 'bio-fungus', base: 'bio', backdrop: 'noir', paletteShift: 30, fadeAlpha: 1, bioType: 'fungus' },
            { key: 'bio-coral', base: 'bio', backdrop: 'cobalt', paletteShift: -20, fadeAlpha: 1, bioType: 'coral' },
            { key: 'collage-dada', base: 'collage', backdrop: 'paper', paletteShift: -10, fadeAlpha: 1, materialType: 'dada' },
            { key: 'collage-constructivist', base: 'collage', backdrop: 'noir', paletteShift: 40, fadeAlpha: 1, materialType: 'constructivist' },
            { key: 'collage-mixed', base: 'collage', backdrop: 'canvas', paletteShift: 10, fadeAlpha: 1, materialType: 'mixed' },
            { key: 'structure-cube', base: 'three', backdrop: 'noir', paletteShift: 0, threeType: 'cube' },
            { key: 'network-sphere', base: 'three', backdrop: 'noir', paletteShift: 20, threeType: 'sphere' },
            { key: 'galaxy-spiral', base: 'three', backdrop: 'noir', paletteShift: -20, threeType: 'spiral' },
            { key: 'cyber-city', base: 'three', backdrop: 'noir', paletteShift: 0, threeType: 'cyber-city' },
            { key: 'abstract-flow', base: 'three', backdrop: 'noir', paletteShift: 10, threeType: 'abstract-flow' },
            { key: 'minimal-sculpture', base: 'three', backdrop: 'noir', paletteShift: 30, threeType: 'minimal-sculpture' },
            { key: 'organic-crystal', base: 'three', backdrop: 'noir', paletteShift: -10, threeType: 'organic-crystal' },
            { key: 'vapor-grid', base: 'three', backdrop: 'noir', paletteShift: 40, threeType: 'vapor-grid' },
            { key: 'glitch-monolith', base: 'three', backdrop: 'noir', paletteShift: -30, threeType: 'glitch-monolith' }
        ];
    }

    getStylePalette(signature, count) {
        const profile = signature.styleProfile || {};
        const strategy = profile.paletteStrategy || 'random';
        const seed = signature.hash + this.hashString(signature.styleKey || signature.style);
        const rng = this.createSeededRNG(seed);
        const base = signature.primaryHue;
        const palette = [];

        for (let i = 0; i < count; i++) {
            let hue = base;
            let sat = 40 + rng() * 45;
            let light = 28 + rng() * 45;

            if (strategy === 'monochromatic') {
                hue = base + (rng() - 0.5) * 10;
                sat = 20 + rng() * 60;
                light = 15 + rng() * 70;
            } else if (strategy === 'analogous') {
                hue = (base + (rng() - 0.5) * 60 + 360) % 360;
            } else if (strategy === 'complementary') {
                hue = (base + (rng() > 0.5 ? 180 : 0) + (rng()-0.5)*20 + 360) % 360;
            } else if (strategy === 'triadic') {
                const legs = [0, 120, 240];
                hue = (base + legs[Math.floor(rng()*3)] + (rng()-0.5)*20 + 360) % 360;
            } else if (strategy === 'tetradic') {
                const legs = [0, 90, 180, 270];
                hue = (base + legs[Math.floor(rng()*4)] + (rng()-0.5)*20 + 360) % 360;
            } else {
                // Random/Wild
                const spread = 30 + (signature.hash % 60);
                hue = (base + (i * spread + rng() * 30 - 15) + 360) % 360;
            }
            
            palette.push({ h: hue, s: sat, l: light });
        }

        return palette.slice(0, count);
    }

    getPaletteColorForHue(hue, palette) {
        if (!palette || !palette.length) return { h: hue, s: 60, l: 60 };
        let closest = palette[0];
        let best = Infinity;
        for (let i = 0; i < palette.length; i++) {
            const candidate = palette[i];
            const delta = Math.abs(((hue - candidate.h + 540) % 360) - 180);
            if (delta < best) {
                best = delta;
                closest = candidate;
            }
        }
        return closest;
    }

    createProceduralTexture(type, width, height, tone, seed) {
        const c = document.createElement('canvas');
        c.width = width;
        c.height = height;
        const ctx = c.getContext('2d');
        const rng = this.createSeededRNG(seed);
        
        ctx.fillStyle = `hsla(${tone.h}, ${tone.s}%, ${tone.l}%, 1)`;
        ctx.fillRect(0, 0, width, height);
        
        ctx.fillStyle = `rgba(0,0,0,0.2)`;
        
        if (type === 'halftone') {
            const dotSize = 4;
            for(let y=0; y<height; y+=dotSize*1.5) {
                for(let x=0; x<width; x+=dotSize*1.5) {
                    if ((x+y)%2===0) {
                        ctx.beginPath();
                        ctx.arc(x, y, dotSize * rng(), 0, Math.PI*2);
                        ctx.fill();
                    }
                }
            }
        } else if (type === 'noise') {
            const imgData = ctx.getImageData(0,0,width,height);
            for(let i=0; i<imgData.data.length; i+=4) {
                if(rng()>0.5) {
                    const v = Math.floor(rng()*50);
                    imgData.data[i] -= v;
                    imgData.data[i+1] -= v;
                    imgData.data[i+2] -= v;
                }
            }
            ctx.putImageData(imgData,0,0);
        } else if (type === 'lines') {
            ctx.lineWidth = 1;
            ctx.beginPath();
            for(let y=0; y<height; y+=5) {
                ctx.moveTo(0, y);
                ctx.lineTo(width, y + (rng()-0.5)*5);
            }
            ctx.stroke();
        } else if (type === 'grid') {
            ctx.lineWidth = 2;
            ctx.beginPath();
            const step = 20;
            for(let x=0; x<width; x+=step) { ctx.moveTo(x,0); ctx.lineTo(x,height); }
            for(let y=0; y<height; y+=step) { ctx.moveTo(0,y); ctx.lineTo(width,y); }
            ctx.stroke();
        }
        
        return c;
    }

    createGrainPattern(size, rng) {
        const grain = document.createElement('canvas');
        grain.width = size;
        grain.height = size;
        const gctx = grain.getContext('2d');
        const image = gctx.createImageData(size, size);
        for (let i = 0; i < image.data.length; i += 4) {
            const tone = Math.floor(rng() * 255);
            const alpha = rng() > 0.55 ? 30 : 0;
            image.data[i] = tone;
            image.data[i + 1] = tone;
            image.data[i + 2] = tone;
            image.data[i + 3] = alpha;
        }
        gctx.putImageData(image, 0, 0);
        return this.ctx.createPattern(grain, 'repeat');
    }

    drawBackdrop(width, height, signature) {
        const ctx = this.ctx;
        const bg = signature.styleProfile.bg || { mode: 'solid', stops: [{offset:0, alpha:1, shift:0}] };
        const primary = signature.primaryHue;
        
        let style = null;
        
        if (bg.mode === 'solid') {
            style = `hsla(${(primary + bg.stops[0].shift)%360}, 20%, 5%, 1)`;
        } else if (bg.mode === 'linear') {
            const grad = ctx.createLinearGradient(0, 0, width, height);
            bg.stops.forEach(stop => {
                grad.addColorStop(stop.offset, `hsla(${(primary + stop.shift)%360}, 40%, 10%, ${stop.alpha})`);
            });
            style = grad;
        } else if (bg.mode === 'radial') {
            const grad = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, Math.max(width, height));
            bg.stops.forEach(stop => {
                grad.addColorStop(stop.offset, `hsla(${(primary + stop.shift)%360}, 40%, 10%, ${stop.alpha})`);
            });
            style = grad;
        } else {
            // Complex
            const grad = ctx.createLinearGradient(0, 0, width, height);
            grad.addColorStop(0, `hsla(${primary}, 50%, 5%, 1)`);
            grad.addColorStop(0.5, `hsla(${(primary+60)%360}, 40%, 8%, 1)`);
            grad.addColorStop(1, `hsla(${(primary+120)%360}, 50%, 5%, 1)`);
            style = grad;
        }
        
        ctx.fillStyle = style;
        ctx.fillRect(0, 0, width, height);
        
        // Noise
        if (bg.noise > 0 && this.styleState.grainPattern) {
            ctx.save();
            ctx.globalAlpha = bg.noise;
            ctx.fillStyle = this.styleState.grainPattern;
            ctx.fillRect(0, 0, width, height);
            ctx.restore();
        }
    }

    drawFrame(width, height, signature) {
        const palette = this.styleState.palette || [];
        const frameColor = palette[0] || { h: signature.primaryHue, s: 30, l: 25 };
        const lineColor = palette[1] || { h: signature.secondaryHue, s: 20, l: 35 };
        const outer = Math.max(10, Math.min(width, height) * 0.02);
        const inner = outer * 0.6;

        this.ctx.strokeStyle = `hsla(${frameColor.h}, ${frameColor.s}%, ${Math.min(frameColor.l + 10, 80)}%, 0.7)`;
        this.ctx.lineWidth = outer;
        this.ctx.strokeRect(outer * 0.5, outer * 0.5, width - outer, height - outer);

        this.ctx.strokeStyle = `hsla(${lineColor.h}, ${lineColor.s}%, ${Math.max(lineColor.l - 10, 10)}%, 0.5)`;
        this.ctx.lineWidth = inner;
        this.ctx.strokeRect(outer + inner * 0.5, outer + inner * 0.5, width - 2 * outer - inner, height - 2 * outer - inner);
    }
    
                async visualizeRepository(repoData) {
    
                    // Ensure canvas is sized correctly
    
                    this.resize();
    
            
    
                    // Generate unique signature based on repo
    
                    const signature = this.generateSignature(repoData);
    
            
    
                    // Initialize seeded RNG
    
                    this.rng = this.createSeededRNG(signature.hash);
    
                    this.noise = new SeededPerlinNoise(signature.hash);
    
                    
    
                    // Initialize particles/state based on style
    
                    this.initializeState(signature, repoData);
    
                    
    
                    // Start animation
    
                    this.animate(signature, repoData);
    
                }
    
            
    
    generateProceduralProfile(baseStyle, seed, complexity, energy, traits) {
        const rng = this.createSeededRNG(seed);
        
        // Helper for range
        const range = (min, max) => min + rng() * (max - min);
        const pick = (arr) => arr[Math.floor(rng() * arr.length)];
        
        // 1. Global Visuals
        const compositeModes = ['source-over', 'lighter', 'screen', 'overlay', 'hard-light', 'difference', 'exclusion', 'color-dodge'];
        const composite = pick(compositeModes);
        
        // Semantic Mapping: History = Trails
        // Older repos (1000+ days) get longer trails (lower fadeAlpha)
        const historyFactor = Math.min(1, (traits?.ageDays || 0) / 2000); // 0 to 1
        let fadeAlpha = range(0.1, 0.4) - (historyFactor * 0.05);
        if (fadeAlpha < 0.02) fadeAlpha = 0.02;

        // Semantic Mapping: Energy = Speed
        // Energy is 0-100 (based on commit count/20)
        const speedFactor = Math.min(1, energy / 100);
        const speed = (0.5 + speedFactor * 1.5) * (rng() > 0.5 ? 1 : -1);
        
        // 2. Palette Logic
        const paletteShift = Math.floor(range(0, 360));
        const secondaryOffset = Math.floor(range(30, 180));
        const tertiaryOffset = Math.floor(range(180, 300));
        
        // 3. CSS Filters
        const filters = [];
        if (rng() > 0.9) filters.push(`contrast(${range(1.1, 1.3)})`);
        if (rng() > 0.9) filters.push(`saturate(${range(1.1, 1.5)})`);
        const filter = filters.join(' ') || 'none';

        // 4. Background
        const bgModes = ['solid', 'linear', 'radial'];
        const bg = {
            mode: pick(bgModes),
            stops: [
                { offset: 0, alpha: 1, shift: 0 },
                { offset: 1, alpha: 1, shift: Math.floor(range(20, 60)) }
            ],
            noise: rng() > 0.5 ? range(0.02, 0.05) : 0
        };

        // 5. Engine Specific Params (Keep existing safe ranges)
        const params = {};
        // ... (engine params kept same, omitting for brevity in this replace block, need to keep them)
        if (baseStyle === 'city') {
            params.gridSize = Math.floor(range(20, 30));
            params.isoAngle = 0.5;
            params.tileW = range(25, 35);
            params.tileH = params.tileW * 0.6;
            params.buildingRoundness = 0;
            params.strokeWidth = 1;
            params.fillOpacity = 0.9;
            params.wireframeOnly = false;
        } else if (baseStyle === 'bio') {
            const recipes = [
                { dA: 1.0, dB: 0.5, f: 0.055, k: 0.062 },
                { dA: 1.0, dB: 0.5, f: 0.035, k: 0.060 },
                { dA: 1.0, dB: 0.5, f: 0.025, k: 0.060 },
                { dA: 1.0, dB: 0.5, f: 0.022, k: 0.051 },
                { dA: 1.0, dB: 0.5, f: 0.029, k: 0.057 }
            ];
            const r = pick(recipes);
            params.bioParams = { dA: r.dA, dB: r.dB, f: r.f, k: r.k };
            params.threshold = 0.1; 
            params.colorMode = pick(['smooth', 'banded']);
        } else if (baseStyle === 'paint') {
            params.style = pick(['oil', 'watercolor', 'marker']);
            params.brushSize = range(2.0, 5.0);
            params.turbulence = range(0.5, 1.5);
            params.accumulation = range(0.05, 0.15);
        } else if (baseStyle === 'collage') {
            params.count = Math.floor(range(15, 25));
            params.materials = ['solid', 'grid', 'noise'];
            params.roughness = 2; 
            params.rotation = range(0, 0.5); 
        } else if (baseStyle === 'three') {
            params.cameraZ = 400;
            params.fogDensity = 0;
            params.shape = pick(['cube', 'sphere', 'spiral']);
            params.wireframe = false;
            params.particleSize = range(4, 8);
        } else if (baseStyle === 'attractor') {
            params.a = range(-2.0, 2.0);
            params.b = range(-2.0, 2.0);
            params.c = range(-2.0, 2.0);
            params.d = range(-2.0, 2.0);
            params.scale = range(150, 250);
        }

        // 6. Advanced Composition (Semantic)
        let paletteStrategy = 'random';
        if (traits?.diversity > 0.5) {
            paletteStrategy = pick(['triadic', 'tetradic', 'complementary']);
        } else {
            paletteStrategy = pick(['monochromatic', 'analogous']);
        }

        let symmetry = 'none';
        if (traits?.gini > 0.6) { // High inequality = Order
            symmetry = pick(['horizontal', 'vertical', 'radial-4']);
        } else { // High equality = Chaos/Freedom
            symmetry = 'none';
        }

        let glitchMode = 'none';
        if (traits?.ageDays > 365 * 5) { // Old code = Decay
            glitchMode = pick(['scanlines', 'vhs-tracking']);
        }

        const borderMode = rng() > 0.7 ? pick(['simple', 'polaroid', 'film-strip', 'vignette']) : 'none';
        const textureOverlay = rng() > 0.6 ? pick(['paper', 'canvas', 'noise', 'grid']) : 'none';

        return {
            paletteShift,
            secondaryOffset,
            tertiaryOffset,
            fadeAlpha,
            speed,
            composite,
            filter,
            bg,
            params,
            // New Traits
            paletteStrategy,
            symmetry,
            borderMode,
            glitchMode,
            textureOverlay
        };
    }

    generateSignature(repoData) {
        const { info, languages, contributors, commits } = repoData;
        const repoName = info.full_name;
        const hash = this.hashString(repoName);

        // Determine dominant language for base hue
        const dominantLang = Object.keys(languages)[0] || 'JavaScript';
        const langHash = this.hashString(dominantLang);
        const baseHue = langHash % 360;
        
        const complexity = Math.min(Object.keys(languages || {}).length + (contributors || []).length / 5, 20);
        const energy = Math.min((commits || []).length / 20, 100);

        // Semantic Analysis
        const traits = this.analyzeRepoTraits(repoData);
        
        let availableEngines = [];
        
        // 1. The "Auteur" (One dominant mind)
        if (traits.gini > 0.55 || traits.teamSize < 3) {
            availableEngines = ['attractor', 'minimal-sculpture', 'glitch-monolith', 'paint', 'rift'];
        } 
        // 2. The "Society" (Collaborative swarm)
        else if (traits.teamSize > 15 || traits.gini < 0.3) {
            availableEngines = ['city', 'galaxy-spiral', 'network-sphere', 'bio', 'life'];
        }
        // 3. The "Legacy" (Old, deep roots)
        else if (traits.ageDays > 1500) {
            availableEngines = ['strata', 'tree', 'runes', 'matrix'];
        }
        // 4. The "Polyglot" (Complex materials)
        else if (traits.diversity > 0.8) {
            availableEngines = ['collage', 'mosaic', 'weave', 'barcode'];
        }
        // 5. Default / Balanced
        else {
            availableEngines = ['vapor-grid', 'abstract-flow', 'cyber-city', 'paint', 'bio'];
        }
        
        // Deterministic selection from the semantically filtered list
        const engineIndex = Math.abs(hash) % availableEngines.length;
        const baseStyle = availableEngines[engineIndex];
        
        // Generate TRULY unique parameters
        const procedural = this.generateProceduralProfile(baseStyle, hash, complexity, energy, traits);

        const primaryHue = (baseHue + procedural.paletteShift + 360) % 360;
        const secondaryHue = (primaryHue + procedural.secondaryOffset) % 360;
        const tertiaryHue = (primaryHue + procedural.tertiaryOffset) % 360;

        return {
            hash: hash,
            primaryHue: primaryHue,
            secondaryHue: secondaryHue,
            tertiaryHue: tertiaryHue,
            complexity: complexity,
            energy: energy,
            style: baseStyle,
            styleProfile: procedural, 
            speed: procedural.speed,
            traits: traits // Save for debug/overlay
        };
    }

    mapCommitToParticle(commit, index, total, width, height, timeRange) {
        const { minTime, maxTime } = timeRange;
        const commitInfo = commit?.commit || {};
        const authorInfo = commitInfo.author || {};
        const committerInfo = commitInfo.committer || {};
        const commitMessage = commitInfo.message || '';
        const authorName = authorInfo.name || authorInfo.email || 'Unknown';
        const stats = commit.stats || { total: 10 };
        const authorHash = this.hashString(authorName);
        const hashSource = String(commit.sha || commitMessage || authorName);
        const commitHash = this.hashString(hashSource);
        const rawCommitDate = authorInfo.date || committerInfo.date;
        const parsedCommitDate = new Date(rawCommitDate).getTime();
        const commitDate = Number.isFinite(parsedCommitDate)
            ? parsedCommitDate
            : (minTime + maxTime) / 2;
        const msgLength = commitMessage.length;

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
            originX: x,
            originY: y,
            prevX: x,
            prevY: y,
            vx, vy,
            size,
            hue,
            alpha: 0.5 + ((commitHash % 50) / 100), // 0.5 - 1.0
            phase: (commitDate % 1000) / 1000 * Math.PI * 2,
            commit
        };
    }

    initializeState(signature, repoData) {
        // Handle 3D vs 2D mode switching
        if (signature.style === 'three') {
            if (window.THREE) {
                this.canvas.style.display = 'none';
                this.initializeThree(signature, repoData);
                return;
            } else {
                console.warn('Three.js not loaded, falling back to 2D City style');
                signature.style = 'city';
                // Fallback profile
                signature.styleProfile = this.generateProceduralProfile('city', signature.hash, 10, 10);
            }
        } 
        
        this.canvas.style.display = 'block';
        if (this.threeCanvas) this.threeCanvas.style.display = 'none';

        this.particles = [];
        this.styleState = {};
        this.lifeGrid = [];
        
        // Use procedural palette
        this.styleState.palette = this.getStylePalette(signature, 5);
        
        // Procedural Params
        const params = signature.styleProfile.params || {};
        
        if (signature.styleProfile.bg?.noise > 0) {
            const grainRng = this.createSeededRNG(signature.hash + 991);
            this.styleState.grainPattern = this.createGrainPattern(120, grainRng);
        }
        
        const { commits } = repoData;
        const dpr = window.devicePixelRatio || 1;
        const width = this.canvas.width / dpr;
        const height = this.canvas.height / dpr;
        
        const activeCommits = (commits || []).slice(0, 150);
        if (activeCommits.length === 0) return;

        // Calculate Time Range
        const times = activeCommits
            .map(c => {
                const dateValue = c?.commit?.author?.date || c?.commit?.committer?.date;
                const parsed = new Date(dateValue).getTime();
                return Number.isFinite(parsed) ? parsed : null;
            })
            .filter((time) => time !== null);

        let minTime, maxTime;
        if (times.length === 0) {
            const fallbackBase = 946684800000;
            minTime = fallbackBase - 86400000;
            maxTime = fallbackBase + 86400000;
        } else {
            minTime = Math.min(...times);
            maxTime = Math.max(...times);
        }
        if (minTime === maxTime) { minTime -= 86400000; maxTime += 86400000; }
        
        const timeRange = { minTime, maxTime };

        // Generate Particles
        activeCommits.forEach((commit, i) => {
            const p = this.mapCommitToParticle(commit, i, activeCommits.length, width, height, timeRange);
            if (!isNaN(p.x) && !isNaN(p.y)) this.particles.push(p);
        });

        // Initialize Engine State from Params
        if (signature.style === 'city') {
            const gridSize = params.gridSize || 20;
            const cols = Math.ceil(width / gridSize);
            const rows = Math.ceil(height / gridSize);
            const grid = new Array(cols * rows).fill(null);
            
            activeCommits.forEach((commit, i) => {
                const seed = this.hashString(commit.commit?.sha || String(i));
                const x = Math.floor((seed % 1000) / 1000 * cols);
                const y = Math.floor(((seed * 13) % 1000) / 1000 * rows);
                const idx = y * cols + x;
                const stats = commit.stats || { total: 10 };
                const heightVal = Math.min(Math.log(stats.total + 1) * 8, 50);
                const hue = (seed) % 360;
                
                if (!grid[idx] || grid[idx].h < heightVal) {
                    grid[idx] = { h: heightVal, hue: hue, x: x * gridSize, y: y * gridSize, z: heightVal };
                }
            });
            this.styleState.cityGrid = grid;
            this.styleState.sortedBuildings = grid.filter(b => b).sort((a, b) => (a.y + a.x) - (b.y + b.x));
            this.styleState.gridSize = gridSize;
            this.styleState.cityTheme = params; // Pass all params
        }

        if (signature.style === 'paint') {
            const brushes = [];
            activeCommits.forEach((commit, i) => {
                 const seed = this.hashString(commit.commit?.sha || String(i));
                 const hue = seed % 360;
                 const size = (Math.min(Math.log((commit.stats?.total || 1) + 1) * 10, 60)) * (params.brushSize || 1);
                 
                 brushes.push({
                     x: this.rng() * width,
                     y: this.rng() * height,
                     vx: (this.rng() - 0.5) * 4,
                     vy: (this.rng() - 0.5) * 4,
                     hue: hue,
                     size: size,
                     phase: this.rng() * Math.PI * 2,
                     life: 0
                 });
            });
            this.styleState.brushes = brushes;
            this.styleState.paintStyle = params.style || 'oil';
        }

        if (signature.style === 'attractor') {
             this.styleState.attractorParams = params;
             this.styleState.attractorType = 'clifford';
             this.particles.forEach(p => {
                 p.x = (this.rng() - 0.5) * 5;
                 p.y = (this.rng() - 0.5) * 5;
             });
        }

        if (signature.style === 'bio') {
            const dim = 100; 
            const grid = new Float32Array(dim * dim * 2);
            for(let i=0; i< dim*dim; i++) { grid[i*2] = 1.0; grid[i*2+1] = 0.0; }
            
            activeCommits.forEach((commit, i) => {
                const seed = this.hashString(commit.commit?.sha || String(i));
                const cx = Math.floor((seed % 1000) / 1000 * dim);
                const cy = Math.floor(((seed * 13) % 1000) / 1000 * dim);
                const r = 3 + (seed % 4);
                for(let dy=-r; dy<=r; dy++) {
                    for(let dx=-r; dx<=r; dx++) {
                        const idx = ((cy+dy + dim)%dim)*dim + ((cx+dx + dim)%dim);
                        grid[idx*2 + 1] = 0.9; 
                    }
                }
            });
            
            this.styleState.bioGrid = grid;
            this.styleState.bioNext = new Float32Array(dim * dim * 2);
            this.styleState.bioDim = dim;
            this.styleState.bioParams = params.bioParams || { dA: 1.0, dB: 0.5, f: 0.0545, k: 0.062 };
            this.styleState.bioType = params.colorMode; // Using colorMode as type proxy
        }
        
        if (signature.style === 'collage') {
            const pieceCount = params.count || 15;
            const pieces = [];
            const types = params.materials || ['solid'];
            
            for (let i = 0; i < pieceCount; i++) {
                const seed = signature.hash + i;
                const rng = this.createSeededRNG(seed);
                const hueSeed = (signature.primaryHue + i * 25) % 360;
                const paletteTone = this.getPaletteColorForHue(hueSeed, this.styleState.palette);
                
                const type = types[Math.floor(rng() * types.length)];
                const w = 100 + rng() * 300;
                const h = 100 + rng() * 300;
                const texture = this.createProceduralTexture(type, Math.ceil(w), Math.ceil(h), paletteTone, seed);
                
                pieces.push({
                    x: rng() * width,
                    y: rng() * height,
                    w: w, h: h,
                    rot: (rng() - 0.5) * (params.rotation || Math.PI),
                    drift: rng() * Math.PI * 2,
                    kind: rng() > 0.6 ? 'poly' : 'rect',
                    texture: texture,
                    shadow: rng() > 0.5
                });
            }
            this.styleState.collagePieces = pieces;
        }
        
        // Pass through legacy styles setup if needed (matrix, etc would need similar updates to use 'params')
        // For now, only the primary new styles are fully procedural.
        // Legacy styles will default to their hardcoded behaviors unless we update them too.
        // Given constraints, I'll update Matrix briefly.
        if (signature.style === 'matrix') {
             this.styleState.columnWidth = 30; // Could use params
             this.styleState.columns = []; // ... re-init logic ...
             // Re-using existing logic but ensures it runs
             const columnCount = Math.ceil(width / 30);
             for (let i = 0; i < columnCount; i++) {
                this.styleState.columns.push({
                    x: (i + 0.5) * 30,
                    width: 5,
                    alpha: 0.1 + this.rng() * 0.2,
                    hue: (signature.secondaryHue) % 360
                });
            }
        }
    }

    initializeThree(signature, repoData) {
        if (!window.THREE) {
            console.error('Three.js not loaded');
            return;
        }

        const container = this.canvas.parentElement;
        const width = container.clientWidth;
        const height = container.clientHeight;

        if (!this.threeCanvas) {
            this.threeCanvas = document.createElement('canvas');
            this.threeCanvas.style.position = 'absolute';
            this.threeCanvas.style.top = '0';
            this.threeCanvas.style.left = '0';
            this.threeCanvas.style.width = '100%';
            this.threeCanvas.style.height = '100%';
            this.threeCanvas.style.pointerEvents = 'none'; // Let overlay handle clicks
            container.appendChild(this.threeCanvas);
            
            this.threeRenderer = new THREE.WebGLRenderer({ 
                canvas: this.threeCanvas, 
                alpha: true, 
                antialias: true 
            });
            this.threeRenderer.setSize(width, height);
            this.threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        }
        
        this.threeCanvas.style.display = 'block';
        
        // Cleanup previous state
        this.threePoints = null;
        this.threeGroup = null;
        this.threeGrid = null;
        this.monolith = null;
        this.monolithGeo = null;
        this.monolithBasePos = null;
        
        // Scene Setup
        this.threeScene = new THREE.Scene();
        // Fog for depth
        const hue = signature.primaryHue;
        const col = new THREE.Color(`hsl(${hue}, 20%, 5%)`);
        
        const fogDensity = signature.styleProfile.params?.fogDensity || 0.002;
        this.threeScene.fog = new THREE.FogExp2(col, fogDensity);
        
        this.threeCamera = new THREE.PerspectiveCamera(60, width / height, 0.1, 2000);
        this.threeCamera.position.z = signature.styleProfile.params?.cameraZ || 400;
        
        // Objects
        const { commits } = repoData;
        const activeCommits = (commits || []).slice(0, 500);
        
        const type = signature.styleProfile.threeType || 'cube';
        const palette = this.getStylePalette(signature, 5);
        
        // Symmetry Handling for 3D
        const symmetry = signature.styleProfile.symmetry || 'none';
        
        // --- 1. Cyber City (Cyberpunk) ---
        if (type === 'cyber-city') {
            const cityGroup = new THREE.Group();
            const material = new THREE.MeshBasicMaterial({ color: 0x000000, wireframe: true, transparent: true, opacity: 0.3 });
            const edgeMat = new THREE.LineBasicMaterial({ color: new THREE.Color(`hsl(${palette[0].h}, 100%, 70%)`), transparent: true, opacity: 0.8 });
            
            const gridSize = 20;
            activeCommits.slice(0, 100).forEach((c, i) => {
                const seed = this.hashString(c.commit?.sha || String(i));
                const h = 10 + Math.log(c.stats?.total || 1) * 20;
                const geo = new THREE.BoxGeometry(10, h, 10);
                geo.translate(0, h/2, 0);
                
                const mesh = new THREE.Mesh(geo, material);
                const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat);
                
                const x = ((seed % gridSize) - gridSize/2) * 15;
                const z = ((Math.floor(seed/gridSize) % gridSize) - gridSize/2) * 15;
                
                mesh.position.set(x, -50, z);
                edges.position.set(x, -50, z);
                
                cityGroup.add(mesh);
                cityGroup.add(edges);
            });
            this.threeScene.add(cityGroup);
            this.threeGroup = cityGroup; // Track for rotation
        } 
        
        // --- 2. Minimal Sculpture (Minimalism) ---
        else if (type === 'minimal-sculpture') {
            const group = new THREE.Group();
            const geoms = [
                new THREE.IcosahedronGeometry(10, 0),
                new THREE.BoxGeometry(15, 15, 15),
                new THREE.TorusGeometry(8, 2, 8, 20),
                new THREE.ConeGeometry(8, 15, 4)
            ];
            
            activeCommits.slice(0, 20).forEach((c, i) => {
                const seed = this.hashString(c.commit?.sha || String(i));
                const pTone = palette[seed % palette.length];
                const col = new THREE.Color(`hsl(${pTone.h}, ${pTone.s}%, ${pTone.l}%)`);
                
                const geom = geoms[seed % geoms.length];
                const mat = new THREE.MeshPhongMaterial({ 
                    color: col, 
                    flatShading: true, 
                    shininess: 0 
                });
                
                const mesh = new THREE.Mesh(geom, mat);
                mesh.position.set(
                    (this.rng()-0.5)*100,
                    (this.rng()-0.5)*100,
                    (this.rng()-0.5)*100
                );
                mesh.rotation.set(this.rng()*Math.PI, this.rng()*Math.PI, 0);
                const scale = 1 + Math.log(c.stats?.total || 1) * 0.5;
                mesh.scale.set(scale, scale, scale);
                
                group.add(mesh);
            });
            
            // Add lights for this style
            const light = new THREE.DirectionalLight(0xffffff, 1);
            light.position.set(10, 10, 10);
            this.threeScene.add(light);
            const amb = new THREE.AmbientLight(0x404040);
            this.threeScene.add(amb);
            
            this.threeScene.add(group);
            this.threeGroup = group;
        }
        
        // --- 3. Organic Crystal (Surreal/Organic) ---
        else if (type === 'organic-crystal') {
            const group = new THREE.Group();
            const mainGeo = new THREE.IcosahedronGeometry(40, 1);
            const mainMat = new THREE.MeshPhysicalMaterial({
                color: new THREE.Color(`hsl(${palette[0].h}, 80%, 50%)`),
                metalness: 0.1,
                roughness: 0.1,
                transparent: true,
                opacity: 0.8,
                transmission: 0.5
            });
            const center = new THREE.Mesh(mainGeo, mainMat);
            group.add(center);
            
            activeCommits.slice(0, 50).forEach((c, i) => {
                const seed = this.hashString(c.commit?.sha || String(i));
                const pTone = palette[seed % palette.length];
                const size = 5 + Math.log(c.stats?.total || 1) * 2;
                
                const geo = new THREE.IcosahedronGeometry(size, 0);
                const mat = new THREE.MeshPhysicalMaterial({
                    color: new THREE.Color(`hsl(${pTone.h}, 70%, 60%)`),
                    metalness: 0.2,
                    roughness: 0.2
                });
                
                const mesh = new THREE.Mesh(geo, mat);
                // Position on surface approx
                const theta = this.rng() * Math.PI * 2;
                const phi = Math.acos(2 * this.rng() - 1);
                const r = 40;
                mesh.position.set(
                    r * Math.sin(phi) * Math.cos(theta),
                    r * Math.sin(phi) * Math.sin(theta),
                    r * Math.cos(phi)
                );
                mesh.lookAt(0,0,0);
                group.add(mesh);
            });
            
            const light = new THREE.PointLight(0xffffff, 1, 500);
            light.position.set(50, 50, 50);
            this.threeScene.add(light);
            this.threeScene.add(new THREE.AmbientLight(0x222222));
            this.threeScene.add(group);
            this.threeGroup = group;
        }
        
        // --- 4. Vapor Grid (Vaporwave) ---
        else if (type === 'vapor-grid') {
            // Sun
            const sunGeo = new THREE.CircleGeometry(60, 32);
            const sunMat = new THREE.MeshBasicMaterial({ 
                color: new THREE.Color(`hsl(${palette[0].h}, 100%, 70%)`) 
            });
            const sun = new THREE.Mesh(sunGeo, sunMat);
            sun.position.set(0, 30, -200);
            this.threeScene.add(sun);
            
            // Moving Grid
            const gridGeo = new THREE.PlaneGeometry(600, 600, 40, 40);
            // Distort grid
            const pos = gridGeo.attributes.position;
            for(let i=0; i<pos.count; i++) {
                const z = pos.getZ(i);
                pos.setZ(i, z + Math.sin(pos.getX(i)*0.05)*10);
            }
            gridGeo.computeVertexNormals();
            
            const gridMat = new THREE.MeshBasicMaterial({ 
                color: new THREE.Color(`hsl(${palette[1].h}, 100%, 50%)`),
                wireframe: true
            });
            const grid = new THREE.Mesh(gridGeo, gridMat);
            grid.rotation.x = -Math.PI / 2;
            grid.position.y = -50;
            this.threeScene.add(grid);
            this.threeGrid = grid; // Animate this
            
            // Floating Pyramids
            activeCommits.slice(0, 30).forEach((c, i) => {
                const seed = this.hashString(c.commit?.sha || String(i));
                const geo = new THREE.ConeGeometry(5, 10, 4);
                const mat = new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true });
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.set(
                    (this.rng()-0.5)*400,
                    (this.rng()*50) - 20,
                    (this.rng()-0.5)*200 - 50
                );
                mesh.rotation.z = Math.PI;
                this.threeScene.add(mesh);
            });
        }
        
        // --- 5. Glitch Monolith (Glitch) ---
        else if (type === 'glitch-monolith') {
            const geo = new THREE.BoxGeometry(40, 120, 10, 10, 30, 2);
            const mat = new THREE.MeshBasicMaterial({ 
                color: 0xffffff, 
                wireframe: true,
                transparent: true,
                opacity: 0.5
            });
            this.monolith = new THREE.Mesh(geo, mat);
            this.monolithGeo = geo;
            this.monolithBasePos = geo.attributes.position.clone(); // Store original
            this.threeScene.add(this.monolith);
            
            // Random floating debris
            const debrisGeo = new THREE.BufferGeometry();
            const dPos = [];
            for(let i=0; i<200; i++) {
                dPos.push((this.rng()-0.5)*300, (this.rng()-0.5)*300, (this.rng()-0.5)*300);
            }
            debrisGeo.setAttribute('position', new THREE.Float32BufferAttribute(dPos, 3));
            const debris = new THREE.Points(debrisGeo, new THREE.PointsMaterial({color: 0xff00ff, size: 2}));
            this.threeScene.add(debris);
        }
        
        // --- 6. Abstract Flow (Abstract Expressionism) / Default Points ---
        else {
            // Default to Points logic (Abstract Flow, Cube, Sphere, Spiral)
            const geometry = new THREE.BufferGeometry();
            const positions = [];
            const colors = [];
            const sizes = [];
            
            activeCommits.forEach((commit, i) => {
                const seed = this.hashString(commit.commit?.sha || String(i));
                const pTone = palette[seed % palette.length] || {h:0, s:0, l:100};
                const color = new THREE.Color(`hsl(${pTone.h}, ${pTone.s}%, ${pTone.l}%)`);
                
                let x, y, z;
                
                if (type === 'abstract-flow') {
                    // Strange Attractor-ish
                    const t = i * 0.1;
                    x = Math.sin(t) * (100 + Math.cos(t*0.5)*50);
                    y = Math.cos(t) * (100 + Math.sin(t*0.3)*50);
                    z = Math.sin(t*1.5) * 100;
                    // Add noise
                    x += (this.rng()-0.5)*20;
                    y += (this.rng()-0.5)*20;
                    z += (this.rng()-0.5)*20;
                } else if (type === 'cube') {
                    // Distributed in a cube volume
                    const range = 300;
                    x = (this.rng() - 0.5) * range;
                    y = (this.rng() - 0.5) * range;
                    z = (this.rng() - 0.5) * range;
                } else if (type === 'sphere') {
                    // Surface of a sphere + random depth
                    const r = 150 + this.rng() * 50;
                    const theta = this.rng() * Math.PI * 2;
                    const phi = Math.acos(2 * this.rng() - 1);
                    x = r * Math.sin(phi) * Math.cos(theta);
                    y = r * Math.sin(phi) * Math.sin(theta);
                    z = r * Math.cos(phi);
                } else {
                    // Spiral Galaxy
                    const angle = i * 0.1;
                    const r = i * 0.5 + 20;
                    x = r * Math.cos(angle) + (this.rng()-0.5)*20;
                    y = (this.rng()-0.5) * 40;
                    z = r * Math.sin(angle) + (this.rng()-0.5)*20;
                }
                
                positions.push(x, y, z);
                colors.push(color.r, color.g, color.b);
                sizes.push(5 + Math.log(commit.stats?.total || 1) * 2);
            });
            
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
            geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
            
            // Shader Material for nice dots
            const material = new THREE.PointsMaterial({
                size: 4,
                vertexColors: true,
                transparent: true,
                opacity: 0.8,
                sizeAttenuation: true,
                blending: THREE.AdditiveBlending
            });
            
            this.threePoints = new THREE.Points(geometry, material);
            this.threeScene.add(this.threePoints);
            
            // Add connections for 'network' or 'cube'
            if (type !== 'spiral' && type !== 'abstract-flow') {
                const lineMat = new THREE.LineBasicMaterial({
                    color: 0xffffff,
                    transparent: true,
                    opacity: 0.1,
                    blending: THREE.AdditiveBlending
                });
                
                const lineGeo = new THREE.BufferGeometry();
                const linePos = [];
                for(let i=0; i<positions.length/3 - 2; i++) {
                    if (this.rng() > 0.5) continue;
                    const i3 = i*3;
                    linePos.push(positions[i3], positions[i3+1], positions[i3+2]);
                    linePos.push(positions[i3+3], positions[i3+4], positions[i3+5]);
                }
                lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3));
                const lines = new THREE.LineSegments(lineGeo, lineMat);
                this.threeScene.add(lines);
                
                // Track for symmetry
                if (!this.threeGroup) { this.threeGroup = new THREE.Group(); this.threeScene.add(this.threeGroup); }
                this.threeGroup.add(this.threePoints);
                this.threeGroup.add(lines);
            } else {
                 if (!this.threeGroup) { this.threeGroup = new THREE.Group(); this.threeScene.add(this.threeGroup); }
                 this.threeGroup.add(this.threePoints);
            }
        }
        
        // 3D Symmetry Post-Process
        if (symmetry !== 'none' && this.threeGroup) {
            if (symmetry === 'horizontal') {
                const mirror = this.threeGroup.clone();
                mirror.scale.x = -1;
                this.threeScene.add(mirror);
            } else if (symmetry === 'vertical') {
                const mirror = this.threeGroup.clone();
                mirror.scale.y = -1;
                this.threeScene.add(mirror);
            } else if (symmetry === 'radial-4') {
                for(let i=1; i<4; i++) {
                    const clone = this.threeGroup.clone();
                    clone.rotation.y = (Math.PI/2) * i;
                    this.threeScene.add(clone);
                }
            }
        }
    } // End initializeThree

    renderThree() {
        if (!this.threeRenderer || !this.threeScene || !this.threeCamera) return;
        
        const time = Date.now() * 0.001;

        // Generic Group Rotation (City, Sculpture, Crystal)
        if (this.threeGroup) {
            this.threeGroup.rotation.y += 0.002;
            if (this.threeGroup.children[0] && this.threeGroup.children[0].type === 'Mesh') {
                // Bobbing for floating items
                this.threeGroup.position.y = Math.sin(time) * 5;
            }
        }
        
        // Vapor Grid Animation
        if (this.threeGrid) {
            // Infinite scroll effect
            this.threeGrid.position.z = (time * 50) % 50; 
        }
        
        // Glitch Monolith Animation
        if (this.monolith && this.monolithGeo && this.monolithBasePos) {
            if (Math.random() > 0.95) { // Glitch trigger
                const pos = this.monolithGeo.attributes.position;
                const base = this.monolithBasePos;
                for(let i=0; i<pos.count; i++) {
                    if (Math.random() > 0.8) {
                        pos.setX(i, base.getX(i) + (Math.random()-0.5)*10);
                    } else {
                        pos.setX(i, base.getX(i));
                    }
                }
                pos.needsUpdate = true;
            }
            this.monolith.rotation.y = time * 0.5;
        }
        
        // Points Rotation (Fallbacks)
        if (this.threePoints) {
            this.threePoints.rotation.y += 0.002;
            this.threePoints.rotation.z += 0.001;
        }
        
        // Camera drift (Generic)
        const camTime = time * 0.5;
        this.threeCamera.position.x += Math.cos(camTime) * 0.2;
        this.threeCamera.position.y += Math.sin(camTime) * 0.2;
        this.threeCamera.lookAt(0,0,0);
        
        this.threeRenderer.render(this.threeScene, this.threeCamera);
    }
    
    animate(signature, repoData) {
        // Stop any previous animation
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }

        const render = () => {
            if (signature.style === 'three') {
                this.renderThree();
            } else {
                this.time += signature.speed;
                this.clear(signature);
                this.drawVisualization(signature, repoData);
            }
            this.animationId = requestAnimationFrame(render);
        };
        
        render();
    }
    
    clear(signature) {
        if (signature.style === 'paint' || signature.style === 'bio') {
            // Paint: accumulative
            // Bio: redraws full pixel buffer every frame
            return;
        }

        const dpr = window.devicePixelRatio || 1;
        const width = this.canvas.width / dpr;
        const height = this.canvas.height / dpr;

        const fadeAlpha = this.getStyleFadeAlpha(signature);
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.globalAlpha = fadeAlpha;
        this.drawBackdrop(width, height, signature);
        this.ctx.restore();
    }
    
    drawVisualization(signature, repoData) {
        const dpr = window.devicePixelRatio || 1;
        const width = this.canvas.width / dpr;
        const height = this.canvas.height / dpr;

        // Apply procedural compositing and filters
        this.ctx.globalCompositeOperation = signature.styleProfile.composite || 'source-over';
        this.ctx.filter = signature.styleProfile.filter || 'none';
        
        const symmetry = signature.styleProfile.symmetry || 'none';
        
        if (symmetry === 'none') {
            this.renderScene(width, height, signature);
        } else if (symmetry === 'horizontal') {
            this.ctx.save();
            // Left half clip? No, usually drawing full then mirroring is easier or drawing half
            // Let's just draw full and mirror overlay? Or draw twice.
            // Draw Normal
            this.ctx.save();
            this.ctx.beginPath(); this.ctx.rect(0,0,width/2, height); this.ctx.clip();
            this.renderScene(width, height, signature);
            this.ctx.restore();
            
            // Mirror
            this.ctx.save();
            this.ctx.translate(width, 0);
            this.ctx.scale(-1, 1);
            this.ctx.beginPath(); this.ctx.rect(0,0,width/2, height); this.ctx.clip();
            this.renderScene(width, height, signature);
            this.ctx.restore();
            this.ctx.restore();
        } else if (symmetry === 'vertical') {
            this.ctx.save();
            this.ctx.beginPath(); this.ctx.rect(0,0,width, height/2); this.ctx.clip();
            this.renderScene(width, height, signature);
            this.ctx.restore();
            
            this.ctx.save();
            this.ctx.translate(0, height);
            this.ctx.scale(1, -1);
            this.ctx.beginPath(); this.ctx.rect(0,0,width, height/2); this.ctx.clip();
            this.renderScene(width, height, signature);
            this.ctx.restore();
        } else if (symmetry === 'radial-4') {
            // Kaleidoscope
            const cx = width/2;
            const cy = height/2;
            for(let i=0; i<4; i++) {
                this.ctx.save();
                this.ctx.translate(cx, cy);
                this.ctx.rotate(i * Math.PI/2);
                this.ctx.translate(-cx, -cy);
                // Clip quadrant
                this.ctx.beginPath();
                this.ctx.moveTo(cx, cy);
                this.ctx.lineTo(width, cy);
                this.ctx.lineTo(width, height);
                this.ctx.lineTo(cx, height); // roughly bottom right relative to center
                this.ctx.clip();
                this.renderScene(width, height, signature);
                this.ctx.restore();
            }
        }

        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.filter = 'none';
        
        this.drawPostEffects(width, height, signature);
        this.drawOverlay(width, height, signature, repoData);
    }

    renderScene(width, height, signature) {
        switch (signature.style) {
            case 'constellation':
                this.drawConstellation(width, height, signature);
                break;
            case 'attractor':
                this.drawAttractor(width, height, signature);
                break;
            case 'bio':
                this.drawBio(width, height, signature);
                break;
            case 'city':
                this.drawCity(width, height, signature);
                break;
            case 'paint':
                this.drawPainting(width, height, signature);
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
            case 'strata':
                this.drawStrata(width, height, signature);
                break;
            case 'orbit':
                this.drawOrbit(width, height, signature);
                break;
            case 'runes':
                this.drawRunes(width, height, signature);
                break;
            case 'weave':
                this.drawWeave(width, height, signature);
                break;
            case 'rift':
                this.drawRift(width, height, signature);
                break;
            case 'barcode':
                this.drawBarcode(width, height, signature);
                break;
            case 'collage':
                this.drawCollage(width, height, signature);
                break;
            case 'radar':
                this.drawRadar(width, height, signature);
                break;
            default:
                this.drawCity(width, height, signature);
        }
    }

    drawPostEffects(width, height, signature) {
        const ctx = this.ctx;
        const profile = signature.styleProfile;
        
        // 1. Texture Overlays
        if (profile.textureOverlay && profile.textureOverlay !== 'none') {
            const seed = signature.hash;
            // Generate texture once if not cached
            if (!this.styleState.overlayTexture) {
                const c = document.createElement('canvas');
                c.width = 512; c.height = 512;
                const tx = c.getContext('2d');
                const rng = this.createSeededRNG(seed);
                
                if (profile.textureOverlay === 'paper') {
                    tx.fillStyle = '#fff'; tx.fillRect(0,0,512,512);
                    for(let i=0; i<50000; i++) {
                        tx.fillStyle = `rgba(0,0,0,${rng()*0.05})`;
                        tx.fillRect(rng()*512, rng()*512, 2, 2);
                    }
                } else if (profile.textureOverlay === 'canvas') {
                    tx.fillStyle = '#fff'; tx.fillRect(0,0,512,512);
                    tx.strokeStyle = 'rgba(0,0,0,0.05)';
                    for(let i=0; i<512; i+=4) {
                        tx.beginPath(); tx.moveTo(i,0); tx.lineTo(i,512); tx.stroke();
                        tx.beginPath(); tx.moveTo(0,i); tx.lineTo(512,i); tx.stroke();
                    }
                } else if (profile.textureOverlay === 'grid') {
                    tx.strokeStyle = 'rgba(0,255,255,0.1)';
                    tx.lineWidth = 1;
                    tx.beginPath();
                    for(let i=0; i<512; i+=32) {
                        tx.moveTo(i,0); tx.lineTo(i,512);
                        tx.moveTo(0,i); tx.lineTo(512,i);
                    }
                    tx.stroke();
                } else if (profile.textureOverlay === 'noise') {
                    const id = tx.createImageData(512,512);
                    for(let i=0; i<id.data.length; i+=4) {
                        const v = rng()*255;
                        id.data[i] = v; id.data[i+1] = v; id.data[i+2] = v; id.data[i+3] = 30;
                    }
                    tx.putImageData(id,0,0);
                }
                this.styleState.overlayTexture = c;
            }
            
            ctx.save();
            ctx.globalCompositeOperation = 'overlay';
            const pat = ctx.createPattern(this.styleState.overlayTexture, 'repeat');
            ctx.fillStyle = pat;
            ctx.fillRect(0, 0, width, height);
            ctx.restore();
        }

        // 2. Glitch Mode
        if (profile.glitchMode && profile.glitchMode !== 'none') {
            if (Math.random() > 0.9) { // Random flicker
                const h = Math.random() * 50;
                const y = Math.random() * height;
                const offset = (Math.random() - 0.5) * 20;
                const id = ctx.getImageData(0, y, width, h);
                ctx.putImageData(id, offset, y);
            }
            
            if (profile.glitchMode === 'scanlines') {
                ctx.fillStyle = 'rgba(0,0,0,0.1)';
                for(let y=0; y<height; y+=2) ctx.fillRect(0,y,width,1);
            } else if (profile.glitchMode === 'rgb-shift') {
                // Expensive to do full frame, skipping for perf or doing simplified
                // ...
            }
        }

        // 3. Borders
        if (profile.borderMode && profile.borderMode !== 'none') {
            ctx.save();
            ctx.strokeStyle = '#111';
            if (profile.borderMode === 'simple') {
                ctx.lineWidth = 20;
                ctx.strokeRect(0,0,width,height);
            } else if (profile.borderMode === 'polaroid') {
                ctx.fillStyle = '#eee';
                ctx.fillRect(0, height-60, width, 60); // Bottom lip
                ctx.lineWidth = 20;
                ctx.fillStyle = '#eee'; // Sides
                ctx.fillRect(0,0,20,height);
                ctx.fillRect(width-20,0,20,height);
                ctx.fillRect(0,0,width,20);
            } else if (profile.borderMode === 'vignette') {
                const grad = ctx.createRadialGradient(width/2, height/2, height/2, width/2, height/2, height);
                grad.addColorStop(0, 'rgba(0,0,0,0)');
                grad.addColorStop(1, 'rgba(0,0,0,0.8)');
                ctx.fillStyle = grad;
                ctx.fillRect(0,0,width,height);
            } else if (profile.borderMode === 'film-strip') {
                ctx.fillStyle = '#000';
                ctx.fillRect(0,0,40,height);
                ctx.fillRect(width-40,0,40,height);
                // Holes
                ctx.fillStyle = '#fff';
                for(let y=10; y<height; y+=30) {
                    ctx.fillRect(10,y,20,15);
                    ctx.fillRect(width-30,y,20,15);
                }
            }
            ctx.restore();
        }
    }

    drawTree(width, height, signature) {
        const segments = this.styleState.treeSegments;
        const leaves = this.styleState.treeLeaves;
        if (segments && leaves) {
            const maxDepth = this.styleState.treeDepth || 10;
            segments.forEach((seg) => {
                const lightness = Math.max(25, 65 - seg.depth * 4);
                const sway = Math.sin(this.time * 0.6 + seg.phase) * (0.3 + seg.depth * 0.12);
                const sx = seg.x1 + sway * 0.2;
                const ex = seg.x2 + sway;
                this.ctx.strokeStyle = `hsla(${signature.primaryHue + seg.depth * 8}, 45%, ${lightness}%, 0.85)`;
                this.ctx.lineWidth = Math.max(0.6, (maxDepth - seg.depth) * 0.35);
                this.ctx.beginPath();
                this.ctx.moveTo(sx, seg.y1);
                this.ctx.lineTo(ex, seg.y2);
                this.ctx.stroke();
            });

            leaves.forEach((leaf) => {
                if (leaf.depth < maxDepth - 2) return;
                const sway = Math.sin(this.time * 0.5 + leaf.phase) * 0.8;
                this.drawLeafCluster(leaf.x + sway, leaf.y, leaf.depth, signature);
            });
            return;
        }

        const startX = width / 2;
        const startY = height * 0.98;
        const branchLen = height * 0.32;
        const angle = -Math.PI / 2; 
        const baseThickness = Math.max(2, width * 0.006);
        const maxDepth = this.styleState.treeDepth || 10;

        this.recursiveBranch(startX, startY, branchLen, angle, 0, signature, baseThickness, maxDepth);
    }

    recursiveBranch(x, y, len, angle, depth, signature, thickness, maxDepth) {
        if (depth > maxDepth || len < 2) {
            this.drawLeafCluster(x, y, depth, signature);
            return;
        }

        const wind = this.noise.noise(depth * 0.15, this.time * 0.18) * 0.5 - 0.25;
        const curl = Math.sin(this.time * 0.2 + depth) * 0.05;
        const finalAngle = angle + wind;
        const angleWithCurl = finalAngle + curl;

        const endX = x + Math.cos(angleWithCurl) * len;
        const endY = y + Math.sin(angleWithCurl) * len;

        const lightness = Math.max(25, 65 - depth * 4);
        this.ctx.strokeStyle = `hsla(${signature.primaryHue + depth * 8}, 55%, ${lightness}%, 0.85)`;
        this.ctx.lineWidth = Math.max(0.6, thickness);
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(endX, endY);
        this.ctx.stroke();

        const branchCount = 2 + ((signature.hash + depth) % 2); 
        const spread = 0.45 + ((signature.hash + depth * 3) % 10) / 20;

        for (let i = 0; i < branchCount; i++) {
            const noiseScale = this.noise.noise(depth * 0.2, i * 0.2) * 0.05;
            const newLen = len * (0.72 + noiseScale);
            const newAngle = angleWithCurl + spread * (i - (branchCount - 1) / 2);
            this.recursiveBranch(endX, endY, newLen, newAngle, depth + 1, signature, thickness * 0.7, maxDepth);
        }

        if (depth >= maxDepth - 2) {
            this.drawLeafCluster(endX, endY, depth, signature);
        }
    }

    drawLeafCluster(x, y, depth, signature) {
        const mode = this.styleState.leafMode || 'petal';
        const count = mode === 'coral' ? 8 + (signature.hash % 6) : 4 + (signature.hash % 5);
        const radius = 5 + depth * 0.5;
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count + this.time * 0.2;
            const spread = mode === 'coral' ? 0.8 : 0.4;
            const leafX = x + Math.cos(angle) * radius * spread;
            const leafY = y + Math.sin(angle) * radius * spread;
            const size = mode === 'glow' ? 2.4 + depth * 0.18 : 1.6 + depth * 0.15;
            const hue = (signature.tertiaryHue + i * 12 + depth * 3) % 360;
            const lightness = mode === 'glow' ? 70 : 60;
            const alpha = mode === 'coral' ? 0.55 : 0.75;

            this.ctx.fillStyle = `hsla(${hue}, 60%, ${lightness}%, ${alpha})`;
            this.ctx.beginPath();
            if (mode === 'coral') {
                this.ctx.rect(leafX - size * 0.6, leafY - size * 0.6, size * 1.2, size * 1.2);
            } else {
                this.ctx.arc(leafX, leafY, size, 0, Math.PI * 2);
            }
            this.ctx.fill();
        }
    }

    drawLife(width, height, signature) {
        const cols = 50;
        const rows = 50;
        const cellW = width / cols;
        const cellH = height / rows;
        const maxAge = this.styleState.lifeMaxAge || 18;
        
        // Use additive blending for glow effect
        this.ctx.globalCompositeOperation = 'lighter';
        
        for (let i = 0; i < cols; i++) {
            for (let j = 0; j < rows; j++) {
                const age = this.lifeGrid[i][j];
                if (age > 0) {
                    const ageNorm = Math.min(age, maxAge) / maxAge;
                    const hue = (signature.secondaryHue + ageNorm * 40 + (i / cols) * 60) % 360;
                    const lightness = 40 + ageNorm * 40;
                    const alpha = 0.3 + ageNorm * 0.6;
                    
                    const x = i * cellW;
                    const y = j * cellH;
                    
                    this.ctx.shadowColor = `hsla(${hue}, 80%, 50%, 0.8)`;
                    this.ctx.shadowBlur = 10;
                    this.ctx.fillStyle = `hsla(${hue}, 80%, ${lightness}%, ${alpha})`;
                    
                    // Draw rounded rects for organic look
                    const size = cellW * 0.85;
                    const radius = size * 0.3;
                    this.ctx.beginPath();
                    this.ctx.roundRect(x + (cellW - size)/2, y + (cellH - size)/2, size, size, radius);
                    this.ctx.fill();
                }
            }
        }
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.shadowBlur = 0;

        if (Math.floor(this.time * 100) % 6 === 0) { // Slower update
            const next = this.lifeGrid.map(arr => [...arr]);
            for (let i = 0; i < cols; i++) {
                for (let j = 0; j < rows; j++) {
                    let neighbors = 0;
                    for (let x = -1; x <= 1; x++) {
                        for (let y = -1; y <= 1; y++) {
                            if (x === 0 && y === 0) continue;
                            const ni = (i + x + cols) % cols;
                            const nj = (j + y + rows) % rows;
                            neighbors += this.lifeGrid[ni][nj] > 0 ? 1 : 0;
                        }
                    }
                    if (this.lifeGrid[i][j] > 0 && (neighbors === 2 || neighbors === 3)) {
                        next[i][j] = Math.min(this.lifeGrid[i][j] + 1, maxAge);
                    } else if (this.lifeGrid[i][j] === 0 && neighbors === 3) {
                        next[i][j] = 1;
                    } else {
                        // Decay instead of instant death
                         if (this.lifeGrid[i][j] > 0) next[i][j] = this.lifeGrid[i][j] - 1; 
                         else next[i][j] = 0;
                    }
                }
            }
            this.lifeGrid = next;
        }
    }

    drawConstellation(width, height, signature) {
        const profile = signature.styleProfile || {};
        const palette = this.styleState.palette || [];
        
        // 1. Draw subtle starfield background
        if (this.styleState.stars) {
            this.ctx.save();
            this.styleState.stars.forEach((star) => {
                const alpha = star.alpha * (0.3 + 0.7 * Math.sin(this.time * 0.5 + star.twinkle));
                this.ctx.fillStyle = `hsla(${star.hue}, 20%, 80%, ${alpha})`;
                this.ctx.fillRect(star.x, star.y, star.r, star.r);
            });
            this.ctx.restore();
        }

        // 2. Update particle positions (Slow drift)
        this.particles.forEach(p => {
            if (!p.isBackground) {
                p.x += Math.cos(this.time * 0.5 + p.phase) * 0.2;
                p.y += Math.sin(this.time * 0.5 + p.phase) * 0.2;
            }
        });

        // 3. Draw Dense Network Connections
        const linkRadius = (profile.linkRadius || 120) * 1.5;
        this.ctx.lineWidth = 0.8;
        this.ctx.lineCap = 'round';
        
        // Optimization: spatial partition or just brute force (150 particles is fine)
        for (let i = 0; i < this.particles.length; i++) {
            const p1 = this.particles[i];
            if (p1.isBackground) continue;

            const neighbors = [];
            
            for (let j = i + 1; j < this.particles.length; j++) {
                const p2 = this.particles[j];
                if (p2.isBackground) continue;

                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const distSq = dx * dx + dy * dy;
                const radiusSq = linkRadius * linkRadius;

                if (distSq < radiusSq) {
                    const dist = Math.sqrt(distSq);
                    const intensity = 1 - dist / linkRadius;
                    
                    // Color blending
                    const hue = (p1.hue + p2.hue) / 2;
                    const paletteTone = this.getPaletteColorForHue(hue, palette);
                    
                    this.ctx.strokeStyle = `hsla(${paletteTone.h}, ${paletteTone.s}%, ${paletteTone.l}%, ${intensity * 0.15})`;
                    this.ctx.beginPath();
                    this.ctx.moveTo(p1.x, p1.y);
                    this.ctx.lineTo(p2.x, p2.y);
                    this.ctx.stroke();
                }
            }
        }

        // 4. Draw Glowing Nodes
        this.ctx.shadowBlur = 10;
        this.particles.forEach((p) => {
            const paletteTone = this.getPaletteColorForHue(p.hue, palette);
            this.ctx.fillStyle = `hsla(${paletteTone.h}, ${paletteTone.s}%, ${paletteTone.l + 20}%, 0.9)`;
            this.ctx.shadowColor = `hsla(${paletteTone.h}, ${paletteTone.s}%, ${paletteTone.l}%, 0.8)`;
            
            const size = Math.max(1.5, p.size * 0.3);
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.shadowBlur = 0;
    }

    drawFlowField(width, height, signature) {
        const mode = this.styleState.flowMode || 'ribbon';
        const scale = 0.0018 + signature.complexity * 0.00002;
        const speed = 0.6 + signature.energy * 0.006;
        const palette = this.styleState.palette || [];
        this.ctx.lineCap = 'round';
        
        this.particles.forEach(p => {
            // Calculate flow vector based on Perlin noise
            const noiseVal = this.noise.noise(p.x * scale, p.y * scale + this.time * 0.1);
            const angle = noiseVal * Math.PI * 4;

            let prevX = p.x;
            let prevY = p.y;
            const drift = p.isBackground ? 0.4 : speed;
            
            p.x += Math.cos(angle) * drift;
            p.y += Math.sin(angle) * drift;
            
            // Wrap around deterministically
            if (p.x < 0) { p.x += width; prevX = p.x; }
            if (p.x > width) { p.x -= width; prevX = p.x; }
            if (p.y < 0) { p.y += height; prevY = p.y; }
            if (p.y > height) { p.y -= height; prevY = p.y; }

            const baseAlpha = p.isBackground ? 0.12 : (this.styleState.flowAlpha || 0.55);
            const alpha = mode === 'mist' ? baseAlpha * 0.7 : baseAlpha;
            const size = p.isBackground ? p.size : p.size * (Math.sin(this.time + p.phase) * 0.2 + 1);
            const lineWidth = p.isBackground ? 0.6 : Math.max(0.6, p.size * 0.25);
            const paletteTone = this.getPaletteColorForHue(p.hue, palette);

            if (mode === 'mist') {
                this.ctx.fillStyle = `hsla(${paletteTone.h}, ${paletteTone.s * 0.7}%, ${paletteTone.l}%, ${alpha})`;
                const rectSize = size * 1.8;
                this.ctx.fillRect(p.x - rectSize / 2, p.y - rectSize / 2, rectSize, rectSize);
            } else {
                this.ctx.strokeStyle = `hsla(${paletteTone.h}, ${paletteTone.s}%, ${paletteTone.l}%, ${alpha})`;
                this.ctx.lineWidth = lineWidth * 1.6;
                this.ctx.beginPath();
                this.ctx.moveTo(prevX, prevY);
                this.ctx.lineTo(p.x, p.y);
                this.ctx.stroke();

                if (mode === 'braid') {
                    const offset = 2 + p.size * 0.3;
                    const perpX = -Math.sin(angle) * offset;
                    const perpY = Math.cos(angle) * offset;
                    const accent = this.getPaletteColorForHue((p.hue + 40) % 360, palette);
                    this.ctx.strokeStyle = `hsla(${accent.h}, ${accent.s}%, ${accent.l}%, ${alpha * 0.7})`;
                    this.ctx.lineWidth = lineWidth;
                    this.ctx.beginPath();
                    this.ctx.moveTo(prevX + perpX, prevY + perpY);
                    this.ctx.lineTo(p.x + perpX, p.y + perpY);
                    this.ctx.stroke();
                }

                const blockSize = size * 0.9;
                this.ctx.fillStyle = `hsla(${paletteTone.h}, ${paletteTone.s}%, ${Math.min(85, paletteTone.l + 12)}%, ${alpha + 0.2})`;
                this.ctx.fillRect(p.x - blockSize / 2, p.y - blockSize / 2, blockSize, blockSize);
            }

            p.prevX = p.x;
            p.prevY = p.y;
        });
    }

    drawNebula(width, height, signature) {
        const centerX = width / 2;
        const centerY = height / 2;
        const profile = signature.styleProfile || {};
        const palette = this.styleState.palette || [];

        if (this.styleState.clouds) {
            this.ctx.save();
            this.styleState.clouds.forEach((cloud) => {
                const grad = this.ctx.createRadialGradient(cloud.x, cloud.y, 0, cloud.x, cloud.y, cloud.r);
                grad.addColorStop(0, `hsla(${cloud.hue}, 35%, 50%, ${cloud.alpha})`);
                grad.addColorStop(1, `hsla(${cloud.hue}, 20%, 10%, 0)`);
                this.ctx.fillStyle = grad;
                this.ctx.beginPath();
                this.ctx.arc(cloud.x, cloud.y, cloud.r, 0, Math.PI * 2);
                this.ctx.fill();
            });
            this.ctx.restore();
        }

        this.particles.forEach((p, i) => {
            // Spiral motion based on original mapped position
            // We interpret p.x as 'angle' and p.y as 'radius' offsets for nebula
            const angleOffset = (p.originX / width) * Math.PI * 2;
            const radiusBase = this.mapValue(p.originY, 0, height, 40, Math.min(width, height) * 0.45);
            const swirlStrength = profile.swirlStrength || 0.4;
            const swirl = Math.sin(this.time * 0.15 + angleOffset * 3) * swirlStrength;
            const angle = this.time * 0.15 + angleOffset + swirl;
            const radius = radiusBase + Math.sin(this.time * 1.8 + i) * (6 + p.size);
            const squash = profile.diskSquash || 1;

            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius * squash;
            const tailAngle = angle + Math.PI / 2;
            const tailScale = profile.tailScale || 1;
            const tailLen = (6 + p.size * 2.5) * tailScale;
            const paletteTone = this.getPaletteColorForHue(p.hue, palette);

            this.ctx.strokeStyle = `hsla(${paletteTone.h}, ${paletteTone.s * 0.7}%, ${paletteTone.l}%, 0.35)`;
            this.ctx.lineWidth = Math.max(0.6, p.size * 0.25);
            this.ctx.beginPath();
            this.ctx.moveTo(x, y);
            this.ctx.lineTo(x - Math.cos(tailAngle) * tailLen, y - Math.sin(tailAngle) * tailLen);
            this.ctx.stroke();

            const block = p.size * 1.4;
            this.ctx.fillStyle = `hsla(${paletteTone.h}, ${paletteTone.s}%, ${Math.min(80, paletteTone.l + 10)}%, 0.8)`;
            this.ctx.fillRect(x - block / 2, y - block / 2, block, block);

            if (p.prevX !== undefined) {
                this.ctx.strokeStyle = `hsla(${paletteTone.h}, ${paletteTone.s * 0.5}%, ${Math.max(20, paletteTone.l - 15)}%, 0.2)`;
                this.ctx.lineWidth = 0.6;
                this.ctx.beginPath();
                this.ctx.moveTo(p.prevX, p.prevY);
                this.ctx.lineTo(x, y);
                this.ctx.stroke();
            }

            p.prevX = x;
            p.prevY = y;
        });
    }

    drawMosaic(width, height, signature) {
        const gridSize = this.styleState.mosaicGrid || 15;
        const style = this.styleState.mosaicStyle || 'stained';
        
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
                const noiseVal = this.noise.noise(cx * 0.015, cy * 0.015 + this.time * 0.05);
                const jitter = (noiseVal + 1) * 0.5;
                const jitterX = noiseVal * gridSize * 0.35;
                const jitterY = this.noise.noise(cx * 0.02 + this.time * 0.03, cy * 0.02) * gridSize * 0.35;
                const cellSize = gridSize * (0.7 + jitter * 0.6);
                
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
                    const lightness = 35 + jitter * 35;
                    const baseX = cx + jitterX - cellSize / 2;
                    const baseY = cy + jitterY - cellSize / 2;
                    const paletteTone = this.getPaletteColorForHue(nearestP.hue, this.styleState.palette || []);
                    const hue = paletteTone.h;
                    const sat = paletteTone.s;
                    const baseLight = Math.max(20, Math.min(85, paletteTone.l + (lightness - 50) * 0.6));

                    if (style === 'shards') {
                        this.ctx.fillStyle = `hsla(${hue}, ${sat}%, ${baseLight}%, 0.9)`;
                        this.ctx.beginPath();
                        this.ctx.moveTo(baseX, baseY);
                        this.ctx.lineTo(baseX + cellSize, baseY);
                        this.ctx.lineTo(baseX + cellSize, baseY + cellSize);
                        this.ctx.closePath();
                        this.ctx.fill();

                        this.ctx.fillStyle = `hsla(${(hue + 25) % 360}, ${sat}%, ${Math.min(90, baseLight + 8)}%, 0.65)`;
                        this.ctx.beginPath();
                        this.ctx.moveTo(baseX, baseY);
                        this.ctx.lineTo(baseX, baseY + cellSize);
                        this.ctx.lineTo(baseX + cellSize, baseY + cellSize);
                        this.ctx.closePath();
                        this.ctx.fill();
                    } else if (style === 'circuit') {
                        this.ctx.fillStyle = `hsla(${hue}, ${sat}%, ${baseLight}%, 0.85)`;
                        this.ctx.fillRect(baseX, baseY, cellSize, cellSize);

                        this.ctx.strokeStyle = `hsla(${(hue + 45) % 360}, ${sat}%, ${Math.min(90, baseLight + 12)}%, 0.5)`;
                        this.ctx.lineWidth = 1;
                        this.ctx.beginPath();
                        this.ctx.moveTo(baseX + cellSize * 0.2, baseY + cellSize * 0.2);
                        this.ctx.lineTo(baseX + cellSize * 0.8, baseY + cellSize * 0.2);
                        this.ctx.lineTo(baseX + cellSize * 0.8, baseY + cellSize * 0.8);
                        this.ctx.stroke();

                        this.ctx.fillStyle = `hsla(${(hue + 90) % 360}, ${Math.min(95, sat + 10)}%, ${Math.min(92, baseLight + 18)}%, 0.7)`;
                        this.ctx.fillRect(baseX + cellSize * 0.55, baseY + cellSize * 0.55, cellSize * 0.2, cellSize * 0.2);
                    } else {
                        this.ctx.fillStyle = `hsla(${hue}, ${sat}%, ${baseLight}%, 0.9)`;
                        this.ctx.fillRect(baseX, baseY, cellSize, cellSize);

                        const inset = cellSize * 0.18;
                        this.ctx.fillStyle = `hsla(${(hue + 25) % 360}, ${sat}%, ${Math.min(90, baseLight + 10)}%, 0.5)`;
                        this.ctx.fillRect(baseX + inset, baseY + inset, cellSize - inset * 2, cellSize - inset * 2);

                        this.ctx.strokeStyle = `hsla(${hue}, ${Math.max(20, sat - 25)}%, ${Math.max(10, baseLight - 25)}%, 0.45)`;
                        this.ctx.lineWidth = 1;
                        this.ctx.strokeRect(baseX + 0.5, baseY + 0.5, cellSize - 1, cellSize - 1);
                    }
                }
            }
        }
    }

    drawMatrix(width, height, signature) {
        if (this.styleState.columns) {
            this.ctx.save();
            this.styleState.columns.forEach((column) => {
                const grad = this.ctx.createLinearGradient(column.x, 0, column.x, height);
                grad.addColorStop(0, `hsla(${column.hue}, 80%, 45%, 0)`);
                const beamAlpha = this.styleState.beamAlpha || 0.16;
                grad.addColorStop(0.5, `hsla(${column.hue}, 40%, 35%, ${column.alpha * beamAlpha})`);
                grad.addColorStop(1, `hsla(${column.hue}, 80%, 45%, 0)`);
                this.ctx.strokeStyle = grad;
                this.ctx.lineWidth = column.width;
                this.ctx.beginPath();
                this.ctx.moveTo(column.x, 0);
                this.ctx.lineTo(column.x, height);
                this.ctx.stroke();
            });
            this.ctx.restore();
        }

        const columnWidth = this.styleState.columnWidth || 24;
        const speedBase = 0.7 + signature.energy * 0.004;
        const glyphMode = this.styleState.glyphMode || 'katakana';
        const glyphScale = this.styleState.glyphScale || 1;
        const palette = this.styleState.palette || [];

        this.particles.forEach(p => {
            const columnIndex = Math.max(0, Math.floor(p.originX / columnWidth));
            const columnX = columnIndex * columnWidth + columnWidth * 0.5;
            const sway = Math.sin(this.time + p.phase) * 1.2;
            p.x = columnX + sway;

            p.y += (p.size * 0.5 + 0.8) * speedBase; // Rain down
            if (p.y > height + 20) {
                p.y = -20 - (p.phase * 40);
            }

            const glyphHue = (signature.secondaryHue + (p.hue - signature.secondaryHue) * 0.2 + 360) % 360;
            const paletteTone = this.getPaletteColorForHue(glyphHue, palette);
            const trailLen = Math.max(10, p.size * 5);
            const trail = this.ctx.createLinearGradient(p.x, p.y - trailLen, p.x, p.y + 2);
            trail.addColorStop(0, `hsla(${paletteTone.h}, ${paletteTone.s}%, ${paletteTone.l}%, 0)`);
            trail.addColorStop(1, `hsla(${paletteTone.h}, ${paletteTone.s}%, ${paletteTone.l}%, ${p.alpha * 0.5})`);
            this.ctx.strokeStyle = trail;
            this.ctx.lineWidth = Math.max(1, p.size * 0.18);
            this.ctx.beginPath();
            this.ctx.moveTo(p.x, p.y - trailLen);
            this.ctx.lineTo(p.x, p.y);
            this.ctx.stroke();

            const tileSize = Math.max(8, p.size * 2) * glyphScale;
            this.ctx.fillStyle = `hsla(${paletteTone.h}, ${paletteTone.s}%, ${paletteTone.l}%, ${p.alpha + 0.3})`;
            this.ctx.fillRect(p.x - tileSize / 2, p.y - tileSize / 2, tileSize, tileSize);
            this.ctx.font = `${Math.max(9, p.size * 1.9) * glyphScale}px monospace`;
            this.ctx.fillStyle = `hsla(${paletteTone.h}, ${Math.max(20, paletteTone.s - 20)}%, ${Math.max(20, paletteTone.l - 15)}%, ${p.alpha + 0.4})`;
            // Draw char based on commit hash
            const glyphSeed = this.hashString(p.commit?.sha || 'x') + columnIndex * 31;
            let char = '';
            if (glyphMode === 'binary') {
                char = (glyphSeed % 2).toString();
            } else if (glyphMode === 'hex') {
                const hex = '0123456789ABCDEF';
                char = hex[glyphSeed % hex.length];
            } else {
                const charCode = 0x30A0 + (glyphSeed % 96);
                char = String.fromCharCode(charCode);
            }
            this.ctx.fillText(char, p.x, p.y);
        });
    }

    drawStrata(width, height, signature) {
        const layers = this.styleState.strataLayers || 9;
        const amplitude = this.styleState.strataAmplitude || Math.round(height * 0.08);
        const scale = this.styleState.strataScale || 0.004;
        const spacing = height / (layers + 1);
        const palette = this.styleState.palette || [];

        this.ctx.globalCompositeOperation = 'screen';

        for (let i = 0; i < layers; i++) {
            const baseY = spacing * (i + 1) + Math.sin(this.time * 0.2 + i) * spacing * 0.12;
            const hueSeed = (signature.primaryHue + i * 12 + (signature.hash % 30)) % 360;
            const paletteTone = this.getPaletteColorForHue(hueSeed, palette);
            const lightness = Math.min(80, paletteTone.l + i * 1.5);
            const alpha = 0.4 + (i / layers) * 0.4; // Higher alpha for glow

            this.ctx.strokeStyle = `hsla(${paletteTone.h}, ${paletteTone.s}%, ${lightness}%, ${alpha})`;
            this.ctx.lineWidth = 2 + i * 0.15;
            this.ctx.shadowColor = `hsla(${paletteTone.h}, ${paletteTone.s}%, 50%, 1)`;
            this.ctx.shadowBlur = 15;
            
            this.ctx.beginPath();

            for (let x = 0; x <= width; x += 6) {
                const noiseVal = this.noise.noise(x * scale, i * 0.4 + this.time * 0.18);
                const wave = Math.sin(x * 0.015 + this.time * 0.3 + i) * amplitude * 0.15;
                const y = baseY + noiseVal * amplitude + wave;
                if (x === 0) {
                    this.ctx.moveTo(x, y);
                } else {
                    this.ctx.lineTo(x, y);
                }
            }
            this.ctx.stroke();
        }
        
        this.ctx.shadowBlur = 0;
        this.ctx.globalCompositeOperation = 'source-over';
    }

    drawOrbit(width, height, signature) {
        const centers = this.styleState.orbitCenters || [{ x: width * 0.5, y: height * 0.5 }];
        const palette = this.styleState.palette || [];

        // Draw Central Core
        centers.forEach((center, i) => {
             const hue = signature.primaryHue;
             const grad = this.ctx.createRadialGradient(center.x, center.y, 1, center.x, center.y, 60);
             grad.addColorStop(0, `hsla(${hue}, 80%, 80%, 0.8)`);
             grad.addColorStop(1, `hsla(${hue}, 60%, 20%, 0)`);
             this.ctx.fillStyle = grad;
             this.ctx.beginPath();
             this.ctx.arc(center.x, center.y, 60, 0, Math.PI * 2);
             this.ctx.fill();
        });

        // Draw Particles as Orbiting Bodies with Trails
        this.particles.forEach(p => {
            const center = centers[p.orbitIndex || 0] || centers[0];
            // Elliptical Orbit
            const tilt = 0.6; // 3D tilt effect
            const speed = p.orbitSpeed || 0.002;
            const angle = this.time * speed + (p.orbitPhase || 0);
            const r = p.orbitRadius || 100;
            
            // Calculate current position
            const x = center.x + Math.cos(angle) * r;
            const y = center.y + Math.sin(angle) * r * tilt;
            
            // Calculate trail position (slightly behind in time)
            const trailAngle = angle - 0.15; // Trail lag
            const tx = center.x + Math.cos(trailAngle) * r;
            const ty = center.y + Math.sin(trailAngle) * r * tilt;

            const hue = (p.hue + signature.secondaryHue) / 2;
            const paletteTone = this.getPaletteColorForHue(hue, palette);
            
            // Draw Trail
            const grad = this.ctx.createLinearGradient(x, y, tx, ty);
            grad.addColorStop(0, `hsla(${paletteTone.h}, ${paletteTone.s}%, ${paletteTone.l}%, 0.6)`);
            grad.addColorStop(1, `hsla(${paletteTone.h}, ${paletteTone.s}%, ${paletteTone.l}%, 0)`);
            
            this.ctx.strokeStyle = grad;
            this.ctx.lineWidth = Math.max(1, p.size * 0.3);
            this.ctx.beginPath();
            this.ctx.moveTo(x, y);
            this.ctx.lineTo(tx, ty);
            this.ctx.stroke();

            // Draw Body
            this.ctx.fillStyle = `hsla(${paletteTone.h}, ${paletteTone.s}%, ${paletteTone.l + 20}%, 1)`;
            this.ctx.beginPath();
            this.ctx.arc(x, y, Math.max(1, p.size * 0.2), 0, Math.PI * 2);
            this.ctx.fill();
        });
    }

    drawRunes(width, height, signature) {
        const palette = this.styleState.palette || [];
        const center = { x: width / 2, y: height / 2 };
        const maxRadius = Math.min(width, height) * 0.45;
        const ringCount = 8;
        
        const drawSigil = (x, y, size, seed, hue, alpha) => {
            let state = seed >>> 0;
            const rand = () => {
                state = (1664525 * state + 1013904223) >>> 0;
                return state / 4294967295;
            };
            const paletteTone = this.getPaletteColorForHue(hue, palette);

            const strokes = 3 + Math.floor(rand() * 4);
            this.ctx.strokeStyle = `hsla(${paletteTone.h}, ${paletteTone.s}%, ${paletteTone.l}%, ${alpha})`;
            this.ctx.lineWidth = Math.max(1, size * 0.1);
            
            this.ctx.beginPath();
            for (let i = 0; i < strokes; i++) {
                const x1 = (rand() - 0.5) * size;
                const y1 = (rand() - 0.5) * size;
                const x2 = (rand() - 0.5) * size;
                const y2 = (rand() - 0.5) * size;
                this.ctx.moveTo(x + x1, y + y1);
                this.ctx.lineTo(x + x2, y + y2);
            }
            this.ctx.stroke();
        };

        this.ctx.globalCompositeOperation = 'lighter';

        for (let r = 0; r < ringCount; r++) {
            const radius = (r + 1) / ringCount * maxRadius;
            const circumference = 2 * Math.PI * radius;
            const glyphSize = 20 + r * 5;
            const glyphCount = Math.floor(circumference / (glyphSize * 1.5));
            const speed = (r % 2 === 0 ? 1 : -1) * (0.002 + 0.005 / (r + 1));
            const ringPhase = this.time * speed + r;

            for (let i = 0; i < glyphCount; i++) {
                const angle = (i / glyphCount) * Math.PI * 2 + ringPhase;
                const x = center.x + Math.cos(angle) * radius;
                const y = center.y + Math.sin(angle) * radius;
                
                // Use particle data for seeding if available, otherwise procedural
                const seed = this.hashString(signature.hash + r + i);
                const hue = (signature.primaryHue + r * 20) % 360;
                const alpha = 0.4 + 0.3 * Math.sin(angle * 2 + this.time);

                drawSigil(x, y, glyphSize, seed, hue, alpha);
            }
            
            // Draw ring line
            this.ctx.strokeStyle = `hsla(${signature.primaryHue}, 20%, 30%, 0.1)`;
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
            this.ctx.stroke();
        }
        this.ctx.globalCompositeOperation = 'source-over';
    }

    drawWeave(width, height, signature) {
        const cols = (this.styleState.weaveCols || 10) * 3; // Tripled density
        const rows = (this.styleState.weaveRows || 8) * 3;
        const palette = this.styleState.palette || [];
        const bandW = width / cols;
        const bandH = height / rows;
        
        this.ctx.globalCompositeOperation = 'multiply';

        // Vertical Threads (Warp)
        for (let i = 0; i < cols; i++) {
            const tone = palette[i % palette.length] || { h: signature.primaryHue, s: 40, l: 40 };
            this.ctx.strokeStyle = `hsla(${tone.h}, ${tone.s}%, ${tone.l}%, 0.3)`;
            this.ctx.lineWidth = bandW * 0.8;
            this.ctx.beginPath();
            
            for (let y = 0; y <= height; y += 10) {
                // Noise-based distortion
                const noise = this.noise.noise(i * 0.1, y * 0.01 + this.time * 0.1);
                const x = i * bandW + noise * 10;
                if (y===0) this.ctx.moveTo(x, y);
                else this.ctx.lineTo(x, y);
            }
            this.ctx.stroke();
        }

        // Horizontal Threads (Weft)
        for (let j = 0; j < rows; j++) {
            const tone = palette[(j + 2) % palette.length] || { h: signature.secondaryHue, s: 35, l: 45 };
            this.ctx.strokeStyle = `hsla(${tone.h}, ${tone.s}%, ${tone.l}%, 0.3)`;
            this.ctx.lineWidth = bandH * 0.8;
            this.ctx.beginPath();
            
            for (let x = 0; x <= width; x += 10) {
                 const noise = this.noise.noise(x * 0.01 + this.time * 0.1, j * 0.1);
                 const y = j * bandH + noise * 10;
                 if (x===0) this.ctx.moveTo(x, y);
                 else this.ctx.lineTo(x, y);
            }
            this.ctx.stroke();
        }
        
        // Highlights (Texture)
        this.ctx.globalCompositeOperation = 'source-over';
        this.particles.forEach(p => {
             // Subtle stitch highlights
             const x = p.x;
             const y = p.y;
             this.ctx.fillStyle = `hsla(${p.hue}, 60%, 80%, 0.3)`;
             this.ctx.beginPath();
             this.ctx.arc(x, y, 1.5, 0, Math.PI * 2);
             this.ctx.fill();
        });
    }

    drawRift(width, height, signature) {
        const lines = 40;
        const step = height / lines;
        const palette = this.styleState.palette || [];
        
        // Draw back to front
        for (let i = 0; i < lines; i++) {
            const baseY = i * step + 40;
            const tone = palette[i % palette.length] || { h: signature.primaryHue, s: 0, l: 50 };
            
            this.ctx.beginPath();
            this.ctx.moveTo(0, baseY);
            
            for (let x = 0; x <= width; x += 10) {
                // Noise base
                let yOff = this.noise.noise(x * 0.005, i * 0.1 + this.time * 0.2) * 40;
                
                // Interaction with particles
                // Find nearest particle to this x location (simplified influence)
                // We'll just map particles to x-zones to avoid N^2 loop inside drawing loop
                // ...or just use a few spatial noise layers
                
                yOff -= Math.abs(this.noise.noise(x * 0.02, this.time * 0.5)) * 30 * (1 - i/lines);

                this.ctx.lineTo(x, baseY + yOff);
            }
            
            this.ctx.lineTo(width, height);
            this.ctx.lineTo(0, height);
            this.ctx.closePath();
            
            // Fill with background color to occlude lower lines
            this.ctx.fillStyle = `hsla(${signature.primaryHue}, 10%, 5%, 1)`;
            this.ctx.fill();
            
            // Stroke the edge
            this.ctx.strokeStyle = `hsla(${tone.h}, ${tone.s}%, 70%, 0.8)`;
            this.ctx.lineWidth = 1.5;
            this.ctx.stroke();
        }
    }

    drawBarcode(width, height, signature) {
        const bars = this.styleState.barcodeBars || [];
        const palette = this.styleState.palette || [];
        const centerY = height / 2;
        
        this.ctx.globalCompositeOperation = 'lighter';
        
        // Draw spectral bars
        bars.forEach((bar, index) => {
            const tone = bar.color || palette[index % palette.length];
            const noise = this.noise.noise(index * 0.1, this.time * 0.5);
            const activity = Math.max(0.1, noise + 0.5); // 0.1 to 1.5
            const h = height * 0.4 * activity;
            
            const grad = this.ctx.createLinearGradient(0, centerY - h, 0, centerY + h);
            grad.addColorStop(0, `hsla(${tone.h}, ${tone.s}%, ${tone.l}%, 0)`);
            grad.addColorStop(0.5, `hsla(${tone.h}, ${tone.s}%, ${tone.l}%, ${bar.alpha})`);
            grad.addColorStop(1, `hsla(${tone.h}, ${tone.s}%, ${tone.l}%, 0)`);
            
            this.ctx.fillStyle = grad;
            this.ctx.fillRect(bar.x, centerY - h, bar.w, h * 2);
            
            // Peak dot
            this.ctx.fillStyle = `hsla(${tone.h}, 90%, 90%, 0.8)`;
            this.ctx.fillRect(bar.x, centerY - h - 2, bar.w, 2);
            this.ctx.fillRect(bar.x, centerY + h, bar.w, 2);
        });
        
        this.ctx.globalCompositeOperation = 'source-over';
    }

    drawCollage(width, height, signature) {
        const pieces = this.styleState.collagePieces || [];
        
        // Sort pieces by "depth" (size) so large ones are in back? 
        // Or just maintain array order for "layering"
        
        pieces.forEach((piece, index) => {
            // Animation
            const driftX = Math.sin(this.time * 0.2 + piece.drift) * 10;
            const driftY = Math.cos(this.time * 0.15 + piece.drift) * 10;
            const rot = piece.rot + Math.sin(this.time * 0.1) * 0.05;
            
            const cx = piece.x + driftX;
            const cy = piece.y + driftY;
            
            this.ctx.save();
            this.ctx.translate(cx, cy);
            this.ctx.rotate(rot);
            
            if (piece.shadow) {
                this.ctx.shadowColor = 'rgba(0,0,0,0.5)';
                this.ctx.shadowBlur = 10;
                this.ctx.shadowOffsetX = 5;
                this.ctx.shadowOffsetY = 5;
            }
            
            if (piece.kind === 'poly') {
                // Simulating torn paper
                this.ctx.beginPath();
                const w = piece.w;
                const h = piece.h;
                // Simple jagged rect
                this.ctx.moveTo(-w/2, -h/2);
                this.ctx.lineTo(0, -h/2 - 5);
                this.ctx.lineTo(w/2, -h/2);
                this.ctx.lineTo(w/2 + 5, 0);
                this.ctx.lineTo(w/2, h/2);
                this.ctx.lineTo(0, h/2 + 5);
                this.ctx.lineTo(-w/2, h/2);
                this.ctx.lineTo(-w/2 - 5, 0);
                this.ctx.closePath();
                
                // Clip and draw texture
                this.ctx.save();
                this.ctx.clip();
                this.ctx.drawImage(piece.texture, -w/2, -h/2, w, h);
                this.ctx.restore();
                
                // Edge stroke
                this.ctx.shadowBlur = 0;
                this.ctx.shadowOffset = 0;
                this.ctx.strokeStyle = 'rgba(255,255,255,0.4)';
                this.ctx.lineWidth = 1;
                this.ctx.stroke();
                
            } else {
                // Rect (Photos/Cards)
                this.ctx.drawImage(piece.texture, -piece.w/2, -piece.h/2, piece.w, piece.h);
                
                // Tape effect?
                if (!piece.isText && index % 4 === 0) {
                     this.ctx.fillStyle = 'rgba(255,255,255,0.3)';
                     this.ctx.fillRect(-piece.w/4, -piece.h/2 - 10, piece.w/2, 20);
                }
            }
            
            this.ctx.restore();
        });
    }

    drawRadar(width, height, signature) {
        const rings = this.styleState.radarRings || [];
        const points = this.styleState.radarPoints || [];
        const palette = this.styleState.palette || [];
        const centerX = width / 2;
        const centerY = height / 2;
        const sweepAngle = (this.time * 0.8) % (Math.PI * 2);

        // Draw Rings (Sonar Grid)
        rings.forEach((radius, index) => {
            const tone = palette[index % palette.length] || { h: signature.primaryHue, s: 40, l: 40 };
            this.ctx.strokeStyle = `hsla(${tone.h}, ${tone.s}%, ${tone.l}%, 0.15)`;
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            this.ctx.stroke();
            
            // Axis lines
            if (index === rings.length - 1) {
                 this.ctx.beginPath();
                 this.ctx.moveTo(centerX - radius, centerY);
                 this.ctx.lineTo(centerX + radius, centerY);
                 this.ctx.moveTo(centerX, centerY - radius);
                 this.ctx.lineTo(centerX, centerY + radius);
                 this.ctx.stroke();
            }
        });

        // Draw Sweep (Gradient Sector)
        const grad = this.ctx.createConicGradient(sweepAngle + Math.PI/2, centerX, centerY);
        grad.addColorStop(0, `hsla(${signature.secondaryHue}, 80%, 60%, 0)`);
        grad.addColorStop(0.1, `hsla(${signature.secondaryHue}, 80%, 60%, 0.2)`);
        grad.addColorStop(0.2, `hsla(${signature.secondaryHue}, 80%, 60%, 0)`);
        this.ctx.fillStyle = grad;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, Math.min(width, height) * 0.45, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw Blips
        points.forEach((point) => {
            // Position
            const x = centerX + Math.cos(point.angle) * point.radius;
            const y = centerY + Math.sin(point.angle) * point.radius;
            
            // Calculate opacity based on sweep distance
            // Normalized angle distance
            let dist = sweepAngle - point.angle;
            while (dist < 0) dist += Math.PI * 2;
            while (dist > Math.PI * 2) dist -= Math.PI * 2;
            
            // If just scanned (dist is small positive), fade slowly
            // Opacity decay
            const opacity = Math.max(0.1, Math.exp(-dist * 2));
            
            this.ctx.fillStyle = `hsla(${point.tone.h}, ${point.tone.s}%, 60%, ${opacity})`;
            this.ctx.shadowColor = `hsla(${point.tone.h}, ${point.tone.s}%, 50%, ${opacity})`;
            this.ctx.shadowBlur = 8 * opacity;
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, point.size * 0.8, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
        });
    }

    drawCity(width, height, signature) {
        const grid = this.styleState.cityGrid || [];
        const theme = this.styleState.cityTheme || 'blueprint';
        const palette = this.styleState.palette || [];
        const isoX = width / 2;
        const isoY = height * 0.2;
        const tileW = 24;
        const tileH = 12;

        // Clear specially for city to ensure clean lines
        this.ctx.fillStyle = theme === 'blueprint' ? '#1a2b3c' : '#05070a';
        this.ctx.fillRect(0, 0, width, height);

        // Use pre-sorted buildings
        const buildings = this.styleState.sortedBuildings || [];
        
        buildings.forEach(b => {
            const phase = this.time * 0.5 + (b.x + b.y) * 0.05;
            const animHeight = b.h * (0.5 + 0.5 * Math.sin(phase));
            
            // Iso projection
            const screenX = isoX + (b.x - b.y) * tileW;
            const screenY = isoY + (b.x + b.y) * tileH;
            
            const paletteTone = this.getPaletteColorForHue(b.hue, palette);
            
            if (theme === 'blueprint') {
                this.ctx.strokeStyle = `hsla(${paletteTone.h}, 60%, 70%, 0.4)`;
                this.ctx.lineWidth = 1;
                this.ctx.fillStyle = `hsla(${paletteTone.h}, 40%, 20%, 0.8)`;
            } else if (theme === 'neon') {
                this.ctx.strokeStyle = `hsla(${paletteTone.h}, 100%, 60%, 0.6)`;
                this.ctx.lineWidth = 1.5;
                this.ctx.fillStyle = `hsla(${paletteTone.h}, 60%, 10%, 0.9)`;
            } else {
                 this.ctx.fillStyle = `hsla(${paletteTone.h}, ${paletteTone.s}%, ${paletteTone.l}%, 1)`;
                 this.ctx.strokeStyle = 'rgba(0,0,0,0.2)';
            }
            
            // Top face
            this.ctx.beginPath();
            this.ctx.moveTo(screenX, screenY - animHeight);
            this.ctx.lineTo(screenX + tileW, screenY - tileH - animHeight);
            this.ctx.lineTo(screenX, screenY - tileH * 2 - animHeight);
            this.ctx.lineTo(screenX - tileW, screenY - tileH - animHeight);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.stroke();
            
            // Left face
            this.ctx.beginPath();
            this.ctx.moveTo(screenX - tileW, screenY - tileH - animHeight);
            this.ctx.lineTo(screenX, screenY - animHeight);
            this.ctx.lineTo(screenX, screenY);
            this.ctx.lineTo(screenX - tileW, screenY - tileH);
            this.ctx.closePath();
            this.ctx.fillStyle = `rgba(0,0,0,0.2)`; 
            this.ctx.fill();
            this.ctx.stroke();

            // Right face
            this.ctx.beginPath();
            this.ctx.moveTo(screenX, screenY - animHeight);
            this.ctx.lineTo(screenX + tileW, screenY - tileH - animHeight);
            this.ctx.lineTo(screenX + tileW, screenY - tileH);
            this.ctx.lineTo(screenX, screenY);
            this.ctx.closePath();
            this.ctx.fillStyle = `rgba(0,0,0,0.4)`; 
            this.ctx.fill();
            this.ctx.stroke();
        });
    }

    drawAttractor(width, height, signature) {
        const { a, b, c, d } = this.styleState.attractorParams;
        // Use generated scale or fallback
        const scale = this.styleState.attractorParams.scale || 200;
        const cx = width / 2;
        const cy = height / 2;
        const palette = this.styleState.palette || [];

        this.ctx.lineWidth = 1.5;
        
        // Iterate points
        this.particles.forEach((p, i) => {
             const oldX = cx + p.x * scale;
             const oldY = cy + p.y * scale;
             
             // Clifford Attractor update
             const nx = Math.sin(a * p.y) + c * Math.cos(a * p.x);
             const ny = Math.sin(b * p.x) + d * Math.cos(b * p.y);
             
             p.x = nx;
             p.y = ny;
             
             const newX = cx + p.x * scale;
             const newY = cy + p.y * scale;
             
             // Bounds check to avoid drawing off-screen infinity
             if (Math.abs(newX) > width * 2 || Math.abs(newY) > height * 2) return;
             
             const paletteTone = this.getPaletteColorForHue(p.hue, palette);
             this.ctx.strokeStyle = `hsla(${paletteTone.h}, ${paletteTone.s}%, ${paletteTone.l}%, 0.35)`;
             
             this.ctx.beginPath();
             this.ctx.moveTo(oldX, oldY);
             this.ctx.lineTo(newX, newY);
             this.ctx.stroke();
        });
    }

    drawBio(width, height, signature) {
        const dim = this.styleState.bioDim;
        const grid = this.styleState.bioGrid;
        const next = this.styleState.bioNext;
        const { dA, dB, f, k } = this.styleState.bioParams;
        const palette = this.styleState.palette || [];
        
        const cellW = width / dim;
        const cellH = height / dim;
        
        // Run multiple simulation steps per frame for speed
        for(let step=0; step<8; step++) {
            for(let x=0; x<dim; x++) {
                for(let y=0; y<dim; y++) {
                    const i = (y * dim + x) * 2;
                    const A = grid[i];
                    const B = grid[i+1];
                    
                    // Laplacian
                    let lapA = 0;
                    let lapB = 0;
                    
                    // Simple 3x3 convolution convolution kernel:
                    // 0.05  0.2  0.05
                    // 0.2  -1.0  0.2
                    // 0.05  0.2  0.05
                    
                    // Center weight is -1, so we add neighbors * weights
                    // Neighbors
                    const xm1 = ((x - 1 + dim) % dim);
                    const xp1 = ((x + 1) % dim);
                    const ym1 = ((y - 1 + dim) % dim);
                    const yp1 = ((y + 1) % dim);
                    
                    const neighbors = [
                        [xm1, y, 0.2], [xp1, y, 0.2], [x, ym1, 0.2], [x, yp1, 0.2],
                        [xm1, ym1, 0.05], [xp1, ym1, 0.05], [xm1, yp1, 0.05], [xp1, yp1, 0.05]
                    ];
                    
                    neighbors.forEach(n => {
                        const idx = (n[1]*dim + n[0])*2;
                        lapA += grid[idx] * n[2];
                        lapB += grid[idx+1] * n[2];
                    });
                    
                    lapA -= A; // Center weight -1
                    lapB -= B; 
                    
                    // Gray-Scott Formula
                    // A' = A + (dA * lapA - A*B^2 + f*(1-A))
                    // B' = B + (dB * lapB + A*B^2 - (k+f)*B)
                    
                    const reaction = A * B * B;
                    next[i] = A + (dA * lapA - reaction + f * (1 - A));
                    next[i+1] = B + (dB * lapB + reaction - (k + f) * B);
                    
                    // Clamp
                    if(next[i] < 0) next[i]=0; if(next[i]>1) next[i]=1;
                    if(next[i+1] < 0) next[i+1]=0; if(next[i+1]>1) next[i+1]=1;
                }
            }
            // Swap
            for(let k=0; k<grid.length; k++) grid[k] = next[k];
        }

        // Draw
        // We can draw directly to ImageData for speed, but fillRect is easier for palette mapping
        // Optimization: Create ImageData once and update it? 
        // For 100x100, fillRect is acceptable (~10k calls).
        
        for(let y=0; y<dim; y++) {
            for(let x=0; x<dim; x++) {
                const i = (y * dim + x) * 2;
                const B = grid[i+1];
                const A = grid[i];
                
                // Color based on concentration difference A-B or just B
                const val = Math.floor((A - B) * 255);
                
                // Only draw active cells
                if (B > 0.1) {
                     // Map B concentration to palette index
                     const paletteIdx = Math.floor(B * palette.length * 2) % palette.length;
                     const tone = palette[paletteIdx] || palette[0];
                     
                     this.ctx.fillStyle = `hsla(${tone.h}, ${tone.s}%, ${Math.max(10, tone.l - B*20)}%, 1)`;
                     this.ctx.fillRect(x * cellW, y * cellH, cellW+1, cellH+1);
                } else {
                     this.ctx.fillStyle = `rgba(0,0,0,1)`; // Clear background
                     this.ctx.fillRect(x * cellW, y * cellH, cellW, cellH);
                }
            }
        }
    }

    drawPainting(width, height, signature) {
        const brushes = this.styleState.brushes || [];
        const style = this.styleState.paintStyle || 'oil';
        const palette = this.styleState.palette || [];

        brushes.forEach(b => {
            // Update brush
            const noise = this.noise.noise(b.x * 0.005, b.y * 0.005 + this.time * 0.1);
            const angle = noise * Math.PI * 4;
            
            b.vx += Math.cos(angle) * 0.2;
            b.vy += Math.sin(angle) * 0.2;
            b.vx *= 0.96;
            b.vy *= 0.96;
            
            b.x += b.vx;
            b.y += b.vy;
            
            if (b.x < 0) b.x += width;
            if (b.x > width) b.x -= width;
            if (b.y < 0) b.y += height;
            if (b.y > height) b.y -= height;
            
            const paletteTone = this.getPaletteColorForHue(b.hue, palette);
            
            if (style === 'oil') {
                this.ctx.fillStyle = `hsla(${paletteTone.h}, ${paletteTone.s}%, ${paletteTone.l}%, 0.1)`;
                this.ctx.beginPath();
                this.ctx.arc(b.x, b.y, b.size * (0.8 + Math.sin(this.time) * 0.2), 0, Math.PI * 2);
                this.ctx.fill();
                
                // Texture
                this.ctx.strokeStyle = `hsla(${paletteTone.h}, ${paletteTone.s}%, ${paletteTone.l + 10}%, 0.1)`;
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                this.ctx.moveTo(b.x, b.y);
                this.ctx.lineTo(b.x + b.vx * 4, b.y + b.vy * 4);
                this.ctx.stroke();
            } else {
                // Watercolor
                const spread = b.size * 3; // Increased spread
                this.ctx.fillStyle = `hsla(${paletteTone.h}, ${paletteTone.s}%, ${paletteTone.l}%, 0.08)`; // Increased opacity
                
                // Deformed circle
                this.ctx.beginPath();
                const points = 8;
                for(let i=0; i<=points; i++) {
                    const a = (i/points) * Math.PI * 2;
                    const r = spread * (0.8 + Math.random() * 0.4);
                    const px = b.x + Math.cos(a) * r;
                    const py = b.y + Math.sin(a) * r;
                    if (i===0) this.ctx.moveTo(px, py);
                    else this.ctx.lineTo(px, py);
                }
                this.ctx.fill();
            }
        });
    }
    
    drawOverlay(width, height, signature, repoData) {
        // Overlay text is handled by DOM for the Apple TV style UI.
        return;
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
        this.repoNameEl = document.getElementById('repo-name');
        this.repoStatsEl = document.getElementById('repo-stats');
        
        this.visualizer = null;
        this.repoData = null;
        this.placeholderCycleActive = false;
        this.resizeTimer = null;
        this.exampleRepos = [
            'https://github.com/facebook/react',
            'https://github.com/torvalds/linux',
            'https://github.com/tensorflow/tensorflow'
        ];
        this.currentExampleIndex = 0;
        this.placeholderRepos = [
            'https://github.com/facebook/react',
            'https://github.com/vuejs/vue',
            'https://github.com/tensorflow/tensorflow',
            'https://github.com/bitcoin/bitcoin',
            'https://github.com/rust-lang/rust',
            'https://github.com/torvalds/linux'
        ];
        
        this.init();
    }
    
    init() {
        // Initialize visualizer
        this.visualizer = new SimpleVisualizer(this.canvas);
        
        // Event listeners
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        document.getElementById('download-btn')?.addEventListener('click', () => this.downloadScreenshot());
        document.getElementById('share-btn')?.addEventListener('click', () => this.share());
        document.getElementById('randomize-btn')?.addEventListener('click', () => this.randomizeExample());

        this.repoUrlInput.addEventListener('focus', () => {
            document.body.classList.add('is-input-focused');
        });
        this.repoUrlInput.addEventListener('blur', () => {
            document.body.classList.remove('is-input-focused');
        });
        
        // Handle window resize
        window.addEventListener('resize', () => {
            if (!this.visualizer) return;
            this.visualizer.resize();
            if (!this.repoData) return;
            if (this.resizeTimer) clearTimeout(this.resizeTimer);
            this.resizeTimer = setTimeout(() => {
                this.visualizer.visualizeRepository(this.repoData);
            }, 150);
        });
        
        // Set random placeholder library
        this.setRandomPlaceholderLibrary();

        // Initial overlay content
        this.updateOverlay();

        // Auto-pick an example repo on load
        this.autoSelectExample();

        // Idle UI fade for controls
        this.setupIdleUI();
    }
    
    setRandomPlaceholderLibrary() {
        let currentIndex = 0;
        let isTyping = false;
        let currentFullUrl = this.placeholderRepos[0]; 
        
        const typeText = async (text) => {
            if (isTyping) return;
            isTyping = true;
            currentFullUrl = text;
            
            // Simple typing effect simulation
            this.repoUrlInput.setAttribute('placeholder', text);
            
            isTyping = false;
        };
        
        this.placeholderCycleActive = true;

        const cycleRepositories = async () => {
            if (!this.placeholderCycleActive) return;
            await typeText(this.placeholderRepos[currentIndex]);
            currentIndex = (currentIndex + 1) % this.placeholderRepos.length;
            setTimeout(cycleRepositories, 4000);
        };
        
        // Expose the current full URL for form submission
        this.getCurrentPlaceholderUrl = () => currentFullUrl;
        
        cycleRepositories();
    }

    autoSelectExample() {
        if (this.repoUrlInput.value.trim()) return;
        const repoUrl = this.getRandomExampleRepo();
        if (!repoUrl) return;

        this.repoUrlInput.value = repoUrl;
        this.form.dispatchEvent(new Event('submit'));
    }

    getRandomExampleRepo() {
        if (this.exampleRepos && this.exampleRepos.length) {
            const index = Math.floor(Math.random() * this.exampleRepos.length);
            this.currentExampleIndex = index;
            return this.exampleRepos[index];
        }
        return null;
    }

    randomizeExample() {
        if (!this.exampleRepos.length) return;
        this.currentExampleIndex = (this.currentExampleIndex + 1) % this.exampleRepos.length;
        const repoUrl = this.exampleRepos[this.currentExampleIndex];
        if (!repoUrl) return;
        this.repoUrlInput.value = repoUrl;
        this.form.dispatchEvent(new Event('submit'));
    }

    setupIdleUI() {
        const idleClass = 'is-idle';
        const idleDelay = 3000;
        let idleTimer = null;
        const controls = document.querySelector('.overlay-controls');
        const stack = document.querySelector('.overlay-stack');

        const updateIdleShift = () => {
            if (!controls || !stack) return;
            const controlsHeight = controls.getBoundingClientRect().height;
            const stackStyles = window.getComputedStyle(stack);
            const gap = parseFloat(stackStyles.gap || '0') || 0;
            const shift = Math.max(0, Math.round(controlsHeight));
            const shiftActions = Math.max(0, Math.round(controlsHeight + gap));
            document.body.style.setProperty('--idle-shift', `${shift}px`);
            document.body.style.setProperty('--idle-shift-actions', `${shiftActions}px`);
        };

        const resetIdleTimer = () => {
            if (idleTimer) clearTimeout(idleTimer);
            idleTimer = setTimeout(() => {
                updateIdleShift();
                document.body.classList.add(idleClass);
            }, idleDelay);
        };

        const wake = () => {
            if (document.body.classList.contains(idleClass)) {
                document.body.classList.remove(idleClass);
            }
            resetIdleTimer();
        };

        ['mousemove', 'mousedown', 'pointermove', 'touchstart', 'touchmove', 'keydown'].forEach((eventName) => {
            window.addEventListener(eventName, wake, { passive: true });
        });

        window.addEventListener('resize', updateIdleShift);
        updateIdleShift();
        resetIdleTimer();
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
            this.updateOverlay(this.repoData);
            this.updateInputPlaceholder(this.repoData);
            
            // Delay slightly to ensure canvas is ready
            setTimeout(() => {
                this.hideStatus();
                this.visualizer.visualizeRepository(this.repoData);
            }, 50);
            
        } catch (error) {
            console.error('Visualization error:', error);
            
            // Fallback for Rate Limits OR Network Errors (Offline)
            const isNetworkError = error.message.includes('Failed to fetch') || error.message.includes('NetworkError');
            const isApiError = error.message.includes('rate limit') || error.message.includes('API error') || error.message.includes('404') || error.message.includes('403');
            
            if (isNetworkError || isApiError) {
                this.showStatus('Simulation mode (Network/API unavailable)...');
                const { owner, repo } = this.parseGitHubUrl(repoUrl);
                const fallbackData = this.createFallbackData(owner, repo);
                
                this.showResult();
                this.updateOverlay(fallbackData);
                this.updateInputPlaceholder(fallbackData);
                setTimeout(() => {
                    this.hideStatus();
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
            const authorIndex = Math.floor(random() * 5);
            const commitDate = new Date(Date.now() - Math.floor(random() * 31536000000)).toISOString();
            const messageSuffix = Math.floor(random() * 1000);
            const sha = Math.floor(random() * 1e16).toString(16).padStart(16, '0');

            commits.push({
                sha,
                commit: { 
                    author: { 
                        name: `Dev ${authorIndex + 1}`,
                        email: `dev${authorIndex}@test.com`,
                        date: commitDate
                    },
                    committer: {
                        date: commitDate
                    },
                    message: `Generated commit ${i + 1} (${messageSuffix})`
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
        this.hideStatus();
        this.errorDiv.style.display = 'none';
        // Result is always visible now
    }
    
    showError(msg) {
        this.hideAll();
        this.errorDiv.style.display = 'block';
        this.errorDiv.querySelector('.error-message').textContent = msg;
        this.updateOverlay();
    }
    
    hideAll() {
        this.statusDiv.style.display = 'none';
        this.errorDiv.style.display = 'none';
    }

    formatNumber(value) {
        if (typeof value !== 'number' || !Number.isFinite(value)) return '0';
        if (typeof Intl !== 'undefined' && Intl.NumberFormat) {
            return new Intl.NumberFormat('en', { notation: 'compact' }).format(value);
        }
        return String(value);
    }

    updateOverlay(repoData) {
        if (!this.repoNameEl || !this.repoStatsEl) return;

        if (!repoData) {
            this.repoNameEl.textContent = 'Commit Flipbook';
            this.repoStatsEl.textContent = 'Enter a GitHub repository URL';
            return;
        }

        const commitCount = repoData.commits ? repoData.commits.length : 0;
        const languageCount = Object.keys(repoData.languages || {}).length;
        const stats = repoData.stats || {};
        const parts = [
            `${commitCount} commits`,
            `${languageCount} languages`
        ];

        if (typeof stats.stars === 'number') {
            parts.push(`${this.formatNumber(stats.stars)} stars`);
        }
        if (typeof stats.forks === 'number') {
            parts.push(`${this.formatNumber(stats.forks)} forks`);
        }

        this.repoNameEl.textContent = repoData.info.full_name;
        this.repoStatsEl.textContent = parts.join(' • ');
    }

    updateInputPlaceholder(repoData) {
        if (!this.repoUrlInput) return;
        if (!repoData || !repoData.info || !repoData.info.full_name) return;

        const placeholder = `https://github.com/${repoData.info.full_name}`;
        this.placeholderCycleActive = false;
        this.repoUrlInput.value = '';
        this.repoUrlInput.setAttribute('placeholder', placeholder);
        this.getCurrentPlaceholderUrl = () => placeholder;
    }
    
    setLoadingState(loading) {
        this.generateBtn.disabled = loading;
        const loader = this.generateBtn.querySelector('.button-loader');
        const text = this.generateBtn.querySelector('.button-text');
        if (loader) loader.style.display = loading ? 'inline-block' : 'none';
        if (text) text.style.display = loading ? 'none' : '';
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new CommitArtGenerator();
});
