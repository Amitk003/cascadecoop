import { redis } from '@devvit/web/server';
import type { BoardState, PlacedPiece, UserProfile, PieceKind } from '../../shared/api';

const PIECE_KINDS: PieceKind[] = ['ramp', 'bumper', 'gravity_well', 'slide', 'block'];

function boardKey(date: string): string {
  return `board:${date}`;
}

function profileKey(userId: string): string {
  return `users:${userId}`;
}

export function leaderboardKey(date: string): string {
  return `leaderboard:${date}`;
}

function lockKey(date: string, userId: string): string {
  return `lock:${date}:${userId}`;
}

export function todayDate(): string {
  const d = new Date();
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function getBoardState(date: string): Promise<BoardState> {
  const raw = await redis.get(boardKey(date));
  if (!raw) {
    return { pieces: [], date };
  }
  try {
    return JSON.parse(raw) as BoardState;
  } catch {
    return { pieces: [], date };
  }
}

export async function saveBoardState(state: BoardState): Promise<void> {
  await redis.set(boardKey(state.date), JSON.stringify(state));
}

export async function appendPiece(
  date: string,
  newPiece: PlacedPiece
): Promise<boolean> {
  const key = boardKey(date);

  const tx = await redis.watch(key);
  const raw = await redis.get(key);
  const current: BoardState = raw ? JSON.parse(raw) : { pieces: [], date };

  current.pieces.push(newPiece);

  await tx.multi();
  await tx.set(key, JSON.stringify(current));
  const results = await tx.exec();

  return results !== null;
}

export async function getUserProfile(userId: string): Promise<UserProfile> {
  const raw = await redis.hGetAll(profileKey(userId));
  if (!raw || Object.keys(raw).length === 0) {
    return { totalScore: 0, dailyPiece: null, lastActiveDate: '' };
  }
  return {
    totalScore: Number(raw.totalScore ?? 0),
    dailyPiece: raw.dailyPiece ? (raw.dailyPiece as PieceKind) : null,
    lastActiveDate: raw.lastActiveDate ?? '',
  };
}

export async function ensureDailyPiece(
  userId: string,
  profile: UserProfile
): Promise<UserProfile> {
  const today = todayDate();

  if (profile.lastActiveDate === today && profile.dailyPiece) {
    return profile;
  }

  const kind = PIECE_KINDS[Math.floor(Math.random() * PIECE_KINDS.length)];
  if (!kind) {
    return profile;
  }

  const updated: UserProfile = {
    totalScore: profile.totalScore,
    dailyPiece: kind,
    lastActiveDate: today,
  };

  const fields: Record<string, string> = {
    totalScore: String(updated.totalScore),
    lastActiveDate: updated.lastActiveDate,
  };
  if (updated.dailyPiece) {
    fields.dailyPiece = updated.dailyPiece;
  }
  await redis.hSet(profileKey(userId), fields);

  return updated;
}

export async function addScoreToUser(
  userId: string,
  points: number
): Promise<void> {
  await redis.hIncrBy(profileKey(userId), 'totalScore', points);
}

export async function submitScore(
  date: string,
  username: string,
  score: number
): Promise<void> {
  await redis.zAdd(leaderboardKey(date), { score, member: username });
}

export async function getLeaderboard(
  date: string,
  topN: number = 100
): Promise<Array<{ username: string; score: number }>> {
  const results = await redis.zRange(leaderboardKey(date), 0, topN - 1, {
    reverse: true,
    by: 'rank',
  });
  return results.map((r) => ({ username: r.member, score: r.score }));
}

export async function acquireLock(date: string, userId: string, ttlSeconds: number = 5): Promise<boolean> {
  const result = await redis.set(lockKey(date, userId), '1', { nx: true });
  if (result !== null) {
    await redis.expire(lockKey(date, userId), ttlSeconds);
    return true;
  }
  return false;
}

export async function releaseLock(date: string, userId: string): Promise<void> {
  await redis.del(lockKey(date, userId));
}