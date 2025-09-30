---
import BaseLayout from "../../layouts/BaseLayout.astro";
import LayoutRenderer from "../../lib/wp/LayoutRenderer.astro";
import { getAllServiceAreaTermPaths, getFlexibleServiceAreaTermBySlug } from "../../lib/api";

export async function getStaticPaths() {
  return getAllServiceAreaTermPaths();
}

const { slug } = Astro.params;
const term = getFlexibleServiceAreaTermBySlug(slug);

if (!term) return Astro.redirect("/404");
const title = term.title || (slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
---

<BaseLayout title={title}>
  <LayoutRenderer layouts={term.layouts || []} />
</BaseLayout>
