import crypto from 'crypto'

/**
 * Slackからのリクエストの署名を検証する
 * リプレイ攻撃対策として、タイムスタンプが5分以上古い場合は拒否
 * @param body リクエストボディ（生テキスト）
 * @param timestamp X-Slack-Request-Timestampヘッダー
 * @param signature X-Slack-Signatureヘッダー
 * @returns 署名が有効ならtrue
 */
export function verifySlackSignature(
  body: string,
  timestamp: string,
  signature: string
): boolean {
  const signingSecret = process.env.SLACK_SIGNING_SECRET

  if (!signingSecret) {
    throw new Error('SLACK_SIGNING_SECRET is not set')
  }

  // タイムスタンプチェック（リプレイ攻撃対策）
  const now = Math.floor(Date.now() / 1000)
  const requestTime = parseInt(timestamp, 10)

  if (isNaN(requestTime)) {
    return false
  }

  // 5分以上古いリクエストは拒否
  if (Math.abs(now - requestTime) > 60 * 5) {
    return false
  }

  // 署名生成
  const sigBasestring = `v0:${timestamp}:${body}`
  const hmac = crypto.createHmac('sha256', signingSecret)
  hmac.update(sigBasestring, 'utf8')
  const computedSignature = `v0=${hmac.digest('hex')}`

  // 定数時間比較（タイミング攻撃対策）
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'utf8'),
      Buffer.from(computedSignature, 'utf8')
    )
  } catch (error) {
    // バッファ長が異なる場合、timingSafeEqualは例外を投げる
    return false
  }
}
