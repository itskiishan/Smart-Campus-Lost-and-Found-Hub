import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createBaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Configure Transformers.js for Node.js server environment
export const runtime = "nodejs";

/**
 * Obtain an authenticated Supabase client derived from Bearer token or server cookies.
 * Uses ONLY the public anon key (NEXT_PUBLIC_SUPABASE_ANON_KEY) and user session.
 */
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

  // Fallback to server cookies client
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

/**
 * Generate 512-dimensional CLIP image embedding from an image URL
 */
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
    const val = rawArray[i];
    if (Number.isNaN(val) || !Number.isFinite(val)) {
      throw new Error(`Invalid numeric value in vision embedding at index ${i}`);
    }
    norm += val * val;
  }
  norm = Math.sqrt(norm);

  return norm > 0 ? rawArray.map((v) => v / norm) : rawArray;
}

/**
 * Generate 512-dimensional CLIP text embedding from item text
 */
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
    const val = rawArray[i];
    if (Number.isNaN(val) || !Number.isFinite(val)) {
      throw new Error(`Invalid numeric value in text embedding at index ${i}`);
    }
    norm += val * val;
  }
  norm = Math.sqrt(norm);

  return norm > 0 ? rawArray.map((v) => v / norm) : rawArray;
}

export async function POST(request: Request) {
  try {
    const supabase = await getAuthenticatedSupabaseClient(request);
    const { data: authData, error: authUserErr } = await supabase.auth.getUser();
    const authUser = authData?.user || null;

    const body = await request.json().catch(() => ({}));
    let { itemId, imageUrl, text } = body;

    console.log("[EMBED API] Received request:", {
      authUserId: authUser?.id || null,
      itemId,
      hasImageUrl: Boolean(imageUrl),
      hasText: Boolean(text),
    });

    if (!itemId && !imageUrl && !text) {
      return NextResponse.json(
        { success: false, error: "Payload must contain 'itemId', 'imageUrl', or 'text'." },
        { status: 400 }
      );
    }

    let targetItem: any = null;

    if (itemId) {
      const { data: itemData } = await (supabase.from("lost_items") as any)
        .select("id, user_id, title, description, category, image_url, image_embedding, text_embedding")
        .eq("id", itemId)
        .maybeSingle();

      targetItem = itemData;

      if (!imageUrl && targetItem?.image_url) {
        imageUrl = targetItem.image_url;
      }
    }

    // Construct item text string for text embedding
    let itemTextString = text;
    if (!itemTextString && targetItem) {
      itemTextString = `Item: ${targetItem.title}. Description: ${targetItem.description || ""}. Category: ${targetItem.category}.`;
    }

    let imageEmbedding: number[] | null = null;
    let textEmbedding: number[] | null = null;
    let imageErr: string | null = null;
    let textErr: string | null = null;

    // 1. Generate Image Embedding (if photo URL is present)
    if (imageUrl) {
      try {
        imageEmbedding = await generateClipImageEmbedding(imageUrl);
      } catch (err) {
        imageErr = err instanceof Error ? err.message : "Image embedding failed";
        console.warn("[EMBED API] Image embedding notice:", imageErr);
      }
    }

    // 2. Generate Text Embedding (if text string is present)
    if (itemTextString && itemTextString.trim().length > 0) {
      try {
        textEmbedding = await generateClipTextEmbedding(itemTextString);
      } catch (err) {
        textErr = err instanceof Error ? err.message : "Text embedding failed";
        console.warn("[EMBED API] Text embedding notice:", textErr);
      }
    }

    // 3. Update database row if itemId is provided
    let dbUpdated = false;
    let updateError: string | null = null;

    if (itemId && (imageEmbedding || textEmbedding)) {
      const updatePayload: Record<string, any> = {};

      if (imageEmbedding) {
        updatePayload.image_embedding = `[${imageEmbedding.join(",")}]`;
      }
      if (textEmbedding) {
        updatePayload.text_embedding = `[${textEmbedding.join(",")}]`;
      }

      const { data: uData, error: uErr } = await (supabase.from("lost_items") as any)
        .update(updatePayload)
        .eq("id", itemId)
        .select("id, image_embedding, text_embedding")
        .single();

      if (uErr) {
        updateError = uErr.message;
        console.error("[EMBED API] Database update error:", uErr.message);
      } else if (uData) {
        dbUpdated = true;
      }
    }

    return NextResponse.json({
      success: true,
      itemId: itemId || null,
      hasImageEmbedding: Boolean(imageEmbedding),
      hasTextEmbedding: Boolean(textEmbedding),
      imageEmbeddingDimensions: imageEmbedding ? imageEmbedding.length : null,
      textEmbeddingDimensions: textEmbedding ? textEmbedding.length : null,
      dbUpdated,
      updateError,
      imageErr,
      textErr,
    });
  } catch (err) {
    console.error("[EMBED API] Route error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to process embeddings",
      },
      { status: 500 }
    );
  }
}
