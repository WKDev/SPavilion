# NVIDIA GPU Setup Guide for S-Pavilion Detection Service

This guide explains how to enable NVIDIA GPU passthrough for the S-Pavilion detection service.

## Prerequisites

### Host System Requirements
- NVIDIA GPU with CUDA support
- NVIDIA drivers installed on host system
- Docker with NVIDIA Container Toolkit
- NVIDIA Container Runtime

### Installing NVIDIA Container Toolkit

#### Ubuntu/Debian
```bash
# Add NVIDIA package repositories
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list

# Install nvidia-docker2
sudo apt-get update && sudo apt-get install -y nvidia-docker2
sudo systemctl restart docker
```

#### Windows
1. Install Docker Desktop
2. Install NVIDIA Container Toolkit for Windows
3. Enable WSL2 integration if using WSL2

## Configuration

### Environment Variables

Set the following environment variables to enable GPU detection:

```bash
# Enable YOLOv8 detection
export USE_DETECTION=true

# GPU settings (optional)
export NVIDIA_VISIBLE_DEVICES=all
export NVIDIA_DRIVER_CAPABILITIES=compute,utility
```

### Docker Compose Profiles

The detection service supports multiple profiles:

#### Default Profile (with GPU)
```bash
docker-compose --profile default up
```

#### Mock Profile (with GPU)
```bash
docker-compose --profile mock up
```

#### Hardware Profile (with GPU)
```bash
docker-compose --profile hardware up
```

## Testing GPU Setup

### 1. Test GPU Availability
```bash
# Run GPU test script
docker-compose exec detection-service python test_gpu.py
```

### 2. Check Container GPU Access
```bash
# Check if container can see GPU
docker-compose exec detection-service nvidia-smi
```

### 3. Monitor GPU Usage
```bash
# Monitor GPU usage while running detection
watch -n 1 nvidia-smi
```

## Troubleshooting

### Common Issues

#### 1. "CUDA not available" Error
- Ensure NVIDIA drivers are installed on host
- Verify NVIDIA Container Toolkit is installed
- Check that `runtime: nvidia` is set in docker-compose.yml

#### 2. "Failed to import PyTorch" Error
- Rebuild the Docker image: `docker-compose build detection-service`
- Check PyTorch CUDA version compatibility

#### 3. "No GPU detected" Error
- Verify GPU is visible to Docker: `docker run --rm --gpus all nvidia/cuda:11.0-base nvidia-smi`
- Check NVIDIA_VISIBLE_DEVICES environment variable

### Debug Commands

```bash
# Check Docker GPU support
docker run --rm --gpus all nvidia/cuda:11.0-base nvidia-smi

# Check container GPU access
docker-compose exec detection-service nvidia-smi

# Check PyTorch CUDA availability
docker-compose exec detection-service python -c "import torch; print(torch.cuda.is_available())"

# Run comprehensive GPU test
docker-compose exec detection-service python test_gpu.py
```

## Performance Optimization

### GPU Memory Management
- Monitor GPU memory usage with `nvidia-smi`
- Adjust batch sizes if running out of memory
- Use mixed precision training if supported

### CUDA Version Compatibility
- Current setup uses CUDA 12.1
- PyTorch version: 2.1.0+cu121
- Ultralytics version: 8.0.196

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `USE_DETECTION` | `false` | Enable YOLOv8 person detection |
| `NVIDIA_VISIBLE_DEVICES` | `all` | Which GPUs to make visible |
| `NVIDIA_DRIVER_CAPABILITIES` | `compute,utility` | GPU capabilities to expose |
| `MOCK_MODE` | `true` | Use mock video instead of camera |
| `USE_GSTREAMER` | `false` | Use GStreamer for RTSP streaming |

## Example Usage

### Enable Detection with GPU
```bash
# Set environment variables
export USE_DETECTION=true
export MOCK_MODE=false

# Start services with GPU support
docker-compose --profile hardware up
```

### Monitor Detection Performance
```bash
# In another terminal, monitor GPU usage
watch -n 1 nvidia-smi

# Check detection service logs
docker-compose logs -f detection-service
```
