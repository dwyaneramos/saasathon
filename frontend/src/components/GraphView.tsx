import React, { Suspense, useMemo, useRef, useState, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
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

const generateNodes = () => {
  return Array.from({ length: NODE_COUNT }, (_, i) => ({
    position: new THREE.Vector3(
      (Math.random() - 0.5) * NETWORK_SIZE,
      (Math.random() - 0.5) * NETWORK_SIZE,
      (Math.random() - 0.5) * NETWORK_SIZE,
    ),
    label: LABELS[i % LABELS.length],
  }));
};

// Camera controller to adjust camera for 2D / 3D
function CameraController({ is2D }: { is2D: boolean }) {
  const { camera } = useThree();

  useEffect(() => {
    if (is2D) {
      // Camera above looking down
      camera.position.set(0, 6.5, 0.01);
      camera.lookAt(0, 0, 0);
    } else {
      // Default 3D view
      camera.position.set(0, 0, 6.5);
      camera.lookAt(0, 0, 0);
    }
  }, [is2D, camera]);

  return null;
}

interface GraphViewProps {
  is2D: boolean;
}

const GraphView: React.FC<GraphViewProps> = ({ is2D }) => {
  const groupRef = useRef<THREE.Group>(null!);
  const nodes = useMemo(() => generateNodes(), []);
  const [selectedNodeIndex, setSelectedNodeIndex] = useState<number | null>(
    null,
  );

  const connections: [THREE.Vector3, THREE.Vector3][] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i].position;
      const b = nodes[j].position;
      if (a.distanceTo(b) < 1.55) connections.push([a, b]);
    }
  }

  // Flatten node positions for 2D
  const getNodePosition = (pos: THREE.Vector3) =>
    is2D ? new THREE.Vector3(pos.x, 0, pos.z) : pos;

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
        <group ref={groupRef} scale={1} rotation={[0.1, 0, 0]}>
          {connections.map(([start, end], index) => (
            <Line
              key={index}
              points={[getNodePosition(start), getNodePosition(end)]}
              color="#000000"
              transparent
              opacity={0.35}
              lineWidth={1}
            />
          ))}

          {nodes.map((node, index) => {
            const isSelected = selectedNodeIndex === index;
            return (
              <group key={index} position={getNodePosition(node.position)}>
                <Float speed={1.2} rotationIntensity={0.1} floatIntensity={0.3}>
                  <mesh
                    onClick={() => setSelectedNodeIndex(index)}
                    cursor="pointer"
                  >
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
                    position={[0, 0.07, 0]}
                    fontSize={0.034}
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
