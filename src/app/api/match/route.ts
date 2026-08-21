import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createBaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export const runtime = "nodejs";

async function getAuthenticatedSupabaseClient(request: Request) {
  const authHeader = request.headers.get("Authorization");

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseAnonKey && token) {
      return createBaseClient<Database>(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      });
    }
  }

  return await createServerClient();
}

// Server-side Singleton for CLIP Vision Model
class CLIPVisionSingleton {
  static modelName = "Xenova/clip-vit-base-patch32";
  static processor: any = null;
  static model: any = null;
  static loadingPromise: Promise<any> | null = null;

  static async getInstance() {
    if (this.processor && this.model) {
      return { processor: this.processor, model: this.model };
    }

    if (!this.loadingPromise) {
      this.loadingPromise = (async () => {
        const { AutoProcessor, CLIPVisionModelWithProjection, env } = await import(
          "@xenova/transformers"
        );
        env.allowLocalModels = false;

        const processor = await AutoProcessor.from_pretrained(this.modelName);
        const model = await CLIPVisionModelWithProjection.from_pretrained(this.modelName);

        this.processor = processor;
        this.model = model;
        return { processor, model };
      })();
    }

    return this.loadingPromise;
  }
}

// Server-side Singleton for CLIP Text Model
class CLIPTextSingleton {
  static modelName = "Xenova/clip-vit-base-patch32";
  static tokenizer: any = null;
  static model: any = null;
  static loadingPromise: Promise<any> | null = null;

  static async getInstance() {
    if (this.tokenizer && this.model) {
      return { tokenizer: this.tokenizer, model: this.model };
    }

    if (!this.loadingPromise) {
      this.loadingPromise = (async () => {
        const { AutoTokenizer, CLIPTextModelWithProjection, env } = await import(
          "@xenova/transformers"
        );
        env.allowLocalModels = false;

        const tokenizer = await AutoTokenizer.from_pretrained(this.modelName);
        const model = await CLIPTextModelWithProjection.from_pretrained(this.modelName);

        this.tokenizer = tokenizer;
        this.model = model;
        return { tokenizer, model };
      })();
    }

    return this.loadingPromise;
  }
}

async function generateClipImageEmbedding(imageUrl: string): Promise<number[]> {
  const { RawImage } = await import("@xenova/transformers");
  const image = await RawImage.fromURL(imageUrl);
  const { processor, model } = await CLIPVisionSingleton.getInstance();
  const imageInputs = await processor(image);
  const { image_embeds } = await model(imageInputs);

  if (!image_embeds || !image_embeds.data) {
    throw new Error("CLIP vision model failed to produce image embeddings tensor.");
  }

  const rawArray = Array.from(image_embeds.data as Float32Array);
  if (rawArray.length !== 512) {
    throw new Error(`Vision embedding output dimension mismatch: Expected 512, received ${rawArray.length}`);
  }

  let norm = 0;
  for (let i = 0; i < rawArray.length; ++i) {
    norm += rawArray[i] * rawArray[i];
  }
  norm = Math.sqrt(norm);

  return norm > 0 ? rawArray.map((v) => v / norm) : rawArray;
}

async function generateClipTextEmbedding(text: string): Promise<number[]> {
  const { tokenizer, model } = await CLIPTextSingleton.getInstance();
  const textInputs = await tokenizer(text, { padding: true, truncation: true });
  const { text_embeds } = await model(textInputs);

  if (!text_embeds || !text_embeds.data) {
    throw new Error("CLIP text model failed to produce embeddings tensor.");
  }

  const rawArray = Array.from(text_embeds.data as Float32Array);
  if (rawArray.length !== 512) {
    throw new Error(`Text embedding output dimension mismatch: Expected 512, received ${rawArray.length}`);
  }

  let norm = 0;
  for (let i = 0; i < rawArray.length; ++i) {
    norm += rawArray[i] * rawArray[i];
  }
  norm = Math.sqrt(norm);

  return norm > 0 ? rawArray.map((v) => v / norm) : rawArray;
}

