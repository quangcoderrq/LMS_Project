import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float, OrbitControls, useCursor, useTexture } from "@react-three/drei";
import { atom, useAtom } from "jotai";
// import { easing } from "maath"; // Not used anymore
import * as THREE from "three";
import { degToRad } from "three/src/math/MathUtils.js";

// UI state and pages (from provided sample)
const pictures = [
  "bookPage1",
  "bookPage2",
  "bookPage3",
  "bookPage4",
  "bookPage5",
  "bookPage6",
  "bookPage7",
  "bookPage8",
  "bookPage9",
];

const pageAtom = atom(0);
const pages = [
  {
    front: "book-cover",
    back: pictures[0],
  },
  ...Array.from({ length: pictures.length - 2 }, (_, i) => ({
    front: pictures[(i + 1) % pictures.length],
    back: pictures[(i + 2) % pictures.length],
  })),
  {
    front: pictures[pictures.length - 1],
    back: "book-back",
  },
];

const easingFactor = 1.5;
const easingFactorFold = 0.9;
const insideCurveStrength = 0.18;
const outsideCurveStrength = 0.05;
const turningCurveStrength = 0.09;

const PAGE_WIDTH = 1.28;
const PAGE_HEIGHT = 1.71; // 4:3 aspect ratio
const PAGE_DEPTH = 0.003;
const PAGE_SEGMENTS = 30;
const SEGMENT_WIDTH = PAGE_WIDTH / PAGE_SEGMENTS;

const pageGeometry = new THREE.BoxGeometry(
  PAGE_WIDTH,
  PAGE_HEIGHT,
  PAGE_DEPTH,
  PAGE_SEGMENTS,
  2
);

pageGeometry.translate(PAGE_WIDTH / 2, 0, 0);

const position = pageGeometry.attributes.position;
const vertex = new THREE.Vector3();
const skinIndexes = [];
const skinWeights = [];

for (let i = 0; i < position.count; i++) {
  vertex.fromBufferAttribute(position, i);
  const x = vertex.x;
  const skinIndex = Math.max(0, Math.floor(x / SEGMENT_WIDTH));
  const skinWeight = (x % SEGMENT_WIDTH) / SEGMENT_WIDTH;
  skinIndexes.push(skinIndex, skinIndex + 1, 0, 0);
  skinWeights.push(1 - skinWeight, skinWeight, 0, 0);
}

pageGeometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(skinIndexes, 4));
pageGeometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(skinWeights, 4));

const whiteColor = new THREE.Color("white");
const emissiveColor = new THREE.Color("orange");

const pageMaterials = [
  new THREE.MeshStandardMaterial({ color: whiteColor }),
  new THREE.MeshStandardMaterial({ color: "#111" }),
  new THREE.MeshStandardMaterial({ color: whiteColor }),
  new THREE.MeshStandardMaterial({ color: whiteColor }),
];

pages.forEach((page) => {
  useTexture.preload(`/textures/${page.front}.jpg`);
  useTexture.preload(`/textures/${page.back}.jpg`);
  useTexture.preload(`/textures/book-cover-roughness.jpg`);
});

