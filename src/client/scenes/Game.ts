import { Scene } from 'phaser';
import * as Phaser from 'phaser';
import type { GameInitResponse, PlacedPiece, PieceKind } from '../../shared/api';
import { fetchBoardState, fetchUserStatus, placePiece, fetchLeaderboard, submitRunScore } from '../api';
import { MarblePool } from '../physics/MarblePool';
import { PIECE_DEFINITIONS } from '../physics/PieceTypes';
import { playPlacementSound, playScoreSound, playSimulationStartSound, playRoundEndSound } from '../utils/AudioManager';

const FIXED_DELTA = 1000 / 60;
const MAX_DELTA = 100;
const SPAWN_ZONE_Y = 40;
const GOAL_COUNT = 4;
const BOARD_WIDTH = 800;
const BOARD_HEIGHT = 600;
const MARBLE_COUNT = 50;

type PieceBody = {
  piece: PlacedPiece;
  bodies: Phaser.Physics.Matter.Sprite[];
};

type GravityWellData = {
  x: number;
  y: number;
  pullRadius: number;
};

function usernameFromUserId(userId: string): string {
  const parts = userId.split(':');
  return parts.slice(1).join(':') || 'unknown';
}

export class Game extends Scene {
  private camera: Phaser.Cameras.Scene2D.Camera;
  private background: Phaser.GameObjects.Image;
  private marblePool: MarblePool;
  private accumulator: number = 0;
  private isSimulating: boolean = false;
  private initData: GameInitResponse | null = null;
  private placedBodies: PieceBody[] = [];
  private userDailyPiece: PieceKind | null = null;
  private hasPlacedToday: boolean = false;
  private placementActive: boolean = false;
  private previewSprite: Phaser.GameObjects.Sprite | null = null;
  private currentRunScore: number = 0;
  private roundEnded: boolean = false;
  private placementRotation: number = 0;
  private gravityWells: GravityWellData[] = [];
  private spriteToUser: Map<Phaser.GameObjects.Sprite, string> = new Map();
  private countdownInterval: ReturnType<typeof setInterval> | null = null;
  private boardRefreshInterval: ReturnType<typeof setInterval> | null = null;
  private tutorialActive: boolean = false;
  private tutorialStep: number = 0;
  private tutorialOverlay: HTMLDivElement | null = null;

  constructor() {
    super('Game');
  }

  init(data: { initData: GameInitResponse }): void {
    this.initData = data.initData;
    this.accumulator = 0;
    this.isSimulating = false;
    this.placedBodies = [];
    this.userDailyPiece = null;
    this.hasPlacedToday = false;
    this.placementActive = false;
    this.previewSprite = null;
    this.currentRunScore = 0;
    this.roundEnded = false;
    this.placementRotation = 0;
    this.gravityWells = [];
    this.spriteToUser = new Map();
    this.stopCountdown();
    this.stopBoardRefresh();
    this.destroyTutorial();

    const btn = document.getElementById('simulate-btn');
    if (btn) {
      btn.textContent = 'Simulate';
    }
  }

