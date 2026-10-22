// api/index.js
// Vercel Serverless Function for Hustler Mindset

export default async function handler(req, res) {
  // 1. CORS Headers (Allows your frontend to make requests to this backend)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); // You can restrict this to your Vercel domain later
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST,GET');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // 2. Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 3. Route Handling
  const { url } = req;

  // Route: /api/ai/autopilot
  if (url.includes('/api/ai/autopilot')) {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
    }

    try {
      const { profile, question } = req.body;

      // Validation
      if (!profile || !question) {
        return res.status(400).json({ error: 'Missing profile context or question.' });
      }

      if (!process.env.OPENROUTER_API_KEY) {
        console.error("Missing OPENROUTER_API_KEY environment variable.");
        return res.status(500).json({ error: 'AI service is not configured on the server.' });
      }

      // Construct the prompt. We enforce strict constraints so the AI only uses the provided resume.
      const systemPrompt = `You are Vortex AI, an expert career assistant. Your task is to answer job application questions on behalf of the candidate described below.
      
CRITICAL RULES:
1. Answer strictly using the provided Candidate Details and Resume. Do not invent experience, skills, or education that is not explicitly stated.
2. Write in a professional, concise, and natural tone.
3. Do not use excessive formatting like asterisks (***) or hashtags (###). Just provide plain, well-structured text.
4. If the question asks for something not in the resume, infer a reasonable answer based on their existing skills, but do not lie about direct experience.
5. Do not include any conversational filler like "Here is the answer:" or "Based on the resume". Just give the direct answer.

CANDIDATE DETAILS:
Client Name: ${profile.clientName || 'Unknown'}
Profile Notes: ${profile.details || 'None'}

RESUME / BASE INFO:
${profile.resumeText || 'No resume text provided.'}`;

      // Call OpenRouter API
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://hustlermindset.com", // Optional, for OpenRouter rankings
          "X-Title": "Hustler Mindset", // Optional
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "openrouter/auto", // Uses the Auto Router to find a free/cheap model
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
        console.error("OpenRouter API Error:", data);
        return res.status(response.status).json({ 
          error: data.error?.message || 'Failed to generate AI response.' 
        });
      }

      // Return the generated text
      const aiText = data.choices?.[0]?.message?.content || "I could not generate a response.";
      
      return res.status(200).json({ answer: aiText.trim() });

    } catch (error) {
      console.error("AI Autopilot Endpoint Error:", error);
      return res.status(500).json({ error: 'Internal Server Error during AI generation.' });
    }
  }

  // Fallback for unknown routes
  return res.status(404).json({ error: 'API Route Not Found' });
}