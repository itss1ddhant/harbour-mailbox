// Next.js settings.
//   serverExternalPackages  the database driver is loaded as-is at run time, not bundled
//   headers                 security headers sent with every page and API answer (below)

const dev = process.env.NODE_ENV !== "production";

// SECURITY HEADERS
// Instructions to the browser that limit what a page is allowed to do, so that if
// something does go wrong the damage is contained.
//
// Content-Security-Policy says where the page may load things from:
//   default-src 'self'        by default, only from this site
//   script-src                scripts only from this site. 'unsafe-inline' is needed because
//                             Next.js writes small inline scripts into each page; the
//                             stricter alternative (a one-time code per page, a "nonce")
//                             is a known next step. 'unsafe-eval' is for development only.
//   style-src                 styles from this site, plus inline styles
//   connect-src               the page may only call this site's own API
//                             (ws: in development is the live-reload connection)
//   frame-ancestors 'none'    no other site may show this one inside a frame
//   form-action / base-uri    forms and relative links cannot be pointed at another site
//   object-src 'none'         no plugins
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  `connect-src 'self'${dev ? " ws:" : ""}`,
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Older browsers' version of frame-ancestors: stops "clickjacking", where another site
  // shows ours invisibly and tricks a signed-in person into clicking.
  { key: "X-Frame-Options", value: "DENY" },
  // The browser must trust the declared file type and not guess.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Conversation ids are in our addresses; do not pass them on to other sites in links.
  { key: "Referrer-Policy", value: "same-origin" },
  // This app never needs the camera, microphone or location.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Once visited over HTTPS, always use HTTPS for the next two years. Ignored on http://localhost.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@libsql/client"],
  // Do not announce which framework runs the site.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
