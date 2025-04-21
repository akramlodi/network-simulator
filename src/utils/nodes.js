import * as THREE from 'three';
import anime from 'animejs';
import { NODE_TYPES, CONFIG, SCENARIOS } from './scenarios.js';

// Create and manage nodes
export class NodeManager {
    constructor(scene) {
        this.scene = scene;
        this.nodes = [];
        this.nodeObjects = [];
    }

    createNode(x, y, z, nodeType, id) {
        // Create node geometry based on type
        const geometry = new THREE.SphereGeometry(nodeType.size, 16, 16);
        
        // Create glowing material for the node
        const material = new THREE.MeshStandardMaterial({
            color: nodeType.color,
            emissive: nodeType.color,
            emissiveIntensity: 0.5,
            metalness: 0.8,
            roughness: 0.2
        });
        
        const nodeMesh = new THREE.Mesh(geometry, material);
        nodeMesh.position.set(x, y, z);
        this.scene.add(nodeMesh);
        
        // Create halo effect
        const haloGeometry = new THREE.SphereGeometry(nodeType.size * 1.2, 16, 16);
        const haloMaterial = new THREE.MeshBasicMaterial({
            color: nodeType.color,
            transparent: true,
            opacity: 0.15,
            side: THREE.BackSide
        });
        
        const halo = new THREE.Mesh(haloGeometry, haloMaterial);
        nodeMesh.add(halo);
        
        // Store node data
        const node = {
            id: id,
            position: new THREE.Vector3(x, y, z),
            type: nodeType.type,
            object: nodeMesh,
            color: nodeType.color,
            packetQueue: [],
            status: 'active', // active, congested, down
            lastActivity: 0
        };
        
        this.nodes.push(node);
        this.nodeObjects.push(nodeMesh);
        
        return node;
    }

    createNodesForTopology(count, topology) {
        const gridSize = CONFIG.gridSize - 10;
        
        // Create nodes based on topology
        switch(topology) {
            case 'mesh':
                // In mesh topology, distribute nodes evenly
                for (let i = 0; i < count; i++) {
                    const angle = (i / count) * Math.PI * 2;
                    const radius = gridSize / 3;
                    const x = Math.cos(angle) * radius;
                    const z = Math.sin(angle) * radius;
                    
                    // Determine node type - routers in the center for mesh
                    let nodeType;
                    if (i === 0) {
                        // One server
                        nodeType = NODE_TYPES[1]; // server
                    } else if (i % 5 === 0) {
                        // Some routers
                        nodeType = NODE_TYPES[2]; // router
                    } else {
                        // Most are clients
                        nodeType = NODE_TYPES[0]; // client
                    }
                    
                    this.createNode(x, 0, z, nodeType, `node-${i}`);
                }
                break;
            
            case 'star':
                // Create central node (router)
                this.createNode(0, 0, 0, NODE_TYPES[2], 'central-router');
                
                // Create surrounding nodes
                for (let i = 1; i < count; i++) {
                    const angle = ((i - 1) / (count - 1)) * Math.PI * 2;
                    const radius = gridSize / 3;
                    const x = Math.cos(angle) * radius;
                    const z = Math.sin(angle) * radius;
                    
                    // In star topology, central is router, one is server, rest are clients
                    const nodeType = (i === 1) ? NODE_TYPES[1] : NODE_TYPES[0];
                    this.createNode(x, 0, z, nodeType, `node-${i}`);
                }
                break;
            
            case 'ring':
                // In ring topology, nodes form a circle
                for (let i = 0; i < count; i++) {
                    const angle = (i / count) * Math.PI * 2;
                    const radius = gridSize / 3;
                    const x = Math.cos(angle) * radius;
                    const z = Math.sin(angle) * radius;
                    
                    // Every third node is a router in ring topology
                    const nodeType = (i % 3 === 0) ? NODE_TYPES[2] : 
                                    (i === 1) ? NODE_TYPES[1] : NODE_TYPES[0];
                    this.createNode(x, 0, z, nodeType, `node-${i}`);
                }
                break;
            
            case 'distributed':
                // P2P distributed topology - more random placement
                for (let i = 0; i < count; i++) {
                    // Random position within grid
                    const angle = Math.random() * Math.PI * 2;
                    const radius = Math.random() * (gridSize / 2.5);
                    const x = Math.cos(angle) * radius;
                    const z = Math.sin(angle) * radius;
                    
                    // In P2P, nodes are more equal - mostly clients
                    const nodeType = (Math.random() < 0.2) ? 
                                    (Math.random() < 0.5 ? NODE_TYPES[1] : NODE_TYPES[2]) : 
                                    NODE_TYPES[0];
                    
                    this.createNode(x, 0, z, nodeType, `node-${i}`);
                }
                break;
        }
    }

