#!/usr/bin/env python3
"""
启动脚本
"""
import os
import sys

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

import uvicorn
from agent_service.server import app

if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    
    print(f"🚀 Starting GeoModel Agent Service on {host}:{port}")
    print(f"📡 LLM: {os.getenv('LLM_MODEL', 'deepseek-chat')} @ {os.getenv('LLM_BASE_URL', 'N/A')}")
    
    uvicorn.run(
        "agent_service.server:app",
        host=host,
        port=port,
        reload=True,
        log_level="info"
    )
