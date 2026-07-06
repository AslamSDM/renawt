import { renderThreeScene } from "../src/threeEngine/sceneHost"
import { existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const threePath = join(__dirname, "node_modules", "three", "build", "three.module.js")
console.log("three exists:", existsSync(threePath), threePath)

const spec: any = {
  width: 320, height: 240, fps: 30, durationInFrames: 3, bgColor: "#111",
  cameraRig: { type: "orbit", center: [0,0,0], radius: 5, speed: 0.2, fov: 50, height: 1.5 },
  objects: [{ id: "box1", kind: "box", props: { color: "#4a9eff" }, position: [0,0,0] }],
}
const r = await renderThreeScene(spec, {
  width: 320, height: 240, fps: 30, durationInFrames: 3,
  outputFormat: "mp4", outputPath: join(__dirname, "out", "three-mini.mp4"),
  onProgress: () => {},
})
console.log("result:", r)