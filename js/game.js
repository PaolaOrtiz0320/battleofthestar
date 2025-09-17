/* 
============================================
 VIDEOJUEGO STAR WARS - DOCUMENTACIÓN
============================================

1. CONTEXTO
------------
Este videojuego está inspirado en el universo de Star Wars y 
se desarrolla en un entorno espacial con HTML5 Canvas y JavaScript.
El jugador controla una nave espacial que se desplaza en un fondo
de estrellas en movimiento, enfrentando obstáculos y enemigos.

2. OBJETIVO
------------
- General: Crear un videojuego interactivo que simule la experiencia
  de pilotar una nave en el espacio.
- Específicos:
  * Implementar movimiento de nave con teclas.
  * Generar un fondo dinámico con estrellas.
  * Integrar enemigos y disparos.
  * Practicar programación gráfica con Canvas y animaciones.

3. JUSTIFICACIÓN
-----------------
El proyecto es relevante porque:
- Refuerza el aprendizaje en JavaScript con canvas y ciclos de animación.
- Promueve la creatividad y la lógica de programación orientada a objetos.
- Sirve como prototipo para desarrollos más complejos.
- Vincula la programación con un tema atractivo como Star Wars.

4. OPERACIÓN DEL VIDEOJUEGO
-----------------------------
- Inicio:
  El usuario abre el juego en el navegador y se genera el fondo estrellado.
- Controles:
  Flechas → Mueven la nave.
  Espacio → Dispara proyectiles.
- Dinámica:
  Las estrellas se desplazan hacia abajo simulando el espacio.
  Enemigos descienden desde la parte superior.
- Final:
  El juego termina al colisionar con un enemigo o perder todas las vidas.
============================================
*/

// ====== Obtiene el elemento <canvas> del DOM por su id ======
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// ====== Configuración inicial del canvas ======
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// ====== Variables de estado básicas del juego ======
let nivel = 1, vidas = 5, score = 0;
const nivelFinal = 10;
let enemigos = [], powerups = [], estrellas = [], explosiones = [];
let nave;
let gameRunning = false;
let boostActive = false;
let boostTimer = 0;
let menuVisible = false;
let paused = false;

// ====== Control de sonido ======
let soundEnabled = true;

// ====== Carga de imágenes ======
const naveImg = new Image(); naveImg.src = "assets/xwing.png";
const enemigoImg = new Image(); enemigoImg.src = "assets/tie.png";
const powerupImg = new Image(); powerupImg.src = "assets/holocron.png";

// ====== Carga de sonidos ======
const sndIntro = new Audio("assets/intro.mp3");
const sndPowerUp = new Audio("assets/comerholocron.mp3");
const sndHit = new Audio("assets/choque3.mp3");       // choque X-Wing – TIE
const sndTieCollision = new Audio("assets/collision2.mp3"); // choque entre TIE
const sndLevelUp = new Audio("assets/subirnivel.mp3");
const sndVictory = new Audio("assets/ganar.mp3");
const sndGameOver = new Audio("assets/perder1.mp3");

// Configuración de volumen / loop (comportamiento original)
sndIntro.volume = 0.5;
sndIntro.loop = true;

// ====== Helper: reproducir sonidos sin cortar otros ======
function playSound(baseSound) {
  if (!soundEnabled) return;
  const clone = baseSound.cloneNode();
  clone.volume = baseSound.volume;
  clone.play();
}

/* ============================================================
   PROYECTO: STARSHIP SURVIVOR
   BLOQUE DOCUMENTADO: ESTRELLAS, NAVE, ENEMIGOS, POWERUPS, EXPLOSIONES
   ============================================================ */

/* ============================================================
   🌌 1) GENERACIÓN Y DIBUJO DE ESTRELLAS
   ============================================================ */

// Generamos 150 estrellas con posiciones, tamaños y velocidades aleatorias
for (let i = 0; i < 150; i++) {
  estrellas.push({
    x: Math.random() * canvas.width,   // posición X dentro del ancho del canvas
    y: Math.random() * canvas.height,  // posición Y dentro del alto del canvas
    size: Math.random() * 2,           // tamaño de la estrella (0–2 px)
    speed: 0.3 + Math.random() * 0.7   // velocidad entre 0.3–1 px/frame
  });
}

