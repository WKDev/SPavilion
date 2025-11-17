const Service = require('node-windows').Service;
const path = require('path');

// Create a new service object (must match install-service.js)
const svc = new Service({
  name: 'S-Pavilion Host Monitor',
  script: path.join(__dirname, 'host-monitor.js'),
});

// Listen for the "uninstall" event
svc.on('uninstall', () => {
  console.log('✓ Service uninstalled successfully!');
  console.log('');
  console.log('The service has been removed from Windows Services.');
  console.log('To reinstall: npm run install-service');
});

svc.on('alreadyuninstalled', () => {
  console.log('⚠ Service is not installed.');
  console.log('Nothing to uninstall.');
});

svc.on('error', (err) => {
  console.error('✗ Service uninstallation failed:');
  console.error(err);
  process.exit(1);
});

// Check if running as Administrator
console.log('Uninstalling S-Pavilion Host Monitor Windows Service...');
console.log('');
console.log('⚠ IMPORTANT: You must run this script as Administrator!');
console.log('  Right-click Command Prompt → "Run as administrator"');
console.log('  Then run: npm run uninstall-service');
console.log('');

// Uninstall the service
try {
  svc.uninstall();
} catch (err) {
  console.error('✗ Uninstallation failed:', err.message);
  console.error('');
  console.error('Make sure you are running as Administrator.');
  process.exit(1);
}
