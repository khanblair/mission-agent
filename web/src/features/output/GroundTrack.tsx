import { useEffect, useRef } from 'react'
import { Map } from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { GroundTrackPoint } from '../../types'

// Lat/lon graticule lines every N degrees
const GRATICULE_STEP = 30

function buildGraticule() {
  const lines: [number, number][][] = []

  // Longitude lines
  for (let lon = -180; lon <= 180; lon += GRATICULE_STEP) {
    const pts: [number, number][] = []
    for (let lat = -90; lat <= 90; lat += 5) pts.push([lat, lon])
    lines.push(pts)
  }

  // Latitude lines
  for (let lat = -90; lat <= 90; lat += GRATICULE_STEP) {
    const pts: [number, number][] = []
    for (let lon = -180; lon <= 180; lon += 5) pts.push([lat, lon])
    lines.push(pts)
  }

  return lines
}

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
        center: [20, 0],
        zoom: 2,
        minZoom: 1,
        maxZoom: 8,
        zoomControl: true,
        attributionControl: false,
      })

      // ESRI World Imagery — free satellite tiles, no API key required
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, opacity: 0.9 },
      ).addTo(map)

      // ESRI labels overlay (country/city names)
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, opacity: 0.7 },
      ).addTo(map)

      // Lat/lon graticule
      const graticule = buildGraticule()
      for (const line of graticule) {
        L.polyline(line, {
          color: 'rgba(255,255,255,0.12)',
          weight: 0.5,
          interactive: false,
        }).addTo(map)
      }

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

      for (const layer of layersRef.current) map.removeLayer(layer)
      layersRef.current = []

      const segments = lastRunResult!.groundtrack_segments
      if (!segments?.length) return

      for (const seg of segments) {
        const latlngs = seg.map((p: GroundTrackPoint) => [p.lat, p.lon])
        const line = L.polyline(latlngs, {
          color: '#f97316',  // accent orange — stands out on satellite imagery
          weight: 2,
          opacity: 0.9,
        })
        map.addLayer(line)
        layersRef.current.push(line)
      }

      // Epoch (start) position marker
      const first = segments[0]?.[0]
      if (first) {
        const marker = L.circleMarker([first.lat, first.lon], {
          radius: 6,
          color: '#ffffff',
          fillColor: '#f97316',
          fillOpacity: 1,
          weight: 2,
        }).bindTooltip('Epoch position', { permanent: false, className: 'leaflet-tooltip-dark' })
        map.addLayer(marker)
        layersRef.current.push(marker)
      }

      // Latest position marker (last point of last segment)
      const lastSeg = segments[segments.length - 1]
      const lastPt = lastSeg?.[lastSeg.length - 1]
      if (lastPt && lastPt !== first) {
        const marker = L.circleMarker([lastPt.lat, lastPt.lon], {
          radius: 5,
          color: '#ffffff',
          fillColor: '#60a5fa',
          fillOpacity: 1,
          weight: 2,
        }).bindTooltip('End position', { permanent: false, className: 'leaflet-tooltip-dark' })
        map.addLayer(marker)
        layersRef.current.push(marker)
      }
    }

    drawTrack()
  }, [lastRunResult])

  const hasTrack = Boolean(lastRunResult?.groundtrack_segments?.length)

  return (
    <div className="relative w-full h-full" style={{ background: '#02050f' }}>
      <div ref={mapRef} className="w-full h-full" />

      {!hasTrack && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none" style={{ background: '#02050f' }}>
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