// Dibuja las estrellas y las mueve hacia abajo
function drawStars() {
  ctx.fillStyle = "white"; // color de las estrellas
  estrellas.forEach(s => {
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2); // estrella = círculo pequeño
    ctx.fill();

    // Movimiento hacia abajo
    s.y += s.speed;

    // Si sale por abajo → reaparece arriba con nueva posición X
    if (s.y > canvas.height) {
      s.y = 0;
      s.x = Math.random() * canvas.width;
    }
  });
}

/* ============================================================
   🚀 2) CLASE NAVE
   ============================================================ */
class Nave {
  constructor() {
    this.width = 70; this.height = 90;      // tamaño de la nave
    this.x = canvas.width / 2;              // posición inicial centrada
    this.y = canvas.height - 100;           // posición inicial cerca del fondo
    this.speed = 12;                        // velocidad base
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);          // mover sistema de coordenadas
    ctx.rotate(Math.PI);                    // rotar sprite (180°)
    ctx.drawImage(naveImg, -this.width / 2, -this.height / 2, this.width, this.height);
    ctx.restore();

    // 🔹 Si está activo el boost (por comer holocrón), dibuja rastro azul
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

  move(dir) {
    // Si hay boost, la nave se mueve 4× más rápido
    let currentSpeed = boostActive ? this.speed * 4 : this.speed;

    // Movimiento limitado para que no salga del canvas
    if (dir === "left" && this.x > 40) this.x -= currentSpeed;
    if (dir === "right" && this.x < canvas.width - 40) this.x += currentSpeed;
    if (dir === "up" && this.y > 60) this.y -= currentSpeed * 1.3;   // 30% más rápido vertical
    if (dir === "down" && this.y < canvas.height - 60) this.y += currentSpeed * 1.3;
  }
}

/* ============================================================
   👾 3) CLASE ENEMIGO
   ============================================================ */
class Enemigo {
  constructor() {
    this.width = 50; this.height = 50;
    this.x = Math.random() * (canvas.width - this.width); // posición X inicial
    this.y = -this.height;                               // aparece fuera de pantalla
    this.speed = 1.5 + nivel * 0.3;                      // más rápido con cada nivel

    // Dirección inicial aleatoria en X (izquierda o derecha)
    this.dx = (Math.random() < 0.5 ? -1 : 1) * this.speed;
    this.dy = this.speed; // movimiento hacia abajo
    this.hit = false;     // indicador de choque
    this.hitColor = "red";
  }

  draw() {
    ctx.shadowColor = this.hit ? this.hitColor : "red"; // brillo si fue golpeado
    ctx.shadowBlur = this.hit ? 40 : 20;
    ctx.drawImage(enemigoImg, this.x, this.y, this.width, this.height);
    ctx.shadowBlur = 0;
  }

  update() {
    this.x += this.dx;
    this.y += this.dy;

    // Rebote en las paredes laterales
    if (this.x < 0) { this.x = 0; this.dx *= -1; }
    if (this.x + this.width > canvas.width) {
      this.x = canvas.width - this.width;
      this.dx *= -1;
    }

    // Si sale por abajo → se marca para eliminar
    if (this.y > canvas.height) this.remove = true;

    this.draw();
  }

  hitEffect(color = "white") {
    this.hit = true;
    this.hitColor = color;         // cambia color temporalmente
    setTimeout(() => { this.hit = false; }, 200); // vuelve a normal en 200ms
  }
}

/* ============================================================
   🔮 4) CLASE POWERUP (HOLOCRÓN)
   ============================================================ */
class PowerUp {
  constructor() {
    this.width = 35; this.height = 35;
    this.x = Math.random() * (canvas.width - this.width); // posición X aleatoria
    this.y = -this.height;                               // aparece arriba
    this.speed = 2;                                      // velocidad constante
    this.hit = false;                                    // indicador de recogido
  }

  draw() {
    ctx.shadowColor = this.hit ? "cyan" : "blue";  // cambia color al recogerse
    ctx.shadowBlur = this.hit ? 40 : 15;
    ctx.drawImage(powerupImg, this.x, this.y, this.width, this.height);
    ctx.shadowBlur = 0;
  }

  update() { this.y += this.speed; this.draw(); }

