import type {
  GameInitResponse,
  BoardStateResponse,
  PlacePieceRequest,
  PlacePieceResponse,
  UserStatusResponse,
  LeaderboardResponse,
} from '../shared/api';

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (body as Record<string, string>).message ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export async function fetchInit(): Promise<GameInitResponse> {
  return request<GameInitResponse>('/api/init');
}

export async function fetchBoardState(): Promise<BoardStateResponse> {
  return request<BoardStateResponse>('/api/board/state');
}

export async function placePiece(body: PlacePieceRequest): Promise<PlacePieceResponse> {
  return request<PlacePieceResponse>('/api/board/place', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchUserStatus(): Promise<UserStatusResponse> {
  return request<UserStatusResponse>('/api/user/status');
}

export async function fetchLeaderboard(): Promise<LeaderboardResponse> {
  return request<LeaderboardResponse>('/api/leaderboard');
}

export { ApiError };