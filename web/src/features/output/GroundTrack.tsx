import { useEffect, useRef } from 'react'
import { Map } from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { GroundTrackPoint } from '../../types'

export function GroundTrack() {
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletRef = useRef<unknown>(null)
  const layersRef = useRef<unknown[]>([])
  const { lastRunResult } = useStore()

  useEffect(() => {
    if (!mapRef.current || leafletRef.current) return

    async function initMap() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const L: any = await import('leaflet')
      if (!mapRef.current) return

      const map = L.map(mapRef.current, {
        center: [0, 0],
        zoom: 1.5,
        minZoom: 1,
        maxZoom: 6,
        zoomControl: true,
        attributionControl: false,
      })

      // Dark tile layer
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map)

      leafletRef.current = map
    }

    initMap()

    return () => {
      if (leafletRef.current) {
        // @ts-expect-error
        leafletRef.current.remove()
        leafletRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!leafletRef.current || !lastRunResult?.groundtrack_segments) return

    async function drawTrack() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const L: any = await import('leaflet')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const map: any = leafletRef.current

      for (const layer of layersRef.current) {
        map.removeLayer(layer)
      }
      layersRef.current = []

      const segments = lastRunResult!.groundtrack_segments
      if (!segments?.length) return

      for (const seg of segments) {
        const latlngs = seg.map((p: GroundTrackPoint) => [p.lat, p.lon])
        const line = L.polyline(latlngs, { color: '#60a5fa', weight: 1.5, opacity: 0.8 })
        map.addLayer(line)
        layersRef.current.push(line)
      }

      const first = segments[0]?.[0]
      if (first) {
        const marker = L.circleMarker([first.lat, first.lon], {
          radius: 5, color: '#f97316', fillColor: '#f97316', fillOpacity: 1, weight: 2,
        }).bindTooltip('Epoch position', { permanent: false })
        map.addLayer(marker)
        layersRef.current.push(marker)
      }
    }

    drawTrack()
  }, [lastRunResult])

  const hasTrack = Boolean(lastRunResult?.groundtrack_segments?.length)

  return (
    <div className="relative w-full h-full bg-space-950">
      <div ref={mapRef} className="w-full h-full" />

      {!hasTrack && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none bg-space-950">
          <Map size={28} className="text-accent-500/30" />
          <div className="text-center">
            <p className="text-sm text-muted/60">Ground track</p>
            <p className="text-xs text-faint mt-1">Run a mission to see the ground track</p>
          </div>
        </div>
      )}
    </div>
  )
}
