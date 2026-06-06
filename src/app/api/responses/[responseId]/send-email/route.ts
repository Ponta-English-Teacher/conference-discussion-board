import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ responseId: string }> }
) {
  const { responseId } = await params;
  const db = createServerClient();

  const { data: response, error: rErr } = await db
    .from('cdb_responses')
    .select('*')
    .eq('id', responseId)
    .single();

  if (rErr || !response) {
    return NextResponse.json({ error: 'Response not found' }, { status: 404 });
  }

  if (response.email_sent) {
    return NextResponse.json({ error: 'Email already sent' }, { status: 409 });
  }

  const { data: question, error: qErr } = await db
    .from('cdb_questions')
    .select('id, content, content_en, content_ja, author_name, author_email, notify_on_response, session_id')
    .eq('id', response.question_id)
    .single();

  if (qErr || !question) {
    return NextResponse.json({ error: 'Question not found' }, { status: 404 });
  }

  if (!question.notify_on_response || !question.author_email) {
    return NextResponse.json(
      { error: 'Participant did not request email delivery' },
      { status: 400 }
    );
  }

  const { data: session } = await db
    .from('cdb_sessions')
    .select('title, title_ja')
    .eq('id', question.session_id)
    .single();

  const { data: profile } = await db
    .from('cdb_moderator_profile')
    .select('display_name, affiliation, email_signature')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const moderatorName = profile?.display_name?.trim() || response.author_name || 'Moderator';
  const moderatorAffiliation = profile?.affiliation?.trim() || response.author_affiliation || '';
  const signature = profile?.email_signature?.trim() || '';
  const sessionTitle = session?.title || 'Academic Conference';

  const questionText = question.content_en ?? question.content;
  const questionTextJa = question.content_ja ?? null;
  const responseText = response.content_en ?? response.content;
  const responseTextJa = response.content_ja ?? null;

  const subject = `Re: Your question at "${sessionTitle}"`;

  const htmlBody = buildHtml({
    recipientName: question.author_name,
    sessionTitle,
    questionText,
    questionTextJa,
    responseText,
    responseTextJa,
    moderatorName,
    moderatorAffiliation,
    signature,
  });

  const textBody = buildText({
    recipientName: question.author_name,
    sessionTitle,
    questionText,
    questionTextJa,
    responseText,
    responseTextJa,
    moderatorName,
    moderatorAffiliation,
    signature,
  });

  try {
    await transporter.sendMail({
      from: `"Conference Discussion Board" <${process.env.GMAIL_USER}>`,
      to: question.author_email,
      subject,
      html: htmlBody,
      text: textBody,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send email';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  await db
    .from('cdb_responses')
    .update({ email_sent: true, email_sent_at: new Date().toISOString() })
    .eq('id', responseId);

  return NextResponse.json({ ok: true });
}

interface EmailData {
  recipientName: string;
  sessionTitle: string;
  questionText: string;
  questionTextJa: string | null;
  responseText: string;
  responseTextJa: string | null;
  moderatorName: string;
  moderatorAffiliation: string;
  signature: string;
}

function buildHtml(d: EmailData): string {
  const jaBlock = (label: string, text: string) =>
    `<p style="margin:0 0 6px;font-size:12px;color:#94a3b8;">${label}</p>
     <p style="margin:0;font-size:13px;color:#64748b;font-style:italic;">${escapeHtml(text)}</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:#4f46e5;padding:24px 32px;">
            <p style="margin:0;font-size:11px;color:#c7d2fe;text-transform:uppercase;letter-spacing:.08em;">Conference Discussion Board</p>
            <p style="margin:6px 0 0;font-size:18px;font-weight:700;color:#ffffff;">${escapeHtml(d.sessionTitle)}</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 24px;font-size:15px;color:#1e293b;">Dear ${escapeHtml(d.recipientName)},</p>
            <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.6;">
              A moderator has responded to your question submitted at <strong>${escapeHtml(d.sessionTitle)}</strong>.
            </p>

            <!-- Original question -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="background:#fefce8;border:1px solid #fde68a;border-left:4px solid #f59e0b;border-radius:8px;padding:16px 20px;">
                  <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#b45309;text-transform:uppercase;letter-spacing:.08em;">Your Question</p>
                  <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.6;">${escapeHtml(d.questionText)}</p>
                  ${d.questionTextJa ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid #fde68a;">${jaBlock('JA', d.questionTextJa)}</div>` : ''}
                </td>
              </tr>
            </table>

            <!-- Moderator response -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
              <tr>
                <td style="background:#f0f9ff;border:1px solid #bae6fd;border-left:4px solid #0ea5e9;border-radius:8px;padding:16px 20px;">
                  <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#0369a1;text-transform:uppercase;letter-spacing:.08em;">Moderator Response</p>
                  <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.7;white-space:pre-wrap;">${escapeHtml(d.responseText)}</p>
                  ${d.responseTextJa ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid #bae6fd;">${jaBlock('JA', d.responseTextJa)}</div>` : ''}
                </td>
              </tr>
            </table>

            <!-- Signature -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="border-top:1px solid #e2e8f0;padding-top:20px;">
                  <p style="margin:0;font-size:14px;color:#334155;font-weight:600;">${escapeHtml(d.moderatorName)}</p>
                  ${d.moderatorAffiliation ? `<p style="margin:2px 0 0;font-size:13px;color:#64748b;">${escapeHtml(d.moderatorAffiliation)}</p>` : ''}
                  ${d.signature ? `<p style="margin:12px 0 0;font-size:13px;color:#64748b;white-space:pre-wrap;">${escapeHtml(d.signature)}</p>` : ''}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;">
              This is an automated message from the Conference Discussion Board. Please do not reply to this email.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildText(d: EmailData): string {
  const lines: string[] = [
    `Dear ${d.recipientName},`,
    '',
    `A moderator has responded to your question at "${d.sessionTitle}".`,
    '',
    '--- YOUR QUESTION ---',
    d.questionText,
    ...(d.questionTextJa ? ['', `[JA] ${d.questionTextJa}`] : []),
    '',
    '--- MODERATOR RESPONSE ---',
    d.responseText,
    ...(d.responseTextJa ? ['', `[JA] ${d.responseTextJa}`] : []),
    '',
    '---',
    d.moderatorName,
    ...(d.moderatorAffiliation ? [d.moderatorAffiliation] : []),
    ...(d.signature ? ['', d.signature] : []),
  ];
  return lines.join('\n');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
