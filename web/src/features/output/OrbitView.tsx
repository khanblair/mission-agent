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

        Cesium.Ion.defaultAccessToken =
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJkZWZhdWx0LXRva2VuIiwiaWF0IjoxNjAwMDAwMDAwfQ.placeholder'

        const viewer = new Cesium.Viewer(containerRef.current, {
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
          imageryProvider: new Cesium.TileMapServiceImageryProvider({
            url: Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII'),
          }),
        })

        viewer.scene.globe.enableLighting = true
        viewer.scene.skyAtmosphere.show = true
        viewerRef.current = viewer
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

        const entity = ds.entities.values[1]
        if (entity) {
          viewer.trackedEntity = entity
          viewer.clock.startTime = ds.clock.startTime
          viewer.clock.stopTime = ds.clock.stopTime
          viewer.clock.currentTime = ds.clock.startTime
          viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP
          viewer.clock.multiplier = 60
          viewer.timeline.zoomTo(ds.clock.startTime, ds.clock.stopTime)
        }
      } catch (e) {
        console.error('CZML load failed:', e)
      }
    }

    loadCzml()
  }, [lastRunResult])

  const hasCzml = Boolean(lastRunResult?.czml?.length)

  return (
    <div className="relative w-full h-full bg-space-950">
      {/* Cesium container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Empty state */}
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
            {Array.from({ length: 40 }).map((_, i) => (
              <div
                key={i}
                className="absolute w-0.5 h-0.5 rounded-full bg-white/20"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  opacity: Math.random() * 0.6 + 0.1,
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
