import { Link } from "react-router";
import { PageHero, useTitle } from "../components/ui";

export function NotFoundPage({ what = "page" }: { what?: string }) {
  useTitle("Not found");
  return (
    <PageHero eyebrow="404" title={`This ${what} isn't here.`}>
      It may have been moved or taken down.{" "}
      <Link to="/shop" className="link text-ink">
        Back to the shop
      </Link>
    </PageHero>
  );
}
