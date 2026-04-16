/**
 * INTERCEPTOR: EARTH DEFENSE
 * Atari-Style Shooter Engine
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score-val');
const multEl = document.getElementById('mult-val');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreEl = document.getElementById('final-score-val');
const startBtn = document.getElementById('start-btn');
const retryBtn = document.getElementById('retry-btn');
const touchPad = document.getElementById('touch-pad');
const joystick = document.getElementById('joy-stick');

// Constants
const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

// Game State
let gameState = 'START';
let score = 0;
let multiplier = 1;
let lastTime = performance.now();
let spawnTimer = 0;
let spawnInterval = 1200;

// Entities
let player = {
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT - 60,
    width: 36,
    height: 24,
    speed: 6,
    color: '#00f2ff'
};

let bullets = [];
let enemies = [];
let particles = [];

// Controller Logic
const input = { left: false, right: false, lastAction: null };

function handleTouch(e) {
    if (gameState !== 'PLAYING') return;
    const rect = touchPad.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    const x = touch.clientX - rect.left;
    const width = rect.width;

    // Reset movements
    input.left = false;
    input.right = false;

    if (x < width * 0.33) {
        input.left = true;
        joystick.style.transform = 'translate(-80%, -50%)';
    } else if (x > width * 0.66) {
        input.right = true;
        joystick.style.transform = 'translate(20%, -50%)';
    } else {
        fireBullet();
        joystick.style.transform = 'translate(-50%, -80%)';
        setTimeout(() => joystick.style.transform = 'translate(-50%, -50%)', 100);
    }
}

function stopTouch() {
    input.left = false;
    input.right = false;
    joystick.style.transform = 'translate(-50%, -50%)';
}

touchPad.addEventListener('touchstart', (e) => { e.preventDefault(); handleTouch(e); });
touchPad.addEventListener('touchmove', (e) => { e.preventDefault(); handleTouch(e); });
touchPad.addEventListener('touchend', (e) => { e.preventDefault(); stopTouch(); });
touchPad.addEventListener('mousedown', (e) => handleTouch(e));
window.addEventListener('mouseup', stopTouch);

// Keyboard Support
window.addEventListener('keydown', (e) => {
    if (gameState !== 'PLAYING') return;
    if (e.key === 'ArrowLeft') input.left = true;
    if (e.key === 'ArrowRight') input.right = true;
    if (e.key === ' ' || e.key === 'ArrowUp') fireBullet();
});
window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft') input.left = false;
    if (e.key === 'ArrowRight') input.right = false;
});

// Sound Synth
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(freq, type, duration, vol) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + duration);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

const shootSFX = () => playSound(440, 'square', 0.1, 0.05);
const exploitSFX = () => playSound(150, 'sawtooth', 0.2, 0.1);
const failSFX = () => playSound(80, 'triangle', 1.0, 0.2);

// Game Engine
function fireBullet() {
    if (bullets.length > 5) return; // Limit bullets
    bullets.push({ x: player.x, y: player.y - 12, w: 4, h: 12, s: 10 });
    shootSFX();
}

function spawnEnemy() {
    const w = 32;
    enemies.push({
        x: Math.random() * (CANVAS_WIDTH - w) + w/2,
        y: -30,
        w: w,
        h: 24,
        s: 1.2 + (score / 10000),
        color: ['#39ff14', '#ff00ff', '#ff9d00', '#ff3e3e'][Math.floor(Math.random() * 4)],
        vx: (Math.random() - 0.5) * 2
    });
}

function update(dt) {
    if (gameState !== 'PLAYING') return;

    // Movement
    if (input.left) player.x -= player.speed;
    if (input.right) player.x += player.speed;
    player.x = Math.max(20, Math.min(CANVAS_WIDTH - 20, player.x));

    // Bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].y -= bullets[i].s;
        if (bullets[i].y < -20) bullets.splice(i, 1);
    }

    // Enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        e.y += e.s;
        e.x += e.vx;
        if (e.x < 20 || e.x > CANVAS_WIDTH - 20) e.vx *= -1;

        // Bullet Collision
        for (let j = bullets.length - 1; j >= 0; j--) {
            const b = bullets[j];
            if (Math.abs(b.x - e.x) < 20 && Math.abs(b.y - e.y) < 20) {
                exploitSFX();
                particles.push(...Array(8).fill(0).map(() => ({
                    x: e.x, y: e.y, vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10, l: 20, c: e.color
                })));
                enemies.splice(i, 1);
                bullets.splice(j, 1);
                score += 100 * multiplier;
                multiplier = Math.min(5, multiplier + 0.1);
                break;
            }
        }

        // Earth Boundary Collision
        if (e.y > CANVAS_HEIGHT - 30) {
            endGame();
        }
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].x += particles[i].vx;
        particles[i].y += particles[i].vy;
        particles[i].l--;
        if (particles[i].l <= 0) particles.splice(i, 1);
    }

    // Spawning
    spawnTimer += dt;
    if (spawnTimer > spawnInterval) {
        spawnEnemy();
        spawnTimer = 0;
        spawnInterval = Math.max(400, 1200 - (score/200));
    }

    // Multiplier drain
    multiplier = Math.max(1, multiplier - 0.001 * dt);

    scoreEl.innerText = Math.floor(score).toString().padStart(6, '0');
    multEl.innerText = `x${multiplier.toFixed(1)}`;
}

function draw() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Stars
    ctx.fillStyle = '#fff';
    for(let i=0; i<30; i++) {
        const s = (Math.sin(Date.now()/500 + i) + 1) * 1;
        ctx.fillRect((i*137)%CANVAS_WIDTH, (i*243+Date.now()/20)%CANVAS_HEIGHT, s, s);
    }

    // Earth Atmosphere
    ctx.fillStyle = 'rgba(255, 62, 62, 0.4)';
    ctx.fillRect(0, CANVAS_HEIGHT - 30, CANVAS_WIDTH, 30);
    ctx.strokeStyle = '#ff3e3e';
    ctx.setLineDash([10, 5]);
    ctx.beginPath(); ctx.moveTo(0, CANVAS_HEIGHT - 30); ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT - 30); ctx.stroke();
    ctx.setLineDash([]);

    // Player (Fighter Jet)
    ctx.shadowBlur = 10;
    ctx.shadowColor = player.color;
    ctx.fillStyle = player.color;
    // Jet Body
    ctx.fillRect(player.x - 4, player.y - 20, 8, 20);
    ctx.fillRect(player.x - 18, player.y - 4, 36, 10);
    ctx.fillStyle = '#fff';
    ctx.fillRect(player.x - 14, player.y + 2, 4, 4);
    ctx.fillRect(player.x + 10, player.y + 2, 4, 4);

    // Bullets
    ctx.shadowColor = '#fff';
    ctx.fillStyle = '#fff';
    bullets.forEach(b => ctx.fillRect(b.x - b.w/2, b.y, b.w, b.h));

    // Monsters
    enemies.forEach(e => {
        ctx.shadowBlur = 15;
        ctx.shadowColor = e.color;
        ctx.fillStyle = e.color;
        // Blocky monster head
        ctx.fillRect(e.x - 14, e.y - 12, 28, 16);
        // Tentacles
        const off = Math.sin(Date.now()/100) * 4;
        ctx.fillRect(e.x - 10, e.y + 4, 6, 8 + off);
        ctx.fillRect(e.x + 4, e.y + 4, 6, 8 - off);
        // Eyes
        ctx.fillStyle = '#000';
        ctx.fillRect(e.x - 8, e.y - 4, 4, 4);
        ctx.fillRect(e.x + 4, e.y - 4, 4, 4);
    });

    // Particles
    ctx.shadowBlur = 0;
    particles.forEach(p => {
        ctx.fillStyle = p.c;
        ctx.fillRect(p.x, p.y, 3, 3);
    });
}

function gameLoop(now) {
    const dt = now - lastTime;
    lastTime = now;
    update(dt);
    draw();
    requestAnimationFrame(gameLoop);
}

function startGame() {
    score = 0; multiplier = 1; enemies = []; bullets = [];
    gameState = 'PLAYING';
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function endGame() {
    gameState = 'GAMEOVER';
    failSFX();
    gameOverScreen.classList.remove('hidden');
    finalScoreEl.innerText = Math.floor(score);
}

startBtn.addEventListener('click', startGame);
retryBtn.addEventListener('click', startGame);
requestAnimationFrame(gameLoop);
