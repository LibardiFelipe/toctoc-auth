import { type TocTocAuthConfig, type TocTocResult } from "../types";

export class RefreshTokenManager {
  private pendingRefresh: Promise<TocTocResult<unknown>> | null = null;
  private isRefreshing = false;

  async refresh<TResponse>(
    config: TocTocAuthConfig,
    refreshToken: string,
    refreshFn: (
      config: TocTocAuthConfig,
      token: string
    ) => Promise<TocTocResult<TResponse>>
  ): Promise<TocTocResult<TResponse>> {
    // If there's already a pending refresh, return it
    // This prevents race conditions by checking the promise immediately
    if (this.pendingRefresh) {
      return this.pendingRefresh as Promise<TocTocResult<TResponse>>;
    }

    // Create the refresh promise immediately to prevent race conditions
    // Any concurrent calls will see pendingRefresh as non-null
    this.pendingRefresh = (async (): Promise<TocTocResult<TResponse>> => {
      this.isRefreshing = true;
      try {
        return await refreshFn(config, refreshToken);
      } finally {
        this.isRefreshing = false;
        // Small delay before clearing to handle near-simultaneous requests
        // that might check pendingRefresh right after it's set to null
        setTimeout(() => {
          this.pendingRefresh = null;
        }, 100);
      }
    })();

    return this.pendingRefresh as Promise<TocTocResult<TResponse>>;
  }

  isCurrentlyRefreshing(): boolean {
    return this.isRefreshing;
  }

  reset(): void {
    this.isRefreshing = false;
    this.pendingRefresh = null;
  }
}
