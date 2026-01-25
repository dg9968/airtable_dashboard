/**
 * Template Engine for Variable Replacement
 * Handles dynamic variable substitution in message templates
 */

export interface VariableDefinition {
  name: string;
  label: string;
  type: 'airtable_field' | 'custom';
  source?: string; // Airtable field name (for type: 'airtable_field')
  required: boolean;
  defaultValue?: string;
}

export interface CorporateClient {
  id: string;
  name?: string;
  ein?: string;
  entityNumber?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string;
  clientCode?: string;
  [key: string]: any; // Allow additional fields
}

export interface VariableReplacementResult {
  result: string;
  missingVariables: string[];
}

/**
 * Field mapping from Airtable field names to client object properties
 */
const FIELD_MAPPING: Record<string, string> = {
  'Company': 'name',
  'Company Name': 'name',
  'EIN': 'ein',
  'Tax ID': 'ein',
  'Entity Number': 'entityNumber',
  'Business Partner Number': 'entityNumber',
  'Sunbiz Document Number': 'entityNumber',
  'Email': 'email',
  '🤷‍♂️Email': 'email',
  'ADDRESS': 'address',
  'Address': 'address',
  'CITY': 'city',
  'City': 'city',
  'STATE': 'state',
  'State': 'state',
  'ZIP CODE': 'zipCode',
  'Zip Code': 'zipCode',
  'Phone': 'phone',
  'Client Code': 'clientCode',
};

/**
 * Replace variables in a template string
 *
 * @param template - Template string with {{variable}} placeholders
 * @param variableValues - Custom variable values provided by user
 * @param clientData - Corporate client data from Airtable
 * @param variableDefinitions - Variable definitions from template
 * @returns Object with replaced text and list of missing required variables
 */
export function replaceVariables(
  template: string,
  variableValues: Record<string, any>,
  clientData: CorporateClient,
  variableDefinitions: VariableDefinition[]
): VariableReplacementResult {
  const missingVariables: string[] = [];
  const variableMap: Record<string, any> = {};

  // Step 1: Build variable map from Airtable fields
  variableDefinitions
    .filter((v) => v.type === 'airtable_field')
    .forEach((varDef) => {
      // Get the client data property name from the Airtable field name
      const propertyName = FIELD_MAPPING[varDef.source || ''] || varDef.source;

      // Get the value from client data
      let fieldValue = propertyName ? clientData[propertyName] : undefined;

      // Use default value if field is empty
      if (!fieldValue && varDef.defaultValue !== undefined) {
        fieldValue = varDef.defaultValue;
      }

      variableMap[varDef.name] = fieldValue || '';

      // Track missing required variables
      if (!fieldValue && varDef.required) {
        missingVariables.push(varDef.name);
      }
    });

  // Step 2: Add custom variables from user input
  variableDefinitions
    .filter((v) => v.type === 'custom')
    .forEach((varDef) => {
      const customValue = variableValues[varDef.name];

      // Use default value if not provided
      if (customValue === undefined && varDef.defaultValue !== undefined) {
        variableMap[varDef.name] = varDef.defaultValue;
      } else {
        variableMap[varDef.name] = customValue !== undefined ? customValue : '';
      }

      // Track missing required variables
      if (!customValue && varDef.required) {
        missingVariables.push(varDef.name);
      }
    });

  // Step 3: Replace all placeholders in template
  let result = template;

  Object.entries(variableMap).forEach(([key, value]) => {
    const placeholder = `{{${key}}}`;
    const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    result = result.replace(regex, String(value));
  });

  // Step 4: Check for unreplaced placeholders
  const unreplacedMatches = result.match(/\{\{(\w+)\}\}/g);
  if (unreplacedMatches) {
    unreplacedMatches.forEach((match) => {
      const varName = match.slice(2, -2); // Remove {{ and }}
      if (!missingVariables.includes(varName)) {
        missingVariables.push(varName);
      }
    });
  }

  return { result, missingVariables };
}

/**
 * Validate that all required variables are present
 *
 * @param variableValues - Custom variable values
 * @param clientData - Corporate client data
 * @param variableDefinitions - Variable definitions from template
 * @returns Object with validation status and missing variables
 */
export function validateVariables(
  variableValues: Record<string, any>,
  clientData: CorporateClient,
  variableDefinitions: VariableDefinition[]
): { valid: boolean; missingVariables: string[] } {
  const missingVariables: string[] = [];

  variableDefinitions.forEach((varDef) => {
    if (!varDef.required) return;

    if (varDef.type === 'airtable_field') {
      const propertyName = FIELD_MAPPING[varDef.source || ''] || varDef.source;
      const fieldValue = propertyName ? clientData[propertyName] : undefined;

      if (!fieldValue && !varDef.defaultValue) {
        missingVariables.push(varDef.name);
      }
    } else if (varDef.type === 'custom') {
      const customValue = variableValues[varDef.name];

      if (customValue === undefined && !varDef.defaultValue) {
        missingVariables.push(varDef.name);
      }
    }
  });

  return {
    valid: missingVariables.length === 0,
    missingVariables,
  };
}

/**
 * Extract all variable names from a template string
 *
 * @param template - Template string with {{variable}} placeholders
 * @returns Array of unique variable names found in template
 */
export function extractVariableNames(template: string): string[] {
  const matches = template.match(/\{\{(\w+)\}\}/g);
  if (!matches) return [];

  const variableNames = matches.map((match) => match.slice(2, -2));
  return Array.from(new Set(variableNames)); // Remove duplicates
}

/**
 * Render a complete message (subject + content) with variable replacement
 *
 * @param subjectTemplate - Subject template string
 * @param contentTemplate - Content template string
 * @param variableValues - Custom variable values
 * @param clientData - Corporate client data
 * @param variableDefinitions - Variable definitions
 * @returns Rendered subject and content with missing variables
 */
export function renderMessage(
  subjectTemplate: string,
  contentTemplate: string,
  variableValues: Record<string, any>,
  clientData: CorporateClient,
  variableDefinitions: VariableDefinition[]
): {
  subject: string;
  content: string;
  missingVariables: string[];
} {
  const subjectResult = replaceVariables(
    subjectTemplate,
    variableValues,
    clientData,
    variableDefinitions
  );

  const contentResult = replaceVariables(
    contentTemplate,
    variableValues,
    clientData,
    variableDefinitions
  );

  // Combine missing variables from both
  const allMissingVariables = Array.from(
    new Set([...subjectResult.missingVariables, ...contentResult.missingVariables])
  );

  return {
    subject: subjectResult.result,
    content: contentResult.result,
    missingVariables: allMissingVariables,
  };
}
