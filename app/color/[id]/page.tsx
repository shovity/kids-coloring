import ColoringScreen from "@/components/ColoringScreen";
import { manifest } from "@/lib/manifest";

export const dynamicParams = false;

export function generateStaticParams() {
  return manifest.packs.flatMap((p) => p.pages.map((page) => ({ id: page.id })));
}

export default async function ColorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ColoringScreen pageId={id} />;
}
