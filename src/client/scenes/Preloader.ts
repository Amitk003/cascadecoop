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
    this.genMarble();
    this.genBumper();
    this.genGravityWell();
    this.genRamp();
    this.genSlide();
    this.genBlock();
    this.genBackground();
    this.genLogo();
    this.genParticleGold();
  }

  private makeCanvas(key: string, w: number, h: number): CanvasRenderingContext2D {
    const ct = this.textures.createCanvas(key, w, h);
    if (!ct) throw new Error(`Failed to create canvas texture for ${key}`);
    const ctx = ct.getContext();
    if (!ctx) throw new Error(`Failed to get 2D context for ${key}`);
    return ctx;
  }

  private genMarble(): void {
    const ctx = this.makeCanvas('marble', 12, 12);
    const g = ctx.createRadialGradient(4, 3, 1, 6, 6, 7);
    g.addColorStop(0, '#fff8e0');
    g.addColorStop(0.3, '#ffd700');
    g.addColorStop(0.7, '#b8860b');
    g.addColorStop(1, '#8b6508');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(6, 6, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(4, 3, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  private genBumper(): void {
    const ctx = this.makeCanvas('piece_bumper', 40, 40);
    const cx = 20, cy = 20, r = 18;
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.arc(cx, cy, r + 1, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createRadialGradient(cx - 4, cy - 4, 2, cx, cy, r);
    g.addColorStop(0, '#ff8888');
    g.addColorStop(0.4, '#ff3333');
    g.addColorStop(0.8, '#cc0000');
    g.addColorStop(1, '#660000');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,100,100,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 1, 0, Math.PI * 2);
    ctx.stroke();
  }

  private genGravityWell(): void {
    const ctx = this.makeCanvas('piece_gravity_well', 60, 60);
    const cx = 30, cy = 30;
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 30);
    g.addColorStop(0, '#d4a0ff');
    g.addColorStop(0.3, '#9b59b6');
    g.addColorStop(0.6, '#6c3483');
    g.addColorStop(1, 'rgba(108,52,131,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(180,100,220,0.3)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(cx, cy, 8 * i + 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private genRamp(): void {
    const ctx = this.makeCanvas('piece_ramp', 120, 16);
    const g = ctx.createLinearGradient(0, 0, 0, 16);
    g.addColorStop(0, '#5a6a8a');
    g.addColorStop(0.3, '#3a4a6a');
    g.addColorStop(0.7, '#2a3a5a');
    g.addColorStop(1, '#1a2a3a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 120, 16);
    ctx.strokeStyle = '#4fc3f7';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0.5);
    ctx.lineTo(120, 0.5);
    ctx.stroke();
  }

  private genSlide(): void {
    const ctx = this.makeCanvas('piece_slide', 100, 8);
    const g = ctx.createLinearGradient(0, 0, 0, 8);
    g.addColorStop(0, '#4a7a9a');
    g.addColorStop(0.4, '#2a5a7a');
    g.addColorStop(1, '#1a3a5a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 100, 8);
    ctx.strokeStyle = '#4fc3f7';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0.5);
    ctx.lineTo(100, 0.5);
    ctx.stroke();
  }

  private genBlock(): void {
    const ctx = this.makeCanvas('piece_block', 40, 40);
    const g = ctx.createLinearGradient(0, 0, 40, 40);
    g.addColorStop(0, '#6a6a7a');
    g.addColorStop(0.3, '#4a4a5a');
    g.addColorStop(0.7, '#3a3a4a');
    g.addColorStop(1, '#2a2a3a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 40, 40);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, 39, 39);
  }

  private genBackground(): void {
    const ctx = this.makeCanvas('background', 1024, 768);
    const g = ctx.createLinearGradient(0, 0, 0, 768);
    g.addColorStop(0, '#0a0a1a');
    g.addColorStop(0.5, '#0f0f24');
    g.addColorStop(1, '#0a0a1a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 768);
    ctx.strokeStyle = 'rgba(255,255,255,0.02)';
    ctx.lineWidth = 1;
    for (let x = 0; x < 1024; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 768);
      ctx.stroke();
    }
    for (let y = 0; y < 768; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1024, y);
      ctx.stroke();
    }
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  private genLogo(): void {
    const ctx = this.makeCanvas('logo', 280, 80);
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    this.roundRect(ctx, 0, 0, 280, 80, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,215,0,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    this.roundRect(ctx, 0.5, 0.5, 279, 79, 12);
    ctx.stroke();
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 28px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('cascadecoop', 140, 42);
  }

  private genParticleGold(): void {
    const ctx = this.makeCanvas('particle_gold', 8, 8);
    const g = ctx.createRadialGradient(4, 3, 1, 4, 4, 4);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.3, '#ffd700');
    g.addColorStop(1, 'rgba(255,215,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(4, 4, 4, 0, Math.PI * 2);
    ctx.fill();
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
