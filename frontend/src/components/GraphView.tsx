import React, { Suspense, useMemo, useRef, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, Line, OrbitControls, Text, Billboard } from "@react-three/drei";
import * as THREE from "three";

const NODE_COUNT = 25;
const NETWORK_SIZE = 2.8;

const LABELS = [
  "tax.pdf",
  "audit.pdf",
  "wire.pdf",
  "cash.pdf",
  "fund.pdf",
  "risk.pdf",
  "bank.pdf",
  "pay.pdf",
  "loan.pdf",
  "trade.pdf",
  "asset.pdf",
  "rev.pdf",
  "fin.pdf",
  "cap.pdf",
  "docs.pdf",
  "fy25.pdf",
  "q1.pdf",
  "inv.pdf",
  "ops.pdf",
  "sec.pdf",
];

interface Edge {
  source: number;
  target: number;
  weight: number;
}

const generateNodes = () => {
  return Array.from({ length: NODE_COUNT }, (_, i) => ({
    position: new THREE.Vector3(
      (Math.random() - 0.5) * NETWORK_SIZE,
      (Math.random() - 0.5) * NETWORK_SIZE,
      (Math.random() - 0.5) * NETWORK_SIZE,
    ),
    velocity: new THREE.Vector3(0, 0, 0),
    label: LABELS[i % LABELS.length],
  }));
};

// Generate a full weight matrix (every node connected to every other node)
const generateWeightMatrix = (nodeCount: number): number[][] => {
  const matrix: number[][] = [];
  for (let i = 0; i < nodeCount; i++) {
    matrix[i] = [];
    for (let j = 0; j < nodeCount; j++) {
      if (i === j) {
        matrix[i][j] = 0; // No self-connections
      } else {
        matrix[i][j] = Math.random(); // Random weight 0.00 - 1.00
      }
    }
  }
  return matrix;
};

// Convert weight matrix to edge list, filtering by threshold
const matrixToEdges = (matrix: number[][], threshold: number): Edge[] => {
  const edges: Edge[] = [];
  for (let i = 0; i < matrix.length; i++) {
    for (let j = i + 1; j < matrix.length; j++) {
      const weight = matrix[i][j];
      if (weight >= threshold) {
        edges.push({ source: i, target: j, weight });
      }
    }
  }
  return edges;
};

// Camera controller to adjust camera for 2D / 3D
function CameraController({ is2D }: { is2D: boolean }) {
  const { camera } = useThree();

  useEffect(() => {
    if (is2D) {
      camera.position.set(0, 6.5, 0.01);
      camera.lookAt(0, 0, 0);
    } else {
      camera.position.set(0, 0, 6.5);
      camera.lookAt(0, 0, 0);
    }
  }, [is2D, camera]);

  return null;
}

interface ForceSimulationProps {
  nodes: any[];
  edges: Edge[];
  is2D: boolean;
  selectedNodeIndex: number | null;
  onNodeClick: (index: number) => void;
}

