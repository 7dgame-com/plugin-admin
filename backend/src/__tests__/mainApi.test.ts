jest.mock('axios');

import axios from 'axios';
import { requestMainApiGet, resolveMainApiConfig } from '../utils/mainApi';

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('main api upstream routing', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      APP_API_1_URL: 'http://primary.example.com',
      APP_API_1_WEIGHT: '60',
      APP_API_2_URL: 'http://secondary.example.com',
      APP_API_2_WEIGHT: '40',
      MAIN_API_TIMEOUT_MS: '5000',
    };
    mockedAxios.get.mockReset();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses APP_API_N_URL upstreams as the active configuration', () => {
    expect(resolveMainApiConfig()).toMatchObject({
      mode: 'app-api',
      timeoutMs: 5000,
      upstreams: [
        { url: 'http://primary.example.com', weight: 60, envKey: 'APP_API_1_URL' },
        { url: 'http://secondary.example.com', weight: 40, envKey: 'APP_API_2_URL' },
      ],
    });
  });

  it('falls back to the default APP_API_1_URL when APP_API_N_URL is absent', () => {
    delete process.env.APP_API_1_URL;
    delete process.env.APP_API_1_WEIGHT;
    delete process.env.APP_API_2_URL;
    delete process.env.APP_API_2_WEIGHT;

    expect(resolveMainApiConfig()).toMatchObject({
      mode: 'app-api',
      timeoutMs: 5000,
      upstreams: [
        { url: 'http://localhost:8081', weight: 1, envKey: 'APP_API_1_URL' },
      ],
    });
  });

  it('fails over to the next APP_API upstream on retryable upstream errors', async () => {
    mockedAxios.get
      .mockRejectedValueOnce(new Error('socket hang up'))
      .mockResolvedValueOnce({
        status: 200,
        data: { code: 0, data: { id: 9, roles: ['root'] } },
      } as never);

    const response = await requestMainApiGet('/v1/plugin/verify-token', {
      key: '',
      headers: {
        Authorization: 'Bearer token',
      },
    });

    expect(response.response.status).toBe(200);
    expect(mockedAxios.get).toHaveBeenNthCalledWith(
      1,
      'http://primary.example.com/v1/plugin/verify-token',
      expect.objectContaining({
        headers: { Authorization: 'Bearer token' },
        timeout: 5000,
      })
    );
    expect(mockedAxios.get).toHaveBeenNthCalledWith(
      2,
      'http://secondary.example.com/v1/plugin/verify-token',
      expect.objectContaining({
        headers: { Authorization: 'Bearer token' },
        timeout: 5000,
      })
    );
  });

  it('does not fail over when the upstream returns a non-retryable auth error', async () => {
    mockedAxios.get.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 401 },
    });

    await expect(
      requestMainApiGet('/v1/plugin/verify-token', {
        key: '',
        headers: {
          Authorization: 'Bearer token',
        },
      })
    ).rejects.toMatchObject({
      response: { status: 401 },
    });

    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    expect(mockedAxios.get).toHaveBeenCalledWith(
      'http://primary.example.com/v1/plugin/verify-token',
      expect.objectContaining({
        headers: { Authorization: 'Bearer token' },
        timeout: 5000,
      })
    );
  });
});
