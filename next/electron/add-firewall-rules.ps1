# Windows 방화벽 규칙 추가 스크립트
# 관리자 권한으로 실행 필요

$appName = "SPav"
$electronPath = "C:\Users\user\SPavilion\next\node_modules\electron\dist\electron.exe"

Write-Host "Adding firewall rules for $appName..." -ForegroundColor Green

# UDP 인바운드
netsh advfirewall firewall add rule name="$appName UDP Inbound" dir=in action=allow program="$electronPath" protocol=UDP enable=yes
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ UDP Inbound rule added" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to add UDP Inbound rule" -ForegroundColor Red
}

# UDP 아웃바운드
netsh advfirewall firewall add rule name="$appName UDP Outbound" dir=out action=allow program="$electronPath" protocol=UDP enable=yes
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ UDP Outbound rule added" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to add UDP Outbound rule" -ForegroundColor Red
}

# TCP 인바운드
netsh advfirewall firewall add rule name="$appName TCP Inbound" dir=in action=allow program="$electronPath" protocol=TCP enable=yes
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ TCP Inbound rule added" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to add TCP Inbound rule" -ForegroundColor Red
}

# TCP 아웃바운드
netsh advfirewall firewall add rule name="$appName TCP Outbound" dir=out action=allow program="$electronPath" protocol=TCP enable=yes
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ TCP Outbound rule added" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to add TCP Outbound rule" -ForegroundColor Red
}

Write-Host "`nFirewall rules configuration completed!" -ForegroundColor Cyan
Write-Host "You can verify the rules in Windows Defender Firewall settings." -ForegroundColor Yellow

