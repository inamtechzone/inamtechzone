import type { Metadata } from 'next';
import StoreApp from '../store-app';

export const metadata: Metadata = {
  title: 'Professional Technical Services | INAM TECH ZONE',
  description: 'Technical consultation, site survey planning, system design, BOQ, sourcing, installation coordination and maintenance planning.',
};

export default function ServicesPage() {
  return <StoreApp initialView="services" />;
}
