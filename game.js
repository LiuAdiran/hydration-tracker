class RunnerGame {
    constructor() {
        this.canvas = document.getElementById('runner-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.scoreElement = document.getElementById('game-score');
        this.bestScoreElement = document.getElementById('best-score');
        this.restartBtn = document.getElementById('restart-game-btn');

        this.storageKeys = {
            bestScore: 'runnerBestScore',
            achievements: 'runnerGameAchievementsData'
        };

        this.logicalWidth = 900;
        this.logicalHeight = 240;
        this.groundOffset = 32;
        this.resizeCanvas();

        this.groundY = this.canvas.height - this.groundOffset;
        this.player = {
            x: 48,
            y: this.groundY - 38,
            w: 40,
            h: 38,
            vy: 0,
            jumping: false
        };

        this.gravity = 0.72;
        this.jumpPower = -13.8;
        this.baseSpeed = 6.4;
        this.speed = this.baseSpeed;
        this.maxSpeed = 12.5;
        this.scoreScale = 0.05;
        this.distance = 0;
        this.score = 0;
        this.bestScore = this.loadBestScore();
        this.gameOver = false;
        this.hasStarted = false;

        this.obstacles = [];
        this.nextObstacleIn = this.randomObstacleGap();
        this.decorClouds = this.createClouds();
        this.groundDots = this.createGroundDots();
        this.dayNightCycle = 0;
        this.lastTimestamp = 0;

        this.bestScoreElement.textContent = this.bestScore;
        this.scoreElement.textContent = this.score;

        this.bindEvents();
        this.loop(0);
    }

    bindEvents() {
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space' || e.code === 'ArrowUp') {
                e.preventDefault();
                if (this.gameOver && e.code === 'Space') {
                    this.reset(true);
                    return;
                }
                if (!this.hasStarted) {
                    this.startGame(true);
                    return;
                }
                this.jump();
            }
        });

        this.canvas.addEventListener('click', () => {
            if (!this.hasStarted) {
                this.startGame(false);
                return;
            }
            this.jump();
        });

        this.restartBtn.addEventListener('click', () => this.reset(true));
        window.addEventListener('resize', () => this.handleResize());
    }

    resizeCanvas() {
        const cssWidth = this.canvas.clientWidth || this.logicalWidth;
        const cssHeight = (cssWidth * this.logicalHeight) / this.logicalWidth;
        this.canvas.width = Math.round(cssWidth);
        this.canvas.height = Math.round(cssHeight);
        this.ctx.imageSmoothingEnabled = false;
    }

    handleResize() {
        const oldGroundY = this.groundY;
        this.resizeCanvas();
        this.groundY = this.canvas.height - this.groundOffset;
        if (!this.player.jumping) {
            this.player.y = this.groundY - this.player.h;
        } else {
            this.player.y += this.groundY - oldGroundY;
        }
        this.groundDots = this.createGroundDots();
    }

    loadBestScore() {
        return Number(localStorage.getItem(this.storageKeys.bestScore) || 0);
    }

    saveBestScore() {
        localStorage.setItem(this.storageKeys.bestScore, String(this.bestScore));
    }

    loadAchievements() {
        return JSON.parse(localStorage.getItem(this.storageKeys.achievements) || '[]');
    }

    saveAchievements(achievements) {
        localStorage.setItem(this.storageKeys.achievements, JSON.stringify(achievements));
    }

    unlockAchievement(score) {
        const configs = [
            { id: 'runner-100', title: '初级跑者', description: '跑酷得分达到100分', icon: '🏃', threshold: 100 },
            { id: 'runner-300', title: '疾速冲刺', description: '跑酷得分达到300分', icon: '⚡', threshold: 300 },
            { id: 'runner-600', title: '极限大师', description: '跑酷得分达到600分', icon: '👑', threshold: 600 }
        ];

        const achievements = this.loadAchievements();
        const unlockedIds = new Set(achievements.map((a) => a.id));
        let unlockedNow = 0;

        configs.forEach((config) => {
            if (score >= config.threshold && !unlockedIds.has(config.id)) {
                achievements.push({
                    ...config,
                    type: 'game',
                    unlocked: true,
                    date: new Date().toISOString()
                });
                unlockedNow++;
            }
        });

        if (unlockedNow > 0) {
            this.saveAchievements(achievements);
            window.AppUI.toast(`解锁 ${unlockedNow} 个游戏成就！`, 'success');
        }
    }

    createClouds() {
        const clouds = [];
        for (let i = 0; i < 5; i++) {
            clouds.push({
                x: i * 220 + 120,
                y: 30 + Math.random() * 70,
                w: 45 + Math.random() * 30,
                speed: 0.45 + Math.random() * 0.3
            });
        }
        return clouds;
    }

    createGroundDots() {
        const dots = [];
        for (let i = 0; i < 48; i++) {
            dots.push({
                x: (i * this.canvas.width) / 48,
                y: this.groundY + 5 + Math.random() * 14,
                w: 4 + Math.random() * 10
            });
        }
        return dots;
    }

    randomObstacleGap() {
        return 240 + Math.random() * 230;
    }

    jump() {
        if (this.gameOver || !this.hasStarted) {
            return;
        }
        if (!this.player.jumping) {
            this.player.vy = this.jumpPower;
            this.player.jumping = true;
        }
    }

    startGame(shouldJump = false) {
        this.hasStarted = true;
        if (shouldJump) {
            this.jump();
        }
    }

    reset(autoStart = false) {
        this.player.y = this.groundY - this.player.h;
        this.player.vy = 0;
        this.player.jumping = false;
        this.obstacles = [];
        this.distance = 0;
        this.score = 0;
        this.speed = this.baseSpeed;
        this.nextObstacleIn = this.randomObstacleGap();
        this.gameOver = false;
        this.hasStarted = false;
        this.lastTimestamp = 0;
        if (autoStart) {
            this.startGame(false);
        }
    }

    spawnObstacle() {
        const isTall = Math.random() < 0.5;
        const h = isTall ? 48 + Math.random() * 12 : 28 + Math.random() * 10;
        const w = isTall ? 20 + Math.random() * 8 : 34 + Math.random() * 14;
        this.obstacles.push({
            x: this.canvas.width + 20,
            y: this.groundY - h,
            w,
            h
        });
    }

    drawRunner() {
        const x = this.player.x;
        const y = this.player.y;
        const runPhase = Math.floor(this.distance / 10) % 2 === 0 ? 1 : -1;
        const tailWave = Math.sin(this.distance * 0.05) * 2;

        // Tail
        this.ctx.fillStyle = '#ffb18a';
        this.ctx.fillRect(x - 8, y + 12 + tailWave, 10, 4);
        this.ctx.fillRect(x - 13, y + 10 + tailWave, 6, 4);

        // Body
        this.ctx.fillStyle = '#ffb18a';
        this.ctx.fillRect(x + 8, y + 11, 22, 15);

        // Head
        this.ctx.fillRect(x + 23, y + 4, 14, 12);
        this.ctx.fillRect(x + 24, y + 1, 4, 4);
        this.ctx.fillRect(x + 31, y + 1, 4, 4);

        // Legs
        this.ctx.fillStyle = '#f79667';
        this.ctx.fillRect(x + 10, y + 26, 5, 10 + runPhase);
        this.ctx.fillRect(x + 20, y + 26, 5, 10 - runPhase);

        // Eye and nose
        this.ctx.fillStyle = '#1f2937';
        this.ctx.fillRect(x + 33, y + 8, 2, 2);
        this.ctx.fillStyle = '#ef476f';
        this.ctx.fillRect(x + 37, y + 11, 2, 2);
    }

    update(deltaFactor) {
        if (this.gameOver || !this.hasStarted) return;

        this.dayNightCycle += 0.00055 * deltaFactor;
        this.distance += this.speed * deltaFactor;
        this.score = Math.floor(this.distance * this.scoreScale);
        this.scoreElement.textContent = this.score;

        this.speed = Math.min(this.maxSpeed, this.baseSpeed + this.score / 260);

        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            this.bestScoreElement.textContent = this.bestScore;
            this.saveBestScore();
        }

        this.player.vy += this.gravity * deltaFactor;
        this.player.y += this.player.vy * deltaFactor;
        const floorY = this.groundY - this.player.h;
        if (this.player.y >= floorY) {
            this.player.y = floorY;
            this.player.vy = 0;
            this.player.jumping = false;
        }

        this.nextObstacleIn -= this.speed * deltaFactor;
        if (this.nextObstacleIn <= 0) {
            this.spawnObstacle();
            this.nextObstacleIn = this.randomObstacleGap() - Math.min(90, this.score * 0.1);
        }

        this.obstacles.forEach((ob) => {
            ob.x -= this.speed * deltaFactor;
        });
        this.obstacles = this.obstacles.filter((ob) => ob.x + ob.w > -20);

        this.decorClouds.forEach((cloud) => {
            cloud.x -= cloud.speed * deltaFactor;
            if (cloud.x + cloud.w < -20) {
                cloud.x = this.canvas.width + 50 + Math.random() * 120;
                cloud.y = 30 + Math.random() * 70;
            }
        });

        this.groundDots.forEach((dot) => {
            dot.x -= this.speed * 0.7 * deltaFactor;
            if (dot.x + dot.w < 0) {
                dot.x = this.canvas.width + Math.random() * 60;
                dot.y = this.groundY + 5 + Math.random() * 14;
                dot.w = 4 + Math.random() * 10;
            }
        });

        const hitboxPaddingX = 3;
        const hitboxPaddingY = 2;
        this.obstacles.forEach((ob) => {
            const hit =
                this.player.x + hitboxPaddingX < ob.x + ob.w &&
                this.player.x + this.player.w - hitboxPaddingX > ob.x &&
                this.player.y + hitboxPaddingY < ob.y + ob.h &&
                this.player.y + this.player.h - hitboxPaddingY > ob.y;
            if (hit) {
                this.gameOver = true;
                this.unlockAchievement(this.score);
                window.AppUI.toast(`游戏结束，得分 ${this.score} 分`, 'warning');
            }
        });
    }

    drawSky() {
        const t = (Math.sin(this.dayNightCycle) + 1) / 2;
        const dayTop = [241, 245, 249];
        const dayBottom = [255, 255, 255];
        const nightTop = [19, 24, 39];
        const nightBottom = [45, 55, 72];

        const blend = (a, b) => Math.round(a * t + b * (1 - t));
        const top = `rgb(${blend(dayTop[0], nightTop[0])}, ${blend(dayTop[1], nightTop[1])}, ${blend(dayTop[2], nightTop[2])})`;
        const bottom = `rgb(${blend(dayBottom[0], nightBottom[0])}, ${blend(dayBottom[1], nightBottom[1])}, ${blend(dayBottom[2], nightBottom[2])})`;

        const g = this.ctx.createLinearGradient(0, 0, 0, this.groundY);
        g.addColorStop(0, top);
        g.addColorStop(1, bottom);
        this.ctx.fillStyle = g;
        this.ctx.fillRect(0, 0, this.canvas.width, this.groundY);

        const starAlpha = 1 - t;
        if (starAlpha > 0.15) {
            this.ctx.fillStyle = `rgba(255,255,255,${Math.min(0.9, starAlpha)})`;
            for (let i = 0; i < 20; i++) {
                const sx = (i * 97 + 11) % this.canvas.width;
                const sy = (i * 53 + 27) % (this.groundY - 60);
                this.ctx.fillRect(sx, sy, 2, 2);
            }
        }

        // Soft far hills for richer depth
        this.ctx.fillStyle = `rgba(171, 198, 226, ${0.2 + t * 0.18})`;
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.groundY);
        this.ctx.quadraticCurveTo(140, this.groundY - 28, 280, this.groundY);
        this.ctx.quadraticCurveTo(420, this.groundY - 24, 560, this.groundY);
        this.ctx.quadraticCurveTo(700, this.groundY - 30, this.canvas.width, this.groundY);
        this.ctx.closePath();
        this.ctx.fill();
    }

    drawGround() {
        this.ctx.strokeStyle = '#9aa5b1';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.groundY);
        this.ctx.lineTo(this.canvas.width, this.groundY);
        this.ctx.stroke();

        this.ctx.fillStyle = '#b0bac6';
        this.groundDots.forEach((dot) => {
            this.ctx.fillRect(dot.x, dot.y, dot.w, 2);
        });
    }

    drawClouds() {
        this.ctx.fillStyle = '#d2dae3';
        this.decorClouds.forEach((cloud) => {
            this.ctx.fillRect(cloud.x, cloud.y, cloud.w, 14);
            this.ctx.fillRect(cloud.x + 8, cloud.y - 6, 18, 8);
            this.ctx.fillRect(cloud.x + 26, cloud.y - 9, 20, 10);
        });
    }

    drawObstacles() {
        this.ctx.fillStyle = '#5f6b7a';
        this.obstacles.forEach((ob) => {
            this.ctx.fillRect(ob.x, ob.y, ob.w, ob.h);
            const notches = Math.max(2, Math.floor(ob.h / 14));
            for (let i = 0; i < notches; i++) {
                this.ctx.fillStyle = '#4b5563';
                this.ctx.fillRect(ob.x - 3, ob.y + i * 13 + 4, 3, 4);
            }
            this.ctx.fillStyle = '#7a8898';
            this.ctx.fillRect(ob.x + 3, ob.y + 3, Math.max(2, ob.w - 8), 3);
            this.ctx.fillStyle = '#5f6b7a';
        });
    }

    drawGameOver() {
        if (!this.gameOver) return;

        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 30px Microsoft YaHei';
        this.ctx.fillText('游戏结束', this.canvas.width / 2 - 65, 100);
        this.ctx.font = '18px Microsoft YaHei';
        this.ctx.fillText(`本次得分：${this.score}`, this.canvas.width / 2 - 58, 140);
        this.ctx.fillText('按“重新开始”或空格键继续', this.canvas.width / 2 - 108, 170);
    }

    drawStartOverlay() {
        if (this.hasStarted || this.gameOver) return;

        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.62)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = '#2f3e4f';
        this.ctx.font = 'bold 30px Microsoft YaHei';
        this.ctx.fillText('猫咪准备冲刺', this.canvas.width / 2 - 95, 95);
        this.ctx.font = '18px Microsoft YaHei';
        this.ctx.fillText('按空格键开始，或点击下方“开始游戏”', this.canvas.width / 2 - 148, 132);
        this.ctx.fillText('开始后可按空格/上键/点击画布跳跃', this.canvas.width / 2 - 145, 162);
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawSky();
        this.drawClouds();
        this.drawGround();
        this.drawRunner();
        this.drawObstacles();
        this.drawStartOverlay();
        this.drawGameOver();
    }

    loop(timestamp) {
        if (!this.lastTimestamp) {
            this.lastTimestamp = timestamp;
        }
        const delta = timestamp - this.lastTimestamp;
        this.lastTimestamp = timestamp;
        const deltaFactor = Math.min(2.3, delta / 16.67 || 1);

        this.update(deltaFactor);
        this.draw();
        requestAnimationFrame((nextTs) => this.loop(nextTs));
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new RunnerGame();
});
