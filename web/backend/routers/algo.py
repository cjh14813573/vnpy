"""算法交易路由"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Optional
from io import StringIO
import csv
import json
from auth import get_current_user
from bridge import bridge

router = APIRouter(prefix="/api/algo", tags=["algo"], dependencies=[Depends(get_current_user)])


class StartAlgoRequest(BaseModel):
    template_name: str
    vt_symbol: str
    direction: str
    offset: str
    price: float
    volume: float
    setting: Optional[dict] = {}


@router.get("/templates")
async def get_algo_templates():
    """获取算法模板列表"""
    try:
        return bridge.get_algo_templates()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/templates/{name}")
async def get_algo_template(name: str):
    """获取算法模板详情"""
    try:
        template = bridge.get_algo_template(name)
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        return template
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/list")
async def get_algo_list():
    """获取运行中的算法列表"""
    try:
        return bridge.get_algo_list()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/start")
async def start_algo(req: StartAlgoRequest):
    """启动算法"""
    try:
        algo_name = bridge.start_algo(
            template_name=req.template_name,
            vt_symbol=req.vt_symbol,
            direction=req.direction,
            offset=req.offset,
            price=req.price,
            volume=req.volume,
            setting=req.setting,
        )
        return {"success": True, "algo_name": algo_name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{algo_name}/stop")
async def stop_algo(algo_name: str):
    """停止算法"""
    try:
        bridge.stop_algo(algo_name)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stop-all")
async def stop_all_algos():
    """停止所有算法"""
    try:
        bridge.stop_all_algos()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{algo_name}/pause")
async def pause_algo(algo_name: str):
    """暂停算法"""
    try:
        bridge.pause_algo(algo_name)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{algo_name}/resume")
async def resume_algo(algo_name: str):
    """恢复算法"""
    try:
        bridge.resume_algo(algo_name)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/batch-import")
async def batch_import_algos(file: UploadFile = File(...)):
    """批量导入算法（CSV格式）"""
    try:
        # 读取CSV内容
        content = await file.read()
        content_str = content.decode('utf-8')

        # 解析CSV
        csv_reader = csv.DictReader(StringIO(content_str))
        rows = list(csv_reader)

        if not rows:
            raise HTTPException(status_code=400, detail="CSV文件为空或格式错误")

        results = {
            "total": len(rows),
            "success": 0,
            "failed": 0,
            "errors": [],
            "created": []
        }

        for idx, row in enumerate(rows, 1):
            try:
                # 解析设置（JSON字符串）
                setting = {}
                if row.get('params'):
                    try:
                        setting = json.loads(row['params'])
                    except json.JSONDecodeError:
                        pass

                # 启动算法
                algo_name = bridge.start_algo(
                    template_name=row['template_name'],
                    vt_symbol=f"{row['symbol']}.{row['exchange']}",
                    direction=row['direction'],
                    offset=row['offset'],
                    price=float(row['price']),
                    volume=float(row['volume']),
                    setting=setting,
                )

                results["success"] += 1
                results["created"].append({
                    "row": idx,
                    "algo_name": algo_name,
                    "vt_symbol": f"{row['symbol']}.{row['exchange']}"
                })

            except Exception as e:
                results["failed"] += 1
                results["errors"].append({
                    "row": idx,
                    "data": row,
                    "error": str(e)
                })

        return results

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"批量导入失败: {str(e)}")


@router.get("/batch-template")
async def get_batch_template():
    """获取批量导入CSV模板"""
    template = """template_name,symbol,exchange,direction,offset,price,volume,params
TWAP,rb2410,SHFE,多,开,3500,10,"{\"interval\":60,\"interval_num\":10}"
TWAP,cu2410,SHFE,空,开,68000,5,"{\"interval\":30,\"interval_num\":5}"
SNIPER,rb2410,SHFE,多,平,3510,10,"{\"trigger_price\":3510}"
"""
    return {"template": template}
