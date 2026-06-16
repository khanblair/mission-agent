import { useEffect, useRef } from 'react'
import { Globe } from 'lucide-react'
import { useStore } from '../../store/useStore'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyViewer = any

export function OrbitView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<AnyViewer>(null)
  const { lastRunResult } = useStore()

  useEffect(() => {
    if (!containerRef.current) return

    async function initCesium() {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Cesium: any = await import('cesium')
        if (!containerRef.current || viewerRef.current) return

        // Use UrlTemplateImageryProvider — synchronous API, unchanged since Cesium 1.x.
        // ESRI World Imagery: free, no token, same source as the ground track view.
        // Do NOT set Ion.defaultAccessToken — we use no Ion-hosted assets.
        const imageryProvider = new Cesium.UrlTemplateImageryProvider({
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          maximumLevel: 18,
        })

        const viewer = new Cesium.Viewer(containerRef.current, {
          baseLayer: false,   // suppress default Bing/Ion request
          animation: true,
          timeline: true,
          homeButton: false,
          sceneModePicker: false,
          baseLayerPicker: false,
          navigationHelpButton: false,
          geocoder: false,
          fullscreenButton: false,
          infoBox: false,
          selectionIndicator: false,
          shadows: false,
          terrainShadows: Cesium.ShadowMode.DISABLED,
        })

        // Assign immediately so CZML loader can find the viewer even if
        // subsequent imagery setup throws (avoids the ref staying null).
        viewerRef.current = viewer

        // Add ESRI World Imagery as layer 0 (base). Use .add() — never
        // addImageryProvider(), which was removed in Cesium 1.100+.
        // No label overlay — ESRI's "Boundaries & Places" service has a solid
        // teal ocean background that completely covers the satellite imagery.
        viewer.imageryLayers.add(
          new Cesium.ImageryLayer(imageryProvider),
          0,
        )

        // Atmosphere & day/night terminator
        viewer.scene.globe.enableLighting = true
        viewer.scene.skyAtmosphere.show = true
        viewer.scene.globe.atmosphereLightIntensity = 10.0

        // Dark space background
        viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#02050f')

        // Initial camera — Earth centered, 22,000 km out, slight overhead tilt
        viewer.camera.lookAt(
          Cesium.Cartesian3.ZERO,
          new Cesium.HeadingPitchRange(
            Cesium.Math.toRadians(30),
            Cesium.Math.toRadians(-30),
            22_000_000,
          ),
        )
        viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY)
      } catch (e) {
        console.error('Cesium init failed:', e)
      }
    }

    initCesium()

    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy?.()
        viewerRef.current = null
      }
    }
  }, [])

  // Load CZML when run result arrives
  useEffect(() => {
    if (!viewerRef.current || !lastRunResult?.czml?.length) return

    async function loadCzml() {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Cesium: any = await import('cesium')
        const viewer = viewerRef.current
        viewer.dataSources.removeAll()

        const czmlStr = JSON.stringify(lastRunResult!.czml)
        const blob = new Blob([czmlStr], { type: 'application/json' })
        const blobUrl = URL.createObjectURL(blob)

        const ds = await Cesium.CzmlDataSource.load(blobUrl)
        await viewer.dataSources.add(ds)
        URL.revokeObjectURL(blobUrl)

        // Set the simulation clock from the CZML document packet
        viewer.clock.startTime = ds.clock.startTime
        viewer.clock.stopTime = ds.clock.stopTime
        viewer.clock.currentTime = ds.clock.startTime
        viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP
        viewer.clock.multiplier = 60
        viewer.timeline.zoomTo(ds.clock.startTime, ds.clock.stopTime)

        // lookAt(Cartesian3.ZERO) GUARANTEES Earth center is at the exact
        // center of the viewport — no pitch arithmetic needed.
        // HeadingPitchRange positions the camera 22,000 km from Earth center
        // at 30° above the equatorial plane for a nice orbital perspective.
        // lookAtTransform(IDENTITY) immediately unlocks free navigation.
        viewer.camera.lookAt(
          Cesium.Cartesian3.ZERO,
          new Cesium.HeadingPitchRange(
            Cesium.Math.toRadians(30),   // heading — slight east rotation
            Cesium.Math.toRadians(-30),  // pitch — camera above equatorial plane
            22_000_000,                   // 22,000 km from Earth center
          ),
        )
        viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY)
      } catch (e) {
        console.error('CZML load failed:', e)
      }
    }

    loadCzml()
  }, [lastRunResult])

  const hasCzml = Boolean(lastRunResult?.czml?.length)

  return (
    <div className="relative w-full h-full" style={{ background: '#02050f' }}>
      {/* Cesium mounts here */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Empty state — only when no run has completed */}
      {!hasCzml && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 pointer-events-none">
          <div className="w-16 h-16 rounded-full border border-accent-500/20 flex items-center justify-center bg-space-900/80">
            <Globe size={28} className="text-accent-500/50" />
          </div>
          <div className="text-center">
            <p className="text-sm text-muted/60">3D orbit view</p>
            <p className="text-xs text-faint mt-1">Run a mission to see the orbit</p>
          </div>
          {/* Starfield dots */}
          <div className="absolute inset-0 overflow-hidden">
            {Array.from({ length: 60 }).map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full bg-white"
                style={{
                  width: Math.random() > 0.85 ? '2px' : '1px',
                  height: Math.random() > 0.85 ? '2px' : '1px',
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  opacity: Math.random() * 0.7 + 0.1,
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
