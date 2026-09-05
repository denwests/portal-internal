import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Expose-Headers": "Content-Type, Content-Disposition",
};

function json(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function safeFilename(value: unknown) {
  const cleaned = String(value || "pluno-photo.jpg")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ");

  return cleaned || "pluno-photo.jpg";
}

function getDriveSource(photo: Record<string, unknown>) {
  const explicit = String(photo.download_url || photo.original_url || "").trim();
  if (explicit) return explicit;

  const driveId = String(photo.drive_file_id || "").trim();
  if (!driveId) return "";

  return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(
    driveId
  )}&export=download&confirm=t`;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "GET") {
    return json("Method not allowed", 405);
  }

  try {
    const url = new URL(request.url);
    const slug = url.searchParams.get("slug")?.trim() || "";
    const photoId = url.searchParams.get("photo_id")?.trim() || "";
    const visitorId = url.searchParams.get("visitor_id")?.trim() || "download";

    if (!slug || !photoId) {
      return json("Missing slug or photo_id", 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      return json("Supabase environment is not configured", 500);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Reuse the same guest RPC as ClientGallery. This validates the gallery
    // slug/expiry and only exposes files that actually belong to this gallery.
    const { data, error } = await supabase.rpc("get_guest_gallery", {
      p_slug: slug,
      p_visitor_id: visitorId,
    });

    if (error) {
      console.error("gallery-file rpc error", error);
      return json("Gallery could not be validated", 403);
    }

    if (!data || !data.id) {
      return json("Gallery not found or expired", 404);
    }

    const photos = Array.isArray(data.photos) ? data.photos : [];
    const photo = photos.find(
      (item: Record<string, unknown>) => String(item?.id || "") === photoId
    );

    if (!photo) {
      return json("Photo does not belong to this gallery", 404);
    }

    const sourceUrl = getDriveSource(photo);
    if (!sourceUrl) {
      return json("Original photo source is unavailable", 404);
    }

    const driveResponse = await fetch(sourceUrl, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 PlunoGallery/1.0",
      },
    });

    if (!driveResponse.ok || !driveResponse.body) {
      console.error("gallery-file drive error", driveResponse.status, sourceUrl);
      return json(`Drive returned ${driveResponse.status}`, 502);
    }

    const contentType =
      driveResponse.headers.get("content-type") ||
      String(photo.mime_type || "application/octet-stream");

    // Drive sometimes returns an HTML permission/confirmation page instead of
    // the original binary. Reject it so the frontend does not put HTML into ZIP.
    if (contentType.toLowerCase().includes("text/html")) {
      return json(
        "Google Drive returned an HTML page. Make sure the original file is accessible through the gallery's Drive link.",
        502
      );
    }

    const filename = safeFilename(photo.filename);

    return new Response(driveResponse.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    console.error("gallery-file unexpected error", error);
    return json("Unexpected download proxy error", 500);
  }
});
