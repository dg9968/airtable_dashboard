/**
 * Family Record Helper Functions (Postgres-backed)
 * Handles creation and linking of spouse and dependent records in the personal table
 */

import { sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { personal, personalRelationships } from '../db/schema';
import { personalToAirtableRecord, loadPersonalRelationships, computeClientCode } from '../db/serializers';

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
 * Search for existing person by SSN.
 * Compares digits-only on both sides, so it matches regardless of whether the
 * stored SSN has dashes (the legacy Airtable lookup missed dash-formatted rows).
 */
export async function findPersonBySSN(ssn: string): Promise<PersonalRecord | null> {
  try {
    const cleanSSN = ssn.replace(/\D/g, '');
    if (!cleanSSN) return null;

    const db = getDb();
    const rows = await db
      .select()
      .from(personal)
      .where(sql`regexp_replace(coalesce(${personal.ssn}, ''), '\\D', '', 'g') = ${cleanSSN}`)
      .limit(1);

    if (rows.length === 0) return null;

    const { relMap, lookup } = await loadPersonalRelationships(db, [rows[0].id]);
    return personalToAirtableRecord(rows[0], relMap.get(rows[0].id), lookup);
  } catch (error) {
    console.error('Error finding person by SSN:', error);
    return null;
  }
}

/** Shared insert for spouse/dependent rows. */
async function createFamilyMember(
  data: FamilyMemberData,
  taxYear: string
): Promise<OperationResult> {
  try {
    const ssn = data.ssn.replace(/-/g, '');

    const [row] = await getDb()
      .insert(personal)
      .values({
        firstName: data.firstName,
        lastName: data.lastName,
        ssn,
        dateOfBirth: data.dob,
        taxYear: parseInt(taxYear, 10) || null,
        occupation: data.occupation || null,
        driverLicense: data.driverLicense || null,
        mailingAddress: data.address || null,
        city: data.city || null,
        state: data.state || null,
        zip: data.zip || null,
        phone: data.phone || null,
        email: data.email || null,
        // Like the Airtable formula: no override for family members, so the
        // client code is the last 4 digits of the SSN.
        clientCode: computeClientCode(null, ssn),
      })
      .returning({ id: personal.id });

    return { success: true, recordId: row.id };
  } catch (error) {
    console.error('Error creating family member record:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error creating record',
    };
  }
}

/**
 * Create a new personal record for spouse
 */
export async function createSpouseRecord(
  spouseData: FamilyMemberData,
  taxYear: string
): Promise<OperationResult> {
  return createFamilyMember(spouseData, taxYear);
}

/**
 * Create bidirectional spouse link between two persons (two rows, like the
 * bidirectional Airtable link field).
 */
export async function linkSpouses(
  personAId: string,
  personBId: string
): Promise<OperationResult> {
  try {
    await getDb()
      .insert(personalRelationships)
      .values([
        {
          id: `${personAId}:spouse:${personBId}`,
          personalId: personAId,
          relatedPersonalId: personBId,
          relationship: 'spouse',
        },
        {
          id: `${personBId}:spouse:${personAId}`,
          personalId: personBId,
          relatedPersonalId: personAId,
          relationship: 'spouse',
        },
      ])
      .onConflictDoNothing();

    return { success: true };
  } catch (error) {
    console.error('Error linking spouses:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error linking spouses',
    };
  }
}

/**
 * Create a new personal record for dependent
 */
export async function createDependentRecord(
  dependentData: DependentData,
  taxYear: string
): Promise<OperationResult> {
  return createFamilyMember(dependentData, taxYear);
}

/**
 * Link dependent to primary taxpayer
 */
export async function linkDependent(
  primaryId: string,
  dependentId: string,
  relationshipType: 'Child' | 'Parent' | 'Other Dependent'
): Promise<OperationResult> {
  try {
    const relationship =
      relationshipType === 'Child' ? 'child'
      : relationshipType === 'Parent' ? 'parent'
      : 'dependent';

    await getDb()
      .insert(personalRelationships)
      .values({
        id: `${primaryId}:${relationship}:${dependentId}`,
        personalId: primaryId,
        relatedPersonalId: dependentId,
        relationship,
      })
      .onConflictDoNothing();

    return { success: true };
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
 */
export function validateUniqueFamilySSN(
  primarySSN: string,
  spouseSSN?: string,
  dependentSSNs?: string[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const ssnSet = new Set<string>();

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
