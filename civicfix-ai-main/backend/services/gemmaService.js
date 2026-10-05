const {
  COMPLAINT_CATEGORIES,
  ALL_COMPLAINT_CATEGORIES,
} = require("../constants/complaintCategories");
const {
  URGENCY_LEVELS,
  ALL_URGENCY_LEVELS,
} = require("../constants/urgencyLevels");
const {
  DEPARTMENT_TYPES,
  ALL_DEPARTMENT_TYPES,
} = require("../constants/departmentTypes");
const { getDepartmentByCategory } = require("../utils/departmentMapper");
const { analyzeComplaintText } = require("../utils/aiScoring");

/**
 * Reads Gemma AI configuration from environment variables.
 * Fails gracefully if GEMMA_API_KEY is missing or contains placeholder values.
 */
const getGemmaConfig = () => {
  const apiKey = (process.env.GEMMA_API_KEY || "").trim();
  const isConfigured = Boolean(
    apiKey &&
      apiKey !== "your_gemma_api_key_here" &&
      apiKey !== "your_key_here" &&
      !apiKey.startsWith("your_")
  );

  const model = (process.env.GEMMA_MODEL || "gemma-3-4b-it").trim();
  const endpoint = (process.env.GEMMA_API_ENDPOINT || "").trim();

  return {
    apiKey,
    isConfigured,
    model,
    endpoint,
  };
};

/**
 * Builds the structured prompt instructing Gemma to analyze civic issues.
 */
const buildGemmaPrompt = ({ title, description, selectedCategory = "" }) => {
  return `You are NagarSetu's AI civic complaint analyzer for Indian municipal and smart city administration.
Analyze the following civic complaint and provide classification, urgency, department routing, risk factors, and reasoning.

Complaint Details:
- Title: "${title}"
- Description: "${description}"
${selectedCategory ? `- User-selected Category Hint: "${selectedCategory}"` : ""}

Allowed Categories:
${ALL_COMPLAINT_CATEGORIES.join(", ")}

Allowed Urgency Levels:
${ALL_URGENCY_LEVELS.join(", ")}

Allowed Department Names:
- road -> "Road Maintenance Department"
- sanitation -> "Sanitation Department"
- drainage: -> "Drainage Department"
- electricity -> "Streetlight & Electricity Department"
- water -> "Water Supply Department"
- safety -> "Public Safety Department"
- environment -> "Parks & Environment Department"
- traffic -> "Traffic Department"
- health -> "Health & Hygiene Department"
- other -> "General Civic Department"

Return ONLY a valid JSON object strictly matching this schema with NO markdown code block fences and NO commentary:
{
  "category": "one of allowed categories",
  "urgency": "one of: Low, Medium, High, Critical",
  "aiScore": <integer number between 0 and 100 representing priority/urgency>,
  "department": "exact allowed department name",
  "detectedKeywords": ["list", "of", "detected", "keywords"],
  "riskFactors": ["list", "of", "risk", "factors"],
  "aiReason": "Concise 1-2 sentence explanation of why this priority score and department were chosen."
}`;
};

/**
 * Normalizes Gemma or fallback response into the standard NagarSetu analysis schema
 * expected by the database and frontend components (e.g. PriorityScoreCard).
 */
const normalizeAnalysisResponse = ({
  parsed,
  selectedCategory = "",
  source = "gemma_api",
}) => {
  const rawCat = (parsed.category || selectedCategory || "").toLowerCase().trim();
  const category = ALL_COMPLAINT_CATEGORIES.includes(rawCat)
    ? rawCat
    : COMPLAINT_CATEGORIES.OTHER;

  let urgency = ALL_URGENCY_LEVELS.find(
    (u) => u.toLowerCase() === (parsed.urgency || "").toString().toLowerCase().trim()
  );

  let aiScore = Number(parsed.aiScore);
  if (isNaN(aiScore) || aiScore < 0 || aiScore > 100) {
    if (urgency === URGENCY_LEVELS.CRITICAL) aiScore = 90;
    else if (urgency === URGENCY_LEVELS.HIGH) aiScore = 75;
    else if (urgency === URGENCY_LEVELS.MEDIUM) aiScore = 50;
    else aiScore = 30;
  } else {
    aiScore = Math.round(aiScore);
  }

  if (!urgency) {
    if (aiScore >= 85) urgency = URGENCY_LEVELS.CRITICAL;
    else if (aiScore >= 70) urgency = URGENCY_LEVELS.HIGH;
    else if (aiScore >= 45) urgency = URGENCY_LEVELS.MEDIUM;
    else urgency = URGENCY_LEVELS.LOW;
  }

  const department =
    parsed.department && ALL_DEPARTMENT_TYPES.includes(parsed.department)
      ? parsed.department
      : getDepartmentByCategory(category);

  const detectedKeywords = Array.isArray(parsed.detectedKeywords)
    ? parsed.detectedKeywords.map((k) => String(k).trim()).filter(Boolean)
    : [];

  const riskFactors = Array.isArray(parsed.riskFactors)
    ? parsed.riskFactors.map((r) => String(r).trim()).filter(Boolean)
    : [];

  const aiReason =
    typeof parsed.aiReason === "string" && parsed.aiReason.trim().length > 0
      ? parsed.aiReason.trim()
      : `Classified as ${category} and routed to ${department}. Urgency: ${urgency} (Score: ${aiScore}/100).`;

  return {
    category,
    urgency,
    aiScore,
    department,
    detectedKeywords,
    riskFactors,
    aiReason,
    analysisSource: source,
  };
};

