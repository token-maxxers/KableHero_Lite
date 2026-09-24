import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const PHOTO_BUCKET = "hazard-photos";

/** Photos live in a private bucket, so render them through short-lived signed URLs. */
export function useSignedPhoto(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setUrl(null);
    if (!path) return;
    void supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrl(path, 60 * 60)
      .then(({ data }) => {
        if (active) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      active = false;
    };
  }, [path]);

  return url;
}
