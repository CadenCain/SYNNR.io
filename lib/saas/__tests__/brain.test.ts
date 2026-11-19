import { describe, it, expect } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { chunkPages, isHeading, tidy, listScore, listAsText, fileKind, titleFromFile, sourceWhere, keyWords, askedWords, quoted, unknownSays, CHUNK_MAX, MAX_CHUNKS } from "../brain";
import { partsFrom } from "../brain-ask";

describe("what counts as a heading", () => {
  it("takes a numbered section, an article, a line in capitals, and a short line ending in a colon", () => {
    for (const h of ["7. Standby", "7.2 Standby Time", "3. Rates and Charges", "ARTICLE IV", "Section 5 - Rates", "Exhibit A", "RIG UP", "# Rig up", "Pressure test:"]) expect(isHeading(h), h).toBe(true);
  });
  it("leaves a step, a sentence, and a size alone", () => {
    for (const s of ["3. Pressure test to 5,000 psi", "2. Function test the BOP rams before stabbing on.", "Standby is billed at 185.00 per hour.", "5-1/2", "OK", "a line that goes on for quite a while and is plainly a sentence of some kind, not a heading at all:"]) expect(isHeading(s), s).toBe(false);
  });
});

describe("cutting a document into passages", () => {
  const msa = [
    "MASTER SERVICE AGREEMENT\nBetween the shop and the customer\n\n7. Standby\nStandby is billed at 185.00 per hour per unit after the first two hours on location.\n\n8. Cancellation\nA job cancelled less than 12 hours before the start time is billed a 1,500.00 mobilization charge.",
    "9. Payment\nInvoices are due net 45 from the invoice date.",
  ];

  it("makes each clause its own passage, named for its section and its page", () => {
    const pieces = chunkPages(msa);
    const standby = pieces.find((p) => p.body.includes("185.00"))!;
    expect(standby.section).toContain("7. Standby");
    expect(standby.page).toBe(1);
    const cancel = pieces.find((p) => p.body.includes("1,500.00"))!;
    expect(cancel.section).toBe("8. Cancellation");
    expect(cancel.body).not.toContain("185.00");
    const pay = pieces.find((p) => p.body.includes("net 45"))!;
    expect(pay.section).toBe("9. Payment");
    expect(pay.page).toBe(2);
    expect(pieces.map((p) => p.idx)).toEqual(pieces.map((_, i) => i));
  });

  it("keeps the steps of a procedure together", () => {
    const sop = "RIG UP\n1. Spot the unit upwind of the wellhead.\n2. Function test the BOP rams before stabbing on\n3. Pressure test to 5,000 psi\n4. Record the test on the ticket.";
    const pieces = chunkPages([sop]);
    expect(pieces).toHaveLength(1);
    expect(pieces[0].section).toBe("RIG UP");
    // Not a PDF: no page to point at.
    expect(pieces[0].page).toBeNull();
  });

  it("takes a short line standing on its own as a heading, when a paragraph follows it", () => {
    const sheet = "Price sheet\n\nStandby\n\nStandby is $225.00 per hour for each unit after the first hour on location.\n\nMileage and travel\n\nMileage is $4.25 per mile for each unit, one way, from the yard.";
    const pieces = chunkPages([sheet]);
    expect(pieces.find((p) => p.body.includes("225.00"))!.section).toBe("Standby");
    expect(pieces.find((p) => p.body.includes("4.25"))!.section).toBe("Mileage and travel");
    // A short line in the middle of a list isn't one.
    const list = chunkPages(["What we carry\n\nLubricator\n\nBOP\n\nTest pump"]);
    expect(list).toHaveLength(1);
  });

  it("never makes a passage too long to keep, even from one unbroken wall of text", () => {
    const wall = "word ".repeat(4000);
    const pieces = chunkPages([wall]);
    expect(pieces.length).toBeGreaterThan(5);
    for (const p of pieces) expect(p.body.length).toBeLessThanOrEqual(CHUNK_MAX + 200);
    const sentences = Array.from({ length: 400 }, (_, i) => `Sentence number ${i} says something about the job.`).join(" ");
    for (const p of chunkPages([sentences])) expect(p.body.length).toBeLessThanOrEqual(CHUNK_MAX + 200);
  });

  it("stops at the most passages a document can hold, and loses nothing before that", () => {
    const many = Array.from({ length: MAX_CHUNKS + 50 }, (_, i) => `SECTION ${i}\nThis is what section ${i} says about how the work is done here.`).join("\n\n");
    expect(chunkPages([many])).toHaveLength(MAX_CHUNKS);
    expect(chunkPages(["", "   \n\n"])).toEqual([]);
  });

  it("cleans up what a file hands back", () => {
    expect(tidy("stand-\nby\r\nline\u0000 two here \n\n\n\nend")).toBe("standby\nline two here\n\nend");
  });
});

