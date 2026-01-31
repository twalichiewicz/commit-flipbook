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
            { key: 'constellation-iris', base: 'constellation', backdrop: 'iris', paletteShift: 0, accentShift: 120, starDensity: 1.4, linkRadius: 110, haloScale: 3.8, fadeAlpha: 0.16, starBurst: true },
            { key: 'constellation-ember', base: 'constellation', backdrop: 'ember', paletteShift: 25, accentShift: 60, starDensity: 1.1, linkRadius: 80, haloScale: 4.2, fadeAlpha: 0.2, starBurst: true },
            { key: 'constellation-glacier', base: 'constellation', backdrop: 'ice', paletteShift: -35, accentShift: 180, starDensity: 1.2, linkRadius: 95, haloScale: 3.4, fadeAlpha: 0.18 },
            { key: 'flow-aurora', base: 'flow', backdrop: 'aurora', paletteShift: 15, flowMode: 'ribbon', speedScale: 1.1, fadeAlpha: 0.14 },
            { key: 'flow-smoke', base: 'flow', backdrop: 'ink', paletteShift: -10, flowMode: 'mist', speedScale: 0.9, fadeAlpha: 0.2, flowAlpha: 0.35 },
            { key: 'flow-braids', base: 'flow', backdrop: 'cobalt', paletteShift: 40, flowMode: 'braid', speedScale: 1.2, fadeAlpha: 0.12 },
            { key: 'nebula-supernova', base: 'nebula', backdrop: 'solar', paletteShift: 25, cloudCount: 10, cloudAlpha: 0.14, tailScale: 1.4, swirlStrength: 0.6, fadeAlpha: 0.12 },
            { key: 'nebula-disk', base: 'nebula', backdrop: 'noir', paletteShift: -20, cloudCount: 6, cloudAlpha: 0.1, tailScale: 1.1, swirlStrength: 0.3, diskSquash: 0.65, fadeAlpha: 0.15 },
            { key: 'nebula-void', base: 'nebula', backdrop: 'ice', paletteShift: -50, cloudCount: 4, cloudAlpha: 0.08, tailScale: 0.8, swirlStrength: 0.2, fadeAlpha: 0.2 },
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
            { key: 'orbit-helix', base: 'orbit', backdrop: 'iris', paletteShift: 10, orbitCenters: 3, orbitTightness: 0.9, fadeAlpha: 0.12 },
            { key: 'orbit-astrolabe', base: 'orbit', backdrop: 'ice', paletteShift: -15, orbitCenters: 4, orbitTightness: 1.2, fadeAlpha: 0.16 },
            { key: 'orbit-molten', base: 'orbit', backdrop: 'ember', paletteShift: 30, orbitCenters: 2, orbitTightness: 0.7, fadeAlpha: 0.18 },
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
            { key: 'radar-archive', base: 'radar', backdrop: 'verdant', paletteShift: 20, radarRings: 6, fadeAlpha: 0.18, grain: true },
            { key: 'radar-prism', base: 'radar', backdrop: 'aurora', paletteShift: 45, radarRings: 7, fadeAlpha: 0.14 },
            { key: 'radar-signal', base: 'radar', backdrop: 'noir', paletteShift: -15, radarRings: 5, fadeAlpha: 0.2, grain: true, frame: true }
        ];
    }

    getStylePalette(signature, count) {
        const profile = signature.styleProfile || {};
        const seed = signature.hash + this.hashString(signature.styleKey || signature.style);
        const rng = this.createSeededRNG(seed);
        const base = signature.primaryHue;
        const palette = [];

        const offsets = Array.isArray(profile.paletteOffsets) ? profile.paletteOffsets : null;
        const total = offsets ? offsets.length : count;
        const spread = 30 + (signature.hash % 60);

        for (let i = 0; i < total; i++) {
            const offset = offsets ? offsets[i] : (i * spread + rng() * 30 - 15);
            const hue = (base + offset + 360) % 360;
            const sat = 40 + rng() * 45;
            const light = 28 + rng() * 45;
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
        const profile = signature.styleProfile || {};
        const mode = profile.backdrop || signature.style;
        const accentHue = (signature.primaryHue + (profile.accentShift || 90) + 360) % 360;
        let gradient = null;

        switch (mode) {
            case 'iris':
                gradient = ctx.createRadialGradient(
                    width * 0.35,
                    height * 0.3,
                    Math.min(width, height) * 0.05,
                    width * 0.6,
                    height * 0.65,
                    Math.max(width, height)
                );
                gradient.addColorStop(0, `hsla(${accentHue}, 35%, 14%, 1)`);
                gradient.addColorStop(0.45, `hsla(${signature.primaryHue}, 30%, 8%, 1)`);
                gradient.addColorStop(1, `hsla(${signature.secondaryHue}, 35%, 4%, 1)`);
                break;
            case 'ember':
                gradient = ctx.createRadialGradient(
                    width * 0.5,
                    height * 0.4,
                    Math.min(width, height) * 0.08,
                    width * 0.5,
                    height * 0.6,
                    Math.max(width, height) * 0.9
                );
                gradient.addColorStop(0, `hsla(${signature.primaryHue}, 50%, 16%, 1)`);
                gradient.addColorStop(0.5, `hsla(${signature.primaryHue + 20}, 55%, 8%, 1)`);
                gradient.addColorStop(1, `hsla(${signature.secondaryHue}, 40%, 3%, 1)`);
                break;
            case 'ice':
                gradient = ctx.createRadialGradient(
                    width * 0.4,
                    height * 0.2,
                    Math.min(width, height) * 0.05,
                    width * 0.7,
                    height * 0.8,
                    Math.max(width, height)
                );
                gradient.addColorStop(0, `hsla(${signature.primaryHue}, 35%, 18%, 1)`);
                gradient.addColorStop(0.6, `hsla(${signature.secondaryHue}, 25%, 8%, 1)`);
                gradient.addColorStop(1, `hsla(${signature.secondaryHue}, 20%, 4%, 1)`);
                break;
            case 'aurora':
                gradient = ctx.createLinearGradient(0, 0, width, height);
                gradient.addColorStop(0, `hsla(${signature.primaryHue}, 40%, 12%, 1)`);
                gradient.addColorStop(0.5, `hsla(${accentHue}, 45%, 8%, 1)`);
                gradient.addColorStop(1, `hsla(${signature.tertiaryHue}, 40%, 4%, 1)`);
                break;
            case 'noir':
                gradient = ctx.createLinearGradient(0, 0, 0, height);
                gradient.addColorStop(0, `hsla(${signature.primaryHue}, 10%, 9%, 1)`);
                gradient.addColorStop(1, `hsla(${signature.secondaryHue}, 12%, 2%, 1)`);
                break;
            case 'verdant':
                gradient = ctx.createLinearGradient(0, height, width, 0);
                gradient.addColorStop(0, `hsla(${signature.primaryHue + 80}, 30%, 10%, 1)`);
                gradient.addColorStop(1, `hsla(${signature.secondaryHue + 60}, 35%, 5%, 1)`);
                break;
            case 'solar':
                gradient = ctx.createRadialGradient(
                    width * 0.5,
                    height * 0.5,
                    Math.min(width, height) * 0.05,
                    width * 0.5,
                    height * 0.5,
                    Math.max(width, height) * 0.8
                );
                gradient.addColorStop(0, `hsla(${signature.primaryHue}, 60%, 18%, 1)`);
                gradient.addColorStop(0.6, `hsla(${signature.primaryHue + 30}, 45%, 10%, 1)`);
                gradient.addColorStop(1, `hsla(${signature.secondaryHue}, 40%, 3%, 1)`);
                break;
            case 'cobalt':
                gradient = ctx.createLinearGradient(0, 0, width, 0);
                gradient.addColorStop(0, `hsla(${signature.primaryHue + 200}, 35%, 10%, 1)`);
                gradient.addColorStop(1, `hsla(${signature.secondaryHue + 200}, 30%, 4%, 1)`);
                break;
            case 'ink':
                gradient = ctx.createLinearGradient(0, 0, 0, height);
                gradient.addColorStop(0, `hsla(${signature.primaryHue}, 12%, 6%, 1)`);
                gradient.addColorStop(1, `hsla(${signature.secondaryHue}, 12%, 2%, 1)`);
                break;
            case 'constellation':
                gradient = ctx.createRadialGradient(
                    width * 0.2,
                    height * 0.15,
                    Math.min(width, height) * 0.05,
                    width * 0.6,
                    height * 0.7,
                    Math.max(width, height)
                );
                gradient.addColorStop(0, `hsla(${signature.primaryHue}, 35%, 10%, 1)`);
                gradient.addColorStop(0.6, `hsla(${signature.secondaryHue}, 35%, 6%, 1)`);
                gradient.addColorStop(1, `hsla(${signature.secondaryHue}, 30%, 3%, 1)`);
                break;
            case 'flow':
                gradient = ctx.createLinearGradient(0, 0, width, height);
                gradient.addColorStop(0, `hsla(${signature.primaryHue}, 45%, 9%, 1)`);
                gradient.addColorStop(1, `hsla(${signature.tertiaryHue}, 45%, 5%, 1)`);
                break;
            case 'nebula':
                gradient = ctx.createRadialGradient(
                    width * 0.5,
                    height * 0.5,
                    Math.min(width, height) * 0.1,
                    width * 0.5,
                    height * 0.5,
                    Math.max(width, height) * 0.9
                );
                gradient.addColorStop(0, `hsla(${signature.primaryHue}, 40%, 12%, 1)`);
                gradient.addColorStop(0.5, `hsla(${signature.secondaryHue}, 35%, 7%, 1)`);
                gradient.addColorStop(1, `hsla(${signature.secondaryHue}, 30%, 4%, 1)`);
                break;
            case 'matrix':
                gradient = ctx.createLinearGradient(0, 0, 0, height);
                gradient.addColorStop(0, `hsla(${signature.secondaryHue}, 40%, 6%, 1)`);
                gradient.addColorStop(1, `hsla(${signature.secondaryHue}, 30%, 2%, 1)`);
                break;
            case 'mosaic':
                gradient = ctx.createLinearGradient(0, 0, width, 0);
                gradient.addColorStop(0, `hsla(${signature.primaryHue}, 20%, 10%, 1)`);
                gradient.addColorStop(1, `hsla(${signature.secondaryHue}, 25%, 6%, 1)`);
                break;
            case 'tree':
                gradient = ctx.createLinearGradient(0, 0, 0, height);
                gradient.addColorStop(0, `hsla(${signature.primaryHue}, 18%, 12%, 1)`);
                gradient.addColorStop(1, `hsla(${signature.secondaryHue}, 18%, 6%, 1)`);
                break;
            case 'life':
                gradient = ctx.createLinearGradient(0, 0, width, height);
                gradient.addColorStop(0, `hsla(${signature.secondaryHue}, 25%, 9%, 1)`);
                gradient.addColorStop(1, `hsla(${signature.tertiaryHue}, 20%, 5%, 1)`);
                break;
            default:
                break;
        }

        if (gradient) {
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);
            if (signature.styleProfile?.grain && this.styleState.grainPattern) {
                ctx.save();
                ctx.globalAlpha = 0.18;
                ctx.fillStyle = this.styleState.grainPattern;
                ctx.fillRect(0, 0, width, height);
                ctx.restore();
            }
            return;
        }

        ctx.fillStyle = `hsla(${signature.primaryHue}, 30%, 5%, 1)`;
        ctx.fillRect(0, 0, width, height);
        if (signature.styleProfile?.grain && this.styleState.grainPattern) {
            ctx.save();
            ctx.globalAlpha = 0.18;
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
    
            
    
            generateSignature(repoData) {
        const { info, languages, contributors, commits } = repoData;
        const repoName = info.full_name;
        const hash = this.hashString(repoName);

        // Determine palette based on dominant language
        const dominantLang = Object.keys(languages)[0] || 'JavaScript';
        const langHash = this.hashString(dominantLang);
        const baseHue = langHash % 360;
        const complexity = Math.min(Object.keys(languages || {}).length + (contributors || []).length / 5, 20);
        const energy = Math.min((commits || []).length / 20, 100);

        const styleProfiles = this.getStyleProfiles();
        let styleIndex = Math.abs(hash + Math.floor(complexity * 13) + Math.floor(energy * 7) + (commits || []).length) % styleProfiles.length;
        let styleProfile = styleProfiles[styleIndex];
        const avoidMap = {
            'facebook/react': new Set(['life-neon', 'life-quilt', 'life-bioreactor']),
            'torvalds/linux': new Set(['rift-glitch', 'rift-paper'])
        };
        const avoid = avoidMap[repoName];
        if (avoid && avoid.has(styleProfile.key)) {
            const salt = 7 + (hash % 5);
            let attempts = 0;
            while (attempts < styleProfiles.length && avoid.has(styleProfile.key)) {
                styleIndex = (styleIndex + salt) % styleProfiles.length;
                styleProfile = styleProfiles[styleIndex];
                attempts++;
            }
        }
        const paletteShift = styleProfile.paletteShift || 0;
        const primaryHue = (baseHue + paletteShift + 360) % 360;
        const secondaryHue = (primaryHue + (styleProfile.secondaryOffset || 180)) % 360;
        const tertiaryHue = (primaryHue + (styleProfile.tertiaryOffset || 90)) % 360;
        const speedScale = styleProfile.speedScale || 1;

        return {
            hash: hash,
            primaryHue: primaryHue,
            secondaryHue: secondaryHue,
            tertiaryHue: tertiaryHue,
            complexity: complexity,
            energy: energy,
            style: styleProfile.base,
            styleKey: styleProfile.key,
            styleProfile: styleProfile,
            speed: (0.009 + ((hash % 12) / 1200)) * speedScale
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
        this.particles = [];
        this.styleState = {};
        this.lifeGrid = [];
        const profile = signature.styleProfile || {};
        const paletteCount = profile.paletteCount || 5;
        this.styleState.palette = this.getStylePalette(signature, paletteCount);
        if (profile.grain) {
            const grainRng = this.createSeededRNG(signature.hash + 991);
            this.styleState.grainPattern = this.createGrainPattern(120, grainRng);
        }
        const { commits } = repoData;
        const dpr = window.devicePixelRatio || 1;
        const width = this.canvas.width / dpr;
        const height = this.canvas.height / dpr;
        
        const activeCommits = (commits || []).slice(0, 150);
        if (activeCommits.length === 0) return;

        // Calculate Time Range (guard against missing/invalid dates)
        const times = activeCommits
            .map(c => {
                const dateValue = c?.commit?.author?.date || c?.commit?.committer?.date;
                const parsed = new Date(dateValue).getTime();
                return Number.isFinite(parsed) ? parsed : null;
            })
            .filter((time) => time !== null);

        let minTime;
        let maxTime;

        if (times.length === 0) {
            const fallbackBase = 946684800000 + (signature.hash % 31536000000); // Year 2000 + up to 1 year
            minTime = fallbackBase - 86400000;
            maxTime = fallbackBase + 86400000;
        } else {
            minTime = Math.min(...times);
            maxTime = Math.max(...times);
        }
        
        if (minTime === maxTime) {
            minTime -= 86400000; // -1 day
            maxTime += 86400000; // +1 day
        }
        
        const timeRange = { minTime, maxTime };

        // Generate Particles from Commits
        activeCommits.forEach((commit, i) => {
            const p = this.mapCommitToParticle(commit, i, activeCommits.length, width, height, timeRange);
            
            if (isNaN(p.x) || isNaN(p.y)) {
                console.error('Invalid particle:', p);
                return;
            }
            this.particles.push(p);
        });

        // Add "Ghost" particles for structure (e.g. background flow)
        // These are seeded by Repo Name to remain deterministic
        if (signature.style === 'flow' || signature.style === 'nebula') {
             const bgCount = profile.bgCount || 50;
             for(let i=0; i<bgCount; i++) {
                 // Seed pseudorandomness with index + repo hash
                 const seed = signature.hash + i;
                 const px = (seed % 1000) / 1000 * width;
                 const py = ((seed * 2) % 1000) / 1000 * height;
                 
                 this.particles.push({
                     x: px, y: py,
                     originX: px,
                     originY: py,
                     prevX: px,
                     prevY: py,
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
            this.styleState.lifeMaxAge = profile.lifeMaxAge || 18;
            this.styleState.lifeCellStyle = profile.lifeCellStyle || 'square';
        }

        if (signature.style === 'constellation') {
            const starDensity = profile.starDensity || 1;
            const starCount = Math.min(420, Math.floor((140 + signature.energy * 1.4) * starDensity));
            this.styleState.stars = [];
            for (let i = 0; i < starCount; i++) {
                this.styleState.stars.push({
                    x: this.rng() * width,
                    y: this.rng() * height,
                    r: 0.4 + this.rng() * 1.6,
                    alpha: 0.3 + this.rng() * 0.6,
                    twinkle: this.rng() * Math.PI * 2,
                    hue: (signature.primaryHue + this.rng() * 60 - 30 + 360) % 360,
                    burst: profile.starBurst ? (0.2 + this.rng() * 0.8) : 0
                });
            }
        }

        if (signature.style === 'nebula') {
            const cloudCount = profile.cloudCount || (6 + (signature.hash % 4));
            const cloudAlpha = profile.cloudAlpha || 0.1;
            this.styleState.clouds = [];
            for (let i = 0; i < cloudCount; i++) {
                const spread = profile.cloudSpread || 0.35;
                const radius = (0.15 + this.rng() * spread) * Math.min(width, height);
                this.styleState.clouds.push({
                    x: this.rng() * width,
                    y: this.rng() * height,
                    r: radius,
                    alpha: cloudAlpha * (0.5 + this.rng() * 0.8),
                    hue: (signature.primaryHue + this.rng() * 90 - 45 + 360) % 360
                });
            }
        }

        if (signature.style === 'matrix') {
            const columnBase = profile.columnWidth || 40;
            const columnDensity = profile.columnDensity || 1;
            const columnCount = Math.max(14, Math.floor((width / columnBase) * columnDensity));
            const columnWidth = width / columnCount;
            this.styleState.columns = [];
            for (let i = 0; i < columnCount; i++) {
                this.styleState.columns.push({
                    x: (i + 0.5) * columnWidth,
                    width: Math.max(1, columnWidth * 0.15),
                    alpha: 0.06 + this.rng() * 0.18,
                    hue: (signature.secondaryHue + (i / columnCount) * 60 + signature.hash % 30) % 360
                });
            }
            this.styleState.columnWidth = columnWidth;
            this.styleState.glyphMode = profile.glyphMode || 'katakana';
            this.styleState.glyphScale = profile.glyphScale || 1;
            this.styleState.beamAlpha = profile.beamAlpha || 0.16;
        }

        if (signature.style === 'mosaic') {
            const gridMin = profile.mosaicGridMin || 12;
            const gridMax = profile.mosaicGridMax || 24;
            this.styleState.mosaicGrid = Math.round(this.mapValue(signature.complexity, 0, 20, gridMax, gridMin));
            this.styleState.mosaicStyle = profile.mosaicStyle || 'stained';
        }

        if (signature.style === 'tree') {
            this.styleState.treeDepth = profile.treeDepth || (9 + (signature.hash % 3));
            this.styleState.leafMode = profile.leafMode || 'petal';
        }

        if (signature.style === 'flow') {
            this.styleState.flowMode = profile.flowMode || 'ribbon';
            this.styleState.flowAlpha = profile.flowAlpha || 0.55;
        }

        if (signature.style === 'strata') {
            this.styleState.strataLayers = profile.strataLayers || Math.round(this.mapValue(signature.complexity, 0, 20, 12, 7));
            this.styleState.strataAmplitude = profile.strataAmplitude || Math.round(height * 0.08);
            this.styleState.strataScale = profile.strataScale || 0.004;
        }

        if (signature.style === 'orbit') {
            const centerCount = profile.orbitCenters || 3;
            const centers = [];
            const orbitSpread = Math.min(width, height) * 0.22;
            for (let i = 0; i < centerCount; i++) {
                const angle = (i / centerCount) * Math.PI * 2 + this.rng() * 0.6;
                const radius = orbitSpread * (0.6 + this.rng() * 0.6);
                centers.push({
                    x: width * 0.5 + Math.cos(angle) * radius,
                    y: height * 0.5 + Math.sin(angle) * radius
                });
            }
            this.styleState.orbitCenters = centers;
            this.styleState.orbitTightness = profile.orbitTightness || 1;
            this.styleState.orbitRings = centers.map((center, index) => {
                const ringCount = 2 + ((signature.hash + index) % 3);
                const ringSizes = [];
                for (let i = 0; i < ringCount; i++) {
                    ringSizes.push((0.12 + this.rng() * 0.28) * Math.min(width, height));
                }
                return ringSizes;
            });

            this.particles.forEach((p, index) => {
                const seed = this.hashString(p.commit?.sha || String(index)) + signature.hash;
                const centerIndex = Math.abs(seed) % centers.length;
                const center = centers[centerIndex];
                const dx = p.originX - center.x;
                const dy = p.originY - center.y;
                const baseRadius = Math.sqrt(dx * dx + dy * dy);
                const maxRadius = Math.min(width, height) * 0.45;
                p.orbitIndex = centerIndex;
                p.orbitRadius = Math.max(28, Math.min(baseRadius, maxRadius));
                p.orbitPhase = (seed % 360) * (Math.PI / 180);
                p.orbitSpeed = 0.002 + (p.size / 15) * 0.004 + (centerIndex * 0.0006);
                const startX = center.x + Math.cos(p.orbitPhase) * p.orbitRadius;
                const startY = center.y + Math.sin(p.orbitPhase) * p.orbitRadius * this.styleState.orbitTightness;
                p.x = startX;
                p.y = startY;
                p.prevX = startX;
                p.prevY = startY;
            });
        }

        if (signature.style === 'runes') {
            this.styleState.runeDensity = profile.runeDensity || 1;
            this.styleState.runeScale = profile.runeScale || 1;
        }

        if (signature.style === 'weave') {
            this.styleState.weaveCols = profile.weaveCols || Math.round(this.mapValue(signature.complexity, 0, 20, 14, 8));
            this.styleState.weaveRows = profile.weaveRows || Math.round(this.mapValue(signature.energy, 0, 100, 10, 6));
            this.styleState.weaveAmplitude = profile.weaveAmplitude || Math.round(height * 0.05);
        }

        if (signature.style === 'rift') {
            this.styleState.riftSlices = profile.riftSlices || Math.round(this.mapValue(signature.complexity, 0, 20, 18, 10));
            this.styleState.riftJitter = profile.riftJitter || 24;
        }

        if (signature.style === 'barcode') {
            const barCount = profile.barCount || Math.round(this.mapValue(signature.energy, 0, 100, 55, 80));
            const bars = [];
            let x = 0;
            for (let i = 0; i < barCount; i++) {
                const commit = activeCommits[i % activeCommits.length] || {};
                const statTotal = commit?.stats?.total ?? (10 + this.rng() * 120);
                const widthFactor = Math.log(statTotal + 2);
                const barW = Math.max(6, Math.min(width * 0.06, widthFactor * 4));
                const hue = this.hashString(commit?.commit?.author?.name || String(i)) % 360;
                const paletteTone = this.getPaletteColorForHue(hue, this.styleState.palette);
                bars.push({
                    x,
                    w: barW,
                    color: paletteTone,
                    alpha: 0.7 + this.rng() * 0.25
                });
                x += barW + 2 + this.rng() * 4;
                if (x > width) break;
            }
            this.styleState.barcodeBars = bars;
        }

        if (signature.style === 'collage') {
            const pieceCount = profile.collageCount || Math.round(this.mapValue(signature.complexity, 0, 20, 22, 32));
            const pieces = [];
            for (let i = 0; i < pieceCount; i++) {
                const hueSeed = (signature.primaryHue + i * 18) % 360;
                const paletteTone = this.getPaletteColorForHue(hueSeed, this.styleState.palette);
                const size = 40 + this.rng() * 140;
                pieces.push({
                    x: this.rng() * width,
                    y: this.rng() * height,
                    w: size * (0.6 + this.rng() * 0.8),
                    h: size * (0.6 + this.rng() * 0.8),
                    rot: (this.rng() - 0.5) * 0.6,
                    drift: this.rng() * Math.PI * 2,
                    kind: this.rng() > 0.7 ? 'circle' : 'rect',
                    tone: paletteTone,
                    alpha: 0.6 + this.rng() * 0.3
                });
            }
            this.styleState.collagePieces = pieces;
        }

        if (signature.style === 'radar') {
            const ringCount = profile.radarRings || Math.round(this.mapValue(signature.complexity, 0, 20, 5, 7));
            const maxRadius = Math.min(width, height) * 0.45;
            const rings = [];
            for (let i = 0; i < ringCount; i++) {
                rings.push((i + 1) / ringCount * maxRadius);
            }
            const points = [];
            activeCommits.forEach((commit, i) => {
                const author = commit?.commit?.author?.name || String(i);
                const angle = (this.hashString(author) % 360) * (Math.PI / 180);
                const radius = rings[i % rings.length];
                const hue = this.hashString(author) % 360;
                const tone = this.getPaletteColorForHue(hue, this.styleState.palette);
                points.push({
                    angle,
                    radius,
                    size: 2 + (i % 5),
                    tone
                });
            });
            this.styleState.radarRings = rings;
            this.styleState.radarPoints = points;
        }

        if (signature.style === 'tree') {
            const maxDepth = this.styleState.treeDepth || 9;
            const segments = [];
            const leaves = [];
            const buildTree = (x, y, len, angle, depth) => {
                if (depth > maxDepth || len < 2) {
                    leaves.push({ x, y, depth, phase: this.rng() * Math.PI * 2 });
                    return;
                }
                const bend = (this.rng() - 0.5) * 0.4;
                const nextAngle = angle + bend;
                const endX = x + Math.cos(nextAngle) * len;
                const endY = y + Math.sin(nextAngle) * len;
                segments.push({ x1: x, y1: y, x2: endX, y2: endY, depth, phase: this.rng() * Math.PI * 2 });

                const branchCount = 2 + ((signature.hash + depth) % 2);
                const spread = 0.45 + (this.rng() * 0.2);
                for (let i = 0; i < branchCount; i++) {
                    const newLen = len * (0.7 + this.rng() * 0.08);
                    const newAngle = nextAngle + spread * (i - (branchCount - 1) / 2);
                    buildTree(endX, endY, newLen, newAngle, depth + 1);
                }
            };
            buildTree(width / 2, height * 0.98, height * 0.32, -Math.PI / 2, 0);
            this.styleState.treeSegments = segments;
            this.styleState.treeLeaves = leaves;
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

        const compositeByStyle = {
            constellation: 'source-over',
            flow: 'source-over',
            nebula: 'source-over',
            matrix: 'source-over',
            mosaic: 'source-over',
            tree: 'source-over',
            life: 'source-over',
            strata: 'source-over',
            orbit: 'source-over',
            runes: 'source-over',
            weave: 'source-over',
            rift: 'source-over',
            barcode: 'source-over',
            collage: 'source-over',
            radar: 'source-over'
        };
        const profileComposite = signature.styleProfile?.composite;
        this.ctx.globalCompositeOperation = profileComposite || compositeByStyle[signature.style] || 'screen';
        
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
                this.drawConstellation(width, height, signature);
        }

        this.ctx.globalCompositeOperation = 'source-over';
            if (signature.styleProfile?.frame) {
                this.drawFrame(width, height, signature);
            }
            this.drawOverlay(width, height, signature, repoData);
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
        const cellStyle = this.styleState.lifeCellStyle || 'square';
        
        for (let i = 0; i < cols; i++) {
            for (let j = 0; j < rows; j++) {
                const age = this.lifeGrid[i][j];
                if (age > 0) {
                    const ageNorm = Math.min(age, maxAge) / maxAge;
                    const hue = (signature.secondaryHue + ageNorm * 80 + (i / cols) * 25 - (j / rows) * 20 + 360) % 360;
                    const lightness = 30 + ageNorm * 40;
                    const alpha = 0.2 + ageNorm * 0.8;
                    const pulse = 0.7 + 0.3 * Math.sin(this.time + (i + j) * 0.2);
                    const size = Math.min(cellW, cellH) * (0.4 + ageNorm * 0.55) * pulse;
                    const x = i * cellW + (cellW - size) / 2;
                    const y = j * cellH + (cellH - size) / 2;

                    this.ctx.fillStyle = `hsla(${hue}, 70%, ${lightness}%, ${alpha})`;
                    if (cellStyle === 'circle') {
                        this.ctx.beginPath();
                        this.ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
                        this.ctx.fill();
                    } else if (cellStyle === 'diamond') {
                        this.ctx.beginPath();
                        this.ctx.moveTo(x + size / 2, y);
                        this.ctx.lineTo(x + size, y + size / 2);
                        this.ctx.lineTo(x + size / 2, y + size);
                        this.ctx.lineTo(x, y + size / 2);
                        this.ctx.closePath();
                        this.ctx.fill();
                    } else {
                        this.ctx.fillRect(x, y, size, size);
                    }

                    const inset = size * 0.25;
                    this.ctx.fillStyle = `hsla(${hue}, 80%, ${lightness + 12}%, ${alpha * 0.5})`;
                    if (cellStyle === 'circle') {
                        this.ctx.beginPath();
                        this.ctx.arc(x + size / 2, y + size / 2, Math.max(1, (size - inset * 2) / 2), 0, Math.PI * 2);
                        this.ctx.fill();
                    } else if (cellStyle === 'diamond') {
                        const insetSize = size - inset * 2;
                        const cx = x + size / 2;
                        const cy = y + size / 2;
                        this.ctx.beginPath();
                        this.ctx.moveTo(cx, cy - insetSize / 2);
                        this.ctx.lineTo(cx + insetSize / 2, cy);
                        this.ctx.lineTo(cx, cy + insetSize / 2);
                        this.ctx.lineTo(cx - insetSize / 2, cy);
                        this.ctx.closePath();
                        this.ctx.fill();
                    } else {
                        this.ctx.fillRect(x + inset, y + inset, size - inset * 2, size - inset * 2);
                    }
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
                            neighbors += this.lifeGrid[ni][nj] > 0 ? 1 : 0;
                        }
                    }
                    if (this.lifeGrid[i][j] > 0 && (neighbors === 2 || neighbors === 3)) {
                        next[i][j] = Math.min(this.lifeGrid[i][j] + 1, maxAge);
                    } else if (this.lifeGrid[i][j] === 0 && neighbors === 3) {
                        next[i][j] = 1;
                    } else {
                        next[i][j] = 0;
                    }
                }
            }
            this.lifeGrid = next;
        }
    }

    drawConstellation(width, height, signature) {
        const profile = signature.styleProfile || {};
        const palette = this.styleState.palette || [];
        if (this.styleState.stars) {
            this.ctx.save();
            this.styleState.stars.forEach((star) => {
                const twinkle = 0.5 + 0.5 * Math.sin(this.time * 1.5 + star.twinkle);
                const alpha = star.alpha * twinkle;
                this.ctx.fillStyle = `hsla(${star.hue}, 15%, 80%, ${alpha})`;
                this.ctx.fillRect(star.x, star.y, star.r, star.r);

                if (star.r > 1.4 || star.burst) {
                    const burstScale = star.burst ? 1 + star.burst : 1;
                    this.ctx.strokeStyle = `hsla(${star.hue}, 20%, 85%, ${alpha * 0.4})`;
                    this.ctx.lineWidth = 0.6;
                    this.ctx.beginPath();
                    this.ctx.moveTo(star.x - star.r * 2.2 * burstScale, star.y);
                    this.ctx.lineTo(star.x + star.r * 2.2 * burstScale, star.y);
                    this.ctx.moveTo(star.x, star.y - star.r * 2.2 * burstScale);
                    this.ctx.lineTo(star.x, star.y + star.r * 2.2 * burstScale);
                    this.ctx.stroke();
                }
            });
            this.ctx.restore();
        }

        // Update particles
        this.particles.forEach(p => {
            // Subtle orbital movement based on phase
            if (!p.isBackground) {
                p.x += Math.cos(this.time + p.phase) * 0.3;
                p.y += Math.sin(this.time + p.phase) * 0.3;
            }
        });

        // Draw Connections
        const linkRadius = profile.linkRadius || 90;
        this.ctx.lineWidth = 1;
        this.ctx.lineCap = 'round';
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
                if (dist < linkRadius) {
                    const intensity = 1 - dist / linkRadius;
                    const midHue = (p1.hue + p2.hue) / 2;
                    const paletteTone = this.getPaletteColorForHue(midHue, palette);
                    const opacity = intensity * 0.35;
                    this.ctx.strokeStyle = `hsla(${paletteTone.h}, ${paletteTone.s * 0.6}%, ${paletteTone.l}%, ${opacity})`;
                    this.ctx.lineWidth = 0.5 + intensity * 1.2;
                    this.ctx.beginPath();
                    this.ctx.moveTo(p1.x, p1.y);
                    this.ctx.lineTo(p2.x, p2.y);
                    this.ctx.stroke();
                }
            }
        }

        // Draw Particles (Nodes)
        this.particles.forEach((p, index) => {
            const pulse = Math.sin(this.time * 2 + p.phase) * 0.5 + 1; // 0.5 to 1.5
            const coreRadius = (p.size / 2) * pulse;
            const paletteTone = this.getPaletteColorForHue(p.hue, palette);

            this.ctx.fillStyle = `hsla(${paletteTone.h}, ${paletteTone.s}%, ${paletteTone.l}%, 0.9)`;
            if (index % 3 === 0) {
                const side = coreRadius * 1.8;
                this.ctx.fillRect(p.x - side / 2, p.y - side / 2, side, side);
            } else {
                const side = coreRadius * 1.6;
                this.ctx.save();
                this.ctx.translate(p.x, p.y);
                this.ctx.rotate(Math.PI / 4);
                this.ctx.fillRect(-side / 2, -side / 2, side, side);
                this.ctx.restore();
            }

            this.ctx.strokeStyle = `hsla(${paletteTone.h}, ${paletteTone.s * 0.5}%, ${Math.max(20, paletteTone.l - 20)}%, 0.5)`;
            this.ctx.lineWidth = 0.7;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, coreRadius * 1.8, 0, Math.PI * 2);
            this.ctx.stroke();
        });
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

        for (let i = 0; i < layers; i++) {
            const baseY = spacing * (i + 1) + Math.sin(this.time * 0.2 + i) * spacing * 0.12;
            const hueSeed = (signature.primaryHue + i * 12 + (signature.hash % 30)) % 360;
            const paletteTone = this.getPaletteColorForHue(hueSeed, palette);
            const lightness = Math.min(80, paletteTone.l + i * 1.5);
            const alpha = 0.12 + (i / layers) * 0.18;

            this.ctx.strokeStyle = `hsla(${paletteTone.h}, ${paletteTone.s}%, ${lightness}%, ${alpha})`;
            this.ctx.lineWidth = 1 + i * 0.08;
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

        const markerStep = Math.max(6, Math.floor(this.particles.length / 20));
        for (let i = 0; i < this.particles.length; i += markerStep) {
            const p = this.particles[i];
            const hue = (p.hue + signature.tertiaryHue) % 360;
            this.ctx.strokeStyle = `hsla(${hue}, 40%, 40%, 0.18)`;
            this.ctx.lineWidth = 0.8;
            this.ctx.beginPath();
            this.ctx.moveTo(p.originX, 0);
            this.ctx.lineTo(p.originX, height);
            this.ctx.stroke();
        }
    }

    drawOrbit(width, height, signature) {
        const centers = this.styleState.orbitCenters || [{ x: width * 0.5, y: height * 0.5 }];
        const rings = this.styleState.orbitRings || [];
        const tightness = this.styleState.orbitTightness || 1;
        const palette = this.styleState.palette || [];

        centers.forEach((center, index) => {
            const ringList = rings[index] || [];
            ringList.forEach((radius, ringIndex) => {
                const hue = (signature.primaryHue + index * 20 + ringIndex * 15) % 360;
                const paletteTone = this.getPaletteColorForHue(hue, palette);
                this.ctx.strokeStyle = `hsla(${paletteTone.h}, ${paletteTone.s * 0.5}%, ${paletteTone.l}%, 0.2)`;
                this.ctx.lineWidth = 0.8;
                this.ctx.beginPath();
                this.ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
                this.ctx.stroke();
            });
        });

        this.particles.forEach(p => {
            const center = centers[p.orbitIndex || 0] || centers[0];
            const angle = this.time * (p.orbitSpeed || 0.002) + (p.orbitPhase || 0);
            const radius = (p.orbitRadius || 60);
            const x = center.x + Math.cos(angle) * radius;
            const y = center.y + Math.sin(angle) * radius * tightness;

            const hue = (p.hue + signature.secondaryHue) / 2;
            const paletteTone = this.getPaletteColorForHue(hue, palette);
            this.ctx.strokeStyle = `hsla(${paletteTone.h}, ${paletteTone.s * 0.6}%, ${paletteTone.l}%, 0.3)`;
            this.ctx.lineWidth = Math.max(0.6, p.size * 0.2);
            this.ctx.beginPath();
            this.ctx.moveTo(p.prevX || x, p.prevY || y);
            this.ctx.lineTo(x, y);
            this.ctx.stroke();

            const block = p.size * 0.9 + 1.2;
            this.ctx.fillStyle = `hsla(${paletteTone.h}, ${paletteTone.s}%, ${Math.min(85, paletteTone.l + 10)}%, 0.8)`;
            this.ctx.fillRect(x - block / 2, y - block / 2, block, block);

            p.prevX = x;
            p.prevY = y;
        });
    }

    drawRunes(width, height, signature) {
        const density = this.styleState.runeDensity || 1;
        const scale = this.styleState.runeScale || 1;
        const total = this.particles.length;
        const target = Math.max(8, Math.floor(total * density));
        const stride = Math.max(1, Math.floor(total / target));
        const palette = this.styleState.palette || [];

        const drawSigil = (x, y, size, seed, hue) => {
            let state = seed >>> 0;
            const rand = () => {
                state = (1664525 * state + 1013904223) >>> 0;
                return state / 4294967295;
            };
            const paletteTone = this.getPaletteColorForHue(hue, palette);

            const strokes = 3 + Math.floor(rand() * 4);
            this.ctx.strokeStyle = `hsla(${paletteTone.h}, ${paletteTone.s}%, ${paletteTone.l}%, 0.55)`;
            this.ctx.lineWidth = Math.max(0.8, size * 0.14);
            for (let i = 0; i < strokes; i++) {
                const x1 = (rand() - 0.5) * size * 1.8;
                const y1 = (rand() - 0.5) * size * 1.8;
                const x2 = (rand() - 0.5) * size * 1.8;
                const y2 = (rand() - 0.5) * size * 1.8;
                this.ctx.beginPath();
                this.ctx.moveTo(x + x1, y + y1);
                this.ctx.lineTo(x + x2, y + y2);
                this.ctx.stroke();
            }

            const stampSize = size * 0.35;
            this.ctx.fillStyle = `hsla(${paletteTone.h}, ${Math.max(15, paletteTone.s - 20)}%, ${Math.max(20, paletteTone.l - 10)}%, 0.6)`;
            this.ctx.fillRect(x - stampSize / 2, y - stampSize / 2, stampSize, stampSize);
        };

        for (let i = 0; i < total; i += stride) {
            const p = this.particles[i];
            const seed = this.hashString(p.commit?.sha || String(i)) + signature.hash;
            const angle = this.time * 0.3 + (seed % 360) * (Math.PI / 180);
            const drift = this.noise.noise(p.originX * 0.01, p.originY * 0.01 + this.time * 0.4) * 8;
            const orbit = 6 + (seed % 25);
            const x = p.originX + Math.cos(angle) * orbit + drift;
            const y = p.originY + Math.sin(angle) * orbit + drift;
            const size = (2.5 + p.size * 0.7) * scale;
            const hue = (signature.primaryHue + p.hue) % 360;

            drawSigil(x, y, size, seed, hue);
        }
    }

    drawWeave(width, height, signature) {
        const cols = this.styleState.weaveCols || 10;
        const rows = this.styleState.weaveRows || 8;
        const amplitude = this.styleState.weaveAmplitude || Math.round(height * 0.05);
        const palette = this.styleState.palette || [];
        const bandW = width / cols;
        const bandH = height / rows;

        for (let i = 0; i < cols; i++) {
            const tone = palette[i % palette.length] || { h: signature.primaryHue, s: 40, l: 40 };
            const drift = Math.sin(this.time * 0.4 + i) * amplitude * 0.15;
            this.ctx.fillStyle = `hsla(${tone.h}, ${tone.s}%, ${tone.l}%, 0.8)`;
            this.ctx.fillRect(i * bandW, drift, bandW + 1, height);
        }

        for (let j = 0; j < rows; j++) {
            const tone = palette[(j + 2) % palette.length] || { h: signature.secondaryHue, s: 35, l: 45 };
            const drift = Math.cos(this.time * 0.3 + j) * amplitude * 0.15;
            this.ctx.fillStyle = `hsla(${tone.h}, ${tone.s}%, ${tone.l}%, 0.65)`;
            this.ctx.fillRect(0, j * bandH + drift, width, bandH + 1);
        }

        for (let i = 0; i < cols; i++) {
            for (let j = 0; j < rows; j++) {
                const tone = palette[(i + j) % palette.length] || { h: signature.tertiaryHue, s: 30, l: 35 };
                const x = i * bandW;
                const y = j * bandH;
                const inset = Math.min(bandW, bandH) * 0.1;
                this.ctx.strokeStyle = `hsla(${tone.h}, ${Math.max(10, tone.s - 20)}%, ${Math.max(15, tone.l - 20)}%, 0.4)`;
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(x + inset, y + inset, bandW - inset * 2, bandH - inset * 2);
            }
        }
    }

    drawRift(width, height, signature) {
        const slices = this.styleState.riftSlices || 14;
        const jitter = this.styleState.riftJitter || 24;
        const palette = this.styleState.palette || [];
        const sliceW = width / slices;

        for (let i = 0; i < slices; i++) {
            const tone = palette[i % palette.length] || { h: signature.primaryHue, s: 40, l: 40 };
            const offset = this.noise.noise(i * 0.4, this.time * 0.3) * jitter;
            this.ctx.fillStyle = `hsla(${tone.h}, ${tone.s}%, ${tone.l}%, 0.85)`;
            this.ctx.fillRect(i * sliceW, offset, sliceW + 1, height);
        }

        const stride = Math.max(1, Math.floor(this.particles.length / 40));
        for (let i = 0; i < this.particles.length; i += stride) {
            const p = this.particles[i];
            const tone = this.getPaletteColorForHue(p.hue, palette);
            const sliceIndex = Math.max(0, Math.min(slices - 1, Math.floor(p.originX / sliceW)));
            const baseX = sliceIndex * sliceW;
            const offset = this.noise.noise(sliceIndex * 0.4, this.time * 0.3) * jitter;
            const blockW = sliceW * 0.6;
            const blockH = 6 + p.size * 1.2;
            const y = (p.originY + offset + this.time * 20) % height;
            this.ctx.fillStyle = `hsla(${tone.h}, ${tone.s}%, ${Math.min(80, tone.l + 10)}%, 0.8)`;
            this.ctx.fillRect(baseX + (sliceW - blockW) / 2, y, blockW, blockH);
        }
    }

    drawBarcode(width, height, signature) {
        const bars = this.styleState.barcodeBars || [];
        const palette = this.styleState.palette || [];
        const labelHeight = height * 0.18;
        const labelY = height * 0.7;

        bars.forEach((bar, index) => {
            const tone = bar.color || palette[index % palette.length] || { h: signature.primaryHue, s: 40, l: 40 };
            this.ctx.fillStyle = `hsla(${tone.h}, ${tone.s}%, ${tone.l}%, ${bar.alpha})`;
            this.ctx.fillRect(bar.x, 0, bar.w, height);
        });

        if (palette.length) {
            const bandTone = palette[0];
            this.ctx.fillStyle = `hsla(${bandTone.h}, ${bandTone.s * 0.5}%, ${Math.min(90, bandTone.l + 20)}%, 0.85)`;
            this.ctx.fillRect(width * 0.08, labelY, width * 0.84, labelHeight);

            const bandTone2 = palette[1] || bandTone;
            this.ctx.fillStyle = `hsla(${bandTone2.h}, ${Math.max(10, bandTone2.s - 20)}%, ${Math.max(15, bandTone2.l - 10)}%, 0.7)`;
            this.ctx.fillRect(width * 0.12, labelY + labelHeight * 0.2, width * 0.76, labelHeight * 0.6);
        }

        const step = Math.max(1, Math.floor(this.particles.length / 60));
        for (let i = 0; i < this.particles.length; i += step) {
            const p = this.particles[i];
            const tone = this.getPaletteColorForHue(p.hue, palette);
            const size = 4 + (p.size * 0.6);
            this.ctx.fillStyle = `hsla(${tone.h}, ${tone.s}%, ${Math.min(85, tone.l + 12)}%, 0.8)`;
            this.ctx.fillRect(p.originX - size / 2, (p.originY + this.time * 8) % height, size, size);
        }
    }

    drawCollage(width, height, signature) {
        const pieces = this.styleState.collagePieces || [];
        const palette = this.styleState.palette || [];

        pieces.forEach((piece, index) => {
            const drift = Math.sin(this.time * 0.4 + piece.drift) * 8;
            const x = piece.x + drift;
            const y = piece.y + Math.cos(this.time * 0.3 + piece.drift) * 6;
            const tone = piece.tone || palette[index % palette.length] || { h: signature.primaryHue, s: 40, l: 40 };

            this.ctx.save();
            this.ctx.translate(x, y);
            this.ctx.rotate(piece.rot);
            this.ctx.fillStyle = `hsla(${tone.h}, ${tone.s}%, ${tone.l}%, ${piece.alpha})`;
            if (piece.kind === 'circle') {
                this.ctx.beginPath();
                this.ctx.arc(0, 0, Math.min(piece.w, piece.h) * 0.4, 0, Math.PI * 2);
                this.ctx.fill();
            } else {
                this.ctx.fillRect(-piece.w / 2, -piece.h / 2, piece.w, piece.h);
            }
            this.ctx.restore();
        });

        const strokeTone = palette[0] || { h: signature.secondaryHue, s: 30, l: 50 };
        this.ctx.strokeStyle = `hsla(${strokeTone.h}, ${strokeTone.s * 0.5}%, ${Math.max(20, strokeTone.l - 15)}%, 0.5)`;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(width * 0.1, height * 0.12, width * 0.8, height * 0.76);
    }

    drawRadar(width, height, signature) {
        const rings = this.styleState.radarRings || [];
        const points = this.styleState.radarPoints || [];
        const palette = this.styleState.palette || [];
        const centerX = width / 2;
        const centerY = height / 2;
        const sweep = (this.time * 0.6) % (Math.PI * 2);

        rings.forEach((radius, index) => {
            const tone = palette[index % palette.length] || { h: signature.primaryHue, s: 40, l: 40 };
            this.ctx.strokeStyle = `hsla(${tone.h}, ${tone.s * 0.5}%, ${tone.l}%, 0.3)`;
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            this.ctx.stroke();
        });

        this.ctx.strokeStyle = `hsla(${signature.secondaryHue}, 40%, 50%, 0.2)`;
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(centerX, centerY);
        this.ctx.lineTo(centerX + Math.cos(sweep) * rings[rings.length - 1], centerY + Math.sin(sweep) * rings[rings.length - 1]);
        this.ctx.stroke();

        points.forEach((point) => {
            const x = centerX + Math.cos(point.angle + this.time * 0.15) * point.radius;
            const y = centerY + Math.sin(point.angle + this.time * 0.15) * point.radius;
            const delta = Math.abs(((point.angle - sweep + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
            const alpha = 0.2 + Math.max(0, 1 - delta / 1.2) * 0.6;
            this.ctx.fillStyle = `hsla(${point.tone.h}, ${point.tone.s}%, ${Math.min(85, point.tone.l + 10)}%, ${alpha})`;
            this.ctx.fillRect(x - point.size / 2, y - point.size / 2, point.size, point.size);
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
            
            if (error.message.includes('rate limit') || error.message.includes('API error')) {
                this.showStatus('Rate limit hit. Generating simulation...');
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
