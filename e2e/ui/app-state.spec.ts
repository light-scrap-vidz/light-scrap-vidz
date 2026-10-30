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
  await app.getByRole('tab', { name: /Queue/ }).click();
  await app.getByPlaceholder('Paste one or more links, one per line…').fill('https://youtu.be/one');
  await app.getByRole('button', { name: 'Add to queue' }).click();
  await expect.poll(async () => (await calls(app, 'start_download')).length).toBe(1);

  await app.reload();

  // The interrupted item is back and starts again.
  await expect.poll(async () => (await calls(app, 'start_download')).length).toBe(1);
  await app.getByRole('tab', { name: /Queue/ }).click();
  await expect(app.getByText('https://youtu.be/one')).toBeVisible();
});

test('the language chosen in the Help menu is remembered', async ({ app, backend }) => {
  await backend.set({});
  await app.goto('/');
  // The native menu is not there in a browser: it stores the choice the same way.
  await app.evaluate(() => localStorage.setItem('light-scrap-vidz:language', 'fr'));

  await app.reload();

  await expect(app.getByText('Compatible :')).toBeVisible();
});

test('Escape closes the settings panel', async ({ app, backend }) => {
  await backend.set({});
  await app.goto('/');
  await expect(app.getByText('Supports:')).toBeVisible();
  await app.keyboard.press('Control+,');
  await expect(app.getByText('Default folder')).toBeVisible();

  await app.keyboard.press('Escape');

  await expect(app.getByText('Default folder')).toBeHidden();
});

test('an available update is offered in a banner at start-up, then installs it and restarts', async ({ app, backend }) => {
  await backend.set({
    'plugin:updater|check': () => ({ rid: 1, available: true, currentVersion: '1.1.0', version: '9.9.9' }),
    'plugin:updater|download_and_install': () => undefined,
    'plugin:process|restart': () => undefined,
    release_notes: () => '## [9.9.9] - 2026-11-01\n### Fixed\n- something\n',
  });
  await app.goto('/');

  await expect(app.getByText('Version 9.9.9 is available.')).toBeVisible({ timeout: 10_000 });
  expect(await calls(app, 'plugin:updater|download_and_install')).toEqual([]);

  await app.getByRole('button', { name: 'Update now' }).click();
  await expect.poll(() => calls(app, 'plugin:process|restart')).toHaveLength(1);
  expect(await calls(app, 'plugin:updater|download_and_install')).toHaveLength(1);
});

test('the notification switch is remembered', async ({ app, backend }) => {
  await backend.set({});
  await app.goto('/');
  await expect(app.getByText('Supports:')).toBeVisible();
  await app.keyboard.press('Control+,');
  const toggle = app.getByRole('switch', { name: 'Toggle notification' });
  await expect(toggle).toHaveAttribute('aria-checked', 'true');

  await toggle.click();
  await app.reload();
  await expect(app.getByText('Supports:')).toBeVisible();
  await app.keyboard.press('Control+,');

  await expect(app.getByRole('switch', { name: 'Toggle notification' })).toHaveAttribute('aria-checked', 'false');
});
