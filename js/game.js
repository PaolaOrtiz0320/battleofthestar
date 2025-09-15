// ====== Obtiene el elemento <canvas> del DOM por su id ======
const canvas = document.getElementById("gameCanvas");
// ====== Pide el “contexto” 2D para poder dibujar en el canvas ======
const ctx = canvas.getContext("2d");

// ====== Hace que el canvas ocupe todo el ancho de la ventana ======
canvas.width = window.innerWidth;
// ====== Hace que el canvas ocupe todo el alto de la ventana ======
canvas.height = window.innerHeight;

// ====== Variables de estado básicas del juego ======
let nivel = 1, vidas = 5, score = 0;   // nivel actual, vidas restantes y puntaje
// ====== Nivel máximo permitido antes de declarar victoria ======
const nivelFinal = 10;
// ====== Arreglos para entidades activas en pantalla ======
let enemigos = [], powerups = [], estrellas = []; // enemigos, potenciadores y estrellas del fondo
// ====== Referencia a la nave del jugador (se instanciará luego) ======
let nave;
// ====== ¿El juego está en curso? Controla el loop principal ======
let gameRunning = false;
// ====== ¿Está activo el “turbo” de velocidad (boost)? ======
let boostActive = false;
// ====== Marca de tiempo para medir cuánto dura el boost ======
let boostTimer = 0;
// ====== ¿Está visible el menú principal? (afecta controles con Enter) ======
let menuVisible = false;
// ====== ¿El juego está en pausa? (detiene el loop) ======
let paused = false;

// ====== Carga de imágenes (sprites) ======
const naveImg = new Image(); naveImg.src = "assets/xwing.png";      // sprite de la nave
const enemigoImg = new Image(); enemigoImg.src = "assets/tie.png";   // sprite del enemigo
const powerupImg = new Image(); powerupImg.src = "assets/holocron.png"; // sprite del power-up

// ====== Genera estrellas iniciales para el fondo animado ======
for (let i = 0; i < 150; i++) {                   // crea 150 estrellas
  estrellas.push({
    x: Math.random() * canvas.width,              // posición X aleatoria
    y: Math.random() * canvas.height,             // posición Y aleatoria
    size: Math.random() * 2,                      // radio de la estrella (pequeñito)
    speed: 0.3 + Math.random() * 0.7              // velocidad vertical (parallax simple)
  });
}
// ====== Dibuja y actualiza el campo de estrellas de fondo ======
function drawStars() {
  ctx.fillStyle = "white";                         // color de las estrellas
  estrellas.forEach(s => {
    ctx.beginPath();                               // inicia camino de dibujo
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);    // dibuja un circulito
    ctx.fill();                                    // lo rellena

    s.y += s.speed;                                // hace “caer” la estrella
    if (s.y > canvas.height) {                     // si salió por abajo…
      s.y = 0;                                     // …reaparece arriba
      s.x = Math.random() * canvas.width;          // con nueva X aleatoria
    }
  });
}

// ===================== CLASES =====================

// ====== Clase de la nave del jugador ======
class Nave {
  constructor() {
    this.width = 70; this.height = 90;             // tamaño del sprite a dibujar
    this.x = canvas.width / 2; this.y = canvas.height - 100; // posición inicial (centrada, abajo)
    this.speed = 12;                                // velocidad base de movimiento horizontal
  }
  draw() {
    // Dibuja el sprite centrado tomando (x, y) como centro geométrico
    ctx.drawImage(naveImg, this.x - this.width / 2, this.y - this.height / 2, this.width, this.height);

    // Si el boost está activo, pinta una “llama” azul detrás
    if (boostActive) {
      const grad = ctx.createLinearGradient(this.x, this.y, this.x, this.y + 80); // gradiente vertical
      grad.addColorStop(0, "rgba(0,204,255,0.7)");  // inicio más intenso
      grad.addColorStop(1, "rgba(0,0,255,0)");      // se desvanece
      ctx.fillStyle = grad;                         // usa el gradiente como relleno
      ctx.beginPath();                              // triángulo de “cola”
      ctx.moveTo(this.x - 15, this.y + 20);
      ctx.lineTo(this.x + 15, this.y + 20);
      ctx.lineTo(this.x, this.y + 80);
      ctx.closePath();
      ctx.fill();
    }
  }
  move(dir) {
    let currentSpeed = boostActive ? this.speed * 1.8 : this.speed; // acelera con boost
    if (dir === "left" && this.x > 40) this.x -= currentSpeed;      // mueve a la izquierda con límite
    if (dir === "right" && this.x < canvas.width - 40) this.x += currentSpeed; // mueve a la derecha con límite
  }
}

