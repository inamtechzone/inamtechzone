import type { Metadata } from 'next';
import StoreApp from '../store-app';

export const metadata: Metadata = {
  title: 'Technical Products | INAM TECH ZONE',
  description: 'Shop professional hardware, electrical, CCTV, solar, networking, alarm, access control and fire safety products.',
};

export default function ProductsPage() {
  return <StoreApp initialView="shop" />;
}
