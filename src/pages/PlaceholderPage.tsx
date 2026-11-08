interface PlaceholderPageProps {
  title: string;
}

// Stand-in route content until the feature issue for each page lands.
export function PlaceholderPage({ title }: PlaceholderPageProps) {
  return <h1>{title}</h1>;
}
