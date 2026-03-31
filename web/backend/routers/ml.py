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
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score, roc_auc_score,
    confusion_matrix, roc_curve, classification_report
)
import joblib
from datetime import datetime, timedelta
from pathlib import Path
import asyncio
import json
from threading import Lock

router = APIRouter(prefix="/api/ml", tags=["ml"], dependencies=[Depends(get_current_user)])

# WebSocket 导入（放在这里避免循环导入）
from ws_manager import ws_manager

# ML 信号服务状态
_ml_signal_service_running = False
_ml_signal_subscriptions: Dict[str, Dict[str, Any]] = {}  # vt_symbol -> {model_name, interval, last_prediction}
_ml_signal_lock = Lock()
_ml_signal_task: Optional[asyncio.Task] = None

# 信号历史存储（内存中，限制数量）
_ml_signal_history: List[Dict[str, Any]] = []
_max_history_size = 1000

# 模型存储目录
ML_MODELS_DIR = Path.home() / ".vntrader" / "ml_models"
ML_MODELS_DIR.mkdir(parents=True, exist_ok=True)


class FeatureConfig(BaseModel):
    """特征工程配置"""
    technical_indicators: List[str] = ["sma", "ema", "rsi", "macd", "atr", "bollinger"]
    window_sizes: List[int] = [5, 10, 20, 60]
    target_horizon: int = 5  # 预测未来N个周期
    target_type: str = "direction"  # direction, return, volatility


class FeaturePreviewRequest(BaseModel):
    """特征预览请求"""
    vt_symbol: str
    interval: str = "1d"
    start: str
    end: str
    feature_config: FeatureConfig


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


class SignalSubscribeRequest(BaseModel):
    """信号订阅请求"""
    model_name: str
    vt_symbol: str
    interval: int = 60  # 预测间隔（秒）


