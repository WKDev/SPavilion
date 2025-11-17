const Service = require('node-windows').Service;
const path = require('path');

// Create a new service object
const svc = new Service({
  name: 'S-Pavilion NestJS Backend',
  description: 'S-Pavilion hardware monitoring system backend service',
  script: path.join(__dirname, 'nest-service.js'),
  nodeOptions: [],
  env: [
    {
      name: 'NODE_ENV',
      value: 'production',
    },
    {
      name: 'PORT',
      value: '3000',
    },
    {
      name: 'ENABLE_PROXY',
      value: 'true', // Enable proxy to Next.js server (port 3001)
    },
    {
      name: 'NEXTJS_URL',
      value: 'http://localhost:3001', // Next.js server URL (optional, defaults to this)
    },
  ],
});

// Listen for the "install" event, which indicates the process is available as a service.
svc.on('install', () => {
  console.log('✓ Service installed successfully!');
  console.log('Starting service...');
  svc.start();
});

svc.on('start', () => {
  console.log('✓ Service started successfully!');
  console.log('');
  console.log('Service Details:');
  console.log(`  Name: ${svc.name}`);
  console.log(`  Status: Running`);
  console.log(`  Port: 3000`);
  console.log(`  Endpoint: http://localhost:3000`);
  console.log('');
  console.log('Important Notes:');
  console.log('  - Make sure PostgreSQL is running (docker-compose up -d postgres)');
  console.log('  - Make sure Next.js server is running on port 3001');
  console.log('    (cd ../next && npm run build && npm run start)');
  console.log('  - Configure PLC connection in the web UI Settings page');
  console.log('  - Check .env file for configuration (nest/.env)');
  console.log('');
  console.log('To uninstall: npm run uninstall-service');
  console.log('To view service: Open "Services" app (services.msc)');
});

svc.on('alreadyinstalled', () => {
  console.log('⚠ Service is already installed.');
  console.log('To reinstall, first run: npm run uninstall-service');
});

svc.on('error', (err) => {
  console.error('✗ Service installation failed:');
  console.error(err);
  process.exit(1);
});

// Check if running as Administrator
console.log('Installing S-Pavilion NestJS Backend as Windows Service...');
console.log('');
console.log('⚠ IMPORTANT: You must run this script as Administrator!');
console.log('  Right-click Command Prompt → "Run as administrator"');
console.log('  Then run: npm run install-service');
console.log('');
console.log('Prerequisites:');
console.log('  1. PostgreSQL must be running: docker-compose up -d postgres');
console.log('  2. Build the NestJS app: npm run build');
console.log('  3. Install dependencies: npm install');
console.log('  4. Build and start Next.js server (port 3001):');
console.log('     cd ../next && npm run build && npm run start');
console.log('');

// Install the service
try {
  svc.install();
} catch (err) {
  console.error('✗ Installation failed:', err.message);
  console.error('');
  console.error('Make sure you are running as Administrator.');
  process.exit(1);
}