export async function GET(request: Request) {
  try {
    const supabase = await getAuthenticatedSupabaseClient(request);
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get("itemId");

    if (!itemId) {
      return NextResponse.json(
        { success: false, error: "Query parameter 'itemId' is required." },
        { status: 400 }
      );
    }

    // 1. Load target item details
    const { data: targetItem, error: fetchErr } = await (supabase
      .from("lost_items") as any)
      .select("id, title, description, category, campus_location, incident_at, image_url, text_embedding, image_embedding, item_type")
      .eq("id", itemId)
      .maybeSingle();

    if (fetchErr || !targetItem) {
      return NextResponse.json(
        { success: false, error: `Target item not found: ${fetchErr?.message || "Invalid item ID"}` },
        { status: 404 }
      );
    }

    // 2. On-the-fly fallback triggers for missing embeddings
    const fallbackUpdatePayload: Record<string, any> = {};

    // 2a. On-the-fly trigger for missing text_embedding if needed
    if (!targetItem.text_embedding) {
      try {
        const itemText = `Item: ${targetItem.title}. Description: ${targetItem.description || ""}. Category: ${targetItem.category}.`;
        const textEmbedding = await generateClipTextEmbedding(itemText);
        if (textEmbedding) {
          fallbackUpdatePayload.text_embedding = `[${textEmbedding.join(",")}]`;
        }
      } catch (embedErr) {
        console.warn("[MATCH API] Non-blocking text embedding generation notice:", embedErr);
      }
    }

    // 2b. On-the-fly trigger for missing image_embedding (using primary image_url)
    if (targetItem.image_url && !targetItem.image_embedding) {
      try {
        const imageEmbedding = await generateClipImageEmbedding(targetItem.image_url);
        if (imageEmbedding) {
          fallbackUpdatePayload.image_embedding = `[${imageEmbedding.join(",")}]`;
        }
      } catch (imgErr) {
        console.warn("[MATCH API] Non-blocking image embedding generation notice:", imgErr);
      }
    }

    // Save any generated fallback embeddings back to DB
    if (Object.keys(fallbackUpdatePayload).length > 0) {
      try {
        await (supabase.from("lost_items") as any)
          .update(fallbackUpdatePayload)
          .eq("id", itemId);
      } catch (saveErr) {
        console.warn("[MATCH API] Failed to save fallback embeddings to database:", saveErr);
      }
    }

    // 3. Execute hybrid matching RPC
    const { data: rawMatches, error: rpcErr } = await (supabase as any).rpc(
      "match_hybrid_items",
      {
        p_item_id: itemId,
        p_text_weight: 0.40,
        p_image_weight: 0.25,
        p_location_weight: 0.20,
        p_time_weight: 0.15,
        p_match_threshold: 0.55,
        p_match_count: 5,
      }
    );

    if (rpcErr) {
      console.error("[MATCH API] RPC error:", rpcErr);
      return NextResponse.json(
        { success: false, error: `Matching engine error: ${rpcErr.message}` },
        { status: 500 }
      );
    }

    const matches = (rawMatches || []).map((m: any) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      category: m.category,
      campus_location: m.campus_location,
      image_url: m.image_url,
      item_type: m.item_type,
      status: m.status,
      incident_at: m.incident_at,
      match_score: Math.round((m.match_score || 0) * 100),
      breakdown: {
        text_similarity: m.text_similarity !== null ? Math.round(m.text_similarity * 100) : null,
        image_similarity: m.image_similarity !== null ? Math.round(m.image_similarity * 100) : null,
        location_similarity: m.location_similarity !== null ? Math.round(m.location_similarity * 100) : null,
        time_similarity: m.time_similarity !== null ? Math.round(m.time_similarity * 100) : null,
      },
    }));

    return NextResponse.json({
      success: true,
      targetItemId: itemId,
      targetItemType: targetItem.item_type || "lost",
      totalMatches: matches.length,
      matches,
    });
  } catch (err) {
    console.error("[MATCH API] Route error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to calculate hybrid matches",
      },
      { status: 500 }
    );
  }
}
