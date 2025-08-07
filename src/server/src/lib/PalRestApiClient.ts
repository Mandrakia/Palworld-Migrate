export interface ServerInfo {
  version: string;
  servername: string;
  description: string;
  worldguid: string;
}

export interface Player {
  name: string;
  accountName: string;
  playerId: string;
  userId: string;
  ip?: string;
  ping?: number;
  location_x?: number;
  location_y?: number;
  level?: number;
  exp?: number;
  hp?: number;
  food?: number;
  building_count?: number;
}

export interface PlayerListResponse {
  players: Player[];
}

export interface ServerMetrics {
  serverfps: number;
  currentplayernum: number;
  serverframetime: number;
  maxplayernum: number;
  uptime: number;
  days: number;
}

export interface ApiResponse<T = any> {
  success?: boolean;
  message?: string;
  data?: T;
}

export interface AnnounceRequest {
  message: string;
}

export interface KickPlayerRequest {
  userid: string;
  message?: string;
}

export interface BanPlayerRequest {
  userid: string;
  message?: string;
}

export interface UnbanPlayerRequest {
  userid: string;
}

export interface ShutdownRequest {
  waittime: number;
  message?: string;
}

export class PalRestApiClient {
  private readonly baseUrl: string;
  private readonly auth: string;

  constructor(host: string, protocol: 'http' | 'https', password: string) {
    this.baseUrl = `${protocol}://${host}`;
    this.auth = Buffer.from(`admin:${password}`).toString('base64');
  }

  private async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: any
  ): Promise<T> {
    const url = `${this.baseUrl}/v1/api${endpoint}`;
    const headers: HeadersInit = {
      'Authorization': `Basic ${this.auth}`,
    };

    if (body && method === 'POST') {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (response.headers.get('content-type')?.includes('application/json')) {
      return response.json();
    }

    return response.text() as T;
  }

  async getServerInfo(): Promise<ServerInfo> {
    return this.request<ServerInfo>('/info');
  }

  async getPlayerList(): Promise<PlayerListResponse> {
    return this.request<PlayerListResponse>('/players');
  }

  async getServerSettings(): Promise<Record<string, any>> {
    return this.request<Record<string, any>>('/settings');
  }

  async getServerMetrics(): Promise<ServerMetrics> {
    return this.request<ServerMetrics>('/metrics');
  }

  async announceMessage(message: string): Promise<ApiResponse> {
    return this.request<ApiResponse>('/announce', 'POST', { message });
  }

  async kickPlayer(userid: string, message?: string): Promise<ApiResponse> {
    const body: KickPlayerRequest = { userid };
    if (message) body.message = message;
    return this.request<ApiResponse>('/kick', 'POST', body);
  }

  async banPlayer(userid: string, message?: string): Promise<ApiResponse> {
    const body: BanPlayerRequest = { userid };
    if (message) body.message = message;
    return this.request<ApiResponse>('/ban', 'POST', body);
  }

  async unbanPlayer(userid: string): Promise<ApiResponse> {
    return this.request<ApiResponse>('/unban', 'POST', { userid });
  }

  async saveWorld(): Promise<ApiResponse> {
    return this.request<ApiResponse>('/save', 'POST');
  }

  async shutdownServer(waittime: number, message?: string): Promise<ApiResponse> {
    const body: ShutdownRequest = { waittime };
    if (message) body.message = message;
    return this.request<ApiResponse>('/shutdown', 'POST', body);
  }

  async forceStopServer(): Promise<ApiResponse> {
    return this.request<ApiResponse>('/stop', 'POST');
  }
}