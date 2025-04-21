import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import anime from 'animejs';
import { createNoise3D, createNoise4D } from 'simplex-noise';

import { NodeManager } from './utils/nodes.js';
import { ConnectionManager } from './utils/connections.js';
import { PacketManager } from './utils/packets.js';
import { SCENARIOS, CONFIG } from './utils/scenarios.js';

// Main class for the network simulator
class NetworkSimulator {
    constructor() {
        // Three.js components
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.clock = null;
        this.composer = null;
        this.bloomPass = null;

        // Noise generators
        this.noise3D = null;
        this.noise4D = null;

        // Simulation state
        this.isInitialized = false;
        this.isSimulationRunning = true;
        this.currentScenario = 'normal';
        this.currentTopology = SCENARIOS[this.currentScenario].topology;

        // Managers
        this.nodeManager = null;
        this.connectionManager = null;
        this.packetManager = null;

        // Initialize
        this.init();
    }

    init() {
        let progress = 0;
        const progressBar = document.getElementById('progress');
        const loadingScreen = document.getElementById('loading');
        
        const updateProgress = (increment) => {
            progress += increment;
            progressBar.style.width = `${Math.min(100, progress)}%`;
            if (progress >= 100) {
                setTimeout(() => {
                    loadingScreen.style.opacity = '0';
                    setTimeout(() => { loadingScreen.style.display = 'none'; }, 600);
                }, 200);
            }
        };

        // Initialize basic Three.js components
        this.clock = new THREE.Clock();
        this.noise3D = createNoise3D(() => Math.random());
        this.noise4D = createNoise4D(() => Math.random());
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x000308, 0.025);
        updateProgress(5);

