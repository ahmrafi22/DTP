import { MapWorkspace } from "@/components/map/workspace";

/**
 * The map workspace is a pure client shell — the living fleet, rides and
 * fares all come from the Express API (GET /map/live + polling endpoints),
 * so there is nothing to fetch or prerender here beyond the frame.
 */
export default function Home() {
  return <MapWorkspace />;
}