    addRandomNode(connectionManager) {
        // Add a new node at a random position
        const gridSize = CONFIG.gridSize - 10;
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * (gridSize / 3) + (gridSize / 6);
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        
        // Random node type with higher probability for client
        const typeIndex = (Math.random() < 0.7) ? 0 : (Math.random() < 0.5 ? 1 : 2);
        const nodeType = NODE_TYPES[typeIndex];
        
        // Create the node
        const newNode = this.createNode(x, 0, z, nodeType, `node-${this.nodes.length}`);
        
        // Connect to some existing nodes
        const connectionCount = 1 + Math.floor(Math.random() * 3);
        
        // Randomly connect to existing nodes
        const shuffledNodes = [...this.nodes];
        shuffledNodes.pop(); // Remove the node we just added
        this.shuffleArray(shuffledNodes);
        
        for (let i = 0; i < connectionCount && i < shuffledNodes.length; i++) {
            connectionManager.createConnection(newNode, shuffledNodes[i]);
        }
        
        // Log node addition
        this.addLogEntry(`Added new ${nodeType.type} node: ${newNode.id}`, 'log-http');
        
        return newNode;
    }

    updateNodeStatuses(packets) {
        const now = Date.now();
        
        // Update node status based on activity and congestion
        for (const node of this.nodes) {
            // Check for recent activity
            const activityAge = now - node.lastActivity;
            
            // Update node appearance based on status
            if (node.status === 'down') {
                // Down nodes are dimmed
                node.object.material.emissiveIntensity = 0.1;
                node.object.material.opacity = 0.5;
            } else if (activityAge < 1000) {
                // Recently active nodes glow brighter
                node.object.material.emissiveIntensity = 0.8;
            } else {
                // Nodes with no recent activity return to normal
                node.object.material.emissiveIntensity = 0.5;
            }
            
            // Count active packets for this node to determine congestion
            const nodePackets = packets.filter(p => 
                (p.source === node || p.target === node) && p.status === 'active'
            );
            
            if (nodePackets.length > 10) {
                node.status = 'congested';
                node.object.material.color.set(0xff6600); // Orange for congestion
            } else if (node.status !== 'down') {
                node.status = 'active';
                node.object.material.color.set(node.color);
            }
        }
    }

    pulseNode(nodeMesh) {
        // Create a pulse effect when a node sends/receives a packet
        const originalScale = nodeMesh.scale.x;
        
        // Scale up quickly
        anime({
            targets: nodeMesh.scale,
            x: originalScale * 1.3,
            y: originalScale * 1.3,
            z: originalScale * 1.3,
            duration: 150,
            easing: 'easeOutQuad',
            complete: function() {
                // Scale back to normal
                anime({
                    targets: nodeMesh.scale,
                    x: originalScale,
                    y: originalScale,
                    z: originalScale,
                    duration: 300,
                    easing: 'easeOutElastic(1, 0.5)'
                });
            }
        });
    }

    clear() {
        // Remove all nodes from the scene
        for (const node of this.nodeObjects) {
            this.scene.remove(node);
        }
        
        // Clear arrays
        this.nodes = [];
        this.nodeObjects = [];
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
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
}