export type GeoCoord = {
  latitude: number;
  longitude: number;
};

const UF_BASE: GeoCoord = {
  latitude: 29.64655,
  longitude: -82.3472,
};

function hashCode(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function syntheticCoordForDevice(id: string): GeoCoord {
  const h = hashCode(id);
  const latJitter = ((h % 21) - 10) * 0.00018;
  const lngJitter = (((h / 21) % 21) - 10) * 0.00018;
  return {
    latitude: UF_BASE.latitude + latJitter,
    longitude: UF_BASE.longitude + lngJitter,
  };
}

export function nearbyLocationLabel(coord: GeoCoord): string {
  void coord;
  return 'Gainesville, FL';
}

