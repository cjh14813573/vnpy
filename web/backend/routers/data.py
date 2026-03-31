"""数据管理路由"""

import io
import csv
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from auth import get_current_user

router = APIRouter(prefix="/api/data", tags=["data"], dependencies=[Depends(get_current_user)])

# 内存存储示例数据（实际应使用数据库）
_data_store: dict[str, list[dict]] = {}


def _generate_sample_data(vt_symbol: str, interval: str) -> list[dict]:
    """生成示例 K 线数据"""
    symbol, exchange = vt_symbol.split(".") if "." in vt_symbol else (vt_symbol, "SHFE")
    data = []
    base_price = 3500

    # 生成 100 条数据
    for i in range(100):
        date = datetime(2024, 1, 1)
        date = date.replace(day=1 + i % 28, hour=i % 24, minute=i % 60)

        open_price = base_price + (i * 10) + (hash(vt_symbol) % 100 - 50)
        close_price = open_price + (hash(f"{vt_symbol}_{i}") % 50 - 25)
        high_price = max(open_price, close_price) + abs(hash(f"high_{i}") % 20)
        low_price = min(open_price, close_price) - abs(hash(f"low_{i}") % 20)

        data.append({
            "datetime": date.isoformat(),
            "open": round(open_price, 2),
            "high": round(high_price, 2),
            "low": round(low_price, 2),
            "close": round(close_price, 2),
            "volume": abs(hash(f"vol_{i}") % 10000) + 1000,
            "open_interest": abs(hash(f"oi_{i}") % 50000) + 10000,
        })

    return data


@router.get("/overview")
async def get_overview():
    """获取 Bar 数据概览"""
    # 生成示例概览数据
    overview = []
    symbols = [
        ("rb2410", "SHFE", "1m"),
        ("rb2410", "SHFE", "5m"),
        ("cu2410", "SHFE", "1m"),
        ("al2410", "SHFE", "1m"),
    ]

    for symbol, exchange, interval in symbols:
        vt_symbol = f"{symbol}.{exchange}"
        key = f"{vt_symbol}_{interval}"

        if key not in _data_store:
            _data_store[key] = _generate_sample_data(vt_symbol, interval)

        data = _data_store[key]
        if data:
            overview.append({
                "symbol": symbol,
                "exchange": exchange,
                "interval": interval,
                "count": len(data),
                "start": data[0]["datetime"][:10],
                "end": data[-1]["datetime"][:10],
                "size_mb": round(len(data) * 0.05, 2),
            })

    return overview


@router.post("/download")
async def download_data(req: dict):
    """下载 Bar 数据"""
    raise HTTPException(status_code=501, detail="数据下载引擎集成中")


@router.delete("/delete")
async def delete_data(req: dict):
    """删除 Bar 数据"""
    vt_symbol = req.get("vt_symbol", "")
    interval = req.get("interval", "")

    key = f"{vt_symbol}_{interval}"
    if key in _data_store:
        del _data_store[key]

    return {"message": "数据已删除"}


@router.post("/import-csv")
async def import_csv(
    file: UploadFile = File(...),
    vt_symbol: str = Query(..., description="合约代码"),
    interval: str = Query("1m", description="数据周期"),
):
    """CSV 导入数据

    CSV 格式要求:
    - 必须包含列: datetime, open, high, low, close, volume
    - 可选列: open_interest
    - datetime 格式: YYYY-MM-DD HH:MM:SS 或 ISO 格式
    """
    try:
        content = await file.read()
        content_str = content.decode('utf-8')

        # 解析 CSV
        csv_reader = csv.DictReader(io.StringIO(content_str))
        rows = list(csv_reader)

        if not rows:
            raise HTTPException(status_code=400, detail="CSV 文件为空")

        # 验证必需列
        required_cols = ["datetime", "open", "high", "low", "close", "volume"]
        headers = rows[0].keys()
        missing_cols = [col for col in required_cols if col not in headers]
        if missing_cols:
            raise HTTPException(
                status_code=400,
                detail=f"缺少必需列: {', '.join(missing_cols)}"
            )

        # 转换数据
        data = []
        errors = []

        for idx, row in enumerate(rows, 1):
            try:
                data.append({
                    "datetime": row["datetime"],
                    "open": float(row["open"]),
                    "high": float(row["high"]),
                    "low": float(row["low"]),
                    "close": float(row["close"]),
                    "volume": float(row["volume"]),
                    "open_interest": float(row.get("open_interest", 0)),
                })
            except (ValueError, KeyError) as e:
                errors.append({"row": idx, "error": str(e)})

        # 存储数据
        key = f"{vt_symbol}_{interval}"
        _data_store[key] = data

        return {
            "success": True,
            "imported": len(data),
            "errors": len(errors),
            "error_details": errors[:10],  # 最多返回 10 条错误
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")


@router.post("/export-csv")
async def export_csv(
    body: dict,
):
    """导出数据为 CSV"""
    vt_symbol = body.get("vt_symbol", "")
    interval = body.get("interval", "1m")
    start = body.get("start", "")
    end = body.get("end", "")
    """导出数据为 CSV"""
    key = f"{vt_symbol}_{interval}"

    if key not in _data_store:
        # 生成示例数据
        _data_store[key] = _generate_sample_data(vt_symbol, interval)

    data = _data_store[key]

    # 时间范围过滤
    if start:
        data = [d for d in data if d["datetime"] >= start]
    if end:
        data = [d for d in data if d["datetime"] <= end]

    if not data:
        raise HTTPException(status_code=404, detail="无数据可导出")

    # 生成 CSV
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=["datetime", "open", "high", "low", "close", "volume", "open_interest"])
    writer.writeheader()
    writer.writerows(data)

    # 返回文件流
    output.seek(0)
    filename = f"{vt_symbol.replace('.', '_')}_{interval}_{datetime.now().strftime('%Y%m%d')}.csv"

    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8')),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/preview")
async def preview_data(
    vt_symbol: str = Query(..., description="合约代码"),
    interval: str = Query("1m", description="数据周期"),
    limit: int = Query(10, ge=1, le=100),
):
    """预览数据前 N 条"""
    key = f"{vt_symbol}_{interval}"

    if key not in _data_store:
        # 生成示例数据
        _data_store[key] = _generate_sample_data(vt_symbol, interval)

    data = _data_store[key][:limit]

    return {
        "vt_symbol": vt_symbol,
        "interval": interval,
        "total": len(_data_store[key]),
        "preview": data,
    }
