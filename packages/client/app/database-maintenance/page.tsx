import CsvUpload from '@/components/CsvUpload';

export default function DatabaseMaintenancePage() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Airtable Database Maintenance Tools</h1>

      <div className="grid gap-6">
        <CsvUpload />
      </div>
    </div>
  );
}
