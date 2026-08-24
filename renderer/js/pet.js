'use strict';
/* 3D 骷髅头骨桌宠: Three.js 程序化建模, WebGL 失败自动降级 CSS */
(function () {
  const THREE = (typeof require !== 'undefined') ? require('three') : window.THREE;

  function Pet(container) {
    this.container = container;
    this.fallback = false;
    this.onClick = null;
    this.onDragStart = null;
    this._down = null;
    this._moved = false;
    this._bindEvents();
  }

  /* ---------- 生命周期 ---------- */
  Pet.prototype.init = function () {
    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    this.container.appendChild(canvas);
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch (e) {
      this.fallback = true;
      canvas.remove();
      this._showFallback();
      return;
    }
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setSize(150, 150, false);
    const el = this.renderer.domElement;
    el.style.cursor = 'grab';
    el.style.pointerEvents = 'none';
    this._buildScene();
    this._raf = requestAnimationFrame(this._loop.bind(this));
  };

  Pet.prototype._showFallback = function () {
    const fb = document.getElementById('pet-fallback');
    if (fb) fb.classList.remove('hidden');
  };

  /* ---------- 场景搭建 ---------- */
  Pet.prototype._buildScene = function () {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(24, 1, 0.1, 15);
    this.camera.position.set(0, 0.05, 4);
    this.camera.lookAt(0, 0, 0);

    // 灯光
    this.scene.add(new THREE.AmbientLight(0x8899cc, 1.0));
    const key = new THREE.DirectionalLight(0x00ff88, 2.2);
    key.position.set(2.5, 3.5, 4); this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x44ddff, 0.8);
    fill.position.set(-2.5, 1.5, 3); this.scene.add(fill);
    const rim = new THREE.DirectionalLight(0x00ff88, 0.8);
    rim.position.set(-2, -1.5, -3.5); this.scene.add(rim);
    const top = new THREE.DirectionalLight(0x00ffcc, 0.6);
    top.position.set(0, 5, 0); this.scene.add(top);

    this.group = new THREE.Group();
    this.group.scale.set(0.55, 0.55, 0.55);
    this.scene.add(this.group);

    // 构建光滑曲面骷髅头骨
    this._buildSkull();

    // 辉光 sprite
    const glow = this._makeGlowSprite(2.0);
    glow.position.set(0, -0.05, -2.5);
    glow.material.opacity = 0.04;
    this.scene.add(glow);

    // 粒子系统
    this._createParticles();

    // 投影
    this._createShadow();

    this._shock = 0;
    this._laserTime = 0;
  };

  /* ========== 头骨几何体 ========== */
  Pet.prototype._buildSkull = function () {
    const merged = this._mergeGeos([
      this._createSkullGeometry(48),
      this._createJawGeometry(32)
    ]);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x2a3e4c, roughness: 0.08, metalness: 0.3,
      emissive: 0x00ff88, emissiveIntensity: 0.12
    });
    this._skullMesh = new THREE.Mesh(merged, mat);
    this.group.add(this._skullMesh);

    // 微光边缘线
    const edges = new THREE.EdgesGeometry(merged);
    this.group.add(new THREE.LineSegments(
      edges, new THREE.LineBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.15 })
    ));

    // 五官
    this._addEyeHalos();
    this._addEyes();
    this._addNose();
    this._addMouth();
  };

  Pet.prototype._createSkullGeometry = function (seg) {
    const geo = new THREE.SphereGeometry(1.4, seg, Math.floor(seg * 0.75));
    const pos = geo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      if (v.y > 0) v.y *= 1.18;
      v.z *= 0.80;
      if (v.y < -0.1) v.x *= 1 - Math.min((v.y + 0.1) / 1.1, 1) * 0.15;
      // 颧骨
      if (v.y > -0.35 && v.y < 0.35 && Math.abs(v.x) > 0.35 && v.z < -0.1) {
        const d = Math.sqrt((v.y) * (v.y) + (Math.abs(v.x) - 0.75) * (Math.abs(v.x) - 0.75));
        if (d < 0.4) { const s = Math.cos(d / 0.4 * Math.PI * 0.5); v.x *= 1 + s * 0.1; v.z -= s * 0.15; }
      }
      // 眉弓
      if (v.y > 0.25 && v.y < 0.6 && Math.abs(v.x) < 0.7 && v.z < -0.2) {
        const d = Math.sqrt((v.y - 0.4) * (v.y - 0.4) + (Math.abs(v.x) - 0.3) * (Math.abs(v.x) - 0.3));
        if (d < 0.3) { v.z -= Math.cos(d / 0.3 * Math.PI * 0.5) * 0.18; }
      }
      // 眼眶凹陷
      if (v.z < -0.2) {
        const eX = Math.abs(v.x), eY = v.y - 0.20;
        if (eX < 0.55 && Math.abs(eY) < 0.5) {
          const d = Math.sqrt(eX * eX + eY * eY);
          if (d < 0.45) { v.z += Math.cos(d / 0.45 * Math.PI * 0.5) * 0.35; }
        }
      }
      // 鼻腔凹陷
      if (v.y > -0.35 && v.y < 0.02 && Math.abs(v.x) < 0.12 && v.z < -0.4) {
        const nW = 0.10 * (1 + (v.y + 0.35) / 0.37);
        if (Math.abs(v.x) < nW) { v.z += 0.18; }
      }
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  };

  Pet.prototype._createJawGeometry = function (seg) {
    const jaw = new THREE.SphereGeometry(0.9, seg, Math.floor(seg * 0.6));
    const pos = jaw.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      v.y *= 0.45; v.z *= 0.65; v.x *= 0.90;
      if (v.y < -0.05 && Math.abs(v.x) > 0.4) {
        v.x *= 1 + (Math.min(Math.abs(v.y), 0.3) / 0.3) * 0.08;
      }
      pos.setXYZ(i, v.x, v.y - 0.88, v.z);
    }
    pos.needsUpdate = true;
    jaw.computeVertexNormals();
    return jaw;
  };

  Pet.prototype._mergeGeos = function (geos) {
    const ni = geos.map(g => { const ng = g.toNonIndexed(); if (g !== ng) g.dispose(); return ng; });
    const total = ni.reduce((s, g) => s + g.attributes.position.count, 0);
    const positions = new Float32Array(total * 3), normals = new Float32Array(total * 3);
    let off = 0;
    ni.forEach(g => {
      const p = g.attributes.position, n = g.attributes.normal;
      for (let i = 0; i < p.count; i++) {
        positions[off * 3] = p.getX(i); positions[off * 3 + 1] = p.getY(i); positions[off * 3 + 2] = p.getZ(i);
        if (n) { normals[off * 3] = n.getX(i); normals[off * 3 + 1] = n.getY(i); normals[off * 3 + 2] = n.getZ(i); }
        off++;
      }
      g.dispose();
    });
    const m = new THREE.BufferGeometry();
    m.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    m.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    return m;
  };

  /* ========== 五官 ========== */
  Pet.prototype._addEyes = function () {
    const segs = 20;
    [-0.50, 0.50].forEach(x => {
      const group = new THREE.Group();
      // 辉光 (z 最浅, 在 socket 之后)
      const g = this._makeGlowSprite(0.25);
      g.position.set(x, 0.20, -1.20);
      g.material.opacity = 0.2;
      group.add(g);
      // 深黑色眶窝
      const socket = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, segs, segs),
        new THREE.MeshBasicMaterial({ color: 0x020810 })
      );
      socket.position.set(x, 0.20, -1.22);
      socket.scale.set(1, 1.2, 0.4);
      group.add(socket);
      // 白色瞳孔 (z 最深 = 世界坐标最靠前, 盖住 socket)
      const whitePupil = new THREE.Mesh(
        new THREE.SphereGeometry(0.20, segs, segs),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      whitePupil.position.set(x, 0.20, -1.30);
      whitePupil.scale.set(1, 1.2, 0.45);
      group.add(whitePupil);
      // 绿色发光瞳孔 (z 最深 = 最靠前)
      const pupil = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, segs, segs),
        new THREE.MeshBasicMaterial({ color: 0x00ff88 })
      );
      pupil.position.set(x, 0.20, -1.32);
      pupil.scale.set(1, 1.3, 0.5);
      group.add(pupil);
      // 高光点
      const glint = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      pupil.add(glint);
      glint.position.set(0.035, 0.035, 0.03);

      this.group.add(group);
      if (x < 0) { this._eyeL = group; this._pupilL = pupil; this._glintL = glint; }
      else { this._eyeR = group; this._pupilR = pupil; this._glintR = glint; }
    });
    // 激光束 (独立于眼睛组, 直接添加到主组, 避免坐标翻转问题)
    this._laserL = this._createLaserBeam(-0.50);
    this._laserR = this._createLaserBeam(0.50);
  };

  Pet.prototype._addEyeHalos = function () {
    [-0.50, 0.50].forEach(x => {
      const g = this._makeGlowSprite(0.7);
      g.position.set(x, 0.20, -1.35);
      g.material.opacity = 0.2;
      this.group.add(g);
    });
  };

  Pet.prototype._createLaserBeam = function (x) {
    const g = new THREE.Group();
    // 主光束锥体
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.15, 3.0, 12),
      new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending })
    );
    cone.rotation.x = -Math.PI / 2;
    cone.position.set(x, 0.20, -2.78);
    g.add(cone);
    // 外层光晕锥体 (更大, 更透)
    const outer = new THREE.Mesh(
      new THREE.ConeGeometry(0.30, 3.5, 12),
      new THREE.MeshBasicMaterial({ color: 0x44ffaa, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending })
    );
    outer.rotation.x = -Math.PI / 2;
    outer.position.set(x, 0.20, -3.03);
    g.add(outer);
    // 尖端发光球 (主)
    const tip = new THREE.Mesh(
      new THREE.SphereGeometry(0.20, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending })
    );
    tip.position.set(x, 0.20, -4.28);
    g.add(tip);
    // 尖端发光球 (外)
    const tipOuter = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0x44ffaa, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending })
    );
    tipOuter.position.set(x, 0.20, -4.28);
    g.add(tipOuter);
    // 尖端辉光
    const glow = this._makeGlowSprite(0.8);
    glow.position.set(x, 0.20, -4.28);
    glow.material.opacity = 0.5;
    g.add(glow);

    g.visible = false;
    this.group.add(g);
    return g;
  };

  Pet.prototype._addMouth = function () {
    const mouth = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x020810 })
    );
    mouth.position.set(0, -0.50, -1.30);
    mouth.scale.set(2.0, 0.9, 0.35);
    this.group.add(mouth);
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.26, 0.030, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.25 })
    );
    rim.position.set(0, -0.50, -1.25);
    rim.scale.set(2.0, 0.9, 1);
    rim.rotation.x = 0.1;
    this.group.add(rim);
  };

  Pet.prototype._addNose = function () {
    const shape = new THREE.Shape();
    const w = 0.12, h = 0.14;
    shape.moveTo(0, 0); shape.quadraticCurveTo(-w, -h * 0.5, -w * 0.5, -h);
    shape.quadraticCurveTo(0, -h * 1.3, w * 0.5, -h);
    shape.quadraticCurveTo(w, -h * 0.5, 0, 0);
    const nose = new THREE.Mesh(
      new THREE.ShapeGeometry(shape),
      new THREE.MeshBasicMaterial({ color: 0x061218, side: THREE.DoubleSide })
    );
    nose.position.set(0, -0.05, -1.32);
    this.group.add(nose);
    const edges = new THREE.EdgesGeometry(nose.geometry);
    this.group.add(new THREE.LineSegments(
      edges, new THREE.LineBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.5 })
    ));
  };

  Pet.prototype._createParticles = function () {
    const count = 60;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    this._partOffsets = [];
    for (let i = 0; i < count; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const r = 0.5 + Math.random() * 0.4;
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.cos(ph) * 0.8;
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th) - 0.3;
      this._partOffsets.push(Math.random() * Math.PI * 2);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this._particles = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0x00ff88, size: 0.025, transparent: true, opacity: 0.6,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    this.scene.add(this._particles);
  };

  Pet.prototype._createShadow = function () {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(0.5, 'rgba(0,0,0,0.20)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    this._shadow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(c),
      transparent: true,
      depthWrite: false,
      opacity: 0.6,
      blending: THREE.NormalBlending
    }));
    this._shadow.scale.set(0.7, 0.5, 1);
    this._shadow.position.set(0, -0.40, 0);
    this.scene.add(this._shadow);
  };

  Pet.prototype._makeGlowSprite = function (size) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, 'rgba(0,255,136,0.6)');
    g.addColorStop(1, 'rgba(0,255,136,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false
    }));
    sprite.scale.set(size, size, 1);
    return sprite;
  };

  /* ---------- 动画循环 ---------- */
  Pet.prototype._loop = function (ts) {
    if (this._raf) this._raf = requestAnimationFrame(this._loop.bind(this));
    if (this.fallback) return;
    const t = ts / 1000;

    this.group.position.y = Math.sin(t * 0.9) * 0.06;         // 悬浮
    const floatY = this.group.position.y;
    // 投影跟随悬浮
    if (this._shadow) {
      const h = floatY + 0.40;
      this._shadow.material.opacity = Math.max(0.15, 0.6 - h * 2.5);
      this._shadow.scale.setScalar(1.0 + h * 0.4);
    }
    const breathe = 1 + Math.sin(t * 1.2) * 0.012;
    this.group.scale.setScalar(breathe * 0.28);               // 呼吸+基础缩放
    this.group.rotation.y = Math.PI + Math.sin(t * 0.7) * 0.18 + Math.sin(t * 1.5) * 0.06;  // 正面朝向 + 随机左右摇头
    this.group.rotation.x = Math.sin(t * 0.5) * 0.10 + Math.sin(t * 1.2) * 0.04;  // 随机上下点头

    // 眨眼
    const blink = (t % 3.2) > 3.0 ? 0.1 : 1;
    if (this._eyeL) { this._eyeL.scale.y = blink; this._eyeR.scale.y = blink; }

    // 瞳孔环顾 + 高光跟随
    if (this._pupilL) {
      const px = Math.sin(t * 2.3) * 0.03;
      const py = 0.20 + Math.sin(t * 3.1) * 0.02;
      this._pupilL.position.x = -0.50 + px;
      this._pupilL.position.y = py;
      this._pupilR.position.x = 0.50 + Math.sin(t * 2.3 + 1) * 0.03;
      this._pupilR.position.y = 0.20 + Math.sin(t * 3.1 + 1) * 0.02;
      // 高光跟随瞳孔
      // 高光自动跟随瞳孔 (glint 是 pupil 的子元素)
    }

    // 点击惊吓
    if (this._shock > 0) {
      this._shock -= 0.06;
      this.group.scale.setScalar(breathe * 0.28 * (1 + this._shock * 0.4));
      // 惊吓时瞳孔放大
      if (this._pupilL) {
        const shockScale = 1 + this._shock * 0.3;
        this._pupilL.scale.setScalar(shockScale);
        this._pupilR.scale.setScalar(shockScale);
      }
    } else {
      if (this._pupilL) { this._pupilL.scale.setScalar(1); this._pupilR.scale.setScalar(1); }
    }

    // 粒子动画
    if (this._particles) {
      const arr = this._particles.geometry.attributes.position.array;
      for (let i = 0; i < this._partOffsets.length; i++) {
        const ph = t * 0.35 + this._partOffsets[i];
        arr[i * 3 + 1] += Math.sin(ph) * 0.002;
        arr[i * 3] += Math.cos(ph * 0.7) * 0.002;
      }
      this._particles.geometry.attributes.position.needsUpdate = true;
      this._particles.material.opacity = 0.25 + Math.sin(t * 0.7) * 0.12;
    }

    // 激光束动画
    if (this._laserTime > 0) {
      this._laserTime -= 0.025;
      // 起始充能效果 (前 0.5 秒快速从 0 到 1)
      const charge = Math.min(1, (3 - this._laserTime) / 0.3);
      const flicker = (0.2 + Math.sin(t * 40) * 0.8);
      const intensity = Math.min(this._laserTime, 1) * charge * flicker;
      [this._laserL, this._laserR].forEach(laser => {
        if (!laser) return;
        laser.visible = true;
        laser.children.forEach(child => {
          child.material.opacity = Math.max(0, intensity);
        });
        const pulse = 1 + Math.sin(t * 35) * 0.25;
        laser.scale.setScalar(pulse);
      });
    } else {
      if (this._laserL) this._laserL.visible = false;
      if (this._laserR) this._laserR.visible = false;
    }

    this.renderer.render(this.scene, this.camera);
  };

  /* ---------- 鼠标交互 ---------- */
  Pet.prototype._bindEvents = function () {
    const el = this.container;
    el.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      this._down = { x: e.screenX, y: e.screenY, t: Date.now() };
      this._moved = false;
      el.classList.add('dragging');
    });
    document.addEventListener('mousemove', (e) => {
      if (!this._down) return;
      const dx = e.screenX - this._down.x;
      const dy = e.screenY - this._down.y;
      if (Math.abs(dx) + Math.abs(dy) > 5) {
        this._moved = true;
        if (this.onDragStart) this.onDragStart(dx, dy);
        this._down = { x: e.screenX, y: e.screenY, t: this._down.t };
      }
    });
    document.addEventListener('mouseup', () => {
      if (!this._down) return;
      const wasClick = !this._moved && (Date.now() - this._down.t < 350);
      this._down = null;
      el.classList.remove('dragging');
      if (wasClick && this.onClick) {
        this.fireLaser();
        this.onClick();
      }
    });
  };

  Pet.prototype.destroy = function () {
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this.renderer) this.renderer.dispose();
  };

  Pet.prototype.setStealth = function (stealth) {
    if (this.fallback) return;
    if (stealth) {
      if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    } else {
      if (!this._raf) this._raf = requestAnimationFrame(this._loop.bind(this));
    }
  };

  Pet.prototype.fireLaser = function () {
    this._shock = 1;
    this._laserTime = 8;
  };

  if (typeof module !== 'undefined') module.exports = { Pet };
  if (typeof window !== 'undefined') { window.Pet = window.Pet || { Pet }; }
})();