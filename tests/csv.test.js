import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, serializeItems, detectDelimiter, parseDate, normalizeType } from "../js/csv.js";

describe("csv", () => {
  it("round-trips items including quoted names", () => {
    const items = [
      {
        id: "abc",
        name: 'Blue "favorite" jeans',
        type: "pants",
        firstUsed: "2026-03-12",
        usesSinceWash: 3,
        totalUses: 47,
      },
    ];
    const csv = serializeItems(items);
    const parsed = parseCsv(csv);
    assert.equal(parsed.items.length, 1);
    assert.equal(parsed.items[0].name, 'Blue "favorite" jeans');
    assert.equal(parsed.items[0].type, "pants");
    assert.equal(parsed.items[0].usesSinceWash, 3);
    assert.equal(parsed.items[0].totalUses, 47);
    assert.equal(parsed.items[0].id, "abc");
    assert.equal(parsed.items[0].firstUsed, "2026-03-12");
  });

  it("reads Google Sheets TSV paste", () => {
    const text = "Name\tType\tFirst Used\tUses Since Wash\tTotal Uses\nNavy chinos\tPants\t2026-01-02\t2\t10";
    assert.equal(detectDelimiter(text), "\t");
    const parsed = parseCsv(text);
    assert.equal(parsed.items[0].name, "Navy chinos");
    assert.equal(parsed.items[0].type, "pants");
    assert.equal(parsed.items[0].usesSinceWash, 2);
  });

  it("maps hoodie aliases and BOM", () => {
    const text = "\uFEFFName,Type,Uses Since Wash,Total Uses\nCampus hoodie,Hoodie,1,4";
    const parsed = parseCsv(text);
    assert.equal(parsed.items[0].type, "sweaters");
    assert.equal(normalizeType("Sweaters & Hoodies"), "sweaters");
  });

  it("parses common date formats", () => {
    assert.equal(parseDate("2026-08-31"), "2026-08-31");
    assert.equal(parseDate("8/31/2026"), "2026-08-31");
    assert.equal(parseDate("31/8/2026"), "2026-08-31");
  });

  it("raises total to at least uses since wash", () => {
    const parsed = parseCsv("Name,Type,Uses Since Wash,Total Uses\nA,Shorts,5,2");
    assert.equal(parsed.items[0].usesSinceWash, 5);
    assert.equal(parsed.items[0].totalUses, 5);
  });

  it("skips empty names and unknown types", () => {
    const parsed = parseCsv("Name,Type\n,Pants\nHat,Hat");
    assert.equal(parsed.items.length, 0);
    assert.equal(parsed.errors.length, 2);
  });
});
