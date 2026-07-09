export type PieceKind = 'ramp' | 'bumper' | 'gravity_well' | 'slide' | 'block';

export type PlacedPiece = {
  type: PieceKind;
  x: number;
  y: number;
  rotation: number;
  userId: string;
};

export type BoardState = {
  pieces: PlacedPiece[];
  date: string;
};

export type UserProfile = {
  totalScore: number;
  dailyPiece: PieceKind | null;
  lastActiveDate: string;
  lastPlacementDate: string;
};

export type LeaderboardEntry = {
  username: string;
  score: number;
};

export type GameInitResponse = {
  postId: string;
  username: string;
};

export type BoardStateResponse = {
  pieces: PlacedPiece[];
  date: string;
};

export type PlacePieceRequest = {
  type: PieceKind;
  x: number;
  y: number;
  rotation: number;
};

export type PlacePieceResponse = {
  success: true;
};

export type UserStatusResponse = {
  profile: UserProfile;
};

export type LeaderboardResponse = {
  entries: LeaderboardEntry[];
};