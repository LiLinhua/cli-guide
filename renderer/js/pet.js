'use strict';
/* 3D 终端脸桌宠: Three.js 程序化建模, WebGL 失败自动降级 CSS */
(function () {
  // 浏览器环境由 index.html 先加载 three.min.js (window.THREE); Node 测试用 require
  const THREE = (typeof require !== 'undefined') ? require('three') : window.THREE;

  function Pet(container) {
    this.container = container;
    this.fallback = false;
    this.onClick = null;      // 单击回调
    this.onDragStart = null;  // 拖拽开始回调 (dx,dy 由调用方管理)
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
    el.style.pointerEvents = 'none'; // 鼠标事件由容器层处理(拖拽/点击判定)
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
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    this.camera.position.set(0, 0.4, 5.2);
    this.camera.lookAt(0, 0, 0);

    this.group = new THREE.Group();
    this.scene.add(this.group);

    // 主体: 终端窗口盒子
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 1.5, 0.35),
      new THREE.MeshBasicMaterial({ color: 0x0a0f14 })
    );
    this.group.add(body);
    // 边框线
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(body.geometry),
      new THREE.LineBasicMaterial({ color: 0x00ff88 })
    );
    this.group.add(edges);

    // 屏幕: 字符流贴图
    const sCanvas = document.createElement('canvas');
    sCanvas.width = 96; sCanvas.height = 64;
    this.sCtx = sCanvas.getContext('2d');
    this._initStream();
    this.screenTex = new THREE.CanvasTexture(sCanvas);
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 1.2),
      new THREE.MeshBasicMaterial({ map: this.screenTex, transparent: true })
    );
    screen.position.z = 0.19;
    this.group.add(screen);

    // 眼睛
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
    this.eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, 0.06), eyeMat);
    this.eyeL.position.set(-0.5, 0.05, 0.2);
    this.eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, 0.06), eyeMat);
    this.eyeR.position.set(0.5, 0.05, 0.2);
    this.group.add(this.eyeL, this.eyeR);

    // traffic lights
    const dotMat = new THREE.MeshBasicMaterial({ color: 0x27c93f });
    const dotGeo = new THREE.SphereGeometry(0.07, 8, 8);
    const dots = [0xff5f56, 0xffbd2e, 0x27c93f];
    dots.forEach((c, i) => {
      const m = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: c }));
      m.position.set(-0.72 + i * 0.18, 0.72, 0.2);
      this.group.add(m);
    });

    // 辉光 sprite
    const gCanvas = document.createElement('canvas');
    gCanvas.width = gCanvas.height = 64;
    const g = gCanvas.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    grad.addColorStop(0, 'rgba(0,255,136,.5)');
    grad.addColorStop(1, 'rgba(0,255,136,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(gCanvas), transparent: true, depthWrite: false
    }));
    glow.scale.set(3.4, 2.6, 1);
    this.group.add(glow);

    // 点击惊吓
    this._shock = 0;
  };

  /* ---------- Matrix 字符流 ---------- */
  Pet.prototype._initStream = function () {
    this.cols = [];
    for (let i = 0; i < 20; i++) {
      this.cols.push({ head: Math.floor(Math.random() * 64), speed: 0.3 + Math.random() * 0.8 });
    }
    this._chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$#@%&';
  };
  Pet.prototype._drawStream = function () {
    const c = this.sCtx, w = 96, h = 64;
    c.clearRect(0, 0, w, h);
    c.font = '7px monospace';
    for (let i = 0; i < this.cols.length; i++) {
      const col = this.cols[i];
      col.head = (col.head + col.speed) % (h + 10);
      const x = i * 5;
      for (let j = 0; j < 4; j++) {
        const y = col.head - j * 7;
        if (y < 0 || y > h) continue;
        c.fillStyle = j === 0 ? '#7dffc0' : 'rgba(0,255,136,' + (0.6 - j * 0.13) + ')';
        c.fillText(this._chars[(Math.random() * this._chars.length) | 0], x, y);
      }
    }
    if (this.screenTex) this.screenTex.needsUpdate = true;
  };

  /* ---------- 动画循环 ---------- */
  Pet.prototype._loop = function (ts) {
    if (this._raf) this._raf = requestAnimationFrame(this._loop.bind(this));
    if (this.fallback) return;
    const t = ts / 1000;
    this.group.position.y = Math.sin(t * 1.2) * 0.12;          // 悬浮
    const breathe = 1 + Math.sin(t * 1.6) * 0.02;
    this.group.scale.setScalar(breathe);                        // 呼吸
    const blink = (t % 2.7) > 2.62 ? 0.12 : 1;                  // 眨眼
    this.eyeL.scale.y = blink; this.eyeR.scale.y = blink;
    if (this._shock > 0) {                                      // 点击惊吓
      this._shock -= 0.06;
      this.group.scale.setScalar(breathe * (1 + this._shock * 0.5));
    }
    this.group.rotation.y = Math.sin(t * 0.5) * 0.12;
    this._drawStream();
    this.renderer.render(this.scene, this.camera);
  };

  /* ---------- 鼠标交互: 拖拽 + 单击判定 ---------- */
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
        this._shock = 1;
        this.onClick();
      }
    });
  };

  Pet.prototype.destroy = function () {
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this.renderer) this.renderer.dispose();
  };

  if (typeof module !== 'undefined') module.exports = { Pet };
  if (typeof window !== 'undefined') { window.Pet = window.Pet || { Pet }; }
})();
