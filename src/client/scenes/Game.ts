import { Scene } from 'phaser';
import * as Phaser from 'phaser';

export class Game extends Scene {
  private camera: Phaser.Cameras.Scene2D.Camera;
  private background: Phaser.GameObjects.Image;

  constructor() {
    super('Game');
  }

  create() {
    this.camera = this.cameras.main;
    this.camera.setBackgroundColor(0x222222);

    this.background = this.add.image(512, 384, 'background').setAlpha(0.25);

    const overlay = document.getElementById('game-overlay');
    if (overlay) {
      overlay.style.display = 'flex';
    }

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
}
