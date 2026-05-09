import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Billboard, Float, Line, OrbitControls, Text } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { GraphNode } from "@/types/graph";

const NETWORK_SIZE = 2.8;

interface GraphNodeState extends GraphNode {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
}

interface Edge {
  source: number;
  target: number;
  weight: number;
}

const generateNodes = (nodeData: GraphNode[]) => {
  return nodeData.map((node) => ({
    ...node,
    position: new THREE.Vector3(
      (Math.random() - 0.5) * NETWORK_SIZE,
      (Math.random() - 0.5) * NETWORK_SIZE,
      (Math.random() - 0.5) * NETWORK_SIZE,
    ),
    velocity: new THREE.Vector3(0, 0, 0),
  }));
};

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

function CameraController({
  is2D,
  controlsRef,
}: {
  is2D: boolean;
  controlsRef: React.RefObject<any>;
}) {
  const { camera } = useThree();

  const recenter = () => {
    if (is2D) {
      camera.position.set(0, 16.5, 0.01);
    } else {
      camera.position.set(0, 0, 16.5);
    }

    camera.lookAt(0, 0, 0);

    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  };

  useEffect(() => {
    recenter();
  }, [is2D]);

  return null;
}

interface ForceSimulationProps {
  nodes: GraphNodeState[];
  edges: Edge[];
  is2D: boolean;
  selectedNodeIndex: number | null;
  onNodeClick?: (index: number) => void;
}

