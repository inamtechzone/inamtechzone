import type { Metadata } from 'next';
import StoreApp from '../store-app';

export const metadata: Metadata = {
  title: 'Support Center | INAM TECH ZONE',
  description: 'Order tracking, technical assistance, quotations, product compatibility, warranty guidance and project support.',
};

export default function SupportPage() {
  return <StoreApp initialView="support" />;
}
