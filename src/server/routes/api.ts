import { Hono } from 'hono';
import { context, reddit } from '@devvit/web/server';
import type {
  GameInitResponse,
  BoardStateResponse,
  PlacePieceRequest,
  PlacePieceResponse,
  UserStatusResponse,
  LeaderboardResponse,
  SubmitScoreRequest,
  SubmitScoreResponse,
  PieceKind,
} from '../../shared/api';
import {
  getBoardState,
  appendPiece,
  todayDate,
  getUserProfile,
  ensureDailyPiece,
  consumeDailyPiece,
  submitScore,
  getLeaderboard,
  acquireLock,
  releaseLock,
} from '../core/storage';

const VALID_TYPES: PieceKind[] = ['ramp', 'bumper', 'gravity_well', 'slide', 'block'];
const BOARD_WIDTH = 800;
const BOARD_HEIGHT = 600;

export const api = new Hono();

api.use('*', async (c, next) => {
  if (!context.postId) {
    return c.json({ status: 'error', message: 'postId is required' }, 400);
  }
  await next();
});

api.get('/init', async (c) => {
  try {
    const username = await reddit.getCurrentUsername();
    return c.json<GameInitResponse>({
      postId: context.postId!,
      username: username ?? 'anonymous',
    });
  } catch (error) {
    console.error('API Init Error:', error);
    return c.json({ status: 'error', message: 'Initialization failed' }, 400);
  }
});

api.get('/board/state', async (c) => {
  try {
    const date = todayDate();
    const state = await getBoardState(date);
    return c.json<BoardStateResponse>({
      pieces: state.pieces,
      date: state.date,
    });
  } catch (error) {
    console.error('Board State Error:', error);
    return c.json({ status: 'error', message: 'Failed to get board state' }, 500);
  }
});

api.post('/board/place', async (c) => {
  try {
    const userId = `${context.postId}:${await reddit.getCurrentUsername()}`;
    const date = todayDate();
    const body = await c.req.json<PlacePieceRequest>();

    if (typeof body.type !== 'string' || !VALID_TYPES.includes(body.type as PieceKind)) {
      return c.json({ status: 'error', message: 'Invalid piece type' }, 400);
    }
    if (typeof body.x !== 'number' || !isFinite(body.x) || body.x < 0 || body.x > BOARD_WIDTH) {
      return c.json({ status: 'error', message: 'Invalid piece position' }, 400);
    }
    if (typeof body.y !== 'number' || !isFinite(body.y) || body.y < 0 || body.y > BOARD_HEIGHT) {
      return c.json({ status: 'error', message: 'Invalid piece position' }, 400);
    }
    if (typeof body.rotation !== 'number' || !isFinite(body.rotation)) {
      return c.json({ status: 'error', message: 'Invalid piece rotation' }, 400);
    }

    const acquired = await acquireLock(date, userId, 5);
    if (!acquired) {
      return c.json({ status: 'error', message: 'You have already placed a piece today' }, 429);
    }

    try {
      const profile = await getUserProfile(userId);
      const updated = await ensureDailyPiece(userId, profile);

      if (!updated.dailyPiece || updated.dailyPiece !== body.type) {
        return c.json({ status: 'error', message: 'You do not have this piece type today' }, 400);
      }

      const piece = {
        type: body.type as PieceKind,
        x: body.x,
        y: body.y,
        rotation: body.rotation,
        userId,
      };

      await appendPiece(date, piece);
      await consumeDailyPiece(userId);

      return c.json<PlacePieceResponse>({ success: true });
    } catch (error) {
      if (error instanceof Error && error.message === 'Board is full') {
        return c.json({ status: 'error', message: 'The board is full today' }, 400);
      }
      throw error;
    } finally {
      await releaseLock(date, userId);
    }
  } catch (error) {
    console.error('Place Piece Error:', error);
    return c.json({ status: 'error', message: 'Failed to place piece' }, 500);
  }
});

api.get('/user/status', async (c) => {
  try {
    const userId = `${context.postId}:${await reddit.getCurrentUsername()}`;
    const profile = await getUserProfile(userId);
    const updated = await ensureDailyPiece(userId, profile);
    return c.json<UserStatusResponse>({ profile: updated });
  } catch (error) {
    console.error('User Status Error:', error);
    return c.json({ status: 'error', message: 'Failed to get user status' }, 500);
  }
});

api.get('/leaderboard', async (c) => {
  try {
    const date = todayDate();
    const entries = await getLeaderboard(date);
    return c.json<LeaderboardResponse>({ entries });
  } catch (error) {
    console.error('Leaderboard Error:', error);
    return c.json({ status: 'error', message: 'Failed to get leaderboard' }, 500);
  }
});

api.post('/score/submit', async (c) => {
  try {
    const username = await reddit.getCurrentUsername();
    const date = todayDate();
    const body = await c.req.json<SubmitScoreRequest>();

    if (typeof body.score !== 'number' || !isFinite(body.score) || body.score < 0 || body.score > 10000) {
      return c.json({ status: 'error', message: 'Invalid score' }, 400);
    }

    await submitScore(date, username ?? 'anonymous', body.score);

    return c.json<SubmitScoreResponse>({ success: true });
  } catch (error) {
    console.error('Score Submit Error:', error);
    return c.json({ status: 'error', message: 'Failed to submit score' }, 500);
  }
});
