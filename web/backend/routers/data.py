"""数据管理路由"""

from fastapi import APIRouter, Depends, HTTPException
from auth import get_current_user
from schemas import DataDeleteRequest, CSVImportRequest, CSVExportRequest

router = APIRouter(prefix="/api/data", tags=["data"], dependencies=[Depends(get_current_user)])


@router.get("/overview")
async def get_overview():
    """获取 Bar 数据概览"""
    raise HTTPException(status_code=501, detail="数据管理引擎集成中")


@router.post("/download")
async def download_data(req: dict):
    """下载 Bar 数据"""
    raise HTTPException(status_code=501, detail="数据下载引擎集成中")


@router.delete("/delete")
async def delete_data(req: DataDeleteRequest):
    """删除 Bar 数据"""
    raise HTTPException(status_code=501, detail="数据管理引擎集成中")


@router.post("/import-csv")
async def import_csv(req: CSVImportRequest):
    """CSV 导入数据"""
    raise HTTPException(status_code=501, detail="CSV 导入引擎集成中")


@router.post("/export-csv")
async def export_csv(req: CSVExportRequest):
    """导出数据为 CSV"""
    raise HTTPException(status_code=501, detail="CSV 导出引擎集成中")