class MLSignalService:
    """ML 实时信号服务"""

    def __init__(self):
        self.subscriptions: Dict[str, Dict[str, Any]] = {}  # vt_symbol -> sub info
        self.history: List[Dict[str, Any]] = []
        self.max_history = 1000
        self._lock = Lock()
        self._task: Optional[asyncio.Task] = None
        self._running = False

    def start(self):
        """启动信号服务"""
        if not self._running:
            self._running = True
            # 创建后台任务
            try:
                loop = asyncio.get_event_loop()
                self._task = loop.create_task(self._prediction_loop())
            except RuntimeError:
                pass  # 没有事件循环，稍后启动

    def stop(self):
        """停止信号服务"""
        self._running = False
        if self._task:
            self._task.cancel()
            self._task = None

    def subscribe(self, model_name: str, vt_symbol: str, interval: int = 60) -> bool:
        """订阅信号"""
        with self._lock:
            # 加载模型
            model_path = ML_MODELS_DIR / f"{model_name}.joblib"
            if not model_path.exists():
                return False

            try:
                data = joblib.load(model_path)
                self.subscriptions[vt_symbol] = {
                    "model_name": model_name,
                    "model": data["model"],
                    "scaler": data["scaler"],
                    "feature_names": data["feature_names"],
                    "config": data.get("config", {}),
                    "interval": interval,
                    "last_prediction": None,
                    "last_run": None,
                }
                self.start()
                return True
            except Exception:
                return False

    def unsubscribe(self, vt_symbol: str) -> bool:
        """取消订阅"""
        with self._lock:
            if vt_symbol in self.subscriptions:
                del self.subscriptions[vt_symbol]
                # 如果没有订阅了，停止服务
                if not self.subscriptions:
                    self.stop()
                return True
            return False

    def get_subscriptions(self) -> Dict[str, Dict[str, Any]]:
        """获取当前订阅"""
        with self._lock:
            # 返回不包含模型对象的副本
            return {
                vt: {k: v for k, v in sub.items() if k not in ["model", "scaler"]}
                for vt, sub in self.subscriptions.items()
            }

    def get_history(self, limit: int = 100, vt_symbol: Optional[str] = None) -> List[Dict[str, Any]]:
        """获取信号历史"""
        with self._lock:
            history = self.history
            if vt_symbol:
                history = [h for h in history if h.get("vt_symbol") == vt_symbol]
            return history[-limit:]

    def clear_history(self):
        """清空历史"""
        with self._lock:
            self.history.clear()

    async def _prediction_loop(self):
        """预测循环"""
        while self._running:
            try:
                await self._run_predictions()
            except Exception as e:
                print(f"ML Signal prediction error: {e}")
            # 每秒检查一次
            await asyncio.sleep(1)

    async def _run_predictions(self):
        """执行预测"""
        now = datetime.now()

        with self._lock:
            subs = list(self.subscriptions.items())

        for vt_symbol, sub in subs:
            # 检查是否需要运行
            last_run = sub.get("last_run")
            interval = sub.get("interval", 60)

            if last_run and (now - last_run).seconds < interval:
                continue

            try:
                # 获取历史数据计算特征
                end = now.strftime("%Y-%m-%d")
                start = (now - timedelta(days=30)).strftime("%Y-%m-%d")

                history = bridge.query_history(vt_symbol, start, end, "1d")
                if not history or len(history) < 20:
                    continue

                # 转换为 DataFrame
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
                config = FeatureConfig(**sub.get("config", {}))
                engineer = FeatureEngineer(config)
                features = engineer.calculate_features(df)

                if len(features) == 0:
                    continue

                # 获取最后一行特征
                latest_features = features.iloc[-1]

                # 构建特征向量
                feature_vector = []
                for fname in sub["feature_names"]:
                    if fname in latest_features:
                        feature_vector.append(latest_features[fname])
                    else:
                        feature_vector.append(0.0)

                # 预测
                X = np.array(feature_vector).reshape(1, -1)
                X_scaled = sub["scaler"].transform(X)
                prediction = int(sub["model"].predict(X_scaled)[0])
                probability = sub["model"].predict_proba(X_scaled)[0].tolist() if hasattr(sub["model"], "predict_proba") else None

                # 生成信号
                signal = {
                    "up" if prediction == 1 else "down": probability[1] if probability else 0.5
                } if probability else {"up" if prediction == 1 else "down": 0.5}

                # 创建信号记录
                signal_record = {
                    "id": f"{vt_symbol}_{now.strftime('%Y%m%d%H%M%S')}",
                    "model_name": sub["model_name"],
                    "vt_symbol": vt_symbol,
                    "prediction": prediction,
                    "probability": probability,
                    "signal": signal,
                    "price": float(df['close'].iloc[-1]),
                    "timestamp": now.isoformat(),
                }

                # 更新订阅状态
                with self._lock:
                    if vt_symbol in self.subscriptions:
                        self.subscriptions[vt_symbol]["last_prediction"] = signal_record
                        self.subscriptions[vt_symbol]["last_run"] = now

                # 添加到历史
                with self._lock:
                    self.history.append(signal_record)
                    if len(self.history) > self.max_history:
                        self.history = self.history[-self.max_history:]

                # WebSocket 推送
                await ws_manager.broadcast_event(
                    topic="ml.signal",
                    data=signal_record,
                    symbol=vt_symbol
                )

            except Exception as e:
                print(f"Prediction error for {vt_symbol}: {e}")


# 全局信号服务实例
ml_signal_service = MLSignalService()


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

        # ROC 曲线数据
        roc_data = None
        if y_pred_proba is not None:
            try:
                metrics["auc"] = float(roc_auc_score(y_test, y_pred_proba))
                fpr, tpr, thresholds = roc_curve(y_test, y_pred_proba)
                roc_data = {
                    "fpr": fpr.tolist(),
                    "tpr": tpr.tolist(),
                    "thresholds": thresholds.tolist()
                }
            except:
                pass

        # 混淆矩阵 - 确保是2x2（二分类问题）
        cm = confusion_matrix(y_test, y_pred, labels=[0, 1])
        confusion_matrix_data = {
            "matrix": cm.tolist(),
            "labels": ["Negative", "Positive"]
        }

        # 分类报告
        try:
            report = classification_report(y_test, y_pred, output_dict=True, zero_division=0)
            # 转换值为float并处理可能的缺失键
            cleaned_report = {}
            for key, value in report.items():
                if isinstance(value, dict):
                    cleaned_report[key] = {k: float(v) if v is not None else 0.0 for k, v in value.items()}
                else:
                    cleaned_report[key] = float(value) if value is not None else 0.0
            report = cleaned_report
        except Exception as e:
            print(f"Classification report error: {e}")
            report = {}

        # 预测概率分布
        prediction_dist = None
        if y_pred_proba is not None:
            # 将概率分成10个区间统计
            hist, bins = np.histogram(y_pred_proba, bins=10, range=(0, 1))
            prediction_dist = {
                "bins": bins.tolist(),
                "counts": hist.tolist()
            }

        # 学习曲线数据 - 使用交叉验证结果作为近似
        learning_curve_data = {
            "train_sizes": list(range(1, 6)),
            "train_scores": [float(cv_scores.mean())] * 5,
            "val_scores": [float(cv_scores.mean() - cv_scores.std() / 2)] * 5
        }

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
            "evaluation": {
                "roc_curve": roc_data,
                "confusion_matrix": confusion_matrix_data,
                "classification_report": report,
                "prediction_distribution": prediction_dist,
                "learning_curve": learning_curve_data,
            },
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
            "evaluation": data.get("evaluation", {}),
            "created_at": data.get("created_at", ""),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/models/{name}/evaluation")
