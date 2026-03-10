import React, { useRef, useMemo } from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

// ============================================
// THREE SCENE WRAPPER
// Bridge between Remotion and Three.js
// ============================================
interface ThreeSceneProps {
  children?: React.ReactNode;
  cameraPosition?: [number, number, number];
  cameraFov?: number;
  style?: React.CSSProperties;
  transparent?: boolean;
}

export const ThreeScene: React.FC<ThreeSceneProps> = ({
  children,
  cameraPosition = [0, 2, 8],
  cameraFov = 50,
  style,
  transparent = true,
}) => {
  const { width, height } = useVideoConfig();

  return (
    <ThreeCanvas
      orthographic={false}
      width={width}
      height={height}
      camera={{ position: cameraPosition, fov: cameraFov }}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        ...style,
      }}
      gl={{ alpha: transparent }}
    >
      <ambientLight intensity={0.6} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <pointLight position={[-10, -5, 5]} intensity={0.4} color="#8888ff" />
      {children}
    </ThreeCanvas>
  );
};

// ============================================
// ANIMATED CAMERA
// Camera orbit, dolly, and pan using Remotion frames
// ============================================
interface AnimatedCameraProps {
  orbitSpeed?: number;
  dollyRange?: [number, number];
  panX?: [number, number];
  panY?: [number, number];
  lookAt?: [number, number, number];
}

export const AnimatedCamera: React.FC<AnimatedCameraProps> = ({
  orbitSpeed = 0.5,
  dollyRange = [8, 5],
  panX = [0, 0],
  panY = [1.5, 2.5],
  lookAt = [0, 0, 0],
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const { camera } = useThree();

  const progress = frame / durationInFrames;
  const angle = progress * Math.PI * 2 * orbitSpeed;
  const radius = interpolate(frame, [0, durationInFrames], dollyRange, {
    extrapolateRight: "clamp",
  });

  const xOffset = interpolate(progress, [0, 1], panX, {
    extrapolateRight: "clamp",
  });
  const yOffset = interpolate(progress, [0, 1], panY, {
    extrapolateRight: "clamp",
  });

  camera.position.x = Math.sin(angle) * radius + xOffset;
  camera.position.z = Math.cos(angle) * radius;
  camera.position.y = yOffset;
  camera.lookAt(new THREE.Vector3(...lookAt));
  camera.updateProjectionMatrix();

  return null;
};

// ============================================
// FLOATING MESH
// Single animated 3D shape
// ============================================
interface FloatingMeshProps {
  geometry: "torus" | "icosahedron" | "octahedron" | "dodecahedron" | "torusKnot" | "sphere";
  position?: [number, number, number];
  color?: string;
  scale?: number;
  rotationSpeed?: number;
  driftSpeed?: number;
  driftAmplitude?: number;
  wireframe?: boolean;
  opacity?: number;
  index?: number;
}

const FloatingMesh: React.FC<FloatingMeshProps> = ({
  geometry,
  position = [0, 0, 0],
  color = "#6366f1",
  scale = 1,
  rotationSpeed = 0.015,
  driftSpeed = 0.02,
  driftAmplitude = 0.5,
  wireframe = false,
  opacity = 0.7,
  index = 0,
}) => {
  const frame = useCurrentFrame();
  const meshRef = useRef<THREE.Mesh>(null);

  // Compute transforms from frame
  const rotX = frame * rotationSpeed * (1 + index * 0.3);
  const rotY = frame * rotationSpeed * 0.7 * (1 + index * 0.2);
  const rotZ = frame * rotationSpeed * 0.5;

  const driftX = Math.sin(frame * driftSpeed + index * 2) * driftAmplitude;
  const driftY = Math.cos(frame * driftSpeed * 0.8 + index * 1.5) * driftAmplitude * 0.6;
  const driftZ = Math.sin(frame * driftSpeed * 0.6 + index * 3) * driftAmplitude * 0.4;

  const breathe = 1 + Math.sin(frame * 0.03 + index) * 0.1;

  const geometryNode = useMemo(() => {
    switch (geometry) {
      case "torus":
        return <torusGeometry args={[1, 0.4, 16, 32]} />;
      case "icosahedron":
        return <icosahedronGeometry args={[1, 0]} />;
      case "octahedron":
        return <octahedronGeometry args={[1, 0]} />;
      case "dodecahedron":
        return <dodecahedronGeometry args={[1, 0]} />;
      case "torusKnot":
        return <torusKnotGeometry args={[0.8, 0.3, 64, 16]} />;
      case "sphere":
        return <sphereGeometry args={[1, 32, 32]} />;
      default:
        return <icosahedronGeometry args={[1, 0]} />;
    }
  }, [geometry]);

  return (
    <mesh
      ref={meshRef}
      position={[
        position[0] + driftX,
        position[1] + driftY,
        position[2] + driftZ,
      ]}
      rotation={[rotX, rotY, rotZ]}
      scale={[scale * breathe, scale * breathe, scale * breathe]}
    >
      {geometryNode}
      <meshStandardMaterial
        color={color}
        wireframe={wireframe}
        transparent
        opacity={opacity}
        roughness={0.3}
        metalness={0.6}
      />
    </mesh>
  );
};

// ============================================
// FLOATING GEOMETRIES
// Multiple animated 3D shapes
// ============================================
interface FloatingGeometriesProps {
  count?: number;
  color1?: string;
  color2?: string;
  speed?: number;
  opacity?: number;
  spread?: number;
}

const GEOMETRY_TYPES: FloatingMeshProps["geometry"][] = [
  "torus",
  "icosahedron",
  "octahedron",
  "dodecahedron",
  "torusKnot",
];

export const FloatingGeometries: React.FC<FloatingGeometriesProps> = ({
  count = 5,
  color1 = "#6366f1",
  color2 = "#ec4899",
  speed = 1,
  opacity = 0.6,
  spread = 4,
}) => {
  const shapes = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2;
      const radius = 1.5 + ((i * 7) % 3);
      return {
        geometry: GEOMETRY_TYPES[i % GEOMETRY_TYPES.length],
        position: [
          Math.cos(angle) * radius * (spread / 4),
          ((i * 1.3) % 3) - 1.5,
          Math.sin(angle) * radius * (spread / 4),
        ] as [number, number, number],
        color: i % 2 === 0 ? color1 : color2,
        scale: 0.4 + ((i * 3) % 5) / 8,
        wireframe: i % 3 === 0,
        rotationSpeed: 0.01 * speed + ((i * 0.003) % 0.01),
        driftSpeed: 0.015 * speed,
        driftAmplitude: 0.3 + ((i * 0.1) % 0.4),
      };
    });
  }, [count, color1, color2, speed, spread]);

  return (
    <>
      {shapes.map((shape, i) => (
        <FloatingMesh
          key={i}
          index={i}
          geometry={shape.geometry}
          position={shape.position}
          color={shape.color}
          scale={shape.scale}
          wireframe={shape.wireframe}
          rotationSpeed={shape.rotationSpeed}
          driftSpeed={shape.driftSpeed}
          driftAmplitude={shape.driftAmplitude}
          opacity={opacity}
        />
      ))}
    </>
  );
};

export default { ThreeScene, FloatingGeometries, AnimatedCamera };
