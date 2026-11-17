import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class EmbeddingScene3D {
  constructor(containerEl, labelsOverlayEl, onSelectNode) {
    this.container = containerEl;
    this.labelsOverlay = labelsOverlayEl;
    this.onSelectNode = onSelectNode;

    this.options = {
      showVectors: true,
      showTrajectory: true,
      showAnchors: true,
      showLabels: true
    };

    this.tokenNodes = [];
    this.anchorNodes = [];
    this.selectedNode = null;
    this.neighborLinks = [];

    this.interactableMeshes = [];
    this.labelEntries = [];

    this._initScene();
    this._bindEvents();
    this._animate();
  }

  _initScene() {
    const width = this.container.clientWidth || 700;
    const height = this.container.clientHeight || 540;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x060911, 0.028);

    this.camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 150);
    this.camera.position.set(10.5, 7.5, 12.5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 38;

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.75);
    this.scene.add(ambient);

    const dirLight1 = new THREE.DirectionalLight(0x93c5fd, 1.1);
    dirLight1.position.set(10, 15, 10);
    this.scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xc084fc, 0.7);
    dirLight2.position.set(-10, -8, -10);
    this.scene.add(dirLight2);

    // Subtle 3D Grid & Axes
    const grid = new THREE.GridHelper(20, 20, 0x263552, 0x131d30);
    grid.position.y = -6.5;
    this.scene.add(grid);

    const axesGroup = new THREE.Group();
    const axisLen = 7.5;
    const makeAxis = (dir, color) => {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        dir.clone().multiplyScalar(axisLen)
      ]);
      const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.32 });
      return new THREE.Line(geo, mat);
    };
    axesGroup.add(makeAxis(new THREE.Vector3(1, 0, 0), 0xf43f5e));
    axesGroup.add(makeAxis(new THREE.Vector3(0, 1, 0), 0x10b981));
    axesGroup.add(makeAxis(new THREE.Vector3(0, 0, 1), 0x3b82f6));
    this.scene.add(axesGroup);

    // Origin core
    const originGeo = new THREE.SphereGeometry(0.12, 16, 16);
    const originMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.scene.add(new THREE.Mesh(originGeo, originMat));

    // Dynamic groups
    this.tokensGroup = new THREE.Group();
    this.anchorsGroup = new THREE.Group();
    this.vectorsGroup = new THREE.Group();
    this.trajectoryGroup = new THREE.Group();
    this.neighborsGroup = new THREE.Group();

    this.scene.add(
      this.anchorsGroup,
      this.vectorsGroup,
      this.trajectoryGroup,
      this.neighborsGroup,
      this.tokensGroup
    );

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
  }

  _bindEvents() {
    this._resizeObserver = new ResizeObserver(() => {
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      if (!w || !h) return;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });
    this._resizeObserver.observe(this.container);

    let downPos = { x: 0, y: 0 };
    this.renderer.domElement.addEventListener('pointerdown', (e) => {
      downPos = { x: e.clientX, y: e.clientY };
    });

    this.renderer.domElement.addEventListener('pointerup', (e) => {
      const dist = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
      if (dist > 5) return; // Ignore orbit drags

      const rect = this.renderer.domElement.getBoundingClientRect();
      this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hits = this.raycaster.intersectObjects(this.interactableMeshes, false);
      if (hits.length > 0) {
        const node = hits[0].object.userData.node;
        if (node && this.onSelectNode) {
          this.onSelectNode(node);
        }
      }
    });
  }

  setData(tokenNodes, anchorNodes) {
    this.tokenNodes = tokenNodes;
    this.anchorNodes = anchorNodes;
    this.selectedNode = null;
    this.neighborLinks = [];
    this._rebuildSceneObjects();
  }

  setOptions(partialOpts) {
    Object.assign(this.options, partialOpts);
    this.vectorsGroup.visible = this.options.showVectors;
    this.trajectoryGroup.visible = this.options.showTrajectory;
    this.anchorsGroup.visible = this.options.showAnchors;
    this._rebuildLabels();
  }

  selectNode(node, neighbors = []) {
    this.selectedNode = node;
    this.neighborLinks = neighbors;
    this._rebuildHighlightAndNeighbors();
    this._rebuildLabels();
  }

  resetCamera() {
    this.camera.position.set(10.5, 7.5, 12.5);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  _clearGroup(group) {
    while (group.children.length > 0) {
      const child = group.children.pop();
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
    }
  }

  _rebuildSceneObjects() {
    this._clearGroup(this.tokensGroup);
    this._clearGroup(this.anchorsGroup);
    this._clearGroup(this.vectorsGroup);
    this._clearGroup(this.trajectoryGroup);
    this._clearGroup(this.neighborsGroup);
    this.interactableMeshes = [];

    // 1. Reference Anchor Nodes
    const anchorGeo = new THREE.SphereGeometry(0.16, 16, 16);
    for (const node of this.anchorNodes) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0x64748b,
        emissive: 0x1e293b,
        transparent: true,
        opacity: 0.65,
        roughness: 0.4
      });
      const mesh = new THREE.Mesh(anchorGeo, mat);
      mesh.position.set(node.pos.x, node.pos.y, node.pos.z);
      mesh.userData.node = node;
      this.anchorsGroup.add(mesh);
      this.interactableMeshes.push(mesh);
    }

    // 2. Input Token Spheres + Origin Vectors
    const tokenGeo = new THREE.SphereGeometry(0.26, 24, 24);
    const trajectoryPoints = [];

    for (const node of this.tokenNodes) {
      const color = new THREE.Color(node.color);
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.38,
        roughness: 0.25,
        metalness: 0.15
      });
      const mesh = new THREE.Mesh(tokenGeo, mat);
      mesh.position.set(node.pos.x, node.pos.y, node.pos.z);
      mesh.userData.node = node;
      this.tokensGroup.add(mesh);
      this.interactableMeshes.push(mesh);

      trajectoryPoints.push(mesh.position.clone());

      // Origin vector line
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        mesh.position.clone()
      ]);
      const lineMat = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.28
      });
      this.vectorsGroup.add(new THREE.Line(lineGeo, lineMat));
    }

    // 3. Sequence Trajectory Path
    if (trajectoryPoints.length > 1) {
      const trajGeo = new THREE.BufferGeometry().setFromPoints(trajectoryPoints);
      const trajMat = new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.55
      });
      this.trajectoryGroup.add(new THREE.Line(trajGeo, trajMat));
    }

    this.vectorsGroup.visible = this.options.showVectors;
    this.trajectoryGroup.visible = this.options.showTrajectory;
    this.anchorsGroup.visible = this.options.showAnchors;

    this._rebuildLabels();
  }

  _rebuildHighlightAndNeighbors() {
    this._clearGroup(this.neighborsGroup);
    if (!this.selectedNode) return;

    const selPos = new THREE.Vector3(
      this.selectedNode.pos.x,
      this.selectedNode.pos.y,
      this.selectedNode.pos.z
    );

    // Glowing selection ring
    const ringGeo = new THREE.RingGeometry(0.36, 0.46, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(selPos);
    ring.lookAt(this.camera.position);
    this._selectionRing = ring;
    this.neighborsGroup.add(ring);

    // Neighbor beams
    for (const neighbor of this.neighborLinks) {
      const nPos = new THREE.Vector3(neighbor.node.pos.x, neighbor.node.pos.y, neighbor.node.pos.z);
      const geo = new THREE.BufferGeometry().setFromPoints([selPos, nPos]);
      const mat = new THREE.LineBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.85
      });
      this.neighborsGroup.add(new THREE.Line(geo, mat));
    }
  }

  _rebuildLabels() {
    this.labelsOverlay.innerHTML = '';
    this.labelEntries = [];
    if (!this.options.showLabels) return;

    const addLabel = (node, isAnchor) => {
      const el = document.createElement('div');
      const isSelected = this.selectedNode && this.selectedNode.rawText === node.rawText && this.selectedNode.index === node.index;
      el.className = `label-3d${isAnchor ? ' anchor' : ''}${isSelected ? ' selected' : ''}`;
      el.textContent = node.label;
      this.labelsOverlay.appendChild(el);
      this.labelEntries.push({
        el,
        pos: new THREE.Vector3(node.pos.x, node.pos.y, node.pos.z)
      });
    };

    if (this.options.showAnchors) {
      this.anchorNodes.forEach(n => addLabel(n, true));
    }
    this.tokenNodes.forEach(n => addLabel(n, false));
  }

  _updateLabelPositions() {
    if (!this.options.showLabels || this.labelEntries.length === 0) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    const proj = new THREE.Vector3();

    for (const entry of this.labelEntries) {
      proj.copy(entry.pos).project(this.camera);
      if (proj.z > 1) {
        entry.el.style.opacity = '0';
        continue;
      }
      const x = (proj.x * 0.5 + 0.5) * width;
      const y = (-proj.y * 0.5 + 0.5) * height;
      if (x < -20 || x > width + 20 || y < -20 || y > height + 20) {
        entry.el.style.opacity = '0';
      } else {
        entry.el.style.opacity = '1';
        entry.el.style.left = `${x}px`;
        entry.el.style.top = `${y}px`;
      }
    }
  }

  _animate() {
    requestAnimationFrame(() => this._animate());
    this.controls.update();
    if (this._selectionRing) {
      this._selectionRing.lookAt(this.camera.position);
    }
    this._updateLabelPositions();
    this.renderer.render(this.scene, this.camera);
  }
}
