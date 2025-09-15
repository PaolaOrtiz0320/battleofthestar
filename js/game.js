// ====== Obtiene el elemento <canvas> del DOM por su id ======
const canvas = document.getElementById("gameCanvas");
// ====== Pide el “contexto” 2D para poder dibujar en el canvas ======
const ctx = canvas.getContext("2d");

// ====== Hace que el canvas ocupe todo el ancho de la ventana ======
canvas.width = window.innerWidth;
// ====== Hace que el canvas ocupe todo el alto de la ventana ======
canvas.height = window.innerHeight;

// ====== Variables de estado básicas del juego ======
let nivel = 1, vidas = 5, score = 0;
const nivelFinal = 10;
let enemigos = [], powerups = [], estrellas = [], explosiones = []; // 🔹 explosiones nuevas
let nave;
let gameRunning = false;
let boostActive = false;
let boostTimer = 0;
let menuVisible = false;
let paused = false;

// ====== Carga de imágenes (sprites) ======
const naveImg = new Image(); naveImg.src = "assets/xwing.png";
const enemigoImg = new Image(); enemigoImg.src = "assets/tie.png";
const powerupImg = new Image(); powerupImg.src = "assets/holocron.png";

// ====== Genera estrellas iniciales ======
for (let i = 0; i < 150; i++) {
  estrellas.push({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    size: Math.random() * 2,
    speed: 0.3 + Math.random() * 0.7
  });
}
// ====== Dibuja el campo de estrellas en movimiento ======
function drawStars() {
  ctx.fillStyle = "white";
  estrellas.forEach(s => {
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fill();
    s.y += s.speed;
    if (s.y > canvas.height) {
      s.y = 0;
      s.x = Math.random() * canvas.width;
    }
  });
}

// ===================== CLASES =====================
class Nave {
  constructor() {
    this.width = 70; this.height = 90;
    this.x = canvas.width / 2;
    this.y = canvas.height - 100;
    this.speed = 12;
  }
  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.PI);            // rota 180° para que apunte hacia arriba
    ctx.drawImage(naveImg, -this.width / 2, -this.height / 2, this.width, this.height);
    ctx.restore();

    // 🔹 Efecto de cola azul cuando hay boost
    if (boostActive) {
      const grad = ctx.createLinearGradient(this.x, this.y, this.x, this.y + 80);
      grad.addColorStop(0, "rgba(0,204,255,0.7)");
      grad.addColorStop(1, "rgba(0,0,255,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(this.x - 15, this.y + 20);
      ctx.lineTo(this.x + 15, this.y + 20);
      ctx.lineTo(this.x, this.y + 80);
      ctx.closePath();
      ctx.fill();
    }
  }
  // 🔹 Movimiento en 4 direcciones
  move(dir) {
    // cuando hay boost la nave avanza más rápido (tipo Subway Surfers)
    let currentSpeed = boostActive ? this.speed * 2.5 : this.speed;
    if (dir === "left" && this.x > 40) this.x -= currentSpeed;
    if (dir === "right" && this.x < canvas.width - 40) this.x += currentSpeed;
    if (dir === "up" && this.y > 60) this.y -= currentSpeed;
    if (dir === "down" && this.y < canvas.height - 60) this.y += currentSpeed;
  }
}

// ====== Clase de Enemigo ======
class Enemigo {
  constructor() {
    this.width = 50; this.height = 50;
    this.x = Math.random() * (canvas.width - this.width);
    this.y = -this.height;
    this.speed = 1.5 + nivel * 0.3;
    this.dx = (Math.random() < 0.5 ? -1 : 1) * this.speed;
    this.dy = this.speed;
    this.hit = false;
    this.hitColor = "red";
  }
  draw() {
    ctx.shadowColor = this.hit ? this.hitColor : "red";
    ctx.shadowBlur = this.hit ? 40 : 20;
    ctx.drawImage(enemigoImg, this.x, this.y, this.width, this.height);
    ctx.shadowBlur = 0;
  }
  update() {
    this.x += this.dx; this.y += this.dy;
    if (this.x < 0 || this.x + this.width > canvas.width) this.dx *= -1;
    if (this.y > canvas.height) this.remove = true;
    this.draw();
  }
  hitEffect(color = "white") {
    this.hit = true;
    this.hitColor = color;
    setTimeout(() => { this.hit = false; }, 200);
  }
}

