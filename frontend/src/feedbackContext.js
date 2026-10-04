// Ephemeral allowlisted status only; never store prompts, replies or credentials.
let aiStatus = null;
export function rememberFeedbackAIStatus(value) {
  aiStatus = ['available', 'unavailable', 'not_requested'].includes(value) ? value : null;
}
export function getFeedbackAIStatus() { return aiStatus; }
