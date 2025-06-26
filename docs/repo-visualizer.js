import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class RepoVisualizer {
    constructor(canvas) {
        this.canvas = canvas;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        this.controls = null;
        
        this.commits = [];
        this.particles = null;
        this.connections = null;
        this.time = 0;
        
        this.init();
    }
    
    init() {
        // Setup renderer
        this.renderer.setSize(this.canvas.width, this.canvas.height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        
        // Setup camera
        this.camera.position.set(0, 0, 50);
        
        // Setup controls
        this.controls = new OrbitControls(this.camera, this.canvas);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.autoRotate = true;
        this.controls.autoRotateSpeed = 0.5;
        
        // Add lights
        const ambientLight = new THREE.AmbientLight(0x404040);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(1, 1, 0.5);
        this.scene.add(directionalLight);
        
        // Set background
        this.scene.fog = new THREE.Fog(0x000000, 50, 100);
    }
    
    async visualizeRepository(repoData) {
        // Clear existing visualization
        this.clearScene();
        
        // Process repository data
        const { commits, languages, contributors, stats } = repoData;
        
        // Create visualization based on data type
        if (commits && commits.length > 0) {
            this.createCommitGalaxy(commits);
        }
        
        if (languages) {
            this.createLanguageCrystal(languages);
        }
        
        if (contributors && contributors.length > 0) {
            this.createContributorNetwork(contributors);
        }
        
        // Start animation
        this.animate();
    }
    
    createCommitGalaxy(commits) {
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const colors = [];
        const sizes = [];
        
        // Create spiral galaxy layout
        commits.forEach((commit, i) => {
            const angle = i * 0.1;
            const radius = Math.sqrt(i) * 2;
            const height = (i / commits.length) * 20 - 10;
            
            // Position
            positions.push(
                Math.cos(angle) * radius,
                height,
                Math.sin(angle) * radius
            );
            
            // Color based on additions/deletions
            const intensity = Math.min(commit.stats?.total || 1, 100) / 100;
            colors.push(intensity, 0.3, 1 - intensity);
            
            // Size based on impact
            sizes.push(Math.max(0.5, Math.min(3, (commit.stats?.total || 1) / 10)));
        });
        
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
        
        // Create particle material
        const material = new THREE.PointsMaterial({
            size: 1,
            sizeAttenuation: true,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            transparent: true,
            opacity: 0.8
        });
        
        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
        
        // Add connections between sequential commits
        this.createCommitConnections(positions);
    }
    
    createCommitConnections(positions) {
        const geometry = new THREE.BufferGeometry();
        const linePositions = [];
        
        for (let i = 0; i < positions.length - 3; i += 3) {
            linePositions.push(
                positions[i], positions[i + 1], positions[i + 2],
                positions[i + 3], positions[i + 4], positions[i + 5]
            );
        }
        
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
        
        const material = new THREE.LineBasicMaterial({
            color: 0x4444ff,
            transparent: true,
            opacity: 0.2,
            blending: THREE.AdditiveBlending
        });
        
        const lines = new THREE.LineSegments(geometry, material);
        this.scene.add(lines);
    }
    
    createLanguageCrystal(languages) {
        const group = new THREE.Group();
        const total = Object.values(languages).reduce((sum, val) => sum + val, 0);
        
        Object.entries(languages).forEach(([language, bytes], index) => {
            const percentage = bytes / total;
            const radius = Math.cbrt(percentage) * 10;
            
            // Create crystalline geometry
            const geometry = new THREE.IcosahedronGeometry(radius, 0);
            const material = new THREE.MeshPhysicalMaterial({
                color: this.getLanguageColor(language),
                metalness: 0.3,
                roughness: 0.4,
                transparent: true,
                opacity: 0.7,
                side: THREE.DoubleSide
            });
            
            const mesh = new THREE.Mesh(geometry, material);
            
            // Position in a circular pattern
            const angle = (index / Object.keys(languages).length) * Math.PI * 2;
            mesh.position.set(
                Math.cos(angle) * 15,
                0,
                Math.sin(angle) * 15
            );
            
            group.add(mesh);
        });
        
        group.position.y = -20;
        this.scene.add(group);
    }
    
    createContributorNetwork(contributors) {
        const group = new THREE.Group();
        
        // Create nodes for each contributor
        contributors.forEach((contributor, i) => {
            const geometry = new THREE.SphereGeometry(
                Math.log(contributor.contributions + 1) * 0.5,
                16,
                16
            );
            
            const material = new THREE.MeshPhongMaterial({
                color: new THREE.Color().setHSL(i / contributors.length, 0.7, 0.5),
                emissive: new THREE.Color().setHSL(i / contributors.length, 0.7, 0.3),
                emissiveIntensity: 0.5
            });
            
            const mesh = new THREE.Mesh(geometry, material);
            
            // Position in 3D space
            const phi = Math.acos(1 - 2 * i / contributors.length);
            const theta = Math.sqrt(contributors.length * Math.PI) * phi;
            
            mesh.position.setFromSphericalCoords(20, phi, theta);
            group.add(mesh);
        });
        
        group.position.y = 20;
        this.scene.add(group);
    }
    
    getLanguageColor(language) {
        const colors = {
            'JavaScript': 0xf7df1e,
            'TypeScript': 0x3178c6,
            'Python': 0x3776ab,
            'Java': 0x007396,
            'C++': 0x00599c,
            'C': 0x555555,
            'C#': 0x239120,
            'Go': 0x00add8,
            'Rust': 0xdea584,
            'Ruby': 0xcc342d,
            'PHP': 0x777bb4,
            'Swift': 0xfa7343,
            'Kotlin': 0xf18e33,
            'Dart': 0x0175c2,
            'HTML': 0xe34c26,
            'CSS': 0x1572b6,
            'Shell': 0x89e051,
            'Dockerfile': 0x2496ed
        };
        
        return colors[language] || 0x888888;
    }
    
    clearScene() {
        while (this.scene.children.length > 0) {
            const child = this.scene.children[0];
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => mat.dispose());
                } else {
                    child.material.dispose();
                }
            }
            this.scene.remove(child);
        }
        
        // Re-add lights
        const ambientLight = new THREE.AmbientLight(0x404040);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(1, 1, 0.5);
        this.scene.add(directionalLight);
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        this.time += 0.01;
        
        // Rotate particles
        if (this.particles) {
            this.particles.rotation.y += 0.001;
        }
        
        // Update controls
        this.controls.update();
        
        // Render
        this.renderer.render(this.scene, this.camera);
    }
    
    resize(width, height) {
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }
}