// ====== Clase de PowerUp ======
class PowerUp {
  constructor() {
    this.width = 35; this.height = 35;
    this.x = Math.random() * (canvas.width - this.width);
    this.y = -this.height; this.speed = 2;
    this.hit = false;
  }
  draw() {
    ctx.shadowColor = this.hit ? "cyan" : "blue";
    ctx.shadowBlur = this.hit ? 40 : 15;
    ctx.drawImage(powerupImg, this.x, this.y, this.width, this.height);
    ctx.shadowBlur = 0;
  }
  update() { this.y += this.speed; this.draw(); }
  hitEffect() {
    this.hit = true;
    setTimeout(() => { this.hit = false; }, 200);
  }
}

// ====== Clase Explosión (efecto visual al chocar o recoger) ======
class Explosion {
  constructor(x, y, color1 = "yellow", color2 = "orange", color3 = "red") {
    this.x = x;
    this.y = y;
    this.radius = 10;
    this.maxRadius = 60;
    this.alpha = 1;
    this.color1 = color1;
    this.color2 = color2;
    this.color3 = color3;
  }
  update() {
    this.radius += 5;   // el círculo crece
    this.alpha -= 0.08; // se desvanece
  }
  draw() {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    const grad = ctx.createRadialGradient(
      this.x, this.y, this.radius * 0.2,
      this.x, this.y, this.radius
    );
    grad.addColorStop(0, this.color1);
    grad.addColorStop(0.3, this.color2);
    grad.addColorStop(1, this.color3);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  finished() {
    return this.alpha <= 0;
  }
}

// ===================== COLISIONES =====================
// Colisión rectángulo-rectángulo (AABB: axis-aligned bounding box)
function colisionRectRect(a, b) {
  return (a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y);
}

// Rebote entre dos enemigos
function rebotar(e1, e2) {
  // intercambio de velocidades → simula rebote
  let tempDx = e1.dx; e1.dx = e2.dx; e2.dx = tempDx;
  let tempDy = e1.dy; e1.dy = e2.dy; e2.dy = tempDy;
  e1.hitEffect("white");
  e2.hitEffect("white");
}

// Empuje para separarlos si se enciman demasiado
function separar(obj1, obj2) {
  const dx = obj1.x - obj2.x;
  const dy = obj1.y - obj2.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 50) {
    const angle = Math.atan2(dy, dx); // calcula ángulo de la línea entre ambos
    const fuerza = 10;                // cuánto se empujan
    obj1.x += Math.cos(angle) * fuerza;
    obj1.y += Math.sin(angle) * fuerza;
    obj2.x -= Math.cos(angle) * fuerza;
    obj2.y -= Math.sin(angle) * fuerza;
  }
}

// ===================== HUD =====================
function updateHUD() {
  if (!gameRunning) {
    document.getElementById("hud").classList.add("hidden");
    return;
  }
  document.getElementById("hud").classList.remove("hidden");
  document.getElementById("nivel").textContent = "Nivel: " + nivel;
  document.getElementById("vidas").textContent = "Vidas: " + vidas;
  document.getElementById("score").textContent = "Puntaje: " + score;
}

