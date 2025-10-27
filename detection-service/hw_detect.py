"""
Hardware Detection Module for S-Pavilion Detection Service

Detects platform, GPU capabilities, and available hardware encoders
for optimized video encoding in RTSP streaming via GStreamer.
"""

import os
import sys
import platform
import subprocess
import re
from typing import Dict, List, Optional


class HardwareConfig:
    """Hardware configuration data class"""

    def __init__(self):
        self.platform: str = ""  # linux, darwin, windows
        self.arch: str = ""  # x86_64, arm64, etc.
        self.gpu_vendor: str = "none"  # nvidia, intel, amd, apple, none
        self.gpu_name: str = ""
        self.hw_encoders: List[str] = []
        self.hw_decoders: List[str] = []
        self.device_path: Optional[str] = None
        self.vaapi_driver: Optional[str] = None
        self.selected_encoder: str = "x264enc"  # Default GStreamer software encoder
        self.encoder_options: Dict[str, str] = {}
        self.gst_encoders: List[str] = []  # GStreamer encoder elements

    def __repr__(self):
        return (f"HardwareConfig(platform={self.platform}, gpu={self.gpu_vendor}, "
                f"encoder={self.selected_encoder})")


def detect_platform() -> tuple:
    """Detect operating system and architecture"""
    system = platform.system().lower()
    machine = platform.machine().lower()

    # Normalize platform names
    if system == "darwin":
        platform_name = "darwin"
    elif system == "linux":
        platform_name = "linux"
    elif system == "windows":
        platform_name = "windows"
    else:
        platform_name = "unknown"

    return platform_name, machine


def check_nvidia_gpu() -> Optional[Dict[str, str]]:
    """Check for NVIDIA GPU using nvidia-smi"""
    try:
        result = subprocess.run(
            ['nvidia-smi', '--query-gpu=name,driver_version', '--format=csv,noheader'],
            capture_output=True,
            text=True,
            timeout=5
        )

        if result.returncode == 0 and result.stdout.strip():
            lines = result.stdout.strip().split('\n')
            if lines:
                parts = lines[0].split(',')
                return {
                    'vendor': 'nvidia',
                    'name': parts[0].strip() if len(parts) > 0 else 'NVIDIA GPU',
                    'driver': parts[1].strip() if len(parts) > 1 else 'unknown'
                }
    except (FileNotFoundError, subprocess.TimeoutExpired, Exception):
        pass

    return None


