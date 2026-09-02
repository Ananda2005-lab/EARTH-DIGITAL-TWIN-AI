// E2E auth verification: register -> login -> me -> refresh -> logout
const BASE = 'http://localhost:4000/api/v1';
let failures = 0;

async function call(method, path, body, token, cookies) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookies) headers.Cookie = cookies;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  const setCookie = res.headers.get('set-cookie') || '';
  return { status: res.status, json, setCookie };
}

function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' :: ' + detail : ''}`);
  if (!ok) failures++;
}

const email = `e2e_${Date.now()}@test.local`;
const password = 'E2ePass!2026';

(async () => {
  // 1. register
  const reg = await call('POST', '/auth/register', { name: 'E2E Tester', email, password, acceptTerms: true });
  check('register', reg.status < 300, `status=${reg.status} ${JSON.stringify(reg.json).slice(0, 120)}`);

  // 2. login
  const login = await call('POST', '/auth/login', { email, password });
  const accessToken = login.json?.data?.accessToken || login.json?.data?.tokens?.accessToken;
  check('login', login.status === 200 && !!accessToken, `status=${login.status}`);
  const refreshCookie = (login.setCookie.match(/edt[_-]?refresh[^,]*/i) || [login.setCookie.split(',')[0]])[0];

  // 3. protected route: /users/me
  const me = await call('GET', '/users/me', null, accessToken);
  check('users/me with token', me.status === 200, `status=${me.status}`);

  // 4. protected route without token must 401
  const noAuth = await call('GET', '/users/me');
  check('users/me without token -> 401', noAuth.status === 401, `status=${noAuth.status}`);

  // 5. refresh
  const refresh = await call('POST', '/auth/refresh', {}, null, refreshCookie);
  const newToken = refresh.json?.data?.tokens?.accessToken || refresh.json?.data?.accessToken;
  check('refresh via cookie', refresh.status === 200 && !!newToken, `status=${refresh.status}`);

  // 6. logout
  const logout = await call('POST', '/auth/logout', {}, newToken || accessToken, refreshCookie);
  check('logout', logout.status < 300, `status=${logout.status}`);

  // 7. wrong password rejected
  const bad = await call('POST', '/auth/login', { email, password: 'WrongPass!1' });
  check('wrong password rejected', bad.status === 401, `status=${bad.status}`);

  console.log(failures === 0 ? '\nALL AUTH CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(1); });
