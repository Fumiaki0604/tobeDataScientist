import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'

/**
 * Slack OAuthトークンを暗号化する
 * @param token 暗号化するトークン
 * @returns 暗号化されたトークン（IV:AuthTag:EncryptedData の形式）
 */
export async function encryptToken(token: string): Promise<string> {
  const encryptionKey = process.env.SLACK_TOKEN_ENCRYPTION_KEY

  if (!encryptionKey) {
    throw new Error('SLACK_TOKEN_ENCRYPTION_KEY is not set')
  }

  if (encryptionKey.length !== 64) {
    throw new Error(
      'SLACK_TOKEN_ENCRYPTION_KEY must be 64 characters (32 bytes in hex)'
    )
  }

  const key = Buffer.from(encryptionKey, 'hex')
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(token, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  // IV + AuthTag + Encrypted Data を結合
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

/**
 * 暗号化されたトークンを復号化する
 * @param encryptedToken 暗号化されたトークン
 * @returns 復号化されたトークン
 */
export async function decryptToken(encryptedToken: string): Promise<string> {
  const encryptionKey = process.env.SLACK_TOKEN_ENCRYPTION_KEY

  if (!encryptionKey) {
    throw new Error('SLACK_TOKEN_ENCRYPTION_KEY is not set')
  }

  if (encryptionKey.length !== 64) {
    throw new Error(
      'SLACK_TOKEN_ENCRYPTION_KEY must be 64 characters (32 bytes in hex)'
    )
  }

  const [ivHex, authTagHex, encrypted] = encryptedToken.split(':')

  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error('Invalid encrypted token format')
  }

  const key = Buffer.from(encryptionKey, 'hex')
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}
