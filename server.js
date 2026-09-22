import express from "express";
import { InferenceClient } from "@huggingface/inference";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json({ limit: "8mb" }));

const IMAGE_MODEL =
  process.env.OPEN_SOURCE_MODEL ||
  "Qwen/Qwen-Image-2512";

const TEXT_MODEL =
  process.env.TEXT_MODEL ||
  "Qwen/Qwen3-32B";

function isPhone(req) {
  return /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(
    req.headers["user-agent"] || ""
  );
}

function hf() {
  if (!process.env.HF_TOKEN) {
    throw new Error("HF_TOKEN is not configured.");
  }

  return new InferenceClient(process.env.HF_TOKEN);
}

app.get("/api/health", (_, res) => {
  res.json({
    ok: true,
    huggingface: !!process.env.HF_TOKEN,
    imageModel: IMAGE_MODEL,
    textModel: TEXT_MODEL
  });
});

function cleanJson(text) {
  if (!text) return null;

  let value = text.trim();

  if (value.startsWith("```")) {
    value = value
      .replace(/^```json/i, "")
      .replace(/^```/i, "")
      .replace(/```$/i, "")
      .trim();
  }

  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");

  if (start === -1 || end === -1) {
    return null;
  }

  try {
    return JSON.parse(value.slice(start, end + 1));
  } catch {
    return null;
  }
}

function fallbackPlan(userPrompt) {
  const quoted =
    userPrompt.match(/["“](.+?)["”]/)?.[1] || "";

  const headlineMatch =
    userPrompt.match(
      /(?:headline|title)\s*[:=-]\s*([^.\n]+)/i
    );

  const headline =
    quoted ||
    headlineMatch?.[1]?.trim() ||
    " ";

  let subject = "professional business design";

  const lower = userPrompt.toLowerCase();

  if (
    lower.includes("barber") ||
    lower.includes("barbing")
  ) {
    subject = "professional barbershop";
  } else if (
    lower.includes("salon") ||
    lower.includes("hair")
  ) {
    subject = "professional salon";
  } else if (
    lower.includes("church") ||
    lower.includes("worship")
  ) {
    subject = "church event";
  } else if (
    lower.includes("birthday")
  ) {
    subject = "birthday celebration";
  } else if (
    lower.includes("food") ||
    lower.includes("restaurant") ||
    lower.includes("jollof") ||
    lower.includes("barbecue")
  ) {
    subject = "food business";
  }

  return {
    subject,
    headline,
    subtitle: "",
    details: [],
    services: [],
    price: "",
    date: "",
    time: "",
    location: "",
    phone: "",
    email: "",
    cta: "",
    visualDirection:
      `Modern premium ${subject} photography with a realistic professional social-media aesthetic.`,
    layoutDirection:
      "Editorial social-media flyer with strong hierarchy, generous spacing and a clean information area.",
    backgroundDirection:
      "Realistic professional environment related to the subject with clean negative space for typography."
  };
}

async function understandRequest(userPrompt) {
  try {
    const response = await hf().chatCompletion({
      model: TEXT_MODEL,
      provider: "auto",
      messages: [
        {
          role: "system",
          content: `
You are the planning brain for Wisdom AI.

The user wants a professional flyer.

Your job is ONLY to understand the user's request and return
structured information.

IMPORTANT:

Never invent information.

Only use information that the user actually supplied.

Do not create fake:
- names
- prices
- phone numbers
- dates
- times
- locations
- services
- offers
- websites
- social handles

Copy important user-provided wording exactly whenever possible.

Return ONLY valid JSON.

Use exactly this structure:

{
  "subject": "",
  "headline": "",
  "subtitle": "",
  "details": [],
  "services": [],
  "price": "",
  "date": "",
  "time": "",
  "location": "",
  "phone": "",
  "email": "",
  "cta": "",
  "visualDirection": "",
  "layoutDirection": "",
  "backgroundDirection": ""
}

DESIGN DIRECTION:

Choose a visual direction based on the actual subject.

Barbershop:
realistic modern barbershop photography.

Salon:
premium beauty/salon photography.

Food:
realistic food photography.

Church:
appropriate church/event photography.

Birthday:
appropriate celebration photography.

Corporate:
professional business photography.

Do not force the same design onto every category.

Do not add random objects.

Do not automatically add:
- smoke
- fire
- flames
- flowers
- food
- people
- buildings
- products

unless the request actually calls for them.

The visual direction should feel modern, premium,
creative and professionally designed.

Do not mention Pinterest.
`
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
      max_tokens: 900,
      temperature: 0.1
    });

    const text =
      response?.choices?.[0]?.message?.content || "";

    return cleanJson(text) || fallbackPlan(userPrompt);

  } catch (error) {
    console.error("Planning error:", error);
    return fallbackPlan(userPrompt);
  }
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapText(text, maxChars) {
  const words = String(text || "").split(/\s+/);
  const lines = [];
  let line = "";

  for (const word of words) {
    if ((line + " " + word).trim().length <= maxChars) {
      line = (line + " " + word).trim();
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }

  if (line) lines.push(line);

  return lines;
}

function textBlock(text, x, y, size, weight = 400, maxChars = 38) {
  if (!text) return "";

  const lines = wrapText(text, maxChars);

  return lines
    .map(
      (line, index) => `
        <text
          x="${x}"
          y="${y + index * (size + 8)}"
          font-family="Arial, Helvetica, sans-serif"
          font-size="${size}px"
          font-weight="${weight}"
          fill="#ffffff"
        >${escapeXml(line)}</text>
      `
    )
    .join("");
}

function makeFlyerSvg(plan, background, format) {
  const width = 1080;
  const height =
    format === "1:1"
      ? 1080
      : 1350;

  const headline =
    plan.headline ||
    plan.subject ||
    " ";

  const subtitle =
    plan.subtitle || "";

  const services =
    Array.isArray(plan.services)
      ? plan.services
      : [];

  const details =
    Array.isArray(plan.details)
      ? plan.details
      : [];

  const info = [
    plan.date
      ? `Date: ${plan.date}`
      : "",
    plan.time
      ? `Time: ${plan.time}`
      : "",
    plan.location
      ? `Location: ${plan.location}`
      : "",
    plan.phone
      ? `Phone: ${plan.phone}`
      : "",
    plan.email
      ? `Email: ${plan.email}`
      : "",
    plan.price
      ? `Price: ${plan.price}`
      : ""
  ].filter(Boolean);

  const bodyItems = [
    ...services.map(x => `• ${x}`),
    ...details
  ];

  const serviceText = bodyItems.join("\n");

  const safeBackground =
    background || "";

  const bodyLines = wrapText(
    serviceText,
    45
  ).slice(0, 7);

  const infoLines = info
    .map(x => escapeXml(x))
    .join("   •   ");

  const cta = plan.cta || "";

  return `
<svg
  xmlns="http://www.w3.org/2000/svg"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  width="${width}"
  height="${height}"
  viewBox="0 0 ${width} ${height}"
>

  <rect
    width="${width}"
    height="${height}"
    fill="#111111"
  />

  <image
    href="${safeBackground}"
    x="0"
    y="0"
    width="${width}"
    height="${height}"
    preserveAspectRatio="xMidYMid slice"
  />

  <rect
    x="0"
    y="0"
    width="${width}"
    height="${height}"
    fill="#000000"
    opacity="0.30"
  />

  <rect
    x="55"
    y="55"
    width="${width - 110}"
    height="${height - 110}"
    rx="28"
    fill="none"
    stroke="#ffffff"
    stroke-opacity="0.35"
    stroke-width="2"
  />

  <rect
    x="75"
    y="75"
    width="${width - 150}"
    height="430"
    rx="24"
    fill="#000000"
    opacity="0.48"
  />

  <text
    x="100"
    y="145"
    font-family="Arial, Helvetica, sans-serif"
    font-size="30px"
    font-weight="600"
    letter-spacing="5"
    fill="#ffffff"
    opacity="0.85"
  >
    ${escapeXml(
      String(plan.subject || "")
        .toUpperCase()
        .slice(0, 30)
    )}
  </text>

  ${textBlock(
    headline,
    100,
    245,
    headline.length > 28 ? 58 : 76,
    800,
    24
  )}

  ${textBlock(
    subtitle,
    100,
    395,
    28,
    400,
    48
  )}

  ${
    serviceText
      ? `
        <rect
          x="75"
          y="555"
          width="${width - 150}"
          height="280"
          rx="24"
          fill="#000000"
          opacity="0.70"
        />

        <text
          x="105"
          y="610"
          font-family="Arial, Helvetica, sans-serif"
          font-size="25px"
          font-weight="700"
          letter-spacing="3"
          fill="#ffffff"
        >
          SERVICES
        </text>

        ${bodyLines
          .map(
            (line, i) => `
              <text
                x="105"
                y="${665 + i * 34}"
                font-family="Arial, Helvetica, sans-serif"
                font-size="23px"
                font-weight="400"
                fill="#ffffff"
              >
                ${escapeXml(line)}
              </text>
            `
          )
          .join("")}
      `
      : ""
  }

  ${
    infoLines
      ? `
        <rect
          x="75"
          y="${serviceText ? 870 : 620}"
          width="${width - 150}"
          height="150"
          rx="24"
          fill="#000000"
          opacity="0.72"
        />

        <text
          x="105"
          y="${serviceText ? 930 : 680}"
          font-family="Arial, Helvetica, sans-serif"
          font-size="22px"
          font-weight="500"
          fill="#ffffff"
        >
          ${infoLines}
        </text>
      `
      : ""
  }

  ${
    cta
      ? `
        <rect
          x="75"
          y="${height - 220}"
          width="${width - 150}"
          height="100"
          rx="50"
          fill="#ffffff"
        />

        <text
          x="${width / 2}"
          y="${height - 157}"
          text-anchor="middle"
          font-family="Arial, Helvetica, sans-serif"
          font-size="30px"
          font-weight="800"
          fill="#111111"
        >
          ${escapeXml(cta.toUpperCase())}
        </text>
      `
      : ""
  }

  <text
    x="${width / 2}"
    y="${height - 75}"
    text-anchor="middle"
    font-family="Arial, Helvetica, sans-serif"
    font-size="17px"
    letter-spacing="3"
    fill="#ffffff"
    opacity="0.55"
  >
    WISDOM AI
  </text>

</svg>
`;
}

async function generateBackground(plan, format) {
  const client = hf();

  const ratio =
    format === "1:1"
      ? "square 1:1"
      : "vertical 4:5";

  const prompt = `
Create ONLY the realistic photographic visual background for a
premium modern social-media flyer.

SUBJECT:
${plan.subject}

VISUAL DIRECTION:
${plan.visualDirection}

BACKGROUND:
${plan.backgroundDirection}

FORMAT:
${ratio}

IMPORTANT:

This is a BACKGROUND IMAGE.

DO NOT create a flyer.
DO NOT create typography.
DO NOT create captions.
DO NOT create signs.
DO NOT create logos.
DO NOT create written words.
DO NOT create fake business information.

Leave clean visual space where professional typography can be
placed later by the application.

Make the photography realistic, premium and contemporary.

Avoid:
cartoon style,
3D illustration,
plastic-looking people,
fake-looking faces,
random objects,
random food,
random fire,
random smoke,
random decorations,
outdated stock-photo appearance.

The visual must match the exact subject.
`;

  const image = await client.textToImage({
    model: IMAGE_MODEL,
    inputs: prompt,
    provider: "auto"
  });

  const base64 = Buffer.from(
    await image.arrayBuffer()
  ).toString("base64");

  return `data:image/png;base64,${base64}`;
}

async function generateFlyer(prompt, format) {
  const plan = await understandRequest(prompt);

  const background =
    await generateBackground(
      plan,
      format
    );

  const svg =
    makeFlyerSvg(
      plan,
      background,
      format
    );

  return {
    image:
      "data:image/svg+xml;base64," +
      Buffer.from(svg).toString("base64"),
    plan
  };
}

app.post("/api/generate", async (req, res) => {
  try {
    if (!isPhone(req)) {
      return res.status(403).json({
        error:
          "Wisdom AI is phone-only. Open it from a phone."
      });
    }

    const {
      prompt,
      format = "4:5"
    } = req.body || {};

    if (!prompt?.trim()) {
      return res.status(400).json({
        error:
          "Please describe the design."
      });
    }

    console.log(
      "Wisdom AI request:",
      prompt
    );

    const result =
      await generateFlyer(
        prompt,
        format
      );

    res.json({
      image: result.image,
      provider: "huggingface",
      model: IMAGE_MODEL,
      plan: result.plan
    });

  } catch (error) {
    console.error(
      "Wisdom AI error:",
      error
    );

    res.status(500).json({
      error:
        error?.message ||
        "Generation failed."
    });
  }
});

app.get("/{*splat}", (_, res) =>
  res.sendFile(
    path.join(
      __dirname,
      "index.html"
    )
  )
);

app.listen(
  process.env.PORT || 3000,
  () =>
    console.log(
      "Wisdom AI running"
    )
);
