import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Fantasy Bake Off',
    short_name: 'Bake Off',
    description: 'Family fantasy game for The Great British Baking Show',
    start_url: '/',
    display: 'standalone',
    background_color: '#FAF7F2',
    theme_color: '#C8902E',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}
