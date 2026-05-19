import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://siyaram-mitra-mandal.vercel.app/';

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/dashboard', '/api/', '/profile'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
