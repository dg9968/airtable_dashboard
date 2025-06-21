// app/api/bookkeeping/route.ts
import { NextResponse } from 'next/server';
import { fetchAllTableData, testConnection } from '@/lib/airtable';

export async function GET() {
  try {
    // Test connection first
    const connectionTest = await testConnection();
    if (!connectionTest.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Connection failed: ${connectionTest.message}`,
          suggestion: 'Please check your AIRTABLE_PERSONAL_ACCESS_TOKEN and AIRTABLE_BASE_ID in .env.local'
        },
        { status: 401 }
      );
    }

    // Try multiple possible table names
    const possibleTableNames = [
      'Subscriptions Corporate',
      'Subscription Corporate',
      'Corporate Subscriptions', 
      'Subscriptions',
      'Corporate',
      'Clients',
      'Companies',
      'Business Clients',
      'Corporate Clients',
      'Subscription',
      'Services'
    ];
    
    let records;
    let actualTableName = '';
    let tableFound = false;
    
    for (const tableName of possibleTableNames) {
      try {
        console.log(`Trying table: ${tableName}`);
        records = await fetchAllTableData(tableName); // Fetch ALL records
        actualTableName = tableName;
        tableFound = true;
        console.log(`Successfully found table: ${tableName} with ${records.length} total records`);
        break;
      } catch (error) {
        console.log(`Table "${tableName}" not found, trying next...`);
        continue;
      }
    }
    
    if (!tableFound) {
      try {
        const { getTablesMetadata } = await import('@/lib/airtable');
        const availableTables = await getTablesMetadata();
        
        return NextResponse.json({
          success: false,
          error: 'No matching table found',
          suggestion: 'Please check your table names. Here are the available tables in your base:',
          availableTables: availableTables.map(t => t.name),
          searchedFor: possibleTableNames
        }, { status: 404 });
      } catch (metaError) {
        return NextResponse.json({
          success: false,
          error: 'Could not find any suitable table for bookkeeping data',
          suggestion: `Please create a table with one of these names: ${possibleTableNames.join(', ')} or update the API to use your actual table name`,
          searchedFor: possibleTableNames
        }, { status: 404 });
      }
    }

    // STEP 1: Filter for Active status first
    const activeRecords = records.filter(record => {
      const status = record.fields.Status || record.fields.status || '';
      return status.toString().toLowerCase() === 'active';
    });

    console.log(`Found ${activeRecords.length} Active records out of ${records.length} total records`);

    if (activeRecords.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No Active status records found',
        suggestion: 'Make sure your records have a Status field set to "Active"',
        debug: {
          totalRecords: records.length,
          tableName: actualTableName,
          activeRecords: 0,
          searchedFor: 'Status = Active',
          sampleStatuses: records.slice(0, 10).map(r => ({
            id: r.id,
            companyName: r.fields['Company Name'] || r.fields.Name || 'Unknown',
            status: r.fields.Status || r.fields.status || 'No status field'
          }))
        }
      }, { status: 404 });
    }

    // STEP 2: From Active records, filter for "Bookkeeping Clients" service
    const bookkeepingClients = activeRecords.filter(record => {
      // Lookup fields can be in various field names
      const services = record.fields.Services || 
                      record.fields.Service || 
                      record.fields['Service Type'] || 
                      record.fields['Services Subscribed'] ||
                      record.fields['Subscription Services'] ||
                      record.fields['Plan Services'] ||
                      record.fields['Service Name'] ||
                      record.fields['Services Corporate'] ||
                      record.fields['Linked Services'] ||
                      '';
      
      // Debug logging for arrays
      if (Array.isArray(services) && services.length > 0) {
        console.log(`Checking services array for record ${record.id}:`, services);
      }
      
      // Handle arrays (most common for lookup fields)
      if (Array.isArray(services)) {
        const hasBookkeeping = services.some(service => {
          const serviceStr = String(service).trim();
          const isMatch = serviceStr === 'Bookkeeping Clients' || 
                         serviceStr.toLowerCase() === 'bookkeeping clients';
          
          if (isMatch) {
            console.log(`✓ Found match in array: "${serviceStr}" for record ${record.id}`);
          }
          return isMatch;
        });
        return hasBookkeeping;
      } 
      // Handle single string values
      else if (typeof services === 'string' && services.trim()) {
        const serviceStr = services.trim();
        const isMatch = serviceStr === 'Bookkeeping Clients' || 
                       serviceStr.toLowerCase() === 'bookkeeping clients';
        
        if (isMatch) {
          console.log(`✓ Found match in string: "${serviceStr}" for record ${record.id}`);
        }
        return isMatch;
      }
      
      return false;
    });

    if (bookkeepingClients.length === 0) {
      // Get sample services from Active records to help debug arrays
      const sampleServices = activeRecords.slice(0, 15).map(r => {
        const services = r.fields.Services || 
                        r.fields.Service || 
                        r.fields['Service Type'] || 
                        r.fields['Services Subscribed'] ||
                        r.fields['Subscription Services'] ||
                        r.fields['Plan Services'] ||
                        r.fields['Service Name'] ||
                        r.fields['Services Corporate'] ||
                        r.fields['Linked Services'] ||
                        null;

        return {
          id: r.id,
          companyName: r.fields['Company Name'] || r.fields.Name || r.fields.Company || r.fields['Client Name'] || 'Unknown',
          status: r.fields.Status || r.fields.status || 'No status',
          services: services,
          servicesType: Array.isArray(services) ? 'Array' : typeof services,
          servicesCount: Array.isArray(services) ? services.length : (services ? 1 : 0),
          servicesArray: Array.isArray(services) ? services : [services],
          hasBookkeepingClients: Array.isArray(services) 
            ? services.some(s => String(s).toLowerCase().includes('bookkeeping'))
            : String(services || '').toLowerCase().includes('bookkeeping'),
          allServiceValues: Array.isArray(services) ? services.join(' | ') : String(services || 'null')
        };
      });

      // Count how many Active records have arrays vs strings vs empty
      const arrayCount = sampleServices.filter(s => s.servicesType === 'Array').length;
      const stringCount = sampleServices.filter(s => s.servicesType === 'string').length;
      const nullCount = sampleServices.filter(s => !s.services).length;

      return NextResponse.json({
        success: false,
        error: 'No "Bookkeeping Clients" service subscribers found among Active records',
        suggestion: 'Check the exact spelling and case of "Bookkeeping Clients" in your Services Corporate table',
        debug: {
          totalRecords: records.length,
          activeRecords: activeRecords.length,
          bookkeepingClientsFound: 0,
          tableName: actualTableName,
          sampleRecords: sampleServices,
          searchedFor: 'Status = Active AND Services array contains "Bookkeeping Clients"',
          note: 'Looking for "Bookkeeping Clients" as an element in Services arrays',
          serviceFieldStats: {
            arraysFound: arrayCount,
            stringsFound: stringCount,
            nullOrEmptyFound: nullCount,
            recordsWithBookkeepingInName: sampleServices.filter(s => s.hasBookkeepingClients).length
          }
        }
      }, { status: 404 });
    }

    // Calculate statistics for Active Bookkeeping Clients subscribers
    // Note: All bookkeepingClients are already Active (filtered in step 1)
    const activeClients = bookkeepingClients.length; // All are active by definition

    const monthlyRevenue = bookkeepingClients.reduce((sum, record) => {
      const fee = record.fields['Monthly Fee'] || 
                 record.fields.Fee || 
                 record.fields.Amount || 
                 record.fields['Subscription Fee'] || 0;
      return sum + (typeof fee === 'number' ? fee : parseFloat(fee) || 0);
    }, 0);

    const averageFee = bookkeepingClients.length > 0 
      ? bookkeepingClients.reduce((sum, record) => {
          const fee = record.fields['Monthly Fee'] || 
                     record.fields.Fee || 
                     record.fields.Amount || 
                     record.fields['Subscription Fee'] || 0;
          return sum + (typeof fee === 'number' ? fee : parseFloat(fee) || 0);
        }, 0) / bookkeepingClients.length
      : 0;

    const recentClients = bookkeepingClients.filter(record => {
      const createdDate = new Date(record.createdTime);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      return createdDate > thirtyDaysAgo;
    }).length;

    const stats = {
      totalClients: bookkeepingClients.length,
      activeClients, // All are active
      monthlyRevenue: Math.round(monthlyRevenue),
      averageFee: Math.round(averageFee),
      recentClients
    };

    return NextResponse.json({
      success: true,
      data: {
        subscriptions: bookkeepingClients,
        stats,
        tableName: actualTableName,
        totalRecordsInTable: records.length,
        activeRecordsInTable: activeRecords.length,
        bookkeepingClientsFound: bookkeepingClients.length,
        bookkeepingServiceId: bookkeepingServiceId,
        searchMethod: bookkeepingServiceId ? 'Record ID lookup in Services field' : 'Could not get service ID',
        serviceSearched: 'Bookkeeping Clients',
        filterApplied: bookkeepingServiceId 
          ? `Status = Active AND Services lookup field contains ID: ${bookkeepingServiceId}`
          : 'Status = Active (could not get Bookkeeping Clients service ID)'
      }
    });

  } catch (error) {
    console.error('Error in bookkeeping API route:', error);
    
    let errorMessage = 'Failed to fetch bookkeeping clients data';
    let suggestion = 'Please check your configuration and try again';
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
      if (error.message.includes('Table') && error.message.includes('not found')) {
        suggestion = 'Please check that you have a table with subscription data in your Airtable base';
      } else if (error.message.includes('AIRTABLE_PERSONAL_ACCESS_TOKEN')) {
        suggestion = 'Create a Personal Access Token at https://airtable.com/create/tokens with data.records:read scope';
      } else if (error.message.includes('AIRTABLE_BASE_ID')) {
        suggestion = 'Check your Base ID in the Airtable URL or API documentation';
      }
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        suggestion
      },
      { status: 500 }
    );
  }
}