describe("the shop's job lists as something to answer from", () => {
  const plug = { name: "Plug and cement", lines: ["3-1/2 bailer", "Setting tool", "CCL"] };
  const coil = { name: "Standard Coil Package", lines: ["Lubricator", "2in 1502 pup joint"] };

  it("picks the list a question names", () => {
    expect(listScore("What do we take on a plug and cement job?", plug)).toBeGreaterThanOrEqual(10);
    expect(listScore("What do we take on a plug and cement job?", coil)).toBe(0);
    expect(listScore("what's on the standard coil package", coil)).toBeGreaterThanOrEqual(10);
  });
  it("picks one that's plainly about what's on it, and not one that shares a single word", () => {
    expect(listScore("do we carry a bailer and a setting tool?", plug)).toBeGreaterThan(0);
    expect(listScore("what does the MSA say about standby?", plug)).toBe(0);
    expect(listScore("", plug)).toBe(0);
  });
  it("reads as plain text, with what stops the job marked", () => {
    const text = listAsText({ name: "Plug and cement", lines: [
      { label: "3-1/2 bailer", qty: 2, critical: true, phase: "load" },
      { label: "CCL", qty: 1, critical: false, phase: "load" },
      { label: "Equipment washed", qty: 1, critical: true, phase: "after" },
    ] });
    expect(text).toContain("Job list: Plug and cement");
    expect(text).toContain("- 3-1/2 bailer x 2 (critical");
    expect(text).toContain("- CCL\n");
    expect(text).toContain("after the job:\n- Equipment washed");
  });
  it("keeps sizes whole when it reads a question", () => {
    expect(keyWords("What do we take on a 5-1/2 plug?")).toEqual(["5-1/2", "plug"]);
  });
});

describe("what SYNNR can read", () => {
  it("takes PDF, Word and text, and says why not for the rest", () => {
    expect(fileKind("MSA 2026.PDF")).toMatchObject({ ok: true, ext: "pdf" });
    expect(fileKind("sop.docx")).toMatchObject({ ok: true, ext: "docx" });
    expect(fileKind("rates.csv")).toMatchObject({ ok: true, ext: "text", mime: "text/csv" });
    expect(fileKind("old.doc")).toMatchObject({ ok: false });
    expect((fileKind("prices.xlsx") as { problem: string }).problem).toContain("PDF or a CSV");
    expect((fileKind("IMG_0412.jpg") as { problem: string }).problem).toContain("note");
    expect(fileKind("thing")).toMatchObject({ ok: false });
  });
  it("names a document after its file", () => {
    expect(titleFromFile("MSA_Dry_Creek-2026.pdf")).toBe("MSA Dry Creek-2026");
    expect(titleFromFile(".pdf")).toBe("Untitled");
  });
  it("says where a passage is", () => {
    expect(sourceWhere({ section: "7. Standby", page: 4 })).toBe("7. Standby · page 4");
    expect(sourceWhere({ section: null, page: null })).toBe("");
  });
});

