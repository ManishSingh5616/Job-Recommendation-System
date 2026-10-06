import axios from 'axios';

export const ai = axios.create({
  baseURL: process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000',
  headers: { 'X-Internal-Key': process.env.INTERNAL_API_KEY || '' },
  timeout: 20 * 60 * 1000, // resume analysis sends every chunk to the LLM, so allow time
});

/** Turn an AI-service failure into { status, message } for the client. */
export function aiFailure(err) {
  if (err.response) {
    const detail = err.response.data?.detail;
    if (err.response.status === 422) return { status: 422, message: typeof detail === 'string' ? detail : 'The file could not be processed.' };
    return { status: 502, message: 'The AI service returned an error. Check its console for details.' };
  }
  if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') {
    return { status: 503, message: 'The AI service is not running. Start it with: uvicorn app.main:app --port 8000' };
  }
  if (err.code === 'ECONNABORTED') return { status: 504, message: 'The AI service took too long to respond.' };
  return { status: 502, message: 'Could not reach the AI service.' };
}
