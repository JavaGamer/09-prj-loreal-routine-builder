export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", {
        status: 405,
        headers: corsHeaders,
      });
    }

    if (!env.OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({
          error: "The OpenAI API secret is not configured.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    try {
      const body = await request.json();
      const messages = Array.isArray(body.messages) ? body.messages : [];

      const systemMessage =
        messages.find((message) => message.role === "system")?.content ||
        "You are a knowledgeable L'Oréal beauty advisor.";
      const conversation = messages
        .filter((message) => message.role !== "system")
        .map((message) => ({
          role: message.role,
          content: message.content,
        }));

      const openAIResponse = await fetch(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4.1",
            instructions: systemMessage,
            input: conversation,
            tools: [{ type: "web_search_preview" }],
          }),
        }
      );

      const data = await openAIResponse.json();
      if (!openAIResponse.ok) {
        return new Response(
          JSON.stringify({
            error: data.error?.message || "OpenAI request failed.",
          }),
          {
            status: openAIResponse.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const text =
        data.output_text ||
        data.output
          ?.flatMap((item) => item.content || [])
          .filter((item) => item.type === "output_text")
          .map((item) => item.text)
          .join("\n") ||
        "";

      const citations = [];
      data.output?.forEach((item) => {
        item.content?.forEach((content) => {
          content.annotations?.forEach((annotation) => {
            if (
              annotation.type === "url_citation" &&
              annotation.url &&
              !citations.some((citation) => citation.url === annotation.url)
            ) {
              citations.push({
                title: annotation.title || "Web source",
                url: annotation.url,
              });
            }
          });
        });
      });

      return new Response(
        JSON.stringify({
          choices: [{ message: { role: "assistant", content: text } }],
          citations,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: "The worker could not complete the request.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  },
};
