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
  "count": number | null,
  "isPostable": boolean
}
Rules:
- Create one item per distinct task or metric mentioned, however many there are.
- If a task doesn't fit a common category (post, outreach, poll, group joining, group posting, engagement), invent a short reasonable activityType label rather than forcing it into an existing one.
- Only fill "count" when a number is actually stated or clearly implied. Never invent numbers.
- Keep "description" short (under 15 words).
- Set "isPostable": true if this activity represents something publicly published or visible (a post, reel, poll, published content), false if it's a private or unverifiable action (outreach/DMs, engagement on others' content, group joining, planning notes).`;

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
    return parsed.map((item: any) => {
      const isPostable = Boolean(item.isPostable);
      return {
        activityType: String(item.activityType || '').trim(),
        platform: item.platform ? String(item.platform).trim() : null,
        description: String(item.description || '').trim(),
        count: item.count !== undefined && item.count !== null ? Number(item.count) : null,
        isPostable,
        verifiedStatus: isPostable ? 'unreviewed' : 'not_independently_verifiable',
      };
    });
  } catch (err) {
    console.error('Failed to parse Gemini output as JSON:', cleaned, err);
    throw new Error('Failed to parse structured response from Gemini.');
  }
}
