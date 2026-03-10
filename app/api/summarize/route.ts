import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { text, style } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'テキストが見つかりません' }, { status: 400 });
    }

    const stylePrompts: Record<string, string> = {
      concise: '3〜5行で簡潔に',
      detailed: '詳細に（重要なポイントを箇条書きで）',
      bullets: '箇条書きで主要ポイントを整理して',
      action: 'アクションアイテムと決定事項を中心に',
    };

    const styleInstruction = stylePrompts[style] || stylePrompts.concise;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `以下の音声文字起こしを${styleInstruction}要約してください。日本語で回答してください。\n\n---\n${text}\n---`,
        },
      ],
    });

    const summary = message.content[0].type === 'text' ? message.content[0].text : '';

    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Summarize error:', error);
    return NextResponse.json({ error: '要約に失敗しました' }, { status: 500 });
  }
}
