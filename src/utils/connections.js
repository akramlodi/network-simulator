import * as THREE from 'three';
import { CONFIG } from './scenarios.js';

// Create and manage network connections
export class ConnectionManager {
    constructor(scene) {
        this.scene = scene;
        this.connections = [];
        this.connectionLines = [];
    }

    createConnection(sourceNode, targetNode) {
        // Create a line to represent the connection
        const points = [
            sourceNode.position.clone(),
            targetNode.position.clone()
        ];
        
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: 0x3366cc,
            transparent: true,
            opacity: 0.6,
            linewidth: 1 // Note: linewidth only works in WebGL 2
        });
        
        const line = new THREE.Line(geometry, material);
        this.scene.add(line);
        
        // Store connection data
        const connection = {
            source: sourceNode,
            target: targetNode,
            line: line,
            status: 'active', // active, congested, down
            bandwidth: 100 + Math.floor(Math.random() * 900) // kbps
        };
        
        this.connections.push(connection);
        this.connectionLines.push(line);
        
        return connection;
    }

    createConnectionsForTopology(topology, nodes) {
        switch(topology) {
            case 'mesh':
                // In mesh topology, all nodes connect to each other
                for (let i = 0; i < nodes.length; i++) {
                    for (let j = i + 1; j < nodes.length; j++) {
                        // In a true mesh, all nodes connect to all other nodes
                        // But for visualization, we'll limit connections
                        if (Math.random() < 0.7 || i === 0 || j === 0) {
                            this.createConnection(nodes[i], nodes[j]);
                        }
                    }
                }
                break;
            
            case 'star':
                // In star topology, all nodes connect to central node
                const centralNode = nodes[0];
                for (let i = 1; i < nodes.length; i++) {
                    this.createConnection(centralNode, nodes[i]);
                }
                break;
            
            case 'ring':
                // In ring topology, nodes connect to adjacent nodes
                for (let i = 0; i < nodes.length; i++) {
                    const nextIndex = (i + 1) % nodes.length;
                    this.createConnection(nodes[i], nodes[nextIndex]);
                }
                break;
            
            case 'distributed':
                // In P2P distributed, connections are more random
                // Each node connects to several others
                for (let i = 0; i < nodes.length; i++) {
                    // Number of connections per node varies
                    const connectionCount = 2 + Math.floor(Math.random() * 3);
                    
                    for (let c = 0; c < connectionCount; c++) {
                        // Find a random node that isn't this one and isn't already connected
                        let attempts = 0;
                        let connected = false;
                        
                        while (!connected && attempts < 10) {
                            const targetIndex = Math.floor(Math.random() * nodes.length);
                            
                            if (targetIndex !== i && !this.isConnected(nodes[i], nodes[targetIndex])) {
                                this.createConnection(nodes[i], nodes[targetIndex]);
                                connected = true;
                            }
                            
                            attempts++;
                        }
                    }
                }
                break;
        }
    }

    isConnected(node1, node2) {
        return this.connections.some(conn => 
            (conn.source === node1 && conn.target === node2) || 
            (conn.source === node2 && conn.target === node1)
        );
    }

    updateConnectionStatuses(packets) {
        // Update connection appearances based on traffic and status
        for (const connection of this.connections) {
            if (connection.status === 'down') {
                connection.line.material.color.set(0xff0000); // Red for down
                connection.line.material.opacity = 0.3;
            } else {
                // Count packets on this connection to determine congestion
                const connectionPackets = packets.filter(p => 
                    ((p.source === connection.source && p.target === connection.target) || 
                     (p.source === connection.target && p.target === connection.source)) && 
                    p.status === 'active'
                );
                
                if (connectionPackets.length > 5) {
                    connection.status = 'congested';
                    connection.line.material.color.set(0xff9900); // Orange for congested
                    connection.line.material.opacity = 0.8;
                } else {
                    connection.status = 'active';
                    connection.line.material.color.set(0x3366cc); // Blue for active
                    connection.line.material.opacity = 0.6;
                }
            }
        }
    }

    clear() {
        // Remove all connections from the scene
        for (const line of this.connectionLines) {
            this.scene.remove(line);
        }
        
        // Clear arrays
        this.connections = [];
        this.connectionLines = [];
    }
}