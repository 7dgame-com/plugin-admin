import { error, paginated, success } from '../utils/response';

describe('response utils', () => {
  it('wraps success payloads with code and message', () => {
    expect(success({ ok: true })).toEqual({
      code: 0,
      message: 'ok',
      data: { ok: true },
    });
  });

  it('builds paginated payloads with per_page', () => {
    expect(paginated([{ id: 1 }], 7, 2, 5)).toEqual({
      code: 0,
      message: 'ok',
      data: {
        items: [{ id: 1 }],
        total: 7,
        page: 2,
        per_page: 5,
      },
    });
  });

  it('builds error payloads', () => {
    expect(error(4001, 'bad request')).toEqual({
      code: 4001,
      message: 'bad request',
    });
  });
});
