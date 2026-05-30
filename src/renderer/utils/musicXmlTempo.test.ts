import { describe, expect, it } from "vitest";
import { parseMusicXmlTempo } from "./musicXmlTempo";

describe("parseMusicXmlTempo", () => {
  it("reads per-minute tempo + time signature (Brahms 3/4, ♩=95)", () => {
    const xml = `<score-partwise>
      <part><measure>
        <attributes><time><beats>3</beats><beat-type>4</beat-type></time></attributes>
        <direction><direction-type><metronome>
          <beat-unit>quarter</beat-unit><per-minute>95</per-minute>
        </metronome></direction-type></direction>
      </measure></part></score-partwise>`;
    expect(parseMusicXmlTempo(xml)).toEqual({
      bpm: 95,
      numerator: 3,
      denominator: 4,
    });
  });

  it("falls back to sound tempo when no metronome mark", () => {
    const xml = `<measure>
      <attributes><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
      <sound tempo="120"/>
    </measure>`;
    expect(parseMusicXmlTempo(xml)).toEqual({
      bpm: 120,
      numerator: 4,
      denominator: 4,
    });
  });

  it("returns meter even when tempo is absent", () => {
    const xml =
      `<attributes><time><beats>6</beats><beat-type>8</beat-type></time></attributes>`;
    expect(parseMusicXmlTempo(xml)).toEqual({
      bpm: null,
      numerator: 6,
      denominator: 8,
    });
  });

  it("rounds fractional per-minute", () => {
    expect(parseMusicXmlTempo("<per-minute>92.5</per-minute>")?.bpm).toBe(93);
  });

  it("returns null when nothing parseable / empty", () => {
    expect(parseMusicXmlTempo("<score/>")).toBeNull();
    expect(parseMusicXmlTempo(null)).toBeNull();
    expect(parseMusicXmlTempo("")).toBeNull();
  });
});
