import { DASHBOARD_TUI_MODE } from '../config/env.js'

export interface SessionResumeParams {
  [key: string]: unknown
  cols: number
  follow_config_model?: true
  session_id: string
}

/**
 * Params for `session.resume`. The dashboard chat presents one model chosen in
 * AI model settings, so its resumed sessions follow that configured model
 * instead of pinning the model the chat last used.
 */
export const sessionResumeParams = (
  sessionId: string,
  cols: number,
  dashboardTuiMode = DASHBOARD_TUI_MODE
): SessionResumeParams =>
  dashboardTuiMode ? { cols, follow_config_model: true, session_id: sessionId } : { cols, session_id: sessionId }
