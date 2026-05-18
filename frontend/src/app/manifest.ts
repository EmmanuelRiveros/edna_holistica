import { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Edna Lugo Holística',
    short_name: 'Sanación',
    description: 'Portal de pacientes para citas y expediente médico',
    start_url: '/',
    display: 'standalone', // Esto oculta la barra del navegador (parece app nativa)
    background_color: '#ffffff',
    theme_color: '#10b981', // Cambia esto por tu color principal (primary)
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}