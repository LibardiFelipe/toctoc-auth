import axios from "axios";
import { createTocTocAxiosWrapper } from "../../src/services/toctoc-wrapper";
import { localStorageService } from "../../src/services/localStorage-service";

const config = { apiBaseUrl: location.origin, encryptionKey: "test", providers: { credentials: {
  refreshTokenApiRoute: "/refresh", signInJsonResponseAccessTokenLocation: ["accessToken"],
  signInJsonResponseRefreshTokenLocation: ["refreshToken"], redirectClientRoutes: {},
} } } as any;

export const init = () => localStorageService.setItem("toctoc-auth", {
  provider: "credentials", accessToken: "old-access", refreshToken: "old-refresh", sessionId: "test-session",
}, "test");
export const call = () => createTocTocAxiosWrapper(config, axios.create({ baseURL: location.origin }))
  .get("/protected").then(response => response.status);
export const session = () => localStorageService.getItem("toctoc-auth", "test");
