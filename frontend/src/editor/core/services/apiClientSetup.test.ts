import axios, { type InternalAxiosRequestConfig } from "axios";
import { afterEach, describe, expect, test } from "vitest";
import {
  getAuthHeaders,
  setupApiInterceptors,
} from "@editor/services/apiClientSetup";
import {
  clearStoredProState,
  saveStoredProState,
} from "@editor/services/sirisoProService";

/** A real axios instance whose adapter records each outgoing request instead of sending it. */
function capturingClient(baseURL = "/") {
  const sent: InternalAxiosRequestConfig[] = [];
  const client = axios.create({
    baseURL,
    adapter: async (config) => {
      sent.push(config);
      return { data: {}, status: 200, statusText: "OK", headers: {}, config };
    },
  });
  setupApiInterceptors(client);
  return { client, sent };
}

function signIn() {
  saveStoredProState({ isPro: true, authToken: "tok.sig" });
}

describe("engine API client and the Siriso paywall", () => {
  afterEach(() => clearStoredProState());

  test("sends no Authorization while nobody is signed in", async () => {
    const { client, sent } = capturingClient();

    await client.post("/api/v1/misc/compress-pdf");

    expect(sent[0].headers.Authorization).toBeUndefined();
    expect(await getAuthHeaders()).toEqual({});
  });

  test("attaches the signed-in customer's token to engine calls", async () => {
    signIn();
    const { client, sent } = capturingClient();

    await client.post("/api/v1/misc/compress-pdf");

    expect(sent[0].headers.Authorization).toBe("Bearer tok.sig");
    expect(await getAuthHeaders()).toEqual({ Authorization: "Bearer tok.sig" });
  });

  test("follows an engine served from another origin", async () => {
    signIn();
    const { client, sent } = capturingClient("https://engine.example.com");

    await client.get("/api/v1/general/job/1/result");

    expect(sent[0].headers.Authorization).toBe("Bearer tok.sig");
  });

  test("never hands the token to a different origin", async () => {
    signIn();
    const { client, sent } = capturingClient();

    await client.get("https://third-party.example.com/data.json");

    expect(sent[0].headers.Authorization).toBeUndefined();
  });

  test("leaves an explicit Authorization header alone", async () => {
    signIn();
    const { client, sent } = capturingClient();

    await client.get("/api/v1/info/status", {
      headers: { Authorization: "Bearer someone-else" },
    });

    expect(sent[0].headers.Authorization).toBe("Bearer someone-else");
  });
});
