/**
 * pm2 process manifest — keeps the API and web servers alive with
 * automatic restart on crash. Start with:  pm2 start ecosystem.config.cjs
 * Logs land in .scratch/pm2-*.log
 */
module.exports = {
  apps: [
    {
      name: 'edt-api',
      script: 'cmd',
      args: '/c npm run start:dev --workspace @edt/api',
      cwd: __dirname,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      out_file: '.scratch/pm2-api.log',
      error_file: '.scratch/pm2-api.err.log',
      merge_logs: true,
    },
    {
      name: 'edt-web',
      script: 'cmd',
      args: '/c npx next start -p 3100',
      cwd: `${__dirname}/apps/web`,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      out_file: '.scratch/pm2-web.log',
      error_file: '.scratch/pm2-web.err.log',
      merge_logs: true,
    },
  ],
};
