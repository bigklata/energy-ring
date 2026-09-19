import { test, expect, type APIRequestContext } from '@playwright/test';
import { withCredentialIsolatedRequest } from '@open-mercato/core/testing/integration/api';

const ORG_PATH = '/api/directory/organizations';

type ErrorBody = {
  error?: string;
};

test.describe('TC-INSTANCE-003 invalid bearer token is rejected', () => {
  test('GET with an invalid bearer token returns 401', async () => {
    await withCredentialIsolatedRequest(async (isolated: APIRequestContext) => {
      const response = await isolated.get(ORG_PATH, {
        headers: {
          Authorization: 'Bearer not-a-real-token',
        },
      });
      expect(response.status(), 'invalid bearer GET /organizations must be rejected with 401').toBe(401);
      const body = (await response.json().catch(() => ({}))) as ErrorBody;
      expect(typeof body.error, '401 body must carry an error message').toBe('string');
    });
  });
});
