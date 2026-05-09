import { Suspense, useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { Line, OrbitControls, Text, Billboard } from "@react-three/drei";
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

		size: THREE.MathUtils.randFloat(0.035, 0.095),

		textSize: THREE.MathUtils.randFloat(0.045, 0.08),
	}));
};

export const LandingAnimation = () => {
	const groupRef = useRef<THREE.Group>(null!);

	const nodes = useMemo(() => generateNodes(), []);

	const connections: [THREE.Vector3, THREE.Vector3][] = [];

	for (let i = 0; i < nodes.length; i++) {
		for (let j = i + 1; j < nodes.length; j++) {
			const a = nodes[i].position;
			const b = nodes[j].position;

			if (a.distanceTo(b) < 1.55) {
				connections.push([a, b]);
			}
		}
	}

	return (
		<div className="w-[800px] h-[800px] -mt-24 -mr-48">
			<Canvas
				camera={{ position: [0, 0, 7], fov: 42 }}
				gl={{ antialias: true, alpha: true }}
			>
				<ambientLight intensity={1.2} />

				<pointLight
					position={[0, 0, 5]}
					intensity={12}
					color="#242f40"
				/>

				<pointLight
					position={[-2, -2, -2]}
					intensity={6}
					color="#242f40"
				/>

				<Suspense fallback={null}>
					<group ref={groupRef} scale={1} rotation={[0.1, 0, 0]}>
						{connections.map(([start, end], index) => (
							<Line
								key={index}
								points={[start, end]}
								color="#000000"
								transparent
								opacity={0.35}
								lineWidth={1}
							/>
						))}

						{nodes.map((node) => (
							<group
								key={`${node.label}-${node.position.toArray().join("-")}`}
								position={node.position}
							>
								<mesh>
									<sphereGeometry args={[node.size, 16, 16]} />
									<meshStandardMaterial
										color="#000000"
										emissive="#000000"
										emissiveIntensity={2}
									/>
								</mesh>

								<Billboard>
									<Text
										position={[0, node.size + 0.05, 0]}
										fontSize={node.textSize}
										color="rgb(0, 0, 0)"
										anchorX="center"
										anchorY="middle"
									>
										{node.label}
									</Text>
								</Billboard>
							</group>
						))}
					</group>
				</Suspense>

				<OrbitControls
					enableZoom={false}
					enableRotate={true}
					enablePan={false}
					autoRotate
					autoRotateSpeed={0.2}
				/>
			</Canvas>
		</div>
	);
};

export default LandingAnimation;