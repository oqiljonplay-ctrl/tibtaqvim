export interface LocationLinks {
  yandex: string;
  twoGis: string;
  google: string;
}

export function buildLocationLinks(lat: number, lng: number): LocationLinks {
  return {
    yandex: `https://yandex.com/maps/?ll=${lng},${lat}&z=17&pt=${lng},${lat}`,
    twoGis: `https://2gis.uz/geo/${lng},${lat}`,
    google: `https://maps.google.com/?q=${lat},${lng}`,
  };
}

export function buildAddressSearchLinks(address: string): LocationLinks {
  const encoded = encodeURIComponent(address);
  return {
    yandex: `https://yandex.com/maps/?text=${encoded}`,
    twoGis: `https://2gis.uz/search/${encoded}`,
    google: `https://maps.google.com/?q=${encoded}`,
  };
}

export function getLocationLinks(
  lat: number | null | undefined,
  lng: number | null | undefined,
  address: string | null | undefined
): { links: LocationLinks; isPrecise: boolean } | null {
  if (lat != null && lng != null) {
    return { links: buildLocationLinks(lat, lng), isPrecise: true };
  }
  if (address && address.trim().length >= 3) {
    return { links: buildAddressSearchLinks(address.trim()), isPrecise: false };
  }
  return null;
}
