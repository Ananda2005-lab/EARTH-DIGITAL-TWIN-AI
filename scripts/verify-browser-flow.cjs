const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Users/anand/AppData/Local/Google/Chrome/Application/chrome.exe',
  });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  const events = [];
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      events.push({ type: `console-${message.type()}`, text: message.text() });
    }
  });
  page.on('pageerror', (error) => events.push({ type: 'pageerror', text: error.stack || error.message }));
  page.on('requestfailed', (request) =>
    events.push({ type: 'requestfailed', url: request.url(), error: request.failure()?.errorText }),
  );
  page.on('response', (response) => {
    if (response.status() >= 400) {
      events.push({ type: 'http', status: response.status(), url: response.url() });
    }
  });

  await context.clearCookies();
  const response = await page.goto('http://localhost:3000/login', {
    waitUntil: 'networkidle',
    timeout: 60_000,
  });
  await page.screenshot({ path: 'images/after-current.png', fullPage: true });
  const before = {
    status: response?.status(),
    url: page.url(),
    title: await page.title(),
    body: (await page.locator('body').innerText()).slice(0, 3000),
  };

  await page.getByLabel('Email').fill('demo@earthdigitaltwin.ai');
  await page.getByLabel('Password', { exact: true }).fill('EarthTwin!2025');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForTimeout(15_000);
  await page.screenshot({ path: 'images/after-post-login.png', fullPage: true });
  const after = {
    url: page.url(),
    title: await page.title(),
    body: (await page.locator('body').innerText()).slice(0, 5000),
    cookies: (await context.cookies()).map((cookie) => ({
      name: cookie.name,
      domain: cookie.domain,
      path: cookie.path,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
    })),
  };

  console.log(JSON.stringify({ before, after, events }, null, 2));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
