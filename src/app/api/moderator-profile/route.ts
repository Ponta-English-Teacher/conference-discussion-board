import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET() {
  const db = createServerClient();
  const { data } = await db
    .from('cdb_moderator_profile')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return NextResponse.json(
    data ?? { display_name: '', affiliation: '', email_signature: '' }
  );
}

export async function PUT(req: NextRequest) {
  const { display_name, affiliation, email_signature } = await req.json();
  const db = createServerClient();

  const { data: existing } = await db
    .from('cdb_moderator_profile')
    .select('id')
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { data, error } = await db
      .from('cdb_moderator_profile')
      .update({ display_name, affiliation, email_signature, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } else {
    const { data, error } = await db
      .from('cdb_moderator_profile')
      .insert({ display_name, affiliation, email_signature })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }
}
