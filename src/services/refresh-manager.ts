import { type TocTocAuthConfig, type TocTocResult } from "../types";

interface RefreshState {
  promise: Promise<TocTocResult<any>> | null;
  isRefreshing: boolean;
}

export class RefreshTokenManager {
  private refreshState: RefreshState = {
    promise: null,
    isRefreshing: false,
  };

  async refresh<TResponse>(
    config: TocTocAuthConfig,
    refreshToken: string,
    refreshFn: (
      config: TocTocAuthConfig,
      token: string
    ) => Promise<TocTocResult<TResponse>>
  ): Promise<TocTocResult<TResponse>> {
    if (this.refreshState.isRefreshing && this.refreshState.promise) {
      return this.refreshState.promise as Promise<TocTocResult<TResponse>>;
    }

    this.refreshState.isRefreshing = true;
    this.refreshState.promise = this.performRefresh(
      config,
      refreshToken,
      refreshFn
    );

    try {
      const result = await this.refreshState.promise;
      return result as TocTocResult<TResponse>;
    } finally {
      this.refreshState.isRefreshing = false;
      this.refreshState.promise = null;
    }
  }

  private async performRefresh<TResponse>(
    config: TocTocAuthConfig,
    refreshToken: string,
    refreshFn: (
      config: TocTocAuthConfig,
      token: string
    ) => Promise<TocTocResult<TResponse>>
  ): Promise<TocTocResult<TResponse>> {
    return refreshFn(config, refreshToken);
  }

  isCurrentlyRefreshing(): boolean {
    return this.refreshState.isRefreshing;
  }

  reset(): void {
    this.refreshState.isRefreshing = false;
    this.refreshState.promise = null;
  }
}