// ===================== LOOP PRINCIPAL =====================
function gameLoop() {
  if (!gameRunning || paused) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawStars();
  nave.draw();

  // 🔹 Dibuja y actualiza todas las explosiones en pantalla
  explosiones.forEach((ex, i) => {
    ex.update();
    ex.draw();
    if (ex.finished()) explosiones.splice(i, 1);
  });

  // --------- ENEMIGOS ---------
  if (Math.random() < 0.01 + nivel * 0.01) enemigos.push(new Enemigo());
  enemigos.forEach((e, i) => {
    e.update();
    // Colisión nave–enemigo
    if (colisionRectRect({ x: nave.x - 30, y: nave.y - 40, width: 60, height: 80 }, e)) {
      explosiones.push(new Explosion(e.x + e.width / 2, e.y + e.height / 2)); // 💥 explosión
      vidas--; enemigos.splice(i, 1);
      if (vidas <= 0) {
        gameOver();
        return;
      }
    }
    // Colisiones entre enemigos
    for (let j = i + 1; j < enemigos.length; j++) {
      if (colisionRectRect(e, enemigos[j])) {
        rebotar(e, enemigos[j]);
        separar(e, enemigos[j]);
      }
    }
    if (e.remove) enemigos.splice(i, 1);
  });

  // --------- POWERUPS ---------
  if (Math.random() < Math.max(0.01 - (nivel * 0.001), 0.002)) powerups.push(new PowerUp());
  powerups.forEach((p, i) => {
    p.update();
    // Colisión nave–powerup
    if (colisionRectRect({ x: nave.x - 30, y: nave.y - 40, width: 60, height: 80 }, p)) {
      score += 50; boostActive = true; boostTimer = Date.now();
      explosiones.push(new Explosion(p.x + p.width / 2, p.y + p.height / 2, "cyan", "blue", "navy")); // ⚡ destello azul
      powerups.splice(i, 1);
    }
    // Evita que se encimen entre sí
    for (let j = i + 1; j < powerups.length; j++) {
      if (colisionRectRect(p, powerups[j])) {
        separar(p, powerups[j]);
      }
    }
    if (p.y > canvas.height) powerups.splice(i, 1);
  });

  // --------- BOOST ---------
  if (boostActive && Date.now() - boostTimer > 4000) boostActive = false;

  score++;
  updateHUD();

  // --------- SUBIR DE NIVEL ---------
  if (score > nivel * 1500) {
    nivel++;
    if (nivel > nivelFinal) {
      gameRunning = false;
      showOverlay("🏆 ¡Victoria Jedi! 🌌<br>Puntaje final: " + score, true);
      setTimeout(() => location.reload(), 5000);
      return;
    }
    gameRunning = false;
    showOverlay(`⚡ ¡Nivel ${nivel}!`, true);
    setTimeout(() => {
      enemigos = [];
      powerups = [];
      vidas = 5;
      nave = new Nave();
      updateHUD();
      gameRunning = true;
      gameLoop();
    }, 3000);
  }

  requestAnimationFrame(gameLoop);
}

// ===================== OVERLAY =====================
function showOverlay(msg, autoHide = true) {
  const overlay = document.getElementById("overlay");
  overlay.innerHTML = msg;
  overlay.classList.remove("hidden");
  if (autoHide) {
    setTimeout(() => overlay.classList.add("hidden"), 2000);
  }
}

// ===================== GAME OVER =====================
function gameOver() {
  gameRunning = false;
  const overlay = document.getElementById("overlay");
  overlay.innerHTML = `
    ☠️ GAME OVER ☠️<br>Puntaje final: ${score}<br><br>
    <button id="retryBtn">Volver a jugar</button>
    <button id="exitBtn">Salir</button>
  `;
  overlay.classList.remove("hidden");

  document.getElementById("retryBtn").onclick = () => { overlay.classList.add("hidden"); resetGame(); };
  document.getElementById("exitBtn").onclick = () => {
    overlay.classList.add("hidden");
    gameRunning = false;
    paused = false;
    nivel = 1;
    vidas = 5;
    score = 0;
    enemigos = [];
    powerups = [];
    nave = null;
    updateHUD();
    document.getElementById("hud").classList.add("hidden");
    document.getElementById("menu").style.display = "block";
    menuVisible = true;
  };
}

