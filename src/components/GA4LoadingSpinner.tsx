'use client'

import { useEffect, useState } from 'react'

export default function GA4LoadingSpinner() {
  const animatedText = ['G', 'N', 'I', 'D', 'A', 'O', 'L']
  const [logs, setLogs] = useState<string[]>([])

  useEffect(() => {
    // ローカルストレージからログを定期的に取得
    const interval = setInterval(() => {
      const storedLogs = localStorage.getItem('ga4-loading-logs')
      if (storedLogs) {
        try {
          const parsed = JSON.parse(storedLogs)
          // 最新3行のみ表示
          setLogs(parsed.slice(-3))
        } catch (e) {
          // エラーは無視
        }
      }
    }, 300) // 300msごとに更新

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="fixed inset-0 bg-gray-50 flex flex-col items-center justify-center z-50 gap-8">
      <svg
        version="1.1"
        xmlns="http://www.w3.org/2000/svg"
        xmlnsXlink="http://www.w3.org/1999/xlink"
        x="0px"
        y="0px"
        width="96px"
        viewBox="0 0 48 34"
        enableBackground="new 0 0 48 34"
        xmlSpace="preserve"
      >
        <defs>
          <clipPath id="mask">
            <polygon
              transform="rotate(180 18 11)"
              points="10,15.2 13.5,10.9 23.2,20.8 35.7,7.9 35.7,0 10,0"
            />
          </clipPath>
        </defs>

        <g transform="rotate(180 18 11)" clipPath="url(#mask)">
          <rect x="0" y="0" width="7" height="14" fill="#9CA3AF">
            <animateTransform
              attributeType="xml"
              attributeName="transform"
              type="scale"
              values="1,1; 1,1.5; 1,1"
              begin="0.4s"
              dur="0.8s"
              repeatCount="indefinite"
            />
          </rect>
          <rect x="9" y="0" width="7" height="19" fill="#9CA3AF">
            <animateTransform
              attributeType="xml"
              attributeName="transform"
              type="scale"
              values="1,0.2; 1,1.2; 1,0.2"
              begin="0.3s"
              dur="0.8s"
              repeatCount="indefinite"
            />
          </rect>
          <rect x="18" y="0" width="8" height="14" fill="#9CA3AF">
            <animateTransform
              attributeType="xml"
              attributeName="transform"
              type="scale"
              values="1,0.2; 1,1.5; 1,0.2"
              begin="0s"
              dur="0.8s"
              repeatCount="indefinite"
            />
          </rect>
        </g>

        <polygon
          fill="#E67E25"
          points="38.6,2 41.4,4.2 36.1,10.2 29.5,17 26.8,19.8 23.3,23.3 19.9,19.8 17.1,17 13.7,13.5 10.2,17.7 0,30.2 10,20.8 10,34 16.9,34 16.9,22.2 19.7,25.1 19.7,34 26.7,34 26.7,25.3 29.5,22.5 29.5,34 36.4,34 36.4,15.5 44.1,7.1 46.4,9.7 48,0"
        />
      </svg>

      {/* 固定テキスト */}
      <p className="text-lg text-gray-900 font-medium">GA4プロパティを読み込んでいます</p>

      {/* ログ表示（最新3行） */}
      {logs.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-4 w-full max-w-2xl">
          <div className="space-y-1 font-mono text-sm text-gray-700">
            {logs.map((log, index) => (
              <div key={index} className="animate-fade-in">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LOADINGアニメーション */}
      <div className="relative w-[600px] h-[36px] overflow-visible select-none">
        {animatedText.map((char, index) => (
          <div
            key={index}
            className="absolute w-[20px] h-[36px] opacity-0 font-sans text-gray-500 text-2xl font-normal"
            style={{
              animation: 'textMove 2s linear infinite',
              animationDelay: `${index * 0.2}s`,
              transform: 'rotate(180deg)',
            }}
          >
            {char}
          </div>
        ))}
      </div>

      <style jsx>{`
        @keyframes textMove {
          0% {
            left: 0;
            opacity: 0;
          }
          35% {
            left: 41%;
            transform: rotate(0deg);
            opacity: 1;
          }
          65% {
            left: 59%;
            transform: rotate(0deg);
            opacity: 1;
          }
          100% {
            left: 100%;
            transform: rotate(-180deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}
