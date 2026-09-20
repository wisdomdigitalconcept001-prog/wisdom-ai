import express from "express";
import { InferenceClient } from "@huggingface/inference";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json({ limit: "2mb" }));

const phone = req =>
  /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(
    req.headers["user-agent"] || ""
  );

function hfClient() {
  if (!process.env.HF_TOKEN) {
    throw new Error("HF_TOKEN is not configured.");
  }

  return new InferenceClient(process.env.HF_TOKEN);
}

app.get("/api/health", (_, res) => {
  res.json({
    ok: true,
    huggingface: !!process.env.HF_TOKEN,
    model:
      process.env.OPEN_SOURCE_MODEL ||
      "black-forest-labs/FLUX.1-schnell"
  });
});

function buildDesignPrompt(userPrompt) {
  return `
Create a COMPLETE, professional social-media flyer based on the
user's request below.

USER REQUEST:
${userPrompt}

IMPORTANT:
The user's request is the source of truth.

Understand exactly what the user wants and create the visual around
that subject.

DO NOT invent important information.

Do not invent:
- names
- phone numbers
- prices
- dates
- times
- addresses
- services
- offers
- websites
- social media handles

If the user gives information, use it exactly.

DESIGN:

Create a modern, premium, professionally art-directed flyer.

Use:
- strong visual hierarchy
- professional typography
- creative composition
- intentional spacing
- realistic photography where appropriate
- attractive background treatment
- clear information sections
- polished social-media design

Do not make every flyer look the same.

Choose the design direction based on the actual subject.

For example:

BARBERSHOP:
Use a professional modern barbershop visual direction.

SALON:
Use a premium beauty/salon visual direction.

FOOD:
Use realistic food photography and a food-focused composition.

CHURCH:
Use an appropriate church/event visual direction.

BIRTHDAY:
Use an appropriate celebration design.

BUSINESS:
Use a clean professional business design.

EVENT:
Use a strong event-focused composition.

INFORMATION ICONS:

When the user provides relevant information, visually organize it
using clean professional icons where appropriate.

Examples:
- calendar for date
- clock for time
- location pin for location
- phone for phone number
- email icon for email
- website icon for website
- social icon for social media

Do not create fake information just to fill these areas.

SUBJECT ACCURACY:

Show the exact subject requested.

Do not replace the requested subject with something else.

Do not automatically add:
- smoke
- fire
- flames
- food
- flowers
- random people
- random products
- random buildings
- random decorations

Only include visual elements that are requested or clearly appropriate
for the subject.

STYLE:

Modern.
Creative.
Premium.
Realistic.
Professional.
High-quality.
Social-media ready.

Avoid:
- cartoon style
- childish designs
- anime
- cheap clip-art
- plastic-looking people
- unrealistic faces
- outdated flyer templates
- messy layouts
- random decorations
- excessive effects
- unrelated imagery
- fake information
- Pinterest logos
- Pinterest branding

The final result should look like a professional graphic designer
created the flyer.

Do not mention Pinterest anywhere in the artwork.

IMPORTANT TEXT:

Try to render the supplied text clearly and accurately.

The final output must be a COMPLETE FLYER, not just a photograph.

USER REQUEST ENDS HERE.
`;
}

async function generateImage(prompt, format) {
  const client = hfClient();

  const model =
    process.env.OPEN_SOURCE_MODEL ||
    "black-forest-labs/FLUX.1-schnell";

  let width = 1024;
  let height = 1536;

  if (format === "1:1") {
    width = 1024;
    height = 1024;
  }

  if (format === "9:16") {
    width = 1024;
    height = 1536;
  }

  const image = await client.textToImage({
    model,
    inputs: prompt,
    provider: "auto",
    width,
    height
  });

  return `data:image/png;base64,${Buffer.from(
    await image.arrayBuffer()
  ).toString("base64")}`;
}

app.post("/api/generate", async (req, res) => {
  try {
    if (!phone(req)) {
      return res.status(403).json({
        error: "Wisdom AI is phone-only. Open it from a phone."
      });
    }

    const {
      prompt,
      format = "4:5"
    } = req.body || {};

    if (!prompt?.trim()) {
      return res.status(400).json({
        error: "Please describe the design."
      });
    }

    console.log("Wisdom AI request:", prompt);

    const designPrompt = buildDesignPrompt(prompt);

    const image = await generateImage(
      designPrompt,
      format
    );

    res.json({
      image,
      provider: "huggingface",
      model:
        process.env.OPEN_SOURCE_MODEL ||
        "black-forest-labs/FLUX.1-schnell"
    });

  } catch (error) {
    console.error("Wisdom AI error:", error);

    res.status(500).json({
      error: error?.message || "Generation failed."
    });
  }
});

app.get("/{*splat}", (_, res) =>
  res.sendFile(path.join(__dirname, "index.html"))
);

app.listen(
  process.env.PORT || 3000,
  () => console.log("Wisdom AI running")
);
