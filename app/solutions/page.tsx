import type { Metadata } from 'next';
import StoreApp from '../store-app';

export const metadata: Metadata = {
  title: 'Complete Technical Solutions | INAM TECH ZONE',
  description: 'Complete CCTV, solar, networking, access control, safety, electrical and workshop solutions designed around real project requirements.',
};

export default function SolutionsPage() {
  return <StoreApp initialView="solutions" />;
}
