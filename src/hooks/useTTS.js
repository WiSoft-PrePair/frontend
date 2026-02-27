import { useState, useRef, useCallback } from 'react'
import { textToSpeech, TTS_SPEAKERS } from '../utils/ttsApi'

/**
 * TTS (Text-to-Speech) 커스텀 훅
 *
 * @example
 * const { speak, stop, isPlaying, isLoading, error } = useTTS()
 * await speak('안녕하세요') // 기본 음성
 */
export function useTTS(defaultOptions = {}) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState({ current: 0, total: 0 })

  const audioRef = useRef(null)
  const abortControllerRef = useRef(null)

  /**
   * 현재 재생 중인 오디오 정지
   */
  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsPlaying(false)
    setIsLoading(false)
  }, [])

  /**
   * 텍스트를 음성으로 변환하여 재생
   * @param {string} text - 변환할 텍스트
   * @param {Object} options - TTS 옵션
   * @returns {Promise<void>} 오디오 재생 완료 시 resolve
   */
  const speak = useCallback(async (text, options = {}) => {
    // 이전 재생 중지
    stop()

    if (!text || text.trim().length === 0) {
      return
    }

    setIsLoading(true)
    setError(null)
    abortControllerRef.current = new AbortController()

    try {
      const mergedOptions = { ...defaultOptions, ...options }
      const blob = await textToSpeech(text, mergedOptions)

      // 중단되었는지 확인
      if (abortControllerRef.current?.signal.aborted) {
        return
      }

      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio

      // 오디오 재생 완료까지 기다리는 Promise
      await new Promise((resolve, reject) => {
        audio.onplay = () => {
          setIsPlaying(true)
          setIsLoading(false)
        }

        audio.onended = () => {
          setIsPlaying(false)
          URL.revokeObjectURL(url)
          audioRef.current = null
          resolve()
        }

        audio.onerror = () => {
          setError(new Error('오디오 재생에 실패했습니다.'))
          setIsPlaying(false)
          setIsLoading(false)
          URL.revokeObjectURL(url)
          audioRef.current = null
          reject(new Error('오디오 재생 실패'))
        }

        audio.play().catch((err) => {
          setIsLoading(false)
          reject(err)
        })
      })
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err)
        console.error('[useTTS] speak error:', err)
      }
      setIsLoading(false)
      throw err
    }
  }, [defaultOptions, stop])

  /**
   * 긴 텍스트를 청크로 나누어 순차 재생
   * @param {string} text - 변환할 텍스트
   * @param {Object} options - TTS 옵션
   */
  const speakLong = useCallback(async (text, options = {}) => {
    stop()

    if (!text || text.trim().length === 0) {
      return
    }

    const chunks = splitTextIntoChunks(text, 500)
    setProgress({ current: 0, total: chunks.length })
    setIsLoading(true)
    setError(null)
    abortControllerRef.current = new AbortController()

    try {
      const mergedOptions = { ...defaultOptions, ...options }

      for (let i = 0; i < chunks.length; i++) {
        // 중단되었는지 확인
        if (abortControllerRef.current?.signal.aborted) {
          break
        }

        setProgress({ current: i + 1, total: chunks.length })

        const blob = await textToSpeech(chunks[i], mergedOptions)

        if (abortControllerRef.current?.signal.aborted) {
          break
        }

        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        audioRef.current = audio

        setIsPlaying(true)
        setIsLoading(false)

        await new Promise((resolve, reject) => {
          audio.onended = () => {
            URL.revokeObjectURL(url)
            resolve()
          }
          audio.onerror = (e) => {
            URL.revokeObjectURL(url)
            reject(new Error('오디오 재생에 실패했습니다.'))
          }
          audio.play().catch(reject)
        })
      }

      setIsPlaying(false)
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err)
        console.error('[useTTS] speakLong error:', err)
      }
      setIsPlaying(false)
      setIsLoading(false)
    }
  }, [defaultOptions, stop])

  return {
    speak,
    speakLong,
    stop,
    isPlaying,
    isLoading,
    error,
    progress,
    speakers: TTS_SPEAKERS,
  }
}

/**
 * 텍스트를 청크로 분할
 */
function splitTextIntoChunks(text, maxLength) {
  if (text.length <= maxLength) {
    return [text]
  }

  const chunks = []
  let remaining = text

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining)
      break
    }

    let splitIndex = -1
    const searchEnd = Math.min(remaining.length, maxLength)

    // 문장 끝에서 분할
    for (let i = searchEnd - 1; i >= maxLength * 0.5; i--) {
      if (['.', '?', '!', '。'].includes(remaining[i])) {
        splitIndex = i + 1
        break
      }
    }

    // 공백에서 분할
    if (splitIndex === -1) {
      for (let i = searchEnd - 1; i >= maxLength * 0.5; i--) {
        if (remaining[i] === ' ' || remaining[i] === '\n') {
          splitIndex = i + 1
          break
        }
      }
    }

    // 강제 분할
    if (splitIndex === -1) {
      splitIndex = maxLength
    }

    chunks.push(remaining.slice(0, splitIndex).trim())
    remaining = remaining.slice(splitIndex).trim()
  }

  return chunks
}

export default useTTS
