#!/bin/bash
# Startup script for CV Cursor Detection Service

cd "$(dirname "$0")/cursor-detector"
source /Users/aslam/tempy/remawt/venv/bin/activate

# Check if model exists
if [ ! -f "weights/cursor_class_best.pt" ]; then
    echo "❌ Error: Model not found at weights/cursor_class_best.pt"
    echo "Please download the model first:"
    echo "gdown 1slDiZoA8iIYpuUpWtbFqfv3R5VF14Zn- -O weights/cursor_class_best.pt"
    exit 1
fi

echo "🚀 Starting Cursor Detection API..."
echo "Service will be available at: http://localhost:8001"
echo "Health check: http://localhost:8001/health"
echo ""

python api.py
