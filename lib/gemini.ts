const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

async function callGemini(prompt: string, systemInstruction?: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('Missing GEMINI_API_KEY environment variable.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  const payload: any = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.1, // low temperature for consistent extraction
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

export interface ParsedWorkUpdate {
  platform: string;
  postType: string;
  postCount: number;
  outreachCount: number;
  pollsPosted: number;
  groupsJoined: number;
  groupPostCount: number;
  engagementNotes: string;
  contentCreationNotes: string;
}

export async function parseTextWithGemini(rawText: string): Promise<ParsedWorkUpdate> {
  const systemInstruction = `You extract structured data from a daily marketing work-update message written in casual English/Hindi mix. Return ONLY valid JSON matching this schema, with no markdown fences or extra text:
{
  "platform": string,
  "postType": string,
  "postCount": number,
  "outreachCount": number,
  "pollsPosted": number,
  "groupsJoined": number,
  "groupPostCount": number,
  "engagementNotes": string,
  "contentCreationNotes": string
}
If a field isn't mentioned, use 0 for numbers and "" for text. Never invent numbers that aren't stated or clearly implied.`;

  const prompt = `Text to parse:\n"""\n${rawText}\n"""`;

  const text = await callGemini(prompt, systemInstruction);
  
  // Clean markdown JSON code fences if they are returned despite system prompt
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(json)?\s*/i, '').replace(/```$/, '').trim();
  }

  try {
    return JSON.parse(cleaned) as ParsedWorkUpdate;
  } catch (err) {
    console.error('Failed to parse Gemini output as JSON:', cleaned, err);
    throw new Error('Failed to parse structured response from Gemini.');
  }
}

export async function generateGapSummary(plan: any, update: any): Promise<string> {
  const planMetrics = `Post Count: ${plan.postCount}, Outreach: ${plan.outreachCount}, Polls: ${plan.pollsPosted}, Groups Joined: ${plan.groupsJoined}, Group Posts: ${plan.groupPostCount}`;
  const updateMetrics = `Post Count: ${update.postCount}, Outreach: ${update.outreachCount}, Polls: ${update.pollsPosted}, Groups Joined: ${update.groupsJoined}, Group Posts: ${update.groupPostCount}`;

  const prompt = `Compare these planned metrics and actual updated metrics for marketing work:
Plan: ${planMetrics}
Update: ${updateMetrics}

Generate a concise, one-line natural language summary in English highlighting only what planned work was missed or short (e.g. 'Planned 5 group joins, reported 3' or 'Missed 2 group joins and 4 outreach messages'). Keep it under 15 words. Return ONLY the plain text summary, no markdown, no quotes, no extra text.`;

  try {
    const text = await callGemini(prompt);
    // Clean outer quotes and trim
    return text.trim().replace(/^["']|["']$/g, '');
  } catch (err) {
    console.error('Error generating gap summary with Gemini:', err);
    return 'Gap detected in reported metrics.';
  }
}
