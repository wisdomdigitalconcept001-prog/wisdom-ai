import express from "express";
import OpenAI from "openai";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json({ limit: "2mb" }));

const phone = req =>
  /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(
    req.headers["user-agent"] || ""
  );

const client = () => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
};

app.get("/api/health", (_, res) => {
  res.json({
    ok: true,
    openai: !!process.env.OPENAI_API_KEY,
    pinterest: !!process.env.PINTEREST_ACCESS_TOKEN
  });
});

/*
  ----------------------------------------------------
  STEP 1
  GPT-5.6 understands the user's flyer request.
  ----------------------------------------------------
*/

async function understandFlyer(userPrompt) {
  const response = await client().responses.create({
    model: "gpt-5.6",
    input: [
      {
        role: "system",
        content: `
You are the creative planning brain behind Wisdom AI.

Your job is to understand a user's request for a flyer, poster,
social-media graphic, advertisement, invitation, announcement,
business promotion, event design, or similar visual.

Do NOT generate the image.

Instead, turn the user's request into a clear professional design brief
for an image-generation model.

The user's request is the source of truth.

Never invent important business information.
Never invent prices, phone numbers, dates, names, addresses,
services, event details, or offers.

If information is not provided, do not create fake information.

Determine:

1. The exact subject of the design.
2. The purpose of the design.
3. The type of flyer/design.
4. The important text supplied by the user.
5. The appropriate visual subject.
6. The appropriate photography direction.
7. The appropriate layout.
8. The appropriate typography direction.
9. Which information icons would naturally help the design.
10. What visual elements must NOT appear.

DESIGN INTELLIGENCE:

Every flyer should have its own visual direction.

A barber/barbing flyer should look like a professional barbershop
advertisement.

A salon flyer should look like a professional beauty/salon advertisement.

A food flyer should use food-related visuals.

A church flyer should use church/event-appropriate visuals.

A birthday or celebration flyer should use celebration/event-appropriate
visuals.

A corporate/business flyer should use a professional business direction.

Do not use the same visual formula for every category.

INFORMATION ICONS:

When relevant information is provided, the layout may use clean,
modern visual icons such as:

- calendar/date icon
- clock/time icon
- location/pin icon
- phone icon
- email icon
- website icon
- Instagram/social icon

These icons should be used only when appropriate to the design.

Do not add fake information just to fill an icon.

CREATIVITY:

The design should feel like a professionally art-directed modern
social-media flyer.

Use strong hierarchy, intentional spacing, creative composition,
premium typography, appropriate imagery, modern graphic elements,
and a visually interesting background.

The design may use creative shapes, grids, cards, gradients,
textures, image crops, borders, or other design elements when they
fit the subject.

Do not make every design look the same.

IMPORTANT:

Do not automatically add smoke, fire, flames, food, flowers,
people, buildings, products, or other visual objects.

Only include visual elements that are requested or clearly appropriate
for the exact subject.

Do not use cartoon, childish, anime, plastic 3D, toy-like, or
cheap-looking visuals unless the user specifically requests that style.

Do not mention Pinterest.

Return ONLY valid JSON using this structure:

{
  "design_type": "",
  "subject": "",
  "purpose": "",
  "headline": "",
  "supporting_text": [],
  "details": [],
  "visual_direction": "",
  "layout_direction": "",
  "typography_direction": "",
  "icon_direction": "",
  "background_direction": "",
  "style": "",
  "avoid": []
}
        `
      },
      {
        role: "user",
        content: userPrompt
      }
    ]
  });

  const text = response.output_text?.trim();

  if (!text) {
    throw new Error("Wisdom AI could not understand the design request.");
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Wisdom AI returned an invalid design plan.");
  }
}

/*
  ----------------------------------------------------
  STEP 2
  GPT-Image-2 creates the actual flyer.
  ----------------------------------------------------
*/

async function generateImage(brief, format) {
  const size =
    {
      "1:1": "1024x1024",
      "4:5": "1024x1536",
      "9:16": "1024x1536"
    }[format] || "1024x1536";

  const imagePrompt = `
Create a finished, professional social-media flyer based on the
following structured design brief.

THIS IS A COMPLETE FLYER, NOT A STANDALONE PHOTO.

DESIGN BRIEF:

${JSON.stringify(brief, null, 2)}

CORE RULE:

The design brief is the source of truth.

Create a visually complete flyer with:

- a clear headline
- strong visual hierarchy
- professional typography
- deliberate spacing
- appropriate imagery
- appropriate background
- organized information
- polished composition
- professional social-media design quality

The flyer must look intentionally designed by a skilled graphic designer.

VISUAL ACCURACY:

The main visual must clearly represent the exact subject in the brief.

Do not substitute the subject with something else.

Do not add unrelated objects.

Do not automatically add smoke.

Do not automatically add fire.

Do not automatically add flames.

Do not automatically add food.

Do not automatically add flowers.

Do not automatically add random people.

Do not automatically add random products.

Do not automatically add random decorations.

Only use visual elements that are requested or naturally appropriate
for the exact subject.

LAYOUT:

Use a creative layout appropriate for this particular design.

Do not force every flyer into the same template.

Use modern compositions such as:

- strong hero image with structured information
- editorial-style layout
- split image/text composition
- premium card sections
- asymmetric modern composition
- clean information blocks
- layered photography
- sophisticated grid layout

Choose the layout that best fits the subject.

INFORMATION:

Use the exact information supplied in the brief.

Do not invent:

- names
- prices
- phone numbers
- addresses
- dates
- times
- websites
- social handles
- services
- offers
- claims

If a piece of information is not provided, do not invent it.

ICONS:

When appropriate, use clean professional icons for:

date
time
location
phone
email
website
social media

The icons should be visually integrated into the design.

They should not look like random emoji.

STYLE:

Modern.
Creative.
Premium.
Professional.
Realistic.
Social-media ready.

Use realistic photography when photography is appropriate.

Avoid:

- childish designs
- cartoon characters
- anime
- cheap clip-art
- plastic-looking people
- fake-looking faces
- random smoke
- excessive effects
- meaningless decorations
- outdated flyer templates
- empty plain backgrounds
- messy text placement
- unrelated imagery
- fake information
- Pinterest logos
- Pinterest branding

The final result should feel like a professionally designed flyer,
not an AI experiment.

Do not mention Pinterest anywhere in the artwork.

Format: ${format}
`;

  const result = await client().images.generate({
    model: "gpt-image-2",
    prompt: imagePrompt,
    size
  });

  const b64 = result?.data?.[0]?.b64_json;

  if (!b64) {
    throw new Error("OpenAI returned no image.");
  }

  return `data:image/png;base64,${b64}`;
}

/*
  ----------------------------------------------------
  GENERATE ENDPOINT
  ----------------------------------------------------
*/

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

    /*
      First understand the request.
    */
    const brief = await understandFlyer(prompt);

    console.log("Wisdom AI design brief:", brief);

    /*
      Then generate the actual flyer.
    */
    const image = await generateImage(brief, format);

    res.json({
      image,
      provider: "openai",
      model: "gpt-image-2",
      brief
    });

  } catch (error) {
    console.error("Wisdom AI error:", error);

    res.status(500).json({
      error: error?.message || "Generation failed."
    });
  }
});

/*
  ----------------------------------------------------
  FRONTEND
  ----------------------------------------------------
*/

app.get("/{*splat}", (_, res) =>
  res.sendFile(path.join(__dirname, "index.html"))
);

app.listen(
  process.env.PORT || 3000,
  () => console.log("Wisdom AI running")
);
