import type { Question } from '@/types/database'

/**
 * 日次問題配信のBlock Kitメッセージを生成
 */
export function createDailyQuestionMessage(question: Question, deliveryId: number) {
  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '📚 本日のデータサイエンティスト試験問題',
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*問題 #${question.id}*\n${question.question_text}`,
      },
    },
    {
      type: 'divider',
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*選択肢を選んでください:*',
      },
    },
    {
      type: 'actions',
      block_id: `question_${deliveryId}`,
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'A',
            emoji: true,
          },
          value: 'A',
          action_id: 'answer_A',
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'B',
            emoji: true,
          },
          value: 'B',
          action_id: 'answer_B',
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'C',
            emoji: true,
          },
          value: 'C',
          action_id: 'answer_C',
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'D',
            emoji: true,
          },
          value: 'D',
          action_id: 'answer_D',
        },
      ],
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `カテゴリ: *${question.category}* | 難易度: *${question.difficulty}*`,
        },
      ],
    },
  ]

  return { blocks }
}

/**
 * 正解時のメッセージを生成
 */
export function createCorrectAnswerMessage(
  question: Question,
  selectedAnswer: string,
  streak?: number
) {
  let streakText = ''
  if (streak && streak > 1) {
    streakText = `\n🔥 連続正答: *${streak}日* おめでとうございます！`
  }

  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `✅ *正解です！*\n\nあなたの回答: *${selectedAnswer}*\n正解: *${question.correct_answer}*${streakText}`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*解説:*\n${question.explanation || '解説はありません'}`,
      },
    },
  ]

  return { blocks, replace_original: true }
}

/**
 * 不正解時のメッセージを生成
 */
export function createIncorrectAnswerMessage(
  question: Question,
  selectedAnswer: string
) {
  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `❌ *不正解です*\n\nあなたの回答: *${selectedAnswer}*\n正解: *${question.correct_answer}*`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*解説:*\n${question.explanation || '解説はありません'}`,
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '次回頑張りましょう！ 💪',
        },
      ],
    },
  ]

  return { blocks, replace_original: true }
}

/**
 * 既に回答済みの場合のエラーメッセージ
 */
export function createAlreadyAnsweredMessage() {
  return {
    text: '⚠️ この問題には既に回答済みです',
    replace_original: false,
  }
}

/**
 * エラーメッセージを生成
 */
export function createErrorMessage(errorMessage: string) {
  return {
    text: `❌ エラーが発生しました: ${errorMessage}`,
    replace_original: false,
  }
}
