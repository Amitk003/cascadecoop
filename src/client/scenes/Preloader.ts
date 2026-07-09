import { Scene } from 'phaser';
import type { GameInitResponse } from '../../shared/api';

export class Preloader extends Scene {
  constructor() {
    super('Preloader');
  }

  init() {
    this.add.image(512, 384, 'background');
    this.add.rectangle(512, 384, 468, 32).setStrokeStyle(1, 0xffffff);
    const bar = this.add.rectangle(512 - 230, 384, 4, 28, 0xffffff);

    this.load.on('progress', (progress: number) => {
      bar.width = 4 + 460 * progress;
    });
  }

  preload() {
  }

  create() {
    this.generateTextures();
    void this.fetchInitData().then((data) => {
      this.scene.start('MainMenu', { initData: data });
    });
  }

  private generateTextures(): void {
    const g = this.add.graphics();

    g.fillStyle(0xffd700, 1);
    g.fillCircle(6, 6, 6);
    g.generateTexture('marble', 12, 12);

    g.fillStyle(0x8b4513, 1);
    g.fillRect(0, 0, 120, 16);
    g.generateTexture('piece_ramp', 120, 16);

    g.fillStyle(0xff4444, 1);
    g.fillCircle(20, 20, 20);
    g.generateTexture('piece_bumper', 40, 40);

    g.fillStyle(0x9b59b6, 1);
    g.fillCircle(30, 30, 30);
    g.generateTexture('piece_gravity_well', 60, 60);

    g.fillStyle(0x3498db, 1);
    g.fillRect(0, 0, 100, 8);
    g.generateTexture('piece_slide', 100, 8);

    g.fillStyle(0x555555, 1);
    g.fillRect(0, 0, 40, 40);
    g.generateTexture('piece_block', 40, 40);

    g.fillStyle(0x0a0a1a, 1);
    g.fillRect(0, 0, 1024, 768);
    for (let i = 0; i < 768; i += 32) {
      g.fillStyle(0x111133, 0.3);
      g.fillRect(0, i, 1024, 1);
    }
    g.generateTexture('background', 1024, 768);

    g.fillStyle(0x1a1a2e, 1);
    g.fillRoundedRect(0, 0, 280, 80, 12);
    g.fillStyle(0xffd700, 1);
    g.fillRect(20, 20, 240, 2);
    g.fillRect(20, 58, 240, 2);
    g.generateTexture('logo', 280, 80);

    g.fillStyle(0xffd700, 1);
    g.fillCircle(4, 4, 4);
    g.generateTexture('particle_gold', 8, 8);

    g.destroy();
  }

  private async fetchInitData(): Promise<GameInitResponse> {
    try {
      const response = await fetch('/api/init');
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      return await response.json() as GameInitResponse;
    } catch (error) {
      console.error('Failed to fetch init data:', error);
      return { postId: '', username: 'anonymous' };
    }
  }
}
