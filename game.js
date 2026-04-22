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

        this.player = { x: 60, y: 180, w: 26, h: 40, vy: 0, jumping: false };
        this.groundY = 220;
        this.gravity = 0.7;
        this.jumpPower = -12;
        this.speed = 6;
        this.obstacles = [];
        this.score = 0;
        this.bestScore = this.loadBestScore();
        this.gameOver = false;
        this.lastObstacleTick = 0;
        this.tick = 0;

        this.bestScoreElement.textContent = this.bestScore;

        this.bindEvents();
        this.loop();
    }

    bindEvents() {
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                this.jump();
            }
        });

        this.canvas.addEventListener('click', () => this.jump());
        this.restartBtn.addEventListener('click', () => this.reset());
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
        const unlockedIds = new Set(achievements.map(a => a.id));
        let unlockedNow = 0;

        configs.forEach(config => {
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

    jump() {
        if (this.gameOver) {
            return;
        }
        if (!this.player.jumping) {
            this.player.vy = this.jumpPower;
            this.player.jumping = true;
        }
    }

    reset() {
        this.player.y = 180;
        this.player.vy = 0;
        this.player.jumping = false;
        this.obstacles = [];
        this.score = 0;
        this.tick = 0;
        this.lastObstacleTick = 0;
        this.speed = 6;
        this.gameOver = false;
    }

    spawnObstacle() {
        const h = 24 + Math.random() * 36;
        const w = 18 + Math.random() * 14;
        this.obstacles.push({
            x: this.canvas.width + 20,
            y: this.groundY - h,
            w,
            h
        });
    }

    update() {
        if (this.gameOver) return;

        this.tick++;
        this.score += 1;
        this.speed = 6 + Math.min(6, this.score / 250);
        this.scoreElement.textContent = this.score;

        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            this.bestScoreElement.textContent = this.bestScore;
            this.saveBestScore();
        }

        this.player.vy += this.gravity;
        this.player.y += this.player.vy;
        if (this.player.y >= 180) {
            this.player.y = 180;
            this.player.vy = 0;
            this.player.jumping = false;
        }

        const obstacleInterval = Math.max(55, 120 - this.score / 20);
        if (this.tick - this.lastObstacleTick > obstacleInterval) {
            this.spawnObstacle();
            this.lastObstacleTick = this.tick;
        }

        this.obstacles.forEach(ob => {
            ob.x -= this.speed;
        });
        this.obstacles = this.obstacles.filter(ob => ob.x + ob.w > -20);

        this.obstacles.forEach(ob => {
            const hit =
                this.player.x < ob.x + ob.w &&
                this.player.x + this.player.w > ob.x &&
                this.player.y < ob.y + ob.h &&
                this.player.y + this.player.h > ob.y;
            if (hit) {
                this.gameOver = true;
                this.unlockAchievement(this.score);
                window.AppUI.toast(`游戏结束，得分 ${this.score} 分`, 'warning');
            }
        });
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.fillStyle = '#e8f5e8';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.strokeStyle = '#90a4ae';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.groundY);
        this.ctx.lineTo(this.canvas.width, this.groundY);
        this.ctx.stroke();

        this.ctx.fillStyle = '#1e88e5';
        this.ctx.fillRect(this.player.x, this.player.y, this.player.w, this.player.h);
        this.ctx.fillStyle = '#fff';
        this.ctx.fillRect(this.player.x + 17, this.player.y + 8, 4, 4);

        this.ctx.fillStyle = '#455a64';
        this.obstacles.forEach(ob => {
            this.ctx.fillRect(ob.x, ob.y, ob.w, ob.h);
        });

        if (this.gameOver) {
            this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = 'bold 30px Microsoft YaHei';
            this.ctx.fillText('游戏结束', this.canvas.width / 2 - 65, 100);
            this.ctx.font = '18px Microsoft YaHei';
            this.ctx.fillText(`本次得分：${this.score}`, this.canvas.width / 2 - 55, 140);
            this.ctx.fillText('点击“重新开始”再来一局', this.canvas.width / 2 - 95, 170);
        }
    }

    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new RunnerGame();
});