const ForceSimulation: React.FC<ForceSimulationProps> = ({
  nodes,
  edges,
  is2D,
  selectedNodeIndex,
  onNodeClick,
}) => {
  const groupRef = useRef<THREE.Group>(null!);
  const nodesRef = useRef(nodes);
  const prevIs2DRef = useRef(is2D);
  const [, forceUpdate] = useState({});

  // When switching from 2D to 3D, add some random Y velocity to expand into 3D
  useEffect(() => {
    if (prevIs2DRef.current && !is2D) {
      // Transitioning from 2D to 3D - add vertical velocity
      nodesRef.current.forEach((node) => {
        node.velocity.y = (Math.random() - 0.5) * 0.05;
      });
    }
    prevIs2DRef.current = is2D;
  }, [is2D]);

  // Force-directed layout simulation
  useFrame(() => {
    const alpha = 0.05; // Reduced simulation strength for less bouncing
    const repulsionStrength = 0.06;
    const attractionStrength = 0.012;
    const centeringStrength = 0.0008;
    const damping = 0.92; // Increased damping for more rigidity

    const currentNodes = nodesRef.current;

    // Apply damping first
    currentNodes.forEach((node) => {
      node.velocity.multiplyScalar(damping);
    });

    // Repulsion between all nodes
    for (let i = 0; i < currentNodes.length; i++) {
      for (let j = i + 1; j < currentNodes.length; j++) {
        const nodeA = currentNodes[i];
        const nodeB = currentNodes[j];

        const delta = new THREE.Vector3().subVectors(
          nodeA.position,
          nodeB.position,
        );
        const distance = delta.length();

        if (distance > 0 && distance < 3) { // Only apply repulsion within range
          const force = (repulsionStrength / (distance * distance)) * alpha;
          delta.normalize().multiplyScalar(force);

          nodeA.velocity.add(delta);
          nodeB.velocity.sub(delta);
        }
      }
    }

    // Attraction along edges (stronger weight = closer together)
    edges.forEach((edge) => {
      const nodeA = currentNodes[edge.source];
      const nodeB = currentNodes[edge.target];

      const delta = new THREE.Vector3().subVectors(
        nodeB.position,
        nodeA.position,
      );
      const distance = delta.length();

      // Higher weight = shorter desired distance
      const desiredDistance = 0.3 + (1.0 - edge.weight) * 0.5;

      if (distance > 0) {
        const displacement = distance - desiredDistance;
        const force = displacement * attractionStrength * edge.weight * alpha;
        delta.normalize().multiplyScalar(force);

        nodeA.velocity.add(delta);
        nodeB.velocity.sub(delta);
      }
    });

    // Centering force
    const center = new THREE.Vector3(0, 0, 0);
    currentNodes.forEach((node) => {
      const delta = new THREE.Vector3().subVectors(center, node.position);
      node.velocity.add(delta.multiplyScalar(centeringStrength * alpha));
    });

    // Cap maximum velocity to prevent excessive movement
    const maxVelocity = 0.02;
    currentNodes.forEach((node) => {
      const speed = node.velocity.length();
      if (speed > maxVelocity) {
        node.velocity.normalize().multiplyScalar(maxVelocity);
      }
    });

    // Update positions
    currentNodes.forEach((node) => {
      node.position.add(node.velocity);

      // Only flatten to 2D if in 2D mode
      if (is2D) {
        node.position.y = 0;
        node.velocity.y = 0;
      }
    });

    // Force re-render to update lines
    forceUpdate({});
  });

  return (
    <group ref={groupRef} scale={1} rotation={[0.1, 0, 0]}>
      {edges.map((edge, index) => {
        const start = nodesRef.current[edge.source].position;
        const end = nodesRef.current[edge.target].position;
        
        // Visual properties based on weight (reduced thickness)
        const opacity = 0.15 + edge.weight * 0.35; // Higher weight = more opaque
        const lineWidth = 0.3 + edge.weight * 0.7; // Much thinner lines

        return (
          <Line
            key={index}
            points={[
              new THREE.Vector3(start.x, start.y, start.z),
              new THREE.Vector3(end.x, end.y, end.z)
            ]}
            color="#000000"
            transparent
            opacity={opacity}
            lineWidth={lineWidth}
          />
        );
      })}

      {nodesRef.current.map((node, index) => {
        const isSelected = selectedNodeIndex === index;
        return (
          <group key={index} position={node.position.clone()}>
            <Float speed={1.2} rotationIntensity={0.1} floatIntensity={0.3}>
              <mesh onClick={() => onNodeClick(index)} cursor="pointer">
                <sphereGeometry args={[0.035, 16, 16]} />
                <meshStandardMaterial
                  color={isSelected ? "blue" : "#000000"}
                  emissive={isSelected ? "blue" : "#000000"}
                  emissiveIntensity={2}
                />
              </mesh>
            </Float>

            <Billboard>
              <Text
                position={[0, 0.1, 0]}
                fontSize={0.06}
                color="#000000"
                anchorX="center"
                anchorY="middle"
              >
                {node.label}
              </Text>
            </Billboard>
          </group>
        );
      })}
    </group>
  );
};

interface GraphViewProps {
  is2D: boolean;
  weightMatrix?: number[][]; // Full NxN weight matrix
  threshold?: number; // Only show edges with weight >= threshold
}

const GraphView: React.FC<GraphViewProps> = ({ 
  is2D, 
  weightMatrix: customWeightMatrix,
  threshold = 0.5 // Default threshold
}) => {
  const nodes = useMemo(() => generateNodes(), []);
  const weightMatrix = useMemo(
    () => customWeightMatrix || generateWeightMatrix(NODE_COUNT),
    [customWeightMatrix],
  );
  const edges = useMemo(
    () => matrixToEdges(weightMatrix, threshold),
    [weightMatrix, threshold],
  );
  const [selectedNodeIndex, setSelectedNodeIndex] = useState<number | null>(
    null,
  );

  return (
    <Canvas
      camera={{ position: [0, 0, 6.5], fov: 42 }}
      gl={{ antialias: true, alpha: true }}
    >
      <CameraController is2D={is2D} />
      <ambientLight intensity={1.2} />
      <pointLight position={[0, 0, 5]} intensity={12} color="#ffffff" />
      <pointLight position={[-2, -2, -2]} intensity={6} color="#ffffff" />

      <Suspense fallback={null}>
        <ForceSimulation
          nodes={nodes}
          edges={edges}
          is2D={is2D}
          selectedNodeIndex={selectedNodeIndex}
          onNodeClick={setSelectedNodeIndex}
        />
      </Suspense>

      <OrbitControls
        enableZoom={true}
        enablePan={true}
        autoRotate={!is2D}
        autoRotateSpeed={0.2}
        maxPolarAngle={is2D ? 0 : Math.PI}
        minPolarAngle={is2D ? 0 : 0}
      />
    </Canvas>
  );
};

export default GraphView;