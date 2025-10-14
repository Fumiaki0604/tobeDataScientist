# GA4 Forecast API

ProphetベースのGA4データ予測APIサーバー

## セットアップ

### ローカル開発

```bash
# 依存パッケージのインストール
pip install -r requirements.txt

# サーバー起動
python main.py
```

サーバーは http://localhost:8000 で起動します。

### APIドキュメント

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API仕様

### POST /forecast

時系列データから将来の値を予測します。

**リクエスト:**
```json
{
  "data": [
    {"date": "2024-01-01", "value": 100000},
    {"date": "2024-01-02", "value": 120000},
    ...
  ],
  "periods": 30,
  "metric_name": "売上"
}
```

**レスポンス:**
```json
{
  "historical": [
    {
      "date": "2024-01-01",
      "value": 100000,
      "predicted": 98500,
      "lower": 95000,
      "upper": 102000
    }
  ],
  "forecast": [
    {
      "date": "2024-02-01",
      "predicted": 110000,
      "lower": 105000,
      "upper": 115000
    }
  ],
  "metric_name": "売上"
}
```

## Renderへのデプロイ

1. GitHubにプッシュ
2. Renderで新しいWeb Serviceを作成
3. 以下の設定:
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - Python Version: 3.11
