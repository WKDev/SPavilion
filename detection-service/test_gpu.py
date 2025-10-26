#!/usr/bin/env python3
"""
GPU Test Script for S-Pavilion Detection Service
This script tests GPU availability and CUDA functionality
"""

import os
import sys

def test_gpu_setup():
    """Test GPU setup and CUDA availability"""
    print("=" * 60)
    print("GPU SETUP TEST")
    print("=" * 60)
    
    # Test PyTorch import
    try:
        import torch
        print(f"✓ PyTorch imported successfully")
        print(f"  Version: {torch.__version__}")
    except ImportError as e:
        print(f"✗ Failed to import PyTorch: {e}")
        return False
    
    # Test CUDA availability
    try:
        cuda_available = torch.cuda.is_available()
        print(f"✓ CUDA availability check: {cuda_available}")
        
        if cuda_available:
            print(f"✓ CUDA version: {torch.version.cuda}")
            print(f"✓ Number of GPUs: {torch.cuda.device_count()}")
            
            for i in range(torch.cuda.device_count()):
                gpu_name = torch.cuda.get_device_name(i)
                gpu_memory = torch.cuda.get_device_properties(i).total_memory / (1024**3)
                print(f"  GPU {i}: {gpu_name} ({gpu_memory:.1f} GB)")
            
            # Test tensor operations on GPU
            try:
                x = torch.randn(1000, 1000).cuda()
                y = torch.randn(1000, 1000).cuda()
                z = torch.mm(x, y)
                print(f"✓ GPU tensor operations working")
            except Exception as e:
                print(f"✗ GPU tensor operations failed: {e}")
                return False
        else:
            print("! CUDA not available - will use CPU")
            
    except Exception as e:
        print(f"✗ CUDA check failed: {e}")
        return False
    
    # Test ultralytics import
    try:
        from ultralytics import YOLO
        print(f"✓ Ultralytics imported successfully")
        
        # Test YOLO model loading
        try:
            model = YOLO('yolov8n.pt')
            print(f"✓ YOLOv8n model loaded successfully")
            
            # Test model device assignment
            if cuda_available:
                model.to('cuda')
                print(f"✓ Model moved to GPU")
            else:
                model.to('cpu')
                print(f"✓ Model using CPU")
                
        except Exception as e:
            print(f"✗ YOLO model loading failed: {e}")
            return False
            
    except ImportError as e:
        print(f"✗ Failed to import ultralytics: {e}")
        return False
    
    print("=" * 60)
    print("✓ All GPU tests passed!")
    print("=" * 60)
    return True

if __name__ == "__main__":
    success = test_gpu_setup()
    sys.exit(0 if success else 1)
