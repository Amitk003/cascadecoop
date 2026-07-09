import { Hono } from 'hono';
import { context, reddit } from '@devvit/web/server';
import type { GameInitResponse } from '../../shared/api';

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
