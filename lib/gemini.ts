import { ActivityItem } from './google-sheets';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

async function callGemini(prompt: string, systemInstruction?: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('Missing GEMINI_API_KEY environment variable.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  const payload: any = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.1,
    },
  };

  if (systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API call failed: ${response.statusText} - ${errText}`);
  }

  const result = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini API returned an empty response.');
  }
  return text;
}

export async function parseTextWithGemini(rawText: string): Promise<ActivityItem[]> {
  const systemInstruction = `You extract a list of work activity items from a daily marketing update message (casual English/Hindi mix). The message may describe any number of distinct tasks — do not assume a fixed set of task types. Return ONLY a valid JSON array, no markdown fences, no extra text, matching this schema per item:
{
  "activityType": string,
  "platform": string | null,
  "description": string,
  "count": number | null
}
Rules:
- Create one item per distinct task or metric mentioned, however many there are.
- If a task doesn't fit a common category (post, outreach, poll, group joining, group posting, engagement), invent a short reasonable activityType label rather than forcing it into an existing one.
- Only fill "count" when a number is actually stated or clearly implied. Never invent numbers.
- Keep "description" short (under 15 words).`;

  const prompt = `Text to parse:\n"""\n${rawText}\n"""`;

  const text = await callGemini(prompt, systemInstruction);
  
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(json)?\s*/i, '').replace(/```$/, '').trim();
  }

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) {
      throw new Error('Gemini did not return an array of items.');
    }
    return parsed.map((item: any) => ({
      activityType: String(item.activityType || '').trim(),
      platform: item.platform ? String(item.platform).trim() : null,
      description: String(item.description || '').trim(),
      count: item.count !== undefined && item.count !== null ? Number(item.count) : null,
    }));
  } catch (err) {
    console.error('Failed to parse Gemini output as JSON:', cleaned, err);
    throw new Error('Failed to parse structured response from Gemini.');
  }
}

export interface ActivityMismatch {
  plan?: ActivityItem;
  update?: ActivityItem;
  type: 'missing' | 'variance';
}

export async function generateGapSummary(mismatches: ActivityMismatch[]): Promise<string> {
  if (!mismatches || mismatches.length === 0) {
    return '';
  }

  const mismatchDetails = mismatches.map((m) => {
    if (m.type === 'missing') {
      const p = m.plan!;
      const platformStr = p.platform ? ` on ${p.platform}` : '';
      return `- Planned task was missed entirely: "${p.activityType}${platformStr} (${p.description})"${p.count !== null ? ` with count ${p.count}` : ''}`;
    } else {
      const p = m.plan!;
      const u = m.update!;
      const platformStr = p.platform ? ` on ${p.platform}` : '';
      return `- Planned "${p.activityType}${platformStr}" count was ${p.count}, but actually reported ${u.count}`;
    }
  }).join('\n');

  const prompt = `Compare the following planned work discrepancies against what was actually completed:
${mismatchDetails}

Generate a concise, one-line natural language summary in English highlighting only what planned work was missed or fell short (e.g. 'Planned 5 group joins, reported 3' or 'Missed 2 group joins and 4 outreach messages'). Keep it under 15 words. Return ONLY the plain text summary, no markdown, no quotes, no extra text.`;

  try {
    const text = await callGemini(prompt);
    return text.trim().replace(/^["']|["']$/g, '');
  } catch (err) {
    console.error('Error generating gap summary with Gemini:', err);
    return 'Gap detected in completed activities.';
  }
}
