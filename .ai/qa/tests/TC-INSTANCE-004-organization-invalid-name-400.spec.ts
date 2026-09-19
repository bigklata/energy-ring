import { test, expect, type APIRequestContext } from '@playwright/test';
import {
  getAuthToken,
  apiRequest,
} from '@open-mercato/core/testing/integration/api';

const ORG_PATH = '/api/directory/organizations';

type InvalidInputDetail = {
  path: string[];
};

type InvalidInputBody = {
  error?: string;
  details?: InvalidInputDetail[];
};

type CreateResponse = {
  id: string;
};

type OkResponse = {
  ok: boolean;
};

const removeOwned = async (request: APIRequestContext, token: string, id: string) => {
  const response = await apiRequest(request, 'DELETE', ORG_PATH, {
    token,
    data: { id },
  });
  const body = (await response.json().catch(() => ({}))) as OkResponse;
  expect(response.status(), 'leaked organization must be removed in cleanup').toBe(200);
  expect(body.ok, 'cleanup delete must report ok:true').toBe(true);
};

test.describe('TC-INSTANCE-004 empty organization name is rejected', () => {
  test('POST with an empty name returns 400 invalid input', async ({ request }) => {
    const token = await getAuthToken(request, 'superadmin');
    let leakedId: string | null = null;

    try {
      const response = await apiRequest(request, 'POST', ORG_PATH, {
        token,
        data: { name: '' },
      });

      // Defensive: if the instance ever accepted an empty name, record the id so
      // the assertion failure below cannot leak a row we own.
      if (response.status() >= 200 && response.status() < 300) {
        const created = (await response.json().catch(() => ({}))) as CreateResponse;
        if (created && typeof created.id === 'string') {
          leakedId = created.id;
        }
      }

      expect(response.status(), 'POST /organizations with empty name must fail validation with 400').toBe(400);

      const body = (await response.json()) as InvalidInputBody;
      expect(body.error, '400 body must name the failure as invalid input').toBe('Invalid input');
      expect(Array.isArray(body.details), '400 body must include a details array').toBe(true);
      expect(
        body.details?.some((detail) => Array.isArray(detail.path) && detail.path.includes('name')),
        'details must flag the name field',
      ).toBe(true);
    } finally {
      if (leakedId) {
        await removeOwned(request, token, leakedId);
      }
    }
  });
});
