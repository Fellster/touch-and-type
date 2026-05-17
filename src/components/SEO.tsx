import { Helmet } from "react-helmet-async";

type Props = {
  title: string;
  description: string;
  path: string;
};

const BASE_URL = "https://touch-and-type.lovable.app";

export default function SEO({ title, description, path }: Props) {
  const url = `${BASE_URL}${path}`;
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
    </Helmet>
  );
}
