import { Scene } from 'phaser';
import * as Phaser from 'phaser';
import type { GameInitResponse, PlacedPiece, PieceKind } from '../../shared/api';
import { fetchBoardState, fetchUserStatus, placePiece, fetchLeaderboard, submitRunScore } from '../api';
import { MarblePool } from '../physics/MarblePool';
import { PIECE_DEFINITIONS } from '../physics/PieceTypes';

const FIXED_DELTA = 1000 / 60;
const SPAWN_ZONE_Y = 40;
const GOAL_COUNT = 4;
const BOARD_WIDTH = 800;
const BOARD_HEIGHT = 600;

type PieceBody = {
  piece: PlacedPiece;
  bodies: Phaser.Physics.Matter.Sprite[];
};

type GravityWellData = {
  x: number;
  y: number;
  pullRadius: number;
};

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

    const btn = document.getElementById('simulate-btn');
    if (btn) {
      btn.textContent = 'Simulate';
    }
  }

  async create() {
    this.camera = this.cameras.main;
    this.camera.setBackgroundColor(0x1a1a2e);

    this.background = this.add.image(512, 384, 'background').setAlpha(0.15);

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

    this.accumulator += delta;

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
      this.add.circle(piece.x, piece.y, 120, 0x9b59b6, 0.03)
        .setStrokeStyle(1, 0x9b59b6, 0.15)
        .setDepth(-1);
    }
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
  }

  private exitPlacementMode(): void {
    this.placementActive = false;

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
    } else if (this.hasPlacedToday) {
      status.textContent = 'Come back tomorrow for a new piece';
      status.style.color = '#888';
    } else if (this.userDailyPiece) {
      const def = PIECE_DEFINITIONS[this.userDailyPiece];
      const name = def?.label ?? this.userDailyPiece;
      status.textContent = `Tap the board to place your ${name}`;
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
    } catch {
      container.innerHTML = '<div class="leaderboard-empty">Failed to load</div>';
    }
  }

  private updateScoreDisplay(): void {
    const display = document.getElementById('score-display');
    if (display) {
      display.textContent = `Score: ${this.currentRunScore}`;
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

    const panel = document.getElementById('leaderboard-panel');
    if (panel) {
      panel.classList.add('visible');
    }
    await this.refreshLeaderboard();

    const btn = document.getElementById('simulate-btn');
    if (btn) {
      btn.textContent = 'Reset';
    }
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

            this.marblePool.release(marbleGO);
          }
        }
      }
    });
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

    for (let i = 0; i < 50; i++) {
      const x = Phaser.Math.Between(100, BOARD_WIDTH - 100);
      const marble = this.marblePool.spawn(x, SPAWN_ZONE_Y);
      if (!marble) break;
    }
  }

  stopSimulation(): void {
    this.isSimulating = false;
    this.marblePool.releaseAll();
  }
}
