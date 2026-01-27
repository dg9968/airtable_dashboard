/**
 * Family Record Helper Functions
 * Handles creation and linking of spouse and dependent records in Airtable Personal table
 */

import { fetchAllRecords, createRecords, updateRecords } from './airtable-helpers.js';

const baseId = process.env.AIRTABLE_BASE_ID!;
const tableName = 'Personal';

export interface FamilyMemberData {
  firstName: string;
  lastName: string;
  ssn: string;
  dob: string;
  occupation?: string;
  driverLicense?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  email?: string;
}

export interface DependentData extends FamilyMemberData {
  relationshipType: 'Child' | 'Parent' | 'Other Dependent';
}

export interface PersonalRecord {
  id: string;
  fields: Record<string, any>;
  createdTime?: string;
}

export interface OperationResult {
  success: boolean;
  recordId?: string;
  error?: string;
}

/**
 * Parse first and last name from full name
 */
function parseFirstName(fullName: string): string {
  return fullName.trim().split(' ')[0] || '';
}

function parseLastName(fullName: string): string {
  const parts = fullName.trim().split(' ');
  return parts.length > 1 ? parts.slice(1).join(' ') : '';
}

/**
 * Search for existing person by SSN
 * @param ssn - Social Security Number (can include dashes)
 * @returns PersonalRecord if found, null otherwise
 */
export async function findPersonBySSN(ssn: string): Promise<PersonalRecord | null> {
  try {
    // Remove dashes from SSN for comparison
    const cleanSSN = ssn.replace(/-/g, '');

    // Use filterByFormula to search for SSN
    const formula = `{SSN} = "${cleanSSN}"`;

    const records = await fetchAllRecords(baseId, tableName, {
      filterByFormula: formula,
    });

    return records.length > 0 ? records[0] : null;
  } catch (error) {
    console.error('Error finding person by SSN:', error);
    return null;
  }
}

/**
 * Create a new Personal record for spouse
 * @param spouseData - Spouse information
 * @param taxYear - Tax year for the record
 * @returns Operation result with record ID if successful
 */
export async function createSpouseRecord(
  spouseData: FamilyMemberData,
  taxYear: string
): Promise<OperationResult> {
  try {
    const fields: Record<string, any> = {
      'First Name': spouseData.firstName,
      'Last Name': spouseData.lastName,
      'SSN': spouseData.ssn.replace(/-/g, ''), // Remove dashes
      'Date of Birth': spouseData.dob,
      'Tax Year': parseInt(taxYear, 10),
    };

    // Add optional fields if provided
    if (spouseData.occupation) {
      fields['Occupation'] = spouseData.occupation;
    }

    if (spouseData.driverLicense) {
      fields['Drivers License / State ID'] = spouseData.driverLicense;
    }

    if (spouseData.address) {
      fields['Mailing Address'] = spouseData.address;
    }

    if (spouseData.city) {
      fields['City'] = spouseData.city;
    }

    if (spouseData.state) {
      fields['State'] = spouseData.state;
    }

    if (spouseData.zip) {
      fields['ZIP'] = spouseData.zip;
    }

    if (spouseData.phone) {
      fields['📞Phone number'] = spouseData.phone;
    }

    if (spouseData.email) {
      fields['Email'] = spouseData.email;
    }

    const createdRecords = await createRecords(baseId, tableName, [{ fields }]);

    if (createdRecords && createdRecords.length > 0) {
      return {
        success: true,
        recordId: createdRecords[0].id,
      };
    }

    return {
      success: false,
      error: 'Failed to create spouse record',
    };
  } catch (error) {
    console.error('Error creating spouse record:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error creating spouse record',
    };
  }
}

/**
 * Create bidirectional spouse link between two persons
 * Updates both Person A and Person B to point to each other
 * @param personAId - ID of first person
 * @param personBId - ID of second person (spouse)
 * @returns Operation result
 */
export async function linkSpouses(
  personAId: string,
  personBId: string
): Promise<OperationResult> {
  try {
    // Update both records in a single batch to create bidirectional link
    const updates = [
      {
        id: personAId,
        fields: {
          'Spouse (Linked)': [personBId],
        },
      },
      {
        id: personBId,
        fields: {
          'Spouse (Linked)': [personAId],
        },
      },
    ];

    await updateRecords(baseId, tableName, updates);

    return {
      success: true,
    };
  } catch (error) {
    console.error('Error linking spouses:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error linking spouses',
    };
  }
}

/**
 * Create a new Personal record for dependent
 * @param dependentData - Dependent information
 * @param taxYear - Tax year for the record
 * @returns Operation result with record ID if successful
 */