def check_vaapi_devices() -> Optional[Dict[str, str]]:
    """Check for VA-API devices (Intel/AMD on Linux)"""
    vaapi_devices = [
        '/dev/dri/renderD128',
        '/dev/dri/renderD129',
        '/dev/dri/card0',
        '/dev/dri/card1'
    ]

    for device in vaapi_devices:
        if os.path.exists(device):
            # Try to determine vendor from device
            gpu_info = {'vendor': 'intel', 'name': 'Intel GPU', 'device': device}

            # Check for Intel or AMD
            try:
                with open('/sys/class/drm/card0/device/vendor', 'r') as f:
                    vendor_id = f.read().strip()
                    if vendor_id == '0x8086':
                        gpu_info['vendor'] = 'intel'
                        gpu_info['name'] = 'Intel GPU'
                    elif vendor_id == '0x1002':
                        gpu_info['vendor'] = 'amd'
                        gpu_info['name'] = 'AMD GPU'
            except:
                pass

            # Try to get actual GPU name
            try:
                result = subprocess.run(
                    ['vainfo', '--display', 'drm', '--device', device],
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                if result.returncode == 0:
                    # Parse vainfo output for driver and device name
                    for line in result.stdout.split('\n'):
                        if 'Driver version' in line or 'VADriverInit' in line:
                            if 'iHD' in line:
                                gpu_info['driver'] = 'iHD'
                            elif 'i965' in line:
                                gpu_info['driver'] = 'i965'
                            elif 'radeonsi' in line or 'mesa' in line:
                                gpu_info['vendor'] = 'amd'
                                gpu_info['driver'] = 'mesa'
            except:
                pass

            return gpu_info

    return None


def check_apple_metal() -> Optional[Dict[str, str]]:
    """Check for Apple Metal support (macOS)"""
    try:
        result = subprocess.run(
            ['system_profiler', 'SPDisplaysDataType'],
            capture_output=True,
            text=True,
            timeout=5
        )

        if result.returncode == 0:
            # Parse for GPU info
            output = result.stdout
            if 'Metal' in output or 'Apple' in output:
                # Try to extract GPU name
                gpu_match = re.search(r'Chipset Model:\s*(.+)', output)
                gpu_name = gpu_match.group(1).strip() if gpu_match else 'Apple GPU'

                return {
                    'vendor': 'apple',
                    'name': gpu_name,
                    'metal': 'supported'
                }
    except:
        pass

    return None


def get_ffmpeg_encoders() -> List[str]:
    """Get list of available FFmpeg encoders"""
    encoders = []

    try:
        result = subprocess.run(
            ['ffmpeg', '-hide_banner', '-encoders'],
            capture_output=True,
            text=True,
            timeout=5
        )

        if result.returncode == 0:
            # Parse encoder list
            for line in result.stdout.split('\n'):
                # Look for hardware encoder patterns
                if any(hw in line for hw in ['nvenc', 'vaapi', 'qsv', 'videotoolbox', 'amf']):
                    # Extract encoder name (format: " V..... encoder_name  Description")
                    match = re.search(r'V\.{5}\s+(\S+)', line)
                    if match:
                        encoders.append(match.group(1))
    except:
        pass

    return encoders


def get_gstreamer_encoders() -> List[str]:
    """Get list of available GStreamer H.264 encoder elements"""
    encoders = []
    
    try:
        result = subprocess.run(
            ['gst-inspect-1.0'],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        if result.returncode == 0:
            # Look for H.264 encoder plugins
            for line in result.stdout.split('\n'):
                # Match encoder element names
                if 'h264' in line.lower() and 'encoder' in line.lower():
                    parts = line.split(':')
                    if len(parts) >= 2:
                        element_name = parts[1].strip().split()[0]
                        encoders.append(element_name)
    except:
        pass
    
    # Also check specific encoders directly
    encoder_candidates = [
        'nvh264enc',      # NVIDIA
        'vaapih264enc',   # VA-API
        'vah264enc',      # VA-API (new)
        'vtenc_h264',     # Apple VideoToolbox
        'x264enc',        # Software
    ]
    
    for encoder in encoder_candidates:
        try:
            result = subprocess.run(
                ['gst-inspect-1.0', encoder],
                capture_output=True,
                timeout=2
            )
            if result.returncode == 0 and encoder not in encoders:
                encoders.append(encoder)
        except:
            pass
    
    return encoders


def select_best_encoder(hw_config: HardwareConfig) -> None:
    """Select the best available GStreamer encoder based on hardware"""
    
    # Get available GStreamer encoders
    hw_config.gst_encoders = get_gstreamer_encoders()
    
    # Priority order based on GPU vendor
    if hw_config.gpu_vendor == 'nvidia':
        # NVIDIA: Try NVENC
        if 'nvh264enc' in hw_config.gst_encoders:
            hw_config.selected_encoder = 'nvh264enc'
            hw_config.encoder_options = {
                'preset': 'low-latency-hq',
                'rc-mode': 'cbr',
                'bitrate': '4000',  # 4 Mbps
                'gop-size': '30',
            }
            return
    
    elif hw_config.gpu_vendor == 'apple':
        # Apple: Try VideoToolbox
        if 'vtenc_h264' in hw_config.gst_encoders:
            hw_config.selected_encoder = 'vtenc_h264'
            hw_config.encoder_options = {
                'realtime': 'true',
                'allow-frame-reordering': 'false',
                'bitrate': '4000',
            }
            return
    
    elif hw_config.gpu_vendor == 'intel':
        # Intel: Try VA-API encoders
        if 'vah264enc' in hw_config.gst_encoders:
            hw_config.selected_encoder = 'vah264enc'
            hw_config.encoder_options = {
                'rate-control': 'cbr',
                'bitrate': '4000',
                'target-usage': '4',  # Balanced speed/quality
            }
            return
        elif 'vaapih264enc' in hw_config.gst_encoders:
            hw_config.selected_encoder = 'vaapih264enc'
            hw_config.encoder_options = {
                'rate-control': 'cbr',
                'bitrate': '4000',
            }
            if hw_config.device_path:
                hw_config.encoder_options['device-path'] = hw_config.device_path
            return
    
    elif hw_config.gpu_vendor == 'amd':
        # AMD: Try VA-API
        if 'vah264enc' in hw_config.gst_encoders:
            hw_config.selected_encoder = 'vah264enc'
            hw_config.encoder_options = {
                'rate-control': 'cbr',
                'bitrate': '4000',
            }
            return
        elif 'vaapih264enc' in hw_config.gst_encoders:
            hw_config.selected_encoder = 'vaapih264enc'
            hw_config.encoder_options = {
                'rate-control': 'cbr',
                'bitrate': '4000',
            }
            if hw_config.device_path:
                hw_config.encoder_options['device-path'] = hw_config.device_path
            return
    
    # Fallback to software encoder
    hw_config.selected_encoder = 'x264enc'
    hw_config.encoder_options = {
        'speed-preset': 'ultrafast',
        'tune': 'zerolatency',
        'bitrate': '4000',
        'key-int-max': '30',
    }


def detect_hardware() -> HardwareConfig:
    """Main hardware detection function"""
    config = HardwareConfig()

    # Detect platform
    config.platform, config.arch = detect_platform()

    # Detect GPU based on platform
    if config.platform == 'linux':
        # Check for NVIDIA first (highest performance)
        nvidia_info = check_nvidia_gpu()
        if nvidia_info:
            config.gpu_vendor = nvidia_info['vendor']
            config.gpu_name = nvidia_info['name']
        else:
            # Check for VA-API devices (Intel/AMD)
            vaapi_info = check_vaapi_devices()
            if vaapi_info:
                config.gpu_vendor = vaapi_info['vendor']
                config.gpu_name = vaapi_info['name']
                config.device_path = vaapi_info.get('device')
                config.vaapi_driver = vaapi_info.get('driver')

    elif config.platform == 'darwin':
        # macOS: Check for Metal support
        metal_info = check_apple_metal()
        if metal_info:
            config.gpu_vendor = metal_info['vendor']
            config.gpu_name = metal_info['name']

    elif config.platform == 'windows':
        # Windows: Check NVIDIA first, then try to detect others
        nvidia_info = check_nvidia_gpu()
        if nvidia_info:
            config.gpu_vendor = nvidia_info['vendor']
            config.gpu_name = nvidia_info['name']
        # TODO: Add Intel QSV and AMD AMF detection for Windows

    # Get available FFmpeg encoders
    config.hw_encoders = get_ffmpeg_encoders()

    # Select best encoder
    select_best_encoder(config)

    return config


def print_hardware_info(config: HardwareConfig) -> None:
    """Print detailed hardware information"""
    print("\n" + "=" * 60)
    print("HARDWARE DETECTION")
    print("=" * 60)

    # Platform info
    print(f"Platform: {config.platform.capitalize()} ({config.arch})")

    # CPU info
    try:
        cpu_count = os.cpu_count()
        print(f"CPU: {cpu_count} cores")
    except:
        pass

    # GPU info
    print(f"\nGPU Detection:")
    if config.gpu_vendor != 'none':
        print(f"  ✓ {config.gpu_name}")
        print(f"    Vendor: {config.gpu_vendor.upper()}")
        if config.device_path:
            print(f"    Device: {config.device_path}")
        if config.vaapi_driver:
            print(f"    VA-API Driver: {config.vaapi_driver}")
    else:
        print(f"  ✗ No GPU detected (will use CPU encoding)")

    # Available hardware encoders (FFmpeg - for reference)
    print(f"\nAvailable FFmpeg Hardware Encoders:")
    if config.hw_encoders:
        for encoder in sorted(set(config.hw_encoders)):
            # Categorize encoder
            if 'nvenc' in encoder:
                category = 'NVIDIA NVENC'
            elif 'vaapi' in encoder:
                category = 'Intel/AMD VA-API'
            elif 'qsv' in encoder:
                category = 'Intel QuickSync'
            elif 'videotoolbox' in encoder:
                category = 'Apple VideoToolbox'
            elif 'amf' in encoder:
                category = 'AMD AMF'
            else:
                category = 'Other'

            print(f"  ✓ {encoder} ({category})")
    else:
        print(f"  ✗ No hardware encoders detected")
    
    # Available GStreamer encoders
    print(f"\nAvailable GStreamer H.264 Encoders:")
    if config.gst_encoders:
        for encoder in sorted(set(config.gst_encoders)):
            # Categorize encoder
            if 'nv' in encoder:
                category = 'NVIDIA'
            elif 'vaapi' in encoder or 'vah264' in encoder:
                category = 'VA-API'
            elif 'vtenc' in encoder:
                category = 'Apple VideoToolbox'
            elif 'x264' in encoder:
                category = 'Software'
            else:
                category = 'Other'
            
            print(f"  ✓ {encoder} ({category})")
    else:
        print(f"  ✗ No GStreamer encoders detected")

    # Selected configuration
    print(f"\nSelected Encoder Configuration:")
    print(f"  Encoder: {config.selected_encoder}")
    if config.encoder_options:
        print(f"  Options:")
        for key, value in config.encoder_options.items():
            print(f"    - {key}: {value}")

    print("=" * 60 + "\n")


def check_gstreamer_dependencies() -> bool:
    """Check if GStreamer and required plugins are installed correctly"""
    print("\n" + "=" * 60)
    print("GSTREAMER DEPENDENCY CHECK")
    print("=" * 60)

    success = True

    # 1. Check GStreamer Python bindings
    try:
        import gi
        gi.require_version('Gst', '1.0')
        from gi.repository import Gst, GLib
        
        # Initialize GStreamer
        Gst.init(None)
        
        print("✓ GStreamer Python bindings: Installed")
        print(f"  GStreamer version: {'.'.join(map(str, Gst.version()))}")
    except ImportError as e:
        print("✗ GStreamer Python bindings: NOT INSTALLED")
        print(f"  Error: {e}")
        print("  Install: apt-get install python3-gi gir1.2-gstreamer-1.0")
        success = False
        return success
    except Exception as e:
        print(f"✗ GStreamer initialization failed: {e}")
        success = False
        return success

    # 2. Check GStreamer command-line tools
    print("\n  GStreamer Tools:")
    try:
        result = subprocess.run(
            ['gst-inspect-1.0', '--version'],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            version_line = result.stdout.strip().split('\n')[0]
            print(f"  ✓ {version_line}")
        else:
            print("  ✗ gst-inspect-1.0 not found")
            success = False
    except FileNotFoundError:
        print("  ✗ gst-inspect-1.0 not found in PATH")
        success = False
    except Exception as e:
        print(f"  ✗ GStreamer tools check failed: {e}")
        success = False

    # 3. Check essential GStreamer plugins
    print("\n  Essential GStreamer Plugins:")
    essential_plugins = [
        ('appsrc', 'Application source'),
        ('videoconvert', 'Video format conversion'),
        ('videoscale', 'Video scaling'),
        ('h264parse', 'H.264 parser'),
        ('rtph264pay', 'RTP H.264 payloader'),
        ('rtspclientsink', 'RTSP client sink'),
    ]
    
    for plugin, description in essential_plugins:
        try:
            result = subprocess.run(
                ['gst-inspect-1.0', plugin],
                capture_output=True,
                timeout=2
            )
            if result.returncode == 0:
                print(f"    ✓ {plugin} - {description}")
            else:
                print(f"    ✗ {plugin} - {description} (MISSING)")
                success = False
        except Exception as e:
            print(f"    ✗ {plugin} - Check failed: {e}")
            success = False

    # 4. Check H.264 encoders
    print("\n  H.264 Encoders:")
    encoders = get_gstreamer_encoders()
    
    if encoders:
        for encoder in encoders:
            print(f"    ✓ {encoder}")
    else:
        print("    ⚠ No H.264 encoders found (using software fallback)")
    
    # At minimum, we need x264enc
    if 'x264enc' not in encoders:
        print("    ✗ x264enc (software encoder) not found!")
        print("    Install: apt-get install gstreamer1.0-plugins-ugly")
        success = False

    # 5. Check system FFmpeg (for hardware detection)
    print("\n  FFmpeg (for hardware detection):")
    try:
        result = subprocess.run(
            ['ffmpeg', '-version'],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            version_line = result.stdout.split('\n')[0]
            print(f"  ✓ {version_line}")
        else:
            print("  ⚠ FFmpeg not found (hardware detection may be limited)")
    except FileNotFoundError:
        print("  ⚠ FFmpeg not found in PATH (hardware detection may be limited)")
    except Exception as e:
        print(f"  ⚠ FFmpeg check failed: {e}")

    print("=" * 60)

    if success:
        print("✓ All GStreamer dependencies are installed correctly")
    else:
        print("✗ Some GStreamer dependencies are missing!")
        print("Please install missing dependencies and restart.")

    print()
    return success


if __name__ == "__main__":
    # Test hardware detection
    config = detect_hardware()
    print_hardware_info(config)

    # Test GStreamer dependencies
    check_gstreamer_dependencies()
