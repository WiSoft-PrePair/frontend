/**
 * 화상 면접 TTS 파이프라인 (프론트 역할만 정의)
 *
 * 1. 백엔드 질문 생성 API (`createVideoInterviewQuestion` → `/interviews/.../video` 등)가 질문 목록을 준다.
 * 2. `normalizeVideoQuestionList`가 각 항목에서 **질문 본문만** 뽑아 `text` 필드로 둔다.
 * 3. 그 문자열을 `textToSpeech`로 넘기면 전용 TTS 서버·동일 출처 프록시(`/tts`, `/api/tts` 등)로 요청한다.
 *    OpenAI API 키는 서버 쪽에서만 사용한다.
 */

import { textToSpeech } from './ttsApi'

/**
 * 면접 질문 문장 하나를 음성(blob)으로 받는다.
 *
 * @param {string} questionText - API 응답에서 추출한 질문 문자열 (`question` / `text` → `normalizeVideoQuestionList`의 `text`)
 * @param {object} [options] - `ttsApi.textToSpeech`와 동일 (`speaker`, `accessToken`, `language_type` 등)
 * @param {AbortSignal|null} [signal]
 * @returns {Promise<Blob>}
 */
export function speechFromInterviewQuestion(questionText, options = {}, signal = null) {
  return textToSpeech(questionText, options, signal)
}
