import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';
import { currentURL, settled, click } from '@ember/test-helpers';
import { create } from 'ember-cli-page-object';
import apiStub from 'vault/tests/helpers/noop-all-api-requests';
import authPage from 'vault/tests/pages/auth';
import logout from 'vault/tests/pages/logout';
import consoleClass from 'vault/tests/pages/components/console/ui-panel';

const consoleComponent = create(consoleClass);

const MODEL = {
  engineType: 'database',
  id: 'database-name',
};

// ARG TODO add more to test her once you fill out the flow
module('Acceptance | secrets/database/*', function(hooks) {
  setupApplicationTest(hooks);

  hooks.beforeEach(async function() {
    this.server = apiStub({ usePassthrough: true });
    return authPage.login();
  });
  hooks.afterEach(function() {
    this.server.shutdown();
  });

  test('root access', async function(assert) {
    this.set('model', MODEL);
    await click('[data-test-secret-backend-row="database"]');
    assert.dom('[data-test-component="empty-state"]').exists('renders empty state');
    assert.dom('[data-test-secret-list-tab="Connections"]').exists('renders connections tab');
    assert.dom('[data-test-secret-list-tab="Roles"]').exists('renders connections tab');

    await click('[data-test-secret-create="connections"]');
    assert.equal(currentURL(), '/vault/secrets/database/create');
    // ARG TODO finish the rest of the connection flow
  });

  test('no roles access', async function(assert) {
    this.set('model', MODEL);
    let backend = 'database';
    const NO_ROLES_POLICY = `
      path "database/roles/*" {
        capabilities = ["delete"]
      }
      path "database/static-roles/*" {
        capabilities = ["delete"]
      }
      path "database/config/*" {
        capabilities = ["list", "create", "read", "update"]
      }
      path "database/creds/*" {
        capabilities = ["list", "create", "read", "update"]
      }
    `;
    await consoleComponent.runCommands([
      `write sys/mounts/${backend} type=database`,
      `write sys/policies/acl/test-policy policy=${btoa(NO_ROLES_POLICY)}`,
      'write -field=client_token auth/token/create policies=test-policy ttl=1h',
    ]);
    let token = consoleComponent.lastTextOutput;
    await logout.visit();
    await authPage.login(token);
    await settled();
    await click('[data-test-secret-backend-row="database"]');
    assert.dom('[data-test-tab="overview"]').exists('renders overview tab');
    assert.dom('[data-test-secret-list-tab="Connections"]').exists('renders connections tab');
    assert
      .dom('[data-test-secret-list-tab="Roles]')
      .doesNotExist(`does not show the roles tab because it does not have permissions`);
    assert
      .dom('[data-test-selectable-card="Connections"]')
      .exists({ count: 1 }, 'renders only the connection card');

    await click('[data-test-action-text="Configure new"]');
    assert.equal(currentURL(), '/vault/secrets/database/create?itemType=connection');
  });
});
