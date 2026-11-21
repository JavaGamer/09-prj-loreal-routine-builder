# Project 9: L'Oréal Routine Builder
L’Oréal is expanding what’s possible with AI, and now your chatbot is getting smarter. This week, you’ll upgrade it into a product-aware routine builder. 

Users will be able to browse real L’Oréal brand products, select the ones they want, and generate a personalized routine using AI. They can also ask follow-up questions about their routine—just like chatting with a real advisor.

## Cloudflare Worker Setup

1. Create a Cloudflare Worker in the Cloudflare dashboard.
2. Copy the contents of `cloudflare-worker.js` into the Worker.
3. In **Settings > Variables and Secrets**, add a secret named `OPENAI_API_KEY` and paste in your OpenAI API key.
4. Deploy the Worker and copy its public Worker URL.
5. In `script.js`, replace `[YOUR_CLOUDFLARE_WORKER_URL]` with that URL.
6. Serve the site through a local web server, such as VS Code Live Server, so `products.json` loads correctly.

The frontend sends the conversation as a `messages` array. The Worker reads the key from `env.OPENAI_API_KEY` and never exposes it to the browser.

## Troubleshooting the Groq `/openai/v1` Error

The error `Unknown request URL: POST /openai/v1` means the deployed Worker is calling
the wrong provider URL. `/openai/v1` is an incomplete Groq route.

- If using Groq, the standard Chat Completions route is:
  `https://api.groq.com/openai/v1/chat/completions`
- If using the repository's web-search Worker, replace the deployed code with
  `cloudflare-worker.js`, set `OPENAI_API_KEY` as a Worker secret, and redeploy.