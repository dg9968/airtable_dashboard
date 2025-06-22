import HomePage from '@/components/HomePage';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tax Preparation Business Operations',
  description: 'Comprehensive business management system for tax preparation services, client management, and operational oversight',
};

export default function Home() {
  return <HomePage />;
}