  hitEffect() {
    this.hit = true;                       // parpadeo breve
    setTimeout(() => { this.hit = false; }, 200);
  }
}

/* ============================================================
   💥 5) CLASE EXPLOSION
   ============================================================ */
class Explosion {
  constructor(x, y, color1 = "yellow", color2 = "orange", color3 = "red") {
    this.x = x; this.y = y;       // posición de la explosión
    this.radius = 10;             // radio inicial
    this.alpha = 1;               // opacidad inicial (visible)
    this.color1 = color1; this.color2 = color2; this.color3 = color3;
  }

  update() {
    this.radius += 5;   // cada frame aumenta el radio
    this.alpha -= 0.08; // se va volviendo transparente
  }

  draw() {
    ctx.save();
    ctx.globalAlpha = this.alpha; // opacidad actual
    const grad = ctx.createRadialGradient(
      this.x, this.y, this.radius * 0.2,  // inicio degradado
      this.x, this.y, this.radius         // fin degradado
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

  finished() { return this.alpha <= 0; } // desaparece cuando alpha = 0
}

// ===================== COLISIONES =====================
// AABB: colisión rectángulo-rectángulo
function colisionRectRect(a, b) {
  return (a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y);
}

let lastTieCollisionTime = 0;

// Rebote calculado según la línea que une centros, y separación para evitar "pegado"
function rebotarYSeparar(e1, e2) {
  // centros
  const c1x = e1.x + e1.width / 2, c1y = e1.y + e1.height / 2;
  const c2x = e2.x + e2.width / 2, c2y = e2.y + e2.height / 2;

  // vector entre centros y ángulo
  const nx = c1x - c2x;
  const ny = c1y - c2y;
  const angle = Math.atan2(ny, nx) || 0;

  // magnitudes de velocidad actuales (con un mínimo)
  const s1 = Math.max(0.8, Math.hypot(e1.dx, e1.dy) || e1.speed);
  const s2 = Math.max(0.8, Math.hypot(e2.dx, e2.dy) || e2.speed);

  // reasignamos direcciones opuestas (salida en sentido contrario)
  e1.dx = Math.cos(angle) * s1;
  e1.dy = Math.sin(angle) * s1;
  e2.dx = -Math.cos(angle) * s2;
  e2.dy = -Math.sin(angle) * s2;

  // separación para que no sigan superpuestos
  const overlapX = (e1.width + e2.width) / 2 - Math.abs(c1x - c2x);
  const overlapY = (e1.height + e2.height) / 2 - Math.abs(c1y - c2y);
  const fuerza = 12 + Math.random() * 8;
  // empuje a lo largo del ángulo normal
  e1.x += Math.cos(angle) * fuerza;
  e1.y += Math.sin(angle) * fuerza;
  e2.x -= Math.cos(angle) * fuerza;
  e2.y -= Math.sin(angle) * fuerza;

  // Efecto visual y sonido
  e1.hitEffect("white");
  e2.hitEffect("white");
  const now = Date.now();
  if (now - lastTieCollisionTime > 200) {
    playSound(sndTieCollision);
    lastTieCollisionTime = now;
  }

  // Clamp en bordes para no salir del canvas tras separar
  if (e1.x < 0) e1.x = 0;
  if (e1.x + e1.width > canvas.width) e1.x = canvas.width - e1.width;
  if (e2.x < 0) e2.x = 0;
  if (e2.x + e2.width > canvas.width) e2.x = canvas.width - e2.width;
}

// ===================== HUD =====================
function updateHUD() {
  if (!gameRunning) { document.getElementById("hud").classList.add("hidden"); return; }
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

  // Explosiones
  for (let i = explosiones.length - 1; i >= 0; i--) {
    const ex = explosiones[i];
    ex.update(); ex.draw();
    if (ex.finished()) explosiones.splice(i, 1);
  }

  // Spawning
  if (Math.random() < 0.01 + nivel * 0.01) enemigos.push(new Enemigo());
  if (Math.random() < Math.max(0.01 - (nivel * 0.001), 0.002)) powerups.push(new PowerUp());

  // ====== Enemigos: actualizar, colisiones con nave, y entre sí (desde nivel 1) ======
  // Recorremos hacia atrás para poder splicear sin romper índices
  for (let i = enemigos.length - 1; i >= 0; i--) {
    const e = enemigos[i];
    e.update();

    // Colisión enemigo vs nave (usamos caja centrada sobre la nave)
    const naveBox = { x: nave.x - 30, y: nave.y - 40, width: 60, height: 80 };
    if (colisionRectRect(naveBox, e)) {
      explosiones.push(new Explosion(e.x + e.width / 2, e.y + e.height / 2));
      playSound(sndHit);
      vidas--;
      enemigos.splice(i, 1);
      if (vidas <= 0) { gameOver(); return; }
      continue; // ya removimos e, pasamos al siguiente
    }

    // Colisiones enemigo-enemigo (todas las parejas, todos los niveles)
    for (let j = i - 1; j >= 0; j--) {
      const o = enemigos[j];
      if (colisionRectRect(e, o)) {
        rebotarYSeparar(e, o);
      }
    }

    // Remover si salió de pantalla
    if (e.remove) enemigos.splice(i, 1);
  }

  // ====== PowerUps: actualizar y verificar si la nave "come" holocrones ======
  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    p.update();

    const naveBox = { x: nave.x - 30, y: nave.y - 40, width: 60, height: 80 };
    if (colisionRectRect(naveBox, p)) {
      // Comer holocrón: sumar puntaje y activar boost temporal
      score += 50;
      boostActive = true;
      boostTimer = Date.now();

      // Efecto visual + sonido
      explosiones.push(new Explosion(p.x + p.width / 2, p.y + p.height / 2, "cyan", "blue", "navy"));
      playSound(sndPowerUp);

      // Quitar el powerup de la lista
      powerups.splice(i, 1);
      continue;
    }
    // Si sale por abajo, se elimina
    if (p.y > canvas.height) powerups.splice(i, 1);
  }

  // Duración del boost (4 s)
  if (boostActive && Date.now() - boostTimer > 4000) boostActive = false;

  // Score y HUD
  score++; 
  updateHUD();

  // Subir de nivel y victoria
  if (score > nivel * 1500) {
    nivel++;
    if (nivel > nivelFinal) {
      gameRunning = false;
      showOverlay("🏆 ¡Victoria Jedi! 🌌<br>Puntaje final: " + score, true);
      playSound(sndVictory);
      setTimeout(() => location.reload(), 5000);
      return;
    }
    gameRunning = false;
    showOverlay(`⚡ ¡Nivel ${nivel}!`, true);
    playSound(sndLevelUp);
    setTimeout(() => {
      enemigos = []; powerups = []; vidas = 5;
      nave = new Nave(); updateHUD(); gameRunning = true; gameLoop();
    }, 3000);
  }

  requestAnimationFrame(gameLoop);
}

// ===================== OVERLAY =====================
function showOverlay(msg, autoHide = true) {
  const overlay = document.getElementById("overlay");
  overlay.innerHTML = msg;
  overlay.classList.remove("hidden");
  if (autoHide) setTimeout(() => overlay.classList.add("hidden"), 2000);
}

// ===================== GAME OVER =====================
function gameOver() {
  gameRunning = false;
  playSound(sndGameOver);
  const overlay = document.getElementById("overlay");
  overlay.innerHTML = `
    ☠️ GAME OVER ☠️<br>Puntaje final: ${score}<br><br>
    <button id="retryBtn">Volver a jugar</button>
    <button id="exitBtn">Salir</button>
  `;
  overlay.classList.remove("hidden");

  document.getElementById("retryBtn").onclick = () => { 
    overlay.classList.add("hidden"); 
    resetGame(); 
  };

  document.getElementById("exitBtn").onclick = () => {
    overlay.classList.add("hidden"); 
    gameRunning = false; 
    paused = false;
    nivel = 1; vidas = 5; score = 0; enemigos = []; powerups = []; nave = null;
    updateHUD(); 
    document.getElementById("hud").classList.add("hidden");
    document.getElementById("menu").style.display = "block"; 
    menuVisible = true;

    if (soundEnabled) {
      sndIntro.currentTime = 0;
      sndIntro.play().catch(() => {
        // fallback: desbloqueo en siguiente interacción
        const resumeIntro = () => {
          sndIntro.play();
          document.body.removeEventListener("click", resumeIntro);
          document.body.removeEventListener("keydown", resumeIntro);
        };
        document.body.addEventListener("click", resumeIntro, { once: true });
        document.body.addEventListener("keydown", resumeIntro, { once: true });
      });
    }
  };
}

// ===================== RESET =====================
function resetGame() {
  nivel = 1; vidas = 5; score = 0;
  enemigos = []; powerups = []; explosiones = [];
  nave = new Nave(); updateHUD(); gameRunning = true; gameLoop();
}

// ===================== CONTROLES =====================
document.addEventListener("keydown", e => {
  if (e.key === "ArrowLeft") nave?.move("left");
  if (e.key === "ArrowRight") nave?.move("right");
  if (e.key === "ArrowUp") nave?.move("up");
  if (e.key === "ArrowDown") nave?.move("down");
  if (e.key === "Enter" && menuVisible) { startGame(); return; }
  if (e.key === "Enter" && gameRunning && !menuVisible) togglePause();
});
document.getElementById("startBtn").addEventListener("click", () => startGame());
document.getElementById("pauseBtn").addEventListener("click", togglePause);
canvas.addEventListener("click", () => { if (gameRunning && !menuVisible) togglePause(); });

// ===================== BOTÓN SONIDO =====================
document.getElementById("soundBtn").addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  document.getElementById("soundBtn").textContent = soundEnabled ? "🔊" : "🔇";
  if (!soundEnabled) { sndIntro.pause(); }
  else { sndIntro.play(); }
});

