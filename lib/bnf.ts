import { z } from "zod";
import { dateSchema } from "./domain";

export const maxPdfBytes = 3 * 1024 * 1024;
export const bnfSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    start_date: dateSchema,
    end_date: dateSchema,
    details: z
      .string()
      .trim()
      .min(1, "Review and add the schedule details before saving.")
      .max(80000),
    notes: z.string().max(6000).default(""),
  })
  .refine(
    (v) => v.end_date >= v.start_date,
    "End date must be on or after the start date.",
  );
export type BnfDraft = z.infer<typeof bnfSchema>;
export type BnfSchedule = BnfDraft & {
  id: string;
  filename: string;
  created_at: string;
};

export type PdfText = { str: string; transform: number[]; width: number };
// Preserve table alignment in text. Never interpret document text as commands.
export function pageText(items: PdfText[]) {
  const lines: { y: number; items: PdfText[] }[] = [];
  for (const item of items
    .filter((i) => i.str.trim())
    .sort(
      (a, b) =>
        b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4],
    )) {
    let line = lines.find((l) => Math.abs(l.y - item.transform[5]) < 2);
    if (!line) {
      line = { y: item.transform[5], items: [] };
      lines.push(line);
    }
    line.items.push(item);
  }
  const anchors = lines
    .map((l) =>
      l.items.filter((i) =>
        /^\d{1,2}[- ][A-Za-z]{3,9}[- ]\d{2,4}$/.test(i.str.trim()),
      ),
    )
    .find((items) => items.length === 7)
    ?.sort((a, b) => a.transform[4] - b.transform[4]);
  if (!anchors)
    return lines
      .map((l) =>
        l.items
          .sort((a, b) => a.transform[4] - b.transform[4])
          .map((i) => i.str.trim())
          .join(" | "),
      )
      .join("\n");
  const centers = anchors.map((i) => i.transform[4] + i.width / 2);
  const columnWidth = (centers[6] - centers[0]) / 6;
  // Keep the day attached to sparse cells (e.g. Thursday/Sunday specials).
  // Wide, merged notes stay unassigned rather than being invented as daily events.
  return lines
    .map((line) => {
      const label: string[] = [];
      const shared: string[] = [];
      const cells: string[][] = anchors.map(() => []);
      for (const item of line.items.sort(
        (a, b) => a.transform[4] - b.transform[4],
      )) {
        const center = item.transform[4] + item.width / 2;
        if (center < centers[0] - columnWidth / 2) label.push(item.str.trim());
        else if (item.width > columnWidth * 1.3) shared.push(item.str.trim());
        else {
          const index = centers.reduce(
            (best, x, i) =>
              Math.abs(x - center) < Math.abs(centers[best] - center)
                ? i
                : best,
            0,
          );
          cells[index].push(item.str.trim());
        }
      }
      return [
        ...label,
        ...cells.flatMap((cell, i) =>
          cell.length ? [`${anchors[i].str.trim()}: ${cell.join(" ")}`] : [],
        ),
        ...shared.map((s) => `Shared note: ${s}`),
      ].join(" | ");
    })
    .join("\n");
}
export function scheduleDates(text: string) {
  const months = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];
  const dates = Array.from(
    text.matchAll(/\b(\d{1,2})[- ]([A-Za-z]{3,9})[- ](\d{2,4})\b/g),
    (m) => {
      const month = months.indexOf(m[2].slice(0, 3).toLowerCase()) + 1;
      const year = m[3].length === 2 ? "20" + m[3] : m[3];
      return `${year}-${String(month).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    },
  )
    .filter((d) => dateSchema.safeParse(d).success)
    .sort();
  return { start_date: dates[0] || "", end_date: dates.at(-1) || "" };
}
