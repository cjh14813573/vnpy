"""机器学习路由"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from auth import get_current_user
from bridge import bridge
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
import joblib
from datetime import datetime
from pathlib import Path

router = APIRouter(prefix="/api/ml", tags=["ml"], dependencies=[Depends(get_current_user)])

# 模型存储目录
ML_MODELS_DIR = Path.home() / ".vntrader" / "ml_models"
ML_MODELS_DIR.mkdir(parents=True, exist_ok=True)


class FeatureConfig(BaseModel):
    """特征工程配置"""
    technical_indicators: List[str] = ["sma", "ema", "rsi", "macd", "atr", "bollinger"]
    window_sizes: List[int] = [5, 10, 20, 60]
    target_horizon: int = 5  # 预测未来N个周期
    target_type: str = "direction"  # direction, return, volatility


class ModelTrainRequest(BaseModel):
    """模型训练请求"""
    name: str
    model_type: str  # random_forest, gradient_boosting, logistic_regression, svm
    vt_symbol: str
    interval: str = "1d"
    start: str
    end: str
    feature_config: FeatureConfig
    model_params: Dict[str, Any] = {}
    test_size: float = 0.2


class ModelPredictRequest(BaseModel):
    """模型预测请求"""
    model_name: str
    vt_symbol: str
    current_data: Dict[str, Any]


class FeatureEngineer:
    """特征工程工具"""

    def __init__(self, config: FeatureConfig):
        self.config = config
        self.scaler = StandardScaler()

    def calculate_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """计算技术指标特征"""
        features = pd.DataFrame(index=df.index)

        # 价格特征
        features['close'] = df['close']
        features['high'] = df['high']
        features['low'] = df['low']
        features['volume'] = df['volume']
        features['returns'] = df['close'].pct_change()
        features['log_returns'] = np.log(df['close'] / df['close'].shift(1))

        # 移动平均线
        for window in self.config.window_sizes:
            features[f'sma_{window}'] = df['close'].rolling(window=window).mean()
            features[f'ema_{window}'] = df['close'].ewm(span=window).mean()
            features[f'volume_sma_{window}'] = df['volume'].rolling(window=window).mean()

        # RSI
        if "rsi" in self.config.technical_indicators:
            for window in [6, 12, 24]:
                delta = df['close'].diff()
                gain = (delta.where(delta > 0, 0)).rolling(window=window).mean()
                loss = (-delta.where(delta < 0, 0)).rolling(window=window).mean()
                rs = gain / loss
                features[f'rsi_{window}'] = 100 - (100 / (1 + rs))

        # MACD
        if "macd" in self.config.technical_indicators:
            exp1 = df['close'].ewm(span=12).mean()
            exp2 = df['close'].ewm(span=26).mean()
            features['macd'] = exp1 - exp2
            features['macd_signal'] = features['macd'].ewm(span=9).mean()
            features['macd_hist'] = features['macd'] - features['macd_signal']

        # ATR
        if "atr" in self.config.technical_indicators:
            high_low = df['high'] - df['low']
            high_close = np.abs(df['high'] - df['close'].shift())
            low_close = np.abs(df['low'] - df['close'].shift())
            tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
            features['atr_14'] = tr.rolling(window=14).mean()

        # Bollinger Bands
        if "bollinger" in self.config.technical_indicators:
            features['bb_middle'] = df['close'].rolling(window=20).mean()
            bb_std = df['close'].rolling(window=20).std()
            features['bb_upper'] = features['bb_middle'] + 2 * bb_std
            features['bb_lower'] = features['bb_middle'] - 2 * bb_std
            features['bb_width'] = (features['bb_upper'] - features['bb_lower']) / features['bb_middle']
            features['bb_position'] = (df['close'] - features['bb_lower']) / (features['bb_upper'] - features['bb_lower'])

        # 价格波动率
        for window in [5, 10, 20]:
            features[f'volatility_{window}'] = features['returns'].rolling(window=window).std()

        # 价格动量
        for window in [1, 5, 10, 20]:
            features[f'momentum_{window}'] = df['close'].pct_change(periods=window)

        return features.dropna()

    def create_target(self, df: pd.DataFrame) -> pd.Series:
        """创建目标变量"""
        if self.config.target_type == "direction":
            # 未来N期涨跌方向
            future_return = df['close'].shift(-self.config.target_horizon) / df['close'] - 1
            return (future_return > 0).astype(int)
        elif self.config.target_type == "return":
            # 未来N期收益率（离散化）
            future_return = df['close'].shift(-self.config.target_horizon) / df['close'] - 1
            return pd.cut(future_return, bins=[-np.inf, -0.02, 0.02, np.inf], labels=[0, 1, 2])
        else:
            raise ValueError(f"Unknown target type: {self.config.target_type}")


@router.post("/features/generate")
async def generate_features(config: FeatureConfig, vt_symbol: str, interval: str = "1d", start: str = None, end: str = None):
    """生成特征数据集"""
    try:
        # 获取历史数据
        if not start or not end:
            end_date = datetime.now()
            start_date = end_date.replace(year=end_date.year - 1)
            start = start_date.strftime("%Y-%m-%d")
            end = end_date.strftime("%Y-%m-%d")

        history = bridge.query_history(vt_symbol, start, end, interval)

        if not history:
            raise HTTPException(status_code=404, detail="未找到历史数据")

        # 转换为DataFrame
        df = pd.DataFrame(history)
        df['datetime'] = pd.to_datetime(df['datetime'])
        df.set_index('datetime', inplace=True)
        df.rename(columns={
            'open_price': 'open',
            'high_price': 'high',
            'low_price': 'low',
            'close_price': 'close',
            'volume': 'volume'
        }, inplace=True)

        # 生成特征
        engineer = FeatureEngineer(config)
        features = engineer.calculate_features(df)
        target = engineer.create_target(df)

        # 对齐特征和目标
        valid_idx = features.index.intersection(target.dropna().index)
        features = features.loc[valid_idx]
        target = target.loc[valid_idx]

        return {
            "features_count": len(features.columns),
            "samples_count": len(features),
            "feature_names": list(features.columns),
            "target_distribution": target.value_counts().to_dict()
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/models/train")
async def train_model(req: ModelTrainRequest):
    """训练机器学习模型"""
    try:
        # 获取历史数据
        history = bridge.query_history(req.vt_symbol, req.start, req.end, req.interval)

        if not history or len(history) < 100:
            raise HTTPException(status_code=400, detail="历史数据不足，至少需要100条数据")

        # 转换为DataFrame
        df = pd.DataFrame(history)
        df['datetime'] = pd.to_datetime(df['datetime'])
        df.set_index('datetime', inplace=True)
        df.rename(columns={
            'open_price': 'open',
            'high_price': 'high',
            'low_price': 'low',
            'close_price': 'close',
            'volume': 'volume'
        }, inplace=True)

        # 生成特征
        engineer = FeatureEngineer(req.feature_config)
        features = engineer.calculate_features(df)
        target = engineer.create_target(df)

        # 对齐特征和目标
        valid_idx = features.index.intersection(target.dropna().index)
        features = features.loc[valid_idx]
        target = target.loc[valid_idx]

        if len(features) < 50:
            raise HTTPException(status_code=400, detail="有效样本不足，请扩大数据范围")

        # 划分训练集和测试集
        X_train, X_test, y_train, y_test = train_test_split(
            features, target, test_size=req.test_size, shuffle=False
        )

        # 标准化
        X_train_scaled = engineer.scaler.fit_transform(X_train)
        X_test_scaled = engineer.scaler.transform(X_test)

        # 创建模型
        if req.model_type == "random_forest":
            model = RandomForestClassifier(
                n_estimators=req.model_params.get("n_estimators", 100),
                max_depth=req.model_params.get("max_depth", 10),
                random_state=42
            )
        elif req.model_type == "gradient_boosting":
            model = GradientBoostingClassifier(
                n_estimators=req.model_params.get("n_estimators", 100),
                learning_rate=req.model_params.get("learning_rate", 0.1),
                random_state=42
            )
        elif req.model_type == "logistic_regression":
            model = LogisticRegression(random_state=42, max_iter=1000)
        elif req.model_type == "svm":
            model = SVC(probability=True, random_state=42)
        else:
            raise HTTPException(status_code=400, detail=f"不支持的模型类型: {req.model_type}")

        # 训练模型
        model.fit(X_train_scaled, y_train)

        # 预测
        y_pred = model.predict(X_test_scaled)
        y_pred_proba = model.predict_proba(X_test_scaled)[:, 1] if hasattr(model, "predict_proba") else None

        # 计算指标
        metrics = {
            "accuracy": float(accuracy_score(y_test, y_pred)),
            "precision": float(precision_score(y_test, y_pred, average='binary')),
            "recall": float(recall_score(y_test, y_pred, average='binary')),
            "f1": float(f1_score(y_test, y_pred, average='binary')),
        }

        if y_pred_proba is not None:
            try:
                metrics["auc"] = float(roc_auc_score(y_test, y_pred_proba))
            except:
                pass

        # 交叉验证
        cv_scores = cross_val_score(model, X_train_scaled, y_train, cv=5)
        metrics["cv_mean"] = float(cv_scores.mean())
        metrics["cv_std"] = float(cv_scores.std())

        # 特征重要性
        if hasattr(model, "feature_importances_"):
            importance = dict(zip(features.columns, model.feature_importances_.tolist()))
            # 排序并取前10
            importance = dict(sorted(importance.items(), key=lambda x: x[1], reverse=True)[:10])
        else:
            importance = {}

        # 保存模型
        model_path = ML_MODELS_DIR / f"{req.name}.joblib"
        joblib.dump({
            "model": model,
            "scaler": engineer.scaler,
            "feature_names": list(features.columns),
            "config": req.feature_config.dict(),
            "metrics": metrics,
            "importance": importance,
            "created_at": datetime.now().isoformat()
        }, model_path)

        return {
            "name": req.name,
            "model_type": req.model_type,
            "metrics": metrics,
            "feature_importance": importance,
            "samples": len(features),
            "features": len(features.columns),
            "model_path": str(model_path)
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/models")
async def list_models():
    """列出所有已训练的模型"""
    try:
        models = []
        for model_file in ML_MODELS_DIR.glob("*.joblib"):
            try:
                data = joblib.load(model_file)
                models.append({
                    "name": model_file.stem,
                    "metrics": data.get("metrics", {}),
                    "created_at": data.get("created_at", ""),
                    "features": len(data.get("feature_names", [])),
                })
            except:
                continue

        return sorted(models, key=lambda x: x["created_at"], reverse=True)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/models/{name}")
async def get_model_detail(name: str):
    """获取模型详情"""
    try:
        model_path = ML_MODELS_DIR / f"{name}.joblib"
        if not model_path.exists():
            raise HTTPException(status_code=404, detail="模型不存在")

        data = joblib.load(model_path)
        return {
            "name": name,
            "model_type": type(data["model"]).__name__,
            "metrics": data.get("metrics", {}),
            "feature_importance": data.get("importance", {}),
            "feature_names": data.get("feature_names", []),
            "config": data.get("config", {}),
            "created_at": data.get("created_at", ""),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/models/{name}/predict")
async def predict(name: str, data: Dict[str, Any]):
    """使用模型进行预测"""
    try:
        model_path = ML_MODELS_DIR / f"{name}.joblib"
        if not model_path.exists():
            raise HTTPException(status_code=404, detail="模型不存在")

        saved_data = joblib.load(model_path)
        model = saved_data["model"]
        scaler = saved_data["scaler"]
        feature_names = saved_data["feature_names"]

        # 构建特征向量
        features = []
        for fname in feature_names:
            if fname in data:
                features.append(data[fname])
            else:
                raise HTTPException(status_code=400, detail=f"缺少特征: {fname}")

        # 预测
        X = np.array(features).reshape(1, -1)
        X_scaled = scaler.transform(X)
        prediction = model.predict(X_scaled)[0]
        probability = model.predict_proba(X_scaled)[0].tolist() if hasattr(model, "predict_proba") else None

        return {
            "prediction": int(prediction),
            "probability": probability,
            "signal": "buy" if prediction == 1 else "sell" if prediction == 0 else "hold"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/models/{name}")
async def delete_model(name: str):
    """删除模型"""
    try:
        model_path = ML_MODELS_DIR / f"{name}.joblib"
        if not model_path.exists():
            raise HTTPException(status_code=404, detail="模型不存在")

        model_path.unlink()
        return {"success": True, "message": f"模型 {name} 已删除"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
