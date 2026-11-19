import type { MetadataRoute } from "next";
import { customerManifest } from "@/lib/manifest";

export default function manifest(): MetadataRoute.Manifest {
  return customerManifest();
}
