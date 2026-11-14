// POST /api/ask  { question: string, history?: [{ role: 'user'|'bot', text }] }
// Thin HTTP wrapper: all the work happens in lib/pipeline.js.
// Response always has `status` and a plain-text `answer`; see lib/pipeline.js for the full shape.
import { NextResponse } from 'next/server';
import { answerQuestion } from '@/lib/pipeline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    const msg = 'Request body must be JSON: { "question": "..." }';
    return NextResponse.json({ status: 'error', message: msg, answer: msg }, { status: 400 });
  }

  try {
    const result = await answerQuestion(body?.question, body?.history);
    return NextResponse.json(result, { status: result.status === 'error' ? 400 : 200 });
  } catch (e) {
    console.error('[api/ask] unexpected failure:', e);
    const msg = 'Something went wrong on our side. Please try again shortly.';
    return NextResponse.json({ status: 'error', message: msg, answer: msg }, { status: 500 });
  }
}
