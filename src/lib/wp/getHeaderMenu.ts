export async function getHeaderMenu(): Promise<string> {
  const base = import.meta.env.WORDPRESS_API_URL.replace('/graphql', '');
  const res = await fetch(`${base}/wp-json/astro/v1/headermenu`);
  if (!res.ok) throw new Error("Failed to fetch options");
  return res.json(); // returns the string value
}