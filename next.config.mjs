/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // football-data.org takım armaları (crest) bu domainlerden gelir
    remotePatterns: [
      { protocol: "https", hostname: "crests.football-data.org" },
      { protocol: "https", hostname: "**.football-data.org" },
    ],
  },
};
export default nextConfig;
