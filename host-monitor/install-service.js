const Service = require('node-windows').Service;
const path = require('path');

// Create a new service object
const svc = new Service({
  name: 'S-Pavilion Host Monitor',
  description: 'System monitoring service for S-Pavilion Docker containers',
  script: path.join(__dirname, 'host-monitor.js'),
  nodeOptions: [],
  env: [
    {
      name: 'PORT',
      value: '9100',
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
  console.log(`  Port: 9100`);
  console.log(`  Endpoint: http://localhost:9100/api/system/info`);
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
console.log('Installing S-Pavilion Host Monitor as Windows Service...');
console.log('');
console.log('⚠ IMPORTANT: You must run this script as Administrator!');
console.log('  Right-click Command Prompt → "Run as administrator"');
console.log('  Then run: npm run install-service');
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
