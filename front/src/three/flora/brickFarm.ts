import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const BRICK_FARM_GLB_PATH = "/assets/stls/bick_factory.glb";
const BRICK_FARM_MAX_FOOTPRINT = 4.75;

let brickFarmModel: THREE.Object3D | null = null;
let brickFarmLoadPromise: Promise<THREE.Object3D> | null = null;

function prepareModel(model: THREE.Object3D): THREE.Object3D {
  model.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
  return model;
}

function normalizeModel(model: THREE.Object3D): THREE.Group {
  const wrapper = new THREE.Group();
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const footprint = Math.max(size.x, size.z);
  const scale = footprint > 0 ? BRICK_FARM_MAX_FOOTPRINT / footprint : 1;

  model.position.set(-center.x, -box.min.y, -center.z);
  model.scale.setScalar(scale);
  wrapper.add(model);

  wrapper.updateMatrixWorld(true);
  const normalizedBox = new THREE.Box3().setFromObject(wrapper);
  wrapper.position.y -= normalizedBox.min.y;

  return wrapper;
}

function cloneRenderableResources(model: THREE.Object3D): void {
  model.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry = mesh.geometry.clone();
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map((material) => material.clone())
      : mesh.material.clone();
  });
}

function loadBrickFarmModel(): Promise<THREE.Object3D> {
  if (brickFarmModel) return Promise.resolve(brickFarmModel);
  if (!brickFarmLoadPromise) {
    const loader = new GLTFLoader();
    brickFarmLoadPromise = loader.loadAsync(BRICK_FARM_GLB_PATH).then((gltf) => {
      brickFarmModel = prepareModel(gltf.scene);
      return brickFarmModel;
    });
  }
  return brickFarmLoadPromise;
}

function createBrickFarmModel(model: THREE.Object3D): THREE.Group {
  const instance = model.clone(true);
  cloneRenderableResources(instance);
  return normalizeModel(instance);
}

export function createBrickFarmCluster(tileId: number | string): THREE.Group {
  const cluster = new THREE.Group();

  const rotationStep =
    typeof tileId === "number"
      ? tileId
      : Array.from(tileId).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  cluster.rotation.y = ((rotationStep % 6) * Math.PI) / 3;

  if (brickFarmModel) {
    cluster.add(createBrickFarmModel(brickFarmModel));
    return cluster;
  }

  void loadBrickFarmModel()
    .then((model) => {
      if (cluster.parent) cluster.add(createBrickFarmModel(model));
    })
    .catch((error: unknown) => {
      console.error("Failed to load brick farm GLB", error);
    });

  return cluster;
}
