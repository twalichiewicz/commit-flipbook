class RepoVisualizer {
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
        // Setup renderer with proper sizing
        this.updateSize();
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        
        // Setup camera
        this.camera.position.set(0, 0, 50);
        
        // Setup controls
        this.controls = new THREE.OrbitControls(this.camera, this.canvas);
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
        
        // Generate unique art signature based on repo characteristics
        const artSignature = this.generateArtSignature(repoData);
        
        // Process repository data
        const { commits, languages, contributors, stats, info } = repoData;
        
        // Create unique art style based on repo signature
        this.createUniqueArtwork(repoData, artSignature);
        
        // Start animation
        this.animate();
    }
    
    generateArtSignature(repoData) {
        const { info, languages, contributors, commits } = repoData;
        
        // Create a unique hash based on repo characteristics
        const repoName = info.full_name;
        const createdAt = new Date(info.created_at).getTime();
        const languageCount = Object.keys(languages || {}).length;
        const contributorCount = contributors ? contributors.length : 0;
        const commitCount = commits ? commits.length : 0;
        
        // Generate pseudo-random values based on repo characteristics
        const seed = this.hashCode(repoName + createdAt);
        const rng = this.createSeededRandom(seed);
        
        return {
            seed,
            rng,
            primaryHue: Math.floor(rng() * 360),
            secondaryHue: (Math.floor(rng() * 360) + 180) % 360,
            complexity: Math.min(languageCount + contributorCount / 10, 10),
            energy: Math.min(commitCount / 10, 100),
            style: ['spiral', 'crystalline', 'organic', 'geometric'][Math.floor(rng() * 4)],
            repoName,
            languageCount,
            contributorCount,
            commitCount
        };
    }
    
    hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }
    
    createSeededRandom(seed) {
        let m = 0x80000000;
        let a = 1103515245;
        let c = 12345;
        let state = seed;
        
        return function() {
            state = (a * state + c) % m;
            return state / (m - 1);
        };
    }
    
    createUniqueArtwork(repoData, signature) {
        const { commits, languages, contributors } = repoData;
        
        // Create base scene with repo-specific characteristics
        this.createBaseEnvironment(signature);
        
        // Add commits visualization
        if (commits && commits.length > 0) {
            this.createUniqueCommitVisualization(commits, signature);
        }
        
        // Add language representation
        if (languages) {
            this.createUniqueLanguageVisualization(languages, signature);
        }
        
        // Add contributor representation
        if (contributors && contributors.length > 0) {
            this.createUniqueContributorVisualization(contributors, signature);
        }
        
        // Add repo name as floating text
        this.createRepoNameDisplay(signature);
    }
    
    createBaseEnvironment(signature) {
        // Create unique background particles
        const particleCount = Math.floor(signature.complexity * 50 + 100);
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const colors = [];
        
        for (let i = 0; i < particleCount; i++) {
            // Create scattered background particles
            positions.push(
                (signature.rng() - 0.5) * 200,
                (signature.rng() - 0.5) * 200,
                (signature.rng() - 0.5) * 200
            );
            
            // Color based on repo signature
            const hue = signature.primaryHue + (signature.rng() - 0.5) * 60;
            const color = new THREE.Color().setHSL(hue / 360, 0.5, 0.7);
            colors.push(color.r, color.g, color.b);
        }
        
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        
        const material = new THREE.PointsMaterial({
            size: 0.5,
            vertexColors: true,
            transparent: true,
            opacity: 0.3
        });
        
        const particles = new THREE.Points(geometry, material);
        this.scene.add(particles);
        
        // Set unique fog color
        const fogColor = new THREE.Color().setHSL(signature.primaryHue / 360, 0.2, 0.1);
        this.scene.fog = new THREE.Fog(fogColor, 50, 150);
    }
    
    createRepoNameDisplay(signature) {
        // Create a simple text representation using geometry
        const textGroup = new THREE.Group();
        
        // Create letters as simple geometries
        const letterSpacing = 2;
        let xPos = -signature.repoName.length * letterSpacing / 2;
        
        for (let i = 0; i < Math.min(signature.repoName.length, 20); i++) {
            const char = signature.repoName[i];
            if (char !== '/' && char !== '-' && char !== '_') {
                const geometry = new THREE.BoxGeometry(0.5, 1, 0.1);
                const material = new THREE.MeshBasicMaterial({
                    color: new THREE.Color().setHSL(signature.primaryHue / 360, 0.8, 0.6),
                    transparent: true,
                    opacity: 0.7
                });
                const cube = new THREE.Mesh(geometry, material);
                cube.position.set(xPos, -30, 0);
                textGroup.add(cube);
            }
            xPos += letterSpacing;
        }
        
        this.scene.add(textGroup);
    }
    
    createUniqueCommitVisualization(commits, signature) {
        switch (signature.style) {
            case 'spiral':
                this.createSpiralCommits(commits, signature);
                break;
            case 'crystalline':
                this.createCrystallineCommits(commits, signature);
                break;
            case 'organic':
                this.createOrganicCommits(commits, signature);
                break;
            case 'geometric':
                this.createGeometricCommits(commits, signature);
                break;
        }
    }
    
    createSpiralCommits(commits, signature) {
        commits.forEach((commit, i) => {
            const angle = i * 0.2 + signature.seed * 0.001;
            const radius = Math.sqrt(i) * (signature.complexity * 0.5 + 1);
            const height = (i / commits.length) * 30 - 15;
            
            const geometry = new THREE.SphereGeometry(0.2 + signature.rng() * 0.3, 8, 6);
            const material = new THREE.MeshPhongMaterial({
                color: new THREE.Color().setHSL(
                    (signature.primaryHue + i * 10) / 360,
                    0.7,
                    0.5 + signature.rng() * 0.3
                ),
                transparent: true,
                opacity: 0.8
            });
            
            const sphere = new THREE.Mesh(geometry, material);
            sphere.position.set(
                Math.cos(angle) * radius,
                height,
                Math.sin(angle) * radius
            );
            
            this.scene.add(sphere);
        });
    }
    
    createCrystallineCommits(commits, signature) {
        commits.forEach((commit, i) => {
            const geometry = new THREE.OctahedronGeometry(0.3 + signature.rng() * 0.4, 0);
            const material = new THREE.MeshPhysicalMaterial({
                color: new THREE.Color().setHSL(signature.secondaryHue / 360, 0.6, 0.7),
                metalness: 0.3,
                roughness: 0.4,
                transparent: true,
                opacity: 0.8
            });
            
            const crystal = new THREE.Mesh(geometry, material);
            crystal.position.set(
                (signature.rng() - 0.5) * 40,
                (signature.rng() - 0.5) * 40,
                (signature.rng() - 0.5) * 40
            );
            crystal.rotation.set(
                signature.rng() * Math.PI,
                signature.rng() * Math.PI,
                signature.rng() * Math.PI
            );
            
            this.scene.add(crystal);
        });
    }
    
    createOrganicCommits(commits, signature) {
        const curve = new THREE.CatmullRomCurve3([]);
        const points = [];
        
        for (let i = 0; i < Math.min(commits.length, 20); i++) {
            points.push(new THREE.Vector3(
                Math.sin(i * 0.5) * (10 + signature.complexity),
                (i - commits.length / 2) * 2,
                Math.cos(i * 0.3) * (8 + signature.complexity)
            ));
        }
        
        if (points.length > 1) {
            curve.points = points;
            const tubeGeometry = new THREE.TubeGeometry(curve, 64, 0.5, 8, false);
            const tubeMaterial = new THREE.MeshPhongMaterial({
                color: new THREE.Color().setHSL(signature.primaryHue / 360, 0.8, 0.6)
            });
            const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
            this.scene.add(tube);
        }
    }
    
    createGeometricCommits(commits, signature) {
        for (let i = 0; i < Math.min(commits.length, 50); i++) {
            const size = 0.5 + signature.rng() * 1;
            const geometry = new THREE.BoxGeometry(size, size, size);
            const material = new THREE.MeshLambertMaterial({
                color: new THREE.Color().setHSL(
                    (signature.primaryHue + i * 5) / 360,
                    0.6,
                    0.5
                )
            });
            
            const cube = new THREE.Mesh(geometry, material);
            cube.position.set(
                (i % 10 - 5) * 3,
                Math.floor(i / 10) * 3 - 10,
                (signature.rng() - 0.5) * 10
            );
            cube.rotation.set(
                signature.rng() * Math.PI,
                signature.rng() * Math.PI,
                signature.rng() * Math.PI
            );
            
            this.scene.add(cube);
        }
    }
    
    createUniqueLanguageVisualization(languages, signature) {
        // Create language representation as colored rings or shapes
        const languageEntries = Object.entries(languages);
        const total = Object.values(languages).reduce((sum, val) => sum + val, 0);
        
        languageEntries.forEach(([language, bytes], index) => {
            const percentage = bytes / total;
            const radius = 15 + index * 2;
            const thickness = percentage * 2;
            
            const geometry = new THREE.TorusGeometry(radius, thickness, 8, 16);
            const material = new THREE.MeshPhongMaterial({
                color: this.getLanguageColor(language),
                transparent: true,
                opacity: 0.7
            });
            
            const torus = new THREE.Mesh(geometry, material);
            torus.rotation.x = Math.PI / 2;
            torus.position.y = index * 2 - languageEntries.length;
            
            this.scene.add(torus);
        });
    }
    
    createUniqueContributorVisualization(contributors, signature) {
        contributors.slice(0, 20).forEach((contributor, i) => {
            const geometry = new THREE.IcosahedronGeometry(
                Math.log(contributor.contributions + 1) * 0.3,
                0
            );
            
            const material = new THREE.MeshPhongMaterial({
                color: new THREE.Color().setHSL(
                    (signature.secondaryHue + i * 18) / 360,
                    0.7,
                    0.6
                ),
                wireframe: signature.rng() > 0.5
            });
            
            const mesh = new THREE.Mesh(geometry, material);
            
            // Position in a circle around the main visualization
            const angle = (i / contributors.length) * Math.PI * 2;
            mesh.position.set(
                Math.cos(angle) * 25,
                (signature.rng() - 0.5) * 20,
                Math.sin(angle) * 25
            );
            
            this.scene.add(mesh);
        });
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
    
    updateSize() {
        const rect = this.canvas.getBoundingClientRect();
        const width = rect.width || 800;
        const height = rect.height || 400;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height, false);
    }
    
    resize(width, height) {
        this.updateSize();
    }
}