// ===================== PAUSA =====================
function togglePause() {
  paused = !paused;
  const pauseBtn = document.getElementById("pauseBtn");
  const pausePopup = document.getElementById("pausePopup");
  if (paused) { pauseBtn.textContent = "▶️"; pausePopup.classList.remove("hidden"); }
  else { pauseBtn.textContent = "⏸"; pausePopup.classList.add("hidden"); gameLoop(); }
}

// ===================== START =====================
function startGame() {
  sndIntro.pause();
  sndIntro.currentTime = 0;
  document.getElementById("menu").style.display = "none";
  menuVisible = false;
  nave = new Nave(); updateHUD();
  document.getElementById("hud").classList.remove("hidden");
  gameRunning = true; paused = false;
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
      if (s.y > introCanvas.height) { s.y = 0; s.x = Math.random() * introCanvas.width; }
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
  paused = false; gameRunning = false;
  document.getElementById("pausePopup").classList.add("hidden");
  document.getElementById("hud").classList.add("hidden");
  document.getElementById("menu").style.display = "block"; 
  menuVisible = true;

  if (soundEnabled) {
    sndIntro.currentTime = 0;
    sndIntro.play().catch(() => {
      const resumeIntro = () => {
        sndIntro.play();
        document.body.removeEventListener("click", resumeIntro);
        document.body.removeEventListener("keydown", resumeIntro);
      };
      document.body.addEventListener("click", resumeIntro, { once: true });
      document.body.addEventListener("keydown", resumeIntro, { once: true });
    });
  }
});

// ===================== ONLOAD =====================
window.onload = () => {
  introStars();

  // 🔊 Intento inmediato de reproducir la música de intro (si el navegador lo permite)
  if (soundEnabled) {
    sndIntro.play().catch(() => {
      // Fallback: al primer click/tecla se desbloquea el audio
      const startIntro = () => {
        sndIntro.play();
        document.body.removeEventListener("click", startIntro);
        document.body.removeEventListener("keydown", startIntro);
      };
      document.body.addEventListener("click", startIntro, { once: true });
      document.body.addEventListener("keydown", startIntro, { once: true });
    });
  }

  // Fondo animado cuando el juego no está corriendo
  function backgroundLoop() {
    if (!gameRunning) { ctx.clearRect(0, 0, canvas.width, canvas.height); drawStars(); }
    requestAnimationFrame(backgroundLoop);
  }
  backgroundLoop();

  // Mostrar menú al cabo de la intro visual
  setTimeout(() => {
    document.getElementById("menu").classList.remove("hidden");
    menuVisible = true;
    document.getElementById("hud").classList.add("hidden");
    document.getElementById("intro").style.display = "none";
  }, 10000);
};
