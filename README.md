# Wisdom AI v3 — phone-only

Simple AI-assistant style interface for design generation.

Open Source mode uses Hugging Face Inference Providers with FLUX.1-schnell. OpenAI mode uses GPT-Image-2. Pinterest is a private backend trend signal only; it is not shown in the UI and is never requested to copy a specific pin.

Set `HF_TOKEN` for Open Source mode. Set `OPENAI_API_KEY` for OpenAI mode. Pinterest requires an approved Pinterest developer app and access token.

Deploy the folder to a Node-compatible host and add the environment variables there.
