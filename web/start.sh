#!/bin/bash
# vnpy Web 启动脚本

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 停止现有进程
pkill -f "python3 main.py" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 2

echo "启动后端..."
(cd "$SCRIPT_DIR/backend" && python3 -c "
import sys
sys.path.insert(0, '.')
from auth import init_db
init_db()
print('数据库已初始化')
")
(cd "$SCRIPT_DIR/backend" && nohup python3 main.py > /tmp/backend.log 2>&1 &)
echo "后端 PID: $!"

sleep 3

echo "启动前端..."
(cd "$SCRIPT_DIR/frontend" && nohup npm run dev -- --host > /tmp/frontend.log 2>&1 &)
echo "前端 PID: $!"

sleep 3

echo ""
echo "服务已启动:"
echo "  前端: http://localhost:5173"
echo "  后端: http://localhost:8000"
echo "  局域网: http://192.168.31.117:5173"
echo ""
echo "日志:"
echo "  后端: tail -f /tmp/backend.log"
echo "  前端: tail -f /tmp/frontend.log"
