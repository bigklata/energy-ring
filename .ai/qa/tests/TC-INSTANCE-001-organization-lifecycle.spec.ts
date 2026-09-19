import { test, expect, type APIRequestContext } from '@playwright/test';
import {
  getAuthToken,
  apiRequest,
} from '@open-mercato/core/testing/integration/api';

const ORG_PATH = '/api/directory/organizations';

type OrganizationRow = {
  id: string;
  name: string;
};

type OrganizationListBody = {
  items: OrganizationRow[];
};

type CreateResponse = {
  id: string;
};

type OkResponse = {
  ok: boolean;
};

test.describe('TC-INSTANCE-001 organization lifecycle', () => {
  let token = '';
  let organizationId: string | null = null;

  const uniqueName = () => `inst-001-${Date.now()}-${crypto.randomUUID()}`;

  const fetchManaged = async (request: APIRequestContext, id: string) => {
    const response = await apiRequest(request, 'GET', `${ORG_PATH}?view=manage&ids=${encodeURIComponent(id)}`, {
      token,
    });
    expect(response.status(), 'fetchManaged must return 200').toBe(200);
    return (await response.json()) as Promise<OrganizationListBody>;
  };

  const removeOwned = async (request: APIRequestContext, id: string) => {
    const response = await apiRequest(request, 'DELETE', ORG_PATH, {
      token,
      data: { id },
    });
    const body = (await response.json().catch(() => ({}))) as OkResponse;
    return { status: response.status(), body };
  };

  test.beforeAll(async ({ request }) => {
    token = await getAuthToken(request, 'superadmin');
  });

  test('create, read, rename, delete an owned organization', async ({ request }) => {
    const initialName = uniqueName();
    const renamedName = uniqueName();

    const created = await apiRequest(request, 'POST', ORG_PATH, {
      token,
      data: { name: initialName },
    });
    expect(created.status(), 'POST /organizations must create with 201').toBe(201);

    const createdBody = (await created.json()) as CreateResponse;
    organizationId = createdBody.id;
    expect(typeof organizationId, 'created organization must expose a string id').toBe('string');

    let listed = await fetchManaged(request, organizationId);
    expect(listed.items.length, 'managed view must return exactly one row for the owned id').toBe(1);
    expect(listed.items[0]?.id).toBe(organizationId);
    expect(listed.items[0]?.name, 'managed view must reflect the created name').toBe(initialName);

    const renamed = await apiRequest(request, 'PUT', ORG_PATH, {
      token,
      data: { id: organizationId, name: renamedName },
    });
    expect(renamed.status(), 'PUT /organizations must rename with 200').toBe(200);
    expect(((await renamed.json()) as OkResponse).ok, 'rename must report ok:true').toBe(true);

    listed = await fetchManaged(request, organizationId);
    expect(listed.items.length, 'rename must keep exactly one row for the owned id').toBe(1);
    expect(listed.items[0]?.name, 'rename must be persisted and visible on re-read').toBe(renamedName);

    const deleted = await apiRequest(request, 'DELETE', ORG_PATH, {
      token,
      data: { id: organizationId },
    });
    expect(deleted.status(), 'DELETE /organizations must soft-delete with 200').toBe(200);
    expect(((await deleted.json()) as OkResponse).ok, 'delete must report ok:true').toBe(true);

    listed = await fetchManaged(request, organizationId);
    expect(listed.items, 'managed view must be empty after delete').toEqual([]);
    organizationId = null;
  });

  test.afterAll(async ({ request }) => {
    if (!organizationId) return;
    const cleanup = await removeOwned(request, organizationId);
    expect(cleanup.status, 'surviving owned organization must be removed in cleanup').toBe(200);
    expect(cleanup.body.ok, 'cleanup delete must report ok:true').toBe(true);
  });
});
