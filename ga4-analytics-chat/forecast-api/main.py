"""
GA4売上予測API
Prophetを使用して時系列データから将来の売上を予測
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import pandas as pd
from prophet import Prophet
import logging
from datetime import datetime, timedelta

# ロギング設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="GA4 Forecast API",
    description="Prophetを使用したGA4データの売上予測API",
    version="1.0.0"
)

# CORS設定（Next.jsアプリからのアクセスを許可）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 本番環境では特定のオリジンに制限
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class DataPoint(BaseModel):
    """時系列データポイント"""
    date: str  # YYYY-MM-DD形式
    value: float  # 売上などの数値

class ForecastRequest(BaseModel):
    """予測リクエスト"""
    data: List[DataPoint]
    periods: int = 30  # 予測期間（日数）
    metric_name: Optional[str] = "売上"

class ForecastResponse(BaseModel):
    """予測レスポンス"""
    historical: List[dict]  # 過去データ
    forecast: List[dict]    # 予測データ
    metric_name: str

@app.get("/")
async def root():
    """ヘルスチェック"""
    return {
        "status": "ok",
        "service": "GA4 Forecast API",
        "version": "1.0.0"
    }

@app.get("/health")
async def health():
    """ヘルスチェックエンドポイント"""
    return {"status": "healthy"}

@app.post("/forecast", response_model=ForecastResponse)
async def create_forecast(request: ForecastRequest):
    """
    時系列データから将来の値を予測

    Parameters:
    - data: 過去の時系列データ（日付と値のペア）
    - periods: 予測する日数（デフォルト: 30日）
    - metric_name: メトリクス名（表示用）

    Returns:
    - historical: 過去データ
    - forecast: 予測データ（予測値、信頼区間含む）
    """
    try:
        logger.info(f"予測リクエスト受信: {len(request.data)}件のデータ, {request.periods}日間予測")

        # データ検証
        if len(request.data) < 7:
            raise HTTPException(
                status_code=400,
                detail="予測には最低7日分のデータが必要です"
            )

        # DataFrameに変換（Prophetの入力形式: ds=日付, y=値）
        df = pd.DataFrame([
            {
                'ds': pd.to_datetime(point.date),
                'y': point.value
            }
            for point in request.data
        ])

        # 日付でソート
        df = df.sort_values('ds').reset_index(drop=True)

        logger.info(f"データ範囲: {df['ds'].min()} ~ {df['ds'].max()}")
        logger.info(f"値の範囲: {df['y'].min()} ~ {df['y'].max()}")

        # データ期間に応じて年次季節性を自動調整
        data_days = (df['ds'].max() - df['ds'].min()).days
        enable_yearly = data_days >= 180  # 半年以上のデータがあれば年次季節性を有効化

        logger.info(f"データ期間: {data_days}日, 年次季節性: {'有効' if enable_yearly else '無効'}")

        # Prophetモデルの作成と学習
        model = Prophet(
            daily_seasonality=True,
            weekly_seasonality=True,
            yearly_seasonality=enable_yearly,  # データ期間に応じて自動調整
            changepoint_prior_scale=0.05,  # トレンドの柔軟性
            interval_width=0.95  # 信頼区間95%
        )

        # 売上は必ず0以上（マイナスにならない）
        df['floor'] = 0
        model.fit(df)
        logger.info("モデル学習完了")

        # 未来の日付を生成
        future = model.make_future_dataframe(periods=request.periods)

        # 予測データにもfloorを設定（売上は0以上）
        future['floor'] = 0

        # 予測実行
        forecast_df = model.predict(future)
        logger.info("予測完了")

        # 過去データの整形
        historical = [
            {
                'date': row['ds'].strftime('%Y-%m-%d'),
                'value': float(row['y']),
                'predicted': max(0, float(forecast_df.loc[idx, 'yhat'])),  # マイナス値を0にクリップ
                'lower': max(0, float(forecast_df.loc[idx, 'yhat_lower'])),
                'upper': max(0, float(forecast_df.loc[idx, 'yhat_upper']))
            }
            for idx, row in df.iterrows()
        ]

        # 予測データの整形（未来のみ）
        forecast_start_idx = len(df)
        forecast = [
            {
                'date': row['ds'].strftime('%Y-%m-%d'),
                'predicted': max(0, float(row['yhat'])),  # マイナス値を0にクリップ
                'lower': max(0, float(row['yhat_lower'])),  # 信頼区間下限も0以上
                'upper': max(0, float(row['yhat_upper']))  # 念のため上限も
            }
            for idx, row in forecast_df.iloc[forecast_start_idx:].iterrows()
        ]

        logger.info(f"予測結果: {len(forecast)}件")

        return ForecastResponse(
            historical=historical,
            forecast=forecast,
            metric_name=request.metric_name or "売上"
        )

    except ValueError as e:
        logger.error(f"データエラー: {str(e)}")
        raise HTTPException(status_code=400, detail=f"データエラー: {str(e)}")
    except Exception as e:
        logger.error(f"予測エラー: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"予測処理エラー: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