// ====== Clase de enemigo (TIE) ======
class Enemigo {
  constructor() {
    this.width = 50; this.height = 50;                         // tamaño del enemigo
    this.x = Math.random() * (canvas.width - this.width);      // X aleatoria dentro del canvas
    this.y = -this.height;                                     // arranca fuera de pantalla (arriba)
    this.speed = 1.5 + nivel * 0.3;                            // velocidad depende del nivel
    this.dx = (Math.random() < 0.5 ? -1 : 1) * this.speed;     // dirección horizontal aleatoria
    this.dy = this.speed;                                      // velocidad vertical constante
    this.hit = false;                                          // flag para efecto de golpe (glow)
  }
  draw() {
    ctx.shadowColor = this.hit ? "white" : "red";              // color de brillo según golpe
    ctx.shadowBlur = this.hit ? 40 : 20;                       // intensidad del brillo
    ctx.drawImage(enemigoImg, this.x, this.y, this.width, this.height); // pinta el sprite
    ctx.shadowBlur = 0;                                        // limpia el blur para el resto
  }
  update() {
    this.x += this.dx; this.y += this.dy;                      // avanza en X y Y
    if (this.x < 0 || this.x + this.width > canvas.width) this.dx *= -1; // rebote lateral
    if (this.y > canvas.height) this.remove = true;            // marca para borrar si sale por abajo
    this.draw();                                               // se dibuja en su nueva posición
  }
}

// ====== Clase de power-up (Holocron) ======
class PowerUp {
  constructor() {
    this.width = 35; this.height = 35;                         // tamaño del power-up
    this.x = Math.random() * (canvas.width - this.width);      // X aleatoria
    this.y = -this.height; this.speed = 2;                     // entra desde arriba, baja a 2 px/frame
    this.hit = false;                                          // para efecto de flash al recoger
  }
  draw() {
    ctx.shadowColor = this.hit ? "white" : "cyan";             // color del glow
    ctx.shadowBlur = this.hit ? 40 : 20;                       // intensidad
    ctx.drawImage(powerupImg, this.x, this.y, this.width, this.height); // se dibuja
    ctx.shadowBlur = 0;                                        // limpia blur
  }
  update() { this.y += this.speed; this.draw(); }              // baja y se dibuja
}

// ===================== COLISIONES =====================

// ====== Colisión AABB (rectángulos alineados a ejes) ======
function colisionRectRect(a, b) {
  return (a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y);
}
// ====== Rebote simple: intercambia velocidades entre dos enemigos ======
function rebotar(e1, e2) {
  let tempDx = e1.dx; e1.dx = e2.dx; e2.dx = tempDx;          // intercambia dx
  let tempDy = e1.dy; e1.dy = e2.dy; e2.dy = tempDy;          // intercambia dy
  e1.hit = e2.hit = true;                                     // activa glow de golpe
  setTimeout(() => { e1.hit = e2.hit = false; }, 200);        // desactiva glow tras 200 ms
}
// ====== Empuje para separar dos objetos que se superponen ======
function separar(obj1, obj2) {
  const dx = obj1.x - obj2.x;                                 // diferencia en X
  const dy = obj1.y - obj2.y;                                 // diferencia en Y
  const dist = Math.sqrt(dx * dx + dy * dy);                  // distancia euclidiana
  if (dist < 50) {                                            // si están demasiado cerca…
    const angle = Math.atan2(dy, dx);                         // calcula el ángulo entre ellos
    const fuerza = 10;                                        // magnitud del empuje
    obj1.x += Math.cos(angle) * fuerza;                       // empuja obj1 alejándolo
    obj1.y += Math.sin(angle) * fuerza;
    obj2.x -= Math.cos(angle) * fuerza;                       // empuja obj2 en sentido contrario
    obj2.y -= Math.sin(angle) * fuerza;
  }
}

// ===================== HUD =====================

// ====== Actualiza la UI del HUD (nivel, vidas y puntaje) ======
function updateHUD() {
  if (!gameRunning) {                                         // si no hay juego…
    document.getElementById("hud").classList.add("hidden");   // oculta el HUD
    return;                                                   // y termina
  }
  document.getElementById("hud").classList.remove("hidden");  // muestra HUD si hay juego
  document.getElementById("nivel").textContent = "Nivel: " + nivel; // escribe nivel
  document.getElementById("vidas").textContent = "Vidas: " + vidas; // escribe vidas
  document.getElementById("score").textContent = "Puntaje: " + score; // escribe puntaje
}

// ===================== LOOP PRINCIPAL =====================