// ===================== RESET =====================
function resetGame() {
  nivel = 1; vidas = 5; score = 0;
  enemigos = []; powerups = []; explosiones = [];
  nave = new Nave();
  updateHUD();
  gameRunning = true;
  gameLoop();
}

// ===================== CONTROLES =====================
document.addEventListener("keydown", e => {
  if (e.key === "ArrowLeft") nave?.move("left");
  if (e.key === "ArrowRight") nave?.move("right");
  if (e.key === "ArrowUp") nave?.move("up");
  if (e.key === "ArrowDown") nave?.move("down");

  if (e.key === "Enter" && menuVisible) {
    startGame();
    return;
  }
  if (e.key === "Enter" && gameRunning && !menuVisible) {
    togglePause();
  }
});

document.getElementById("startBtn").addEventListener("click", () => startGame());
document.getElementById("pauseBtn").addEventListener("click", togglePause);
canvas.addEventListener("click", () => {
  if (gameRunning && !menuVisible) togglePause();
});

// ===================== PAUSA =====================
function togglePause() {
  paused = !paused;
  const pauseBtn = document.getElementById("pauseBtn");
  const pausePopup = document.getElementById("pausePopup");
  if (paused) {
    pauseBtn.textContent = "▶️";
    pausePopup.classList.remove("hidden");
  } else {
    pauseBtn.textContent = "⏸";
    pausePopup.classList.add("hidden");
    gameLoop();
  }
}

// ===================== START =====================
function startGame() {
  document.getElementById("menu").style.display = "none";
  menuVisible = false;
  nave = new Nave();
  updateHUD();
  document.getElementById("hud").classList.remove("hidden");
  gameRunning = true;
  paused = false;
  document.getElementById("pauseBtn").innerHTML = "⏸";
  gameLoop();
}

// ===================== INTRO =====================
function introStars() {
  const introCanvas = document.getElementById("intro-canvas");
  const ictx = introCanvas.getContext("2d");
  introCanvas.width = window.innerWidth;
  introCanvas.height = window.innerHeight;
  const stars = [];
  for (let i = 0; i < 120; i++) {
    stars.push({
      x: Math.random() * introCanvas.width,
      y: Math.random() * introCanvas.height,
      size: Math.random() * 2,
      speed: 0.2 + Math.random() * 0.6
    });
  }
  function animateStars() {
    ictx.clearRect(0, 0, introCanvas.width, introCanvas.height);
    ictx.fillStyle = "white";
    stars.forEach(s => {
      ictx.beginPath();
      ictx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ictx.fill();
      s.y += s.speed;
      if (s.y > introCanvas.height) {
        s.y = 0; s.x = Math.random() * introCanvas.width;
      }
    });
    requestAnimationFrame(animateStars);
  }
  animateStars();
}

document.getElementById("continueBtn").addEventListener("click", () => {
  paused = false;
  document.getElementById("pausePopup").classList.add("hidden");
  document.getElementById("pauseBtn").textContent = "⏸";
  gameLoop();
});

document.getElementById("quitBtn").addEventListener("click", () => {
  paused = false;
  gameRunning = false;
  document.getElementById("pausePopup").classList.add("hidden");
  document.getElementById("hud").classList.add("hidden");
  document.getElementById("menu").style.display = "block";
  menuVisible = true;
});

window.onload = () => {
  introStars();
  function backgroundLoop() {
    if (!gameRunning) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawStars();
    }
    requestAnimationFrame(backgroundLoop);
  }
  backgroundLoop();
  setTimeout(() => {
    // 🔹 Mostrar menú
    document.getElementById("menu").classList.remove("hidden");
    menuVisible = true;
    document.getElementById("hud").classList.add("hidden");

    // 🔹 Ocultar intro al mismo tiempo
    document.getElementById("intro").style.display = "none";
  }, 10000); // ajusta el tiempo a lo que te guste

};
