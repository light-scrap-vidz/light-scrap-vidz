import { test, expect, calls } from './app';

test.beforeEach(async ({ app }) => {
  await app.addInitScript(() => {
    if (!localStorage.getItem('light-scrap-vidz:outputDir')) {
      localStorage.setItem('light-scrap-vidz:outputDir', '/home/me/Videos');
    }
  });
});

test('the queue survives a reload and resumes', async ({ app, backend }) => {
  await backend.set({ start_download: () => undefined });
  await app.goto('/');
  await app.getByRole('button', { name: /Queue/ }).click();
  await app.getByPlaceholder('Paste one or more links, one per line…').fill('https://youtu.be/one');
  await app.getByRole('button', { name: 'Add to queue' }).click();
  await expect.poll(async () => (await calls(app, 'start_download')).length).toBe(1);

  await app.reload();

  // The interrupted item is back and starts again.
  await expect.poll(async () => (await calls(app, 'start_download')).length).toBe(1);
  await app.getByRole('button', { name: /Queue/ }).click();
  await expect(app.getByText('https://youtu.be/one')).toBeVisible();
});

test('the language switches to French and is remembered', async ({ app, backend }) => {
  await backend.set({});
  await app.goto('/');
  await app.getByLabel('Settings').click();
  await app.getByRole('button', { name: 'Français' }).click();
  await expect(app.getByText('Réglages').first()).toBeVisible();

  await app.reload();
  await expect(app.getByText('Compatible :')).toBeVisible();
});

test('Escape closes the settings panel', async ({ app, backend }) => {
  await backend.set({});
  await app.goto('/');
  await app.getByLabel('Settings').click();
  await expect(app.getByText('Default folder')).toBeVisible();

  await app.keyboard.press('Escape');

  await expect(app.getByText('Default folder')).toBeHidden();
});

test('an available update asks for confirmation, then sends deb users to the release page', async ({ app, backend }) => {
  await backend.set({
    'plugin:updater|check': () => ({ rid: 1, available: true, currentVersion: '1.1.0', version: '9.9.9' }),
    update_ytdlp: () => 'ok',
    'plugin:opener|open_url': () => undefined,
  });
  await app.goto('/');
  await app.getByLabel('Settings').click();

  await app.getByRole('button', { name: 'Check for updates' }).click();
  const confirm = app.getByRole('button', { name: 'Update to v9.9.9' });
  await expect(confirm).toBeVisible();
  expect(await calls(app, 'plugin:opener|open_url')).toEqual([]);

  await confirm.click();
  await expect.poll(() => calls(app, 'plugin:opener|open_url')).toHaveLength(1);
});

test('the notification switch is remembered', async ({ app, backend }) => {
  await backend.set({});
  await app.goto('/');
  await app.getByLabel('Settings').click();
  const toggle = app.getByRole('switch', { name: 'Toggle notification' });
  await expect(toggle).toHaveAttribute('aria-checked', 'true');

  await toggle.click();
  await app.reload();
  await app.getByLabel('Settings').click();

  await expect(app.getByRole('switch', { name: 'Toggle notification' })).toHaveAttribute('aria-checked', 'false');
});
