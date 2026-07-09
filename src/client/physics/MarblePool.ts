import Phaser from 'phaser';

const POOL_SIZE = 200;
const MARBLE_RADIUS = 6;

export class MarblePool {
  private pool: Phaser.Physics.Matter.Image[] = [];
  private scene: Phaser.Scene;
  private activeCount: number = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.buildPool();
  }

  private buildPool(): void {
    for (let i = 0; i < POOL_SIZE; i++) {
      const marble = this.scene.matter.add.image(-100, -100, 'marble', undefined, {
        shape: { type: 'circle', radius: MARBLE_RADIUS },
        label: 'marble',
        collisionFilter: {
          category: 0x0002,
          mask: 0x0001 | 0x0004,
        },
        restitution: 0.5,
        friction: 0.05,
        density: 0.002,
        frictionAir: 0.01,
      });

      marble.setVisible(false);
      marble.setActive(false);
      marble.setStatic(true);
      this.pool.push(marble);
    }
  }

  spawn(x: number, y: number): Phaser.Physics.Matter.Image | null {
    for (const marble of this.pool) {
      if (!marble.active) {
        marble.setPosition(x, y);
        marble.setVisible(true);
        marble.setActive(true);
        marble.setStatic(false);
        this.activeCount++;
        return marble;
      }
    }
    return null;
  }

  release(marble: Phaser.Physics.Matter.Image): void {
    marble.setStatic(true);
    marble.setVelocity(0, 0);
    marble.setPosition(-100, -100);
    marble.setVisible(false);
    marble.setActive(false);
    this.activeCount--;
  }

  releaseAll(): void {
    for (const marble of this.pool) {
      if (marble.active) {
        this.release(marble);
      }
    }
  }

  getAt(index: number): Phaser.Physics.Matter.Image | null {
    return this.pool[index] ?? null;
  }

  getActiveCount(): number {
    return this.activeCount;
  }

  getPoolSize(): number {
    return POOL_SIZE;
  }
}