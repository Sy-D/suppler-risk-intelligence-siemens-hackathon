"use client"

import {
  Map,
  MapCircle,
  MapMarker,
  MapPopup,
  MapTileLayer,
  MapZoomControl,
  MapFullscreenControl,
} from "@/components/ui/map"
import { HAZARD_META, regionForSupplier, type HazardKind } from "@/lib/geo"
import type { Supplier } from "@/lib/supplier-data"

const HAZARD_RADIUS = [0, 25000, 60000, 120000]

export function SupplierMap({ supplier }: { supplier: Supplier }) {
  const region = regionForSupplier(supplier.id)
  const center: [number, number] = [supplier.lat, supplier.lon]
  // SAFETY: GeoRegion.hazards keys are exactly the HazardKind union.
  const activeHazards = (
    Object.entries(region.hazards) as [HazardKind, number][]
  ).filter(([, level]) => level > 0)

  return (
    <Map
      center={center}
      zoom={5}
      className="h-72 rounded-2xl sm:h-80"
      scrollWheelZoom={false}
    >
      <MapTileLayer
        vectorStyleUrl="/api/map-proxy/styles/positron"
        darkVectorStyleUrl="/api/map-proxy/styles/dark"
      />
      <MapZoomControl />
      <MapFullscreenControl />
      {activeHazards.map(([kind, level]) => (
        <MapCircle
          key={kind}
          center={center}
          radius={HAZARD_RADIUS[level]}
          pathOptions={{
            color: HAZARD_META[kind].color,
            fillColor: HAZARD_META[kind].color,
            fillOpacity: 0.12,
            weight: 1.5,
            dashArray: "4 4",
          }}
        />
      ))}
      <MapMarker position={center}>
        <MapPopup>
          <p className="font-medium">{supplier.name}</p>
          <p className="text-xs text-muted-foreground">
            {region.name}, {region.country}
          </p>
        </MapPopup>
      </MapMarker>
    </Map>
  )
}