// ====== Bucle de juego que corre en cada frame ======
function gameLoop() {
  if (!gameRunning || paused) return;                         // si está parado o en pausa, no avanza
  ctx.clearRect(0, 0, canvas.width, canvas.height);           // limpia el lienzo
  drawStars();                                                // dibuja fondo estelar
  nave.draw();                                                // dibuja la nave del jugador

  // --------- ENEMIGOS ---------
  if (Math.random() < 0.01 + nivel * 0.01) enemigos.push(new Enemigo()); // spawn aleatorio según nivel
  enemigos.forEach((e, i) => {                                // recorre todos los enemigos
    e.update();                                               // actualiza posición/dibujo
    // Colisión nave–enemigo (hitbox aproximada centrada en la nave)
    if (colisionRectRect({ x: nave.x - 30, y: nave.y - 40, width: 60, height: 80 }, e)) {
      vidas--; enemigos.splice(i, 1);                         // resta vida y elimina ese enemigo
      if (vidas <= 0) {                                       // si se quedó sin vidas…
        gameOver();                                           // muestra Game Over (overlay persistente)
        return;                                               // corta el frame actual del loop
      }
    }

    // Colisiones entre enemigos para rebotar y separarse
    for (let j = i + 1; j < enemigos.length; j++) {
      if (colisionRectRect(e, enemigos[j])) {
        rebotar(e, enemigos[j]);                              // intercambio de velocidades
        separar(e, enemigos[j]);                              // pequeño empuje para que no queden pegados
      }
    }
    if (e.remove) enemigos.splice(i, 1);                      // si salió del canvas, eliminar
  });

  // --------- POWER-UPS ---------
  // Aparecen con probabilidad inversa al nivel (nunca menor que 0.002)
  if (Math.random() < Math.max(0.01 - (nivel * 0.001), 0.002)) powerups.push(new PowerUp());
  powerups.forEach((p, i) => {
    p.update();                                               // baja y se dibuja
    // Colisión nave–powerup: sumar puntos y activar boost temporal
    if (colisionRectRect({ x: nave.x - 30, y: nave.y - 40, width: 60, height: 80 }, p)) {
      score += 50;                                            // suma puntos
      boostActive = true; boostTimer = Date.now();            // activa boost y guarda tiempo de inicio
      p.hit = true;                                           // efecto visual de “tomado”
      setTimeout(() => { p.hit = false; }, 200);              // quita el flash a los 200 ms
      powerups.splice(i, 1);                                  // elimina el power-up tomado
    }
    // Evita que dos power-ups queden encimados
    for (let j = i + 1; j < powerups.length; j++) {
      if (colisionRectRect(p, powerups[j])) {
        separar(p, powerups[j]);                              // pequeño empuje
      }
    }
    if (p.y > canvas.height) powerups.splice(i, 1);           // si salió del canvas, eliminar
  });

  // Desactiva boost cuando pasan ~4 segundos desde que se activó
  if (boostActive && Date.now() - boostTimer > 4000) boostActive = false;

  score++;                                                    // incrementa puntaje cada frame
  updateHUD();                                                // refresca interfaz

  // --------- SUBIDA DE NIVEL ---------
  if (score > nivel * 1500) {                                 // umbral de avance por nivel
    nivel++;                                                  // sube de nivel
    if (nivel > nivelFinal) {                                 // si pasó el último nivel…
      gameRunning = false;                                    // detén loop
      showOverlay("🏆 ¡Victoria Jedi! 🌌<br>Puntaje final: " + score, true); // overlay temporal de victoria
      setTimeout(() => location.reload(), 5000);              // recarga página tras 5 s
      return;                                                 // corta frame
    }

    gameRunning = false;                                      // pausa temporal entre niveles
    showOverlay(`⚡ ¡Nivel ${nivel}!`, true);                  // mensaje de nivel (se oculta solo)
    setTimeout(() => {                                        // espera 3 s para reanudar
      enemigos = [];                                          // limpia enemigos
      powerups = [];                                          // limpia power-ups
      vidas = 5;                                              // reinicia vidas por nivel
      nave = new Nave();                                      // reposiciona la nave
      updateHUD();                                            // actualiza HUD
      gameRunning = true;                                     // reanuda juego
      gameLoop();                                             // vuelve a correr el loop
    }, 3000);
  }

  requestAnimationFrame(gameLoop);                            // pide el siguiente frame
}

// ===================== OVERLAY (mensajes) =====================

