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
    this.load.setPath('../assets');
    this.load.image('logo', 'logo.png');
  }

  create() {
    void this.fetchInitData().then((data) => {
      this.scene.start('MainMenu', { initData: data });
    });
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
