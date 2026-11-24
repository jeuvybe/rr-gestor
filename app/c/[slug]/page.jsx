import AreaCliente from '@/components/AreaCliente';

export const metadata = { title: 'Área do cliente', robots: { index: false } };

export default async function Page({ params }) {
  const { slug } = await params;
  return <AreaCliente slug={slug} />;
}
