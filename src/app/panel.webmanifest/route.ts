import { adminManifest } from "@/lib/manifest";

// Lives outside /admin on purpose: browsers fetch manifests without cookies,
// so under /admin the auth proxy would redirect it to the login page.
export function GET() {
  return new Response(JSON.stringify(adminManifest()), {
    headers: { "Content-Type": "application/manifest+json; charset=utf-8" },
  });
}
