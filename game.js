/** 
 * INTERCEPTOR: EARTH DEFENSE
 * A Retro Atari-Style Shooter
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

// Game State
let gameState = 'START'; // START, PLAYING, GAMEOVER
let score = 0;
let multiplier = 1;
let lastTime = 0;
let spawnTimer = 0;
let spawnInterval = 1000;
let multTimer = 0;

// Game Config
const PADDING = 10;
const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;

canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

// Entities
let player = {
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT - 40,
    width: 32,
    height: 24,
    speed: 5,
    dx: 0,
    color: '#00f2ff'
};

let bullets = [];
let enemies = [];
let particles = [];

// Colors
const COLORS = [
    '#39ff14', // Green
    '#ff00ff', // Pink
    '#ff9d00', // Orange
    '#ff3e3e', // Red
    '#00f2ff'  // Cyan
];

// Audio Synth (Web Audio API)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(freq, type, duration, vol = 0.1) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + duration);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

function shootSound() {
    playSound(400, 'square', 0.1, 0.05);
}

function explosionSound() {
    playSound(150, 'sawtooth', 0.3, 0.1);
}

function failSound() {
    playSound(100, 'square', 1.0, 0.1);
}

// Controller Logic
const controlZones = document.querySelectorAll('.control-zone');
const activeActions = {
    left: false,
    right: false
};

controlZones.forEach(zone => {
    const action = zone.dataset.action;
    
    const startAction = (e) => {
        e.preventDefault();
        if (gameState !== 'PLAYING') return;
        
        if (action === 'fire') {
            fireBullet();
        } else {
            activeActions[action] = true;
        }
    };
    
    const endAction = (e) => {
        e.preventDefault();
        if (action !== 'fire') {
            activeActions[action] = false;
        }
    };

    zone.addEventListener('mousedown', startAction);
    zone.addEventListener('mouseup', endAction);
    zone.addEventListener('touchstart', startAction);
    zone.addEventListener('touchend', endAction);
});

// Keyboard Fallback
window.addEventListener('keydown', (e) => {
    if (gameState !== 'PLAYING') return;
    if (e.key === 'ArrowLeft') activeActions.left = true;
    if (e.key === 'ArrowRight') activeActions.right = true;
    if (e.key === ' ' || e.key === 'ArrowUp') fireBullet();
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft') activeActions.left = false;
    if (e.key === 'ArrowRight') activeActions.right = false;
});

// Game Loop Functions
function fireBullet() {
    bullets.push({
        x: player.x,
        y: player.y - 10,
        width: 4,
        height: 12,
        speed: 8
    });
    shootSound();
}

function spawnEnemy() {
    const types = ['SCUTTLER', 'WANDERER', 'DROPER'];
    const type = types[Math.floor(Math.random() * types.length)];
    const width = 30;
    
    enemies.push({
        x: Math.random() * (CANVAS_WIDTH - width) + width / 2,
        y: -30,
        width: width,
        height: 20,
        speed: 1 + Math.random() * (score / 5000), // Speed up based on score
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        type: type,
        vx: (Math.random() - 0.5) * 2 // Side movement
    });
}

function createExplosion(x, y, color) {
    for (let i = 0; i < 8; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            life: 20,
            color: color
        });
    }
}

function update(dt) {
    if (gameState !== 'PLAYING') return;

    // Player Movement
    if (activeActions.left) player.x -= player.speed;
    if (activeActions.right) player.x += player.speed;
    
    // Clamp player
    player.x = Math.max(player.width/2 + PADDING, Math.min(CANVAS_WIDTH - player.width/2 - PADDING, player.x));

    // Update Bullets
    bullets.forEach((b, i) => {
        b.y -= b.speed;
        if (b.y < -20) bullets.splice(i, 1);
    });

    // Update Enemies
    enemies.forEach((e, i) => {
        e.y += e.speed;
        
        // Horizontal logic
        if (e.type === 'WANDERER') {
            e.x += e.vx;
            if (e.x < 20 || e.x > CANVAS_WIDTH - 20) e.vx *= -1;
        }

        // Collision with bullets
        bullets.forEach((b, bi) => {
            if (Math.abs(b.x - e.x) < (b.width + e.width)/2 && 
                Math.abs(b.y - e.y) < (b.height + e.height)/2) {
                
                bullets.splice(bi, 1);
                enemies.splice(i, 1);
                createExplosion(e.x, e.y, e.color);
                explosionSound();
                
                // Score logic
                score += 100 * multiplier;
                multiplier = Math.min(10, multiplier + 0.1);
                multTimer = 0;
            }
        });

        // Fail condition: Enemy touches bottom
        if (e.y > CANVAS_HEIGHT - 10) {
            endGame();
        }
    });

    // Update Particles
    particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        if (p.life <= 0) particles.splice(i, 1);
    });

    // Spawn Logic
    spawnTimer += dt;
    if (spawnTimer > spawnInterval) {
        spawnEnemy();
        spawnTimer = 0;
        spawnInterval = Math.max(300, 1000 - (score / 100)); // Get harder
    }

    // Multiplier cooldown
    multTimer += dt;
    if (multTimer > 2000) {
        multiplier = Math.max(1, multiplier - 0.01);
    }

    // Update HUD
    scoreEl.innerText = String(Math.floor(score)).padStart(6, '0');
    multEl.innerText = `x${multiplier.toFixed(1)}`;
}

function draw() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw Space Grid (Atari style)
    ctx.strokeStyle = '#1e113a';
    ctx.lineWidth = 1;
    for(let i=0; i < CANVAS_WIDTH; i += 40) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, CANVAS_HEIGHT); ctx.stroke();
    }
    for(let i=0; i < CANVAS_HEIGHT; i += 40) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(CANVAS_WIDTH, i); ctx.stroke();
    }

    // Draw Earth Atmosphere Line
    ctx.fillStyle = '#ff3e3e';
    ctx.fillRect(0, CANVAS_HEIGHT - 5, CANVAS_WIDTH, 5);
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ff3e3e';

    // Draw Player (Pixel style)
    ctx.shadowBlur = 15;
    ctx.shadowColor = player.color;
    ctx.fillStyle = player.color;
    
    // Player body
    ctx.fillRect(player.x - 16, player.y - 8, 32, 16);
    ctx.fillRect(player.x - 4, player.y - 16, 8, 8); // Tip
    ctx.fillStyle = '#fff';
    ctx.fillRect(player.x - 12, player.y - 4, 4, 8); // Wings detail
    ctx.fillRect(player.x + 8, player.y - 4, 4, 8);

    // Draw Bullets
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#fff';
    ctx.fillStyle = '#fff';
    bullets.forEach(b => {
        ctx.fillRect(b.x - b.width/2, b.y, b.width, b.height);
    });

    // Draw Enemies (Monsters)
    enemies.forEach(e => {
        ctx.shadowBlur = 15;
        ctx.shadowColor = e.color;
        ctx.fillStyle = e.color;
        
        // Draw pixelated monster
        ctx.fillRect(e.x - 15, e.y - 10, 30, 20);
        // Eyes
        ctx.fillStyle = 'black';
        ctx.fillRect(e.x - 8, e.y - 4, 4, 4);
        ctx.fillRect(e.x + 4, e.y - 4, 4, 4);
        // Legs/Tentacles
        ctx.fillStyle = e.color;
        const bounce = Math.sin(Date.now() / 100) * 5;
        ctx.fillRect(e.x - 12, e.y + 10, 6, 4 + bounce);
        ctx.fillRect(e.x + 6, e.y + 10, 6, 4 - bounce);
    });

    // Draw Particles
    ctx.shadowBlur = 0;
    particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 4, 4);
    });
}

function gameLoop(timestamp) {
    const dt = timestamp - lastTime;
    lastTime = timestamp;

    update(dt);
    draw();

    requestAnimationFrame(gameLoop);
}

function startGame() {
    score = 0;
    multiplier = 1;
    enemies = [];
    bullets = [];
    particles = [];
    spawnInterval = 1000;
    gameState = 'PLAYING';
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    
    // Initialize audio context on first interaction
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function endGame() {
    gameState = 'GAMEOVER';
    failSound();
    gameOverScreen.classList.remove('hidden');
    finalScoreEl.innerText = Math.floor(score);
}

startBtn.onclick = startGame;
retryBtn.onclick = startGame;

requestAnimationFrame(gameLoop);