const Page = ({
  number,
  front,
  back,
  page,
  opened,
  bookClosed,
  ...props
}: {
  number: number;
  front: string;
  back: string;
  page: number;
  opened: boolean;
  bookClosed: boolean;
}) => {
  const textures = useTexture([
    `/textures/${front}.jpg`,
    `/textures/${back}.jpg`,
    ...(number === 0 || number === pages.length - 1
      ? [`/textures/book-cover-roughness.jpg`]
      : []),
  ]);
  const picture = textures[0];
  const picture2 = textures[1];
  const pictureRoughness = textures[2];
  picture.colorSpace = picture2.colorSpace = THREE.SRGBColorSpace;


  const group = useRef<THREE.Group>(null);
  const turnedAt = useRef(0);
  const lastOpened = useRef(opened);

  const skinnedMeshRef = useRef<THREE.SkinnedMesh>(null);

  const manualSkinnedMesh = useMemo(() => {
    const bones = [];
    for (let i = 0; i <= PAGE_SEGMENTS; i++) {
      const bone = new THREE.Bone();
      bones.push(bone);
      if (i === 0) {
        bone.position.x = 0;
      } else {
        bone.position.x = SEGMENT_WIDTH;
      }
      if (i > 0) {
        bones[i - 1].add(bone);
      }
    }
    const skeleton = new THREE.Skeleton(bones);

    const materials = [
      ...pageMaterials,
      new THREE.MeshStandardMaterial({
        color: whiteColor,
        map: picture,
        ...(number === 0 ? { roughnessMap: pictureRoughness } : { roughness: 0.1 }),
        emissive: emissiveColor,
        emissiveIntensity: 0,
      }),
      new THREE.MeshStandardMaterial({
        color: whiteColor,
        map: picture2,
        ...(number === pages.length - 1 ? { roughnessMap: pictureRoughness } : { roughness: 0.1 }),
        emissive: emissiveColor,
        emissiveIntensity: 0,
      }),
    ];
    const mesh = new THREE.SkinnedMesh(pageGeometry, materials);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.add(skeleton.bones[0]);
    mesh.bind(skeleton);
    return mesh;
  }, [number, picture, picture2, pictureRoughness]);

  useFrame((_, delta: number) => {
    if (!skinnedMeshRef.current) return;

    const emissiveIntensity = highlighted ? 0.22 : 0;
    if (skinnedMeshRef.current && Array.isArray(skinnedMeshRef.current.material)) {
        (skinnedMeshRef.current.material[4] as THREE.MeshStandardMaterial).emissiveIntensity =
        (skinnedMeshRef.current.material[5] as THREE.MeshStandardMaterial).emissiveIntensity = THREE.MathUtils.lerp(
          (skinnedMeshRef.current.material[4] as THREE.MeshStandardMaterial).emissiveIntensity,
          emissiveIntensity,
          0.1
        );
    }

    if (lastOpened.current !== opened) {
      turnedAt.current = +new Date();
      lastOpened.current = opened;
    }


    let turningTime = Math.min(200, Date.now() - turnedAt.current) / 200;
    turningTime = Math.sin(turningTime * Math.PI);

    let targetRotation = opened ? -Math.PI / 2 : Math.PI / 2;
    if (!bookClosed) {
      targetRotation += degToRad(number * 0.8);
    }

    const bones = (skinnedMeshRef.current as THREE.SkinnedMesh).skeleton.bones;
    for (let i = 0; i < bones.length; i++) {
      const target = i === 0 ? group.current : bones[i];
      if (!target) continue;

      const insideCurveIntensity = i < 8 ? Math.sin(i * 0.2 + 0.25) : 0;
      const outsideCurveIntensity = i >= 8 ? Math.cos(i * 0.3 + 0.09) : 0;
      const turningIntensity = Math.sin(i * Math.PI * (1 / bones.length)) * turningTime;
      let rotationAngle =
        insideCurveStrength * insideCurveIntensity * targetRotation -
        outsideCurveStrength * outsideCurveIntensity * targetRotation +
        turningCurveStrength * turningIntensity * targetRotation;
      let foldRotationAngle = degToRad(Math.sign(targetRotation) * 2);
      if (bookClosed) {
        if (i === 0) {
          rotationAngle = targetRotation;
          foldRotationAngle = 0;
        } else {
          rotationAngle = 0;
          foldRotationAngle = 0;
        }
      }
      if (i === 0) {
        (target as THREE.Group).rotation.y = THREE.MathUtils.lerp((target as THREE.Group).rotation.y, rotationAngle, easingFactor * delta);
      } else {
        (target as THREE.Bone).rotation.y = THREE.MathUtils.lerp((target as THREE.Bone).rotation.y, rotationAngle, easingFactor * delta);
      }

      const foldIntensity = i > 8 ? Math.sin(i * Math.PI * (1 / bones.length) - 0.5) * turningTime : 0;
      if (i === 0) {
        (target as THREE.Group).rotation.x = THREE.MathUtils.lerp((target as THREE.Group).rotation.x, foldRotationAngle * foldIntensity, easingFactorFold * delta);
      } else {
        (target as THREE.Bone).rotation.x = THREE.MathUtils.lerp((target as THREE.Bone).rotation.x, foldRotationAngle * foldIntensity, easingFactorFold * delta);
      }
    }
  });

  const [, setPage] = useAtom(pageAtom);
  const [highlighted, setHighlighted] = useState(false);
  useCursor(highlighted);

  return (
    <group
      {...props}
      ref={group}
      onPointerEnter={(e: React.PointerEvent) => {
        e.stopPropagation();
        setHighlighted(true);
      }}
      onPointerLeave={(e: React.PointerEvent) => {
        e.stopPropagation();
        setHighlighted(false);
      }}
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        setPage(opened ? number : number + 1);
        setHighlighted(false);
      }}
    >
      <primitive object={manualSkinnedMesh} ref={skinnedMeshRef} position-z={-number * PAGE_DEPTH + page * PAGE_DEPTH} />
    </group>
  );
};

