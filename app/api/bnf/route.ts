import { z } from "zod";
import { bnfSchema } from "@/lib/bnf";
import {
  supabase,
  json,
  failure,
  sameOrigin,
  requireUser,
  check,
  HttpError,
} from "@/lib/server";

export async function GET(req: Request) {
  const s = supabase(req);
  try {
    await requireUser(s.client);
    const { data, error } = await s.client.rpc("pi_bnf", {
      payload: { action: "list" },
    });
    check(error);
    return s.finish(json({ schedules: data }));
  } catch (e) {
    return s.finish(failure(e));
  }
}

export async function POST(req: Request) {
  const s = supabase(req);
  try {
    sameOrigin(req);
    await requireUser(s.client);
    if (!req.headers.get("content-type")?.includes("application/json"))
      throw new HttpError(
        415,
        "Only reviewed schedule details are accepted. PDFs are not stored.",
      );
    const reader = req.body?.getReader();
    if (!reader) throw new HttpError(400, "Missing schedule details");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 400000) {
        await reader.cancel();
        throw new HttpError(413, "Schedule details are too large");
      }
      chunks.push(value);
    }
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(new TextDecoder().decode(Buffer.concat(chunks)));
    } catch {
      throw new HttpError(400, "Invalid schedule data");
    }
    const draft = bnfSchema.parse(raw);
    const filename = z.string().trim().min(1).max(240).parse(raw.filename);
    const { data, error } = await s.client.rpc("pi_bnf", {
      payload: { action: "save", ...draft, filename },
    });
    check(error);
    return s.finish(json(data, 201));
  } catch (e) {
    return s.finish(failure(e));
  }
}
