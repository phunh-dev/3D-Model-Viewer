import { describe, expect, it } from "vitest";
import { MeshPhongMaterial, MeshStandardMaterial, Texture } from "three";
import { collectTextures, slotSummary } from "../src/core/collectTextures";

describe("collectTextures", () => {
  it("dedupes shared textures and records every slot and material", () => {
    const albedo = new Texture();
    const normal = new Texture();
    const a = new MeshStandardMaterial({ name: "Body", map: albedo, normalMap: normal });
    const b = new MeshPhongMaterial({ name: "Head", map: albedo });

    const entries = collectTextures([a, b, a]);
    expect(entries).toHaveLength(2);
    expect(entries[0].texture).toBe(albedo);
    expect(entries[0].slots).toEqual(["map"]);
    expect(entries[0].materials).toEqual(["Body", "Head"]);
    expect(entries[1].slots).toEqual(["normalMap"]);
  });

  it("orders entries by slot and includes extra textures from userData", () => {
    const ao = new Texture();
    const rough = new Texture();
    const m = new MeshPhongMaterial({ name: "M", aoMap: ao });
    m.userData.extraTextures = { roughnessMap: rough };

    const entries = collectTextures([m]);
    expect(entries.map((e) => e.slots[0])).toEqual(["aoMap", "roughnessMap"]);

    const summary = slotSummary(entries);
    expect(summary.aoMap).toBe(1);
    expect(summary.roughnessMap).toBe(1);
    expect(summary.displacementMap).toBe(0);
  });
});

describe("collectTextures keyOf", () => {
  it("merges different Texture objects that come from the same file", () => {
    const a = new Texture();
    const b = new Texture();
    const files = new Map([
      [a, "C:/m/face.jpg"],
      [b, "C:/m/face.jpg"],
    ]);
    const entries = collectTextures(
      [new MeshPhongMaterial({ name: "A", map: a }), new MeshPhongMaterial({ name: "B", map: b })],
      (t) => files.get(t) ?? t.uuid,
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].materials).toEqual(["A", "B"]);
  });
});
