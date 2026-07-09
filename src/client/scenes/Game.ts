import { Scene } from 'phaser';
import * as Phaser from 'phaser';
import type { GameInitResponse } from '../../shared/api';
import { MarblePool } from '../physics/MarblePool';

const FIXED_DELTA = 1000 / 60;
const SPAWN_ZONE_Y = 40;
const GOAL_COUNT = 4;
const BOARD_WIDTH = 800;
const BOARD_HEIGHT = 600;

export class Game extends Scene {
  private camera: Phaser.Cameras.Scene2D.Camera;
  private background: Phaser.GameObjects.Image;
  private marblePool: MarblePool;
  private accumulator: number = 0;
  private isSimulating: boolean = false;
  private initData: GameInitResponse | null = null;

  constructor() {
    super('Game');
  }

  init(data: { initData: GameInitResponse }): void {
    this.initData = data.initData;
    this.accumulator = 0;
    this.isSimulating = false;

    const btn = document.getElementById('simulate-btn');
    if (btn) {
      btn.textContent = 'Simulate';
    }
  }

  create() {
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

    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.cameras.resize(gameSize.width, gameSize.height);
      if (this.background) {
        this.background.setPosition(gameSize.width / 2, gameSize.height / 2);
        const scale = Math.max(
          gameSize.width / this.background.width,
          gameSize.height / this.background.height
        );
        this.background.setScale(scale);
      }
    });
  }

  override update(_time: number, delta: number): void {
    if (!this.isSimulating) return;

    this.accumulator += delta;

    while (this.accumulator >= FIXED_DELTA) {
      this.matter.world.step(FIXED_DELTA);
      this.accumulator -= FIXED_DELTA;
    }

    this.recycleOffscreenMarbles();
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

  private wireSimulateButton(): void {
    const btn = document.getElementById('simulate-btn');
    if (!btn) return;

    btn.addEventListener('click', () => {
      if (this.isSimulating) {
        this.stopSimulation();
        btn.textContent = 'Simulate';
      } else {
        this.startSimulation();
        btn.textContent = 'Reset';
      }
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
    this.matter.world.on('collisionstart', (event: { pairs: Array<{ bodyA: { label: string; gameObject?: Phaser.Physics.Matter.Image | null }; bodyB: { label: string; gameObject?: Phaser.Physics.Matter.Image | null } }> }) => {
      for (const pair of event.pairs) {
        const { bodyA, bodyB } = pair;

        const marbleBody = bodyA?.label === 'marble' ? bodyA : bodyB?.label === 'marble' ? bodyB : null;
        const goalBody = bodyA?.label?.startsWith('goal_') ? bodyA : bodyB?.label?.startsWith('goal_') ? bodyB : null;

        if (marbleBody && goalBody) {
          const marbleGO = marbleBody.gameObject;
          if (marbleGO && marbleGO.active) {
            this.marblePool.release(marbleGO);
          }
        }
      }
    });
  }

  startSimulation(): void {
    this.accumulator = 0;
    this.isSimulating = true;

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
