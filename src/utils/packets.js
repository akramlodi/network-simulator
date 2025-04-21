import * as THREE from 'three';
import { PROTOCOLS, CONFIG } from './scenarios.js';

// Create and manage network packets
export class PacketManager {
    constructor(scene) {
        this.scene = scene;
        this.packets = [];
        this.packetMeshes = [];
        this.packetCount = 0;
        this.lostPackets = 0;
        this.currentBandwidth = 0;
        this.currentLatency = 50; // ms
    }

    createPacket(sourceNode, targetNode, protocol = 'TCP') {
        // Get protocol properties
        const protocolInfo = PROTOCOLS[protocol];
        
        // Create packet geometry
        const geometry = new THREE.SphereGeometry(protocolInfo.size, 8, 8);
        const material = new THREE.MeshBasicMaterial({
            color: protocolInfo.color,
            transparent: true,
            opacity: 0.9
        });
        
        // Create packet mesh
        const packetMesh = new THREE.Mesh(geometry, material);
        
        // Set initial position at source node
        packetMesh.position.copy(sourceNode.position.clone());
        this.scene.add(packetMesh);
        
        // Create packet data
        const packetId = `packet-${this.packetCount++}`;
        const packet = {
            id: packetId,
            source: sourceNode,
            target: targetNode,
            protocol: protocol,
            object: packetMesh,
            position: 0, // Progress from 0 to 1
            speed: protocolInfo.speed * (Math.random() * 0.4 + 0.8), // Randomize a bit
            status: 'active', // active, lost, delivered
            color: protocolInfo.color,
            reliable: protocolInfo.reliable,
            size: 1024 * (Math.random() * 4 + 1), // Random packet size in KB
            creationTime: Date.now(),
            deliveryTime: null
        };
        
        // Add to packets array
        this.packets.push(packet);
        this.packetMeshes.push(packetMesh);
        
        // Update source node activity
        sourceNode.lastActivity = Date.now();
        
        // Log packet creation
        this.addLogEntry(`${protocol} packet sent: ${sourceNode.id} → ${targetNode.id}`, `log-${protocol.toLowerCase()}`);
        
        return packet;
    }

    updatePackets(deltaTime, nodeManager, currentLatency) {
        // Process existing packets
        for (let i = this.packets.length - 1; i >= 0; i--) {
            const packet = this.packets[i];
            
            // Skip processed packets
            if (packet.status !== 'active') continue;
            
            // Skip invalid packets (safety check)
            if (!packet.source || !packet.target || !packet.source.position || !packet.target.position) {
                console.warn('Found invalid packet with missing source/target:', packet.id);
                packet.status = 'lost';
                this.lostPackets++;
                if (packet.object) this.scene.remove(packet.object);
                continue;
            }
            
            // Move packet along path
            packet.position += packet.speed * deltaTime * 0.5;
            
            // Check if packet is lost
            if (!packet.reliable && Math.random() < (CONFIG.packetLoss / 100) * deltaTime * 2) {
                // Packet is lost
                packet.status = 'lost';
                this.lostPackets++;
                this.scene.remove(packet.object);
                
                // Log packet loss
                this.addLogEntry(`${packet.protocol} packet lost: ${packet.source.id} → ${packet.target.id}`, 'log-error');
                
                // Continue to next packet
                continue;
            }
            
            // Update packet position
            const sourcePos = packet.source.position;
            const targetPos = packet.target.position;
            
            // Calculate current position
            packet.object.position.lerpVectors(sourcePos, targetPos, packet.position);
            
            // Rest of the method as before...
        }
        
        // Remove delivered or lost packets
        this.packets = this.packets.filter(p => p.status === 'active');
        
        // Update bandwidth calculation
        this.updateBandwidth();
    }

    generateRandomTraffic(deltaTime, nodeManager, currentTopology) {
        // Check if it's time to create a new packet based on packet rate
        const packetProbability = CONFIG.packetRate * deltaTime;
        const nodes = nodeManager.nodes;
        
        if (Math.random() < packetProbability && nodes.length > 1) {
            // Select random source and target
            let sourceIndex, targetIndex;
            let retry = 0;
            
            do {
                sourceIndex = Math.floor(Math.random() * nodes.length);
                
                // Nodes with type 'client' are more likely to initiate connections
                if (nodes[sourceIndex].type !== 'client' && Math.random() < 0.7 && retry < 3) {
                    retry++;
                    continue;
                }
                
                do {
                    targetIndex = Math.floor(Math.random() * nodes.length);
                } while (targetIndex === sourceIndex);
                
                // Servers are more likely to be targets
                if (nodes[targetIndex].type !== 'server' && Math.random() < 0.6 && retry < 3) {
                    retry++;
                    continue;
                }
                
                retry++;
            } while (!this.canSendPacket(nodes[sourceIndex], nodes[targetIndex], currentTopology) && retry < 5);
            
            if (retry < 5) {
                // Select random protocol based on scenario
                const protocols = ['TCP', 'UDP', 'HTTP', 'DNS']; // Default protocols
                const protocol = protocols[Math.floor(Math.random() * protocols.length)];
                
                // Create packet
                this.createPacket(nodes[sourceIndex], nodes[targetIndex], protocol);
                
                // Pulse the source node
                nodeManager.pulseNode(nodes[sourceIndex].object);
            }
        }
    }

    canSendPacket(sourceNode, targetNode, currentTopology) {
        // For simplicity, always allow sending in this module
        // More complex routing logic would be implemented in a real simulator
        return true;
    }

    updateBandwidth() {
        // Calculate current bandwidth usage based on active packets
        let totalBandwidth = 0;
        const activePackets = this.packets.filter(p => p.status === 'active');
        
        for (const packet of activePackets) {
            totalBandwidth += packet.size / 10; // Simplistic bandwidth calculation
        }
        
        // Smooth the bandwidth changes
        this.currentBandwidth = Math.round((this.currentBandwidth * 0.8) + (totalBandwidth * 0.2));
    }

    clear() {
        // Remove all packets from the scene
        for (const packet of this.packetMeshes) {
            this.scene.remove(packet);
        }
        
        // Clear arrays
        this.packets = [];
        this.packetMeshes = [];
    }

    reset() {
        this.clear();
        this.packetCount = 0;
        this.lostPackets = 0;
        this.currentBandwidth = 0;
        this.currentLatency = 50;
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