const ForceSimulation: React.FC<ForceSimulationProps> = ({
  nodes,
  edges,
  is2D,
  selectedNodeIndex,
  onNodeClick,
}) => {
  const nodesRef = useRef(nodes);
  const prevIs2DRef = useRef(is2D);
  const [, forceUpdate] = useState({});

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    if (prevIs2DRef.current && !is2D) {
      nodesRef.current.forEach((node) => {
        node.velocity.y = (Math.random() - 0.5) * 0.15;
      });
    }

    prevIs2DRef.current = is2D;
  }, [is2D]);

  useFrame(() => {
    const alpha = 0.05;
    const repulsionStrength = 0.06;
    const attractionStrength = 0.012;
    const centeringStrength = 0.0008;
    const damping = 0.92;
    const currentNodes = nodesRef.current;

    currentNodes.forEach((node) => {
      node.velocity.multiplyScalar(damping);
    });

    for (let i = 0; i < currentNodes.length; i++) {
      for (let j = i + 1; j < currentNodes.length; j++) {
        const nodeA = currentNodes[i];
        const nodeB = currentNodes[j];
        const delta = new THREE.Vector3().subVectors(nodeA.position, nodeB.position);
        const distance = delta.length();

        if (distance > 0 && distance < 3) {
          const force = (repulsionStrength / (distance * distance)) * alpha;
          delta.normalize().multiplyScalar(force);
          nodeA.velocity.add(delta);
          nodeB.velocity.sub(delta);
        }
      }
    }

    edges.forEach((edge) => {
      const nodeA = currentNodes[edge.source];
      const nodeB = currentNodes[edge.target];
      const delta = new THREE.Vector3().subVectors(nodeB.position, nodeA.position);
      const distance = delta.length();
      const desiredDistance = 0.3 + (1.0 - edge.weight) * 0.5;

      if (distance > 0) {
        const displacement = distance - desiredDistance;
        const force = displacement * attractionStrength * edge.weight * alpha;
        delta.normalize().multiplyScalar(force);
        nodeA.velocity.add(delta);
        nodeB.velocity.sub(delta);
      }
    });

    const center = new THREE.Vector3(0, 0, 0);
    currentNodes.forEach((node) => {
      const delta = new THREE.Vector3().subVectors(center, node.position);
      node.velocity.add(delta.multiplyScalar(centeringStrength * alpha));
    });

    const maxVelocity = 0.02;
    currentNodes.forEach((node) => {
      const speed = node.velocity.length();
      if (speed > maxVelocity) {
        node.velocity.normalize().multiplyScalar(maxVelocity);
      }
    });

    const bounds = 3;
    currentNodes.forEach((node) => {
      node.position.add(node.velocity);
      node.position.x = THREE.MathUtils.clamp(node.position.x, -bounds, bounds);
      node.position.y = THREE.MathUtils.clamp(node.position.y, -bounds, bounds);
      node.position.z = THREE.MathUtils.clamp(node.position.z, -bounds, bounds);

      if (is2D) {
        node.position.y = 0;
        node.velocity.y = 0;
      }
    });

    const totalVelocity = currentNodes.reduce((sum, node) => sum + node.velocity.length(), 0);
    if (totalVelocity < 0.001) {
      return;
    }

    forceUpdate({});
  });

  return (
    <group scale={1} rotation={[0.1, 0, 0]}>
      {edges.map((edge, index) => {
        const start = nodesRef.current[edge.source].position;
        const end = nodesRef.current[edge.target].position;
        const opacity = 0.2 + edge.weight * 0.35;
        const lineWidth = 0.35 + edge.weight * 0.65;

        return (
          <Line
            key={index}
            points={[
              new THREE.Vector3(start.x, start.y, start.z),
              new THREE.Vector3(end.x, end.y, end.z),
            ]}
            color="#111111"
            transparent
            opacity={opacity}
            lineWidth={lineWidth}
          />
        );
      })}

      {nodesRef.current.map((node, index) => {
        const isSelected = selectedNodeIndex === index;

        return (
          <group key={node.id} position={node.position.clone()}>
            <Float speed={1.2} rotationIntensity={0.1} floatIntensity={0.3}>
              <mesh onClick={() => onNodeClick?.(index)}>
                <sphereGeometry args={[isSelected ? 0.09 : 0.07, 16, 16]} />
                <meshStandardMaterial
                  color={isSelected ? "#2563eb" : "#111111"}
                  emissive={isSelected ? "#2563eb" : "#111111"}
                  emissiveIntensity={isSelected ? 2.2 : 1.4}
                />
              </mesh>
            </Float>

            <Billboard>
              <Text
                position={[0, 0.17, 0]}
                fontSize={0.09}
                color="#111111"
                anchorX="center"
                anchorY="middle"
                maxWidth={1.5}
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
  nodes?: GraphNode[];
  weightMatrix?: number[][];
  threshold?: number;
  onNodeClick?: (node: GraphNode, index: number) => void;
}

const GraphView: React.FC<GraphViewProps> = ({
  is2D,
  nodes: graphNodes = [],
  weightMatrix = [],
  threshold = 0.16,
  onNodeClick,
}) => {
  const nodes = useMemo(() => generateNodes(graphNodes), [graphNodes]);
  const edges = useMemo(() => matrixToEdges(weightMatrix, threshold), [weightMatrix, threshold]);
  const [selectedNodeIndex, setSelectedNodeIndex] = useState<number | null>(null);
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    setSelectedNodeIndex(null);
  }, [graphNodes]);

  const handleNodeClick = (index: number) => {
    setSelectedNodeIndex(index);
    const node = graphNodes[index];
    if (node) {
      onNodeClick?.(node, index);
    }
  };

  return (
    <Canvas camera={{ position: [0, 0, 6.5], fov: 42 }} gl={{ antialias: true, alpha: true }}>
      <CameraController is2D={is2D} controlsRef={controlsRef} />
      <ambientLight intensity={1.2} />
      <pointLight position={[0, 0, 5]} intensity={12} color="#ffffff" />
      <pointLight position={[-2, -2, -2]} intensity={6} color="#ffffff" />

      <Suspense fallback={null}>
        <ForceSimulation
          nodes={nodes}
          edges={edges}
          is2D={is2D}
          selectedNodeIndex={selectedNodeIndex}
          onNodeClick={handleNodeClick}
        />
      </Suspense>

      <OrbitControls
        ref={controlsRef}
        enableZoom
        enablePan
        autoRotate={!is2D}
        autoRotateSpeed={0.2}
        maxPolarAngle={is2D ? 0 : Math.PI}
        minPolarAngle={is2D ? 0 : 0}
        minDistance={3}
        maxDistance={10}
        enableDamping
        dampingFactor={0.08}
      />
    </Canvas>
  );
};

export default GraphView;