/**
 * Analyzes a complaint using Gemma API when configured,
 * or gracefully falls back to the internal rule-based engine.
 */
const analyzeComplaintWithGemma = async ({
  title,
  description,
  selectedCategory = "",
}) => {
  const config = getGemmaConfig();

  // If GEMMA_API_KEY is not configured, gracefully log configuration status and use fallback
  if (!config.isConfigured) {
    console.info(
      "[Gemma AI Service] GEMMA_API_KEY is not configured or using placeholder in backend/.env. Using intelligent rule-based AI analyzer as fallback."
    );
    const fallback = analyzeComplaintText({
      title,
      description,
      selectedCategory,
    });
    return {
      ...fallback,
      analysisSource: "rule_based_ai (GEMMA_API_KEY not configured)",
    };
  }

  try {
    const prompt = buildGemmaPrompt({ title, description, selectedCategory });

    let url = "";
    let requestHeaders = {
      "Content-Type": "application/json",
    };
    let requestBody = {};

    const isCustomEndpoint = Boolean(config.endpoint);
    const isOpenAICompatible =
      isCustomEndpoint &&
      (config.endpoint.includes("/chat/completions") ||
        config.endpoint.includes("openai") ||
        config.endpoint.includes("groq"));

    if (isOpenAICompatible) {
      url = config.endpoint;
      requestHeaders["Authorization"] = `Bearer ${config.apiKey}`;
      requestBody = {
        model: config.model,
        messages: [
          {
            role: "system",
            content:
              "You are NagarSetu's AI civic complaint engine. Always output pure valid JSON strictly matching the requested format.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
      };
    } else {
      // Official Google Generative Language API for Gemma models
      const base =
        config.endpoint ||
        "https://generativelanguage.googleapis.com/v1beta/models";
      url = `${base}/${config.model}:generateContent?key=${encodeURIComponent(
        config.apiKey
      )}`;
      requestBody = {
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      };
    }

    const response = await fetch(url, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(15000), // 15 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Gemma API request failed with HTTP ${response.status}: ${errorText}`
      );
    }

    const responseData = await response.json();
    let textContent = "";

    if (
      responseData.candidates &&
      responseData.candidates[0]?.content?.parts?.[0]?.text
    ) {
      textContent = responseData.candidates[0].content.parts[0].text;
    } else if (responseData.choices && responseData.choices[0]?.message?.content) {
      textContent = responseData.choices[0].message.content;
    } else {
      throw new Error("Unrecognized response payload structure from Gemma API");
    }

    // Clean any markdown code blocks (e.g. ```json ... ```)
    const cleaned = textContent
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    const parsedJson = JSON.parse(cleaned);

    return normalizeAnalysisResponse({
      parsed: parsedJson,
      selectedCategory,
      source: "gemma_api",
    });
  } catch (error) {
    console.error(
      `[Gemma AI Service Error] Call to Gemma model '${config.model}' failed: ${error.message}. Gracefully falling back to rule-based AI analyzer.`
    );

    const fallback = analyzeComplaintText({
      title,
      description,
      selectedCategory,
    });

    return {
      ...fallback,
      analysisSource: `rule_based_ai (Gemma fallback: ${error.message.substring(
        0,
        60
      )})`,
    };
  }
};

module.exports = {
  getGemmaConfig,
  analyzeComplaintWithGemma,
  normalizeAnalysisResponse,
};