// ====== Muestra un overlay y opcionalmente lo oculta solo ======
function showOverlay(msg, autoHide = true) {
  const overlay = document.getElementById("overlay");         // obtiene el contenedor del overlay
  overlay.innerHTML = msg;                                    // inyecta el HTML del mensaje
  overlay.classList.remove("hidden");                         // lo hace visible
  if (autoHide) {                                             // si se indicó auto ocultar…
    setTimeout(() => overlay.classList.add("hidden"), 2000);  // lo oculta a los 2 s
  }
}

// ===================== GAME OVER =====================

// ====== Detiene el juego y muestra botones de reintentar/salir ======
function gameOver() {
  gameRunning = false;                                        // detiene el loop del juego

  // NOTA: usamos plantilla con backticks para poder escribir varias líneas HTML
  const overlay = document.getElementById("overlay");         // referencia al overlay
  overlay.innerHTML = `
    ☠️ GAME OVER ☠️<br>Puntaje final: ${score}<br><br>
    <button id="retryBtn">Volver a jugar</button>
    <button id="exitBtn">Salir</button>
  `;                                                          // contenido del overlay (no se auto-oculta)
  overlay.classList.remove("hidden");                         // muestra el overlay en pantalla

  // Al pulsar “Volver a jugar”: oculta overlay y reinicia juego
  document.getElementById("retryBtn").onclick = () => { overlay.classList.add("hidden"); resetGame(); };
  // Al pulsar “Salir”: oculta overlay, resetea todo y vuelve al menú
  document.getElementById("exitBtn").onclick = () => {
    overlay.classList.add("hidden");                          // oculta overlay

    // Reset completo al estado inicial
    gameRunning = false;                                      // asegura que no hay loop
    paused = false;                                           // quita pausa
    nivel = 1;                                                // reinicia nivel
    vidas = 5;                                                // reinicia vidas
    score = 0;                                                // reinicia puntaje
    enemigos = [];                                            // limpia listas
    powerups = [];
    nave = null;                                              // sin nave activa

    updateHUD();                                              // actualiza HUD
    document.getElementById("hud").classList.add("hidden");   // oculta HUD
    document.getElementById("menu").style.display = "block";  // muestra menú
    menuVisible = true;                                       // marca menú visible
  };
}

// ===================== RESET =====================

// ====== Restaura el estado y arranca una nueva partida ======
function resetGame() {
  nivel = 1; vidas = 5; score = 0;                            // estado inicial
  enemigos = []; powerups = [];                               // limpia entidades
  nave = new Nave();                                          // crea nueva nave
  updateHUD();                                                // actualiza HUD
  gameRunning = true;                                         // activa loop
  gameLoop();                                                 // comienza el bucle
}

// ===================== CONTROLES =====================

// ====== Manejo de teclado: flechas para mover; Enter para iniciar/pausar ======
document.addEventListener("keydown", e => {
  if (e.key === "ArrowLeft") nave?.move("left");              // mueve nave a la izquierda si existe
  if (e.key === "ArrowRight") nave?.move("right");            // mueve nave a la derecha si existe

  // Si el menú está visible y se presiona Enter, inicia el juego
  if (e.key === "Enter" && menuVisible) {
    startGame();                                              // inicia partida
    return;                                                   // evita que caiga al bloque de pausa
  }

  // Si hay juego activo (sin menú) y se presiona Enter, alterna pausa
  if (e.key === "Enter" && gameRunning && !menuVisible) {
    togglePause();                                            // pausa/reanuda
  }
});

// ====== Click en el botón “Jugar” del menú ======
document.getElementById("startBtn").addEventListener("click", () => startGame());

// ====== Click en el botón de pausa del HUD ======
document.getElementById("pauseBtn").addEventListener("click", togglePause);

// ====== Click sobre el canvas: atajo para pausar durante la partida ======
canvas.addEventListener("click", () => {
  if (gameRunning && !menuVisible) {                          // solo si hay partida activa
    togglePause();                                            // alterna pausa
  }
});

// ====== Alterna el estado de pausa y muestra/oculta el popup ======
function togglePause() {
  paused = !paused;                                           // invierte el flag de pausa
  const pauseBtn = document.getElementById("pauseBtn");       // botón en el HUD
  const pausePopup = document.getElementById("pausePopup");   // popup centrado

  if (paused) {
    pauseBtn.textContent = "▶️";                              // cambia icono a “play”
    pausePopup.classList.remove("hidden");                    // muestra el popup de pausa
  } else {
    pauseBtn.textContent = "⏸";                              // vuelve al icono de pausa
    pausePopup.classList.add("hidden");                       // oculta el popup
    gameLoop();                                               // reanuda el bucle
  }
}

// ===================== START (iniciar partida) =====================

