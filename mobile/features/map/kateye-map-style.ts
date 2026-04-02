// google maps styling — only applied on android w/ google maps provider; ios falls back to mapType

export const kateyeMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1a1e24' }] },
  { featureType: 'water', stylers: [{ color: '#121416' }] },
  { featureType: 'landscape', stylers: [{ color: '#242a32' }] },
  { featureType: 'landscape.man_made', stylers: [{ color: '#2a3038' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.locality', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.neighborhood', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.province', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.country', stylers: [{ visibility: 'off' }] },
];
