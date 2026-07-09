import { Scene, GameObjects } from 'phaser';
import type { GameInitResponse } from '../../shared/api';

export class MainMenu extends Scene {
  background: GameObjects.Image | null = null;
  logo: GameObjects.Image | null = null;
  title: GameObjects.Text | null = null;
  private initData: GameInitResponse | null = null;

  constructor() {
    super('MainMenu');
  }

  init(data: { initData: GameInitResponse }): void {
    this.background = null;
    this.logo = null;
    this.title = null;
    this.initData = data.initData;
  }

  create() {
    this.refreshLayout();
    this.scale.on('resize', () => this.refreshLayout());

    this.input.once('pointerdown', () => {
      this.scene.start('Game', { initData: this.initData });
    });
  }

  private refreshLayout(): void {
    const { width, height } = this.scale;
    this.cameras.resize(width, height);

    if (!this.background) {
      this.background = this.add.image(0, 0, 'background').setOrigin(0);
    }
    this.background.setDisplaySize(width, height);

    const scaleFactor = Math.min(width / 1024, height / 768);

    if (!this.logo) {
      this.logo = this.add.image(0, 0, 'logo');
    }
    this.logo.setPosition(width / 2, height * 0.38).setScale(scaleFactor);

    if (!this.title) {
      this.title = this.add
        .text(0, 0, 'Main Menu', {
          fontFamily: 'Arial Black',
          fontSize: '38px',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 8,
          align: 'center',
        })
        .setOrigin(0.5);
    }
    this.title.setPosition(width / 2, height * 0.6);
    this.title.setScale(scaleFactor);
  }
}
