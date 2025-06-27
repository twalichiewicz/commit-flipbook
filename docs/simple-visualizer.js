class SimpleVisualizer {
    constructor(canvas) {
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
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        
        this.ctx.scale(dpr, dpr);
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
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
        
        const centerX = this.canvas.clientWidth / 2;
        const centerY = this.canvas.clientHeight / 2;
        
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
        
        for (let x = 0; x < this.canvas.clientWidth; x += 5) {
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
        const cols = Math.floor(this.canvas.clientWidth / gridSize);
        const rows = Math.floor(this.canvas.clientHeight / gridSize);
        
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
        this.ctx.fillText(info.full_name, this.canvas.clientWidth / 2, 30);
    }
    
    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }
}