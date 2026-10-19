import Foundation
import Vision
import AppKit

// Usage: swift ocr.swift image.png > out.json
// Runs Vision OCR on overlapping tiles and prints [{text, x, y, w, h}] in image pixels.
let path = CommandLine.arguments[1]
guard let img = NSImage(contentsOfFile: path),
      let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { exit(1) }
let W = cg.width, H = cg.height
let tile = 800, overlap = 150
var out: [[String: Any]] = []

var ty = 0
while ty < H {
  var tx = 0
  while tx < W {
    let rect = CGRect(x: tx, y: ty, width: min(tile, W - tx), height: min(tile, H - ty))
    if let sub = cg.cropping(to: rect) {
      let req = VNRecognizeTextRequest()
      req.recognitionLevel = .accurate
      req.usesLanguageCorrection = false
      req.minimumTextHeight = 0.005
      let h = VNImageRequestHandler(cgImage: sub, options: [:])
      try? h.perform([req])
      for o in req.results ?? [] {
        guard let c = o.topCandidates(1).first else { continue }
        let b = o.boundingBox
        let x = Double(tx) + b.minX * rect.width
        let y = Double(ty) + (1 - b.maxY) * rect.height
        out.append(["text": c.string, "x": x, "y": y, "w": b.width * rect.width, "h": b.height * rect.height, "conf": c.confidence])
      }
    }
    if tx + tile >= W { break }
    tx += tile - overlap
  }
  if ty + tile >= H { break }
  ty += tile - overlap
}
let data = try JSONSerialization.data(withJSONObject: out)
FileHandle.standardOutput.write(data)
