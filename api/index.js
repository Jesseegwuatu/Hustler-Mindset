// api/index.js
export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST,GET');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { url } = req;

  if (url.includes('/api/ai/autopilot')) {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
    }

    try {
      const { profile, question } = req.body;

      if (!profile || !question) {
        return res.status(400).json({ error: 'Missing profile context or question.' });
      }

      if (!process.env.OPENROUTER_API_KEY) {
        return res.status(500).json({ error: 'OPENROUTER_API_KEY is missing from Vercel Environment Variables.' });
      }

      const systemPrompt = `You are Vortex AI, an expert career assistant. Your task is to answer job application questions on behalf of the candidate described below.
      
CRITICAL RULES:
1. Answer strictly using the provided Candidate Details and Resume. Do not invent experience.
2. Write in a professional, concise, and natural tone.
3. Do not use excessive formatting like asterisks (***) or hashtags (###).
4. If the question asks for something not in the resume, infer a reasonable answer based on their skills.
5. Do not include conversational filler.

CANDIDATE DETAILS:
Client Name: ${profile.clientName || 'Unknown'}
Profile Notes: ${profile.details || 'None'}

RESUME / BASE INFO:
${profile.resumeUrl ? 'Resume is attached/available.' : 'No resume text provided.'}`;

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://hustlermindset.com",
          "X-Title": "Hustler Mindset",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "openrouter/free", // Extremely reliable free model
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: question }
          ],
          max_tokens: 1000,
          temperature: 0.7
        })
      });

      const data = await response.json();

      if (!response.ok) {
        // This sends the EXACT OpenRouter error to your chat UI
        return res.status(response.status).json({ 
          error: data.error?.message || 'OpenRouter rejected the request.' 
        });
      }

      const aiText = data.choices?.[0]?.message?.content || "No response generated.";
      return res.status(200).json({ answer: aiText.trim() });

    } catch (error) {
      return res.status(500).json({ error: error.message || 'Internal Server Error during AI generation.' });
    }
  }

  return res.status(404).json({ error: 'API Route Not Found' });
}