describe("reading the model's reply", () => {
  const text = (t: string, cites: number[] = []) => ({
    type: "text", text: t,
    citations: cites.length ? cites.map((i) => ({ type: "search_result_location", search_result_index: i, source: "doc:x#0", title: "t", cited_text: "c", start_block_index: 0, end_block_index: 1 })) : null,
  }) as unknown as Anthropic.ContentBlock;

  it("ties each part to the passages it was taken from, numbered from 1", () => {
    const parts = partsFrom([
      { type: "thinking", thinking: "…", signature: "s" } as unknown as Anthropic.ContentBlock,
      text("Standby is 185.00 an hour", [0, 0]),
      text(" after the first two hours.", [2]),
      text(" Sign for it on the ticket."),
    ], 3);
    expect(parts).toEqual([
      { text: "Standby is 185.00 an hour", cites: [1] },
      { text: " after the first two hours.", cites: [3] },
      { text: " Sign for it on the ticket.", cites: [] },
    ]);
  });
  it("drops a pointer to a passage it was never given", () => {
    expect(partsFrom([text("Something.", [7])], 3)).toEqual([{ text: "Something.", cites: [] }]);
  });
  it("won't pass an empty reply off as an answer", () => {
    expect(() => partsFrom([], 3)).toThrow();
    expect(() => partsFrom([text("  ")], 3)).toThrow();
  });
});

describe("saying when the documents don't have it", () => {
  it("keeps the words that say what a question is about", () => {
    expect(askedWords("What does our MSA say about standby time?")).toEqual(["msa", "standby", "time"]);
    expect(askedWords("Who pays the hotel on an overnight job?")).toEqual(["pays", "hotel", "overnight"]);
    // Split the way the database splits it, so the two agree on what a word is.
    expect(askedWords("What do we take on a 5-1/2 plug?")).toEqual(["plug"]);
  });
  it("lists words the way a person would", () => {
    expect(quoted(["hotel"])).toBe("“hotel”");
    expect(quoted(["hotel", "lodging"])).toBe("“hotel” or “lodging”");
    expect(quoted(["torque", "injector", "chain"])).toBe("“torque”, “injector” or “chain”");
  });
  it("says nothing when every word that matters is in the documents", () => {
    expect(unknownSays("What does our MSA say about standby time?", [])).toBeNull();
    // A padding word no document uses isn't worth mentioning.
    expect(unknownSays("What does our MSA say about standby time?", ["say"])).toBeNull();
  });
  it("names the word the passages don't have, and calls them the closest", () => {
    const says = unknownSays("Who pays the hotel on an overnight job?", ["hotel"]);
    expect(says).toEqual({ none: false, text: "Your documents never mention “hotel”. These are the closest passages, word for word." });
  });
  it("won't guess when most of what was asked about is in no document", () => {
    const says = unknownSays("Who covers lodging overnight?", ["covers", "lodging"]);
    expect(says?.none).toBe(true);
    expect(says?.text).toBe("Your documents never mention “covers” or “lodging”. I won't guess.");
    // Half isn't most: the passages still get shown as the closest.
    expect(unknownSays("What do we charge if we lose a tool downhole?", ["lose", "downhole"])?.none).toBe(false);
  });
  it("counts a word on a job list as known", () => {
    expect(unknownSays("Do we take the bailer?", ["bailer"], ["Plug and cement", "3-1/2 bailers"])).toBeNull();
    expect(unknownSays("Do we take the bailer?", ["bailer"], ["Plug and cement", "CCL"])?.none).toBe(true);
  });
  it("names four words at most", () => {
    const says = unknownSays("torque injector chain gooseneck stripper", ["torque", "injector", "chain", "gooseneck", "stripper"]);
    expect(says?.text).toBe("Your documents never mention “torque”, “injector”, “chain” or “gooseneck”. I won't guess.");
  });
});
