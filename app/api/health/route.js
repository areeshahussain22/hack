// GET /api/health: quick check for Render's health check and for debugging keys.
import { NextResponse } from 'next/server';
import { providerStatus } from '@/lib/llm';
import { hasVectors } from '@/lib/embeddings';
import INDEX from '@/lib/policy-index';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({
    ok: true,
    policy_files: Object.keys(INDEX.files).length,
    policy_items: INDEX.items.length,
    semantic_search: hasVectors(),
    providers: providerStatus(),
  });
}
