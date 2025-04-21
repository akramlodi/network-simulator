// Network protocols (for visualization)
export const PROTOCOLS = {
    TCP: { color: 0x66ccff, size: 0.4, speed: 1.0, reliable: true },
    UDP: { color: 0xffcc66, size: 0.3, speed: 1.5, reliable: false },
    HTTP: { color: 0x66ff99, size: 0.5, speed: 0.9, reliable: true },
    DNS: { color: 0xff99cc, size: 0.35, speed: 1.2, reliable: false }
};

// Network Simulation Scenarios
export const SCENARIOS = {
    normal: {
        nodeCount: 8,
        packetRate: 2,
        packetLoss: 2, // percentage
        latency: 50,
        protocols: ['TCP', 'UDP', 'HTTP', 'DNS'],
        topology: 'mesh' // mesh, star, ring, tree
    },
    highload: {
        nodeCount: 12,
        packetRate: 8,
        packetLoss: 5,
        latency: 100,
        protocols: ['TCP', 'TCP', 'TCP', 'HTTP', 'HTTP'],
        topology: 'star'
    },
    failover: {
        nodeCount: 6,
        packetRate: 3,
        packetLoss: 15,
        latency: 200,
        protocols: ['TCP', 'UDP'],
        topology: 'ring'
    },
    p2p: {
        nodeCount: 16,
        packetRate: 5,
        packetLoss: 8,
        latency: 150,
        protocols: ['UDP', 'UDP', 'UDP', 'TCP'],
        topology: 'distributed'
    }
};

// Node Types
export const NODE_TYPES = [
    { type: 'client', color: 0x3399ff, size: 1.0 },
    { type: 'server', color: 0x66ff66, size: 2.0 },
    { type: 'router', color: 0xff9933, size: 1.5 }
];

// Main configuration for the simulation
export const CONFIG = {
    starfieldCount: 5000,
    bloomStrength: 1.0,
    bloomRadius: 0.5,
    bloomThreshold: 0.05,
    nodeSize: 1.0,
    routerSize: 1.5,
    serverSize: 2.0,
    connectionWidth: 0.1,
    packetSize: 0.4,
    gridSize: 30,
    packetRate: SCENARIOS.normal.packetRate,
    packetLoss: SCENARIOS.normal.packetLoss,
    latency: SCENARIOS.normal.latency,
};