export async function createDependentRecord(
  dependentData: DependentData,
  taxYear: string
): Promise<OperationResult> {
  try {
    const fields: Record<string, any> = {
      'First Name': dependentData.firstName,
      'Last Name': dependentData.lastName,
      'SSN': dependentData.ssn.replace(/-/g, ''), // Remove dashes
      'Date of Birth': dependentData.dob,
      'Tax Year': parseInt(taxYear, 10),
    };

    // Add optional fields if provided
    if (dependentData.occupation) {
      fields['Occupation'] = dependentData.occupation;
    }

    if (dependentData.driverLicense) {
      fields['Drivers License / State ID'] = dependentData.driverLicense;
    }

    if (dependentData.address) {
      fields['Mailing Address'] = dependentData.address;
    }

    if (dependentData.city) {
      fields['City'] = dependentData.city;
    }

    if (dependentData.state) {
      fields['State'] = dependentData.state;
    }

    if (dependentData.zip) {
      fields['ZIP'] = dependentData.zip;
    }

    if (dependentData.phone) {
      fields['📞Phone number'] = dependentData.phone;
    }

    if (dependentData.email) {
      fields['Email'] = dependentData.email;
    }

    const createdRecords = await createRecords(baseId, tableName, [{ fields }]);

    if (createdRecords && createdRecords.length > 0) {
      return {
        success: true,
        recordId: createdRecords[0].id,
      };
    }

    return {
      success: false,
      error: 'Failed to create dependent record',
    };
  } catch (error) {
    console.error('Error creating dependent record:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error creating dependent record',
    };
  }
}

/**
 * Link dependent to primary taxpayer
 * @param primaryId - ID of primary taxpayer
 * @param dependentId - ID of dependent
 * @param relationshipType - Type of relationship (Child, Parent, Other Dependent)
 * @returns Operation result
 */
export async function linkDependent(
  primaryId: string,
  dependentId: string,
  relationshipType: 'Child' | 'Parent' | 'Other Dependent'
): Promise<OperationResult> {
  try {
    // Determine which field to use based on relationship type
    let linkField: string;

    if (relationshipType === 'Child') {
      linkField = 'Child (Linked)';
    } else if (relationshipType === 'Parent') {
      linkField = 'Parent (Linked)';
    } else {
      linkField = 'Dependent (Linked)';
    }

    // First, fetch the current primary record to get existing links
    const apiKey = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;
    if (!apiKey) {
      throw new Error('AIRTABLE_PERSONAL_ACCESS_TOKEN not configured');
    }

    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}/${primaryId}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch primary record: ${response.statusText}`);
    }

    const record = await response.json() as { fields: Record<string, any> };
    const existingLinks = record.fields[linkField] || [];

    // Add new dependent to existing links (avoid duplicates)
    const updatedLinks = existingLinks.includes(dependentId)
      ? existingLinks
      : [...existingLinks, dependentId];

    // Update primary record with new link
    await updateRecords(baseId, tableName, [
      {
        id: primaryId,
        fields: {
          [linkField]: updatedLinks,
        },
      },
    ]);

    return {
      success: true,
    };
  } catch (error) {
    console.error('Error linking dependent:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error linking dependent',
    };
  }
}

/**
 * Validate that all SSNs in the family are unique
 * @param primarySSN - Primary taxpayer's SSN
 * @param spouseSSN - Spouse's SSN (optional)
 * @param dependentSSNs - Array of dependent SSNs (optional)
 * @returns Validation result with any error messages
 */
export function validateUniqueFamilySSN(
  primarySSN: string,
  spouseSSN?: string,
  dependentSSNs?: string[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const ssnSet = new Set<string>();

  // Normalize SSNs (remove dashes)
  const cleanPrimarySSN = primarySSN.replace(/-/g, '');
  ssnSet.add(cleanPrimarySSN);

  if (spouseSSN) {
    const cleanSpouseSSN = spouseSSN.replace(/-/g, '');
    if (ssnSet.has(cleanSpouseSSN)) {
      errors.push('Spouse SSN cannot be the same as primary taxpayer SSN');
    } else {
      ssnSet.add(cleanSpouseSSN);
    }
  }

  if (dependentSSNs && dependentSSNs.length > 0) {
    dependentSSNs.forEach((ssn, index) => {
      const cleanSSN = ssn.replace(/-/g, '');
      if (ssnSet.has(cleanSSN)) {
        errors.push(`Dependent #${index + 1} SSN must be unique within the family`);
      } else {
        ssnSet.add(cleanSSN);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Helper function to parse name into first and last name
 * Exported for use in API endpoints
 */
export function parseName(fullName: string): { firstName: string; lastName: string } {
  return {
    firstName: parseFirstName(fullName),
    lastName: parseLastName(fullName),
  };
}
