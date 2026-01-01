// Slack連携関連の型定義

export interface SlackIntegration {
  id: number
  workspace_id: string
  workspace_name: string
  team_name: string | null
  access_token_encrypted: string
  bot_user_id: string
  installed_by: string | null
  installed_at: string
  is_active: boolean
  last_health_check: string | null
  created_at: string
  updated_at: string
}

export interface SlackDailyDeliverySetting {
  id: number
  slack_integration_id: number
  channel_id: string
  channel_name: string | null
  delivery_time: string // HH:MM:SS
  timezone: string
  category_ids: number[] | null
  difficulty_min: number
  difficulty_max: number
  only_approved: boolean
  is_enabled: boolean
  created_at: string
  updated_at: string
}

export interface SlackDailyDelivery {
  id: number
  setting_id: number
  question_id: number
  delivered_at: string
  message_ts: string
  channel_id: string
  status: 'sent' | 'failed' | 'expired'
  error_message: string | null
  total_responses: number
  correct_responses: number
  created_at: string
}

export interface SlackAnswer {
  id: number
  delivery_id: number
  slack_user_id: string
  slack_username: string | null
  user_id: string | null
  question_id: number
  user_answer: 'a' | 'b' | 'c' | 'd'
  is_correct: boolean
  answered_at: string
  time_since_delivery_ms: number | null
  created_at: string
}

export interface SlackGamificationStreak {
  id: number
  slack_integration_id: number
  slack_user_id: string
  slack_username: string | null
  user_id: string | null
  current_streak: number
  longest_streak: number
  last_answer_date: string | null
  total_answers: number
  total_correct: number
  accuracy_percentage: number | null
  created_at: string
  updated_at: string
}

export interface SlackAchievement {
  id: number
  streak_id: number
  achievement_type:
    | 'streak_3'
    | 'streak_7'
    | 'streak_30'
    | 'perfect_10'
    | 'first_answer'
    | 'speed_demon'
  achievement_name: string
  earned_at: string
}

export interface SlackUserMapping {
  id: number
  slack_integration_id: number
  slack_user_id: string
  user_id: string
  mapping_method: 'oauth' | 'email_match' | 'manual'
  created_at: string
}

// Slack API Response Types

export interface SlackOAuthV2AccessResponse {
  ok: boolean
  access_token: string
  token_type: string
  scope: string
  bot_user_id: string
  app_id: string
  team: {
    id: string
    name: string
  }
  enterprise: {
    id: string
    name: string
  } | null
  authed_user: {
    id: string
    scope: string
    access_token: string
    token_type: string
  }
  error?: string
}

export interface SlackChannel {
  id: string
  name: string
  is_channel: boolean
  is_private: boolean
  is_archived: boolean
}

export interface SlackUser {
  id: string
  name: string
  real_name: string
  is_bot: boolean
  profile: {
    email?: string
    image_72?: string
  }
}

// Slack Block Kit Types

export interface SlackBlockKitMessage {
  blocks: SlackBlock[]
  text: string // Fallback text
}

export type SlackBlock =
  | SlackHeaderBlock
  | SlackSectionBlock
  | SlackDividerBlock
  | SlackActionsBlock
  | SlackContextBlock

export interface SlackHeaderBlock {
  type: 'header'
  text: {
    type: 'plain_text'
    text: string
    emoji?: boolean
  }
}

export interface SlackSectionBlock {
  type: 'section'
  text: {
    type: 'mrkdwn' | 'plain_text'
    text: string
  }
  accessory?: any
  fields?: any[]
}

export interface SlackDividerBlock {
  type: 'divider'
}

export interface SlackActionsBlock {
  type: 'actions'
  block_id: string
  elements: SlackButtonElement[]
}

export interface SlackButtonElement {
  type: 'button'
  text: {
    type: 'plain_text'
    text: string
    emoji?: boolean
  }
  value: string
  action_id: string
  style?: 'primary' | 'danger'
}

export interface SlackContextBlock {
  type: 'context'
  elements: Array<{
    type: 'mrkdwn' | 'plain_text' | 'image'
    text?: string
    image_url?: string
    alt_text?: string
  }>
}

// Slack Interactive Payload Types

export interface SlackInteractivePayload {
  type: 'block_actions' | 'view_submission' | 'view_closed'
  user: {
    id: string
    username: string
    name: string
  }
  channel: {
    id: string
    name: string
  }
  message: {
    ts: string
    text: string
  }
  actions: Array<{
    action_id: string
    block_id: string
    type: string
    value: string
  }>
  response_url: string
  trigger_id: string
}