export const Book = ({ ...props }) => {
  const [page] = useAtom(pageAtom);
  const [delayedPage, setDelayedPage] = useState(page);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const goToPage = () => {
      setDelayedPage((delayedPage: number) => {
        if (page === delayedPage) {
          return delayedPage;
        } else {
          timeout = setTimeout(() => {
            goToPage();
          }, Math.abs(page - delayedPage) > 2 ? 25 : 75);
          if (page > delayedPage) return delayedPage + 1;
          if (page < delayedPage) return delayedPage - 1;
          return delayedPage;
        }
      });
    };
    goToPage();
    return () => clearTimeout(timeout);
  }, [page]);

  return (
    <group {...props} rotation-y={-Math.PI / 2}>
      {[...pages].map((pageData, index) => (
        <Page
          key={index}
          page={delayedPage}
          number={index}
          opened={delayedPage > index}
          bookClosed={delayedPage === 0 || delayedPage === pages.length}
          front={pageData.front}
          back={pageData.back}
        />
      ))}
    </group>
  );
};

export const Experience = () => {
  return (
    <>
      <Float rotation-x={-Math.PI / 4} floatIntensity={1} speed={2} rotationIntensity={2}>
        <Book />
      </Float>
      <OrbitControls />
      <Environment preset="studio" />
      <directionalLight
        position={[2, 5, 2]}
        intensity={2.5}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0001}
      />
      <mesh position-y={-1.5} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <shadowMaterial transparent opacity={0.2} />
      </mesh>
    </>
  );
};

function UI() {
  const [page, setPage] = useAtom(pageAtom);
  useEffect(() => {
    const audio = new Audio("/audios/page-flip-01a.mp3");
    audio.play();
  }, [page]);
  return (
    <div className="pointer-events-none select-none absolute inset-0 flex items-end justify-center p-4">
      <div className="pointer-events-auto flex gap-2 bg-black/30 text-white rounded-xl p-2 backdrop-blur-sm">
        {[...pages].map((_, index) => (
          <button
            key={index}
            className={`px-3 py-2 rounded-full text-sm border transition-all ${index === page ? "/90 text-black" : "bg-black/30 text-white border-transparent hover:border-white"}`}
            onClick={() => setPage(index)}
          >
            {index === 0 ? "Cover" : `Page ${index}`}
          </button>
        ))}
        <button
          className={`px-3 py-2 rounded-full text-sm border transition-all ${page === pages.length ? "/90 text-black" : "bg-black/30 text-white border-transparent hover:border-white"}`}
          onClick={() => setPage(pages.length)}
        >
          Back Cover
        </button>
      </div>
    </div>
  );
}

export default function BookViewer() {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Canvas
        shadows
        camera={{ position: [-0.5, 1, typeof window !== 'undefined' && window.innerWidth > 800 ? 4 : 9], fov: 45 }}
      >
        <group position-y={0}>
          <Suspense fallback={null}>
            <Experience />
          </Suspense>
        </group>
      </Canvas>
      <UI />
    </div>
  );
}