// ====== Esconde el menú, prepara estado y arranca el loop ======
function startGame() {
  document.getElementById("menu").style.display = "none";     // oculta menú
  menuVisible = false;                                        // marca que ya no está visible
  nave = new Nave();                                          // crea la nave
  updateHUD();                                                // actualiza HUD
  document.getElementById("hud").classList.remove("hidden");  // muestra HUD
  gameRunning = true;                                         // activa loop
  paused = false;                                             // asegura que no esté pausado

  const pauseBtn = document.getElementById("pauseBtn");       // referencia al botón de pausa
  pauseBtn.innerHTML = "⏸";                                   // restablece icono a “pausa”

  gameLoop();                                                 // arranca el bucle principal
}

// ===================== INTRO (pantalla inicial) =====================

// ====== Dibuja estrellas animadas en el canvas de la intro ======
function introStars() {
  const introCanvas = document.getElementById("intro-canvas"); // canvas de la intro (sección superior)
  const ictx = introCanvas.getContext("2d");                   // contexto de dibujo 2D
  introCanvas.width = window.innerWidth;                       // ocupa todo el ancho
  introCanvas.height = window.innerHeight;                     // ocupa todo el alto

  const stars = [];                                            // arreglo local de estrellas para intro
  for (let i = 0; i < 120; i++) {                              // crea 120 estrellas
    stars.push({
      x: Math.random() * introCanvas.width,                    // X aleatoria
      y: Math.random() * introCanvas.height,                   // Y aleatoria
      size: Math.random() * 2,                                 // tamaño pequeño
      speed: 0.2 + Math.random() * 0.6                         // velocidad vertical suave
    });
  }
  // ====== Anima continuamente el fondo de estrellas de la intro ======
  function animateStars() {
    ictx.clearRect(0, 0, introCanvas.width, introCanvas.height); // limpia el canvas de la intro
    ictx.fillStyle = "white";                                     // color de las estrellas
    stars.forEach(s => {
      ictx.beginPath();                                           // inicia camino
      ictx.arc(s.x, s.y, s.size, 0, Math.PI * 2);                 // dibuja estrella
      ictx.fill();                                                // rellena
      s.y += s.speed;                                             // cae hacia abajo
      if (s.y > introCanvas.height) {                             // si sale por abajo…
        s.y = 0; s.x = Math.random() * introCanvas.width;         // reaparece arriba con nueva X
      }
    });
    requestAnimationFrame(animateStars);                          // pide siguiente frame
  }
  animateStars();                                                 // arranca la animación de intro
}

// ===================== Botones del popup de pausa =====================

// ====== Botón “Continuar”: quita la pausa y reanuda el loop ======
document.getElementById("continueBtn").addEventListener("click", () => {
  paused = false;                                              // desactiva pausa
  document.getElementById("pausePopup").classList.add("hidden"); // oculta popup
  document.getElementById("pauseBtn").textContent = "⏸";      // restaura icono
  gameLoop();                                                  // reanuda el bucle
});

// ====== Botón “Salir”: vuelve al menú sin cerrar la página ======
document.getElementById("quitBtn").addEventListener("click", () => {
  paused = false;                                              // por si estaba en pausa
  gameRunning = false;                                         // detiene loop
  document.getElementById("pausePopup").classList.add("hidden"); // oculta popup
  document.getElementById("hud").classList.add("hidden");      // oculta HUD
  document.getElementById("menu").style.display = "block";     // muestra menú
  menuVisible = true;                                          // marca menú visible
});

// ===================== onload: configuración de la pantalla inicial =====================

// ====== Cuando la página termina de cargar… ======
window.onload = () => {
  introStars();                                                // inicia animación de intro

  // ====== Fondo de estrellas en el canvas principal cuando NO hay juego corriendo ======
  function backgroundLoop() {
    if (!gameRunning) {                                        // solo si no hay partida
      ctx.clearRect(0, 0, canvas.width, canvas.height);        // limpia el canvas principal
      drawStars();                                             // dibuja estrellas (idle)
    }
    requestAnimationFrame(backgroundLoop);                     // siguiente frame del fondo
  }
  backgroundLoop();                                            // arranca el fondo perpetuo

  // ====== Al terminar el “crawl” (animación CSS) se oculta la intro y aparece el menú ======
  document.querySelector("#intro .crawl").addEventListener("animationend", () => {
    document.getElementById("intro").style.display = "none";   // oculta sección de intro
    document.getElementById("menu").classList.remove("hidden");// muestra menú
    menuVisible = true;                                        // marca menú visible
    document.getElementById("hud").classList.add("hidden");    // oculta HUD hasta iniciar partida
  });
};

