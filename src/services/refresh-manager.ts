import { type TocTocAuthConfig, type TocTocResult } from "../types";

export class RefreshTokenManager {
  private pendingRefresh: Promise<TocTocResult<unknown>> | null = null;
  private pendingSession: string | null = null;
  private isRefreshing = false;

  async refresh<TResponse>(
    config: TocTocAuthConfig,
    refreshToken: string,
    refreshFn: (
      config: TocTocAuthConfig,
      token: string
    ) => Promise<TocTocResult<TResponse>>,
    generation: number
  ): Promise<TocTocResult<TResponse>> {
    // If there's already a pending refresh, return it
    // This prevents race conditions by checking the promise immediately
    const session = `${generation}:${refreshToken}`;
    if (this.pendingRefresh && this.pendingSession === session) {
      return this.pendingRefresh as Promise<TocTocResult<TResponse>>;
    }

    // Create the refresh promise immediately to prevent race conditions
    // Any concurrent calls will see pendingRefresh as non-null
    this.pendingSession = session;
    const pending = (async (): Promise<TocTocResult<TResponse>> => {
      this.isRefreshing = true;
      try {
        return await refreshFn(config, refreshToken);
      } finally {
        this.isRefreshing = false;
        // Small delay before clearing to handle near-simultaneous requests
        // that might check pendingRefresh right after it's set to null
        setTimeout(() => {
          if (this.pendingRefresh === pending) {
            this.pendingRefresh = null;
            this.pendingSession = null;
          }
        }, 100);
      }
    })();

    this.pendingRefresh = pending;
    return pending;
  }

  isCurrentlyRefreshing(): boolean {
    return this.isRefreshing;
  }

  reset(): void {
    this.isRefreshing = false;
    this.pendingRefresh = null;
    this.pendingSession = null;
  }
}