        this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 20, 40);
        this.camera.lookAt(0, 0, 0);
        updateProgress(5);

        const canvas = document.getElementById('webglCanvas');
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;
        updateProgress(10);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 5;
        this.controls.maxDistance = 100;
        updateProgress(5);

        // Initialize managers
        this.nodeManager = new NodeManager(this.scene);
        this.connectionManager = new ConnectionManager(this.scene);
        this.packetManager = new PacketManager(this.scene);

        // Add lighting
        this.scene.add(new THREE.AmbientLight(0x404060));
        const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.5);
        dirLight1.position.set(15, 20, 10);
        this.scene.add(dirLight1);
        const dirLight2 = new THREE.DirectionalLight(0x88aaff, 0.9);
        dirLight2.position.set(-15, -10, -15);
        this.scene.add(dirLight2);
        updateProgress(10);

        // Post-processing setup
        this.setupPostProcessing();
        updateProgress(10);
        
        // Create environment
        this.createStarfield();
        updateProgress(15);
        
        // Create network grid
        this.createNetworkGrid();
        updateProgress(10);
        
        // Initialize network scenario
        this.initializeScenario(this.currentScenario);
        updateProgress(20);

        // Event listeners
        window.addEventListener('resize', this.onWindowResize.bind(this));
        document.getElementById('toggle-simulation').addEventListener('click', this.toggleSimulation.bind(this));
        document.getElementById('add-node').addEventListener('click', this.addRandomNode.bind(this));
        document.getElementById('simulate-attack').addEventListener('click', this.simulateAttack.bind(this));
        
        document.querySelectorAll('.scenario-option').forEach(option => {
            option.addEventListener('click', (e) => {
                document.querySelectorAll('.scenario-option').forEach(o => o.classList.remove('active'));
                e.target.classList.add('active');
                const scenario = e.target.dataset.scenario;
                this.changeScenario(scenario);
            });
        });
        
        updateProgress(15);
        this.isInitialized = true;
        this.animate();
    }

    setupPostProcessing() {
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            CONFIG.bloomStrength,
            CONFIG.bloomRadius,
            CONFIG.bloomThreshold
        );
        this.composer.addPass(this.bloomPass);
    }

    createStarfield() {
        const starGeometry = new THREE.BufferGeometry();
        const starVertices = [];
        const starColors = [];
        
        for (let i = 0; i < CONFIG.starfieldCount; i++) {
            const x = THREE.MathUtils.randFloatSpread(200);
            const y = THREE.MathUtils.randFloatSpread(200);
            const z = THREE.MathUtils.randFloatSpread(200);
            starVertices.push(x, y, z);
            
            const color = new THREE.Color();
            if (Math.random() < 0.15) {
                // Some colorful stars
                color.setHSL(Math.random(), 0.7, 0.6);
            } else {
                // Most stars are blue/white
                color.setHSL(0.6, Math.random() * 0.2, 0.8 + Math.random() * 0.2);
            }
            starColors.push(color.r, color.g, color.b);
        }
        
        starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
        starGeometry.setAttribute('color', new THREE.Float32BufferAttribute(starColors, 3));
        
        const starMaterial = new THREE.PointsMaterial({
            size: 0.12,
            transparent: true,
            opacity: 0.8,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true
        });
        
        const stars = new THREE.Points(starGeometry, starMaterial);
        this.scene.add(stars);
    }

    createNetworkGrid() {
        const gridSize = CONFIG.gridSize;
        const gridDivisions = 20;
        
        // Grid helper for visual reference
        const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0x0055ff, 0x001a33);
        gridHelper.position.y = -5;
        this.scene.add(gridHelper);
        
        // Create base plane for the network
        const planeGeometry = new THREE.PlaneGeometry(gridSize, gridSize);
        const planeMaterial = new THREE.MeshBasicMaterial({
            color: 0x000a18,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide
        });
        const plane = new THREE.Mesh(planeGeometry, planeMaterial);
        plane.rotation.x = Math.PI / 2;
        plane.position.y = -5;
        this.scene.add(plane);
    }

    initializeScenario(scenarioName) {
        // Clear existing network elements
        this.clearNetwork();
        
        const scenario = SCENARIOS[scenarioName];
        CONFIG.packetRate = scenario.packetRate;
        CONFIG.packetLoss = scenario.packetLoss;
        CONFIG.latency = scenario.latency;
        this.currentTopology = scenario.topology;
        
        // Create nodes based on scenario
        this.nodeManager.createNodesForTopology(scenario.nodeCount, scenario.topology);
        
        // Create connections based on topology
        this.connectionManager.createConnectionsForTopology(scenario.topology, this.nodeManager.nodes);
        
        // Update UI
        this.updateNetworkStats();
        document.getElementById('info').innerText = `${scenarioName.charAt(0).toUpperCase() + scenarioName.slice(1)} Network - ${this.currentTopology.charAt(0).toUpperCase() + this.currentTopology.slice(1)} Topology`;
        
        // Log event
        this.addLogEntry(`Initialized ${scenarioName} scenario with ${scenario.nodeCount} nodes`, 'log-http');
    }

    clearNetwork() {
        this.nodeManager.clear();
        this.connectionManager.clear();
        this.packetManager.reset();
    }

    addRandomNode() {
        const newNode = this.nodeManager.addRandomNode(this.connectionManager);
        this.updateNetworkStats();
    }

    simulateAttack() {
        // Simulate a network attack - DDoS or similar
        this.addLogEntry('⚠️ Network attack detected!', 'log-error');
        
        // Increase packet loss and latency temporarily
        const originalPacketLoss = CONFIG.packetLoss;
        const originalLatency = CONFIG.latency;
        
        CONFIG.packetLoss *= 3;
        CONFIG.latency *= 2;
        this.packetManager.currentLatency = CONFIG.latency;
        
        // Flash the info panel red
        const infoPanel = document.getElementById('info');
        infoPanel.style.backgroundColor = 'rgba(255, 50, 50, 0.4)';
        infoPanel.textContent = 'NETWORK UNDER ATTACK - HIGH PACKET LOSS DETECTED';
        
        // Take down some connections
        const connectionCount = Math.floor(this.connectionManager.connections.length * 0.3);
        const shuffledConnections = [...this.connectionManager.connections];
        this.shuffleArray(shuffledConnections);
        
        for (let i = 0; i < connectionCount; i++) {
            if (i < shuffledConnections.length) {
                shuffledConnections[i].status = 'down';
                this.addLogEntry(`Connection failure: ${shuffledConnections[i].source.id} ⟷ ${shuffledConnections[i].target.id}`, 'log-error');
            }
        }
        
        // Take down some nodes
        const nodeCount = Math.floor(this.nodeManager.nodes.length * 0.2);
        const shuffledNodes = [...this.nodeManager.nodes];
        this.shuffleArray(shuffledNodes);
        
        for (let i = 0; i < nodeCount; i++) {
            if (i < shuffledNodes.length) {
                shuffledNodes[i].status = 'down';
                this.addLogEntry(`Node ${shuffledNodes[i].id} is down!`, 'log-error');
            }
        }
        
        // Flood the network with packets
        const burstCount = 20;
        let burstDelay = 100;
        
        const sendBurst = () => {
            for (let i = 0; i < 5; i++) {
                if (this.nodeManager.nodes.length > 1) {
                    // Get a random active source node
                    const activeNodes = this.nodeManager.nodes.filter(n => n.status !== 'down');
                    if (activeNodes.length < 2) break;
                    
                    const sourceIndex = Math.floor(Math.random() * activeNodes.length);
                    let targetIndex;
                    do {
                        targetIndex = Math.floor(Math.random() * activeNodes.length);
                    } while (targetIndex === sourceIndex);
                    
                    this.packetManager.createPacket(activeNodes[sourceIndex], activeNodes[targetIndex], 'UDP');
                }
            }
        };
        
        // Send several bursts of packets
        for (let i = 0; i < burstCount; i++) {
            setTimeout(sendBurst, i * burstDelay);
        }
        
        // Recover network after attack
        setTimeout(() => {
            // Restore original settings
            CONFIG.packetLoss = originalPacketLoss;
            CONFIG.latency = originalLatency;
            
            // Restore connections
            for (const connection of this.connectionManager.connections) {
                if (Math.random() < 0.8) { // Some connections may remain down
                    connection.status = 'active';
                }
            }
            
            // Restore nodes
            for (const node of this.nodeManager.nodes) {
                if (Math.random() < 0.9) { // Some nodes may remain down
                    node.status = 'active';
                }
            }
            
            // Restore info panel
            infoPanel.style.backgroundColor = 'rgba(25, 30, 50, 0.35)';
            infoPanel.textContent = `${this.currentScenario.charAt(0).toUpperCase() + this.currentScenario.slice(1)} Network - ${this.currentTopology.charAt(0).toUpperCase() + this.currentTopology.slice(1)} Topology`;
            
            this.addLogEntry('Network recovery initiated', 'log-http');
        }, 15000); // 15 seconds of attack
    }

    toggleSimulation() {
        this.isSimulationRunning = !this.isSimulationRunning;
        const button = document.getElementById('toggle-simulation');
        button.textContent = this.isSimulationRunning ? 'Pause Simulation' : 'Resume Simulation';
        
        if (this.isSimulationRunning) {
            this.addLogEntry('Simulation resumed', 'log-http');
        } else {
            this.addLogEntry('Simulation paused', 'log-http');
        }
    }

    changeScenario(scenario) {
        this.currentScenario = scenario;
        this.initializeScenario(scenario);
        this.addLogEntry(`Switched to ${scenario} scenario`, 'log-http');
    }

    updateNetworkStats() {
        // Update UI with current network stats
        document.getElementById('active-nodes').textContent = this.nodeManager.nodes.filter(n => n.status !== 'down').length;
        document.getElementById('packets-sent').textContent = this.packetManager.packetCount;
        document.getElementById('packet-loss').textContent = (this.packetManager.lostPackets > 0) ? 
            Math.round((this.packetManager.lostPackets / this.packetManager.packetCount) * 100) : 0;
        document.getElementById('latency').textContent = this.packetManager.currentLatency;
        document.getElementById('bandwidth').textContent = this.packetManager.currentBandwidth;
    }

    addLogEntry(message, className = '') {
        const logContainer = document.getElementById('packet-log');
        const entry = document.createElement('div');
        entry.className = `log-entry ${className}`;
        entry.textContent = message;
        
        // Add to beginning for newest-first ordering
        logContainer.insertBefore(entry, logContainer.firstChild);
        
        // Limit log entries
        while (logContainer.children.length > 20) {
            logContainer.removeChild(logContainer.lastChild);
        }
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.composer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        
        const deltaTime = this.clock.getDelta();
        this.controls.update();
        
        // Update simulation logic
        if (this.isSimulationRunning) {
            // Update existing packets
            this.packetManager.updatePackets(deltaTime, this.nodeManager, this.currentLatency);
            
            // Generate new random traffic
            this.packetManager.generateRandomTraffic(deltaTime, this.nodeManager, this.currentTopology);
            
            // Update node statuses
            this.nodeManager.updateNodeStatuses(this.packetManager.packets);
            
            // Update connection statuses
            this.connectionManager.updateConnectionStatuses(this.packetManager.packets);
            
            // Periodically update network stats
            if (Math.random() < 0.05) {
                this.updateNetworkStats();
            }
        }
        
        // Render scene
        this.composer.render(deltaTime);
    }
}

// Create and initialize the simulation
const simulation = new NetworkSimulator();