  async create() {
    this.camera = this.cameras.main;
    this.camera.setBackgroundColor(0x1a1a2e);

    this.background = this.add.image(512, 384, 'background').setAlpha(0.15);

    const grid = this.add.graphics();
    grid.lineStyle(1, 0xffffff, 0.03);
    for (let x = 0; x < BOARD_WIDTH; x += 40) {
      grid.lineBetween(x, 0, x, BOARD_HEIGHT);
    }
    for (let y = 0; y < BOARD_HEIGHT; y += 40) {
      grid.lineBetween(0, y, BOARD_WIDTH, y);
    }
    grid.setDepth(-2);

    this.matter.world.autoUpdate = false;

    this.setupBoundaries();
    this.setupGoalZones();
    this.setupSpawnZone();
    this.setupCollisionHandler();

    this.marblePool = new MarblePool(this);

    const overlay = document.getElementById('game-overlay');
    if (overlay) {
      overlay.style.display = 'flex';
    }

    this.wireSimulateButton();
    this.wireLeaderboardToggle();
    this.wireRotateButton();
    this.wireHelpButton();

    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.cameras.resize(gameSize.width, gameSize.height);
      if (this.background) {
        this.background.setPosition(gameSize.width / 2, gameSize.height / 2);
        const scale = Math.max(
          gameSize.width / this.background.width,
          gameSize.height / this.background.height,
        );
        this.background.setScale(scale);
      }
    });

    await this.loadBoard();
    await this.loadUserStatus();
  }

  override update(_time: number, delta: number): void {
    if (!this.isSimulating) return;

    this.accumulator += Math.min(delta, MAX_DELTA);

    while (this.accumulator >= FIXED_DELTA) {
      this.applyGravityWells();
      this.matter.world.step(FIXED_DELTA);
      this.accumulator -= FIXED_DELTA;
    }

    this.recycleOffscreenMarbles();

    if (!this.roundEnded && this.marblePool.getActiveCount() === 0) {
      void this.handleRoundEnd();
    }
  }

  private async loadBoard(): Promise<void> {
    try {
      const data = await fetchBoardState();
      for (const piece of data.pieces) {
        if (piece.userId !== `${this.initData?.postId}:${this.initData?.username}`) {
          this.renderPiece(piece);
        }
      }
    } catch (err) {
      console.error('Failed to load board:', err);
    }
  }

  private async refreshBoard(): Promise<void> {
    try {
      const data = await fetchBoardState();
      const existingIds = new Set(this.placedBodies.map((pb) => pb.piece.userId));
      for (const piece of data.pieces) {
        if (!existingIds.has(piece.userId)) {
          this.renderPiece(piece);
          existingIds.add(piece.userId);
        }
      }
    } catch (e) {
      console.debug('Board refresh failed:', e);
    }
  }

  private startBoardRefresh(): void {
    this.stopBoardRefresh();
    this.boardRefreshInterval = setInterval(() => {
      void this.refreshBoard();
    }, 60000);
  }

  private stopBoardRefresh(): void {
    if (this.boardRefreshInterval !== null) {
      clearInterval(this.boardRefreshInterval);
      this.boardRefreshInterval = null;
    }
  }

  private async loadUserStatus(): Promise<void> {
    try {
      const data = await fetchUserStatus();
      this.userDailyPiece = data.profile.dailyPiece;
      this.hasPlacedToday = data.profile.lastPlacementDate !== '';

      this.updateInventoryUI();
      this.updatePlacementStatus();

      if (!this.hasPlacedToday && this.userDailyPiece) {
        this.enterPlacementMode();
      }

      if (this.hasPlacedToday) {
        this.startCountdown();
        this.startBoardRefresh();
      }
    } catch (err) {
      console.error('Failed to load user status:', err);
    }
  }

  private renderPiece(piece: PlacedPiece): void {
    const def = PIECE_DEFINITIONS[piece.type];
    if (!def) return;

    const texKey = `piece_${piece.type}`;
    const shapeOptions =
      piece.type === 'bumper'
        ? { shape: { type: 'circle' as const, radius: 20 } }
        : piece.type === 'gravity_well'
          ? { shape: { type: 'circle' as const, radius: 30 } }
          : {};

    const isWell = piece.type === 'gravity_well';

    const sprite = this.matter.add.sprite(piece.x, piece.y, texKey, undefined, {
      isStatic: true,
      isSensor: isWell,
      label: def.label,
      friction: def.friction,
      restitution: def.restitution,
      density: def.density,
      collisionFilter: {
        category: 0x0001,
        mask: 0x0002,
      },
      ...shapeOptions,
    });

    sprite.setRotation(piece.rotation);
    sprite.setDepth(0);

    this.placedBodies.push({ piece, bodies: [sprite] });

    if (isWell) {
      this.gravityWells.push({ x: piece.x, y: piece.y, pullRadius: 120 });
      this.add.circle(piece.x, piece.y, 120, 0x9b59b6, 0.08)
        .setStrokeStyle(1, 0x9b59b6, 0.3)
        .setDepth(-1);
    }

    const displayName = usernameFromUserId(piece.userId);
    this.spriteToUser.set(sprite, displayName);

    sprite.setInteractive();
    sprite.on('pointerover', () => {
      if (this.isSimulating) return;
      const status = document.getElementById('placement-status');
      if (status) {
        status.textContent = `${def.label} (placed by u/${displayName})`;
        status.style.color = '#ccc';
      }
    });
    sprite.on('pointerout', () => {
      this.updatePlacementStatus();
    });
  }

  private renderOwnPiece(piece: PlacedPiece): void {
    this.renderPiece(piece);

    const def = PIECE_DEFINITIONS[piece.type];
    if (!def) return;

    const colors: Record<PieceKind, string> = {
      ramp: '#8b4513',
      bumper: '#ff4444',
      gravity_well: '#9b59b6',
      slide: '#3498db',
      block: '#555555',
    };

    const inv = document.getElementById('piece-inventory');
    if (inv) {
      inv.innerHTML = `<span class="piece-icon" style="background:${colors[piece.type] ?? '#888'}"></span><span class="piece-label">Placed ${def.label}</span>`;
    }
  }

  private enterPlacementMode(): void {
    this.placementActive = true;
    this.placementRotation = 0;

    const rotateBtn = document.getElementById('rotate-btn');
    if (rotateBtn) {
      rotateBtn.classList.remove('hidden');
    }

    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerdown', this.onPointerDown, this);

    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-R', this.onKeyR, this);
    }

    this.showTutorialStep(1);
  }

  private exitPlacementMode(): void {
    this.placementActive = false;
    this.destroyTutorial();

    const rotateBtn = document.getElementById('rotate-btn');
    if (rotateBtn) {
      rotateBtn.classList.add('hidden');
    }

    this.input.off('pointermove', this.onPointerMove, this);
    this.input.off('pointerdown', this.onPointerDown, this);

    if (this.input.keyboard) {
      this.input.keyboard.off('keydown-R', this.onKeyR, this);
    }

    if (this.previewSprite) {
      this.previewSprite.destroy();
      this.previewSprite = null;
    }
  }

  private onKeyR = (): void => {
    if (!this.placementActive) return;

    this.placementRotation += Math.PI / 4;

    if (this.previewSprite) {
      this.previewSprite.setRotation(this.placementRotation);
    }
  };

  private onPointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (!this.placementActive || !this.userDailyPiece) return;

    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

    if (!this.previewSprite) {
      const texKey = `piece_${this.userDailyPiece}`;
      if (this.textures.exists(texKey)) {
        this.previewSprite = this.add.sprite(worldPoint.x, worldPoint.y, texKey);
        this.previewSprite.setAlpha(0.6);
        this.previewSprite.setDepth(5);
      }
    } else {
      this.previewSprite.setPosition(worldPoint.x, worldPoint.y);
    }
  };

  private onPointerDown = async (pointer: Phaser.Input.Pointer): Promise<void> => {
    if (!this.placementActive || !this.userDailyPiece) return;

    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const x = Phaser.Math.Clamp(worldPoint.x, 20, BOARD_WIDTH - 20);
    const y = Phaser.Math.Clamp(worldPoint.y, 60, BOARD_HEIGHT - 60);

    try {
      await placePiece({
        type: this.userDailyPiece,
        x,
        y,
        rotation: this.placementRotation,
      });

      this.hasPlacedToday = true;
      this.renderOwnPiece({
        type: this.userDailyPiece,
        x,
        y,
        rotation: this.placementRotation,
        userId: '',
      });
      this.exitPlacementMode();
      this.updatePlacementStatus();
      this.updateInventoryUI();
      playPlacementSound();
      this.startCountdown();
      this.startBoardRefresh();
    } catch (err) {
      console.error('Failed to place piece:', err);
      const status = document.getElementById('placement-status');
      if (status) {
        status.textContent = 'Placement failed. Try again.';
        status.style.color = '#ff4444';
      }
    }
  };

  private updateInventoryUI(): void {
    const inv = document.getElementById('piece-inventory');
    if (!inv) return;

    const colors: Record<PieceKind, string> = {
      ramp: '#8b4513',
      bumper: '#ff4444',
      gravity_well: '#9b59b6',
      slide: '#3498db',
      block: '#555555',
    };

    if (this.hasPlacedToday) {
      inv.innerHTML = '<span style="color:#888">Piece placed today</span>';
    } else if (this.userDailyPiece) {
      const color = colors[this.userDailyPiece] ?? '#888';
      const def = PIECE_DEFINITIONS[this.userDailyPiece];
      const name = def?.label ?? this.userDailyPiece;
      inv.innerHTML = `<span class="piece-icon" style="background:${color}"></span><span class="piece-label">${name}</span>`;
    } else {
      inv.innerHTML = '<span style="color:#888">No piece today</span>';
    }
  }

  private updatePlacementStatus(): void {
    const status = document.getElementById('placement-status');
    if (!status) return;

    if (this.isSimulating) {
      status.textContent = 'Simulation running';
      status.style.color = '#fff';
    } else if (this.tutorialActive) {
      return;
    } else if (this.hasPlacedToday) {
      this.updateCountdownDisplay();
    } else if (this.userDailyPiece) {
      const def = PIECE_DEFINITIONS[this.userDailyPiece];
      const name = def?.label ?? this.userDailyPiece;
      status.textContent = `Tap to place your ${name}. Press R or tap Rotate to spin.`;
      status.style.color = '#2ecc71';
    } else {
      status.textContent = 'Loading...';
      status.style.color = '#888';
    }
  }

  private async refreshLeaderboard(): Promise<void> {
    const container = document.getElementById('leaderboard-entries');
    if (!container) return;

    try {
      const data = await fetchLeaderboard();
      if (data.entries.length === 0) {
        container.innerHTML = '<div class="leaderboard-empty">No scores yet</div>';
        return;
      }

      container.innerHTML = data.entries
        .map(
          (entry, i) =>
            `<div class="leaderboard-row">
              <span class="lb-rank">${i + 1}</span>
              <span class="lb-name">${entry.username}</span>
              <span class="lb-score">${entry.score}</span>
            </div>`,
        )
        .join('');
    } catch (e) {
      console.debug('Leaderboard refresh failed:', e);
      container.innerHTML = '<div class="leaderboard-empty">Failed to load</div>';
    }
  }

  private updateScoreDisplay(): void {
    const display = document.getElementById('score-display');
    if (display) {
      if (this.isSimulating) {
        display.textContent = `Run: ${this.currentRunScore}`;
      } else {
        display.textContent = `Score: ${this.currentRunScore}`;
      }
    }
  }

  private async handleRoundEnd(): Promise<void> {
    this.roundEnded = true;
    this.isSimulating = false;

    const score = this.currentRunScore;

    const status = document.getElementById('placement-status');
    if (status) {
      if (score > 0) {
        status.textContent = `Round complete! +${score} points`;
        status.style.color = '#ffd700';
      } else {
        status.textContent = 'Round complete. No marbles scored.';
        status.style.color = '#888';
      }
    }

    if (score > 0) {
      try {
        await submitRunScore({ score });
      } catch (err) {
        console.error('Failed to submit score:', err);
      }
    }

    const display = document.getElementById('score-display');
    if (display) {
      display.textContent = `Submitted: ${score}!`;
      setTimeout(() => {
        this.updateScoreDisplay();
      }, 2000);
    }

    const panel = document.getElementById('leaderboard-panel');
    const wasVisible = panel?.classList.contains('visible');
    if (wasVisible) {
      await this.refreshLeaderboard();
    }

    const btn = document.getElementById('simulate-btn');
    if (btn) {
      btn.textContent = 'Reset';
    }

    playRoundEndSound();

    await this.refreshBoard();
  }

  private applyGravityWells(): void {
    if (this.gravityWells.length === 0) return;

    const pool = this.marblePool;
    for (let i = 0; i < pool.getPoolSize(); i++) {
      const marble = pool.getAt(i);
      if (!marble || !marble.active) continue;

      const body = marble.body as MatterJS.BodyType;
      if (!body) continue;

      for (const well of this.gravityWells) {
        const dx = well.x - body.position.x;
        const dy = well.y - body.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > well.pullRadius || dist < 1) continue;

        const strength = 0.0015;
        const forceMag = strength / (dist * dist + 1);
        const nx = dx / dist;
        const ny = dy / dist;

        body.force.x += nx * forceMag;
        body.force.y += ny * forceMag;
      }
    }
  }

  private wireLeaderboardToggle(): void {
    let toggle = document.getElementById('leaderboard-toggle');
    const panel = document.getElementById('leaderboard-panel');
    if (!toggle || !panel) return;

    const newToggle = toggle.cloneNode(true) as HTMLElement;
    toggle.parentNode?.replaceChild(newToggle, toggle);
    toggle = newToggle;

    toggle.addEventListener('click', async () => {
      const isVisible = panel.classList.toggle('visible');
      if (isVisible) {
        await this.refreshLeaderboard();
      }
    });
  }

  private recycleOffscreenMarbles(): void {
    const pool = this.marblePool;
    for (let i = 0; i < pool.getPoolSize(); i++) {
      const marble = pool.getAt(i);
      if (marble && marble.active && marble.y > BOARD_HEIGHT + 50) {
        pool.release(marble);
      }
    }
  }

  private wireRotateButton(): void {
    let btn = document.getElementById('rotate-btn');
    if (!btn) return;

    const newBtn = btn.cloneNode(true) as HTMLElement;
    btn.parentNode?.replaceChild(newBtn, btn);
    btn = newBtn;

    btn.addEventListener('click', () => {
      this.onKeyR();
    });
  }

  private wireHelpButton(): void {
    let btn = document.getElementById('help-btn');
    let closeBtn = document.getElementById('close-help-btn');
    const modal = document.getElementById('help-modal');
    const leaderboard = document.getElementById('leaderboard-panel');
    if (!btn || !closeBtn || !modal) return;

    const newBtn = btn.cloneNode(true) as HTMLElement;
    btn.parentNode?.replaceChild(newBtn, btn);
    btn = newBtn;

    const newCloseBtn = closeBtn.cloneNode(true) as HTMLElement;
    closeBtn.parentNode?.replaceChild(newCloseBtn, closeBtn);
    closeBtn = newCloseBtn;

    btn.addEventListener('click', () => {
      modal.classList.remove('hidden');
      if (leaderboard) leaderboard.classList.remove('visible');
    });
    closeBtn.addEventListener('click', () => {
      modal.classList.add('hidden');
    });
  }

  private wireSimulateButton(): void {
    let btn = document.getElementById('simulate-btn');
    if (!btn) return;

    const newBtn = btn.cloneNode(true) as HTMLElement;
    btn.parentNode?.replaceChild(newBtn, btn);
    btn = newBtn;

    btn.addEventListener('click', () => {
      if (this.isSimulating) {
        this.stopSimulation();
        btn.textContent = 'Simulate';
      } else {
        this.startSimulation();
        btn.textContent = 'Reset';
      }
      this.updatePlacementStatus();
    });
  }

  private setupBoundaries(): void {
    const walls = [
      { x: BOARD_WIDTH / 2, y: -10, w: BOARD_WIDTH + 20, h: 20 },
      { x: -10, y: BOARD_HEIGHT / 2, w: 20, h: BOARD_HEIGHT + 40 },
      { x: BOARD_WIDTH + 10, y: BOARD_HEIGHT / 2, w: 20, h: BOARD_HEIGHT + 40 },
    ];

    for (const wall of walls) {
      this.matter.add.rectangle(wall.x, wall.y, wall.w, wall.h, {
        isStatic: true,
        collisionFilter: {
          category: 0x0001,
          mask: 0x0002,
        },
        friction: 0.5,
        restitution: 0.1,
      });
    }
  }

  private setupGoalZones(): void {
    const goalWidth = BOARD_WIDTH / GOAL_COUNT;
    const goalY = BOARD_HEIGHT - 20;
    const colors = [0x2ecc71, 0x3498db, 0xe74c3c, 0xf39c12];

    for (let i = 0; i < GOAL_COUNT; i++) {
      const gx = goalWidth * i + goalWidth / 2;
      this.matter.add.rectangle(gx, goalY, goalWidth - 10, 20, {
        isStatic: true,
        isSensor: true,
        label: `goal_${i}`,
        collisionFilter: {
          category: 0x0004,
          mask: 0x0002,
        },
      });

      this.add.rectangle(gx, goalY, goalWidth - 10, 20, colors[i]!, 0.6)
        .setDepth(-1);
    }
  }

  private setupSpawnZone(): void {
    this.matter.add.rectangle(BOARD_WIDTH / 2, SPAWN_ZONE_Y, BOARD_WIDTH - 40, 20, {
      isStatic: true,
      isSensor: true,
      label: 'spawn_zone',
      collisionFilter: {
        category: 0x0008,
        mask: 0x0002,
      },
    });

    this.add.rectangle(BOARD_WIDTH / 2, SPAWN_ZONE_Y, BOARD_WIDTH - 40, 4, 0xffffff, 0.3)
      .setDepth(-1);
  }

  private setupCollisionHandler(): void {
    const goalScores = [10, 25, 50, 100];

    this.matter.world.on('collisionstart', (event: { pairs: Array<{ bodyA: { label: string; gameObject?: Phaser.Physics.Matter.Image | null }; bodyB: { label: string; gameObject?: Phaser.Physics.Matter.Image | null } }> }) => {
      for (const pair of event.pairs) {
        const { bodyA, bodyB } = pair;

        const marbleBody = bodyA?.label === 'marble' ? bodyA : bodyB?.label === 'marble' ? bodyB : null;
        const goalBody = bodyA?.label?.startsWith('goal_') ? bodyA : bodyB?.label?.startsWith('goal_') ? bodyB : null;

        if (marbleBody && goalBody) {
          const marbleGO = marbleBody.gameObject;
          if (marbleGO && marbleGO.active) {
            const goalIndex = parseInt(goalBody.label.replace('goal_', ''), 10);
            const points = goalScores[goalIndex] ?? 10;

            this.currentRunScore += points;
            this.updateScoreDisplay();
            this.spawnScoreParticles(parseInt(goalBody.label.replace('goal_', ''), 10));
            playScoreSound();

            this.marblePool.release(marbleGO);
          }
        }
      }
    });
  }

  private spawnScoreParticles(goalIndex: number): void {
    const goalWidth = BOARD_WIDTH / GOAL_COUNT;
    const gx = goalWidth * goalIndex + goalWidth / 2;
    const gy = BOARD_HEIGHT - 20;
    const colors = [0x2ecc71, 0x3498db, 0xe74c3c, 0xf39c12];

    for (let i = 0; i < 8; i++) {
      const p = this.add.circle(gx, gy, 3, colors[goalIndex] ?? 0xffd700, 1);
      p.setDepth(10);
      this.tweens.add({
        targets: p,
        x: gx + Phaser.Math.Between(-60, 60),
        y: gy + Phaser.Math.Between(-80, -20),
        alpha: 0,
        scale: 0,
        duration: Phaser.Math.Between(400, 700),
        ease: 'Power2',
        onComplete: () => p.destroy(),
      });
    }
  }

  private startCountdown(): void {
    this.stopCountdown();
    this.countdownInterval = setInterval(() => {
      this.updateCountdownDisplay();
    }, 1000);
    this.updateCountdownDisplay();
  }

  private stopCountdown(): void {
    if (this.countdownInterval !== null) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  private updateCountdownDisplay(): void {
    const status = document.getElementById('placement-status');
    if (!status) return;

    if (this.isSimulating || this.placementActive) return;

    const now = new Date();
    const utcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    const diffMs = utcMidnight.getTime() - now.getTime();
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);
    status.textContent = `Next board in: ${hours}h ${minutes}m ${seconds}s`;
    status.style.color = '#888';
  }

  private showTutorialStep(step: number): void {
    this.tutorialActive = true;
    this.tutorialStep = step;
    this.destroyTutorial();

    const overlay = document.createElement('div');
    overlay.id = 'tutorial-overlay';

    const steps = [
      {
        text: 'This is your daily piece! Tap the board to place it.',
        highlight: 'piece-inventory',
        pos: 'bottom',
      },
      {
        text: 'Press R or tap Rotate to spin your piece before placing.',
        highlight: 'rotate-btn',
        pos: 'top',
      },
      {
        text: 'Press Simulate to drop marbles and test your machine!',
        highlight: 'simulate-btn',
        pos: 'top',
      },
      {
        text: 'Open the Leaderboard to see how you rank.',
        highlight: 'leaderboard-toggle',
        pos: 'bottom',
      },
    ];

    const s = steps[step - 1];
    if (!s) {
      this.tutorialActive = false;
      return;
    }

    overlay.innerHTML = `
      <div class="tutorial-backdrop"></div>
      <div class="tutorial-box">
        <p>${s.text}</p>
        <button id="tutorial-next-btn">${step < steps.length ? 'Next' : 'Got it!'}</button>
      </div>
    `;
    document.getElementById('app')?.appendChild(overlay);
    this.tutorialOverlay = overlay;

    const nextBtn = document.getElementById('tutorial-next-btn');
    if (nextBtn) {
      const newBtn = nextBtn.cloneNode(true) as HTMLElement;
      nextBtn.parentNode?.replaceChild(newBtn, nextBtn);
      newBtn.addEventListener('click', () => {
        if (step < steps.length) {
          this.showTutorialStep(step + 1);
        } else {
          this.destroyTutorial();
        }
      });
    }
  }

  private destroyTutorial(): void {
    this.tutorialActive = false;
    this.tutorialStep = 0;
    if (this.tutorialOverlay) {
      this.tutorialOverlay.remove();
      this.tutorialOverlay = null;
    }
  }

  startSimulation(): void {
    this.accumulator = 0;
    this.isSimulating = true;
    this.currentRunScore = 0;
    this.roundEnded = false;

    this.updateScoreDisplay();

    if (this.placementActive) {
      this.exitPlacementMode();
    }

    for (let i = 0; i < MARBLE_COUNT; i++) {
      const x = Phaser.Math.Between(100, BOARD_WIDTH - 100);
      const marble = this.marblePool.spawn(x, SPAWN_ZONE_Y);
      if (!marble) break;
    }

    playSimulationStartSound();
  }

  stopSimulation(): void {
    this.isSimulating = false;
    this.marblePool.releaseAll();
  }
}
