export type PieceKind = 'ramp' | 'bumper' | 'gravity_well' | 'slide' | 'block';

export type PieceDefinition = {
  kind: PieceKind;
  label: string;
  width: number;
  height: number;
  color: number;
  friction: number;
  restitution: number;
  density: number;
  isStatic: boolean;
};

export const PIECE_DEFINITIONS: Record<PieceKind, PieceDefinition> = {
  ramp: {
    kind: 'ramp',
    label: 'Ramp',
    width: 120,
    height: 16,
    color: 0x8b4513,
    friction: 0.8,
    restitution: 0.2,
    density: 0.01,
    isStatic: true,
  },
  bumper: {
    kind: 'bumper',
    label: 'Bumper',
    width: 40,
    height: 40,
    color: 0xff4444,
    friction: 0.1,
    restitution: 1.2,
    density: 0.005,
    isStatic: true,
  },
  gravity_well: {
    kind: 'gravity_well',
    label: 'Gravity Well',
    width: 60,
    height: 60,
    color: 0x9b59b6,
    friction: 0.3,
    restitution: 0.5,
    density: 0.01,
    isStatic: true,
  },
  slide: {
    kind: 'slide',
    label: 'Slide',
    width: 100,
    height: 8,
    color: 0x3498db,
    friction: 0.05,
    restitution: 0.1,
    density: 0.01,
    isStatic: true,
  },
  block: {
    kind: 'block',
    label: 'Block',
    width: 40,
    height: 40,
    color: 0x555555,
    friction: 0.6,
    restitution: 0.1,
    density: 0.02,
    isStatic: true,
  },
};