async def get_model_evaluation(name: str):
    """获取模型详细评估数据（ROC曲线、混淆矩阵等）"""
    try:
        model_path = ML_MODELS_DIR / f"{name}.joblib"
        if not model_path.exists():
            raise HTTPException(status_code=404, detail="模型不存在")

        data = joblib.load(model_path)
        return {
            "name": name,
            "metrics": data.get("metrics", {}),
            "evaluation": data.get("evaluation", {}),
            "feature_importance": data.get("importance", {}),
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


@router.post("/signals/subscribe")
async def subscribe_signals(req: SignalSubscribeRequest):
    """订阅 ML 实时信号"""
    try:
        success = ml_signal_service.subscribe(
            model_name=req.model_name,
            vt_symbol=req.vt_symbol,
            interval=req.interval
        )
        if not success:
            raise HTTPException(status_code=400, detail="订阅失败，模型可能不存在")

        return {
            "success": True,
            "message": f"已订阅 {req.vt_symbol} 的 ML 信号",
            "model_name": req.model_name,
            "interval": req.interval
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/signals/unsubscribe")
async def unsubscribe_signals(vt_symbol: str):
    """取消订阅 ML 信号"""
    try:
        success = ml_signal_service.unsubscribe(vt_symbol)
        if not success:
            raise HTTPException(status_code=404, detail="未找到该合约的订阅")

        return {
            "success": True,
            "message": f"已取消 {vt_symbol} 的 ML 信号订阅"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/signals/subscriptions")
async def get_signal_subscriptions():
    """获取当前信号订阅列表"""
    try:
        subs = ml_signal_service.get_subscriptions()
        return {
            "subscriptions": subs,
            "count": len(subs)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/signals/history")
async def get_signal_history(
    limit: int = 100,
    vt_symbol: Optional[str] = None,
    model_name: Optional[str] = None
):
    """获取 ML 信号历史"""
    try:
        history = ml_signal_service.get_history(limit=limit, vt_symbol=vt_symbol)

        # 按模型名过滤
        if model_name:
            history = [h for h in history if h.get("model_name") == model_name]

        return {
            "signals": history,
            "count": len(history)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/signals/history")
async def clear_signal_history():
    """清空信号历史"""
    try:
        ml_signal_service.clear_history()
        return {"success": True, "message": "信号历史已清空"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/signals/status")
async def get_signal_service_status():
    """获取信号服务状态"""
    try:
        subs = ml_signal_service.get_subscriptions()
        return {
            "running": ml_signal_service._running,
            "subscription_count": len(subs),
            "subscriptions": subs,
            "history_size": len(ml_signal_service.history)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ModelCompareRequest(BaseModel):
    """模型对比请求"""
    model_names: List[str]


class MLBacktestRequest(BaseModel):
    """ML 回测请求"""
    model_name: str
    vt_symbol: str
    interval: str = "1d"
    start: str
    end: str
    initial_capital: float = 1000000
    position_size: float = 0.1  # 仓位比例
    take_profit: Optional[float] = None  # 止盈比例
    stop_loss: Optional[float] = None  # 止损比例


@router.post("/models/compare")
async def compare_models(req: ModelCompareRequest):
    """对比多个模型的性能"""
    try:
        if len(req.model_names) < 2:
            raise HTTPException(status_code=400, detail="至少需要选择2个模型进行对比")

        comparison_results = []

        for model_name in req.model_names:
            model_path = ML_MODELS_DIR / f"{model_name}.joblib"
            if not model_path.exists():
                continue

            try:
                data = joblib.load(model_path)
                metrics = data.get("metrics", {})
                importance = data.get("importance", {})
                config = data.get("config", {})
                created_at = data.get("created_at", "")

                comparison_results.append({
                    "name": model_name,
                    "model_type": type(data["model"]).__name__,
                    "metrics": metrics,
                    "top_features": list(importance.keys())[:5] if importance else [],
                    "feature_count": len(data.get("feature_names", [])),
                    "target_config": config.get("target_config", {}),
                    "created_at": created_at,
                })
            except Exception:
                continue

        if len(comparison_results) < 2:
            raise HTTPException(status_code=400, detail="可对比的有效模型不足")

        # 计算排名
        rankings = {
            "accuracy": sorted(comparison_results, key=lambda x: x["metrics"].get("accuracy", 0), reverse=True),
            "precision": sorted(comparison_results, key=lambda x: x["metrics"].get("precision", 0), reverse=True),
            "recall": sorted(comparison_results, key=lambda x: x["metrics"].get("recall", 0), reverse=True),
            "f1": sorted(comparison_results, key=lambda x: x["metrics"].get("f1", 0), reverse=True),
            "auc": sorted(comparison_results, key=lambda x: x["metrics"].get("auc", 0), reverse=True),
        }

        # 综合评分 (加权平均)
        for model in comparison_results:
            m = model["metrics"]
            score = (
                m.get("accuracy", 0) * 0.25 +
                m.get("precision", 0) * 0.25 +
                m.get("recall", 0) * 0.25 +
                m.get("f1", 0) * 0.25
            )
            model["composite_score"] = round(score, 4)

        # 按综合评分排序
        comparison_results.sort(key=lambda x: x["composite_score"], reverse=True)

        return {
            "models": comparison_results,
            "rankings": {
                metric: [{"name": m["name"], "value": m["metrics"].get(metric, 0)} for m in ranked]
                for metric, ranked in rankings.items()
            },
            "best_model": comparison_results[0]["name"] if comparison_results else None,
            "model_count": len(comparison_results)
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/backtest")
async def run_ml_backtest(req: MLBacktestRequest):
    """运行 ML 模型信号回测"""
    try:
        # 加载模型
        model_path = ML_MODELS_DIR / f"{req.model_name}.joblib"
        if not model_path.exists():
            raise HTTPException(status_code=404, detail="模型不存在")

        model_data = joblib.load(model_path)
        model = model_data["model"]
        scaler = model_data["scaler"]
        feature_names = model_data["feature_names"]
        config = FeatureConfig(**model_data.get("config", {}))

        # 获取历史数据
        history = bridge.query_history(req.vt_symbol, req.start, req.end, req.interval)

        if not history or len(history) < 50:
            raise HTTPException(status_code=400, detail="历史数据不足，至少需要50条数据")

        # 转换为 DataFrame
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

        if len(features) < 30:
            raise HTTPException(status_code=400, detail="有效样本不足")

        # 回测模拟
        capital = req.initial_capital
        position = 0  # 持仓数量
        trades = []
        daily_pnl = []
        equity_curve = []

        for i in range(len(features)):
            date = features.index[i]
            current_price = df.loc[date, 'close']

            # 获取特征并预测
            feature_vector = []
            for fname in feature_names:
                if fname in features.columns:
                    feature_vector.append(features.loc[date, fname])
                else:
                    feature_vector.append(0.0)

            X = np.array(feature_vector).reshape(1, -1)
            X_scaled = scaler.transform(X)
            prediction = int(model.predict(X_scaled)[0])
            probability = model.predict_proba(X_scaled)[0].tolist() if hasattr(model, "predict_proba") else [0.5, 0.5]

            signal_strength = abs(probability[1] - 0.5) * 2  # 0-1

            # 交易逻辑
            if prediction == 1 and position <= 0:  # 买入信号
                # 平空仓
                if position < 0:
                    pnl = (current_price - trades[-1]['price']) * abs(position)
                    trades.append({
                        'date': date.strftime('%Y-%m-%d'),
                        'action': '平空',
                        'price': current_price,
                        'pnl': pnl
                    })
                    capital += pnl
                    position = 0

                # 开多仓
                position_size = int(capital * req.position_size / current_price)
                if position_size > 0:
                    position = position_size
                    trades.append({
                        'date': date.strftime('%Y-%m-%d'),
                        'action': '买入',
                        'price': current_price,
                        'size': position_size,
                        'confidence': signal_strength
                    })

            elif prediction == 0 and position >= 0:  # 卖出信号
                # 平多仓
                if position > 0:
                    pnl = (current_price - trades[-1]['price']) * position
                    trades.append({
                        'date': date.strftime('%Y-%m-%d'),
                        'action': '卖出',
                        'price': current_price,
                        'pnl': pnl
                    })
                    capital += pnl
                    position = 0

                # 开空仓
                position_size = int(capital * req.position_size / current_price)
                if position_size > 0:
                    position = -position_size
                    trades.append({
                        'date': date.strftime('%Y-%m-%d'),
                        'action': '卖空',
                        'price': current_price,
                        'size': position_size,
                        'confidence': signal_strength
                    })

            # 计算当日权益
            unrealized = 0
            if position > 0:
                unrealized = (current_price - trades[-1]['price']) * position
            elif position < 0:
                unrealized = (trades[-1]['price'] - current_price) * abs(position)

            total_equity = capital + unrealized
            equity_curve.append({
                'date': date.strftime('%Y-%m-%d'),
                'equity': round(total_equity, 2)
            })

            daily_pnl.append({
                'date': date.strftime('%Y-%m-%d'),
                'pnl': round(unrealized, 2)
            })

        # 计算回测指标
        final_equity = equity_curve[-1]['equity'] if equity_curve else req.initial_capital
        total_return = (final_equity - req.initial_capital) / req.initial_capital

        # 计算最大回撤
        max_drawdown = 0
        peak = req.initial_capital
        for point in equity_curve:
            if point['equity'] > peak:
                peak = point['equity']
            drawdown = (peak - point['equity']) / peak
            if drawdown > max_drawdown:
                max_drawdown = drawdown

        # 计算胜率
        closed_trades = [t for t in trades if 'pnl' in t and t['pnl'] is not None]
        winning_trades = [t for t in closed_trades if t.get('pnl', 0) > 0]
        win_rate = len(winning_trades) / len(closed_trades) if closed_trades else 0

        return {
            "model_name": req.model_name,
            "vt_symbol": req.vt_symbol,
            "period": {"start": req.start, "end": req.end},
            "initial_capital": req.initial_capital,
            "final_equity": round(final_equity, 2),
            "total_return": round(total_return, 4),
            "total_return_pct": round(total_return * 100, 2),
            "max_drawdown": round(max_drawdown, 4),
            "max_drawdown_pct": round(max_drawdown * 100, 2),
            "trade_count": len(closed_trades),
            "win_count": len(winning_trades),
            "loss_count": len(closed_trades) - len(winning_trades),
            "win_rate": round(win_rate, 4),
            "win_rate_pct": round(win_rate * 100, 2),
            "trades": trades,
            "equity_curve": equity_curve,
            "daily_pnl": daily_pnl
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/features/preview")
async def preview_features(req: FeaturePreviewRequest):
    """预览特征工程结果 - 返回特征统计信息和与目标变量的相关性"""
    try:
        # 获取历史数据
        history = bridge.query_history(req.vt_symbol, req.start, req.end, req.interval)

        if not history or len(history) < 50:
            raise HTTPException(status_code=400, detail="历史数据不足，至少需要50条数据")

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

        if len(features) < 30:
            raise HTTPException(status_code=400, detail="有效样本不足，请扩大数据范围")

        # 计算特征统计信息
        feature_stats = []
        for col in features.columns:
            col_data = features[col]
            # 跳过全为NaN的特征
            if col_data.isna().all():
                continue

            def safe_float(val):
                if pd.isna(val) or np.isinf(val):
                    return 0.0
                return float(val)

            stats = {
                "name": col,
                "mean": safe_float(col_data.mean()),
                "std": safe_float(col_data.std()),
                "min": safe_float(col_data.min()),
                "max": safe_float(col_data.max()),
                "median": safe_float(col_data.median()),
            }

            # 计算与目标变量的相关性
            try:
                correlation = safe_float(col_data.corr(target.astype(float)))
                stats["target_correlation"] = correlation
            except:
                stats["target_correlation"] = 0.0

            feature_stats.append(stats)

        # 按相关性排序
        feature_stats.sort(key=lambda x: abs(x.get("target_correlation", 0)), reverse=True)

        # 目标变量分布
        target_dist = target.value_counts().to_dict()
        target_dist = {str(k): int(v) for k, v in target_dist.items()}

        return {
            "vt_symbol": req.vt_symbol,
            "interval": req.interval,
            "samples_count": len(features),
            "features_count": len(features.columns),
            "target_distribution": target_dist,
            "target_config": {
                "horizon": req.feature_config.target_horizon,
                "type": req.feature_config.target_type
            },
            "feature_stats": feature_stats,
            "date_range": {
                "start": features.index[0].strftime("%Y-%m-%d"),
                "end": features.index[-1].strftime("%Y-%m-%d")
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
