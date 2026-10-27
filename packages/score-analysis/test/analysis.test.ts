import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseMusicXml } from '../musicxml'
import { detectStaffLines, analyzePageImage } from '../staffDetector'
import { detectMetadataFromText } from '../metadataDetector'
import { analyzeScore } from '../index'

describe('MusicXML Parser', () => {
  it('correctly parses title, composer, parts, key, time signature, and repeats', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <score-partwise version="3.1">
      <work>
        <work-title>Sinfonía No. 5 en Do Menor</work-title>
      </work>
      <identification>
        <creator type="composer">Ludwig van Beethoven</creator>
      </identification>
      <part-list>
        <score-part id="P1">
          <part-name>Violín I</part-name>
        </score-part>
        <score-part id="P2">
          <part-name>Violonchelo</part-name>
        </score-part>
      </part-list>
      <part id="P1">
        <measure number="1">
          <attributes>
            <key>
              <fifths>-3</fifths>
              <mode>minor</mode>
            </key>
            <time>
              <beats>2</beats>
              <beat-type>4</beat-type>
            </time>
          </attributes>
          <direction>
            <sound tempo="108"/>
          </direction>
        </measure>
        <measure number="2"/>
        <measure number="3"/>
        <measure number="4">
          <barline location="right">
            <repeat direction="backward"/>
          </barline>
        </measure>
        <measure number="5"/>
      </part>
    </score-partwise>`

    const result = parseMusicXml(xml)

    assert.equal(result.title, 'Sinfonía No. 5 en Do Menor')
    assert.equal(result.composer, 'Ludwig van Beethoven')
    assert.equal(result.keySignature, 'C minor')
    assert.equal(result.timeSignature, '2/4')
    assert.equal(result.tempoBpm, 108)
    assert.equal(result.parts.length, 2)
    assert.equal(result.parts[0].name, 'Violín I')
    assert.equal(result.parts[0].instrumentCode, 'violin_1')
    assert.equal(result.parts[1].name, 'Violonchelo')
    assert.equal(result.parts[1].instrumentCode, 'cello')
    assert.equal(result.totalMeasures, 5)
    assert.equal(result.source, 'musicxml')

    // Check repeat in playbackMap
    assert.equal(result.playbackMap.length, 1)
    assert.equal(result.playbackMap[0].at, 4)
    assert.equal(result.playbackMap[0].to, 1)
    assert.equal(result.playbackMap[0].label, 'repeat')
  })
})

describe('Staff Detection Heuristics (HPP)', () => {
  it('detects 5-line staff pattern in synthetic pixel buffer', () => {
    const width = 200
    const height = 100
    const gray = new Uint8Array(width * height)
    gray.fill(255) // White background

    // Draw a 5-line staff at y = 30, 38, 46, 54, 62 (spacing = 8px)
    const staffLines = [30, 38, 46, 54, 62]
    for (const y of staffLines) {
      for (let x = 10; x < 190; x++) {
        gray[y * width + x] = 0 // Black line
      }
    }

    const staves = detectStaffLines({
      width,
      height,
      data: gray,
      isRgba: false,
    })

    assert.equal(staves.length, 1)
    assert.equal(staves[0].topY, 30)
    assert.equal(staves[0].bottomY, 62)
    assert.equal(staves[0].lineSpacing, 8)
  })

  it('generates normalized system bounding boxes and measures', () => {
    const width = 400
    const height = 300
    const gray = new Uint8Array(width * height)
    gray.fill(255)

    // Draw staff 1 (y = 50, 58, 66, 74, 82)
    for (const y of [50, 58, 66, 74, 82]) {
      for (let x = 20; x < 380; x++) gray[y * width + x] = 0
    }

    // Draw staff 2 (y = 180, 188, 196, 204, 212)
    for (const y of [180, 188, 196, 204, 212]) {
      for (let x = 20; x < 380; x++) gray[y * width + x] = 0
    }

    const res = analyzePageImage(
      { width, height, data: gray, isRgba: false },
      1,
      1,
      4
    )

    assert.equal(res.systems.length, 2)
    assert.equal(res.systems[0].systemOrder, 1)
    assert.equal(res.systems[0].measureStart, 1)
    assert.equal(res.systems[0].measureCount, 4)
    assert.equal(res.systems[1].systemOrder, 2)
    assert.equal(res.systems[1].measureStart, 5)
  })
})

describe('Metadata Text Detection', () => {
  it('extracts title, composer, opus, and instruments from text items', () => {
    const items = [
      { str: 'CUARTETO DE CUERDAS NO. 14', x: 200, y: 50, fontSize: 24 },
      { str: 'Op. 131', x: 350, y: 80, fontSize: 14 },
      { str: 'L. van Beethoven', x: 750, y: 110, fontSize: 13 },
      { str: 'Adagio ma non troppo', x: 100, y: 160, fontSize: 12 },
      { str: 'Violín I', x: 30, y: 220, fontSize: 10 },
      { str: 'Violín II', x: 30, y: 320, fontSize: 10 },
      { str: 'Viola', x: 30, y: 420, fontSize: 10 },
      { str: 'Violonchelo', x: 30, y: 520, fontSize: 10 },
    ]

    const meta = detectMetadataFromText(items, 1000, 1400)

    assert.equal(meta.title, 'CUARTETO DE CUERDAS NO. 14')
    assert.equal(meta.composer, 'L. van Beethoven')
    assert.equal(meta.catalogRef, 'Op. 131')
    assert.equal(meta.tempoBpm, 66) // Adagio
    assert.equal(meta.detectedInstrumentNames.length, 4)
    assert.ok(meta.detectedInstrumentNames.includes('Violín I'))
    assert.ok(meta.detectedInstrumentNames.includes('Viola'))
  })
})
